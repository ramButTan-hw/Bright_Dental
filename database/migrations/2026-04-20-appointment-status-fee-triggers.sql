-- Enforce no-show and late-arrival penalty fees at the database level.
-- This centralizes fee application so all clients follow the same policy.

DROP TRIGGER IF EXISTS appointments_apply_fee_on_no_show;
DROP TRIGGER IF EXISTS appointments_apply_fee_on_late_checkin;

DELIMITER $$

CREATE TRIGGER appointments_apply_fee_on_no_show
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE v_no_show_status_id INT DEFAULT NULL;
    DECLARE v_invoice_id INT DEFAULT NULL;
    DECLARE v_existing_note VARCHAR(255) DEFAULT NULL;

    IF OLD.status_id <> NEW.status_id THEN
        SELECT status_id INTO v_no_show_status_id
        FROM appointment_statuses
        WHERE status_name = 'NO_SHOW'
        LIMIT 1;

        IF v_no_show_status_id IS NOT NULL AND NEW.status_id = v_no_show_status_id THEN
            SELECT invoice_id, fee_note
            INTO v_invoice_id, v_existing_note
            FROM invoices
            WHERE appointment_id = NEW.appointment_id
            LIMIT 1;

            IF v_invoice_id IS NULL THEN
                INSERT INTO invoices (
                    appointment_id,
                    insurance_id,
                    amount,
                    insurance_covered_amount,
                    patient_amount,
                    payment_status,
                    fee_note,
                    created_by,
                    updated_by
                ) VALUES (
                    NEW.appointment_id,
                    NULL,
                    50.00,
                    0,
                    50.00,
                    'Unpaid',
                    'No-show fee',
                    'TRIGGER_FEE',
                    'TRIGGER_FEE'
                );
            ELSEIF v_existing_note IS NULL OR v_existing_note NOT LIKE '%No-show fee%' THEN
                UPDATE invoices
                SET amount = amount + 50.00,
                    patient_amount = patient_amount + 50.00,
                    fee_note = CASE
                        WHEN fee_note IS NULL OR TRIM(fee_note) = '' THEN 'No-show fee'
                        ELSE CONCAT(fee_note, '; No-show fee')
                    END,
                    updated_by = 'TRIGGER_FEE'
                WHERE invoice_id = v_invoice_id;
            END IF;
        END IF;
    END IF;
END $$

CREATE TRIGGER appointments_apply_fee_on_late_checkin
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE v_checked_in_status_id INT DEFAULT NULL;
    DECLARE v_invoice_id INT DEFAULT NULL;
    DECLARE v_existing_note VARCHAR(255) DEFAULT NULL;
    DECLARE v_minutes_late INT DEFAULT 0;

    IF OLD.status_id <> NEW.status_id THEN
        SELECT status_id INTO v_checked_in_status_id
        FROM appointment_statuses
        WHERE status_name = 'CHECKED_IN'
        LIMIT 1;

        IF v_checked_in_status_id IS NOT NULL AND NEW.status_id = v_checked_in_status_id THEN
            SET v_minutes_late = TIMESTAMPDIFF(
                MINUTE,
                TIMESTAMP(NEW.appointment_date, NEW.appointment_time),
                NOW()
            );

            IF v_minutes_late > 15 THEN
                SELECT invoice_id, fee_note
                INTO v_invoice_id, v_existing_note
                FROM invoices
                WHERE appointment_id = NEW.appointment_id
                LIMIT 1;

                IF v_invoice_id IS NULL THEN
                    INSERT INTO invoices (
                        appointment_id,
                        insurance_id,
                        amount,
                        insurance_covered_amount,
                        patient_amount,
                        payment_status,
                        fee_note,
                        created_by,
                        updated_by
                    ) VALUES (
                        NEW.appointment_id,
                        NULL,
                        25.00,
                        0,
                        25.00,
                        'Unpaid',
                        CONCAT('Late arrival fee (', v_minutes_late, ' min past scheduled time)'),
                        'TRIGGER_FEE',
                        'TRIGGER_FEE'
                    );
                ELSEIF v_existing_note IS NULL OR v_existing_note NOT LIKE '%Late arrival fee%' THEN
                    UPDATE invoices
                    SET amount = amount + 25.00,
                        patient_amount = patient_amount + 25.00,
                        fee_note = CASE
                            WHEN fee_note IS NULL OR TRIM(fee_note) = ''
                                THEN CONCAT('Late arrival fee (', v_minutes_late, ' min past scheduled time)')
                            ELSE CONCAT(
                                fee_note,
                                '; Late arrival fee (',
                                v_minutes_late,
                                ' min past scheduled time)'
                            )
                        END,
                        updated_by = 'TRIGGER_FEE'
                    WHERE invoice_id = v_invoice_id;
                END IF;
            END IF;
        END IF;
    END IF;
END $$

DELIMITER ;
