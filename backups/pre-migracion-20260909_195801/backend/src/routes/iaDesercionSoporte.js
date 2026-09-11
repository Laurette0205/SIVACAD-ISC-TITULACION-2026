'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  estadoServicio,
  logs,
  errores,
  conectividad,
  integridad,
  verificacionCompleta,
  rutasModulo
} = require('../controllers/iaDesercionSoporte');

const ROLES_SOPORTE = ['ADMINISTRADOR', 'SOPORTE'];

router.get('/soporte/estado', auth, role(...ROLES_SOPORTE), estadoServicio);
router.get('/soporte/logs', auth, role(...ROLES_SOPORTE), logs);
router.get('/soporte/errores', auth, role(...ROLES_SOPORTE), errores);
router.get('/soporte/conectividad', auth, role(...ROLES_SOPORTE), conectividad);
router.get('/soporte/integridad', auth, role(...ROLES_SOPORTE), integridad);
router.post('/soporte/verificar', auth, role(...ROLES_SOPORTE), verificacionCompleta);
router.get('/soporte/rutas', auth, role(...ROLES_SOPORTE), rutasModulo);

module.exports = router;
