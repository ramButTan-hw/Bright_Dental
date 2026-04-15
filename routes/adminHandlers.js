
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

      // Collected = actual payments received (cash collected)
      const [[actualPayments]] = await db.query('SELECT COALESCE(SUM(payment_amount), 0) AS value FROM payments');
      
      // Insurance coverage = total insurance responsibility (what insurance will pay)
      const [[insuranceCoverageTotal]] = await db.query(`
        SELECT COALESCE(SUM(insurance_covered_amount), 0) AS value FROM invoices
      `);
      
      // Patient collections = payments applied toward patient invoice balances (capped at patient_amount per invoice)
      const [[patientPayments]] = await db.query(`
        SELECT COALESCE(SUM(LEAST(COALESCE(pay.total_paid, 0), COALESCE(i.patient_amount, 0))), 0) AS value
        FROM invoices i
        LEFT JOIN (SELECT invoice_id, SUM(payment_amount) AS total_paid FROM payments GROUP BY invoice_id) pay
          ON pay.invoice_id = i.invoice_id
      `);
      
      const collected = parseFloat(actualPayments?.value) || 0;
      const insuranceCollected = parseFloat(insuranceCoverageTotal?.value) || 0;
      const patientCollected = parseFloat(patientPayments?.value) || 0;
      
      const [[totalOutstanding]] = await db.query(
        `SELECT COALESCE(SUM(GREATEST(COALESCE(i.patient_amount, 0) - (COALESCE(pay.total_paid, 0) - COALESCE(ref.total_refunded, 0)), 0)), 0) AS value
         FROM invoices i
         LEFT JOIN (SELECT invoice_id, SUM(payment_amount) AS total_paid FROM payments GROUP BY invoice_id) pay ON pay.invoice_id = i.invoice_id
         LEFT JOIN (SELECT invoice_id, SUM(refund_amount) AS total_refunded FROM refunds GROUP BY invoice_id) ref ON ref.invoice_id = i.invoice_id`
      );
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
      const [[newPatientsThisMonth]] = await db.query(
        `SELECT COUNT(*) AS value FROM patients
         WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
      );
      const [[pendingTimeOffCount]] = await db.query(
        `SELECT COUNT(*) AS value FROM staff_time_off_requests WHERE is_approved IS NULL OR is_approved = 0`
      );

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
          collected: Math.round(collected * 100) / 100,
          patientCollected: Math.round(patientCollected * 100) / 100,
          insuranceCollected: Math.round(insuranceCollected * 100) / 100,
          totalOutstanding: Number(totalOutstanding?.value || 0),
          scheduledToday: Number(scheduledCount?.value || 0),
          waitingToSchedule: Number(pendingPreferenceCount?.value || 0),
          patientsScheduledToday: Number(totalPatientsToday?.value || 0),
          doctorCount: Number(doctorCount?.value || 0),
          newPatientsThisMonth: Number(newPatientsThisMonth?.value || 0),
          pendingTimeOffCount: Number(pendingTimeOffCount?.value || 0)
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

  function getAdminFollowUpQueue(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const windowDaysInput = Number(parsedUrl.query.windowDays || 365);
    const windowDays = Number.isInteger(windowDaysInput) && windowDaysInput >= 0 && windowDaysInput <= 730
      ? windowDaysInput
      : 365;
    const includeScheduled = String(parsedUrl.query.includeScheduled || '').trim().toLowerCase() === 'true';

    (async () => {
      const db = pool.promise();

      const [rows] = await db.query(
        `SELECT
          q.patient_id,
          q.next_follow_up_date,
          q.pending_follow_up_items,
          q.procedure_codes,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.p_phone,
          p.p_email,
          na.next_appointment_date,
          (
            SELECT CONCAT(st.first_name, ' ', st.last_name)
            FROM treatment_plans tp2
            JOIN doctors d2 ON d2.doctor_id = tp2.doctor_id
            JOIN staff st ON st.staff_id = d2.staff_id
            WHERE tp2.patient_id = q.patient_id
              AND tp2.follow_up_required = 1
              AND tp2.follow_up_date = q.next_follow_up_date
            ORDER BY tp2.created_at DESC
            LIMIT 1
          ) AS suggested_doctor_name
        FROM (
          SELECT
            tp.patient_id,
            MIN(tp.follow_up_date) AS next_follow_up_date,
            COUNT(*) AS pending_follow_up_items,
            GROUP_CONCAT(DISTINCT tp.procedure_code ORDER BY tp.follow_up_date ASC SEPARATOR ', ') AS procedure_codes
          FROM treatment_plans tp
          LEFT JOIN treatment_statuses ts ON ts.status_id = tp.status_id
          WHERE tp.follow_up_required = 1
            AND tp.follow_up_date IS NOT NULL
            AND (ts.status_name = 'COMPLETED' OR ts.status_name IS NULL)
          GROUP BY tp.patient_id
          HAVING MIN(tp.follow_up_date) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ) q
        JOIN patients p ON p.patient_id = q.patient_id
        LEFT JOIN (
          SELECT
            a.patient_id,
            MIN(a.appointment_date) AS next_appointment_date
          FROM appointments a
          JOIN appointment_statuses s ON s.status_id = a.status_id
          WHERE a.appointment_date >= CURDATE()
            AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')
          GROUP BY a.patient_id
        ) na ON na.patient_id = q.patient_id
        ORDER BY q.next_follow_up_date ASC, patient_name ASC`,
        [windowDays]
      );

      const todayDate = new Date();
      const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

      const queueItems = (rows || []).map((row) => {
        const dueDate = new Date(row.next_follow_up_date);
        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilDue = Math.round((dueDay.getTime() - today.getTime()) / msPerDay);

        const dueState = daysUntilDue < 0
          ? 'OVERDUE'
          : daysUntilDue === 0
            ? 'DUE_TODAY'
            : 'UPCOMING';

        const nextApptDate = row.next_appointment_date ? String(row.next_appointment_date).slice(0, 10) : null;
        const dueDateKey = String(row.next_follow_up_date).slice(0, 10);
        const isAlreadyScheduled = Boolean(nextApptDate && nextApptDate >= dueDateKey);

        return {
          patientId: Number(row.patient_id || 0),
          patientName: row.patient_name || 'Unknown patient',
          phone: row.p_phone || null,
          email: row.p_email || null,
          followUpDate: dueDateKey,
          dueState,
          daysUntilDue,
          pendingFollowUpItems: Number(row.pending_follow_up_items || 0),
          procedureCodes: String(row.procedure_codes || '').split(',').map((value) => value.trim()).filter(Boolean),
          suggestedDoctorName: row.suggested_doctor_name || null,
          nextAppointmentDate: nextApptDate,
          isAlreadyScheduled
        };
      });

      const filteredItems = includeScheduled
        ? queueItems
        : queueItems.filter((item) => !item.isAlreadyScheduled);

      const summary = filteredItems.reduce((acc, item) => {
        if (item.dueState === 'OVERDUE') acc.overdue += 1;
        if (item.dueState === 'DUE_TODAY') acc.dueToday += 1;
        if (item.dueState === 'UPCOMING') acc.upcoming += 1;
        if (item.isAlreadyScheduled) acc.scheduled += 1;
        else acc.unscheduled += 1;
        return acc;
      }, { overdue: 0, dueToday: 0, upcoming: 0, scheduled: 0, unscheduled: 0 });

      sendJSON(res, 200, {
        generatedAt: new Date().toISOString(),
        windowDays,
        includeScheduled,
        summary,
        totalItems: filteredItems.length,
        items: filteredItems
      });
    })().catch((err) => {
      console.error('Error fetching admin follow-up queue:', err);
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
            SUM(CASE WHEN i.payment_status IN ('Unpaid', 'Partial') THEN 1 ELSE 0 END) AS unpaid_invoices,
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
      WHERE COALESCE(u.is_deleted, 0) = 0
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
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (!digits) return '';
    if (digits.length !== 10) return '';
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function createAdminDoctor(req, data, res) {
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const dob = String(data?.dob || '').trim();
    const normalizedSsn = normalizeSsn(data?.ssn);
    const phoneDigits = String(data?.phone || '').replace(/\D/g, '');
    const normalizedPhone = normalizeUsPhone(phoneDigits);
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

    if (!username || !password || !phoneDigits) {
      return sendJSON(res, 400, { error: 'username, password, and phone are required' });
    }

    if (phoneDigits.length !== 10) {
      return sendJSON(res, 400, { error: 'phone must contain exactly 10 digits' });
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

    const validationErrors = [];

    if (!city || !state || !streetNo || !streetName || !zipCode) {
      validationErrors.push('city, state, streetNo, streetName, and zipCode are required');
    }

    if (city && city.length > 20) {
      validationErrors.push('city must be 20 characters or fewer');
    }

    if (state && !/^[A-Z]{2}$/.test(state)) {
      validationErrors.push('state must be a 2-letter abbreviation (e.g., TX)');
    }

    if (streetNo && streetNo.length > 20) {
      validationErrors.push('streetNo must be 20 characters or fewer');
    }

    if (streetNo && !/^\d+[A-Za-z0-9\-\/]*$/.test(streetNo)) {
      validationErrors.push('streetNo must be a street number only (e.g., 11606 or 11606A)');
    }

    if (streetName && streetName.length > 100) {
      validationErrors.push('streetName must be 100 characters or fewer');
    }

    if (zipCode && !/^\d{5}(?:-\d{4})?$/.test(zipCode)) {
      validationErrors.push('zipCode must be 5 digits or ZIP+4 format (e.g., 77089 or 77089-1234)');
    }

    if (validationErrors.length > 0) {
      return sendJSON(res, 400, {
        error: 'Invalid location data',
        details: validationErrors
      });
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
          if (err.code === 'ER_DATA_TOO_LONG') {
            return sendJSON(res, 400, {
              error: 'Invalid location data',
              details: ['One or more fields exceed allowed length']
            });
          }
          if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'ER_WARN_DATA_OUT_OF_RANGE') {
            return sendJSON(res, 400, {
              error: 'Invalid location data',
              details: ['One or more fields have invalid values']
            });
          }
          return sendJSON(res, 500, { error: 'Failed to create location' });
        }

        sendJSON(res, 201, {
          message: 'Location created successfully',
          locationId: result.insertId
        });
      }
    );
  }

  function deleteAdminLocation(req, locationId, res) {
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return sendJSON(res, 400, { error: 'A valid locationId is required' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting DB connection for location delete:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction((beginErr) => {
        if (beginErr) {
          conn.release();
          console.error('Error starting location delete transaction:', beginErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        conn.query(
          'SELECT location_id FROM locations WHERE location_id = ? FOR UPDATE',
          [locationId],
          (locErr, locRows) => {
            if (locErr) {
              return conn.rollback(() => {
                conn.release();
                console.error('Error locking location for delete:', locErr);
                sendJSON(res, 500, { error: 'Database error' });
              });
            }

            if (!locRows?.length) {
              return conn.rollback(() => {
                conn.release();
                sendJSON(res, 404, { error: 'Location not found' });
              });
            }

            conn.query('DELETE FROM staff_locations WHERE location_id = ?', [locationId], (staffLocErr) => {
              if (staffLocErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('Error deleting staff_locations for location:', staffLocErr);
                  sendJSON(res, 500, { error: 'Failed to delete location dependencies' });
                });
              }

              conn.query('UPDATE appointment_slots SET location_id = NULL WHERE location_id = ?', [locationId], (slotsErr) => {
                if (slotsErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('Error clearing appointment_slots location references:', slotsErr);
                    sendJSON(res, 500, { error: 'Failed to delete location dependencies' });
                  });
                }

                conn.query('UPDATE appointments SET location_id = NULL WHERE location_id = ?', [locationId], (apptErr) => {
                  if (apptErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error('Error clearing appointments location references:', apptErr);
                      sendJSON(res, 500, { error: 'Failed to delete location dependencies' });
                    });
                  }

                  conn.query('DELETE FROM locations WHERE location_id = ?', [locationId], (delErr, delResult) => {
                    if (delErr) {
                      return conn.rollback(() => {
                        conn.release();
                        if (delErr.code === 'ER_ROW_IS_REFERENCED_2') {
                          return sendJSON(res, 409, { error: 'Location is still referenced by other records and cannot be deleted' });
                        }
                        console.error('Error deleting location:', delErr);
                        sendJSON(res, 500, { error: 'Failed to delete location' });
                      });
                    }

                    if (!delResult?.affectedRows) {
                      return conn.rollback(() => {
                        conn.release();
                        sendJSON(res, 404, { error: 'Location not found' });
                      });
                    }

                    conn.commit((commitErr) => {
                      if (commitErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error('Error committing location delete transaction:', commitErr);
                          sendJSON(res, 500, { error: 'Failed to delete location' });
                        });
                      }

                      conn.release();
                      sendJSON(res, 200, { message: 'Location deleted successfully' });
                    });
                  });
                });
              });
            });
          }
        );
      });
    });
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
    pool.promise().query(
      `SELECT dto.time_off_id, dto.doctor_id, dto.start_datetime, dto.end_datetime,
              CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')) AS doctor_name
       FROM doctor_time_off dto
       JOIN doctors d ON d.doctor_id = dto.doctor_id
       JOIN staff st ON st.staff_id = d.staff_id
       WHERE dto.time_off_id = ?
       LIMIT 1`,
      [timeOffId]
    ).then(async ([rows]) => {
      const request = rows?.[0] || null;
      if (!request) {
        sendJSON(res, 404, { error: 'Time-off entry not found' });
        return;
      }

      const [updateResult] = await pool.promise().query(
        `UPDATE doctor_time_off SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE time_off_id = ?`,
        [timeOffId]
      );

      if (!updateResult.affectedRows) {
        sendJSON(res, 404, { error: 'Time-off entry not found' });
        return;
      }

      const [[countRow]] = await pool.promise().query(
        `SELECT COUNT(*) AS affected_count, MIN(a.patient_id) AS patient_id
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         WHERE a.doctor_id = ?
           AND s.status_name = 'CANCELLED'
           AND a.updated_by = 'SYSTEM_TIME_OFF'
           AND TIMESTAMP(a.appointment_date, a.appointment_time) >= ?
           AND TIMESTAMP(a.appointment_date, a.appointment_time) < ?`,
        [request.doctor_id, request.start_datetime, request.end_datetime]
      );

      const affectedCount = Number(countRow?.affected_count || 0);
      const patientId = Number(countRow?.patient_id || 0);

      if (affectedCount > 0 && patientId > 0) {
        await pool.promise().query(
          `INSERT INTO receptionist_notifications (
             source_table,
             source_request_id,
             patient_id,
             notification_type,
             message,
             is_read,
             read_at,
             created_by,
             updated_by
           ) VALUES (?, ?, ?, 'DOCTOR_TIME_OFF', ?, FALSE, NULL, 'ADMIN_PORTAL', 'ADMIN_PORTAL')
           ON DUPLICATE KEY UPDATE
             patient_id = VALUES(patient_id),
             notification_type = VALUES(notification_type),
             message = VALUES(message),
             is_read = FALSE,
             read_at = NULL,
             updated_by = VALUES(updated_by)`,
          [
            'doctor_time_off',
            timeOffId,
            patientId,
            `Doctor time off approved for ${request.doctor_name || `doctor #${request.doctor_id}`}. ${affectedCount} appointment${affectedCount === 1 ? '' : 's'} were cancelled and need rescheduling.`
          ]
        );
      }

      sendJSON(res, 200, { message: 'Time-off approved' });
    }).catch((err) => {
      console.error('Error approving time off:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
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

    if (isDoctorSource) {
      pool.promise().query(
        `SELECT dto.time_off_id, dto.doctor_id, dto.start_datetime, dto.end_datetime,
                CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')) AS doctor_name
         FROM doctor_time_off dto
         JOIN doctors d ON d.doctor_id = dto.doctor_id
         JOIN staff st ON st.staff_id = d.staff_id
         WHERE dto.time_off_id = ?
         LIMIT 1`,
        [requestId]
      ).then(async ([rows]) => {
        const request = rows?.[0] || null;
        if (!request) {
          sendJSON(res, 404, { error: 'Time-off request not found' });
          return;
        }

        const [updateResult] = await pool.promise().query(
          `UPDATE doctor_time_off SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE time_off_id = ?`,
          [requestId]
        );

        if (!updateResult.affectedRows) {
          sendJSON(res, 404, { error: 'Time-off request not found' });
          return;
        }

        const [[countRow]] = await pool.promise().query(
          `SELECT COUNT(*) AS affected_count, MIN(a.patient_id) AS patient_id
           FROM appointments a
           JOIN appointment_statuses s ON s.status_id = a.status_id
           WHERE a.doctor_id = ?
             AND s.status_name = 'CANCELLED'
             AND a.updated_by = 'SYSTEM_TIME_OFF'
             AND TIMESTAMP(a.appointment_date, a.appointment_time) >= ?
             AND TIMESTAMP(a.appointment_date, a.appointment_time) < ?`,
          [request.doctor_id, request.start_datetime, request.end_datetime]
        );

        const affectedCount = Number(countRow?.affected_count || 0);
        const patientId = Number(countRow?.patient_id || 0);

        if (affectedCount > 0 && patientId > 0) {
          await pool.promise().query(
            `INSERT INTO receptionist_notifications (
               source_table,
               source_request_id,
               patient_id,
               notification_type,
               message,
               is_read,
               read_at,
               created_by,
               updated_by
             ) VALUES (?, ?, ?, 'DOCTOR_TIME_OFF', ?, FALSE, NULL, 'ADMIN_PORTAL', 'ADMIN_PORTAL')
             ON DUPLICATE KEY UPDATE
               patient_id = VALUES(patient_id),
               notification_type = VALUES(notification_type),
               message = VALUES(message),
               is_read = FALSE,
               read_at = NULL,
               updated_by = VALUES(updated_by)`,
            [
              'doctor_time_off',
              requestId,
              patientId,
              `Doctor time off approved for ${request.doctor_name || `doctor #${request.doctor_id}`}. ${affectedCount} appointment${affectedCount === 1 ? '' : 's'} were cancelled and need rescheduling.`
            ]
          );
        }

        sendJSON(res, 200, { message: 'Time-off request approved' });
      }).catch((err) => {
        console.error('Error approving time off request:', err);
        sendJSON(res, 500, { error: 'Database error' });
      });
      return;
    }

    const sql = isDoctorSource
      ? `UPDATE doctor_time_off SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE time_off_id = ?`
      : `UPDATE staff_time_off_requests SET is_approved = TRUE, updated_by = 'ADMIN_PORTAL' WHERE request_id = ?`;

    pool.query(sql, [requestId], (err, result) => {
      if (err) { console.error('Error approving time off request:', err); return sendJSON(res, 500, { error: 'Database error' }); }
      if (result.affectedRows === 0) return sendJSON(res, 404, { error: 'Time-off request not found' });
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
    const phoneDigits = String(data?.phone || '').replace(/\D/g, '');
    const normalizedPhone = normalizeUsPhone(phoneDigits);
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
    if (!username || !password || !phoneDigits) {
      return sendJSON(res, 400, { error: 'username, password, and phone are required' });
    }

    if (phoneDigits.length !== 10) {
      return sendJSON(res, 400, { error: 'phone must contain exactly 10 digits' });
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
          SUM(CASE WHEN s.status_name = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show,
          COALESCE(SUM(i.patient_amount), 0) AS total_billed,
          COALESCE(SUM(
            (SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id)
          ), 0) AS total_collected
        FROM doctors d
        JOIN staff st ON st.staff_id = d.staff_id
        LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
          AND a.appointment_date BETWEEN ? AND ?
        LEFT JOIN appointment_statuses s ON s.status_id = a.status_id
        LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
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
    if (!newPassword || newPassword.length < 8) {
      return sendJSON(res, 400, { error: 'Must be at least 8 characters.' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return sendJSON(res, 400, { error: 'Must include at least 1 uppercase letter.' });
    }
    if (!/[a-z]/.test(newPassword)) {
      return sendJSON(res, 400, { error: 'Must include at least 1 lowercase letter.' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return sendJSON(res, 400, { error: 'Must include at least 1 number.' });
    }

    const crypto = require('crypto');
    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    pool.query(
      `SELECT u.password_hash
       FROM users u JOIN staff st ON st.user_id = u.user_id
       WHERE st.staff_id = ? LIMIT 1`,
      [staffId],
      (err, rows) => {
        if (err) {
          console.error('Error resetting staff password:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows.length) {
          return sendJSON(res, 404, { error: 'Staff member not found' });
        }
        if (newHash.toLowerCase() === String(rows[0].password_hash || '').toLowerCase()) {
          return sendJSON(res, 400, { error: 'Password must be different from the current password.' });
        }

        pool.query(
          `UPDATE users u JOIN staff st ON st.user_id = u.user_id
           SET u.password_hash = SHA2(?, 256)
           WHERE st.staff_id = ?`,
          [newPassword, staffId],
          (updateErr, result) => {
            if (updateErr) {
              console.error('Error resetting staff password:', updateErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            if (!result.affectedRows) {
              return sendJSON(res, 404, { error: 'Staff member not found' });
            }
            sendJSON(res, 200, { message: 'Password reset successfully' });
          }
        );
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
    const status = String(parsedUrl.query.status || 'ALL').trim().toUpperCase();
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

    const conditions = ['a.appointment_date BETWEEN ? AND ?'];
    const params = [dateFrom, dateTo];

    if (status && status !== 'ALL') {
      if (status === 'CANCELED' || status === 'CANCELLED') {
        conditions.push("UPPER(s.status_name) IN ('CANCELED', 'CANCELLED')");
      } else {
        conditions.push('UPPER(s.status_name) = ?');
        params.push(status);
      }
    }

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
        i.invoice_id,
        COALESCE(i.payment_status, 'No Invoice') AS payment_status,
        COALESCE(i.amount, 0) AS invoice_total,
        COALESCE(i.patient_amount, 0) AS patient_amount,
        COALESCE(pay.total_paid, 0) AS total_paid,
        COALESCE(ref.total_refunded, 0) AS total_refunded,
        ROUND(COALESCE(pay.total_paid, 0) - COALESCE(ref.total_refunded, 0), 2) AS net_collected,
        ROUND(COALESCE(i.patient_amount, 0) - (COALESCE(pay.total_paid, 0) - COALESCE(ref.total_refunded, 0)), 2) AS patient_outstanding
      FROM appointments a
      JOIN appointment_statuses s ON s.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
      LEFT JOIN (
        SELECT invoice_id, SUM(payment_amount) AS total_paid
        FROM payments
        GROUP BY invoice_id
      ) pay ON pay.invoice_id = i.invoice_id
      LEFT JOIN (
        SELECT invoice_id, SUM(refund_amount) AS total_refunded
        FROM refunds
        GROUP BY invoice_id
      ) ref ON ref.invoice_id = i.invoice_id
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
               i.invoice_id, i.payment_status, i.amount, i.patient_amount,
               pay.total_paid, ref.total_refunded,
               apr.appointment_reason
      ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

    pool.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error generating admin report:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      const reportRows = rows || [];
      const uniquePatients = new Set(reportRows.map((row) => row.patient_id));
      const uniqueDoctors = new Set(reportRows.map((row) => row.doctor_id));
      const statusBreakdown = reportRows.reduce((acc, row) => {
        const key = String(row.status_name || 'UNKNOWN').toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalAppointments = reportRows.length;
      const completedAppointments = statusBreakdown.COMPLETED || 0;
      const noShowAppointments = statusBreakdown.NO_SHOW || 0;
      const cancelledAppointments = (statusBreakdown.CANCELED || 0) + (statusBreakdown.CANCELLED || 0);
      const totalRevenue = reportRows.reduce((sum, row) => sum + Number(row.invoice_total || 0), 0);
      const totalPatientResponsibility = reportRows.reduce((sum, row) => sum + Number(row.patient_amount || 0), 0);
      const totalCollected = reportRows.reduce((sum, row) => sum + Number(row.net_collected || 0), 0);
      const totalOutstanding = reportRows.reduce((sum, row) => sum + Math.max(Number(row.patient_outstanding || 0), 0), 0);

      const summary = {
        totalAppointments,
        uniquePatients: uniquePatients.size,
        uniqueDoctors: uniqueDoctors.size,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        completionRate: totalAppointments ? Number(((completedAppointments / totalAppointments) * 100).toFixed(2)) : 0,
        noShowRate: totalAppointments ? Number(((noShowAppointments / totalAppointments) * 100).toFixed(2)) : 0,
        totalRevenue,
        totalPatientResponsibility,
        totalCollected,
        totalOutstanding,
        avgRevenuePerAppointment: totalAppointments ? Number((totalRevenue / totalAppointments).toFixed(2)) : 0,
        statusBreakdown
      };

      sendJSON(res, 200, {
        dateFrom,
        dateTo,
        filters: {
          status: status || 'ALL',
          zipCode: zipCode || null,
          locationId: locationId || null,
          patientCity: patientCity || null,
          patientState: patientState || null,
          treatmentCode: treatmentCode || null,
          departmentId: departmentId || null,
          doctorId: doctorId || null
        },
        generatedAt: new Date().toISOString(),
        summary,
        totalRows: reportRows.length,
        rows: reportRows
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
        'SELECT procedure_code, description, category FROM ada_procedure_codes ORDER BY procedure_code ASC'
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
        apr.receptionist_notes,
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

  function getNewPatientsReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const dateFrom = String(parsedUrl.query.dateFrom || '').trim();
    const dateTo = String(parsedUrl.query.dateTo || '').trim();

    if (!dateFrom || !dateTo) {
      return sendJSON(res, 400, { error: 'dateFrom and dateTo are required' });
    }

    pool.query(
      `SELECT
        p.patient_id,
        p.p_first_name,
        p.p_last_name,
        p.p_dob,
        p.p_gender,
        p.p_phone,
        p.p_email,
        p.p_city,
        p.p_state,
        p.p_zipcode,
        DATE(p.created_at) AS registered_date,
        COUNT(DISTINCT a.appointment_id) AS total_appointments,
        MAX(a.appointment_date) AS last_appointment_date
      FROM patients p
      LEFT JOIN appointments a ON a.patient_id = p.patient_id
      WHERE DATE(p.created_at) BETWEEN ? AND ?
      GROUP BY p.patient_id, p.p_first_name, p.p_last_name, p.p_dob, p.p_gender,
               p.p_phone, p.p_email, p.p_city, p.p_state, p.p_zipcode, p.created_at
      ORDER BY p.created_at ASC`,
      [dateFrom, dateTo],
      (err, rows) => {
        if (err) {
          console.error('Error generating new patients report:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, {
          dateFrom,
          dateTo,
          totalNewPatients: (rows || []).length,
          generatedAt: new Date().toISOString(),
          rows: rows || []
        });
      }
    );
  }

  function getClinicPerformanceReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const dateFrom = String(parsedUrl.query.dateFrom || '').trim();
    const dateTo = String(parsedUrl.query.dateTo || '').trim();
    const doctorIdRaw = Number(parsedUrl.query.doctorId || 0);
    const locationIdRaw = Number(parsedUrl.query.locationId || 0);
    const statusGroupRaw = String(parsedUrl.query.statusGroup || 'ALL').trim().toUpperCase();
    const paymentStatusRaw = String(parsedUrl.query.paymentStatus || 'ALL').trim().toUpperCase();
    const patientStateRaw = String(parsedUrl.query.patientState || 'ALL').trim().toUpperCase();
    const procedureCodeQuery = parsedUrl.query.procedureCode || parsedUrl.query.procedureCategory || 'ALL';
    const procedureCodeRaw = String(procedureCodeQuery).trim().toUpperCase();

    const doctorId = Number.isInteger(doctorIdRaw) && doctorIdRaw > 0 ? doctorIdRaw : null;
    const locationId = Number.isInteger(locationIdRaw) && locationIdRaw > 0 ? locationIdRaw : null;

    const allowedStatusGroups = new Set(['ALL', 'COMPLETED', 'SCHEDULED', 'CANCELLED', 'NO_SHOW', 'MISSED']);
    const allowedPaymentStatuses = new Set(['ALL', 'PAID', 'PARTIAL', 'UNPAID', 'REFUNDED']);
    const normalizedStatusGroup = allowedStatusGroups.has(statusGroupRaw) ? statusGroupRaw : 'ALL';
    const normalizedPaymentStatus = allowedPaymentStatuses.has(paymentStatusRaw) ? paymentStatusRaw : 'ALL';
    const normalizedPatientState = /^[A-Z]{2}$/.test(patientStateRaw) ? patientStateRaw : 'ALL';
    const normalizedProcedureCode = procedureCodeRaw ? procedureCodeRaw : 'ALL';

    if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return sendJSON(res, 400, { error: 'dateFrom and dateTo are required in YYYY-MM-DD format' });
    }

    (async () => {
      const db = pool.promise();
      const buildCommonFilters = () => {
        const conditions = ['a.appointment_date BETWEEN ? AND ?'];
        const params = [dateFrom, dateTo];

        if (doctorId) {
          conditions.push('a.doctor_id = ?');
          params.push(doctorId);
        }

        if (locationId) {
          conditions.push('a.location_id = ?');
          params.push(locationId);
        }

        if (normalizedStatusGroup === 'COMPLETED') {
          conditions.push("UPPER(s.status_name) = 'COMPLETED'");
        } else if (normalizedStatusGroup === 'SCHEDULED') {
          conditions.push("UPPER(s.status_name) IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')");
        } else if (normalizedStatusGroup === 'CANCELLED') {
          conditions.push("UPPER(s.status_name) IN ('CANCELED', 'CANCELLED')");
        } else if (normalizedStatusGroup === 'NO_SHOW') {
          conditions.push("UPPER(s.status_name) = 'NO_SHOW'");
        } else if (normalizedStatusGroup === 'MISSED') {
          conditions.push("UPPER(s.status_name) IN ('CANCELED', 'CANCELLED', 'NO_SHOW')");
        }

        if (normalizedPaymentStatus !== 'ALL') {
          conditions.push('UPPER(COALESCE(i.payment_status, \"\")) = ?');
          params.push(normalizedPaymentStatus);
        }

        if (normalizedPatientState !== 'ALL') {
          conditions.push('UPPER(COALESCE(p.p_state, \"\")) = ?');
          params.push(normalizedPatientState);
        }

        if (normalizedProcedureCode !== 'ALL') {
          conditions.push(`EXISTS (
            SELECT 1
            FROM treatment_plans tp
            WHERE tp.patient_id = a.patient_id
              AND tp.doctor_id = a.doctor_id
              AND DATE(tp.created_at) BETWEEN ? AND ?
              AND UPPER(COALESCE(tp.procedure_code, '')) = ?
          )`);
          params.push(dateFrom, dateTo, normalizedProcedureCode);
        }

        return {
          whereClause: conditions.join(' AND '),
          params
        };
      };

      const summaryFilters = buildCommonFilters();

      const [[summaryRow]] = await db.query(
        `SELECT
          COUNT(*) AS total_appointments,
          COUNT(DISTINCT a.patient_id) AS active_patients,
          SUM(CASE WHEN UPPER(s.status_name) = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('CANCELED', 'CANCELLED') THEN 1 ELSE 0 END) AS cancelled_appointments,
          SUM(CASE WHEN UPPER(s.status_name) = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED') THEN 1 ELSE 0 END) AS scheduled_appointments,
          COALESCE(SUM(i.amount), 0) AS total_production,
          COALESCE(SUM(i.patient_amount), 0) AS total_patient_responsibility,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS actual_payments,
          COALESCE(SUM(i.insurance_covered_amount), 0) AS insurance_covered,
          COALESCE(SUM(COALESCE(ref.total_refunded, 0)), 0) AS total_refunded,
          COALESCE(SUM(GREATEST(COALESCE(i.patient_amount, 0) - COALESCE(pay.total_paid, 0), 0)), 0) AS total_outstanding
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         LEFT JOIN (
           SELECT invoice_id, SUM(payment_amount) AS total_paid
           FROM payments
           GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.invoice_id
         LEFT JOIN (
           SELECT invoice_id, SUM(refund_amount) AS total_refunded
           FROM refunds
           GROUP BY invoice_id
         ) ref ON ref.invoice_id = i.invoice_id
         WHERE ${summaryFilters.whereClause}`,
        summaryFilters.params
      );

      const newPatientsFilters = buildCommonFilters();
      const [[newPatientsRow]] = await db.query(
        `SELECT COUNT(DISTINCT p.patient_id) AS total_new_patients
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         WHERE ${newPatientsFilters.whereClause}
           AND DATE(p.created_at) BETWEEN ? AND ?`,
        [...newPatientsFilters.params, dateFrom, dateTo]
      );

      const monthlyTrendFilters = buildCommonFilters();
      const [monthlyTrends] = await db.query(
        `SELECT
          DATE_FORMAT(a.appointment_date, '%Y-%m-01') AS period_key,
          DATE_FORMAT(a.appointment_date, '%b %Y') AS period_label,
          COUNT(*) AS total_appointments,
          SUM(CASE WHEN UPPER(s.status_name) = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('CANCELED', 'CANCELLED') THEN 1 ELSE 0 END) AS cancelled_appointments,
          SUM(CASE WHEN UPPER(s.status_name) = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN') THEN 1 ELSE 0 END) AS scheduled_appointments,
          COALESCE(SUM(i.amount), 0) AS total_production,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS patient_collected,
          COALESCE(SUM(i.insurance_covered_amount), 0) AS insurance_collected,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) + COALESCE(SUM(i.insurance_covered_amount), 0) AS total_collected,
          COALESCE(SUM(GREATEST(COALESCE(i.patient_amount, 0) - COALESCE(pay.total_paid, 0), 0)), 0) AS total_outstanding
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         LEFT JOIN (
           SELECT invoice_id, SUM(payment_amount) AS total_paid
           FROM payments
           GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.invoice_id
         LEFT JOIN (
           SELECT invoice_id, SUM(refund_amount) AS total_refunded
           FROM refunds
           GROUP BY invoice_id
         ) ref ON ref.invoice_id = i.invoice_id
         WHERE ${monthlyTrendFilters.whereClause}
         GROUP BY period_key, period_label
         ORDER BY period_key ASC`,
        monthlyTrendFilters.params
      );

      const providerFilters = buildCommonFilters();
      const [providerPerformance] = await db.query(
        `SELECT
          d.doctor_id,
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          st.phone_number,
          COUNT(*) AS total_appointments,
          SUM(CASE WHEN UPPER(s.status_name) = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('CANCELED', 'CANCELLED') THEN 1 ELSE 0 END) AS cancelled_appointments,
          SUM(CASE WHEN UPPER(s.status_name) = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_appointments,
          SUM(CASE WHEN UPPER(s.status_name) IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN') THEN 1 ELSE 0 END) AS scheduled_appointments,
          COALESCE(SUM(i.amount), 0) AS total_production,
          COALESCE(SUM(i.patient_amount), 0) AS total_patient_responsibility,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS patient_collected,
          COALESCE(SUM(i.insurance_covered_amount), 0) AS insurance_collected,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) + COALESCE(SUM(i.insurance_covered_amount), 0) AS total_collected,
          COALESCE(SUM(GREATEST(COALESCE(i.patient_amount, 0) - COALESCE(pay.total_paid, 0), 0)), 0) AS total_outstanding
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         JOIN doctors d ON d.doctor_id = a.doctor_id
         JOIN staff st ON st.staff_id = d.staff_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         LEFT JOIN (
           SELECT invoice_id, SUM(payment_amount) AS total_paid
           FROM payments
           GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.invoice_id
         LEFT JOIN (
           SELECT invoice_id, SUM(refund_amount) AS total_refunded
           FROM refunds
           GROUP BY invoice_id
         ) ref ON ref.invoice_id = i.invoice_id
         WHERE ${providerFilters.whereClause}
         GROUP BY d.doctor_id, st.first_name, st.last_name, st.phone_number
         ORDER BY total_production DESC, total_appointments DESC, st.last_name ASC`,
        providerFilters.params
      );

      const newPatientsTrendFilters = buildCommonFilters();
      const [newPatientsTrend] = await db.query(
        `SELECT
          DATE_FORMAT(p.created_at, '%Y-%m-01') AS period_key,
          DATE_FORMAT(p.created_at, '%b %Y') AS period_label,
          COUNT(DISTINCT p.patient_id) AS new_patients
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         WHERE ${newPatientsTrendFilters.whereClause}
           AND DATE(p.created_at) BETWEEN ? AND ?
         GROUP BY period_key, period_label
         ORDER BY period_key ASC`,
        [...newPatientsTrendFilters.params, dateFrom, dateTo]
      );

      const newPatientRowFilters = buildCommonFilters();
      const [newPatientRows] = await db.query(
        `SELECT
          p.patient_id,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          DATE(p.created_at) AS registered_date,
          DATE_FORMAT(p.created_at, '%Y-%m-01') AS period_key,
          p.p_phone,
          p.p_email,
          (SELECT COUNT(*) FROM appointments a2 WHERE a2.patient_id = p.patient_id) AS total_appointments,
          (SELECT CONCAT(st2.first_name, ' ', st2.last_name)
           FROM appointments a2
           JOIN doctors d2 ON d2.doctor_id = a2.doctor_id
           JOIN staff st2 ON st2.staff_id = d2.staff_id
           WHERE a2.patient_id = p.patient_id
           ORDER BY a2.appointment_date DESC
           LIMIT 1) AS doctor_name
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         WHERE ${newPatientRowFilters.whereClause}
           AND DATE(p.created_at) BETWEEN ? AND ?
         GROUP BY p.patient_id, p.p_first_name, p.p_last_name, p.created_at, p.p_phone, p.p_email
         ORDER BY p.created_at ASC`,
        [...newPatientRowFilters.params, dateFrom, dateTo]
      );

      const outstandingFilters = buildCommonFilters();
      const [outstandingPatients] = await db.query(
        `SELECT
          p.patient_id,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.p_phone,
          COUNT(DISTINCT i.invoice_id) AS total_invoices,
          COALESCE(SUM(i.amount), 0) AS total_charged,
          COALESCE(SUM(i.insurance_covered_amount), 0) AS insurance_covered,
          COALESCE(SUM(i.patient_amount), 0) AS patient_responsibility,
          COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS patient_paid,
          COALESCE(SUM(GREATEST(COALESCE(i.patient_amount, 0) - COALESCE(pay.total_paid, 0), 0)), 0) AS patient_due,
          MIN(DATE(p.created_at)) AS patient_since
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         LEFT JOIN (
           SELECT invoice_id, SUM(payment_amount) AS total_paid
           FROM payments
           GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.invoice_id
         LEFT JOIN (
           SELECT invoice_id, SUM(refund_amount) AS total_refunded
           FROM refunds
           GROUP BY invoice_id
         ) ref ON ref.invoice_id = i.invoice_id
         WHERE ${outstandingFilters.whereClause}
         GROUP BY p.patient_id, p.p_first_name, p.p_last_name, p.p_phone
         HAVING patient_due > 0
         ORDER BY patient_due DESC, patient_name ASC`,
        outstandingFilters.params
      );

      const apptRowFilters = buildCommonFilters();
      const [appointmentRows] = await db.query(
        `SELECT
          a.appointment_id,
          a.appointment_date,
          a.appointment_time,
          DATE_FORMAT(a.appointment_date, '%Y-%m-01') AS period_key,
          UPPER(s.status_name) AS status_name,
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          d.doctor_id,
          CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
          COALESCE(i.amount, 0) AS production,
          COALESCE(pay.total_paid, 0) AS patient_collected,
          COALESCE(i.insurance_covered_amount, 0) AS insurance_collected,
          COALESCE(pay.total_paid, 0) + COALESCE(i.insurance_covered_amount, 0) AS total_collected,
          GREATEST(COALESCE(i.patient_amount, 0) - COALESCE(pay.total_paid, 0), 0) AS outstanding
         FROM appointments a
         JOIN appointment_statuses s ON s.status_id = a.status_id
         JOIN patients p ON p.patient_id = a.patient_id
         JOIN doctors d ON d.doctor_id = a.doctor_id
         JOIN staff st ON st.staff_id = d.staff_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         LEFT JOIN (
           SELECT invoice_id, SUM(payment_amount) AS total_paid
           FROM payments
           GROUP BY invoice_id
         ) pay ON pay.invoice_id = i.invoice_id
         WHERE ${apptRowFilters.whereClause}
         ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
        apptRowFilters.params
      );

      const totalAppointments = Number(summaryRow?.total_appointments || 0);
      const completedAppointments = Number(summaryRow?.completed_appointments || 0);
      const cancelledAppointments = Number(summaryRow?.cancelled_appointments || 0);
      const noShowAppointments = Number(summaryRow?.no_show_appointments || 0);
      const totalProduction = Number(summaryRow?.total_production || 0);
      const actualPayments = Number(summaryRow?.actual_payments || 0);
      const insuranceCovered = Number(summaryRow?.insurance_covered || 0);
      const totalCollected = actualPayments + insuranceCovered; // Collected = actual payments + insurance coverage
      const totalRefunded = Number(summaryRow?.total_refunded || 0);
      const totalOutstanding = outstandingPatients.reduce((sum, row) => sum + Number(row.patient_due || 0), 0);
      const totalPatientResponsibility = Number(summaryRow?.total_patient_responsibility || 0);
      const netCollectionRate = totalProduction > 0
        ? Number(((totalCollected / totalProduction) * 100).toFixed(2))
        : 0;

      sendJSON(res, 200, {
        dateFrom,
        dateTo,
        filters: {
          doctorId,
          locationId,
          statusGroup: normalizedStatusGroup,
          paymentStatus: normalizedPaymentStatus,
          patientState: normalizedPatientState,
          procedureCode: normalizedProcedureCode
        },
        generatedAt: new Date().toISOString(),
        summary: {
          totalAppointments,
          activePatients: Number(summaryRow?.active_patients || 0),
          newPatients: Number(newPatientsRow?.total_new_patients || 0),
          completedAppointments,
          cancelledAppointments,
          noShowAppointments,
          scheduledAppointments: Number(summaryRow?.scheduled_appointments || 0),
          totalProduction,
          totalCollected,
          patientCollected: actualPayments,
          insuranceCollected: insuranceCovered,
          totalRefunded,
          netCollected: (actualPayments - totalRefunded) + insuranceCovered,
          totalPatientResponsibility,
          totalOutstanding,
          completionRate: totalAppointments > 0 ? Number(((completedAppointments / totalAppointments) * 100).toFixed(2)) : 0,
          cancellationRate: totalAppointments > 0 ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(2)) : 0,
          noShowRate: totalAppointments > 0 ? Number(((noShowAppointments / totalAppointments) * 100).toFixed(2)) : 0,
          collectionRate: netCollectionRate,
          avgProductionPerAppointment: totalAppointments > 0 ? Number((totalProduction / totalAppointments).toFixed(2)) : 0
        },
        monthlyTrends: monthlyTrends || [],
        providerPerformance: providerPerformance || [],
        newPatientsTrend: newPatientsTrend || [],
        newPatientRows: newPatientRows || [],
        outstandingPatients: outstandingPatients || [],
        appointmentRows: appointmentRows || []
      });
    })().catch((err) => {
      console.error('Error generating clinic performance report:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  function getRecallReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const asOfDate = String(parsedUrl.query.asOfDate || '').trim() || new Date().toISOString().slice(0, 10);
    const rawWindowDays = Number(parsedUrl.query.windowDays || 90);
    const windowDays = Number.isFinite(rawWindowDays) ? Math.max(1, Math.min(365, rawWindowDays)) : 90;
    const asOfDateValue = new Date(`${asOfDate}T00:00:00`);
    const cutoffDate = new Date(asOfDateValue.getTime() + (windowDays * 24 * 60 * 60 * 1000));
    const cutoffDateString = cutoffDate.toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return sendJSON(res, 400, { error: 'asOfDate must use YYYY-MM-DD format' });
    }

    (async () => {
      const db = pool.promise();
      const [columnRows] = await db.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'treatment_plans'`
      );
      const existingColumns = new Set(columnRows.map((row) => row.COLUMN_NAME));
      const hasContactAt = existingColumns.has('follow_up_contacted_at');
      const hasContactBy = existingColumns.has('follow_up_contacted_by');
      const hasContactNote = existingColumns.has('follow_up_contact_note');

      const contactedAtSelect = hasContactAt ? 'MAX(tp.follow_up_contacted_at) AS last_contacted_at' : 'NULL AS last_contacted_at';
      const contactedBySelect = hasContactBy ? 'MAX(tp.follow_up_contacted_by) AS last_contacted_by' : 'NULL AS last_contacted_by';
      const contactNoteSelect = hasContactNote ? 'MAX(tp.follow_up_contact_note) AS last_contact_note' : 'NULL AS last_contact_note';

      const [rows] = await db.query(
        `SELECT
          tp.patient_id,
          MIN(tp.follow_up_date) AS next_follow_up_date,
          COUNT(*) AS pending_follow_up_items,
          SUM(CASE WHEN tp.follow_up_date < ? THEN 1 ELSE 0 END) AS overdue_items,
          SUM(CASE WHEN tp.follow_up_date = ? THEN 1 ELSE 0 END) AS due_today_items,
          SUM(CASE WHEN DATEDIFF(tp.follow_up_date, ?) BETWEEN 1 AND 30 THEN 1 ELSE 0 END) AS due_30_items,
          SUM(CASE WHEN DATEDIFF(tp.follow_up_date, ?) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS due_60_items,
          SUM(CASE WHEN DATEDIFF(tp.follow_up_date, ?) >= 61 THEN 1 ELSE 0 END) AS due_90_plus_items,
          ${contactedAtSelect},
          ${contactedBySelect},
          ${contactNoteSelect},
          CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
          p.p_phone,
          p.p_email,
          (
            SELECT MIN(a.appointment_date)
            FROM appointments a
            JOIN appointment_statuses s ON s.status_id = a.status_id
            WHERE a.patient_id = tp.patient_id
              AND a.appointment_date >= ?
              AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')
          ) AS next_appointment_date,
          (
            SELECT s.status_name
            FROM appointments a
            JOIN appointment_statuses s ON s.status_id = a.status_id
            WHERE a.patient_id = tp.patient_id
              AND a.appointment_date >= ?
              AND s.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
            LIMIT 1
          ) AS next_appointment_status
         FROM treatment_plans tp
         JOIN patients p ON p.patient_id = tp.patient_id
         LEFT JOIN treatment_statuses ts ON ts.status_id = tp.status_id
         WHERE tp.follow_up_required = 1
           AND tp.follow_up_date IS NOT NULL
           AND (ts.status_name = 'COMPLETED' OR ts.status_name IS NULL)
           AND tp.follow_up_date <= ?
         GROUP BY tp.patient_id, p.p_first_name, p.p_last_name, p.p_phone, p.p_email
         ORDER BY next_follow_up_date ASC, p.p_last_name ASC, p.p_first_name ASC`,
        [asOfDate, asOfDate, asOfDate, asOfDate, asOfDate, asOfDate, asOfDate, cutoffDateString]
      );

      const today = asOfDateValue;
      const msPerDay = 24 * 60 * 60 * 1000;

      const items = (rows || []).map((row) => {
        const dueDate = row.next_follow_up_date ? new Date(`${String(row.next_follow_up_date).slice(0, 10)}T00:00:00`) : null;
        const daysUntilDue = dueDate ? Math.round((dueDate.getTime() - today.getTime()) / msPerDay) : null;

        const dueState = daysUntilDue == null
          ? 'UNKNOWN'
          : daysUntilDue < 0
            ? 'OVERDUE'
            : daysUntilDue === 0
              ? 'DUE_TODAY'
              : daysUntilDue <= 30
                ? 'DUE_30'
                : daysUntilDue <= 60
                  ? 'DUE_60'
                  : 'DUE_90_PLUS';

        const nextAppointmentDate = row.next_appointment_date ? String(row.next_appointment_date).slice(0, 10) : null;
        const isScheduled = Boolean(nextAppointmentDate);

        return {
          patientId: Number(row.patient_id || 0),
          patientName: row.patient_name || 'Unknown patient',
          phone: row.p_phone || null,
          email: row.p_email || null,
          followUpDate: row.next_follow_up_date ? String(row.next_follow_up_date).slice(0, 10) : null,
          dueState,
          daysUntilDue,
          pendingFollowUpItems: Number(row.pending_follow_up_items || 0),
          overdueItems: Number(row.overdue_items || 0),
          dueTodayItems: Number(row.due_today_items || 0),
          due30Items: Number(row.due_30_items || 0),
          due60Items: Number(row.due_60_items || 0),
          due90PlusItems: Number(row.due_90_plus_items || 0),
          nextAppointmentDate,
          nextAppointmentStatus: row.next_appointment_status || null,
          isScheduled,
          lastContactedAt: row.last_contacted_at || null,
          lastContactedBy: row.last_contacted_by || null,
          lastContactNote: row.last_contact_note || null,
          contactState: row.last_contacted_at ? 'CONTACTED' : 'UNCONTACTED'
        };
      });

      const summary = items.reduce((acc, item) => {
        acc.totalPatientsDue += 1;
        acc.pendingFollowUpItems += Number(item.pendingFollowUpItems || 0);
        if (item.dueState === 'OVERDUE') acc.overdue += 1;
        if (item.dueState === 'DUE_TODAY') acc.dueToday += 1;
        if (item.dueState === 'DUE_30') acc.due30 += 1;
        if (item.dueState === 'DUE_60') acc.due60 += 1;
        if (item.dueState === 'DUE_90_PLUS') acc.due90Plus += 1;
        if (item.isScheduled) acc.scheduled += 1;
        else acc.unscheduled += 1;
        if (item.contactState === 'CONTACTED') acc.contacted += 1;
        else acc.uncontacted += 1;
        return acc;
      }, {
        totalPatientsDue: 0,
        pendingFollowUpItems: 0,
        overdue: 0,
        dueToday: 0,
        due30: 0,
        due60: 0,
        due90Plus: 0,
        scheduled: 0,
        unscheduled: 0,
        contacted: 0,
        uncontacted: 0
      });

      sendJSON(res, 200, {
        asOfDate,
        windowDays,
        generatedAt: new Date().toISOString(),
        summary,
        totalRows: items.length,
        items
      });
    })().catch((err) => {
      console.error('Error generating recall report:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  function getCancelledAppointments(req, res) {
    pool.query(
      `SELECT
         a.appointment_id,
         a.appointment_date,
         a.appointment_time,
         CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
         CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
         CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location,
         cr.reason_text AS cancel_reason,
         a.updated_by AS cancelled_by,
         a.updated_at AS cancelled_at
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN appointment_statuses ast ON ast.status_id = a.status_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN staff st ON st.staff_id = d.staff_id
       LEFT JOIN cancel_reasons cr ON cr.reason_id = a.reason_id
       LEFT JOIN locations l ON l.location_id = a.location_id
       WHERE ast.status_name = 'CANCELLED'
       ORDER BY a.updated_at DESC
       LIMIT 200`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching cancelled appointments:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function getSystemCancelledAppointments(req, res) {
    pool.promise().query(
      `SELECT COUNT(*) AS column_count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME = 'rescheduled_from_appointment_id'`
    ).then(async ([[columnRow]]) => {
      const hasRescheduleLinkColumn = Number(columnRow?.column_count || 0) > 0;
      const baseSelectSql = `SELECT
         a.appointment_id,
         a.patient_id,
         a.appointment_date,
         a.appointment_time,
         CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
         p.p_email,
         p.p_phone,
         CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
         a.updated_at AS cancelled_at,
         a.updated_by AS cancelled_by${hasRescheduleLinkColumn ? ',\n         r.appointment_id AS rescheduled_appointment_id,\n         rs.status_name AS rescheduled_status_name' : ''}
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN appointment_statuses ast ON ast.status_id = a.status_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN staff st ON st.staff_id = d.staff_id${hasRescheduleLinkColumn ? '\n       LEFT JOIN appointments r ON r.rescheduled_from_appointment_id = a.appointment_id\n       LEFT JOIN appointment_statuses rs ON rs.status_id = r.status_id' : ''}
       WHERE ast.status_name = 'CANCELLED'
         AND a.updated_by IN ('SYSTEM_TIME_OFF', 'SYSTEM_DOCTOR_HIDDEN')
         AND a.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY a.updated_at DESC`;

      const [rows] = await pool.promise().query(baseSelectSql);
      const cancelledRows = rows || [];
      const [activePatientRows] = await pool.promise().query(
        `SELECT DISTINCT a.patient_id
         FROM appointments a
         JOIN appointment_statuses ast ON ast.status_id = a.status_id
         WHERE ast.status_name IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN')`
      );

      const activePatientIds = new Set((activePatientRows || []).map((row) => Number(row.patient_id)));
      const unresolvedPatientIds = new Set();
      const unresolvedTimeOffPatientIds = new Set();
      const unresolvedDoctorHiddenPatientIds = new Set();

      cancelledRows.forEach((row) => {
        const patientId = Number(row.patient_id);
        const replacementStatus = String(row.rescheduled_status_name || '').toUpperCase();
        const hasLinkedActiveReplacement = Boolean(row.rescheduled_appointment_id)
          && replacementStatus
          && !['CANCELLED', 'COMPLETED'].includes(replacementStatus);

        const isResolved = hasLinkedActiveReplacement || activePatientIds.has(patientId);
        row.is_resolved = isResolved;

        if (!isResolved) {
          unresolvedPatientIds.add(patientId);
          if (row.cancelled_by === 'SYSTEM_TIME_OFF') unresolvedTimeOffPatientIds.add(patientId);
          if (row.cancelled_by === 'SYSTEM_DOCTOR_HIDDEN') unresolvedDoctorHiddenPatientIds.add(patientId);
        }
      });

      sendJSON(res, 200, {
        items: cancelledRows,
        unresolvedCount: unresolvedPatientIds.size,
        unresolvedTimeOffCount: unresolvedTimeOffPatientIds.size,
        unresolvedDoctorHiddenCount: unresolvedDoctorHiddenPatientIds.size
      });
    }).catch((err) => {
      console.error('Error fetching system-cancelled appointments:', err);
      sendJSON(res, 500, { error: 'Database error' });
    });
  }

  return {
    getAdminDashboardSummary,
    getAdminAppointmentsQueue,
    getAdminFollowUpQueue,
    getAdminScheduledPatients,
    getAdminPatientsReport,
    getAdminStaffReport,
    getClinicPerformanceReport,
    getRecallReport,
    getAdminDoctors,
    createAdminDoctor,
    getAdminLocations,
    createAdminLocation,
    deleteAdminLocation,
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
    getNewPatientsReport,
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
    adminUpdateStaffSchedule,
    processRefund,
    getRefundHistory,
    getOverpaidInvoices,
    getInvoiceLookup,
    getCancelledAppointments,
    getSystemCancelledAppointments
  };

  // ── Staff Schedule Request Handlers ──

  function getClinicStartMinutes() {
    return 8 * 60;
  }

  function getClinicEndMinutes() {
    return 19 * 60;
  }

  function parseScheduleTimeToMinutes(rawTime) {
    const value = String(rawTime || '').trim();
    const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return (hour * 60) + minute;
  }

  function formatScheduleTimeHHMM(totalMinutes) {
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minute = String(totalMinutes % 60).padStart(2, '0');
    return `${hour}:${minute}`;
  }

  function coerceBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  function normalizeScheduleSubmissionPayload(data, req) {
    const payload = (data && typeof data === 'object') ? data : {};
    const queryStaffId = Number(url.parse(req.url, true)?.query?.staffId || 0);
    let source = payload.payload && typeof payload.payload === 'object' ? payload.payload : payload;

    // If body is parsed as a top-level entries array, preserve it and fallback staffId to query string.
    if (Array.isArray(payload)) {
      return {
        staffId: Number.isInteger(queryStaffId) && queryStaffId > 0 ? queryStaffId : 0,
        entries: payload.map((entry) => ({
          day: String(entry?.day || '').toUpperCase(),
          startTime: entry?.startTime == null ? null : String(entry.startTime),
          endTime: entry?.endTime == null ? null : String(entry.endTime),
          isOff: coerceBoolean(entry?.isOff)
        }))
      };
    }

    // Some parsers produce a single key where the key itself is JSON and value is ''.
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const keys = Object.keys(source);
      if (keys.length === 1 && (source[keys[0]] === '' || source[keys[0]] == null)) {
        const onlyKey = String(keys[0] || '').trim();
        if (onlyKey.startsWith('{') || onlyKey.startsWith('[') || /^%7B|%5B/i.test(onlyKey)) {
          try {
            const decoded = /^%7B|%5B/i.test(onlyKey) ? decodeURIComponent(onlyKey) : onlyKey;
            const parsedSingleKey = JSON.parse(decoded);
            if (parsedSingleKey && typeof parsedSingleKey === 'object') {
              source = parsedSingleKey;
            }
          } catch (_singleKeyErr) {
            // Continue with best-effort parsing below.
          }
        }
      }
    }

    let staffId = Number(source.staffId || source.staff_id || source.staffid || 0);
    let entries = Array.isArray(source.entries) ? source.entries : [];

    // Handle URL-encoded bracket keys like entries[0][day], entries[0][startTime], etc.
    if (!entries.length) {
      const rebuiltByIndex = {};
      Object.keys(source).forEach((key) => {
        const match = key.match(/^entries\[(\d+)\]\[(day|startTime|endTime|isOff)\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const field = match[2];
        if (!Number.isInteger(idx)) return;
        if (!rebuiltByIndex[idx]) rebuiltByIndex[idx] = {};
        rebuiltByIndex[idx][field] = source[key];
      });
      entries = Object.keys(rebuiltByIndex)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((idx) => rebuiltByIndex[idx]);
    }

    // Handle dotted notation keys like entries.0.day / entries.0.startTime
    if (!entries.length) {
      const rebuiltByIndex = {};
      Object.keys(source).forEach((key) => {
        const match = key.match(/^entries\.(\d+)\.(day|startTime|endTime|isOff)$/);
        if (!match) return;
        const idx = Number(match[1]);
        const field = match[2];
        if (!Number.isInteger(idx)) return;
        if (!rebuiltByIndex[idx]) rebuiltByIndex[idx] = {};
        rebuiltByIndex[idx][field] = source[key];
      });
      entries = Object.keys(rebuiltByIndex)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((idx) => rebuiltByIndex[idx]);
    }

    // Handle a single JSON string blob if client sent entries as serialized text.
    if (!entries.length && typeof source.entries === 'string') {
      try {
        const parsedEntries = JSON.parse(source.entries);
        if (Array.isArray(parsedEntries)) entries = parsedEntries;
      } catch (_err) {
        entries = [];
      }
    }

    const normalizedEntries = Array.isArray(entries)
      ? entries.map((entry) => ({
          day: String(entry?.day || '').toUpperCase(),
          startTime: entry?.startTime == null ? null : String(entry.startTime),
          endTime: entry?.endTime == null ? null : String(entry.endTime),
          isOff: coerceBoolean(entry?.isOff)
        }))
      : [];

    if ((!Number.isInteger(staffId) || staffId <= 0) && typeof payload.staffId === 'string' && /^\d+$/.test(payload.staffId)) {
      staffId = Number(payload.staffId);
    }

    if ((!Number.isInteger(staffId) || staffId <= 0) && Number.isInteger(queryStaffId) && queryStaffId > 0) {
      staffId = queryStaffId;
    }

    return {
      staffId,
      entries: normalizedEntries
    };
  }

  function submitScheduleRequest(req, data, res) {
    const { staffId, entries } = normalizeScheduleSubmissionPayload(data, req);
    if (!Number.isInteger(staffId) || staffId <= 0 || !entries.length) {
      const source = (data && typeof data === 'object') ? data : {};
      return sendJSON(res, 400, {
        error: 'staffId and entries[] are required',
        detail: {
          receivedKeys: Object.keys(source).slice(0, 20),
          receivedStaffId: source.staffId ?? source.staff_id ?? source.staffid ?? null,
          entriesType: Array.isArray(source.entries) ? 'array' : typeof source.entries
        }
      });
    }

    const VALID_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const rows = [];
    for (const e of entries) {
      const day = String(e.day || '').toUpperCase();
      const isOff = coerceBoolean(e.isOff);
      const startRaw = isOff ? null : String(e.startTime || '').trim();
      const endRaw = isOff ? null : String(e.endTime || '').trim();
      if (!VALID_DAYS.includes(day)) {
        return sendJSON(res, 400, { error: `Invalid day: ${day}` });
      }

      let start = null;
      let end = null;
      if (!isOff) {
        const startMinutes = parseScheduleTimeToMinutes(startRaw);
        const endMinutes = parseScheduleTimeToMinutes(endRaw);
        const outOfBounds = startMinutes === null
          || endMinutes === null
          || startMinutes < getClinicStartMinutes()
          || endMinutes > getClinicEndMinutes()
          || startMinutes >= endMinutes;

        if (outOfBounds) {
          return sendJSON(res, 400, { error: `Invalid entry: ${day} ${startRaw}-${endRaw}` });
        }

        start = formatScheduleTimeHHMM(startMinutes);
        end = formatScheduleTimeHHMM(endMinutes);
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
    // Find days/hours where no staff are scheduled vs clinic hours (08:00-19:00, Mon-Sat)
    const CLINIC_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const CLINIC_START = '08:00:00';
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
          for (let h = 8; h < 19; h++) {
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
        const startRaw = isOff ? null : String(e.startTime || '').trim() || null;
        const endRaw = isOff ? null : String(e.endTime || '').trim() || null;

        let start = null;
        let end = null;
        if (!isOff) {
          const startMinutes = parseScheduleTimeToMinutes(startRaw);
          const endMinutes = parseScheduleTimeToMinutes(endRaw);
          const outOfBounds = startMinutes === null
            || endMinutes === null
            || startMinutes < getClinicStartMinutes()
            || endMinutes > getClinicEndMinutes()
            || startMinutes >= endMinutes;
          if (outOfBounds) continue;

          start = formatScheduleTimeHHMM(startMinutes);
          end = formatScheduleTimeHHMM(endMinutes);
        }

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

  // ── Refund Handlers ──

  function processRefund(req, data, res) {
    const invoiceId = Number(data.invoiceId || 0);
    const refundAmount = Number(data.refundAmount || 0);
    const reason = String(data.reason || 'Treatment cost adjusted').trim();

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return sendJSON(res, 400, { error: 'Valid invoiceId is required' });
    }
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return sendJSON(res, 400, { error: 'Refund amount must be greater than 0' });
    }

    // Verify invoice exists and check paid amounts
    pool.query(
      `SELECT i.invoice_id, i.amount, i.patient_amount, i.insurance_covered_amount,
              COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS total_paid,
              COALESCE((SELECT SUM(r.refund_amount) FROM refunds r WHERE r.invoice_id = i.invoice_id), 0) AS total_refunded
       FROM invoices i WHERE i.invoice_id = ?`,
      [invoiceId],
      (err, rows) => {
        if (err) { console.error(err); return sendJSON(res, 500, { error: 'Database error' }); }
        if (!rows?.length) return sendJSON(res, 404, { error: 'Invoice not found' });

        const inv = rows[0];
        const netPaid = Number(inv.total_paid) - Number(inv.total_refunded);
        if (refundAmount > netPaid) {
          return sendJSON(res, 400, { error: `Refund amount ($${refundAmount.toFixed(2)}) exceeds net paid ($${netPaid.toFixed(2)})` });
        }

        pool.query(
          `INSERT INTO refunds (invoice_id, refund_amount, reason, refunded_by) VALUES (?, ?, ?, 'ADMIN')`,
          [invoiceId, refundAmount, reason],
          (refErr, refResult) => {
            if (refErr) { console.error(refErr); return sendJSON(res, 500, { error: 'Failed to process refund' }); }

            // Update invoice payment_status based on new net paid
            const newNetPaid = netPaid - refundAmount;
            const patientAmount = Number(inv.patient_amount);
            const newStatus = patientAmount <= 0 ? 'Paid'
              : newNetPaid >= patientAmount ? 'Paid'
              : newNetPaid > 0 ? 'Partial'
              : newNetPaid <= 0 ? 'Refunded' : 'Unpaid';

            pool.query(
              `UPDATE invoices SET payment_status = ?, updated_by = 'ADMIN_REFUND' WHERE invoice_id = ?`,
              [newStatus, invoiceId],
              (updErr) => {
                if (updErr) console.error('Error updating invoice status after refund:', updErr);
                sendJSON(res, 201, {
                  message: 'Refund processed successfully',
                  refundId: refResult.insertId,
                  refundAmount,
                  newPaymentStatus: newStatus
                });
              }
            );
          }
        );
      }
    );
  }

  function getInvoiceLookup(req, res, invoiceId) {
    pool.query(
      `SELECT i.invoice_id, i.amount, i.insurance_covered_amount, i.patient_amount, i.payment_status,
              CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
              a.appointment_date,
              COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS total_paid,
              COALESCE((SELECT SUM(r.refund_amount) FROM refunds r WHERE r.invoice_id = i.invoice_id), 0) AS total_refunded
       FROM invoices i
       JOIN appointments a ON a.appointment_id = i.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       WHERE i.invoice_id = ?`,
      [invoiceId],
      (err, rows) => {
        if (err) { console.error(err); return sendJSON(res, 500, { error: 'Database error' }); }
        if (!rows?.length) return sendJSON(res, 404, { error: 'Invoice not found' });
        const inv = rows[0];
        const netPaid = Number(inv.total_paid) - Number(inv.total_refunded);
        const patientAmount = Number(inv.patient_amount);
        const overpayment = netPaid > patientAmount ? Math.round((netPaid - patientAmount) * 100) / 100 : 0;
        sendJSON(res, 200, {
          ...inv,
          net_paid: netPaid,
          overpayment,
          max_refundable: Math.round(netPaid * 100) / 100
        });
      }
    );
  }

  function getOverpaidInvoices(req, res) {
    pool.query(
      `SELECT
         i.invoice_id,
         i.patient_amount,
         i.payment_status,
         i.updated_by,
         CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
         p.patient_id,
         a.appointment_date,
         COALESCE(CONCAT(st.first_name, ' ', st.last_name), '') AS doctor_name,
         COALESCE(SUM(pay.payment_amount), 0) AS total_paid,
         COALESCE((SELECT SUM(r.refund_amount) FROM refunds r WHERE r.invoice_id = i.invoice_id), 0) AS total_refunded
       FROM invoices i
       JOIN appointments a ON a.appointment_id = i.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       LEFT JOIN doctors doc ON doc.doctor_id = a.doctor_id
       LEFT JOIN staff st ON st.staff_id = doc.staff_id
       LEFT JOIN payments pay ON pay.invoice_id = i.invoice_id
       WHERE i.payment_status NOT IN ('Refunded')
       GROUP BY i.invoice_id, i.patient_amount, i.payment_status, i.updated_by,
                p.p_first_name, p.p_last_name, p.patient_id,
                a.appointment_date, st.first_name, st.last_name
       HAVING (total_paid - total_refunded) > i.patient_amount
       ORDER BY a.appointment_date DESC`,
      (err, rows) => {
        if (err) { console.error('Error fetching overpaid invoices:', err); return sendJSON(res, 500, { error: 'Database error' }); }
        const result = (rows || []).map((row) => {
          const netPaid = Number(row.total_paid) - Number(row.total_refunded);
          const overpayment = Math.round((netPaid - Number(row.patient_amount)) * 100) / 100;
          const updatedBy = String(row.updated_by || '');
          let reason = 'Payment exceeds invoice amount';
          if (updatedBy === 'DENTIST_PORTAL') reason = 'Treatment cost reduced by dentist after payment';
          else if (updatedBy === 'SYSTEM_AUTO') reason = 'Payment recorded above invoice total';
          return { ...row, net_paid: netPaid, overpayment, reason };
        });
        sendJSON(res, 200, result);
      }
    );
  }

  function getRefundHistory(req, res) {
    pool.query(
      `SELECT r.refund_id, r.invoice_id, r.refund_amount, r.reason, r.refunded_by, r.created_at,
              CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
              p.p_phone,
              i.amount AS invoice_total, i.patient_amount,
              a.appointment_date
       FROM refunds r
       JOIN invoices i ON i.invoice_id = r.invoice_id
       JOIN appointments a ON a.appointment_id = i.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       ORDER BY r.created_at DESC`,
      (err, rows) => {
        if (err) { console.error('Error fetching refund history:', err); return sendJSON(res, 500, { error: 'Database error' }); }
        sendJSON(res, 200, rows || []);
      }
    );
  }
}

module.exports = {
  createAdminHandlers
};
