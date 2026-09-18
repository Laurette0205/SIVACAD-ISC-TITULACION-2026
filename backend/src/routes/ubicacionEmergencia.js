'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');
const { registrarAuditoria } = require('../middleware/auditoria');

const MAX_DURATION_MINUTES = 480;
const MIN_DURATION_MINUTES = 5;

// ==============================
// GET — Estado actual de ubicación del alumno
// ==============================
router.get('/', auth, async (req, res) => {
  try {
    let rows = [];
    try {
      [rows] = await pool.execute(
        `SELECT id, activa, latitud, longitud, precision_metros, motivo,
                duracion_minutos, fecha_activacion, fecha_expiracion,
                fecha_desactivacion, creado_en
         FROM ubicacion_emergencia
         WHERE id_usuario = ?
         ORDER BY creado_en DESC
         LIMIT 1`,
        [req.user.id_usuario]
      );
    } catch (_) {
      // Tabla podria no existir aun
      rows = [];
    }

    const ubicacion = rows[0] || null;

    if (ubicacion && ubicacion.activa && ubicacion.fecha_expiracion) {
      const ahora = new Date();
      const expira = new Date(ubicacion.fecha_expiracion);
      if (ahora > expira) {
        try {
          await pool.execute(
            `UPDATE ubicacion_emergencia SET activa = 0, fecha_desactivacion = NOW() WHERE id = ?`,
            [ubicacion.id]
          );
        } catch (_) {}
        ubicacion.activa = 0;
        ubicacion.fecha_desactivacion = new Date();
      }
    }

    return res.json({ ok: true, ubicacion });
  } catch (error) {
    console.error('[UBICACION_EMERGENCIA] Error:', error);
    return res.json({ ok: true, ubicacion: null });
  }
});

// ==============================
// POST — Activar compartir ubicación
// ==============================
router.post('/activar', auth, async (req, res) => {
  try {
    const { latitud, longitud, precision_metros, motivo, duracion_minutos } = req.body;

    if (!latitud || !longitud) {
      return res.status(400).json({ ok: false, message: 'latitud y longitud son requeridos' });
    }

    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, message: 'Coordenadas inválidas' });
    }

    const duracion = Math.min(
      Math.max(parseInt(duracion_minutos) || 60, MIN_DURATION_MINUTES),
      MAX_DURATION_MINUTES
    );

    const fechaActivacion = new Date();
    const fechaExpiracion = new Date(Date.now() + duracion * 60 * 1000);

    await pool.execute(
      `UPDATE ubicacion_emergencia SET activa = 0, fecha_desactivacion = NOW()
       WHERE id_usuario = ? AND activa = 1`,
      [req.user.id_usuario]
    );

    const [result] = await pool.execute(
      `INSERT INTO ubicacion_emergencia
       (id_usuario, activa, latitud, longitud, precision_metros, motivo,
        duracion_minutos, fecha_activacion, fecha_expiracion)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id_usuario, lat, lng, precision_metros || null,
       motivo?.trim() || null, duracion, fechaActivacion, fechaExpiracion]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'EMERGENCIA',
      accion: 'UBICACION_ACTIVADA',
      descripcion: `Ubicación de emergencia activada por ${duracion} minutos`,
      entidad_afectada: 'ubicacion_emergencia',
      id_entidad: result.insertId,
      valor_nuevo: { latitud: lat, longitud: lng, duracion, motivo },
      req
    });

    return res.status(201).json({
      ok: true,
      message: 'Ubicación de emergencia activada',
      id: result.insertId,
      fecha_activacion: fechaActivacion,
      fecha_expiracion: fechaExpiracion,
      duracion_minutos: duracion
    });
  } catch (error) {
    console.error('[UBICACION_EMERGENCIA] Error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ ok: false, message: 'Funcion de ubicacion no disponible' });
    }
    return res.status(500).json({ ok: false, message: 'Error activando ubicacion' });
  }
});

// ==============================
// POST — Desactivar compartir ubicación
// ==============================
router.post('/desactivar', auth, async (req, res) => {
  try {
    const [existing] = await pool.execute(
      `SELECT id FROM ubicacion_emergencia WHERE id_usuario = ? AND activa = 1`,
      [req.user.id_usuario]
    );

    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'No hay ubicación activa' });
    }

    await pool.execute(
      `UPDATE ubicacion_emergencia SET activa = 0, fecha_desactivacion = NOW()
       WHERE id_usuario = ? AND activa = 1`,
      [req.user.id_usuario]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'EMERGENCIA',
      accion: 'UBICACION_DESACTIVADA',
      descripcion: 'Ubicación de emergencia desactivada por el alumno',
      entidad_afectada: 'ubicacion_emergencia',
      id_entidad: existing[0].id,
      req
    });

    return res.json({ ok: true, message: 'Ubicación desactivada' });
  } catch (error) {
    console.error('[UBICACION_EMERGENCIA] Error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ ok: false, message: 'Funcion de ubicacion no disponible' });
    }
    return res.status(500).json({ ok: false, message: 'Error desactivando ubicacion' });
  }
});

// ==============================
// GET — Consultar ubicación de un alumno (personal autorizado)
// ==============================
router.get('/alumno/:idAlumno', auth, async (req, res) => {
  try {
    const idAlumno = parseInt(req.params.idAlumno);
    if (isNaN(idAlumno)) {
      return res.status(400).json({ ok: false, message: 'ID de alumno inválido' });
    }

    const [usuarioResult] = await pool.execute(
      `SELECT id_usuario FROM alumnos WHERE id_alumno = ? LIMIT 1`,
      [idAlumno]
    );

    if (!usuarioResult.length) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const idUsuario = usuarioResult[0].id_usuario;

    const [rows] = await pool.execute(
      `SELECT id, activa, latitud, longitud, precision_metros, motivo,
              duracion_minutos, fecha_activacion, fecha_expiracion
       FROM ubicacion_emergencia
       WHERE id_usuario = ? AND activa = 1
       AND fecha_expiracion > NOW()
       ORDER BY creado_en DESC
       LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) {
      return res.json({
        ok: true,
        ubicacion: null,
        message: 'El alumno no ha compartido su ubicación o la autorización expiró'
      });
    }

    const ubicacion = rows[0];

    await pool.execute(
      `INSERT INTO ubicacion_emergencia_log
       (id_ubicacion, id_usuario_consulta, fecha_consulta, ip_origen, motivo_consulta)
       VALUES (?, ?, NOW(), ?, ?)`,
      [ubicacion.id, req.user.id_usuario, req.ip, 'Consulta de emergencia']
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'EMERGENCIA',
      accion: 'UBICACION_CONSULTADA',
      descripcion: `Ubicación del alumno ID ${idAlumno} consultada`,
      entidad_afectada: 'ubicacion_emergencia',
      id_entidad: ubicacion.id,
      req
    });

    return res.json({ ok: true, ubicacion });
  } catch (error) {
    console.error('[UBICACION_EMERGENCIA] Error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ ok: true, ubicacion: null, message: 'Funcion no disponible' });
    }
    return res.status(500).json({ ok: false, message: 'Error consultando ubicacion' });
  }
});

module.exports = router;
