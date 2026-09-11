const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const {
  getMiInformacion,
  solicitarReinscripcion,
  getMiEstatus,
  getMiHistorial,
  descargarComprobante
} = require('../controllers/alumno-reinscripciones');

router.get('/mi-informacion', auth, getMiInformacion);
router.post('/solicitar', auth, solicitarReinscripcion);
router.get('/mi-estatus', auth, getMiEstatus);
router.get('/historial', auth, getMiHistorial);
router.get('/comprobante/:id', auth, descargarComprobante);

module.exports = router;
