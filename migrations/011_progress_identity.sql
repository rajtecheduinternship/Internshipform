-- Stable progress identity: changing/reusing an email must never split or transfer learning history.
-- Run after 010, before deploying the corresponding application code. Back up first;
-- this transaction locks the progress table while consolidating legacy duplicates.
BEGIN;
LOCK TABLE video_progress IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE progress_identity_merge ON COMMIT DROP AS
WITH stats AS (
  SELECT student_id, video_id, MAX(total_seconds_watched) AS old_seconds,
    MAX(completion_percentage) AS old_percentage, BOOL_OR(is_completed) AS old_completed,
    MIN(completed_at) AS completed_at, MIN(first_watched_at) AS first_watched_at, MAX(updated_at) AS updated_at
  FROM video_progress GROUP BY student_id, video_id
), keepers AS (
  SELECT DISTINCT ON (student_id,video_id) id,student_id,video_id
  FROM video_progress ORDER BY student_id,video_id,updated_at DESC,id
), ranges AS (
  SELECT p.student_id,p.video_id,
    GREATEST(0, LEAST(v.duration_seconds, FLOOR(CASE WHEN jsonb_typeof(i->0)='number' THEN (i->>0)::numeric ELSE 0 END))) AS a,
    GREATEST(0, LEAST(v.duration_seconds, CEIL(CASE WHEN jsonb_typeof(i->1)='number' THEN (i->>1)::numeric ELSE 0 END))) AS b
  FROM video_progress p JOIN videos v ON v.id=p.video_id,
    LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.watched_intervals)='array' THEN p.watched_intervals ELSE '[]'::jsonb END) i
), ordered AS (
  SELECT *, MAX(b) OVER (PARTITION BY student_id,video_id ORDER BY a,b ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_end
  FROM ranges WHERE b>a
), islands AS (
  SELECT *, SUM(CASE WHEN prev_end IS NULL OR a>prev_end+1 THEN 1 ELSE 0 END)
    OVER (PARTITION BY student_id,video_id ORDER BY a,b) AS island FROM ordered
), merged AS (
  SELECT student_id,video_id,island,MIN(a) AS a,MAX(b) AS b FROM islands GROUP BY student_id,video_id,island
), covered AS (
  SELECT student_id,video_id,jsonb_agg(jsonb_build_array(a,b) ORDER BY a) AS intervals,SUM(b-a) AS seconds
  FROM merged GROUP BY student_id,video_id
)
SELECT k.id,s.*,COALESCE(c.intervals,'[]'::jsonb) AS intervals,
  GREATEST(s.old_seconds,COALESCE(c.seconds,0)) AS seconds,v.duration_seconds,v.required_watch_percent
FROM stats s JOIN keepers k USING(student_id,video_id)
JOIN videos v ON v.id=s.video_id LEFT JOIN covered c USING(student_id,video_id);

UPDATE video_progress p SET
  watched_intervals=n.intervals,total_seconds_watched=n.seconds,
  completion_percentage=LEAST(100,GREATEST(n.old_percentage,CASE WHEN n.duration_seconds>0 THEN ROUND(n.seconds*100.0/n.duration_seconds,2) ELSE 0 END)),
  is_completed=n.old_completed OR (n.duration_seconds>0 AND n.seconds*100>=n.duration_seconds::bigint*n.required_watch_percent),
  completed_at=COALESCE(n.completed_at,CASE WHEN n.duration_seconds>0 AND n.seconds*100>=n.duration_seconds::bigint*n.required_watch_percent THEN NOW() END),
  first_watched_at=n.first_watched_at,updated_at=n.updated_at
FROM progress_identity_merge n WHERE p.id=n.id;
DELETE FROM video_progress p USING progress_identity_merge n
  WHERE p.student_id=n.student_id AND p.video_id=n.video_id AND p.id<>n.id;
ALTER TABLE video_progress DROP CONSTRAINT IF EXISTS video_progress_student_email_video_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_progress_identity ON video_progress(student_id,video_id);
COMMIT;
