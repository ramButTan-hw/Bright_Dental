function createAdminHandlers(deps) {
  const { pool, sendJSON, url } = deps;

  function parseAdminDateParam(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const providedDate = String(parsedUrl.query.date || '').trim();
    if (!providedDate) {
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return localDate.toISOString().slice(0, 10);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(providedDate)) {
      sendJSON(res, 400, { error: 'date must use YYYY-MM-DD format' });
      return null;
    }

    return providedDate;
  }

  function getAdminDashboardSummary(req, res) {
    const date = parseAdminDateParam(req, res);
    if (!date) return;

    (async () => {
      const db = pool.promise();

      const [[revenueToday]] = await db.query(
        'SELECT COALESCE(SUM(payment_amount), 0) AS value FROM payments WHERE DATE(payment_date) = ?',
        [date]
      );
      const [[revenueAllTime]] = await db.query('SELECT COALESCE(SUM(payment_amount), 0) AS value FROM payments');
      const [[scheduledCount]] = await db.query(
        `SELECT COUNT(*) AS value
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         WHERE a.appointment_date = ?
           AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED')`,
        [date]
      );
      const [[pendingPreferenceCount]] = await db.query(
        `SELECT COUNT(*) AS value
         FROM appointment_preference_requests
         WHERE request_status = 'PREFERRED_PENDING'`
      );
      const [[totalPatientsToday]] = await db.query(
        `SELECT COUNT(DISTINCT a.patient_id) AS value
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         WHERE a.appointment_date = ?
           AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED')`,
        [date]
      );
      const [[doctorCount]] = await db.query('SELECT COUNT(*) AS value FROM doctors');

      const notifications = [];
      if (Number(pendingPreferenceCount?.value || 0) > 0) {
        notifications.push({
          level: 'warning',
          message: `${pendingPreferenceCount.value} appointment requests are waiting to be scheduled.`
        });
      }

      sendJSON(res, 200, {
        date,
        metrics: {
          clinicRevenueToday: Number(revenueToday?.value || 0),
          clinicRevenueAllTime: Number(revenueAllTime?.value || 0),
          scheduledToday: Number(scheduledCount?.value || 0),
          waitingToSchedule: Number(pendingPreferenceCount?.value || 0),
          patientsScheduledToday: Number(totalPatientsToday?.value || 0),
          doctorCount: Number(doctorCount?.value || 0)
        },
        notifications
      });
    })().catch((err) => {
      console.error('Error fetching admin dashboard summary:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  function getAdminAppointmentsQueue(req, res) {
    const date = parseAdminDateParam(req, res);
    if (!date) return;

    (async () => {
      const db = pool.promise();
      const [scheduledAppointments] = await db.query(
        `SELECT
          a.appointment_id,
          a.appointment_date,
          a.appointment_time,
          s.status_name,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
        FROM appointments a
        JOIN appointment_statuses s ON s.status_id = a.status_id
        JOIN patients p ON p.patient_id = a.patient_id
        LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
        LEFT JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN locations l ON l.location_id = a.location_id
        WHERE a.appointment_date = ?
          AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED')
        ORDER BY a.appointment_time ASC`,
        [date]
      );
      const [pendingRequests] = await db.query(
        `SELECT
          apr.preference_request_id,
          apr.preferred_date,
          apr.preferred_time,
          apr.preferred_location,
          apr.available_days,
          apr.available_times,
          apr.appointment_reason,
          apr.created_at,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name
        FROM appointment_preference_requests apr
        JOIN patients p ON p.patient_id = apr.patient_id
        WHERE apr.request_status = 'PREFERRED_PENDING'
        ORDER BY apr.created_at DESC
        LIMIT 100`
      );

      sendJSON(res, 200, {
        date,
        scheduledAppointments: scheduledAppointments || [],
        pendingRequests: pendingRequests || [],
        notificationCount: Number((pendingRequests || []).length)
      });
    })().catch((err) => {
      console.error('Error fetching admin appointment queue:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  function getAdminScheduledPatients(req, res) {
    const date = parseAdminDateParam(req, res);
    if (!date) return;

    pool.query(
      `SELECT
        p.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_phone,
        p.p_email,
        a.appointment_id,
        a.appointment_time,
        s.status_name,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM appointments a
      JOIN appointment_statuses s ON s.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      WHERE a.appointment_date = ?
        AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED')
      ORDER BY a.appointment_time ASC, p.p_last_name ASC`,
      [date],
      (err, rows) => {
        if (err) {
          console.error('Error fetching scheduled patients:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        sendJSON(res, 200, {
          date,
          totalPatients: Number((rows || []).length),
          patients: rows || []
        });
      }
    );
  }

  function getAdminPatientsReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const date = parseAdminDateParam(req, res);
    if (!date) return;

    const statusFilter = String(parsedUrl.query.status || '').trim().toUpperCase();
    const hasStatusFilter = Boolean(statusFilter);
    const queryParams = [date];

    let statusWhere = '';
    if (hasStatusFilter) {
      statusWhere = ' AND s.status_name = ?';
      queryParams.push(statusFilter);
    }

    pool.query(
      `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        s.status_name,
        p.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.p_phone,
        p.p_email,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
        COALESCE(i.patient_amount, 0) AS expected_patient_amount,
        COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS paid_amount
      FROM appointments a
      JOIN appointment_statuses s ON s.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
      WHERE a.appointment_date = ?${statusWhere}
      ORDER BY a.appointment_time ASC, p.p_last_name ASC`,
      queryParams,
      (err, rows) => {
        if (err) {
          console.error('Error generating admin patient report:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        const reportRows = rows || [];
        const uniquePatients = new Set(reportRows.map((row) => row.patient_id));
        const summary = {
          totalAppointments: reportRows.length,
          totalPatients: uniquePatients.size,
          totalExpectedPatientAmount: reportRows.reduce((sum, row) => sum + Number(row.expected_patient_amount || 0), 0),
          totalPaidAmount: reportRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0)
        };

        sendJSON(res, 200, {
          date,
          status: hasStatusFilter ? statusFilter : 'ALL',
          generatedAt: new Date().toISOString(),
          summary,
          rows: reportRows
        });
      }
    );
  }

  function getAdminDoctors(req, res) {
    pool.query(
      `SELECT
        d.doctor_id,
        d.npi,
        st.staff_id,
        st.first_name,
        st.last_name,
        st.date_of_birth,
        st.gender,
        st.phone_number,
        u.user_username,
        u.user_role,
        sl.location_id,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM doctors d
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      ORDER BY st.last_name ASC, st.first_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching admin doctors:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function normalizeSsn(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
    if (!digits) return '';
    if (digits.length !== 9) return '';
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function normalizeUsPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 20);
    if (!digits) return '';
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  function createAdminDoctor(req, data, res) {
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const dob = String(data?.dob || '').trim();
    const normalizedSsn = normalizeSsn(data?.ssn);
    const normalizedPhone = normalizeUsPhone(data?.phone);
    const locationId = Number(data?.locationId || 0);
    const gender = Number(data?.gender || 0);
    const username = String(data?.username || '').trim();
    const password = String(data?.password || '').trim();
    const email = String(data?.email || '').trim();

    if (!firstName || !lastName || !dob) {
      return sendJSON(res, 400, { error: 'firstName, lastName, and dob are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return sendJSON(res, 400, { error: 'dob must use YYYY-MM-DD format' });
    }

    if (!username || !password || !normalizedPhone) {
      return sendJSON(res, 400, { error: 'username, password, and phone are required' });
    }

    if (password.length < 4) {
      return sendJSON(res, 400, { error: 'Password must be at least 4 characters' });
    }

    pool.getConnection((err, conn) => {
      if (err) {
        console.error('Error opening db connection for create doctor:', err);
        return sendJSON(res, 500, { error: 'Database connection failed' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Transaction failed' });
        }

        conn.query(
          `INSERT INTO users (user_username, password_hash, user_email, user_phone, user_role)
           VALUES (?, SHA2(?, 256), ?, ?, 'DOCTOR')`,
          [username, password, email || `${username}@clinic.local`, normalizedPhone],
          (userErr, userResult) => {
            if (userErr) {
              return conn.rollback(() => {
                conn.release();
                if (userErr.code === 'ER_DUP_ENTRY') {
                  return sendJSON(res, 409, { error: 'Username, email, or phone already exists' });
                }
                console.error('Error creating user for doctor:', userErr);
                sendJSON(res, 500, { error: 'Failed to create user account' });
              });
            }

            const userId = userResult.insertId;

            conn.query(
              `INSERT INTO staff (first_name, last_name, date_of_birth, gender, phone_number, ssn, user_id, created_by, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
              [firstName, lastName, dob, Number.isInteger(gender) && gender > 0 ? gender : null, normalizedPhone, normalizedSsn || null, userId],
              (staffErr, staffResult) => {
                if (staffErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('Error creating staff row for doctor:', staffErr);
                    sendJSON(res, 500, { error: 'Failed to create staff record' });
                  });
                }

                const staffId = staffResult.insertId;
                const pendingNpi = `PENDING-${staffId}`;

                conn.query(
                  `INSERT INTO doctors (npi, staff_id, created_by, updated_by)
                   VALUES (?, ?, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
                  [pendingNpi, staffId],
                  (doctorErr, doctorResult) => {
                    if (doctorErr) {
                      return conn.rollback(() => {
                        conn.release();
                        if (doctorErr.code === 'ER_DUP_ENTRY') {
                          return sendJSON(res, 409, { error: 'Unable to assign temporary NPI' });
                        }
                        console.error('Error creating doctor row:', doctorErr);
                        sendJSON(res, 500, { error: 'Failed to create doctor record' });
                      });
                    }

                    const finishCommit = () => {
                      conn.commit((commitErr) => {
                        conn.release();
                        if (commitErr) {
                          return sendJSON(res, 500, { error: 'Failed to commit doctor creation' });
                        }

                        sendJSON(res, 201, {
                          message: 'Doctor created successfully',
                          doctorId: doctorResult.insertId,
                          staffId,
                          userId
                        });
                      });
                    };

                    if (Number.isInteger(locationId) && locationId > 0) {
                      conn.query(
                        `INSERT INTO staff_locations (staff_id, location_id)
                         VALUES (?, ?)
                         ON DUPLICATE KEY UPDATE location_id = VALUES(location_id)`,
                        [staffId, locationId],
                        (staffLocationErr) => {
                          if (staffLocationErr) {
                            return conn.rollback(() => {
                              conn.release();
                              console.error('Error assigning doctor location:', staffLocationErr);
                              sendJSON(res, 500, { error: 'Failed to assign doctor location' });
                            });
                          }
                          finishCommit();
                        }
                      );
                    } else {
                      finishCommit();
                    }
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  function getAdminLocations(req, res) {
    pool.query(
      `SELECT
        location_id,
        location_city,
        location_state,
        loc_street_no,
        loc_street_name,
        loc_zip_code,
        CONCAT(loc_street_no, ' ', loc_street_name, ', ', location_city, ', ', location_state, ' ', loc_zip_code) AS full_address
      FROM locations
      ORDER BY location_state ASC, location_city ASC, loc_street_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching admin locations:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function createAdminLocation(req, data, res) {
    const city = String(data?.city || '').trim();
    const state = String(data?.state || '').trim().toUpperCase();
    const streetNo = String(data?.streetNo || '').trim();
    const streetName = String(data?.streetName || '').trim();
    const zipCode = String(data?.zipCode || '').trim();

    if (!city || !state || !streetNo || !streetName || !zipCode) {
      return sendJSON(res, 400, { error: 'city, state, streetNo, streetName, and zipCode are required' });
    }

    pool.query(
      `INSERT INTO locations (
        location_city,
        location_state,
        loc_street_no,
        loc_street_name,
        loc_zip_code,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
      [city, state, streetNo, streetName, zipCode],
      (err, result) => {
        if (err) {
          console.error('Error creating location:', err);
          return sendJSON(res, 500, { error: 'Failed to create location' });
        }

        sendJSON(res, 201, {
          message: 'Location created successfully',
          locationId: result.insertId
        });
      }
    );
  }

  function getAdminDoctorTimeOff(req, res) {
    pool.query(
      `SELECT
        dto.time_off_id,
        dto.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        dto.location_id,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
        dto.start_datetime,
        dto.end_datetime,
        dto.reason,
        dto.is_approved
      FROM doctor_time_off dto
      JOIN doctors d ON d.doctor_id = dto.doctor_id
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = dto.location_id
      ORDER BY dto.start_datetime DESC
      LIMIT 200`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching doctor time off:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function createAdminDoctorTimeOff(req, data, res) {
    const doctorId = Number(data?.doctorId || 0);
    const locationId = Number(data?.locationId || 0);
    const startDateTime = String(data?.startDateTime || '').trim();
    const endDateTime = String(data?.endDateTime || '').trim();
    const reason = String(data?.reason || '').trim();

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return sendJSON(res, 400, { error: 'A valid doctorId is required' });
    }

    if (!startDateTime || !endDateTime) {
      return sendJSON(res, 400, { error: 'startDateTime and endDateTime are required' });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendJSON(res, 400, { error: 'Invalid time-off range' });
    }

    pool.query(
      `INSERT INTO doctor_time_off (
        doctor_id,
        location_id,
        start_datetime,
        end_datetime,
        reason,
        is_approved,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, FALSE, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
      [doctorId, Number.isInteger(locationId) && locationId > 0 ? locationId : null, startDateTime, endDateTime, reason || null],
      (err, result) => {
        if (err) {
          console.error('Error creating doctor time off:', err);
          return sendJSON(res, 500, { error: 'Failed to create doctor off-day entry' });
        }

        sendJSON(res, 201, {
          message: 'Doctor off-day added successfully',
          timeOffId: result.insertId
        });
      }
    );
  }

  function approveAdminDoctorTimeOff(req, timeOffId, res) {
    pool.query(
      `UPDATE doctor_time_off SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE time_off_id = ?`,
      [timeOffId],
      (err, result) => {
        if (err) {
          console.error('Error approving time off:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (result.affectedRows === 0) {
          return sendJSON(res, 404, { error: 'Time-off entry not found' });
        }
        sendJSON(res, 200, { message: 'Time-off approved' });
      }
    );
  }

  function denyAdminDoctorTimeOff(req, timeOffId, res) {
    pool.query(
      `DELETE FROM doctor_time_off WHERE time_off_id = ? AND is_approved = FALSE`,
      [timeOffId],
      (err, result) => {
        if (err) {
          console.error('Error denying time off:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (result.affectedRows === 0) {
          return sendJSON(res, 404, { error: 'Time-off entry not found or already approved' });
        }
        sendJSON(res, 200, { message: 'Time-off denied and removed' });
      }
    );
  }

  function createStaffTimeOffRequest(req, data, res) {
    const staffId = Number(data?.staffId || 0);
    const locationId = Number(data?.locationId || 0);
    const startDateTime = String(data?.startDateTime || '').trim();
    const endDateTime = String(data?.endDateTime || '').trim();
    const reason = String(data?.reason || '').trim();

    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'A valid staffId is required' });
    }

    if (!startDateTime || !endDateTime) {
      return sendJSON(res, 400, { error: 'startDateTime and endDateTime are required' });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return sendJSON(res, 400, { error: 'Invalid time-off range' });
    }

    pool.query(
      `INSERT INTO staff_time_off_requests (
        staff_id,
        location_id,
        start_datetime,
        end_datetime,
        reason,
        is_approved,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, FALSE, 'STAFF_PORTAL', 'STAFF_PORTAL')`,
      [staffId, Number.isInteger(locationId) && locationId > 0 ? locationId : null, startDateTime, endDateTime, reason || null],
      (err, result) => {
        if (err) {
          console.error('Error creating staff time-off request:', err);
          return sendJSON(res, 500, { error: 'Failed to create staff off-day request' });
        }

        sendJSON(res, 201, {
          message: 'Staff off-day request submitted successfully',
          requestId: result.insertId
        });
      }
    );
  }

  function getAdminStaffTimeOffRequests(req, res) {
    pool.query(
      `SELECT
        unified.request_id,
        unified.request_source,
        unified.staff_id,
        unified.requester_name,
        unified.requester_role,
        unified.location_id,
        unified.location_address,
        unified.start_datetime,
        unified.end_datetime,
        unified.reason,
        unified.is_approved
      FROM (
        SELECT
          dto.time_off_id AS request_id,
          'DOCTOR_TIME_OFF' AS request_source,
          st.staff_id,
          CONCAT(st.first_name, ' ', st.last_name) AS requester_name,
          'DOCTOR' AS requester_role,
          dto.location_id,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
          dto.start_datetime,
          dto.end_datetime,
          dto.reason,
          dto.is_approved
        FROM doctor_time_off dto
        JOIN doctors d ON d.doctor_id = dto.doctor_id
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN locations l ON l.location_id = dto.location_id

        UNION ALL

        SELECT
          str.request_id,
          'STAFF_TIME_OFF' AS request_source,
          st.staff_id,
          CONCAT(st.first_name, ' ', st.last_name) AS requester_name,
          u.user_role AS requester_role,
          str.location_id,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
          str.start_datetime,
          str.end_datetime,
          str.reason,
          str.is_approved
        FROM staff_time_off_requests str
        JOIN staff st ON st.staff_id = str.staff_id
        LEFT JOIN users u ON u.user_id = st.user_id
        LEFT JOIN locations l ON l.location_id = str.location_id
      ) AS unified
      ORDER BY unified.start_datetime DESC
      LIMIT 300`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff time-off requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function approveAdminStaffTimeOffRequest(req, requestId, source, res) {
    const isDoctorSource = source === 'DOCTOR_TIME_OFF';
    const sql = isDoctorSource
      ? `UPDATE doctor_time_off SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE time_off_id = ?`
      : `UPDATE staff_time_off_requests SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE request_id = ?`;

    pool.query(sql, [requestId], (err, result) => {
      if (err) {
        console.error('Error approving time off request:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (result.affectedRows === 0) {
        return sendJSON(res, 404, { error: 'Time-off request not found' });
      }
      sendJSON(res, 200, { message: 'Time-off request approved' });
    });
  }

  function denyAdminStaffTimeOffRequest(req, requestId, source, res) {
    const isDoctorSource = source === 'DOCTOR_TIME_OFF';
    const sql = isDoctorSource
      ? `DELETE FROM doctor_time_off WHERE time_off_id = ? AND is_approved = FALSE`
      : `DELETE FROM staff_time_off_requests WHERE request_id = ? AND is_approved = FALSE`;

    pool.query(sql, [requestId], (err, result) => {
      if (err) {
        console.error('Error denying time off request:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (result.affectedRows === 0) {
        return sendJSON(res, 404, { error: 'Time-off request not found or already approved' });
      }
      sendJSON(res, 200, { message: 'Time-off request denied and removed' });
    });
  }

  function createAdminStaffMember(req, data, role, res) {
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const dob = String(data?.dob || '').trim();
    const normalizedSsn = normalizeSsn(data?.ssn);
    const normalizedPhone = normalizeUsPhone(data?.phone);
    const gender = Number(data?.gender || 0);
    const locationId = Number(data?.locationId || 0);
    const username = String(data?.username || '').trim();
    const password = String(data?.password || '').trim();
    const email = String(data?.email || '').trim();

    if (!firstName || !lastName || !dob) {
      return sendJSON(res, 400, { error: 'firstName, lastName, and dob are required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return sendJSON(res, 400, { error: 'dob must use YYYY-MM-DD format' });
    }
    if (!username || !password || !normalizedPhone) {
      return sendJSON(res, 400, { error: 'username, password, and phone are required' });
    }
    if (password.length < 4) {
      return sendJSON(res, 400, { error: 'Password must be at least 4 characters' });
    }

    pool.getConnection((err, conn) => {
      if (err) {
        console.error('Error opening db connection for create staff member:', err);
        return sendJSON(res, 500, { error: 'Database connection failed' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Transaction failed' });
        }

        conn.query(
          `INSERT INTO users (user_username, password_hash, user_email, user_phone, user_role)
           VALUES (?, SHA2(?, 256), ?, ?, ?)`,
          [username, password, email || `${username}@clinic.local`, normalizedPhone, role],
          (userErr, userResult) => {
            if (userErr) {
              return conn.rollback(() => {
                conn.release();
                if (userErr.code === 'ER_DUP_ENTRY') {
                  return sendJSON(res, 409, { error: 'Username, email, or phone already exists' });
                }
                console.error('Error creating user for staff member:', userErr);
                sendJSON(res, 500, { error: 'Failed to create user account' });
              });
            }

            const userId = userResult.insertId;
            conn.query(
              `INSERT INTO staff (first_name, last_name, date_of_birth, gender, phone_number, ssn, user_id, created_by, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
              [firstName, lastName, dob, Number.isInteger(gender) && gender > 0 ? gender : null, normalizedPhone, normalizedSsn || null, userId],
              (staffErr, staffResult) => {
                if (staffErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('Error creating staff row:', staffErr);
                    sendJSON(res, 500, { error: 'Failed to create staff record' });
                  });
                }

                const staffId = staffResult.insertId;

                const finishCommit = () => {
                  conn.commit((commitErr) => {
                    conn.release();
                    if (commitErr) {
                      return sendJSON(res, 500, { error: 'Failed to commit' });
                    }
                    sendJSON(res, 201, {
                      message: `${role.charAt(0) + role.slice(1).toLowerCase()} created successfully`,
                      staffId,
                      userId
                    });
                  });
                };

                if (Number.isInteger(locationId) && locationId > 0) {
                  conn.query(
                    `INSERT INTO staff_locations (staff_id, location_id) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE location_id = VALUES(location_id)`,
                    [staffId, locationId],
                    (locErr) => {
                      if (locErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error('Error assigning staff location:', locErr);
                          sendJSON(res, 500, { error: 'Failed to assign location' });
                        });
                      }
                      finishCommit();
                    }
                  );
                } else {
                  finishCommit();
                }
              }
            );
          }
        );
      });
    });
  }

  function getAdminStaffMembersByRole(req, role, res) {
    pool.query(
      `SELECT
        st.staff_id,
        st.first_name,
        st.last_name,
        st.date_of_birth,
        st.gender,
        st.phone_number,
        u.user_username,
        u.user_email,
        u.user_role,
        sl.location_id,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      WHERE u.user_role = ?
        AND COALESCE(u.is_deleted, 0) = 0
      ORDER BY st.last_name ASC, st.first_name ASC
      LIMIT 200`,
      [role],
      (err, rows) => {
        if (err) {
          console.error(`Error fetching staff by role ${role}:`, err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getAdminStaffReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const dateFrom = String(parsedUrl.query.dateFrom || '').trim();
    const dateTo = String(parsedUrl.query.dateTo || '').trim();

    const now = new Date();
    const resolvedFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
      ? dateFrom
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const resolvedTo = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
      ? dateTo
      : now.toISOString().slice(0, 10);

    (async () => {
      const db = pool.promise();

      const [workload] = await db.query(
        `SELECT
          d.doctor_id,
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          st.phone_number,
          COUNT(a.appointment_id) AS total_appointments,
          SUM(CASE WHEN s.status_name = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN s.status_name IN ('SCHEDULED','CONFIRMED','RESCHEDULED') THEN 1 ELSE 0 END) AS upcoming,
          SUM(CASE WHEN s.status_name = 'CANCELED' THEN 1 ELSE 0 END) AS canceled,
          SUM(CASE WHEN s.status_name = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show
        FROM doctors d
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
          AND a.appointment_date BETWEEN ? AND ?
        LEFT JOIN appointment_statuses s ON s.status_id = a.status_id
        GROUP BY d.doctor_id, st.first_name, st.last_name, st.phone_number
        ORDER BY total_appointments DESC`,
        [resolvedFrom, resolvedTo]
      );

      const [schedule] = await db.query(
        `SELECT
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          a.appointment_date,
          a.appointment_time,
          s.status_name,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.p_phone AS patient_phone,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state) AS location_address
        FROM appointments a
        JOIN appointment_statuses s ON s.status_id = a.status_id
        JOIN patients p ON p.patient_id = a.patient_id
        JOIN doctors d ON d.doctor_id = a.doctor_id
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN locations l ON l.location_id = a.location_id
        WHERE a.appointment_date BETWEEN ? AND ?
        ORDER BY a.appointment_date ASC, a.appointment_time ASC, st.last_name ASC`,
        [resolvedFrom, resolvedTo]
      );

      const [timeOff] = await db.query(
        `SELECT
          dto.time_off_id,
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          dto.start_datetime,
          dto.end_datetime,
          dto.reason,
          dto.is_approved,
          COALESCE(
            CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state),
            'All Locations'
          ) AS location_address
        FROM doctor_time_off dto
        JOIN doctors d ON d.doctor_id = dto.doctor_id
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN locations l ON l.location_id = dto.location_id
        ORDER BY dto.start_datetime DESC
        LIMIT 200`
      );

      sendJSON(res, 200, {
        dateFrom: resolvedFrom,
        dateTo: resolvedTo,
        generatedAt: new Date().toISOString(),
        workload: workload || [],
        schedule: schedule || [],
        timeOff: timeOff || []
      });
    })().catch((err) => {
      console.error('Error generating admin staff report:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  return {
    getAdminDashboardSummary,
    getAdminAppointmentsQueue,
    getAdminScheduledPatients,
    getAdminPatientsReport,
    getAdminStaffReport,
    getAdminDoctors,
    createAdminDoctor,
    getAdminLocations,
    createAdminLocation,
    getAdminDoctorTimeOff,
    getAdminStaffTimeOffRequests,
    createAdminDoctorTimeOff,
    approveAdminDoctorTimeOff,
    denyAdminDoctorTimeOff,
    createStaffTimeOffRequest,
    approveAdminStaffTimeOffRequest,
    denyAdminStaffTimeOffRequest,
    getAdminStaffMembersByRole,
    createAdminStaffMember
  };
}

module.exports = {
  createAdminHandlers
};
