-- Run after 007. Adds total course hours and sets 90 hours for every course.
BEGIN;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 90;
UPDATE courses SET duration_hours = 90;
COMMIT;
