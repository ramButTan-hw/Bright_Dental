const url = require('url');
const { createReportHelpers } = require('./reportHelpers');

function createDentistAppointmentRoutes({ pool, sendJSON }) {
  const { createReportFiltersFromQuery, fetchTreatmentRowsForReport, fetchFindingRowsForReport, buildGroupedReport } = createReportHelpers({ pool });

  function normalizeDateParam(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function normalizeDateValue(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  }

  function normalizeBooleanValue(value) {
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }

  function getDentistSinglePatientReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const patientId = Number(parsedUrl.query.patientId || 0);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return sendJSON(res, 400, { error: 'A valid patientId is required' });
    }

    const filters = createReportFiltersFromQuery(parsedUrl.query);
    if (filters.error) {
      return sendJSON(res, 400, { error: filters.error });
    }

    fetchTreatmentRowsForReport({ patientId, ...filters }, (treatmentErr, treatmentRows) => {
      if (treatmentErr) {
        console.error('Error generating single-patient treatment report:', treatmentErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      fetchFindingRowsForReport({ patientId, ...filters }, (findingErr, findingRows) => {
        if (findingErr) {
          console.error('Error generating single-patient finding report:', findingErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        const groupedVisits = buildGroupedReport(treatmentRows, findingRows);
        const totalCost = groupedVisits.reduce((sum, visit) => sum + Number(visit.visitCost || 0), 0);

        return sendJSON(res, 200, {
          reportType: 'SINGLE_PATIENT_TREATMENT_FINDING',
          generatedAt: new Date().toISOString(),
          filters: {
            patientId,
            ...filters
          },
          summary: {
            totalVisits: groupedVisits.length,
            totalEntries: treatmentRows.length,
            totalCost
          },
          visits: groupedVisits
        });
      });
    });
  }

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

  function getTreatmentStatusId(conn, statusName, callback) {
    conn.query(
      'SELECT status_id FROM treatment_statuses WHERE status_name = ? LIMIT 1',
      [String(statusName || '').trim().toUpperCase()],
      (err, rows) => {
        if (err) return callback(err);
        if (!rows?.length) return callback(new Error(`Treatment status ${statusName} not found`));
        callback(null, Number(rows[0].status_id));
      }
    );
  }

  function getAppointmentContext(appointmentId, doctorId, callback) {
    pool.query(
      `SELECT appointment_id, patient_id, doctor_id, appointment_date
       FROM appointments
       WHERE appointment_id = ? AND doctor_id = ?
       LIMIT 1`,
      [appointmentId, doctorId],
      (err, rows) => {
        if (err) return callback(err);
        if (!rows?.length) return callback(null, null);
        callback(null, rows[0]);
      }
    );
  }

  function getAppointmentStatusId(statusName, callback) {
    pool.query(
      'SELECT status_id FROM appointment_statuses WHERE status_name = ? LIMIT 1',
      [String(statusName || '').trim().toUpperCase()],
      (err, rows) => {
        if (err) return callback(err);
        if (!rows?.length) return callback(new Error(`Appointment status ${statusName} not found`));
        callback(null, Number(rows[0].status_id));
      }
    );
  }

  function markAppointmentCompleted(appointmentId, doctorId, callback) {
    getAppointmentStatusId('COMPLETED', (statusErr, completedStatusId) => {
      if (statusErr) return callback(statusErr);

      pool.query(
        `UPDATE appointments
         SET status_id = ?, updated_by = 'DENTIST_PORTAL'
         WHERE appointment_id = ? AND doctor_id = ?`,
        [completedStatusId, appointmentId, doctorId],
        (updateErr) => {
          if (updateErr) return callback(updateErr);

          // Mark linked preference request as COMPLETED
          pool.query(
            `UPDATE appointment_preference_requests apr
             JOIN appointments a ON a.patient_id = apr.patient_id
               AND apr.assigned_doctor_id = a.doctor_id
               AND apr.assigned_date = a.appointment_date
             SET apr.request_status = 'COMPLETED', apr.updated_by = 'DENTIST_PORTAL'
             WHERE a.appointment_id = ? AND apr.request_status = 'ASSIGNED'`,
            [appointmentId],
            (aprErr) => {
              if (aprErr) {
                console.error('Error updating preference request status (non-fatal):', aprErr);
              }
            }
          );

          generateInvoiceForAppointment(appointmentId, (invoiceErr) => {
            if (invoiceErr) {
              console.error('Error auto-generating invoice (non-fatal):', invoiceErr);
            }
            callback(null);
          });
        }
      );
    });
  }

  function computeInvoiceBreakdownForAppointment(appointmentId, callback) {
    pool.query(
      `SELECT a.patient_id, a.appointment_date
       FROM appointments a
       WHERE a.appointment_id = ?
       LIMIT 1`,
      [appointmentId],
      (apptErr, apptRows) => {
        if (apptErr) return callback(apptErr);
        if (!apptRows?.length) return callback(null, null);

        const { patient_id: patientId, appointment_date: apptDate } = apptRows[0];
        const dateStr = apptDate instanceof Date
          ? apptDate.toISOString().slice(0, 10)
          : String(apptDate || '').slice(0, 10);

        pool.query(
          `SELECT tp.procedure_code, tp.estimated_cost
           FROM treatment_plans tp
           WHERE tp.patient_id = ? AND tp.start_date = ?`,
          [patientId, dateStr],
          (tpErr, treatmentRows) => {
            if (tpErr) return callback(tpErr);

            const totalAmountRaw = (treatmentRows || []).reduce((sum, row) => {
              const cost = Number(row.estimated_cost || 0);
              return sum + (Number.isFinite(cost) ? cost : 0);
            }, 0);
            const totalAmount = Math.round(Math.max(totalAmountRaw, 0) * 100) / 100;

            if (totalAmount <= 0) {
              return callback(null, {
                patientId,
                insuranceId: null,
                totalAmount: 0,
                insuranceCovered: 0,
                patientAmount: 0
              });
            }

            pool.query(
              `SELECT i.insurance_id, i.company_id
               FROM insurance i
               WHERE i.patient_id = ? AND i.is_primary = TRUE
               ORDER BY i.insurance_id DESC
               LIMIT 1`,
              [patientId],
              (insErr, insRows) => {
                if (insErr) return callback(insErr);
                if (!insRows?.length) {
                  return callback(null, {
                    patientId,
                    insuranceId: null,
                    totalAmount,
                    insuranceCovered: 0,
                    patientAmount: totalAmount
                  });
                }

                const { insurance_id: insuranceId, company_id: companyId } = insRows[0];
                const procedureCodes = (treatmentRows || [])
                  .map((row) => (row.procedure_code ? String(row.procedure_code).trim().toUpperCase() : null))
                  .filter(Boolean);

                if (!procedureCodes.length) {
                  return callback(null, {
                    patientId,
                    insuranceId,
                    totalAmount,
                    insuranceCovered: 0,
                    patientAmount: totalAmount
                  });
                }

                const placeholders = procedureCodes.map(() => '?').join(',');
                pool.query(
                  `SELECT procedure_code, coverage_percent, copay_amount
                   FROM insurance_coverage
                   WHERE company_id = ? AND procedure_code IN (${placeholders})`,
                  [companyId, ...procedureCodes],
                  (covErr, covRows) => {
                    if (covErr) return callback(covErr);

                    const coverageMap = new Map();
                    (covRows || []).forEach((row) => {
                      coverageMap.set(String(row.procedure_code).toUpperCase(), {
                        percent: Number(row.coverage_percent || 0),
                        copay: Number(row.copay_amount || 0)
                      });
                    });

                    let insuranceCovered = 0;
                    let patientAmount = 0;

                    (treatmentRows || []).forEach((row) => {
                      const cost = Number(row.estimated_cost || 0);
                      if (!Number.isFinite(cost) || cost <= 0) return;

                      const code = row.procedure_code ? String(row.procedure_code).trim().toUpperCase() : null;
                      const cov = code ? coverageMap.get(code) : null;

                      if (!cov) {
                        patientAmount += cost;
                        return;
                      }

                      const coveredByPercent = Math.max(0, Math.min(cost, cost * (cov.percent / 100)));
                      const minimumPatient = Math.max(0, Math.min(cost, cov.copay || 0));
                      const basePatient = Math.max(0, cost - coveredByPercent);
                      const finalPatient = Math.max(basePatient, minimumPatient);
                      const finalInsurance = Math.max(0, cost - finalPatient);

                      patientAmount += finalPatient;
                      insuranceCovered += finalInsurance;
                    });

                    insuranceCovered = Math.round(insuranceCovered * 100) / 100;
                    patientAmount = Math.round(patientAmount * 100) / 100;

                    callback(null, {
                      patientId,
                      insuranceId,
                      totalAmount,
                      insuranceCovered,
                      patientAmount
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

  function upsertInvoiceForAppointment(appointmentId, callback) {
    computeInvoiceBreakdownForAppointment(appointmentId, (calcErr, breakdown) => {
      if (calcErr) return callback(calcErr);
      if (!breakdown) return callback(null, null);

      pool.query(
        `SELECT i.invoice_id,
                COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS total_paid,
                COALESCE((SELECT SUM(r.refund_amount) FROM refunds r WHERE r.invoice_id = i.invoice_id), 0) AS total_refunded
         FROM invoices i
         WHERE i.appointment_id = ?
         LIMIT 1`,
        [appointmentId],
        (existingErr, existingRows) => {
          if (existingErr) return callback(existingErr);

          const existing = existingRows?.[0];
          const netPaid = existing ? (Number(existing.total_paid || 0) - Number(existing.total_refunded || 0)) : 0;
          const paymentStatus = breakdown.patientAmount <= 0
            ? 'Paid'
            : netPaid >= breakdown.patientAmount
              ? 'Paid'
              : netPaid > 0
                ? 'Partial'
                : 'Unpaid';

          if (!existing) {
            return insertInvoice(
              appointmentId,
              breakdown.insuranceId,
              breakdown.totalAmount,
              breakdown.insuranceCovered,
              breakdown.patientAmount,
              paymentStatus,
              callback
            );
          }

          pool.query(
            `UPDATE invoices
             SET insurance_id = ?,
                 amount = ?,
                 insurance_covered_amount = ?,
                 patient_amount = ?,
                 payment_status = ?,
                 updated_by = 'SYSTEM_AUTO_RECALC'
             WHERE invoice_id = ?`,
            [
              breakdown.insuranceId,
              breakdown.totalAmount,
              breakdown.insuranceCovered,
              breakdown.patientAmount,
              paymentStatus,
              existing.invoice_id
            ],
            (updateErr) => {
              if (updateErr) return callback(updateErr);
              callback(null, {
                invoiceId: Number(existing.invoice_id),
                ...breakdown,
                paymentStatus,
                netPaid
              });
            }
          );
        }
      );
    });
  }

  function generateInvoiceForAppointment(appointmentId, callback) {
    upsertInvoiceForAppointment(appointmentId, (err) => callback(err || null));
  }

  function insertInvoice(appointmentId, insuranceId, amount, insuranceCovered, patientAmount, paymentStatus, callback) {
    pool.query(
      `INSERT INTO invoices (appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM_AUTO', 'SYSTEM_AUTO')`,
      [appointmentId, insuranceId, amount, insuranceCovered, patientAmount, paymentStatus],
      (err, result) => {
        if (err) return callback(err);
        callback(null, {
          invoiceId: Number(result.insertId),
          totalAmount: amount,
          insuranceCovered,
          patientAmount,
          paymentStatus
        });
      }
    );
  }

  function getDentistAppointments(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const doctorId = Number(parsedUrl.query.doctorId || 0);
    const requestedDate = String(parsedUrl.query.date || '').trim();
    const hasDateFilter = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate);
    const resolvedDate = hasDateFilter ? requestedDate : null;
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return sendJSON(res, 400, { error: 'A valid doctorId is required' });
    }

    pool.query(
      `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        a.notes,
        ast.status_name,
        ast.display_name AS appointment_status,
        p.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.p_phone,
        p.p_email,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM appointments a
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      WHERE a.doctor_id = ?
        AND (? IS NULL OR a.appointment_date = ?)
      ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
      [doctorId, resolvedDate, resolvedDate],
      (err, rows) => {
        if (err) {
          console.error('Error fetching dentist appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function searchDentistPatientAppointmentHistory(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const doctorId = Number(parsedUrl.query.doctorId || 0);
    const query = String(parsedUrl.query.query || '').trim();
    const sqlLike = `%${query}%`;
    const parsedPatientId = Number.parseInt(query, 10);
    const numericPatientId = Number.isInteger(parsedPatientId) && parsedPatientId > 0 ? parsedPatientId : 0;

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return sendJSON(res, 400, { error: 'A valid doctorId is required' });
    }

    if (!query) {
      return sendJSON(res, 200, []);
    }

    pool.query(
      `SELECT
        p.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.p_email AS patient_email,
        p.p_phone AS patient_phone,
        (
          SELECT a3.appointment_id
          FROM appointments a3
          WHERE a3.patient_id = p.patient_id AND a3.doctor_id = ?
          ORDER BY a3.appointment_date DESC, a3.appointment_time DESC, a3.appointment_id DESC
          LIMIT 1
        ) AS latest_appointment_id,
        (
          SELECT COALESCE(ast2.display_name, ast2.status_name)
          FROM appointments a4
          LEFT JOIN appointment_statuses ast2 ON ast2.status_id = a4.status_id
          WHERE a4.patient_id = p.patient_id AND a4.doctor_id = ?
          ORDER BY a4.appointment_date DESC, a4.appointment_time DESC, a4.appointment_id DESC
          LIMIT 1
        ) AS latest_appointment_status
      FROM patients p
      WHERE EXISTS (
        SELECT 1
        FROM appointments a2
        WHERE a2.patient_id = p.patient_id
          AND a2.doctor_id = ?
      )
        AND (
          CONCAT(p.p_first_name, ' ', p.p_last_name) LIKE ?
          OR p.p_email LIKE ?
          OR p.p_phone LIKE ?
          OR (? > 0 AND p.patient_id = ?)
        )
      ORDER BY p.p_last_name ASC, p.p_first_name ASC, p.patient_id ASC
      LIMIT 100`,
      [doctorId, doctorId, doctorId, sqlLike, sqlLike, sqlLike, numericPatientId, numericPatientId],
      (err, rows) => {
        if (err) {
          console.error('Error searching dentist patients:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        return sendJSON(res, 200, rows || []);
      }
    );
  }

  function getDentistAppointmentDetail(req, appointmentId, doctorId, res) {
    pool.query(
      `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        a.notes,
        ast.status_name,
        ast.display_name AS appointment_status,
        p.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_dob,
        p.p_gender,
        p.p_race,
        p.p_ethnicity,
        p.p_phone,
        p.p_email,
        p.p_address,
        p.p_city,
        p.p_state,
        p.p_zipcode,
        p.p_country,
        p.p_emergency_contact_name,
        p.p_emergency_contact_phone,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM appointments a
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      WHERE a.appointment_id = ? AND a.doctor_id = ?
      LIMIT 1`,
      [appointmentId, doctorId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching dentist appointment detail:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }

        const base = rows[0];
        const patientId = base.patient_id;

        pool.query(
          `SELECT
            a.appointment_id,
            a.appointment_date,
            a.appointment_time,
            ast.display_name AS appointment_status,
            a.notes
          FROM appointments a
          LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
          WHERE a.patient_id = ? AND a.appointment_id <> ?
          ORDER BY a.appointment_date DESC, a.appointment_time DESC
          LIMIT 25`,
          [patientId, appointmentId],
          (pastErr, pastRows) => {
            if (pastErr) {
              console.error('Error fetching past appointments:', pastErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }

            pool.query(
              `SELECT
                tp.plan_id,
                tp.procedure_code,
                tp.tooth_number,
                tp.surface,
                tp.priority,
                tp.follow_up_required,
                tp.follow_up_date,
                tp.start_date,
                tp.created_at,
                tp.notes,
                ts.status_name,
                apc.description AS procedure_description,
                apc.default_fees
              FROM treatment_plans tp
              LEFT JOIN treatment_statuses ts ON ts.status_id = tp.status_id
              LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
              WHERE tp.patient_id = ?
              ORDER BY tp.created_at DESC
              LIMIT 30`,
              [patientId],
              (tpErr, treatmentRows) => {
                if (tpErr) {
                  console.error('Error fetching treatment plans:', tpErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }

                pool.query(
                  `SELECT
                    df.finding_id,
                    df.appointment_id,
                    df.tooth_number,
                    df.surface,
                    df.condition_type,
                    df.notes,
                    df.date_logged,
                    a.appointment_date,
                    a.appointment_time
                  FROM dental_findings df
                  LEFT JOIN appointments a ON a.appointment_id = df.appointment_id
                  WHERE df.patient_id = ?
                  ORDER BY COALESCE(a.appointment_date, DATE(df.date_logged)) DESC,
                           COALESCE(a.appointment_time, TIME(df.date_logged)) DESC,
                           df.finding_id DESC
                  LIMIT 100`,
                  [patientId],
                  (findingErr, findingRows) => {
                    if (findingErr) {
                      console.error('Error fetching dental findings:', findingErr);
                      return sendJSON(res, 500, { error: 'Database error' });
                    }

                    pool.query(
                  `SELECT
                    prescription_id,
                    plan_id,
                    medication_name,
                    instructions,
                    strength,
                    dosage,
                    quantity,
                    refills,
                    date_prescribed
                  FROM prescriptions
                  WHERE patient_id = ?
                  ORDER BY date_prescribed DESC, prescription_id DESC
                  LIMIT 30`,
                      [patientId],
                      (rxErr, rxRows) => {
                        if (rxErr) {
                          console.error('Error fetching prescriptions:', rxErr);
                          return sendJSON(res, 500, { error: 'Database error' });
                        }

                        pool.query(
                          `SELECT snapshot_json
                           FROM patient_registration_snapshots
                           WHERE patient_id = ?
                           ORDER BY updated_at DESC, created_at DESC
                           LIMIT 1`,
                              [patientId],
                              (snapshotErr, snapshotRows) => {
                                if (snapshotErr) {
                                  console.error('Error fetching patient intake snapshot:', snapshotErr);
                                  return sendJSON(res, 500, { error: 'Database error' });
                                }

                                let intakeSnapshot = null;
                                if (snapshotRows?.[0]?.snapshot_json) {
                                  try {
                                    intakeSnapshot = typeof snapshotRows[0].snapshot_json === 'string'
                                      ? JSON.parse(snapshotRows[0].snapshot_json)
                                      : snapshotRows[0].snapshot_json;
                                  } catch {
                                    intakeSnapshot = null;
                                  }
                                }

                                const completedTreatments = (treatmentRows || []).filter((item) => String(item.status_name || '').toUpperCase() === 'COMPLETED');

                                sendJSON(res, 200, {
                                  appointment: base,
                                  patientProfile: {
                                    patient_id: base.patient_id,
                                    first_name: base.p_first_name,
                                    last_name: base.p_last_name,
                                    date_of_birth: base.p_dob,
                                    gender: base.p_gender,
                                    race: base.p_race,
                                    ethnicity: base.p_ethnicity,
                                    phone: base.p_phone,
                                    email: base.p_email,
                                    address: base.p_address,
                                    city: base.p_city,
                                    state: base.p_state,
                                    zipcode: base.p_zipcode,
                                    country: base.p_country,
                                    emergency_contact_name: base.p_emergency_contact_name,
                                    emergency_contact_phone: base.p_emergency_contact_phone
                                  },
                                  intakeSnapshot,
                                  pastAppointments: pastRows || [],
                                  treatmentPlans: treatmentRows || [],
                                  completedTreatments,
                                  dentalFindings: findingRows || [],
                                  prescriptions: rxRows || []
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
    );
  }

  function updateDentistAppointmentNote(req, appointmentId, doctorId, data, res) {
    const note = String(data?.note || '').trim();
    pool.query(
      `UPDATE appointments
       SET notes = ?, updated_by = 'DENTIST_PORTAL'
       WHERE appointment_id = ? AND doctor_id = ?`,
      [note || null, appointmentId, doctorId],
      (err, result) => {
        if (err) {
          console.error('Error updating appointment note:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }
        sendJSON(res, 200, { message: 'Visit note saved' });
      }
    );
  }

  function createDentistDentalFinding(req, appointmentId, doctorId, data, res) {
    const normalizedToothNumbers = (() => {
      const source = Array.isArray(data?.toothNumbers)
        ? data.toothNumbers
        : String(data?.toothNumber || '')
          .split(',');

      const seen = new Set();
      const values = [];
      source.forEach((item) => {
        const value = String(item || '').trim();
        if (!value) return;
        if (seen.has(value)) return;
        seen.add(value);
        values.push(value);
      });
      return values;
    })();
    const surface = data?.surface ? String(data.surface).trim() : null;
    const conditionType = String(data?.conditionType || '').trim();
    const conditionTypesByTooth = (() => {
      if (!data?.conditionTypesByTooth || typeof data.conditionTypesByTooth !== 'object') {
        return {};
      }

      const normalized = {};
      Object.entries(data.conditionTypesByTooth).forEach(([rawTooth, rawCondition]) => {
        const tooth = String(rawTooth || '').trim();
        const condition = String(rawCondition || '').trim();
        if (!tooth || !condition) {
          return;
        }
        normalized[tooth] = condition;
      });
      return normalized;
    })();
    const notes = data?.notes ? String(data.notes).trim() : null;

    if (!normalizedToothNumbers.length) {
      return sendJSON(res, 400, { error: 'At least one tooth number is required' });
    }

    const missingConditionTooth = normalizedToothNumbers.find((tooth) => {
      const conditionForTooth = String(conditionTypesByTooth[tooth] || conditionType || '').trim();
      return !conditionForTooth;
    });

    if (missingConditionTooth) {
      return sendJSON(res, 400, { error: `Condition is required for tooth ${missingConditionTooth}` });
    }

    getAppointmentContext(appointmentId, doctorId, (ctxErr, context) => {
      if (ctxErr) {
        console.error('Error reading appointment context:', ctxErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (!context) {
        return sendJSON(res, 404, { error: 'Appointment not found' });
      }

      const values = normalizedToothNumbers.map((toothNumber) => [
        context.patient_id,
        doctorId,
        appointmentId,
        toothNumber,
        surface,
        String(conditionTypesByTooth[toothNumber] || conditionType || '').trim(),
        notes
      ]);

      pool.query(
        `INSERT INTO dental_findings (
          patient_id,
          doctor_id,
          appointment_id,
          tooth_number,
          surface,
          condition_type,
          notes,
          date_logged,
          created_by,
          updated_by
        ) VALUES ?`,
        [values.map((entry) => [...entry, new Date(), 'DENTIST_PORTAL', 'DENTIST_PORTAL'])],
        (insertErr, insertResult) => {
          if (insertErr) {
            console.error('Error saving dental finding:', insertErr);
            return sendJSON(res, 500, { error: 'Database error' });
          }

          markAppointmentCompleted(appointmentId, doctorId, (statusErr) => {
            if (statusErr) {
              console.error('Error setting appointment to completed:', statusErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }

            sendJSON(res, 201, {
              message: normalizedToothNumbers.length > 1 ? 'Dental findings saved' : 'Dental finding saved',
              savedCount: normalizedToothNumbers.length,
              firstFindingId: insertResult.insertId,
              appointmentStatus: 'COMPLETED'
            });
          });
        }
      );
    });
  }

  function createDentistTreatmentEntry(req, appointmentId, doctorId, data, res) {
    const procedureCode = data?.procedureCode ? String(data.procedureCode).trim().toUpperCase() : null;
    const toothNumber = data?.toothNumber ? String(data.toothNumber).trim() : null;
    const surface = data?.surface ? String(data.surface).trim() : null;
    const estimatedCostInput = data?.estimatedCost !== undefined && data?.estimatedCost !== null
      ? Number(data.estimatedCost)
      : null;
    const hasManualEstimatedCost = Number.isFinite(estimatedCostInput) && estimatedCostInput > 0;
    const priority = data?.priority ? String(data.priority).trim() : null;
    const notes = data?.notes ? String(data.notes).trim() : null;
    const followUpRequired = normalizeBooleanValue(data?.followUpRequired);
    const followUpDate = followUpRequired ? normalizeDateValue(data?.followUpDate) : null;
    const requestedStatus = data?.statusName ? String(data.statusName).trim().toUpperCase() : 'COMPLETED';

    if (followUpRequired && !followUpDate) {
      return sendJSON(res, 400, { error: 'Follow-up date is required when follow-up is enabled' });
    }

    getAppointmentContext(appointmentId, doctorId, (ctxErr, context) => {
      if (ctxErr) {
        console.error('Error reading appointment context:', ctxErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (!context) {
        return sendJSON(res, 404, { error: 'Appointment not found' });
      }

      pool.getConnection((connErr, conn) => {
        if (connErr) {
          console.error('Error getting DB connection for treatment entry:', connErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        getTreatmentStatusId(conn, requestedStatus, (statusErr, statusId) => {
          if (statusErr) {
            conn.release();
            console.error('Error resolving treatment status:', statusErr);
            return sendJSON(res, 400, { error: 'Invalid treatment status' });
          }

          const resolveProcedureCode = (callback) => {
            if (!procedureCode) {
              return callback(null, null, null);
            }

            conn.query(
              'SELECT procedure_code, default_fees FROM ada_procedure_codes WHERE procedure_code = ? LIMIT 1',
              [procedureCode],
              (codeErr, codeRows) => {
                if (codeErr) {
                  return callback(codeErr);
                }
                if (!codeRows?.length) {
                  return callback(null, null, null);
                }
                callback(null, procedureCode, codeRows[0].default_fees);
              }
            );
          };

          resolveProcedureCode((codeErr, safeProcedureCode, adaDefaultFees) => {
            if (codeErr) {
              conn.release();
              console.error('Error validating procedure code:', codeErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }

            const autoEstimatedCost = hasManualEstimatedCost
              ? estimatedCostInput
              : (adaDefaultFees !== undefined && adaDefaultFees !== null ? Number(adaDefaultFees) : null);

            conn.query(
              `INSERT INTO treatment_plans (
                patient_id,
                doctor_id,
                surface,
                procedure_code,
                status_id,
                tooth_number,
                estimated_cost,
                priority,
                follow_up_required,
                follow_up_date,
                start_date,
                notes,
                created_by,
                updated_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DENTIST_PORTAL', 'DENTIST_PORTAL')`,
              [context.patient_id, doctorId, surface, safeProcedureCode, statusId, toothNumber, autoEstimatedCost, priority, followUpRequired ? 1 : 0, followUpDate, context.appointment_date || null, notes],
              (insertErr, insertResult) => {
                if (insertErr) {
                  conn.release();
                  console.error('Error saving treatment entry:', insertErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }

                markAppointmentCompleted(appointmentId, doctorId, (markErr) => {
                  conn.release();
                  if (markErr) {
                    console.error('Error setting appointment to completed after treatment save:', markErr);
                    return sendJSON(res, 500, { error: 'Database error' });
                  }

                  sendJSON(res, 201, {
                    message: 'Treatment entry saved',
                    planId: insertResult.insertId,
                    estimatedCost: autoEstimatedCost,
                    appointmentStatus: 'COMPLETED',
                    pricingSource: hasManualEstimatedCost ? 'MANUAL' : (safeProcedureCode && autoEstimatedCost !== null ? 'ADA_DEFAULT_FEE' : 'NONE')
                  });
                });
              }
            );
          });
        });
      });
    });
  }

  function handleDentistAppointmentRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'reports' && parts[3] === 'patient') {
      getDentistSinglePatientReport(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'ada-procedure-codes') {
      getAdaProcedureCodes(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && !parts[3]) {
      getDentistAppointments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'patients' && parts[3] === 'appointments' && parts[4] === 'search') {
      searchDentistPatientAppointmentHistory(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] === 'today') {
      getDentistAppointments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && !parts[4]) {
      const appointmentId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId and doctorId are required' });
        return true;
      }

      getDentistAppointmentDetail(req, appointmentId, doctorId, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && parts[4] === 'note') {
      const appointmentId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId and doctorId are required' });
        return true;
      }

      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return updateDentistAppointmentNote(req, appointmentId, doctorId, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && parts[4] === 'dental-findings') {
      const appointmentId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId and doctorId are required' });
        return true;
      }

      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return createDentistDentalFinding(req, appointmentId, doctorId, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && parts[4] === 'treatments') {
      const appointmentId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId and doctorId are required' });
        return true;
      }

      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return createDentistTreatmentEntry(req, appointmentId, doctorId, data, res);
      });
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && parts[4] === 'treatments' && parts[5]) {
      const appointmentId = Number(parts[3]);
      const planId = Number(parts[5]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(planId) || planId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId, planId and doctorId are required' });
        return true;
      }

      getAppointmentContext(appointmentId, doctorId, (ctxErr, context) => {
        if (ctxErr) {
          console.error('Error reading appointment context for treatment delete:', ctxErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!context) {
          return sendJSON(res, 404, { error: 'Appointment not found' });
        }

        pool.query(
          `DELETE FROM treatment_plans
           WHERE plan_id = ? AND doctor_id = ? AND patient_id = ?`,
          [planId, doctorId, context.patient_id],
          (deleteErr, result) => {
            if (deleteErr) {
              console.error('Error deleting treatment plan:', deleteErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            if (!result.affectedRows) {
              return sendJSON(res, 404, { error: 'Treatment entry not found' });
            }
            return sendJSON(res, 200, { message: 'Treatment entry deleted' });
          }
        );
      });
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'treatments' && parts[3]) {
      const planId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(planId) || planId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid planId and doctorId are required' });
        return true;
      }

      pool.query(
        `DELETE FROM treatment_plans
         WHERE plan_id = ? AND doctor_id = ?`,
        [planId, doctorId],
        (deleteErr, result) => {
          if (deleteErr) {
            console.error('Error deleting treatment plan by planId:', deleteErr);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          if (!result.affectedRows) {
            return sendJSON(res, 404, { error: 'Treatment entry not found' });
          }
          return sendJSON(res, 200, { message: 'Treatment entry deleted' });
        }
      );
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'findings' && parts[3]) {
      const findingId = Number(parts[3]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(findingId) || findingId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid findingId and doctorId are required' });
        return true;
      }

      pool.query(
        `DELETE FROM dental_findings
         WHERE finding_id = ? AND doctor_id = ?`,
        [findingId, doctorId],
        (deleteErr, result) => {
          if (deleteErr) {
            console.error('Error deleting dental finding:', deleteErr);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          if (!result.affectedRows) {
            return sendJSON(res, 404, { error: 'Dental finding not found' });
          }
          return sendJSON(res, 200, { message: 'Dental finding deleted' });
        }
      );
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && parts[3] && parts[4] === 'findings' && parts[5]) {
      const appointmentId = Number(parts[3]);
      const findingId = Number(parts[5]);
      const parsed = url.parse(req.url, true);
      const doctorId = Number(parsed.query.doctorId || 0);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !Number.isInteger(findingId) || findingId <= 0 || !Number.isInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 400, { error: 'Valid appointmentId, findingId and doctorId are required' });
        return true;
      }

      pool.query(
        `DELETE FROM dental_findings
         WHERE finding_id = ? AND doctor_id = ? AND appointment_id = ?`,
        [findingId, doctorId, appointmentId],
        (deleteErr, result) => {
          if (deleteErr) {
            console.error('Error deleting dental finding by appointment route:', deleteErr);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          if (!result.affectedRows) {
            return sendJSON(res, 404, { error: 'Dental finding not found' });
          }
          return sendJSON(res, 200, { message: 'Dental finding deleted' });
        }
      );
      return true;
    }

    // PUT /api/dentist/treatments/:planId — edit a completed treatment and recalculate invoice
    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'treatments' && parts[3]) {
      const planId = Number(parts[3]);
      if (!Number.isInteger(planId) || planId <= 0) {
        sendJSON(res, 400, { error: 'Valid planId is required' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        const doctorId = Number(data.doctorId || 0);
        if (!Number.isInteger(doctorId) || doctorId <= 0) {
          return sendJSON(res, 400, { error: 'Valid doctorId is required' });
        }
        const updates = {};
        if (data.procedureCode !== undefined) updates.procedure_code = String(data.procedureCode).trim();
        if (data.toothNumber !== undefined) updates.tooth_number = String(data.toothNumber).trim();
        if (data.surface !== undefined) updates.surface = String(data.surface).trim() || null;
        if (data.estimatedCost !== undefined) updates.estimated_cost = Number(data.estimatedCost) || 0;
        if (data.priority !== undefined) updates.priority = String(data.priority).trim() || null;
        if (data.notes !== undefined) updates.notes = String(data.notes).trim() || null;
        if (data.followUpRequired !== undefined) updates.follow_up_required = normalizeBooleanValue(data.followUpRequired) ? 1 : 0;
        if (data.followUpRequired !== undefined) updates.follow_up_date = normalizeBooleanValue(data.followUpRequired) ? normalizeDateValue(data.followUpDate) : null;

        if (updates.follow_up_required && !updates.follow_up_date) {
          return sendJSON(res, 400, { error: 'Follow-up date is required when follow-up is enabled' });
        }

        if (Object.keys(updates).length === 0) {
          return sendJSON(res, 400, { error: 'No fields to update' });
        }
        updates.updated_by = 'DENTIST_PORTAL';

        // Get old treatment info before updating
        pool.query(
          'SELECT tp.patient_id, tp.start_date, tp.estimated_cost FROM treatment_plans tp WHERE tp.plan_id = ? AND tp.doctor_id = ?',
          [planId, doctorId],
          (lookupErr, lookupRows) => {
            if (lookupErr) { console.error(lookupErr); return sendJSON(res, 500, { error: 'Database error' }); }
            if (!lookupRows?.length) return sendJSON(res, 404, { error: 'Treatment entry not found' });

            const oldCost = Number(lookupRows[0].estimated_cost || 0);
            const patientId = lookupRows[0].patient_id;
            const startDate = lookupRows[0].start_date instanceof Date
              ? lookupRows[0].start_date.toISOString().slice(0, 10)
              : String(lookupRows[0].start_date || '').slice(0, 10);

            const ALLOWED_COLS = new Set(['procedure_code', 'tooth_number', 'surface', 'estimated_cost', 'priority', 'notes', 'follow_up_required', 'follow_up_date', 'updated_by']);
            const safeKeys = Object.keys(updates).filter((col) => ALLOWED_COLS.has(col));
            const setClauses = safeKeys.map((col) => `${col} = ?`).join(', ');
            const values = [...safeKeys.map((col) => updates[col]), planId, doctorId];

            pool.query(
              `UPDATE treatment_plans SET ${setClauses} WHERE plan_id = ? AND doctor_id = ?`,
              values,
              (updateErr, result) => {
                if (updateErr) { console.error('Error updating treatment plan:', updateErr); return sendJSON(res, 500, { error: 'Database error' }); }
                if (!result.affectedRows) return sendJSON(res, 404, { error: 'Treatment entry not found' });

                const newCost = updates.estimated_cost !== undefined ? Number(updates.estimated_cost) : oldCost;
                const costDiff = newCost - oldCost;

                // If cost didn't change, just return
                if (Math.abs(costDiff) < 0.01) {
                  return sendJSON(res, 200, { message: 'Treatment updated successfully', costChanged: false });
                }

                // Recalculate invoice using coverage table for this appointment
                pool.query(
                  `SELECT a.appointment_id
                   FROM appointments a
                   WHERE a.patient_id = ? AND a.doctor_id = ? AND a.appointment_date = ?
                   LIMIT 1`,
                  [patientId, doctorId, startDate],
                  (apptErr, apptRows) => {
                    if (apptErr || !apptRows?.length) {
                      return sendJSON(res, 200, { message: 'Treatment updated (no invoice to adjust)', costChanged: true, costDiff });
                    }

                    const appointmentId = Number(apptRows[0].appointment_id);
                    upsertInvoiceForAppointment(appointmentId, (recalcErr, invoiceInfo) => {
                      if (recalcErr || !invoiceInfo) {
                        if (recalcErr) {
                          console.error('Error recalculating invoice from insurance coverage:', recalcErr);
                        }
                        return sendJSON(res, 200, { message: 'Treatment updated (invoice recalculation skipped)', costChanged: true, costDiff });
                      }

                      const oldTotal = Number((invoiceInfo.totalAmount || 0) - costDiff);
                      const newTotal = Number(invoiceInfo.totalAmount || 0);
                      const newPatientAmount = Number(invoiceInfo.patientAmount || 0);
                      const totalPaid = Number(invoiceInfo.netPaid || 0);
                      const refundNeeded = totalPaid > newPatientAmount && newPatientAmount >= 0;
                      const refundAmount = refundNeeded ? Math.round((totalPaid - newPatientAmount) * 100) / 100 : 0;

                      return sendJSON(res, 200, {
                        message: 'Treatment updated and invoice recalculated',
                        costChanged: true,
                        costDiff,
                        invoiceId: invoiceInfo.invoiceId,
                        oldTotal,
                        newTotal,
                        newPatientAmount,
                        totalPaid,
                        refundNeeded,
                        refundAmount
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
      return true;
    }

    return false;
  }

  return {
    handleDentistAppointmentRoutes
  };
}

module.exports = {
  createDentistAppointmentRoutes
};
