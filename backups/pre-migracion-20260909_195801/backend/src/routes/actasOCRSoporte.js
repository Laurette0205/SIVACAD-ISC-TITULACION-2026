const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    const token = auth.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

router.get('/panel', authFromHeader, async (req, res) => {
  try {
    const [[stats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_cargas,
        SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN estado IN ('RECIBIDA','EXTRACCION_PENDIENTE') THEN 1 ELSE 0 END) AS por_procesar,
        SUM(CASE WHEN estado = 'VALIDACION_PENDIENTE' THEN 1 ELSE 0 END) AS pendientes_validacion,
        SUM(CASE WHEN confianza_global < 50 AND confianza_global > 0 THEN 1 ELSE 0 END) AS baja_confianza,
        COUNT(DISTINCT id_docente) AS docentes_con_actas,
        COUNT(DISTINCT id_grupo) AS grupos_con_actas,
        MAX(created_at) AS ultima_carga,
        AVG(NULLIF(confianza_global, 0)) AS confianza_promedio
      FROM actas_ocr_cargas
    `);

    const [[erroresRecientes]] = await pool.execute(`
      SELECT COUNT(*) AS total FROM actas_ocr_auditoria
      WHERE accion IN ('EXTRACCION_OCR','VALIDACION_RECHAZADA','RECHAZO_ADMIN')
        AND creado_en >= NOW() - INTERVAL 7 DAY
    `);

    const [formatos] = await pool.execute(`
      SELECT mime_type, COUNT(*) AS total
      FROM actas_ocr_cargas GROUP BY mime_type ORDER BY total DESC
    `);

    return res.json({ ok: true, data: {
      resumen: {
        total_cargas: Number(stats?.total_cargas || 0),
        rechazadas: Number(stats?.rechazadas || 0),
        por_procesar: Number(stats?.por_procesar || 0),
        pendientes_validacion: Number(stats?.pendientes_validacion || 0),
        baja_confianza: Number(stats?.baja_confianza || 0),
        docentes_con_actas: Number(stats?.docentes_con_actas || 0),
        grupos_con_actas: Number(stats?.grupos_con_actas || 0),
        confianza_promedio: Number(stats?.confianza_promedio || 0),
        ultima_carga: stats?.ultima_carga || null,
        errores_recientes_7d: Number(erroresRecientes?.total || 0)
      },
      formatos: formatos
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar panel técnico.' });
  }
});

router.get('/incidencias', authFromHeader, async (req, res) => {
  try {
    const [cargasProblema] = await pool.execute(`
      SELECT c.id_carga_ocr, c.nombre_archivo, c.mime_type, c.estado, c.confianza_global,
        c.firma_detectada, c.created_at, c.updated_at,
        p.nombre_plantilla, per.nombre_periodo, g.nombre_grupo, m.nombre_materia,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario
      FROM actas_ocr_cargas c
      INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga
      WHERE c.estado IN ('RECHAZADA','RECIBIDA','EXTRACCION_PENDIENTE')
         OR (c.estado = 'VALIDACION_PENDIENTE' AND c.confianza_global < 50)
      ORDER BY GREATEST(c.created_at, COALESCE(c.updated_at, c.created_at)) DESC
      LIMIT 50
    `);

    const [erroresAuditoria] = await pool.execute(`
      SELECT a.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario,
        c.nombre_archivo
      FROM actas_ocr_auditoria a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN actas_ocr_cargas c ON c.id_carga_ocr = a.id_carga_ocr
      WHERE a.accion IN ('EXTRACCION_OCR','VALIDACION_RECHAZADA','RECHAZO_ADMIN','CONFIG_UPDATE')
      ORDER BY a.creado_en DESC LIMIT 30
    `);

    return res.json({ ok: true, data: {
      cargas_problema: cargasProblema,
      errores_auditoria: erroresAuditoria.map(r => ({ ...r, detalle: safeJsonParse(r.detalle, null) }))
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar incidencias.' });
  }
});

router.get('/archivos', authFromHeader, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT c.id_carga_ocr, c.nombre_archivo, c.mime_type, c.storage_path,
        c.estado, c.confianza_global, c.firma_detectada, c.created_at, c.updated_at,
        c.observaciones_revision,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_carga
      FROM actas_ocr_cargas c
      INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      ORDER BY c.id_carga_ocr DESC LIMIT 100
    `);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar archivos.' });
  }
});

router.get('/archivos/:id', authFromHeader, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT c.*, p.nombre_plantilla, p.codigo_plantilla,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_carga
      FROM actas_ocr_cargas c
      INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga
      WHERE c.id_carga_ocr = ? LIMIT 1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ ok: false, message: 'Archivo no encontrado.' });

    const [auditoria] = await pool.execute(`
      SELECT a.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario
      FROM actas_ocr_auditoria a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.id_carga_ocr = ?
      ORDER BY a.creado_en ASC
    `, [req.params.id]);

    const [detalles] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr = ?`, [req.params.id]);

    return res.json({ ok: true, data: {
      ...rows[0],
      json_resultado: safeJsonParse(rows[0].json_resultado, null),
      detalles,
      auditoria: auditoria.map(r => ({ ...r, detalle: safeJsonParse(r.detalle, null) }))
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al obtener archivo.' });
  }
});

router.get('/recuperacion', authFromHeader, async (req, res) => {
  try {
    const [atascadas] = await pool.execute(`
      SELECT c.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_carga
      FROM actas_ocr_cargas c
      INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga
      WHERE c.estado IN ('RECIBIDA', 'EXTRACCION_PENDIENTE')
        AND c.created_at < NOW() - INTERVAL 1 HOUR
      ORDER BY c.created_at ASC LIMIT 20
    `);

    const [reintentos] = await pool.execute(`
      SELECT accion, COUNT(*) AS total, MAX(creado_en) AS ultimo
      FROM actas_ocr_auditoria
      WHERE creado_en >= NOW() - INTERVAL 7 DAY
      GROUP BY accion ORDER BY total DESC
    `);

    const [estadoTiempo] = await pool.execute(`
      SELECT estado, COUNT(*) AS total,
        MIN(created_at) AS mas_antiguo,
        MAX(created_at) AS mas_reciente,
        TIMESTAMPDIFF(HOUR, MIN(created_at), NOW()) AS horas_espera_max
      FROM actas_ocr_cargas
      WHERE estado IN ('RECIBIDA','EXTRACCION_PENDIENTE','VALIDACION_PENDIENTE')
      GROUP BY estado
    `);

    return res.json({ ok: true, data: {
      cargas_atascadas: atascadas,
      reintentos_por_accion: reintentos,
      estado_tiempo: estadoTiempo
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar datos de recuperación.' });
  }
});

router.post('/recuperacion/reintentar/:id', authFromHeader, async (req, res) => {
  try {
    const cargaId = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT id_carga_ocr, estado FROM actas_ocr_cargas WHERE id_carga_ocr = ? LIMIT 1`, [cargaId]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Carga no encontrada.' });

    const userId = Number(req.user?.id_usuario || req.user?.id || 0) || 1;

    await pool.execute(
      `UPDATE actas_ocr_cargas SET estado = 'EXTRACCION_PENDIENTE', updated_at = NOW(), observaciones_revision = 'Reintento de proceso asignado por soporte.' WHERE id_carga_ocr = ?`,
      [cargaId]
    );
    await pool.execute(
      `INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'REINTENTO_SOPORTE', ?, NOW())`,
      [cargaId, userId, JSON.stringify({ estado_anterior: rows[0].estado, accion: 'reintento_asignado' })]
    );

    return res.json({ ok: true, message: 'Reintento asignado. La carga volverá a procesarse.' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al reintentar.' });
  }
});

router.get('/monitoreo', authFromHeader, async (req, res) => {
  try {
    const [porEstado] = await pool.execute(`
      SELECT estado, COUNT(*) AS total FROM actas_ocr_cargas GROUP BY estado ORDER BY total DESC
    `);

    const [porDia] = await pool.execute(`
      SELECT DATE(created_at) AS fecha, COUNT(*) AS total,
        SUM(CASE WHEN estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas
      FROM actas_ocr_cargas
      WHERE created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY DATE(created_at) ORDER BY fecha DESC LIMIT 30
    `);

    const [porDocente] = await pool.execute(`
      SELECT CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS docente,
        COUNT(c.id_carga_ocr) AS total_cargas,
        SUM(CASE WHEN c.estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        AVG(NULLIF(c.confianza_global, 0)) AS confianza_promedio
      FROM actas_ocr_cargas c
      INNER JOIN docentes d ON d.id_docente = c.id_docente
      INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
      GROUP BY d.id_docente, u.nombres, u.apellido_paterno, u.apellido_materno
      ORDER BY total_cargas DESC LIMIT 20
    `);

    const [configActual] = await pool.execute(`SELECT clave, valor FROM actas_ocr_configuracion ORDER BY clave ASC`);

    const [[geminiStatus]] = await pool.execute(`
      SELECT COUNT(*) AS usos_gemini,
        MAX(creado_en) AS ultimo_uso
      FROM actas_ocr_auditoria
      WHERE accion = 'EXTRACCION_OCR' AND creado_en >= NOW() - INTERVAL 7 DAY
    `);

    return res.json({ ok: true, data: {
      por_estado: porEstado,
      por_dia: porDia,
      por_docente: porDocente,
      configuracion: configActual,
      gemini: {
        usos_7d: Number(geminiStatus?.usos_gemini || 0),
        ultimo_uso: geminiStatus?.ultimo_uso || null
      },
      total_cargas: porEstado.reduce((sum, r) => sum + Number(r.total), 0)
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar monitoreo.' });
  }
});

module.exports = router;
