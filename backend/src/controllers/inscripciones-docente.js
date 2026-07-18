'use strict';

const pool = require('../config/db');

function isDocenteRole(user) {
  const roleName = String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
  const roleId = Number(user?.rol_id || user?.id_rol || 0);
  return roleName === 'DOCENTE' || roleId === 3;
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

async function getMisGrupos(req, res) {
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
        ca.id_carga_academica,
        ca.id_periodo,
        p.nombre_periodo,
        ca.id_grupo,
        g.nombre_grupo,
        g.semestre,
        g.turno,
        ca.id_materia,
        m.nombre_materia,
        m.clave_materia,
        ca.estado AS estado_carga,
        ca.observaciones,
        COUNT(DISTINCT ga.id_alumno) AS total_alumnos
      FROM cargas_academicas ca
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      WHERE ca.id_docente = ?
      GROUP BY ca.id_carga_academica, ca.id_periodo, p.nombre_periodo, ca.id_grupo, g.nombre_grupo, g.semestre, g.turno, ca.id_materia, m.nombre_materia, m.clave_materia, ca.estado, ca.observaciones
      ORDER BY p.fecha_inicio DESC, g.semestre ASC, g.nombre_grupo ASC, m.nombre_materia ASC
    `, [docente.id_docente]);

    return res.json({ ok: true, data: rows, docente: { id: docente.id_docente, clave: docente.clave_docente } });
  } catch (error) {
    console.error('Error al obtener grupos del docente:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos asignados' });
  }
}

async function getListaAlumnos(req, res) {
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
      return res.status(403).json({ ok: false, message: 'No tienes asignado este grupo en el periodo indicado' });
    }

    const [rows] = await pool.execute(`
      SELECT
        ga.id_grupo_alumno,
        ga.id_alumno,
        ga.estado AS estado_en_grupo,
        ga.created_at AS fecha_asignacion,
        a.matricula,
        a.curp,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.correo_institucional,
        u.correo_personal,
        u.telefono,
        i.estado AS estado_inscripcion,
        i.tipo_inscripcion,
        i.fecha_solicitud,
        COALESCE(i.comprobante_pago, '') AS comprobante_pago
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN inscripciones i ON i.id_alumno = a.id_alumno AND i.id_periodo = ga.id_periodo AND i.id_grupo = ga.id_grupo
      WHERE ga.id_grupo = ? AND ga.id_periodo = ?
      ORDER BY u.apellido_paterno ASC, u.apellido_materno ASC, u.nombres ASC
    `, [idGrupo, idPeriodo]);

    const [materias] = await pool.execute(`
      SELECT ca.id_materia, m.clave_materia, m.nombre_materia, ca.estado AS estado_carga
      FROM cargas_academicas ca
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      WHERE ca.id_docente = ? AND ca.id_grupo = ? AND ca.id_periodo = ?
    `, [docente.id_docente, idGrupo, idPeriodo]);

    const [infoGrupo] = await pool.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, g.cupo_maximo,
             p.nombre_periodo,
             c.nombre_carrera,
             (SELECT COUNT(*) FROM grupos_alumnos WHERE id_grupo = g.id_grupo AND id_periodo = ? AND estado = 'ACTIVO') AS inscritos_activos,
             (SELECT COUNT(*) FROM grupos_alumnos WHERE id_grupo = g.id_grupo AND id_periodo = ? AND estado = 'BAJA') AS bajas,
             (SELECT COUNT(*) FROM grupos_alumnos WHERE id_grupo = g.id_grupo AND id_periodo = ?) AS total_asignados
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      WHERE g.id_grupo = ?
    `, [idPeriodo, idPeriodo, idPeriodo, idGrupo]);

    return res.json({
      ok: true,
      data: {
        grupo: infoGrupo[0] || null,
        materias,
        alumnos: rows
      }
    });
  } catch (error) {
    console.error('Error al obtener lista de alumnos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener lista de alumnos' });
  }
}

async function getCambiosInscripcion(req, res) {
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
      const [rows] = await pool.execute(`
        SELECT
          ia.id_auditoria,
          ia.id_inscripcion,
          ia.accion,
          ia.detalle,
          ia.estado_anterior,
          ia.estado_nuevo,
          ia.creado_en,
          CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno_nombre,
          a.matricula,
          i.id_grupo,
          i.id_periodo,
          g.nombre_grupo,
          p.nombre_periodo
        FROM inscripciones_auditoria ia
        INNER JOIN inscripciones i ON i.id_inscripcion = ia.id_inscripcion
        INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
        INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
        LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
        LEFT JOIN periodos p ON p.id_periodo = i.id_periodo
        WHERE i.id_grupo IN (
          SELECT DISTINCT ca.id_grupo FROM cargas_academicas ca WHERE ca.id_docente = ?
        )
        AND i.id_periodo IN (
          SELECT DISTINCT ca.id_periodo FROM cargas_academicas ca WHERE ca.id_docente = ?
        )
        ORDER BY ia.creado_en DESC
        LIMIT 100
      `, [docente.id_docente, docente.id_docente]);

      return res.json({ ok: true, data: rows });
    }

    const [carga] = await pool.execute(
      'SELECT id_carga_academica FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ? LIMIT 1',
      [docente.id_docente, idGrupo, idPeriodo]
    );
    if (!carga.length) {
      return res.status(403).json({ ok: false, message: 'No tienes asignado este grupo en el periodo indicado' });
    }

    const [rows] = await pool.execute(`
      SELECT
        ia.id_auditoria,
        ia.id_inscripcion,
        ia.accion,
        ia.detalle,
        ia.estado_anterior,
        ia.estado_nuevo,
        ia.creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno_nombre,
        a.matricula,
        i.id_grupo,
        i.id_periodo
      FROM inscripciones_auditoria ia
      INNER JOIN inscripciones i ON i.id_inscripcion = ia.id_inscripcion
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE i.id_grupo = ? AND i.id_periodo = ?
      ORDER BY ia.creado_en DESC
      LIMIT 100
    `, [idGrupo, idPeriodo]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener cambios de inscripción:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener cambios de inscripción' });
  }
}

async function getNotificaciones(req, res) {
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
        n.id_notificacion,
        n.id_docente,
        n.id_grupo,
        g.nombre_grupo,
        n.id_periodo,
        p.nombre_periodo,
        n.tipo,
        n.mensaje,
        n.leida,
        n.created_at
      FROM notificaciones_docente n
      LEFT JOIN grupos g ON g.id_grupo = n.id_grupo
      LEFT JOIN periodos p ON p.id_periodo = n.id_periodo
      WHERE n.id_docente = ?
      ORDER BY n.created_at DESC
      LIMIT 100
    `, [docente.id_docente]);

    const [noLeidas] = await pool.execute(
      'SELECT COUNT(*) AS total FROM notificaciones_docente WHERE id_docente = ? AND leida = 0',
      [docente.id_docente]
    );

    return res.json({
      ok: true,
      data: rows,
      noLeidas: noLeidas[0].total
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener notificaciones' });
  }
}

async function marcarNotificacionLeida(req, res) {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }

    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    const idNotificacion = Number(req.params.id);
    if (!idNotificacion) {
      return res.status(400).json({ ok: false, message: 'ID de notificación inválido' });
    }

    await pool.execute(
      'UPDATE notificaciones_docente SET leida = 1 WHERE id_notificacion = ? AND id_docente = ?',
      [idNotificacion, docente.id_docente]
    );

    return res.json({ ok: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar notificación' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    if (!isDocenteRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso solo para docentes' });
    }

    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    await pool.execute(
      'UPDATE notificaciones_docente SET leida = 1 WHERE id_docente = ? AND leida = 0',
      [docente.id_docente]
    );

    return res.json({ ok: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar notificaciones' });
  }
}

async function getInconsistencias(req, res) {
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
      const [rows] = await pool.execute(`
        SELECT
          ca.id_grupo,
          g.nombre_grupo,
          ca.id_periodo,
          p.nombre_periodo,
          ca.id_materia,
          m.nombre_materia,
          COUNT(DISTINCT ga.id_alumno) AS alumnos_asignados,
          COUNT(DISTINCT i.id_inscripcion) AS inscripciones_formales,
          (SELECT COUNT(*) FROM grupos_alumnos WHERE id_grupo = ca.id_grupo AND id_periodo = ca.id_periodo AND estado IN ('BAJA', 'TRANSFERIDO')) AS bajas_transferencias,
          COALESCE(g.nombre_grupo, '') AS grupo_nombre
        FROM cargas_academicas ca
        INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
        INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
        INNER JOIN materias m ON m.id_materia = ca.id_materia
        LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
        LEFT JOIN inscripciones i ON i.id_grupo = ca.id_grupo AND i.id_periodo = ca.id_periodo AND i.estado IN ('Activo', 'Aprobada', 'Validada', 'Completada')
        WHERE ca.id_docente = ?
        GROUP BY ca.id_grupo, g.nombre_grupo, ca.id_periodo, p.nombre_periodo, ca.id_materia, m.nombre_materia
        HAVING alumnos_asignados != inscripciones_formales OR bajas_transferencias > 0
        ORDER BY g.nombre_grupo, m.nombre_materia
      `, [docente.id_docente]);

      return res.json({ ok: true, data: rows });
    }

    const [carga] = await pool.execute(
      'SELECT id_carga_academica FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ? AND id_periodo = ? LIMIT 1',
      [docente.id_docente, idGrupo, idPeriodo]
    );
    if (!carga.length) {
      return res.status(403).json({ ok: false, message: 'No tienes asignado este grupo en el periodo indicado' });
    }

    const [rows] = await pool.execute(`
      SELECT
        'alumno_sin_inscripcion_formal' AS tipo_inconsistencia,
        ga.id_alumno,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        'Alumno asignado al grupo pero sin inscripción formal activa en el periodo' AS descripcion
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN inscripciones i ON i.id_alumno = ga.id_alumno AND i.id_periodo = ga.id_periodo AND i.estado IN ('Activo', 'Aprobada', 'Validada', 'Completada')
      WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado = 'ACTIVO' AND i.id_inscripcion IS NULL
      UNION ALL
      SELECT
        'inscripcion_sin_grupo_alumno' AS tipo_inconsistencia,
        i.id_alumno,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        CONCAT('Inscripción activa en este grupo/periodo pero no registrada en grupos_alumnos (id_inscripcion: ', i.id_inscripcion, ')') AS descripcion
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN grupos_alumnos ga ON ga.id_alumno = i.id_alumno AND ga.id_grupo = i.id_grupo AND ga.id_periodo = i.id_periodo
      WHERE i.id_grupo = ? AND i.id_periodo = ? AND i.estado IN ('Activo', 'Aprobada', 'Validada', 'Completada') AND ga.id_grupo_alumno IS NULL
      UNION ALL
      SELECT
        'baja_reciente' AS tipo_inconsistencia,
        ga.id_alumno,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        CONCAT('Alumno dado de baja en el grupo (estado: ', ga.estado, ')') AS descripcion
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE ga.id_grupo = ? AND ga.id_periodo = ? AND ga.estado IN ('BAJA', 'TRANSFERIDO')
      ORDER BY tipo_inconsistencia
    `, [idGrupo, idPeriodo, idGrupo, idPeriodo, idGrupo, idPeriodo]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener inconsistencias:', error);
    return res.status(500).json({ ok: false, message: 'Error al detectar inconsistencias' });
  }
}

module.exports = {
  getMisGrupos,
  getListaAlumnos,
  getCambiosInscripcion,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  getInconsistencias
};
