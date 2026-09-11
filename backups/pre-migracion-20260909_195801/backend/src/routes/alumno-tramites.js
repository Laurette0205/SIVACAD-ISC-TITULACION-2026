const express = require('express');
const router = express.Router();

const { auth, role } = require('../middleware/auth');
const ctrl = require('../controllers/alumno-tramites');
const { docUpload } = require('../middleware/upload');

router.get('/catalogos', auth, role('alumno', 'administrador'), ctrl.catalogos);
router.get('/mis-tramites', auth, role('alumno', 'administrador'), ctrl.misTramites);
router.get('/historial', auth, role('alumno', 'administrador'), ctrl.historial);
router.get('/:id', auth, role('alumno', 'administrador'), ctrl.obtenerTramite);
router.get('/:id/seguimiento', auth, role('alumno', 'administrador'), ctrl.seguimiento);
router.get('/:id/documentos/:id_documento/descargar', auth, role('alumno', 'administrador'), ctrl.descargarDocumento);

router.post('/solicitar', auth, role('alumno', 'administrador'), ctrl.solicitar);
router.post('/:id/documentos',
  auth,
  role('alumno', 'administrador'),
  docUpload.single('documento'),
  ctrl.subirDocumento
);

module.exports = router;
