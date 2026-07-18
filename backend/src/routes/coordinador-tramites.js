const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/coordinador-tramites');

router.get('/resumen', auth, role('coordinador', 'administrador'), ctrl.resumen);
router.get('/catalogos', auth, role('coordinador', 'administrador'), ctrl.catalogos);
router.get('/reportes', auth, role('coordinador', 'administrador'), ctrl.reportes);
router.get('/bitacora', auth, role('coordinador', 'administrador'), ctrl.bitacora);

router.get('/bandeja', auth, role('coordinador', 'administrador'), ctrl.bandeja);
router.get('/:id', auth, role('coordinador', 'administrador'), ctrl.obtenerTramite);

router.put('/:id/pasar-revision', auth, role('coordinador', 'administrador'), ctrl.pasarARevision);
router.put('/:id/pasar-analisis', auth, role('coordinador', 'administrador'), ctrl.pasarAAnalisis);
router.put('/:id/determinar-procedencia', auth, role('coordinador', 'administrador'), ctrl.determinarProcedencia);
router.put('/:id/validar', auth, role('coordinador', 'administrador'), ctrl.validarTramite);
router.put('/:id/rechazar', auth, role('coordinador', 'administrador'), ctrl.rechazarTramite);

router.post('/:id/observaciones', auth, role('coordinador', 'administrador'), ctrl.agregarObservacion);
router.put('/:id/documentos/:id_documento/validar', auth, role('coordinador', 'administrador'), ctrl.validarDocumento);

module.exports = router;
