const { Router } = require('express');
const { login, getUsers } = require('../controllers/authController');

const router = Router();

router.post('/login', login);
router.get('/users', getUsers);

module.exports = router;
