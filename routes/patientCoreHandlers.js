function createPatientCoreHandlers(deps) {
  const { pool, queries, sendJSON, crypto } = deps;
  
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

  function getDoctorAppointments(req, doctorId, res) {
    pool.query(queries.getDoctorAppointments, [doctorId], (err, results) => {
      if (err) {
        console.error('Error fetching appointments:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, results);
    });
  }

  function getPatientByUserId(req, userId, res) {
    pool.query(queries.getPatientByUserId, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching patient by user id:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (results.length === 0) {
        return sendJSON(res, 404, { error: 'Patient not found for user' });
      }
      sendJSON(res, 200, results[0]);
    });
  }

  function getPatientAppointments(req, patientId, res) {
    pool.query(queries.getPatientAppointments, [patientId], (err, results) => {
      if (err) {
        console.error('Error fetching patient appointments:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, results || []);
    });
  }

  function getPatientPrimaryDentist(req, patientId, res) {
    pool.query(queries.getPatientPrimaryDentist, [patientId], (err, results) => {
      if (err) {
        console.error('Error fetching primary dentist:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      sendJSON(res, 200, {
        assigned: Boolean(results?.length),
        dentist: results?.[0] || null
      });
    });
  }

  function getPatientAppointmentReport(req, patientId, res) {
    pool.query(queries.getPatientAppointmentReport, [patientId], (err, rows) => {
      if (err) {
        console.error('Error fetching patient report:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      const data = rows || [];
      const summary = data.reduce((acc, row) => {
        if (row?.appointment_id) {
          acc.totalAppointments += 1;
        }
        if (row?.invoice_id) {
          acc.totalInvoices += 1;
          acc.totalInvoiceAmount += Number(row.invoice_total || 0);
          acc.totalPatientAmount += Number(row.patient_amount || 0);
          acc.totalInsuranceCovered += Number(row.insurance_covered_amount || 0);
        }
        return acc;
      }, {
        totalAppointments: 0,
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        totalPatientAmount: 0,
        totalInsuranceCovered: 0
      });

      sendJSON(res, 200, {
        patientId,
        generatedAt: new Date().toISOString(),
        summary,
        rows: data
      });
    });
  }

  function getPatientPastAppointmentReport(req, patientId, appointmentId, res) {
    pool.query(queries.getPatientAppointmentReportByAppointmentId, [patientId, appointmentId], (err, rows) => {
      if (err) {
        console.error('Error fetching past appointment report:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      if (!rows?.length) {
        return sendJSON(res, 404, { error: 'Past appointment report not found' });
      }

      const row = rows[0];
      sendJSON(res, 200, {
        patientId,
        appointmentId,
        generatedAt: new Date().toISOString(),
        summary: {
          hasVisitNotes: Boolean(row?.visit_notes),
          hasInvoice: Boolean(row?.invoice_id)
        },
        row
      });
    });
  }

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
      const incomingHash = crypto.createHash('sha256').update(String(password)).digest('hex');
      if (String(incomingHash).toLowerCase() !== String(user.password_hash || '').toLowerCase()) {
        return sendJSON(res, 401, { error: 'Invalid credentials' });
      }

      pool.query(queries.updateLastLogin, [user.user_id]);

      const token = crypto.randomBytes(32).toString('hex');

      sendJSON(res, 200, {
        token,
        user: {
          user_id: user.user_id,
          patient_id: user.patient_id || null,
          staff_id: user.staff_id || null,
          doctor_id: user.doctor_id || null,
          username,
          email: user.user_email,
          role: user.user_role,
          full_name: [user.staff_first_name, user.staff_last_name].filter(Boolean).join(' ').trim() || null
        }
      });
    });
  }

  function checkPatientEmail(req, data, res) {
    const { email } = data;

    if (!email || typeof email !== 'string') {
      console.warn('Invalid email check request:', { email });
      return sendJSON(res, 400, { error: 'Email is required' });
    }

    console.log('Checking email:', email);

    pool.query(queries.checkEmailExists, [email, email], (err, results) => {
      if (err) {
        console.error('Error checking email:', email, err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      const exists = Boolean(results[0]?.email_exists);
      console.log('Email check result:', email, '->', exists);
      sendJSON(res, 200, { email, exists });
    });
  }

  return {
    getPatientById,
    getDoctorAppointments,
    getPatientByUserId,
    getPatientAppointments,
    getPatientPrimaryDentist,
    getPatientAppointmentReport,
    getPatientPastAppointmentReport,
    loginUser,
    checkPatientEmail
  };
}

module.exports = {
  createPatientCoreHandlers
};
