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

exports.getBandejaSolicitudes = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const params = [];
    const conditions = ["i.estado = 'Pendiente'"];

    const { periodo, carrera, tipo, busqueda } = req.query;

    if (periodo) {
      conditions.push('i.id_periodo = ?');
      params.push(Number(periodo));
    }
    if (carrera) {
      conditions.push('a.id_carrera = ?');
      params.push(Number(carrera));
    }
    if (tipo) {
      conditions.push('i.tipo_inscripcion = ?');
      params.push(tipo);
    }
    if (busqueda) {
      const term = `%${busqueda}%`;
      conditions.push(`(
        a.matricula LIKE ? OR
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) LIKE ? OR
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) LIKE ?
      )`);
      params.push(term, term, term);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion, i.id_alumno,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno,
        i.id_periodo, p.nombre_periodo,
        i.tipo_inscripcion, i.estado, i.observaciones, i.fecha_inscripcion,
        i.id_carrera, i.id_grupo,
        c.nombre_carrera, g.nombre_grupo,
        a.semestre_actual, a.estatus_academico
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      ${where}
      ORDER BY i.fecha_inscripcion ASC, i.id_inscripcion ASC
      LIMIT 200`,
      params
    );

    const [resumen] = await conn.execute(
      `SELECT
        COUNT(*) AS total_pendientes,
        COUNT(DISTINCT i.id_periodo) AS periodos_involucrados,
        COUNT(DISTINCT COALESCE(i.id_carrera, a.id_carrera)) AS carreras_involucradas
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      WHERE i.estado = 'Pendiente'`
    );

    return res.json({
      ok: true,
      data: rows,
      resumen: resumen[0] || { total_pendientes: 0, periodos_involucrados: 0, carreras_involucradas: 0 },
      total: rows.length
    });
  } catch (error) {
    console.error('Error al obtener bandeja de solicitudes:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener la bandeja de solicitudes' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getValidacionPorGrupo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id_grupo, periodo, carrera } = req.query;
    const params = [];
    const conditions = [];

    if (id_grupo) {
      conditions.push('i.id_grupo = ?');
      params.push(Number(id_grupo));
    }
    if (periodo) {
      conditions.push('i.id_periodo = ?');
      params.push(Number(periodo));
    }
    if (carrera) {
      conditions.push('a.id_carrera = ?');
      params.push(Number(carrera));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion, i.id_alumno,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno,
        i.id_periodo, p.nombre_periodo,
        i.tipo_inscripcion, i.estado, i.observaciones,
        i.fecha_inscripcion, i.id_grupo,
        g.nombre_grupo, g.semestre, g.turno,
        c.nombre_carrera,
        a.semestre_actual, a.estatus_academico
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      INNER JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      ${where}
      ORDER BY g.nombre_grupo, a.apellido_paterno, a.apellido_materno
      LIMIT 500`,
      params
    );

    let gConditions = [];
    const gParams = [];
    if (id_grupo) {
      gConditions.push('g.id_grupo = ?');
      gParams.push(Number(id_grupo));
    }
    if (periodo) {
      gConditions.push('g.id_periodo = ?');
      gParams.push(Number(periodo));
    }
    if (carrera) {
      gConditions.push('g.id_carrera = ?');
      gParams.push(Number(carrera));
    }
    const gWhere = gConditions.length ? `WHERE ${gConditions.join(' AND ')}` : '';

    const [grupos] = await conn.execute(
      `SELECT
        g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        p.nombre_periodo, p.id_periodo,
        COUNT(i.id_inscripcion) AS total_inscripciones,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      LEFT JOIN inscripciones i ON i.id_grupo = g.id_grupo
      ${gWhere}
      GROUP BY g.id_grupo, g.nombre_grupo, g.semestre, g.turno, p.nombre_periodo, p.id_periodo
      ORDER BY g.semestre, g.nombre_grupo
      LIMIT 100`,
      gParams
    );

    return res.json({
      ok: true,
      data: rows,
      grupos: grupos || [],
      total: rows.length
    });
  } catch (error) {
    console.error('Error al obtener validacion por grupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener validacion por grupo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getCuposDisponibles = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id_periodo, id_carrera } = req.query;

    let conditions = '';
    const params = [];
    if (id_periodo) {
      conditions += ' AND cg.id_periodo = ?';
      params.push(Number(id_periodo));
    }
    if (id_carrera) {
      conditions += ' AND g.id_carrera = ?';
      params.push(Number(id_carrera));
    }

    const [rows] = await conn.execute(
      `SELECT
        cg.id_cupo, cg.id_grupo, cg.id_periodo,
        g.nombre_grupo, g.semestre, g.turno,
        p.nombre_periodo,
        c.nombre_carrera,
        cg.cupo_maximo, cg.cupo_actual,
        (cg.cupo_maximo - cg.cupo_actual) AS cupo_disponible,
        ROUND((cg.cupo_actual / cg.cupo_maximo) * 100, 1) AS porcentaje_ocupacion
      FROM cupos_grupos cg
      INNER JOIN grupos g ON g.id_grupo = cg.id_grupo
      INNER JOIN periodos p ON p.id_periodo = cg.id_periodo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      WHERE 1=1 ${conditions}
      ORDER BY c.nombre_carrera, g.semestre, g.nombre_grupo`,
      params
    );

    const [resumen] = await conn.execute(
      `SELECT
        SUM(cupo_maximo) AS cupo_total,
        SUM(cupo_actual) AS inscritos_totales,
        SUM(cupo_maximo - cupo_actual) AS disponibles_totales,
        COUNT(*) AS total_grupos
      FROM cupos_grupos cg
      INNER JOIN grupos g ON g.id_grupo = cg.id_grupo
      WHERE 1=1 ${conditions}`,
      params
    );

    return res.json({
      ok: true,
      data: rows,
      resumen: resumen[0] || { cupo_total: 0, inscritos_totales: 0, disponibles_totales: 0, total_grupos: 0 },
      total: rows.length
    });
  } catch (error) {
    console.error('Error al obtener cupos disponibles:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener cupos disponibles' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getHistorialEstados = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id_inscripcion } = req.params;

    if (!id_inscripcion) {
      return res.status(400).json({ ok: false, message: 'ID de inscripcion requerido' });
    }

    const [inscripcion] = await conn.execute(
      `SELECT
        i.id_inscripcion, i.id_alumno,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        i.id_periodo, p.nombre_periodo,
        i.tipo_inscripcion, i.estado, i.observaciones,
        i.motivo_rechazo, i.fecha_inscripcion, i.actualizado_en, i.fecha_validacion
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      WHERE i.id_inscripcion = ?
      LIMIT 1`,
      [Number(id_inscripcion)]
    );

    if (!inscripcion.length) {
      return res.status(404).json({ ok: false, message: 'Inscripcion no encontrada' });
    }

    const [auditoria] = await conn.execute(
      `SELECT
        a.id_auditoria, a.id_inscripcion, a.id_usuario,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre,
        r.nombre_rol AS usuario_rol,
        a.accion, a.detalle, a.estado_anterior, a.estado_nuevo, a.ip, a.creado_en
      FROM inscripciones_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE a.id_inscripcion = ?
      ORDER BY a.creado_en DESC`,
      [Number(id_inscripcion)]
    );

    return res.json({
      ok: true,
      inscripcion: inscripcion[0],
      historial: auditoria || [],
      total: auditoria.length
    });
  } catch (error) {
    console.error('Error al obtener historial de estados:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener el historial' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getObservacionesAcademicas = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { periodo, carrera, grupo, busqueda } = req.query;
    const params = [];
    const conditions = [];

    conditions.push('(i.observaciones IS NOT NULL AND i.observaciones != \'\')');

    if (periodo) {
      conditions.push('i.id_periodo = ?');
      params.push(Number(periodo));
    }
    if (carrera) {
      conditions.push('a.id_carrera = ?');
      params.push(Number(carrera));
    }
    if (grupo) {
      conditions.push('i.id_grupo = ?');
      params.push(Number(grupo));
    }
    if (busqueda) {
      const term = `%${busqueda}%`;
      conditions.push('i.observaciones LIKE ?');
      params.push(term);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion, i.id_alumno,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        i.id_periodo, p.nombre_periodo,
        i.tipo_inscripcion, i.estado, i.observaciones,
        i.motivo_rechazo, i.fecha_inscripcion, i.actualizado_en,
        i.id_grupo, g.nombre_grupo,
        c.nombre_carrera,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS actualizado_por_nombre
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN usuarios u ON u.id_usuario = i.actualizado_por
      ${where}
      ORDER BY i.actualizado_en DESC, i.fecha_inscripcion DESC
      LIMIT 200`,
      params
    );

    return res.json({
      ok: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Error al obtener observaciones academicas:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener observaciones academicas' });
  } finally {
    if (conn) conn.release();
  }
};

exports.updateEstadoCoordinador = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { estado, observaciones, motivo_rechazo } = req.body;
    const userInfo = getUserInfo(req.user);
    const id_usuario = userInfo.id_usuario;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;

    const estadosValidos = ['Pendiente', 'Validada', 'Rechazada', 'Cancelada'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, message: 'Estado invalido. Use: Pendiente, Validada, Rechazada, Cancelada' });
    }

    conn = await pool.getConnection();

    const [actual] = await conn.execute(
      `SELECT i.id_inscripcion, i.estado AS estado_actual, i.id_alumno, i.id_periodo,
              i.tipo_inscripcion, i.id_grupo
       FROM inscripciones i WHERE i.id_inscripcion = ? LIMIT 1`,
      [Number(id)]
    );

    if (!actual.length) {
      return res.status(404).json({ ok: false, message: 'La inscripcion no existe' });
    }

    const estadoAnterior = actual[0].estado_actual;

    if (estadoAnterior === estado) {
      return res.json({ ok: true, message: 'La inscripcion ya se encuentra en ese estado', data: actual[0] });
    }

    await conn.beginTransaction();

    if (estado === 'Validada') {
      await conn.execute(
        `UPDATE inscripciones
         SET estado = ?, observaciones = COALESCE(NULLIF(?, ''), observaciones),
             motivo_rechazo = NULL,
             actualizado_en = NOW(), actualizado_por = ?,
             validada_por = ?, fecha_validacion = NOW()
         WHERE id_inscripcion = ?`,
        [estado, observaciones?.trim() || null, id_usuario, id_usuario, Number(id)]
      );

      if (actual[0].id_grupo) {
        await conn.execute(
          `INSERT INTO cupos_grupos (id_grupo, id_periodo, cupo_maximo, cupo_actual, actualizado_por)
           VALUES (?, ?, 30, 1, ?)
           ON DUPLICATE KEY UPDATE cupo_actual = cupo_actual + 1, actualizado_por = ?`,
          [actual[0].id_grupo, actual[0].id_periodo, id_usuario, id_usuario]
        );
      }
    } else {
      if (estadoAnterior === 'Validada' && actual[0].id_grupo) {
        await conn.execute(
          `UPDATE cupos_grupos SET cupo_actual = GREATEST(cupo_actual - 1, 0), actualizado_por = ?
           WHERE id_grupo = ? AND id_periodo = ?`,
          [id_usuario, actual[0].id_grupo, actual[0].id_periodo]
        );
      }

      if (estado === 'Rechazada') {
        await conn.execute(
          `UPDATE inscripciones
           SET estado = ?, observaciones = COALESCE(NULLIF(?, ''), observaciones),
               motivo_rechazo = COALESCE(NULLIF(?, ''), motivo_rechazo),
               actualizado_en = NOW(), actualizado_por = ?
           WHERE id_inscripcion = ?`,
          [estado, observaciones?.trim() || null, motivo_rechazo?.trim() || null, id_usuario, Number(id)]
        );
      } else {
        await conn.execute(
          `UPDATE inscripciones
           SET estado = ?, observaciones = COALESCE(NULLIF(?, ''), observaciones),
               actualizado_en = NOW(), actualizado_por = ?
           WHERE id_inscripcion = ?`,
          [estado, observaciones?.trim() || null, id_usuario, Number(id)]
        );
      }
    }

    const accionMap = {
      'Validada': 'VALIDAR', 'Rechazada': 'RECHAZAR',
      'Cancelada': 'CANCELAR', 'Pendiente': 'REVERTIR'
    };

    const nombreUsuario = req.user?.nombre_completo || req.user?.nombres || `Usuario #${id_usuario}`;
    let detalle = `Estado cambiado de "${estadoAnterior}" a "${estado}" por ${nombreUsuario}`;
    if (observaciones) detalle += `. Observaciones: ${observaciones}`;
    if (motivo_rechazo) detalle += `. Motivo: ${motivo_rechazo}`;

    await registrarAuditoria(conn, {
      id_inscripcion: Number(id),
      id_usuario,
      accion: accionMap[estado] || 'EDITAR',
      detalle,
      estado_anterior: estadoAnterior,
      estado_nuevo: estado,
      ip
    });

    await conn.commit();

    return res.json({
      ok: true,
      message: `Inscripcion #${id} actualizada a "${estado}"`,
      data: { id_inscripcion: Number(id), estado_anterior: estadoAnterior, estado_nuevo: estado }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error al actualizar estado:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar estado' });
  } finally {
    if (conn) conn.release();
  }
};

exports.asignarGrupo = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { id_grupo } = req.body;
    const userInfo = getUserInfo(req.user);
    const id_usuario = userInfo.id_usuario;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;

    if (!id_grupo) {
      return res.status(400).json({ ok: false, message: 'El ID del grupo es obligatorio' });
    }

    conn = await pool.getConnection();

    const [actual] = await conn.execute(
      `SELECT i.id_inscripcion, i.id_grupo AS grupo_actual, i.id_periodo, i.estado
       FROM inscripciones i WHERE i.id_inscripcion = ? LIMIT 1`,
      [Number(id)]
    );

    if (!actual.length) {
      return res.status(404).json({ ok: false, message: 'La inscripcion no existe' });
    }

    const [grupo] = await conn.execute(
      `SELECT id_grupo, cupo_maximo, cupo_actual FROM cupos_grupos WHERE id_grupo = ? AND id_periodo = ? LIMIT 1`,
      [Number(id_grupo), actual[0].id_periodo]
    );

    if (!grupo.length) {
      return res.status(404).json({ ok: false, message: 'El grupo no existe o no tiene cupo configurado' });
    }

    if (grupo[0].cupo_actual >= grupo[0].cupo_maximo) {
      return res.status(400).json({ ok: false, message: 'El grupo ha alcanzado su cupo maximo' });
    }

    await conn.beginTransaction();

    const grupoAnterior = actual[0].grupo_actual;

    await conn.execute(
      `UPDATE inscripciones SET id_grupo = ?, actualizado_en = NOW(), actualizado_por = ? WHERE id_inscripcion = ?`,
      [Number(id_grupo), id_usuario, Number(id)]
    );

    if (grupoAnterior) {
      await conn.execute(
        `UPDATE cupos_grupos SET cupo_actual = GREATEST(cupo_actual - 1, 0), actualizado_por = ?
         WHERE id_grupo = ? AND id_periodo = ?`,
        [id_usuario, grupoAnterior, actual[0].id_periodo]
      );
    }

    if (actual[0].estado === 'Validada') {
      await conn.execute(
        `UPDATE cupos_grupos SET cupo_actual = cupo_actual + 1, actualizado_por = ?
         WHERE id_grupo = ? AND id_periodo = ?`,
        [id_usuario, Number(id_grupo), actual[0].id_periodo]
      );
    }

    const nombreUsuario = req.user?.nombre_completo || req.user?.nombres || `Usuario #${id_usuario}`;
    await registrarAuditoria(conn, {
      id_inscripcion: Number(id),
      id_usuario,
      accion: 'ASIGNAR_GRUPO',
      detalle: `Grupo asignado por ${nombreUsuario}: de "${grupoAnterior || 'Sin grupo'}" a "${id_grupo}"`,
      estado_anterior: null,
      estado_nuevo: null,
      ip
    });

    await conn.commit();

    return res.json({
      ok: true,
      message: `Grupo asignado correctamente a la inscripcion #${id}`,
      data: { id_inscripcion: Number(id), id_grupo: Number(id_grupo) }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error al asignar grupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al asignar grupo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.registrarObservacion = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const userInfo = getUserInfo(req.user);
    const id_usuario = userInfo.id_usuario;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;

    if (!observaciones?.trim()) {
      return res.status(400).json({ ok: false, message: 'La observacion es obligatoria' });
    }

    conn = await pool.getConnection();

    const [actual] = await conn.execute(
      `SELECT id_inscripcion, observaciones FROM inscripciones WHERE id_inscripcion = ? LIMIT 1`,
      [Number(id)]
    );

    if (!actual.length) {
      return res.status(404).json({ ok: false, message: 'La inscripcion no existe' });
    }

    await conn.beginTransaction();

    const obsAnterior = actual[0].observaciones || '';
    const nuevaObs = observaciones.trim();
    const obsFinal = obsAnterior
      ? `${obsAnterior}\n[${new Date().toISOString().split('T')[0]}] ${nuevaObs}`
      : `[${new Date().toISOString().split('T')[0]}] ${nuevaObs}`;

    await conn.execute(
      `UPDATE inscripciones SET observaciones = ?, actualizado_en = NOW(), actualizado_por = ? WHERE id_inscripcion = ?`,
      [obsFinal, id_usuario, Number(id)]
    );

    const nombreUsuario = req.user?.nombre_completo || req.user?.nombres || `Usuario #${id_usuario}`;
    await registrarAuditoria(conn, {
      id_inscripcion: Number(id),
      id_usuario,
      accion: 'REGISTRAR_OBSERVACION',
      detalle: `Observacion registrada por ${nombreUsuario}: ${nuevaObs}`,
      estado_anterior: null,
      estado_nuevo: null,
      ip
    });

    await conn.commit();

    return res.json({
      ok: true,
      message: 'Observacion registrada correctamente',
      data: { id_inscripcion: Number(id), observaciones: obsFinal }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error al registrar observacion:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar observacion' });
  } finally {
    if (conn) conn.release();
  }
};

exports.actualizarCupo = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { cupo_maximo } = req.body;
    const userInfo = getUserInfo(req.user);
    const id_usuario = userInfo.id_usuario;

    if (!cupo_maximo || cupo_maximo < 1) {
      return res.status(400).json({ ok: false, message: 'El cupo maximo debe ser mayor a 0' });
    }

    conn = await pool.getConnection();

    await conn.execute(
      `UPDATE cupos_grupos SET cupo_maximo = ?, actualizado_por = ?, fecha_actualizacion = NOW()
       WHERE id_cupo = ?`,
      [Number(cupo_maximo), id_usuario, Number(id)]
    );

    return res.json({
      ok: true,
      message: 'Cupo actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar cupo:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar cupo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getCatalogosCoordinador = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [periodos, carreras, grupos] = await Promise.all([
      conn.execute(
        `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado
         FROM periodos ORDER BY id_periodo DESC`
      ),
      conn.execute(
        `SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera`
      ),
      conn.execute(
        `SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
                p.nombre_periodo, p.id_periodo
         FROM grupos g
         INNER JOIN periodos p ON p.id_periodo = g.id_periodo
         ORDER BY g.semestre, g.nombre_grupo`
      )
    ]);

    return res.json({
      ok: true,
      data: {
        periodos: periodos[0] || [],
        carreras: carreras[0] || [],
        grupos: grupos[0] || []
      }
    });
  } catch (error) {
    console.error('Error al obtener catalogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catalogos' });
  } finally {
    if (conn) conn.release();
  }
};
