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
NCPDP UPI (string)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


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
SALARIES Table
Salary ID(int) (PK)
Hours Worked (float)
Rate(float)
Hours Scheduled(Float
Hours Total(Float)
Tax (float)
CreatedBy (char)
CreatedAt (datetime)
UpdatedBy (char)
LastUpdated (datetime)
*/


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
