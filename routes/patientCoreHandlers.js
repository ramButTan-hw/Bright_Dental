function createPatientCoreHandlers(deps) {
  const { pool, queries, sendJSON, crypto } = deps;

  const FEE_LATE_CANCEL = 35.00;

  async function applyLateCancelFee(conn, appointmentId) {
    const [[existing]] = await conn.promise().query(
      'SELECT invoice_id, amount, patient_amount FROM invoices WHERE appointment_id = ? LIMIT 1',
      [appointmentId]
    );
    if (existing) {
      await conn.promise().query(
        `UPDATE invoices
         SET amount = amount + ?, patient_amount = patient_amount + ?,
             fee_note = 'Late cancellation fee (within 24 hours)', updated_by = 'SYSTEM_FEE'
         WHERE invoice_id = ?`,
        [FEE_LATE_CANCEL, FEE_LATE_CANCEL, existing.invoice_id]
      );
    } else {
      await conn.promise().query(
        `INSERT INTO invoices
         (appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount,
          payment_status, fee_note, created_by, updated_by)
         VALUES (?, NULL, ?, 0, ?, 'Unpaid', 'Late cancellation fee (within 24 hours)', 'SYSTEM_FEE', 'SYSTEM_FEE')`,
        [appointmentId, FEE_LATE_CANCEL, FEE_LATE_CANCEL]
      );
    }
  }
  
    function normalizePhoneForStorage(value) {
      const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
      if (!digits) return null;
      if (digits.length !== 10) return '';
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
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

      pool.query(queries.updateLastLogin, [user.user_id], (err) => {
        if (err) console.error('Failed to update last login for user', user.user_id, ':', err.message);
      });

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
    const cancelNote = String(data?.cancelNote || '').trim();
    if (!cancelNote) {
      return sendJSON(res, 400, { error: 'Please provide a reason for cancellation' });
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

          const [[patientCancelReason]] = await conn.promise().query(
            `SELECT reason_id FROM cancel_reasons WHERE reason_text = 'Patient Cancelled' LIMIT 1`
          );
          const patientReasonId = patientCancelReason?.reason_id ?? null;

          // Fetch appointment date+time before cancelling to check 24-hour window
          const [[apptInfo]] = await conn.promise().query(
            `SELECT doctor_id, appointment_date, appointment_time FROM appointments WHERE appointment_id = ? LIMIT 1`,
            [appointmentId]
          );

          const [updateResult] = await conn.promise().query(
            `UPDATE appointments
             SET status_id = ?, reason_id = ?, notes = ?, updated_by = 'PATIENT_PORTAL'
             WHERE appointment_id = ? AND patient_id = ?
               AND status_id NOT IN (
                 SELECT status_id FROM appointment_statuses
                 WHERE status_name IN ('CANCELLED', 'COMPLETED')
               )`,
            [cancelledStatusId, patientReasonId, cancelNote, appointmentId, patientId]
          );

          if (!updateResult.affectedRows) {
            conn.release();
            return sendJSON(res, 404, { error: 'Appointment not found or cannot be cancelled' });
          }

          // Also cancel any ASSIGNED preference requests linked to this appointment
          if (apptInfo) {
            await conn.promise().query(
              `UPDATE appointment_preference_requests
               SET request_status = 'CANCELLED', updated_by = 'PATIENT_PORTAL'
               WHERE patient_id = ? AND assigned_doctor_id = ? AND assigned_date = ? AND assigned_time = ?
                 AND request_status = 'ASSIGNED'`,
              [patientId, apptInfo.doctor_id, apptInfo.appointment_date, apptInfo.appointment_time]
            );
          }

          // Apply late cancellation fee if appointment is within 24 hours
          let feeApplied = false;
          if (apptInfo) {
            const apptDateStr = apptInfo.appointment_date instanceof Date
              ? apptInfo.appointment_date.toISOString().slice(0, 10)
              : String(apptInfo.appointment_date).slice(0, 10);
            const scheduledAt = new Date(`${apptDateStr}T${apptInfo.appointment_time}`);
            const hoursUntilAppt = (scheduledAt.getTime() - Date.now()) / 3600000;
            if (hoursUntilAppt >= 0 && hoursUntilAppt < 24) {
              await applyLateCancelFee(conn, appointmentId);
              feeApplied = true;
            }
          }

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing cancel:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, {
              message: feeApplied
                ? `Appointment cancelled. A $${FEE_LATE_CANCEL.toFixed(2)} late cancellation fee has been added because the appointment was within 24 hours.`
                : 'Appointment cancelled successfully',
              feeApplied,
              feeAmount: feeApplied ? FEE_LATE_CANCEL : 0
            });
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
    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhoneForStorage(data.phone);
      if (normalizedPhone === '') {
        return sendJSON(res, 400, { error: 'Phone number must contain exactly 10 digits' });
      }
      fields.p_phone = normalizedPhone;
    }
    if (data.email !== undefined) fields.p_email = String(data.email).trim();
    if (data.address !== undefined) fields.p_address = String(data.address).trim() || null;
    if (data.city !== undefined) fields.p_city = String(data.city).trim() || null;
    if (data.state !== undefined) fields.p_state = String(data.state).trim().toUpperCase() || null;
    if (data.zipcode !== undefined) {
      const zipDigits = String(data.zipcode || '').replace(/\D/g, '');
      if (zipDigits.length && zipDigits.length !== 5) {
        return sendJSON(res, 400, { error: 'ZIP code must contain exactly 5 digits' });
      }
      fields.p_zipcode = zipDigits || null;
    }
    if (data.emergencyContactName !== undefined) fields.p_emergency_contact_name = String(data.emergencyContactName).trim() || null;
    if (data.emergencyContactPhone !== undefined) {
      const normalizedEmergencyPhone = normalizePhoneForStorage(data.emergencyContactPhone);
      if (normalizedEmergencyPhone === '') {
        return sendJSON(res, 400, { error: 'Emergency contact phone must contain exactly 10 digits' });
      }
      fields.p_emergency_contact_phone = normalizedEmergencyPhone;
    }

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
    const isPrimary = data?.isPrimary ? 1 : 0;

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return sendJSON(res, 400, { error: 'A valid insurance company is required' });
    }
    if (!memberId) {
      return sendJSON(res, 400, { error: 'Member ID is required' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for add insurance:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          // If setting as primary, unset any existing primary first
          if (isPrimary) {
            await conn.promise().query(queries.clearPrimaryInsurance, [patientId]);
          }

          await conn.promise().query(
            `INSERT INTO insurance (patient_id, company_id, member_id, group_number, is_primary, effective_date, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, CURDATE(), 'RECEPTION', 'RECEPTION')
             ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), group_number = VALUES(group_number), is_primary = VALUES(is_primary), updated_by = 'RECEPTION'`,
            [patientId, companyId, memberId, groupNumber || null, isPrimary]
          );

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing add insurance:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Insurance saved successfully' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            console.error('Error adding patient insurance:', error);
            sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  async function setPrimaryInsurance(req, patientId, insuranceId, res) {
    try {
      await pool.promise().query(queries.clearPrimaryInsurance, [patientId]);
      const [result] = await pool.promise().query(
        `UPDATE insurance SET is_primary = 1, updated_by = 'RECEPTION' WHERE insurance_id = ? AND patient_id = ?`,
        [insuranceId, patientId]
      );
      if (!result.affectedRows) {
        return sendJSON(res, 404, { error: 'Insurance record not found' });
      }
      sendJSON(res, 200, { message: 'Primary insurance updated' });
    } catch (error) {
      console.error('Error setting primary insurance:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
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

  async function submitInsuranceChangeRequest(req, patientId, data, res) {
    const changeType = String(data?.changeType || '').toUpperCase();
    const insuranceId = data?.insuranceId ? Number(data.insuranceId) : null;
    const companyId = data?.companyId ? Number(data.companyId) : null;
    const memberId = String(data?.memberId || '').trim() || null;
    const groupNumber = String(data?.groupNumber || '').trim() || null;
    const isPrimary = data?.isPrimary ? 1 : 0;
    const patientNote = String(data?.patientNote || '').trim() || null;

    if (!['ADD', 'UPDATE', 'REMOVE'].includes(changeType)) {
      return sendJSON(res, 400, { error: 'Invalid change type' });
    }
    if (changeType !== 'REMOVE' && !companyId) {
      return sendJSON(res, 400, { error: 'Insurance company is required' });
    }
    if (changeType !== 'REMOVE' && !memberId) {
      return sendJSON(res, 400, { error: 'Member ID is required' });
    }

    try {
      await pool.promise().query(
        `INSERT INTO insurance_change_requests (patient_id, insurance_id, change_type, company_id, member_id, group_number, is_primary, patient_note, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PATIENT_PORTAL')`,
        [patientId, insuranceId, changeType, companyId, memberId, groupNumber, isPrimary, patientNote]
      );
      sendJSON(res, 200, { message: 'Change request submitted. A receptionist will review it shortly.' });
    } catch (error) {
      console.error('Error submitting insurance change request:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
  }

  async function getInsuranceChangeRequests(req, res) {
    try {
      const [rows] = await pool.promise().query(
        `SELECT
          icr.request_id,
          icr.change_type,
          icr.request_status,
          icr.member_id,
          icr.group_number,
          icr.is_primary,
          icr.patient_note,
          icr.created_at,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.patient_id,
          ic.company_name AS new_company_name,
          ic2.company_name AS current_company_name,
          i.member_id AS current_member_id,
          i.group_number AS current_group_number
        FROM insurance_change_requests icr
        JOIN patients p ON p.patient_id = icr.patient_id
        LEFT JOIN insurance_companies ic ON ic.company_id = icr.company_id
        LEFT JOIN insurance i ON i.insurance_id = icr.insurance_id
        LEFT JOIN insurance_companies ic2 ON ic2.company_id = i.company_id
        WHERE icr.request_status = 'PENDING'
        ORDER BY icr.created_at ASC`
      );
      sendJSON(res, 200, rows || []);
    } catch (error) {
      console.error('Error fetching insurance change requests:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
  }

  async function submitPharmacyChangeRequest(req, patientId, data, res) {
    const changeType = String(data?.changeType || '').toUpperCase();
    const patientPharmacyId = data?.patientPharmacyId ? Number(data.patientPharmacyId) : null;
    const pharmId = data?.pharmId ? Number(data.pharmId) : null;
    const isPrimary = data?.isPrimary ? 1 : 0;
    const patientNote = String(data?.patientNote || '').trim() || null;

    if (!['ADD', 'REMOVE'].includes(changeType)) {
      return sendJSON(res, 400, { error: 'Invalid change type' });
    }
    if (changeType === 'ADD' && !pharmId) {
      return sendJSON(res, 400, { error: 'Pharmacy is required' });
    }

    try {
      await pool.promise().query(
        `INSERT INTO pharmacy_change_requests (patient_id, patient_pharmacy_id, change_type, pharm_id, is_primary, patient_note, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'PATIENT_PORTAL')`,
        [patientId, patientPharmacyId, changeType, pharmId, isPrimary, patientNote]
      );
      sendJSON(res, 200, { message: 'Change request submitted. A receptionist will review it shortly.' });
    } catch (error) {
      console.error('Error submitting pharmacy change request:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
  }

  async function getPharmacyChangeRequests(req, res) {
    try {
      const [rows] = await pool.promise().query(
        `SELECT
          pcr.request_id,
          pcr.change_type,
          pcr.request_status,
          pcr.is_primary,
          pcr.patient_note,
          pcr.created_at,
          pcr.patient_pharmacy_id,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.patient_id,
          ph.pharm_name AS new_pharm_name,
          ph.ph_city AS new_pharm_city,
          ph.ph_state AS new_pharm_state,
          ph2.pharm_name AS current_pharm_name,
          ph2.ph_city AS current_pharm_city
        FROM pharmacy_change_requests pcr
        JOIN patients p ON p.patient_id = pcr.patient_id
        LEFT JOIN pharmacies ph ON ph.pharm_id = pcr.pharm_id
        LEFT JOIN patient_pharmacies pp ON pp.patient_pharmacy_id = pcr.patient_pharmacy_id
        LEFT JOIN pharmacies ph2 ON ph2.pharm_id = pp.pharm_id
        WHERE pcr.request_status = 'PENDING'
        ORDER BY pcr.created_at ASC`
      );
      sendJSON(res, 200, rows || []);
    } catch (error) {
      console.error('Error fetching pharmacy change requests:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
  }

  async function resolvePharmacyChangeRequest(req, requestId, action, res) {
    if (!['APPROVED', 'DENIED'].includes(action)) {
      return sendJSON(res, 400, { error: 'Invalid action' });
    }
    try {
      const [[request]] = await pool.promise().query(
        `SELECT * FROM pharmacy_change_requests WHERE request_id = ? AND request_status = 'PENDING'`,
        [requestId]
      );
      if (!request) return sendJSON(res, 404, { error: 'Request not found or already resolved' });

      if (action === 'APPROVED') {
        const { change_type, patient_id, patient_pharmacy_id, pharm_id, is_primary } = request;
        if (change_type === 'ADD') {
          if (is_primary) {
            await pool.promise().query(
              `UPDATE patient_pharmacies SET is_primary = 0, updated_by = 'RECEPTION' WHERE patient_id = ? AND is_primary = 1`,
              [patient_id]
            );
          }
          await pool.promise().query(
            `INSERT INTO patient_pharmacies (patient_id, pharm_id, is_primary, created_by, updated_by)
             VALUES (?, ?, ?, 'RECEPTION', 'RECEPTION')
             ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), updated_by = 'RECEPTION'`,
            [patient_id, pharm_id, is_primary]
          );
        } else if (change_type === 'REMOVE') {
          const pp = await pool.promise().query(
            `SELECT pharm_id FROM patient_pharmacies WHERE patient_pharmacy_id = ? AND patient_id = ?`,
            [patient_pharmacy_id, patient_id]
          );
          if (pp[0].length) {
            await pool.promise().query(
              `DELETE FROM patient_pharmacies WHERE patient_pharmacy_id = ? AND patient_id = ?`,
              [patient_pharmacy_id, patient_id]
            );
          }
        }
      }

      await pool.promise().query(
        `UPDATE pharmacy_change_requests SET request_status = ?, updated_by = 'RECEPTION' WHERE request_id = ?`,
        [action, requestId]
      );

      await pool.promise().query(
        `UPDATE receptionist_notifications
         SET is_read = TRUE, read_at = NOW(), updated_by = 'RECEPTION'
         WHERE source_table = 'pharmacy_change_requests' AND source_request_id = ?`,
        [requestId]
      );

      sendJSON(res, 200, { message: `Request ${action.toLowerCase()}.` });
    } catch (error) {
      console.error('Error resolving pharmacy change request:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
  }

  async function resolveInsuranceChangeRequest(req, requestId, action, res) {
    if (!['APPROVED', 'DENIED'].includes(action)) {
      return sendJSON(res, 400, { error: 'Invalid action' });
    }
    try {
      const [[request]] = await pool.promise().query(
        `SELECT * FROM insurance_change_requests WHERE request_id = ? AND request_status = 'PENDING'`,
        [requestId]
      );
      if (!request) return sendJSON(res, 404, { error: 'Request not found or already resolved' });

      if (action === 'APPROVED') {
        const { change_type, patient_id, insurance_id, company_id, member_id, group_number, is_primary } = request;

        if (change_type === 'ADD') {
          if (is_primary) {
            await pool.promise().query(queries.clearPrimaryInsurance, [patient_id]);
          }
          await pool.promise().query(
            `INSERT INTO insurance (patient_id, company_id, member_id, group_number, is_primary, effective_date, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, CURDATE(), 'RECEPTION', 'RECEPTION')`,
            [patient_id, company_id, member_id, group_number || null, is_primary]
          );
        } else if (change_type === 'UPDATE') {
          if (is_primary) {
            await pool.promise().query(queries.clearPrimaryInsuranceExcept, [patient_id, insurance_id]);
          }
          await pool.promise().query(
            `UPDATE insurance SET company_id = ?, member_id = ?, group_number = ?, is_primary = ?, updated_by = 'RECEPTION'
             WHERE insurance_id = ? AND patient_id = ?`,
            [company_id, member_id, group_number || null, is_primary, insurance_id, patient_id]
          );
        } else if (change_type === 'REMOVE') {
          await pool.promise().query(
            `DELETE FROM insurance WHERE insurance_id = ? AND patient_id = ?`,
            [insurance_id, patient_id]
          );
        }
      }

      await pool.promise().query(
        `UPDATE insurance_change_requests SET request_status = ?, updated_by = 'RECEPTION' WHERE request_id = ?`,
        [action, requestId]
      );

      await pool.promise().query(
        `UPDATE receptionist_notifications
         SET is_read = TRUE, read_at = NOW(), updated_by = 'RECEPTION'
         WHERE source_table = 'insurance_change_requests' AND source_request_id = ?`,
        [requestId]
      );

      sendJSON(res, 200, { message: `Request ${action.toLowerCase()}.` });
    } catch (error) {
      console.error('Error resolving insurance change request:', error);
      sendJSON(res, 500, { error: 'Database error' });
    }
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
    setPrimaryInsurance,
    removePatientInsurance,
    changeUserPassword,
    submitInsuranceChangeRequest,
    getInsuranceChangeRequests,
    resolveInsuranceChangeRequest,
    submitPharmacyChangeRequest,
    getPharmacyChangeRequests,
    resolvePharmacyChangeRequest
  };
}

module.exports = {
  createPatientCoreHandlers
};
