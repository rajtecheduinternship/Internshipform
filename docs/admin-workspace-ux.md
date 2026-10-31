# Admin workspace usability

This follow-up to the learning feature stack changes presentation/workflow only;
no database migration is needed.

- Navigation is grouped into Overview, People & admissions, Learning,
  Assessments, Communication, and Records. The active section survives reload.
- Assessments has independent Question Bank / Exams / Results views. Lists come
  first; question creation, Word import, draft exam editing and answer review use
  focused drawers rather than a single very long page. Results are brought into
  view when opened; answer-sheet review has a labelled modal and keyboard focus.
- Live classes starts with calendar/list and course/status filters. Admins can see
  draft planning entries; students still see only published classes. Scheduling
  and editing happen in a drawer, and cancelled/draft states do not offer joins.
- Student records start with Profile (including course assignment); learning
  progress and examinations are separate tabs.
- Certificates and sensitive exports live in Records, not an unrelated dropdown
  on every screen. Removing the mobile dropdown also removes its offscreen menu
  and outside-click/Escape dismissal issue.
- A shared in-memory dirty/pending-operation guard protects supported admin
  editors (questions, exam drafts, imports, classes, student details, course/
  module/video forms and walk-in certificates) from refresh, section changes,
  closing an editor or signing out. Browser reload/close uses beforeunload.
  Cancel keeps values; explicit discard loses only unsaved input. Successful saves
  remain in the database. Question keys are not persisted to browser storage.
- Existing backend publication, grading, authorization and privacy are unchanged.

Verification: `npm run test:admin-ux` uses synthetic API responses and checks six
navigation groups, workflow separation, unsaved/discard/cancel behaviour, refresh
and unload protection, persisted section, focused results, draft calendar entries,
student profile priority, certificate editor accessibility, mobile record/export
bounds, Hindi and widths 320/390/768/900/1024/1440. Existing learning UI, mobile /
loading and real HTTP/database E2E suites are also run before publishing.
