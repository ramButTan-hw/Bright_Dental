-- Add NO_SHOW appointment status for tracking no-show appointments and applying fees
INSERT IGNORE INTO appointment_statuses (status_name, display_name)
VALUES ('NO_SHOW', 'No Show');
