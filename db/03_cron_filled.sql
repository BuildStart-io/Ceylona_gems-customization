-- ============================================================================
-- 03_cron.sql — scheduled jobs (safety net + follow-ups).
-- Requires pg_cron + pg_net. Run as superuser on your self-hosted Postgres.
--
-- Replace:
--   http://api-gw:8000/functions/v1  e.g. http://kong:8000/functions/v1   (inside docker)
--   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc5MDUzMTA4MSwiZXhwIjoyMTA1ODkxMDgxfQ.TAwFT4Zgsu6Y4DsJpF781jRRwuo966FsYezsuwei3z4
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Queue drainer safety net. webhook-wsender already fires process-message
-- immediately on each inbound message; this catches anything left behind.
SELECT cron.schedule(
  'drain-message-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'http://api-gw:8000/functions/v1/process-message-Ceylon_gems',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc5MDUzMTA4MSwiZXhwIjoyMTA1ODkxMDgxfQ.TAwFT4Zgsu6Y4DsJpF781jRRwuo966FsYezsuwei3z4"}'::jsonb,
    body    := '{"trigger":"cron"}'::jsonb
  );
  $$
);

-- Order follow-ups + inactivity follow-ups.
SELECT cron.schedule(
  'send-followups',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'http://api-gw:8000/functions/v1/send-followups-Ceylon_gems',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc5MDUzMTA4MSwiZXhwIjoyMTA1ODkxMDgxfQ.TAwFT4Zgsu6Y4DsJpF781jRRwuo966FsYezsuwei3z4"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Inspect:  SELECT jobid, jobname, schedule FROM cron.job;
-- Remove:   SELECT cron.unschedule('drain-message-queue');
