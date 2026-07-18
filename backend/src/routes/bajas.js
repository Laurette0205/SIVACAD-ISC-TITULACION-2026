const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const { listBajas } = require('../controllers/bajas');

router.get('/', auth, role('administrador'), listBajas);

module.exports = router;