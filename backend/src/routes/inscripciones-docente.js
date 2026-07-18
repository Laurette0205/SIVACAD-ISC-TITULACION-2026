'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/inscripciones-docente');

router.get('/mis-grupos', auth, ctrl.getMisGrupos);
router.get('/grupos/:idGrupo/periodo/:idPeriodo/lista-alumnos', auth, ctrl.getListaAlumnos);
router.get('/grupos/:idGrupo/periodo/:idPeriodo/cambios', auth, ctrl.getCambiosInscripcion);
router.get('/cambios', auth, ctrl.getCambiosInscripcion);
router.get('/notificaciones', auth, ctrl.getNotificaciones);
router.put('/notificaciones/:id/leer', auth, ctrl.marcarNotificacionLeida);
router.put('/notificaciones/leer-todas', auth, ctrl.marcarTodasLeidas);
router.get('/grupos/:idGrupo/periodo/:idPeriodo/inconsistencias', auth, ctrl.getInconsistencias);
router.get('/inconsistencias', auth, ctrl.getInconsistencias);

module.exports = router;
