const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const service = require('../services/actasOCRService');
const router = express.Router();

function authCoord(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    const token = auth.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rol = String(decoded.rol || decoded.rol_nombre || '').toUpperCase();
    if (rol !== 'COORDINADOR' && rol !== 'ADMINISTRADOR' && Number(decoded.rol_id) !== 2 && Number(decoded.rol_id) !== 1) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para coordinadores.' });
    }
    req.user = decoded;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

router.get('/panel', authCoord, async (req, res) => {
  try {
    const [[totales]] = await pool.execute(`
      SELECT COUNT(*) AS total_cargas,
        SUM(CASE WHEN estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN estado IN ('RECIBIDA','EXTRACCION_PENDIENTE','VALIDACION_PENDIENTE') THEN 1 ELSE 0 END) AS pendientes,
        AVG(NULLIF(confianza_global, 0)) AS confianza_promedio,
        MAX(updated_at) AS ultima_revision
      FROM actas_ocr_cargas
    `);
    const [[importados]] = await pool.execute(`SELECT COUNT(*) AS total FROM actas_calificaciones_detalle`).catch(() => [[{ total: 0 }]]);
    const [grupos] = await pool.execute(`SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.semestre, c.nombre_carrera FROM actas_ocr_cargas oc INNER JOIN grupos g ON g.id_grupo = oc.id_grupo INNER JOIN carreras c ON c.id_carrera = g.id_carrera ORDER BY g.nombre_grupo`);
    const [periodos] = await pool.execute(`SELECT DISTINCT p.id_periodo, p.nombre_periodo FROM actas_ocr_cargas oc INNER JOIN periodos p ON p.id_periodo = oc.id_periodo ORDER BY p.id_periodo DESC`);
    return res.json({
      ok: true, data: {
        resumen: {
          total_cargas: Number(totales?.total_cargas || 0),
          validadas: Number(totales?.validadas || 0),
          rechazadas: Number(totales?.rechazadas || 0),
          pendientes: Number(totales?.pendientes || 0),
          confianza_promedio: Number(totales?.confianza_promedio || 0),
          ultima_revision: totales?.ultima_revision || null,
          total_detalles_importados: Number(importados?.total || 0)
        },
        grupos_disponibles: grupos,
        periodos_disponibles: periodos
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar panel.' });
  }
});

router.get('/catalogos', authCoord, async (req, res) => {
  try {
    const catalogos = await service.getCatalogos();
    return res.json({ ok: true, catalogos });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar catálogos.' });
  }
});

router.get('/actas-grupo', authCoord, async (req, res) => {
  try {
    const idGrupo = req.query.id_grupo ? Number(req.query.id_grupo) : null;
    let sql = `SELECT c.*, p.nombre_plantilla, p.codigo_plantilla, per.nombre_periodo, g.nombre_grupo, g.semestre, m.nombre_materia, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr LEFT JOIN periodos per ON per.id_periodo = c.id_periodo LEFT JOIN grupos g ON g.id_grupo = c.id_grupo LEFT JOIN materias m ON m.id_materia = c.id_materia INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga`;
    const params = [];
    if (idGrupo) { sql += ` WHERE c.id_grupo = ?`; params.push(idGrupo); }
    sql += ` ORDER BY c.id_carga_ocr DESC LIMIT 100`;
    const [rows] = await pool.execute(sql, params);
    const ids = rows.map(r => r.id_carga_ocr);
    const detailsMap = new Map();
    if (ids.length) {
      const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr IN (${ids.map(() => '?').join(',')}) ORDER BY id_detalle_ocr ASC`, ids);
      details.forEach(d => { if (!detailsMap.has(d.id_carga_ocr)) detailsMap.set(d.id_carga_ocr, []); detailsMap.get(d.id_carga_ocr).push(d); });
    }
    const data = rows.map(row => ({ ...row, json_resultado: safeJsonParse(row.json_resultado, null), detalles: detailsMap.get(row.id_carga_ocr) || [] }));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar actas por grupo.' });
  }
});

router.get('/actas-periodo', authCoord, async (req, res) => {
  try {
    const idPeriodo = req.query.id_periodo ? Number(req.query.id_periodo) : null;
    let sql = `SELECT c.*, p.nombre_plantilla, p.codigo_plantilla, per.nombre_periodo, g.nombre_grupo, g.semestre, m.nombre_materia, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr LEFT JOIN periodos per ON per.id_periodo = c.id_periodo LEFT JOIN grupos g ON g.id_grupo = c.id_grupo LEFT JOIN materias m ON m.id_materia = c.id_materia INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga`;
    const params = [];
    if (idPeriodo) { sql += ` WHERE c.id_periodo = ?`; params.push(idPeriodo); }
    sql += ` ORDER BY c.id_carga_ocr DESC LIMIT 100`;
    const [rows] = await pool.execute(sql, params);
    const ids = rows.map(r => r.id_carga_ocr);
    const detailsMap = new Map();
    if (ids.length) {
      const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr IN (${ids.map(() => '?').join(',')}) ORDER BY id_detalle_ocr ASC`, ids);
      details.forEach(d => { if (!detailsMap.has(d.id_carga_ocr)) detailsMap.set(d.id_carga_ocr, []); detailsMap.get(d.id_carga_ocr).push(d); });
    }
    const data = rows.map(row => ({ ...row, json_resultado: safeJsonParse(row.json_resultado, null), detalles: detailsMap.get(row.id_carga_ocr) || [] }));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar actas por periodo.' });
  }
});

router.get('/actas-semestre', authCoord, async (req, res) => {
  try {
    const semestre = req.query.semestre ? Number(req.query.semestre) : null;
    let sql = `SELECT c.*, p.nombre_plantilla, p.codigo_plantilla, per.nombre_periodo, g.nombre_grupo, g.semestre, m.nombre_materia, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr LEFT JOIN periodos per ON per.id_periodo = c.id_periodo INNER JOIN grupos g ON g.id_grupo = c.id_grupo LEFT JOIN materias m ON m.id_materia = c.id_materia INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga`;
    const params = [];
    if (semestre) { sql += ` WHERE g.semestre = ?`; params.push(semestre); }
    sql += ` ORDER BY g.semestre ASC, g.nombre_grupo ASC, c.id_carga_ocr DESC LIMIT 100`;
    const [rows] = await pool.execute(sql, params);
    const ids = rows.map(r => r.id_carga_ocr);
    const detailsMap = new Map();
    if (ids.length) {
      const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr IN (${ids.map(() => '?').join(',')}) ORDER BY id_detalle_ocr ASC`, ids);
      details.forEach(d => { if (!detailsMap.has(d.id_carga_ocr)) detailsMap.set(d.id_carga_ocr, []); detailsMap.get(d.id_carga_ocr).push(d); });
    }
    const data = rows.map(row => ({ ...row, json_resultado: safeJsonParse(row.json_resultado, null), detalles: detailsMap.get(row.id_carga_ocr) || [] }));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar actas por semestre.' });
  }
});

router.get('/actas/:id', authCoord, async (req, res) => {
  try {
    const data = await service.getCargaById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'La carga no existe.' });
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al obtener acta.' });
  }
});

router.post('/actas/:id/validar', authCoord, async (req, res) => {
  try {
    const userId = service.pickUserId(req);
    const result = await service.validarCarga(req.params.id, userId);
    return res.json({ ok: true, message: result.resultado === 'APROBADA' ? 'Acta validada correctamente.' : 'Acta con observaciones.', data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al validar.' });
  }
});

router.get('/reportes', authCoord, async (req, res) => {
  try {
    const [porPeriodo] = await pool.execute(`
      SELECT per.id_periodo, per.nombre_periodo,
        COUNT(c.id_carga_ocr) AS total_cargas,
        SUM(CASE WHEN c.estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN c.estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
        AVG(NULLIF(c.confianza_global, 0)) AS confianza_promedio,
        SUM(CASE WHEN c.estado IN ('RECIBIDA','EXTRACCION_PENDIENTE','VALIDACION_PENDIENTE') THEN 1 ELSE 0 END) AS pendientes
      FROM actas_ocr_cargas c
      INNER JOIN periodos per ON per.id_periodo = c.id_periodo
      GROUP BY per.id_periodo, per.nombre_periodo
      ORDER BY per.id_periodo DESC
    `);
    const [porGrupo] = await pool.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, car.nombre_carrera,
        COUNT(c.id_carga_ocr) AS total_cargas,
        SUM(CASE WHEN c.estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        AVG(NULLIF(c.confianza_global, 0)) AS confianza_promedio
      FROM actas_ocr_cargas c
      INNER JOIN grupos g ON g.id_grupo = c.id_grupo
      INNER JOIN carreras car ON car.id_carrera = g.id_carrera
      GROUP BY g.id_grupo, g.nombre_grupo, g.semestre, car.nombre_carrera
      ORDER BY g.semestre ASC, g.nombre_grupo ASC
    `);
    const [porSemestre] = await pool.execute(`
      SELECT g.semestre,
        COUNT(c.id_carga_ocr) AS total_cargas,
        SUM(CASE WHEN c.estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN c.estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
        AVG(NULLIF(c.confianza_global, 0)) AS confianza_promedio,
        COUNT(DISTINCT c.id_grupo) AS grupos_con_actas
      FROM actas_ocr_cargas c
      INNER JOIN grupos g ON g.id_grupo = c.id_grupo
      GROUP BY g.semestre
      ORDER BY g.semestre ASC
    `);
    const [recientes] = await pool.execute(`
      SELECT c.id_carga_ocr, c.nombre_archivo, c.estado, c.confianza_global, c.created_at,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia
      FROM actas_ocr_cargas c
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      ORDER BY c.id_carga_ocr DESC LIMIT 20
    `);
    return res.json({ ok: true, data: { porPeriodo, porGrupo, porSemestre, recientes } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al generar reportes.' });
  }
});

module.exports = router;
