const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const {
  getGruposActualizados,
  getListaReinscritos,
  getCambiosReinscripcion,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  getResumenGrupos,
  getCargaAcademica
} = require('../controllers/docente-reinscripciones');

router.get('/grupos-actualizados', auth, getGruposActualizados);
router.get('/grupos/:idGrupo/:idPeriodo/lista-reinscritos', auth, getListaReinscritos);
router.get('/grupos/:idGrupo/:idPeriodo/cambios', auth, getCambiosReinscripcion);
router.get('/cambios', auth, getCambiosReinscripcion);
router.get('/notificaciones', auth, getNotificaciones);
router.put('/notificaciones/:id/leida', auth, marcarNotificacionLeida);
router.put('/notificaciones/leer-todas', auth, marcarTodasLeidas);
router.get('/resumen-grupos', auth, getResumenGrupos);
router.get('/carga-academica', auth, getCargaAcademica);

module.exports = router;
