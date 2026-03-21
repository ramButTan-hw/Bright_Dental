const http = require('http');
const url = require('url');
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
const MAX_PATIENTS_PER_TIME = 5;
const MAX_PATIENTS_PER_DAY = PREFERRED_TIME_OPTIONS.length * MAX_PATIENTS_PER_TIME;
const DEFAULT_CLINIC_LOCATIONS = [
  { city: 'Houston', state: 'TX', streetNo: '4302', streetName: 'University Dr', zipCode: '77004' },
  { city: 'Sugar Land', state: 'TX', streetNo: '14000', streetName: 'University Blvd', zipCode: '77479' },
  { city: 'Houston', state: 'TX', streetNo: '1', streetName: 'Main St', zipCode: '77002' }
];

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

ensureDefaultClinicLocations();

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

// ============================================================================
// MIDDLEWARE: Parse JSON body
// ============================================================================
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

// ============================================================================
// MIDDLEWARE: CORS headers
// ============================================================================
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

// ============================================================================
// HELPER: Extract path and method
// ============================================================================
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
  sendJSON,
  getDoctorAppointments: patientCoreHandlers.getDoctorAppointments,
  getPatientByUserId: patientCoreHandlers.getPatientByUserId,
  getPatientPastAppointmentReport: patientCoreHandlers.getPatientPastAppointmentReport,
  getPatientAppointments: patientCoreHandlers.getPatientAppointments,
  getPatientNewAppointmentPrefill: patientIntakeHandlers.getPatientNewAppointmentPrefill,
  createPatientNewAppointmentRequest: patientIntakeHandlers.createPatientNewAppointmentRequest,
  getPatientPrimaryDentist: patientCoreHandlers.getPatientPrimaryDentist,
  getPatientAppointmentReport: patientCoreHandlers.getPatientAppointmentReport,
  getPatientById: patientCoreHandlers.getPatientById,
  loginUser: patientCoreHandlers.loginUser,
  checkPatientEmail: patientCoreHandlers.checkPatientEmail,
  registerPatient: patientIntakeHandlers.registerPatient,
  getPainSymptoms: patientIntakeHandlers.getPainSymptoms,
  getPreferredAppointmentAvailability: appointmentPreferenceHandlers.getPreferredAppointmentAvailability,
  getAppointmentPreferenceRequests: appointmentPreferenceHandlers.getAppointmentPreferenceRequests,
  getAppointmentPreferenceRequestById: appointmentPreferenceHandlers.getAppointmentPreferenceRequestById,
  assignAppointmentPreferenceRequest: appointmentPreferenceHandlers.assignAppointmentPreferenceRequest
});

// ============================================================================
// ROUTES
// ============================================================================

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================
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

  // ============================================================================
  // ROUTE MATCHING
  // ============================================================================

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

  // Health check
  if (parsedUrl.pathname === '/' && method === 'GET') {
    return sendJSON(res, 200, { status: 'Medical Clinic API is running' });
  }

  // 404 for undefined routes
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
