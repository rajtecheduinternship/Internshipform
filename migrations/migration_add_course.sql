-- Migration script to add the 'course' column to existing internship_applications table
-- Run this if you already have the table created and need to add the course field

-- Add the course column after internship_topic
ALTER TABLE internship_applications 
ADD COLUMN IF NOT EXISTS course TEXT;

-- For existing records, you may want to set a default value or leave as NULL
-- Uncomment the line below if you want to set a default value for existing records
-- UPDATE internship_applications SET course = 'B.A.' WHERE course IS NULL;

-- If you want to make it NOT NULL after setting values, uncomment:
-- ALTER TABLE internship_applications ALTER COLUMN course SET NOT NULL;

-- Made with Bob
