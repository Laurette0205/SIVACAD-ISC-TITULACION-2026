const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { auth, role } = require('../middleware/auth');
const { uploadAlumnoFoto } = require('../middleware/upload');
const ctrl = require('../controllers/admin-kardex');

const FOTOS_DIR = path.resolve(process.cwd(), 'uploads', 'kardex', 'fotos');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

router.get('/general', auth, ctrl.getKardexGeneral);
router.get('/individual/:id', auth, ctrl.getKardexIndividual);
router.get('/qr/validar/:token', ctrl.validarQR);
router.post('/qr/generar/:id', auth, role('ADMINISTRADOR'), ctrl.generarQR);
router.post('/foto/:id', auth, role('ADMINISTRADOR'), uploadAlumnoFoto.single('foto'), ctrl.cargarFotoInstitucional);
router.get('/historial/:id', auth, ctrl.getHistorialAcademico);
router.post('/historial', auth, role('ADMINISTRADOR'), ctrl.agregarHistorialAcademico);
router.get('/auditoria', auth, ctrl.getAuditoria);
router.delete('/auditoria', auth, role('ADMINISTRADOR'), ctrl.limpiarAuditoria);
router.get('/sellos', auth, ctrl.getSellos);
router.get('/export/pdf/:id', auth, ctrl.exportPDF);
router.get('/export/excel/:id', auth, ctrl.exportExcel);

module.exports = router;
