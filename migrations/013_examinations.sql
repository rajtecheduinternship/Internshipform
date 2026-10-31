BEGIN;
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 3000),
  options JSONB NOT NULL CHECK (jsonb_typeof(options)='array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  answer_index INTEGER NOT NULL CHECK (answer_index >= 0 AND answer_index < jsonb_array_length(options)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_bank_course ON question_bank(course_id);
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 300),
  pass_percent INTEGER NOT NULL DEFAULT 50 CHECK (pass_percent BETWEEN 0 AND 100),
  requires_module_completion BOOLEAN NOT NULL DEFAULT true,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  question_ids UUID[] NOT NULL CHECK (cardinality(question_ids) BETWEEN 1 AND 200),
  questions JSONB,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at),
  CHECK (NOT is_published OR (published_at IS NOT NULL AND questions IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id, created_at DESC);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  focus_events INTEGER NOT NULL DEFAULT 0 CHECK (focus_events >= 0),
  correct_count INTEGER,
  score_percent NUMERIC(5,2),
  passed BOOLEAN,
  UNIQUE(exam_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON question_bank, exams, exam_attempts FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON question_bank, exams, exam_attempts FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
