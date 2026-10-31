-- Run after 008. Every course runs 5 weeks.
BEGIN;
ALTER TABLE courses ALTER COLUMN duration_weeks SET DEFAULT 5;
UPDATE courses SET duration_weeks = 5;
COMMIT;
