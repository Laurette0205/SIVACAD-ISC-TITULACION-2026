const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const {
  getMetrics,
  listarInscripcionesAdmin,
  updateEstado,
  getAuditoria,
  exportReport,
  getCatalogos
} = require('../controllers/inscripciones-admin');

const ROLES_ADMIN = ['ADMINISTRADOR'];
const ROLES_ADMIN_COORD = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/metrics', auth, role(...ROLES_ADMIN_COORD), getMetrics);

router.get('/inscripciones', auth, role(...ROLES_ADMIN_COORD), listarInscripcionesAdmin);

router.put('/inscripciones/:id/estado', auth, role(...ROLES_ADMIN_COORD), updateEstado);

router.get('/auditoria', auth, role(...ROLES_ADMIN_COORD), getAuditoria);

router.get('/export', auth, role(...ROLES_ADMIN_COORD), exportReport);

router.get('/catalogos', auth, role(...ROLES_ADMIN_COORD), getCatalogos);

module.exports = router;
