const { Router } = require('express');
const { getDoctors, getDoctorById, getDoctorAppointments } = require('../controllers/doctorController');

const router = Router();

router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/appointments', getDoctorAppointments);

module.exports = router;
