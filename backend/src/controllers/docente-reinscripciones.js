'use strict';

const pool = require('../config/db');

function isDocenteRole(user) {
  const roleName = String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
  const roleId = Number(user?.rol_id || user?.id_rol || 0);
  return roleName === 'DOCENTE' || roleId === 3;
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente, clave_docente, CONCAT(nombres, " ", apellido_paterno, " ", apellido_materno) AS nombre_completo FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

// =====================================================
// 1. GRUPOS ACTUALIZADOS (solo periodo activo o reciente)
// =====================================================
exports.getGruposActualizados = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const [periodoActivo] = await pool.execute(
      `SELECT id_periodo, nombre_periodo FROM periodos WHERE estado = 'Activo' ORDER BY id_periodo DESC LIMIT 1`
    );

    const [rows] = await pool.execute(`
      SELECT
        ca.id_carga_academica, ca.id_periodo, p.nombre_periodo,
        ca.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        ca.id_materia, m.nombre_materia, m.clave_materia,
        ca.estado AS estado_carga, ca.observaciones,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos,
        (SELECT COUNT(*) FROM inscripciones i
         INNER JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
         WHERE i.id_grupo = ca.id_grupo AND i.id_periodo = ca.id_periodo
           AND i.tipo_inscripcion = 'Reinscripcion') AS reinscritos,
        (SELECT COUNT(*) FROM grupos_alumnos ga2
         WHERE ga2.id_grupo = ca.id_grupo AND ga2.id_periodo = ca.id_periodo
           AND ga2.estado = 'BAJA') AS bajas
      FROM cargas_academicas ca
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      WHERE ca.id_docente = ?
        AND (ca.id_periodo = COALESCE(?, ca.id_periodo) OR ? IS NULL)
      GROUP BY ca.id_carga_academica, ca.id_periodo, p.nombre_periodo, ca.id_grupo, g.nombre_grupo,
               g.semestre, g.turno, ca.id_materia, m.nombre_materia, m.clave_materia, ca.estado, ca.observaciones
      ORDER BY p.fecha_inicio DESC, g.semestre ASC, g.nombre_grupo ASC, m.nombre_materia ASC
    `, [docente.id_docente, periodoActivo?.id_periodo || null, periodoActivo?.id_periodo || null]);

    return res.json({
      ok: true,
      data: rows,
      periodoActivo: periodoActivo || null,
      docente: { id: docente.id_docente, clave: docente.clave_docente, nombre: docente.nombre_completo }
    });
  } catch (error) {
    console.error('Error getGruposActualizados:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos actualizados' });
  }
};

// =====================================================
// 2. LISTA DE ALUMNOS REINSCRITOS (por grupo)
// =====================================================
exports.getListaReinscritos = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const idGrupo = Number(req.params.idGrupo);
    const idPeriodo = Number(req.params.idPeriodo);
    if (!idGrupo || !idPeriodo) {
      return res.status(400).json({ ok: false, message: 'Se requieren idGrupo e idPeriodo' });
    }

    const [carga] = await pool.execute(
      'SELECT id_carga_academica FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ? LIMIT 1',
      [docente.id_docente, idGrupo, idPeriodo]
    );
    if (!carga.length) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso a este grupo' });
    }

    const [rows] = await pool.execute(`
      SELECT
        a.id_alumno, a.matricula, a.numero_control,
        CONCAT(a.apellido_paterno, ' ', apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.correo_institucional, a.telefono,
        i.id_inscripcion, i.fecha_inscripcion, i.estado AS estado_inscripcion,
        i.tipo_inscripcion, i.observaciones,
        r.id_reinscripcion, r.fecha_solicitud, r.fecha_validacion,
        c.nombre_carrera,
        ga.estado AS estado_grupo,
        ga.fecha_asignacion,
        CASE WHEN i.tipo_inscripcion = 'Reinscripcion' THEN 'Sí' ELSE 'No' END AS es_reinscrito
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN inscripciones i ON i.id_alumno = a.id_alumno AND i.id_periodo = ga.id_periodo
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      WHERE ga.id_grupo = ? AND ga.id_periodo = ?
      ORDER BY a.apellido_paterno ASC, a.apellido_materno ASC
    `, [idGrupo, idPeriodo]);

    return res.json({ ok: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Error getListaReinscritos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener lista de reinscritos' });
  }
};

// =====================================================
// 3. CAMBIOS / INCIDENCIAS DE REINSCRIPCIÓN
// =====================================================
exports.getCambiosReinscripcion = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const idGrupo = Number(req.params.idGrupo);
    const idPeriodo = Number(req.params.idPeriodo);

    let whereExtra = '';
    const params = [docente.id_docente];
    if (idGrupo) { whereExtra += ' AND ga.id_grupo = ?'; params.push(idGrupo); }
    if (idPeriodo) { whereExtra += ' AND ga.id_periodo = ?'; params.push(idPeriodo); }

    const [rows] = await pool.execute(`
      SELECT
        ga.id_grupo_alumno, ga.id_alumno, ga.id_grupo, ga.id_periodo,
        ga.estado AS estado_grupo, ga.fecha_asignacion, ga.motivo_cambio,
        g.nombre_grupo, g.semestre, g.turno,
        p.nombre_periodo,
        a.matricula,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno_nombre,
        i.tipo_inscripcion, i.estado AS estado_inscripcion,
        i.observaciones AS observaciones_inscripcion,
        c.nombre_carrera AS carrera_actual,
        CASE
          WHEN ga.estado = 'BAJA' THEN 'baja'
          WHEN ga.estado = 'CANCELADO' THEN 'cancelacion'
          WHEN ga.motivo_cambio LIKE '%cambio%grupo%' THEN 'cambio_grupo'
          WHEN ga.motivo_cambio LIKE '%cambio%carrera%' THEN 'cambio_carrera'
          WHEN i.tipo_inscripcion = 'Reinscripcion' AND ga.estado = 'ACTIVO' THEN 'reinscrito'
          ELSE 'otro'
        END AS tipo_incidencia
      FROM grupos_alumnos ga
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN periodos p ON p.id_periodo = ga.id_periodo
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN inscripciones i ON i.id_alumno = a.id_alumno AND i.id_periodo = ga.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      WHERE EXISTS (
        SELECT 1 FROM cargas_academicas ca
        WHERE ca.id_docente = ? AND ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
      )
      ${whereExtra}
      ORDER BY ga.fecha_asignacion DESC, a.apellido_paterno ASC
    `, params);

    const resumen = {
      total: rows.length,
      reinscritos: rows.filter(r => r.tipo_incidencia === 'reinscrito').length,
      bajas: rows.filter(r => r.tipo_incidencia === 'baja').length,
      cambios_grupo: rows.filter(r => r.tipo_incidencia === 'cambio_grupo').length,
      cambios_carrera: rows.filter(r => r.tipo_incidencia === 'cambio_carrera').length,
      otros: rows.filter(r => r.tipo_incidencia === 'otro' || r.tipo_incidencia === 'cancelacion').length
    };

    return res.json({ ok: true, data: rows, resumen });
  } catch (error) {
    console.error('Error getCambiosReinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener cambios de reinscripción' });
  }
};

// =====================================================
// 4. NOTIFICACIONES DE CONTINUIDAD
// =====================================================
exports.getNotificaciones = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const tipo = req.query.tipo || null;
    let whereExtra = '';
    const params = [docente.id_docente];
    if (tipo) { whereExtra += ' AND dnr.tipo = ?'; params.push(tipo); }

    const [rows] = await pool.execute(`
      SELECT
        dnr.id_notificacion, dnr.tipo, dnr.mensaje, dnr.leida, dnr.creado_en,
        a.matricula,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno_nombre,
        g.nombre_grupo,
        p.nombre_periodo
      FROM docente_notificaciones_reinscripcion dnr
      LEFT JOIN alumnos a ON a.id_alumno = dnr.id_alumno
      LEFT JOIN grupos g ON g.id_grupo = dnr.id_grupo
      LEFT JOIN periodos p ON p.id_periodo = dnr.id_periodo
      WHERE dnr.id_docente = ?
      ${whereExtra}
      ORDER BY dnr.creado_en DESC
      LIMIT 100
    `, params);

    const noLeidas = rows.filter(r => !r.leida).length;

    return res.json({ ok: true, data: rows, noLeidas });
  } catch (error) {
    console.error('Error getNotificaciones docente reinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener notificaciones' });
  }
};

exports.marcarNotificacionLeida = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const { id } = req.params;
    await pool.execute(
      'UPDATE docente_notificaciones_reinscripcion SET leida = 1 WHERE id_notificacion = ? AND id_docente = ?',
      [Number(id), docente.id_docente]
    );
    return res.json({ ok: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error marcarNotificacionLeida:', error);
    return res.status(500).json({ ok: false, message: 'Error al marcar notificación' });
  }
};

exports.marcarTodasLeidas = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    await pool.execute(
      'UPDATE docente_notificaciones_reinscripcion SET leida = 1 WHERE id_docente = ? AND leida = 0',
      [docente.id_docente]
    );
    return res.json({ ok: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error marcarTodasLeidas:', error);
    return res.status(500).json({ ok: false, message: 'Error al marcar notificaciones' });
  }
};

// =====================================================
// 5. RESUMEN POR GRUPO (estadísticas de reinscripción)
// =====================================================
exports.getResumenGrupos = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const [rows] = await pool.execute(`
      SELECT
        ca.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        ca.id_periodo, p.nombre_periodo,
        ca.id_materia, m.nombre_materia, m.clave_materia,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos,
        SUM(CASE WHEN i.tipo_inscripcion = 'Reinscripcion' THEN 1 ELSE 0 END) AS reinscritos,
        SUM(CASE WHEN ga.estado = 'BAJA' THEN 1 ELSE 0 END) AS bajas,
        SUM(CASE WHEN ga.estado = 'ACTIVO' AND (ga.motivo_cambio LIKE '%cambio%grupo%' OR ga.motivo_cambio LIKE '%reubicacion%') THEN 1 ELSE 0 END) AS cambios_grupo,
        SUM(CASE WHEN i.tipo_inscripcion = 'Primera_Vez' AND ga.estado = 'ACTIVO' THEN 1 ELSE 0 END) AS nuevos,
        SUM(CASE WHEN ga.estado = 'ACTIVO' AND i.observaciones LIKE '%incidencia%' THEN 1 ELSE 0 END) AS incidencias,
        (
          SELECT COUNT(*) FROM reinscripcion_auditoria ra
          INNER JOIN inscripciones ii ON ii.id_inscripcion = ra.id_inscripcion
          WHERE ii.id_grupo = ca.id_grupo AND ii.id_periodo = ca.id_periodo
        ) AS movimientos_auditados
      FROM cargas_academicas ca
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo
      LEFT JOIN inscripciones i ON i.id_alumno = ga.id_alumno AND i.id_periodo = ga.id_periodo
      WHERE ca.id_docente = ?
      GROUP BY ca.id_grupo, g.nombre_grupo, g.semestre, g.turno,
               ca.id_periodo, p.nombre_periodo, ca.id_materia, m.nombre_materia, m.clave_materia
      ORDER BY p.fecha_inicio DESC, g.semestre ASC, g.nombre_grupo ASC
    `, [docente.id_docente]);

    const global = {
      total_grupos: rows.length,
      total_alumnos: rows.reduce((s, r) => s + Number(r.total_alumnos), 0),
      total_reinscritos: rows.reduce((s, r) => s + Number(r.reinscritos), 0),
      total_bajas: rows.reduce((s, r) => s + Number(r.bajas), 0),
      total_cambios_grupo: rows.reduce((s, r) => s + Number(r.cambios_grupo), 0),
      total_nuevos: rows.reduce((s, r) => s + Number(r.nuevos), 0),
      total_incidencias: rows.reduce((s, r) => s + Number(r.incidencias), 0)
    };

    return res.json({ ok: true, data: rows, global });
  } catch (error) {
    console.error('Error getResumenGrupos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen de grupos' });
  }
};

// =====================================================
// 6. CARGA ACADÉMICA ACTUALIZADA
// =====================================================
exports.getCargaAcademica = async (req, res) => {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const [rows] = await pool.execute(`
      SELECT
        ca.id_carga_academica, ca.id_periodo, p.nombre_periodo,
        ca.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        ca.id_materia, m.nombre_materia, m.clave_materia, m.creditos,
        ca.estado AS estado_carga, ca.observaciones,
        ca.horas_teoricas, ca.horas_practicas,
        ca.fecha_asignacion, ca.fecha_actualizacion,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos,
        GROUP_CONCAT(DISTINCT CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) SEPARATOR ', ') AS docentes_asignados
      FROM cargas_academicas ca
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo
      LEFT JOIN alumnos a ON a.id_alumno = ga.id_alumno
      WHERE ca.id_docente = ?
      GROUP BY ca.id_carga_academica, ca.id_periodo, p.nombre_periodo, ca.id_grupo, g.nombre_grupo,
               g.semestre, g.turno, ca.id_materia, m.nombre_materia, m.clave_materia, m.creditos,
               ca.estado, ca.observaciones, ca.horas_teoricas, ca.horas_practicas,
               ca.fecha_asignacion, ca.fecha_actualizacion
      ORDER BY p.fecha_inicio DESC, g.semestre ASC, m.nombre_materia ASC
    `, [docente.id_docente]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error getCargaAcademica:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener carga académica' });
  }
};
