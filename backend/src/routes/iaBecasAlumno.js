'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const becasTools = require('../services/becasTools');

const router = express.Router();

const { resolveStudentIdentity, getStudentAverage, getStudentEligibility } = becasTools;

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

// Middleware: resolve student from JWT
async function resolveAlumno(req, res, next) {
  try {
    req.alumno = await resolveStudentIdentity(pool, req.user, req.body || {});
    next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al identificar al alumno.' });
  }
}

// ============================================================
// MI PERFIL / DATOS GENERALES
// ============================================================
router.get('/mi-perfil', authRequired, resolveAlumno, async (req, res) => {
  if (!req.alumno) {
    return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil de alumno. Asegúrate de usar una cuenta de alumno.' });
  }

  const average = await getStudentAverage(pool, req.alumno).catch(() => null);

  return res.json({
    ok: true,
    data: {
      ...req.alumno,
      ...(average || {})
    }
  });
});

// ============================================================
// MI ELEGIBILIDAD (asistida por IA)
// ============================================================
router.get('/mi-elegibilidad', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) {
      return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil de alumno.' });
    }

    const elegibilidad = await getStudentEligibility(pool, req.alumno, {});
    return res.json({ ok: true, data: elegibilidad });
  } catch (error) {
    console.error('[iaBecasAlumno] elegibilidad error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al calcular elegibilidad.' });
  }
});

// ============================================================
// MIS SOLICITUDES
// ============================================================
router.get('/mis-solicitudes', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) {
      return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil de alumno.' });
    }

    const [rows] = await pool.query(
      `SELECT s.*, c.titulo AS convocatoria_titulo, c.institucion AS convocatoria_institucion,
              c.categoria AS convocatoria_categoria, c.url_oficial, c.vigencia_texto,
              d.id_dictamen, d.tipo_dictamen, d.fundamento, d.observaciones AS dictamen_observaciones,
              d.monto_asignado, d.fecha_dictamen, d.nombre_dictamina
       FROM ia_becas_solicitudes s
       LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
       LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud
       WHERE s.id_alumno = ?
       ORDER BY s.fecha_solicitud DESC`,
      [req.alumno.id_alumno]
    );

    return res.json({ ok: true, data: { solicitudes: rows || [] } });
  } catch (error) {
    console.error('[iaBecasAlumno] solicitudes error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar tus solicitudes.' });
  }
});

// ============================================================
// CREAR SOLICITUD
// ============================================================
router.post('/solicitar', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) {
      return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil de alumno.' });
    }

    const { id_convocatoria, nota } = req.body;
    if (!id_convocatoria) {
      return res.status(400).json({ ok: false, message: 'Selecciona una convocatoria para enviar tu solicitud.' });
    }

    const [conv] = await pool.query('SELECT * FROM ia_becas_convocatorias WHERE id_convocatoria = ? AND activo = 1 LIMIT 1', [Number(id_convocatoria)]);
    if (!conv?.length) {
      return res.status(404).json({ ok: false, message: 'Convocatoria no encontrada o no activa.' });
    }

    const c = conv[0];
    const codigo = `SOL-AL-${Date.now().toString(36).toUpperCase()}-${String(req.alumno.id_alumno).padStart(4, '0')}`;
    const average = await getStudentAverage(pool, req.alumno).catch(() => ({}));

    const [result] = await pool.query(
      `INSERT INTO ia_becas_solicitudes
       (id_convocatoria, codigo_solicitud, id_usuario_solicitante, id_alumno, matricula, nombre_alumno,
        correo_alumno, id_carrera, nombre_carrera, semestre_actual, promedio_actual, creditos_acumulados,
        estatus_academico, estatus_solicitud, nota_solicitante)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)`,
      [
        c.id_convocatoria, codigo, req.user?.id_usuario, req.alumno.id_alumno, req.alumno.matricula,
        req.alumno.nombre_completo, req.alumno.correo, req.alumno.id_carrera, req.alumno.nombre_carrera,
        req.alumno.semestre_actual, average?.promedio_general || null, average?.creditos_acumulados || 0,
        req.alumno.estatus_academico || 'Regular', nota || null
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Solicitud enviada correctamente.',
      data: { codigo_solicitud: codigo, id_solicitud: result?.[0]?.insertId }
    });
  } catch (error) {
    console.error('[iaBecasAlumno] solicitar error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al enviar solicitud.' });
  }
});

// ============================================================
// MIS NOTIFICACIONES
// ============================================================
router.get('/mis-notificaciones', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil.' });

    const [solicitudes] = await pool.query(
      `SELECT id_solicitud, codigo_solicitud, estatus_solicitud, fecha_solicitud, fecha_resolucion, nombre_revisor
       FROM ia_becas_solicitudes WHERE id_alumno = ? ORDER BY fecha_solicitud DESC LIMIT 5`,
      [req.alumno.id_alumno]
    );

    const [convocatorias] = await pool.query(
      `SELECT id_convocatoria, titulo, institucion, categoria, activo, destacada, fecha_publicacion, url_oficial
       FROM ia_becas_convocatorias WHERE activo = 1 ORDER BY destacada DESC, fecha_publicacion DESC LIMIT 5`
    );

    const notificaciones = [];

    for (const s of solicitudes || []) {
      if (s.estatus_solicitud === 'APROBADA') {
        notificaciones.push({ tipo: 'exito', icono: 'check', titulo: 'Solicitud aprobada', mensaje: `Tu solicitud ${s.codigo_solicitud} fue aprobada.`, fecha: s.fecha_resolucion, id_solicitud: s.id_solicitud });
      } else if (s.estatus_solicitud === 'RECHAZADA') {
        notificaciones.push({ tipo: 'error', icono: 'x', titulo: 'Solicitud rechazada', mensaje: `Tu solicitud ${s.codigo_solicitud} no fue aprobada.`, fecha: s.fecha_resolucion, id_solicitud: s.id_solicitud });
      } else if (s.estatus_solicitud === 'EN_REVISION') {
        notificaciones.push({ tipo: 'info', icono: 'eye', titulo: 'Solicitud en revisión', mensaje: `Tu solicitud ${s.codigo_solicitud} está siendo evaluada.`, fecha: s.fecha_solicitud, id_solicitud: s.id_solicitud });
      } else if (s.estatus_solicitud === 'PENDIENTE') {
        notificaciones.push({ tipo: 'pendiente', icono: 'clock', titulo: 'Solicitud pendiente', mensaje: `Tu solicitud ${s.codigo_solicitud} está pendiente de revisión.`, fecha: s.fecha_solicitud, id_solicitud: s.id_solicitud });
      }
    }

    for (const c of convocatorias || []) {
      if (c.destacada) {
        notificaciones.push({ tipo: 'convocatoria', icono: 'megaphone', titulo: `Nueva convocatoria: ${c.titulo}`, mensaje: `${c.institucion} - Convocatoria destacada disponible.`, fecha: c.fecha_publicacion, url: c.url_oficial, id_convocatoria: c.id_convocatoria });
      }
    }

    notificaciones.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    return res.json({ ok: true, data: { notificaciones: notificaciones.slice(0, 10), solicitudes: solicitudes || [], convocatorias: convocatorias || [] } });
  } catch (error) {
    console.error('[iaBecasAlumno] notificaciones error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar notificaciones.' });
  }
});

// ============================================================
// REQUISITOS / CONVOCATORIAS ACTIVAS
// ============================================================
router.get('/convocatorias-activas', authRequired, resolveAlumno, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_convocatoria, codigo, titulo, institucion, categoria, tipo, url_oficial,
              descripcion, resumen, requisitos, beneficios, nivel, alcance,
              vigencia_inicio, vigencia_fin, vigencia_texto, monto, activo, destacada
       FROM ia_becas_convocatorias
       WHERE activo = 1
       ORDER BY destacada DESC, fecha_publicacion DESC`
    );

    return res.json({ ok: true, data: { convocatorias: rows || [] } });
  } catch (error) {
    console.error('[iaBecasAlumno] convocatorias error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar convocatorias.' });
  }
});

// ============================================================
// SEGUIMIENTO DE UNA SOLICITUD (con observaciones)
// ============================================================
router.get('/seguimiento/:id', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil.' });

    const id = Number(req.params.id) || 0;
    const [rows] = await pool.query(
      `SELECT s.*, c.titulo AS convocatoria_titulo, c.institucion AS convocatoria_institucion,
              c.categoria, c.url_oficial, c.vigencia_texto, c.requisitos, c.beneficios, c.monto,
              d.id_dictamen, d.tipo_dictamen, d.fundamento, d.observaciones AS dictamen_observaciones,
              d.monto_asignado, d.fecha_dictamen, d.nombre_dictamina, d.validado_por_ia
       FROM ia_becas_solicitudes s
       LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
       LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud
       WHERE s.id_solicitud = ? AND s.id_alumno = ?
       LIMIT 1`, [id, req.alumno.id_alumno]);

    if (!rows?.length) {
      return res.status(404).json({ ok: false, message: 'Solicitud no encontrada o no te pertenece.' });
    }

    const [obs] = await pool.query(
      `SELECT id_observacion, tipo_observacion, observacion, nombre_usuario, fecha_observacion
       FROM ia_becas_observaciones WHERE id_solicitud = ? AND es_interna = 0
       ORDER BY fecha_observacion DESC`, [id]);

    return res.json({ ok: true, data: { ...rows[0], observaciones: obs || [] } });
  } catch (error) {
    console.error('[iaBecasAlumno] seguimiento error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar seguimiento.' });
  }
});

// ============================================================
// RECOMENDACIONES (basadas en perfil del alumno)
// ============================================================
router.get('/recomendaciones', authRequired, resolveAlumno, async (req, res) => {
  try {
    if (!req.alumno) return res.status(400).json({ ok: false, message: 'No se pudo identificar tu perfil.' });

    const elegibilidad = await getStudentEligibility(pool, req.alumno, {});
    const elegibles = elegibilidad?.becas_evaluadas?.filter(b => b.elegible) || [];
    const noElegibles = elegibilidad?.becas_evaluadas?.filter(b => !b.elegible) || [];

    const [activas] = await pool.query(
      `SELECT id_convocatoria, codigo, titulo, institucion, categoria, url_oficial, resumen,
              vigencia_texto, monto, destacada
       FROM ia_becas_convocatorias WHERE activo = 1
       ORDER BY destacada DESC, fecha_publicacion DESC LIMIT 5`
    );

    return res.json({
      ok: true,
      data: {
        recomendaciones: elegibles.slice(0, 5).map(b => ({
          titulo: b.titulo,
          institucion: b.institucion,
          url: b.url,
          tipo: 'elegible',
          mensaje: ' Cumples con los requisitos'
        })),
        oportunidades_mejora: noElegibles.slice(0, 5).map(b => ({
          titulo: b.titulo,
          institucion: b.institucion,
          faltantes: b.checks?.filter(c => !c.cumple)?.map(c => c.criterio) || [],
          tipo: 'mejora'
        })),
        convocatorias_activas: activas || [],
        resumen: {
          total_evaluadas: elegibilidad?.total_evaluadas || 0,
          total_elegibles: elegibilidad?.total_elegibles || 0,
          promedio: elegibilidad?.alumno?.promedio_general || 0
        }
      }
    });
  } catch (error) {
    console.error('[iaBecasAlumno] recomendaciones error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al generar recomendaciones.' });
  }
});

module.exports = router;
