'use strict';

const express = require('express');
const path = require('path');

const router = express.Router();

const mountedRoutes = [];

function safeRequire(relativeModulePath) {
  try {
    return require(path.join(__dirname, relativeModulePath));
  } catch (error) {
    return null;
  }
}

function mountIfAvailable(routePath, relativeModulePath) {
  const mod = safeRequire(relativeModulePath);

  if (mod) {
    router.use(routePath, mod);
    mountedRoutes.push(routePath);
  }
}

// =====================================================
// RUTAS BASE
// =====================================================

router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'SIVACAD API disponible',
    version: '1.0.0',
    routes: mountedRoutes
  });
});

router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// MÓDULOS - Todas las rutas se registran AQUÍ
// (único punto de montaje desde app.js)
// =====================================================

mountIfAvailable('/auth', './auth');
mountIfAvailable('/dashboard', './dashboard');
mountIfAvailable('/inscripciones', './inscripciones');
mountIfAvailable('/inscripciones-admin', './inscripciones-admin');
mountIfAvailable('/inscripciones-coordinador', './inscripciones-coordinador');
mountIfAvailable('/inscripciones-alumno', './inscripciones-alumno');
mountIfAvailable('/inscripciones-docente', './inscripciones-docente');
mountIfAvailable('/docente-reinscripciones', './docente-reinscripciones');
mountIfAvailable('/inscripciones-soporte', './inscripciones-soporte');
mountIfAvailable('/soporte-reinscripciones', './soporte-reinscripciones');
mountIfAvailable('/alumno-reinscripciones', './alumno-reinscripciones');
mountIfAvailable('/admin-reinscripciones', './admin-reinscripciones');
mountIfAvailable('/admin-kardex', './admin-kardex');
mountIfAvailable('/coordinador-reinscripciones', './coordinador-reinscripciones');
mountIfAvailable('/alumnos', './alumnos');
mountIfAvailable('/docentes', './docentes');
mountIfAvailable('/periodos', './periodos');
mountIfAvailable('/grupos', './grupos');
mountIfAvailable('/actas-ocr', './actasOCR');
mountIfAvailable('/actas-ocr/coordinador', './actasOCRCoordinador');
mountIfAvailable('/actas-ocr/docente', './actasOCRDocente');
mountIfAvailable('/actas-ocr/alumno', './actasOCRAlumno');
mountIfAvailable('/actas-ocr/soporte', './actasOCRSoporte');
mountIfAvailable('/kardex', './kardex');
mountIfAvailable('/kardex-coordinador', './rutas-kardex-coordinador');
mountIfAvailable('/kardex-docente', './rutas-kardex-docente');
mountIfAvailable('/kardex-soporte', './soporte-kardex');
mountIfAvailable('/chatbot', './chatbot');
mountIfAvailable('/bajas', './bajas');
mountIfAvailable('/reportes', './reportes');
mountIfAvailable('/evaluaciones', './evaluaciones');
mountIfAvailable('/evaluaciones-alumno', './evaluaciones-alumno');
mountIfAvailable('/evaluaciones-docente', './evaluaciones-docente');
mountIfAvailable('/evaluaciones-soporte', './evaluaciones-soporte');
mountIfAvailable('/asistente', './asistente');
mountIfAvailable('/ia/becas', './iaBecas');
mountIfAvailable('/ia/becas/admin', './iaBecasAdmin');
mountIfAvailable('/ia/becas/coordinador', './iaBecasCoordinador');
mountIfAvailable('/ia/becas/alumno', './iaBecasAlumno');
mountIfAvailable('/ia/becas', './iaBecasDocente');
mountIfAvailable('/ia/becas', './iaBecasSoporte');
mountIfAvailable('/bienestar-admin', './iaBienestarAdmin');
mountIfAvailable('/ia/bienestar', './iaBienestar');
mountIfAvailable('/ia/desercion', './iaDesercion');
mountIfAvailable('/ia/desercion/reporte', './desercion.routes');
mountIfAvailable('/ia/desercion', './iaDesercionDocente');
mountIfAvailable('/ia/desercion', './iaDesercionAlumno');
mountIfAvailable('/ia/desercion', './iaDesercionSoporte');
mountIfAvailable('/ia/bienestar', './iaBienestarDocente');
mountIfAvailable('/ia/bienestar', './iaBienestarSoporte');

// =====================================================
// EXPORTAR
// =====================================================

module.exports = router;
