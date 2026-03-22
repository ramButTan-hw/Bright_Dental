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
          COALESCE(
            CONCAT(rst.first_name, ' ', rst.last_name),
            NULLIF(TRIM(a.updated_by), ''),
            NULLIF(TRIM(a.created_by), ''),
            'Unassigned'
          ) AS receptionist_name,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
          i.payment_status,
          i.patient_amount AS invoice_patient_amount,
          ROUND(COALESCE(i.patient_amount, 0) - COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0), 2) AS amount_due
        FROM appointments a
        JOIN appointment_statuses s ON s.status_id = a.status_id
        JOIN patients p ON p.patient_id = a.patient_id
        LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
        LEFT JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN users ru ON ru.user_username = COALESCE(NULLIF(TRIM(a.updated_by), ''), NULLIF(TRIM(a.created_by), ''))
        LEFT JOIN staff rst ON rst.user_id = ru.user_id
        LEFT JOIN locations l ON l.location_id = a.location_id
        LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
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
        COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS paid_amount,
        i.payment_status
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

        // Financial follow-up: per-patient summary across ALL invoices
        pool.query(
          `SELECT
            p.patient_id,
            CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
            p.p_phone,
            p.p_email,
            COUNT(i.invoice_id) AS total_invoices,
            SUM(CASE WHEN i.payment_status = 'Unpaid' THEN 1 ELSE 0 END) AS unpaid_invoices,
            SUM(CASE WHEN i.payment_status = 'Partial' THEN 1 ELSE 0 END) AS partial_invoices,
            SUM(CASE WHEN i.payment_status = 'Paid' THEN 1 ELSE 0 END) AS paid_invoices,
            COALESCE(SUM(i.amount), 0) AS total_charged,
            COALESCE(SUM(i.insurance_covered_amount), 0) AS total_insurance_covered,
            COALESCE(SUM(i.patient_amount), 0) AS total_patient_responsibility,
            COALESCE(SUM((SELECT COALESCE(SUM(pay.payment_amount), 0) FROM payments pay WHERE pay.invoice_id = i.invoice_id)), 0) AS total_paid,
            COALESCE(SUM(i.patient_amount), 0) - COALESCE(SUM((SELECT COALESCE(SUM(pay.payment_amount), 0) FROM payments pay WHERE pay.invoice_id = i.invoice_id)), 0) AS total_outstanding
          FROM patients p
          JOIN appointments a ON a.patient_id = p.patient_id
          JOIN invoices i ON i.appointment_id = a.appointment_id
          GROUP BY p.patient_id, p.p_first_name, p.p_last_name, p.p_phone, p.p_email
          ORDER BY total_outstanding DESC, p.p_last_name ASC`,
          (finErr, finRows) => {
            if (finErr) {
              console.error('Error generating financial follow-up:', finErr);
              // Non-fatal: still return the date-based report
            }

            sendJSON(res, 200, {
              date,
              status: hasStatusFilter ? statusFilter : 'ALL',
              generatedAt: new Date().toISOString(),
              summary,
              rows: reportRows,
              financialFollowUp: finRows || []
            });
          }
        );
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
        GROUP_CONCAT(DISTINCT sl.location_id) AS location_id,
        GROUP_CONCAT(
          DISTINCT CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code)
          SEPARATOR ' | '
        ) AS location_address
      FROM doctors d
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      GROUP BY d.doctor_id, d.npi, st.staff_id, st.first_name, st.last_name,
               st.date_of_birth, st.gender, st.phone_number, u.user_username, u.user_role
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
    const npi = String(data?.npi || '').trim();

    if (!firstName || !lastName || !dob) {
      return sendJSON(res, 400, { error: 'firstName, lastName, and dob are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return sendJSON(res, 400, { error: 'dob must use YYYY-MM-DD format' });
    }

    if (!username || !password || !normalizedPhone) {
      return sendJSON(res, 400, { error: 'username, password, and phone are required' });
    }

    if (!/^\d{10}$/.test(npi)) {
      return sendJSON(res, 400, { error: 'npi is required and must be a 10-digit number' });
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return sendJSON(res, 400, { error: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
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
                conn.query(
                  `INSERT INTO doctors (npi, staff_id, created_by, updated_by)
                   VALUES (?, ?, 'ADMIN_PORTAL', 'ADMIN_PORTAL')`,
                  [npi, staffId],
                  (doctorErr, doctorResult) => {
                    if (doctorErr) {
                      return conn.rollback(() => {
                        conn.release();
                        if (doctorErr.code === 'ER_DUP_ENTRY') {
                          return sendJSON(res, 409, { error: 'NPI already exists' });
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
                          npi,
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

  function getStaffTimeOffRequestsByStaffId(req, res, staffId) {
    pool.query(
      `SELECT
        str.request_id,
        str.staff_id,
        str.location_id,
        COALESCE(
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code),
          'Any location'
        ) AS location_address,
        str.start_datetime,
        str.end_datetime,
        str.reason,
        str.is_approved,
        CASE
          WHEN str.is_approved = TRUE THEN 'APPROVED'
          ELSE 'PENDING'
        END AS request_status
      FROM staff_time_off_requests str
      LEFT JOIN locations l ON l.location_id = str.location_id
      WHERE str.staff_id = ?
      ORDER BY str.start_datetime DESC
      LIMIT 100`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching staff time-off requests by staff id:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
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
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return sendJSON(res, 400, { error: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
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
        GROUP_CONCAT(DISTINCT sl.location_id) AS location_id,
        GROUP_CONCAT(
          DISTINCT CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code)
          SEPARATOR ' | '
        ) AS location_address
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      WHERE u.user_role = ?
        AND COALESCE(u.is_deleted, 0) = 0
      GROUP BY st.staff_id, st.first_name, st.last_name, st.date_of_birth,
               st.gender, st.phone_number, u.user_username, u.user_email, u.user_role
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
          COALESCE(
            CONCAT(rst.first_name, ' ', rst.last_name),
            NULLIF(TRIM(a.updated_by), ''),
            NULLIF(TRIM(a.created_by), ''),
            'Unassigned'
          ) AS receptionist_name,
          CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state) AS location_address,
          inv.payment_status,
          ROUND(COALESCE(inv.patient_amount, 0) - COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = inv.invoice_id), 0), 2) AS amount_due
        FROM appointments a
        JOIN appointment_statuses s ON s.status_id = a.status_id
        JOIN patients p ON p.patient_id = a.patient_id
        JOIN doctors d ON d.doctor_id = a.doctor_id
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN users ru ON ru.user_username = COALESCE(NULLIF(TRIM(a.updated_by), ''), NULLIF(TRIM(a.created_by), ''))
        LEFT JOIN staff rst ON rst.user_id = ru.user_id
        LEFT JOIN locations l ON l.location_id = a.location_id
        LEFT JOIN invoices inv ON inv.appointment_id = a.appointment_id
        WHERE a.appointment_date BETWEEN ? AND ?
        ORDER BY a.appointment_date ASC, a.appointment_time ASC, st.last_name ASC`,
        [resolvedFrom, resolvedTo]
      );

      const [timeOff] = await db.query(
        `SELECT
          CONCAT(unified.request_source, '-', unified.request_id) AS request_key,
          unified.request_source,
          unified.requester_name,
          unified.requester_role,
          unified.start_datetime,
          unified.end_datetime,
          unified.reason,
          unified.is_approved,
          COALESCE(
            CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state),
            'All Locations'
          ) AS location_address
        FROM (
          SELECT
            dto.time_off_id AS request_id,
            'DOCTOR_TIME_OFF' AS request_source,
            CONCAT(st.first_name, ' ', st.last_name) AS requester_name,
            'DOCTOR' AS requester_role,
            dto.location_id,
            dto.start_datetime,
            dto.end_datetime,
            dto.reason,
            dto.is_approved
          FROM doctor_time_off dto
          JOIN doctors d ON d.doctor_id = dto.doctor_id
          JOIN staff st ON st.staff_id = d.staff_id

          UNION ALL

          SELECT
            str.request_id,
            'STAFF_TIME_OFF' AS request_source,
            CONCAT(st.first_name, ' ', st.last_name) AS requester_name,
            COALESCE(u.user_role, 'STAFF') AS requester_role,
            str.location_id,
            str.start_datetime,
            str.end_datetime,
            str.reason,
            str.is_approved
          FROM staff_time_off_requests str
          JOIN staff st ON st.staff_id = str.staff_id
          LEFT JOIN users u ON u.user_id = st.user_id
        ) AS unified
        LEFT JOIN locations l ON l.location_id = unified.location_id
        ORDER BY unified.start_datetime DESC
        LIMIT 300`
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

  function resetStaffPassword(req, staffId, data, res) {
    const newPassword = String(data?.newPassword || '').trim();
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return sendJSON(res, 400, { error: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
    }

    pool.query(
      `UPDATE users u JOIN staff st ON st.user_id = u.user_id
       SET u.password_hash = SHA2(?, 256)
       WHERE st.staff_id = ?`,
      [newPassword, staffId],
      (err, result) => {
        if (err) {
          console.error('Error resetting staff password:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Staff member not found' });
        }
        sendJSON(res, 200, { message: 'Password reset successfully' });
      }
    );
  }

  function toggleStaffVisibility(req, staffId, res) {
    pool.query(
      `UPDATE users u JOIN staff st ON st.user_id = u.user_id
       SET u.is_deleted = IF(u.is_deleted = 1, 0, 1)
       WHERE st.staff_id = ?`,
      [staffId],
      (err, result) => {
        if (err) {
          console.error('Error toggling staff visibility:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Staff member not found' });
        }
        // Return new state
        pool.query(
          'SELECT u.is_deleted FROM users u JOIN staff st ON st.user_id = u.user_id WHERE st.staff_id = ? LIMIT 1',
          [staffId],
          (err2, rows) => {
            if (err2) return sendJSON(res, 200, { message: 'Visibility toggled' });
            const isHidden = rows?.[0]?.is_deleted === 1;
            sendJSON(res, 200, { message: isHidden ? 'Staff member hidden' : 'Staff member restored', isHidden });
          }
        );
      }
    );
  }

  function generateAdminReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const dateFrom = String(parsedUrl.query.dateFrom || '').trim();
    const dateTo = String(parsedUrl.query.dateTo || '').trim();
    const zipCode = String(parsedUrl.query.zipCode || '').trim();
    const locationId = Number(parsedUrl.query.locationId || 0);
    const patientCity = String(parsedUrl.query.patientCity || '').trim();
    const patientState = String(parsedUrl.query.patientState || '').trim();
    const treatmentCode = String(parsedUrl.query.treatmentCode || '').trim();
    const departmentId = Number(parsedUrl.query.departmentId || 0);
    const doctorId = Number(parsedUrl.query.doctorId || 0);

    if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return sendJSON(res, 400, { error: 'dateFrom and dateTo are required in YYYY-MM-DD format' });
    }

    const conditions = ['a.appointment_date BETWEEN ? AND ?', "s.status_name = 'COMPLETED'"];
    const params = [dateFrom, dateTo];

    if (zipCode) {
      conditions.push('p.p_zipcode = ?');
      params.push(zipCode);
    }
    if (locationId > 0) {
      conditions.push('a.location_id = ?');
      params.push(locationId);
    }
    if (patientCity) {
      conditions.push('LOWER(p.p_city) = LOWER(?)');
      params.push(patientCity);
    }
    if (patientState) {
      conditions.push('UPPER(p.p_state) = UPPER(?)');
      params.push(patientState);
    }
    if (treatmentCode) {
      conditions.push('tp.procedure_code = ?');
      params.push(treatmentCode);
    }
    if (departmentId > 0) {
      conditions.push('(dep.department_id = ? OR apr.appointment_reason = (SELECT department_name FROM departments WHERE department_id = ?))');
      params.push(departmentId, departmentId);
    }
    if (doctorId > 0) {
      conditions.push('a.doctor_id = ?');
      params.push(doctorId);
    }

    const whereClause = conditions.join(' AND ');

    const needsTreatmentJoin = Boolean(treatmentCode);

    const sql = `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        s.status_name,
        p.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.p_address AS patient_address,
        p.p_city AS patient_city,
        p.p_state AS patient_state,
        p.p_zipcode AS patient_zip,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        d.doctor_id,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS clinic_location,
        l.location_city AS clinic_city,
        l.location_state AS clinic_state,
        l.loc_zip_code AS clinic_zip,
        GROUP_CONCAT(DISTINCT CONCAT(apc.procedure_code, ' - ', apc.description) SEPARATOR '; ') AS treatment_name,
        GROUP_CONCAT(DISTINCT apc.category SEPARATOR ', ') AS treatment_category,
        COALESCE(apr.appointment_reason, GROUP_CONCAT(DISTINCT dep.department_name SEPARATOR ', ')) AS department_name,
        COALESCE(i.payment_status, 'No Invoice') AS payment_status,
        COALESCE(i.amount, 0) AS invoice_total,
        COALESCE(i.patient_amount, 0) AS patient_amount
      FROM appointments a
      JOIN appointment_statuses s ON s.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
      LEFT JOIN appointment_preference_requests apr ON apr.patient_id = a.patient_id
        AND apr.assigned_doctor_id = a.doctor_id
        AND apr.assigned_date = a.appointment_date
      ${needsTreatmentJoin
        ? `JOIN treatment_plans tp ON tp.patient_id = p.patient_id AND tp.doctor_id = d.doctor_id AND tp.start_date = a.appointment_date
           JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code`
        : `LEFT JOIN treatment_plans tp ON tp.patient_id = p.patient_id AND tp.doctor_id = d.doctor_id AND tp.start_date = a.appointment_date
           LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code`}
      LEFT JOIN specialties_department sd ON sd.doctor_id = d.doctor_id
      LEFT JOIN departments dep ON dep.department_id = sd.department_id
      WHERE ${whereClause}
      GROUP BY a.appointment_id, a.appointment_date, a.appointment_time, s.status_name,
               p.patient_id, p.p_first_name, p.p_last_name, p.p_address, p.p_city, p.p_state, p.p_zipcode,
               st.first_name, st.last_name, d.doctor_id,
               l.loc_street_no, l.loc_street_name, l.location_city, l.location_state, l.loc_zip_code,
               i.payment_status, i.amount, i.patient_amount,
               apr.appointment_reason
      ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

    pool.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error generating admin report:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, {
        dateFrom,
        dateTo,
        filters: { zipCode: zipCode || null, locationId: locationId || null, patientCity: patientCity || null, patientState: patientState || null, treatmentCode: treatmentCode || null, departmentId: departmentId || null, doctorId: doctorId || null },
        generatedAt: new Date().toISOString(),
        totalRows: (rows || []).length,
        rows: rows || []
      });
    });
  }

  function getReportFilterOptions(req, res) {
    (async () => {
      const db = pool.promise();
      const [locations] = await db.query(
        `SELECT location_id, CONCAT(loc_street_no, ' ', loc_street_name, ', ', location_city, ', ', location_state, ' ', loc_zip_code) AS full_address FROM locations ORDER BY location_city`
      );
      const [departments] = await db.query(
        'SELECT department_id, department_name FROM departments ORDER BY department_name'
      );
      const [doctors] = await db.query(
        `SELECT d.doctor_id, CONCAT(st.first_name, ' ', st.last_name) AS doctor_name
         FROM doctors d JOIN staff st ON st.staff_id = d.staff_id
         JOIN users u ON u.user_id = st.user_id
         WHERE COALESCE(u.is_deleted, 0) = 0
         ORDER BY st.last_name`
      );
      const [treatments] = await db.query(
        'SELECT procedure_code, description, category FROM ada_procedure_codes ORDER BY category, description'
      );
      sendJSON(res, 200, {
        locations: locations || [],
        departments: departments || [],
        doctors: doctors || [],
        treatments: treatments || []
      });
    })().catch((err) => {
      console.error('Error fetching report filter options:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  function getCancelledAppointmentRequests(req, res) {
    pool.query(
      `SELECT
        apr.preference_request_id,
        apr.preferred_date,
        apr.preferred_time,
        apr.preferred_location,
        apr.appointment_reason,
        apr.request_status,
        apr.updated_at,
        apr.updated_by,
        apr.created_at,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        p.patient_id
      FROM appointment_preference_requests apr
      JOIN patients p ON p.patient_id = apr.patient_id
      WHERE apr.request_status = 'CANCELLED'
      ORDER BY apr.updated_at DESC
      LIMIT 200`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching cancelled requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function restoreAppointmentRequest(req, requestId, res) {
    pool.query(
      `UPDATE appointment_preference_requests
       SET request_status = 'PREFERRED_PENDING', updated_by = 'ADMIN_PORTAL'
       WHERE preference_request_id = ? AND request_status = 'CANCELLED'`,
      [requestId],
      (err, result) => {
        if (err) {
          console.error('Error restoring appointment request:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!result.affectedRows) {
          return sendJSON(res, 404, { error: 'Request not found or not cancelled' });
        }
        sendJSON(res, 200, { message: 'Appointment request restored' });
      }
    );
  }

  function getAdminAllStaff(req, res) {
    pool.query(
      `SELECT
        st.staff_id,
        st.first_name,
        st.last_name,
        st.date_of_birth,
        st.phone_number,
        u.user_username,
        u.user_email,
        u.user_role,
        u.is_deleted,
        GROUP_CONCAT(
          DISTINCT CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city)
          SEPARATOR ' | '
        ) AS location_address
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      WHERE u.user_role IN ('DOCTOR', 'RECEPTIONIST')
      GROUP BY st.staff_id, st.first_name, st.last_name, st.date_of_birth,
               st.phone_number, u.user_username, u.user_email, u.user_role, u.is_deleted
      ORDER BY u.is_deleted ASC, st.last_name ASC, st.first_name ASC
      LIMIT 200`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching all staff:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
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
    getStaffTimeOffRequestsByStaffId,
    approveAdminStaffTimeOffRequest,
    denyAdminStaffTimeOffRequest,
    getAdminStaffMembersByRole,
    createAdminStaffMember,
    resetStaffPassword,
    toggleStaffVisibility,
    getAdminAllStaff,
    generateAdminReport,
    getReportFilterOptions,
    getCancelledAppointmentRequests,
    restoreAppointmentRequest,
    submitScheduleRequest,
    getScheduleRequestsByStaffId,
    getAdminScheduleRequests,
    approveScheduleRequest,
    denyScheduleRequest,
    getStaffSchedules,
    getAllStaffSchedules,
    getStaffScheduleGaps,
    adminUpdateStaffSchedule
  };

  // ── Staff Schedule Request Handlers ──

  function submitScheduleRequest(req, data, res) {
    const staffId = Number(data.staffId || 0);
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (!Number.isInteger(staffId) || staffId <= 0 || !entries.length) {
      return sendJSON(res, 400, { error: 'staffId and entries[] are required' });
    }

    const VALID_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const rows = [];
    for (const e of entries) {
      const day = String(e.day || '').toUpperCase();
      const isOff = !!e.isOff;
      const start = isOff ? null : String(e.startTime || '').trim();
      const end = isOff ? null : String(e.endTime || '').trim();
      if (!VALID_DAYS.includes(day)) {
        return sendJSON(res, 400, { error: `Invalid day: ${day}` });
      }
      if (!isOff && (!start || !end || start >= end)) {
        return sendJSON(res, 400, { error: `Invalid entry: ${day} ${start}-${end}` });
      }
      rows.push([staffId, day, start, end, isOff ? 1 : 0, 'PENDING']);
    }

    // Cancel any existing PENDING requests for this staff, then insert new ones
    pool.query(
      `DELETE FROM staff_schedule_requests WHERE staff_id = ? AND request_status = 'PENDING'`,
      [staffId],
      (err) => {
        if (err) {
          console.error('Error clearing old schedule requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        pool.query(
          `INSERT INTO staff_schedule_requests (staff_id, day_of_week, start_time, end_time, is_off, request_status) VALUES ?`,
          [rows],
          (err2) => {
            if (err2) {
              console.error('Error inserting schedule requests:', err2);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            sendJSON(res, 200, { message: 'Schedule request submitted' });
          }
        );
      }
    );
  }

  function getScheduleRequestsByStaffId(req, res, staffId) {
    pool.query(
      `SELECT request_id, day_of_week, start_time, end_time, is_off, request_status, submitted_at, reviewed_at
       FROM staff_schedule_requests
       WHERE staff_id = ?
       ORDER BY FIELD(day_of_week,'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'), start_time`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching schedule requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getAdminScheduleRequests(req, res) {
    pool.query(
      `SELECT
        sr.request_id,
        sr.staff_id,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
        u.user_role AS role,
        sr.day_of_week,
        sr.start_time,
        sr.end_time,
        sr.is_off,
        sr.request_status,
        sr.submitted_at
      FROM staff_schedule_requests sr
      JOIN staff st ON st.staff_id = sr.staff_id
      LEFT JOIN users u ON u.user_id = st.user_id
      WHERE sr.request_status = 'PENDING'
      ORDER BY sr.submitted_at DESC, st.first_name`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching admin schedule requests:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function approveScheduleRequest(req, requestId, res) {
    // Get the request details first
    pool.query(
      `SELECT staff_id, day_of_week, start_time, end_time, is_off FROM staff_schedule_requests WHERE request_id = ? AND request_status = 'PENDING'`,
      [requestId],
      (err, rows) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });
        if (!rows.length) return sendJSON(res, 404, { error: 'Request not found or already handled' });

        const { staff_id, day_of_week, start_time, end_time, is_off } = rows[0];

        // Upsert the approved schedule
        pool.query(
          `INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_off)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), is_off = VALUES(is_off)`,
          [staff_id, day_of_week, start_time, end_time, is_off ? 1 : 0],
          (err2) => {
            if (err2) return sendJSON(res, 500, { error: 'Database error' });

            // Mark request approved
            pool.query(
              `UPDATE staff_schedule_requests SET request_status = 'APPROVED', reviewed_at = NOW() WHERE request_id = ?`,
              [requestId],
              (err3) => {
                if (err3) return sendJSON(res, 500, { error: 'Database error' });
                sendJSON(res, 200, { message: 'Schedule request approved' });
              }
            );
          }
        );
      }
    );
  }

  function denyScheduleRequest(req, requestId, res) {
    pool.query(
      `UPDATE staff_schedule_requests SET request_status = 'DENIED', reviewed_at = NOW() WHERE request_id = ? AND request_status = 'PENDING'`,
      [requestId],
      (err, result) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });
        if (!result.affectedRows) return sendJSON(res, 404, { error: 'Request not found or already handled' });
        sendJSON(res, 200, { message: 'Schedule request denied' });
      }
    );
  }

  function getStaffSchedules(req, res, staffId) {
    pool.query(
      `SELECT schedule_id, day_of_week, start_time, end_time, is_off
       FROM staff_schedules WHERE staff_id = ?
       ORDER BY FIELD(day_of_week,'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY')`,
      [staffId],
      (err, rows) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getAllStaffSchedules(req, res) {
    pool.query(
      `SELECT
        ss.schedule_id,
        ss.staff_id,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
        u.user_role AS role,
        ss.day_of_week,
        ss.start_time,
        ss.end_time,
        ss.is_off
      FROM staff_schedules ss
      JOIN staff st ON st.staff_id = ss.staff_id
      LEFT JOIN users u ON u.user_id = st.user_id
      WHERE u.is_deleted = 0
      ORDER BY st.first_name, FIELD(ss.day_of_week,'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY')`,
      (err, rows) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getStaffScheduleGaps(req, res) {
    // Find days/hours where no staff are scheduled vs clinic hours (09:00-19:00, Mon-Sat)
    const CLINIC_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const CLINIC_START = '09:00:00';
    const CLINIC_END = '19:00:00';

    pool.query(
      `SELECT
        ss.staff_id,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
        u.user_role AS role,
        ss.day_of_week,
        ss.start_time,
        ss.end_time,
        ss.is_off
      FROM staff_schedules ss
      JOIN staff st ON st.staff_id = ss.staff_id
      LEFT JOIN users u ON u.user_id = st.user_id
      WHERE u.is_deleted = 0
      ORDER BY FIELD(ss.day_of_week,'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'), ss.start_time`,
      (err, rows) => {
        if (err) return sendJSON(res, 500, { error: 'Database error' });

        const schedulesByDay = {};
        CLINIC_DAYS.forEach((d) => { schedulesByDay[d] = []; });
        (rows || []).forEach((r) => {
          if (schedulesByDay[r.day_of_week] && !r.is_off) {
            schedulesByDay[r.day_of_week].push(r);
          }
        });

        const gaps = [];
        CLINIC_DAYS.forEach((day) => {
          const daySchedules = schedulesByDay[day];
          if (!daySchedules.length) {
            gaps.push({ day_of_week: day, gap_start: CLINIC_START, gap_end: CLINIC_END, type: 'NO_COVERAGE' });
            return;
          }

          // Check each clinic hour for coverage
          for (let h = 9; h < 19; h++) {
            const hourStart = `${String(h).padStart(2, '0')}:00:00`;
            const hourEnd = `${String(h + 1).padStart(2, '0')}:00:00`;
            const hasDoctorCoverage = daySchedules.some((s) =>
              s.role === 'DOCTOR' && s.start_time <= hourStart && s.end_time >= hourEnd
            );
            const hasReceptionistCoverage = daySchedules.some((s) =>
              s.role === 'RECEPTIONIST' && s.start_time <= hourStart && s.end_time >= hourEnd
            );
            if (!hasDoctorCoverage && !hasReceptionistCoverage) {
              gaps.push({ day_of_week: day, gap_start: hourStart, gap_end: hourEnd, type: 'NO_COVERAGE' });
            } else if (!hasDoctorCoverage) {
              gaps.push({ day_of_week: day, gap_start: hourStart, gap_end: hourEnd, type: 'NO_DOCTOR' });
            } else if (!hasReceptionistCoverage) {
              gaps.push({ day_of_week: day, gap_start: hourStart, gap_end: hourEnd, type: 'NO_RECEPTIONIST' });
            }
          }
        });

        sendJSON(res, 200, gaps);
      }
    );
  }

  function adminUpdateStaffSchedule(req, data, res) {
    const staffId = Number(data.staffId || 0);
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (!Number.isInteger(staffId) || staffId <= 0) {
      return sendJSON(res, 400, { error: 'Valid staffId is required' });
    }

    const VALID_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

    // Delete all existing schedules for this staff, then insert the new ones
    pool.query(`DELETE FROM staff_schedules WHERE staff_id = ?`, [staffId], (err) => {
      if (err) return sendJSON(res, 500, { error: 'Database error' });

      // Filter out entries with no data
      const rows = [];
      for (const e of entries) {
        const day = String(e.day || '').toUpperCase();
        if (!VALID_DAYS.includes(day)) continue;
        const isOff = !!e.isOff;
        const start = isOff ? null : String(e.startTime || '').trim() || null;
        const end = isOff ? null : String(e.endTime || '').trim() || null;
        if (!isOff && (!start || !end || start >= end)) continue;
        rows.push([staffId, day, start, end, isOff ? 1 : 0]);
      }

      if (!rows.length) {
        return sendJSON(res, 200, { message: 'Schedule cleared' });
      }

      pool.query(
        `INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_off) VALUES ?`,
        [rows],
        (err2) => {
          if (err2) {
            console.error('Error updating staff schedule:', err2);
            return sendJSON(res, 500, { error: 'Database error' });
          }
          sendJSON(res, 200, { message: 'Schedule updated' });
        }
      );
    });
  }
}

module.exports = {
  createAdminHandlers
};
