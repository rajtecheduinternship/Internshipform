-- Run after 009. Modules can be unpublished (hidden from students) without deleting them.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
