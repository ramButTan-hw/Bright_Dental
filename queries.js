

const queries = {
  // Get patient by ID with full profile
  getPatientById: `
    SELECT
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
      COUNT(DISTINCT a.appointment_id) AS total_appointments,
      COUNT(DISTINCT i.invoice_id) AS total_invoices,
      p.created_at AS patient_since,
      p.updated_at
    FROM patients p
    LEFT JOIN appointments a ON p.patient_id = a.patient_id
    LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
    WHERE p.patient_id = ?
    GROUP BY p.patient_id
  `,

  // Get patient profile by user id (for patient portal login resolution)
  getPatientByUserId: `
    SELECT
      p.patient_id,
      p.user_id,
      p.p_first_name,
      p.p_last_name,
      p.p_email,
      p.p_phone,
      p.created_at
    FROM patients p
    WHERE p.user_id = ?
    LIMIT 1
  `,

  // List doctor's appointments this month
  getDoctorAppointments: `
    SELECT
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      a.appt_status,
      a.cancel_reason,
      p.patient_id,
      CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
      p.p_phone,
      p.p_email,
      l.location_city,
      l.location_state,
      l.location_id,
      i.invoice_id,
      i.payment_status,
      i.patient_amount,
      i.amount AS total_invoice_amount
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.patient_id
    LEFT JOIN locations l ON a.location_id = l.location_id
    LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
    WHERE a.doctor_id = ?
      AND YEAR(a.appointment_date) = YEAR(NOW())
      AND MONTH(a.appointment_date) = MONTH(NOW())
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
  `,

  // Get patient billing summary (using report view)
  getPatientBilling: `
    SELECT * FROM vw_report_patient_billing WHERE patient_id = ?
  `,

  // List patient appointments with doctor and location details
  getPatientAppointments: `
    SELECT
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      ast.status_name,
      ast.display_name AS appointment_status,
      a.notes,
      a.created_at,
      d.doctor_id,
      CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
      l.location_id,
      CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
      i.invoice_id,
      i.amount AS invoice_total,
      i.patient_amount,
      i.insurance_covered_amount,
      i.payment_status
    FROM appointments a
    LEFT JOIN appointment_statuses ast ON a.status_id = ast.status_id
    LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
    LEFT JOIN staff st ON d.staff_id = st.staff_id
    LEFT JOIN locations l ON a.location_id = l.location_id
    LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
    WHERE a.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `,

  // List patient-submitted appointment preference requests
  getPatientAppointmentRequests: `
    SELECT
      apr.preference_request_id,
      apr.preferred_date,
      apr.preferred_time,
      apr.preferred_location,
      apr.available_days,
      apr.available_times,
      apr.appointment_reason,
      apr.request_status,
      apr.assigned_date,
      apr.assigned_time,
      apr.receptionist_notes,
      apr.created_at
    FROM appointment_preference_requests apr
    WHERE apr.patient_id = ?
    ORDER BY apr.created_at DESC
  `,

  // List all invoices for a patient with appointment context
  getPatientInvoices: `
    SELECT
      i.invoice_id,
      i.amount,
      i.insurance_covered_amount,
      i.patient_amount,
      COALESCE(SUM(pay.payment_amount), 0) AS amount_paid,
      GREATEST(i.patient_amount - COALESCE(SUM(pay.payment_amount), 0), 0) AS amount_due,
      i.payment_status,
      i.created_at,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time
    FROM invoices i
    JOIN appointments a ON i.appointment_id = a.appointment_id
    LEFT JOIN payments pay ON pay.invoice_id = i.invoice_id
    WHERE a.patient_id = ?
    GROUP BY
      i.invoice_id,
      i.amount,
      i.insurance_covered_amount,
      i.patient_amount,
      i.payment_status,
      i.created_at,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time
    ORDER BY i.created_at DESC
  `,

  // Get one invoice with appointment context and running payment totals
  getPatientInvoiceById: `
    SELECT
      i.invoice_id,
      i.insurance_id,
      i.amount,
      i.insurance_covered_amount,
      i.patient_amount,
      COALESCE(SUM(pay.payment_amount), 0) AS amount_paid,
      GREATEST(i.patient_amount - COALESCE(SUM(pay.payment_amount), 0), 0) AS amount_due,
      i.payment_status,
      i.created_at,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time
    FROM invoices i
    JOIN appointments a ON i.appointment_id = a.appointment_id
    LEFT JOIN payments pay ON pay.invoice_id = i.invoice_id
    WHERE a.patient_id = ? AND i.invoice_id = ?
    GROUP BY
      i.invoice_id,
      i.insurance_id,
      i.amount,
      i.insurance_covered_amount,
      i.patient_amount,
      i.payment_status,
      i.created_at,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time
    LIMIT 1
  `,

  // Get one invoice totals for payment validation (transaction-safe)
  getPatientInvoiceForPayment: `
    SELECT
      i.invoice_id,
      i.patient_amount,
      COALESCE(SUM(pay.payment_amount), 0) AS amount_paid
    FROM invoices i
    JOIN appointments a ON i.appointment_id = a.appointment_id
    LEFT JOIN payments pay ON pay.invoice_id = i.invoice_id
    WHERE a.patient_id = ? AND i.invoice_id = ?
    GROUP BY i.invoice_id, i.patient_amount
    LIMIT 1
    FOR UPDATE
  `,

  // List payments for an invoice
  getInvoicePayments: `
    SELECT
      p.payment_id,
      p.payment_amount,
      p.payment_date,
      p.method_id,
      pm.method_name,
      pm.display_name AS payment_method,
      p.reference_number,
      p.notes,
      p.created_at
    FROM payments p
    JOIN payment_methods pm ON p.method_id = pm.method_id
    WHERE p.invoice_id = ?
    ORDER BY p.payment_date DESC, p.payment_id DESC
  `,

  // Active payment methods for checkout UI
  getActivePaymentMethods: `
    SELECT method_id, method_name, display_name
    FROM payment_methods
    WHERE is_active = 1
    ORDER BY method_id ASC
  `,

  // Validate selected payment method is active
  getActivePaymentMethodById: `
    SELECT method_id
    FROM payment_methods
    WHERE method_id = ? AND is_active = 1
    LIMIT 1
  `,

  // Create payment record
  createPayment: `
    INSERT INTO payments (
      invoice_id,
      payment_amount,
      payment_date,
      method_id,
      reference_number,
      notes,
      created_by,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
  `,

  // Get patient's primary dentist from visit history (most frequent, then most recent)
  getPatientPrimaryDentist: `
    SELECT
      d.doctor_id,
      CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
      st.phone_number AS doctor_phone,
      st.s_city AS doctor_city,
      st.s_state AS doctor_state,
      d.npi,
      NULL AS profile_image_base64,
      COALESCE(GROUP_CONCAT(DISTINCT dept.department_name ORDER BY dept.department_name SEPARATOR ', '), 'General Dentistry') AS specialties,
      COUNT(DISTINCT a.appointment_id) AS visit_count,
      MAX(a.appointment_date) AS last_visit_date
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.doctor_id
    LEFT JOIN staff st ON d.staff_id = st.staff_id
    LEFT JOIN specialties_department sd ON sd.doctor_id = d.doctor_id
    LEFT JOIN departments dept ON dept.department_id = sd.department_id
    WHERE a.patient_id = ?
    GROUP BY d.doctor_id, st.first_name, st.last_name, st.phone_number, st.s_city, st.s_state, d.npi
    ORDER BY visit_count DESC, last_visit_date DESC
    LIMIT 1
  `,

  // Rich patient report rows for export
  getPatientAppointmentReport: `
    SELECT
      p.patient_id,
      CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
      p.p_email,
      p.p_phone,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      ast.status_name,
      ast.display_name AS appointment_status,
      a.notes AS visit_notes,
      CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
      l.location_city,
      l.location_state,
      CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
      i.invoice_id,
      i.amount AS invoice_total,
      i.insurance_covered_amount,
      i.patient_amount,
      i.payment_status,
      i.created_at AS invoice_created_at
    FROM patients p
    LEFT JOIN appointments a ON p.patient_id = a.patient_id
    LEFT JOIN appointment_statuses ast ON a.status_id = ast.status_id
    LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
    LEFT JOIN staff st ON d.staff_id = st.staff_id
    LEFT JOIN locations l ON a.location_id = l.location_id
    LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
    WHERE p.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `,

  // Report row for one past appointment with visit notes
  getPatientAppointmentReportByAppointmentId: `
    SELECT
      p.patient_id,
      CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
      p.p_email,
      p.p_phone,
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      ast.status_name,
      ast.display_name AS appointment_status,
      a.notes AS visit_notes,
      CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
      l.location_city,
      l.location_state,
      CONCAT(l.loc_street_no, ' ', l.loc_street_name, ', ', l.location_city, ', ', l.location_state, ' ', l.loc_zip_code) AS location_address,
      i.invoice_id,
      i.amount AS invoice_total,
      i.insurance_covered_amount,
      i.patient_amount,
      i.payment_status,
      i.created_at AS invoice_created_at
    FROM patients p
    JOIN appointments a ON p.patient_id = a.patient_id
    LEFT JOIN appointment_statuses ast ON a.status_id = ast.status_id
    LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
    LEFT JOIN staff st ON d.staff_id = st.staff_id
    LEFT JOIN locations l ON a.location_id = l.location_id
    LEFT JOIN invoices i ON a.appointment_id = i.appointment_id
    WHERE p.patient_id = ?
      AND a.appointment_id = ?
      AND a.appointment_date < CURDATE()
    LIMIT 1
  `,

  // Get user for login
  getUserForLogin: `
    SELECT
      u.user_id,
      u.password_hash,
      u.user_role,
      u.user_email,
      p.patient_id,
      st.staff_id,
      d.doctor_id,
      st.first_name AS staff_first_name,
      st.last_name AS staff_last_name
    FROM users u
    LEFT JOIN patients p ON p.user_id = u.user_id
    LEFT JOIN staff st ON st.user_id = u.user_id
    LEFT JOIN doctors d ON d.staff_id = st.staff_id
    WHERE u.user_username = ? AND u.is_deleted = 0
  `,

  // Update last login timestamp
  updateLastLogin: `
    UPDATE users SET account_last_login = NOW() WHERE user_id = ?
  `,

  // Check whether an email already exists in patient or user records
  checkEmailExists: `
    SELECT EXISTS (
      SELECT 1 FROM patients p WHERE LOWER(TRIM(p.p_email)) = LOWER(TRIM(?))
      UNION
      SELECT 1 FROM users u WHERE LOWER(TRIM(u.user_email)) = LOWER(TRIM(?)) AND COALESCE(u.is_deleted, 0) = 0
    ) AS email_exists
  `,

  // Register a new patient from frontend intake form
  registerPatient: `
    INSERT INTO patients (
      p_first_name,
      p_last_name,
      p_dob,
      p_phone,
      p_email,
      p_ssn,
      p_drivers_license,
      created_by,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PORTAL', 'PORTAL')
  `,

  // Latest stored intake snapshot for patient prefill
  getLatestPatientRegistrationSnapshot: `
    SELECT snapshot_json, updated_at
    FROM patient_registration_snapshots
    WHERE patient_id = ?
    LIMIT 1
  `,

  // Appointments cancelled by the system (doctor time-off) for a patient in the last 30 days
  getPatientSystemCancelledAppointments: `
    SELECT
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      CONCAT(st.first_name, ' ', st.last_name) AS doctor_name,
      a.updated_at AS cancelled_at
    FROM appointments a
    JOIN appointment_statuses ast ON ast.status_id = a.status_id
    JOIN doctors d ON d.doctor_id = a.doctor_id
    JOIN staff st ON st.staff_id = d.staff_id
    WHERE a.patient_id = ?
      AND ast.status_name = 'CANCELLED'
      AND a.updated_by = 'SYSTEM_TIME_OFF'
      AND a.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY a.updated_at DESC
  `,

  // Latest appointment preference request for patient prefill
  getLatestPatientAppointmentPreferenceRequest: `
    SELECT
      preferred_date,
      preferred_time,
      preferred_location,
      available_days,
      available_times,
      appointment_reason,
      created_at
    FROM appointment_preference_requests
    WHERE patient_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `
};

module.exports = queries;
