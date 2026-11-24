-- Course syllabus PDFs (one per course, versioned) and generated internship attendance sheets.
BEGIN;
CREATE TABLE IF NOT EXISTS course_syllabi (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 160),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  data BYTEA NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS attendance_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  ref_code TEXT NOT NULL DEFAULT '003' CHECK (ref_code ~ '^[A-Za-z0-9-]{1,12}$')
);
INSERT INTO attendance_settings(id) VALUES (true) ON CONFLICT DO NOTHING;
-- Last number issued for each year/code series, e.g. 2026/003/<n>. Numbers are never reused.
CREATE TABLE IF NOT EXISTS attendance_ref_counters (
  year INTEGER NOT NULL,
  code TEXT NOT NULL,
  last_no INTEGER NOT NULL DEFAULT 0 CHECK (last_no >= 0),
  PRIMARY KEY (year, code)
);
CREATE TABLE IF NOT EXISTS attendance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ref_no TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  min_percent INTEGER NOT NULL DEFAULT 90 CHECK (min_percent BETWEEN 0 AND 100),
  details JSONB NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  ref_final BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (end_date >= start_date),
  UNIQUE (student_id, course_id)
);
ALTER TABLE attendance_reports ADD COLUMN IF NOT EXISTS ref_final BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_attendance_reports_course ON attendance_reports(course_id, is_published);
ALTER TABLE course_syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_ref_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON course_syllabi, attendance_reports, attendance_settings, attendance_ref_counters FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON course_syllabi, attendance_reports, attendance_settings, attendance_ref_counters FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
