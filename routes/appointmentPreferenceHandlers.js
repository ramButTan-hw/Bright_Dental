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
    const doctorIdParam = Number(parsedUrl.query.doctorId) || 0;
    const hasDoctorFilter = doctorIdParam > 0;

    const locationFilterSql = hasLocationFilter
      ? ' AND LOWER(TRIM(preferred_location)) = ?'
      : '';

    const queryParams = [days];
    if (hasLocationFilter) {
      queryParams.push(preferredLocation);
    }

    // Fetch both preference requests AND actual booked appointment slots
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
      (err, prefResults) => {
        if (err) {
          console.error('Error fetching preferred availability:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        // Query actual appointment slots
        const slotSql = `SELECT
            s.slot_date, s.slot_start_time, s.current_bookings, s.max_patients, s.is_available
          FROM appointment_slots s
          WHERE s.slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)${hasDoctorFilter ? ' AND s.doctor_id = ?' : ''}`;
        const slotParams = hasDoctorFilter ? [days, doctorIdParam] : [days];

        // Query approved time-off from BOTH doctor_time_off and staff_time_off_requests
        const timeOffSql = hasDoctorFilter
          ? `SELECT start_datetime, end_datetime FROM (
               SELECT start_datetime, end_datetime FROM doctor_time_off
               WHERE doctor_id = ? AND is_approved = TRUE
                 AND end_datetime >= CURDATE()
                 AND start_datetime <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
               UNION ALL
               SELECT str.start_datetime, str.end_datetime FROM staff_time_off_requests str
               JOIN doctors d ON d.staff_id = str.staff_id
               WHERE d.doctor_id = ? AND str.is_approved = TRUE
                 AND str.end_datetime >= CURDATE()
                 AND str.start_datetime <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
             ) AS combined_time_off`
          : null;
        const timeOffParams = hasDoctorFilter ? [doctorIdParam, days, doctorIdParam, days] : [];

        pool.query(slotSql, slotParams, (slotErr, slotResults) => {
          if (slotErr) {
            console.error('Error fetching slot availability:', slotErr);
            return sendJSON(res, 500, { error: 'Database error' });
          }

          const processResults = (timeOffResults) => {
            // Helper: mysql2 returns DATE as JS Date objects — normalise to YYYY-MM-DD
            const toDateKey = (val) => {
              if (val instanceof Date) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              }
              return String(val).slice(0, 10);
            };

            // Build map of preference request counts
            const usageByDate = new Map();
            (prefResults || []).forEach((row) => {
              const dateKey = toDateKey(row.preferred_date);
              const timeKey = String(row.preferred_time).slice(0, 8);
              if (!usageByDate.has(dateKey)) {
                usageByDate.set(dateKey, new Map());
              }
              usageByDate.get(dateKey).set(timeKey, Number(row.requests_count) || 0);
            });

            // Build map of actual slot bookings
            const slotsByDate = new Map();
            (slotResults || []).forEach((row) => {
              const dateKey = toDateKey(row.slot_date);
              const timeKey = String(row.slot_start_time).slice(0, 5);
              if (!slotsByDate.has(dateKey)) {
                slotsByDate.set(dateKey, new Map());
              }
              slotsByDate.get(dateKey).set(timeKey, {
                currentBookings: Number(row.current_bookings) || 0,
                maxPatients: Number(row.max_patients) || 1,
                isAvailable: Boolean(row.is_available)
              });
            });

            // Build list of time-off intervals (use ms timestamps for reliable comparison)
            const toMs = (dt) => {
              // mysql2 returns DATETIME as JS Date objects
              if (dt instanceof Date) return dt.getTime();
              const s = String(dt);
              const cleaned = s.replace(' ', 'T').replace(/\.000Z$/, '');
              const parts = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
              if (!parts) return new Date(s).getTime();
              return Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6]);
            };

            const timeOffIntervals = (timeOffResults || []).map((row) => ({
              start: toMs(row.start_datetime),
              end: toMs(row.end_datetime)
            }));

            const isOnTimeOff = (dateKey, hourStr) => {
              if (timeOffIntervals.length === 0) return false;
              const hour = parseInt(hourStr, 10);
              // Use local time to match how mysql2 returns DATETIME values
              const slotStart = new Date(+dateKey.slice(0, 4), +dateKey.slice(5, 7) - 1, +dateKey.slice(8, 10), hour, 0, 0);
              const slotStartMs = slotStart.getTime();
              const slotEndMs = slotStartMs + 60 * 60 * 1000;
              return timeOffIntervals.some((interval) => slotStartMs < interval.end && slotEndMs > interval.start);
            };

            const availability = [];
            const now = new Date();
            const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

            for (let offset = 0; offset <= days; offset += 1) {
              const date = new Date(todayUtc.getTime() + (offset * 24 * 60 * 60 * 1000));
              const dateKey = date.toISOString().slice(0, 10);
              const timeCounts = usageByDate.get(dateKey) || new Map();
              const slotData = slotsByDate.get(dateKey) || new Map();

              const timeOptions = preferredTimeOptions.map((timeValue) => {
                const shortTime = timeValue.slice(0, 5);
                const prefBooked = Number(timeCounts.get(timeValue) || 0);
                const slot = slotData.get(shortTime);
                const capacity = slot ? slot.maxPatients : maxPatientsPerTime;
                const slotFull = slot ? (slot.currentBookings >= slot.maxPatients || !slot.isAvailable) : false;
                const doctorOff = isOnTimeOff(dateKey, shortTime);
                const booked = Math.max(prefBooked, slot ? slot.currentBookings : 0);
                const remaining = (slotFull || doctorOff) ? 0 : Math.max(capacity - booked, 0);
                return {
                  time: shortTime,
                  booked,
                  remaining,
                  isFull: slotFull || doctorOff || remaining <= 0,
                  timeOff: doctorOff
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
          };

          if (timeOffSql) {
            pool.query(timeOffSql, timeOffParams, (toErr, toResults) => {
              if (toErr) {
                console.error('Error fetching doctor time-off:', toErr);
                return sendJSON(res, 500, { error: 'Database error' });
              }
              processResults(toResults);
            });
          } else {
            processResults([]);
          }
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

          // Check if doctor has approved time off during this slot (both tables)
          const [timeOffRows] = await conn.promise().query(
            `SELECT 1 FROM (
               SELECT start_datetime, end_datetime FROM doctor_time_off
               WHERE doctor_id = ? AND is_approved = TRUE
                 AND start_datetime <= ? AND end_datetime > ?
               UNION ALL
               SELECT str.start_datetime, str.end_datetime FROM staff_time_off_requests str
               JOIN doctors d ON d.staff_id = str.staff_id
               WHERE d.doctor_id = ? AND str.is_approved = TRUE
                 AND str.start_datetime <= ? AND str.end_datetime > ?
             ) AS combined LIMIT 1`,
            [assignedDoctorId, `${assignedDate} ${normalizedTime}`, `${assignedDate} ${normalizedTime}`,
             assignedDoctorId, `${assignedDate} ${normalizedTime}`, `${assignedDate} ${normalizedTime}`]
          );
          if (timeOffRows?.length) {
            throw new Error('This doctor has approved time off during the selected date and time. Please choose a different time or doctor.');
          }

          const [slotRows] = await conn.promise().query(
            `SELECT slot_id, current_bookings, max_patients, is_available
             FROM appointment_slots
             WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ?
             LIMIT 1 FOR UPDATE`,
            [assignedDoctorId, assignedDate, normalizedTime]
          );

          let slotId;
          if (slotRows?.length) {
            const existingSlot = slotRows[0];
            if (existingSlot.current_bookings >= existingSlot.max_patients || !existingSlot.is_available) {
              throw new Error('This time slot is already full. Please choose a different time.');
            }
            slotId = Number(existingSlot.slot_id);
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

  function revertAppointmentPreferenceRequest(req, preferenceRequestId, data, res) {
    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for revert:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          // Look up the assigned preference request
          const [prefRows] = await conn.promise().query(
            `SELECT patient_id, assigned_doctor_id, assigned_date, assigned_time
             FROM appointment_preference_requests
             WHERE preference_request_id = ? AND request_status = 'ASSIGNED'
             LIMIT 1 FOR UPDATE`,
            [preferenceRequestId]
          );

          if (!prefRows?.length) {
            conn.release();
            return sendJSON(res, 404, { error: 'Assigned appointment request not found' });
          }

          const pref = prefRows[0];

          // Cancel the linked appointment
          const [cancelledStatus] = await conn.promise().query(
            `SELECT status_id FROM appointment_statuses WHERE status_name = 'CANCELLED' LIMIT 1`
          );
          if (cancelledStatus?.length) {
            await conn.promise().query(
              `UPDATE appointments
               SET status_id = ?, updated_by = 'RECEPTIONIST_REVERT'
               WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND appointment_time = ?
                 AND status_id IN (SELECT status_id FROM appointment_statuses WHERE status_name IN ('SCHEDULED', 'CONFIRMED'))`,
              [cancelledStatus[0].status_id, pref.patient_id, pref.assigned_doctor_id, pref.assigned_date, pref.assigned_time]
            );
          }

          // Revert the preference request back to PREFERRED_PENDING
          await conn.promise().query(
            `UPDATE appointment_preference_requests
             SET request_status = 'PREFERRED_PENDING',
                 assigned_doctor_id = NULL, assigned_date = NULL, assigned_time = NULL,
                 receptionist_notes = NULL, updated_by = 'RECEPTIONIST_REVERT'
             WHERE preference_request_id = ?`,
            [preferenceRequestId]
          );

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing revert:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Appointment reverted to pending request' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            console.error('Error reverting appointment:', error);
            sendJSON(res, 500, { error: 'Database error' });
          });
        }
      });
    });
  }

  return {
    getPreferredAppointmentAvailability,
    getAppointmentPreferenceRequests,
    getAppointmentPreferenceRequestById,
    assignAppointmentPreferenceRequest,
    revertAppointmentPreferenceRequest
  };
}

module.exports = {
  createAppointmentPreferenceHandlers
};
