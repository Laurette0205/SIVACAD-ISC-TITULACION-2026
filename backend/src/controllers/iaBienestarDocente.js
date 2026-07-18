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

async function getPeriodoActivo(conn) {
  const [rows] = await conn.execute(
    "SELECT id_periodo, nombre_periodo FROM periodos WHERE activo = 1 LIMIT 1"
  );
  return rows.length ? rows[0] : null;
}

// ── 1. MIS GRUPOS (con conteo de alertas bienestar) ──
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
        c.nombre_carrera,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos,
        COUNT(DISTINCT a.id_alerta) AS total_alertas,
        SUM(CASE WHEN a.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alertas_criticas,
        SUM(CASE WHEN a.estado IN ('PENDIENTE','EN_REVISION') THEN 1 ELSE 0 END) AS alertas_pendientes
      FROM cargas_academicas ca
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      LEFT JOIN alumnos al ON al.id_alumno = ga.id_alumno
      LEFT JOIN ia_bienestar_sesiones s ON s.id_usuario = al.id_usuario AND s.estado = 'ACTIVA'
      LEFT JOIN ia_bienestar_alertas a ON a.id_usuario = al.id_usuario
      ${docenteId ? 'WHERE ca.id_docente = ?' : ''}
      GROUP BY ca.id_carga_academica, ca.id_periodo, ca.id_grupo, ca.id_materia
      ORDER BY p.fecha_inicio DESC, g.semestre, g.nombre_grupo, m.nombre_materia
    `, docenteId ? [docenteId] : []);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener grupos del docente (bienestar):', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos' });
  }
}

// ── 2. ALUMNOS DE UN GRUPO (con datos bienestar) ──
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
        al.id_alumno, al.matricula,
        u.nombres, u.apellido_paterno, u.apellido_materno,
        al.semestre_actual, al.estatus_academico,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        a.id_alerta, a.tipo_alerta, a.nivel_riesgo,
        a.estado AS estado_alerta, a.descripcion, a.accion_sugerida,
        a.creado_en AS alerta_creada_en,
        s.bienestar_score, s.indice_riesgo, s.nivel_riesgo AS sesion_riesgo,
        p.nombre_periodo
      FROM grupos_alumnos ga
      INNER JOIN alumnos al ON al.id_alumno = ga.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = al.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = al.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = al.id_alumno
      LEFT JOIN ia_bienestar_sesiones s ON s.id_usuario = al.id_usuario AND s.estado = 'ACTIVA'
      LEFT JOIN ia_bienestar_alertas a ON a.id_usuario = al.id_usuario
      LEFT JOIN periodos p ON p.id_periodo = ga.id_periodo
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO' ${periodoFilter}
      ORDER BY a.nivel_riesgo DESC, a.creado_en DESC, al.matricula ASC
    `, params);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener alumnos del grupo (bienestar):', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumnos' });
  }
}

// ── 3. ALERTAS TEMPRANAS (docente) ──
async function listAlertas(req, res) {
  try {
    const { nivel_riesgo, estado, periodoId, busqueda, pagina = 1, limite = 20 } = req.query;
    const page = Math.max(1, parseInt(pagina, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));
    const offset = (page - 1) * limit;

    const idDocente = await resolveDocenteId(pool, req.user.id_usuario);
    if (!idDocente && isDocente(req.user)) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }
    const docenteId = isDocente(req.user) ? idDocente.id_docente : null;

    const where = [];
    const params = [];
    if (docenteId) { where.push('ca.id_docente = ?'); params.push(docenteId); }
    if (nivel_riesgo) { where.push('a.nivel_riesgo = ?'); params.push(nivel_riesgo); }
    if (estado) { where.push('a.estado = ?'); params.push(estado); }
    if (periodoId) { where.push('ga.id_periodo = ?'); params.push(Number(periodoId)); }
    if (busqueda) {
      where.push('(al.matricula LIKE ? OR u.nombres LIKE ? OR u.apellido_paterno LIKE ? OR u.apellido_materno LIKE ?)');
      const q = `%${busqueda}%`;
      params.push(q, q, q, q);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(DISTINCT a.id_alerta) AS total
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN alumnos al ON al.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = al.id_alumno AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      ${whereClause}
    `, params);

    const total = toNum(countRes?.total);
    const totalPaginas = Math.ceil(total / limit);

    const [rows] = await pool.execute(`
      SELECT DISTINCT a.id_alerta, a.tipo_alerta, a.nivel_riesgo,
        a.estado AS estado_alerta, a.descripcion, a.accion_sugerida,
        a.requiere_derivacion, a.creado_en, a.metadata_json,
        al.id_alumno, al.matricula,
        u.nombres, u.apellido_paterno, u.apellido_materno,
        al.semestre_actual, al.estatus_academico,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        g.nombre_grupo, m.nombre_materia, c.nombre_carrera,
        p.nombre_periodo
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN alumnos al ON al.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = al.id_alumno AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN kardex_alumno k ON k.id_alumno = al.id_alumno
      LEFT JOIN periodos p ON p.id_periodo = ga.id_periodo
      ${whereClause}
      ORDER BY a.nivel_riesgo DESC, a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const data = rows.map(r => ({
      ...r,
      metadata: (() => { try { return JSON.parse(r.metadata_json || '{}'); } catch { return {}; } })()
    }));

    return res.json({
      ok: true,
      data,
      total,
      pagina: page,
      limite: limit,
      totalPaginas
    });
  } catch (error) {
    console.error('Error al listar alertas bienestar docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alertas' });
  }
}

// ── 4. DETALLE DE ALUMNO (alertas bienestar + checkins + evolución) ──
async function detalleAlumno(req, res) {
  try {
    const { idAlumno } = req.params;
    const idDocente = isDocente(req.user) ? await resolveDocenteId(pool, req.user.id_usuario) : null;

    if (isDocente(req.user)) {
      if (!idDocente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
      const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente.id_docente, idAlumno);
      if (!tieneAcceso) return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
    }

    const [[alumno]] = await pool.execute(`
      SELECT al.id_alumno, al.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        u.correo_institucional AS email, al.semestre_actual, al.estatus_academico,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos al
      INNER JOIN usuarios u ON u.id_usuario = al.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = al.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = al.id_alumno
      WHERE al.id_alumno = ?
      LIMIT 1
    `, [Number(idAlumno)]);

    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [alertas] = await pool.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.nivel_riesgo,
        a.estado AS estado_alerta, a.descripcion, a.accion_sugerida,
        a.requiere_derivacion, a.creado_en,
        COALESCE(d.cont_derivaciones, 0) AS total_derivaciones
      FROM ia_bienestar_alertas a
      LEFT JOIN (
        SELECT id_alerta, COUNT(*) AS cont_derivaciones
        FROM ia_bienestar_derivaciones
        GROUP BY id_alerta
      ) d ON d.id_alerta = a.id_alerta
      WHERE a.id_usuario = ?
      ORDER BY a.creado_en DESC
    `, [alumno.id_usuario]);

    const [checkins] = await pool.execute(`
      SELECT c.id_checkin, c.codigo_plantilla, c.bienestar_score,
        c.indice_riesgo, c.nivel_riesgo,
        c.animo, c.energia, c.sueno, c.estres,
        c.apoyo, c.ambiente, c.carga_academica, c.carga_laboral, c.enfoque,
        c.observaciones, c.creado_en
      FROM ia_bienestar_checkins c
      WHERE c.id_usuario = ?
      ORDER BY c.creado_en DESC
      LIMIT 20
    `, [alumno.id_usuario]);

    const [sesiones] = await pool.execute(`
      SELECT s.id_sesion, s.estado AS estado_sesion, s.nivel_riesgo AS sesion_riesgo,
        s.iniciada_en, s.cerrada_en
      FROM ia_bienestar_sesiones s
      WHERE s.id_usuario = ?
      ORDER BY s.iniciada_en DESC
      LIMIT 10
    `, [alumno.id_usuario]);

    const [derivaciones] = await pool.execute(`
      SELECT d.id_derivacion, d.id_alerta, d.destino, d.motivo,
        d.estado AS estado_derivacion, d.observaciones, d.creado_en,
        u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido
      FROM ia_bienestar_derivaciones d
      LEFT JOIN ia_bienestar_alertas a ON a.id_alerta = d.id_alerta
      LEFT JOIN usuarios u2 ON d.id_usuario = u2.id_usuario
      WHERE a.id_usuario = ?
      ORDER BY d.creado_en DESC
      LIMIT 20
    `, [alumno.id_usuario]);

    return res.json({
      ok: true,
      data: {
        alumno,
        alertas,
        checkins,
        sesiones,
        derivaciones
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle alumno bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener detalle del alumno' });
  }
}

// ── 5. REGISTRAR OBSERVACIÓN / SUGERENCIA ──
async function registrarObservacion(req, res) {
  try {
    const { id_alerta, accion_sugerida, observaciones } = req.body;
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

    const destino = accion_sugerida?.trim() || 'INTERVENCION_DOCENTE';

    await pool.execute(
      `INSERT INTO ia_bienestar_derivaciones (id_alerta, id_usuario, destino, motivo, estado, observaciones)
       VALUES (?, ?, ?, ?, 'PENDIENTE', ?)`,
      [Number(id_alerta), req.user.id_usuario, destino, observaciones.trim(), '']
    );

    await pool.execute(
      `UPDATE ia_bienestar_alertas
       SET estado = 'EN_REVISION'
       WHERE id_alerta = ? AND estado = 'PENDIENTE'`,
      [Number(id_alerta)]
    );

    return res.json({ ok: true, message: 'Observación registrada correctamente' });
  } catch (error) {
    console.error('Error al registrar observación bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar observación' });
  }
}

// ── 6. HISTORIAL DE INTERVENCIÓN ──
async function historialIntervenciones(req, res) {
  try {
    const { idAlumno } = req.params;
    const idDocente = isDocente(req.user) ? await resolveDocenteId(pool, req.user.id_usuario) : null;

    if (isDocente(req.user)) {
      if (!idDocente) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
      const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente.id_docente, idAlumno);
      if (!tieneAcceso) return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
    }

    const [[alumno]] = await pool.execute(`
      SELECT al.id_alumno, al.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        al.semestre_actual, al.estatus_academico, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos al
      INNER JOIN usuarios u ON u.id_usuario = al.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = al.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = al.id_alumno
      WHERE al.id_alumno = ?
      LIMIT 1
    `, [Number(idAlumno)]);

    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [alertas] = await pool.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.nivel_riesgo,
        a.estado AS estado_alerta, a.descripcion, a.accion_sugerida,
        a.requiere_derivacion, a.creado_en
      FROM ia_bienestar_alertas a
      WHERE a.id_usuario = ?
      ORDER BY a.creado_en DESC
    `, [alumno.id_usuario]);

    const [derivaciones] = await pool.execute(`
      SELECT d.id_derivacion, d.id_alerta, d.destino, d.motivo,
        d.estado AS estado_derivacion, d.observaciones, d.creado_en,
        u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido,
        a2.nivel_riesgo
      FROM ia_bienestar_derivaciones d
      LEFT JOIN ia_bienestar_alertas a2 ON a2.id_alerta = d.id_alerta
      LEFT JOIN usuarios u2 ON d.id_usuario = u2.id_usuario
      WHERE a2.id_usuario = ?
      ORDER BY d.creado_en DESC
    `, [alumno.id_usuario]);

    return res.json({
      ok: true,
      data: {
        alumno,
        alertas,
        intervenciones: derivaciones
      }
    });
  } catch (error) {
    console.error('Error al obtener historial bienestar:', error);
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
        a.id_alerta, al.id_alumno, al.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno_nombre,
        a.tipo_alerta, a.nivel_riesgo, a.descripcion, a.accion_sugerida,
        a.estado AS estado_alerta,
        g.nombre_grupo, m.nombre_materia, p.nombre_periodo
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN alumnos al ON al.id_usuario = u.id_usuario
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = al.id_alumno AND ga.estado = 'ACTIVO'
      INNER JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN periodos p ON p.id_periodo = ga.id_periodo
      ${docenteId ? 'WHERE ca.id_docente = ?' : ''}
      ORDER BY a.nivel_riesgo DESC, a.creado_en DESC
      LIMIT 50
    `, docenteId ? [docenteId] : []);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener recomendaciones bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener recomendaciones' });
  }
}

module.exports = {
  misGrupos,
  alumnosGrupo,
  listAlertas,
  detalleAlumno,
  registrarObservacion,
  historialIntervenciones,
  recomendaciones
};
