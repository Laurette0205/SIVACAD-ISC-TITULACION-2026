const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { auth, role, verifyRoleAgainstDB } = require('../middleware/auth');
const { uploadAlumnoFoto } = require('../middleware/upload');
const ctrl = require('../controllers/admin-kardex');

const FOTOS_DIR = path.resolve(process.cwd(), 'uploads', 'kardex', 'fotos');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

router.get('/general', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.getKardexGeneral);
router.get('/individual/:id', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.getKardexIndividual);
router.get('/qr/validar/:token', ctrl.validarQR);
router.get('/qr/imagen/:id', auth, role('ADMINISTRADOR'), ctrl.getQrImagen);
router.get('/foto/imagen/:id', auth, role('ADMINISTRADOR'), ctrl.getFotoInstitucional);
router.post('/qr/generar/:id', auth, role('ADMINISTRADOR'), ctrl.generarQR);
router.post('/foto/:id', auth, role('ADMINISTRADOR'), uploadAlumnoFoto.single('foto'), ctrl.cargarFotoInstitucional);
router.get('/historial/:id', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.getHistorialAcademico);
router.post('/historial', auth, role('ADMINISTRADOR'), ctrl.agregarHistorialAcademico);
router.get('/auditoria', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.getAuditoria);
router.delete('/auditoria', auth, role('ADMINISTRADOR'), ctrl.limpiarAuditoria);
router.get('/sellos', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.getSellos);
router.get('/export/pdf/:id', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.exportPDF);
router.get('/export/excel/:id', auth, verifyRoleAgainstDB, role('ADMINISTRADOR'), ctrl.exportExcel);

module.exports = router;
