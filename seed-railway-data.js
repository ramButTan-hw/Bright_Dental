/**
 * Comprehensive seed script for Railway (or any environment).
 *
 * Creates:
 *   1. Scheduled appointments for Apr 1–4, 2026 (Wed–Sat), ~3-4 per day
 *   2. Appointment preference requests (PREFERRED_PENDING) for Apr 8–10 (another week)
 *   3. Completed appointments (past dates) with treatment plans, dental findings, invoices
 *   4. Staff schedules for all active doctors + receptionists
 *
 * All patients get full registration info + preferred location.
 * All passwords: Test123!
 *
 * Usage:
 *   node database/seeds/seed-railway-data.js
 */

const crypto = require('crypto');
const pool = require('../db');

function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad2(n) { return String(n).padStart(2, '0'); }

const FIRST_NAMES = [
  'Aiden','Bella','Carlos','Diana','Elijah','Fiona','Gabriel','Hannah',
  'Ivan','Julia','Kevin','Luna','Mason','Nina','Oscar','Priya',
  'Quinn','Rosa','Sean','Tara','Umar','Vera','Wade','Xena','Yuri','Zara',
  'Liam','Sophia','Mateo','Camila','Jayden','Amara','Kai','Leila'
];
const LAST_NAMES = [
  'Adams','Brown','Cruz','Davis','Evans','Foster','Garcia','Hill',
  'Irwin','Jones','Kim','Lee','Moore','Nash','Ortiz','Park',
  'Quinn','Reed','Shah','Torres','Upton','Vega','Wells','Xu','Young','Zhang',
  'Chen','Patel','Lopez','Rivera','Wright','Flores'
];
const STREETS = ['Main St','University Dr','Maple Ave','Oak Blvd','Sunset Ln','Elm St','Park Ave','Cedar Rd','Pine St','Willow Dr'];
const CITIES = ['Houston','Sugar Land','Pearland','Katy','Spring','Missouri City'];
const REASONS = ['Routine checkup','Tooth pain','Cleaning','Crown follow-up','Cavity filling','Wisdom tooth consultation','Gum pain','Chipped tooth'];
const SURFACES = ['O','M','D','B','L','OB','MO','DO'];
const FINDINGS = ['Decay','Missing','Fracture','Existing Composite','Crown','Root Canal','Periodontal','Existing Amalgam'];
const PRIORITIES = ['High','Medium','Low'];
const GENDERS = ['Male','Female','Non-binary'];

let nameCounter = 0;
const usedPhones = new Set();
const hash = crypto.createHash('sha256').update('Test123!').digest('hex');
let isGenderNumeric = false;

function uniquePhone() {
  let phone;
  do { phone = `(713) ${pad2(randInt(10,99))}-${randInt(1000,9999)}`; } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
}

async function createPatient(locationIds) {
  const first = FIRST_NAMES[nameCounter % FIRST_NAMES.length];
  const last = LAST_NAMES[nameCounter % LAST_NAMES.length];
  nameCounter++;

  const uname = `seed_${Date.now()}_${nameCounter}_${randInt(100,999)}`;
  const email = `${uname}@clinic.test`;
  const phone = uniquePhone();

  await q(
    `INSERT INTO users (user_username, password_hash, user_email, user_phone, user_role) VALUES (?, ?, ?, ?, 'PATIENT')`,
    [uname, hash, email, phone]
  );
  const user = (await q('SELECT user_id FROM users WHERE user_username = ? LIMIT 1', [uname]))[0];
  const userId = Number(user.user_id);

  const dob = `19${randInt(55, 99)}-${pad2(randInt(1,12))}-${pad2(randInt(1,28))}`;
  const address = `${randInt(100,9999)} ${randFrom(STREETS)}`;
  const city = randFrom(CITIES);
  const zip = String(randInt(77001, 77999));
  const ssn = `${randInt(100,999)}-${pad2(randInt(10,99))}-${randInt(1000,9999)}`;
  const dl = `TX${randInt(10000000, 99999999)}`;
  const emergName = `${randFrom(FIRST_NAMES)} ${randFrom(LAST_NAMES)}`;
  const emergPhone = uniquePhone();

  await q(
    `INSERT INTO patients (
      user_id, p_first_name, p_last_name, p_dob, p_gender, p_phone, p_email,
      p_ssn, p_drivers_license, p_emergency_contact_name, p_emergency_contact_phone,
      p_address, p_city, p_state, p_zipcode, p_country, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TX', ?, 'USA', 'SYSTEM_SEED', 'SYSTEM_SEED')`,
    [userId, first, last, dob, isGenderNumeric ? randInt(1, 4) : randFrom(GENDERS), phone, email,
     ssn, dl, emergName, emergPhone, address, city, zip]
  );

  const patient = (await q('SELECT patient_id FROM patients WHERE user_id = ? LIMIT 1', [userId]))[0];
  const patientId = Number(patient.patient_id);

  // Add preferred location
  const prefLocId = randFrom(locationIds);
  await q(
    `INSERT IGNORE INTO patient_registration_snapshots (patient_id, snapshot_json, created_by, updated_by)
     VALUES (?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
    [patientId, JSON.stringify({
      preferredLocation: prefLocId,
      medicalHistory: {
        hasHeartDisease: Math.random() > 0.7,
        hasHighBloodPressure: Math.random() > 0.6,
        hasDiabetes: Math.random() > 0.8,
        hasAsthma: Math.random() > 0.7
      },
      adverseReactions: {
        latexAllergy: Math.random() > 0.85,
        penicillinAllergy: Math.random() > 0.8
      },
      dentalFindings: {
        bleedingGums: Math.random() > 0.6,
        toothSensitivity: Math.random() > 0.5,
        jawPain: Math.random() > 0.7
      }
    })]
  );

  // Add insurance for some patients
  if (Math.random() > 0.3) {
    const insuranceCompanies = await q('SELECT company_id FROM insurance_companies ORDER BY RAND() LIMIT 1');
    if (insuranceCompanies.length) {
      const companyId = insuranceCompanies[0].company_id;
      const memberId = `MEM${randInt(100000, 999999)}`;
      await q(
        `INSERT IGNORE INTO insurance (patient_id, company_id, member_id, group_number, is_primary, effective_date, policy_holder_name, created_by, updated_by)
         VALUES (?, ?, ?, ?, TRUE, '2025-01-01', ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
        [patientId, companyId, memberId, `GRP${randInt(1000,9999)}`, `${first} ${last}`]
      );
    }
  }

  return { patientId, userId, first, last, username: uname };
}

(async () => {
  console.log('=== Comprehensive Seed Script ===\n');

  // Detect gender column type
  const genderCol = await q("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patients' AND COLUMN_NAME = 'p_gender'");
  const genderType = String(genderCol[0]?.DATA_TYPE || '').toLowerCase();
  isGenderNumeric = ['tinyint','smallint','mediumint','int','bigint','integer'].includes(genderType);

  // Fetch reference data
  const doctors = await q('SELECT d.doctor_id, d.staff_id, CONCAT(st.first_name, " ", st.last_name) AS name FROM doctors d JOIN staff st ON st.staff_id = d.staff_id JOIN users u ON u.user_id = st.user_id WHERE u.is_deleted = 0');
  if (!doctors.length) throw new Error('No active doctors found.');

  const locations = await q('SELECT location_id FROM locations ORDER BY location_id');
  if (!locations.length) throw new Error('No locations found.');
  const locationIds = locations.map((l) => l.location_id);

  const statuses = {};
  const statusRows = await q('SELECT status_id, status_name FROM appointment_statuses');
  statusRows.forEach((r) => { statuses[r.status_name] = Number(r.status_id); });

  const treatmentStatuses = {};
  const tStatusRows = await q('SELECT status_id, status_name FROM treatment_statuses');
  tStatusRows.forEach((r) => { treatmentStatuses[r.status_name] = Number(r.status_id); });

  const procCodes = await q('SELECT procedure_code, description, default_fees FROM ada_procedure_codes ORDER BY RAND() LIMIT 20');
  if (!procCodes.length) console.log('Warning: No ADA procedure codes found. Treatments will be skipped.');

  // ─────────────────────────────────────────────────────────
  // 1. SCHEDULED APPOINTMENTS: Apr 1–4, 2026
  // ─────────────────────────────────────────────────────────
  console.log('--- 1. Scheduled Appointments (Apr 1–4) ---');
  const scheduledDates = ['2026-04-01','2026-04-02','2026-04-03','2026-04-04'];
  const scheduledTimes = [
    { h: 9, m: 0 }, { h: 10, m: 0 }, { h: 11, m: 0 }, { h: 13, m: 0 },
    { h: 14, m: 0 }, { h: 15, m: 0 }, { h: 16, m: 0 }
  ];

  for (const date of scheduledDates) {
    // Pick 3-4 random time slots per day
    const numAppts = randInt(3, 4);
    const shuffledTimes = [...scheduledTimes].sort(() => Math.random() - 0.5).slice(0, numAppts);

    for (const t of shuffledTimes) {
      const doctor = randFrom(doctors);
      const locationId = randFrom(locationIds);
      const patient = await createPatient(locationIds);

      const startTime = `${pad2(t.h)}:${pad2(t.m)}:00`;
      const endTime = `${pad2(t.h)}:30:00`;

      // Check if slot already exists and is booked
      const existingSlot = await q('SELECT slot_id, current_bookings, max_patients FROM appointment_slots WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ? LIMIT 1', [doctor.doctor_id, date, startTime]);
      let slotId;
      if (existingSlot.length && existingSlot[0].current_bookings >= existingSlot[0].max_patients) {
        console.log(`  ${date} ${startTime.slice(0,5)} — SKIPPED (slot already booked)`);
        continue;
      } else if (existingSlot.length) {
        slotId = existingSlot[0].slot_id;
      } else {
        await q(
          `INSERT INTO appointment_slots (doctor_id, location_id, slot_date, slot_start_time, slot_end_time, duration_minutes, is_available, max_patients, current_bookings, slot_type, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, 30, TRUE, 1, 0, 'REGULAR', 'SYSTEM_SEED', 'SYSTEM_SEED')`,
          [doctor.doctor_id, locationId, date, startTime, endTime]
        );
        const slot = (await q('SELECT slot_id FROM appointment_slots WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ? LIMIT 1', [doctor.doctor_id, date, startTime]))[0];
        slotId = slot.slot_id;
      }

      try {
        await q(
          `INSERT INTO appointments (slot_id, location_id, patient_id, doctor_id, appointment_time, appointment_date, status_id, notes, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
          [slotId, locationId, patient.patientId, doctor.doctor_id, startTime, date, statuses.SCHEDULED, randFrom(REASONS)]
        );
        console.log(`  ${date} ${startTime.slice(0,5)} — ${patient.first} ${patient.last} → Dr. ${doctor.name}`);
      } catch (e) {
        console.log(`  ${date} ${startTime.slice(0,5)} — SKIPPED (${e.sqlMessage || e.message})`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 2. APPOINTMENT PREFERENCE REQUESTS: Apr 8–10
  // ─────────────────────────────────────────────────────────
  console.log('\n--- 2. Appointment Preference Requests (Apr 8–10) ---');
  const requestDates = ['2026-04-08','2026-04-09','2026-04-10'];
  const requestTimes = ['09:00','10:00','11:00','13:00','14:00','15:00'];

  for (let i = 0; i < 5; i++) {
    const patient = await createPatient(locationIds);
    const prefDate = randFrom(requestDates);
    const prefTime = randFrom(requestTimes);
    const locationId = randFrom(locationIds);
    const reason = randFrom(REASONS);
    const availDays = randFrom(['Monday, Wednesday, Friday', 'Tuesday, Thursday', 'Any weekday', 'Monday, Tuesday, Wednesday']);
    const availTimes = randFrom(['Morning (9-12)', 'Afternoon (1-5)', 'Any time', 'Morning only']);

    // Look up location address for preferred_location text field
    const locInfo = await q('SELECT CONCAT(loc_street_no, " ", loc_street_name, ", ", location_city) AS addr FROM locations WHERE location_id = ? LIMIT 1', [locationId]);
    const prefLocText = locInfo.length ? locInfo[0].addr : 'Any location';

    await q(
      `INSERT INTO appointment_preference_requests (
        patient_id, preferred_date, preferred_time, preferred_location, appointment_reason,
        request_status, available_days, available_times, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, 'PREFERRED_PENDING', ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
      [patient.patientId, prefDate, `${prefTime}:00`, prefLocText, reason, availDays, availTimes]
    );

    console.log(`  ${patient.first} ${patient.last} — prefers ${prefDate} @ ${prefTime}, reason: ${reason}`);
  }

  // ─────────────────────────────────────────────────────────
  // 3. COMPLETED APPOINTMENTS (past dates) with treatments
  // ─────────────────────────────────────────────────────────
  console.log('\n--- 3. Completed Appointments (Mar 17–21, past week) ---');
  const completedDates = ['2026-03-16','2026-03-17','2026-03-18','2026-03-19','2026-03-20'];
  const completedTimes = [
    { h: 9, m: 0 }, { h: 10, m: 0 }, { h: 11, m: 0 },
    { h: 13, m: 0 }, { h: 14, m: 0 }, { h: 15, m: 0 }, { h: 16, m: 0 }
  ];

  for (const date of completedDates) {
    const numAppts = randInt(3, 5);
    const shuffledTimes = [...completedTimes].sort(() => Math.random() - 0.5).slice(0, numAppts);

    for (const t of shuffledTimes) {
      const doctor = randFrom(doctors);
      const locationId = randFrom(locationIds);
      const patient = await createPatient(locationIds);

      const startTime = `${pad2(t.h)}:${pad2(t.m)}:00`;
      const endTime = `${pad2(t.h)}:30:00`;

      const existSlot = await q('SELECT slot_id, current_bookings, max_patients FROM appointment_slots WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ? LIMIT 1', [doctor.doctor_id, date, startTime]);
      let cSlotId;
      if (existSlot.length && existSlot[0].current_bookings >= existSlot[0].max_patients) {
        console.log(`  ${date} ${startTime.slice(0,5)} — SKIPPED (slot already booked)`);
        continue;
      } else if (existSlot.length) {
        cSlotId = existSlot[0].slot_id;
      } else {
        await q(
          `INSERT INTO appointment_slots (doctor_id, location_id, slot_date, slot_start_time, slot_end_time, duration_minutes, is_available, max_patients, current_bookings, slot_type, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, 30, FALSE, 1, 0, 'REGULAR', 'SYSTEM_SEED', 'SYSTEM_SEED')`,
          [doctor.doctor_id, locationId, date, startTime, endTime]
        );
        const newSlot = (await q('SELECT slot_id FROM appointment_slots WHERE doctor_id = ? AND slot_date = ? AND slot_start_time = ? LIMIT 1', [doctor.doctor_id, date, startTime]))[0];
        cSlotId = newSlot.slot_id;
      }

      let appointmentId;
      try {
        await q(
          `INSERT INTO appointments (slot_id, location_id, patient_id, doctor_id, appointment_time, appointment_date, status_id, notes, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
          [cSlotId, locationId, patient.patientId, doctor.doctor_id, startTime, date, statuses.COMPLETED, randFrom(REASONS)]
        );
        const appt = (await q('SELECT appointment_id FROM appointments WHERE patient_id = ? ORDER BY appointment_id DESC LIMIT 1', [patient.patientId]))[0];
        appointmentId = Number(appt.appointment_id);
      } catch (e) {
        console.log(`  ${date} ${startTime.slice(0,5)} — SKIPPED (${e.sqlMessage || e.message})`);
        continue;
      }

      // Add dental findings
      const numFindings = randInt(1, 3);
      for (let f = 0; f < numFindings; f++) {
        await q(
          `INSERT INTO dental_findings (patient_id, doctor_id, appointment_id, tooth_number, surface, condition_type, notes, date_logged, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
          [patient.patientId, doctor.doctor_id, appointmentId, String(randInt(1, 32)), randFrom(SURFACES), randFrom(FINDINGS),
           `Finding during ${date} visit`, `${date} ${startTime}`]
        );
      }

      // Add treatment plans
      if (procCodes.length) {
        const numTreatments = randInt(1, 2);
        for (let tp = 0; tp < numTreatments; tp++) {
          const proc = randFrom(procCodes);
          const toothNum = String(randInt(1, 32));
          const surface = randFrom(SURFACES);
          const cost = proc.default_fees ? Number(proc.default_fees) : randInt(100, 800);

          await q(
            `INSERT INTO treatment_plans (patient_id, doctor_id, surface, procedure_code, status_id, tooth_number, estimated_cost, priority, start_date, target_completion_date, notes, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
            [patient.patientId, doctor.doctor_id, surface, proc.procedure_code,
             treatmentStatuses.COMPLETED || 3, toothNum, cost, randFrom(PRIORITIES),
             date, date, `${proc.description || 'Treatment'} — completed on ${date}`]
          );
        }
      }

      // Add invoice for completed appointment
      const invoiceAmount = randInt(150, 900);
      const insuranceCovered = Math.random() > 0.4 ? Math.round(invoiceAmount * (randInt(40, 80) / 100)) : 0;
      const patientAmount = invoiceAmount - insuranceCovered;

      // Check if patient has insurance
      const patientInsurance = await q('SELECT insurance_id FROM insurance WHERE patient_id = ? LIMIT 1', [patient.patientId]);
      const insuranceId = patientInsurance.length ? patientInsurance[0].insurance_id : null;

      await q(
        `INSERT INTO invoices (appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM_SEED', 'SYSTEM_SEED')`,
        [appointmentId, insuranceId, invoiceAmount, insuranceCovered, patientAmount, randFrom(['Paid', 'Paid', 'Partial', 'Unpaid'])]
      );

      console.log(`  ${date} ${startTime.slice(0,5)} — ${patient.first} ${patient.last} → Dr. ${doctor.name} [COMPLETED, ${numFindings} findings]`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. STAFF SCHEDULES (Mon–Sat, default all hours)
  // ─────────────────────────────────────────────────────────
  console.log('\n--- 4. Staff Schedules ---');
  const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const allStaff = await q(
    `SELECT st.staff_id, CONCAT(st.first_name, ' ', st.last_name) AS name, u.user_role AS role
     FROM staff st JOIN users u ON u.user_id = st.user_id
     WHERE u.is_deleted = 0 AND u.user_role IN ('DOCTOR', 'RECEPTIONIST')`
  );

  for (const member of allStaff) {
    for (const day of DAYS) {
      await q(
        `INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_off)
         VALUES (?, ?, '09:00:00', '19:00:00', 0)
         ON DUPLICATE KEY UPDATE start_time = '09:00:00', end_time = '19:00:00', is_off = 0`,
        [member.staff_id, day]
      );
    }
    console.log(`  ${member.name} [${member.role}]: 6 days seeded`);
  }

  // Summary
  console.log('\n=== Done ===');
  console.log('All patient passwords: Test123!');
  console.log(`Scheduled appointments: Apr 1–4 (${scheduledDates.length} days)`);
  console.log('Appointment requests: 5 patients for Apr 8–10');
  console.log(`Completed appointments: ${completedDates.length} days with treatments + invoices`);
  console.log(`Staff schedules: ${allStaff.length} members seeded\n`);

  pool.end();
})().catch((err) => {
  console.error('Seed error:', err);
  pool.end();
  process.exit(1);
});
