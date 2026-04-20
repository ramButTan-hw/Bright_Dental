-- Recreate validation and slot-sync triggers that may be missing in older DBs
-- due to previous schema import delimiter issues.

DELIMITER $$

DROP TRIGGER IF EXISTS patient_checklist_require_other_text_on_insert $$
CREATE TRIGGER patient_checklist_require_other_text_on_insert
BEFORE INSERT ON patient_checklist_responses
FOR EACH ROW
BEGIN
    IF NEW.is_checked = TRUE AND EXISTS (
        SELECT 1
        FROM clinical_checklist_items ci
        WHERE ci.checklist_item_id = NEW.checklist_item_id
          AND ci.requires_free_text = TRUE
    ) AND (NEW.other_text IS NULL OR TRIM(NEW.other_text) = '') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'other_text is required for this checklist item';
    END IF;
END $$

DROP TRIGGER IF EXISTS patient_checklist_require_other_text_on_update $$
CREATE TRIGGER patient_checklist_require_other_text_on_update
BEFORE UPDATE ON patient_checklist_responses
FOR EACH ROW
BEGIN
    IF NEW.is_checked = TRUE AND EXISTS (
        SELECT 1
        FROM clinical_checklist_items ci
        WHERE ci.checklist_item_id = NEW.checklist_item_id
          AND ci.requires_free_text = TRUE
    ) AND (NEW.other_text IS NULL OR TRIM(NEW.other_text) = '') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'other_text is required for this checklist item';
    END IF;
END $$

DROP TRIGGER IF EXISTS appointments_validate_slot_on_insert $$
CREATE TRIGGER appointments_validate_slot_on_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    DECLARE cancelled_status_id INT DEFAULT 4;

    SELECT status_id INTO cancelled_status_id
    FROM appointment_statuses
    WHERE status_name = 'CANCELLED'
    LIMIT 1;

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

    IF NEW.status_id <> cancelled_status_id AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.slot_id = NEW.slot_id
          AND a.status_id <> cancelled_status_id
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
    DECLARE cancelled_status_id INT DEFAULT 4;

    SELECT status_id INTO cancelled_status_id
    FROM appointment_statuses
    WHERE status_name = 'CANCELLED'
    LIMIT 1;

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

    IF NEW.status_id <> cancelled_status_id AND EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.slot_id = NEW.slot_id
          AND a.status_id <> cancelled_status_id
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
    DECLARE cancelled_status_id INT DEFAULT 4;

    SELECT status_id INTO cancelled_status_id
    FROM appointment_statuses
    WHERE status_name = 'CANCELLED'
    LIMIT 1;

    UPDATE appointment_slots s
    SET s.current_bookings = (
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.slot_id = s.slot_id
              AND a.status_id <> cancelled_status_id
        ),
        s.is_available = (
            (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id <> cancelled_status_id
            ) < s.max_patients
        )
    WHERE s.slot_id = NEW.slot_id;
END $$

DROP TRIGGER IF EXISTS appointments_sync_slot_on_update $$
CREATE TRIGGER appointments_sync_slot_on_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE cancelled_status_id INT DEFAULT 4;

    SELECT status_id INTO cancelled_status_id
    FROM appointment_statuses
    WHERE status_name = 'CANCELLED'
    LIMIT 1;

    UPDATE appointment_slots s
    SET s.current_bookings = (
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.slot_id = s.slot_id
              AND a.status_id <> cancelled_status_id
        ),
        s.is_available = (
            (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id <> cancelled_status_id
            ) < s.max_patients
        )
    WHERE s.slot_id = NEW.slot_id;

    IF OLD.slot_id <> NEW.slot_id THEN
        UPDATE appointment_slots s
        SET s.current_bookings = (
                SELECT COUNT(*)
                FROM appointments a
                WHERE a.slot_id = s.slot_id
                  AND a.status_id <> cancelled_status_id
            ),
            s.is_available = (
                (
                    SELECT COUNT(*)
                    FROM appointments a
                    WHERE a.slot_id = s.slot_id
                      AND a.status_id <> cancelled_status_id
                ) < s.max_patients
            )
        WHERE s.slot_id = OLD.slot_id;
    END IF;
END $$

DELIMITER ;
