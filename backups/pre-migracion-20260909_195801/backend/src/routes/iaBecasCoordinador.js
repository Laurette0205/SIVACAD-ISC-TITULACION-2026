'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

const COORD_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR']);

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

function canAccess(req, res, next) {
  const role = normalize(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  const roleId = Number(req.user?.rol_id || req.user?.id_rol || 0);
  if (COORD_ROLES.has(role) || [1, 2].includes(roleId)) return next();
  return res.status(403).json({ ok: false, message: 'Acceso restringido a coordinadores y administradores.' });
}

async function audit(opts = {}) {
  try {
    await pool.query(
      `INSERT INTO ia_becas_auditoria (id_usuario, nombre_usuario, rol_usuario, accion, entidad_tipo, entidad_id, descripcion, detalle_json, nivel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [opts.id_usuario, opts.nombre_usuario, opts.rol_usuario, opts.accion, opts.entidad_tipo, opts.entidad_id, opts.descripcion, opts.detalle ? JSON.stringify(opts.detalle) : null, opts.nivel || 'INFO']
    );
  } catch (e) { console.error('[iaBecasCoord] audit error:', e.message); }
}

function coordName(user) {
  return `${user?.nombres || ''} ${user?.apellido_paterno || ''}`.trim() || user?.nombre_completo || 'Coordinador';
}

// ============================================================
// BANDEJA DE SOLICITUDES
// ============================================================
router.get('/bandeja', authRequired, canAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, estatus, prioridad, id_carrera, id_grupo, semestre, busqueda } = req.query;
    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(10, Number(limit)));
    const offset = (p - 1) * l;
    const params = [];
    let where = 'WHERE 1=1';

    if (estatus) { where += ' AND s.estatus_solicitud = ?'; params.push(estatus); }
    if (prioridad) { where += ' AND s.prioridad = ?'; params.push(prioridad); }
    if (id_carrera) { where += ' AND s.id_carrera = ?'; params.push(Number(id_carrera)); }
    if (id_grupo) { where += ' AND s.id_grupo = ?'; params.push(Number(id_grupo)); }
    if (semestre) { where += ' AND s.semestre_actual = ?'; params.push(Number(semestre)); }
    if (busqueda) { const t = `%${busqueda}%`; where += ' AND (s.nombre_alumno LIKE ? OR s.matricula LIKE ? OR s.codigo_solicitud LIKE ?)'; params.push(t, t, t); }

    const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_bandeja_coordinador_view s ${where}`, params);
    const total = Number(count?.[0]?.total || 0);

    const [rows] = await pool.query(`SELECT * FROM ia_becas_bandeja_coordinador_view s ${where} ORDER BY s.prioridad DESC, s.fecha_solicitud DESC LIMIT ? OFFSET ?`, [...params, l, offset]);

    const [carreras] = await pool.query('SELECT DISTINCT id_carrera, nombre_carrera FROM ia_becas_solicitudes WHERE nombre_carrera IS NOT NULL ORDER BY nombre_carrera');
    const [grupos] = await pool.query('SELECT DISTINCT id_grupo, nombre_grupo FROM ia_becas_solicitudes WHERE nombre_grupo IS NOT NULL ORDER BY nombre_grupo');

    return res.json({ ok: true, data: { solicitudes: rows || [], carreras: carreras || [], grupos: grupos || [], paginacion: { page: p, limit: l, total, total_paginas: Math.ceil(total / l) } } });
  } catch (error) {
    console.error('[iaBecasCoord] bandeja error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar bandeja.' });
  }
});

// ============================================================
// DETALLE DE SOLICITUD (perfil del estudiante)
// ============================================================
router.get('/solicitudes/:id', authRequired, canAccess, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const [rows] = await pool.query('SELECT * FROM ia_becas_bandeja_coordinador_view WHERE id_solicitud = ? LIMIT 1', [id]);
    if (!rows?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    const [obs] = await pool.query('SELECT * FROM ia_becas_observaciones WHERE id_solicitud = ? ORDER BY fecha_observacion DESC', [id]);
    const [canal] = await pool.query('SELECT * FROM ia_becas_canalizaciones WHERE id_solicitud = ? ORDER BY fecha_canalizacion DESC', [id]);

    return res.json({ ok: true, data: { ...rows[0], observaciones: obs || [], canalizaciones: canal || [] } });
  } catch (error) {
    console.error('[iaBecasCoord] detalle error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar detalle.' });
  }
});

// ============================================================
// ESTUDIANTES CANDIDATOS
// ============================================================
router.get('/candidatos', authRequired, canAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, id_carrera, semestre, busqueda, promedio_min } = req.query;
    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(10, Number(limit)));
    const offset = (p - 1) * l;
    const params = [];
    let where = 'WHERE 1=1';

    if (id_carrera) { where += ' AND c.id_carrera = ?'; params.push(Number(id_carrera)); }
    if (semestre) { where += ' AND c.semestre_actual = ?'; params.push(Number(semestre)); }
    if (promedio_min) { where += ' AND c.promedio_general >= ?'; params.push(Number(promedio_min)); }
    if (busqueda) { const t = `%${busqueda}%`; where += ' AND (c.nombre_completo LIKE ? OR c.matricula LIKE ?)'; params.push(t, t); }

    const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_candidatos_view c ${where}`, params);
    const total = Number(count?.[0]?.total || 0);

    const [rows] = await pool.query(`SELECT * FROM ia_becas_candidatos_view c ${where} ORDER BY c.promedio_general DESC LIMIT ? OFFSET ?`, [...params, l, offset]);

    const [carreras] = await pool.query('SELECT DISTINCT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera');
    const [semestres] = await pool.query('SELECT DISTINCT semestre_actual FROM alumnos WHERE semestre_actual IS NOT NULL ORDER BY semestre_actual');

    return res.json({ ok: true, data: { candidatos: rows || [], carreras: carreras || [], semestres: semestres?.map(s => s.semestre_actual) || [], paginacion: { page: p, limit: l, total, total_paginas: Math.ceil(total / l) } } });
  } catch (error) {
    console.error('[iaBecasCoord] candidatos error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar candidatos.' });
  }
});

// ============================================================
// EVALUACIÓN DE ELEGIBILIDAD (asistida por IA)
// ============================================================
router.get('/elegibilidad/:id', authRequired, canAccess, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const [rows] = await pool.query(`
      SELECT s.*, c.requisitos, c.beneficios, c.nivel, c.titulo AS convocatoria_titulo,
             c.institucion, c.categoria, c.monto, k.promedio_general, k.creditos_acumulados
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      LEFT JOIN kardex_alumno k ON k.id_alumno = s.id_alumno
      WHERE s.id_solicitud = ? LIMIT 1
    `, [id]);

    if (!rows?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    const sol = rows[0];
    let requisitos = [];
    try { requisitos = JSON.parse(sol.requisitos || '[]'); } catch { requisitos = []; }

    const criterios = requisitos.map((reqText, idx) => {
      const text = String(reqText).toLowerCase();
      let cumple = true, detalle = 'Criterio cumplido';
      if (text.includes('promedio')) {
        const m = text.match(/(\d+\.?\d*)/);
        if (m) { const min = parseFloat(m[1]); cumple = (sol.promedio_actual || 0) >= min; detalle = cumple ? `Promedio ${sol.promedio_actual} >= ${min}` : `Promedio ${sol.promedio_actual} < ${min}`; }
      }
      if (text.includes('crédito') || text.includes('credito')) {
        const m = text.match(/(\d+)/);
        if (m) { const min = parseInt(m[1]); cumple = (sol.creditos_acumulados || 0) >= min; detalle = cumple ? `Créditos ${sol.creditos_acumulados} >= ${min}%` : `Créditos ${sol.creditos_acumulados} < ${min}%`; }
      }
      if (text.includes('regular')) { cumple = (sol.estatus_academico || '').toUpperCase() === 'REGULAR'; detalle = cumple ? 'Estatus regular' : `Estatus: ${sol.estatus_academico}`; }
      return { criterio: reqText, cumple, detalle, index: idx };
    });

    const total = criterios.length;
    const cumplidos = criterios.filter(c => c.cumple).length;
    const puntuacion = total > 0 ? Math.round((cumplidos / total) * 100) : 0;

    return res.json({
      ok: true, data: {
        id_solicitud: sol.id_solicitud, nombre_alumno: sol.nombre_alumno, matricula: sol.matricula,
        convocatoria: sol.convocatoria_titulo, institucion: sol.institucion, categoria: sol.categoria,
        promedio_actual: sol.promedio_actual, creditos_acumulados: sol.creditos_acumulados,
        estatus_academico: sol.estatus_academico, semestre_actual: sol.semestre_actual,
        carrera: sol.nombre_carrera, grupo: sol.nombre_grupo, turno: sol.turno,
        total_criterios: total, cumplidos, no_cumplidos: total - cumplidos, puntuacion,
        elegible: puntuacion >= 60, criterios
      }
    });
  } catch (error) {
    console.error('[iaBecasCoord] elegibilidad error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al evaluar elegibilidad.' });
  }
});

// ============================================================
// OBSERVACIONES
// ============================================================
router.get('/observaciones', authRequired, canAccess, async (req, res) => {
  try {
    const { id_solicitud, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(10, Number(limit)));
    const offset = (p - 1) * l;
    const params = [];
    let where = 'WHERE 1=1';

    if (id_solicitud) { where += ' AND o.id_solicitud = ?'; params.push(Number(id_solicitud)); }

    const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_observaciones o ${where}`, params);
    const total = Number(count?.[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT o.*, s.nombre_alumno, s.codigo_solicitud, s.matricula
       FROM ia_becas_observaciones o
       JOIN ia_becas_solicitudes s ON s.id_solicitud = o.id_solicitud
       ${where} ORDER BY o.fecha_observacion DESC LIMIT ? OFFSET ?`, [...params, l, offset]);

    return res.json({ ok: true, data: { observaciones: rows || [], paginacion: { page: p, limit: l, total, total_paginas: Math.ceil(total / l) } } });
  } catch (error) {
    console.error('[iaBecasCoord] observaciones error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar observaciones.' });
  }
});

router.post('/observaciones', authRequired, canAccess, async (req, res) => {
  try {
    const { id_solicitud, tipo_observacion, observacion, es_interna } = req.body;
    if (!id_solicitud || !observacion) return res.status(400).json({ ok: false, message: 'id_solicitud y observacion son obligatorios.' });

    const [sol] = await pool.query('SELECT id_solicitud FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [Number(id_solicitud)]);
    if (!sol?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    const nombre = coordName(req.user);
    const result = await pool.query(
      `INSERT INTO ia_becas_observaciones (id_solicitud, id_usuario, nombre_usuario, rol_usuario, tipo_observacion, observacion, es_interna)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(id_solicitud), req.user?.id_usuario, nombre, req.user?.rol_nombre || req.user?.rol, tipo_observacion || 'GENERAL', observacion, es_interna ? 1 : 0]
    );

    await audit({ id_usuario: req.user?.id_usuario, nombre_usuario: nombre, rol_usuario: req.user?.rol_nombre || req.user?.rol, accion: 'AGREGAR_OBSERVACION', entidad_tipo: 'ia_becas_observaciones', entidad_id: result?.[0]?.insertId, descripcion: `Observación [${tipo_observacion || 'GENERAL'}] en solicitud #${id_solicitud}`, detalle: { id_solicitud, tipo_observacion, es_interna } });

    return res.status(201).json({ ok: true, message: 'Observación registrada.', data: { id_observacion: result?.[0]?.insertId } });
  } catch (error) {
    console.error('[iaBecasCoord] crear observacion error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al registrar observación.' });
  }
});

// ============================================================
// CANALIZAR CASO
// ============================================================
router.post('/canalizar', authRequired, canAccess, async (req, res) => {
  try {
    const { id_solicitud, area_destino, id_usuario_destino, motivo } = req.body;
    if (!id_solicitud || !area_destino) return res.status(400).json({ ok: false, message: 'id_solicitud y area_destino son obligatorios.' });

    const areasValidas = ['COORDINACION_ACADEMICA', 'SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECCION', 'COMITE_BECAS'];
    if (!areasValidas.includes(area_destino)) return res.status(400).json({ ok: false, message: `Área destino inválida. Válidas: ${areasValidas.join(', ')}` });

    const [sol] = await pool.query('SELECT id_solicitud FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [Number(id_solicitud)]);
    if (!sol?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    const nombre = coordName(req.user);
    const result = await pool.query(
      `INSERT INTO ia_becas_canalizaciones (id_solicitud, id_usuario_origen, nombre_usuario_origen, id_usuario_destino, area_destino, motivo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(id_solicitud), req.user?.id_usuario, nombre, id_usuario_destino || null, area_destino, motivo || null]
    );

    // Update solicitud with canalizacion info
    await pool.query('UPDATE ia_becas_solicitudes SET canalizado_a = ?, fecha_canalizacion = NOW() WHERE id_solicitud = ?', [area_destino, Number(id_solicitud)]);

    await audit({ id_usuario: req.user?.id_usuario, nombre_usuario: nombre, rol_usuario: req.user?.rol_nombre || req.user?.rol, accion: 'CANALIZAR_CASO', entidad_tipo: 'ia_becas_canalizaciones', entidad_id: result?.[0]?.insertId, descripcion: `Caso #${id_solicitud} canalizado a ${area_destino}`, detalle: { id_solicitud, area_destino, id_usuario_destino, motivo } });

    return res.status(201).json({ ok: true, message: `Caso canalizado a ${area_destino}.`, data: { id_canalizacion: result?.[0]?.insertId } });
  } catch (error) {
    console.error('[iaBecasCoord] canalizar error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al canalizar caso.' });
  }
});

// ============================================================
// DICTAMEN PRELIMINAR
// ============================================================
router.post('/dictamen-preliminar', authRequired, canAccess, async (req, res) => {
  try {
    const { id_solicitud, tipo_dictamen, fundamento, observaciones, monto_sugerido } = req.body;
    if (!id_solicitud || !tipo_dictamen) return res.status(400).json({ ok: false, message: 'id_solicitud y tipo_dictamen son obligatorios.' });
    if (!['APROBADA', 'RECHAZADA', 'CONDICIONADA'].includes(tipo_dictamen)) return res.status(400).json({ ok: false, message: 'tipo_dictamen inválido.' });

    const [sol] = await pool.query('SELECT * FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [Number(id_solicitud)]);
    if (!sol?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    const [exist] = await pool.query('SELECT id_dictamen FROM ia_becas_dictamenes WHERE id_solicitud = ? LIMIT 1', [Number(id_solicitud)]);
    if (exist?.length) return res.status(409).json({ ok: false, message: 'La solicitud ya tiene dictamen final. Use la sección de Administración.' });

    const nombre = coordName(req.user);

    await pool.query(
      `INSERT INTO ia_becas_dictamenes (id_solicitud, id_convocatoria, id_alumno, tipo_dictamen, fundamento, observaciones, monto_asignado, validado_por_ia, id_usuario_dictamina, nombre_dictamina)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(id_solicitud), sol[0].id_convocatoria, sol[0].id_alumno, tipo_dictamen, fundamento || null, observaciones || null, monto_sugerido || null, 0, req.user?.id_usuario, nombre]
    );

    const nuevoEstatus = tipo_dictamen === 'APROBADA' ? 'APROBADA' : tipo_dictamen === 'RECHAZADA' ? 'RECHAZADA' : 'VALIDADA';
    await pool.query('UPDATE ia_becas_solicitudes SET estatus_solicitud = ?, fecha_resolucion = NOW(), id_usuario_revisor = ?, nombre_revisor = ? WHERE id_solicitud = ?', [nuevoEstatus, req.user?.id_usuario, nombre, Number(id_solicitud)]);

    await audit({ id_usuario: req.user?.id_usuario, nombre_usuario: nombre, rol_usuario: req.user?.rol_nombre || req.user?.rol, accion: 'DICTAMEN_PRELIMINAR', entidad_tipo: 'ia_becas_dictamenes', entidad_id: null, descripcion: `Dictamen preliminar "${tipo_dictamen}" para solicitud #${id_solicitud}`, detalle: { id_solicitud, tipo_dictamen, fundamento, monto_sugerido } });

    return res.json({ ok: true, message: `Dictamen preliminar "${tipo_dictamen}" emitido para solicitud #${id_solicitud}.` });
  } catch (error) {
    console.error('[iaBecasCoord] dictamen preliminar error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al emitir dictamen preliminar.' });
  }
});

// ============================================================
// SEGUIMIENTO DE CASOS
// ============================================================
router.get('/seguimiento', authRequired, canAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, estatus, id_coordinador } = req.query;
    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(10, Number(limit)));
    const offset = (p - 1) * l;
    const params = [];
    let where = 'WHERE 1=1';

    if (estatus) { where += ' AND s.estatus_solicitud = ?'; params.push(estatus); }
    if (id_coordinador) { where += ' AND s.id_coordinador_asignado = ?'; params.push(Number(id_coordinador)); }

    const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_bandeja_coordinador_view s ${where}`, params);
    const total = Number(count?.[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT s.id_solicitud, s.codigo_solicitud, s.nombre_alumno, s.matricula, s.nombre_carrera, s.nombre_grupo,
              s.semestre_actual, s.promedio_actual, s.estatus_solicitud, s.prioridad, s.fecha_solicitud,
              s.fecha_revision, s.fecha_resolucion, s.convocatoria_titulo, s.total_observaciones,
              s.total_canalizaciones, s.id_coordinador_asignado, s.nombre_coordinador_asignado,
              s.canalizado_a, d.tipo_dictamen
       FROM ia_becas_bandeja_coordinador_view s
       LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud
       ${where} ORDER BY s.prioridad DESC, s.fecha_solicitud DESC LIMIT ? OFFSET ?`, [...params, l, offset]);

    return res.json({ ok: true, data: { seguimiento: rows || [], paginacion: { page: p, limit: l, total, total_paginas: Math.ceil(total / l) } } });
  } catch (error) {
    console.error('[iaBecasCoord] seguimiento error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar seguimiento.' });
  }
});

// ============================================================
// ASIGNAR COORDINADOR A SOLICITUD
// ============================================================
router.put('/solicitudes/:id/asignar', authRequired, canAccess, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const nombre = coordName(req.user);
    const [sol] = await pool.query('SELECT id_solicitud FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [id]);
    if (!sol?.length) return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });

    await pool.query('UPDATE ia_becas_solicitudes SET id_coordinador_asignado = ?, nombre_coordinador_asignado = ?, fecha_asignacion = NOW() WHERE id_solicitud = ?', [req.user?.id_usuario, nombre, id]);

    await audit({ id_usuario: req.user?.id_usuario, nombre_usuario: nombre, rol_usuario: req.user?.rol_nombre || req.user?.rol, accion: 'ASIGNAR_COORDINADOR', entidad_tipo: 'ia_becas_solicitudes', entidad_id: id, descripcion: `Coordinador ${nombre} asignado a solicitud #${id}` });

    return res.json({ ok: true, message: `Te has asignado a la solicitud #${id}.` });
  } catch (error) {
    console.error('[iaBecasCoord] asignar error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al asignar coordinador.' });
  }
});

// ============================================================
// ACTUALIZAR PRIORIDAD
// ============================================================
router.put('/solicitudes/:id/prioridad', authRequired, canAccess, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const { prioridad } = req.body;
    if (!['BAJA', 'NORMAL', 'ALTA', 'URGENTE'].includes(prioridad)) return res.status(400).json({ ok: false, message: 'Prioridad inválida.' });

    await pool.query('UPDATE ia_becas_solicitudes SET prioridad = ? WHERE id_solicitud = ?', [prioridad, id]);
    return res.json({ ok: true, message: `Prioridad actualizada a "${prioridad}".` });
  } catch (error) {
    console.error('[iaBecasCoord] prioridad error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al actualizar prioridad.' });
  }
});

module.exports = router;
