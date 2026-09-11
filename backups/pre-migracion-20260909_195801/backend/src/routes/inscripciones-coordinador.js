const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const {
  getBandejaSolicitudes,
  getValidacionPorGrupo,
  getCuposDisponibles,
  getHistorialEstados,
  getObservacionesAcademicas,
  updateEstadoCoordinador,
  asignarGrupo,
  registrarObservacion,
  actualizarCupo,
  getCatalogosCoordinador
} = require('../controllers/inscripciones-coordinador');

const ROLES_COORD = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/bandeja', auth, role(...ROLES_COORD), getBandejaSolicitudes);

router.get('/validacion-grupo', auth, role(...ROLES_COORD), getValidacionPorGrupo);

router.get('/cupos', auth, role(...ROLES_COORD), getCuposDisponibles);

router.get('/historial/:id_inscripcion', auth, role(...ROLES_COORD), getHistorialEstados);

router.get('/observaciones', auth, role(...ROLES_COORD), getObservacionesAcademicas);

router.get('/catalogos', auth, role(...ROLES_COORD), getCatalogosCoordinador);

router.put('/inscripciones/:id/estado', auth, role(...ROLES_COORD), updateEstadoCoordinador);

router.put('/inscripciones/:id/grupo', auth, role(...ROLES_COORD), asignarGrupo);

router.post('/inscripciones/:id/observaciones', auth, role(...ROLES_COORD), registrarObservacion);

router.put('/cupos/:id', auth, role(...ROLES_COORD), actualizarCupo);

module.exports = router;
