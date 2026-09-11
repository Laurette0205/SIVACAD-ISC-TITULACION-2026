const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const service = require('../services/actasOCRService');
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

async function resolveDocenteId(idUsuario) {
  const [rows] = await pool.execute('SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1', [idUsuario]);
  return rows.length ? rows[0] : null;
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

router.get('/panel', authFromHeader, async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const [grupos] = await pool.execute(`
      SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, m.id_materia, m.nombre_materia,
        per.id_periodo, per.nombre_periodo
      FROM cargas_academicas ca
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      INNER JOIN periodos per ON per.id_periodo = ca.id_periodo
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
      ORDER BY per.id_periodo DESC, g.nombre_grupo ASC
    `, [docente.id_docente]);

    const [[stats]] = await pool.execute(`
      SELECT COUNT(*) AS total_mis_actas,
        SUM(CASE WHEN c.estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN c.estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN c.estado IN ('RECIBIDA','EXTRACCION_PENDIENTE','VALIDACION_PENDIENTE') THEN 1 ELSE 0 END) AS pendientes,
        AVG(NULLIF(c.confianza_global, 0)) AS confianza_promedio
      FROM actas_ocr_cargas c
      WHERE c.id_docente = ?
    `, [docente.id_docente]);

    return res.json({ ok: true, data: {
      docente: { id_docente: docente.id_docente, clave_docente: docente.clave_docente },
      grupos_asignados: grupos,
      stats: {
        total_mis_actas: Number(stats?.total_mis_actas || 0),
        validadas: Number(stats?.validadas || 0),
        rechazadas: Number(stats?.rechazadas || 0),
        pendientes: Number(stats?.pendientes || 0),
        confianza_promedio: Number(stats?.confianza_promedio || 0),
        total_grupos: grupos.length
      }
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar panel docente OCR.' });
  }
});

router.get('/mis-grupos', authFromHeader, async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const [rows] = await pool.execute(`
      SELECT ca.id_carga_academica, g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        m.id_materia, m.nombre_materia, m.clave_materia,
        per.id_periodo, per.nombre_periodo, per.estado AS estado_periodo,
        (SELECT COUNT(*) FROM grupos_alumnos ga WHERE ga.id_grupo = g.id_grupo AND ga.id_periodo = per.id_periodo AND ga.estado = 'ACTIVO') AS total_alumnos
      FROM cargas_academicas ca
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      INNER JOIN periodos per ON per.id_periodo = ca.id_periodo
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
      ORDER BY per.id_periodo DESC, g.nombre_grupo ASC, m.nombre_materia ASC
    `, [docente.id_docente]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar grupos del docente.' });
  }
});

router.get('/mis-actas', authFromHeader, async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const [rows] = await pool.execute(`
      SELECT c.*, p.nombre_plantilla, p.codigo_plantilla,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia
      FROM actas_ocr_cargas c
      INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      WHERE c.id_docente = ?
      ORDER BY c.id_carga_ocr DESC LIMIT 50
    `, [docente.id_docente]);

    const ids = rows.map(r => r.id_carga_ocr);
    const detailsMap = new Map();
    if (ids.length) {
      const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr IN (${ids.map(() => '?').join(',')}) ORDER BY id_detalle_ocr ASC`, ids);
      details.forEach(d => { if (!detailsMap.has(d.id_carga_ocr)) detailsMap.set(d.id_carga_ocr, []); detailsMap.get(d.id_carga_ocr).push(d); });
    }
    const data = rows.map(row => ({ ...row, json_resultado: safeJsonParse(row.json_resultado, null), detalles: detailsMap.get(row.id_carga_ocr) || [] }));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al listar actas del docente.' });
  }
});

router.get('/actas/:id', authFromHeader, async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const [rows] = await pool.execute(`
      SELECT c.*, p.nombre_plantilla, p.codigo_plantilla,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia
      FROM actas_ocr_cargas c
      INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr
      LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
      LEFT JOIN materias m ON m.id_materia = c.id_materia
      WHERE c.id_carga_ocr = ? AND c.id_docente = ?
      LIMIT 1
    `, [req.params.id, docente.id_docente]);

    if (!rows.length) return res.status(404).json({ ok: false, message: 'Acta no encontrada o no autorizada.' });

    const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr = ? ORDER BY id_detalle_ocr ASC`, [req.params.id]);
    return res.json({ ok: true, data: { ...rows[0], json_resultado: safeJsonParse(rows[0].json_resultado, null), detalles: details } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al obtener acta.' });
  }
});

router.post('/subir', authFromHeader, service.upload.single('archivo'), async (req, res) => {
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const { id_periodo, id_grupo, id_materia, regla_manual = '' } = req.body || {};
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, message: 'Debes adjuntar una imagen o PDF del acta.' });

    const userId = service.pickUserId(req);
    const result = await service.subirActa({
      body: {
        codigo_plantilla: 'ACTA_CALIFICACIONES',
        id_periodo, id_grupo, id_materia,
        id_docente: docente.id_docente,
        regla_manual
      },
      file, userId
    });

    return res.status(201).json({ ok: true, message: 'Acta subida correctamente. Revisa la vista previa para corrección.', data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al subir acta.' });
  }
});

router.put('/actas/:id/corregir', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const cargaId = Number(req.params.id);
    const [rows] = await conn.execute(`SELECT id_carga_ocr, estado FROM actas_ocr_cargas WHERE id_carga_ocr = ? AND id_docente = ? LIMIT 1`, [cargaId, docente.id_docente]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Acta no encontrada o no autorizada.' });
    if (rows[0].estado === 'VALIDADA') return res.status(400).json({ ok: false, message: 'No se puede corregir un acta ya validada.' });

    const { alumnos = [] } = req.body || {};
    if (!alumnos.length) return res.status(400).json({ ok: false, message: 'Debes enviar la lista de alumnos corregida.' });

    const userId = service.pickUserId(req);
    await conn.beginTransaction();

    for (const alumno of alumnos) {
      if (!alumno.id_detalle_ocr) continue;
      await conn.execute(
        `UPDATE actas_ocr_detalles SET matricula = ?, nombre_completo = ?, calificacion = ?, observaciones = ?, validado = 0, error_validacion = NULL WHERE id_detalle_ocr = ? AND id_carga_ocr = ?`,
        [String(alumno.matricula || '').trim().toUpperCase(), String(alumno.nombre_completo || '').trim(), Number(alumno.calificacion || 0), String(alumno.observaciones || '').trim() || null, alumno.id_detalle_ocr, cargaId]
      );
    }

    await conn.execute(`UPDATE actas_ocr_cargas SET estado = 'VALIDACION_PENDIENTE', updated_at = NOW() WHERE id_carga_ocr = ?`, [cargaId]);
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'CORRECCION_DOCENTE', ?, NOW())`, [cargaId, userId, JSON.stringify({ alumnos_corregidos: alumnos.length })]);

    await conn.commit();
    return res.json({ ok: true, message: 'Datos corregidos correctamente. El acta queda pendiente de confirmación.' });
  } catch (error) {
    await conn.rollback().catch(() => {});
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al corregir acta.' });
  } finally { conn.release(); }
});

router.post('/actas/:id/confirmar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const docente = await resolveDocenteId(req.user.id_usuario);
    if (!docente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado.' });

    const cargaId = Number(req.params.id);
    const [rows] = await conn.execute(`SELECT id_carga_ocr, estado FROM actas_ocr_cargas WHERE id_carga_ocr = ? AND id_docente = ? LIMIT 1`, [cargaId, docente.id_docente]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Acta no encontrada o no autorizada.' });
    if (rows[0].estado === 'VALIDADA') return res.status(400).json({ ok: false, message: 'El acta ya fue validada.' });

    const userId = service.pickUserId(req);
    await conn.beginTransaction();

    await conn.execute(`UPDATE actas_ocr_cargas SET estado = 'VALIDACION_PENDIENTE', observaciones_revision = 'Enviada por docente para validación institucional.', updated_at = NOW() WHERE id_carga_ocr = ?`, [cargaId]);
    await conn.execute(`INSERT INTO actas_ocr_validaciones (id_carga_ocr, id_usuario, resultado, comentario, creado_en) VALUES (?, ?, 'APROBADA', 'Confirmación docente.', NOW())`, [cargaId, userId]);
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'CONFIRMACION_DOCENTE', ?, NOW())`, [cargaId, userId, JSON.stringify({ confirmado: true, docente: docente.id_docente })]);

    await conn.commit();
    return res.json({ ok: true, message: 'Acta confirmada y enviada para validación institucional.' });
  } catch (error) {
    await conn.rollback().catch(() => {});
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || 'Error al confirmar acta.' });
  } finally { conn.release(); }
});

module.exports = router;
