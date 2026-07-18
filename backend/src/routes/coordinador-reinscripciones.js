'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/coordinador-reinscripciones');

const ROLES_COORD = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/bandeja', auth, role(...ROLES_COORD), ctrl.getBandeja);
router.get('/validacion-grupo', auth, role(...ROLES_COORD), ctrl.getValidacionPorGrupo);
router.get('/detalle/:id_inscripcion', auth, role(...ROLES_COORD), ctrl.getDetalleAlumno);
router.get('/catalogos', auth, role(...ROLES_COORD), ctrl.getCatalogos);
router.put('/inscripciones/:id/estado', auth, role(...ROLES_COORD), ctrl.updateEstado);
router.put('/inscripciones/:id/grupo', auth, role(...ROLES_COORD), ctrl.asignarGrupo);
router.post('/inscripciones/:id/observaciones', auth, role(...ROLES_COORD), ctrl.registrarObservacion);

module.exports = router;
