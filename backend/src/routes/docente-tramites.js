const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/docente-tramites');

router.get('/resumen', auth, role('docente', 'administrador'), ctrl.resumen);
router.get('/catalogos', auth, role('docente', 'administrador'), ctrl.catalogos);
router.get('/mis-grupos', auth, role('docente', 'administrador'), ctrl.misGrupos);
router.get('/reportes', auth, role('docente', 'administrador'), ctrl.reportes);
router.get('/bitacora', auth, role('docente', 'administrador'), ctrl.bitacora);

router.get('/bandeja', auth, role('docente', 'administrador'), ctrl.bandeja);
router.get('/grupos/:idGrupo/periodo/:idPeriodo/alumnos', auth, role('docente', 'administrador'), ctrl.alumnosGrupo);
router.get('/:id', auth, role('docente', 'administrador'), ctrl.obtenerTramite);
router.get('/:id/trayectoria', auth, role('docente', 'administrador'), ctrl.revisarTrayectoria);

router.put('/:id/emitir-opinion', auth, role('docente', 'administrador'), ctrl.emitirOpinionAcademica);
router.put('/:id/confirmar-compatibilidad', auth, role('docente', 'administrador'), ctrl.confirmarCompatibilidad);
router.put('/:id/validar-observaciones', auth, role('docente', 'administrador'), ctrl.validarObservaciones);

router.post('/:id/observaciones', auth, role('docente', 'administrador'), ctrl.agregarObservacionDocente);

module.exports = router;
