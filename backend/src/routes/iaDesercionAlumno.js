'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  miRiesgo,
  recomendaciones,
  historial,
  progreso
} = require('../controllers/iaDesercionAlumno');

const ROLES_ALUMNO = ['ADMINISTRADOR', 'COORDINADOR', 'ALUMNO'];

router.get('/alumno/mi-riesgo', auth, role(...ROLES_ALUMNO), miRiesgo);
router.get('/alumno/recomendaciones', auth, role(...ROLES_ALUMNO), recomendaciones);
router.get('/alumno/historial', auth, role(...ROLES_ALUMNO), historial);
router.get('/alumno/progreso', auth, role(...ROLES_ALUMNO), progreso);

module.exports = router;
