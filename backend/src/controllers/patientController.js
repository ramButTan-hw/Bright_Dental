const pool = require('../../../database/db');

const getPatients = (req, res) => {
  pool.query(
    'SELECT patient_id, p_first_name, p_last_name, p_dob, p_gender, p_phone, p_email, p_city, p_state, p_emergency_contact_name, p_emergency_contact_phone FROM patients',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getPatientById = (req, res) => {
  pool.query(
    'SELECT * FROM patients WHERE patient_id = ?',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Patient not found' });
      res.json(results[0]);
    }
  );
};

const createPatient = (req, res) => {
  const {
    p_first_name, p_last_name, p_dob, p_gender, p_race, p_ethnicity,
    p_phone, p_email, p_address_1, p_address_2, p_city, p_state, p_zipcode, p_country,
    p_emergency_contact_name, p_emergency_contact_phone, created_by
  } = req.body;

  pool.query(
    `INSERT INTO patients
      (p_first_name, p_last_name, p_dob, p_gender, p_race, p_ethnicity,
       p_phone, p_email, p_address_1, p_address_2, p_city, p_state, p_zipcode, p_country,
       p_emergency_contact_name, p_emergency_contact_phone, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p_first_name, p_last_name, p_dob, p_gender, p_race, p_ethnicity,
      p_phone, p_email, p_address_1, p_address_2, p_city, p_state, p_zipcode, p_country,
      p_emergency_contact_name, p_emergency_contact_phone, created_by
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Patient created', patient_id: result.insertId });
    }
  );
};

const updatePatient = (req, res) => {
  const {
    p_first_name, p_last_name, p_dob, p_gender, p_race, p_ethnicity,
    p_phone, p_email, p_address_1, p_address_2, p_city, p_state, p_zipcode, p_country,
    p_emergency_contact_name, p_emergency_contact_phone, updated_by
  } = req.body;

  pool.query(
    `UPDATE patients SET
      p_first_name=?, p_last_name=?, p_dob=?, p_gender=?, p_race=?, p_ethnicity=?,
      p_phone=?, p_email=?, p_address_1=?, p_address_2=?, p_city=?, p_state=?, p_zipcode=?, p_country=?,
      p_emergency_contact_name=?, p_emergency_contact_phone=?, updated_by=?
     WHERE patient_id=?`,
    [
      p_first_name, p_last_name, p_dob, p_gender, p_race, p_ethnicity,
      p_phone, p_email, p_address_1, p_address_2, p_city, p_state, p_zipcode, p_country,
      p_emergency_contact_name, p_emergency_contact_phone, updated_by, req.params.id
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Patient updated' });
    }
  );
};

const deletePatient = (req, res) => {
  pool.query(
    'DELETE FROM patients WHERE patient_id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Patient deleted' });
    }
  );
};

const getPatientAppointments = (req, res) => {
  pool.query(
    `SELECT a.*, s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getPatientPrescriptions = (req, res) => {
  pool.query(
    `SELECT p.*, s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
     FROM prescriptions p
     JOIN doctors d ON p.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     WHERE p.patient_id = ?
     ORDER BY p.date_prescribed DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

module.exports = {
  getPatients, getPatientById, createPatient,
  updatePatient, deletePatient,
  getPatientAppointments, getPatientPrescriptions
};
