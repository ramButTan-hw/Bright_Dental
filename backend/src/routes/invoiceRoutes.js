const { Router } = require('express');
const { getInvoices, getInvoiceById, createInvoice, updateInvoice } = require('../controllers/invoiceController');

const router = Router();

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);

module.exports = router;
