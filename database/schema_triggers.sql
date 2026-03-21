-- TRIGGERS

DELIMITER $$

-- Trigger 1: Enforce cancel_reason when appointment is cancelled
DROP TRIGGER IF EXISTS trg_appointments_require_cancel_reason_on_insert $$
CREATE TRIGGER trg_appointments_require_cancel_reason_on_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    DECLARE cancelled_status_id INT DEFAULT 4;
    SELECT status_id INTO cancelled_status_id FROM appointment_statuses
    WHERE status_name = 'CANCELLED' LIMIT 1;
    IF NEW.status_id = cancelled_status_id AND NEW.reason_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'reason_id is required when appointment status is Cancelled';
    END IF;
END $$

DROP TRIGGER IF EXISTS trg_appointments_require_cancel_reason $$
CREATE TRIGGER trg_appointments_require_cancel_reason
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE cancelled_status_id INT DEFAULT 4;
    SELECT status_id INTO cancelled_status_id FROM appointment_statuses 
    WHERE status_name = 'CANCELLED' LIMIT 1;
    IF NEW.status_id = cancelled_status_id AND NEW.reason_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'reason_id is required when appointment status is Cancelled';
    END IF;
END $$

-- Trigger 2: Auto-update invoice payment_status when payment is inserted
DROP TRIGGER IF EXISTS trg_payments_update_invoice_status $$
CREATE TRIGGER trg_payments_update_invoice_status
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE total_paid DECIMAL(10,2) DEFAULT 0.00;
    DECLARE patient_due DECIMAL(10,2) DEFAULT 0.00;

    IF NEW.invoice_id IS NOT NULL THEN
        SELECT COALESCE(SUM(payment_amount), 0.00)
        INTO total_paid
        FROM payments
        WHERE invoice_id = NEW.invoice_id;

        SELECT COALESCE(patient_amount, 0.00)
        INTO patient_due
        FROM invoices
        WHERE invoice_id = NEW.invoice_id;

        UPDATE invoices
        SET payment_status = CASE
            WHEN total_paid <= 0 THEN 'Unpaid'
            WHEN total_paid < patient_due THEN 'Partial'
            ELSE 'Paid'
        END
        WHERE invoice_id = NEW.invoice_id;
    END IF;
END $$

-- Trigger 3: Auto-update invoice payment_status when payment is updated
DROP TRIGGER IF EXISTS trg_payments_update_invoice_status_on_update $$
CREATE TRIGGER trg_payments_update_invoice_status_on_update
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    DECLARE total_paid_new DECIMAL(10,2) DEFAULT 0.00;
    DECLARE patient_due_new DECIMAL(10,2) DEFAULT 0.00;
    DECLARE total_paid_old DECIMAL(10,2) DEFAULT 0.00;
    DECLARE patient_due_old DECIMAL(10,2) DEFAULT 0.00;

    IF NEW.invoice_id IS NOT NULL THEN
        SELECT COALESCE(SUM(payment_amount), 0.00)
        INTO total_paid_new
        FROM payments
        WHERE invoice_id = NEW.invoice_id;

        SELECT COALESCE(patient_amount, 0.00)
        INTO patient_due_new
        FROM invoices
        WHERE invoice_id = NEW.invoice_id;

        UPDATE invoices
        SET payment_status = CASE
            WHEN total_paid_new <= 0 THEN 'Unpaid'
            WHEN total_paid_new < patient_due_new THEN 'Partial'
            ELSE 'Paid'
        END
        WHERE invoice_id = NEW.invoice_id;
    END IF;

    IF OLD.invoice_id IS NOT NULL AND OLD.invoice_id <> NEW.invoice_id THEN
        SELECT COALESCE(SUM(payment_amount), 0.00)
        INTO total_paid_old
        FROM payments
        WHERE invoice_id = OLD.invoice_id;

        SELECT COALESCE(patient_amount, 0.00)
        INTO patient_due_old
        FROM invoices
        WHERE invoice_id = OLD.invoice_id;

        UPDATE invoices
        SET payment_status = CASE
            WHEN total_paid_old <= 0 THEN 'Unpaid'
            WHEN total_paid_old < patient_due_old THEN 'Partial'
            ELSE 'Paid'
        END
        WHERE invoice_id = OLD.invoice_id;
    END IF;
END $$

-- Trigger 4: Auto-update invoice payment_status when payment is deleted
DROP TRIGGER IF EXISTS trg_payments_update_invoice_status_on_delete $$
CREATE TRIGGER trg_payments_update_invoice_status_on_delete
AFTER DELETE ON payments
FOR EACH ROW
BEGIN
    DECLARE total_paid DECIMAL(10,2) DEFAULT 0.00;
    DECLARE patient_due DECIMAL(10,2) DEFAULT 0.00;

    IF OLD.invoice_id IS NOT NULL THEN
        SELECT COALESCE(SUM(payment_amount), 0.00)
        INTO total_paid
        FROM payments
        WHERE invoice_id = OLD.invoice_id;

        SELECT COALESCE(patient_amount, 0.00)
        INTO patient_due
        FROM invoices
        WHERE invoice_id = OLD.invoice_id;

        UPDATE invoices
        SET payment_status = CASE
            WHEN total_paid <= 0 THEN 'Unpaid'
            WHEN total_paid < patient_due THEN 'Partial'
            ELSE 'Paid'
        END
        WHERE invoice_id = OLD.invoice_id;
    END IF;
END $$

-- Trigger 5: Enforce one primary insurance policy per patient
DROP TRIGGER IF EXISTS trg_insurance_single_primary_insert $$
CREATE TRIGGER trg_insurance_single_primary_insert
BEFORE INSERT ON insurance
FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE AND EXISTS (
        SELECT 1
        FROM insurance i
        WHERE i.patient_id = NEW.patient_id
          AND i.is_primary = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Patient already has a primary insurance policy';
    END IF;
END $$

DROP TRIGGER IF EXISTS trg_insurance_single_primary_update $$
CREATE TRIGGER trg_insurance_single_primary_update
BEFORE UPDATE ON insurance
FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE AND EXISTS (
        SELECT 1
        FROM insurance i
        WHERE i.patient_id = NEW.patient_id
          AND i.insurance_id <> NEW.insurance_id
          AND i.is_primary = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Patient already has a primary insurance policy';
    END IF;
END $$

-- Trigger 6: Enforce free text when a checklist item requires it
DROP TRIGGER IF EXISTS trg_patient_checklist_require_other_text_on_insert $$
CREATE TRIGGER trg_patient_checklist_require_other_text_on_insert
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

DROP TRIGGER IF EXISTS trg_patient_checklist_require_other_text_on_update $$
CREATE TRIGGER trg_patient_checklist_require_other_text_on_update
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

-- Trigger 7: Ensure appointment details match selected slot
DROP TRIGGER IF EXISTS trg_appointments_validate_slot_on_insert $$
CREATE TRIGGER trg_appointments_validate_slot_on_insert
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

DROP TRIGGER IF EXISTS trg_appointments_validate_slot_on_update $$
CREATE TRIGGER trg_appointments_validate_slot_on_update
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

-- Trigger 8: Keep appointment slot counters synchronized
DROP TRIGGER IF EXISTS trg_appointments_sync_slot_on_insert $$
CREATE TRIGGER trg_appointments_sync_slot_on_insert
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

DROP TRIGGER IF EXISTS trg_appointments_sync_slot_on_update $$
CREATE TRIGGER trg_appointments_sync_slot_on_update
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

DROP TRIGGER IF EXISTS trg_appointments_sync_slot_on_delete $$
CREATE TRIGGER trg_appointments_sync_slot_on_delete
AFTER DELETE ON appointments
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
    WHERE s.slot_id = OLD.slot_id;
END $$

DELIMITER ;
