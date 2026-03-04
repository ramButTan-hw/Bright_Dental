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

/*
PHARMACIES Table
Pharmacy ID(int) (PK)
Address (Composite)
NPI (Pharm ID) (int)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char) 
LastUpdated (datetime)	
*/


/*
USER Table
User ID (int) (PK)
Email (string)
Username (string)
Password (string)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char) 
LastUpdated (datetime)
*/


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
TREATMENT_PLANS Table
Plan_ID (int) (Primary Key)
Patient ID (int) (Foreign Key)
Doctor_ID (int) (Foreign Key)
Tooth_Number (string) 
Surface (string)(Domain constraint = M=Mesial, O=Occlusal, D=Distal, F=Facial, L=Lingual)
Procedure_Code (string) (Foreign Key)
Status (string) 
Estimated_Cost (float)
Date_Proposed (datetime)
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

