-- Migration 004: student accounts (phone = user ID, roll number = password)
-- Run after schema.sql:  psql $DATABASE_URL -f migrations/004_student_accounts.sql

-- 1. The internship form no longer collects these fields, so they must be optional.
ALTER TABLE internship_applications ALTER COLUMN internship_topic DROP NOT NULL;
ALTER TABLE internship_applications ALTER COLUMN course DROP NOT NULL;
ALTER TABLE internship_applications ALTER COLUMN honours_subject DROP NOT NULL;
ALTER TABLE internship_applications ALTER COLUMN current_semester DROP NOT NULL;
ALTER TABLE internship_applications ALTER COLUMN class_roll_no DROP NOT NULL;
ALTER TABLE internship_applications ALTER COLUMN university_registration_number DROP NOT NULL;

-- 2. Profiles become login accounts linked to the application that created them.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES internship_applications(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Phone number is the user ID, so it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique ON profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_application ON profiles(application_id);

-- 3. Progress rows are now keyed to the logged-in profile.
CREATE INDEX IF NOT EXISTS idx_video_progress_student_id ON video_progress(student_id);
