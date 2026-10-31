-- A click/request is evidence only. Only a signed admin action sets present/absent.
BEGIN;
CREATE TABLE IF NOT EXISTS class_attendance (
  class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','present','absent')),
  join_clicked_at TIMESTAMPTZ,
  last_join_clicked_at TIMESTAMPTZ,
  join_click_count INTEGER NOT NULL DEFAULT 0 CHECK (join_click_count>=0),
  requested_at TIMESTAMPTZ,
  request_note TEXT NOT NULL DEFAULT '' CHECK (length(request_note)<=1000),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (class_id,student_id),
  CHECK ((join_click_count=0)=(join_clicked_at IS NULL)),
  CHECK (status='pending' OR decided_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON class_attendance(student_id,class_id);
CREATE TABLE IF NOT EXISTS class_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('join_clicked','requested','admin_present','admin_absent')),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('student','admin')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note)<=1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_class_attendance_events_class ON class_attendance_events(class_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_attendance_events_student ON class_attendance_events(class_id,student_id,created_at DESC);
ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_attendance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON class_attendance,class_attendance_events FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON class_attendance,class_attendance_events FROM %I',r);
    END IF;
  END LOOP;
END $$;
COMMIT;
