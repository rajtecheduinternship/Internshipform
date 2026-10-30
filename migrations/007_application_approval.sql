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
