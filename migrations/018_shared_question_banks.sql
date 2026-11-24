-- Shared question banks + multi-course exams/practice sets.
--  * question_banks: named banks that belong to no course; questions point at a bank (question_bank.bank_id).
--  * exam_courses / practice_courses: one exam or practice set can be offered to several courses.
-- Additive and backward compatible: the legacy course_id columns are kept (now nullable, no cascade).
BEGIN;
CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES question_banks(id) ON DELETE CASCADE;
-- Existing questions: one bank per course that had questions.
DO $$ DECLARE r record; b uuid; BEGIN
  FOR r IN SELECT DISTINCT q.course_id, c.title FROM question_bank q JOIN courses c ON c.id = q.course_id WHERE q.bank_id IS NULL LOOP
    INSERT INTO question_banks(title) VALUES (left(r.title || ' – question bank', 200)) RETURNING id INTO b;
    UPDATE question_bank SET bank_id = b WHERE course_id = r.course_id AND bank_id IS NULL;
  END LOOP;
END $$;
ALTER TABLE question_bank ALTER COLUMN bank_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_question_bank_bank ON question_bank(bank_id);

CREATE TABLE IF NOT EXISTS exam_courses (
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_courses_course ON exam_courses(course_id);
CREATE TABLE IF NOT EXISTS practice_courses (
  practice_id UUID NOT NULL REFERENCES practice_exams(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (practice_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_practice_courses_course ON practice_courses(course_id);
INSERT INTO exam_courses(exam_id, course_id) SELECT id, course_id FROM exams WHERE course_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO practice_courses(practice_id, course_id) SELECT id, course_id FROM practice_exams WHERE course_id IS NOT NULL ON CONFLICT DO NOTHING;

-- The legacy course_id columns are no longer authoritative: allow NULL and stop a course delete from
-- cascading into exams / questions that other courses share.
ALTER TABLE exams ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE practice_exams ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE question_bank ALTER COLUMN course_id DROP NOT NULL;
DO $$ DECLARE t text; c record; BEGIN
  FOREACH t IN ARRAY ARRAY['exams', 'practice_exams', 'question_bank'] LOOP
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = t::regclass AND contype = 'f' AND confrelid = 'courses'::regclass LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ADD FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL', t);
  END LOOP;
END $$;

ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON question_banks, exam_courses, practice_courses FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON question_banks, exam_courses, practice_courses FROM %I', r);
    END IF;
  END LOOP;
END $$;
COMMIT;
