-- Remove seed-generated appointment preference requests so test/live seed data
-- does not appear as a permanent patient request in receptionist or portal views.

DELETE FROM appointment_preference_requests
WHERE COALESCE(created_by, '') IN ('SYSTEM_SEED')
   OR COALESCE(created_by, '') LIKE 'LIVE_SEED_%';
