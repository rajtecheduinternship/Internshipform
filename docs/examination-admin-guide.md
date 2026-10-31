# Online classes and examinations: operator guide

## Deploy in phases

See `learning-phases.md` for PR order and completion semantics. Apply the new SQL
migrations manually on a backup-verified database using the trusted server role:
`011_progress_identity.sql`, then `012_live_classes.sql`, then
`013_examinations.sql`, then `014_exam_result_publication.sql`.
The new tables have RLS enabled and no anonymous/authenticated client grants.
Use a brief maintenance window for phase 1: the old app targets the email-based
unique constraint, which migration 011 replaces. Deploy the new phase-1 code
immediately after that migration before reopening progress writes.
Their APIs require the existing signed admin/student cookies. Do not put service
credentials, Google Meet links, questions or answer keys into public notices.

## Online classes

Admin → Online classes → choose a course and optionally a module → enter a Meet
link, title, instructions and start/end in **India time (IST)**. Save as draft or
check Published. Multiple independently editable occurrences per day are allowed.
No Google Calendar/Meet account connection is needed: create the Meet link in
Google, then paste it here. Rescheduling, unpublishing and cancellation are edits.
Cancellation stays visible on the student's calendar but removes join buttons.
Module-specific classes follow module publication and course membership; course
classes work even when the course has no published modules. Classes do not mark
videos complete and attendance is not claimed to be tracked.

Students see bilingual class notices in My learning, and Online classes opens a
month calendar with a daily agenda. All displayed schedule times are explicitly
IST regardless of the device timezone. Refresh/focus polling picks up new notices.

## Question bank

Admin → Examinations → choose course and optionally module. Enter each question,
2–6 distinct options (one per line) and one correct option. Hindi and English are
supported as authored text; the system does not translate question content.
Course-wide bank questions can be reused by any module exam in that course.
Module-scoped bank questions can only be selected for that module.

For Word import use `.docx` (maximum **2 MB**) with plain paragraphs and this exact
format. Type labels explicitly rather than using Word's automatic numbering:

```
Q: Which device is used to type?
A) Keyboard
B) Monitor
C) Speaker
D) Printer
ANSWER: A

Q: कंप्यूटर का मस्तिष्क किसे कहते हैं?
A) CPU
B) Mouse
C) Monitor
D) Keyboard
ANSWER: A
```

Repeat one block per question, at most 200 per import. Each prompt and option must
be on its own paragraph/line. An answer is the option letter, not the option text.
Use 2–6 sequential labels A) through F). `.doc`, macros, tables, tracked changes,
images, mathematical objects and inferred/separate answer-key sheets are not
supported. Convert to the explicit text template first. Text split across Word
runs and ordinary XML character entities are handled. External relationships are
never followed, no files are extracted to disk, and decompression is bounded.
Review the preview (including every answer key), then explicitly confirm saving.
Import validates all questions before inserting any; there is no partial bank.

## Exams

Select one course + module and 1–200 bank questions. Set title, 1–300 minutes,
0–100 pass percentage, optional IST opening/closing window and whether completed
published module videos are required. Save a **draft**, review, then Publish.
A draft cannot be accessed even by guessing its URL. Published exams appear
inside the corresponding module and in the student's Examinations area.

Publication freezes questions, answer keys, timing, prerequisites and pass rules.
Later question-bank edits do not change that exam. To correct a published exam,
unpublish it and create a new one; timers for existing attempts are not paused.
Republishing restores the same attempts, not a fresh attempt. Every exam has one
attempt per student; create another exam for a retake. Multiple exams per module
or course are supported. Started attempts remain valid if new module lessons are
published later, but hiding/reassigning the course/module blocks access.

The server owns the start time and deadline. Closing time shortens an attempt if
it occurs before the full duration. Answers are automatically saved after each
choice, in order. Students should wait for “All changes saved” before leaving.
Reload resumes the same questions/options and deadline. Question and option order
are randomized per student, then persisted. Blank questions score zero; each
question has equal weight, no negative marking. Passing compares the unrounded
correct-answer ratio against the configured threshold.

At expiry, late answers are ignored; previously saved answers are graded. The UI
requests finalization automatically. If the browser is closed/offline, the next
attempt access or admin result report finalizes from the original deadline (no
background scheduler is required). Submission/finalization is locked, atomic and
idempotent. Answer keys are never returned by student endpoints, even after release.

## Admin answer review and optional result publication

Scores are now **private by default**, including pre-existing attempts when
migration 014 is applied. Submission/expiry still calculates and retains the
score, but the student only sees “Appeared / Submitted / Result awaiting
publication.” No correct count, percentage or pass/fail is returned to students
until the admin explicitly releases that specific result.

Admin → Examinations → View results → Review answers & calculation displays:

- Each saved question and its shuffled options from that student's attempt.
- The selected answer (or Unanswered), the correct answer and awarded marks.
- Correct / incorrect / unanswered totals and the percentage calculation.
- The frozen exam pass threshold; passing uses the unrounded correct-answer ratio.

Each question is worth 1 mark; incorrect and blank answers receive 0, with no
negative marks. Reviewing/publishing does not edit answers, keys or calculated
scores. Bank changes after an attempt cannot change this saved answer sheet.
Review/publication of an unfinished attempt is refused. Expired attempts are
finalized from saved answers before review.

Use **Publish result** for one student, or **Publish all submitted results** for
all current submissions. Bulk publication is a one-time action, not an automatic
release setting: later submissions remain private. **Make result private** hides
it again without erasing internal marks/answers. Previously disclosed marks
cannot be recalled from screenshots or a student's memory.

Students can see appearance/submission and released marks in the module exam list,
Examinations and My progress; the submitted-exam screen refreshes result status
on focus, every 30 seconds, or using Refresh result. Admins can also review and
publish from Students → student record → Exam participation & results. Private
scores remain visible to admins. A published historical result can still be read
if the exam/module is hidden, provided the student remains assigned to the same
published course; this does not permit starting/resuming a hidden examination.

Tab-visibility counts remain advisory and are shown only to admins.

Copy/context-menu blocking is **only a deterrent**, not a security boundary. This
cannot prevent screenshots, browser tools, photographs, another device, or all
internet searching. Visibility counts are advisory, never proof of misconduct.
Do not use them for automatic penalties or advertise this as secure proctoring.
Video/module completion and certificates are not changed by exam grades.

## Verification

`npm run test:lms` requires DATABASE_URL (or local `.env`) pointing to PostgreSQL
where the role may create/drop temporary schemas. Tests create only random
`rts_lms_test_*` schemas and clean them in finally blocks. No existing student
records are edited. `npx tsc --noEmit` and targeted ESLint cover the application.
`npm run test:learning-ui` uses Playwright, an existing local server, and synthetic
API fixtures only; set PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE, BASE_URL and optionally
SCREENSHOT_DIR for environments without a project-local browser installation.


Real full-stack acceptance: `npm run test:learning-e2e` requires a fresh isolated
production BUILD_DIR plus Playwright/Chrome paths. It starts/stops its own local
server, signs in through real password endpoints, uses real HTTP APIs and browser
forms (no API interception), and creates/drops a random PostgreSQL schema. It
covers completion/publication, course-scoped Meet notices, timed exam attempts,
admin answer review, private/released/withdrawn student scores, expiry and key
negative/security cases. `npm run test:exam-results` covers result visibility,
immutable grading, snapshot preservation, wrong-student/wrong-exam access,
unfinished-attempt refusal, bulk/future submissions, payload tampering and CSRF.


### Network / console confidentiality

Student exam endpoints explicitly serialize only their question text/options,
selected answers and safe attempt metadata. Correct-option indices, answer keys,
per-question marks and admin review data are never sent to student endpoints,
including after result publication. Until release, percentage/correct-count and
pass/fail are null in both the attempt and dashboard responses. Admin review
endpoints require the signed admin session and same-origin protection for writes.
All result responses use no-store caching headers. Browser exam code cannot
runtime-import the server DB/grading modules under the ESLint boundary rules,
and exam UI console calls are prohibited. Learning API failures do not log raw
exceptions/messages that could contain question/answer payloads.

The real E2E suite inspects student browser API response bodies and console output
for answer-key/private-grade leakage. This is not DRM: visible questions and
intentionally published scores must reach the student's browser and can be read
in DevTools, photographed or copied. No claim is made to prevent that, or to
recall a result the student already saw before it was made private again.
