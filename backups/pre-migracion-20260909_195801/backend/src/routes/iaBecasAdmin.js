'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR']);

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token no disponible' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

function canManageBecas(user) {
  const role = normalize(user?.rol_nombre || user?.rol || user?.role);
  const roleId = Number(user?.rol_id || user?.id_rol || 0);
  return ADMIN_ROLES.has(role) || [1, 2].includes(roleId);
}

function requireAdmin(req, res, next) {
  if (!canManageBecas(req.user)) {
    return res.status(403).json({ ok: false, message: 'No tienes permisos de administración de becas.' });
  }
  next();
}

async function auditLog({ id_usuario, nombre_usuario, rol_usuario, accion, entidad_tipo, entidad_id, descripcion, detalle_json, nivel = 'INFO' }) {
  try {
    await pool.query(
      `INSERT INTO ia_becas_auditoria (id_usuario, nombre_usuario, rol_usuario, accion, entidad_tipo, entidad_id, descripcion, detalle_json, nivel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario || null, nombre_usuario || null, rol_usuario || null, accion, entidad_tipo, entidad_id || null, descripcion || null, detalle_json ? JSON.stringify(detalle_json) : null, nivel]
    );
  } catch (error) {
    console.error('[iaBecasAdmin] Error al registrar auditoría:', error.message);
  }
}

// ============================================================
// TABLERO DE MÉTRICAS / PANEL GENERAL
// ============================================================
router.get('/metricas', authRequired, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ia_becas_metricas_view LIMIT 1');
    const [convocatorias] = await pool.query('SELECT id_convocatoria, codigo, titulo, institucion, categoria, activo, destacada, fecha_publicacion FROM ia_becas_convocatorias ORDER BY destacada DESC, fecha_publicacion DESC LIMIT 5');
    const [solicitudesRecientes] = await pool.query(`
      SELECT s.id_solicitud, s.codigo_solicitud, s.nombre_alumno, s.estatus_solicitud, s.fecha_solicitud, c.titulo AS convocatoria_titulo
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      ORDER BY s.fecha_solicitud DESC LIMIT 5
    `);
    const [dictamenesRecientes] = await pool.query(`
      SELECT d.id_dictamen, d.tipo_dictamen, d.monto_asignado, d.fecha_dictamen, d.nombre_dictamina, s.nombre_alumno
      FROM ia_becas_dictamenes d
      JOIN ia_becas_solicitudes s ON s.id_solicitud = d.id_solicitud
      ORDER BY d.fecha_dictamen DESC LIMIT 5
    `);

    return res.json({
      ok: true,
      data: {
        metricas: rows?.[0] || {},
        convocatorias_destacadas: convocatorias || [],
        solicitudes_recientes: solicitudesRecientes || [],
        dictamenes_recientes: dictamenesRecientes || []
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en métricas:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar métricas.' });
  }
});

// ============================================================
// SOLICITUDES
// ============================================================
router.get('/solicitudes', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const estatus = String(req.query.estatus || '').trim();
    const busqueda = String(req.query.busqueda || '').trim();
    const id_carrera = Number(req.query.id_carrera) || 0;
    const id_periodo = Number(req.query.id_periodo) || 0;

    let where = 'WHERE 1=1';
    const params = [];

    if (estatus) {
      where += ' AND s.estatus_solicitud = ?';
      params.push(estatus);
    }
    if (busqueda) {
      where += ' AND (s.nombre_alumno LIKE ? OR s.matricula LIKE ? OR s.codigo_solicitud LIKE ?)';
      const term = `%${busqueda}%`;
      params.push(term, term, term);
    }
    if (id_carrera) {
      where += ' AND s.id_carrera = ?';
      params.push(id_carrera);
    }
    if (id_periodo) {
      where += ' AND s.id_periodo = ?';
      params.push(id_periodo);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_solicitudes s ${where}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(`
      SELECT s.*, c.titulo AS convocatoria_titulo, c.institucion AS convocatoria_institucion
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      ${where}
      ORDER BY s.fecha_solicitud DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: {
        solicitudes: rows || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en solicitudes:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar solicitudes.' });
  }
});

router.get('/solicitudes/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const [rows] = await pool.query(`
      SELECT s.*, c.titulo AS convocatoria_titulo, c.institucion AS convocatoria_institucion, c.categoria AS convocatoria_categoria,
             d.id_dictamen, d.tipo_dictamen, d.fundamento, d.observaciones AS dictamen_observaciones, d.monto_asignado,
             d.validado_por_ia, d.resultado_ia, d.fecha_dictamen, d.nombre_dictamina
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      LEFT JOIN ia_becas_dictamenes d ON d.id_solicitud = s.id_solicitud
      WHERE s.id_solicitud = ?
      LIMIT 1
    `, [id]);

    if (!rows?.length) {
      return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });
    }

    const [documentos] = await pool.query('SELECT * FROM ia_becas_documentos WHERE id_solicitud = ?', [id]);

    return res.json({
      ok: true,
      data: { ...rows[0], documentos: documentos || [] }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al obtener solicitud:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar solicitud.' });
  }
});

router.put('/solicitudes/:id/estatus', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const { estatus, nota_revisor } = req.body;

    const estatusPermitidos = ['PENDIENTE', 'EN_REVISION', 'VALIDADA', 'RECHAZADA', 'APROBADA', 'CANCELADA'];
    if (!estatusPermitidos.includes(estatus)) {
      return res.status(400).json({ ok: false, message: `Estatus inválido. Permitidos: ${estatusPermitidos.join(', ')}` });
    }

    const [rows] = await pool.query('SELECT * FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [id]);
    if (!rows?.length) {
      return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });
    }

    const nombre_usuario = `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador';
    const updateFields = ['estatus_solicitud = ?', 'fecha_revision = NOW()'];
    const updateParams = [estatus];

    if (['RECHAZADA', 'APROBADA', 'CANCELADA'].includes(estatus)) {
      updateFields.push('fecha_resolucion = NOW()');
      updateFields.push('id_usuario_revisor = ?');
      updateFields.push('nombre_revisor = ?');
      updateParams.push(req.user?.id_usuario || null);
      updateParams.push(nombre_usuario);
    }
    if (nota_revisor !== undefined) {
      updateFields.push('nota_revisor = ?');
      updateParams.push(nota_revisor);
    }

    updateParams.push(id);
    await pool.query(`UPDATE ia_becas_solicitudes SET ${updateFields.join(', ')} WHERE id_solicitud = ?`, updateParams);

    await auditLog({
      id_usuario: req.user?.id_usuario,
      nombre_usuario,
      rol_usuario: req.user?.rol_nombre || req.user?.rol,
      accion: `CAMBIAR_ESTATUS_SOLICITUD`,
      entidad_tipo: 'ia_becas_solicitudes',
      entidad_id: id,
      descripcion: `Cambio de estatus de solicitud #${id} a "${estatus}"`,
      detalle_json: { estatus_anterior: rows[0].estatus_solicitud, estatus_nuevo: estatus, nota_revisor }
    });

    return res.json({ ok: true, message: `Solicitud #${id} actualizada a "${estatus}".` });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al actualizar estatus:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al actualizar estatus.' });
  }
});

// ============================================================
// DICTÁMENES
// ============================================================
router.get('/dictamenes', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const tipo = String(req.query.tipo || '').trim();
    const busqueda = String(req.query.busqueda || '').trim();

    let where = 'WHERE 1=1';
    const params = [];

    if (tipo) {
      where += ' AND d.tipo_dictamen = ?';
      params.push(tipo);
    }
    if (busqueda) {
      where += ' AND (s.nombre_alumno LIKE ? OR s.matricula LIKE ?)';
      const term = `%${busqueda}%`;
      params.push(term, term);
    }

    const [countRows] = await pool.query(`
      SELECT COUNT(*) AS total FROM ia_becas_dictamenes d
      JOIN ia_becas_solicitudes s ON s.id_solicitud = d.id_solicitud
      ${where}
    `, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(`
      SELECT d.*, s.nombre_alumno, s.matricula, s.codigo_solicitud, s.nombre_carrera,
             c.titulo AS convocatoria_titulo, c.institucion AS convocatoria_institucion
      FROM ia_becas_dictamenes d
      JOIN ia_becas_solicitudes s ON s.id_solicitud = d.id_solicitud
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = d.id_convocatoria
      ${where}
      ORDER BY d.fecha_dictamen DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: {
        dictamenes: rows || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en dictámenes:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar dictámenes.' });
  }
});

router.post('/dictamenes', authRequired, requireAdmin, async (req, res) => {
  try {
    const { id_solicitud, tipo_dictamen, fundamento, observaciones, monto_asignado, validado_por_ia, resultado_ia } = req.body;

    if (!id_solicitud || !tipo_dictamen) {
      return res.status(400).json({ ok: false, message: 'id_solicitud y tipo_dictamen son obligatorios.' });
    }

    const tiposPermitidos = ['APROBADA', 'RECHAZADA', 'CONDICIONADA'];
    if (!tiposPermitidos.includes(tipo_dictamen)) {
      return res.status(400).json({ ok: false, message: `Tipo de dictamen inválido. Permitidos: ${tiposPermitidos.join(', ')}` });
    }

    const [solicitudRows] = await pool.query('SELECT * FROM ia_becas_solicitudes WHERE id_solicitud = ? LIMIT 1', [id_solicitud]);
    if (!solicitudRows?.length) {
      return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });
    }

    const [existente] = await pool.query('SELECT id_dictamen FROM ia_becas_dictamenes WHERE id_solicitud = ? LIMIT 1', [id_solicitud]);
    if (existente?.length) {
      return res.status(409).json({ ok: false, message: 'La solicitud ya tiene un dictamen. Use PUT para actualizarlo.' });
    }

    const solicitud = solicitudRows[0];
    const nombre_usuario = `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador';

    const result = await pool.query(
      `INSERT INTO ia_becas_dictamenes
       (id_solicitud, id_convocatoria, id_alumno, tipo_dictamen, fundamento, observaciones, monto_asignado,
        validado_por_ia, resultado_ia, id_usuario_dictamina, nombre_dictamina)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_solicitud, solicitud.id_convocatoria, solicitud.id_alumno, tipo_dictamen,
        fundamento || null, observaciones || null, monto_asignado || null,
        validado_por_ia ? 1 : 0, resultado_ia ? JSON.stringify(resultado_ia) : null,
        req.user?.id_usuario, nombre_usuario
      ]
    );

    const nuevoEstatus = tipo_dictamen === 'APROBADA' ? 'APROBADA' : tipo_dictamen === 'RECHAZADA' ? 'RECHAZADA' : 'VALIDADA';
    await pool.query(
      `UPDATE ia_becas_solicitudes SET estatus_solicitud = ?, fecha_resolucion = NOW(), id_usuario_revisor = ?, nombre_revisor = ? WHERE id_solicitud = ?`,
      [nuevoEstatus, req.user?.id_usuario, nombre_usuario, id_solicitud]
    );

    if (tipo_dictamen === 'APROBADA' && monto_asignado) {
      await pool.query(
        `UPDATE ia_becas_solicitudes SET monto_aprobado = ? WHERE id_solicitud = ?`,
        [monto_asignado, id_solicitud]
      );
    }

    await auditLog({
      id_usuario: req.user?.id_usuario, nombre_usuario, rol_usuario: req.user?.rol_nombre || req.user?.rol,
      accion: 'CREAR_DICTAMEN', entidad_tipo: 'ia_becas_dictamenes', entidad_id: result?.[0]?.insertId || null,
      descripcion: `Dictamen "${tipo_dictamen}" para solicitud #${id_solicitud} (${solicitud.nombre_alumno})`,
      detalle_json: { id_solicitud, tipo_dictamen, fundamento, monto_asignado, validado_por_ia }
    });

    return res.json({
      ok: true,
      message: `Dictamen "${tipo_dictamen}" registrado para solicitud #${id_solicitud}.`,
      data: { id_dictamen: result?.[0]?.insertId || null }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al crear dictamen:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al crear dictamen.' });
  }
});

// ============================================================
// HISTORIAL (vista completa)
// ============================================================
router.get('/historial', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const estatus = String(req.query.estatus || '').trim();
    const busqueda = String(req.query.busqueda || '').trim();

    let where = 'WHERE 1=1';
    const params = [];

    if (estatus) {
      where += ' AND estatus_solicitud = ?';
      params.push(estatus);
    }
    if (busqueda) {
      where += ' AND (nombre_alumno LIKE ? OR matricula LIKE ? OR codigo_solicitud LIKE ?)';
      const term = `%${busqueda}%`;
      params.push(term, term, term);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_historial_view ${where}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(`SELECT * FROM ia_becas_historial_view ${where} ORDER BY fecha_solicitud DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: {
        historial: rows || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en historial:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar historial.' });
  }
});

// ============================================================
// CONVOCATORIAS
// ============================================================
router.get('/convocatorias', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const categoria = String(req.query.categoria || '').trim();
    const activo = req.query.activo !== undefined ? Number(req.query.activo) : -1;

    let where = 'WHERE 1=1';
    const params = [];

    if (categoria) {
      where += ' AND categoria = ?';
      params.push(categoria);
    }
    if (activo >= 0) {
      where += ' AND activo = ?';
      params.push(activo);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_convocatorias ${where}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(`SELECT * FROM ia_becas_convocatorias ${where} ORDER BY destacada DESC, fecha_publicacion DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [categorias] = await pool.query('SELECT DISTINCT categoria FROM ia_becas_convocatorias ORDER BY categoria');

    return res.json({
      ok: true,
      data: {
        convocatorias: rows || [],
        categorias: categorias?.map(c => c.categoria) || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en convocatorias:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar convocatorias.' });
  }
});

router.post('/convocatorias', authRequired, requireAdmin, async (req, res) => {
  try {
    const { codigo, titulo, institucion, categoria, tipo, url_oficial, descripcion, resumen, requisitos, beneficios, nivel, alcance, vigencia_inicio, vigencia_fin, vigencia_texto, monto, activo, destacada, fecha_publicacion } = req.body;

    if (!codigo || !titulo) {
      return res.status(400).json({ ok: false, message: 'codigo y titulo son obligatorios.' });
    }

    const nombre_usuario = `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador';

    const result = await pool.query(
      `INSERT INTO ia_becas_convocatorias
       (codigo, titulo, institucion, categoria, tipo, url_oficial, descripcion, resumen, requisitos, beneficios,
        nivel, alcance, vigencia_inicio, vigencia_fin, vigencia_texto, monto, activo, destacada, fecha_publicacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo, titulo, institucion || '', categoria || 'Gobierno del Estado de México', tipo || 'OFICIAL',
        url_oficial || '', descripcion || null, resumen || null,
        requisitos ? JSON.stringify(requisitos) : null, beneficios ? JSON.stringify(beneficios) : null,
        nivel ? JSON.stringify(nivel) : null, alcance || 'Estado de México',
        vigencia_inicio || null, vigencia_fin || null, vigencia_texto || 'Consultar convocatoria vigente',
        monto || null, activo !== undefined ? (activo ? 1 : 0) : 1, destacada ? 1 : 0, fecha_publicacion || null
      ]
    );

    await auditLog({
      id_usuario: req.user?.id_usuario, nombre_usuario, rol_usuario: req.user?.rol_nombre || req.user?.rol,
      accion: 'CREAR_CONVOCATORIA', entidad_tipo: 'ia_becas_convocatorias',
      entidad_id: result?.[0]?.insertId || null,
      descripcion: `Convocatoria creada: ${titulo} (${codigo})`,
      detalle_json: { codigo, titulo, institucion, categoria }
    });

    return res.status(201).json({
      ok: true,
      message: `Convocatoria "${titulo}" creada.`,
      data: { id_convocatoria: result?.[0]?.insertId || null }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, message: `El código "${req.body.codigo}" ya existe.` });
    }
    console.error('[iaBecasAdmin] Error al crear convocatoria:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al crear convocatoria.' });
  }
});

router.put('/convocatorias/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    const fields = ['titulo', 'institucion', 'categoria', 'tipo', 'url_oficial', 'descripcion', 'resumen', 'requisitos', 'beneficios', 'nivel', 'alcance', 'vigencia_inicio', 'vigencia_fin', 'vigencia_texto', 'monto', 'activo', 'destacada', 'fecha_publicacion'];
    const updates = [];
    const params = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (['requisitos', 'beneficios', 'nivel'].includes(field)) {
          updates.push(`${field} = ?`);
          params.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, message: 'No hay campos para actualizar.' });
    }

    params.push(id);
    await pool.query(`UPDATE ia_becas_convocatorias SET ${updates.join(', ')} WHERE id_convocatoria = ?`, params);

    await auditLog({
      id_usuario: req.user?.id_usuario,
      nombre_usuario: `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador',
      rol_usuario: req.user?.rol_nombre || req.user?.rol,
      accion: 'ACTUALIZAR_CONVOCATORIA', entidad_tipo: 'ia_becas_convocatorias', entidad_id: id,
      descripcion: `Convocatoria #${id} actualizada`,
      detalle_json: req.body
    });

    return res.json({ ok: true, message: `Convocatoria #${id} actualizada.` });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al actualizar convocatoria:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al actualizar convocatoria.' });
  }
});

// ============================================================
// EXPORTACIONES
// ============================================================
router.get('/exportaciones', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM ia_becas_exportaciones');
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query('SELECT * FROM ia_becas_exportaciones ORDER BY fecha_generacion DESC LIMIT ? OFFSET ?', [limit, offset]);

    return res.json({
      ok: true,
      data: {
        exportaciones: rows || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en exportaciones:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar exportaciones.' });
  }
});

router.post('/exportar', authRequired, requireAdmin, async (req, res) => {
  try {
    const { tipo_reporte, formato, filtros } = req.body;
    if (!tipo_reporte || !formato) {
      return res.status(400).json({ ok: false, message: 'tipo_reporte y formato son obligatorios.' });
    }

    const formatosPermitidos = ['PDF', 'XLSX', 'CSV'];
    if (!formatosPermitidos.includes(formato)) {
      return res.status(400).json({ ok: false, message: `Formato inválido. Permitidos: ${formatosPermitidos.join(', ')}` });
    }

    const tiposPermitidos = ['SOLICITUDES', 'DICTAMENES', 'CONVOCATORIAS', 'AUDITORIA', 'METRICAS', 'GENERAL'];
    if (!tiposPermitidos.includes(tipo_reporte)) {
      return res.status(400).json({ ok: false, message: `Tipo de reporte inválido. Permitidos: ${tiposPermitidos.join(', ')}` });
    }

    let query = '';
    let count = 0;
    const params = [];

    switch (tipo_reporte) {
      case 'SOLICITUDES':
        query = `SELECT s.codigo_solicitud, s.nombre_alumno, s.matricula, s.nombre_carrera, s.semestre_actual, s.promedio_actual, s.estatus_solicitud, s.monto_solicitado, s.fecha_solicitud, s.fecha_resolucion, c.titulo AS convocatoria FROM ia_becas_solicitudes s LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria ORDER BY s.fecha_solicitud DESC`;
        break;
      case 'DICTAMENES':
        query = `SELECT d.tipo_dictamen, d.fundamento, d.monto_asignado, d.fecha_dictamen, d.nombre_dictamina, d.validado_por_ia, s.nombre_alumno, s.matricula, c.titulo AS convocatoria FROM ia_becas_dictamenes d JOIN ia_becas_solicitudes s ON s.id_solicitud = d.id_solicitud LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = d.id_convocatoria ORDER BY d.fecha_dictamen DESC`;
        break;
      case 'CONVOCATORIAS':
        query = `SELECT * FROM ia_becas_convocatorias ORDER BY destacada DESC, fecha_publicacion DESC`;
        break;
      case 'AUDITORIA':
        query = `SELECT * FROM ia_becas_auditoria ORDER BY created_at DESC`;
        break;
      case 'METRICAS':
      case 'GENERAL':
        query = `SELECT * FROM ia_becas_metricas_view LIMIT 1`;
        break;
    }

    if (filtros?.estatus && query.includes('WHERE') === false && tipo_reporte === 'SOLICITUDES') {
      query = query.replace('ORDER BY', 'WHERE s.estatus_solicitud = ? ORDER BY');
      params.push(filtros.estatus);
    }

    if (query) {
      const [dataRows] = await pool.query(query, params);
      count = dataRows.length;

      const exportData = tipo_reporte === 'METRICAS' || tipo_reporte === 'GENERAL'
        ? JSON.stringify(dataRows[0] || {})
        : JSON.stringify(dataRows);

      const nombre_usuario = `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador';

      const result = await pool.query(
        `INSERT INTO ia_becas_exportaciones (id_usuario, nombre_usuario, tipo_reporte, formato, filtros_aplicados, total_registros)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user?.id_usuario, nombre_usuario, tipo_reporte, formato, filtros ? JSON.stringify(filtros) : null, count]
      );

      await auditLog({
        id_usuario: req.user?.id_usuario, nombre_usuario, rol_usuario: req.user?.rol_nombre || req.user?.rol,
        accion: 'EXPORTAR_REPORTE', entidad_tipo: 'ia_becas_exportaciones',
        entidad_id: result?.[0]?.insertId || null,
        descripcion: `Exportación "${tipo_reporte}" en formato ${formato} - ${count} registros`,
        detalle_json: { tipo_reporte, formato, filtros, total_registros: count }
      });

      return res.json({
        ok: true,
        message: `Reporte "${tipo_reporte}" generado en ${formato} con ${count} registros.`,
        data: {
          id_exportacion: result?.[0]?.insertId || null,
          tipo_reporte, formato, total_registros: count,
          registros: tipo_reporte === 'METRICAS' || tipo_reporte === 'GENERAL' ? dataRows[0] || {} : dataRows
        }
      });
    }

    return res.status(400).json({ ok: false, message: 'No se pudo generar el reporte.' });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al exportar:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al exportar reporte.' });
  }
});

// ============================================================
// AUDITORÍA
// ============================================================
router.get('/auditoria', authRequired, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const accion = String(req.query.accion || '').trim();
    const nivel = String(req.query.nivel || '').trim();
    const desde = String(req.query.desde || '').trim();
    const hasta = String(req.query.hasta || '').trim();

    let where = 'WHERE 1=1';
    const params = [];

    if (accion) {
      where += ' AND accion = ?';
      params.push(accion);
    }
    if (nivel) {
      where += ' AND nivel = ?';
      params.push(nivel);
    }
    if (desde) {
      where += ' AND created_at >= ?';
      params.push(desde);
    }
    if (hasta) {
      where += ' AND created_at <= ?';
      params.push(hasta + ' 23:59:59');
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ia_becas_auditoria ${where}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(`SELECT * FROM ia_becas_auditoria ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [acciones] = await pool.query('SELECT DISTINCT accion FROM ia_becas_auditoria ORDER BY accion');
    const [niveles] = await pool.query('SELECT DISTINCT nivel FROM ia_becas_auditoria ORDER BY nivel');

    return res.json({
      ok: true,
      data: {
        auditoria: rows || [],
        acciones: acciones?.map(a => a.accion) || [],
        niveles: niveles?.map(n => n.nivel) || [],
        paginacion: { page, limit, total, total_paginas: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en auditoría:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar auditoría.' });
  }
});

// ============================================================
// VALIDAR CRITERIOS (asistido por IA)
// ============================================================
router.post('/validar-criterios', authRequired, requireAdmin, async (req, res) => {
  try {
    const { id_solicitud } = req.body;
    if (!id_solicitud) {
      return res.status(400).json({ ok: false, message: 'id_solicitud es obligatorio.' });
    }

    const [rows] = await pool.query(`
      SELECT s.*, c.requisitos, c.beneficios, c.nivel, c.titulo AS convocatoria_titulo
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      WHERE s.id_solicitud = ? LIMIT 1
    `, [id_solicitud]);

    if (!rows?.length) {
      return res.status(404).json({ ok: false, message: 'Solicitud no encontrada.' });
    }

    const solicitud = rows[0];
    let requisitos = [];
    try { requisitos = JSON.parse(solicitud.requisitos || '[]'); } catch { requisitos = []; }

    const criterios_validados = requisitos.map((req, index) => {
      const criterio_lower = String(req).toLowerCase();
      let cumple = true;
      let detalle = 'Criterio cumplido';

      if (criterio_lower.includes('promedio mínimo') || criterio_lower.includes('promedio minimo')) {
        const match = criterio_lower.match(/(\d+\.?\d*)/);
        if (match) {
          const min = parseFloat(match[1]);
          cumple = (solicitud.promedio_actual || 0) >= min;
          detalle = cumple ? `Promedio ${solicitud.promedio_actual} >= ${min}` : `Promedio ${solicitud.promedio_actual} < ${min}`;
        }
      }
      if (criterio_lower.includes('créditos') || criterio_lower.includes('creditos')) {
        const match = criterio_lower.match(/(\d+)/);
        if (match) {
          const min = parseInt(match[1]);
          cumple = (solicitud.creditos_acumulados || 0) >= min;
          detalle = cumple ? `Créditos ${solicitud.creditos_acumulados} >= ${min}%` : `Créditos ${solicitud.creditos_acumulados} < ${min}%`;
        }
      }
      if (criterio_lower.includes('regular')) {
        cumple = (solicitud.estatus_academico || '').toUpperCase() === 'REGULAR';
        detalle = cumple ? 'Estatus regular' : `Estatus: ${solicitud.estatus_academico}`;
      }

      return { criterio: req, cumple, detalle, index };
    });

    const total = criterios_validados.length;
    const cumplidos = criterios_validados.filter(c => c.cumple).length;
    const puntuacion = total > 0 ? Math.round((cumplidos / total) * 100) : 0;
    const elegible = puntuacion >= 60;

    const resultado_ia = { total_criterios: total, cumplidos, no_cumplidos: total - cumplidos, puntuacion, elegible, criterios_validados };

    await pool.query(
      `UPDATE ia_becas_solicitudes SET criterios_validados = ? WHERE id_solicitud = ?`,
      [JSON.stringify(resultado_ia), id_solicitud]
    );

    await auditLog({
      id_usuario: req.user?.id_usuario,
      nombre_usuario: `${req.user?.nombres || ''} ${req.user?.apellido_paterno || ''}`.trim() || req.user?.nombre_completo || 'Administrador',
      rol_usuario: req.user?.rol_nombre || req.user?.rol,
      accion: 'VALIDAR_CRITERIOS', entidad_tipo: 'ia_becas_solicitudes', entidad_id: id_solicitud,
      descripcion: `Validación de criterios para solicitud #${id_solicitud}: ${cumplidos}/${total} cumplidos (${puntuacion}%)`,
      detalle_json: resultado_ia
    });

    return res.json({
      ok: true,
      message: `Validación completada: ${cumplidos}/${total} criterios cumplidos (${puntuacion}%).`,
      data: resultado_ia
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error al validar criterios:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al validar criterios.' });
  }
});

// ============================================================
// INDICADORES GLOBALES
// ============================================================
router.get('/indicadores', authRequired, requireAdmin, async (req, res) => {
  try {
    const [metricas] = await pool.query('SELECT * FROM ia_becas_metricas_view LIMIT 1');
    const [porCarrera] = await pool.query(`
      SELECT s.nombre_carrera, COUNT(*) AS total_solicitudes,
             SUM(CASE WHEN s.estatus_solicitud = 'APROBADA' THEN 1 ELSE 0 END) AS aprobadas,
             SUM(CASE WHEN s.estatus_solicitud = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
             AVG(s.promedio_actual) AS promedio_grupo
      FROM ia_becas_solicitudes s
      WHERE s.nombre_carrera IS NOT NULL AND s.nombre_carrera != ''
      GROUP BY s.nombre_carrera ORDER BY total_solicitudes DESC
    `);
    const [porPeriodo] = await pool.query(`
      SELECT s.periodo_nombre, COUNT(*) AS total_solicitudes,
             SUM(CASE WHEN s.estatus_solicitud = 'APROBADA' THEN 1 ELSE 0 END) AS aprobadas,
             SUM(CASE WHEN s.estatus_solicitud = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas
      FROM ia_becas_solicitudes s
      WHERE s.periodo_nombre IS NOT NULL AND s.periodo_nombre != ''
      GROUP BY s.periodo_nombre ORDER BY s.periodo_nombre DESC
    `);
    const [porConvocatoria] = await pool.query(`
      SELECT c.titulo, c.institucion, COUNT(s.id_solicitud) AS total_solicitudes,
             SUM(CASE WHEN s.estatus_solicitud = 'APROBADA' THEN 1 ELSE 0 END) AS aprobadas
      FROM ia_becas_convocatorias c
      LEFT JOIN ia_becas_solicitudes s ON s.id_convocatoria = c.id_convocatoria
      GROUP BY c.id_convocatoria ORDER BY total_solicitudes DESC
    `);

    return res.json({
      ok: true,
      data: {
        metricas: metricas?.[0] || {},
        desglose_por_carrera: porCarrera || [],
        desglose_por_periodo: porPeriodo || [],
        desglose_por_convocatoria: porConvocatoria || []
      }
    });
  } catch (error) {
    console.error('[iaBecasAdmin] Error en indicadores:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar indicadores.' });
  }
});

module.exports = router;
