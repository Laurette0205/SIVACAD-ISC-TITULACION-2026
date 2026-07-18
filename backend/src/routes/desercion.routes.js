'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const deC = require('../controllers/desercionController');

const ROLES_AUTH = ['ADMINISTRADOR', 'COORDINADOR', 'SOPORTE', 'DOCENTE'];

router.get('/preview', auth, role(...ROLES_AUTH), deC.getReportData);
router.get('/preview/resumen', auth, role(...ROLES_AUTH), deC.getResumen);
router.get('/preview/distribucion', auth, role(...ROLES_AUTH), deC.getDistribucion);
router.get('/preview/alertas', auth, role(...ROLES_AUTH), deC.getAlertasRecientes);
router.get('/dashboard', auth, role(...ROLES_AUTH), deC.getDashboard);
router.get('/pdf', auth, role(...ROLES_AUTH), deC.generatePdf);
router.get('/excel', auth, role(...ROLES_AUTH), deC.generateExcel);

module.exports = router;
