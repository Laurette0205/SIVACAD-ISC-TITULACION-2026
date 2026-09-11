// ==============================
// 🧠 IA DE DESERCIÓN
// ==============================
const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const iaCtrl = require('../controllers/iaDesercion');

const ROLES_ADMIN_COORD = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/', auth, role(...ROLES_ADMIN_COORD), iaCtrl.dashboard);
router.get('/resumen', auth, role(...ROLES_ADMIN_COORD), iaCtrl.resumen);
router.get('/alertas', auth, role(...ROLES_ADMIN_COORD), iaCtrl.listAlertas);
router.get('/alertas/:id', auth, role(...ROLES_ADMIN_COORD), iaCtrl.detalleAlerta);
router.get('/exportar/pdf', auth, role(...ROLES_ADMIN_COORD), iaCtrl.exportarPdf);
router.get('/exportar/excel', auth, role(...ROLES_ADMIN_COORD), iaCtrl.exportarExcel);
router.get('/auditoria', auth, role(...ROLES_ADMIN_COORD), iaCtrl.auditoria);
router.get('/auditoria/exportar', auth, role(...ROLES_ADMIN_COORD), iaCtrl.exportarAuditoria);
router.get('/auditoria/respaldar', auth, role(...ROLES_ADMIN_COORD), iaCtrl.respaldarAuditoria);
router.delete('/auditoria', auth, role(...ROLES_ADMIN_COORD), iaCtrl.eliminarAuditoria);

router.get('/ml-health', auth, role(...ROLES_ADMIN_COORD), iaCtrl.mlHealth);

router.post('/predecir', auth, role(...ROLES_ADMIN_COORD), iaCtrl.predecirDesercion);
router.post('/predecir-ml', auth, role(...ROLES_ADMIN_COORD), iaCtrl.predecirDesercionML);
router.post('/seguimiento', auth, role(...ROLES_ADMIN_COORD), iaCtrl.registrarSeguimiento);
router.post('/generar', auth, role(...ROLES_ADMIN_COORD), iaCtrl.generarAlerta);
router.post('/alertas/:id/validar', auth, role(...ROLES_ADMIN_COORD), iaCtrl.validarSeguimiento);

module.exports = router;
