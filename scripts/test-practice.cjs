/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { setup, load } = require('./lms-test-harness.cjs');
(async () => {
  const h = await setup();
  try {
    const { pool, lms, root } = h;
    for (const f of ['013_examinations.sql', '014_exam_result_publication.sql', '017_practice_exams.sql']) await pool.query(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'));
    await pool.query(fs.readFileSync(path.join(root, 'migrations/017_practice_exams.sql'), 'utf8')); // idempotent
    const errors = load('lib/learning-errors.ts');
    const mocks = { ...h.mocks, '@/lib/lms': lms, '@/lib/learning-errors': errors };
    mocks['@/lib/exam-validation'] = load('lib/exam-validation.ts', mocks);
    mocks['@/lib/exams'] = load('lib/exams.ts', mocks);
    const exams = mocks['@/lib/exams']; const practice = load('lib/practice.ts', mocks);

    const A = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('A','a',true) RETURNING id")).rows[0].id;
    const B = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('B','b',true) RETURNING id")).rows[0].id;
    const s1 = (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES('S1','p1@example.test','0000000010','student',$1) RETURNING id", [A])).rows[0].id;
    const s2 = (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES('S2','p2@example.test','0000000011','student',$1) RETURNING id", [A])).rows[0].id;
    const outsider = (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES('O','p3@example.test','0000000012','student',$1) RETURNING id", [B])).rows[0].id;
    const M = (await pool.query("INSERT INTO modules(title,is_published) VALUES('Module',true) RETURNING id")).rows[0].id;
    await pool.query('INSERT INTO course_modules(course_id,module_id) VALUES($1,$2)', [A, M]);
    const bank = await exams.saveBank(A, M, [1, 2, 3, 4].map((n) => ({ prompt: `Q${n}`, options: ['a', 'b', 'c'], answer_index: n % 3 })));
    const data = { course_id: A, module_id: M, title: 'Practice 1', pass_percent: 50, question_ids: bank.map((q) => q.id) };

    // admin validation
    await assert.rejects(practice.savePractice({ ...data, question_ids: [] }), /1–200/);
    await assert.rejects(practice.savePractice({ ...data, pass_percent: 101 }), /Pass/);
    await assert.rejects(practice.savePractice({ ...data, course_id: B }), /belong/);
    await assert.rejects(practice.savePractice({ ...data, title: '  ' }), /Title/);
    const p = await practice.savePractice(data);
    assert.equal(p.is_published, false); assert.equal(p.question_count, 4);
    await practice.savePractice({ ...data, title: 'Practice 1b' }, p.id); // practice sets stay editable
    // not visible while draft
    assert.equal((await practice.studentPractice(A, s1)).length, 0);
    await assert.rejects(practice.practiceAttempt({ practiceId: p.id, courseId: A, studentId: s1, action: 'start' }), /not available/);
    await practice.setPracticePublished(p.id, true);
    const list = await practice.studentPractice(A, s1);
    assert.equal(list.length, 1); assert.equal(list[0].my_attempts, 0); assert.equal(JSON.stringify(list).includes('question_ids'), false);
    assert.equal((await practice.studentPractice(B, outsider)).length, 0, 'other course sees nothing');
    await assert.rejects(practice.practiceAttempt({ practiceId: p.id, courseId: B, studentId: outsider, action: 'start' }), /not available/);

    // attempt 1: key hidden until submit, start resumes, answers merge
    const base = { practiceId: p.id, courseId: A, studentId: s1 };
    assert.equal(await practice.practiceAttempt({ ...base, action: 'read' }), null);
    const [x, y] = await Promise.all([practice.practiceAttempt({ ...base, action: 'start' }), practice.practiceAttempt({ ...base, action: 'start' })]);
    assert.equal(x.id, y.id, 'concurrent starts make one attempt');
    assert.equal(JSON.stringify(x).includes('answer_index'), false); assert.equal(x.result, null);
    const stored = (await pool.query('SELECT * FROM practice_attempts WHERE id=$1', [x.id])).rows[0];
    const key = Object.fromEntries(stored.questions.map((q) => [q.id, q.answer_index]));
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'save', answers: { [bank[0].id]: 99 } }), /Invalid/);
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'save', answers: { 'not-a-question': 0 } }), /Invalid/);
    const saved = await practice.practiceAttempt({ ...base, action: 'save', answers: { [bank[0].id]: key[bank[0].id] } });
    assert.equal(Object.keys(saved.answers).length, 1);
    assert.equal((await practice.studentPractice(A, s1))[0].my_in_progress, true);
    // submit: 3 right (one saved earlier + two now), 1 wrong => 75%, result shown at once with the answer key
    const wrong = (key[bank[3].id] + 1) % 3;
    const done = await practice.practiceAttempt({ ...base, action: 'submit', answers: { [bank[1].id]: key[bank[1].id], [bank[2].id]: key[bank[2].id], [bank[3].id]: wrong } });
    assert.ok(done.submitted_at); assert.equal(done.result.score_percent, 75); assert.equal(done.result.passed, true);
    assert.equal(done.result.questions.length, 4); assert.ok(done.result.questions.every((q) => q.correct_answer));
    // a finished attempt cannot be edited or resubmitted
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'submit', answers: {} }), /Start/);
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'save', answers: {} }), /Start/);
    const read = await practice.practiceAttempt({ ...base, action: 'read' });
    assert.equal(read.result.score_percent, 75);

    // retake: unlimited, new attempt each time, history keeps all
    const again = await practice.practiceAttempt({ ...base, action: 'start' });
    assert.notEqual(again.id, x.id); assert.equal(again.result, null); assert.deepEqual(again.answers, {});
    const k2 = Object.fromEntries((await pool.query('SELECT questions FROM practice_attempts WHERE id=$1', [again.id])).rows[0].questions.map((q) => [q.id, q.answer_index]));
    const perfect = await practice.practiceAttempt({ ...base, action: 'submit', answers: k2 });
    assert.equal(perfect.result.score_percent, 100);
    for (let i = 0; i < 3; i++) { await practice.practiceAttempt({ ...base, action: 'start' }); await practice.practiceAttempt({ ...base, action: 'submit', answers: {} }); }
    const hist = await practice.practiceHistory(p.id, A, s1);
    assert.equal(hist.length, 5); assert.equal(hist[hist.length - 1].score_percent, 75); assert.equal(hist[hist.length - 1].total, 4);
    const mine = (await practice.studentPractice(A, s1))[0];
    assert.equal(mine.my_attempts, 5); assert.equal(mine.my_best_percent, 100); assert.equal(mine.my_last_percent, 0); assert.equal(mine.my_in_progress, false);
    // other student unaffected / cannot see this student's work
    assert.equal((await practice.studentPractice(A, s2))[0].my_attempts, 0);
    assert.equal((await practice.practiceHistory(p.id, A, s2)).length, 0);
    assert.equal(await practice.practiceAttempt({ practiceId: p.id, courseId: A, studentId: s2, action: 'read' }), null);
    // real exams are untouched
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM exam_attempts')).rows[0].n, 0);

    // admin stats, unpublish hides (attempts kept), republish restores
    const stat = (await practice.adminPractice(A))[0]; assert.equal(stat.attempts, 5); assert.equal(stat.students, 1);
    await practice.setPracticePublished(p.id, false);
    assert.equal((await practice.studentPractice(A, s1)).length, 0);
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'start' }), /not available/);
    await practice.setPracticePublished(p.id, true);
    assert.equal((await practice.studentPractice(A, s1))[0].my_attempts, 5);
    // a bank question removed => the next retake simply has fewer questions
    await pool.query('DELETE FROM question_bank WHERE id=$1', [bank[0].id]);
    assert.equal((await practice.practiceAttempt({ ...base, action: 'start' })).questions.length, 3);
    await practice.practiceAttempt({ ...base, action: 'submit', answers: {} });
    // an unpublished module blocks publishing
    await pool.query('UPDATE modules SET is_published=false WHERE id=$1', [M]);
    await practice.setPracticePublished(p.id, false);
    await assert.rejects(practice.setPracticePublished(p.id, true), /Publish the course and module/);
    await pool.query('UPDATE modules SET is_published=true WHERE id=$1', [M]);
    await assert.rejects(practice.setPracticePublished('00000000-0000-4000-8000-000000000000', true), /not found/);

    // delete: the set and every attempt vanish for students
    await practice.deletePractice(p.id);
    assert.equal((await practice.studentPractice(A, s1)).length, 0);
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM practice_attempts')).rows[0].n, 0);
    await assert.rejects(practice.deletePractice(p.id), /not found/);
    await assert.rejects(practice.practiceAttempt({ ...base, action: 'read' }), /not available/);
    console.log('practice exam rules ok');
  } finally { await h.cleanup(); }
})().catch((e) => { console.error(e); process.exit(1); });
