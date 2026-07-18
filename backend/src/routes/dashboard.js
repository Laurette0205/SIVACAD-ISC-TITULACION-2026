// ==============================
// 📦 IMPORTACIONES
// ==============================
const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');

const {
    getDashboard
} = require('../controllers/dashboard');

// ==============================
// 📊 DASHBOARD
// ==============================
router.get('/', auth, getDashboard);

// ==============================
// 📤 EXPORTAR
// ==============================
module.exports = router;