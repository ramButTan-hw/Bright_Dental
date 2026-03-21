function createAppointmentPreferenceHandlers(deps) {
  const {
    pool,
    sendJSON,
    url,
    preferredTimeOptions,
    maxPatientsPerTime,
    maxPatientsPerDay
  } = deps;

  function getPreferredAppointmentAvailability(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const days = Math.min(Math.max(Number(parsedUrl.query.days) || 365, 30), 730);
    const preferredLocation = String(parsedUrl.query.location || '').trim().toLowerCase();
    const hasLocationFilter = Boolean(preferredLocation);

    const locationFilterSql = hasLocationFilter
      ? ' AND LOWER(TRIM(preferred_location)) = ?'
      : '';

    const queryParams = [days];
    if (hasLocationFilter) {
      queryParams.push(preferredLocation);
    }

    pool.query(
      `SELECT
        preferred_date,
        preferred_time,
        COUNT(*) AS requests_count
      FROM appointment_preference_requests
      WHERE request_status IN ('PREFERRED_PENDING', 'ASSIGNED')
        AND preferred_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ${locationFilterSql}
      GROUP BY preferred_date, preferred_time`,
      queryParams,
      (err, results) => {
        if (err) {
          console.error('Error fetching preferred availability:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        const usageByDate = new Map();
        (results || []).forEach((row) => {
          const dateKey = String(row.preferred_date).slice(0, 10);
          const timeKey = String(row.preferred_time).slice(0, 8);
          if (!usageByDate.has(dateKey)) {
            usageByDate.set(dateKey, new Map());
          }
          usageByDate.get(dateKey).set(timeKey, Number(row.requests_count) || 0);
        });

        const availability = [];
        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        for (let offset = 0; offset <= days; offset += 1) {
          const date = new Date(todayUtc.getTime() + (offset * 24 * 60 * 60 * 1000));
          const dateKey = date.toISOString().slice(0, 10);
          const timeCounts = usageByDate.get(dateKey) || new Map();
          const timeOptions = preferredTimeOptions.map((timeValue) => {
            const booked = Number(timeCounts.get(timeValue) || 0);
            return {
              time: timeValue.slice(0, 5),
              booked,
              remaining: Math.max(maxPatientsPerTime - booked, 0),
              isFull: booked >= maxPatientsPerTime
            };
          });

          const totalBooked = timeOptions.reduce((sum, option) => sum + option.booked, 0);
          availability.push({
            date: dateKey,
            totalBooked,
            totalCapacity: maxPatientsPerDay,
            remainingCapacity: Math.max(maxPatientsPerDay - totalBooked, 0),
            isFull: totalBooked >= maxPatientsPerDay || timeOptions.every((option) => option.isFull),
            timeOptions
          });
        }

        sendJSON(res, 200, {
          requestedLocation: hasLocationFilter ? preferredLocation : null,
          slotWindow: {
            officeHours: '08:00-19:00',
            patientSelectionHours: '09:00-19:00',
            slotDurationMinutes: 60,
            dentistsAvailable: maxPatientsPerTime,
            capacityPerTime: maxPatientsPerTime,
            capacityPerDay: maxPatientsPerDay
          },
          availability
        });
      }
    );
  }

  function getAppointmentPreferenceRequests(req, res) {
    pool.query(
      `SELECT
        apr.preference_request_id,
        apr.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_phone,
        p.p_email,
        apr.preferred_date,
        apr.preferred_time,
        apr.preferred_location,
        apr.available_days,
        apr.available_times,
        apr.appointment_reason,
        apr.request_status,
        apr.assigned_doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS assigned_doctor_name,
        apr.assigned_date,
        apr.assigned_time,
        apr.receptionist_notes,
        apr.created_at
      FROM appointment_preference_requests apr
      JOIN patients p ON p.patient_id = apr.patient_id
      LEFT JOIN doctors d ON d.doctor_id = apr.assigned_doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      WHERE apr.request_status NOT IN ('CANCELLED', 'ASSIGNED')
      ORDER BY apr.created_at DESC`,
      (err, results) => {
        if (err) {
          console.error('Error fetching appointment preference requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, results);
      }
    );
  }

  function getAppointmentPreferenceRequestById(req, preferenceRequestId, res) {
    pool.query(
      `SELECT
        apr.preference_request_id,
        apr.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_phone,
        p.p_email,
        apr.preferred_date,
        apr.preferred_time,
        apr.preferred_location,
        apr.available_days,
        apr.available_times,
        apr.appointment_reason,
        apr.request_status,
        apr.assigned_doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS assigned_doctor_name,
        apr.assigned_date,
        apr.assigned_time,
        apr.receptionist_notes,
        apr.created_at
      FROM appointment_preference_requests apr
      JOIN patients p ON p.patient_id = apr.patient_id
      LEFT JOIN doctors d ON d.doctor_id = apr.assigned_doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      WHERE apr.preference_request_id = ?`,
      [preferenceRequestId],
      (err, results) => {
        if (err) {
          console.error('Error fetching appointment preference request:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!results.length) {
          return sendJSON(res, 404, { error: 'Appointment preference request not found' });
        }
        sendJSON(res, 200, results[0]);
      }
    );
  }

  function normalizeTimeValue(value) {
    const raw = String(value || '').trim();
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    return '';
  }

  function addMinutesToTime(timeValue, minutesToAdd) {
    const [hour, minute, second] = String(timeValue).split(':').map((p) => Number(p || 0));
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
    if (!rows?.length) throw new Error(`Status ${statusName} not found`);
    return Number(rows[0].status_id);
  }

  function assignAppointmentPreferenceRequest(req, preferenceRequestId, data, res) {
    const assignedDoctorId = Number(data?.assignedDoctorId);
    const assignedDate = String(data?.assignedDate || '').trim();
    const assignedTime = String(data?.assignedTime || '').trim();
    const receptionistNotes = data?.receptionistNotes ? String(data.receptionistNotes) : null;
    const receptionistUsernameInput = String(data?.receptionistUsername || '').trim();
    const receptionistStaffId = Number(data?.receptionistStaffId || 0);

    if (!Number.isInteger(assignedDoctorId) || assignedDoctorId <= 0) {
      return sendJSON(res, 400, { error: 'A valid assignedDoctorId is required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(assignedDate)) {
      return sendJSON(res, 400, { error: 'assignedDate must use YYYY-MM-DD format' });
    }

    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(assignedTime)) {
      return sendJSON(res, 400, { error: 'assignedTime must use HH:MM or HH:MM:SS format' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for assign:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          let receptionistActor = receptionistUsernameInput;
          if (!receptionistActor && Number.isInteger(receptionistStaffId) && receptionistStaffId > 0) {
            const [staffUserRows] = await conn.promise().query(
              `SELECT u.user_username
               FROM staff st
               JOIN users u ON u.user_id = st.user_id
               WHERE st.staff_id = ?
               LIMIT 1`,
              [receptionistStaffId]
            );
            if (staffUserRows?.length) {
              receptionistActor = String(staffUserRows[0].user_username || '').trim();
            }
          }
          if (!receptionistActor) {
            receptionistActor = 'RECEPTIONIST';
          }

          const [prefRows] = await conn.promise().query(
            `SELECT patient_id, preferred_location FROM appointment_preference_requests
             WHERE preference_request_id = ? AND request_status <> 'CANCELLED'
             LIMIT 1 FOR UPDATE`,
            [preferenceRequestId]
          );

          if (!prefRows?.length) {
            conn.release();
            return sendJSON(res, 404, { error: 'Appointment preference request not found' });
          }

          const patientId = Number(prefRows[0].patient_id);
          const normalizedTime = normalizeTimeValue(assignedTime);
          const appointmentEndTime = addMinutesToTime(normalizedTime, 30);
          const statusId = await getAppointmentStatusId(conn, 'SCHEDULED');

          const [slotRows] = await conn.promise().query(
            `SELECT slot_id, current_bookings, max_patients, is_available
             FROM appointment_slots
             WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ?
             LIMIT 1 FOR UPDATE`,
            [assignedDoctorId, assignedDate, normalizedTime]
          );

          let slotId;
          if (slotRows?.length) {
            slotId = Number(slotRows[0].slot_id);
          } else {
            const [slotInsert] = await conn.promise().query(
              `INSERT INTO appointment_slots (
                doctor_id, location_id, slot_date, slot_start_time, slot_end_time,
                duration_minutes, is_available, max_patients, current_bookings,
                slot_type, created_by, updated_by
                ) VALUES (?, NULL, ?, ?, ?, 30, TRUE, 1, 0, 'REGULAR', ?, ?)`,
                [assignedDoctorId, assignedDate, normalizedTime, appointmentEndTime, receptionistActor, receptionistActor]
            );
            slotId = Number(slotInsert.insertId);
          }

          const [appointmentInsert] = await conn.promise().query(
            `INSERT INTO appointments (
              slot_id, location_id, patient_id, doctor_id,
              appointment_time, appointment_date, status_id,
              notes, created_by, updated_by
            ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [slotId, patientId, assignedDoctorId, normalizedTime, assignedDate, statusId, receptionistNotes, receptionistActor, receptionistActor]
          );

          await conn.promise().query(
            `UPDATE appointment_preference_requests
             SET assigned_doctor_id = ?, assigned_date = ?, assigned_time = ?,
                 request_status = 'ASSIGNED', receptionist_notes = ?, updated_by = ?
             WHERE preference_request_id = ?`,
            [assignedDoctorId, assignedDate, normalizedTime, receptionistNotes, receptionistActor, preferenceRequestId]
          );

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing assign appointment:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, {
              message: 'Appointment assigned and scheduled successfully',
              preferenceRequestId,
              appointmentId: Number(appointmentInsert.insertId)
            });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            if (error.message.includes('required') || error.message.includes('format') || error.message.includes('booked')) {
              return sendJSON(res, 400, { error: error.message });
            }
            console.error('Error assigning appointment:', error);
            return sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  return {
    getPreferredAppointmentAvailability,
    getAppointmentPreferenceRequests,
    getAppointmentPreferenceRequestById,
    assignAppointmentPreferenceRequest
  };
}

module.exports = {
  createAppointmentPreferenceHandlers
};
