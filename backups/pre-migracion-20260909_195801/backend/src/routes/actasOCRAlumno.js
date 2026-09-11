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

async function resolveAlumnoId(idUsuario) {
  const [rows] = await pool.execute('SELECT id_alumno, matricula, semestre_actual FROM alumnos WHERE id_usuario = ? LIMIT 1', [idUsuario]);
  return rows.length ? rows[0] : null;
}

router.get('/panel', authFromHeader, async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado.' });

    const [[stats]] = await pool.execute(`
      SELECT COUNT(DISTINCT ac.id_acta_calificacion) AS total_actas,
        COUNT(acd.id_detalle_acta) AS total_calificaciones,
        AVG(NULLIF(acd.calificacion, 0)) AS promedio_general,
        MAX(ac.fecha_creacion) AS ultima_actualizacion
      FROM actas_calificaciones ac
      INNER JOIN actas_calificaciones_detalle acd ON acd.id_acta_calificacion = ac.id_acta_calificacion
      WHERE acd.id_alumno = ?
    `, [alumno.id_alumno]).catch(() => [[{}]]);

    const [actasRecientes] = await pool.execute(`
      SELECT ac.id_acta_calificacion, ac.estado, ac.total_alumnos, ac.created_at,
        per.nombre_periodo, g.nombre_grupo, m.nombre_materia
      FROM actas_calificaciones ac
      INNER JOIN actas_calificaciones_detalle acd ON acd.id_acta_calificacion = ac.id_acta_calificacion
      LEFT JOIN periodos per ON per.id_periodo = ac.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = ac.id_grupo
      LEFT JOIN materias m ON m.id_materia = ac.id_materia
      WHERE acd.id_alumno = ?
      ORDER BY ac.created_at DESC LIMIT 10
    `, [alumno.id_alumno]).catch(() => []);

    return res.json({ ok: true, data: {
      alumno: { id_alumno: alumno.id_alumno, matricula: alumno.matricula, semestre_actual: alumno.semestre_actual },
      stats: {
        total_actas: Number(stats?.total_actas || 0),
        total_calificaciones: Number(stats?.total_calificaciones || 0),
        promedio_general: Number(stats?.promedio_general || 0).toFixed(2),
        ultima_actualizacion: stats?.ultima_actualizacion || null
      },
      actas_recientes: actasRecientes
    }});
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar panel.' });
  }
});

router.get('/historial', authFromHeader, async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado.' });

    const [rows] = await pool.execute(`
      SELECT acd.id_detalle_acta, acd.matricula, acd.nombre_completo, acd.calificacion, acd.created_at,
        ac.id_acta_calificacion, ac.estado AS estado_acta, ac.created_at AS fecha_acta,
        per.nombre_periodo, g.nombre_grupo, g.semestre, m.nombre_materia, m.clave_materia
      FROM actas_calificaciones_detalle acd
      INNER JOIN actas_calificaciones ac ON ac.id_acta_calificacion = acd.id_acta_calificacion
      LEFT JOIN periodos per ON per.id_periodo = ac.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = ac.id_grupo
      LEFT JOIN materias m ON m.id_materia = ac.id_materia
      WHERE acd.id_alumno = ?
      ORDER BY ac.created_at DESC, m.nombre_materia ASC
    `, [alumno.id_alumno]).catch(() => []);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar historial.' });
  }
});

router.get('/resultados', authFromHeader, async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado.' });

    const [porPeriodo] = await pool.execute(`
      SELECT per.id_periodo, per.nombre_periodo,
        COUNT(acd.id_detalle_acta) AS materias,
        AVG(NULLIF(acd.calificacion, 0)) AS promedio,
        SUM(CASE WHEN acd.calificacion >= 60 THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN acd.calificacion < 60 THEN 1 ELSE 0 END) AS reprobadas
      FROM actas_calificaciones_detalle acd
      INNER JOIN actas_calificaciones ac ON ac.id_acta_calificacion = acd.id_acta_calificacion
      INNER JOIN periodos per ON per.id_periodo = ac.id_periodo
      WHERE acd.id_alumno = ?
      GROUP BY per.id_periodo, per.nombre_periodo
      ORDER BY per.id_periodo DESC
    `, [alumno.id_alumno]).catch(() => []);

    const [resumen] = await pool.execute(`
      SELECT COUNT(DISTINCT per.id_periodo) AS periodos_cursados,
        COUNT(acd.id_detalle_acta) AS total_materias,
        AVG(NULLIF(acd.calificacion, 0)) AS promedio_global,
        SUM(CASE WHEN acd.calificacion >= 60 THEN 1 ELSE 0 END) AS total_aprobadas,
        SUM(CASE WHEN acd.calificacion < 60 THEN 1 ELSE 0 END) AS total_reprobadas
      FROM actas_calificaciones_detalle acd
      INNER JOIN actas_calificaciones ac ON ac.id_acta_calificacion = acd.id_acta_calificacion
      INNER JOIN periodos per ON per.id_periodo = ac.id_periodo
      WHERE acd.id_alumno = ?
    `, [alumno.id_alumno]).catch(() => [[{}]]);

    const [[mejorMateria]] = await pool.execute(`
      SELECT m.nombre_materia, acd.calificacion, per.nombre_periodo
      FROM actas_calificaciones_detalle acd
      INNER JOIN actas_calificaciones ac ON ac.id_acta_calificacion = acd.id_acta_calificacion
      INNER JOIN materias m ON m.id_materia = ac.id_materia
      INNER JOIN periodos per ON per.id_periodo = ac.id_periodo
      WHERE acd.id_alumno = ?
      ORDER BY acd.calificacion DESC LIMIT 1
    `, [alumno.id_alumno]).catch(() => [[]]);

    return res.json({ ok: true, data: { porPeriodo, resumen: resumen[0] || {}, mejor_materia: mejorMateria || null } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar resultados.' });
  }
});

router.get('/actas-validadas', authFromHeader, async (req, res) => {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado.' });

    const [rows] = await pool.execute(`
      SELECT ac.id_acta_calificacion, ac.estado, ac.total_alumnos, ac.promedio_grupal,
        ac.created_at, per.nombre_periodo, g.nombre_grupo, g.semestre, m.nombre_materia, m.clave_materia,
        acd.calificacion, acd.matricula, acd.nombre_completo
      FROM actas_calificaciones ac
      INNER JOIN actas_calificaciones_detalle acd ON acd.id_acta_calificacion = ac.id_acta_calificacion
      LEFT JOIN periodos per ON per.id_periodo = ac.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = ac.id_grupo
      LEFT JOIN materias m ON m.id_materia = ac.id_materia
      WHERE acd.id_alumno = ? AND (ac.estado = 'VALIDADA' OR ac.estado = 'IMPORTADA')
      ORDER BY ac.created_at DESC LIMIT 50
    `, [alumno.id_alumno]).catch(() => []);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Error al cargar actas validadas.' });
  }
});

module.exports = router;
