// ==============================
// 📦 IMPORTACIONES
// ==============================
const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const {
  listarInscripciones,
  crearInscripcion
} = require('../controllers/inscripciones');

// ==============================
// 👮 ROLES PERMITIDOS
// ==============================
const ROLES_ADMIN_COORD = ['ADMINISTRADOR', 'COORDINADOR'];
const ROLES_CONSULTA = ['ADMINISTRADOR', 'COORDINADOR', 'ALUMNO'];

// ==============================
// 📝 INSCRIPCIONES
// ==============================

// Historial general
router.get(
  '/',
  auth,
  role(...ROLES_CONSULTA),
  listarInscripciones
);

// Crear inscripción
router.post(
  '/',
  auth,
  role(...ROLES_ADMIN_COORD),
  crearInscripcion
);

// ==============================
// 📤 EXPORTAR
// ==============================
module.exports = router;
