-- Migration 006: mandatory (common) modules + student questions
-- Run after 005:  psql $DATABASE_URL -f migrations/006_mandatory_modules_and_questions.sql
-- Idempotent: safe to run more than once.

BEGIN;

-- A mandatory module is shown to every student automatically, whatever their course.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT false;

-- Doubts students ask (optionally about one lecture); the admin answers them.
CREATE TABLE IF NOT EXISTS student_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_questions_student ON student_questions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_questions_open ON student_questions(created_at DESC) WHERE answer IS NULL;

COMMIT;
