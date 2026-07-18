'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  getCatalogosKardex,
  getKardexGrupo,
  getKardexAlumnoDetalle,
  getResumenPorPeriodo,
  getHistorialPorCarrera,
  getValidacionTrayectoria,
  getDiagnosticoRezago,
  getDiagnosticoIrregularidades
} = require('../controllers/kardex-coordinador');

const ROLES_COORD = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/catalogos', auth, role(...ROLES_COORD), getCatalogosKardex);
router.get('/grupo/:idGrupo', auth, role(...ROLES_COORD), getKardexGrupo);
router.get('/alumno/:idAlumno', auth, role(...ROLES_COORD), getKardexAlumnoDetalle);
router.get('/resumen/periodo/:idPeriodo', auth, role(...ROLES_COORD), getResumenPorPeriodo);
router.get('/historial/carrera/:idCarrera', auth, role(...ROLES_COORD), getHistorialPorCarrera);
router.get('/validar/trayectoria/:idAlumno', auth, role(...ROLES_COORD), getValidacionTrayectoria);
router.get('/diagnostico/rezago', auth, role(...ROLES_COORD), getDiagnosticoRezago);
router.get('/diagnostico/irregularidades', auth, role(...ROLES_COORD), getDiagnosticoIrregularidades);

module.exports = router;
