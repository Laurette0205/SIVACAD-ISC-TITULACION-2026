'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const calificaciones = require('../controllers/calificaciones');
const calExport = require('../services/calificacionesExport');

// 1. Calificaciones de un grupo por período
router.get('/grupo/:idGrupo/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  calificaciones.getCalificacionesGrupo
);

// 2. Capturar / actualizar calificaciones (borrador)
router.post('/capturar',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  calificaciones.capturarCalificaciones
);

// 3. Validar calificaciones (coordinador/admin)
router.post('/validar',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  calificaciones.validarCalificaciones
);

// 4. Publicar calificaciones
router.post('/publicar',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  calificaciones.publicarCalificaciones
);

// 5. Cerrar calificaciones (solo admin)
router.post('/cerrar',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR'),
  calificaciones.cerrarCalificaciones
);

// 6. Historial de cambios de una calificación
router.get('/historial/:idHistorial',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  calificaciones.getHistorialCambios
);

// 7. Boleta del alumno
router.get('/boleta/:idAlumno',
  auth,
  calificaciones.getBoletaAlumno
);

// 8. Resumen de estado para docente
router.get('/resumen',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  calificaciones.getResumenCalificaciones
);

// =====================================================
// MÓDULO 6: EXPORTACIÓN SEGURA DE CALIFICACIONES
// =====================================================

// 9. Exportar boleta del alumno (solo sus propias calificaciones)
router.get('/export/boleta/:idAlumno',
  auth,
  async (req, res) => {
    try {
      const { idAlumno } = req.params;
      const { idPeriodo } = req.query;
      const esAlumno = String(req.user.rol).trim().toUpperCase() === 'ALUMNO';

      // Un alumno solo puede exportar su propia boleta
      if (esAlumno && req.user.id_alumno !== Number(idAlumno)) {
        return res.status(403).json({ ok: false, message: 'No puedes exportar la boleta de otro alumno' });
      }

      const { workbook, folio, totalMaterias } = await calExport.exportBoletaAlumno(
        idAlumno, idPeriodo, req.user.id_usuario
      );

      // Registrar auditoría
      try {
        const { registrarAuditoria } = require('../middleware/auditoria');
        await registrarAuditoria({
          id_usuario: req.user.id_usuario,
          modulo: 'CALIFICACIONES',
          accion: 'EXPORT_BOLETA',
          descripcion: `Export boleta alumno ${idAlumno} — Folio: ${folio} — Materias: ${totalMaterias}`,
          nivel: 'INFO',
          req
        });
      } catch (_) {}

      const filename = `boleta_alumno_${idAlumno}_${folio}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Folio', folio);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('[CAL-EXPORT] Error exportando boleta:', error.message);
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({ ok: false, message: error.message });
      }
      res.status(500).json({ ok: false, message: 'Error exportando boleta' });
    }
  }
);

// 10. Exportar calificaciones de un grupo (docente/coordinador/admin)
router.get('/export/grupo/:idGrupo/periodo/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE'),
  async (req, res) => {
    try {
      const { idGrupo, idPeriodo } = req.params;

      const { workbook, folio, totalRegistros, totalAlumnos } = await calExport.exportGrupoCalificaciones(
        idGrupo, idPeriodo, req.user.id_usuario, req.user.rol
      );

      // Registrar auditoría
      try {
        const { registrarAuditoria } = require('../middleware/auditoria');
        await registrarAuditoria({
          id_usuario: req.user.id_usuario,
          modulo: 'CALIFICACIONES',
          accion: 'EXPORT_GRUPO',
          descripcion: `Export grupo ${idGrupo} período ${idPeriodo} — Folio: ${folio} — Registros: ${totalRegistros} — Alumnos: ${totalAlumnos}`,
          nivel: 'INFO',
          req
        });
      } catch (_) {}

      const filename = `calificaciones_grupo_${idGrupo}_${folio}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Folio', folio);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('[CAL-EXPORT] Error exportando grupo:', error.message);
      if (error.message.includes('no encontrado') || error.message.includes('No tienes acceso')) {
        return res.status(403).json({ ok: false, message: error.message });
      }
      res.status(500).json({ ok: false, message: 'Error exportando calificaciones del grupo' });
    }
  }
);

// 11. Exportar resumen de todos los grupos (solo coordinador/admin)
router.get('/export/resumen/:idPeriodo',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  async (req, res) => {
    try {
      const { idPeriodo } = req.params;

      const { workbook, folio, totalGrupos, totalAlumnos } = await calExport.exportResumenCalificaciones(
        idPeriodo, req.user.id_usuario, req.user.rol
      );

      // Registrar auditoría
      try {
        const { registrarAuditoria } = require('../middleware/auditoria');
        await registrarAuditoria({
          id_usuario: req.user.id_usuario,
          modulo: 'CALIFICACIONES',
          accion: 'EXPORT_RESUMEN',
          descripcion: `Export resumen período ${idPeriodo} — Folio: ${folio} — Grupos: ${totalGrupos} — Alumnos: ${totalAlumnos}`,
          nivel: 'INFO',
          req
        });
      } catch (_) {}

      const filename = `resumen_calificaciones_${idPeriodo}_${folio}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Folio', folio);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('[CAL-EXPORT] Error exportando resumen:', error.message);
      if (error.message.includes('no encontrado') || error.message.includes('Solo coordinadores')) {
        return res.status(403).json({ ok: false, message: error.message });
      }
      res.status(500).json({ ok: false, message: 'Error exportando resumen de calificaciones' });
    }
  }
);

module.exports = router;
