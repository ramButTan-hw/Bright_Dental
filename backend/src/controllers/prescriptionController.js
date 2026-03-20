const pool = require('../../../database/db');

const getPrescriptions = (req, res) => {
  pool.query(
    `SELECT pr.*, p.p_first_name, p.p_last_name, s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
     FROM prescriptions pr
     JOIN patients p ON pr.patient_id = p.patient_id
     JOIN doctors d ON pr.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     ORDER BY pr.date_prescribed DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getPrescriptionById = (req, res) => {
  pool.query(
    `SELECT pr.*, p.p_first_name, p.p_last_name, s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
     FROM prescriptions pr
     JOIN patients p ON pr.patient_id = p.patient_id
     JOIN doctors d ON pr.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     WHERE pr.prescription_id = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Prescription not found' });
      res.json(results[0]);
    }
  );
};

const createPrescription = (req, res) => {
  const {
    plan_id, patient_id, pharm_id, doctor_id,
    medication_name, instructions, strength, dosage,
    date_prescribed, quantity, refills, created_by
  } = req.body;

  pool.query(
    `INSERT INTO prescriptions
       (plan_id, patient_id, pharm_id, doctor_id, medication_name, instructions,
        strength, dosage, date_prescribed, quantity, refills, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [plan_id, patient_id, pharm_id, doctor_id, medication_name, instructions,
     strength, dosage, date_prescribed, quantity, refills, created_by],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Prescription created', prescription_id: result.insertId });
    }
  );
};

module.exports = { getPrescriptions, getPrescriptionById, createPrescription };
