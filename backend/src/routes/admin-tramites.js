const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const { docUpload } = require('../middleware/upload');

const ctrl = require('../controllers/admin-tramites');

router.get('/resumen', auth, role('administrador'), ctrl.resumen);
router.get('/catalogos', auth, role('administrador'), ctrl.catalogos);
router.get('/bitacora', auth, role('administrador'), ctrl.bitacora);
router.get('/auditoria', auth, role('administrador'), ctrl.auditoria);
router.get('/configuracion', auth, role('administrador'), ctrl.obtenerConfiguracion);
router.put('/configuracion/:id', auth, role('administrador'), ctrl.actualizarConfiguracion);

router.get('/', auth, role('administrador'), ctrl.listarTramites);
router.get('/:id', auth, role('administrador'), ctrl.obtenerTramite);
router.post('/', auth, role('administrador'), ctrl.crearTramite);

router.put('/:id/validar-solicitud', auth, role('administrador'), ctrl.validarSolicitud);
router.put('/:id/emitir-dictamen', auth, role('administrador'), ctrl.emitirDictamen);
router.put('/:id/rechazar', auth, role('administrador'), ctrl.rechazarTramite);

router.put('/:id/autorizar-control-escolar', auth, role('administrador'), ctrl.autorizarControlEscolar);
router.put('/:id/autorizar-division-isc', auth, role('administrador'), ctrl.autorizarDivisionISC);

router.put('/:id/emitir-documento', auth, role('administrador'), ctrl.emitirDocumentoOficial);
router.put('/:id/cerrar', auth, role('administrador'), ctrl.cerrarTramite);

router.post('/:id/documentos', auth, role('administrador'), docUpload.single('archivo'), ctrl.subirDocumento);
router.get('/:id/documentos', auth, role('administrador'), ctrl.listarDocumentos);

module.exports = router;
