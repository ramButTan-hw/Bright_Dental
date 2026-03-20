const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const doctorRoutes = require('./src/routes/doctorRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');
const prescriptionRoutes = require('./src/routes/prescriptionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Medical Clinic API is running' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
