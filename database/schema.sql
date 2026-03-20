CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    user_phone VARCHAR(20) UNIQUE NOT NULL,
    account_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    account_last_login TIMESTAMP DEFAULT NULL,
    user_role ENUM(
        'ADMIN',
        'PATIENT',
        'DOCTOR',
        'RECEPTIONIST',
        'HYGIENIST'
    ) NOT NULL,
    portal_last_login TIMESTAMP,
    is_deleted TINYINT NOT NULL DEFAULT 0
);


CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    p_first_name VARCHAR(50) NOT NULL,
    p_last_name VARCHAR(50) NOT NULL,
    p_dob DATE NOT NULL,
    p_gender INT,
    p_race INT,
    p_race_other_text VARCHAR(100),
    p_ethnicity INT,
    p_phone VARCHAR(20),
    p_email VARCHAR(100) UNIQUE NOT NULL,
    p_emergency_contact_name VARCHAR(100),
    p_emergency_contact_phone VARCHAR(20),
    p_address VARCHAR(120),
    p_city VARCHAR(60),
    p_state CHAR(2),
    p_zipcode CHAR(10),
    p_country VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);



CREATE TABLE IF NOT EXISTS locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_city VARCHAR(20) NOT NULL,
    location_state VARCHAR(20) NOT NULL,
    loc_street_no VARCHAR(20) NOT NULL,
    loc_street_name VARCHAR(100) NOT NULL,
    loc_zip_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS ada_procedure_codes (
    procedure_code VARCHAR(20) PRIMARY KEY,
    description TEXT,
    category VARCHAR(50),
    default_fees DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender INT,
    race INT,
    ethnicity INT,
    phone_number VARCHAR(20),
    ssn VARCHAR(11),
    salary DECIMAL(10,2),
    s_staff_id INT,
    s_address VARCHAR(120),
    s_city VARCHAR(60),
    s_state CHAR(2),
    s_zipcode CHAR(10),
    s_country VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    INDEX idx_staff_supervisor (s_staff_id),
    CONSTRAINT fk_staff_supervisor FOREIGN KEY (s_staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_staff_not_self_supervisor CHECK (s_staff_id IS NULL OR s_staff_id <> staff_id)
);

CREATE TABLE IF NOT EXISTS staff_locations (
    staff_locations_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    location_id INT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    npi VARCHAR(20) NOT NULL,
    staff_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);


CREATE TABLE IF NOT EXISTS specialties_department (
    doctor_id INT NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    PRIMARY KEY (doctor_id, specialty),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

CREATE TABLE IF NOT EXISTS pharmacies (
    pharm_id INT AUTO_INCREMENT PRIMARY KEY,
    pharm_name VARCHAR(100),
    pharm_phone VARCHAR(20),
    ph_address_1 VARCHAR(120),
    ph_address_2 VARCHAR(120),
    ph_city VARCHAR(60),
    ph_state CHAR(2),
    ph_zipcode CHAR(10),
    ph_country VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_date DATE NOT NULL,
    appt_status VARCHAR(20) NOT NULL,
    cancel_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

CREATE TABLE IF NOT EXISTS insurance (
    insurance_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    member_id INT NOT NULL,
    group_number INT NOT NULL,
    is_primary BOOLEAN,
    effective_date DATETIME,
    expiration_date DATETIME,
    company_name VARCHAR(100),
    phone_number VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);


CREATE TABLE IF NOT EXISTS treatment_plans (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    surface VARCHAR(5),
    procedure_code VARCHAR(20),
    treatment_status VARCHAR(20),
    tooth_number VARCHAR(10),
    estimated_cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (procedure_code) REFERENCES ada_procedure_codes(procedure_code)
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    insurance_id INT,
    amount DECIMAL(10,2) NOT NULL,
    insurance_covered_amount DECIMAL(10,2) NOT NULL,
    patient_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (insurance_id) REFERENCES insurance(insurance_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
);


CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    payment_amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT,
    patient_id INT NOT NULL,
    pharm_id INT NOT NULL,
    doctor_id INT NOT NULL,
    medication_name VARCHAR(100),
    instructions VARCHAR(255),
    strength VARCHAR(50),
    dosage VARCHAR(50),
    date_prescribed DATETIME,
    quantity INT,
    refills INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (plan_id) REFERENCES treatment_plans(plan_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (pharm_id) REFERENCES pharmacies(pharm_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

CREATE TABLE IF NOT EXISTS dental_findings (
    finding_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    tooth_number VARCHAR(10) NOT NULL,
    surface VARCHAR(5),
    condition_type VARCHAR(30),
    notes VARCHAR(200),
    date_logged DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    CHECK (condition_type IN ('Decay', 'Missing', 'Impacted', 'Existing Amalgam', 'Fracture', 'Crown', 'Root Canal', 'Abscess', 'Periodontal', 'Existing Composite'))
);

CREATE TABLE IF NOT EXISTS dental_lab_orders (
    lab_order_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_id INT,
    tooth_number VARCHAR(10),
    procedure_code VARCHAR(20),
    lab_name VARCHAR(100),
    order_date DATETIME,
    due_date DATETIME,
    status VARCHAR(20),
    cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    FOREIGN KEY (procedure_code) REFERENCES ada_procedure_codes(procedure_code),
    CHECK (status IN ('Sent', 'In Production', 'Received', 'Delivered', 'Cancelled'))
);

CREATE TABLE IF NOT EXISTS vitals (
    vitals_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    blood_pressure_systolic INT,
    blood_pressure_diastolic INT,
    heart_rate INT,
    oxygen_saturation INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    CHECK (heart_rate > 0 AND heart_rate < 300)
);

CREATE TABLE IF NOT EXISTS medical_alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    alert_condition VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);



-- TRIGGERS

DELIMITER $$

-- Trigger 1: Enforce cancel_reason when appointment is cancelled
DROP TRIGGER IF EXISTS trg_appointments_require_cancel_reason $$
CREATE TRIGGER trg_appointments_require_cancel_reason
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    IF NEW.appt_status = 'Cancelled'
       AND (NEW.cancel_reason IS NULL OR TRIM(NEW.cancel_reason) = '') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'cancel_reason is required when appointment status is Cancelled';
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

DELIMITER ;





-- VIEWS - OPERATIONAL & REPORTING

-- View 1: Organizational hierarchy
CREATE OR REPLACE VIEW vw_staff_hierarchy AS
SELECT
    e.staff_id AS employee_id,
    e.first_name AS employee_first_name,
    e.last_name AS employee_last_name,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_full_name,
    e.s_staff_id AS supervisor_id,
    s.first_name AS supervisor_first_name,
    s.last_name AS supervisor_last_name,
    COALESCE(CONCAT(s.first_name, ' ', s.last_name), 'No Supervisor') AS supervisor_full_name,
    e.phone_number,
    e.salary,
    e.created_at
FROM staff e
LEFT JOIN staff s ON e.s_staff_id = s.staff_id
ORDER BY e.s_staff_id, e.last_name, e.first_name;


-- REPORT VIEWS

-- Report 1: Patient Billing Summary
CREATE OR REPLACE VIEW vw_report_patient_billing AS
SELECT
    p.patient_id,
    CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
    p.p_email,
    p.p_phone,
    COUNT(DISTINCT i.invoice_id) AS total_invoices,
    COALESCE(SUM(i.amount), 0) AS total_charged,
    COALESCE(SUM(i.insurance_covered_amount), 0) AS insurance_covered,
    COALESCE(SUM(i.patient_amount), 0) AS patient_responsibility,
    COALESCE(SUM(CASE WHEN i.payment_status = 'Paid' THEN i.patient_amount ELSE 0 END), 0) AS patient_paid,
    COALESCE(SUM(CASE WHEN i.payment_status IN ('Unpaid', 'Partial') THEN i.patient_amount ELSE 0 END), 0) AS patient_due,
    p.created_at AS patient_since
FROM patients p
LEFT JOIN appointments a ON p.patient_id = a.patient_id
LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
GROUP BY p.patient_id, p.p_first_name, p.p_last_name, p.p_email, p.p_phone, p.created_at
ORDER BY patient_due DESC;


-- Report 2: Doctor Appointment Utilization & Revenue
CREATE OR REPLACE VIEW vw_report_doctor_utilization AS
SELECT
    d.doctor_id,
    s.staff_id,
    CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    SUM(CASE WHEN a.appt_status = 'Completed' THEN 1 ELSE 0 END) AS completed_appointments,
    SUM(CASE WHEN a.appt_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_appointments,
    ROUND(100.0 * SUM(CASE WHEN a.appt_status = 'Completed' THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(DISTINCT a.appointment_id), 0), 2) AS completion_rate_percent,
    COALESCE(SUM(i.amount), 0) AS total_revenue,
    COALESCE(AVG(i.amount), 0) AS avg_invoice_value,
    MIN(a.appointment_date) AS first_appointment,
    MAX(a.appointment_date) AS last_appointment
FROM doctors d
LEFT JOIN staff s ON d.staff_id = s.staff_id
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
GROUP BY d.doctor_id, s.staff_id, s.first_name, s.last_name
ORDER BY total_revenue DESC;


-- Report 3: Treatment Plans Progress
CREATE OR REPLACE VIEW vw_report_treatment_progress AS
SELECT
    tp.plan_id,
    CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
    CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
    apc.procedure_code,
    apc.description AS procedure_name,
    apc.category AS procedure_category,
    tp.tooth_number,
    tp.surface,
    tp.treatment_status,
    tp.estimated_cost,
    COALESCE(SUM(i.amount), 0) AS invoiced_amount,
    tp.created_at AS plan_created,
    COUNT(DISTINCT a.appointment_id) AS total_appointments
FROM treatment_plans tp
LEFT JOIN patients p ON tp.patient_id = p.patient_id
LEFT JOIN doctors d ON tp.doctor_id = d.doctor_id
LEFT JOIN staff s ON d.staff_id = s.staff_id
LEFT JOIN ada_procedure_codes apc ON tp.procedure_code = apc.procedure_code
LEFT JOIN appointments a ON a.patient_id = tp.patient_id AND a.doctor_id = tp.doctor_id
LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
GROUP BY tp.plan_id, p.p_first_name, p.p_last_name, s.first_name, s.last_name, apc.procedure_code, apc.description, apc.category, tp.tooth_number, tp.surface, tp.treatment_status, tp.estimated_cost, tp.created_at
ORDER BY tp.treatment_status, tp.created_at DESC;


-- Report 4: Single Patient Treatment History
CREATE OR REPLACE VIEW vw_report_patient_treatment_history AS
SELECT
    p.patient_id,
    CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
    tp.plan_id,
    CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
    apc.procedure_code,
    apc.description AS procedure_name,
    tp.tooth_number,
    tp.surface,
    tp.treatment_status,
    tp.estimated_cost,
    a.appointment_date,
    a.appt_status,
    i.payment_status,
    i.amount AS invoice_amount,
    tp.created_at
FROM treatment_plans tp
LEFT JOIN patients p ON tp.patient_id = p.patient_id
LEFT JOIN doctors d ON tp.doctor_id = d.doctor_id
LEFT JOIN staff s ON d.staff_id = s.staff_id
LEFT JOIN ada_procedure_codes apc ON tp.procedure_code = apc.procedure_code
LEFT JOIN appointments a ON a.patient_id = p.patient_id AND a.doctor_id = d.doctor_id
LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
ORDER BY p.patient_id, a.appointment_date DESC;


-- Report 5: Popular Procedures Report
CREATE OR REPLACE VIEW vw_report_popular_procedures AS
SELECT
    tp.procedure_code,
    apc.description AS procedure_name,
    apc.category AS procedure_category,
    COUNT(DISTINCT tp.plan_id) AS total_procedures,
    COUNT(DISTINCT tp.patient_id) AS unique_patients,
    SUM(CASE WHEN tp.treatment_status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
    ROUND(100.0 * SUM(CASE WHEN tp.treatment_status = 'Completed' THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(DISTINCT tp.plan_id), 0), 2) AS completion_rate_percent,
    ROUND(AVG(tp.estimated_cost), 2) AS avg_estimated_cost,
    ROUND(COALESCE(AVG(i.amount), 0), 2) AS avg_actual_cost,
    COALESCE(SUM(i.amount), 0) AS total_revenue_generated
FROM treatment_plans tp
LEFT JOIN ada_procedure_codes apc ON tp.procedure_code = apc.procedure_code
LEFT JOIN appointments a ON a.patient_id = tp.patient_id AND a.doctor_id = tp.doctor_id
LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
WHERE tp.procedure_code IS NOT NULL
GROUP BY tp.procedure_code, apc.description, apc.category
ORDER BY total_procedures DESC, total_revenue_generated DESC;

