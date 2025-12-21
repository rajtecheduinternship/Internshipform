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
  internship_topic TEXT NOT NULL,
  course TEXT NOT NULL,
  college_name TEXT NOT NULL,
  honours_subject TEXT NOT NULL,
  current_semester TEXT NOT NULL,
  class_roll_no TEXT NOT NULL,
  university_name TEXT,
  university_roll_number TEXT NOT NULL UNIQUE,
  university_registration_number TEXT NOT NULL,
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
