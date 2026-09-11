'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/admin-reinscripciones');

const ROLES_ADMIN = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/metrics', auth, role(...ROLES_ADMIN), ctrl.getMetrics);
router.get('/reinscripciones', auth, role(...ROLES_ADMIN), ctrl.listarReinscripciones);
router.get('/incidencias', auth, role(...ROLES_ADMIN), ctrl.getIncidencias);
router.get('/bitacora', auth, role(...ROLES_ADMIN), ctrl.getBitacora);
router.get('/historial', auth, role(...ROLES_ADMIN), ctrl.getHistorialInstitucional);
router.get('/catalogos', auth, role(...ROLES_ADMIN), ctrl.getCatalogos);
router.get('/export', auth, role(...ROLES_ADMIN), ctrl.exportReport);

module.exports = router;
