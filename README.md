# Medical Clinic Project
Team 1 COSC 3380
bright-dental.up.railway.app

## Setup Instructions

### 1. Database Configuration
Create a `.env` file in the project root:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=medical-clinic
ADMIN_SECRET=your_admin_password
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd clinic-medical
npm install
cd ..
```

### 3. Initialize Database
```bash
# Run schema migrations (auto-applies any pending migrations)
node database/init-db.js
```

## Running the Application

### Development Mode
You need to run **two separate processes**:

#### Terminal 1: Backend API Server
```bash
node server.js
# Server will run on http://localhost:3001
```

#### Terminal 2: Frontend Development Server
```bash
cd clinic-medical
npm run dev
# Frontend will run on http://localhost:5173 (or similar)
```

### Production Mode
```bash
# Build frontend
cd clinic-medical
npm run build

# Serve backend
node server.js
```

## Login Credentials For Live Server

```bash
MiaBorbon12
Password1!
Adrian12
Password1!
Christian12
Password1!
patient_tz_b
Password123!
admin
password
```

## Features

### Patient Portal
- Book, reschedule, and cancel appointments
- View billing & invoices with procedure reasons and fee notes
- Pay outstanding invoices online
- View dental findings and treatment plans
- Manage insurance and pharmacy preferences

### Receptionist Portal
- View and manage daily appointments by date
- Check in patients (with confirmation prompt)
- Mark late arrivals — applies a **$25.00 late arrival fee** to the invoice
- Mark no-shows — applies a **$50.00 no-show fee** to the invoice
- Schedule new appointments and manage preference requests
- Handle insurance and pharmacy change requests

### Dentist Portal
- View assigned patient profiles
- Add, edit, and delete dental findings
- Create and manage treatment plans
- Record completed procedures

### Admin Dashboard
- Staff and location management (activate/deactivate dentists and receptionists)
- Appointment reports with filters (date range, provider, location, payment status)
- Financial Detail report showing per-appointment invoice breakdown (gross charge, insurance covered, patient responsibility, payments, refunds, balance, fee notes)
- Metric cards: Total Charged, Insurance Covered, Patient Responsibility, Amount Paid, Refunded, Amount Due

