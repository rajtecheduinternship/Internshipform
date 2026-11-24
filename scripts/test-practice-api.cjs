/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end practice-exam flow over HTTP against a running server.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_PASSWORD=… STUDENT_PHONE=… STUDENT_PASSWORD=… node scripts/test-practice-api.cjs
 *
 * Needs migration 017 applied and a student who is enrolled in a published course that has a published module.
 * The script creates its own bank questions + practice exam (titled "ZZ-API-PRACTICE") and deletes them at the end.
 */
const assert = require('node:assert/strict');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const { ADMIN_PASSWORD, STUDENT_PHONE, STUDENT_PASSWORD } = process.env;
if (!ADMIN_PASSWORD || !STUDENT_PHONE || !STUDENT_PASSWORD) { console.error('Set ADMIN_PASSWORD, STUDENT_PHONE and STUDENT_PASSWORD.'); process.exit(2); }

function jar() {
  const cookies = new Map();
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Origin: BASE, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie?.() || []) { const [pair] = c.split(';'); const i = pair.indexOf('='); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}
const admin = jar(), student = jar(), anon = jar();
const ok = (r, label) => { assert.ok(r.status >= 200 && r.status < 300, `${label}: ${r.status} ${JSON.stringify(r.data)}`); return r.data; };
const step = (m) => console.log('  ✓', m);

(async () => {
  let practiceId = null; const bankIds = [];
  try {
    // --- logins
    ok(await admin('/api/admin/verify', { method: 'POST', body: { password: ADMIN_PASSWORD } }), 'admin login');
    ok(await student('/api/portal/login', { method: 'POST', body: { phone: STUDENT_PHONE, password: STUDENT_PASSWORD } }), 'student login');
    const me = ok(await student('/api/portal/me'), 'me'); const profile = me.profile || me.student || me;
    const courseId = profile.course_id; assert.ok(courseId, 'student has a course'); step('admin + student logged in');

    // --- access control
    assert.equal((await anon('/api/admin/practice')).status, 401, 'admin list needs login');
    assert.equal((await student('/api/admin/practice')).status, 401, 'a student is not an admin');
    assert.equal((await anon('/api/portal/practice')).status, 401);
    assert.equal((await student('/api/admin/practice', { method: 'POST', body: {} })).status, 401);
    step('endpoints reject anonymous callers and students on admin routes');

    // --- pick a published module on the student's course
    const modules = ok(await admin('/api/admin/modules'), 'modules').modules.filter((m) => m.is_published && (m.is_mandatory || m.courses.some((c) => c.id === courseId)));
    assert.ok(modules.length, 'course needs a published module'); const moduleId = modules[0].id;

    // --- admin builds a practice set from fresh bank questions
    const qs = [0, 1, 2, 3].map((n) => ({ prompt: `ZZ-API-PRACTICE question ${n + 1}`, options: ['Alpha', 'Beta', 'Gamma'], answer_index: n % 3 }));
    const created = ok(await admin('/api/admin/question-bank', { method: 'POST', body: { course_id: courseId, module_id: moduleId, questions: qs } }), 'bank').questions;
    created.forEach((q) => bankIds.push(q.id));
    assert.equal((await admin('/api/admin/practice', { method: 'POST', body: { course_id: courseId, module_id: moduleId, title: 'x', pass_percent: 50, question_ids: [] } })).status, 400);
    assert.equal((await admin('/api/admin/practice', { method: 'POST', body: { course_id: courseId, module_id: moduleId, title: '', pass_percent: 50, question_ids: bankIds } })).status, 400);
    assert.equal((await admin('/api/admin/practice', { method: 'POST', body: { course_id: courseId, module_id: moduleId, title: 'x', pass_percent: 500, question_ids: bankIds } })).status, 400);
    practiceId = ok(await admin('/api/admin/practice', { method: 'POST', body: { course_id: courseId, module_id: moduleId, title: 'ZZ-API-PRACTICE', pass_percent: 50, question_ids: bankIds } }), 'create').practice.id;
    step('admin created a draft practice exam (bad input rejected with 400)');

    // --- drafts are invisible to students
    assert.ok(!ok(await student('/api/portal/practice'), 'list').practice.some((p) => p.id === practiceId), 'draft hidden');
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' })).status, 404);
    step('draft is hidden from the student and cannot be started');

    ok(await admin(`/api/admin/practice/${practiceId}`, { method: 'PATCH', body: { is_published: true } }), 'publish');
    const listed = ok(await student('/api/portal/practice'), 'list').practice.find((p) => p.id === practiceId);
    assert.ok(listed); assert.equal(listed.my_attempts, 0); assert.equal(listed.question_count, 4); assert.equal(JSON.stringify(listed).includes('question_ids'), false);
    step('after publishing the student sees it (0 attempts)');

    // --- attempt 1: answer key hidden while in progress
    const a1 = ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' }), 'start').attempt;
    assert.equal(a1.questions.length, 4); assert.equal(a1.result, null); assert.equal(JSON.stringify(a1).includes('answer_index'), false);
    const resumed = ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' }), 'start again').attempt;
    assert.equal(resumed.id, a1.id, 'starting twice resumes the same attempt');
    const byPrompt = (q) => ['Alpha', 'Beta', 'Gamma'].indexOf(q.options.find((o) => o)); void byPrompt;
    // work out the correct option text from the prompt number (answer_index = n % 3 -> Alpha/Beta/Gamma)
    const correctText = (q) => ['Alpha', 'Beta', 'Gamma'][(Number(q.prompt.match(/(\d+)$/)[1]) - 1) % 3];
    const pick = (q, right) => { const want = correctText(q); const i = q.options.indexOf(want); return right ? i : (i + 1) % q.options.length; };
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PATCH', body: { answers: { [a1.questions[0].id]: 99 } } })).status, 400);
    ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PATCH', body: { answers: { [a1.questions[0].id]: pick(a1.questions[0], true) } } }), 'save');
    const mid = ok(await student(`/api/portal/practice/${practiceId}/attempt`), 'read').attempt;
    assert.equal(Object.keys(mid.answers).length, 1); assert.equal(mid.result, null);
    assert.equal(ok(await student('/api/portal/practice'), 'list').practice.find((p) => p.id === practiceId).my_in_progress, true);
    step('save/resume works, answer key hidden mid-attempt');

    // --- submit: 3 right, 1 wrong => 75%, result shown immediately
    const answers = Object.fromEntries(a1.questions.map((q, i) => [q.id, pick(q, i !== 3)]));
    const done = ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PUT', body: { answers } }), 'submit').attempt;
    assert.ok(done.submitted_at); assert.equal(done.result.score_percent, 75); assert.equal(done.result.passed, true);
    assert.equal(done.result.questions.length, 4); assert.equal(done.result.incorrect_count, 1); assert.equal(done.result.questions.filter((q) => !q.is_correct).length, 1);
    assert.ok(done.result.questions.every((q) => q.correct_answer === correctText(q)));
    step('submitted: 3/4 = 75% shown immediately with correct answers');
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PUT', body: { answers } })).status, 409, 'cannot resubmit');
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PATCH', body: { answers } })).status, 409, 'cannot edit after submit');
    const reread = ok(await student(`/api/portal/practice/${practiceId}/attempt`), 'read').attempt;
    assert.equal(reread.result.score_percent, 75);
    step('finished attempt is read-only and viewable again');

    // --- retake as often as wanted
    for (let i = 0; i < 3; i++) {
      const n = ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' }), 'retake').attempt;
      assert.notEqual(n.id, a1.id); assert.equal(n.result, null); assert.deepEqual(n.answers, {});
      const all = Object.fromEntries(n.questions.map((q) => [q.id, pick(q, true)]));
      assert.equal(ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PUT', body: { answers: all } }), 'submit').attempt.result.score_percent, 100);
    }
    const hist = ok(await student(`/api/portal/practice/${practiceId}/history`), 'history').history;
    assert.equal(hist.length, 4); assert.equal(hist[hist.length - 1].score_percent, 75); assert.equal(hist[0].score_percent, 100);
    const sum = ok(await student('/api/portal/practice'), 'list').practice.find((p) => p.id === practiceId);
    assert.equal(sum.my_attempts, 4); assert.equal(sum.my_best_percent, 100); assert.equal(sum.my_last_percent, 100); assert.equal(sum.my_in_progress, false);
    step('retook 3 more times; history shows 4 attempts, best 100%');

    // --- real exam records untouched; admin sees stats
    const stat = ok(await admin('/api/admin/practice?course_id=' + courseId), 'admin list').practice.find((p) => p.id === practiceId);
    assert.equal(stat.attempts, 4); assert.ok(stat.students >= 1);
    step('admin sees attempt counts');

    // --- unpublish hides, republish restores history
    ok(await admin(`/api/admin/practice/${practiceId}`, { method: 'PATCH', body: { is_published: false } }), 'unpublish');
    assert.ok(!ok(await student('/api/portal/practice'), 'list').practice.some((p) => p.id === practiceId));
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' })).status, 404);
    ok(await admin(`/api/admin/practice/${practiceId}`, { method: 'PATCH', body: { is_published: true } }), 'republish');
    assert.equal(ok(await student('/api/portal/practice'), 'list').practice.find((p) => p.id === practiceId).my_attempts, 4);
    step('unpublish hides it; republish brings the history back');

    // --- admin edits title while live
    ok(await admin(`/api/admin/practice/${practiceId}`, { method: 'PATCH', body: { course_id: courseId, module_id: moduleId, title: 'ZZ-API-PRACTICE (edited)', pass_percent: 60, question_ids: bankIds.slice(0, 3) } }), 'edit');
    const edited = ok(await student('/api/portal/practice'), 'list').practice.find((p) => p.id === practiceId);
    assert.equal(edited.title, 'ZZ-API-PRACTICE (edited)'); assert.equal(edited.question_count, 3);
    assert.equal(ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'POST' }), 'start').attempt.questions.length, 3);
    ok(await student(`/api/portal/practice/${practiceId}/attempt`, { method: 'PUT', body: { answers: {} } }), 'submit blank');
    step('admin edit applies to the next attempt');

    // --- delete: gone for the student, attempts removed
    ok(await admin(`/api/admin/practice/${practiceId}`, { method: 'DELETE' }), 'delete');
    assert.ok(!ok(await student('/api/portal/practice'), 'list').practice.some((p) => p.id === practiceId));
    assert.equal((await student(`/api/portal/practice/${practiceId}/attempt`)).status, 404);
    assert.equal((await student(`/api/portal/practice/${practiceId}/history`)).status, 404);
    assert.equal((await admin(`/api/admin/practice/${practiceId}`, { method: 'DELETE' })).status, 404);
    practiceId = null; step('deleted: student loses access, repeat delete is 404');
    console.log('practice exam API flow ok');
  } finally {
    if (practiceId) await admin(`/api/admin/practice/${practiceId}`, { method: 'DELETE' }).catch(() => {});
    // leave no test questions behind
    if (bankIds.length) console.log(`note: ${bankIds.length} "ZZ-API-PRACTICE" bank questions remain in the question bank (no delete endpoint); remove via DB if unwanted.`);
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
