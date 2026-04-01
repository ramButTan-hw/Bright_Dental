const http = require('http');
const url = require('url');
const fs = require('fs');
const pathModule = require('path');
const querystring = require('querystring');
const pool = require('./database/db');
const queries = require('./queries');
const { createDentistProfileRoutes } = require('./routes/dentistProfileRoutes');
const { createDentistAppointmentRoutes } = require('./routes/dentistAppointmentRoutes');
const { createPatientBillingRoutes } = require('./routes/patientBillingRoutes');
const { createReceptionRoutes } = require('./routes/receptionRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');
const { createAdminHandlers } = require('./routes/adminHandlers');
const { createPatientCoreHandlers } = require('./routes/patientCoreHandlers');
const { createPatientPortalRoutes } = require('./routes/patientPortalRoutes');
const { createAppointmentPreferenceHandlers } = require('./routes/appointmentPreferenceHandlers');
const { createPatientIntakeHandlers } = require('./routes/patientIntakeHandlers');
const crypto = require('crypto');
require('dotenv').config();

const PORT = process.env.PORT || 3001;
const PREFERRED_TIME_OPTIONS = [
  '09:00:00', '10:00:00', '11:00:00', '12:00:00', '13:00:00', '14:00:00',
  '15:00:00', '16:00:00', '17:00:00', '18:00:00', '19:00:00'
];
const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ALLOWED_PATIENT_GENDER_IDS = new Set([1, 2, 3, 4]);
const MAX_PATIENTS_PER_TIME = 1;
const MAX_PATIENTS_PER_DAY = PREFERRED_TIME_OPTIONS.length * MAX_PATIENTS_PER_TIME;
const DEFAULT_CLINIC_LOCATIONS = [
  { city: 'Houston', state: 'TX', streetNo: '4302', streetName: 'University Dr', zipCode: '77004' },
  { city: 'Sugar Land', state: 'TX', streetNo: '14000', streetName: 'University Blvd', zipCode: '77479' },
  { city: 'Houston', state: 'TX', streetNo: '1', streetName: 'Main St', zipCode: '77002' }
];

function generateRandomNpi() {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
}

async function getUniqueRandomNpi(db, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateRandomNpi();
    const [rows] = await db.query('SELECT 1 FROM doctors WHERE npi = ? LIMIT 1', [candidate]);
    if (!rows.length) {
      return candidate;
    }
  }
  throw new Error('Unable to generate a unique NPI after multiple attempts');
}

async function ensureDoctorNpiPrimaryKey() {
  const db = pool.promise();

  try {
    const [invalidNpiDoctors] = await db.query(
      `SELECT doctor_id
       FROM doctors
       WHERE npi IS NULL OR npi NOT REGEXP '^[0-9]{10}$'`
    );

    for (const row of invalidNpiDoctors) {
      const npi = await getUniqueRandomNpi(db);
      await db.query('UPDATE doctors SET npi = ? WHERE doctor_id = ?', [npi, row.doctor_id]);
    }

    try {
      await db.query('ALTER TABLE doctors ADD UNIQUE INDEX uq_doctors_doctor_id (doctor_id)');
    } catch (indexErr) {
      if (indexErr.code !== 'ER_DUP_KEYNAME') {
        throw indexErr;
      }
    }

    const [primaryKeyRows] = await db.query(
      `SELECT COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'doctors'
         AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`
    );

    const isNpiPrimaryKey = primaryKeyRows.length === 1 && primaryKeyRows[0].COLUMN_NAME === 'npi';
    if (!isNpiPrimaryKey) {
      await db.query('ALTER TABLE doctors DROP PRIMARY KEY, ADD PRIMARY KEY (npi)');
    }
  } catch (err) {
    console.error('Error ensuring doctor NPI primary key migration:', err.message);
  }
}

function ensureDefaultClinicLocations() {
  const insertSql = `INSERT INTO locations (location_city, location_state, loc_street_no, loc_street_name, loc_zip_code, created_by, updated_by)
    SELECT ?, ?, ?, ?, ?, 'SYSTEM', 'SYSTEM'
    WHERE NOT EXISTS (
      SELECT 1 FROM locations
      WHERE location_city = ?
        AND location_state = ?
        AND loc_street_no = ?
        AND loc_street_name = ?
        AND loc_zip_code = ?
    )`;

  DEFAULT_CLINIC_LOCATIONS.forEach((location) => {
    const params = [
      location.city,
      location.state,
      location.streetNo,
      location.streetName,
      location.zipCode,
      location.city,
      location.state,
      location.streetNo,
      location.streetName,
      location.zipCode
    ];

    pool.query(insertSql, params, (err) => {
      if (err) {
        console.error('Error ensuring default clinic location:', err.message);
      }
    });
  });
}

// Only seed locations if none exist (prevents duplicates when data is already loaded)
pool.query('SELECT COUNT(*) AS cnt FROM locations', (err, rows) => {
  if (!err && rows[0].cnt === 0) {
    ensureDefaultClinicLocations();
  }
});
ensureDoctorNpiPrimaryKey();

// Ensure location contact columns exist and seed contact info
(function ensureLocationContactColumns() {
  const cols = [
    { name: 'loc_phone', def: "VARCHAR(20) AFTER loc_zip_code" },
    { name: 'loc_email', def: "VARCHAR(100) AFTER loc_phone" },
    { name: 'loc_fax', def: "VARCHAR(20) AFTER loc_email" }
  ];
  let completed = 0;
  const totalCols = cols.length;

  function onColumnDone() {
    completed++;
    if (completed === totalCols) {
      // All location columns ready — seed contact data
      const contactData = [
        { zip: '77004', phone: '(832) 461-3355', email: 'houston@brightdental.com', fax: '(832) 461-3356' },
        { zip: '77479', phone: '(281) 555-0199', email: 'sugarland@brightdental.com', fax: '(281) 555-0200' },
        { zip: '77002', phone: '(713) 555-0142', email: 'downtown@brightdental.com', fax: '(713) 555-0143' }
      ];
      contactData.forEach(({ zip, phone, email, fax }) => {
        pool.query(
          `UPDATE locations SET loc_phone = COALESCE(loc_phone, ?), loc_email = COALESCE(loc_email, ?), loc_fax = COALESCE(loc_fax, ?) WHERE loc_zip_code = ?`,
          [phone, email, fax, zip],
          (err) => {
            if (err) console.error('Error seeding location contact info:', err.message);
          }
        );
      });
    }
  }

  cols.forEach(({ name, def }) => {
    pool.query(`ALTER TABLE locations ADD COLUMN ${name} ${def}`, (err) => {
      if (err && err.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Error adding ${name} column:`, err.message);
      }
      onColumnDone();
    });
  });
})();

pool.query(
  `INSERT INTO appointment_statuses (status_name, display_name, created_by) VALUES
   ('SCHEDULED',   'Scheduled',   'SYSTEM'),
   ('CONFIRMED',   'Confirmed',   'SYSTEM'),
   ('COMPLETED',   'Completed',   'SYSTEM'),
   ('CANCELLED',   'Cancelled',   'SYSTEM'),
   ('RESCHEDULED', 'Rescheduled', 'SYSTEM'),
   ('CHECKED_IN',  'Checked In',  'SYSTEM')
   ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
  (err) => {
    if (err) {
      console.error('Error ensuring appointment statuses:', err.message);
    }
  }
);

pool.query(
  `INSERT INTO treatment_statuses (status_name, display_name, created_by) VALUES
   ('PLANNED',      'Planned',      'SYSTEM'),
   ('IN_PROGRESS',  'In Progress',  'SYSTEM'),
   ('COMPLETED',    'Completed',    'SYSTEM'),
   ('CANCELLED',    'Cancelled',    'SYSTEM')
   ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
  (err) => {
    if (err) {
      console.error('Error ensuring treatment statuses:', err.message);
    }
  }
);

pool.query(
  `INSERT INTO cancel_reasons (reason_text, category, created_by)
   VALUES ('Doctor Unavailable', 'PROVIDER', 'SYSTEM')
   ON DUPLICATE KEY UPDATE category = VALUES(category)`,
  (err) => {
    if (err) console.error('Error ensuring Doctor Unavailable cancel reason:', err.message);
  }
);

// Doctor time-off insert trigger: cancel appointments when time-off is created (is_approved defaults TRUE)
pool.query('DROP TRIGGER IF EXISTS after_doctor_time_off_insert_cancel_appointments', () => {
  pool.query(`CREATE TRIGGER after_doctor_time_off_insert_cancel_appointments
AFTER INSERT ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    IF NEW.is_approved = TRUE THEN
        SELECT status_id INTO v_cancelled_status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;
        SELECT reason_id INTO v_reason_id FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;
        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
            UPDATE appointments SET status_id = v_cancelled_status_id, reason_id = v_reason_id, updated_by = 'SYSTEM_TIME_OFF'
            WHERE doctor_id = NEW.doctor_id
              AND status_id NOT IN (SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED'))
              AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;
            UPDATE appointment_preference_requests SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
            WHERE assigned_doctor_id = NEW.doctor_id AND request_status = 'ASSIGNED'
              AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
              AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;
        END IF;
    END IF;
END`, (err) => { if (err) console.error('Create after_doctor_time_off_insert trigger error:', err.message); });
});

// Doctor time-off update trigger: cancel appointments when time-off is explicitly approved
pool.query('DROP TRIGGER IF EXISTS after_doctor_time_off_update_cancel_appointments', () => {
  pool.query(`CREATE TRIGGER after_doctor_time_off_update_cancel_appointments
AFTER UPDATE ON doctor_time_off
FOR EACH ROW
BEGIN
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        SELECT status_id INTO v_cancelled_status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;
        SELECT reason_id INTO v_reason_id FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;
        IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
            UPDATE appointments SET status_id = v_cancelled_status_id, reason_id = v_reason_id, updated_by = 'SYSTEM_TIME_OFF'
            WHERE doctor_id = NEW.doctor_id
              AND status_id NOT IN (SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED'))
              AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
              AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;
            UPDATE appointment_preference_requests SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
            WHERE assigned_doctor_id = NEW.doctor_id AND request_status = 'ASSIGNED'
              AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
              AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;
        END IF;
    END IF;
END`, (err) => { if (err) console.error('Create after_doctor_time_off_update trigger error:', err.message); });
});

// Appointment status state machine: block invalid status transitions
pool.query('DROP TRIGGER IF EXISTS appointments_enforce_status_transition', () => {
  pool.query(`CREATE TRIGGER appointments_enforce_status_transition
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    DECLARE old_status VARCHAR(50) DEFAULT NULL;
    DECLARE new_status VARCHAR(50) DEFAULT NULL;
    IF OLD.status_id <> NEW.status_id THEN
        SELECT status_name INTO old_status FROM appointment_statuses WHERE status_id = OLD.status_id LIMIT 1;
        SELECT status_name INTO new_status FROM appointment_statuses WHERE status_id = NEW.status_id LIMIT 1;
        IF old_status IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Appointment status cannot be changed once it is Completed or Cancelled';
        END IF;
        IF old_status = 'CHECKED_IN' AND new_status NOT IN ('COMPLETED', 'CANCELLED') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A checked-in appointment can only be marked Completed or Cancelled';
        END IF;
    END IF;
END`, (err) => { if (err) console.error('Create appointments_enforce_status_transition trigger error:', err.message); });
});

// Staff time-off approval trigger: cancel a doctor's appointments when their staff request is approved
pool.query('DROP TRIGGER IF EXISTS after_staff_time_off_approved_cancel_appointments', () => {
  pool.query(`CREATE TRIGGER after_staff_time_off_approved_cancel_appointments
AFTER UPDATE ON staff_time_off_requests
FOR EACH ROW
BEGIN
    DECLARE v_doctor_id INT DEFAULT NULL;
    DECLARE v_cancelled_status_id INT DEFAULT NULL;
    DECLARE v_reason_id INT DEFAULT NULL;
    IF NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN
        SELECT d.doctor_id INTO v_doctor_id FROM doctors d WHERE d.staff_id = NEW.staff_id LIMIT 1;
        IF v_doctor_id IS NOT NULL THEN
            SELECT status_id INTO v_cancelled_status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;
            SELECT reason_id INTO v_reason_id FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;
            IF v_cancelled_status_id IS NOT NULL AND v_reason_id IS NOT NULL THEN
                UPDATE appointments SET status_id = v_cancelled_status_id, reason_id = v_reason_id, updated_by = 'SYSTEM_TIME_OFF'
                WHERE doctor_id = v_doctor_id
                  AND status_id NOT IN (SELECT status_id FROM appointment_statuses WHERE status_name IN ('CANCELLED', 'COMPLETED'))
                  AND TIMESTAMP(appointment_date, appointment_time) >= NEW.start_datetime
                  AND TIMESTAMP(appointment_date, appointment_time) < NEW.end_datetime;
                UPDATE appointment_preference_requests SET request_status = 'CANCELLED', updated_by = 'SYSTEM_TIME_OFF'
                WHERE assigned_doctor_id = v_doctor_id AND request_status = 'ASSIGNED'
                  AND TIMESTAMP(assigned_date, assigned_time) >= NEW.start_datetime
                  AND TIMESTAMP(assigned_date, assigned_time) < NEW.end_datetime;
            END IF;
        END IF;
    END IF;
END`, (err) => { if (err) console.error('Create after_staff_time_off_approved trigger error:', err.message); });
});

// Doctor hidden trigger: cancel future appointments when a doctor's account is deactivated
pool.query('DROP TRIGGER IF EXISTS after_staff_hidden_cancel_appointments', () => {
  pool.query(`CREATE TRIGGER after_staff_hidden_cancel_appointments
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
            SELECT status_id INTO v_cancelled_status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1;
            SELECT reason_id INTO v_reason_id FROM cancel_reasons WHERE reason_text = 'Doctor Unavailable' LIMIT 1;
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
                UPDATE appointment_preference_requests SET request_status = 'CANCELLED', updated_by = 'SYSTEM_DOCTOR_HIDDEN'
                WHERE assigned_doctor_id = v_doctor_id AND request_status = 'ASSIGNED'
                  AND assigned_date >= CURDATE();
            END IF;
        END IF;
    END IF;
END`, (err) => { if (err) console.error('Create after_staff_hidden_cancel_appointments trigger error:', err.message); });
});


// Migration: drop unused color_code column from appointment_statuses
pool.query(`ALTER TABLE appointment_statuses DROP COLUMN color_code`, (err) => {
  if (err && !err.message.includes("check that column/key exists")) { /* column already dropped */ }
});

// Remove dead triggers — app never updates/deletes payments or hard-deletes appointments
['payments_update_invoice_status_on_update', 'payments_update_invoice_status_on_delete', 'appointments_sync_slot_on_delete'].forEach((name) => {
  pool.query(`DROP TRIGGER IF EXISTS ${name}`, (err) => {
    if (err) console.error(`Error dropping trigger ${name}:`, err.message);
  });
});

// Ensure staff time-off request storage exists for non-doctor staff workflows.
pool.query(
  `CREATE TABLE IF NOT EXISTS staff_time_off_requests (
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
  )`,
  (err) => {
    if (err) {
      console.error('Error ensuring staff_time_off_requests table exists:', err.message);
    }
  }
);

// Ensure staff scheduling tables exist.
pool.query(
  `CREATE TABLE IF NOT EXISTS staff_schedule_requests (
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
  )`,
  (err) => {
    if (err) console.error('Error ensuring staff_schedule_requests table:', err.message);
  }
);

pool.query(
  `CREATE TABLE IF NOT EXISTS staff_schedules (
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
  )`,
  (err) => {
    if (err) console.error('Error ensuring staff_schedules table:', err.message);
  }
);

// Migration: add is_off column to existing schedule tables
pool.query(`ALTER TABLE staff_schedules ADD COLUMN is_off TINYINT(1) NOT NULL DEFAULT 0`, (err) => {
  if (err && !err.message.includes('Duplicate column')) console.error('Migration staff_schedules.is_off:', err.message);
});
pool.query(`ALTER TABLE staff_schedule_requests ADD COLUMN is_off TINYINT(1) NOT NULL DEFAULT 0`, (err) => {
  if (err && !err.message.includes('Duplicate column')) console.error('Migration staff_schedule_requests.is_off:', err.message);
});
// Migration: allow NULL times for OFF days
pool.query(`ALTER TABLE staff_schedules MODIFY start_time TIME NULL, MODIFY end_time TIME NULL`, (err) => {
  if (err) console.error('Migration staff_schedules nullable times:', err.message);
});
pool.query(`ALTER TABLE staff_schedule_requests MODIFY start_time TIME NULL, MODIFY end_time TIME NULL`, (err) => {
  if (err) console.error('Migration staff_schedule_requests nullable times:', err.message);
});
// Migration: drop CHECK constraints that block NULL times for OFF days
pool.query(`ALTER TABLE staff_schedules DROP CHECK chk_sched_time`, (err) => {
  if (err && !err.message.includes('not found') && !err.message.includes("doesn't exist") && !err.code === 'ER_CHECK_CONSTRAINT_NOT_FOUND') { /* ignore */ }
});
pool.query(`ALTER TABLE staff_schedule_requests DROP CHECK chk_sched_req_time`, (err) => {
  if (err && !err.message.includes('not found') && !err.message.includes("doesn't exist") && !err.code === 'ER_CHECK_CONSTRAINT_NOT_FOUND') { /* ignore */ }
});

// Migration: create refunds table
pool.query(`CREATE TABLE IF NOT EXISTS refunds (
  refund_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  payment_id INT,
  refund_amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255),
  refunded_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
)`, (err) => {
  if (err && !err.message.includes('already exists')) console.error('Create refunds table:', err.message);
});


// Parse JSON body

function parseJSON(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (err) {
      callback(err, null);
    }
  });
}


// CORS headers
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}

// ============================================================================
// HELPER: Send JSON response
// ============================================================================
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}


// HELPER: Path Extraction and Method
function parsePath(pathname) {
  const parts = pathname.split('/').filter(p => p);
  return { parts, path: parts.join('/') };
}

const dentistProfileRoutes = createDentistProfileRoutes({ pool, sendJSON });
const dentistAppointmentRoutes = createDentistAppointmentRoutes({ pool, sendJSON });
const patientBillingRoutes = createPatientBillingRoutes({ pool, queries, sendJSON });
const receptionRoutes = createReceptionRoutes({ pool, sendJSON });
const adminHandlers = createAdminHandlers({ pool, sendJSON, url });
const adminRoutes = createAdminRoutes({ sendJSON, ...adminHandlers });
const appointmentPreferenceHandlers = createAppointmentPreferenceHandlers({
  pool,
  sendJSON,
  url,
  preferredTimeOptions: PREFERRED_TIME_OPTIONS,
  maxPatientsPerTime: MAX_PATIENTS_PER_TIME,
  maxPatientsPerDay: MAX_PATIENTS_PER_DAY
});
const patientIntakeHandlers = createPatientIntakeHandlers({
  pool,
  queries,
  sendJSON,
  allowedPatientGenderIds: ALLOWED_PATIENT_GENDER_IDS,
  weekdayOptions: WEEKDAY_OPTIONS,
  preferredTimeOptions: PREFERRED_TIME_OPTIONS
});
const patientCoreHandlers = createPatientCoreHandlers({ pool, queries, sendJSON, crypto });
const patientPortalRoutes = createPatientPortalRoutes({
  pool,
  sendJSON,
  getDoctorAppointments: patientCoreHandlers.getDoctorAppointments,
  getPatientByUserId: patientCoreHandlers.getPatientByUserId,
  getPatientPastAppointmentReport: patientCoreHandlers.getPatientPastAppointmentReport,
  getPatientAppointments: patientCoreHandlers.getPatientAppointments,
  getPatientAppointmentRequests: patientCoreHandlers.getPatientAppointmentRequests,
  getPatientNewAppointmentPrefill: patientIntakeHandlers.getPatientNewAppointmentPrefill,
  createPatientNewAppointmentRequest: patientIntakeHandlers.createPatientNewAppointmentRequest,
  getPatientPrimaryDentist: patientCoreHandlers.getPatientPrimaryDentist,
  getPatientAppointmentReport: patientCoreHandlers.getPatientAppointmentReport,
  getPatientById: patientCoreHandlers.getPatientById,
  loginUser: patientCoreHandlers.loginUser,
  checkPatientEmail: patientCoreHandlers.checkPatientEmail,
  getCancelReasons: patientCoreHandlers.getCancelReasons,
  cancelPatientAppointment: patientCoreHandlers.cancelPatientAppointment,
  getDepartments: patientCoreHandlers.getDepartments,
  getInsuranceCompanies: patientCoreHandlers.getInsuranceCompanies,
  updatePatientProfile: patientCoreHandlers.updatePatientProfile,
  addPatientInsurance: patientCoreHandlers.addPatientInsurance,
  changeUserPassword: patientCoreHandlers.changeUserPassword,
  registerPatient: patientIntakeHandlers.registerPatient,
  getPainSymptoms: patientIntakeHandlers.getPainSymptoms,
  getLocations: patientIntakeHandlers.getLocations,
  getPreferredAppointmentAvailability: appointmentPreferenceHandlers.getPreferredAppointmentAvailability,
  getAppointmentPreferenceRequests: appointmentPreferenceHandlers.getAppointmentPreferenceRequests,
  getAppointmentPreferenceRequestById: appointmentPreferenceHandlers.getAppointmentPreferenceRequestById,
  assignAppointmentPreferenceRequest: appointmentPreferenceHandlers.assignAppointmentPreferenceRequest,
  revertAppointmentPreferenceRequest: appointmentPreferenceHandlers.revertAppointmentPreferenceRequest
});


// ROUTES



// MAIN REQUEST HANDLER

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(200);
    return res.end();
  }

  setCORS(res);

  const parsedUrl = url.parse(req.url, true);
  const { parts } = parsePath(parsedUrl.pathname);
  const method = req.method;

  // Static 404 for favicon
  if (parsedUrl.pathname === '/favicon.ico') {
    res.writeHead(404);
    return res.end();
  }


  // ROUTE MATCHING


  // Patient billing and invoices routes
  if (patientBillingRoutes.handlePatientBillingRoutes(req, res, method, parts, parseJSON)) {
    return;
  }

  // Patient portal, login, and intake routes
  if (patientPortalRoutes.handlePatientPortalRoutes(req, res, method, parts, parseJSON)) {
    return;
  }

  // Reception routes
  if (receptionRoutes.handleReceptionRoutes(req, res, method, parts, parseJSON)) {
    return;
  }

  // Dentist profile routes
  if (dentistProfileRoutes.handleDentistProfileRoutes(req, res, method, parts, parseJSON)) {
    return;
  }

  // Dentist appointment routes
  if (dentistAppointmentRoutes.handleDentistAppointmentRoutes(req, res, method, parts, parseJSON)) {
    return;
  }

  // Admin and staff management routes
  if (adminRoutes.handleAdminRoutes(req, res, method, parts, parseJSON, parsedUrl)) {
    return;
  }

  // Health check (API only)
  if (parsedUrl.pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { status: 'Medical Clinic API is running' });
  }

  // Serve React build in production
  const buildDir = pathModule.join(__dirname, 'clinic-medical', 'dist');
  if (fs.existsSync(buildDir)) {
    const MIME_TYPES = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
      '.ttf': 'font/ttf', '.webp': 'image/webp'
    };

    // Try to serve the exact static file
    const filePath = pathModule.join(buildDir, parsedUrl.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = pathModule.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(content);
    }

    // For all other routes, serve index.html (React Router handles client-side routing)
    const indexPath = pathModule.join(buildDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }
  }

  // 404 for undefined routes (no build available)
  sendJSON(res, 404, { error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Medical Clinic API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
