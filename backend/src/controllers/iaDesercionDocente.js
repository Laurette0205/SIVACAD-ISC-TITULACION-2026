'use strict';

const pool = require('../config/db');

function roleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
}

function roleId(user) {
  return Number(user?.rol_id || user?.id_rol || 0);
}

function isDocente(user) {
  const rn = roleName(user);
  const ri = roleId(user);
  return rn === 'DOCENTE' || ri === 3;
}

function isAdminOrCoord(user) {
  const rn = roleName(user);
  const ri = roleId(user);
  return rn === 'ADMINISTRADOR' || ri === 1 || rn === 'COORDINADOR' || ri === 2;
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

async function docenteTieneAccesoAGrupo(conn, idDocente, idGrupo) {
  if (idDocente == null) return true;
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS cnt FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ?',
    [idDocente, idGrupo]
  );
  return rows[0].cnt > 0;
}

async function docenteTieneAccesoAAlumno(conn, idDocente, idAlumno) {
  if (idDocente == null) return true;
  const [rows] = await conn.execute(`
    SELECT COUNT(*) AS cnt
    FROM grupos_alumnos ga
    JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
    WHERE ca.id_docente = ? AND ga.id_alumno = ? AND ga.estado = 'ACTIVO'
  `, [idDocente, idAlumno]);
  return rows[0].cnt > 0;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── 1. MIS GRUPOS ──
async function misGrupos(req, res) {
  try {
    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);
    if (!idDocente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const docenteId = isDocente(req.user) ? idDocente.id_docente : null;

    const [rows] = await pool.execute(`
      SELECT
        ca.id_carga_academica, ca.id_periodo, ca.id_grupo, ca.id_materia,
        p.nombre_periodo,
        g.nombre_grupo, g.semestre, g.turno,
        m.nombre_materia, m.clave_materia,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos,
        COUNT(DISTINCT ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alertas_criticas,
        SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS alertas_pendientes
      FROM cargas_academicas ca
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = ga.id_alumno AND ia.id_periodo = ca.id_periodo
      ${docenteId ? 'WHERE ca.id_docente = ?' : ''}
      GROUP BY ca.id_carga_academica, ca.id_periodo, ca.id_grupo, ca.id_materia
      ORDER BY p.fecha_inicio DESC, g.semestre, g.nombre_grupo, m.nombre_materia
    `, docenteId ? [docenteId] : []);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener grupos del docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos' });
  }
}

// ── 2. ALUMNOS DE UN GRUPO CON SUS ALERTAS ──
async function alumnosGrupo(req, res) {
  try {
    const { idGrupo } = req.params;
    const { periodoId } = req.query;
    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);

    if (isDocente(req.user)) {
      if (!idDocente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
      const tieneAcceso = await docenteTieneAccesoAGrupo(pool, idDocente.id_docente, idGrupo);
      if (!tieneAcceso) return res.status(403).json({ ok: false, message: 'No tienes acceso a este grupo' });
    }

    const params = [Number(idGrupo)];
    let periodoFilter = '';
    if (periodoId) {
      periodoFilter = 'AND ga.id_periodo = ?';
      params.push(Number(periodoId));
    }

    const [rows] = await pool.execute(`
      SELECT
        a.id_alumno, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        a.semestre_actual, a.estatus_academico,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        ia.id_alerta, ia.nivel_riesgo, ia.puntaje_riesgo, ia.atendida,
        ia.estado_seguimiento, ia.recomendacion, ia.descripcion,
        ia.factores_json, ia.explicacion, ia.revisado_en,
        p.nombre_periodo
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = a.id_alumno AND ia.id_periodo = ga.id_periodo
      LEFT JOIN periodos p ON p.id_periodo = ga.id_periodo
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO' ${periodoFilter}
      ORDER BY ia.puntaje_riesgo DESC, a.matricula ASC
    `, params);

    const alumnos = rows.map(r => ({
      ...r,
      factores: (() => { try { return JSON.parse(r.factores_json || '[]'); } catch { return []; } })()
    }));

    return res.json({ ok: true, data: alumnos });
  } catch (error) {
    console.error('Error al obtener alumnos del grupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumnos' });
  }
}

// ── 3. LISTA DE ALERTAS (docente) ──
async function listAlertas(req, res) {
  try {
    const { nivel_riesgo, atendida, periodoId, busqueda, pagina = 1, limite = 20 } = req.query;
    const page = Math.max(1, parseInt(pagina, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));
    const offset = (page - 1) * limit;

    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);
    if (!idDocente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }
    const docenteId = isDocente(req.user) ? idDocente.id_docente : null;

    const countWhere = [];
    const countParams = [];
    if (docenteId) { countWhere.push('ca.id_docente = ?'); countParams.push(docenteId); }
    if (nivel_riesgo) { countWhere.push('ia.nivel_riesgo = ?'); countParams.push(nivel_riesgo); }
    if (atendida !== undefined && atendida !== '') { countWhere.push('ia.atendida = ?'); countParams.push(Number(atendida)); }
    if (periodoId) { countWhere.push('ia.id_periodo = ?'); countParams.push(Number(periodoId)); }
    if (busqueda) { countWhere.push('(a.matricula LIKE ? OR u.nombres LIKE ? OR u.apellido_paterno LIKE ? OR u.apellido_materno LIKE ?)'); const q = `%${busqueda}%`; countParams.push(q, q, q, q); }

    const countWhereClause = countWhere.length ? 'WHERE ' + countWhere.join(' AND ') : '';

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(DISTINCT ia.id_alerta) AS total
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ia.id_periodo AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      ${countWhereClause}
    `, countParams);

    const total = toNum(countRes?.total);
    const totalPaginas = Math.ceil(total / limit);

    const [rows] = await pool.execute(`
      SELECT DISTINCT ia.id_alerta, ia.id_alumno, ia.id_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.descripcion, ia.recomendacion, ia.atendida, ia.estado_seguimiento,
        ia.modelo_version, ia.explicacion, ia.factores_json, ia.revisado_en,
        a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        a.semestre_actual, a.estatus_academico,
        g.nombre_grupo, m.nombre_materia,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ia.id_periodo AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      ${countWhereClause}
      ORDER BY ia.puntaje_riesgo DESC, ia.id_alerta DESC
      LIMIT ? OFFSET ?
    `, [...countParams, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      total,
      pagina: page,
      limite: limit,
      totalPaginas
    });
  } catch (error) {
    console.error('Error al listar alertas docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alertas' });
  }
}

// ── 4. DETALLE DE ALERTA ──
async function detalleAlerta(req, res) {
  try {
    const { id } = req.params;
    const idDocente = isDocente(req.user) ? await resolveDocenteId(pool, req.user.id_usuario) : null;

    const [[alerta]] = await pool.execute(`
      SELECT ia.*, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        u.correo_institucional AS email, a.semestre_actual, a.estatus_academico,
        a.id_carrera, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        p.nombre_periodo, g.nombre_grupo, m.nombre_materia
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
      LEFT JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ia.id_periodo AND ga.estado = 'ACTIVO'
      LEFT JOIN grupos g ON g.id_grupo = ga.id_grupo
      LEFT JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      LEFT JOIN materias m ON m.id_materia = ca.id_materia
      WHERE ia.id_alerta = ?
      LIMIT 1
    `, [Number(id)]);

    if (!alerta) {
      return res.status(404).json({ ok: false, message: 'Alerta no encontrada' });
    }

    if (isDocente(req.user)) {
      const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente.id_docente, alerta.id_alumno);
      if (!tieneAcceso) {
        return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
      }
    }

    const [seguimientos] = await pool.execute(`
      SELECT s.*, u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido
      FROM ia_seguimientos_desercion s
      LEFT JOIN usuarios u2 ON s.id_usuario = u2.id_usuario
      WHERE s.id_alerta = ?
      ORDER BY s.creado_en DESC
    `, [Number(id)]);

    const [[alertasPrevias]] = await pool.execute(`
      SELECT COUNT(*) AS total FROM ia_alertas_desercion
      WHERE id_alumno = ? AND id_alerta != ?
    `, [alerta.id_alumno, Number(id)]);

    return res.json({
      ok: true,
      data: {
        alerta,
        seguimientos,
        alertas_previas: toNum(alertasPrevias?.total)
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener detalle' });
  }
}

// ── 5. REGISTRAR OBSERVACIÓN ──
async function registrarObservacion(req, res) {
  try {
    const { id_alerta, observaciones, accion } = req.body;
    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);

    if (!idDocente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    if (!id_alerta) {
      return res.status(400).json({ ok: false, message: 'ID de alerta es obligatorio' });
    }

    if (!observaciones || !observaciones.trim()) {
      return res.status(400).json({ ok: false, message: 'Las observaciones son obligatorias' });
    }

    const docAccion = accion || 'Observación docente';

    await pool.execute(
      `INSERT INTO ia_seguimientos_desercion (id_alerta, id_usuario, accion, observaciones, estado)
       VALUES (?, ?, ?, ?, 'En_proceso')`,
      [Number(id_alerta), req.user.id_usuario, docAccion, observaciones.trim()]
    );

    await pool.execute(
      `UPDATE ia_alertas_desercion
       SET estado_seguimiento = 'En_proceso', revisado_en = NOW()
       WHERE id_alerta = ? AND estado_seguimiento = 'Pendiente'`,
      [Number(id_alerta)]
    );

    return res.json({ ok: true, message: 'Observación registrada correctamente' });
  } catch (error) {
    console.error('Error al registrar observación:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar observación' });
  }
}

// ── 6. HISTORIAL DE ATENCIÓN DE UN ALUMNO ──
async function historialAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const idDocente = isDocente(req.user) ? await resolveDocenteId(pool, req.user.id_usuario) : null;

    if (isDocente(req.user)) {
      if (!idDocente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
      const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente.id_docente, idAlumno);
      if (!tieneAcceso) return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
    }

    const [[alumno]] = await pool.execute(`
      SELECT a.id_alumno, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        a.semestre_actual, a.estatus_academico, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
      LIMIT 1
    `, [Number(idAlumno)]);

    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [alertas] = await pool.execute(`
      SELECT ia.id_alerta, ia.id_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.atendida, ia.estado_seguimiento, ia.descripcion, ia.recomendacion,
        ia.factores_json, ia.explicacion, ia.creado_en, ia.revisado_en,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      WHERE ia.id_alumno = ?
      ORDER BY ia.creado_en DESC
    `, [Number(idAlumno)]);

    const [seguimientos] = await pool.execute(`
      SELECT s.*, u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido,
        ia2.nivel_riesgo, ia2.puntaje_riesgo
      FROM ia_seguimientos_desercion s
      INNER JOIN ia_alertas_desercion ia2 ON ia2.id_alerta = s.id_alerta
      LEFT JOIN usuarios u2 ON s.id_usuario = u2.id_usuario
      WHERE ia2.id_alumno = ?
      ORDER BY s.creado_en DESC
    `, [Number(idAlumno)]);

    return res.json({
      ok: true,
      data: {
        alumno,
        alertas: alertas.map(a => ({
          ...a,
          factores: (() => { try { return JSON.parse(a.factores_json || '[]'); } catch { return []; } })()
        })),
        seguimientos
      }
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  }
}

// ── 7. RECOMENDACIONES ──
async function recomendaciones(req, res) {
  try {
    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);
    if (!idDocente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }
    const docenteId = isDocente(req.user) ? idDocente.id_docente : null;

    const [rows] = await pool.execute(`
      SELECT
        ia.id_alerta, a.id_alumno, a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno_nombre,
        ia.nivel_riesgo, ia.puntaje_riesgo, ia.recomendacion, ia.explicacion,
        ia.factores_json, ia.atendida, ia.estado_seguimiento,
        g.nombre_grupo, m.nombre_materia, p.nombre_periodo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ia.id_periodo AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      ${docenteId ? 'WHERE ca.id_docente = ?' : ''}
      ORDER BY ia.puntaje_riesgo DESC, ia.id_alerta DESC
      LIMIT 50
    `, docenteId ? [docenteId] : []);

    const data = rows.map(r => ({
      ...r,
      factores: (() => { try { return JSON.parse(r.factores_json || '[]'); } catch { return []; } })()
    }));

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('Error al obtener recomendaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener recomendaciones' });
  }
}

module.exports = {
  misGrupos,
  alumnosGrupo,
  listAlertas,
  detalleAlerta,
  registrarObservacion,
  historialAlumno,
  recomendaciones
};
