// backend/src/routes/kardex.js
const express = require('express');
const router = express.Router();

// Controladores y middlewares

const kardexCtrl = require('../controllers/kardex');
const { auth, role, verifyRoleAgainstDB } = require('../middleware/auth');
const { uploadAlumnoFoto } = require('../middleware/upload');

// Todas las rutas requieren autenticación

router.use(auth);

// Rutas de kardex

router.get('/alumno/me', kardexCtrl.getMyKardexAlumno);
router.get('/alumno/:id', kardexCtrl.getKardexAlumno);
router.get('/grupo/:id', kardexCtrl.getKardexGrupo);

// Rutas de administración

router.post(
  '/alumno/:id/foto',
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  uploadAlumnoFoto.single('foto'),
  kardexCtrl.uploadAlumnoPhoto
);

router.delete(
  '/alumno/:id/foto',
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  kardexCtrl.deleteAlumnoPhoto
);

// Rutas de generación de QR

router.post(
  '/alumno/:id/qr',
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  kardexCtrl.generateQrAlumno
);

// Rutas de generación de QR para grupos

router.post(
  '/grupo/:id/qr',
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  kardexCtrl.generateQrGrupo
);

// Exportar router

module.exports = router;