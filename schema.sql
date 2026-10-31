-- Create the internship_applications table for local PostgreSQL
-- Run this script to set up your local database

CREATE TABLE IF NOT EXISTS internship_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  mother_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  internship_topic TEXT,
  course TEXT,
  college_name TEXT NOT NULL,
  honours_subject TEXT,
  current_semester TEXT,
  class_roll_no TEXT,
  university_name TEXT,
  university_roll_number TEXT NOT NULL UNIQUE,
  university_registration_number TEXT,
  contact_number TEXT NOT NULL,
  whatsapp_number TEXT,
  email_address TEXT NOT NULL UNIQUE,
  photo TEXT,
  signature TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_email ON internship_applications(email_address);
CREATE INDEX IF NOT EXISTS idx_roll_number ON internship_applications(university_roll_number);
CREATE INDEX IF NOT EXISTS idx_created_at ON internship_applications(created_at DESC);

-- ==================== RATE LIMITING TABLES ====================

-- Rate limits table for IP-based rate limiting
-- limit_type can be 'submission' or 'admin'
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  limit_type TEXT NOT NULL DEFAULT 'submission',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address, limit_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created ON rate_limits(created_at);

-- Email cooldowns table to prevent rapid resubmission with same email
CREATE TABLE IF NOT EXISTS email_cooldowns (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email cooldown cleanup
CREATE INDEX IF NOT EXISTS idx_email_cooldowns_created ON email_cooldowns(created_at);

-- Suspicious activity tracking for temporary IP bans
-- activity_type can be 'failed_validation', 'rate_limit_exceeded', etc.
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspicious_ip ON suspicious_activity(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_created ON suspicious_activity(created_at);

-- ==================== CERTIFICATES ====================

CREATE TABLE IF NOT EXISTS certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES internship_applications(id) ON DELETE CASCADE,
  serial_number       TEXT NOT NULL UNIQUE,
  rts_reg_number      TEXT NOT NULL,
  marks               INTEGER NOT NULL CHECK (marks >= 0 AND marks <= 100),
  grade               TEXT NOT NULL,
  grade_point         INTEGER NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  certificate_url     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_application_id ON certificates(application_id);

-- ==================== LMS & VIDEO TRACKING ====================

-- Profiles (Students and Admins)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  avatar_url TEXT,
  college TEXT,
  roll_number TEXT,
  password_hash TEXT,
  application_id UUID REFERENCES internship_applications(id) ON DELETE CASCADE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique ON profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_application ON profiles(application_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT DEFAULT 'IT & Software',
  thumbnail_url TEXT,
  duration_weeks INTEGER DEFAULT 4,
  duration_hours INTEGER DEFAULT 90,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A module can be attached to many courses (shared library)
CREATE TABLE IF NOT EXISTS course_modules (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_course_modules_module ON course_modules(module_id);

-- Student's chosen course (picked on the application form)
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_course ON profiles(course_id);
CREATE INDEX IF NOT EXISTS idx_applications_course ON internship_applications(course_id);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  youtube_video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  archived_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  required_watch_percent INTEGER NOT NULL DEFAULT 90,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_module_id ON videos(module_id);

-- Video Progress (Aggregated progress per student-video)
CREATE TABLE IF NOT EXISTS video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  student_email TEXT NOT NULL,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  total_seconds_watched INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_position INTEGER NOT NULL DEFAULT 0,
  watched_intervals JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  first_watched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_email, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_progress_student ON video_progress(student_email);
CREATE INDEX IF NOT EXISTS idx_video_progress_video ON video_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_student_id ON video_progress(student_id);

-- Watch Sessions
CREATE TABLE IF NOT EXISTS watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_student ON watch_sessions(student_email);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_video ON watch_sessions(video_id);

-- Detailed Watch Events (play, pause, seek, heartbeat, blur, focus, ended)
CREATE TABLE IF NOT EXISTS watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES watch_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'heartbeat', 'blur', 'focus', 'ended')),
  video_time INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_events_session ON watch_events(session_id);

-- Enquiries / Leads
CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  college TEXT,
  course_interest TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enrolled', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_start ON watch_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_video_progress_completed ON video_progress(video_id) WHERE is_completed;
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(limit_type, ip_address, created_at);


-- Mandatory modules are shown to every student; student questions are answered by the admin
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT false;

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

-- ==================== APPLICATION APPROVAL (007) ====================
-- Run after 006. New applications are requests, never automatic portal admission.
-- Existing linked student accounts are grandfathered once; reruns never undo reviews.
BEGIN;

ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS review_note TEXT;
UPDATE internship_applications a
SET approval_status = CASE WHEN EXISTS (
  SELECT 1 FROM profiles p WHERE p.application_id = a.id AND p.role = 'student'
) THEN 'approved' ELSE 'pending' END
WHERE a.approval_status IS NULL;
ALTER TABLE internship_applications ALTER COLUMN approval_status SET DEFAULT 'pending';
ALTER TABLE internship_applications ALTER COLUMN approval_status SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_approval_status_check' AND conrelid = 'internship_applications'::regclass) THEN
    ALTER TABLE internship_applications ADD CONSTRAINT applications_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_applications_approval ON internship_applications(approval_status, created_at DESC);

-- Atomic and row-locked for concurrent admins. Only the trusted server DB role can
-- call this function; no SECURITY DEFINER escalation or public RPC approval path.
CREATE OR REPLACE FUNCTION review_internship_application(
  p_application_id UUID, p_decision TEXT, p_note TEXT, p_password_hash TEXT
) RETURNS TABLE (application_id UUID, approval_status TEXT, profile_id UUID, changed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  application_row internship_applications%ROWTYPE;
  student_id UUID;
  assigned_course UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') OR p_decision IS NULL THEN
    RAISE EXCEPTION 'Invalid approval decision' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_note, '')) > 1000 THEN
    RAISE EXCEPTION 'Review note is too long' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO application_row FROM internship_applications a WHERE a.id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002'; END IF;
  SELECT p.id, p.course_id INTO student_id, assigned_course FROM profiles p
    WHERE p.application_id = p_application_id AND p.role = 'student' ORDER BY p.created_at LIMIT 1 FOR UPDATE;
  IF application_row.approval_status = p_decision THEN
    RETURN QUERY SELECT p_application_id, p_decision, student_id, false;
    RETURN;
  END IF;
  IF p_decision = 'approved' THEN
    assigned_course := coalesce(assigned_course, application_row.course_id);
    IF assigned_course IS NULL OR NOT EXISTS (SELECT 1 FROM courses c WHERE c.id = assigned_course AND c.is_published) THEN
      RAISE EXCEPTION 'A published course must be assigned before approval' USING ERRCODE = '22023';
    END IF;
    IF student_id IS NULL THEN
      IF p_password_hash IS NULL OR length(p_password_hash) < 32 THEN
        RAISE EXCEPTION 'Initial password hash is required' USING ERRCODE = '22023';
      END IF;
      INSERT INTO profiles (full_name, email, phone, role, college, roll_number, password_hash, application_id, course_id)
        VALUES (application_row.student_name, lower(application_row.email_address), application_row.contact_number, 'student',
          application_row.college_name, application_row.university_roll_number, p_password_hash, p_application_id, assigned_course)
        RETURNING id INTO student_id;
    END IF;
    -- Never reset a student's chosen password when reconsidering a rejection.
    UPDATE profiles p SET course_id = assigned_course, token_version = p.token_version + 1
      WHERE p.application_id = p_application_id AND p.role = 'student';
  ELSE
    -- Rejection also revokes sessions if this application was previously approved.
    UPDATE profiles p SET token_version = p.token_version + 1
      WHERE p.application_id = p_application_id AND p.role = 'student';
  END IF;
  UPDATE internship_applications a SET approval_status = p_decision, reviewed_at = NOW(), review_note = nullif(trim(p_note), '')
    WHERE a.id = p_application_id;
  RETURN QUERY SELECT p_application_id, p_decision, student_id, true;
END;
$$;
REVOKE ALL ON FUNCTION review_internship_application(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION review_internship_application(UUID, TEXT, TEXT, TEXT) TO service_role;
  END IF;
END $$;
-- The application uses server APIs and signed cookies, not Supabase client auth.
-- Prevent direct REST writes to admission/account tables or reads of video IDs.
REVOKE ALL ON TABLE internship_applications, profiles, modules, videos, course_modules,
  video_progress, watch_sessions, watch_events, student_questions FROM PUBLIC;
DO $$ DECLARE client_role TEXT; BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE internship_applications, profiles, modules, videos, course_modules, video_progress, watch_sessions, watch_events, student_questions FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
