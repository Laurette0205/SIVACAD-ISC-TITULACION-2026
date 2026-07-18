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
      ['SOPORTE_' + accion, detalle, id_usuario || null]
    );
  } catch (_) {}
}

// ── 1. ESTADO DEL SERVICIO ──
async function estadoServicio(req, res) {
  try {
    const checks = await Promise.allSettled([
      pool.execute('SELECT COUNT(*) AS total FROM ia_alertas_desercion'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_seguimientos_desercion'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_auditoria_desercion'),
      pool.execute(
        `SELECT COUNT(*) AS pendientes FROM ia_alertas_desercion WHERE atendida = 0`
      ),
      pool.execute(
        `SELECT nivel_riesgo, COUNT(*) AS total FROM ia_alertas_desercion
         GROUP BY nivel_riesgo`
      ),
      pool.execute(
        `SELECT MIN(creado_en) AS primera, MAX(creado_en) AS ultima FROM ia_alertas_desercion`
      )
    ]);

    const alertasOk = checks[0].status === 'fulfilled';
    const seguimientosOk = checks[1].status === 'fulfilled';
    const auditoriaOk = checks[2].status === 'fulfilled';

    const totalAlertas = alertasOk ? checks[0].value[0][0]?.total || 0 : 0;
    const totalSeguimientos = seguimientosOk ? checks[1].value[0][0]?.total || 0 : 0;
    const totalAuditoria = auditoriaOk ? checks[2].value[0][0]?.total || 0 : 0;
    const pendientes = checks[3].status === 'fulfilled' ? checks[3].value[0][0]?.pendientes || 0 : 0;

    const distribucionRiesgo = checks[4].status === 'fulfilled'
      ? checks[4].value[0].reduce((acc, r) => {
          acc[r.nivel_riesgo] = r.total;
          return acc;
        }, {})
      : {};

    const rangoFechas = checks[5].status === 'fulfilled'
      ? { primera: checks[5].value[0][0]?.primera, ultima: checks[5].value[0][0]?.ultima }
      : {};

    return res.json({
      ok: true,
      data: {
        estado: (alertasOk && seguimientosOk && auditoriaOk) ? 'operativo' : 'fallo_parcial',
        tablas: {
          ia_alertas_desercion: { ok: alertasOk, registros: totalAlertas },
          ia_seguimientos_desercion: { ok: seguimientosOk, registros: totalSeguimientos },
          ia_auditoria_desercion: { ok: auditoriaOk, registros: totalAuditoria }
        },
        metricas: {
          alertas_pendientes: pendientes,
          alertas_atendidas: totalAlertas - pendientes,
          distribucion_riesgo: distribucionRiesgo,
          rango_fechas: rangoFechas
        }
      }
    });
  } catch (error) {
    console.error('Error en estado del servicio:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar estado del servicio' });
  }
}

// ── 2. LOGS / AUDITORÍA ──
async function logs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [[countRes]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM ia_auditoria_desercion'
    );
    const total = countRes.total;

    const [rows] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.correo_institucional
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      ORDER BY a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error al obtener logs:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener logs' });
  }
}

// ── 3. ERRORES / INCIDENCIAS ──
async function errores(req, res) {
  try {
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    const [alertas] = await pool.execute(`
      SELECT ia.id_alerta, ia.id_alumno, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.descripcion, ia.creado_en, ia.estado_seguimiento, ia.atendida,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON a.id_alumno = ia.id_alumno
      WHERE ia.puntaje_riesgo >= 80 OR ia.nivel_riesgo IN ('Crítico', 'Critico')
      ORDER BY ia.puntaje_riesgo DESC, ia.creado_en DESC
      LIMIT ?
    `, [limite]);

    return res.json({
      ok: true,
      data: alertas,
      total: alertas.length,
      tipo: 'alertas_criticas'
    });
  } catch (error) {
    console.error('Error al obtener errores:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  }
}

// ── 4. CONECTIVIDAD ──
async function conectividad(req, res) {
  try {
    const dbStart = Date.now();
    await pool.execute('SELECT 1 AS ping');
    const dbLatency = Date.now() - dbStart;

    const [tablasEsperadas] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = (SELECT DATABASE())
        AND TABLE_NAME LIKE 'ia_%'
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
      'ia_alertas_desercion',
      'ia_seguimientos_desercion',
      'ia_auditoria_desercion'
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
    console.error('Error al verificar integridad:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar integridad' });
  }
}

// ── 6. VERIFICACIÓN COMPLETA ──
async function verificacionCompleta(req, res) {
  try {
    const [servicio, conect, integ, errs] = await Promise.all([
      (async () => {
        try {
          const [a] = await pool.execute('SELECT COUNT(*) AS t FROM ia_alertas_desercion');
          const [s] = await pool.execute('SELECT COUNT(*) AS t FROM ia_seguimientos_desercion');
          const [ad] = await pool.execute('SELECT COUNT(*) AS t FROM ia_auditoria_desercion');
          return { ok: true, alertas: a[0].t, seguimientos: s[0].t, auditoria: ad[0].t };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        try {
          const start = Date.now();
          await pool.execute('SELECT 1');
          return { ok: true, latencia_ms: Date.now() - start };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        try {
          const [t] = await pool.execute(`SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME LIKE 'ia_%'`);
          return { ok: true, tablas: t.map(r => r.TABLE_NAME) };
        } catch (e) { return { ok: false, error: e.message }; }
      })(),
      (async () => {
        try {
          const [alertas] = await pool.execute(`
            SELECT COUNT(*) AS total FROM ia_alertas_desercion
            WHERE puntaje_riesgo >= 80`);
          return { ok: true, criticas: alertas[0].total };
        } catch (e) { return { ok: false, error: e.message }; }
      })()
    ]);

    const fallos = [servicio, conect, integ, errs].filter(r => !r.ok).length;
    const estadoGeneral = fallos === 0 ? 'operativo' : fallos < 3 ? 'fallo_parcial' : 'critico';

    await registrarLog('VERIFICACION_COMPLETA',
      `Verificación completa: ${estadoGeneral}, ${fallos} fallo(s)`,
      req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        estado: estadoGeneral,
        timestamp: new Date().toISOString(),
        modulos: {
          servicio,
          conectividad: conect,
          integridad: integ,
          errores: errs
        }
      }
    });
  } catch (error) {
    console.error('Error en verificación completa:', error);
    return res.status(500).json({ ok: false, message: 'Error en verificación completa' });
  }
}

// ── 7. RUTAS DEL MÓDULO ──
async function rutasModulo(req, res) {
  try {
    const backendDir = path.resolve(__dirname, '..');
    const routesDir = path.join(backendDir, 'routes');
    const controllersDir = path.join(backendDir, 'controllers');

    const archivosRuta = [];
    if (fs.existsSync(routesDir)) {
      const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
      for (const f of files) {
        const fullPath = path.join(routesDir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('ia') || content.includes('desercion') || content.includes('Desercion')) {
          archivosRuta.push({ archivo: f, peso: fs.statSync(fullPath).size });
        }
      }
    }

    const archivosController = [];
    if (fs.existsSync(controllersDir)) {
      const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
      for (const f of files) {
        const fullPath = path.join(controllersDir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('ia_') || content.includes('desercion') || content.includes('alerta')) {
          archivosController.push({ archivo: f, peso: fs.statSync(fullPath).size });
        }
      }
    }

    const indexContent = fs.readFileSync(path.join(routesDir, 'index.js'), 'utf8');
    const lineasIA = indexContent.split('\n')
      .filter(l => l.includes('iaDesercion') || l.includes('ia/desercion'))
      .map(l => l.trim());

    return res.json({
      ok: true,
      data: {
        rutas: lineasIA,
        archivos_ruta: archivosRuta,
        archivos_controller: archivosController,
        total_rutas: lineasIA.length,
        total_archivos_ruta: archivosRuta.length,
        total_archivos_controller: archivosController.length
      }
    });
  } catch (error) {
    console.error('Error al listar rutas:', error);
    return res.status(500).json({ ok: false, message: 'Error al consultar rutas' });
  }
}

module.exports = {
  estadoServicio,
  logs,
  errores,
  conectividad,
  integridad,
  verificacionCompleta,
  rutasModulo
};
