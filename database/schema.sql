/*
PATIENT Table
Patient ID(int) (PK)
Name
Address
Date of Birth
Race (int)
RaceOtherText (char)
Gender (int)
Ethnicity (int)
Phone
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

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

/*
DOCTORS Table
Doctor ID (int) (Primary Key)
NPI (string) (mandatory ID for medical workers)
Staff ID (int) (FK)
Specialties/Department (string- multi-valued attribute)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

CREATE TABLE IF NOT EXISTS DOCTORS (
    DOCTOR_ID INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    NPI VARCHAR(20) NOT NULL,
    FOREIGN_KEY(STAFF_ID) INT NOT NULL,
    CREATEDBY CHAR,
    CREATEDAT DATETIME,
    UPDATEDBY CHAR,
    LASTUPDATED DATETIME
);
CREATE TABLE IF NOT EXISTS SPECIALTIES_DEPARTMENT (
    DOCTOR_ID INT NOT NULL,
    SPECIALTY VARCHAR(20) NOT NULL,
    FOREIGN KEY (DOCTOR_ID) REFERENCES DOCTORS(DOCTOR_ID),
    CREATEDBY CHAR,
    CREATEDAT DATETIME,
    UPDATEDBY CHAR,
    LASTUPDATED DATETIME
);


/*
STAFF Table
Staff ID (int) (Primary Key)
User ID (int) (FK)
Location ID (int) (Foreign Key- multi-valued attribute)
Home Address (APT#, House#, Street, City, State, Zip, Country) (composite)
Full Name (string- composite attribute)
Date of Birth (Datetime)
Role (string)
Gender (int)
Race (int)
Ethnicity (int)
Phone Number (string)
SSN (int)
S_SSN (int)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

/*
APPOINTMENTS Table
Appointment ID (int) (Primary Key)
Location ID (int) (Foreign Key)
Patient ID(int) (FK)
Doctor ID (int) (FK)
Room ID (int) (FK)
Appointment Time
Appointment Date
Status of appointment
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/
CREATE TABLE IF NOT EXISTS APPOINTMENTS (
    APPOINTMENT_ID INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    FOREIGN KEY(LOCATION_ID) REFERENCES LOCATIONS(LOCATION_ID),
    FOREIGN KEY(PATIENT_ID) REFERENCES PATIENTS(PATIENT_ID),
    FOREIGN KEY(DOCTOR_ID) REFERENCES DOCTOR(DOCTOR_ID),
    FOREIGN KEY(ROOM_NUMBER) REFERENCES ROOMS(ROOM_NUMBER),
    APPOINTMENT_TIME TIME NOT NULL,
    APPOINTMENT_DATE DATE NOT NULL,
    APPT_STATUS BOOLEAN NOT NULL,
    CREATEDBY CHAR,
    CREATEDAT DATETIME,
    UPDATEDBY CHAR,
    LASTUPDATED DATETIME
);


/*
DEPENDENTS Table
Dependents ID (int) (PK)
Patient ID (int) (FK)
Staff ID (int) (FK)
Address
Phone Number (string)
Relation (String)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


/*
MEDICAL RECORDS Table
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
Patient ID (FK) (INT)
Diagnosis(string)
Record details(string)
Allergies (multi-valued)
Family history (multi-valued)
*/


/*
INVOICES Table
Invoice ID (int) (PK)
Appointment ID (int) (FK)
Insurance ID(int) (FK)
Amount (Float)
Insurance Covered Amount (float)
Patient Amount (float)
Payment Status (Bool)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


/*
PAYMENTS Table
Payment ID(Int) (PK)
Invoice ID (Int) (FK)
Amount (float)
Date
Method (string)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

CREATE TABLE IF NOT EXISTS PAYMENTS (
    PAYMENT_ID INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    FOREIGN KEY(INVOICE_ID) REFERENCES INVOICES(INVOICE_ID),
    PAYMENT_AMOUNT FLOAT NOT NULL,
    PAYMENT_DATE DATETIME NOT NULL,
    PAYMENT_METHOD VARCHAR(10) NOT NULL,
    CREATEDBY CHAR,
    CREATEDAT DATETIME,
    UPDATEDBY CHAR,
    LASTUPDATED DATETIME
);

/*
LOCATIONS Table
Location ID (int)
City (str 20)
State (std 20)
Address(composite)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

CREATE TABLE IF NOT EXISTS LOCATIONS (
    LOCATION_ID INT PRIMARY KEY UNIQUE NOT NULL,
    LOCATION_CITY VARCHAR(20) NOT NULL,
    LOCATION_STATE VARCHAR(20) NOT NULL,
    LOC_STREET_NO INT NOT NULL,
    LOC_STREET_NAME VARCHAR(100) NOT NULL,
    LOC_ZIP_CODE VARCHAR(10) NOT NULL,
    CREATEDBY CHAR,
    CREATEDAT DATETIME,
    UPDATEDBY CHAR,
    LASTUPDATED DATETIME
);



/*
SUPPLIES Table
Supply_ID(int) (PK)
Quantity (int)
Department (string)
Location ID (FK)
Room ID(int) (FK)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/



CREATE TABLE IF NOT EXISTS PHARMACY_ADDRESSES (
  ph_address_id INT PRIMARY KEY AUTO_INCREMENT,
  ph_address_1 VARCHAR(120),
  ph_address_2 VARCHAR(120),
  ph_city VARCHAR(60) ,
  ph_state CHAR(2) ,
  ph_zipcode CHAR(10) ,
  ph_country VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS PHARMACIES (
    pharm_id INT AUTO_INCREMENT PRIMARY KEY,
    ph_address_id INT NOT NULL,
    pharm_name VARCHAR(100),
    pharm_phone VARCHAR(10),
    created_by CHAR(1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(1),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (ph_address_id) REFERENCES PHARMACY_ADDRESSES(ph_address_id)
);

CREATE TABLE IF NOT EXISTS INSURANCE (
    insurance_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    member_id INT NOT NULL,
    group_number INT NOT NULL,
    is_primary BOOLEAN,
    effective_date DATETIME,
    expiration_date DATETIME,
    company_name VARCHAR(100),
    phone_number VARCHAR(15),
    created_by CHAR(1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(1),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
);

CREATE TABLE IF NOT EXISTS PRESCRIPTIONS (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL
    patient_id INT NOT NULL,
    pharm_id INT NOT NULL,
    doctor_id INT NOT NULL,
    medication_name VARCHAR (100),
    instructions VARCHAR (255),
    strength VARCHAR(50),
    dosage VARCHAR(50),
    date_prescribed DATETIME,
    quantity INT,
    refills INT,
    created_by CHAR(1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(1),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (pharm_id) REFERENCES PHARMACIES(pharm_id),
    FOREIGN KEY (doctor_id) REFERENCES DOCTORS(doctor_id),
    FOREIGN KEY (plan_id) REFERENCES TREATMENT_PLANS(plan_id)
);
/*
INSURANCE Table
Insurance ID (int) (PK)
Patient ID (int) (FK)
Member ID (int) (PK)
Group_Number (int)
Is_Primary (bool)
Effective_Date (datetime)
Expiration_Date (datetime)
Company Name (string)
Address
Phone number
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

CREATE TABLE IF NOT EXISTS TREATMENT_PLANS (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    surface VARCHAR(10),
    procedure_code VARCHAR(20),
    treatment_status VARCHAR(20),
    tooth_number VARCHAR(10),
    estimated_cost FLOAT,
    quantity INT,
    refills INT,
    created_by CHAR(1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by CHAR(1),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES DOCTORS(doctor_id),
    FOREIGN KEY (procedure_code) REFERENCES ADA_PROCEDURE_CODES(procedure_code)
);

/*
PRESCRIPTION Table
Prescription ID (int) (PK)
Patient ID (int) (FK)
Pharmacy ID (int) (FK)
Medication info (composite)
Date (dateTime)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


/*
ADA_PROCEDURE_CODES Table
Procedure_Code(PK)(string)
Description(string)
Category(string) (should have front end constraints, Diagnostic, Restorative, Endodontics)
Default_Fees (float) (strict const value for default fees of each procedure)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

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

/*
DENTAL_FINDINGS Table
Finding_ID (int) (Primary Key)
Patient ID (int) (Foreign Key)
Doctor_ID (int) (Foreign Key)
Tooth_Number (string)
Surface(string)(Domain constraint = M=Mesial, O=Occlusal, D=Distal, F=Facial, L=Lingual)
Condition_Type (string) (Domain constraint = 'Decay', 'Missing', 'Impacted', 'Existing Amalgam')
Notes (string)
Date_Logged (datetime)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/




/*
DENTAL_LAB_ORDERS Table
Lab_Order_ID  (int) (Primary Key)
Patient ID (int) (Foreign Key)
Doctor_ID (int) (Foreign Key)
Appointment_ID (int) (FK)
Tooth_Number
Procedure_Code (FK)
Lab_Name (String)
Order_Date (datetime)
Due_Date (datetime)
Status (Sent, In Production, Received, Delivered)
Cost (float)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


/*
VITALS Table
Vitals_ID  (int) (Primary Key)
Appointment_ID (int) (Foreign Key)
Blood_Pressure (int)
Heart_Rate (int) (Domain constraint = Check(heart rate > 0 or < 300))
Oxygen_Saturation (int)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/

/*
MEDICAL ALERTS Table
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char) 
Alert ID (PK)
Patient ID(FK)
Condition (string)
Notes(string)
*/

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

