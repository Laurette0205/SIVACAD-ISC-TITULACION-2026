// backend/src/routes/reportes.js
'use strict';

const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const otherCtrl = require('../controllers/other');
const reportesCtrl = require('../controllers/reportes');

const ROLES_REPORTES = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'];

function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

function toPositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : NaN;
}

function validateReportQuery(req, res, next) {
  const tipo = String(req.query?.tipo || 'general').trim().toLowerCase();
  const alumnoId = toPositiveInteger(req.query?.alumnoId);
  const grupoId = toPositiveInteger(req.query?.grupoId);

  const allowedTypes = new Set(['general', 'alumno', 'grupo', 'periodo', 'riesgo']);

  if (!allowedTypes.has(tipo)) {
    return res.status(400).json({
      ok: false,
      message: 'El par\u00e1metro tipo solo permite: general, alumno, grupo, periodo o riesgo.'
    });
  }

  if (req.query?.alumnoId !== undefined && req.query?.alumnoId !== '' && Number.isNaN(alumnoId)) {
    return res.status(400).json({
      ok: false,
      message: 'alumnoId debe ser un n\u00famero entero v\u00e1lido.'
    });
  }

  if (req.query?.grupoId !== undefined && req.query?.grupoId !== '' && Number.isNaN(grupoId)) {
    return res.status(400).json({
      ok: false,
      message: 'grupoId debe ser un n\u00famero entero v\u00e1lido.'
    });
  }

  req.reportQuery = {
    tipo,
    alumnoId,
    grupoId
  };

  return next();
}

function wrapReportController(controllerFn) {
  return asyncHandler(async (req, res, next) => {
    try {
      return await controllerFn(req, res, next);
    } catch (error) {
      console.error('Error en reportes:', error);
      return res.status(error.status || 500).json({
        ok: false,
        message: error.message || 'No fue posible generar el reporte.'
      });
    }
  });
}

// =====================================================
// KARDEX EXPORT ENDPOINTS
// =====================================================

// "Me" routes (must be before :id routes to avoid param capture)
router.get('/kardex/me/preview', auth, role('ADMINISTRADOR', 'ALUMNO'), reportesCtrl.previewMyKardex);
router.get('/kardex/me/pdf', auth, role('ADMINISTRADOR', 'ALUMNO'), reportesCtrl.exportMyKardexPDF);
router.get('/kardex/me/pdf/dompdf', auth, role('ADMINISTRADOR', 'ALUMNO'), reportesCtrl.exportMyKardexDompdfPDF);
router.get('/kardex/me/excel', auth, role('ADMINISTRADOR', 'ALUMNO'), reportesCtrl.exportMyKardexExcel);

// Parameterized routes (admin/coordinador/docente/alumno access)
router.get('/kardex/:id/info', auth, role(...ROLES_REPORTES), reportesCtrl.previewKardex);
router.get('/kardex/:id/preview', auth, role(...ROLES_REPORTES), reportesCtrl.previewKardex);
router.get('/kardex/:id/pdf', auth, role(...ROLES_REPORTES), reportesCtrl.exportKardexPDF);
router.get('/kardex/:id/pdf/dompdf', auth, role(...ROLES_REPORTES), reportesCtrl.exportKardexDompdfPDF);
router.get('/kardex/:id/excel', auth, role(...ROLES_REPORTES), reportesCtrl.exportKardexExcel);

// =====================================================
// LEGACY REPORT ENDPOINTS
// =====================================================
router.use(auth, role(...ROLES_REPORTES), validateReportQuery);

router.get('/pdf', wrapReportController(otherCtrl.reportPdf));
router.get('/excel', wrapReportController(otherCtrl.reportExcel));

module.exports = router;
