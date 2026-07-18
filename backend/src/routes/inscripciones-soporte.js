'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth: verifyToken } = require('../middleware/auth');
const ctrl = require('../controllers/inscripciones-soporte');

function sendError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

function normalizeUpper(value) {
  return String(value || '').trim().toUpperCase();
}

function isSoporte(user) {
  const roleName = normalizeUpper(user?.rol_nombre || user?.rol || user?.role);
  const roleId = Number(user?.rol_id || user?.id_rol || user?.role_id || 0);
  return roleName === 'SOPORTE' || roleId === 5;
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return sendError(res, 401, 'Token no disponible');
  return verifyToken(req, res, next);
}

router.use(authFromHeader);

router.use((req, res, next) => {
  if (!isSoporte(req.user)) {
    return sendError(res, 403, 'Acceso exclusivo para soporte técnico.');
  }
  next();
});

router.get('/panel', ctrl.getPanel);
router.get('/incidencias', ctrl.getIncidencias);
router.post('/incidencias', ctrl.crearIncidencia);
router.put('/incidencias/:id', ctrl.actualizarIncidencia);
router.get('/errores-sistema', ctrl.getErroresSistema);
router.get('/validacion-conectividad', ctrl.getValidacionConectividad);
router.get('/logs', ctrl.getLogs);
router.post('/logs', ctrl.registrarLog);
router.get('/revision-carga', ctrl.getRevisionCarga);

module.exports = router;
