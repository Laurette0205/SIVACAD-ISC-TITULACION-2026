'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const preboletas = require('../controllers/preboletas');

// =====================================================
// PREBOLETA — Documento Preliminar
// =====================================================

// 1. Preboleta de un alumno por período
router.get('/alumno/:idAlumno/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.getPreboletaAlumno
);

// 2. Preboleta del grupo (concentrado)
router.get('/grupo/:idGrupo/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  preboletas.getPreboletaGrupo
);

// 3. Generar preboleta
router.post('/generar',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  preboletas.generarPreboleta
);

// 4. Exportar preboleta Excel (alumno)
router.get('/export/excel/alumno/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.exportPreboletaExcelAlumno
);

// 5. Exportar preboleta Excel (grupo)
router.get('/export/excel/grupo/:idGrupo/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  preboletas.exportPreboletaExcelGrupo
);

// 6. Exportar preboleta PDF (snapshot guardado)
router.get('/export/pdf/:idPreboleta',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.exportPreboletaPDF
);

// 6b. Exportar preboleta PDF (alumno, por período — datos vivos de BD)
router.get('/export/pdf/alumno/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.exportPreboletaPDFAlumno
);

// =====================================================
// BOLETA — Documento Oficial
// =====================================================

// 7. Exportar boleta Excel (alumno)
router.get('/export/boleta/excel/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.exportBoletaExcelAlumno
);

// 8. Exportar boleta PDF (alumno)
router.get('/export/boleta/pdf/:idAlumno',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO'),
  preboletas.exportBoletaPDFAlumno
);

module.exports = router;
