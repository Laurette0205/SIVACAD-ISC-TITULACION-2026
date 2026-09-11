'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth: verifyToken } = require('../middleware/auth');

function sendError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

function normalizeUpper(value) {
  return String(value || '').trim().toUpperCase();
}

function getRoleName(user) {
  return normalizeUpper(user?.rol_nombre || user?.rol || user?.role);
}

function getRoleId(user) {
  return Number(user?.rol_id || user?.id_rol || user?.role_id || 0);
}

function isSoporte(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);
  return roleName === 'SOPORTE' || roleId === 5;
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return sendError(res, 401, 'Token no disponible');
  return verifyToken(req, res, next);
}

router.use(authFromHeader);

router.get('/diagnostico', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isSoporte(req.user)) return sendError(res, 403, 'Acceso exclusivo para soporte t\u00e9cnico.');

    const [dbCheck] = await conn.execute('SELECT 1 AS ok');
    const dbStatus = dbCheck.length ? 'CONECTADA' : 'FALLO';

    const [tablas] = await conn.execute(`
      SELECT TABLE_NAME AS tabla, TABLE_ROWS AS filas, 
        ROUND(DATA_LENGTH / 1024, 1) AS tamano_kb
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME LIKE 'evaluacion%'
      ORDER BY TABLE_NAME
    `);

    const [auditCount] = await conn.execute('SELECT COUNT(*) AS total FROM evaluacion_auditoria');
    const [alertCount] = await conn.execute('SELECT COUNT(*) AS total FROM evaluacion_alertas');
    const [evalCount] = await conn.execute('SELECT COUNT(*) AS total FROM evaluaciones');
    const [resultCount] = await conn.execute('SELECT COUNT(*) AS total FROM evaluacion_resultados');
    const [respCount] = await conn.execute('SELECT COUNT(*) AS total FROM respuestas_evaluacion');

    const [accionesRecientes] = await conn.execute(`
      SELECT a.id_auditoria, a.accion, a.detalle, a.creado_en,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario,
        COALESCE(r.nombre_rol, '—') AS rol_usuario
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      ORDER BY a.creado_en DESC
      LIMIT 30
    `);

    const [alertasRecientes] = await conn.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.descripcion, a.nivel, a.atendida, a.creado_en,
        e.titulo AS evaluacion_titulo
      FROM evaluacion_alertas a
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      ORDER BY a.creado_en DESC
      LIMIT 20
    `);

    const [estadosEval] = await conn.execute(`
      SELECT UPPER(estado) AS estado, COUNT(*) AS total
      FROM evaluaciones GROUP BY UPPER(estado) ORDER BY estado
    `);

    return res.json({
      ok: true,
      data: {
        db: { estado: dbStatus, timestamp: new Date().toISOString() },
        tablas: tablas,
        conteos: {
          evaluaciones: evalCount[0]?.total || 0,
          resultados: resultCount[0]?.total || 0,
          respuestas: respCount[0]?.total || 0,
          auditoria: auditCount[0]?.total || 0,
          alertas: alertCount[0]?.total || 0
        },
        estados_evaluacion: estadosEval,
        accesos_recientes: accionesRecientes,
        alertas_recientes: alertasRecientes
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-soporte/diagnostico:', error);
    return sendError(res, 500, error.message || 'Error al ejecutar diagn\u00f3stico');
  } finally { conn.release(); }
});

router.get('/incidencias', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isSoporte(req.user)) return sendError(res, 403, 'Acceso exclusivo para soporte t\u00e9cnico.');

    const horas = Math.min(Math.max(Number(req.query?.horas || 72), 1), 720);

    const [erroresRecientes] = await conn.execute(`
      SELECT a.id_auditoria, a.accion, a.detalle, a.observaciones, a.creado_en, a.ip,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario,
        COALESCE(r.nombre_rol, '—') AS rol_usuario,
        e.titulo AS evaluacion_titulo
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      WHERE a.creado_en >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY a.creado_en DESC
      LIMIT 100
    `, [horas]);

    const [sinResultados] = await conn.execute(`
      SELECT e.id_evaluacion, e.titulo, UPPER(e.estado) AS estado,
        e.fecha_fin, e.creado_en,
        (SELECT COUNT(*) FROM evaluacion_resultados WHERE id_evaluacion = e.id_evaluacion) AS total_resultados
      FROM evaluaciones e
      WHERE (SELECT COUNT(*) FROM evaluacion_resultados WHERE id_evaluacion = e.id_evaluacion) = 0
        AND UPPER(e.estado) != 'BORRADOR'
      ORDER BY e.creado_en DESC
      LIMIT 30
    `);

    const [alertasAltas] = await conn.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.descripcion, a.nivel, a.atendida, a.creado_en,
        e.titulo AS evaluacion_titulo
      FROM evaluacion_alertas a
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      WHERE a.nivel = 'ALTO' AND a.atendida = 0
      ORDER BY a.creado_en DESC
      LIMIT 30
    `);

    return res.json({
      ok: true,
      data: {
        periodo_horas: horas,
        total_errores: erroresRecientes.length,
        total_sin_resultados: sinResultados.length,
        total_alertas_criticas: alertasAltas.length,
        errores: erroresRecientes,
        evaluaciones_sin_resultados: sinResultados,
        alertas_criticas: alertasAltas
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-soporte/incidencias:', error);
    return sendError(res, 500, error.message || 'Error al cargar incidencias');
  } finally { conn.release(); }
});

router.get('/errores-validacion', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isSoporte(req.user)) return sendError(res, 403, 'Acceso exclusivo para soporte t\u00e9cnico.');

    const [erroresValidacion] = await conn.execute(`
      SELECT a.id_auditoria, a.accion, a.detalle, a.observaciones, a.creado_en, a.ip,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario,
        COALESCE(r.nombre_rol, '—') AS rol_usuario,
        e.titulo AS evaluacion_titulo
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      WHERE a.accion IN ('ERROR', 'VALIDAR', 'RECHAZAR', 'CANCELAR')
        AND a.creado_en >= DATE_SUB(NOW(), INTERVAL 168 HOUR)
      ORDER BY a.creado_en DESC
      LIMIT 100
    `, []);

    const [resultadosRechazados] = await conn.execute(`
      SELECT r.id_resultado, r.id_evaluacion, r.promedio_final, r.observacion_general,
        r.estado_validacion, r.creado_en, r.validado_en,
        e.titulo AS evaluacion_titulo, p.nombre_periodo
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      WHERE r.estado_validacion = 'RECHAZADO'
      ORDER BY r.validado_en DESC
      LIMIT 50
    `);

    return res.json({
      ok: true,
      data: {
        total_errores_validacion: erroresValidacion.length,
        total_resultados_rechazados: resultadosRechazados.length,
        errores_validacion: erroresValidacion,
        resultados_rechazados: resultadosRechazados
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-soporte/errores-validacion:', error);
    return sendError(res, 500, error.message || 'Error al cargar errores de validaci\u00f3n');
  } finally { conn.release(); }
});

router.get('/registros', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isSoporte(req.user)) return sendError(res, 403, 'Acceso exclusivo para soporte t\u00e9cnico.');

    const limite = Math.min(Math.max(Number(req.query?.limite || 100), 10), 500);
    const accion = req.query?.accion ? normalizeUpper(req.query.accion) : null;
    const idEval = req.query?.id_evaluacion ? Number(req.query.id_evaluacion) : 0;

    const where = [];
    const params = [];
    if (accion) { where.push('a.accion = ?'); params.push(accion); }
    if (idEval) { where.push('a.id_evaluacion = ?'); params.push(idEval); }

    const [rows] = await conn.execute(`
      SELECT a.id_auditoria, a.id_evaluacion, a.accion, a.detalle, a.observaciones,
        a.ip, a.creado_en,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario,
        COALESCE(r.nombre_rol, '—') AS rol_usuario,
        e.titulo AS evaluacion_titulo
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.creado_en DESC
      LIMIT ?
    `, [...params, limite]);

    const [accionesDisponibles] = await conn.execute(`
      SELECT DISTINCT accion FROM evaluacion_auditoria ORDER BY accion
    `);

    const [totalRegistros] = await conn.execute('SELECT COUNT(*) AS total FROM evaluacion_auditoria');
    const [periodo] = await conn.execute(`
      SELECT MIN(creado_en) AS mas_antiguo, MAX(creado_en) AS mas_reciente 
      FROM evaluacion_auditoria
    `);

    return res.json({
      ok: true,
      data: {
        registros: rows,
        total: totalRegistros[0]?.total || 0,
        filtros: {
          acciones: accionesDisponibles.map(r => r.accion),
          periodo: periodo[0] || null
        },
        limite: limite
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-soporte/registros:', error);
    return sendError(res, 500, error.message || 'Error al cargar registros de auditor\u00eda');
  } finally { conn.release(); }
});

router.get('/verificar-rutas', async (req, res) => {
  try {
    if (!isSoporte(req.user)) return sendError(res, 403, 'Acceso exclusivo para soporte t\u00e9cnico.');

    const rutas = [
      { ruta: '/evaluaciones', metodo: 'GET', descripcion: 'Listar evaluaciones' },
      { ruta: '/evaluaciones/catalogos', metodo: 'GET', descripcion: 'Cat\u00e1logos' },
      { ruta: '/evaluaciones/resumen', metodo: 'GET', descripcion: 'Resumen' },
      { ruta: '/evaluaciones/seguimiento', metodo: 'GET', descripcion: 'Seguimiento global' },
      { ruta: '/evaluaciones/resultados', metodo: 'GET', descripcion: 'Resultados' },
      { ruta: '/evaluaciones/auditoria', metodo: 'GET', descripcion: 'Auditor\u00eda global' },
      { ruta: '/evaluaciones/grupos', metodo: 'GET', descripcion: 'Evaluaciones por grupo' },
      { ruta: '/evaluaciones/seguimiento/grupos', metodo: 'GET', descripcion: 'Seguimiento por grupo' },
      { ruta: '/evaluaciones/alertas', metodo: 'GET', descripcion: 'Alertas' },
      { ruta: '/evaluaciones/resultados/parciales', metodo: 'GET', descripcion: 'Resultados parciales' },
      { ruta: '/evaluaciones-alumno/mis-evaluaciones', metodo: 'GET', descripcion: 'Mis evaluaciones (alumno)' },
      { ruta: '/evaluaciones-alumno/respondidas', metodo: 'GET', descripcion: 'Respondidas (alumno)' },
      { ruta: '/evaluaciones-docente/resultados', metodo: 'GET', descripcion: 'Resultados (docente)' },
      { ruta: '/evaluaciones-docente/evolucion', metodo: 'GET', descripcion: 'Evoluci\u00f3n (docente)' },
      { ruta: '/evaluaciones-soporte/diagnostico', metodo: 'GET', descripcion: 'Diagn\u00f3stico t\u00e9cnico' },
      { ruta: '/evaluaciones-soporte/incidencias', metodo: 'GET', descripcion: 'Incidencias' },
      { ruta: '/evaluaciones-soporte/errores-validacion', metodo: 'GET', descripcion: 'Errores de validaci\u00f3n' },
      { ruta: '/evaluaciones-soporte/registros', metodo: 'GET', descripcion: 'Registros de auditor\u00eda' }
    ];

    const resultados = await Promise.allSettled(
      rutas.map(async (r) => {
        try {
          const http = require('http');
          const baseUrl = `${req.protocol}://${req.get('host')}/api`;
          return new Promise(resolve => {
            http.get(`${baseUrl}${r.ruta}`, { headers: { Authorization: req.headers.authorization, timeout: 5000 } }, (res) => {
              let data = '';
              res.on('data', c => data += c);
              res.on('end', () => {
                try {
                  const json = JSON.parse(data);
                  resolve({ ...r, status: res.statusCode, ok: json?.ok === true });
                } catch {
                  resolve({ ...r, status: res.statusCode, ok: false });
                }
              });
            }).on('error', (err) => resolve({ ...r, status: 0, ok: false, error: err.message }));
          });
        } catch {
          return { ...r, status: 0, ok: false, error: 'Error de conexi\u00f3n' };
        }
      })
    );

    const verificaciones = resultados.map(r => r.status === 'fulfilled' ? r.value : { ...r, status: 0, ok: false });

    return res.json({
      ok: true,
      data: {
        verificaciones,
        total: verificaciones.length,
        operativas: verificaciones.filter(v => v.ok).length,
        fallando: verificaciones.filter(v => !v.ok).length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-soporte/verificar-rutas:', error);
    return sendError(res, 500, error.message || 'Error al verificar rutas');
  }
});

module.exports = router;
