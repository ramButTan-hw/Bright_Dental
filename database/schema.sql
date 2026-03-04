
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
    p_street VARCHAR(100),
    p_apt VARCHAR(20),
    p_city VARCHAR(50),
    p_state VARCHAR(2),
    p_zip VARCHAR(10),
    p_country VARCHAR(50),
    p_emergency_contact_name VARCHAR(100),
    p_emergency_contact_phone VARCHAR(20),
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

CREATE TABLE IF NOT EXISTS pharmacy_addresses (
    ph_address_id INT AUTO_INCREMENT PRIMARY KEY,
    ph_address_1 VARCHAR(120),
    ph_address_2 VARCHAR(120),
    ph_city VARCHAR(60),
    ph_state CHAR(2),
    ph_zipcode CHAR(10),
    ph_country VARCHAR(40)
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

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    npi VARCHAR(20) NOT NULL,
    staff_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
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
    ph_address_id INT NOT NULL,
    pharm_name VARCHAR(100),
    pharm_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (ph_address_id) REFERENCES pharmacy_addresses(ph_address_id)
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_date DATE NOT NULL,
    appt_status VARCHAR(20) NOT NULL,
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
    surface VARCHAR(10),
    procedure_code VARCHAR(20),
    treatment_status VARCHAR(20),
    tooth_number VARCHAR(10),
    estimated_cost DECIMAL(10,2),
    quantity INT,
    refills INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (procedure_code) REFERENCES ada_procedure_codes(procedure_code)
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
    updated_by VARCHAR(50)
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
    surface CHAR(1),
    condition_type VARCHAR(30),
    notes VARCHAR(200),
    date_logged DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    CHECK (surface IN ('M', 'O', 'D', 'F', 'L')),
    CHECK (condition_type IN ('Decay', 'Missing', 'Impacted', 'Existing Amalgam'))
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
    CHECK (status IN ('Sent', 'In Production', 'Received', 'Delivered'))
);

CREATE TABLE IF NOT EXISTS vitals (
    vitals_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    blood_pressure INT,
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

