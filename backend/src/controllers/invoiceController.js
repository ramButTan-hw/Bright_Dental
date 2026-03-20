const pool = require('../../../database/db');

const getInvoices = (req, res) => {
  pool.query(
    `SELECT i.*, p.p_first_name, p.p_last_name, a.appointment_date, a.appointment_time
     FROM invoices i
     JOIN appointments a ON i.appointment_id = a.appointment_id
     JOIN patients p ON a.patient_id = p.patient_id
     ORDER BY i.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

const getInvoiceById = (req, res) => {
  pool.query(
    `SELECT i.*, p.p_first_name, p.p_last_name, a.appointment_date, a.appointment_time
     FROM invoices i
     JOIN appointments a ON i.appointment_id = a.appointment_id
     JOIN patients p ON a.patient_id = p.patient_id
     WHERE i.invoice_id = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Invoice not found' });
      res.json(results[0]);
    }
  );
};

const createInvoice = (req, res) => {
  const { appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status, created_by } = req.body;

  pool.query(
    `INSERT INTO invoices (appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [appointment_id, insurance_id, amount, insurance_covered_amount, patient_amount, payment_status || 'Pending', created_by],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Invoice created', invoice_id: result.insertId });
    }
  );
};

const updateInvoice = (req, res) => {
  const { payment_status, insurance_covered_amount, patient_amount, updated_by } = req.body;

  pool.query(
    `UPDATE invoices SET payment_status=?, insurance_covered_amount=?, patient_amount=?, updated_by=?
     WHERE invoice_id=?`,
    [payment_status, insurance_covered_amount, patient_amount, updated_by, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Invoice updated' });
    }
  );
};

module.exports = { getInvoices, getInvoiceById, createInvoice, updateInvoice };
