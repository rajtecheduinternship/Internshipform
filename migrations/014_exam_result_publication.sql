-- Scores remain an internal record until explicitly released for each submitted attempt.
-- Existing attempts are deliberately private by default; no answers/scores are changed.
BEGIN;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS result_published_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='exam_result_requires_submission'
    AND conrelid='exam_attempts'::regclass) THEN
    ALTER TABLE exam_attempts ADD CONSTRAINT exam_result_requires_submission
      CHECK (result_published_at IS NULL OR submitted_at IS NOT NULL);
  END IF;
END $$;
COMMIT;
