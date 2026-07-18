'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  estadoServicio,
  bitacora,
  errores,
  conectividad,
  integridad,
  exportarDatos,
  saludModulos,
  monitoreoRutas
} = require('../controllers/iaBienestarSoporte');

const ROLES_SOPORTE = ['ADMINISTRADOR', 'SOPORTE'];

router.get('/soporte-bienestar/estado', auth, role(...ROLES_SOPORTE), estadoServicio);
router.get('/soporte-bienestar/bitacora', auth, role(...ROLES_SOPORTE), bitacora);
router.get('/soporte-bienestar/errores', auth, role(...ROLES_SOPORTE), errores);
router.get('/soporte-bienestar/conectividad', auth, role(...ROLES_SOPORTE), conectividad);
router.get('/soporte-bienestar/integridad', auth, role(...ROLES_SOPORTE), integridad);
router.get('/soporte-bienestar/exportar', auth, role(...ROLES_SOPORTE), exportarDatos);
router.post('/soporte-bienestar/salud', auth, role(...ROLES_SOPORTE), saludModulos);
router.get('/soporte-bienestar/rutas', auth, role(...ROLES_SOPORTE), monitoreoRutas);

module.exports = router;
