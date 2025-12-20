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
