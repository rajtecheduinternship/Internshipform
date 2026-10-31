# Google Meet class attendance

## Deployment order

This is a separate follow-up to `feature/admin-workspace-ux`, which itself builds
on the completion / live-class / examination PR stack. The UX PR needs no new SQL.
For attendance apply **015_class_attendance.sql** using the trusted server role
before deploying its application code. Prerequisite migrations 011–014 must already
be applied for the preceding learning features. Automated tests use random schemas;
no migration is run against existing application data automatically.

## What is and is not evidence

- Only an explicit admin decision marks a student **Present** or **Absent**.
- Clicking Join Google Meet records first/last portal clicks and a bounded count;
  the student remains Pending until an admin approves. Viewing a class or calendar
  does not create an attendance record.
- This is **not** Google Meet attendance verification. It cannot prove the student
  reached the meeting, stayed there, or joined under their real name. A blocked
  popup or failed Google login can still follow a portal click; the admin must
  verify against their actual class/participant list.
- Join opens 15 minutes before the scheduled start and closes at the end. The
  server owns these checks, regardless of the browser clock. Rapid retries within
  30 seconds return the same recorded click rather than adding duplicate evidence.
- Course/module publication, current approved enrollment and cancellation are
  checked again on the server. Student requests cannot set presence or any admin
  decision fields. Meet redirects come only from the stored validated URL.

## Student flow

Online classes and the class calendar use a recorded Join action, not a bare Meet
link. The Meet opens in another tab; a blocked popup gets a safe fallback link.
The student sees the click as awaiting admin approval—not as attendance completed.

Students who used a WhatsApp/external link can press **Request attendance** after
class starts, explain how they joined, and send the request. Requests are supported
for ended classes too. One unresolved request is kept per class/student; repeated
submission does not duplicate it. A request never makes the student present.

Only the admin's Present status counts in **My class attendance**, available on
Online classes and My progress. A declined/Absent record can be appealed with a
new request; it stays Absent until the admin changes the decision. Already approved
students cannot create another pending request. Hidden class history already
belonging to a student is retained, without exposing its Meet URL; new requests
for a hidden/cancelled class are blocked. Course publication/current enrollment
still gate student access. Students receive only their own records, never a roster
or private admin decision notes.

## Admin flow

Learning → Online classes → choose a class → **Attendance**.

- Review all currently approved enrollees plus historical participants with an
  existing class record. Former/revoked enrollment records are labelled historical.
- Filter all / needs review / portal click / request / Present / Absent, or search
  by name/phone. See first/last click, request text/time and existing decision.
- **Approve present** / **Mark absent** handles one student.
- Select a few students or **Select all students in this filtered list**, then use
  the bulk Present/Absent buttons. Confirmation names the class and selected count.
  Selection alone changes nothing; an explicit action is required.
- Bulk writes are transactional. A foreign/non-eligible ID makes the entire batch
  fail with no partial approvals. Up to 1,000 distinct IDs may be submitted per
  batch; use filters/smaller selections for larger courses. New enrollees/future
  records are not automatically included in a past bulk decision.
- Students with no app click/request may be marked manually when the teacher knows
  they attended externally. Lack of a click is not proof of absence.
- Decisions are enabled only for a started, non-cancelled class. Draft/unpublished
  historical classes can be backfilled by the admin, but not self-marked by students.
- Optional admin notes are internal. Unchanged repeated decisions are idempotent;
  a new note/review or appeal resolution is retained in the audit history.
- Students → student record → **Attendance** shows that student's history and can
  open the relevant class roster for admin management.

## Integrity and retention

Click and request upserts never change a previously approved/absent status. Locks
serialize overlapping clicks/requests/decisions, and bulk IDs are locked in stable
order. Decisions preserve join/request evidence. `class_attendance_events` stores
student evidence and admin decisions; the current product has a shared signed
admin login, so this records the actor role, not an invented named-admin identity.
Both attendance tables have RLS enabled with public/client-role access revoked.

Once a class has attendance activity its course, module and start time cannot be
changed. Create a new occurrence instead of reusing historical attendance for a
new class. Description, end time, Meet URL, publication and cancellation can still
be edited. Editors preserve the exact original timestamps when only text changes.

Classes and their containing modules/courses with attendance history cannot be
hard-deleted through cascading deletion. Unpublish instead; API deletion returns
409 with that explanation. Attendance and audit events remain intact. Existing
Present records are not silently erased by hiding/cancelling a class. Account
removal at the database level still follows the explicit student FK deletion
policy. Attendance does not alter video completion, exam marks or certificates.

## Verification

- `npm run test:attendance`: isolated PostgreSQL schema; publication/enrollment and
  time gates, external requests, manual decisions, atomic selected/all batches,
  invalid batches, retries, appeals, concurrent join/approval, future enrollees,
  record retention, identity freeze, role/CSRF/payload negatives and migration RLS.
- `npm run test:lms`: all completion, class, exam/result and attendance regressions.
- `npm run test:learning-e2e`: real production server, password sessions, real HTTP
  and temporary database. Tests the popup Join, external request, one/few/all
  approval, manual external attendance, approved student display and privacy.
  Only the external Google Meet destination is stubbed; application APIs are not.
- Full lint/TypeScript/build and admin-UX/mobile/browser regression suites are run
  before pushing. No live Google Meet or real student record is used in tests.
