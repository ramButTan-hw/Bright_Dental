const pool = require('../../../database/db');

const getDoctors = (req, res) => {
  pool.query(
    `SELECT d.doctor_id, d.npi, s.first_name, s.last_name, s.phone_number,
       GROUP_CONCAT(sd.specialty SEPARATOR ', ') AS specialties
     FROM doctors d
     JOIN staff s ON d.staff_id = s.staff_id
     LEFT JOIN specialties_department sd ON d.doctor_id = sd.doctor_id
     GROUP BY d.doctor_id`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getDoctorById = (req, res) => {
  pool.query(
    `SELECT d.doctor_id, d.npi, s.first_name, s.last_name, s.phone_number, s.date_of_birth, s.gender,
       GROUP_CONCAT(sd.specialty SEPARATOR ', ') AS specialties
     FROM doctors d
     JOIN staff s ON d.staff_id = s.staff_id
     LEFT JOIN specialties_department sd ON d.doctor_id = sd.doctor_id
     WHERE d.doctor_id = ?
     GROUP BY d.doctor_id`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Doctor not found' });
      res.json(results[0]);
    }
  );
};

const getDoctorAppointments = (req, res) => {
  pool.query(
    `SELECT a.*, p.p_first_name, p.p_last_name, l.location_city
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     LEFT JOIN locations l ON a.location_id = l.location_id
     WHERE a.doctor_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

module.exports = { getDoctors, getDoctorById, getDoctorAppointments };
