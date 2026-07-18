'use strict';

const pool = require('../config/db');

function getUserInfo(user) {
  return {
    id_usuario: user?.id_usuario || null,
    nombre: user?.nombre_completo || user?.nombres || 'Sistema',
    ip: user?.ip || null
  };
}

async function registrarAuditoria(conn, data) {
  try {
    await conn.execute(
      `INSERT INTO inscripciones_auditoria
        (id_inscripcion, id_usuario, accion, detalle, estado_anterior, estado_nuevo, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id_inscripcion || null,
        data.id_usuario,
        data.accion,
        data.detalle || null,
        data.estado_anterior || null,
        data.estado_nuevo || null,
        data.ip || null
      ]
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
      console.warn('Tabla inscripciones_auditoria no existe, auditoria omitida');
      return;
    }
    throw error;
  }
}

exports.getBandeja = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const idPeriodo = Number(req.query.id_periodo) || 0;
    const idGrupo = Number(req.query.id_grupo) || 0;
    const estado = req.query.estado || '';
    const busqueda = req.query.busqueda || '';

    const where = ["i.tipo_inscripcion = 'Reinscripcion'"];
    const params = [];

    if (idPeriodo) { where.push('i.id_periodo = ?'); params.push(idPeriodo); }
    if (idGrupo) { where.push('i.id_grupo = ?'); params.push(idGrupo); }
    if (estado) { where.push('i.estado = ?'); params.push(estado); }
    if (busqueda) {
      where.push('(a.matricula LIKE ? OR CONCAT(u.nombres, " ", u.apellido_paterno, " ", u.apellido_materno) LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }

    const [rows] = await conn.execute(`
      SELECT
        i.id_inscripcion, i.id_alumno, i.id_periodo, i.id_grupo, i.id_carrera,
        i.tipo_inscripcion, i.estado, i.fecha_inscripcion, i.fecha_validacion,
        i.observaciones, i.motivo_rechazo, i.comprobante_pago,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        u.correo_institucional,
        p.nombre_periodo,
        g.nombre_grupo,
        c.nombre_carrera,
        r.id_reinscripcion, r.motivo, r.fecha_validacion AS fecha_validacion_reinscripcion,
        CONCAT(uv.nombres, ' ', uv.apellido_paterno) AS validado_por_nombre,
        COALESCE(g.cupo_maximo, 30) AS cupo_maximo,
        (SELECT COUNT(*) FROM inscripciones i2 WHERE i2.id_grupo = i.id_grupo AND i2.id_periodo = i.id_periodo AND i2.estado IN ('Validada','Activo','Aprobada','Completada')) AS cupo_actual
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      LEFT JOIN usuarios uv ON uv.id_usuario = r.validada_por
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.fecha_inscripcion DESC, i.id_inscripcion DESC
      LIMIT 500
    `, params);

    const [resumen] = await conn.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN i.estado IN ('Activo','Aprobada','Completada') THEN 1 ELSE 0 END) AS activas
      FROM inscripciones i
      WHERE i.tipo_inscripcion = 'Reinscripcion'
    `);

    return res.json({
      ok: true,
      data: {
        solicitudes: rows,
        resumen: resumen[0] || { total: 0, pendientes: 0, validadas: 0, rechazadas: 0, canceladas: 0, activas: 0 }
      }
    });
  } catch (error) {
    console.error('Error en getBandeja:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener bandeja de reinscripciones' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getValidacionPorGrupo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const idPeriodo = Number(req.query.id_periodo) || 0;

    let whereExtra = "i.tipo_inscripcion = 'Reinscripcion'";
    const params = [];
    if (idPeriodo) { whereExtra += ' AND i.id_periodo = ?'; params.push(idPeriodo); }

    const [rows] = await conn.execute(`
      SELECT
        g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        p.id_periodo, p.nombre_periodo,
        COUNT(*) AS total_solicitudes,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN i.estado IN ('Activo','Aprobada','Completada') THEN 1 ELSE 0 END) AS activas,
        COALESCE(cg.cupo_maximo, 30) AS cupo_maximo,
        COALESCE(cg.cupo_actual, 0) AS cupo_actual,
        ROUND(COALESCE(cg.cupo_actual, 0) / NULLIF(COALESCE(cg.cupo_maximo, 30), 0) * 100, 1) AS porcentaje_ocupacion
      FROM inscripciones i
      INNER JOIN grupos g ON g.id_grupo = i.id_grupo
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN cupos_grupos cg ON cg.id_grupo = g.id_grupo AND cg.id_periodo = p.id_periodo
      WHERE ${whereExtra} AND i.id_grupo IS NOT NULL
      GROUP BY g.id_grupo, g.nombre_grupo, g.semestre, g.turno, p.id_periodo, p.nombre_periodo, cg.cupo_maximo, cg.cupo_actual
      ORDER BY p.id_periodo DESC, g.nombre_grupo
    `, params);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en getValidacionPorGrupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener validación por grupo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getDetalleAlumno = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const idInscripcion = Number(req.params.id_inscripcion);
    if (!idInscripcion) {
      return res.status(400).json({ ok: false, message: 'ID de inscripción inválido' });
    }

    const [detalle] = await conn.execute(`
      SELECT
        i.id_inscripcion, i.id_alumno, i.id_periodo, i.id_grupo, i.id_carrera,
        i.tipo_inscripcion, i.estado, i.fecha_inscripcion, i.fecha_validacion,
        i.observaciones, i.motivo_rechazo, i.comprobante_pago, i.fecha_comprobante,
        i.actualizado_en, i.validada_por,
        a.matricula, a.curp,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        u.correo_institucional, u.correo_personal, u.telefono,
        p.nombre_periodo,
        g.nombre_grupo, g.semestre, g.turno,
        c.nombre_carrera,
        r.id_reinscripcion, r.motivo, r.fecha_validacion AS fecha_validacion_reinscripcion,
        CONCAT(uv.nombres, ' ', uv.apellido_paterno) AS validado_por_nombre
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      LEFT JOIN usuarios uv ON uv.id_usuario = r.validada_por
      WHERE i.id_inscripcion = ? AND i.tipo_inscripcion = 'Reinscripcion'
      LIMIT 1
    `, [idInscripcion]);

    if (!detalle.length) {
      return res.status(404).json({ ok: false, message: 'Reinscripción no encontrada' });
    }

    const [historialEstados] = await conn.execute(`
      SELECT a.id_auditoria, a.accion, a.detalle, a.estado_anterior, a.estado_nuevo,
        a.ip, a.creado_en,
        CONCAT(ua.nombres, ' ', ua.apellido_paterno) AS usuario_nombre
      FROM inscripciones_auditoria a
      LEFT JOIN usuarios ua ON ua.id_usuario = a.id_usuario
      WHERE a.id_inscripcion = ?
      ORDER BY a.creado_en DESC
    `, [idInscripcion]);

    return res.json({
      ok: true,
      data: {
        detalle: detalle[0],
        historial: historialEstados
      }
    });
  } catch (error) {
    console.error('Error en getDetalleAlumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener detalle del alumno' });
  } finally {
    if (conn) conn.release();
  }
};

exports.updateEstado = async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { estado, motivo_rechazo } = req.body;
    if (!estado) return res.status(400).json({ ok: false, message: 'Estado requerido' });

    const userInfo = getUserInfo(req.user);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.execute(
      "SELECT id_inscripcion, estado, id_grupo, id_periodo FROM inscripciones WHERE id_inscripcion = ? AND tipo_inscripcion = 'Reinscripcion' LIMIT 1",
      [id]
    );

    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: 'Reinscripción no encontrada' });
    }

    const estadoAnterior = existing[0].estado;
    const idGrupo = existing[0].id_grupo;

    const updates = ['estado = ?'];
    const params = [estado];

    if (estado === 'Rechazada' && motivo_rechazo) {
      updates.push('motivo_rechazo = ?');
      params.push(motivo_rechazo);
    }

    if (estado === 'Validada') {
      updates.push('fecha_validacion = NOW()');
    }

    params.push(id);

    await conn.execute(
      `UPDATE inscripciones SET ${updates.join(', ')} WHERE id_inscripcion = ?`,
      params
    );

    if (estado === 'Validada' && idGrupo) {
      await conn.execute(
        `INSERT INTO cupos_grupos (id_grupo, id_periodo, cupo_maximo, cupo_actual)
         VALUES (?, ?, 30, 1)
         ON DUPLICATE KEY UPDATE cupo_actual = cupo_actual + 1`,
        [idGrupo, existing[0].id_periodo]
      );
    }

    if (estado === 'Rechazada' || estado === 'Cancelada') {
      if (estadoAnterior === 'Validada' && idGrupo) {
        await conn.execute(
          `UPDATE cupos_grupos SET cupo_actual = GREATEST(cupo_actual - 1, 0)
           WHERE id_grupo = ? AND id_periodo = ?`,
          [idGrupo, existing[0].id_periodo]
        );
      }
    }

    await registrarAuditoria(conn, {
      id_inscripcion: id,
      id_usuario: userInfo.id_usuario,
      accion: estado === 'Validada' ? 'VALIDAR' : estado === 'Rechazada' ? 'RECHAZAR' : estado === 'Cancelada' ? 'CANCELAR' : 'EDITAR',
      detalle: estado === 'Rechazada' && motivo_rechazo ? `Motivo: ${motivo_rechazo}` : `Estado cambiado a ${estado}`,
      estado_anterior: estadoAnterior,
      estado_nuevo: estado,
      ip: userInfo.ip
    });

    await conn.commit();

    return res.json({ ok: true, message: `Reinscripción ${estado === 'Validada' ? 'validada' : estado === 'Rechazada' ? 'rechazada' : 'actualizada'} correctamente` });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error en updateEstado:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar estado' });
  } finally {
    if (conn) conn.release();
  }
};

exports.asignarGrupo = async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { id_grupo } = req.body;
    if (!id_grupo) return res.status(400).json({ ok: false, message: 'ID del grupo requerido' });

    const userInfo = getUserInfo(req.user);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.execute(
      "SELECT id_inscripcion, id_grupo AS grupo_anterior, id_periodo FROM inscripciones WHERE id_inscripcion = ? AND tipo_inscripcion = 'Reinscripcion' LIMIT 1",
      [id]
    );
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: 'Reinscripción no encontrada' });
    }

    const grupoAnterior = existing[0].grupo_anterior;
    const idPeriodo = existing[0].id_periodo;

    await conn.execute(
      'UPDATE inscripciones SET id_grupo = ? WHERE id_inscripcion = ?',
      [id_grupo, id]
    );

    if (grupoAnterior) {
      await conn.execute(
        `UPDATE cupos_grupos SET cupo_actual = GREATEST(cupo_actual - 1, 0)
         WHERE id_grupo = ? AND id_periodo = ?`,
        [grupoAnterior, idPeriodo]
      );
    }

    await conn.execute(
      `INSERT INTO cupos_grupos (id_grupo, id_periodo, cupo_maximo, cupo_actual)
       VALUES (?, ?, 30, 1)
       ON DUPLICATE KEY UPDATE cupo_actual = cupo_actual + 1`,
      [id_grupo, idPeriodo]
    );

    await registrarAuditoria(conn, {
      id_inscripcion: id,
      id_usuario: userInfo.id_usuario,
      accion: 'EDITAR',
      detalle: `Grupo asignado: ${id_grupo}${grupoAnterior ? ` (anterior: ${grupoAnterior})` : ''}`,
      estado_anterior: null,
      estado_nuevo: null,
      ip: userInfo.ip
    });

    await conn.commit();

    return res.json({ ok: true, message: 'Grupo asignado correctamente' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error en asignarGrupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al asignar grupo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.registrarObservacion = async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { observacion } = req.body;
    if (!observacion) return res.status(400).json({ ok: false, message: 'Observación requerida' });

    const userInfo = getUserInfo(req.user);

    conn = await pool.getConnection();

    const [existing] = await conn.execute(
      "SELECT id_inscripcion, observaciones FROM inscripciones WHERE id_inscripcion = ? AND tipo_inscripcion = 'Reinscripcion' LIMIT 1",
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Reinscripción no encontrada' });
    }

    const obsAnterior = existing[0].observaciones || '';
    const nuevaObs = `[${new Date().toLocaleString('es-MX')}] ${userInfo.nombre}: ${observacion}`;
    const obsActualizada = obsAnterior ? obsAnterior + '\n' + nuevaObs : nuevaObs;

    await conn.execute(
      'UPDATE inscripciones SET observaciones = ? WHERE id_inscripcion = ?',
      [obsActualizada, id]
    );

    await registrarAuditoria(conn, {
      id_inscripcion: id,
      id_usuario: userInfo.id_usuario,
      accion: 'EDITAR',
      detalle: `Observación agregada: ${observacion}`,
      estado_anterior: null,
      estado_nuevo: null,
      ip: userInfo.ip
    });

    return res.json({ ok: true, message: 'Observación registrada correctamente', data: { observaciones: obsActualizada } });
  } catch (error) {
    console.error('Error en registrarObservacion:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar observación' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getCatalogos = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [periodos] = await conn.execute(`
      SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado
      FROM periodos ORDER BY id_periodo DESC LIMIT 20
    `);

    const [grupos] = await conn.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, p.nombre_periodo
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      ORDER BY p.id_periodo DESC, g.nombre_grupo
    `);

    return res.json({ ok: true, data: { periodos, grupos } });
  } catch (error) {
    console.error('Error en getCatalogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  } finally {
    if (conn) conn.release();
  }
};
