'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const ctrl = require('../controllers/academicControlController');

// ================================================
// CONTROL ACADÉMICO POR PARCIAL Y PERIODO
// 6 niveles de consulta + filtros por rol
// ================================================

// Filtros disponibles para un período (Coordinador ve todo, Docente ve los suyos)
// GET /api/academic-control/filtros/:idPeriodo
router.get('/filtros/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.getFiltros
);

// ────────────────────────────────────────────────
// NIVEL 1: PARCIAL (P1/P2/P3)
// GET /api/academic-control/parcial/:idPeriodo/:parcial
// ────────────────────────────────────────────────
router.get('/parcial/:idPeriodo/:parcial',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.getParcial
);

// ────────────────────────────────────────────────
// NIVEL 2: MATERIA
// GET /api/academic-control/materia/:idPeriodo/:idMateria
// ────────────────────────────────────────────────
router.get('/materia/:idPeriodo/:idMateria',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.getMateria
);

// ────────────────────────────────────────────────
// NIVEL 3: GRUPO
// GET /api/academic-control/grupo/:idPeriodo/:idGrupo
// ────────────────────────────────────────────────
router.get('/grupo/:idPeriodo/:idGrupo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  ctrl.getGrupo
);

// ────────────────────────────────────────────────
// NIVEL 4: PERÍODO
// GET /api/academic-control/periodo/:idPeriodo
// ────────────────────────────────────────────────
router.get('/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  ctrl.getPeriodo
);

// ────────────────────────────────────────────────
// NIVEL 5: SEMESTRE
// GET /api/academic-control/semestre/:idPeriodo/:semestre
// ────────────────────────────────────────────────
router.get('/semestre/:idPeriodo/:semestre',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  ctrl.getSemestre
);

// ────────────────────────────────────────────────
// NIVEL 6: HISTORIAL ACADÉMICO (solo Alumno ve el propio)
// GET /api/academic-control/historial/:idAlumno
// ────────────────────────────────────────────────
router.get('/historial/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  ctrl.getHistorial
);

module.exports = router;
