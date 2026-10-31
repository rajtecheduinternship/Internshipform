/** Browser regression checks; uses fixtures only, never writes real app data.
 * Run with an existing dev server and Playwright available:
 * PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chromium node scripts/test-mobile-loading.cjs
 * Optional: BASE_URL, SCREENSHOT_DIR.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS browser test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://localhost:3000';
const screenshots = process.env.SCREENSHOT_DIR;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = { id: 'student-1', full_name: 'Test Student', phone: '9876543210', email: 'student@example.test', college: 'Test College', roll_number: 'R1001', course_id: 'course-1' };
const video = { id: 'lesson-1', module_id: 'module-1', title: 'Your first practical lesson', youtube_video_id: 'test-video', duration_seconds: 600, required_watch_percent: 90, is_published: true, progress: null };
const moduleFixture = { id: 'module-1', title: 'Computer fundamentals', description: '', is_mandatory: false, video_count: 2, courses: [], videos: [video, { ...video, id: 'lesson-2', title: 'Working with documents' }] };
const course = { id: 'course-1', title: 'Office & digital skills', slug: 'office', description: 'Learn useful skills at your own pace.', category: 'IT', duration_weeks: 4, is_published: true, student_count: 1, modules: [moduleFixture] };
const notices = [1, 2, 3].map((n) => ({ id: `notice-${n}`, message: `Notice ${n}: ${'Important internship information for students. '.repeat(6)}`, link_url: '/courses', is_active: true, sort_order: n, created_at: '2026-10-30T10:00:00Z' }));
const student = { ...profile, course_title: course.title, completed_videos: 0, total_videos: 2, watch_seconds: 0, last_activity: null, last_login_at: null };
const fixtures = {
  '/api/portal/attendance': { attendance: [] },
  '/api/portal/classes': { classes: [] }, '/api/portal/exams': { exams: [] },
  '/api/news': notices, '/api/courses': { courses: [course] }, '/api/portal/me': { profile }, '/api/portal/questions': { questions: [] },
  '/api/videos/lesson-1': { video }, '/api/admin/verify': { authenticated: true }, '/api/admin/submissions': { submissions: [] },
  '/api/admin/analytics': { recentSessions: [] }, '/api/admin/questions': { questions: [] },
  '/api/admin/overview': { totals: { students: 1, unassigned: 0, active7d: 0, watchSeconds: 0, enquiries: 1 }, courses: [], daily: [] },
  '/api/admin/courses': { courses: [course] }, '/api/admin/courses/course-1': { course },
  '/api/admin/modules': { modules: [moduleFixture] }, '/api/admin/modules/module-1': { module: moduleFixture },
  '/api/admin/students': { students: [student] }, '/api/admin/students/student-1': { profile, course }, '/api/admin/students/student-1/exams': { results: [] },
  '/api/admin/news': notices, '/api/enquiries': { enquiries: [{ id: 'enquiry-1', full_name: 'Interested Student', phone: profile.phone, email: profile.email, course_interest: course.title, college: profile.college, message: 'How can I start learning?', created_at: '2026-10-30T10:00:00Z' }] },
  '/api/form-token': { token: 'test-only' }, '/api/tracking/session': { session_id: 'test-session' },
};
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const delays = new Map(); const failures = new Set();
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (delays.has(path)) await pause(delays.get(path));
      await route.fulfill({ status: failures.has(path) ? 503 : 200, json: failures.has(path) ? { error: 'Test network failure' } : fixtures[path] || {} });
    });
    // A realistic player stand-in replaces the mount element like YouTube does.
    await page.route('**/www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'application/javascript', body: `
      window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 }, Player: function(id, config) {
        const element = document.getElementById(id); const iframe = document.createElement('div'); iframe.id = id; iframe.textContent = 'Test video'; element.replaceWith(iframe);
        const player = { getDuration: () => 600, getCurrentTime: () => 0, seekTo() {}, pauseVideo() {}, destroy() { iframe.remove(); } };
        window.testYT = { id, ready: () => config.events.onReady({ target: player }), state: (data) => config.events.onStateChange({ data, target: player }), error: () => config.events.onError() };
        return player;
      }}; window.onYouTubeIframeAPIReady();` }));
    async function goto(path) { await page.goto(base + path); await page.locator('body').waitFor(); }
    async function noOverflow(label) {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
    }
    async function shot(name) {
      if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: `${screenshots}/${name}.png`, fullPage: true }); }
    }
    // Slow, failed, and successful initial notice requests.
    delays.set('/api/news', 1800);
    await goto('/');
    await page.getByRole('status').filter({ hasText: 'Loading notices' }).waitFor();
    assert.equal(await page.locator('.notice-board-footer').isVisible(), false);
    await shot('home-loading-mobile');
    await page.getByRole('button', { name: 'Read notices (3)' }).waitFor(); delays.clear();
    const board = await page.locator('#notice-board').boundingBox(); assert(board.height < 310, 'Collapsed notice board should not fill a phone screen');
    assert.equal(await page.locator('.notice-item:visible').count(), 1);
    await page.getByRole('button', { name: 'Read notices (3)' }).click();
    assert.equal(await page.locator('.notice-item:visible').count(), 3);
    await page.getByRole('button', { name: 'Show less' }).click();
    await shot('home-mobile');
    failures.add('/api/news'); await goto('/'); await page.getByRole('button', { name: 'Try again' }).waitFor();
    failures.clear(); delays.set('/api/news', 800); await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('status').filter({ hasText: 'Loading notices' }).waitFor();
    await page.getByRole('button', { name: 'Read notices (3)' }).waitFor(); delays.clear();
    // Public pages and student screens, narrow phone + normal phone.
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ['/', '/about', '/benefits', '/courses', '/apply', '/enquiry', '/portal/login', '/portal/videos', '/portal/profile', '/portal/account']) {
        await goto(path); await page.waitForLoadState('networkidle'); await noOverflow(`${width} ${path}`);
      }
    }
    await goto('/courses'); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.course-syllabus[open]').count(), 0);
    await page.locator('.course-syllabus summary').first().click();
    assert.equal(await page.locator('.course-syllabus[open]').count(), 1);
    await shot('courses-mobile');
    // Desktop keeps full notice board, expanded syllabus, and multiple columns.
    await page.setViewportSize({ width: 1440, height: 1000 }); await goto('/'); await page.waitForLoadState('networkidle');
    assert(await page.locator('.notice-board-footer').isVisible());
    assert.equal(await page.locator('.notice-mobile-toggle').isVisible(), false); await noOverflow('desktop home'); await shot('home-desktop');
    await goto('/courses'); await page.waitForLoadState('networkidle'); assert.equal(await page.locator('.course-syllabus[open]').count(), 6);
    // Course fetching is visible, not an empty panel.
    await page.setViewportSize({ width: 390, height: 844 }); delays.set('/api/courses', 1800); await goto('/portal/videos');
    await page.getByRole('status').filter({ hasText: 'Loading your course' }).waitFor(); await page.locator('.learning-hero').waitFor(); delays.clear();
    await noOverflow('mobile learning'); await shot('learning-mobile');
    await goto('/portal/watch/lesson-1'); await page.getByRole('status').filter({ hasText: 'Loading video' }).waitFor();
    await page.waitForFunction(() => !!window.testYT); await page.evaluate(() => window.testYT.ready());
    await page.locator('.video-loading-overlay').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.testYT.state(3)); await page.getByRole('status').filter({ hasText: 'Buffering' }).waitFor();
    await page.evaluate(() => window.testYT.state(1)); await page.locator('.video-buffering').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.testYT.error()); await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('status').filter({ hasText: 'Loading video' }).waitFor(); await page.waitForFunction(() => window.testYT?.id.endsWith('-1')); await page.evaluate(() => window.testYT.ready()); await page.locator('.video-loading-overlay').waitFor({ state: 'hidden' });
    await noOverflow('watch'); await shot('watch-mobile');
    // Reduced motion retains clear text but no animated spinner.
    await page.emulateMedia({ reducedMotion: 'reduce' }); delays.set('/api/portal/me', 1500); await goto('/portal/account');
    await page.getByRole('status').filter({ hasText: 'Loading your account' }).waitFor();
    assert.equal(await page.locator('.ui-spinner').first().evaluate((el) => getComputedStyle(el).animationName), 'none'); delays.clear();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 320, height: 844 }); await goto('/'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'हिन्दी', exact: true }).click(); await noOverflow('Hindi home');
    await goto('/portal/videos'); await page.locator('.learning-hero').waitFor(); await noOverflow('Hindi learning');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const path of ['/', '/courses', '/portal/videos']) { await goto(path); await page.waitForLoadState('networkidle'); await noOverflow(`tablet ${path}`); }
    await page.setViewportSize({ width: 390, height: 844 });
    // Admin tests use mocked authentication; no live account or writes.
    await goto('/admin'); await page.locator('.admin-shell').waitFor();
    async function adminTab(label) {
      if (!(await page.locator('.admin-sidebar').isVisible())) await page.getByRole('button', { name: 'Open menu' }).click();
      await page.locator('.admin-nav').getByRole('button', { name: label, exact: false }).click();
    }
    await adminTab('Students'); await page.locator('.admin-student-card').first().waitFor(); await noOverflow('admin students'); await shot('admin-students-mobile');
    await page.locator('.admin-student-card').getByRole('button', { name: profile.full_name }).click(); await page.locator('#stu-course').waitFor();
    await noOverflow('student drawer'); await page.getByRole('button', { name: 'Close', exact: true }).click();
    await adminTab('Courses'); await page.getByRole('button', { name: 'Edit & modules' }).first().waitFor(); await noOverflow('admin courses');
    await page.getByRole('button', { name: 'Edit & modules' }).first().click(); await page.getByRole('button', { name: 'Save details' }).waitFor(); await noOverflow('course drawer');
    delays.set('/api/admin/courses/course-1', 1000);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saving…' }).waitFor();
    assert.equal(await page.getByRole('dialog').locator('fieldset').evaluate((el) => el.disabled), true);
    await page.getByRole('button', { name: 'Save details', exact: true }).waitFor(); delays.clear();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Module library', exact: false }).click(); await page.getByRole('button', { name: 'Edit & videos' }).click(); await page.getByRole('button', { name: 'Save details' }).waitFor(); await noOverflow('module drawer'); await page.getByRole('button', { name: 'Close', exact: true }).click();
    await adminTab('Enquiries'); await page.locator('.admin-enquiry-cards').getByText('Interested Student').waitFor(); await noOverflow('admin enquiries'); await shot('admin-enquiries-mobile');
    await adminTab('Announcements'); await page.getByRole('button', { name: 'Publish notice' }).waitFor(); await noOverflow('admin notices');
    await page.setViewportSize({ width: 320, height: 844 });
    for (const tab of ['Students', 'Enquiries', 'Announcements']) { await adminTab(tab); await page.waitForLoadState('networkidle'); await noOverflow(`320px admin ${tab}`); }
    await page.setViewportSize({ width: 1440, height: 1000 }); await adminTab('Students'); await page.locator('.admin-student-table').waitFor(); assert.equal(await page.locator('.admin-student-cards').isVisible(), false); await noOverflow('admin desktop');
    failures.add('/api/admin/logout'); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Could not sign out' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sign out', exact: true }).isEnabled(), true);
    failures.clear();
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('PASS: loading/retry, reduced motion, video buffering/error/retry, notice expansion, syllabus, all public/student pages at 320/390px, mobile admin screens/drawers, and desktop preservation.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
