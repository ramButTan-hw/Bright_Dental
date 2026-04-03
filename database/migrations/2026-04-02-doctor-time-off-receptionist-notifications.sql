-- Add receptionist notifications for doctor time-off approvals.
-- This keeps the live Railway schema aligned with schema.sql.

ALTER TABLE receptionist_notifications
    MODIFY COLUMN notification_type ENUM('INSURANCE_CHANGE_REQUEST', 'PHARMACY_CHANGE_REQUEST', 'DOCTOR_TIME_OFF') NOT NULL;

DELIMITER $$

DROP TRIGGER IF EXISTS after_doctor_time_off_insert_cancel_appointments $$
CREATE TRIGGER after_doctor_time_off_insert_cancel_appointments
AFTER INSERT ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    DECLARE v_doctor_name VARCHAR(120) DEFAULT '';
    DECLARE v_affected_count INT DEFAULT 0;
    DECLARE v_patient_id INT DEFAULT NULL;

    IF NEW.is_approved = TRUE THEN
        SELECT status_id INTO v_cancelled_status_id
        FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

        SELECT reason_id INTO v_reason_id
        FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

        SELECT CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))
        INTO v_doctor_name
        FROM doctors d
        JOIN staff st ON st.staff_id = d.staff_id
        WHERE d.doctor_id = NEW.doctor_id
        LIMIT 1;

        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
            SELECT COUNT(*), MIN(a.patient_id)
            INTO v_affected_count, v_patient_id
            FROM appointments a
            WHERE a.doctor_id = NEW.doctor_id
              AND a.status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
              )
              AND TIMESTAMP(a.appointment_date, a.appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(a.appointment_date, a.appointment_time) < NEW.end_datetime;

            UPDATE appointments
            SET status_id = v_cancelled_status_id,
                reason_id = v_reason_id,
                updated_by = 'SYSTEM_TIME_OFF'
            WHERE doctor_id = NEW.doctor_id
              AND status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
              )
              AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;

            UPDATE appointment_preference_requests
            SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
            WHERE assigned_doctor_id = NEW.doctor_id
              AND request_status = 'ASSIGNED'
              AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
              AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;

            IF v_affected_count > 0 AND v_patient_id IS NOT NULL THEN
                INSERT INTO receptionist_notifications (
                    source_table,
                    source_request_id,
                    patient_id,
                    notification_type,
                    message,
                    created_by,
                    updated_by
                ) VALUES (
                    'doctor_time_off',
                    NEW.time_off_id,
                    v_patient_id,
                    'DOCTOR_TIME_OFF',
                    CONCAT('Doctor time off approved for ', COALESCE(NULLIF(TRIM(v_doctor_name), ''), CONCAT('doctor #', NEW.doctor_id)), '. ', v_affected_count, ' appointment', IF(v_affected_count = 1, '', 's'), ' were cancelled and need rescheduling.'),
                    'SYSTEM_TRIGGER',
                    'SYSTEM_TRIGGER'
                )
                ON DUPLICATE KEY UPDATE
                    patient_id = VALUES(patient_id),
                    notification_type = VALUES(notification_type),
                    message = VALUES(message),
                    updated_by = VALUES(updated_by);
            END IF;
        END IF;
    END IF;
END $$

DROP TRIGGER IF EXISTS after_doctor_time_off_update_cancel_appointments $$
CREATE TRIGGER after_doctor_time_off_update_cancel_appointments
AFTER UPDATE ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    DECLARE v_doctor_name VARCHAR(120) DEFAULT '';
    DECLARE v_affected_count INT DEFAULT 0;
    DECLARE v_patient_id INT DEFAULT NULL;

    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        SELECT status_id INTO v_cancelled_status_id
        FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

        SELECT reason_id INTO v_reason_id
        FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

        SELECT CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))
        INTO v_doctor_name
        FROM doctors d
        JOIN staff st ON st.staff_id = d.staff_id
        WHERE d.doctor_id = NEW.doctor_id
        LIMIT 1;

        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
            SELECT COUNT(*), MIN(a.patient_id)
            INTO v_affected_count, v_patient_id
            FROM appointments a
            WHERE a.doctor_id = NEW.doctor_id
              AND a.status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
              )
              AND TIMESTAMP(a.appointment_date, a.appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(a.appointment_date, a.appointment_time) < NEW.end_datetime;

            UPDATE appointments
            SET status_id = v_cancelled_status_id,
                reason_id = v_reason_id,
                updated_by = 'SYSTEM_TIME_OFF'
            WHERE doctor_id = NEW.doctor_id
              AND status_id NOT IN (
                  SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
              )
              AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;

            UPDATE appointment_preference_requests
            SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
            WHERE assigned_doctor_id = NEW.doctor_id
              AND request_status = 'ASSIGNED'
              AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
              AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;

            IF v_affected_count > 0 AND v_patient_id IS NOT NULL THEN
                INSERT INTO receptionist_notifications (
                    source_table,
                    source_request_id,
                    patient_id,
                    notification_type,
                    message,
                    created_by,
                    updated_by
                ) VALUES (
                    'doctor_time_off',
                    NEW.time_off_id,
                    v_patient_id,
                    'DOCTOR_TIME_OFF',
                    CONCAT('Doctor time off approved for ', COALESCE(NULLIF(TRIM(v_doctor_name), ''), CONCAT('doctor #', NEW.doctor_id)), '. ', v_affected_count, ' appointment', IF(v_affected_count = 1, '', 's'), ' were cancelled and need rescheduling.'),
                    'SYSTEM_TRIGGER',
                    'SYSTEM_TRIGGER'
                )
                ON DUPLICATE KEY UPDATE
                    patient_id = VALUES(patient_id),
                    notification_type = VALUES(notification_type),
                    message = VALUES(message),
                    updated_by = VALUES(updated_by);
            END IF;
        END IF;
    END IF;
END $$

DROP TRIGGER IF EXISTS after_staff_time_off_approved_cancel_appointments $$
CREATE TRIGGER after_staff_time_off_approved_cancel_appointments
AFTER UPDATE ON staff_time_off_requests
FOR EACH ROW
BEGIN
    DECLARE v_doctor_id INT DEFAULT NULL;
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    DECLARE v_doctor_name VARCHAR(120) DEFAULT '';
    DECLARE v_affected_count INT DEFAULT 0;
    DECLARE v_patient_id INT DEFAULT NULL;

    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        SELECT d.doctor_id INTO v_doctor_id
        FROM doctors d
        WHERE d.staff_id = NEW.staff_id
        LIMIT 1;

        IF v_doctor_id IS NOT NULL THEN
            SELECT status_id INTO v_cancelled_status_id
            FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

            SELECT reason_id INTO v_reason_id
            FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

            SELECT CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))
            INTO v_doctor_name
            FROM doctors d
            JOIN staff st ON st.staff_id = d.staff_id
            WHERE d.doctor_id = v_doctor_id
            LIMIT 1;

            IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
                SELECT COUNT(*), MIN(a.patient_id)
                INTO v_affected_count, v_patient_id
                FROM appointments a
                WHERE a.doctor_id = v_doctor_id
                  AND a.status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
                  )
                  AND TIMESTAMP(a.appointment_date, a.appointment_time) >= NEW.start_datetime
                  AND TIMESTAMP(a.appointment_date, a.appointment_time) < NEW.end_datetime;

                UPDATE appointments
                SET status_id = v_cancelled_status_id,
                    reason_id = v_reason_id,
                    updated_by = 'SYSTEM_TIME_OFF'
                WHERE doctor_id = v_doctor_id
                  AND status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
                  )
                  AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
                  AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;

                UPDATE appointment_preference_requests
                SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
                WHERE assigned_doctor_id = v_doctor_id
                  AND request_status = 'ASSIGNED'
                  AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
                  AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;

                IF v_affected_count > 0 AND v_patient_id IS NOT NULL THEN
                    INSERT INTO receptionist_notifications (
                        source_table,
                        source_request_id,
                        patient_id,
                        notification_type,
                        message,
                        created_by,
                        updated_by
                    ) VALUES (
                        'staff_time_off_requests',
                        NEW.request_id,
                        v_patient_id,
                        'DOCTOR_TIME_OFF',
                        CONCAT('Doctor time off approved for ', COALESCE(NULLIF(TRIM(v_doctor_name), ''), CONCAT('doctor #', v_doctor_id)), '. ', v_affected_count, ' appointment', IF(v_affected_count = 1, '', 's'), ' were cancelled and need rescheduling.'),
                        'SYSTEM_TRIGGER',
                        'SYSTEM_TRIGGER'
                    )
                    ON DUPLICATE KEY UPDATE
                        patient_id = VALUES(patient_id),
                        notification_type = VALUES(notification_type),
                        message = VALUES(message),
                        updated_by = VALUES(updated_by);
                END IF;
            END IF;
        END IF;
    END IF;
END $$

DELIMITER ;
