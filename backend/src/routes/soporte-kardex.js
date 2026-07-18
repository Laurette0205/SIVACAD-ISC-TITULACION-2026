'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/soporte-kardex');

const ROLES_SOPORTE = ['ADMINISTRADOR', 'SOPORTE'];

router.get('/diagnostico', auth, role(...ROLES_SOPORTE), ctrl.diagnostico);
router.get('/qr/validar/:token', auth, role(...ROLES_SOPORTE), ctrl.validarQR);
router.get('/verificar-rutas', auth, role(...ROLES_SOPORTE), ctrl.verificarRutas);
router.get('/incidencias', auth, role(...ROLES_SOPORTE), ctrl.incidencias);
router.post('/incidencias', auth, role(...ROLES_SOPORTE), ctrl.crearIncidencia);
router.patch('/incidencias/:id', auth, role(...ROLES_SOPORTE), ctrl.atenderIncidencia);
router.get('/monitoreo-carga', auth, role(...ROLES_SOPORTE), ctrl.monitoreoCarga);
router.post('/verificar-integridad', auth, role(...ROLES_SOPORTE), ctrl.verificarIntegridad);

module.exports = router;
