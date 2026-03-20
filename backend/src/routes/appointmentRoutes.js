const { Router } = require('express');
const {
  getAppointments, getAppointmentById,
  createAppointment, updateAppointment, deleteAppointment
} = require('../controllers/appointmentController');

const router = Router();

router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

module.exports = router;
