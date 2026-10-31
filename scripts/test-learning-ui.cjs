/* eslint-disable @typescript-eslint/no-require-imports */
// UI contract tests with synthetic API fixtures. Backend semantics are separately
// exercised against PostgreSQL by test-completion/test-live-classes/test-exams.
const assert = require('node:assert/strict'); const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://localhost:3000';
const a = '11111111-1111-4111-8111-111111111111'; const m = '22222222-2222-4222-8222-222222222222';
const e = '33333333-3333-4333-8333-333333333333'; const q = '44444444-4444-4444-8444-444444444444';
const profile = { id: a, full_name: 'Synthetic Student', course_id: a, email: 'ui@example.test' };
const course = { id: a, title: 'Computer skills', modules: [{ id: m, title: 'Fundamentals', videos: [] }], completion: { percentage: 0 } };
const exam = { id: e, course_id: a, module_id: m, module_title: 'Fundamentals', title: 'Module assessment', duration_minutes: 15, pass_percent: 50, eligible: true, question_ids: [q], is_published: false, published_at: null, requires_module_completion: true };
const live = { id: e, course_id: a, module_id: m, course_title: course.title, module_title: 'Fundamentals', title: 'Live computer class', description: 'Bring your questions.', meet_url: 'https://meet.google.com/abc-defg-hij', starts_at: new Date(Date.now() - 60000).toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(), is_published: true, is_cancelled: false };
let attempt = null;
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; const writes = [];
    page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
    await page.addInitScript(() => localStorage.setItem('rts_lang', 'en'));
    await page.route('**/api/**', async (route) => {
      const r = route.request(); const path = new URL(r.url()).pathname;
      let data = {};
      const body = r.postData() && r.headers()['content-type']?.includes('application/json') ? r.postDataJSON() : null;
      if (r.method() !== 'GET') writes.push({ path, method: r.method(), body });
      if (path.endsWith('/attempt')) {
        if (r.method() === 'POST' && !attempt) attempt = { id: 'attempt', questions: [{ id: q, prompt: 'What is 2 + 2?', options: ['3', '4'] }], answers: {}, deadline_at: new Date(Date.now() + 900000).toISOString(), submitted_at: null, score_percent: null };
        if (r.method() === 'PATCH' && attempt) attempt.answers = { ...attempt.answers, ...body.answers };
        if (r.method() === 'PUT' && attempt) attempt = { ...attempt, answers: body.answers, submitted_at: new Date().toISOString(), correct_count: 1, score_percent: 100, passed: true };
        data = { attempt: attempt && { ...attempt, server_now: new Date().toISOString() } };
      } else if (path === '/api/portal/me') data = { profile };
      else if (path === '/api/courses') data = { courses: [course] };
      else if (path === '/api/portal/classes' || path === '/api/admin/classes') data = { classes: [live] };
      else if (path === '/api/portal/exams' || path === '/api/admin/exams') data = { exams: [exam] };
      else if (path === '/api/admin/question-bank') data = { questions: [{ id: q, course_id: a, module_id: m, prompt: 'What is 2 + 2?', options: ['3', '4'], answer_index: 1 }] };
      else if (path === '/api/admin/courses') data = { courses: [course] };
      else if (path === '/api/admin/modules') data = { modules: [{ id: m, title: 'Fundamentals', courses: [course], is_mandatory: false }] };
      else if (path === '/api/admin/verify') data = { authenticated: true };
      else if (path === '/api/admin/submissions') data = { submissions: [] };
      else if (path === '/api/admin/analytics') data = { recentSessions: [] };
      else if (path === '/api/admin/overview') data = { totals: {}, courses: [], daily: [] };
      else if (path === '/api/admin/questions') data = { questions: [] };
      else if (path === '/api/enquiries') data = { enquiries: [] };
      await route.fulfill({ status: 200, json: data });
    });
    async function noOverflow(name) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, name + ' overflows horizontally'); }
    async function shot(name) { if (process.env.SCREENSHOT_DIR) { fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true }); } }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/portal/classes'); await page.getByRole('heading', { name: 'Class calendar', exact: true }).waitFor();
      await page.getByText('Student, your online class is live on Google Meet. Join now.').waitFor();
      assert(await page.getByText('छात्र, आपकी ऑनलाइन कक्षा Google Meet पर चल रही है। अभी जुड़ें।').isVisible());
      await noOverflow('class calendar ' + width); await shot('calendar-' + width);
      await page.goto(base + '/portal/videos'); await page.getByRole('link', { name: 'View exam / my attempt' }).waitFor(); await noOverflow('module exam ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + `/portal/exams/${e}`); await page.getByRole('button', { name: 'Start examination', exact: true }).click();
    await page.getByRole('timer').waitFor(); await page.getByRole('radio', { name: 'B) 4', exact: true }).check();
    await page.getByText('All changes saved', { exact: true }).waitFor(); await shot('exam-attempt-mobile');
    const deadline = attempt.deadline_at;
    await page.reload(); await page.getByRole('radio', { name: 'B) 4', exact: true }).waitFor(); assert(await page.getByRole('radio', { name: 'B) 4', exact: true }).isChecked()); assert.equal(attempt.deadline_at, deadline);
    await page.getByRole('button', { name: 'Submit examination', exact: true }).click(); await page.getByRole('heading', { name: 'Examination submitted' }).waitFor(); await shot('exam-result-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(base + '/admin');
    await page.getByRole('button', { name: 'Online classes', exact: true }).click(); await page.getByRole('heading', { name: 'Schedule Google Meet' }).waitFor();
    await page.getByLabel('Course', { exact: true }).selectOption(a); await page.getByLabel('Class title', { exact: true }).fill('New session');
    await page.getByLabel('Google Meet URL').fill('https://meet.google.com/abc-defg-hij'); await page.getByLabel('Starts (IST)').fill('2026-11-02T10:00'); await page.getByLabel('Ends (IST)').fill('2026-11-02T11:00');
    await page.getByRole('button', { name: 'Save class', exact: true }).click(); await page.getByText('Class saved.', { exact: true }).waitFor();
    const saved = writes.find((w) => w.path === '/api/admin/classes' && w.method === 'POST'); assert.equal(saved.body.starts_at, '2026-11-02T04:30:00.000Z'); assert.equal(saved.body.is_published, false);
    await shot('admin-class-desktop');
    await page.getByRole('button', { name: 'Examinations', exact: true }).click();
    await page.getByLabel('Course', { exact: true }).selectOption(a); await page.getByLabel('Module (required for exam; optional for bank)').selectOption(m);
    await page.getByRole('heading', { name: 'Create draft exam' }).waitFor(); await page.getByLabel('Exam title', { exact: true }).fill('Final assessment');
    await page.getByRole('checkbox', { name: 'What is 2 + 2?', exact: true }).check(); await page.getByRole('button', { name: 'Save draft exam', exact: true }).click();
    await page.getByText('Saved successfully.', { exact: true }).waitFor(); assert(writes.some((w) => w.path === '/api/admin/exams' && w.body.question_ids[0] === q));
    await noOverflow('admin exams desktop'); await shot('admin-exams-desktop');
    await page.setViewportSize({ width: 320, height: 900 }); await noOverflow('admin exams mobile'); await shot('admin-exams-mobile');
    assert.deepEqual(errors, []); console.log('PASS bilingual class calendar/notice, module exam links, durable attempt UI/save/reload/submit, admin scheduling/draft creation, 320/390/1440px layout; fixtures only');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
