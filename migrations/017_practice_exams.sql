-- Practice exams: ungraded-for-record module practice. Students may retake as often as they like and
-- see their result immediately. They stay available until an admin deletes them.
BEGIN;
CREATE TABLE IF NOT EXISTS practice_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  pass_percent INTEGER NOT NULL DEFAULT 50 CHECK (pass_percent BETWEEN 0 AND 100),
  question_ids UUID[] NOT NULL CHECK (cardinality(question_ids) BETWEEN 1 AND 200),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_practice_exams_course ON practice_exams(course_id, created_at DESC);
CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practice_exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  submitted_at TIMESTAMPTZ,
  correct_count INTEGER,
  score_percent NUMERIC(5,2),
  passed BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_student ON practice_attempts(practice_id, student_id, started_at DESC);
-- At most one unfinished attempt per student and practice set (a new start resumes it).
CREATE UNIQUE INDEX IF NOT EXISTS uq_practice_open_attempt ON practice_attempts(practice_id, student_id) WHERE submitted_at IS NULL;
ALTER TABLE practice_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON practice_exams, practice_attempts FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON practice_exams, practice_attempts FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
