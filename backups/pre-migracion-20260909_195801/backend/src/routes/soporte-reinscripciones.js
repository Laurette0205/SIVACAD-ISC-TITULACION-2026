const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const {
  getPanel,
  getIncidencias,
  crearIncidencia,
  actualizarIncidencia,
  getMonitoreo,
  iniciarMonitoreo,
  actualizarMonitoreo,
  getErroresProceso,
  getLogs,
  registrarLog,
  verificarIntegridad,
  reintentarProceso
} = require('../controllers/soporte-reinscripciones');

router.get('/panel', auth, getPanel);
router.get('/incidencias', auth, getIncidencias);
router.post('/incidencias', auth, crearIncidencia);
router.put('/incidencias/:id', auth, actualizarIncidencia);
router.get('/monitoreo', auth, getMonitoreo);
router.post('/monitoreo', auth, iniciarMonitoreo);
router.put('/monitoreo/:id', auth, actualizarMonitoreo);
router.get('/errores', auth, getErroresProceso);
router.get('/logs', auth, getLogs);
router.post('/logs', auth, registrarLog);
router.post('/verificar-integridad', auth, verificarIntegridad);
router.post('/reintentar', auth, reintentarProceso);

module.exports = router;
