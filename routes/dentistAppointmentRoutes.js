const url = require('url');

function createDentistAppointmentRoutes({ pool, sendJSON }) {
  function getDentistAppointments(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const doctorId = Number(parsedUrl.query.doctorId || 0);
    const requestedDate = String(parsedUrl.query.date || '').trim();
    const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : new Date().toISOString().slice(0, 10);
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
        AND a.appointment_date = ?
      ORDER BY a.appointment_time ASC`,
      [doctorId, resolvedDate],
      (err, rows) => {
        if (err) {
          console.error('Error fetching dentist appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
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
                      `SELECT
                        lab_order_id,
                        tooth_number,
                        procedure_code,
                        lab_name,
                        order_date,
                        due_date,
                        status,
                        cost
                      FROM dental_lab_orders
                      WHERE patient_id = ?
                      ORDER BY order_date DESC, lab_order_id DESC
                      LIMIT 30`,
                      [patientId],
                      (labErr, labRows) => {
                        if (labErr) {
                          console.error('Error fetching dental lab orders:', labErr);
                          return sendJSON(res, 500, { error: 'Database error' });
                        }

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
                          pastAppointments: pastRows || [],
                          treatmentPlans: treatmentRows || [],
                          prescriptions: rxRows || [],
                          labOrders: labRows || []
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

  function handleDentistAppointmentRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'dentist' && parts[2] === 'appointments' && !parts[3]) {
      getDentistAppointments(req, res);
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

    return false;
  }

  return {
    handleDentistAppointmentRoutes
  };
}

module.exports = {
  createDentistAppointmentRoutes
};
