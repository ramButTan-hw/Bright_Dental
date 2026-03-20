// ============================================================================
// DATABASE QUERIES MODULE
// ============================================================================
// All queries used by the API server
// Reference: See database/queries/api-queries.sql for documentation
// ============================================================================

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

  // Get user for login
  getUserForLogin: `
    SELECT user_id, password_hash, user_role, user_email 
    FROM users 
    WHERE user_username = ? AND is_deleted = 0
  `,

  // Update last login timestamp
  updateLastLogin: `
    UPDATE users SET account_last_login = NOW() WHERE user_id = ?
  `
};

module.exports = queries;
