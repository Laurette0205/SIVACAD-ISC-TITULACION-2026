'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/soporte-tramites');

const ROLES_SOPORTE = ['ADMINISTRADOR', 'SOPORTE'];

// Panel técnico
router.get('/panel', auth, role(...ROLES_SOPORTE), ctrl.getPanel);

// Incidencias
router.get('/incidencias', auth, role(...ROLES_SOPORTE), ctrl.getIncidencias);
router.post('/incidencias', auth, role(...ROLES_SOPORTE), ctrl.crearIncidencia);
router.put('/incidencias/:id', auth, role(...ROLES_SOPORTE), ctrl.actualizarIncidencia);

// Archivos
router.get('/archivos', auth, role(...ROLES_SOPORTE), ctrl.getArchivos);
router.put('/archivos/:id/validar', auth, role(...ROLES_SOPORTE), ctrl.validarArchivo);

// Recuperación
router.get('/recuperacion', auth, role(...ROLES_SOPORTE), ctrl.getRecuperacion);
router.post('/recuperacion', auth, role(...ROLES_SOPORTE), ctrl.realizarRecuperacion);

// Integridad
router.post('/validar-integridad', auth, role(...ROLES_SOPORTE), ctrl.validarIntegridad);

// Historial técnico
router.get('/historial', auth, role(...ROLES_SOPORTE), ctrl.getHistorial);

// Errores
router.get('/errores', auth, role(...ROLES_SOPORTE), ctrl.getErrores);

// Reintentar
router.post('/reintentar/:id', auth, role(...ROLES_SOPORTE), ctrl.reintentarProceso);

// Compatibilidad
router.post('/validar-compatibilidad', auth, role(...ROLES_SOPORTE), ctrl.validarCompatibilidad);

// Trámites (vista técnica)
router.get('/tramites', auth, role(...ROLES_SOPORTE), ctrl.listarTramites);
router.get('/tramites-especiales', auth, role(...ROLES_SOPORTE), ctrl.getTramitesEspeciales);

module.exports = router;
