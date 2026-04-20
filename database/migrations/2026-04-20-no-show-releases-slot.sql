-- Ensure NO_SHOW appointments release slot capacity like CANCELLED appointments.
-- This prevents slots from staying locked after a no-show.

DELIMITER $$

DROP TRIGGER IF EXISTS appointments_validate_slot_on_insert $$
CREATE TRIGGER appointments_validate_slot_on_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM appointment_slots s
        WHERE s.slot_id = NEW.slot_id
          AND s.doctor_id = NEW.doctor_id
          AND s.slot_date = NEW.appointment_date
          AND s.slot_start_time = NEW.appointment_time
          AND (
              (NEW.location_id IS NULL AND s.location_id IS NULL) OR
              NEW.location_id = s.location_id
          )
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Appointment must match the selected slot (doctor, location, date, and time)';
    END IF;

    IF NEW.status_id NOT IN (
        SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
    ) AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.slot_id = NEW.slot_id
          AND a.status_id NOT IN (
              SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
          )
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This slot already has an active appointment';
    END IF;
END $$

DROP TRIGGER IF EXISTS appointments_validate_slot_on_update $$
CREATE TRIGGER appointments_validate_slot_on_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM appointment_slots s
        WHERE s.slot_id = NEW.slot_id
          AND s.doctor_id = NEW.doctor_id
          AND s.slot_date = NEW.appointment_date
          AND s.slot_start_time = NEW.appointment_time
          AND (
              (NEW.location_id IS NULL AND s.location_id IS NULL) OR
              NEW.location_id = s.location_id
          )
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Updated appointment must match the selected slot (doctor, location, date, and time)';
    END IF;

    IF NEW.status_id NOT IN (
        SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
    ) AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.slot_id = NEW.slot_id
          AND a.status_id NOT IN (
              SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
          )
          AND a.appointment_id <> NEW.appointment_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This slot already has an active appointment';
    END IF;
END $$

DROP TRIGGER IF EXISTS appointments_sync_slot_on_insert $$
CREATE TRIGGER appointments_sync_slot_on_insert
AFTER INSERT ON appointments
FOR EACH ROW
BEGIN
    UPDATE appointment_slots s
    SET s.current_bookings = (
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.slot_id = s.slot_id
              AND a.status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
              )
        ),
        s.is_available = (
            (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
                  )
            ) < s.max_patients
        )
    WHERE s.slot_id = NEW.slot_id;
END $$

DROP TRIGGER IF EXISTS appointments_sync_slot_on_update $$
CREATE TRIGGER appointments_sync_slot_on_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    UPDATE appointment_slots s
    SET s.current_bookings = (
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.slot_id = s.slot_id
              AND a.status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
              )
        ),
        s.is_available = (
            (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
                  )
            ) < s.max_patients
        )
    WHERE s.slot_id = NEW.slot_id;

    IF OLD.slot_id <> NEW.slot_id THEN
        UPDATE appointment_slots s
        SET s.current_bookings = (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
                  )
            ),
            s.is_available = (
                (
                    SELECT COUNT(*)
                    FROM appointments a
                    WHERE a.slot_id = s.slot_id
                      AND a.status_id NOT IN (
                          SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'NO_SHOW')
                      )
                ) < s.max_patients
            )
        WHERE s.slot_id = OLD.slot_id;
    END IF;
END $$

DELIMITER ;
