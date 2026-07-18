'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const ROLES_SOPORTE = ['ADMINISTRADOR', 'SOPORTE'];

function roleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
}
function roleId(user) {
  return Number(user?.rol_id || user?.id_rol || 0);
}
function esSoporte(user) {
  const rn = roleName(user), ri = roleId(user);
  return rn === 'SOPORTE' || ri === 5;
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    const rn = roleName(req.user);
    if (!ROLES_SOPORTE.includes(rn) && ![1, 5].includes(roleId(req.user))) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ═══════════════════════════════════════════
// 1. ESTADO DEL SERVICIO
// ═══════════════════════════════════════════
router.get('/soporte-becas/estado', authRequired, async (req, res) => {
  try {
    const tablas = ['ia_becas_solicitudes', 'ia_becas_convocatorias', 'ia_becas_dictamenes',
      'ia_becas_observaciones', 'ia_becas_canalizaciones', 'ia_becas_auditoria',
      'ia_becas_exportaciones', 'ia_becas_documentos'];
    const estadoTablas = {};

    for (const t of tablas) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
        estadoTablas[t] = { existe: true, registros: rows[0].cnt };
      } catch {
        estadoTablas[t] = { existe: false, registros: 0 };
      }
    }

    let dbStatus = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    const [vistas] = await pool.query(`
      SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'ia_becas_%' AND TABLE_TYPE = 'VIEW'
    `, [process.env.DB_NAME || 'sivacad_isc']);

    return res.json({
      ok: true,
      data: {
        db: dbStatus,
        timestamp: new Date().toISOString(),
        tablas: estadoTablas,
        vistas: vistas || [],
        total_tablas: Object.keys(estadoTablas).length,
        total_registros: Object.values(estadoTablas).reduce((a, b) => a + b.registros, 0)
      }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] estado error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 2. LOGS / AUDITORÍA
// ═══════════════════════════════════════════
router.get('/soporte-becas/logs', authRequired, async (req, res) => {
  try {
    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(100, Math.max(1, toNum(req.query.limite, 25)));
    const offset = (pagina - 1) * limite;
    const filtro = String(req.query.busqueda || '').trim();
    const nivel = String(req.query.nivel || '').trim().toUpperCase();

    let where = [];
    let params = [];

    if (filtro) {
      where.push('(a.descripcion LIKE ? OR a.nombre_usuario LIKE ? OR a.accion LIKE ?)');
      params.push(`%${filtro}%`, `%${filtro}%`, `%${filtro}%`);
    }
    if (nivel && ['INFO', 'WARNING', 'ERROR', 'CRITICAL'].includes(nivel)) {
      where.push('a.nivel = ?');
      params.push(nivel);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ia_becas_auditoria a ${whereClause}`, params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT a.id_auditoria, a.id_usuario, a.nombre_usuario, a.rol_usuario,
              a.accion, a.entidad_tipo, a.entidad_id, a.descripcion, a.detalle_json,
              a.nivel, a.created_at
       FROM ia_becas_auditoria a ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] logs error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 3. ERRORES / INCIDENCIAS
// ═══════════════════════════════════════════
router.get('/soporte-becas/errores', authRequired, async (req, res) => {
  try {
    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(100, Math.max(1, toNum(req.query.limite, 25)));
    const offset = (pagina - 1) * limite;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ia_becas_auditoria
       WHERE nivel IN ('ERROR','CRITICAL')`
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT id_auditoria, id_usuario, nombre_usuario, rol_usuario, accion,
              entidad_tipo, entidad_id, descripcion, detalle_json, nivel, created_at
       FROM ia_becas_auditoria
       WHERE nivel IN ('ERROR','CRITICAL')
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limite, offset]
    );

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] errores error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 4. CONECTIVIDAD / DIAGNÓSTICO DB
// ═══════════════════════════════════════════
router.get('/soporte-becas/conectividad', authRequired, async (req, res) => {
  try {
    const inicio = Date.now();
    await pool.query('SELECT 1');
    const latencia = Date.now() - inicio;

    const [tablas] = await pool.query(
      `SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'ia_becas_%'`,
      [process.env.DB_NAME || 'sivacad_isc']
    );

    return res.json({
      ok: true,
      data: {
        db: 'conectado',
        latencia_ms: latencia,
        timestamp: new Date().toISOString(),
        tablas_becas: tablas || [],
        total_tablas: tablas?.length || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error de conexión: ' + (error?.message || 'desconocido') });
  }
});

// ═══════════════════════════════════════════
// 5. INTEGRIDAD (validar tablas y columnas)
// ═══════════════════════════════════════════
router.get('/soporte-becas/integridad', authRequired, async (req, res) => {
  try {
    const requeridas = {
      ia_becas_solicitudes: ['id_solicitud', 'codigo_solicitud', 'id_alumno', 'estatus_solicitud', 'fecha_solicitud'],
      ia_becas_convocatorias: ['id_convocatoria', 'titulo', 'categoria', 'activo'],
      ia_becas_dictamenes: ['id_dictamen', 'id_solicitud', 'tipo_dictamen'],
      ia_becas_observaciones: ['id_observacion', 'id_solicitud', 'observacion', 'tipo_observacion'],
      ia_becas_canalizaciones: ['id_canalizacion', 'id_solicitud', 'area_destino'],
      ia_becas_auditoria: ['id_auditoria', 'accion', 'nivel', 'created_at'],
      ia_becas_exportaciones: ['id_exportacion', 'tipo_reporte', 'formato'],
      ia_becas_documentos: ['id_documento', 'id_solicitud']
    };

    const resultados = [];
    let totalFaltantes = 0;

    for (const [tabla, columnas] of Object.entries(requeridas)) {
      try {
        const [cols] = await pool.query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [process.env.DB_NAME || 'sivacad_isc', tabla]
        );
        const existentes = new Set(cols.map(c => c.COLUMN_NAME));
        const faltantes = columnas.filter(c => !existentes.has(c));

        if (faltantes.length) totalFaltantes += faltantes.length;

        resultados.push({
          tabla,
          existe: cols.length > 0,
          columnas_requeridas: columnas.length,
          columnas_existentes: cols.length,
          columnas_faltantes: faltantes,
          estado: faltantes.length === 0 ? 'OK' : 'INCOMPLETO'
        });
      } catch {
        resultados.push({ tabla, existe: false, estado: 'AUSENTE' });
        totalFaltantes += columnas.length;
      }
    }

    return res.json({
      ok: true,
      data: {
        tablas: resultados,
        resumen: {
          total_tablas: resultados.length,
          tablas_ok: resultados.filter(r => r.estado === 'OK').length,
          tablas_incompletas: resultados.filter(r => r.estado === 'INCOMPLETO').length,
          tablas_ausentes: resultados.filter(r => r.estado === 'AUSENTE').length,
          columnas_faltantes: totalFaltantes
        }
      }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] integridad error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 6. EXPORTACIONES (historial)
// ═══════════════════════════════════════════
router.get('/soporte-becas/exportaciones', authRequired, async (req, res) => {
  try {
    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(100, Math.max(1, toNum(req.query.limite, 25)));
    const offset = (pagina - 1) * limite;

    const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM ia_becas_exportaciones');
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT id_exportacion, id_usuario, nombre_usuario, tipo_reporte, formato,
              filtros_aplicados, total_registros, ruta_archivo, tamano_bytes, fecha_generacion
       FROM ia_becas_exportaciones
       ORDER BY fecha_generacion DESC
       LIMIT ? OFFSET ?`,
      [limite, offset]
    );

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] exportaciones error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 7. VERIFICACIÓN COMPLETA DEL MÓDULO
// ═══════════════════════════════════════════
router.post('/soporte-becas/verificar', authRequired, async (req, res) => {
  try {
    const resultados = [];

    try {
      await pool.query('SELECT 1');
      resultados.push({ prueba: 'Conexión DB', estado: 'OK', detalle: 'Base de datos responde correctamente' });
    } catch (e) {
      resultados.push({ prueba: 'Conexión DB', estado: 'ERROR', detalle: e.message });
    }

    const tablas = ['ia_becas_solicitudes', 'ia_becas_convocatorias', 'ia_becas_dictamenes',
      'ia_becas_observaciones', 'ia_becas_canalizaciones', 'ia_becas_auditoria',
      'ia_becas_exportaciones', 'ia_becas_documentos'];

    for (const t of tablas) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
        resultados.push({ prueba: `Tabla ${t}`, estado: 'OK', detalle: `${rows[0].cnt} registros` });
      } catch {
        resultados.push({ prueba: `Tabla ${t}`, estado: 'AUSENTE', detalle: 'La tabla no existe o no es accesible' });
      }
    }

    try {
      const [views] = await pool.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'ia_becas_%' AND TABLE_TYPE = 'VIEW'`,
        [process.env.DB_NAME || 'sivacad_isc']
      );
      if (views?.length) {
        resultados.push({ prueba: 'Vistas del módulo', estado: 'OK', detalle: `${views.length} vistas encontradas` });
      } else {
        resultados.push({ prueba: 'Vistas del módulo', estado: 'SIN_DATOS', detalle: 'No se encontraron vistas' });
      }
    } catch {
      resultados.push({ prueba: 'Vistas del módulo', estado: 'ERROR', detalle: 'Error al consultar vistas' });
    }

    const erroresRecientes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM ia_becas_auditoria WHERE nivel IN ('ERROR','CRITICAL') AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    resultados.push({
      prueba: 'Errores 24h',
      estado: erroresRecientes[0][0].cnt === 0 ? 'OK' : 'ALERTA',
      detalle: `${erroresRecientes[0][0].cnt} errores/críticos en las últimas 24 horas`
    });

    return res.json({
      ok: true,
      data: {
        verificaciones: resultados,
        resumen: {
          total: resultados.length,
          ok: resultados.filter(r => r.estado === 'OK').length,
          alertas: resultados.filter(r => r.estado === 'ALERTA' || r.estado === 'SIN_DATOS').length,
          errores: resultados.filter(r => r.estado === 'ERROR' || r.estado === 'AUSENTE').length,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] verificar error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

// ═══════════════════════════════════════════
// 8. RUTAS Y ARCHIVOS DEL MÓDULO
// ═══════════════════════════════════════════
router.get('/soporte-becas/rutas', authRequired, async (req, res) => {
  try {
    const baseBackend = path.join(__dirname);
    const baseFrontend = path.join(__dirname, '..', '..', '..', 'frontend', 'src');

    const archivosBackend = [];
    const archivosFrontend = [];

    for (const file of fs.readdirSync(baseBackend)) {
      if (file.startsWith('iaBecas') || file.startsWith('ia_becas')) {
        archivosBackend.push(file);
      }
    }

    const controllersDir = path.join(baseBackend, '..', 'controllers');
    if (fs.existsSync(controllersDir)) {
      for (const file of fs.readdirSync(controllersDir)) {
        if (file.startsWith('iaBecas')) {
          archivosBackend.push(`controllers/${file}`);
        }
      }
    }

    const pagesDir = path.join(baseFrontend, 'pages');
    if (fs.existsSync(pagesDir)) {
      for (const file of fs.readdirSync(pagesDir)) {
        if (file.startsWith('IABecas')) {
          archivosFrontend.push(`pages/${file}`);
        }
      }
    }

    const servicesDir = path.join(baseFrontend, 'services');
    if (fs.existsSync(servicesDir)) {
      for (const file of fs.readdirSync(servicesDir)) {
        if (file === 'api.js') {
          archivosFrontend.push('services/api.js');
        }
      }
    }

    return res.json({
      ok: true,
      data: {
        backend: archivosBackend.sort(),
        frontend: archivosFrontend.sort(),
        backend_path: baseBackend,
        frontend_path: baseFrontend
      }
    });
  } catch (error) {
    console.error('[iaBecasSoporte] rutas error:', error);
    return res.status(500).json({ ok: false, message: error?.message });
  }
});

module.exports = router;
