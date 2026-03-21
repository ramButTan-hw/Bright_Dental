const url = require('url');

function createReceptionRoutes({ pool, sendJSON }) {
  function normalizeTimeValue(value) {
    const raw = String(value || '').trim();
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return `${raw}:00`;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    return '';
  }

  function addMinutesToTime(timeValue, minutesToAdd) {
    const [hour, minute, second] = String(timeValue).split(':').map((part) => Number(part || 0));
    const base = new Date();
    base.setHours(hour, minute, second, 0);
    base.setMinutes(base.getMinutes() + minutesToAdd);
    return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}:${String(base.getSeconds()).padStart(2, '0')}`;
  }

  async function getAppointmentStatusId(conn, statusName) {
    const [rows] = await conn.promise().query(
      'SELECT status_id FROM appointment_statuses WHERE status_name = ? LIMIT 1',
      [String(statusName || '').trim().toUpperCase()]
    );
    if (!rows?.length) {
      throw new Error(`Status ${statusName} not found`);
    }
    return Number(rows[0].status_id);
  }

  async function createScheduledAppointment(conn, payload) {
    const patientId = Number(payload?.patientId || 0);
    const doctorId = Number(payload?.doctorId || 0);
    const appointmentDate = String(payload?.appointmentDate || '').trim();
    const appointmentTime = normalizeTimeValue(payload?.appointmentTime);
    const createdBy = String(payload?.createdBy || 'RECEPTION_PORTAL').trim();
    const locationId = Number.isInteger(payload?.locationId) && payload.locationId > 0 ? payload.locationId : null;
    const notes = payload?.notes ? String(payload.notes).trim() : null;

    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw new Error('A valid patientId is required');
    }
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      throw new Error('A valid doctorId is required');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      throw new Error('appointmentDate must use YYYY-MM-DD format');
    }
    if (!appointmentTime) {
      throw new Error('appointmentTime must use HH:MM or HH:MM:SS format');
    }

    const statusId = await getAppointmentStatusId(conn, 'SCHEDULED');
    const appointmentEndTime = addMinutesToTime(appointmentTime, 30);

    const [slotRows] = await conn.promise().query(
      `SELECT slot_id, current_bookings, max_patients, is_available
       FROM appointment_slots
       WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ?
       LIMIT 1
       FOR UPDATE`,
      [doctorId, appointmentDate, appointmentTime]
    );

    let slotId = null;
    let currentBookings = 0;
    let maxPatients = 1;
    let isAvailable = true;

    if (slotRows?.length) {
      slotId = Number(slotRows[0].slot_id);
      currentBookings = Number(slotRows[0].current_bookings || 0);
      maxPatients = Number(slotRows[0].max_patients || 1);
      isAvailable = Boolean(slotRows[0].is_available);
    } else {
      const [slotInsert] = await conn.promise().query(
        `INSERT INTO appointment_slots (
          doctor_id,
          location_id,
          slot_date,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          is_available,
          max_patients,
          current_bookings,
          slot_type,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, 30, TRUE, 1, 0, 'REGULAR', ?, ?)`,
        [doctorId, locationId, appointmentDate, appointmentTime, appointmentEndTime, createdBy, createdBy]
      );
      slotId = Number(slotInsert.insertId);
      currentBookings = 0;
      maxPatients = 1;
      isAvailable = true;
    }

    const [occupiedRows] = await conn.promise().query(
      `SELECT a.appointment_id
       FROM appointments a
       JOIN appointment_statuses s ON s.status_id = a.status_id
       WHERE a.slot_id = ?
         AND s.status_name NOT IN ('CANCELLED')
       LIMIT 1`,
      [slotId]
    );

    if (occupiedRows?.length || currentBookings >= maxPatients || !isAvailable) {
      throw new Error('The selected doctor time slot is already booked');
    }

    const [appointmentInsert] = await conn.promise().query(
      `INSERT INTO appointments (
        slot_id,
        location_id,
        patient_id,
        doctor_id,
        appointment_time,
        appointment_date,
        status_id,
        notes,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slotId, locationId, patientId, doctorId, appointmentTime, appointmentDate, statusId, notes, createdBy, createdBy]
    );

    await conn.promise().query(
      `UPDATE appointment_slots
       SET current_bookings = current_bookings + 1,
           is_available = FALSE,
           updated_by = ?
       WHERE slot_id = ?`,
      [createdBy, slotId]
    );

    return {
      appointmentId: Number(appointmentInsert.insertId),
      slotId
    };
  }

  function getReceptionDoctors(req, res) {
    pool.query(
      `SELECT
        d.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        st.phone_number,
        COALESCE(GROUP_CONCAT(DISTINCT dept.department_name ORDER BY dept.department_name SEPARATOR ', '), 'General Dentistry') AS specialties
      FROM doctors d
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN specialties_department sd ON sd.doctor_id = d.doctor_id
      LEFT JOIN departments dept ON dept.department_id = sd.department_id
      GROUP BY d.doctor_id, st.first_name, st.last_name, st.phone_number
      ORDER BY st.last_name ASC, st.first_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching reception doctors:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  const APPOINTMENT_SELECT_SQL = `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        ast.status_name,
        ast.display_name AS appointment_status,
        a.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.p_phone,
        p.p_email,
        a.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM appointments a
      JOIN appointment_statuses ast ON ast.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id`;

  function getReceptionAppointments(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(parsedUrl.query.date || ''))
      ? String(parsedUrl.query.date)
      : new Date().toISOString().slice(0, 10);

    pool.query(
      `${APPOINTMENT_SELECT_SQL}
      WHERE a.appointment_date = ?
      ORDER BY a.appointment_time ASC, patient_name ASC`,
      [date],
      (err, rows) => {
        if (err) {
          console.error('Error fetching reception appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getReceptionFutureAppointments(req, res) {
    const today = new Date().toISOString().slice(0, 10);

    pool.query(
      `${APPOINTMENT_SELECT_SQL}
      WHERE a.appointment_date > ?
      ORDER BY a.appointment_date ASC, a.appointment_time ASC, patient_name ASC
      LIMIT 200`,
      [today],
      (err, rows) => {
        if (err) {
          console.error('Error fetching future appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getReceptionPastAppointments(req, res) {
    const today = new Date().toISOString().slice(0, 10);

    pool.query(
      `${APPOINTMENT_SELECT_SQL}
      WHERE a.appointment_date < ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC, patient_name ASC
      LIMIT 200`,
      [today],
      (err, rows) => {
        if (err) {
          console.error('Error fetching past appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function createReceptionAppointment(req, data, res) {
    const patientId = Number(data?.patientId || 0);
    const doctorId = Number(data?.doctorId || 0);
    const appointmentDate = String(data?.appointmentDate || '').trim();
    const appointmentTime = String(data?.appointmentTime || '').trim();
    const locationId = Number(data?.locationId || 0);
    const notes = data?.notes ? String(data.notes).trim() : null;

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for reception appointment:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          const result = await createScheduledAppointment(conn, {
            patientId,
            doctorId,
            appointmentDate,
            appointmentTime,
            locationId: Number.isInteger(locationId) && locationId > 0 ? locationId : null,
            notes,
            createdBy: 'RECEPTION_PORTAL'
          });

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing reception appointment:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            return sendJSON(res, 201, {
              message: 'Appointment created successfully',
              appointmentId: result.appointmentId
            });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            if (error.message.includes('required') || error.message.includes('format') || error.message.includes('booked')) {
              return sendJSON(res, 400, { error: error.message });
            }
            if (error.code === 'ER_DUP_ENTRY') {
              return sendJSON(res, 409, { error: 'The selected time slot already exists for this doctor' });
            }
            console.error('Error creating reception appointment:', error);
            return sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  function checkInReceptionAppointment(req, appointmentId, res) {
    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for check-in:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          const confirmedStatusId = await getAppointmentStatusId(conn, 'CONFIRMED');
          const [updateResult] = await conn.promise().query(
            `UPDATE appointments
             SET status_id = ?, updated_by = 'RECEPTION_PORTAL'
             WHERE appointment_id = ?`,
            [confirmedStatusId, appointmentId]
          );

          if (!updateResult.affectedRows) {
            throw new Error('Appointment not found');
          }

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing check-in:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            return sendJSON(res, 200, { message: 'Patient checked in successfully' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            if (error.message === 'Appointment not found') {
              return sendJSON(res, 404, { error: error.message });
            }
            console.error('Error checking in appointment:', error);
            return sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  function searchReceptionPatients(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const query = String(parsedUrl.query.query || '').trim();
    const sqlLike = `%${query}%`;

    pool.query(
      `SELECT
        p.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_phone,
        p.p_email,
        p.p_dob,
        p.p_city,
        p.p_state,
        p.p_emergency_contact_name,
        p.p_emergency_contact_phone
      FROM patients p
      WHERE (? = '' OR
        CONCAT(p.p_first_name, ' ', p.p_last_name) LIKE ? OR
        p.p_phone LIKE ? OR
        p.p_email LIKE ? OR
        p.p_ssn LIKE ?)
      ORDER BY p.p_last_name ASC, p.p_first_name ASC
      LIMIT 100`,
      [query, sqlLike, sqlLike, sqlLike, sqlLike],
      (err, rows) => {
        if (err) {
          console.error('Error searching reception patients:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getReceptionPatientDetails(req, patientId, res) {
    pool.query(
      `SELECT
        p.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_dob,
        p.p_phone,
        p.p_email,
        p.p_address,
        p.p_city,
        p.p_state,
        p.p_zipcode,
        p.p_emergency_contact_name,
        p.p_emergency_contact_phone
      FROM patients p
      WHERE p.patient_id = ?
      LIMIT 1`,
      [patientId],
      (patientErr, patientRows) => {
        if (patientErr) {
          console.error('Error fetching reception patient detail:', patientErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!patientRows?.length) {
          return sendJSON(res, 404, { error: 'Patient not found' });
        }

        pool.query(
          `SELECT
            i.insurance_id,
            i.member_id,
            i.group_number,
            i.is_primary,
            i.effective_date,
            i.expiration_date,
            ic.company_name
          FROM insurance i
          LEFT JOIN insurance_companies ic ON ic.company_id = i.company_id
          WHERE i.patient_id = ?
          ORDER BY i.is_primary DESC, i.insurance_id DESC`,
          [patientId],
          (insuranceErr, insuranceRows) => {
            if (insuranceErr) {
              console.error('Error fetching patient insurance:', insuranceErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }

            pool.query(
              `SELECT DISTINCT
                ph.pharm_id,
                ph.pharm_name,
                ph.pharm_phone,
                ph.ph_city,
                ph.ph_state
              FROM prescriptions pr
              JOIN pharmacies ph ON ph.pharm_id = pr.pharm_id
              WHERE pr.patient_id = ?
              ORDER BY ph.pharm_name ASC`,
              [patientId],
              (pharmacyErr, pharmacyRows) => {
                if (pharmacyErr) {
                  console.error('Error fetching patient pharmacies:', pharmacyErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }

                pool.query(
                  `SELECT
                    tp.plan_id,
                    tp.procedure_code,
                    tp.tooth_number,
                    tp.notes,
                    ts.display_name AS treatment_status,
                    tp.created_at
                  FROM treatment_plans tp
                  LEFT JOIN treatment_statuses ts ON ts.status_id = tp.status_id
                  WHERE tp.patient_id = ?
                  ORDER BY tp.created_at DESC
                  LIMIT 40`,
                  [patientId],
                  (treatmentErr, treatmentRows) => {
                    if (treatmentErr) {
                      console.error('Error fetching patient treatments:', treatmentErr);
                      return sendJSON(res, 500, { error: 'Database error' });
                    }

                    return sendJSON(res, 200, {
                      patient: patientRows[0],
                      insurance: insuranceRows || [],
                      pharmacies: pharmacyRows || [],
                      treatments: treatmentRows || []
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

  function updateReceptionPatient(req, patientId, data, res) {
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const phone = String(data?.phone || '').trim();
    const email = String(data?.email || '').trim();
    const address = String(data?.address || '').trim();
    const city = String(data?.city || '').trim();
    const state = String(data?.state || '').trim().toUpperCase();
    const zipcode = String(data?.zipcode || '').trim();
    const emergencyContactName = String(data?.emergencyContactName || '').trim();
    const emergencyContactPhone = String(data?.emergencyContactPhone || '').trim();

    if (!firstName || !lastName || !email) {
      return sendJSON(res, 400, { error: 'firstName, lastName, and email are required' });
    }

    pool.query(
      `UPDATE patients
       SET p_first_name = ?,
           p_last_name = ?,
           p_phone = ?,
           p_email = ?,
           p_address = ?,
           p_city = ?,
           p_state = ?,
           p_zipcode = ?,
           p_emergency_contact_name = ?,
           p_emergency_contact_phone = ?,
           updated_by = 'RECEPTION_PORTAL'
       WHERE patient_id = ?`,
      [
        firstName,
        lastName,
        phone || null,
        email,
        address || null,
        city || null,
        state || null,
        zipcode || null,
        emergencyContactName || null,
        emergencyContactPhone || null,
        patientId
      ],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return sendJSON(res, 409, { error: 'Patient email already exists' });
          }
          console.error('Error updating patient info:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Patient not found' });
        }
        return sendJSON(res, 200, { message: 'Patient information updated successfully' });
      }
    );
  }

  function registerReceptionPatient(req, data, res) {
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const dob = String(data?.dob || '').trim();
    const phone = String(data?.phone || '').trim();
    const email = String(data?.email || '').trim();
    const gender = Number(data?.gender || 0);

    if (!firstName || !lastName || !dob || !email) {
      return sendJSON(res, 400, { error: 'firstName, lastName, dob, and email are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return sendJSON(res, 400, { error: 'dob must use YYYY-MM-DD format' });
    }

    pool.query(
      `INSERT INTO patients (
        p_first_name,
        p_last_name,
        p_dob,
        p_gender,
        p_phone,
        p_email,
        p_address,
        p_city,
        p_state,
        p_zipcode,
        p_emergency_contact_name,
        p_emergency_contact_phone,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEPTION_PORTAL', 'RECEPTION_PORTAL')`,
      [
        firstName,
        lastName,
        dob,
        Number.isInteger(gender) && gender > 0 ? gender : null,
        phone || null,
        email,
        data?.address ? String(data.address).trim() : null,
        data?.city ? String(data.city).trim() : null,
        data?.state ? String(data.state).trim().toUpperCase() : null,
        data?.zipcode ? String(data.zipcode).trim() : null,
        data?.emergencyContactName ? String(data.emergencyContactName).trim() : null,
        data?.emergencyContactPhone ? String(data.emergencyContactPhone).trim() : null
      ],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return sendJSON(res, 409, { error: 'Patient email already exists' });
          }
          console.error('Error registering patient from reception:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        return sendJSON(res, 201, {
          message: 'Patient registered successfully',
          patientId: Number(result.insertId)
        });
      }
    );
  }

  function handleReceptionRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'doctors') {
      getReceptionDoctors(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && parts[3] === 'future') {
      getReceptionFutureAppointments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && parts[3] === 'past') {
      getReceptionPastAppointments(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && !parts[3]) {
      getReceptionAppointments(req, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && !parts[3]) {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return createReceptionAppointment(req, data, res);
      });
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && parts[3] && parts[4] === 'check-in') {
      const appointmentId = Number(parts[3]);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        sendJSON(res, 400, { error: 'A valid appointment id is required' });
        return true;
      }
      checkInReceptionAppointment(req, appointmentId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] === 'search') {
      searchReceptionPatients(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && parts[4] === 'details') {
      const patientId = Number(parts[3]);
      if (!Number.isInteger(patientId) || patientId <= 0) {
        sendJSON(res, 400, { error: 'A valid patient id is required' });
        return true;
      }
      getReceptionPatientDetails(req, patientId, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && !parts[4]) {
      const patientId = Number(parts[3]);
      if (!Number.isInteger(patientId) || patientId <= 0) {
        sendJSON(res, 400, { error: 'A valid patient id is required' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return updateReceptionPatient(req, patientId, data, res);
      });
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] === 'register') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return registerReceptionPatient(req, data, res);
      });
      return true;
    }

    return false;
  }

  return {
    handleReceptionRoutes
  };
}

module.exports = {
  createReceptionRoutes
};
