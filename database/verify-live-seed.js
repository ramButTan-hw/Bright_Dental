require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const checks = [
    ['users', "SELECT COUNT(*) AS c FROM users WHERE user_username LIKE 'live_seed_2026_04_02_patient_%'"],
    ['patients', "SELECT COUNT(*) AS c FROM patients WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['intake_form_submissions', "SELECT COUNT(*) AS c FROM intake_form_submissions WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['medical_alerts', "SELECT COUNT(*) AS c FROM medical_alerts WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['patient_registration_snapshots', "SELECT COUNT(*) AS c FROM patient_registration_snapshots WHERE updated_by='LIVE_SEED_2026_04_02'"],
    ['patient_current_medications', "SELECT COUNT(*) AS c FROM patient_current_medications WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['patient_pharmacies', "SELECT COUNT(*) AS c FROM patient_pharmacies WHERE created_by='LIVE_SEED_2026_04_02' OR updated_by='LIVE_SEED_2026_04_02'"],
    ['insurance', "SELECT COUNT(*) AS c FROM insurance WHERE created_by='LIVE_SEED_2026_04_02' OR updated_by='LIVE_SEED_2026_04_02'"],
    ['insurance_change_requests', "SELECT COUNT(*) AS c FROM insurance_change_requests WHERE updated_by='LIVE_SEED_2026_04_02'"],
    ['pharmacy_change_requests', "SELECT COUNT(*) AS c FROM pharmacy_change_requests WHERE updated_by='LIVE_SEED_2026_04_02'"],
    ['appointment_preference_requests', "SELECT COUNT(*) AS c FROM appointment_preference_requests WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['appointments', "SELECT COUNT(*) AS c FROM appointments WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['treatment_plans', "SELECT COUNT(*) AS c FROM treatment_plans WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['dental_findings', "SELECT COUNT(*) AS c FROM dental_findings WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['invoices', "SELECT COUNT(*) AS c FROM invoices WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['payments', "SELECT COUNT(*) AS c FROM payments WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['prescriptions', "SELECT COUNT(*) AS c FROM prescriptions WHERE created_by='LIVE_SEED_2026_04_02'"],
    ['receptionist_notifications_for_seed_patients', "SELECT COUNT(*) AS c FROM receptionist_notifications rn JOIN patients p ON p.patient_id = rn.patient_id WHERE p.created_by='LIVE_SEED_2026_04_02'"]
  ];

  for (const [label, sql] of checks) {
    const [[row]] = await conn.query(sql);
    console.log(`${label}: ${row.c}`);
  }

  const [sampleRows] = await conn.query(
    "SELECT patient_id, p_first_name, p_last_name, p_email FROM patients WHERE created_by='LIVE_SEED_2026_04_02' ORDER BY patient_id"
  );
  console.log('seed_patients:', JSON.stringify(sampleRows));

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
