'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  misGrupos,
  alumnosGrupo,
  listAlertas,
  detalleAlumno,
  registrarObservacion,
  historialIntervenciones,
  recomendaciones
} = require('../controllers/iaBienestarDocente');

const ROLES_DOCENTE = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'];

router.get('/docente-bienestar/mis-grupos', auth, role(...ROLES_DOCENTE), misGrupos);
router.get('/docente-bienestar/grupos/:idGrupo/alumnos', auth, role(...ROLES_DOCENTE), alumnosGrupo);
router.get('/docente-bienestar/alertas', auth, role(...ROLES_DOCENTE), listAlertas);
router.get('/docente-bienestar/alumnos/:idAlumno/detalle', auth, role(...ROLES_DOCENTE), detalleAlumno);
router.post('/docente-bienestar/observaciones', auth, role(...ROLES_DOCENTE), registrarObservacion);
router.get('/docente-bienestar/alumnos/:idAlumno/historial', auth, role(...ROLES_DOCENTE), historialIntervenciones);
router.get('/docente-bienestar/recomendaciones', auth, role(...ROLES_DOCENTE), recomendaciones);

module.exports = router;
