const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const SEED_TAG = 'LIVE_SEED_2026_04_02';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function phoneFromIndex(index) {
  const n = 9000 + index;
  return `713-555-${String(n).slice(-4)}`;
}

async function getLookupMaps(conn) {
  const [statusRows] = await conn.query('SELECT status_id, status_name FROM appointment_statuses');
  const [treatmentRows] = await conn.query('SELECT status_id, status_name FROM treatment_statuses');
  const [paymentRows] = await conn.query('SELECT method_id, method_name FROM payment_methods WHERE is_active = 1 ORDER BY method_id ASC');
  const [procedureRows] = await conn.query('SELECT procedure_code FROM ada_procedure_codes ORDER BY procedure_code ASC');
  const [companyRows] = await conn.query('SELECT company_id FROM insurance_companies ORDER BY company_id ASC');
  const [pharmacyRows] = await conn.query('SELECT pharm_id FROM pharmacies ORDER BY pharm_id ASC');
  const [doctorRows] = await conn.query(
    `SELECT d.doctor_id
     FROM doctors d
     JOIN staff st ON st.staff_id = d.staff_id
     JOIN users u ON u.user_id = st.user_id
     WHERE COALESCE(u.user_username, '') NOT LIKE 'railway_doc_%'
       AND COALESCE(u.is_deleted, 0) = 0
     ORDER BY d.doctor_id ASC`
  );
  const [locationRows] = await conn.query('SELECT location_id FROM locations ORDER BY location_id ASC');
  const [reasonRows] = await conn.query('SELECT reason_id FROM cancel_reasons ORDER BY reason_id ASC LIMIT 1');
  const [painRows] = await conn.query('SELECT pain_symptom_id FROM intake_pain_symptoms ORDER BY display_order ASC, pain_symptom_id ASC LIMIT 3');
  const [tobaccoRows] = await conn.query('SELECT tobacco_type_id, tobacco_label FROM intake_tobacco_types');
  const [caffeineRows] = await conn.query('SELECT caffeine_type_id, caffeine_label FROM intake_caffeine_types');
  const [genderColRows] = await conn.query("SHOW COLUMNS FROM patients LIKE 'p_gender'");
  const genderColumnType = String(genderColRows[0]?.Type || '').toLowerCase();

  if (!doctorRows.length || !locationRows.length || !procedureRows.length || !companyRows.length || !pharmacyRows.length) {
    throw new Error('Missing required reference data (doctors/locations/procedure codes/insurance companies/pharmacies).');
  }

  return {
    appointmentStatusByName: new Map(statusRows.map((r) => [String(r.status_name).toUpperCase(), Number(r.status_id)])),
    treatmentStatusByName: new Map(treatmentRows.map((r) => [String(r.status_name).toUpperCase(), Number(r.status_id)])),
    paymentMethodId: Number(paymentRows[0]?.method_id || 1),
    procedureCodes: procedureRows.map((r) => r.procedure_code),
    companyIds: companyRows.map((r) => Number(r.company_id)),
    pharmacyIds: pharmacyRows.map((r) => Number(r.pharm_id)),
    doctorIds: doctorRows.map((r) => Number(r.doctor_id)),
    locationIds: locationRows.map((r) => Number(r.location_id)),
    cancelReasonId: Number(reasonRows[0]?.reason_id || 1),
    painSymptomIds: painRows.map((r) => Number(r.pain_symptom_id)),
    tobaccoTypeByLabel: new Map(tobaccoRows.map((r) => [String(r.tobacco_label), Number(r.tobacco_type_id)])),
    caffeineTypeByLabel: new Map(caffeineRows.map((r) => [String(r.caffeine_label), Number(r.caffeine_type_id)])),
    patientGenderMode: genderColumnType.includes('int') ? 'NUMERIC' : 'TEXT'
  };
}

function resolvePatientGenderValue(mode, sourceGender) {
  const numericValue = Number(sourceGender || 0);
  if (mode === 'NUMERIC') {
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }
  if (numericValue === 1) return 'Male';
  if (numericValue === 2) return 'Female';
  return 'Prefer not to say';
}

async function ensureUserAndPatient(conn, patient, index, lookup) {
  const username = `${SEED_TAG.toLowerCase()}_patient_${index + 1}`;
  const email = `seed.patient${index + 1}.${SEED_TAG.toLowerCase()}@example.com`;
  const phone = phoneFromIndex(index + 1);

  const [existingPatientRows] = await conn.query('SELECT patient_id, user_id FROM patients WHERE p_email = ? LIMIT 1', [email]);
  if (existingPatientRows.length) {
    return { patientId: Number(existingPatientRows[0].patient_id), userId: existingPatientRows[0].user_id ? Number(existingPatientRows[0].user_id) : null, email, phone };
  }

  let userId = null;
  const [existingUserRows] = await conn.query('SELECT user_id FROM users WHERE user_username = ? LIMIT 1', [username]);
  if (existingUserRows.length) {
    userId = Number(existingUserRows[0].user_id);
  } else {
    const [userInsert] = await conn.query(
      `INSERT INTO users (user_username, password_hash, user_email, user_phone, user_role)
       VALUES (?, SHA2(?, 256), ?, ?, 'PATIENT')`,
      [username, 'SeedPass1', email, phone]
    );
    userId = Number(userInsert.insertId);
  }

  const [patientInsert] = await conn.query(
    `INSERT INTO patients (
      user_id, p_first_name, p_last_name, p_dob, p_gender, p_phone, p_email,
      p_ssn, p_drivers_license, p_emergency_contact_name, p_emergency_contact_phone,
      p_address, p_city, p_state, p_zipcode, p_country, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'US', ?, ?)`,
    [
      userId,
      patient.firstName,
      patient.lastName,
      patient.dob,
      resolvePatientGenderValue(lookup.patientGenderMode, patient.gender),
      phone,
      email,
      patient.ssn,
      patient.driversLicense,
      `${patient.firstName} Emergency`,
      phoneFromIndex(index + 101),
      patient.address,
      patient.city,
      patient.state,
      patient.zip,
      SEED_TAG,
      SEED_TAG
    ]
  );

  return { patientId: Number(patientInsert.insertId), userId, email, phone };
}

async function ensureIntakeData(conn, patientId, lookup, profileIndex) {
  const snapshot = {
    medicalHistory: { diabetes: profileIndex % 2 === 0, highBloodPressure: true, heartDisease: profileIndex % 3 === 0 },
    adverseReactions: { aspirin: profileIndex % 2 === 1 },
    dentalHistory: {
      periodontalDiseaseYesNo: profileIndex % 2 === 0 ? 'yes' : 'no',
      periodontalDiseaseWhen: profileIndex % 2 === 0 ? '2022-04-10' : null,
      bracesOrtho: profileIndex % 2 === 1 ? 'yes' : 'no',
      bracesOrthoWhen: profileIndex % 2 === 1 ? '2019-08-15' : null
    },
    sleepSocial: { snore: true, cpap: profileIndex % 2 === 0 },
    tobacco: {
      never: profileIndex % 3 === 0,
      quit: profileIndex % 3 !== 0,
      currentUses: profileIndex % 3 === 0 ? [] : [{ type: 'Cigarettes', amount: '3/day', frequency: 'daily' }],
      quitHistory: [{ type: 'Cigarettes', quitDate: '2024-06-01' }]
    },
    caffeine: { coffee: true, tea: profileIndex % 2 === 0, soda: profileIndex % 2 === 1, none: false },
    painAssessment: lookup.painSymptomIds.map((symptomId, i) => ({ symptomId, pain: Math.min(5, 2 + i) }))
  };

  await conn.query(
    `INSERT INTO medical_alerts (patient_id, alert_condition, notes, created_by, updated_by)
     VALUES (?, 'PATIENT_INTAKE_SNAPSHOT', ?, ?, ?)`,
    [patientId, JSON.stringify(snapshot), SEED_TAG, SEED_TAG]
  );

  await conn.query(
    `INSERT INTO patient_registration_snapshots (patient_id, snapshot_json, created_by, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE snapshot_json = VALUES(snapshot_json), updated_by = VALUES(updated_by)`,
    [patientId, JSON.stringify(snapshot), SEED_TAG, SEED_TAG]
  );

  await conn.query(
    `INSERT INTO intake_dental_history (
      patient_id, periodontal_disease_yes_no, periodontal_disease_date,
      braces_ortho_yes_no, braces_ortho_date, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      periodontal_disease_yes_no = VALUES(periodontal_disease_yes_no),
      periodontal_disease_date = VALUES(periodontal_disease_date),
      braces_ortho_yes_no = VALUES(braces_ortho_yes_no),
      braces_ortho_date = VALUES(braces_ortho_date),
      updated_by = VALUES(updated_by)`,
    [
      patientId,
      snapshot.dentalHistory.periodontalDiseaseYesNo === 'yes' ? 'YES' : 'NO',
      snapshot.dentalHistory.periodontalDiseaseWhen,
      snapshot.dentalHistory.bracesOrtho === 'yes' ? 'YES' : 'NO',
      snapshot.dentalHistory.bracesOrthoWhen,
      SEED_TAG,
      SEED_TAG
    ]
  );

  const [submissionInsert] = await conn.query(
    `INSERT INTO intake_form_submissions (patient_id, source, created_by, updated_by)
     VALUES (?, 'PATIENT_PORTAL', ?, ?)`,
    [patientId, SEED_TAG, SEED_TAG]
  );
  const submissionId = Number(submissionInsert.insertId);

  for (const pain of snapshot.painAssessment) {
    await conn.query(
      `INSERT INTO intake_pain_assessments (submission_id, pain_symptom_id, pain_level, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pain_level = VALUES(pain_level), updated_by = VALUES(updated_by)`,
      [submissionId, pain.symptomId, pain.pain, `Seeded pain level ${pain.pain}`, SEED_TAG, SEED_TAG]
    );
  }

  if (lookup.caffeineTypeByLabel.has('Coffee')) {
    await conn.query(
      `INSERT INTO intake_caffeine_use (submission_id, caffeine_type_id, is_selected, amount_text, frequency_text, created_by, updated_by)
       VALUES (?, ?, TRUE, '2 cups', 'Daily', ?, ?)
       ON DUPLICATE KEY UPDATE is_selected = VALUES(is_selected), updated_by = VALUES(updated_by)`,
      [submissionId, lookup.caffeineTypeByLabel.get('Coffee'), SEED_TAG, SEED_TAG]
    );
  }

  if (lookup.tobaccoTypeByLabel.has('Cigarettes')) {
    await conn.query(
      `INSERT INTO intake_tobacco_use (
        submission_id, tobacco_type_id, uses_tobacco, amount_text, frequency_text, quit_date, notes, usage_context, created_by, updated_by
      ) VALUES (?, ?, 'YES', '3/day', 'Daily', NULL, ?, 'CURRENT', ?, ?)
      ON DUPLICATE KEY UPDATE uses_tobacco = VALUES(uses_tobacco), updated_by = VALUES(updated_by)`,
      [submissionId, lookup.tobaccoTypeByLabel.get('Cigarettes'), `Seed current tobacco ${SEED_TAG}`, SEED_TAG, SEED_TAG]
    );
  }

  await conn.query(
    `INSERT INTO patient_current_medications (
      patient_id, medication_name, strength, dosage, frequency, reason_for_use, route, is_active, notes, created_by, updated_by
    ) VALUES (?, 'Lisinopril', '10 mg', '1 tablet', 'Daily', 'Blood pressure', 'Oral', TRUE, ?, ?, ?)`,
    [patientId, `Seed medication ${SEED_TAG}`, SEED_TAG, SEED_TAG]
  );
}

async function ensurePharmacyInsuranceAndRequests(conn, patientId, lookup, index) {
  const pharmacyId = lookup.pharmacyIds[index % lookup.pharmacyIds.length];
  const companyId = lookup.companyIds[index % lookup.companyIds.length];

  const memberId = `LIVEMEMBER${String(1000 + index)}`;
  await conn.query(
    `INSERT INTO insurance (patient_id, company_id, member_id, group_number, is_primary, effective_date, policy_holder_name, policy_holder_relationship, created_by, updated_by)
     VALUES (?, ?, ?, ?, FALSE, CURDATE(), ?, 'Self', ?, ?)
     ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), updated_by = VALUES(updated_by)`,
    [patientId, companyId, memberId, `GRP${700 + index}`, `Seed Patient ${index + 1}`, SEED_TAG, SEED_TAG]
  );

  await conn.query(
    `INSERT INTO insurance_change_requests (
      patient_id, insurance_id, change_type, company_id, member_id, group_number, is_primary, patient_note, request_status, updated_by
    ) VALUES (?, NULL, 'UPDATE', ?, ?, ?, TRUE, ?, 'PENDING', ?)`,
    [patientId, companyId, `${memberId}-UPD`, `GRP${900 + index}`, `Seed insurance request ${SEED_TAG}`, SEED_TAG]
  );

  await conn.query(
    `INSERT INTO pharmacy_change_requests (
      patient_id, patient_pharmacy_id, change_type, pharm_id, is_primary, patient_note, request_status, updated_by
    ) VALUES (?, NULL, 'ADD', ?, 1, ?, 'PENDING', ?)`,
    [patientId, pharmacyId, `Seed pharmacy request ${SEED_TAG}`, SEED_TAG]
  );
}

async function ensureAppointmentTreatmentBilling(conn, patientId, lookup, index) {
  const now = new Date();
  const doctorId = lookup.doctorIds[index % lookup.doctorIds.length];
  const locationId = lookup.locationIds[index % lookup.locationIds.length];
  const statusCycle = ['SCHEDULED', 'COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'RESCHEDULED'];
  const statusName = statusCycle[index % statusCycle.length];
  const statusId = lookup.appointmentStatusByName.get(statusName) || lookup.appointmentStatusByName.get('SCHEDULED');
  const appointmentDate = formatDate(addDays(now, index - 3));
  const appointmentTime = `0${9 + (index % 6)}:00:00`.slice(-8);
  const appointmentEndTime = `0${10 + (index % 6)}:00:00`.slice(-8);

  const [slotRows] = await conn.query(
    `SELECT slot_id FROM appointment_slots WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ? LIMIT 1`,
    [doctorId, appointmentDate, appointmentTime]
  );
  let slotId = slotRows.length ? Number(slotRows[0].slot_id) : null;

  if (!slotId) {
    const [slotInsert] = await conn.query(
      `INSERT INTO appointment_slots (
        doctor_id, location_id, slot_date, slot_start_time, slot_end_time,
        duration_minutes, is_available, max_patients, current_bookings, slot_type, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, 60, TRUE, 1, 0, 'REGULAR', ?, ?, ?)`,
      [doctorId, locationId, appointmentDate, appointmentTime, appointmentEndTime, `Seed slot ${SEED_TAG}`, SEED_TAG, SEED_TAG]
    );
    slotId = Number(slotInsert.insertId);
  }

  const [appointmentRows] = await conn.query(
    `SELECT appointment_id FROM appointments WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND appointment_time = ? LIMIT 1`,
    [patientId, doctorId, appointmentDate, appointmentTime]
  );

  let appointmentId = appointmentRows.length ? Number(appointmentRows[0].appointment_id) : null;
  if (!appointmentId) {
    const [appointmentInsert] = await conn.query(
      `INSERT INTO appointments (
        slot_id, location_id, patient_id, doctor_id, appointment_time, appointment_date, status_id, reason_id, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slotId, locationId, patientId, doctorId, appointmentTime, appointmentDate, statusId, statusName === 'CANCELLED' ? lookup.cancelReasonId : null, `Seed appointment ${SEED_TAG}`, SEED_TAG, SEED_TAG]
    );
    appointmentId = Number(appointmentInsert.insertId);
  }

  const treatmentStatusName = statusName === 'COMPLETED' ? 'COMPLETED' : 'PLANNED';
  const treatmentStatusId = lookup.treatmentStatusByName.get(treatmentStatusName) || lookup.treatmentStatusByName.get('PLANNED');
  const procedureCode = lookup.procedureCodes[index % lookup.procedureCodes.length];
  const estimatedCost = 120 + (index * 45);

  await conn.query(
    `INSERT INTO treatment_plans (
      patient_id, doctor_id, surface, procedure_code, status_id, tooth_number, estimated_cost,
      priority, follow_up_required, follow_up_date, follow_up_contacted_at, follow_up_contacted_by,
      follow_up_contact_note, start_date, target_completion_date, notes, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      doctorId,
      index % 2 === 0 ? 'M' : 'O',
      procedureCode,
      treatmentStatusId,
      String(2 + index),
      estimatedCost,
      index % 2 === 0 ? 'HIGH' : 'MEDIUM',
      1,
      formatDate(addDays(now, 14 + index)),
      statusName === 'COMPLETED' ? new Date() : null,
      statusName === 'COMPLETED' ? 'RECEPTION_PORTAL' : null,
      statusName === 'COMPLETED' ? `Follow-up called ${SEED_TAG}` : null,
      appointmentDate,
      formatDate(addDays(now, 35 + index)),
      `Seed treatment plan ${SEED_TAG}`,
      SEED_TAG,
      SEED_TAG
    ]
  );

  if (statusName === 'COMPLETED') {
    await conn.query(
      `INSERT INTO dental_findings (
        patient_id, doctor_id, appointment_id, tooth_number, surface, condition_type, notes, date_logged, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, 'Decay', ?, NOW(), ?, ?)`,
      [patientId, doctorId, appointmentId, String(2 + index), index % 2 === 0 ? 'M' : 'O', `Seed finding ${SEED_TAG}`, SEED_TAG, SEED_TAG]
    );
  }

  const [invoiceRows] = await conn.query('SELECT invoice_id FROM invoices WHERE appointment_id = ? LIMIT 1', [appointmentId]);
  let invoiceId = invoiceRows.length ? Number(invoiceRows[0].invoice_id) : null;

  if (!invoiceId) {
    const totalAmount = Number(estimatedCost.toFixed(2));
    const insuranceCovered = Number((totalAmount * 0.6).toFixed(2));
    const patientAmount = Number((totalAmount - insuranceCovered).toFixed(2));
    const paymentStatus = index % 3 === 0 ? 'Unpaid' : (index % 3 === 1 ? 'Partial' : 'Paid');

    const [insuranceRows] = await conn.query('SELECT insurance_id FROM insurance WHERE patient_id = ? ORDER BY is_primary DESC, insurance_id ASC LIMIT 1', [patientId]);
    const insuranceId = insuranceRows.length ? Number(insuranceRows[0].insurance_id) : null;

    const [invoiceInsert] = await conn.query(
      `INSERT INTO invoices (
        appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointmentId, insuranceId, totalAmount, insuranceCovered, patientAmount, paymentStatus, SEED_TAG, SEED_TAG]
    );
    invoiceId = Number(invoiceInsert.insertId);

    if (paymentStatus !== 'Unpaid') {
      const paidAmount = paymentStatus === 'Paid' ? patientAmount : Number((patientAmount * 0.5).toFixed(2));
      await conn.query(
        `INSERT INTO payments (
          invoice_id, payment_amount, payment_date, method_id, reference_number, notes, created_by, updated_by
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [invoiceId, paidAmount, lookup.paymentMethodId, `${SEED_TAG}-PMT-${patientId}`, `Seed payment ${SEED_TAG}`, SEED_TAG, SEED_TAG]
      );
    }
  }

  const [prefRows] = await conn.query(
    `SELECT preference_request_id FROM appointment_preference_requests WHERE patient_id = ? AND preferred_date = ? LIMIT 1`,
    [patientId, appointmentDate]
  );
  if (!prefRows.length) {
    await conn.query(
      `INSERT INTO appointment_preference_requests (
        patient_id, preferred_date, preferred_time, preferred_location,
        appointment_reason, request_status, assigned_doctor_id, assigned_date, assigned_time,
        available_days, available_times, receptionist_notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        appointmentDate,
        appointmentTime,
        `Seed preferred location ${locationId}`,
        'Routine care / seeded comprehensive scenario',
        statusName === 'SCHEDULED' ? 'ASSIGNED' : 'PREFERRED_PENDING',
        doctorId,
        appointmentDate,
        appointmentTime,
        'Monday, Tuesday, Wednesday',
        '09:00, 10:00, 11:00',
        `Seed preference ${SEED_TAG}`,
        SEED_TAG,
        SEED_TAG
      ]
    );
  }

  await conn.query(
    `INSERT INTO prescriptions (
      patient_id, pharm_id, doctor_id, medication_name, instructions, strength, dosage,
      date_prescribed, start_date, end_date, frequency, quantity, refills, created_by, updated_by
    ) VALUES (?, ?, ?, 'Amoxicillin', 'Take with food', '500mg', '1 capsule', NOW(), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Twice daily', 14, 0, ?, ?)`,
    [patientId, lookup.pharmacyIds[index % lookup.pharmacyIds.length], doctorId, SEED_TAG, SEED_TAG]
  );
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const patients = [
    { firstName: 'Lena', lastName: 'Carter', dob: '1991-03-18', gender: 2, ssn: '531-22-1201', driversLicense: 'TX-LIVE-1201', address: '4102 Elm St', city: 'Houston', state: 'TX', zip: '77004' },
    { firstName: 'Marcus', lastName: 'Hill', dob: '1987-07-09', gender: 1, ssn: '531-22-1202', driversLicense: 'TX-LIVE-1202', address: '995 Willow Ave', city: 'Sugar Land', state: 'TX', zip: '77479' },
    { firstName: 'Priya', lastName: 'Nair', dob: '1994-11-25', gender: 2, ssn: '531-22-1203', driversLicense: 'TX-LIVE-1203', address: '27 Bellview Dr', city: 'Houston', state: 'TX', zip: '77002' },
    { firstName: 'Ethan', lastName: 'Brooks', dob: '1979-02-14', gender: 1, ssn: '531-22-1204', driversLicense: 'TX-LIVE-1204', address: '1660 Bayou Rd', city: 'Houston', state: 'TX', zip: '77004' },
    { firstName: 'Ariana', lastName: 'Lopez', dob: '2000-06-30', gender: 2, ssn: '531-22-1205', driversLicense: 'TX-LIVE-1205', address: '382 Garden Oaks', city: 'Sugar Land', state: 'TX', zip: '77479' },
    { firstName: 'Noah', lastName: 'Kim', dob: '1983-12-01', gender: 1, ssn: '531-22-1206', driversLicense: 'TX-LIVE-1206', address: '50 Downtown Loop', city: 'Houston', state: 'TX', zip: '77002' }
  ];

  try {
    const lookup = await getLookupMaps(conn);
    let createdCount = 0;

    for (let i = 0; i < patients.length; i += 1) {
      await conn.beginTransaction();
      try {
        const { patientId } = await ensureUserAndPatient(conn, patients[i], i, lookup);
        await ensureIntakeData(conn, patientId, lookup, i);
        await ensurePharmacyInsuranceAndRequests(conn, patientId, lookup, i);
        await ensureAppointmentTreatmentBilling(conn, patientId, lookup, i);
        await conn.commit();
        createdCount += 1;
        console.log(`Seeded patient journey ${i + 1}/6 (patient_id=${patientId})`);
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    }

    console.log(`Completed comprehensive live seed. Journeys processed: ${createdCount}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('Live comprehensive seed failed:', error.message);
  process.exit(1);
});
