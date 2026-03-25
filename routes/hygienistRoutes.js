const url = require('url');

function createHygienistProfileRoutes({ pool, sendJSON }) {

  // ─── Profile ────────────────────────────────────────────────────────────────

  function getHygienistProfile(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const userId = Number(parsedUrl.query.userId || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJSON(res, 400, { error: 'A valid userId is required' });
    }

    pool.query(
      `SELECT
        u.user_id,
        u.user_username,
        u.user_email,
        st.staff_id,
        st.first_name,
        st.last_name,
        st.phone_number,
        st.date_of_birth,
        st.s_address,
        st.s_city,
        st.s_state,
        st.s_zipcode,
        st.s_country,
        st.emergency_contact_name,
        st.emergency_contact_phone
      FROM users u
      JOIN staff st ON st.user_id = u.user_id
      WHERE u.user_id = ? AND u.is_deleted = 0
      LIMIT 1`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching hygienist profile:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Hygienist profile not found' });
        }
        sendJSON(res, 200, rows[0]);
      }
    );
  }

  function getHygienistProfileByUsername(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const username = String(parsedUrl.query.username || '').trim();
    if (!username) {
      return sendJSON(res, 400, { error: 'A valid username is required' });
    }

    pool.query(
      `SELECT
        u.user_id,
        u.user_username,
        u.user_email,
        st.staff_id,
        st.first_name,
        st.last_name,
        st.phone_number,
        st.date_of_birth,
        st.s_address,
        st.s_city,
        st.s_state,
        st.s_zipcode,
        st.s_country,
        st.emergency_contact_name,
        st.emergency_contact_phone
      FROM users u
      JOIN staff st ON st.user_id = u.user_id
      WHERE u.user_username = ? AND u.is_deleted = 0
      LIMIT 1`,
      [username],
      (err, rows) => {
        if (err) {
          console.error('Error fetching hygienist profile by username:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Hygienist profile not found' });
        }
        sendJSON(res, 200, rows[0]);
      }
    );
  }

  function updateHygienistProfile(req, data, res) {
    const parsedUrl = url.parse(req.url, true);
    const userId = Number(parsedUrl.query.userId || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendJSON(res, 400, { error: 'A valid userId is required' });
    }

    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const email = String(data?.email || '').trim();
    const phone = String(data?.phone || '').replace(/\D/g, '');
    const dateOfBirth = String(data?.dateOfBirth || '').trim();
    const address = String(data?.address || '').trim();
    const city = String(data?.city || '').trim();
    const state = String(data?.state || '').trim().toUpperCase();
    const zipcode = String(data?.zipcode || '').trim();
    const country = String(data?.country || '').trim();
    const emergencyContactName = String(data?.emergencyContactName || '').trim();
    const emergencyContactPhone = String(data?.emergencyContactPhone || '').replace(/\D/g, '');
    const formattedEmergencyContactPhone = emergencyContactPhone
      ? `${emergencyContactPhone.slice(0, 3)}-${emergencyContactPhone.slice(3, 6)}-${emergencyContactPhone.slice(6, 10)}`
      : '';

    if (!firstName || !lastName || !email) {
      return sendJSON(res, 400, { error: 'First name, last name, and email are required' });
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return sendJSON(res, 400, { error: 'dateOfBirth must use YYYY-MM-DD format' });
    }

    if (emergencyContactPhone && !/^\d{10}$/.test(emergencyContactPhone)) {
      return sendJSON(res, 400, { error: 'Emergency contact phone must be exactly 10 digits' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting DB connection for hygienist profile update:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        conn.query(
          `SELECT st.staff_id FROM staff st
           JOIN users u ON u.user_id = st.user_id
           WHERE u.user_id = ? AND u.is_deleted = 0
           LIMIT 1`,
          [userId],
          (profileErr, profileRows) => {
            if (profileErr || !profileRows?.length) {
              return conn.rollback(() => {
                conn.release();
                if (profileErr) {
                  console.error('Error resolving hygienist staff mapping:', profileErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }
                return sendJSON(res, 404, { error: 'Hygienist profile not found' });
              });
            }

            const staffId = profileRows[0].staff_id;
            conn.query(
              `UPDATE users SET user_email = ?, user_phone = ? WHERE user_id = ?`,
              [email, phone || null, userId],
              (userErr) => {
                if (userErr) {
                  return conn.rollback(() => {
                    conn.release();
                    if (userErr.code === 'ER_DUP_ENTRY') {
                      return sendJSON(res, 409, { error: 'Email or phone already exists' });
                    }
                    console.error('Error updating users table for hygienist profile:', userErr);
                    return sendJSON(res, 500, { error: 'Database error' });
                  });
                }

                conn.query(
                  `UPDATE staff
                   SET first_name = ?,
                       last_name = ?,
                       phone_number = ?,
                       date_of_birth = COALESCE(?, date_of_birth),
                       s_address = ?,
                       s_city = ?,
                       s_state = ?,
                       s_zipcode = ?,
                       s_country = ?,
                       emergency_contact_name = ?,
                       emergency_contact_phone = ?,
                       updated_by = 'HYGIENIST_PORTAL'
                   WHERE staff_id = ?`,
                  [
                    firstName, lastName, phone || null,
                    dateOfBirth || null, address || null, city || null,
                    state || null, zipcode || null, country || null,
                    emergencyContactName || null, formattedEmergencyContactPhone || null,
                    staffId
                  ],
                  (staffErr) => {
                    if (staffErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error('Error updating staff table for hygienist profile:', staffErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      });
                    }

                    conn.commit((commitErr) => {
                      conn.release();
                      if (commitErr) {
                        console.error('Error committing hygienist profile update:', commitErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      }
                      return sendJSON(res, 200, { message: 'Profile updated successfully' });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  // ─── Appointments ────────────────────────────────────────────────────────────

  function getHygienistAppointments(req, res) {
    pool.query(
      `SELECT
        a.appointment_id,
        a.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        a.appointment_date,
        a.appointment_time,
        ast.status_name,
        ast.status_name AS appointment_status,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        a.doctor_id
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      ORDER BY a.appointment_date DESC, a.appointment_time ASC`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error fetching hygienist appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getHygienistAppointmentDetail(req, res, appointmentId) {
    pool.query(
      `SELECT
        a.appointment_id,
        a.patient_id,
        a.doctor_id,
        a.appointment_date,
        a.appointment_time,
        ast.status_name
      FROM appointments a
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      WHERE a.appointment_id = ?
      LIMIT 1`,
      [appointmentId],
      (err, apptRows) => {
        if (err) {
          console.error('Error fetching appointment for hygienist:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!apptRows?.length) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }

        const appt = apptRows[0];
        const patientId = appt.patient_id;

        pool.query(
          `SELECT
            p.patient_id, p.p_first_name AS first_name, p.p_last_name AS last_name,
            p.p_phone AS phone, p.p_email AS email,
            CONCAT_WS(', ', p.p_address, p.p_city, p.p_state, p.p_zipcode) AS address,
            p.p_emergency_contact_name AS emergency_contact_name,
            p.p_emergency_contact_phone AS emergency_contact_phone
          FROM patients p
          WHERE p.patient_id = ?
          LIMIT 1`,
          [patientId],
          (patientErr, patientRows) => {
            if (patientErr) {
              console.error('Error fetching patient for hygienist:', patientErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }

            const patient = patientRows?.[0] || null;

            pool.query(
              `SELECT pi.intake_id, pi.intake_data FROM patient_intakes pi
               WHERE pi.patient_id = ?
               ORDER BY pi.created_at DESC LIMIT 1`,
              [patientId],
              (intakeErr, intakeRows) => {
                let intakeSnapshot = {};
                if (!intakeErr && intakeRows?.length) {
                  try {
                    intakeSnapshot = JSON.parse(intakeRows[0].intake_data || '{}');
                  } catch { /* ignore parse errors */ }
                }

                pool.query(
                  `SELECT
                    tp.plan_id, tp.tooth_number, tp.surface, tp.procedure_code,
                    apc.description AS procedure_description,
                    tp.estimated_cost, apc.default_fees,
                    tp.priority, tp.notes, tp.start_date, tp.created_at
                  FROM treatment_plans tp
                  LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
                  WHERE tp.patient_id = ?
                  ORDER BY tp.start_date DESC, tp.created_at DESC`,
                  [patientId],
                  (treatmentErr, treatmentRows) => {
                    if (treatmentErr) {
                      console.error('Error fetching treatments for hygienist:', treatmentErr);
                      return sendJSON(res, 500, { error: 'Database error' });
                    }

                    pool.query(
                      `SELECT
                        df.finding_id, df.tooth_number, df.surface, df.condition_type,
                        df.notes, df.date_logged,
                        a2.appointment_date
                      FROM dental_findings df
                      LEFT JOIN appointments a2 ON a2.appointment_id = df.appointment_id
                      WHERE df.patient_id = ?
                      ORDER BY df.date_logged DESC`,
                      [patientId],
                      (findingErr, findingRows) => {
                        if (findingErr) {
                          console.error('Error fetching findings for hygienist:', findingErr);
                          return sendJSON(res, 500, { error: 'Database error' });
                        }

                        sendJSON(res, 200, {
                          appointment: appt,
                          patientProfile: patient,
                          intakeSnapshot,
                          completedTreatments: treatmentRows || [],
                          dentalFindings: findingRows || []
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }

  function searchHygienistPatientAppointments(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const query = String(parsedUrl.query.query || '').trim();
    if (!query) {
      return sendJSON(res, 400, { error: 'Search query is required' });
    }

    const like = `%${query}%`;
    pool.query(
      `SELECT
        a.appointment_id,
        a.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        a.appointment_date,
        a.appointment_time,
        ast.status_name AS appointment_status,
        a.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      WHERE CONCAT(p.p_first_name, ' ', p.p_last_name) LIKE ?
         OR p.p_email LIKE ?
         OR p.p_phone LIKE ?
         OR CAST(p.patient_id AS CHAR) = ?
      ORDER BY a.appointment_date DESC, a.appointment_time ASC
      LIMIT 50`,
      [like, like, like, query],
      (err, rows) => {
        if (err) {
          console.error('Error searching patient appointments for hygienist:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  // ─── ADA Procedure Codes ─────────────────────────────────────────────────────

  function getAdaProcedureCodes(req, res) {
    pool.query(
      `SELECT procedure_code, description, category, default_fees
       FROM ada_procedure_codes
       ORDER BY procedure_code ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching ADA procedure codes:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  // ─── Dental Findings ─────────────────────────────────────────────────────────

  function saveDentalFindings(req, res, appointmentId, data) {
    const staffId = Number(url.parse(req.url, true).query.staffId || 0);
    if (!staffId || !appointmentId) {
      return sendJSON(res, 400, { error: 'Missing staffId or appointmentId' });
    }

    pool.query(
      `SELECT patient_id FROM appointments WHERE appointment_id = ? LIMIT 1`,
      [appointmentId],
      (apptErr, apptRows) => {
        if (apptErr || !apptRows?.length) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }
        const patientId = apptRows[0].patient_id;

        const toothNumbers = Array.isArray(data?.toothNumbers) ? data.toothNumbers : [];
        const conditionMap = data?.conditionTypesByTooth || {};
        const surface = String(data?.surface || '').trim() || null;
        const notes = String(data?.notes || '').trim() || null;

        if (!toothNumbers.length) {
          return sendJSON(res, 400, { error: 'At least one tooth number is required' });
        }

        const rows = toothNumbers.map((tooth) => [
          patientId,
          appointmentId,
          String(tooth).trim(),
          String(conditionMap[tooth] || '').trim() || null,
          surface,
          notes,
          new Date()
        ]);

        pool.query(
          `INSERT INTO dental_findings (patient_id, appointment_id, tooth_number, condition_type, surface, notes, date_logged)
           VALUES ?`,
          [rows],
          (insertErr) => {
            if (insertErr) {
              console.error('Error saving dental findings (hygienist):', insertErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Findings saved', savedCount: rows.length });
          }
        );
      }
    );
  }

  function deleteFinding(req, res, findingId) {
    pool.query(
      `DELETE FROM dental_findings WHERE finding_id = ?`,
      [findingId],
      (err, result) => {
        if (err) {
          console.error('Error deleting finding (hygienist):', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Finding not found' });
        }
        sendJSON(res, 200, { message: 'Finding deleted' });
      }
    );
  }

  // ─── Treatments ──────────────────────────────────────────────────────────────

  function saveTreatment(req, res, appointmentId, data) {
    const staffId = Number(url.parse(req.url, true).query.staffId || 0);
    if (!staffId || !appointmentId) {
      return sendJSON(res, 400, { error: 'Missing staffId or appointmentId' });
    }

    pool.query(
      `SELECT patient_id FROM appointments WHERE appointment_id = ? LIMIT 1`,
      [appointmentId],
      (apptErr, apptRows) => {
        if (apptErr || !apptRows?.length) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }
        const patientId = apptRows[0].patient_id;
        const procedureCode = String(data?.procedureCode || '').trim();
        const toothNumber = String(data?.toothNumber || '').trim() || null;
        const surface = String(data?.surface || '').trim() || null;
        const notes = String(data?.notes || '').trim() || null;
        const priority = String(data?.priority || '').trim() || null;
        const estimatedCost = data?.estimatedCost != null ? Number(data.estimatedCost) : null;

        if (!procedureCode) {
          return sendJSON(res, 400, { error: 'Procedure code is required' });
        }

        // Resolve cost: use provided cost or fall back to ADA default fee
        pool.query(
          `SELECT default_fees FROM ada_procedure_codes WHERE procedure_code = ? LIMIT 1`,
          [procedureCode],
          (codeErr, codeRows) => {
            const defaultFee = codeRows?.[0]?.default_fees != null ? Number(codeRows[0].default_fees) : null;
            const finalCost = (estimatedCost != null && estimatedCost > 0)
              ? estimatedCost
              : defaultFee;
            const pricingSource = (estimatedCost != null && estimatedCost > 0)
              ? 'MANUAL'
              : defaultFee != null ? 'ADA_DEFAULT_FEE' : 'NONE';

            pool.query(
              `SELECT status_id FROM treatment_statuses WHERE status_name = 'COMPLETED' LIMIT 1`,
              [],
              (statusErr, statusRows) => {
                const statusId = statusRows?.[0]?.status_id || null;
                const today = new Date().toISOString().slice(0, 10);

                pool.query(
                  `INSERT INTO treatment_plans
                     (patient_id, appointment_id, procedure_code, tooth_number, surface,
                      estimated_cost, priority, notes, status_id, start_date, created_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HYGIENIST_PORTAL')`,
                  [patientId, appointmentId, procedureCode, toothNumber, surface,
                   finalCost, priority, notes, statusId, today],
                  (insertErr) => {
                    if (insertErr) {
                      console.error('Error saving treatment (hygienist):', insertErr);
                      return sendJSON(res, 500, { error: 'Database error' });
                    }

                    // Mark appointment completed
                    pool.query(
                      `SELECT status_id FROM appointment_statuses WHERE status_name = 'COMPLETED' LIMIT 1`,
                      [],
                      (astErr, astRows) => {
                        if (!astErr && astRows?.length) {
                          pool.query(
                            `UPDATE appointments SET status_id = ?, updated_by = 'HYGIENIST_PORTAL'
                             WHERE appointment_id = ?`,
                            [astRows[0].status_id, appointmentId],
                            () => {}
                          );
                        }
                        sendJSON(res, 200, {
                          message: 'Treatment saved',
                          estimatedCost: finalCost,
                          pricingSource
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }

  function deleteTreatment(req, res, planId) {
    pool.query(
      `DELETE FROM treatment_plans WHERE plan_id = ?`,
      [planId],
      (err, result) => {
        if (err) {
          console.error('Error deleting treatment (hygienist):', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Treatment not found' });
        }
        sendJSON(res, 200, { message: 'Treatment deleted' });
      }
    );
  }

  function updateTreatment(req, res, planId, data) {
    const procedureCode = String(data?.procedureCode || '').trim();
    const toothNumber = String(data?.toothNumber || '').trim() || null;
    const surface = String(data?.surface || '').trim() || null;
    const notes = String(data?.notes || '').trim() || null;
    const priority = String(data?.priority || '').trim() || null;
    const estimatedCost = data?.estimatedCost != null ? Number(data.estimatedCost) : null;

    if (!procedureCode) {
      return sendJSON(res, 400, { error: 'Procedure code is required' });
    }

    pool.query(
      `UPDATE treatment_plans
       SET procedure_code = ?, tooth_number = ?, surface = ?,
           estimated_cost = ?, priority = ?, notes = ?,
           updated_by = 'HYGIENIST_PORTAL'
       WHERE plan_id = ?`,
      [procedureCode, toothNumber, surface, estimatedCost, priority, notes, planId],
      (err, result) => {
        if (err) {
          console.error('Error updating treatment (hygienist):', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Treatment not found' });
        }
        sendJSON(res, 200, { message: 'Treatment updated' });
      }
    );
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────

  function normalizeDateParam(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function getHygienistSinglePatientReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const patientId = Number(parsedUrl.query.patientId || 0);
    const fromDate = normalizeDateParam(parsedUrl.query.fromDate);
    const toDate = normalizeDateParam(parsedUrl.query.toDate);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return sendJSON(res, 400, { error: 'A valid patientId is required' });
    }
    if (!fromDate || !toDate) {
      return sendJSON(res, 400, { error: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }

    const procedureCode = String(parsedUrl.query.procedureCode || '').trim().toUpperCase();
    const toothNumber = String(parsedUrl.query.toothNumber || '').trim();
    const surface = String(parsedUrl.query.surface || '').trim().toUpperCase();

    pool.query(
      `SELECT
        tp.plan_id AS treatment_id, tp.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        tp.start_date AS visit_date,
        tp.procedure_code, apc.description AS treatment_description,
        tp.tooth_number, tp.surface, tp.estimated_cost AS treatment_cost, tp.notes
      FROM treatment_plans tp
      JOIN patients p ON p.patient_id = tp.patient_id
      LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
      WHERE tp.patient_id = ?
        AND tp.start_date BETWEEN ? AND ?
        AND (? = '' OR tp.procedure_code = ?)
        AND (? = '' OR tp.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(tp.surface,'')) = ?)
      ORDER BY tp.start_date DESC`,
      [patientId, fromDate, toDate, procedureCode, procedureCode, toothNumber, toothNumber, surface, surface],
      (err, rows) => {
        if (err) {
          console.error('Error generating hygienist single-patient report:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        const visits = buildGroupedVisits(rows || []);
        const totalCost = visits.reduce((s, v) => s + v.visitCost, 0);
        sendJSON(res, 200, {
          reportType: 'SINGLE_PATIENT_TREATMENT_FINDING',
          generatedAt: new Date().toISOString(),
          filters: { patientId, fromDate, toDate, procedureCode, toothNumber, surface },
          summary: { totalVisits: visits.length, totalEntries: rows.length, totalCost },
          visits
        });
      }
    );
  }

  function getHygienistMultiPatientReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const fromDate = normalizeDateParam(parsedUrl.query.fromDate);
    const toDate = normalizeDateParam(parsedUrl.query.toDate);

    if (!fromDate || !toDate) {
      return sendJSON(res, 400, { error: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }

    const procedureCode = String(parsedUrl.query.procedureCode || '').trim().toUpperCase();
    const toothNumber = String(parsedUrl.query.toothNumber || '').trim();
    const surface = String(parsedUrl.query.surface || '').trim().toUpperCase();

    pool.query(
      `SELECT
        tp.plan_id AS treatment_id, tp.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        tp.start_date AS visit_date,
        tp.procedure_code, apc.description AS treatment_description,
        tp.tooth_number, tp.surface, tp.estimated_cost AS treatment_cost, tp.notes
      FROM treatment_plans tp
      JOIN patients p ON p.patient_id = tp.patient_id
      LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
      WHERE tp.start_date BETWEEN ? AND ?
        AND (? = '' OR tp.procedure_code = ?)
        AND (? = '' OR tp.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(tp.surface,'')) = ?)
      ORDER BY tp.start_date DESC`,
      [fromDate, toDate, procedureCode, procedureCode, toothNumber, toothNumber, surface, surface],
      (err, rows) => {
        if (err) {
          console.error('Error generating hygienist multi-patient report:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        const visits = buildGroupedVisits(rows || []);
        const uniquePatients = new Set(visits.map((v) => v.patientId));
        const totalCost = visits.reduce((s, v) => s + v.visitCost, 0);
        sendJSON(res, 200, {
          reportType: 'MULTI_PATIENT_TREATMENT_FINDING',
          generatedAt: new Date().toISOString(),
          filters: { fromDate, toDate, procedureCode, toothNumber, surface },
          summary: { totalPatients: uniquePatients.size, totalVisits: visits.length, totalEntries: rows.length, totalCost },
          visits
        });
      }
    );
  }

  function buildGroupedVisits(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const dateKey = (row.visit_date instanceof Date
        ? row.visit_date.toISOString().slice(0, 10)
        : String(row.visit_date || '').slice(0, 10)) || 'Unknown date';
      const key = `${Number(row.patient_id || 0)}::${dateKey}`;
      if (!grouped.has(key)) {
        grouped.set(key, { patientId: Number(row.patient_id), patientName: String(row.patient_name || ''), visitDate: dateKey, visitCost: 0, entries: [] });
      }
      const bucket = grouped.get(key);
      const cost = Number(row.treatment_cost);
      if (Number.isFinite(cost) && cost > 0) bucket.visitCost += cost;
      bucket.entries.push({
        procedureCode: row.procedure_code,
        treatmentDescription: row.treatment_description,
        toothNumber: row.tooth_number,
        surface: row.surface,
        cost: Number.isFinite(cost) ? cost : 0,
        notes: row.notes
      });
    });
    return Array.from(grouped.values()).sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
  }

  // ─── Staff helpers (profile image, locations, schedule, time-off) ────────────

  function getStaffLocations(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    pool.query(
      `SELECT sl.staff_locations_id, sl.location_id, sl.is_primary,
              l.full_address, l.location_city, l.location_state
       FROM staff_locations sl
       JOIN locations l ON l.location_id = sl.location_id
       WHERE sl.staff_id = ?
       ORDER BY sl.is_primary DESC, l.location_city ASC`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff locations:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function updateStaffLocations(req, data, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    const locations = Array.isArray(data?.locations) ? data.locations : [];
    if (!locations.length) {
      return sendJSON(res, 400, { error: 'At least one location is required' });
    }
    if (locations.filter((l) => l.isPrimary).length !== 1) {
      return sendJSON(res, 400, { error: 'Exactly one location must be marked as primary' });
    }
    pool.getConnection((connErr, conn) => {
      if (connErr) return sendJSON(res, 500, { error: 'Database error' });
      conn.beginTransaction(async (txErr) => {
        if (txErr) { conn.release(); return sendJSON(res, 500, { error: 'Database error' }); }
        try {
          await conn.promise().query('DELETE FROM staff_locations WHERE staff_id = ?', [staffId]);
          for (const loc of locations) {
            const locationId = Number(loc.locationId);
            if (!Number.isInteger(locationId) || locationId <= 0) continue;
            await conn.promise().query(
              'INSERT INTO staff_locations (staff_id, location_id, is_primary) VALUES (?, ?, ?)',
              [staffId, locationId, loc.isPrimary ? 1 : 0]
            );
          }
          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) return sendJSON(res, 500, { error: 'Database error' });
            sendJSON(res, 200, { message: 'Locations updated successfully' });
          });
        } catch (error) {
          conn.rollback(() => { conn.release(); sendJSON(res, 500, { error: 'Database error' }); });
        }
      });
    });
  }

  function getStaffProfileImage(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const staffId = Number(parsedUrl.query.staffId || 0);
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    pool.query(
      `SELECT TO_BASE64(profile_image) AS profile_image_base64 FROM staff WHERE staff_id = ?`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff profile image:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows.length) return sendJSON(res, 404, { error: 'Staff not found' });
        sendJSON(res, 200, { profile_image_base64: rows[0].profile_image_base64 });
      }
    );
  }

  function saveStaffProfileImage(req, data, res) {
    const staffId = Number(data?.staffId || 0);
    const imageBase64 = data?.imageBase64 || null;
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }
    if (!imageBase64) {
      pool.query(`UPDATE staff SET profile_image = NULL WHERE staff_id = ?`, [staffId], (err) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });
        sendJSON(res, 200, { message: 'Profile image removed' });
      });
      return;
    }
    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    pool.query(`UPDATE staff SET profile_image = ? WHERE staff_id = ?`, [buf, staffId], (err) => {
      if (err) return sendJSON(res, 500, { error: 'Database error' });
      sendJSON(res, 200, { message: 'Profile image saved' });
    });
  }

  // ─── Router ──────────────────────────────────────────────────────────────────

  function handleHygienistProfileRoutes(req, res, method, parts, parseJSON) {
    // Profile
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'profile' && !parts[3]) {
      getHygienistProfile(req, res); return true;
    }
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'profile-by-username') {
      getHygienistProfileByUsername(req, res); return true;
    }
    if (method === 'PUT' && parts[1] === 'hygienist' && parts[2] === 'profile') {
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        updateHygienistProfile(req, data, res);
      }); return true;
    }

    // Appointments list
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'appointments' && !parts[3]) {
      getHygienistAppointments(req, res); return true;
    }

    // Appointment detail: /api/hygienist/appointments/:id
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'appointments' && parts[3] && !parts[4]) {
      const appointmentId = Number(parts[3]);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        sendJSON(res, 400, { error: 'Invalid appointmentId' }); return true;
      }
      getHygienistAppointmentDetail(req, res, appointmentId); return true;
    }

    // Dental findings: POST /api/hygienist/appointments/:id/dental-findings
    if (method === 'POST' && parts[1] === 'hygienist' && parts[2] === 'appointments' && parts[4] === 'dental-findings') {
      const appointmentId = Number(parts[3]);
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        saveDentalFindings(req, res, appointmentId, data);
      }); return true;
    }

    // Treatments: POST /api/hygienist/appointments/:id/treatments
    if (method === 'POST' && parts[1] === 'hygienist' && parts[2] === 'appointments' && parts[4] === 'treatments') {
      const appointmentId = Number(parts[3]);
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        saveTreatment(req, res, appointmentId, data);
      }); return true;
    }

    // Delete finding: DELETE /api/hygienist/findings/:id
    if (method === 'DELETE' && parts[1] === 'hygienist' && parts[2] === 'findings' && parts[3]) {
      const findingId = Number(parts[3]);
      deleteFinding(req, res, findingId); return true;
    }

    // Delete finding fallback: DELETE /api/hygienist/appointments/:id/findings/:findingId
    if (method === 'DELETE' && parts[1] === 'hygienist' && parts[2] === 'appointments' && parts[4] === 'findings' && parts[5]) {
      const findingId = Number(parts[5]);
      deleteFinding(req, res, findingId); return true;
    }

    // Delete treatment: DELETE /api/hygienist/treatments/:id
    if (method === 'DELETE' && parts[1] === 'hygienist' && parts[2] === 'treatments' && parts[3]) {
      const planId = Number(parts[3]);
      deleteTreatment(req, res, planId); return true;
    }

    // Update treatment: PUT /api/hygienist/treatments/:id
    if (method === 'PUT' && parts[1] === 'hygienist' && parts[2] === 'treatments' && parts[3]) {
      const planId = Number(parts[3]);
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        updateTreatment(req, res, planId, data);
      }); return true;
    }

    // ADA procedure codes
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'ada-procedure-codes') {
      getAdaProcedureCodes(req, res); return true;
    }

    // Patient appointment search
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'patients' && parts[3] === 'appointments' && parts[4] === 'search') {
      searchHygienistPatientAppointments(req, res); return true;
    }

    // Reports
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'reports' && parts[3] === 'patient') {
      getHygienistSinglePatientReport(req, res); return true;
    }
    if (method === 'GET' && parts[1] === 'hygienist' && parts[2] === 'reports' && parts[3] === 'patients') {
      getHygienistMultiPatientReport(req, res); return true;
    }

    // Staff shared endpoints
    if (method === 'GET' && parts[1] === 'staff' && parts[2] === 'locations') {
      getStaffLocations(req, res); return true;
    }
    if (method === 'PUT' && parts[1] === 'staff' && parts[2] === 'locations') {
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        updateStaffLocations(req, data, res);
      }); return true;
    }
    if (method === 'GET' && parts[1] === 'staff' && parts[2] === 'profile-image') {
      getStaffProfileImage(req, res); return true;
    }
    if (method === 'PUT' && parts[1] === 'staff' && parts[2] === 'profile-image') {
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        saveStaffProfileImage(req, data, res);
      }); return true;
    }

    return false;
  }

  return { handleHygienistProfileRoutes };
}

module.exports = { createHygienistProfileRoutes };
