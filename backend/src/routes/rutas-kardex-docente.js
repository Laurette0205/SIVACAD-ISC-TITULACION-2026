'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  getMisGrupos,
  getKardexGrupo,
  getKardexAlumno,
  getResumenDesempeno,
  getHistorialEvaluacion
} = require('../controllers/kardex-docente');

const ROLES_DOCENTE = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'];

router.get('/mis-grupos', auth, role(...ROLES_DOCENTE), getMisGrupos);
router.get('/grupo/:idGrupo', auth, role(...ROLES_DOCENTE), getKardexGrupo);
router.get('/alumno/:idAlumno', auth, role(...ROLES_DOCENTE), getKardexAlumno);
router.get('/alumno/:idAlumno/desempeno', auth, role(...ROLES_DOCENTE), getResumenDesempeno);
router.get('/alumno/:idAlumno/historial', auth, role(...ROLES_DOCENTE), getHistorialEvaluacion);

module.exports = router;
