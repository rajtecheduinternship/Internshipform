-- Migration 005: shared modules, course assignment, session revocation, progress anti-cheat
-- Run after 004:  psql $DATABASE_URL -f migrations/005_courses_and_security.sql
-- Idempotent: safe to run more than once.

BEGIN;

-- 1. Modules become a shared library: a module can belong to many courses.
CREATE TABLE IF NOT EXISTS course_modules (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_course_modules_module ON course_modules(module_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'course_id'
  ) THEN
    INSERT INTO course_modules (course_id, module_id, order_index)
      SELECT course_id, id, order_index FROM modules WHERE course_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    ALTER TABLE modules DROP COLUMN course_id;
  END IF;
END $$;

ALTER TABLE modules ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE videos  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
-- Soft delete: archived videos disappear for students but keep everyone's progress.
ALTER TABLE videos  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. The student's chosen course (picked on the application form).
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_course ON profiles(course_id);
CREATE INDEX IF NOT EXISTS idx_applications_course ON internship_applications(course_id);

-- 3. Password change + session revocation (bumping token_version logs out every device).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 4. Progress anti-cheat: unique seconds credited may not outrun real elapsed time.
ALTER TABLE video_progress ADD COLUMN IF NOT EXISTS first_watched_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Indexes for the hot paths (heartbeats, analytics, login throttling).
CREATE INDEX IF NOT EXISTS idx_watch_sessions_start ON watch_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_video_progress_completed ON video_progress(video_id) WHERE is_completed;
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(limit_type, ip_address, created_at);

-- 6. Preserve links to courses that already exist; admins create new courses.
UPDATE internship_applications a
   SET course_id = c.id
  FROM courses c
 WHERE a.course_id IS NULL AND lower(a.internship_topic) = lower(c.title);

UPDATE profiles p
   SET course_id = a.course_id
  FROM internship_applications a
 WHERE p.application_id = a.id AND p.course_id IS NULL AND a.course_id IS NOT NULL;

COMMIT;
