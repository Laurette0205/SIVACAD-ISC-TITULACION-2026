'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const ctrl = require('../controllers/academicExportController');

// ================================================
// EXPORTACIONES ACADÉMICAS — SIVACAD-ISC
// 10 tipos de exportación Excel unificados
// ================================================

// 1. Concentrado General (CON / Sábana)
// GET /api/academic-export/concentrado/:idGrupo/:idPeriodo
router.get('/concentrado/:idGrupo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.exportConcentradoGeneral
);

// 2-4. Concentrado Parcial (P1, P2, P3)
// GET /api/academic-export/parcial/:idGrupo/:idPeriodo/:parcial
router.get('/parcial/:idGrupo/:idPeriodo/:parcial',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.exportConcentradoParcial
);

// 5. Concentrado General del Periodo (PG)
// GET /api/academic-export/periodo/:idPeriodo
router.get('/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  ctrl.exportConcentradoPeriodo
);

// 6. Preboleta Individual
// GET /api/academic-export/preboleta/:idAlumno/:idPeriodo
router.get('/preboleta/:idAlumno/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.exportPreboletaIndividual
);

// 7. Boleta Individual
// GET /api/academic-export/boleta/:idAlumno/:idPeriodo
router.get('/boleta/:idAlumno/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.exportBoletaIndividual
);

// 8. Historial Académico
// GET /api/academic-export/historial/:idAlumno
router.get('/historial/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.exportHistorialAcademico
);

// 9. Reporte por Grupo
// GET /api/academic-export/reporte-grupo/:idGrupo/:idPeriodo
router.get('/reporte-grupo/:idGrupo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.exportReporteGrupo
);

// 10. Reporte de Seguimiento para Coordinador
// GET /api/academic-export/seguimiento/:idPeriodo
router.get('/seguimiento/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  ctrl.exportReporteSeguimiento
);

module.exports = router;
