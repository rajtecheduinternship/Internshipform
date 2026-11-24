/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { setup, load } = require('./lms-test-harness.cjs');
(async () => {
  const h = await setup();
  try {
    const { pool, lms, root } = h;
    for (const f of ['013_examinations.sql', '014_exam_result_publication.sql', '017_practice_exams.sql']) await pool.query(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'));
    // legacy data present BEFORE 018 must be carried over
    const L = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('Legacy','legacy',true) RETURNING id")).rows[0].id;
    const LM = (await pool.query("INSERT INTO modules(title,is_published) VALUES('LM',true) RETURNING id")).rows[0].id;
    await pool.query('INSERT INTO course_modules(course_id,module_id) VALUES($1,$2)', [L, LM]);
    const lq = (await pool.query("INSERT INTO question_bank(course_id,module_id,prompt,options,answer_index) VALUES($1,$2,'Legacy Q','[\"a\",\"b\"]',0) RETURNING id", [L, LM])).rows[0].id;
    const le = (await pool.query("INSERT INTO exams(course_id,module_id,title,duration_minutes,question_ids) VALUES($1,$2,'Legacy exam',10,ARRAY[$3]::uuid[]) RETURNING id", [L, LM, lq])).rows[0].id;
    const sql = fs.readFileSync(path.join(root, 'migrations/018_shared_question_banks.sql'), 'utf8');
    await pool.query(sql); await pool.query(sql); // idempotent
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM question_banks')).rows[0].n, 1, 'legacy questions got a bank');
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM exam_courses WHERE exam_id=$1 AND course_id=$2', [le, L])).rows[0].n, 1, 'legacy exam keeps its course');

    const errors = load('lib/learning-errors.ts');
    const mocks = { ...h.mocks, '@/lib/lms': lms, '@/lib/learning-errors': errors };
    mocks['@/lib/exam-validation'] = load('lib/exam-validation.ts', mocks);
    const exams = load('lib/exams.ts', mocks); mocks['@/lib/exams'] = exams;
    const practice = load('lib/practice.ts', mocks);

    // legacy exam is still visible to the legacy course's students
    const ls = (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES('L','l@example.test','0000000020','student',$1) RETURNING id", [L])).rows[0].id;
    await exams.publishExam(le, true);
    assert.equal((await exams.studentExams(L, ls)).length, 1);

    // two courses sharing one module (a mandatory module would reach all courses), plus an outsider course
    const A = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('A','a',true) RETURNING id")).rows[0].id;
    const B = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('B','b',true) RETURNING id")).rows[0].id;
    const C = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('C','c',true) RETURNING id")).rows[0].id;
    const M = (await pool.query("INSERT INTO modules(title,is_published) VALUES('Shared',true) RETURNING id")).rows[0].id;
    for (const c of [A, B]) await pool.query('INSERT INTO course_modules(course_id,module_id) VALUES($1,$2)', [c, M]);
    const stu = async (n, c) => (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES($1,$2,$3,'student',$4) RETURNING id", ['S' + n, `s${n}@example.test`, '00000001' + n, c])).rows[0].id;
    const sa = await stu(1, A), sb = await stu(2, B), sc = await stu(3, C);

    // several banks, questions picked across them
    const b1 = (await exams.saveBankMeta({ title: 'Networking', description: 'x' })).id;
    const b2 = (await exams.saveBankMeta({ title: 'Security' })).id;
    await assert.rejects(exams.saveBankMeta({ title: '  ' }), /Bank name/);
    const q1 = await exams.saveBank(b1, [0, 1].map((n) => ({ prompt: `N${n}`, options: ['x', 'y'], answer_index: 0 })));
    const q2 = await exams.saveBank(b2, [0, 1].map((n) => ({ prompt: `S${n}`, options: ['x', 'y'], answer_index: 1 })));
    await assert.rejects(exams.saveBank('00000000-0000-4000-8000-000000000000', [{ prompt: 'p', options: ['a', 'b'], answer_index: 0 }]), /not found/);
    assert.equal((await exams.listBank([b1, b2])).length, 4); assert.equal((await exams.listBank(b1)).length, 2);
    const summary = await exams.listBanks(); assert.equal(summary.find((b) => b.id === b2).question_count, 2);
    const mixed = [q1[0].id, q1[1].id, q2[0].id];

    // one exam, two courses
    const data = { course_ids: [A, B], module_id: M, title: 'Shared exam', duration_minutes: 10, pass_percent: 50, requires_module_completion: false, question_ids: mixed };
    await assert.rejects(exams.saveExam({ ...data, course_ids: [A, C] }), /every selected course/);
    await assert.rejects(exams.saveExam({ ...data, course_ids: [] }), /1–50/);
    await assert.rejects(exams.saveExam({ ...data, course_ids: [A, A] }), /distinct/);
    const exam = await exams.saveExam(data);
    assert.deepEqual([...exam.course_ids].sort(), [A, B].sort());
    await exams.publishExam(exam.id, true);
    assert.equal((await exams.studentExams(A, sa)).some((e) => e.id === exam.id), true);
    assert.equal((await exams.studentExams(B, sb)).some((e) => e.id === exam.id), true);
    assert.equal((await exams.studentExams(C, sc)).some((e) => e.id === exam.id), false, 'unselected course sees nothing');
    await assert.rejects(exams.attemptExam({ examId: exam.id, courseId: C, studentId: sc, action: 'start' }), /not available/);
    const ta = await exams.attemptExam({ examId: exam.id, courseId: A, studentId: sa, action: 'start' });
    const tb = await exams.attemptExam({ examId: exam.id, courseId: B, studentId: sb, action: 'start' });
    assert.equal(ta.questions.length, 3); assert.notEqual(ta.id, tb.id, 'each student has their own attempt');
    // exam freezes at publish: deleting a bank later does not break it
    await exams.deleteBankSet(b2);
    assert.equal((await exams.attemptExam({ examId: exam.id, courseId: A, studentId: sa, action: 'read' })).questions.length, 3);
    assert.equal((await exams.listBank(b1)).length, 2);
    // per-course result scope only counts that course's students
    await exams.attemptExam({ examId: exam.id, courseId: A, studentId: sa, action: 'submit', answers: {} });
    const scopeA = (await exams.resultScopeSummary(A)).find((r) => r.exam_id === exam.id);
    const scopeB = (await exams.resultScopeSummary(B)).find((r) => r.exam_id === exam.id);
    assert.equal(scopeA.submitted, 1); assert.equal(scopeB.submitted, 0);
    assert.equal((await exams.publishScopeResults(B, null, true)).updated, 0);
    assert.equal((await exams.publishScopeResults(A, null, true)).updated, 1);
    assert.equal((await exams.adminExams()).find((e) => e.id === exam.id).course_ids.length, 2);

    // practice set across both courses, drawing from two banks
    const b3 = (await exams.saveBankMeta({ title: 'More' })).id; const q3 = await exams.saveBank(b3, [{ prompt: 'P', options: ['x', 'y'], answer_index: 0 }]);
    const pd = { course_ids: [A, B], module_id: M, title: 'Shared practice', pass_percent: 50, question_ids: [q1[0].id, q3[0].id] };
    await assert.rejects(practice.savePractice({ ...pd, course_ids: [A, C] }), /every selected course/);
    const p = await practice.savePractice(pd); await practice.setPracticePublished(p.id, true);
    assert.equal((await practice.studentPractice(A, sa)).length, 1); assert.equal((await practice.studentPractice(B, sb)).length, 1);
    assert.equal((await practice.studentPractice(C, sc)).length, 0);
    await assert.rejects(practice.practiceAttempt({ practiceId: p.id, courseId: C, studentId: sc, action: 'start' }), /not available/);
    const pa = await practice.practiceAttempt({ practiceId: p.id, courseId: B, studentId: sb, action: 'start' });
    assert.equal(pa.questions.length, 2);
    assert.equal((await practice.adminPractice(A)).length, 1); assert.equal((await practice.adminPractice(C)).length, 0);
    // narrowing the course list removes access for the dropped course
    await practice.savePractice({ ...pd, course_ids: [A] }, p.id);
    assert.equal((await practice.studentPractice(B, sb)).length, 0);
    // deleting a course never deletes shared exams
    await pool.query('DELETE FROM courses WHERE id=$1', [A]);
    assert.equal((await exams.studentExams(B, sb)).some((e) => e.id === exam.id), true);
    // question delete + bank delete
    await exams.deleteBankQuestion(b1, q1[1].id); assert.equal((await exams.listBank(b1)).length, 1);
    await exams.deleteBankSet(b1); await assert.rejects(exams.deleteBankSet(b1), /not found/);
    console.log('shared banks + multi-course exams ok');
  } finally { await h.cleanup(); }
})().catch((e) => { console.error(e); process.exit(1); });
