/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { load } = require('./lms-test-harness.cjs');
const { buildSheet } = load('lib/attendance-report.ts', { '@/lib/db': {}, '@/lib/lms': { isUuid: () => true }, '@/lib/learning-errors': { LearningError: class extends Error {} } });
const days = (marks) => marks.map((mark, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, mark }));
const rep = (n, m) => Array(n).fill(m);
(() => {
  // Unmarked classes count as attended.
  let r = buildSheet(days(rep(10, 'unmarked')));
  assert.equal(r.recorded.percent, 0); assert.equal(r.sheet.percent, 100); assert.equal(r.unmarked_days, 10); assert.equal(r.topped_up_days, 0);
  // Explicit absences stay absent while at/above 90%.
  r = buildSheet(days([...rep(9, 'present'), 'absent']));
  assert.equal(r.sheet.percent, 90); assert.equal(r.topped_up_days, 0); assert.equal(r.rows[9].status, 'Absent');
  // Below 90%: earliest absences are raised, just enough to reach it.
  r = buildSheet(days([...rep(6, 'present'), ...rep(4, 'absent')]));
  assert.equal(r.recorded.percent, 60); assert.equal(r.sheet.percent, 90); assert.equal(r.topped_up_days, 3);
  assert.deepEqual(r.rows.map((x) => x.status).slice(6), ['Present', 'Present', 'Present', 'Absent']);
  // Never pushed past what is needed; 18 days → 17 needed (94.4%).
  r = buildSheet(days(rep(18, 'absent'))); assert.equal(r.sheet.present, 17); assert.equal(r.topped_up_days, 17);
  // Two classes on one day make a single row: present wins; absent only if all absent.
  r = buildSheet([{ date: '2026-02-01', mark: 'absent' }, { date: '2026-02-01', mark: 'present' }, { date: '2026-02-02', mark: 'absent' }, { date: '2026-02-02', mark: 'absent' }], 0);
  assert.deepEqual(r.rows.map((x) => [x.day, x.status]), [[1, 'Present'], [2, 'Absent']]);
  // Rows are chronological and numbered from 1 regardless of input order.
  r = buildSheet([{ date: '2026-03-05', mark: 'present' }, { date: '2026-03-01', mark: 'present' }]);
  assert.deepEqual(r.rows.map((x) => [x.date, x.day]), [['2026-03-01', 1], ['2026-03-05', 2]]);
  assert.equal(buildSheet([]).sheet.percent, 0);
  console.log('attendance report rules ok');
})();
