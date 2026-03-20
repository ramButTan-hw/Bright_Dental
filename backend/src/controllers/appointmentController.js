const pool = require('../../../database/db');

const getAppointments = (req, res) => {
  pool.query(
    `SELECT a.*,
       p.p_first_name, p.p_last_name,
       s.first_name AS doctor_first_name, s.last_name AS doctor_last_name,
       l.location_city, l.loc_street_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     JOIN doctors d ON a.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     LEFT JOIN locations l ON a.location_id = l.location_id
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getAppointmentById = (req, res) => {
  pool.query(
    `SELECT a.*,
       p.p_first_name, p.p_last_name,
       s.first_name AS doctor_first_name, s.last_name AS doctor_last_name,
       l.location_city, l.loc_street_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     JOIN doctors d ON a.doctor_id = d.doctor_id
     JOIN staff s ON d.staff_id = s.staff_id
     LEFT JOIN locations l ON a.location_id = l.location_id
     WHERE a.appointment_id = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      res.json(results[0]);
    }
  );
};

const createAppointment = (req, res) => {
  const { patient_id, doctor_id, location_id, appointment_date, appointment_time, appt_status, created_by } = req.body;

  pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, location_id, appointment_date, appointment_time, appt_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [patient_id, doctor_id, location_id, appointment_date, appointment_time, appt_status || 'Scheduled', created_by],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Appointment created', appointment_id: result.insertId });
    }
  );
};

const updateAppointment = (req, res) => {
  const { patient_id, doctor_id, location_id, appointment_date, appointment_time, appt_status, cancel_reason, updated_by } = req.body;

  pool.query(
    `UPDATE appointments SET
       patient_id=?, doctor_id=?, location_id=?, appointment_date=?, appointment_time=?,
       appt_status=?, cancel_reason=?, updated_by=?
     WHERE appointment_id=?`,
    [patient_id, doctor_id, location_id, appointment_date, appointment_time, appt_status, cancel_reason, updated_by, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Appointment updated' });
    }
  );
};

const deleteAppointment = (req, res) => {
  pool.query(
    'DELETE FROM appointments WHERE appointment_id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Appointment deleted' });
    }
  );
};

module.exports = { getAppointments, getAppointmentById, createAppointment, updateAppointment, deleteAppointment };
