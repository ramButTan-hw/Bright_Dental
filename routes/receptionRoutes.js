const url = require('url');

function createReceptionRoutes({ pool, sendJSON }) {
  function normalizeDateParam(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function normalizeOptionalFilter(value) {
    return String(value || '').trim();
  }

  function createReportFiltersFromQuery(query) {
    const fromDate = normalizeDateParam(query.fromDate);
    const toDate = normalizeDateParam(query.toDate);
    const procedureCode = normalizeOptionalFilter(query.procedureCode).toUpperCase();
    const toothNumber = normalizeOptionalFilter(query.toothNumber);
    const surface = normalizeOptionalFilter(query.surface).toUpperCase();

    if (!fromDate || !toDate) {
      return { error: 'fromDate and toDate are required in YYYY-MM-DD format' };
    }
    if (new Date(`${fromDate}T00:00:00`).getTime() > new Date(`${toDate}T00:00:00`).getTime()) {
      return { error: 'fromDate must be before or equal to toDate' };
    }

    return {
      fromDate,
      toDate,
      procedureCode,
      toothNumber,
      surface
    };
  }

  function fetchTreatmentRowsForReport({ patientId = null, fromDate, toDate, procedureCode, toothNumber, surface }, callback) {
    const includeAllPatients = !Number.isInteger(patientId) || patientId <= 0;
    pool.query(
      `SELECT
        tp.plan_id AS treatment_id,
        tp.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        tp.start_date AS visit_date,
        tp.procedure_code,
        apc.description AS treatment_description,
        tp.tooth_number,
        tp.surface,
        tp.estimated_cost AS treatment_cost,
        tp.notes,
        tp.created_at
      FROM treatment_plans tp
      JOIN patients p ON p.patient_id = tp.patient_id
      LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
      WHERE (? = TRUE OR tp.patient_id = ?)
        AND tp.start_date BETWEEN ? AND ?
        AND (? = '' OR tp.procedure_code = ?)
        AND (? = '' OR tp.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(tp.surface, '')) = ?)
      ORDER BY tp.start_date DESC, tp.created_at DESC, tp.plan_id DESC`,
      [includeAllPatients, patientId || 0, fromDate, toDate, procedureCode, procedureCode, toothNumber, toothNumber, surface, surface],
      (err, rows) => callback(err, rows || [])
    );
  }

  function fetchFindingRowsForReport({ patientId = null, fromDate, toDate, toothNumber, surface }, callback) {
    const includeAllPatients = !Number.isInteger(patientId) || patientId <= 0;
    pool.query(
      `SELECT
        df.patient_id,
        COALESCE(a.appointment_date, DATE(df.date_logged)) AS visit_date,
        GROUP_CONCAT(
          CONCAT(
            'Tooth ', COALESCE(df.tooth_number, 'N/A'),
            CASE WHEN COALESCE(df.surface, '') <> '' THEN CONCAT(' (', df.surface, ')') ELSE '' END,
            ': ', COALESCE(df.condition_type, 'Finding'),
            CASE WHEN COALESCE(df.notes, '') <> '' THEN CONCAT(' - ', df.notes) ELSE '' END
          )
          ORDER BY df.finding_id ASC SEPARATOR ' | '
        ) AS finding_summary
      FROM dental_findings df
      LEFT JOIN appointments a ON a.appointment_id = df.appointment_id
      WHERE (? = TRUE OR df.patient_id = ?)
        AND COALESCE(a.appointment_date, DATE(df.date_logged)) BETWEEN ? AND ?
        AND (? = '' OR df.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(df.surface, '')) = ?)
      GROUP BY df.patient_id, COALESCE(a.appointment_date, DATE(df.date_logged))
      ORDER BY visit_date DESC`,
      [includeAllPatients, patientId || 0, fromDate, toDate, toothNumber, toothNumber, surface, surface],
      (err, rows) => callback(err, rows || [])
    );
  }

  function buildGroupedReport(treatmentRows, findingRows) {
    const findingMap = new Map();
    findingRows.forEach((item) => {
      const dateKey = String(item.visit_date || '').slice(0, 10) || 'Unknown date';
      const key = `${Number(item.patient_id || 0)}::${dateKey}`;
      findingMap.set(key, String(item.finding_summary || ''));
    });

    const grouped = new Map();

    treatmentRows.forEach((row) => {
      const dateKey = String(row.visit_date || '').slice(0, 10) || 'Unknown date';
      const patientId = Number(row.patient_id || 0);
      const patientName = String(row.patient_name || 'Unknown patient');
      const groupKey = `${patientId}::${dateKey}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          patientId,
          patientName,
          visitDate: dateKey,
          visitCost: 0,
          entries: []
        });
      }

      const bucket = grouped.get(groupKey);
      const numericCost = Number(row.treatment_cost);
      if (Number.isFinite(numericCost) && numericCost > 0) {
        bucket.visitCost += numericCost;
      }

      bucket.entries.push({
        treatmentId: row.treatment_id,
        procedureCode: row.procedure_code,
        treatmentDescription: row.treatment_description,
        toothNumber: row.tooth_number,
        surface: row.surface,
        cost: Number.isFinite(numericCost) ? numericCost : 0,
        finding: findingMap.get(groupKey) || '',
        notes: row.notes,
        createdAt: row.created_at
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const dateCompare = String(b.visitDate).localeCompare(String(a.visitDate));
      if (dateCompare !== 0) return dateCompare;
      return a.patientName.localeCompare(b.patientName);
    });
  }

  function getReceptionSinglePatientReport(req, res) {
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
        console.error('Error generating reception single-patient treatment report:', treatmentErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      fetchFindingRowsForReport({ patientId, ...filters }, (findingErr, findingRows) => {
        if (findingErr) {
          console.error('Error generating reception single-patient finding report:', findingErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        const groupedVisits = buildGroupedReport(treatmentRows, findingRows);
        const totalCost = groupedVisits.reduce((sum, visit) => sum + Number(visit.visitCost || 0), 0);

        return sendJSON(res, 200, {
          reportType: 'RECEPTION_SINGLE_PATIENT_TREATMENT_FINDING',
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

  function fetchAppointmentRowsForReport({ patientId = null, fromDate, toDate, status, reason, preferredLocation }, callback) {
    const includeAllPatients = !Number.isInteger(patientId) || patientId <= 0;
    const safeStatus = String(status || '').trim().toUpperCase();
    const safeReason = String(reason || '').trim();
    const safeLocation = String(preferredLocation || '').trim();

    pool.query(
      `SELECT
        a.appointment_id,
        a.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
        a.appointment_time,
        ast.status_name,
        ast.display_name AS status_display,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
        a.notes,
        a.created_at,
        COALESCE(i.patient_amount, 0) AS amount_billed,
        i.payment_status,
        COALESCE((SELECT SUM(pay.payment_amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id), 0) AS amount_paid
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN appointment_statuses ast ON ast.status_id = a.status_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN staff st ON st.staff_id = d.staff_id
      LEFT JOIN locations l ON l.location_id = a.location_id
      LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
      WHERE (? = TRUE OR a.patient_id = ?)
        AND a.appointment_date BETWEEN ? AND ?
        AND (? = '' OR ast.status_name = ?)
        AND (? = '' OR a.notes LIKE CONCAT('%', ?, '%'))
        AND (? = '' OR CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) LIKE CONCAT('%', ?, '%'))
      ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [includeAllPatients, patientId || 0, fromDate, toDate, safeStatus, safeStatus, safeReason, safeReason, safeLocation, safeLocation],
      (err, rows) => callback(err, rows || [])
    );
  }

  function buildAppointmentReport(rows, reportType) {
    const today = new Date().toISOString().slice(0, 10);
    const appointments = rows.map((row) => {
      const billed = Number(row.amount_billed || 0);
      const paid = Number(row.amount_paid || 0);
      return {
        appointmentId: row.appointment_id,
        patientId: row.patient_id,
        patientName: row.patient_name,
        appointmentDate: String(row.appointment_date || '').slice(0, 10),
        appointmentTime: row.appointment_time,
        status: row.status_name,
        statusDisplay: row.status_display,
        doctorName: row.doctor_name,
        location: row.location_address || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        amountBilled: billed,
        amountPaid: paid,
        amountOwed: Math.max(0, billed - paid),
        paymentStatus: row.payment_status || null
      };
    });

    const uniquePatients = new Set(appointments.map((a) => a.patientId));
    const noShows = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const cancellations = appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'CANCELED').length;
    const pastAppts = appointments.filter((a) => a.appointmentDate < today && a.status === 'COMPLETED');
    const upcomingAppts = appointments.filter((a) => a.appointmentDate >= today);
    const lastVisitDate = pastAppts.length ? pastAppts[0].appointmentDate : null;
    const nextUpcomingDate = upcomingAppts.length ? upcomingAppts[upcomingAppts.length - 1].appointmentDate : null;
    const totalBilled = appointments.reduce((sum, a) => sum + a.amountBilled, 0);
    const totalCollected = appointments.reduce((sum, a) => sum + a.amountPaid, 0);

    return {
      reportType,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPatients: uniquePatients.size,
        totalAppointments: appointments.length,
        noShows,
        cancellations,
        lastVisitDate,
        nextUpcomingDate,
        totalBilled,
        totalCollected,
        totalOwed: Math.max(0, totalBilled - totalCollected)
      },
      appointments
    };
  }

  function getReceptionSinglePatientApptReport(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const patientId = Number(parsedUrl.query.patientId || 0);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return sendJSON(res, 400, { error: 'A valid patientId is required' });
    }

    const fromDate = normalizeDateParam(parsedUrl.query.fromDate);
    const toDate = normalizeDateParam(parsedUrl.query.toDate);
    if (!fromDate || !toDate) {
      return sendJSON(res, 400, { error: 'fromDate and toDate are required in YYYY-MM-DD format' });
    }
    if (new Date(`${fromDate}T00:00:00`).getTime() > new Date(`${toDate}T00:00:00`).getTime()) {
      return sendJSON(res, 400, { error: 'fromDate must be before or equal to toDate' });
    }

    const status = normalizeOptionalFilter(parsedUrl.query.status);
    const reason = normalizeOptionalFilter(parsedUrl.query.reason);

    fetchAppointmentRowsForReport({ patientId, fromDate, toDate, status, reason, preferredLocation: '' }, (err, rows) => {
      if (err) {
        console.error('Error generating single-patient appointment report:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      const report = buildAppointmentReport(rows, 'RECEPTION_SINGLE_PATIENT_APPOINTMENT');
      report.filters = { patientId, fromDate, toDate, status, reason };
      return sendJSON(res, 200, report);
    });
  }

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

    if (slotRows?.length) {
      slotId = Number(slotRows[0].slot_id);
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

    // Trigger trg_appointments_sync_slot_on_insert auto-updates current_bookings and is_available

    return {
      appointmentId: Number(appointmentInsert.insertId),
      slotId
    };
  }

  function getReceptionDoctors(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const locationId = parsedUrl.query.locationId ? Number(parsedUrl.query.locationId) : null;

    const baseQuery = `SELECT
        d.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
        st.phone_number,
        COALESCE(GROUP_CONCAT(DISTINCT dept.department_name ORDER BY dept.department_name SEPARATOR ', '), 'General Dentistry') AS specialties,
        GROUP_CONCAT(DISTINCT sl.location_id ORDER BY sl.location_id SEPARATOR ',') AS location_ids,
        GROUP_CONCAT(DISTINCT CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) ORDER BY sl.location_id SEPARATOR ' | ') AS location_names
      FROM doctors d
      JOIN staff st ON st.staff_id = d.staff_id
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN specialties_department sd ON sd.doctor_id = d.doctor_id
      LEFT JOIN departments dept ON dept.department_id = sd.department_id
      LEFT JOIN staff_locations sl ON sl.staff_id = st.staff_id
      LEFT JOIN locations l ON l.location_id = sl.location_id
      WHERE COALESCE(u.is_deleted, 0) = 0
      ${locationId ? 'AND sl.location_id = ?' : ''}
      GROUP BY d.doctor_id, st.first_name, st.last_name, st.phone_number
      ORDER BY st.last_name ASC, st.first_name ASC`;

    const params = locationId ? [locationId] : [];
    pool.query(baseQuery, params, (err, rows) => {
      if (err) {
        console.error('Error fetching reception doctors:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, rows || []);
    });
  }

  const APPOINTMENT_SELECT_SQL = `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
      a.reason_id,
      cr.reason_text AS cancel_reason,
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
      LEFT JOIN cancel_reasons cr ON cr.reason_id = a.reason_id
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
        AND UPPER(ast.status_name) = 'COMPLETED'
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

  function getReceptionCancelledAppointments(req, res) {
    pool.query(
      `${APPOINTMENT_SELECT_SQL}
      WHERE ast.status_name = 'CANCELLED'
      ORDER BY a.appointment_date DESC, a.appointment_time DESC, patient_name ASC
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
          const confirmedStatusId = await getAppointmentStatusId(conn, 'CHECKED_IN');
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

  function markNoShowReceptionAppointment(req, appointmentId, res) {
    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting connection for no-show:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction(async (txErr) => {
        if (txErr) {
          conn.release();
          return sendJSON(res, 500, { error: 'Database error' });
        }

        try {
          const noShowStatusId = await getAppointmentStatusId(conn, 'NO_SHOW');
          const [updateResult] = await conn.promise().query(
            `UPDATE appointments
             SET status_id = ?, updated_by = 'RECEPTION_PORTAL'
             WHERE appointment_id = ?`,
            [noShowStatusId, appointmentId]
          );

          if (!updateResult.affectedRows) {
            throw new Error('Appointment not found');
          }

          conn.commit((commitErr) => {
            conn.release();
            if (commitErr) {
              console.error('Error committing no-show:', commitErr);
              return sendJSON(res, 500, { error: 'Database error' });
            }
            return sendJSON(res, 200, { message: 'Appointment marked as no-show' });
          });
        } catch (error) {
          conn.rollback(() => {
            conn.release();
            if (error.message === 'Appointment not found') {
              return sendJSON(res, 404, { error: error.message });
            }
            console.error('Error marking appointment as no-show:', error);
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

  function searchReceptionPatientAppointmentHistory(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const query = String(parsedUrl.query.query || '').trim();
    const sqlLike = `%${query}%`;
    const numericPatientId = Number.isFinite(Number(query)) ? Number(query) : 0;

    if (!query) {
      return sendJSON(res, 200, []);
    }

    pool.query(
      `SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        ast.status_name,
        ast.display_name AS appointment_status,
        a.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        a.doctor_id,
        CONCAT(st.first_name, ' ', st.last_name) AS doctor_name
      FROM appointments a
      LEFT JOIN appointment_statuses ast ON ast.status_id = a.status_id
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN staff st ON st.staff_id = d.staff_id
      WHERE p.patient_id IN (
        SELECT p2.patient_id
        FROM patients p2
        WHERE CONCAT(p2.p_first_name, ' ', p2.p_last_name) LIKE ?
           OR p2.p_phone LIKE ?
           OR p2.p_email LIKE ?
           OR p2.p_ssn LIKE ?
           OR (? > 0 AND p2.patient_id = ?)
      )
      ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC
      LIMIT 500`,
      [sqlLike, sqlLike, sqlLike, sqlLike, numericPatientId, numericPatientId],
      (err, rows) => {
        if (err) {
          console.error('Error searching reception patient appointment history:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        return sendJSON(res, 200, rows || []);
      }
    );
  }

  function getReceptionPatientAppointments(req, patientId, res) {
    pool.query(
      `${APPOINTMENT_SELECT_SQL}
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT 200`,
      [patientId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching patient appointments:', err);
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
            ic.company_name,
            ic.phone_number AS company_phone,
            ic.fax_number AS company_fax,
            ic.address AS company_address,
            ic.city AS company_city,
            ic.state AS company_state,
            ic.zipcode AS company_zipcode,
            ic.website AS company_website,
            ic.contact_name AS company_contact
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
              `SELECT
                pp.patient_pharmacy_id,
                pp.is_primary,
                ph.pharm_id,
                ph.pharm_name,
                ph.pharm_phone,
                ph.ph_address_1,
                ph.ph_address_2,
                ph.ph_city,
                ph.ph_state,
                ph.ph_zipcode
              FROM patient_pharmacies pp
              JOIN pharmacies ph ON ph.pharm_id = pp.pharm_id
              WHERE pp.patient_id = ?
              ORDER BY pp.is_primary DESC, ph.pharm_name ASC`,
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

                        pool.query(
                          `SELECT
                            df.finding_id,
                            df.tooth_number,
                            df.surface,
                            df.condition_type,
                            df.notes,
                            df.date_logged,
                            a.appointment_date
                          FROM dental_findings df
                          LEFT JOIN appointments a ON a.appointment_id = df.appointment_id
                          WHERE df.patient_id = ?
                          ORDER BY df.date_logged DESC
                          LIMIT 100`,
                          [patientId],
                          (findingErr, findingRows) => {
                            if (findingErr) {
                              console.error('Error fetching dental findings:', findingErr);
                              return sendJSON(res, 500, { error: 'Database error' });
                            }

                            pool.query(
                              `SELECT
                                apr.preference_request_id,
                                apr.preferred_date,
                                apr.preferred_time,
                                apr.preferred_location,
                                apr.appointment_reason,
                                apr.request_status,
                                apr.assigned_doctor_id,
                                CONCAT(st.first_name, ' ', st.last_name) AS assigned_doctor_name,
                                apr.assigned_date,
                                apr.assigned_time,
                                apr.receptionist_notes,
                                apr.created_at
                              FROM appointment_preference_requests apr
                              LEFT JOIN doctors d ON d.doctor_id = apr.assigned_doctor_id
                              LEFT JOIN staff st ON st.staff_id = d.staff_id
                              WHERE apr.patient_id = ? AND apr.request_status IN ('PREFERRED_PENDING', 'ASSIGNED')
                              ORDER BY apr.created_at DESC`,
                              [patientId],
                              (prefErr, prefRows) => {
                                if (prefErr) {
                                  console.error('Error fetching patient preference requests:', prefErr);
                                  return sendJSON(res, 500, { error: 'Database error' });
                                }

                                pool.query(
                                  `SELECT
                                    rx.prescription_id,
                                    rx.medication_name,
                                    rx.strength,
                                    rx.dosage,
                                    rx.frequency,
                                    rx.instructions,
                                    rx.date_prescribed,
                                    rx.start_date,
                                    rx.end_date,
                                    rx.quantity,
                                    rx.refills,
                                    CONCAT(st2.first_name, ' ', st2.last_name) AS prescribing_doctor,
                                    ph2.pharm_name AS pharmacy_name
                                  FROM prescriptions rx
                                  LEFT JOIN doctors d2 ON d2.doctor_id = rx.doctor_id
                                  LEFT JOIN staff st2 ON st2.staff_id = d2.staff_id
                                  LEFT JOIN pharmacies ph2 ON ph2.pharm_id = rx.pharm_id
                                  WHERE rx.patient_id = ?
                                  ORDER BY rx.date_prescribed DESC, rx.prescription_id DESC
                                  LIMIT 50`,
                                  [patientId],
                                  (rxErr, rxRows) => {
                                    if (rxErr) {
                                      console.error('Error fetching patient prescriptions:', rxErr);
                                    }

                                    return sendJSON(res, 200, {
                                      patient: patientRows[0],
                                      insurance: insuranceRows || [],
                                      pharmacies: pharmacyRows || [],
                                      treatments: treatmentRows || [],
                                      intakeSnapshot,
                                      dentalFindings: findingRows || [],
                                      pendingRequests: prefRows || [],
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
        );
      }
    );
  }

  function getReceptionProfile(req, res) {
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
      WHERE u.user_id = ?
        AND u.user_role = 'RECEPTIONIST'
        AND u.is_deleted = 0
      LIMIT 1`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching receptionist profile:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (!rows?.length) {
          return sendJSON(res, 404, { error: 'Receptionist profile not found' });
        }
        return sendJSON(res, 200, rows[0]);
      }
    );
  }

  function updateReceptionProfile(req, data, res) {
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

    if ((emergencyContactName && !emergencyContactPhone) || (!emergencyContactName && emergencyContactPhone)) {
      return sendJSON(res, 400, { error: 'Emergency contact name and phone must both be provided together' });
    }

    pool.getConnection((connErr, conn) => {
      if (connErr) {
        console.error('Error getting DB connection for receptionist profile update:', connErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          console.error('Error starting transaction for receptionist profile update:', txErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        conn.query(
          `SELECT st.staff_id
           FROM staff st
           JOIN users u ON u.user_id = st.user_id
           WHERE u.user_id = ?
             AND u.user_role = 'RECEPTIONIST'
             AND u.is_deleted = 0
           LIMIT 1`,
          [userId],
          (profileErr, profileRows) => {
            if (profileErr || !profileRows?.length) {
              return conn.rollback(() => {
                conn.release();
                if (profileErr) {
                  console.error('Error resolving receptionist profile mapping:', profileErr);
                  return sendJSON(res, 500, { error: 'Database error' });
                }
                return sendJSON(res, 404, { error: 'Receptionist profile not found' });
              });
            }

            const staffId = profileRows[0].staff_id;
            conn.query(
              `UPDATE users
               SET user_email = ?, user_phone = ?
               WHERE user_id = ?`,
              [email, phone || null, userId],
              (userErr) => {
                if (userErr) {
                  return conn.rollback(() => {
                    conn.release();
                    if (userErr.code === 'ER_DUP_ENTRY') {
                      return sendJSON(res, 409, { error: 'Email or phone already exists' });
                    }
                    console.error('Error updating users table for receptionist profile:', userErr);
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
                       updated_by = 'RECEPTION_PORTAL'
                   WHERE staff_id = ?`,
                  [
                    firstName,
                    lastName,
                    phone || null,
                    dateOfBirth || null,
                    address || null,
                    city || null,
                    state || null,
                    zipcode || null,
                    country || null,
                    emergencyContactName || null,
                    formattedEmergencyContactPhone || null,
                    staffId
                  ],
                  (staffErr) => {
                    if (staffErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error('Error updating staff table for receptionist profile:', staffErr);
                        return sendJSON(res, 500, { error: 'Database error' });
                      });
                    }

                    conn.commit((commitErr) => {
                      conn.release();
                      if (commitErr) {
                        console.error('Error committing receptionist profile update:', commitErr);
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

  function getAllPharmacies(req, res) {
    pool.query(
      `SELECT pharm_id, pharm_name, pharm_phone, ph_address_1, ph_address_2, ph_city, ph_state, ph_zipcode
       FROM pharmacies ORDER BY pharm_name ASC`,
      (err, rows) => {
        if (err) {
          console.error('Error fetching pharmacies:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, rows || []);
      }
    );
  }

  function assignPatientPharmacy(req, patientId, data, res) {
    const pharmId = Number(data?.pharmId);
    const isPrimary = data?.isPrimary ? 1 : 0;
    if (!pharmId || pharmId <= 0) {
      return sendJSON(res, 400, { error: 'A valid pharmacy is required' });
    }
    pool.query(
      `INSERT INTO patient_pharmacies (patient_id, pharm_id, is_primary)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)`,
      [patientId, pharmId, isPrimary],
      (err) => {
        if (err) {
          console.error('Error assigning pharmacy:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 200, { message: 'Pharmacy assigned.' });
      }
    );
  }

  function removePatientPharmacy(req, patientId, pharmId, res) {
    pool.query(
      `DELETE FROM patient_pharmacies WHERE patient_id = ? AND pharm_id = ?`,
      [patientId, pharmId],
      (err, result) => {
        if (err) {
          console.error('Error removing pharmacy:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        if (result.affectedRows === 0) {
          return sendJSON(res, 404, { error: 'Pharmacy assignment not found' });
        }
        sendJSON(res, 200, { message: 'Pharmacy removed.' });
      }
    );
  }

  function createPrescription(req, patientId, data, res) {
    const medicationName = String(data?.medicationName || '').trim();
    const strength = String(data?.strength || '').trim();
    const dosage = String(data?.dosage || '').trim();
    const frequency = String(data?.frequency || '').trim();
    const instructions = String(data?.instructions || '').trim();
    const startDate = String(data?.startDate || '').trim() || null;
    const endDate = String(data?.endDate || '').trim() || null;
    const quantity = Number(data?.quantity) || 0;
    const refills = Number(data?.refills) || 0;
    const pharmId = Number(data?.pharmId);
    const doctorId = Number(data?.doctorId);

    if (!medicationName) return sendJSON(res, 400, { error: 'Medication name is required.' });
    if (!Number.isInteger(pharmId) || pharmId <= 0) return sendJSON(res, 400, { error: 'A pharmacy is required.' });
    if (!Number.isInteger(doctorId) || doctorId <= 0) return sendJSON(res, 400, { error: 'A prescribing doctor is required.' });

    pool.query(
      `INSERT INTO prescriptions
        (patient_id, pharm_id, doctor_id, medication_name, strength, dosage, frequency, instructions,
         date_prescribed, start_date, end_date, quantity, refills, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'RECEPTION', 'RECEPTION')`,
      [patientId, pharmId, doctorId, medicationName, strength || null, dosage || null, frequency || null, instructions || null, startDate, endDate, quantity, refills],
      (err, result) => {
        if (err) {
          console.error('Error creating prescription:', err);
          return sendJSON(res, 500, { error: 'Database error' });
        }
        sendJSON(res, 201, { message: 'Prescription created.', prescriptionId: Number(result.insertId) });
      }
    );
  }

  function handleReceptionRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'profile') {
      getReceptionProfile(req, res);
      return true;
    }

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'profile') {
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return updateReceptionProfile(req, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'reports' && parts[3] === 'patient') {
      getReceptionSinglePatientReport(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'reports' && parts[3] === 'patient-appointments') {
      getReceptionSinglePatientApptReport(req, res);
      return true;
    }

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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && parts[3] === 'cancelled') {
      getReceptionCancelledAppointments(req, res);
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

    if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'appointments' && parts[3] && parts[4] === 'no-show') {
      const appointmentId = Number(parts[3]);
      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        sendJSON(res, 400, { error: 'A valid appointment id is required' });
        return true;
      }
      markNoShowReceptionAppointment(req, appointmentId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] === 'search') {
      searchReceptionPatients(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] === 'appointments' && parts[4] === 'search') {
      searchReceptionPatientAppointmentHistory(req, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && parts[4] === 'appointments' && !parts[5]) {
      const patientId = Number(parts[3]);
      if (!Number.isInteger(patientId) || patientId <= 0) {
        sendJSON(res, 400, { error: 'A valid patient id is required' });
        return true;
      }
      getReceptionPatientAppointments(req, patientId, res);
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

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'pharmacies') {
      getAllPharmacies(req, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && parts[4] === 'pharmacy') {
      const patientId = Number(parts[3]);
      if (!Number.isInteger(patientId) || patientId <= 0) {
        sendJSON(res, 400, { error: 'A valid patient id is required' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
        return assignPatientPharmacy(req, patientId, data, res);
      });
      return true;
    }

    if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && parts[4] === 'pharmacy' && parts[5]) {
      const patientId = Number(parts[3]);
      const pharmId = Number(parts[5]);
      if (!Number.isInteger(patientId) || patientId <= 0 || !Number.isInteger(pharmId) || pharmId <= 0) {
        sendJSON(res, 400, { error: 'Valid patient and pharmacy ids are required' });
        return true;
      }
      removePatientPharmacy(req, patientId, pharmId, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'reception' && parts[2] === 'patients' && parts[3] && parts[4] === 'prescriptions') {
      const patientId = Number(parts[3]);
      if (!Number.isInteger(patientId) || patientId <= 0) {
        sendJSON(res, 400, { error: 'A valid patient id is required' });
        return true;
      }
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return createPrescription(req, patientId, data, res);
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
