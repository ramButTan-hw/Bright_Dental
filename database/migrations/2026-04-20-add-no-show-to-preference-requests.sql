-- Add NO_SHOW as a valid appointment preference request status.
-- This lets no-show handled appointments stop blocking the patient portal
-- while ASSIGNED requests continue to count as active.

ALTER TABLE appointment_preference_requests
  MODIFY request_status ENUM('PREFERRED_PENDING', 'ASSIGNED', 'NO_SHOW', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PREFERRED_PENDING';
