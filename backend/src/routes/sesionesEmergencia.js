'use strict';

const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { verifyRoleAgainstDB } = require('../middleware/auth');
const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');
const breakGlass = require('../services/breakGlass');

const MAX_SESSION_HOURS = 8;

// ==============================
// POST — Abrir sesión de emergencia
// ==============================
router.post('/abrir',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'SOPORTE'),
  async (req, res) => {
    try {
      const { idAlumno, justificacion, permisos } = req.body;

      if (!idAlumno || !justificacion) {
        return res.status(400).json({
          ok: false,
          message: 'idAlumno y justificacion son requeridos'
        });
      }

      if (justificacion.trim().length < 10) {
        return res.status(400).json({
          ok: false,
          message: 'La justificación debe tener al menos 10 caracteres'
        });
      }

      const [alumnoRows] = await pool.execute(
        `SELECT id_usuario, nombres, apellido_paterno, apellido_materno, matricula
         FROM alumnos WHERE id_alumno = ? LIMIT 1`,
        [idAlumno]
      );

      if (!alumnoRows.length) {
        return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
      }

      const [activas] = await pool.execute(
        `SELECT id FROM sesiones_emergencia
         WHERE id_alumno = ? AND id_solicitante = ? AND estado = 'ACTIVA'
         LIMIT 1`,
        [idAlumno, req.user.id_usuario]
      );

      if (activas.length) {
        return res.status(409).json({
          ok: false,
          message: 'Ya tienes una sesión de emergencia activa para este alumno'
        });
      }

      const fechaApertura = new Date();
      const fechaExpiracion = new Date(Date.now() + MAX_SESSION_HOURS * 60 * 60 * 1000);

      const permisosDefault = permisos || [
        'identidad', 'contactos_emergencia', 'salud_basica', 'ubicacion'
      ];

      const [result] = await pool.execute(
        `INSERT INTO sesiones_emergencia
         (id_alumno, id_solicitante, justificacion, permisos, estado,
          fecha_apertura, fecha_expiracion, ip_origen)
         VALUES (?, ?, ?, ?, 'ACTIVA', ?, ?, ?)`,
        [idAlumno, req.user.id_usuario, justificacion.trim(),
         JSON.stringify(permisosDefault), fechaApertura, fechaExpiracion, req.ip]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'EMERGENCIA',
        accion: 'SESION_EMERGENCIA_ABIERTA',
        descripcion: `Sesión de emergencia abierta para alumno ID ${idAlumno}: ${justificacion.trim().substring(0, 100)}`,
        entidad_afectada: 'sesiones_emergencia',
        id_entidad: result.insertId,
        valor_nuevo: { idAlumno, justificacion: justificacion.trim().substring(0, 200), permisos: permisosDefault },
        req
      });

      return res.status(201).json({
        ok: true,
        message: 'Sesión de emergencia abierta',
        id_sesion: result.insertId,
        fecha_apertura: fechaApertura,
        fecha_expiracion: fechaExpiracion,
        alumno: {
          id: idAlumno,
          nombre: `${alumnoRows[0].nombres} ${alumnoRows[0].apellido_paterno} ${alumnoRows[0].apellido_materno || ''}`.trim(),
          matricula: alumnoRows[0].matricula
        }
      });
    } catch (error) {
      console.error('[SESION_EMERGENCIA] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error abriendo sesión de emergencia' });
    }
  }
);

// ==============================
// POST — Cerrar sesión de emergencia
// ==============================
router.post('/cerrar/:idSesion',
  auth,
  async (req, res) => {
    try {
      const [existing] = await pool.execute(
        `SELECT id, id_solicitante, estado FROM sesiones_emergencia
         WHERE id = ? LIMIT 1`,
        [req.params.idSesion]
      );

      if (!existing.length) {
        return res.status(404).json({ ok: false, message: 'Sesión no encontrada' });
      }

      if (existing[0].estado !== 'ACTIVA') {
        return res.status(400).json({ ok: false, message: 'La sesión no está activa' });
      }

      if (existing[0].id_solicitante !== req.user.id_usuario &&
          !['ADMINISTRADOR', 'SOPORTE'].includes(req.user.rol)) {
        return res.status(403).json({ ok: false, message: 'Solo el solicitante o un administrador pueden cerrar la sesión' });
      }

      await pool.execute(
        `UPDATE sesiones_emergencia SET estado = 'CERRADA', fecha_cierre = NOW()
         WHERE id = ? AND estado = 'ACTIVA'`,
        [req.params.idSesion]
      );

      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        modulo: 'EMERGENCIA',
        accion: 'SESION_EMERGENCIA_CERRADA',
        descripcion: `Sesión de emergencia ID ${req.params.idSesion} cerrada`,
        entidad_afectada: 'sesiones_emergencia',
        id_entidad: Number(req.params.idSesion),
        req
      });

      return res.json({ ok: true, message: 'Sesión de emergencia cerrada' });
    } catch (error) {
      console.error('[SESION_EMERGENCIA] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error cerrando sesión' });
    }
  }
);

// ==============================
// GET — Datos mínimos del alumno en sesión de emergencia
// ==============================
router.get('/datos/:idSesion',
  auth,
  async (req, res) => {
    try {
      const [sesion] = await pool.execute(
        `SELECT id, id_alumno, id_solicitante, permisos, estado, fecha_expiracion
         FROM sesiones_emergencia WHERE id = ? LIMIT 1`,
        [req.params.idSesion]
      );

      if (!sesion.length) {
        return res.status(404).json({ ok: false, message: 'Sesión no encontrada' });
      }

      const s = sesion[0];

      if (s.estado !== 'ACTIVA') {
        return res.status(400).json({ ok: false, message: 'La sesión no está activa' });
      }

      if (new Date(s.fecha_expiracion) < new Date()) {
        await pool.execute(
          `UPDATE sesiones_emergencia SET estado = 'EXPIRADA' WHERE id = ?`,
          [s.id]
        );
        return res.status(400).json({ ok: false, message: 'La sesión ha expirado' });
      }

      if (s.id_solicitante !== req.user.id_usuario &&
          !['ADMINISTRADOR', 'SOPORTE'].includes(req.user.rol)) {
        return res.status(403).json({ ok: false, message: 'No autorizado para acceder a esta sesión' });
      }

      const permisos = typeof s.permisos === 'string' ? JSON.parse(s.permisos) : s.permisos;

      const [alumno] = await pool.execute(
        `SELECT a.nombres, a.apellido_paterno, a.apellido_materno, a.matricula,
                a.curp, a.semestre_actual, a.estatus_academico,
                c.nombre_carrera
         FROM alumnos a
         LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
         WHERE a.id_alumno = ? LIMIT 1`,
        [s.id_alumno]
      );

      const datos = { identidad: alumno[0] || null };

      if (permisos.includes('contactos_emergencia')) {
        const [contactos] = await pool.execute(
          `SELECT nombre, parentesco, telefono, telefono_alt, correo, prioridad
           FROM contactos_emergencia
           WHERE id_usuario = (SELECT id_usuario FROM alumnos WHERE id_alumno = ?)
           ORDER BY
             CASE prioridad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END,
             principal DESC
           LIMIT 5`,
          [s.id_alumno]
        );
        datos.contactos_emergencia = contactos;
      }

      if (permisos.includes('salud_basica')) {
        const [salud] = await pool.execute(
          `SELECT tipo_sangre, alergias, medicamentos, condiciones_cronicas
           FROM alumno_info_medica
           WHERE id_usuario = (SELECT id_usuario FROM alumnos WHERE id_alumno = ?)
           LIMIT 1`,
          [s.id_alumno]
        );
        datos.salud_basica = salud[0] || null;
      }

      if (permisos.includes('ubicacion')) {
        const [ubicacion] = await pool.execute(
          `SELECT latitud, longitud, precision_metros, fecha_activacion, fecha_expiracion
           FROM ubicacion_emergencia
           WHERE id_usuario = (SELECT id_usuario FROM alumnos WHERE id_alumno = ?)
           AND activa = 1 AND fecha_expiracion > NOW()
           ORDER BY creado_en DESC LIMIT 1`,
          [s.id_alumno]
        );
        datos.ubicacion = ubicacion[0] || null;
      }

      await pool.execute(
        `INSERT INTO sesiones_emergencia_log
         (id_sesion, id_usuario_consulta, tipo_dato, descripcion, fecha_consulta, ip_origen)
         VALUES (?, ?, 'DATOS_MINIMOS', 'Consulta de datos de emergencia', NOW(), ?)`,
        [s.id, req.user.id_usuario, req.ip]
      );

      return res.json({ ok: true, datos, permisos });
    } catch (error) {
      console.error('[SESION_EMERGENCIA] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error obteniendo datos de emergencia' });
    }
  }
);

// ==============================
// GET — Listar sesiones de emergencia activas
// ==============================
router.get('/activas',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR', 'SOPORTE'),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT se.id, se.id_alumno, se.id_solicitante, se.justificacion,
                se.estado, se.fecha_apertura, se.fecha_expiracion,
                a.nombres, a.apellido_paterno, a.matricula,
                u.nombre AS nombre_solicitante
         FROM sesiones_emergencia se
         INNER JOIN alumnos a ON se.id_alumno = a.id_alumno
         INNER JOIN usuarios u ON se.id_solicitante = u.id_usuario
         WHERE se.estado = 'ACTIVA'
         AND se.fecha_expiracion > NOW()
         ORDER BY se.fecha_apertura DESC`
      );

      return res.json({ ok: true, sesiones: rows });
    } catch (error) {
      console.error('[SESION_EMERGENCIA] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error listando sesiones activas' });
    }
  }
);

// ==============================
// GET — Historial de sesiones de emergencia
// ==============================
router.get('/historial',
  auth,
  verifyRoleAgainstDB,
  role('ADMINISTRADOR', 'COORDINADOR'),
  async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT se.id, se.id_alumno, se.justificacion, se.estado,
                se.fecha_apertura, se.fecha_cierre, se.fecha_expiracion,
                a.nombres, a.apellido_paterno, a.matricula,
                u.nombre AS nombre_solicitante
         FROM sesiones_emergencia se
         INNER JOIN alumnos a ON se.id_alumno = a.id_alumno
         INNER JOIN usuarios u ON se.id_solicitante = u.id_usuario
         ORDER BY se.fecha_apertura DESC
         LIMIT 100`
      );

      return res.json({ ok: true, historial: rows });
    } catch (error) {
      console.error('[SESION_EMERGENCIA] Error:', error);
      return res.status(500).json({ ok: false, message: 'Error obteniendo historial' });
    }
  }
);

module.exports = router;
