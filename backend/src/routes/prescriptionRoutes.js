const { Router } = require('express');
const { getPrescriptions, getPrescriptionById, createPrescription } = require('../controllers/prescriptionController');

const router = Router();

router.get('/', getPrescriptions);
router.get('/:id', getPrescriptionById);
router.post('/', createPrescription);

module.exports = router;
