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

function normalizeText(value) {
  return String(value || '').trim();
}

function getRoleName(user) {
  return normalizeUpper(user?.rol_nombre || user?.rol || user?.role);
}

function getRoleId(user) {
  return Number(user?.rol_id || user?.id_rol || user?.role_id || 0);
}

function isAlumno(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);
  return roleName === 'ALUMNO' || roleId === 4;
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return sendError(res, 401, 'Token no disponible');
  }
  return verifyToken(req, res, next);
}

async function resolveAlumnoId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0].id_alumno : null;
}

async function getEvaluacionEstado(conn, idEvaluacion) {
  const [rows] = await conn.execute(
    "SELECT id_evaluacion, titulo, UPPER(estado) AS estado, fecha_inicio, fecha_fin, instrucciones FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1",
    [idEvaluacion]
  );
  return rows.length ? rows[0] : null;
}

router.use(authFromHeader);

router.get('/mis-evaluaciones', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT e.id_evaluacion, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
        UPPER(e.estado) AS estado, e.instrucciones, e.tipo_instrumento, e.escala,
        e.ponderacion_total,
        tp.nombre_plantilla,
        p.nombre_periodo,
        COUNT(DISTINCT ep.id_pregunta) AS total_preguntas,
        COUNT(DISTINCT re.id_respuesta) AS mis_respuestas
      FROM evaluaciones e
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      LEFT JOIN evaluacion_preguntas ep ON ep.id_evaluacion = e.id_evaluacion
      LEFT JOIN respuestas_evaluacion re ON re.id_evaluacion = e.id_evaluacion AND re.id_alumno = ?
      WHERE UPPER(e.estado) = 'ACTIVA'
        AND (e.fecha_inicio IS NULL OR e.fecha_inicio <= NOW())
        AND (e.fecha_fin IS NULL OR e.fecha_fin >= NOW())
      GROUP BY e.id_evaluacion
      ORDER BY e.fecha_fin ASC, e.fecha_inicio ASC
      LIMIT 50
    `, [idAlumno]);

    return res.json({ ok: true, data: rows, evaluaciones: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-alumno/mis-evaluaciones:', error);
    return sendError(res, 500, error.message || 'Error al cargar evaluaciones asignadas');
  } finally { conn.release(); }
});

router.get('/respondidas', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const [rows] = await conn.execute(`
      SELECT e.id_evaluacion, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
        UPPER(e.estado) AS estado, e.tipo_instrumento, e.escala,
        tp.nombre_plantilla, p.nombre_periodo,
        COUNT(DISTINCT ep.id_pregunta) AS total_preguntas,
        COUNT(DISTINCT re.id_respuesta) AS mis_respuestas,
        MAX(re.creado_en) AS ultima_respuesta,
        CASE WHEN COUNT(DISTINCT re.id_respuesta) >= COUNT(DISTINCT ep.id_pregunta) THEN 1 ELSE 0 END AS completada
      FROM evaluaciones e
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      JOIN evaluacion_preguntas ep ON ep.id_evaluacion = e.id_evaluacion
      JOIN respuestas_evaluacion re ON re.id_evaluacion = e.id_evaluacion AND re.id_alumno = ?
      GROUP BY e.id_evaluacion
      ORDER BY MAX(re.creado_en) DESC
      LIMIT 50
    `, [idAlumno]);

    return res.json({ ok: true, data: rows, respondidas: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-alumno/respondidas:', error);
    return sendError(res, 500, error.message || 'Error al cargar evaluaciones respondidas');
  } finally { conn.release(); }
});

router.get('/:id/estado-envio', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');

    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const evaluacion = await getEvaluacionEstado(conn, idEvaluacion);
    if (!evaluacion) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');

    const [preguntas] = await conn.execute(
      'SELECT COUNT(*) AS total FROM evaluacion_preguntas WHERE id_evaluacion = ?',
      [idEvaluacion]
    );
    const totalPreguntas = preguntas[0]?.total || 0;

    const [respondidas] = await conn.execute(`
      SELECT COUNT(DISTINCT ep.id_pregunta) AS respondidas
      FROM evaluacion_preguntas ep
      LEFT JOIN respuestas_evaluacion re ON re.id_evaluacion = ep.id_evaluacion
        AND re.id_alumno = ?
      WHERE ep.id_evaluacion = ?
    `, [idAlumno, idEvaluacion]);

    const respondidasCount = respondidas[0]?.respondidas || 0;

    const [respuestasDetalle] = await conn.execute(`
      SELECT ep.id_pregunta, ep.criterio, ep.tipo_respuesta, ep.peso, ep.orden_pregunta,
        re.id_respuesta, re.valor_numero, re.valor_texto, re.creado_en AS respondido_en
      FROM evaluacion_preguntas ep
      LEFT JOIN respuestas_evaluacion re ON re.id_pregunta = ep.id_pregunta_plantilla
        AND re.id_evaluacion = ep.id_evaluacion
        AND re.id_alumno = ?
      WHERE ep.id_evaluacion = ?
      ORDER BY ep.orden_pregunta ASC
    `, [idAlumno, idEvaluacion]);

    return res.json({
      ok: true,
      data: {
        id_evaluacion: idEvaluacion,
        titulo: evaluacion.titulo,
        estado: evaluacion.estado,
        total_preguntas: totalPreguntas,
        respondidas: respondidasCount,
        completada: respondidasCount >= totalPreguntas,
        preguntas: respuestasDetalle
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-alumno/:id/estado-envio:', error);
    return sendError(res, 500, error.message || 'Error al cargar estado de env\u00edo');
  } finally { conn.release(); }
});

router.get('/:id/preguntas', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');

    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const evaluacion = await getEvaluacionEstado(conn, idEvaluacion);
    if (!evaluacion) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');

    const [preguntas] = await conn.execute(`
      SELECT ep.id_pregunta, ep.id_pregunta_plantilla, ep.criterio, ep.descripcion,
        ep.tipo_respuesta, ep.peso, ep.orden_pregunta,
        re.id_respuesta, re.valor_numero, re.valor_texto
      FROM evaluacion_preguntas ep
      LEFT JOIN respuestas_evaluacion re ON re.id_pregunta = ep.id_pregunta_plantilla
        AND re.id_evaluacion = ep.id_evaluacion
        AND re.id_alumno = ?
      WHERE ep.id_evaluacion = ?
      ORDER BY ep.orden_pregunta ASC
    `, [idAlumno, idEvaluacion]);

    return res.json({
      ok: true,
      data: {
        evaluacion: {
          id_evaluacion: evaluacion.id_evaluacion,
          titulo: evaluacion.titulo,
          instrucciones: evaluacion.instrucciones,
          estado: evaluacion.estado,
          fecha_inicio: evaluacion.fecha_inicio,
          fecha_fin: evaluacion.fecha_fin
        },
        preguntas: preguntas,
        total_preguntas: preguntas.length,
        respondidas: preguntas.filter(p => p.id_respuesta !== null).length
      }
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones-alumno/:id/preguntas:', error);
    return sendError(res, 500, error.message || 'Error al cargar preguntas');
  } finally { conn.release(); }
});

router.post('/responder', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idEvaluacion = Number(req.body.id_evaluacion || 0);
    const idPregunta = Number(req.body.id_pregunta || 0);
    if (!idEvaluacion || !idPregunta) return sendError(res, 400, 'ID de evaluaci\u00f3n e ID de pregunta son obligatorios.');

    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const evaluacion = await getEvaluacionEstado(conn, idEvaluacion);
    if (!evaluacion) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (evaluacion.estado !== 'ACTIVA') return sendError(res, 400, 'Solo se pueden responder evaluaciones en estado ACTIVA.');

    const [questionRows] = await conn.execute(
      'SELECT id_pregunta, id_pregunta_plantilla, tipo_respuesta FROM evaluacion_preguntas WHERE id_pregunta = ? AND id_evaluacion = ? LIMIT 1',
      [idPregunta, idEvaluacion]
    );
    if (!questionRows.length) return sendError(res, 404, 'La pregunta no existe en esta evaluaci\u00f3n.');

    const tipoRespuesta = normalizeUpper(questionRows[0].tipo_respuesta);
    let sourceQuestionId = questionRows[0].id_pregunta_plantilla ? Number(questionRows[0].id_pregunta_plantilla) : null;
    if (!sourceQuestionId) {
      const pregunta = questionRows[0];
      const [pRows] = await conn.execute(
        'SELECT e.id_plantilla FROM evaluaciones e WHERE e.id_evaluacion = ? LIMIT 1',
        [idEvaluacion]
      );
      if (!pRows.length) return sendError(res, 500, 'No fue posible resolver la pregunta asociada.');
      const ordenPregunta = pregunta.orden_pregunta || 1;
      const [existingMirror] = await conn.execute(
        'SELECT id_pregunta FROM evaluacion_plantilla_preguntas WHERE id_plantilla = ? AND orden_pregunta = ? LIMIT 1',
        [pRows[0].id_plantilla, ordenPregunta]
      );
      if (existingMirror.length) {
        sourceQuestionId = existingMirror[0].id_pregunta;
      } else {
        const [newPlantillaPregunta] = await conn.execute(
          'INSERT INTO evaluacion_plantilla_preguntas (id_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [pRows[0].id_plantilla, pregunta.criterio || 'Criterio', pregunta.descripcion || '', pregunta.peso || 0, pregunta.tipo_respuesta || 'NUMERICA', ordenPregunta]
        );
        sourceQuestionId = newPlantillaPregunta.insertId;
      }
      await conn.execute(
        'UPDATE evaluacion_preguntas SET id_pregunta_plantilla = ? WHERE id_pregunta = ?',
        [sourceQuestionId, idPregunta]
      );
    }
    if (!sourceQuestionId) return sendError(res, 500, 'No fue posible resolver la pregunta de plantilla asociada.');

    const valorNumero = req.body.valor_numero === '' || req.body.valor_numero === null || typeof req.body.valor_numero === 'undefined'
      ? null : Number(req.body.valor_numero);
    const valorTexto = req.body.valor_texto === null || typeof req.body.valor_texto === 'undefined'
      ? null : normalizeText(req.body.valor_texto);

    if (tipoRespuesta === 'TEXTO' && !valorTexto) return sendError(res, 400, 'Esta pregunta requiere retroalimentaci\u00f3n textual.');
    if (tipoRespuesta !== 'TEXTO' && (valorNumero === null || Number.isNaN(valorNumero))) return sendError(res, 400, 'Esta pregunta requiere una puntuaci\u00f3n num\u00e9rica v\u00e1lida.');

    const [existing] = await conn.execute(
      'SELECT id_respuesta FROM respuestas_evaluacion WHERE id_evaluacion = ? AND id_pregunta = ? AND id_alumno = ? LIMIT 1',
      [idEvaluacion, sourceQuestionId, idAlumno]
    );

    if (existing.length) {
      await conn.execute(
        'UPDATE respuestas_evaluacion SET valor_numero = ?, valor_texto = ? WHERE id_respuesta = ?',
        [valorNumero, valorTexto, existing[0].id_respuesta]
      );
    } else {
      await conn.execute(
        'INSERT INTO respuestas_evaluacion (id_evaluacion, id_pregunta, id_alumno, valor_numero, valor_texto) VALUES (?, ?, ?, ?, ?)',
        [idEvaluacion, sourceQuestionId, idAlumno, valorNumero, valorTexto]
      );
    }

    return res.json({
      ok: true,
      message: 'Respuesta guardada correctamente.',
      data: { id_evaluacion: idEvaluacion, id_pregunta: idPregunta, valor_numero: valorNumero, valor_texto: valorTexto }
    });
  } catch (error) {
    console.error('ERROR POST /evaluaciones-alumno/responder:', error);
    return sendError(res, 500, error.message || 'No fue posible guardar la respuesta');
  } finally { conn.release(); }
});

router.post('/guardar-avance', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idEvaluacion = Number(req.body.id_evaluacion || 0);
    const respuestas = Array.isArray(req.body.respuestas) ? req.body.respuestas : [];
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n obligatorio.');
    if (!respuestas.length) return sendError(res, 400, 'Debes incluir al menos una respuesta.');

    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const evaluacion = await getEvaluacionEstado(conn, idEvaluacion);
    if (!evaluacion) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (evaluacion.estado !== 'ACTIVA') return sendError(res, 400, 'Solo se pueden responder evaluaciones en estado ACTIVA.');

    let guardadas = 0;
    for (const r of respuestas) {
      const idPregunta = Number(r.id_pregunta || 0);
      if (!idPregunta) continue;

      const [qRow] = await conn.execute(
        'SELECT id_pregunta_plantilla, tipo_respuesta FROM evaluacion_preguntas WHERE id_pregunta = ? AND id_evaluacion = ? LIMIT 1',
        [idPregunta, idEvaluacion]
      );
      if (!qRow.length) continue;

      const sourceId = qRow[0].id_pregunta_plantilla;
      if (!sourceId) continue;

      const vn = r.valor_numero === '' || r.valor_numero === null || typeof r.valor_numero === 'undefined'
        ? null : Number(r.valor_numero);
      const vt = r.valor_texto === null || typeof r.valor_texto === 'undefined'
        ? null : normalizeText(r.valor_texto);

      const [existing] = await conn.execute(
        'SELECT id_respuesta FROM respuestas_evaluacion WHERE id_evaluacion = ? AND id_pregunta = ? AND id_alumno = ? LIMIT 1',
        [idEvaluacion, sourceId, idAlumno]
      );

      if (existing.length) {
        await conn.execute(
          'UPDATE respuestas_evaluacion SET valor_numero = ?, valor_texto = ? WHERE id_respuesta = ?',
          [vn, vt, existing[0].id_respuesta]
        );
      } else {
        await conn.execute(
          'INSERT INTO respuestas_evaluacion (id_evaluacion, id_pregunta, id_alumno, valor_numero, valor_texto) VALUES (?, ?, ?, ?, ?)',
          [idEvaluacion, sourceId, idAlumno, vn, vt]
        );
      }
      guardadas++;
    }

    return res.json({ ok: true, message: `${guardadas} respuesta(s) guardada(s) correctamente.`, data: { guardadas } });
  } catch (error) {
    console.error('ERROR POST /evaluaciones-alumno/guardar-avance:', error);
    return sendError(res, 500, error.message || 'No fue posible guardar el avance');
  } finally { conn.release(); }
});

router.post('/enviar', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!isAlumno(req.user)) return sendError(res, 403, 'Acceso exclusivo para alumnos.');
    const idEvaluacion = Number(req.body.id_evaluacion || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n obligatorio.');

    const idAlumno = await resolveAlumnoId(conn, req.user.id_usuario);
    if (!idAlumno) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');

    const evaluacion = await getEvaluacionEstado(conn, idEvaluacion);
    if (!evaluacion) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (evaluacion.estado !== 'ACTIVA') return sendError(res, 400, 'Solo se pueden enviar evaluaciones en estado ACTIVA.');

    const [preguntas] = await conn.execute(
      'SELECT COUNT(*) AS total FROM evaluacion_preguntas WHERE id_evaluacion = ?',
      [idEvaluacion]
    );
    const totalPreguntas = preguntas[0]?.total || 0;

    const [respondidas] = await conn.execute(`
      SELECT COUNT(DISTINCT ep.id_pregunta) AS respondidas
      FROM evaluacion_preguntas ep
      JOIN respuestas_evaluacion re ON re.id_evaluacion = ep.id_evaluacion
        AND re.id_alumno = ?
      WHERE ep.id_evaluacion = ?
    `, [idAlumno, idEvaluacion]);
    const respondidasCount = respondidas[0]?.respondidas || 0;

    if (respondidasCount < totalPreguntas) {
      return sendError(res, 400, `Debes responder todas las preguntas antes de enviar (${respondidasCount}/${totalPreguntas}).`);
    }

    await conn.execute(
      "INSERT INTO evaluacion_auditoria (id_evaluacion, id_usuario, accion, detalle) VALUES (?, ?, 'ENVIO_ALUMNO', ?)",
      [idEvaluacion, req.user.id_usuario, `El alumno #${idAlumno} envi\u00f3 sus respuestas.`]
    );

    return res.json({
      ok: true,
      message: 'Tus respuestas han sido enviadas correctamente. Gracias por participar.',
      data: { id_evaluacion: idEvaluacion, total_preguntas: totalPreguntas, respondidas: respondidasCount }
    });
  } catch (error) {
    console.error('ERROR POST /evaluaciones-alumno/enviar:', error);
    return sendError(res, 500, error.message || 'No fue posible enviar las respuestas');
  } finally { conn.release(); }
});

module.exports = router;
