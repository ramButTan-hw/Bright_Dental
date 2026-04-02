require('dotenv').config();
const mysql = require('mysql2/promise');

const TAG = 'RAILWAY_REF_SEED_2026_04_02';

async function upsertLookupTables(conn) {
  await conn.query(
    `INSERT INTO appointment_statuses (status_name, display_name, created_by) VALUES
      ('SCHEDULED','Scheduled',?),
      ('CONFIRMED','Confirmed',?),
      ('COMPLETED','Completed',?),
      ('CANCELLED','Cancelled',?),
      ('NO_SHOW','No Show',?),
      ('RESCHEDULED','Rescheduled',?),
      ('CHECKED_IN','Checked In',?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [TAG, TAG, TAG, TAG, TAG, TAG, TAG]
  );

  await conn.query(
    `INSERT INTO treatment_statuses (status_name, display_name, created_by) VALUES
      ('PLANNED','Planned',?),
      ('IN_PROGRESS','In Progress',?),
      ('COMPLETED','Completed',?),
      ('CANCELLED','Cancelled',?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    [TAG, TAG, TAG, TAG]
  );

  await conn.query(
    `INSERT INTO cancel_reasons (reason_text, category, created_by)
     VALUES ('Doctor Unavailable','PROVIDER',?)
     ON DUPLICATE KEY UPDATE category = VALUES(category)`,
    [TAG]
  );

  await conn.query(
    `INSERT INTO payment_methods (method_name, display_name, is_active, created_by) VALUES
      ('CASH','Cash',1,?),
      ('CARD','Card',1,?),
      ('ACH','ACH',1,?),
      ('CHECK','Check',1,?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = VALUES(is_active)`,
    [TAG, TAG, TAG, TAG]
  );

  await conn.query(
    `INSERT INTO intake_tobacco_types (tobacco_label, display_order, is_active, created_by) VALUES
      ('Never',1,1,?),('Quit',2,1,?),('Cigarettes',3,1,?),('Cigars',4,1,?),('Smokeless Tobacco',5,1,?)
     ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active)`,
    [TAG, TAG, TAG, TAG, TAG]
  );

  await conn.query(
    `INSERT INTO intake_caffeine_types (caffeine_label, display_order, is_active, created_by) VALUES
      ('None',1,1,?),('Coffee',2,1,?),('Tea',3,1,?),('Soda',4,1,?)
     ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active)`,
    [TAG, TAG, TAG, TAG]
  );

  await conn.query(
    `INSERT INTO intake_pain_symptoms (symptom_label, display_order, is_active, created_by) VALUES
      ('TMJ clicking/grating',1,1,?),
      ('TMJ locking/stiffness',2,1,?),
      ('Inability to open mouth',3,1,?),
      ('Mouth does not open straight',4,1,?),
      ('Pain when eating/chewing',5,1,?),
      ('Pain in jaw or jaw joint',6,1,?),
      ('Unstable bite',7,1,?),
      ('Headache',8,1,?),
      ('Face Pain',9,1,?),
      ('Ear pain/stiffness',10,1,?),
      ('Ringing in ears',11,1,?),
      ('Difficulty swallowing',12,1,?),
      ('Neck pain',13,1,?),
      ('Face muscle fatigue',14,1,?),
      ('Toothache',15,1,?),
      ('Jaw Pain',16,1,?),
      ('Sensitivity',17,1,?),
      ('Gum Pain',18,1,?)
     ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active)`,
    [
      TAG, TAG, TAG, TAG, TAG, TAG, TAG, TAG, TAG,
      TAG, TAG, TAG, TAG, TAG, TAG, TAG, TAG, TAG
    ]
  );
}

async function upsertCoreReferenceRows(conn) {
  const locations = [
    ['Houston', 'TX', '3412', 'Fannin St', '77004'],
    ['Sugar Land', 'TX', '1540', 'Main St', '77479'],
    ['Houston', 'TX', '1001', 'Congress Ave', '77002']
  ];

  for (const [city, state, streetNo, streetName, zip] of locations) {
    await conn.query(
      `INSERT INTO locations (location_city, location_state, loc_street_no, loc_street_name, loc_zip_code, created_by, updated_by)
       SELECT ?, ?, ?, ?, ?, ?, ?
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM locations
         WHERE location_city = ?
           AND location_state = ?
           AND loc_street_no = ?
           AND loc_street_name = ?
           AND loc_zip_code = ?
       )`,
      [city, state, streetNo, streetName, zip, TAG, TAG, city, state, streetNo, streetName, zip]
    );
  }

  const insurers = [
    ['BlueCross Dental', 'Houston', 'TX', '77001', '800-111-2200'],
    ['Aetna Dental', 'Houston', 'TX', '77002', '800-222-3300'],
    ['Delta Dental', 'Houston', 'TX', '77003', '800-333-4400'],
    ['Cigna Dental', 'Dallas', 'TX', '75001', '800-444-5500'],
    ['Guardian Dental', 'Austin', 'TX', '73301', '800-555-6600'],
    ['MetLife Dental', 'San Antonio', 'TX', '78201', '800-666-7700'],
    ['Humana Dental', 'Houston', 'TX', '77005', '800-777-8800']
  ];

  for (const [name, city, state, zipcode, phone] of insurers) {
    await conn.query(
      `INSERT INTO insurance_companies (company_name, city, state, zipcode, phone_number, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_by = VALUES(updated_by)`,
      [name, city, state, zipcode, phone, TAG, TAG]
    );
  }

  const pharmacies = [
    ['CVS Midtown', '713-555-1111', '2500 Main St', 'Houston', 'TX', '77002'],
    ['Walgreens Sugar Land', '281-555-2222', '1220 Hwy 6', 'Sugar Land', 'TX', '77479'],
    ['HEB Pharmacy Museum', '713-555-3333', '3601 Southmore Blvd', 'Houston', 'TX', '77004'],
    ['Kroger Pharmacy Downtown', '713-555-4444', '1440 Studemont St', 'Houston', 'TX', '77007'],
    ['Randalls Pharmacy West U', '713-555-5555', '3131 W Holcombe Blvd', 'Houston', 'TX', '77025'],
    ['Walmart Pharmacy Rosenberg', '281-555-6666', '5330 FM 1640 Rd', 'Richmond', 'TX', '77469'],
    ['Costco Pharmacy Galleria', '713-555-7777', '3836 Richmond Ave', 'Houston', 'TX', '77027']
  ];

  for (const [name, phone, addr1, city, state, zip] of pharmacies) {
    await conn.query(
      `INSERT INTO pharmacies (pharm_name, pharm_phone, ph_address_1, ph_city, ph_state, ph_zipcode, ph_country, created_by, updated_by)
       SELECT ?, ?, ?, ?, ?, ?, 'US', ?, ?
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM pharmacies
         WHERE pharm_name = ?
           AND ph_city = ?
           AND ph_state = ?
           AND ph_zipcode = ?
       )`,
      [name, phone, addr1, city, state, zip, TAG, TAG, name, city, state, zip]
    );
  }

  const procedures = [
    ['D0120', 'Periodic oral evaluation', 'Diagnostic', 95.0],
    ['D0140', 'Limited oral evaluation', 'Diagnostic', 120.0],
    ['D0150', 'Comprehensive oral evaluation', 'Diagnostic', 145.0],
    ['D0210', 'Intraoral complete series of radiographic images', 'Diagnostic', 210.0],
    ['D1110', 'Adult prophylaxis', 'Preventive', 165.0],
    ['D1206', 'Topical fluoride varnish', 'Preventive', 85.0],
    ['D1351', 'Sealant per tooth', 'Preventive', 72.0],
    ['D2140', 'Amalgam one surface', 'Restorative', 255.0],
    ['D2330', 'Resin one surface anterior', 'Restorative', 325.0],
    ['D2392', 'Resin two surface posterior', 'Restorative', 355.0],
    ['D3310', 'Endodontic therapy anterior tooth', 'Endodontics', 760.0],
    ['D2740', 'Crown porcelain/ceramic', 'Prosthodontics', 980.0],
    ['D4341', 'Periodontal scaling and root planing', 'Periodontics', 420.0],
    ['D4342', 'Periodontal scaling and root planing one to three teeth', 'Periodontics', 280.0],
    ['D4910', 'Periodontal maintenance', 'Periodontics', 225.0],
    ['D7140', 'Extraction erupted tooth', 'Oral Surgery', 275.0],
    ['D7210', 'Surgical removal erupted tooth', 'Oral Surgery', 420.0]
  ];

  for (const [code, desc, category, fee] of procedures) {
    await conn.query(
      `INSERT INTO ada_procedure_codes (procedure_code, description, category, default_fees, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category), default_fees = VALUES(default_fees), updated_by = VALUES(updated_by)`,
      [code, desc, category, fee, TAG, TAG]
    );
  }

  const coverageProfiles = {
    'BlueCross Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 90, copay: 10 },
      restorative: { percent: 80, copay: 25 },
      endodontics: { percent: 70, copay: 40 },
      periodontics: { percent: 70, copay: 35 },
      oralSurgery: { percent: 65, copay: 50 },
      prosthodontics: { percent: 60, copay: 75 }
    },
    'Aetna Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 85, copay: 15 },
      restorative: { percent: 75, copay: 30 },
      endodontics: { percent: 65, copay: 45 },
      periodontics: { percent: 65, copay: 40 },
      oralSurgery: { percent: 60, copay: 55 },
      prosthodontics: { percent: 55, copay: 85 }
    },
    'Delta Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 90, copay: 10 },
      restorative: { percent: 80, copay: 20 },
      endodontics: { percent: 75, copay: 35 },
      periodontics: { percent: 75, copay: 30 },
      oralSurgery: { percent: 70, copay: 45 },
      prosthodontics: { percent: 60, copay: 70 }
    },
    'Cigna Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 85, copay: 15 },
      restorative: { percent: 75, copay: 30 },
      endodontics: { percent: 70, copay: 40 },
      periodontics: { percent: 70, copay: 35 },
      oralSurgery: { percent: 65, copay: 50 },
      prosthodontics: { percent: 55, copay: 80 }
    },
    'Guardian Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 90, copay: 10 },
      restorative: { percent: 80, copay: 25 },
      endodontics: { percent: 70, copay: 40 },
      periodontics: { percent: 70, copay: 35 },
      oralSurgery: { percent: 65, copay: 50 },
      prosthodontics: { percent: 60, copay: 75 }
    },
    'MetLife Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 85, copay: 15 },
      restorative: { percent: 75, copay: 30 },
      endodontics: { percent: 70, copay: 45 },
      periodontics: { percent: 70, copay: 40 },
      oralSurgery: { percent: 65, copay: 55 },
      prosthodontics: { percent: 55, copay: 85 }
    },
    'Humana Dental': {
      preventive: { percent: 100, copay: 0 },
      diagnostic: { percent: 85, copay: 15 },
      restorative: { percent: 75, copay: 30 },
      endodontics: { percent: 65, copay: 45 },
      periodontics: { percent: 65, copay: 40 },
      oralSurgery: { percent: 60, copay: 55 },
      prosthodontics: { percent: 55, copay: 85 }
    }
  };

  const [companyRows] = await conn.query(
    `SELECT company_id, company_name FROM insurance_companies WHERE company_name IN (?)`,
    [Object.keys(coverageProfiles)]
  );
  const companyIdByName = new Map(companyRows.map((row) => [row.company_name, Number(row.company_id)]));

  const procedureBuckets = {
    preventive: ['D1110', 'D1206', 'D1351'],
    diagnostic: ['D0120', 'D0140', 'D0150', 'D0210'],
    restorative: ['D2140', 'D2330', 'D2392'],
    endodontics: ['D3310'],
    periodontics: ['D4341', 'D4342', 'D4910'],
    oralSurgery: ['D7140', 'D7210'],
    prosthodontics: ['D2740']
  };

  for (const [companyName, profile] of Object.entries(coverageProfiles)) {
    const companyId = companyIdByName.get(companyName);
    if (!companyId) continue;

    for (const [bucket, codes] of Object.entries(procedureBuckets)) {
      const cfg = profile[bucket];
      if (!cfg) continue;

      for (const code of codes) {
        await conn.query(
          `INSERT INTO insurance_coverage (company_id, procedure_code, coverage_percent, copay_amount, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             coverage_percent = VALUES(coverage_percent),
             copay_amount = VALUES(copay_amount),
             updated_by = VALUES(updated_by)`,
          [companyId, code, cfg.percent, cfg.copay, TAG, TAG]
        );
      }
    }
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await upsertLookupTables(conn);
    await upsertCoreReferenceRows(conn);
    const [[doctorCount]] = await conn.query('SELECT COUNT(*) AS c FROM doctors');
    if (!Number(doctorCount?.c || 0)) {
      throw new Error('No doctors currently exist in Railway. Please create at least one doctor first.');
    }
    console.log('Railway reference data seeded successfully.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Railway reference seed failed:', err.message);
  process.exit(1);
});
