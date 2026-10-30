-- Announce the new batch starting 3 November 2026.
-- Run after 003_news_ticker.sql on the application's database.
-- Stable ID + conflict handling make reruns safe. Existing notices and any
-- subsequent admin edits/visibility changes to this notice are left untouched.
WITH requested_notice AS (
  SELECT
    '203bcc8c-ee60-5965-99bd-de202a5b97cb'::uuid AS id,
    E'New batch starts on 3 November 2026.\nनया बैच 3 नवंबर 2026 से शुरू होगा।'::text AS message
)
INSERT INTO news_ticker (id, message, link_url, is_active, sort_order)
SELECT id, message, '/apply', true, 1
FROM requested_notice
WHERE NOT EXISTS (
  SELECT 1 FROM news_ticker existing
  WHERE existing.id = requested_notice.id
     OR existing.message = requested_notice.message
)
ON CONFLICT (id) DO NOTHING;
