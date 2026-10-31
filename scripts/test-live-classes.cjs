/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, load } = require('./lms-test-harness.cjs');
(async () => {
  const h = await setup();
  try {
    const { pool, lms, root } = h;
    await pool.query(fs.readFileSync(path.join(root, 'migrations/012_live_classes.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(root, 'migrations/012_live_classes.sql'), 'utf8'));
    const errors = load('lib/learning-errors.ts');
    const classes = load('lib/live-classes.ts', { ...h.mocks, '@/lib/lms': lms, '@/lib/learning-errors': errors });
    const calendar = load('lib/class-calendar.ts');
    assert.equal(calendar.classDay('2026-10-31T20:00:00Z'), '2026-11-01');
    assert.equal(calendar.classInstant('2026-11-01T00:30'), '2026-10-31T19:00:00.000Z');
    assert.equal(calendar.classInput('2026-10-31T19:00:00Z'), '2026-11-01T00:30');
    const a = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('A','a',true) RETURNING id")).rows[0].id;
    const b = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES('B','b',true) RETURNING id")).rows[0].id;
    const m = (await pool.query("INSERT INTO modules(title,is_published) VALUES('M',true) RETURNING id")).rows[0].id;
    await pool.query('INSERT INTO course_modules(course_id,module_id) VALUES($1,$2)', [a,m]);
    const raw = { course_id: a, module_id: null, title: 'Class', meet_url: 'https://meet.google.com/abc-defg-hij', starts_at: new Date(Date.now() + 600000).toISOString(), ends_at: new Date(Date.now() + 1200000).toISOString() };
    for (const url of ['javascript:alert(1)', 'https://meet.google.com.evil.test/abc-defg-hij', 'https://evil.test', 'https://user@meet.google.com/abc-defg-hij']) assert.throws(() => classes.validateClass({ ...raw, meet_url: url }));
    assert.throws(() => classes.validateClass({ ...raw, ends_at: raw.starts_at }));
    await assert.rejects(classes.saveClass({ ...raw, course_id: b, module_id: m }));
    const c = await classes.saveClass(raw);
    assert.equal((await classes.listClasses(a)).length, 0, 'draft hidden');
    assert.equal(await classes.publicClassNotice(), null);
    await classes.saveClass({ ...raw, is_published: true }, c.id);
    await classes.saveClass({ ...raw, module_id: m, is_published: true });
    assert.equal((await classes.listClasses(a)).length, 2, 'multiple classes on same day');
    const publicNotice = await classes.publicClassNotice();
    assert.equal(publicNotice.link_url, '/portal/classes');
    assert.equal(JSON.stringify(publicNotice).includes('abc-defg-hij'), false, 'public notice must not leak the Meet URL');
    assert.equal(JSON.stringify(publicNotice).includes(a), false, 'public notice must not disclose course enrollment');
    assert.equal((await classes.listClasses(b)).length, 0);
    assert.equal((await classes.listClasses(null)).length, 0);
    await pool.query('UPDATE modules SET is_published=false WHERE id=$1', [m]);
    assert.equal((await classes.listClasses(a)).length, 1, 'course-only class independent of modules');
    await classes.saveClass({ ...raw, is_published: true, is_cancelled: true }, c.id);
    assert.equal((await classes.listClasses(a))[0].is_cancelled, true);
    await pool.query('UPDATE courses SET is_published=false WHERE id=$1', [a]);
    assert.equal((await classes.listClasses(a)).length, 0);
    assert.equal(await classes.publicClassNotice(), null);
    const news = load('app/api/news/route.ts', { '@/lib/db': { db: { getActiveNews: async () => [{ id: 'manual', message: 'Manual news' }] } }, '@/lib/live-classes': { publicClassNotice: async () => publicNotice } });
    const payload = await (await news.GET()).json(); assert.equal(payload[0].id, 'online-class-notice'); assert.equal(payload[1].id, 'manual');
    console.log('PASS draft/publish/cancel, course boundaries, module scope, same-day occurrences, Meet validation, IST midnight, idempotent migration');
  } finally { await h.cleanup(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
