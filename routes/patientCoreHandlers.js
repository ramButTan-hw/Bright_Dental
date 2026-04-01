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

  function getPatientAppointmentRequests(req, patientId, res) {
    pool.query(queries.getPatientAppointmentRequests, [patientId], (err, results) => {
      if (err) {
        console.error('Error fetching patient appointment requests:', err);
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

  function getCancelReasons(req, res) {
    pool.query(
      `SELECT reason_id, reason_text, category FROM cancel_reasons ORDER BY reason_id ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching cancel reasons:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function cancelPatientAppointment(req, patientId, appointmentId, data, res) {
    const reasonId = Number(data?.reasonId);
    if (!Number.isInteger(reasonId) || reasonId <= 0) {
      return sendJSON(res, 400, { error: 'A valid reasonId is required' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for cancel:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          const [statusRows] = await conn.promise().query(
            `SELECT status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1`
          );
          if (!statusRows?.length) throw new Error('CANCELLED status not found');
          const cancelledStatusId = Number(statusRows[0].status_id);

          const [updateResult] = await conn.promise().query(
            `UPDATE appointments
             SET status_id = ?, reason_id = ?, updated_by = 'PATIENT_PORTAL'
             WHERE appointment_id = ? AND patient_id = ?`,
            [cancelledStatusId, reasonId, appointmentId, patientId]
          );

          if (!updateResult.affectedRows) {
            conn.release();
            return sendJSON(res, 404, { error: 'Appointment not found' });
          }

          // Also cancel any ASSIGNED preference requests linked to this appointment
          const [apptRows] = await conn.promise().query(
            `SELECT doctor_id, appointment_date, appointment_time FROM appointments WHERE appointment_id = ? LIMIT 1`,
            [appointmentId]
          );
          if (apptRows?.length) {
            const appt = apptRows[0];
            await conn.promise().query(
              `UPDATE appointment_preference_requests
               SET request_status = 'CANCELLED', updated_by = 'PATIENT_PORTAL'
               WHERE patient_id = ? AND assigned_doctor_id = ? AND assigned_date = ? AND assigned_time = ?
                 AND request_status = 'ASSIGNED'`,
              [patientId, appt.doctor_id, appt.appointment_date, appt.appointment_time]
            );
          }

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing cancel:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Appointment cancelled successfully' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            console.error('Error cancelling appointment:', error);
            sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  function getDepartments(req, res) {
    pool.query(
      `SELECT department_id, department_name, description FROM departments ORDER BY department_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching departments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getInsuranceCompanies(req, res) {
    pool.query(
      `SELECT company_id, company_name, phone_number FROM insurance_companies ORDER BY company_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching insurance companies:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function updatePatientProfile(req, patientId, data, res) {
    const fields = {};
    if (data.firstName !== undefined) fields.p_first_name = String(data.firstName).trim();
    if (data.lastName !== undefined) fields.p_last_name = String(data.lastName).trim();
    if (data.phone !== undefined) fields.p_phone = String(data.phone).trim() || null;
    if (data.email !== undefined) fields.p_email = String(data.email).trim();
    if (data.address !== undefined) fields.p_address = String(data.address).trim() || null;
    if (data.city !== undefined) fields.p_city = String(data.city).trim() || null;
    if (data.state !== undefined) fields.p_state = String(data.state).trim().toUpperCase() || null;
    if (data.zipcode !== undefined) fields.p_zipcode = String(data.zipcode).trim() || null;
    if (data.emergencyContactName !== undefined) fields.p_emergency_contact_name = String(data.emergencyContactName).trim() || null;
    if (data.emergencyContactPhone !== undefined) fields.p_emergency_contact_phone = String(data.emergencyContactPhone).trim() || null;

    const keys = Object.keys(fields);
    if (!keys.length) {
      return sendJSON(res, 400, { error: 'No fields to update' });
    }

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    values.push(patientId);

    pool.query(
      `UPDATE patients SET ${setClauses}, updated_by = 'PATIENT_PORTAL' WHERE patient_id = ?`,
      values,
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return sendJSON(res, 409, { error: 'Email already in use' });
          }
          console.error('Error updating patient profile:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Patient not found' });
        }
        sendJSON(res, 200, { message: 'Profile updated successfully' });
      }
    );
  }

  function addPatientInsurance(req, patientId, data, res) {
    const companyId = Number(data?.companyId);
    const memberId = String(data?.memberId || '').trim();
    const groupNumber = String(data?.groupNumber || '').trim();

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return sendJSON(res, 400, { error: 'A valid insurance company is required' });
    }
    if (!memberId) {
      return sendJSON(res, 400, { error: 'Member ID is required' });
    }

    pool.query(
      `INSERT INTO insurance (patient_id, company_id, member_id, group_number, is_primary, created_by, updated_by)
       VALUES (?, ?, ?, ?, TRUE, 'PATIENT_PORTAL', 'PATIENT_PORTAL')
       ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), group_number = VALUES(group_number), updated_by = 'PATIENT_PORTAL'`,
      [patientId, companyId, memberId, groupNumber || null],
      (err) => {
        if (err) {
          console.error('Error adding patient insurance:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, { message: 'Insurance saved successfully' });
      }
    );
  }

  function removePatientInsurance(req, patientId, insuranceId, res) {
    pool.query(
      `DELETE FROM insurance WHERE insurance_id = ? AND patient_id = ?`,
      [insuranceId, patientId],
      (err, result) => {
        if (err) {
          console.error('Error removing insurance:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Insurance record not found' });
        }
        sendJSON(res, 200, { message: 'Insurance removed successfully' });
      }
    );
  }

  function changeUserPassword(req, userId, data, res) {
    const currentPassword = String(data?.currentPassword || '');
    const newPassword = String(data?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return sendJSON(res, 400, { error: 'Current password and new password are required' });
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return sendJSON(res, 400, { error: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
    }

    pool.query(
      'SELECT user_id FROM users WHERE user_id = ? AND password_hash = SHA2(?, 256) LIMIT 1',
      [userId, currentPassword],
      (err, rows) => {
        if (err) {
          console.error('Error verifying current password:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 401, { error: 'Current password is incorrect' });
        }

        pool.query(
          'UPDATE users SET password_hash = SHA2(?, 256) WHERE user_id = ?',
          [newPassword, userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating password:', updateErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Password updated successfully' });
          }
        );
      }
    );
  }

  return {
    getPatientById,
    getDoctorAppointments,
    getPatientByUserId,
    getPatientAppointments,
    getPatientAppointmentRequests,
    getPatientPrimaryDentist,
    getPatientAppointmentReport,
    getPatientPastAppointmentReport,
    loginUser,
    checkPatientEmail,
    getCancelReasons,
    cancelPatientAppointment,
    getDepartments,
    getInsuranceCompanies,
    updatePatientProfile,
    addPatientInsurance,
    removePatientInsurance,
    changeUserPassword
  };
}

module.exports = {
  createPatientCoreHandlers
};
