const { Router } = require('express');
const {
  getPatients, getPatientById, createPatient,
  updatePatient, deletePatient,
  getPatientAppointments, getPatientPrescriptions
} = require('../controllers/patientController');

const router = Router();

router.get('/', getPatients);
router.get('/:id', getPatientById);
router.post('/', createPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.get('/:id/appointments', getPatientAppointments);
router.get('/:id/prescriptions', getPatientPrescriptions);

module.exports = router;
