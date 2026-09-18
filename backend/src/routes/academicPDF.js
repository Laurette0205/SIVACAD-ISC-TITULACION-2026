'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const ctrl = require('../controllers/academicPDFController');

// ================================================
// GENERACIÓN PDF ACADÉMICO — SIVACAD-ISC
// 7 documentos PDF profesionales
// ================================================

// 1. Preboleta PDF
// GET /api/academic-pdf/preboleta/:idAlumno/:idPeriodo
router.get('/preboleta/:idAlumno/:idPeriodo',
  auth,
  ctrl.preboletaPDF
);

// 2. Boleta PDF (solo PUBLICADAS)
// GET /api/academic-pdf/boleta/:idAlumno/:idPeriodo
router.get('/boleta/:idAlumno/:idPeriodo',
  auth,
  ctrl.boletaPDF
);

// 3. Calificaciones por Parcial (P1/P2/P3)
// GET /api/academic-pdf/parcial/:idGrupo/:idPeriodo/:parcial
router.get('/parcial/:idGrupo/:idPeriodo/:parcial',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.calificacionesParcialPDF
);

// 4. Calificaciones por Período (con tabla completa)
// GET /api/academic-pdf/periodo/:idGrupo/:idPeriodo
router.get('/periodo/:idGrupo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.calificacionesPeriodoPDF
);

// 5. Historial Académico Individual
// GET /api/academic-pdf/historial/:idAlumno
router.get('/historial/:idAlumno',
  auth,
  ctrl.historialPDF
);

// 6. Reporte por Grupo
// GET /api/academic-pdf/reporte-grupo/:idGrupo/:idPeriodo
router.get('/reporte-grupo/:idGrupo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.reporteGrupoPDF
);

// 7. Reporte de Seguimiento para Coordinador
// GET /api/academic-pdf/seguimiento/:idPeriodo
router.get('/seguimiento/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  ctrl.reporteSeguimientoPDF
);

module.exports = router;
