CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_username VARCHAR(50) UNIQUE NOT NULL,
    user_password VARCHAR(50) NOT NULL,
    user_email VARCHAR(50) UNIQUE NOT NULL,
    user_phone VARCHAR(20) UNIQUE NOT NULL,
    account_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    account_last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_role ENUM(
        "ADMIN",
        "PATIENT",
        "DOCTOR",
        "RECEPTIONIST",
        "NURSE"
    ) NOT NULL,
    demographics_id INTEGER NOT NULL,
    portal_last_login TIMESTAMP,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    UNIQUE(user_id),
    UNIQUE(user_email),
    UNIQUE(user_username)
);


CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    p_address_id INT NOT NULL,
    p_first_name VARCHAR(50) NOT NULL,
    p_last_name VARCHAR(50) NOT NULL,
    p_dob DATE NOT NULL,
    p_gender INT,
    p_race INT,
    p_race_other_text VARCHAR(100),
    p_ethnicity INT,
    p_phone VARCHAR(20),
    p_email VARCHAR(100) UNIQUE NOT NULL,,
    p_emergency_contact_name VARCHAR(100),
    p_emergency_contact_phone VARCHAR(20),
    p_address_1 VARCHAR(120),
    p_address_2 VARCHAR(120),
    p_city VARCHAR(60),
    p_state CHAR(2),
    p_zipcode CHAR(10),
    p_country VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)

    FOREIGN KEY (p_address_id) REFERENCES patients_addresses(p_address_id)
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
    s_ssn VARCHAR(11),
    s_address_1 VARCHAR(120),
    s_address_2 VARCHAR(120),
    s_city VARCHAR(60),
    s_state CHAR(2),
    s_zipcode CHAR(10),
    s_country VARCHAR(40),,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
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
    updated_by VARCHAR(50),
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

