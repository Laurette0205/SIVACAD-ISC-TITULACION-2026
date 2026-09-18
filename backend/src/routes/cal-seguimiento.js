'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const seguimiento = require('../controllers/cal-seguimiento');

// 1. Dashboard de seguimiento por período
router.get('/dashboard/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  seguimiento.getDashboard
);

// 2. Detalle por grupo
router.get('/detalle/:idGrupo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  seguimiento.getDetalleGrupo
);

// 3. Recalcular seguimiento
router.post('/recalcular',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  seguimiento.recalcular
);

// 4. Incidencias
router.get('/incidencias/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  seguimiento.getIncidencias
);

// 5. Tablero completo de seguimiento académico
router.get('/tablero/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  seguimiento.getTablero
);

module.exports = router;
