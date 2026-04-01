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
        'RECEPTIONIST'
    ) NOT NULL,
    portal_last_login TIMESTAMP,
    is_deleted TINYINT NOT NULL DEFAULT 0
);


CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    p_first_name VARCHAR(50) NOT NULL,
    p_last_name VARCHAR(50) NOT NULL,
    p_dob DATE NOT NULL,
    p_gender ENUM('Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'),
    p_race INT,
    p_race_other_text VARCHAR(100),
    p_ethnicity INT,
    p_phone VARCHAR(20),
    p_email VARCHAR(255),
    p_ssn VARCHAR(11),
    p_drivers_license VARCHAR(50),
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
    updated_by VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE KEY uq_patients_user (user_id),
    UNIQUE KEY uq_patients_phone (p_phone)
);

CREATE TABLE IF NOT EXISTS locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_city VARCHAR(20) NOT NULL,
    location_state VARCHAR(20) NOT NULL,
    loc_street_no VARCHAR(20) NOT NULL,
    loc_street_name VARCHAR(100) NOT NULL,
    loc_zip_code VARCHAR(10) NOT NULL,
    loc_phone VARCHAR(20),
    loc_email VARCHAR(100),
    loc_fax VARCHAR(20),
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
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    profile_image LONGBLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    UNIQUE KEY uq_staff_user (user_id),
    INDEX idx_staff_supervisor (s_staff_id),
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_staff_supervisor FOREIGN KEY (s_staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL ON UPDATE CASCADE
);


CREATE TABLE IF NOT EXISTS staff_locations (
    staff_locations_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    location_id INT NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT NOT NULL AUTO_INCREMENT,
    npi VARCHAR(20) NOT NULL,
    staff_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    PRIMARY KEY (npi),
    UNIQUE KEY uq_doctors_doctor_id (doctor_id),
    UNIQUE KEY uq_doctors_staff (staff_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

INSERT IGNORE INTO departments (department_name, description, created_by, updated_by) VALUES
('General Dentistry', 'Routine dental care including exams, cleanings, and fillings', 'SYSTEM', 'SYSTEM'),
('Orthodontics', 'Teeth alignment and bite correction including braces and aligners', 'SYSTEM', 'SYSTEM'),
('Periodontics', 'Prevention, diagnosis, and treatment of gum diseases', 'SYSTEM', 'SYSTEM'),
('Endodontics', 'Root canal therapy and treatments of dental pulp', 'SYSTEM', 'SYSTEM'),
('Oral Surgery', 'Surgical procedures including extractions and implants', 'SYSTEM', 'SYSTEM'),
('Pediatric Dentistry', 'Dental care for children and adolescents', 'SYSTEM', 'SYSTEM'),
('Prosthodontics', 'Crowns, bridges, dentures, and dental prosthetics', 'SYSTEM', 'SYSTEM'),
('Cosmetic Dentistry', 'Teeth whitening, veneers, and aesthetic procedures', 'SYSTEM', 'SYSTEM');


CREATE TABLE IF NOT EXISTS specialties_department (
    doctor_id INT NOT NULL,
    department_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    PRIMARY KEY (doctor_id, department_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE IF NOT EXISTS appointment_statuses (
    status_id INT AUTO_INCREMENT PRIMARY KEY,
    status_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS treatment_statuses (
    status_id INT AUTO_INCREMENT PRIMARY KEY,
    status_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS cancel_reasons (
    reason_id INT AUTO_INCREMENT PRIMARY KEY,
    reason_text VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS payment_methods (
    method_id INT AUTO_INCREMENT PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS insurance_companies (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(120),
    city VARCHAR(60),
    state CHAR(2),
    zipcode CHAR(10),
    phone_number VARCHAR(20),
    fax_number VARCHAR(20),
    website VARCHAR(255),
    contact_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS insurance_coverage (
    coverage_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    procedure_code VARCHAR(20) NOT NULL,
    coverage_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    copay_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (company_id) REFERENCES insurance_companies(company_id),
    FOREIGN KEY (procedure_code) REFERENCES ada_procedure_codes(procedure_code),
    UNIQUE KEY uq_coverage_company_procedure (company_id, procedure_code)
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

CREATE TABLE IF NOT EXISTS patient_pharmacies (
    patient_pharmacy_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    pharm_id INT NOT NULL,
    is_primary TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (pharm_id) REFERENCES pharmacies(pharm_id),
    UNIQUE KEY uq_patient_pharmacy (patient_id, pharm_id)
);

CREATE TABLE IF NOT EXISTS appointment_slots (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    location_id INT,
    slot_date DATE NOT NULL,
    slot_start_time TIME NOT NULL,
    slot_end_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    is_available BOOLEAN DEFAULT TRUE,
    max_patients INT DEFAULT 1,
    current_bookings INT DEFAULT 0,
    slot_type ENUM('REGULAR', 'EMERGENCY', 'FOLLOW_UP') DEFAULT 'REGULAR',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    UNIQUE KEY uq_slot_doctor_date_time (doctor_id, slot_date, slot_start_time),
    INDEX idx_slot_date (slot_date),
    INDEX idx_slot_doctor (doctor_id),
    INDEX idx_slot_available (is_available),
    CONSTRAINT chk_slot_times CHECK (slot_start_time < slot_end_time),
    CONSTRAINT chk_slot_single_capacity CHECK (max_patients = 1),
    CONSTRAINT chk_slot_capacity CHECK (current_bookings <= max_patients)
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    slot_id INT NOT NULL,
    location_id INT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_date DATE NOT NULL,
    status_id INT NOT NULL DEFAULT 1,
    reason_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (slot_id) REFERENCES appointment_slots(slot_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (status_id) REFERENCES appointment_statuses(status_id),
    FOREIGN KEY (reason_id) REFERENCES cancel_reasons(reason_id),
    UNIQUE KEY uq_appointments_patient_slot (patient_id, slot_id),
    INDEX idx_appointment_slot (slot_id),
    INDEX idx_appointment_doctor_datetime (doctor_id, appointment_date, appointment_time),
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_appointment_patient (patient_id),
    INDEX idx_appointment_doctor (doctor_id)
);

CREATE TABLE IF NOT EXISTS appointment_preference_requests (
    preference_request_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time TIME NOT NULL,
    preferred_location VARCHAR(255),
    location_id INT,
    appointment_reason VARCHAR(255),
    request_status ENUM('PREFERRED_PENDING', 'ASSIGNED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PREFERRED_PENDING',
    assigned_doctor_id INT,
    assigned_date DATE,
    assigned_time TIME,
    available_days VARCHAR(100),
    available_times VARCHAR(255),
    receptionist_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_pref_requests_patient (patient_id),
    INDEX idx_pref_requests_date_time (preferred_date, preferred_time),
    INDEX idx_pref_requests_status (request_status),
    INDEX idx_pref_requests_assigned_doctor (assigned_doctor_id)
);





CREATE TABLE IF NOT EXISTS doctor_time_off (
    time_off_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    location_id INT,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason VARCHAR(100),
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_doctor_time_off_doctor (doctor_id),
    INDEX idx_doctor_time_off_start (start_datetime),
    CONSTRAINT chk_time_off_range CHECK (start_datetime < end_datetime)
);

CREATE TABLE IF NOT EXISTS staff_time_off_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    location_id INT,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason VARCHAR(100),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_staff_time_off_staff (staff_id),
    INDEX idx_staff_time_off_start (start_datetime),
    CONSTRAINT chk_staff_time_off_range CHECK (start_datetime < end_datetime)
);


-- Staff schedule requests: preferred hours submitted by staff, approved by admin
CREATE TABLE IF NOT EXISTS staff_schedule_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    day_of_week ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY') NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    is_off TINYINT(1) NOT NULL DEFAULT 0,
    request_status ENUM('PENDING','APPROVED','DENIED') NOT NULL DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_sched_req_staff (staff_id),
    INDEX idx_sched_req_status (request_status)
);

-- Active approved schedules for staff
CREATE TABLE IF NOT EXISTS staff_schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    day_of_week ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY') NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    is_off TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_staff_day (staff_id, day_of_week),
    INDEX idx_sched_staff (staff_id)
);


CREATE TABLE IF NOT EXISTS insurance (
    insurance_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    company_id INT NOT NULL,
    member_id VARCHAR(50) NOT NULL,
    group_number VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    effective_date DATE NOT NULL,
    expiration_date DATE,
    policy_holder_name VARCHAR(100),
    policy_holder_relationship VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (company_id) REFERENCES insurance_companies(company_id),
    UNIQUE KEY uq_insurance_patient_member_company (patient_id, member_id, company_id),
    INDEX idx_insurance_patient (patient_id),
    INDEX idx_insurance_company (company_id)
);


CREATE TABLE IF NOT EXISTS treatment_plans (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    surface VARCHAR(5),
    procedure_code VARCHAR(20),
    status_id INT NOT NULL DEFAULT 1,
    tooth_number VARCHAR(10),
    estimated_cost DECIMAL(10,2),
    priority VARCHAR(20),
    start_date DATE,
    target_completion_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (procedure_code) REFERENCES ada_procedure_codes(procedure_code),
    FOREIGN KEY (status_id) REFERENCES treatment_statuses(status_id)
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    insurance_id INT,
    amount DECIMAL(10,2) NOT NULL,
    insurance_covered_amount DECIMAL(10,2) NOT NULL,
    patient_amount DECIMAL(10,2) NOT NULL,
    payment_status ENUM('Unpaid', 'Partial', 'Paid', 'Refunded') NOT NULL DEFAULT 'Unpaid',
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
    method_id INT NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
    FOREIGN KEY (method_id) REFERENCES payment_methods(method_id),
    INDEX idx_payment_date (payment_date)
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
    start_date DATE,
    end_date DATE,
    frequency VARCHAR(100),
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
    appointment_id INT,
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
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    CHECK (condition_type IN ('Decay', 'Missing', 'Impacted', 'Existing Amalgam', 'Fracture', 'Crown', 'Root Canal', 'Abscess', 'Periodontal', 'Existing Composite'))
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

CREATE TABLE IF NOT EXISTS clinical_checklist_items (
    checklist_item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_category ENUM('ALLERGY', 'CONDITION', 'MEDICATION', 'ADVERSE_REACTION', 'DENTAL_SYMPTOM', 'PRE_MEDICATION') NOT NULL,
    display_group VARCHAR(80),
    display_order INT NOT NULL DEFAULT 0,
    item_label VARCHAR(120) NOT NULL,
    requires_free_text BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    UNIQUE KEY uq_checklist_category_label (item_category, item_label)
);

CREATE TABLE IF NOT EXISTS patient_checklist_responses (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    checklist_item_id INT NOT NULL,
    is_checked BOOLEAN NOT NULL DEFAULT TRUE,
    other_text VARCHAR(255),
    severity ENUM('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    onset_date DATE,
    resolved_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (checklist_item_id) REFERENCES clinical_checklist_items(checklist_item_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_patient_checklist_response (patient_id, checklist_item_id),
    INDEX idx_patient_checklist_patient (patient_id),
    INDEX idx_patient_checklist_item (checklist_item_id),
    CONSTRAINT chk_checklist_dates CHECK (resolved_date IS NULL OR onset_date IS NULL OR onset_date <= resolved_date)
);

CREATE TABLE IF NOT EXISTS patient_current_medications (
    patient_medication_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    medication_name VARCHAR(120) NOT NULL,
    strength VARCHAR(50),
    dosage VARCHAR(50),
    frequency VARCHAR(50),
    reason_for_use VARCHAR(255),
    route VARCHAR(50),
    start_date DATE,
    end_date DATE,
    prescribing_doctor_id INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (prescribing_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_patient_medications_patient (patient_id),
    INDEX idx_patient_medications_active (patient_id, is_active),
    CONSTRAINT chk_medication_dates CHECK (end_date IS NULL OR start_date IS NULL OR start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS intake_form_submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    form_version VARCHAR(30) DEFAULT 'v1',
    source ENUM('PATIENT_PORTAL', 'STAFF_ENTRY') DEFAULT 'PATIENT_PORTAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_intake_submission_patient (patient_id)
);

CREATE TABLE IF NOT EXISTS intake_yes_no_questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_code VARCHAR(50) NOT NULL UNIQUE,
    section_label VARCHAR(80) NOT NULL,
    question_text VARCHAR(255) NOT NULL,
    has_when_field BOOLEAN NOT NULL DEFAULT FALSE,
    has_details_field BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS intake_yes_no_answers (
    answer_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_value ENUM('YES', 'NO', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    when_text VARCHAR(120),
    details_text VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (submission_id) REFERENCES intake_form_submissions(submission_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (question_id) REFERENCES intake_yes_no_questions(question_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_yes_no_answer (submission_id, question_id),
    INDEX idx_intake_yes_no_submission (submission_id)
);

CREATE TABLE IF NOT EXISTS patient_registration_snapshots (
    snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    snapshot_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_registration_snapshot_patient (patient_id)
);

CREATE TABLE IF NOT EXISTS intake_dental_history (
    dental_history_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    periodontal_disease_yes_no ENUM('YES', 'NO', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    periodontal_disease_date DATE,
    braces_ortho_yes_no ENUM('YES', 'NO', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    braces_ortho_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_dental_history_patient (patient_id)
);

CREATE TABLE IF NOT EXISTS intake_tobacco_types (
    tobacco_type_id INT AUTO_INCREMENT PRIMARY KEY,
    tobacco_label VARCHAR(80) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS intake_tobacco_use (
    tobacco_use_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    tobacco_type_id INT NOT NULL,
    uses_tobacco ENUM('YES', 'NO', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    amount_text VARCHAR(120),
    frequency_text VARCHAR(120),
    quit_date DATE,
    notes TEXT,
    usage_context ENUM('CURRENT', 'FORMER', 'NEVER', 'QUIT') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (submission_id) REFERENCES intake_form_submissions(submission_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tobacco_type_id) REFERENCES intake_tobacco_types(tobacco_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_tobacco_row (submission_id, tobacco_type_id),
    INDEX idx_intake_tobacco_submission (submission_id)
);


CREATE TABLE IF NOT EXISTS intake_caffeine_types (
    caffeine_type_id INT AUTO_INCREMENT PRIMARY KEY,
    caffeine_label VARCHAR(50) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS intake_caffeine_use (
    caffeine_use_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    caffeine_type_id INT NOT NULL,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    amount_text VARCHAR(120),
    frequency_text VARCHAR(120),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (submission_id) REFERENCES intake_form_submissions(submission_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (caffeine_type_id) REFERENCES intake_caffeine_types(caffeine_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_caffeine_row (submission_id, caffeine_type_id),
    INDEX idx_intake_caffeine_submission (submission_id)
);

CREATE TABLE IF NOT EXISTS intake_pain_symptoms (
    pain_symptom_id INT AUTO_INCREMENT PRIMARY KEY,
    symptom_label VARCHAR(120) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);


CREATE TABLE IF NOT EXISTS intake_pain_assessments (
    pain_assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    pain_symptom_id INT NOT NULL,
    pain_level TINYINT NOT NULL DEFAULT 0,
    notes VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (submission_id) REFERENCES intake_form_submissions(submission_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (pain_symptom_id) REFERENCES intake_pain_symptoms(pain_symptom_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_pain_row (submission_id, pain_symptom_id),
    INDEX idx_intake_pain_submission (submission_id),
    CONSTRAINT chk_pain_level_range CHECK (pain_level BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS intake_medication_rows (
    intake_medication_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    row_order INT NOT NULL DEFAULT 1,
    medication_name VARCHAR(120),
    dosage VARCHAR(50),
    frequency VARCHAR(50),
    reason_for_using VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (submission_id) REFERENCES intake_form_submissions(submission_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_intake_medication_row_order (submission_id, row_order),
    INDEX idx_intake_medications_submission (submission_id)
);




-- TRIGGERS

DELIMITER $$

-- Trigger 1: Enforce cancel_reason when appointment is cancelled
DROP TRIGGER IF EXISTS appointments_require_cancel_reason_on_insert $$
CREATE TRIGGER appointments_require_cancel_reason_on_insert
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

DROP TRIGGER IF EXISTS appointments_require_cancel_reason $$
CREATE TRIGGER appointments_require_cancel_reason
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

-- Trigger: Enforce valid appointment status transitions (state machine)
DROP TRIGGER IF EXISTS appointments_enforce_status_transition $$
CREATE TRIGGER appointments_enforce_status_transition
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE old_status VARCHAR(50) DEFAULT NULL;
    DECLARE new_status VARCHAR(50) DEFAULT NULL;

    IF OLD.status_id <> NEW.status_id THEN
        SELECT status_name INTO old_status FROM appointment_statuses WHERE status_id = OLD.status_id LIMIT 1;
        SELECT status_name INTO new_status FROM appointment_statuses WHERE status_id = NEW.status_id LIMIT 1;

        -- Terminal states: no transitions out allowed
        IF old_status IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Appointment status cannot be changed once it is Completed or Cancelled';
        END IF;

        -- CHECKED_IN can only move to COMPLETED or CANCELLED
        IF old_status = 'CHECKED_IN' AND new_status NOT IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A checked-in appointment can only be marked Completed or Cancelled';
        END IF;
    END IF;
END $$

-- Trigger 2: Auto-update invoice payment_status when payment is inserted
DROP TRIGGER IF EXISTS payments_update_invoice_status $$
CREATE TRIGGER payments_update_invoice_status
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

-- Trigger 5: Enforce one primary insurance policy per patient
DROP TRIGGER IF EXISTS insurance_single_primary_insert $$
CREATE TRIGGER insurance_single_primary_insert
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

DROP TRIGGER IF EXISTS insurance_single_primary_update $$
CREATE TRIGGER insurance_single_primary_update
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

-- Trigger 7: Ensure appointment details match selected slot
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

-- Trigger 8: Keep appointment slot counters synchronized
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


-- Trigger: Cancel active appointments when doctor time-off is inserted (is_approved defaults TRUE)
DROP TRIGGER IF EXISTS after_doctor_time_off_insert_cancel_appointments $$
CREATE TRIGGER after_doctor_time_off_insert_cancel_appointments
AFTER INSERT ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;

    IF NEW.is_approved = TRUE THEN
        SELECT status_id INTO v_cancelled_status_id
        FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

        SELECT reason_id INTO v_reason_id
        FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
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
        END IF;
    END IF;
END $$

-- Trigger: Cancel active appointments when doctor time-off is explicitly approved
DROP TRIGGER IF EXISTS after_doctor_time_off_update_cancel_appointments $$
CREATE TRIGGER after_doctor_time_off_update_cancel_appointments
AFTER UPDATE ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;

    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        SELECT status_id INTO v_cancelled_status_id
        FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

        SELECT reason_id INTO v_reason_id
        FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
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
        END IF;
    END IF;
END $$

-- Trigger: Cancel active appointments when a doctor's staff time-off request is approved
DROP TRIGGER IF EXISTS after_staff_time_off_approved_cancel_appointments $$
CREATE TRIGGER after_staff_time_off_approved_cancel_appointments
AFTER UPDATE ON staff_time_off_requests
FOR EACH ROW
BEGIN
    DECLARE v_doctor_id INT DEFAULT NULL;
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;

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

            IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
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
            END IF;
        END IF;
    END IF;
END $$

-- Trigger: Cancel future appointments when a doctor's user account is hidden (is_deleted flips 0 → 1)
DROP TRIGGER IF EXISTS after_staff_hidden_cancel_appointments $$
CREATE TRIGGER after_staff_hidden_cancel_appointments
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    DECLARE v_doctor_id INT DEFAULT NULL;
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;

    IF OLD.is_deleted = 0 AND NEW.is_deleted = 1 THEN
        SELECT d.doctor_id INTO v_doctor_id
        FROM staff st
        JOIN doctors d ON d.staff_id = st.staff_id
        WHERE st.user_id = NEW.user_id
        LIMIT 1;

        IF v_doctor_id IS NOT NULL THEN
            SELECT status_id INTO v_cancelled_status_id
            FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;

            SELECT reason_id INTO v_reason_id
            FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;

            IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
                UPDATE appointments
                SET status_id = v_cancelled_status_id,
                    reason_id = v_reason_id,
                    updated_by = 'SYSTEM_DOCTOR_HIDDEN'
                WHERE doctor_id = v_doctor_id
                  AND appointment_date >= CURDATE()
                  AND status_id NOT IN (
                      SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED')
                  );
            END IF;
        END IF;
    END IF;
END $$

-- Trigger: Auto-unset existing primary pharmacy when a new primary is inserted
DROP TRIGGER IF EXISTS before_patient_pharmacy_insert_one_primary $$
CREATE TRIGGER before_patient_pharmacy_insert_one_primary
BEFORE INSERT ON patient_pharmacies
FOR EACH ROW
BEGIN
    IF NEW.is_primary = 1 THEN
        UPDATE patient_pharmacies
        SET is_primary = 0
        WHERE patient_id = NEW.patient_id AND is_primary = 1;
    END IF;
END $$

-- Trigger: Auto-unset existing primary pharmacy when a different one is updated to primary
DROP TRIGGER IF EXISTS before_patient_pharmacy_update_one_primary $$
CREATE TRIGGER before_patient_pharmacy_update_one_primary
BEFORE UPDATE ON patient_pharmacies
FOR EACH ROW
BEGIN
    IF NEW.is_primary = 1 AND OLD.is_primary = 0 THEN
        UPDATE patient_pharmacies
        SET is_primary = 0
        WHERE patient_id = NEW.patient_id AND is_primary = 1
          AND patient_pharmacy_id != OLD.patient_pharmacy_id;
    END IF;
END $$

-- Trigger: Auto-update invoice payment_status when a payment is recorded
DROP TRIGGER IF EXISTS after_payment_insert_update_invoice_status $$
CREATE TRIGGER after_payment_insert_update_invoice_status
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_patient_amount  DECIMAL(10,2) DEFAULT 0;
    DECLARE v_total_paid      DECIMAL(10,2) DEFAULT 0;
    DECLARE v_total_refunded  DECIMAL(10,2) DEFAULT 0;
    DECLARE v_net_paid        DECIMAL(10,2) DEFAULT 0;
    DECLARE v_new_status      VARCHAR(10);

    SELECT patient_amount INTO v_patient_amount
    FROM invoices WHERE invoice_id = NEW.invoice_id;

    SELECT COALESCE(SUM(payment_amount), 0) INTO v_total_paid
    FROM payments WHERE invoice_id = NEW.invoice_id;

    SELECT COALESCE(SUM(refund_amount), 0) INTO v_total_refunded
    FROM refunds WHERE invoice_id = NEW.invoice_id;

    SET v_net_paid = v_total_paid - v_total_refunded;

    IF v_net_paid >= v_patient_amount THEN
        SET v_new_status = 'Paid';
    ELSEIF v_net_paid > 0 THEN
        SET v_new_status = 'Partial';
    ELSE
        SET v_new_status = 'Unpaid';
    END IF;

    UPDATE invoices
    SET payment_status = v_new_status, updated_by = 'TRIGGER'
    WHERE invoice_id = NEW.invoice_id;
END $$


DELIMITER ;

-- Add 'Refunded' to payment_status ENUM for existing databases
ALTER TABLE invoices MODIFY COLUMN payment_status ENUM('Unpaid', 'Partial', 'Paid', 'Refunded') NOT NULL DEFAULT 'Unpaid';




-- VIEWS - REPORTING

-- Patient Billing Summary
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



