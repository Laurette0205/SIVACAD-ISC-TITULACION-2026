'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  misGrupos,
  alumnosGrupo,
  listAlertas,
  detalleAlerta,
  registrarObservacion,
  historialAlumno,
  recomendaciones
} = require('../controllers/iaDesercionDocente');

const ROLES_DOCENTE = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'];

router.get('/docente/mis-grupos', auth, role(...ROLES_DOCENTE), misGrupos);
router.get('/docente/grupos/:idGrupo/alumnos', auth, role(...ROLES_DOCENTE), alumnosGrupo);
router.get('/docente/alertas', auth, role(...ROLES_DOCENTE), listAlertas);
router.get('/docente/alertas/:id', auth, role(...ROLES_DOCENTE), detalleAlerta);
router.post('/docente/observaciones', auth, role(...ROLES_DOCENTE), registrarObservacion);
router.get('/docente/alumnos/:idAlumno/historial', auth, role(...ROLES_DOCENTE), historialAlumno);
router.get('/docente/recomendaciones', auth, role(...ROLES_DOCENTE), recomendaciones);

module.exports = router;
