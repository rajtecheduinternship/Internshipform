/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, load } = require('./lms-test-harness.cjs');
const { summarizeCompletion } = load('lib/completion.ts');
assert.equal(summarizeCompletion([]).is_completed, false);
assert.equal(summarizeCompletion([{ videos: [] }]).is_completed, false);
assert.equal(summarizeCompletion([{ videos: [{ progress: { is_completed: true } }] }, { videos: [] }]).percentage, 50);
(async () => {
  const { pool, lms, cleanup } = await setup();
  try {
    const course = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('Test','test',true) RETURNING id")).rows[0].id;
    const other = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('Other','other',true) RETURNING id")).rows[0].id;
    const student = (await pool.query("INSERT INTO profiles(full_name,email,phone,role,course_id) VALUES('Test','test@example.test','0000000000','student',$1) RETURNING id", [course])).rows[0].id;
    const mod = (await pool.query("INSERT INTO modules(title,is_published) VALUES('Module',false) RETURNING id")).rows[0].id;
    await pool.query('INSERT INTO course_modules(course_id,module_id) VALUES($1,$2)', [course, mod]);
    const video = (await pool.query("INSERT INTO videos(module_id,title,youtube_video_id,duration_seconds,is_published) VALUES($1,'Lesson','test',20,true) RETURNING *", [mod])).rows[0];
    assert.equal((await lms.getStudentCourse(course, student)).modules.length, 0);
    assert.equal(await lms.getVideoAccessMeta(video.id, course), null);
    await pool.query('UPDATE modules SET is_published=true WHERE id=$1', [mod]);
    assert.equal((await lms.getStudentCourse(course, student)).completion.is_completed, false);
    assert.equal(await lms.getVideoAccessMeta(video.id, other), null);
    const args = { studentId: student, studentEmail: 'test@example.test', video, intervals: [[0,20]], position: 20 };
    await Promise.all([lms.saveProgress(args), lms.saveProgress({ ...args, intervals: [[0,10]] })]);
    assert.equal((await lms.getStudentCourse(course, student)).completion.is_completed, true);
    const progress = (await pool.query('SELECT * FROM video_progress')).rows[0];
    assert.deepEqual(progress.watched_intervals, [[0,20]], 'concurrent first writes must preserve the union');
    await lms.saveProgress({ ...args, studentEmail: 'changed@example.test', intervals: [] });
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM video_progress')).rows[0].n, 1, 'email changes do not split progress');
    assert.equal((await lms.getStudentCourse(course, student)).completion.is_completed, true);
    const otherStudent = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await lms.saveProgress({ ...args, studentId: otherStudent, studentEmail: 'test@example.test', intervals: [] });
    assert.equal((await pool.query('SELECT is_completed FROM video_progress WHERE student_id=$1', [otherStudent])).rows[0].is_completed, false, 'reusing an email must never transfer completion');
    const extra = (await pool.query("INSERT INTO videos(module_id,title,youtube_video_id,duration_seconds,is_published) VALUES($1,'New','new',20,false) RETURNING id", [mod])).rows[0].id;
    assert.equal((await lms.getStudentCourse(course, student)).completion.is_completed, true);
    await pool.query('UPDATE videos SET is_published=true WHERE id=$1', [extra]);
    assert.equal((await lms.getStudentCourse(course, student)).completion.percentage, 50);
    assert.equal((await lms.adminListStudents())[0].completed_videos, 1);
    await pool.query('UPDATE videos SET is_published=false WHERE id=$1', [video.id]);
    assert.equal((await lms.adminListStudents())[0].completed_videos, 0);
    await pool.query('UPDATE videos SET archived_at=NOW() WHERE id=$1', [extra]);
    assert.equal((await lms.getStudentCourse(course, student)).completion.is_completed, false, 'empty modules are pending');
    await pool.query('UPDATE courses SET is_published=false WHERE id=$1', [course]);
    assert.equal(await lms.getVideoForStudent(video.id, course, student), null);
    assert.equal(await lms.getVideoAccessMeta(video.id, course), null);
    assert.equal(await lms.getStudentCourse(course, student), null);
    await pool.query('UPDATE modules SET is_mandatory=true WHERE id=$1', [mod]);
    assert.equal((await lms.getStudentCourse(other, student)).modules.length, 1, 'mandatory modules retain existing global semantics');
    console.log('PASS publication cycle, enrollment boundaries, dynamic completion, empty modules, admin totals, concurrent heartbeats');
  } finally { await cleanup(); }
  await testLegacyIdentityMigration();
})().catch((e) => { console.error(e); process.exitCode = 1; });

async function testLegacyIdentityMigration() {
  const h = await setup({ legacyProgress: true });
  try {
    const mod = (await h.pool.query("INSERT INTO modules(title) VALUES('Legacy') RETURNING id")).rows[0].id;
    const video = (await h.pool.query("INSERT INTO videos(module_id,title,youtube_video_id,duration_seconds) VALUES($1,'Legacy','test',100) RETURNING id", [mod])).rows[0].id;
    const student = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    for (const [email, intervals] of [['old@example.test', [[0,50]]], ['new@example.test', [[40,95]]]]) {
      await h.pool.query('INSERT INTO video_progress(student_id,student_email,video_id,watched_intervals) VALUES($1,$2,$3,$4)', [student,email,video,JSON.stringify(intervals)]);
    }
    const sql = fs.readFileSync(path.join(h.root,'migrations/011_progress_identity.sql'),'utf8');
    await h.pool.query(sql); await h.pool.query(sql);
    const rows = (await h.pool.query('SELECT * FROM video_progress')).rows;
    assert.equal(rows.length,1); assert.deepEqual(rows[0].watched_intervals, [[0,95]]);
    assert.equal(rows[0].total_seconds_watched,95); assert.equal(rows[0].is_completed,true);
    console.log('PASS stable student identity, reused email isolation, legacy interval-union migration, idempotence');
  } finally { await h.cleanup(); }
}
