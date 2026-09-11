'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');

const {
  resumen,
  indicadores,
  catalogoAlertas,
  historialSeguimientos,
  exportarPdf,
  exportarExcel,
  auditoria,
  gruposRiesgo,
  alumnosRiesgo,
  detalleAlumno,
  registrarSeguimiento,
  actualizarEstadoAlerta,
  catalogosFiltros
} = require('../controllers/iaBienestarAdmin');

const ROLES_ADMIN = ['ADMINISTRADOR', 'COORDINADOR'];

router.get('/resumen', auth, role(...ROLES_ADMIN), resumen);
router.get('/indicadores', auth, role(...ROLES_ADMIN), indicadores);
router.get('/alertas', auth, role(...ROLES_ADMIN), catalogoAlertas);
router.get('/seguimientos', auth, role(...ROLES_ADMIN), historialSeguimientos);
router.get('/exportar/pdf', auth, role(...ROLES_ADMIN), exportarPdf);
router.get('/exportar/excel', auth, role(...ROLES_ADMIN), exportarExcel);
router.get('/auditoria', auth, role(...ROLES_ADMIN), auditoria);

router.get('/grupos-riesgo', auth, role(...ROLES_ADMIN), gruposRiesgo);
router.get('/alumnos-riesgo', auth, role(...ROLES_ADMIN), alumnosRiesgo);
router.get('/alumnos-riesgo/:id', auth, role(...ROLES_ADMIN), detalleAlumno);
router.get('/catalogos-filtros', auth, role(...ROLES_ADMIN), catalogosFiltros);

router.post('/registrar-seguimiento', auth, role(...ROLES_ADMIN), registrarSeguimiento);
router.post('/actualizar-estado-alerta', auth, role(...ROLES_ADMIN), actualizarEstadoAlerta);

module.exports = router;
