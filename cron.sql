-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Job 1: Delete internship applications older than 30 days
-- Runs daily at 3:00 AM (UTC)
select cron.schedule(
  'delete-old-applications', -- job name
  '0 3 * * *',              -- schedule
  $$
    delete from internship_applications 
    where created_at < now() - interval '30 days';
  $$
);

-- Job 2: Delete rate limits, email cooldowns, and suspicious activity logs older than 1 day
-- Runs daily at 3:30 AM (UTC)
select cron.schedule(
  'delete-temp-data',       -- job name
  '30 3 * * *',             -- schedule
  $$
    begin;
      delete from rate_limits 
      where created_at < now() - interval '1 day';
      
      delete from email_cooldowns 
      where created_at < now() - interval '1 day';
      
      delete from suspicious_activity 
      where created_at < now() - interval '1 day';
    commit;
  $$
);
