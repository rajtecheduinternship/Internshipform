# Learning delivery phases

The prerequisite video/module-publishing change is already merged into `main`.
Review and merge this stack in order:

1. `feature/course-completion-logic` → `main`
2. `feature/course-live-classes` → `feature/course-completion-logic`
3. `feature/module-examinations` → `feature/course-live-classes`

Do not run migrations against production automatically.

## 1 — Publication and completion correctness

- Student access requires a published assigned course, published module and
  published non-archived video. Existing globally mandatory modules are preserved.
- A module completes only when it has at least one visible video and all its
  visible videos meet their watch threshold. Viewing a module is not completion.
- A course completes only when it has at least one visible module and all visible
  modules complete. Empty published modules remain pending. New published content
  reopens current completion; hidden content is excluded; old video progress stays.
- This is current-curriculum completion, not permanent certificate eligibility.
- Apply `011_progress_identity.sql` before deploying: consolidate legacy duplicate
  intervals and key progress by stable student ID, not editable/reusable email.
- Serialize first/concurrent progress writes; keep unpublished lessons out of
  admin student completion counts. Historical analytics remain historical.
- Test: `node scripts/test-completion.cjs` (isolated PostgreSQL schema).

## 2 — Live classes

- Admin creates draft class occurrences for one course, optionally linked to one
  of its modules (or a global mandatory module). Multiple occurrences per day.
- Manually supplied HTTPS Google Meet links; no Google account/OAuth integration.
- Publish/unpublish/cancel/edit, explicit start/end, stored as UTC timestamps.
- Student calendar/agenda and bilingual notice board, scoped to their course and
  module publication. Course-only classes do not depend on module completion.
- Links appear only to authenticated enrolled students. No public Meet links.
- Classes/attendance do not change video completion.

## 3 — Examinations

- Course-scoped question bank, optional module association; single-answer MCQs.
- Admin form and structured `.docx` import with preview/validation and answer key.
- Draft exam selects bank questions; publication snapshots questions and answers.
- One course + one published module per exam; admin duration, pass percentage,
  optional availability window and module-completion prerequisite.
- One durable attempt/student/exam, reload-safe server deadline, incremental answer
  saving, automatic deadline finalization, atomic/idempotent submission and grading.
- Do not send keys before submission (or after it by default); published exams
  cannot be edited, preserving fairness. Unpublish hides/stops access; republishing
  retains attempts and deadlines, never resets them. Use a new exam for a retake.
- Copy/context-menu deterrents and visibility-change logging are not proctoring.
  Screenshots, external devices and searching cannot be reliably prevented.
- Exams are reported separately from video completion; failed exams do not erase
  watched lessons. No silent change to certificate generation policy.

## Deployment / acceptance

Apply migrations in numeric order, then deploy each PR independently. Verify with
an admin and approved test students in two different courses. Test unpublished
courses/modules/lessons, shared/mandatory modules, empty modules, repeat publish,
IST midnight/calendar boundaries, multiple same-day classes, cancellation,
unpublished exams, prerequisites, timer expiry, reload, duplicate/concurrent
submission, cross-course and cross-student attempts. Never use real student data
for automated regression tests. Run TypeScript, targeted ESLint, build and the
isolated integration tests. Word import must never execute macros or fetch links.
