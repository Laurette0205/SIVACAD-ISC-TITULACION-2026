'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// ────────────── helpers ──────────────
function roleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
}
function roleId(user) {
  return Number(user?.rol_id || user?.id_rol || 0);
}
function isDocente(user) {
  const rn = roleName(user), ri = roleId(user);
  return rn === 'DOCENTE' || ri === 3;
}
function isAdminOrCoord(user) {
  const rn = roleName(user), ri = roleId(user);
  return rn === 'ADMINISTRADOR' || ri === 1 || rn === 'COORDINADOR' || ri === 2;
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, message: 'Token no disponible' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

async function resolveDocente(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
      [req.user.id_usuario]
    );
    req.docente = rows.length ? { ...rows[0], id_usuario: req.user.id_usuario } : null;
    next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al identificar al docente.' });
  }
}

async function getPeriodoActivo(conn) {
  const [rows] = await conn.execute(
    "SELECT id_periodo, nombre_periodo FROM periodos WHERE activo = 1 LIMIT 1"
  );
  return rows.length ? rows[0] : null;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ═══════════════════════════════════════════
// 1. ALUMNOS SUGERIDOS (potenciales a beca)
// ═══════════════════════════════════════════
router.get('/docente-becas/mis-alumnos-sugeridos', authRequired, resolveDocente, async (req, res) => {
  try {
    if (!req.docente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }
    const esAdminOCoord = isAdminOrCoord(req.user);
    const docenteId = isDocente(req.user) ? req.docente.id_docente : null;

    let whereGroup = '';
    const params = [];
    if (!esAdminOCoord && docenteId) {
      whereGroup = 'AND ca.id_docente = ?';
      params.push(docenteId);
    }

    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(50, Math.max(1, toNum(req.query.limite, 20)));
    const offset = (pagina - 1) * limite;

    let countParams = [...params];
    let countSql = `
      SELECT COUNT(DISTINCT a.id_alumno) AS total
      FROM alumnos a
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      JOIN periodos p ON p.id_periodo = ga.id_periodo AND p.estado = 'Activo'
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE 1=1 ${whereGroup}
    `;
    const [countRows] = await pool.execute(countSql, countParams);
    const total = countRows[0].total;

    let sql = `
      SELECT DISTINCT
        a.id_alumno, a.nombres, a.apellido_paterno, a.apellido_materno, a.matricula,
        a.semestre_actual, a.estatus_academico,
        c.nombre_carrera,
        k.promedio_general, k.creditos_acumulados,
        g.nombre_grupo, g.turno,
        CASE
          WHEN k.promedio_general IS NULL THEN 'SIN_PROMEDIO'
          WHEN k.promedio_general < 70 THEN 'CRITICO'
          WHEN k.promedio_general < 80 THEN 'ALTO'
          WHEN k.promedio_general < 85 THEN 'MEDIO'
          ELSE 'BAJO'
        END AS nivel_prioridad,
        CASE
          WHEN k.promedio_general IS NULL OR k.promedio_general < 70 THEN 'Rendimiento bajo - posible candidato a beca por aprovechamiento'
          WHEN k.promedio_general < 80 THEN 'Rendimiento por debajo del promedio - requiere seguimiento'
          WHEN a.estatus_academico IN ('Irregular','Baja_Temporal') THEN 'Estatus irregular - posible necesidad de apoyo'
          WHEN k.creditos_acumulados IS NULL OR k.creditos_acumulados < 30 THEN 'Baja carga crediticia - posible riesgo académico'
          ELSE 'Cumple perfil general - puede optar a becas'
        END AS sugerencia_motivo
      FROM alumnos a
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      JOIN periodos p ON p.id_periodo = ga.id_periodo AND p.estado = 'Activo'
      JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN grupos g ON g.id_grupo = ga.id_grupo
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE 1=1 ${whereGroup}
      ORDER BY k.promedio_general ASC, a.apellido_paterno ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limite, offset);
    const [rows] = await pool.execute(sql, params);

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasDocente] alumnos sugeridos error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar alumnos sugeridos.' });
  }
});

// ═══════════════════════════════════════════
// 2. ALERTAS ACADÉMICAS (alumnos con alertas)
// ═══════════════════════════════════════════
router.get('/docente-becas/alertas-academicas', authRequired, resolveDocente, async (req, res) => {
  try {
    const esAdminOCoord = isAdminOrCoord(req.user);
    const docenteId = isDocente(req.user) ? req.docente?.id_docente : null;

    let whereExtra = '';
    const params = [];
    if (!esAdminOCoord && docenteId) {
      whereExtra = 'AND ca.id_docente = ?';
      params.push(docenteId);
    }

    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(50, Math.max(1, toNum(req.query.limite, 20)));
    const offset = (pagina - 1) * limite;

    const [countRows] = await pool.execute(`
      SELECT COUNT(DISTINCT a.id_alumno) AS total
      FROM alumnos a
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      JOIN periodos p ON p.id_periodo = ga.id_periodo AND p.estado = 'Activo'
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE (k.promedio_general < 70 OR a.estatus_academico IN ('Irregular','Baja_Temporal') OR k.creditos_acumulados < 30) ${whereExtra}
    `, params);
    const total = countRows[0].total;

    const [rows] = await pool.execute(`
      SELECT DISTINCT
        a.id_alumno, a.nombres, a.apellido_paterno, a.apellido_materno, a.matricula,
        a.semestre_actual, a.estatus_academico,
        c.nombre_carrera,
        k.promedio_general, k.creditos_acumulados,
        g.nombre_grupo, g.turno,
        CASE
          WHEN k.promedio_general IS NULL OR k.promedio_general < 70 THEN 'Rendimiento crítico'
          WHEN a.estatus_academico = 'Irregular' THEN 'Estatus irregular'
          WHEN a.estatus_academico = 'Baja_Temporal' THEN 'Baja temporal'
          WHEN k.creditos_acumulados < 30 THEN 'Baja carga crediticia'
          ELSE 'Alerta general'
        END AS tipo_alerta,
        CASE
          WHEN k.promedio_general IS NULL THEN 'Sin información de kardex'
          WHEN k.promedio_general < 70 THEN CONCAT('Promedio crítico: ', k.promedio_general)
          WHEN a.estatus_academico = 'Irregular' THEN 'Estatus academico irregular'
          WHEN k.creditos_acumulados < 30 THEN CONCAT('Solo ', IFNULL(k.creditos_acumulados,0), ' creditos acumulados')
          ELSE 'Requiere atencion'
        END AS descripcion_alerta,
        CASE
          WHEN k.promedio_general IS NULL OR k.promedio_general < 70 THEN 'ALTA'
          WHEN a.estatus_academico IN ('Irregular','Baja_Temporal') THEN 'ALTA'
          WHEN k.creditos_acumulados < 30 THEN 'MEDIA'
          ELSE 'BAJA'
        END AS severidad
      FROM alumnos a
      JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.estado = 'ACTIVO'
      JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      JOIN periodos p ON p.id_periodo = ga.id_periodo AND p.estado = 'Activo'
      JOIN carreras c ON c.id_carrera = a.id_carrera
      JOIN grupos g ON g.id_grupo = ga.id_grupo
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE (k.promedio_general < 70 OR a.estatus_academico IN ('Irregular','Baja_Temporal') OR k.creditos_acumulados < 30) ${whereExtra}
      ORDER BY k.promedio_general ASC, a.apellido_paterno ASC
      LIMIT ? OFFSET ?
    `, [...params, limite, offset]);

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasDocente] alertas academicas error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar alertas.' });
  }
});

// ═══════════════════════════════════════════
// 3. REGISTRAR OBSERVACIÓN ACADÉMICA
// ═══════════════════════════════════════════
router.post('/docente-becas/observaciones', authRequired, resolveDocente, async (req, res) => {
  try {
    const { id_solicitud, tipo_observacion, observacion, es_interna } = req.body;
    if (!id_solicitud || !observacion) {
      return res.status(400).json({ ok: false, message: 'id_solicitud y observacion son requeridos.' });
    }

    const nombre = [req.user.nombres, req.user.apellido_paterno, req.user.apellido_materno || '']
      .filter(Boolean).join(' ').trim() || 'Docente';

    const [result] = await pool.execute(
      `INSERT INTO ia_becas_observaciones (id_solicitud, id_usuario, nombre_usuario, rol_usuario, tipo_observacion, observacion, es_interna)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_solicitud, req.user.id_usuario, nombre, roleName(req.user) || 'DOCENTE',
        tipo_observacion || 'ACADEMICA', observacion, es_interna ? 1 : 0
      ]
    );

    return res.json({
      ok: true,
      message: 'Observación registrada correctamente.',
      data: { id_observacion: result.insertId }
    });
  } catch (error) {
    console.error('[iaBecasDocente] registrar observacion error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al registrar observación.' });
  }
});

// ═══════════════════════════════════════════
// 4. LISTAR OBSERVACIONES DE UNA SOLICITUD
// ═══════════════════════════════════════════
router.get('/docente-becas/observaciones/:idSolicitud', authRequired, resolveDocente, async (req, res) => {
  try {
    const idSolicitud = toNum(req.params.idSolicitud, 0);
    if (!idSolicitud) {
      return res.status(400).json({ ok: false, message: 'ID de solicitud inválido.' });
    }

    const [rows] = await pool.execute(
      `SELECT id_observacion, id_solicitud, id_usuario, nombre_usuario, rol_usuario,
              tipo_observacion, observacion, es_interna, fecha_observacion, created_at
       FROM ia_becas_observaciones
       WHERE id_solicitud = ?
       ORDER BY fecha_observacion DESC`,
      [idSolicitud]
    );

    return res.json({ ok: true, data: rows || [] });
  } catch (error) {
    console.error('[iaBecasDocente] listar observaciones error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar observaciones.' });
  }
});

// ═══════════════════════════════════════════
// 5. RECOMENDAR CANALIZACIÓN
// ═══════════════════════════════════════════
router.post('/docente-becas/canalizar', authRequired, resolveDocente, async (req, res) => {
  try {
    const { id_solicitud, area_destino, motivo } = req.body;
    if (!id_solicitud || !area_destino) {
      return res.status(400).json({ ok: false, message: 'id_solicitud y area_destino son requeridos.' });
    }

    const areasValidas = ['TUTORIAS', 'PSICOLOGIA', 'TRABAJO_SOCIAL', 'COMITE_BECAS', 'COORDINACION_ACADEMICA', 'SERVICIOS_ESCOLARES', 'OTRO'];
    if (!areasValidas.includes(area_destino)) {
      return res.status(400).json({ ok: false, message: `Area destino inválida. Debe ser: ${areasValidas.join(', ')}` });
    }

    const nombre = [req.user.nombres, req.user.apellido_paterno, req.user.apellido_materno || '']
      .filter(Boolean).join(' ').trim() || 'Docente';

    const [result] = await pool.execute(
      `INSERT INTO ia_becas_canalizaciones (id_solicitud, id_usuario_origen, nombre_usuario_origen, area_destino, motivo, estatus_canalizacion)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE')`,
      [id_solicitud, req.user.id_usuario, nombre, area_destino, motivo || '']
    );

    await pool.execute(
      `UPDATE ia_becas_solicitudes SET canalizado_a = ? WHERE id_solicitud = ?`,
      [area_destino, id_solicitud]
    );

    return res.json({
      ok: true,
      message: `Canalización a ${area_destino} registrada correctamente.`,
      data: { id_canalizacion: result.insertId }
    });
  } catch (error) {
    console.error('[iaBecasDocente] canalizar error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al canalizar.' });
  }
});

// ═══════════════════════════════════════════
// 6. SEGUIMIENTO (solicitudes donde el docente participó)
// ═══════════════════════════════════════════
router.get('/docente-becas/seguimiento', authRequired, resolveDocente, async (req, res) => {
  try {
    const esAdminOCoord = isAdminOrCoord(req.user);
    const idUsuario = Number(req.user.id_usuario || 0);

    let whereExtra = '';
    const params = [];
    if (!esAdminOCoord && idUsuario) {
      whereExtra = 'AND (o.id_usuario = ? OR cz.id_usuario_origen = ?)';
      params.push(idUsuario, idUsuario);
    }

    const pagina = Math.max(1, toNum(req.query.pagina, 1));
    const limite = Math.min(50, Math.max(1, toNum(req.query.limite, 20)));
    const offset = (pagina - 1) * limite;

    const [countRows] = await pool.execute(`
      SELECT COUNT(DISTINCT s.id_solicitud) AS total
      FROM ia_becas_solicitudes s
      LEFT JOIN ia_becas_observaciones o ON o.id_solicitud = s.id_solicitud
      LEFT JOIN ia_becas_canalizaciones cz ON cz.id_solicitud = s.id_solicitud
      WHERE 1=1 ${whereExtra}
    `, params);
    const total = countRows[0].total;

    const [rows] = await pool.execute(`
      SELECT DISTINCT
        s.id_solicitud, s.codigo_solicitud, s.nombre_alumno, s.matricula,
        s.nombre_carrera, s.periodo_nombre, s.estatus_solicitud, s.prioridad,
        s.fecha_solicitud,
        cs.titulo AS convocatoria_titulo,
        COUNT(DISTINCT o.id_observacion) AS total_observaciones,
        GROUP_CONCAT(DISTINCT cz.area_destino SEPARATOR ', ') AS areas_canalizacion
      FROM ia_becas_solicitudes s
      JOIN ia_becas_convocatorias cs ON cs.id_convocatoria = s.id_convocatoria
      LEFT JOIN ia_becas_observaciones o ON o.id_solicitud = s.id_solicitud
      LEFT JOIN ia_becas_canalizaciones cz ON cz.id_solicitud = s.id_solicitud
      WHERE 1=1 ${whereExtra}
      GROUP BY s.id_solicitud
      ORDER BY s.fecha_solicitud DESC
      LIMIT ? OFFSET ?
    `, [...params, limite, offset]);

    return res.json({
      ok: true,
      data: rows || [],
      meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('[iaBecasDocente] seguimiento error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar seguimiento.' });
  }
});

// ═══════════════════════════════════════════
// 7. DETALLE DE ALUMNO (solicitudes, observaciones, canalizaciones)
// ═══════════════════════════════════════════
router.get('/docente-becas/alumno/:idAlumno/detalle', authRequired, resolveDocente, async (req, res) => {
  try {
    const idAlumno = toNum(req.params.idAlumno, 0);
    if (!idAlumno) return res.status(400).json({ ok: false, message: 'ID de alumno inválido.' });

    const [alumno] = await pool.execute(`
      SELECT a.*, c.nombre_carrera, k.promedio_general, k.creditos_acumulados
      FROM alumnos a
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [idAlumno]);

    if (!alumno.length) return res.status(404).json({ ok: false, message: 'Alumno no encontrado.' });

    const [solicitudes] = await pool.execute(`
      SELECT s.id_solicitud, s.codigo_solicitud, s.estatus_solicitud, s.prioridad,
             s.fecha_solicitud, c.titulo AS convocatoria_titulo
      FROM ia_becas_solicitudes s
      JOIN ia_becas_convocatorias c ON c.id_convocatoria = s.id_convocatoria
      WHERE s.id_alumno = ?
      ORDER BY s.fecha_solicitud DESC
    `, [idAlumno]);

    return res.json({
      ok: true,
      data: {
        alumno: alumno[0],
        solicitudes: solicitudes || []
      }
    });
  } catch (error) {
    console.error('[iaBecasDocente] detalle alumno error:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al cargar detalle del alumno.' });
  }
});

module.exports = router;
