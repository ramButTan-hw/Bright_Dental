const http = require('http');
const url = require('url');
const querystring = require('querystring');
const pool = require('./database/db');
const queries = require('./queries');
const crypto = require('crypto');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

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

// ============================================================================
// ROUTES
// ============================================================================

// Route: GET /api/patients/:id
function getPatientById(req, patientId, res) {
  pool.query(queries.getPatientById, [patientId], (err, results) => {
    if (err) {
      console.error('Error fetching patient:', err);
      return sendJSON(res, 500, { error: 'Database error' });
    }
    if (results.length === 0) {
      return sendJSON(res, 404, { error: 'Patient not found' });
    }
    sendJSON(res, 200, results[0]);
  });
}

// Route: GET /api/doctors/:id/appointments
function getDoctorAppointments(req, doctorId, res) {
  pool.query(queries.getDoctorAppointments, [doctorId], (err, results) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return sendJSON(res, 500, { error: 'Database error' });
    }
    sendJSON(res, 200, results);
  });
}

// Route: GET /api/patients/:id/billing
function getPatientBilling(req, patientId, res) {
  pool.query(queries.getPatientBilling, [patientId], (err, results) => {
    if (err) {
      console.error('Error fetching billing:', err);
      return sendJSON(res, 500, { error: 'Database error' });
    }
    if (results.length === 0) {
      return sendJSON(res, 404, { error: 'No billing data found' });
    }
    sendJSON(res, 200, results[0]);
  });
}

// Route: POST /api/login
function loginUser(req, data, res) {
  const { username, password } = data;

  if (!username || !password) {
    return sendJSON(res, 400, { error: 'Username and password required' });
  }

  pool.query(queries.getUserForLogin, [username], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      return sendJSON(res, 500, { error: 'Database error' });
    }

    if (results.length === 0) {
      return sendJSON(res, 401, { error: 'Invalid credentials' });
    }

    const user = results[0];
    // TODO: Use bcrypt.compare() in production; for now, simple comparison
    // In production: bcrypt.compare(password, user.password_hash)
    if (password !== user.password_hash) {
      return sendJSON(res, 401, { error: 'Invalid credentials' });
    }

    // Update last login
    pool.query(queries.updateLastLogin, [user.user_id]);

    // TODO: Generate JWT token in production
    // For now, return user data with a simple token
    const token = crypto.randomBytes(32).toString('hex');

    sendJSON(res, 200, {
      token,
      user: {
        user_id: user.user_id,
        username,
        email: user.user_email,
        role: user.user_role
      }
    });
  });
}

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

  // GET /api/patients/:id
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2]) {
    const patientId = parseInt(parts[2]);
    return getPatientById(req, patientId, res);
  }

  // GET /api/doctors/:id/appointments
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'doctors' && parts[2] && parts[3] === 'appointments') {
    const doctorId = parseInt(parts[2]);
    return getDoctorAppointments(req, doctorId, res);
  }

  // GET /api/patients/:id/billing
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'billing') {
    const patientId = parseInt(parts[2]);
    return getPatientBilling(req, patientId, res);
  }

  // POST /api/login
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'login') {
    return parseJSON(req, (err, data) => {
      if (err) {
        return sendJSON(res, 400, { error: 'Invalid JSON' });
      }
      loginUser(req, data, res);
    });
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
