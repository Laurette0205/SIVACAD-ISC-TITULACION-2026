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

function isDocente(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);
  return roleName === 'DOCENTE' || roleId === 3;
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return sendError(res, 401, 'Token no disponible');
  }
  return verifyToken(req, res, next);
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

router.use(authFromHeader);

router.get('/mis-evaluaciones', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT e.id_evaluacion, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
        UPPER(e.estado) AS estado, e.tipo_instrumento, e.escala, e.ponderacion_total,
        tp.nombre_plantilla, p.nombre_periodo,
        COUNT(DISTINCT ep.id_pregunta) AS total_preguntas
      FROM evaluaciones e
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      LEFT JOIN evaluacion_preguntas ep ON ep.id_evaluacion = e.id_evaluacion
      WHERE (UPPER(e.estado) = 'ACTIVA' OR UPPER(e.estado) = 'CERRADA')
        AND (e.publico_objetivo = 'DOCENTES' OR e.tipo_instrumento = 'ALUMNO_POR_DOCENTES')
      GROUP BY e.id_evaluacion
      ORDER BY e.fecha_fin DESC, e.creado_en DESC
      LIMIT 50
    `);

    return res.json({ ok: true, data: rows, evaluaciones: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/mis-evaluaciones:', error);
    return sendError(res, 500, error.message || 'Error al cargar evaluaciones');
  } finally { conn.release(); }
});

router.get('/resultados', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT r.id_resultado, r.id_evaluacion, r.promedio_final, r.observacion_general,
        r.estado_validacion, r.creado_en, r.validado_en,
        e.titulo AS evaluacion_titulo, e.tipo_instrumento, e.escala, e.fecha_inicio, e.fecha_fin,
        UPPER(e.estado) AS estado_evaluacion,
        p.nombre_periodo, p.id_periodo,
        tp.nombre_plantilla,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS validado_por_nombre
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      LEFT JOIN usuarios u ON u.id_usuario = r.validado_por
      WHERE r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
      ORDER BY e.fecha_fin DESC, r.creado_en DESC
      LIMIT 100
    `, [docente.id_docente]);

    return res.json({ ok: true, data: rows, resultados: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/resultados:', error);
    return sendError(res, 500, error.message || 'Error al cargar resultados');
  } finally { conn.release(); }
});

router.get('/resultados/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const idResultado = Number(req.params.id || 0);
    if (!idResultado) return sendError(res, 400, 'ID de resultado inv\u00e1lido.');

    const [resultRows] = await conn.execute(`
      SELECT r.*, e.titulo AS evaluacion_titulo, e.tipo_instrumento, e.escala,
        p.nombre_periodo, tp.nombre_plantilla
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      WHERE r.id_resultado = ? AND r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
      LIMIT 1
    `, [idResultado, docente.id_docente]);

    if (!resultRows.length) return sendError(res, 404, 'Resultado no encontrado.');

    const result = resultRows[0];

    const [preguntas] = await conn.execute(`
      SELECT ep.criterio, ep.tipo_respuesta, ep.peso, ep.orden_pregunta,
        AVG(CASE WHEN re.valor_numero IS NOT NULL THEN re.valor_numero ELSE NULL END) AS promedio_pregunta,
        COUNT(re.id_respuesta) AS total_respuestas,
        COUNT(DISTINCT re.id_alumno) AS alumnos_respondieron
      FROM evaluacion_preguntas ep
      LEFT JOIN respuestas_evaluacion re ON re.id_evaluacion = ep.id_evaluacion
        AND re.id_pregunta = ep.id_pregunta_plantilla
      WHERE ep.id_evaluacion = ?
      GROUP BY ep.id_pregunta, ep.criterio, ep.tipo_respuesta, ep.peso, ep.orden_pregunta
      ORDER BY ep.orden_pregunta ASC
    `, [result.id_evaluacion]);

    const [retroalimentacion] = await conn.execute(`
      SELECT re.id_respuesta, re.valor_texto, re.creado_en,
        CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellido_paterno, '')) AS alumno_nombre
      FROM respuestas_evaluacion re
      LEFT JOIN alumnos a ON a.id_alumno = re.id_alumno
      WHERE re.id_evaluacion = ? AND re.valor_texto IS NOT NULL AND re.valor_texto != ''
      ORDER BY re.creado_en DESC
      LIMIT 100
    `, [result.id_evaluacion]);

    return res.json({
      ok: true,
      data: { ...result, preguntas, retroalimentacion }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/resultados/:id:', error);
    return sendError(res, 500, error.message || 'Error al cargar detalle del resultado');
  } finally { conn.release(); }
});

router.get('/comparativos', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const periodId = req.query?.id_periodo ? Number(req.query.id_periodo) : 0;

    const [periodos] = await conn.execute(`
      SELECT p.id_periodo, p.nombre_periodo,
        AVG(r.promedio_final) AS promedio_periodo,
        COUNT(r.id_resultado) AS total_evaluaciones,
        MAX(r.promedio_final) AS max_promedio,
        MIN(r.promedio_final) AS min_promedio
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      WHERE r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
        AND r.estado_validacion = 'VALIDADO'
        ${periodId ? 'AND p.id_periodo = ?' : ''}
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.fecha_inicio ASC
      LIMIT 20
    `, periodId ? [docente.id_docente, periodId] : [docente.id_docente]);

    const [detallePeriodos] = await conn.execute(`
      SELECT p.id_periodo, p.nombre_periodo,
        e.id_evaluacion, e.titulo AS evaluacion_titulo, e.tipo_instrumento,
        r.promedio_final, r.observacion_general, r.estado_validacion,
        e.escala
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      WHERE r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
        AND r.estado_validacion = 'VALIDADO'
        ${periodId ? 'AND p.id_periodo = ?' : ''}
      ORDER BY p.fecha_inicio ASC, e.fecha_fin ASC
      LIMIT 100
    `, periodId ? [docente.id_docente, periodId] : [docente.id_docente]);

    return res.json({
      ok: true,
      data: {
        periodos: periodos,
        detalle: detallePeriodos,
        total_periodos: periodos.length,
        promedio_general: periodos.reduce((s, p) => s + Number(p.promedio_periodo || 0), 0) / (periodos.length || 1)
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/comparativos:', error);
    return sendError(res, 500, error.message || 'Error al cargar comparativos');
  } finally { conn.release(); }
});

router.get('/evolucion', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT p.nombre_periodo, p.id_periodo, p.fecha_inicio AS periodo_inicio,
        e.id_evaluacion, e.titulo AS evaluacion_titulo, e.tipo_instrumento,
        r.promedio_final, r.creado_en AS resultado_creado, r.estado_validacion,
        e.escala, e.fecha_fin AS evaluacion_fin
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      WHERE r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
        AND r.estado_validacion = 'VALIDADO'
      ORDER BY p.fecha_inicio ASC, e.fecha_fin ASC
      LIMIT 100
    `, [docente.id_docente]);

    const evolucion = [];
    const periodosUnicos = [];
    rows.forEach(r => {
      if (!periodosUnicos.find(p => p.id_periodo === r.id_periodo)) {
        periodosUnicos.push({ id_periodo: r.id_periodo, nombre_periodo: r.nombre_periodo });
      }
      evolucion.push({
        periodo: r.nombre_periodo,
        evaluacion: r.evaluacion_titulo,
        promedio: Number(r.promedio_final || 0),
        escala: r.escala,
        fecha: r.evaluacion_fin || r.resultado_creado
      });
    });

    return res.json({
      ok: true,
      data: {
        evolucion,
        periodos: periodosUnicos,
        promedio_general: evolucion.length
          ? evolucion.reduce((s, e) => s + e.promedio, 0) / evolucion.length
          : 0
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/evolucion:', error);
    return sendError(res, 500, error.message || 'Error al cargar evoluci\u00f3n hist\u00f3rica');
  } finally { conn.release(); }
});

router.get('/retroalimentacion', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT r.id_respuesta, r.valor_texto, r.creado_en,
        e.id_evaluacion, e.titulo AS evaluacion_titulo, e.tipo_instrumento,
        p.nombre_periodo,
        ep.criterio, ep.orden_pregunta,
        CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellido_paterno, '')) AS alumno_nombre
      FROM respuestas_evaluacion r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      JOIN evaluacion_preguntas ep ON ep.id_evaluacion = r.id_evaluacion
        AND ep.id_pregunta_plantilla = r.id_pregunta
      LEFT JOIN alumnos a ON a.id_alumno = r.id_alumno
      WHERE r.valor_texto IS NOT NULL AND r.valor_texto != ''
        AND EXISTS (
          SELECT 1 FROM evaluacion_resultados er
          WHERE er.id_evaluacion = r.id_evaluacion
            AND er.tipo_evaluado = 'DOCENTE'
            AND er.id_evaluado = ?
        )
      ORDER BY r.creado_en DESC
      LIMIT 200
    `, [docente.id_docente]);

    return res.json({ ok: true, data: rows, retroalimentacion: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/retroalimentacion:', error);
    return sendError(res, 500, error.message || 'Error al cargar retroalimentaci\u00f3n');
  } finally { conn.release(); }
});

router.get('/reporte/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isDocente(req.user)) return sendError(res, 403, 'Acceso exclusivo para docentes.');
    const docente = await resolveDocenteId(conn, req.user.id_usuario);
    if (!docente) return sendError(res, 404, 'No se encontr\u00f3 un registro docente vinculado a tu cuenta.');

    const idResultado = Number(req.params.id || 0);
    if (!idResultado) return sendError(res, 400, 'ID de resultado inv\u00e1lido.');

    const [resultRows] = await conn.execute(`
      SELECT r.id_resultado, r.id_evaluacion, r.promedio_final, r.observacion_general,
        r.estado_validacion, r.creado_en, r.validado_en,
        e.titulo AS evaluacion_titulo, e.descripcion, e.tipo_instrumento, e.escala,
        e.fecha_inicio, e.fecha_fin,
        p.nombre_periodo,
        tp.nombre_plantilla
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      WHERE r.id_resultado = ? AND r.tipo_evaluado = 'DOCENTE' AND r.id_evaluado = ?
      LIMIT 1
    `, [idResultado, docente.id_docente]);

    if (!resultRows.length) return sendError(res, 404, 'Resultado no encontrado.');

    const result = resultRows[0];

    const [preguntas] = await conn.execute(`
      SELECT ep.criterio, ep.tipo_respuesta, ep.peso, ep.orden_pregunta,
        AVG(CASE WHEN re.valor_numero IS NOT NULL THEN re.valor_numero ELSE NULL END) AS promedio_pregunta,
        COUNT(re.id_respuesta) AS total_respuestas,
        STDDEV(CASE WHEN re.valor_numero IS NOT NULL THEN re.valor_numero ELSE NULL END) AS desviacion
      FROM evaluacion_preguntas ep
      LEFT JOIN respuestas_evaluacion re ON re.id_evaluacion = ep.id_evaluacion
        AND re.id_pregunta = ep.id_pregunta_plantilla
      WHERE ep.id_evaluacion = ?
      GROUP BY ep.id_pregunta, ep.criterio, ep.tipo_respuesta, ep.peso, ep.orden_pregunta
      ORDER BY ep.orden_pregunta ASC
    `, [result.id_evaluacion]);

    return res.json({
      ok: true,
      data: {
        resultado: result,
        preguntas: preguntas,
        generado_en: new Date().toISOString(),
        docente_nombre: `${req.user.nombres || ''} ${req.user.apellido_paterno || ''}`.trim() || docente.clave_docente
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-docente/reporte/:id:', error);
    return sendError(res, 500, error.message || 'Error al generar reporte');
  } finally { conn.release(); }
});

module.exports = router;
