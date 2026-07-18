'use strict';

const pool = require('../config/db');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function registrarLog(accion, detalle, id_usuario, ip) {
  try {
    await pool.execute(
      `INSERT INTO ia_auditoria_desercion (accion, detalle, id_usuario, creado_en)
       VALUES (?, ?, ?, NOW())`,
      ['BIENESTAR_SOPORTE_' + accion, detalle, id_usuario || null]
    );
  } catch (_) {}
}

// ── 1. ESTADO DEL SERVICIO ──
async function estadoServicio(req, res) {
  try {
    const checks = await Promise.allSettled([
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_alertas'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_derivaciones'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_checkins'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_sesiones'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_mensajes'),
      pool.execute(
        `SELECT COUNT(*) AS pendientes FROM ia_bienestar_alertas WHERE estado = 'PENDIENTE'`
      ),
      pool.execute(
        `SELECT nivel_riesgo, COUNT(*) AS total FROM ia_bienestar_alertas GROUP BY nivel_riesgo`
      ),
      pool.execute(
        `SELECT MIN(creado_en) AS primera, MAX(creado_en) AS ultima FROM ia_bienestar_alertas`
      )
    ]);

    const alertasOk = checks[0].status === 'fulfilled';
    const derivacionesOk = checks[1].status === 'fulfilled';
    const checkinsOk = checks[2].status === 'fulfilled';
    const sesionesOk = checks[3].status === 'fulfilled';
    const mensajesOk = checks[4].status === 'fulfilled';

    const totalAlertas = alertasOk ? checks[0].value[0][0]?.total || 0 : 0;
    const totalDerivaciones = derivacionesOk ? checks[1].value[0][0]?.total || 0 : 0;
    const totalCheckins = checkinsOk ? checks[2].value[0][0]?.total || 0 : 0;
    const totalSesiones = sesionesOk ? checks[3].value[0][0]?.total || 0 : 0;
    const totalMensajes = mensajesOk ? checks[4].value[0][0]?.total || 0 : 0;
    const pendientes = checks[5].status === 'fulfilled' ? checks[5].value[0][0]?.pendientes || 0 : 0;

    const distribucionRiesgo = checks[6].status === 'fulfilled'
      ? checks[6].value[0].reduce((acc, r) => { acc[r.nivel_riesgo] = r.total; return acc; }, {})
      : {};

    const rangoFechas = checks[7].status === 'fulfilled'
      ? { primera: checks[7].value[0][0]?.primera, ultima: checks[7].value[0][0]?.ultima }
      : {};

    const todasOk = alertasOk && derivacionesOk && checkinsOk && sesionesOk && mensajesOk;

    return res.json({
      ok: true,
      data: {
        estado: todasOk ? 'operativo' : 'fallo_parcial',
        tablas: {
          ia_bienestar_alertas: { ok: alertasOk, registros: totalAlertas },
          ia_bienestar_derivaciones: { ok: derivacionesOk, registros: totalDerivaciones },
          ia_bienestar_checkins: { ok: checkinsOk, registros: totalCheckins },
          ia_bienestar_sesiones: { ok: sesionesOk, registros: totalSesiones },
          ia_bienestar_mensajes: { ok: mensajesOk, registros: totalMensajes }
        },
        metricas: {
          alertas_pendientes: pendientes,
          alertas_atendidas: totalAlertas - pendientes,
          total_derivaciones: totalDerivaciones,
          total_checkins: totalCheckins,
          total_sesiones: totalSesiones,
          total_mensajes: totalMensajes,
          distribucion_riesgo: distribucionRiesgo,
          rango_fechas: rangoFechas
        }
      }
    });
  } catch (error) {
    console.error('Error en estado del servicio bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar estado del servicio' });
  }
}

// ── 2. BITÁCORA (auditoría) ──
async function bitacora(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(*) AS total FROM ia_auditoria_desercion
      WHERE accion LIKE 'BIENESTAR_%' OR accion LIKE 'SOPORTE_%'
    `);
    const total = countRes.total;

    const [rows] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.correo_institucional
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.accion LIKE 'BIENESTAR_%' OR a.accion LIKE 'SOPORTE_%'
      ORDER BY a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error al obtener bitácora:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener bitácora' });
  }
}

// ── 3. ERRORES / INCIDENCIAS TÉCNICAS ──
async function errores(req, res) {
  try {
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    const [alertasCriticas] = await pool.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.nivel_riesgo, a.descripcion,
        a.accion_sugerida, a.estado, a.requiere_derivacion, a.creado_en,
        u.id_usuario, u.nombres, u.apellido_paterno, u.correo_institucional AS email
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.nivel_riesgo IN ('Alto','Crítico') OR a.requiere_derivacion = 1
      ORDER BY a.nivel_riesgo DESC, a.creado_en DESC
      LIMIT ?
    `, [limite]);

    const [[statsRow]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_criticas,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN requiere_derivacion = 1 THEN 1 ELSE 0 END) AS requieren_derivacion
      FROM ia_bienestar_alertas
      WHERE nivel_riesgo IN ('Alto','Crítico')
    `);

    return res.json({
      ok: true,
      data: alertasCriticas,
      stats: {
        total_criticas: Number(statsRow?.total_criticas || 0),
        pendientes: Number(statsRow?.pendientes || 0),
        requieren_derivacion: Number(statsRow?.requieren_derivacion || 0)
      },
      total: alertasCriticas.length
    });
  } catch (error) {
    console.error('Error al obtener errores bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias técnicas' });
  }
}

// ── 4. CONECTIVIDAD / ESTADO BD ──
async function conectividad(req, res) {
  try {
    const dbStart = Date.now();
    await pool.execute('SELECT 1 AS ping');
    const dbLatency = Date.now() - dbStart;

    const [tablasEsperadas] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = (SELECT DATABASE())
        AND TABLE_NAME LIKE 'ia_bienestar_%'
      ORDER BY TABLE_NAME
    `);

    return res.json({
      ok: true,
      data: {
        base_datos: {
          estado: 'conectado',
          latencia_ms: dbLatency,
          timestamp: new Date().toISOString()
        },
        tablas: tablasEsperadas.map(t => ({
          nombre: t.TABLE_NAME,
          registros: t.TABLE_ROWS,
          creada: t.CREATE_TIME,
          actualizada: t.UPDATE_TIME
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error de conectividad con la base de datos',
      error: error.message
    });
  }
}

// ── 5. INTEGRIDAD DEL MÓDULO ──
async function integridad(req, res) {
  try {
    const tablasRequeridas = [
      'ia_bienestar_alertas',
      'ia_bienestar_derivaciones',
      'ia_bienestar_checkins',
      'ia_bienestar_sesiones',
      'ia_bienestar_mensajes',
      'ia_bienestar_plantillas',
      'ia_bienestar_plantilla_preguntas',
      'ia_bienestar_recursos'
    ];

    const [tablasExistentes] = await pool.execute(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = (SELECT DATABASE())
        AND TABLE_NAME IN (${tablasRequeridas.map(() => '?').join(',')})
    `, tablasRequeridas);
    const existentes = new Set(tablasExistentes.map(t => t.TABLE_NAME));
    const faltantes = tablasRequeridas.filter(t => !existentes.has(t));

    const [columnas] = await pool.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = (SELECT DATABASE())
        AND TABLE_NAME IN (${tablasRequeridas.map(() => '?').join(',')})
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `, tablasRequeridas);
    const columnasPorTabla = {};
    for (const c of columnas) {
      if (!columnasPorTabla[c.TABLE_NAME]) columnasPorTabla[c.TABLE_NAME] = [];
      columnasPorTabla[c.TABLE_NAME].push({
        columna: c.COLUMN_NAME,
        tipo: c.DATA_TYPE,
        nullable: c.IS_NULLABLE === 'YES',
        llave: c.COLUMN_KEY || null,
        defecto: c.COLUMN_DEFAULT
      });
    }

    const [dbInfo] = await pool.execute('SELECT DATABASE() AS db');
    const [version] = await pool.execute('SELECT VERSION() AS version');

    return res.json({
      ok: true,
      data: {
        integro: faltantes.length === 0,
        tablas_requeridas: tablasRequeridas,
        tablas_existentes: Array.from(existentes),
        tablas_faltantes: faltantes,
        estructura: columnasPorTabla,
        base_datos: dbInfo[0]?.db,
        version_sql: version[0]?.version,
        verificado_en: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error al verificar integridad bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar integridad' });
  }
}

// ── 6. EXPORTACIONES ──
async function exportarDatos(req, res) {
  try {
    const { tipo = 'alertas', formato = 'json' } = req.query;
    const format = formato.toLowerCase() === 'csv' ? 'csv' : 'json';

    let rows;
    let nombreArchivo;

    if (tipo === 'alertas') {
      [rows] = await pool.execute(`
        SELECT a.id_alerta, a.tipo_alerta, a.nivel_riesgo, a.descripcion,
          a.accion_sugerida, a.estado, a.requiere_derivacion, a.creado_en,
          u.nombres, u.apellido_paterno, u.correo_institucional AS email
        FROM ia_bienestar_alertas a
        INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
        ORDER BY a.creado_en DESC
        LIMIT 1000
      `);
      nombreArchivo = 'bienestar_alertas';
    } else if (tipo === 'derivaciones') {
      [rows] = await pool.execute(`
        SELECT d.id_derivacion, d.destino, d.motivo, d.estado, d.observaciones,
          d.creado_en, a.nivel_riesgo, a.tipo_alerta,
          u.nombres, u.apellido_paterno, u.correo_institucional AS email
        FROM ia_bienestar_derivaciones d
        INNER JOIN ia_bienestar_alertas a ON a.id_alerta = d.id_alerta
        INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
        ORDER BY d.creado_en DESC
        LIMIT 1000
      `);
      nombreArchivo = 'bienestar_derivaciones';
    } else if (tipo === 'checkins') {
      [rows] = await pool.execute(`
        SELECT c.id_checkin, c.codigo_plantilla, c.bienestar_score, c.indice_riesgo,
          c.nivel_riesgo, c.animo, c.energia, c.sueno, c.estres,
          c.apoyo, c.ambiente, c.carga_academica, c.carga_laboral, c.enfoque,
          c.creado_en, u.correo_institucional AS email
        FROM ia_bienestar_checkins c
        INNER JOIN usuarios u ON u.id_usuario = c.id_usuario
        ORDER BY c.creado_en DESC
        LIMIT 1000
      `);
      nombreArchivo = 'bienestar_checkins';
    } else {
      return res.status(400).json({ ok: false, message: 'Tipo de exportación no válido' });
    }

    await registrarLog('EXPORTAR_' + tipo.toUpperCase(),
      `Exportación de ${tipo} en formato ${format} (${rows.length} registros)`,
      req.user?.id_usuario, req.ip);

    if (format === 'csv') {
      const headers = Object.keys(rows[0] || {}).join(',');
      const csvRows = rows.map(r => Object.values(r).map(v =>
        v === null || v === undefined ? '' : String(v).replace(/","/g, '""')
      ).join(','));
      const csv = [headers, ...csvRows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}_${Date.now()}.csv"`);
      return res.send('\uFEFF' + csv);
    }

    return res.json({
      ok: true,
      data: rows,
      total: rows.length,
      tipo,
      formato: format,
      exportado_en: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al exportar datos bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar datos' });
  }
}

// ── 7. SALUD DE MÓDULOS / VERIFICACIÓN COMPLETA ──
async function saludModulos(req, res) {
  try {
    const checks = await Promise.allSettled([
      // BD
      (async () => {
        try { const start = Date.now(); await pool.execute('SELECT 1'); return { ok: true, latencia_ms: Date.now() - start }; }
        catch (e) { return { ok: false, error: e.message }; }
      })(),
      // Tablas
      (async () => {
        try {
          const [t] = await pool.execute(`SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME LIKE 'ia_bienestar_%'`);
          return { ok: true, tablas: t.map(r => r.TABLE_NAME), total: t.length };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      // Alertas críticas
      (async () => {
        try {
          const [r] = await pool.execute(
            `SELECT COUNT(*) AS total FROM ia_bienestar_alertas WHERE nivel_riesgo IN ('Alto','Crítico') AND estado = 'PENDIENTE'`);
          return { ok: true, criticas_pendientes: r[0].total };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      // Sesiones activas
      (async () => {
        try {
          const [r] = await pool.execute(
            `SELECT COUNT(*) AS total FROM ia_bienestar_sesiones WHERE estado = 'ACTIVA'`);
          return { ok: true, sesiones_activas: r[0].total };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      // Checkins recientes (últimas 24h)
      (async () => {
        try {
          const [r] = await pool.execute(
            `SELECT COUNT(*) AS total FROM ia_bienestar_checkins WHERE creado_en >= NOW() - INTERVAL 24 HOUR`);
          return { ok: true, checkins_24h: r[0].total };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      // Flask API check
      (async () => {
        try {
          const http = require('http');
          return new Promise(resolve => {
            const req = http.get('http://localhost:5001/health', { timeout: 3000 }, (res) => {
              let data = '';
              res.on('data', c => data += c);
              res.on('end', () => {
                try { const j = JSON.parse(data); resolve({ ok: true, modelos: j.modelos_cargados }); }
                catch { resolve({ ok: true, raw: data }); }
              });
            });
            req.on('error', () => resolve({ ok: false, error: 'Flask no disponible' }));
            req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
          });
        } catch (e) { return { ok: false, error: e.message }; }
      })()
    ]);

    const fallos = checks.filter(r => r.status === 'fulfilled' && !r.value.ok).length;
    const estadoGeneral = fallos === 0 ? 'operativo' : fallos <= 2 ? 'fallo_parcial' : 'critico';

    await registrarLog('SALUD_MODULOS',
      `Verificación completa de salud: ${estadoGeneral}, ${fallos} fallo(s)`,
      req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        estado: estadoGeneral,
        timestamp: new Date().toISOString(),
        modulos: {
          base_datos: checks[0].status === 'fulfilled' ? checks[0].value : { ok: false, error: 'Error de ejecución' },
          tablas: checks[1].status === 'fulfilled' ? checks[1].value : { ok: false, error: 'Error de ejecución' },
          alertas_criticas: checks[2].status === 'fulfilled' ? checks[2].value : { ok: false, error: 'Error de ejecución' },
          sesiones: checks[3].status === 'fulfilled' ? checks[3].value : { ok: false, error: 'Error de ejecución' },
          checkins_recientes: checks[4].status === 'fulfilled' ? checks[4].value : { ok: false, error: 'Error de ejecución' },
          flask_api: checks[5].status === 'fulfilled' ? checks[5].value : { ok: false, error: 'Error de ejecución' }
        },
        resumen: {
          total_modulos: 6,
          operativos: 6 - fallos,
          fallos
        }
      }
    });
  } catch (error) {
    console.error('Error en salud de módulos:', error);
    return res.status(500).json({ ok: false, message: 'Error en verificación de salud' });
  }
}

// ── 8. MONITOREO DE RUTAS ──
async function monitoreoRutas(req, res) {
  try {
    const backendDir = path.resolve(__dirname, '..');
    const routesDir = path.join(backendDir, 'routes');
    const controllersDir = path.join(backendDir, 'controllers');
    const mlDir = path.join(backendDir, '..', 'ml');

    const archivosBienestar = [];
    if (fs.existsSync(routesDir)) {
      const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js') && f.toLowerCase().includes('bienestar'));
      for (const f of files) {
        const fullPath = path.join(routesDir, f);
        archivosBienestar.push({ archivo: f, peso: fs.statSync(fullPath).size, modificado: fs.statSync(fullPath).mtime });
      }
    }

    const archivosController = [];
    if (fs.existsSync(controllersDir)) {
      const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js') && f.toLowerCase().includes('bienestar'));
      for (const f of files) {
        const fullPath = path.join(controllersDir, f);
        archivosController.push({ archivo: f, peso: fs.statSync(fullPath).size, modificado: fs.statSync(fullPath).mtime });
      }
    }

    const archivosML = [];
    if (fs.existsSync(mlDir)) {
      try {
        const files = fs.readdirSync(mlDir);
        for (const f of files) {
          const fullPath = path.join(mlDir, f);
          const stat = fs.statSync(fullPath);
          archivosML.push({ archivo: f, peso: stat.size, modificado: stat.mtime, esDirectorio: stat.isDirectory() });
        }
      } catch (_) {}
    }

    const indexContent = fs.readFileSync(path.join(routesDir, 'index.js'), 'utf8');
    const lineasBienestar = indexContent.split('\n')
      .filter(l => l.includes('bienestar'))
      .map(l => l.trim());

    return res.json({
      ok: true,
      data: {
        rutas_montadas: lineasBienestar,
        archivos_ruta: archivosBienestar,
        archivos_controller: archivosController,
        archivos_ml: archivosML,
        total_rutas: lineasBienestar.length,
        total_archivos_ruta: archivosBienestar.length,
        total_archivos_controller: archivosController.length,
        total_archivos_ml: archivosML.length
      }
    });
  } catch (error) {
    console.error('Error en monitoreo de rutas:', error);
    return res.status(500).json({ ok: false, message: 'Error al monitorear rutas' });
  }
}

module.exports = {
  estadoServicio,
  bitacora,
  errores,
  conectividad,
  integridad,
  exportarDatos,
  saludModulos,
  monitoreoRutas
};
