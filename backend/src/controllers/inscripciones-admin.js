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

exports.getMetrics = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [totales] = await conn.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN i.tipo_inscripcion = 'Primera_Vez' THEN 1 ELSE 0 END) AS primera_vez,
        SUM(CASE WHEN i.tipo_inscripcion = 'Reinscripcion' THEN 1 ELSE 0 END) AS reinscripciones
      FROM inscripciones i`
    );

    const [porPeriodo] = await conn.execute(
      `SELECT
        p.id_periodo, p.nombre_periodo,
        COUNT(*) AS total,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas
      FROM inscripciones i
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.id_periodo DESC`
    );

    const [porTipo] = await conn.execute(
      `SELECT
        i.tipo_inscripcion,
        COUNT(*) AS total
      FROM inscripciones i
      GROUP BY i.tipo_inscripcion`
    );

    const [porCarrera] = await conn.execute(
      `SELECT
        c.id_carrera, c.nombre_carrera,
        COUNT(*) AS total
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN carreras c ON c.id_carrera = a.id_carrera
      GROUP BY c.id_carrera, c.nombre_carrera
      ORDER BY total DESC`
    );

    const [periodosActivos] = await conn.execute(
      `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin
       FROM periodos
       WHERE estado = 'Activo'
       ORDER BY id_periodo DESC
       LIMIT 5`
    );

    return res.json({
      ok: true,
      data: {
        totales: totales[0] || { total: 0, pendientes: 0, validadas: 0, rechazadas: 0, canceladas: 0, primera_vez: 0, reinscripciones: 0 },
        porPeriodo,
        porTipo,
        porCarrera,
        periodosActivos
      }
    });
  } catch (error) {
    console.error('Error al obtener metricas de inscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener metricas' });
  } finally {
    if (conn) conn.release();
  }
};

exports.listarInscripcionesAdmin = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const params = [];
    const conditions = [];

    const { periodo, carrera, estado, tipo, busqueda } = req.query;

    if (periodo) {
      conditions.push('i.id_periodo = ?');
      params.push(Number(periodo));
    }

    if (carrera) {
      conditions.push('a.id_carrera = ?');
      params.push(Number(carrera));
    }

    if (estado) {
      conditions.push('i.estado = ?');
      params.push(estado);
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
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) LIKE ? OR
        p.nombre_periodo LIKE ? OR
        CAST(i.id_inscripcion AS CHAR) LIKE ?
      )`);
      params.push(term, term, term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion,
        i.id_alumno,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS alumno,
        i.id_periodo,
        p.nombre_periodo,
        i.tipo_inscripcion,
        i.estado,
        i.observaciones,
        i.fecha_inscripcion,
        i.actualizado_en,
        i.id_carrera,
        i.id_grupo,
        c.nombre_carrera,
        g.nombre_grupo,
        a.semestre_actual,
        a.estatus_academico
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      ${where}
      ORDER BY i.fecha_inscripcion DESC, i.id_inscripcion DESC
      LIMIT 500`,
      params
    );

    return res.json({ ok: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Error al listar inscripciones admin:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener inscripciones' });
  } finally {
    if (conn) conn.release();
  }
};

exports.updateEstado = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;
    const id_usuario = req.user?.id_usuario || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;

    const estadosValidos = ['Pendiente', 'Validada', 'Rechazada', 'Cancelada'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, message: 'Estado invalido. Use: Pendiente, Validada, Rechazada, Cancelada' });
    }

    conn = await pool.getConnection();

    const [actual] = await conn.execute(
      `SELECT i.id_inscripcion, i.estado AS estado_actual, i.id_alumno, i.id_periodo, i.tipo_inscripcion
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

    await conn.execute(
      `UPDATE inscripciones
       SET estado = ?, observaciones = COALESCE(NULLIF(?, ''), observaciones), actualizado_en = NOW(), actualizado_por = ?
       WHERE id_inscripcion = ?`,
      [estado, observaciones?.trim() || null, id_usuario, Number(id)]
    );

    const accionMap = {
      'Validada': 'VALIDAR',
      'Rechazada': 'RECHAZAR',
      'Cancelada': 'CANCELAR',
      'Pendiente': 'REVERTIR'
    };

    const nombreUsuario = req.user?.nombre_completo || req.user?.nombres || `Usuario #${id_usuario}`;

    await registrarAuditoria(conn, {
      id_inscripcion: Number(id),
      id_usuario,
      accion: accionMap[estado] || 'EDITAR',
      detalle: `Estado cambiado de "${estadoAnterior}" a "${estado}" por ${nombreUsuario}${observaciones ? `. Observaciones: ${observaciones}` : ''}`,
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

exports.getAuditoria = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const params = [];
    const conditions = [];

    const { id_inscripcion, accion, limite } = req.query;

    if (id_inscripcion) {
      conditions.push('a.id_inscripcion = ?');
      params.push(Number(id_inscripcion));
    }

    if (accion) {
      conditions.push('a.accion = ?');
      params.push(accion.toUpperCase());
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = Math.min(Number(limite) || 200, 500);

    const [rows] = await conn.execute(
      `SELECT
        a.id_auditoria,
        a.id_inscripcion,
        a.id_usuario,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre,
        u.correo_institucional AS usuario_correo,
        r.nombre_rol AS usuario_rol,
        a.accion,
        a.detalle,
        a.estado_anterior,
        a.estado_nuevo,
        a.ip,
        a.creado_en
      FROM inscripciones_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      ${where}
      ORDER BY a.creado_en DESC
      LIMIT ${limit}`,
      params
    );

    return res.json({ ok: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Error al obtener auditoria:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener auditoria' });
  } finally {
    if (conn) conn.release();
  }
};

exports.exportReport = async (req, res) => {
  let conn;
  try {
    const formato = (req.query.formato || 'json').toUpperCase();
    const { periodo, estado, tipo, carrera } = req.query;

    conn = await pool.getConnection();
    const params = [];
    const conditions = [];

    if (periodo) {
      conditions.push('i.id_periodo = ?');
      params.push(Number(periodo));
    }
    if (estado) {
      conditions.push('i.estado = ?');
      params.push(estado);
    }
    if (tipo) {
      conditions.push('i.tipo_inscripcion = ?');
      params.push(tipo);
    }
    if (carrera) {
      conditions.push('a.id_carrera = ?');
      params.push(Number(carrera));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await conn.execute(
      `SELECT
        i.id_inscripcion,
        a.matricula,
        CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        c.nombre_carrera,
        p.nombre_periodo,
        i.tipo_inscripcion,
        i.estado,
        i.observaciones,
        i.fecha_inscripcion,
        i.actualizado_en,
        a.semestre_actual,
        a.estatus_academico
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      ${where}
      ORDER BY i.id_inscripcion DESC`,
      params
    );

    if (formato === 'CSV') {
      const headers = ['ID', 'Matricula', 'Alumno', 'Nombre Completo', 'Carrera', 'Periodo', 'Tipo', 'Estado', 'Observaciones', 'Fecha Inscripcion', 'Actualizado', 'Semestre', 'Estatus Academico'];
      const csvRows = rows.map(r => [
        r.id_inscripcion,
        r.matricula,
        `"${(r.alumno || '').replace(/"/g, '""')}"`,
        `"${(r.nombre_completo || '').replace(/"/g, '""')}"`,
        `"${(r.nombre_carrera || '').replace(/"/g, '""')}"`,
        `"${(r.nombre_periodo || '').replace(/"/g, '""')}"`,
        r.tipo_inscripcion,
        r.estado,
        `"${(r.observaciones || '').replace(/"/g, '""')}"`,
        r.fecha_inscripcion ? new Date(r.fecha_inscripcion).toISOString().split('T')[0] : '',
        r.actualizado_en ? new Date(r.actualizado_en).toISOString().split('T')[0] : '',
        r.semestre_actual,
        r.estatus_academico
      ].join(','));

      const csv = [headers.join(','), ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=inscripciones_${Date.now()}.csv`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=inscripciones_${Date.now()}.json`);
    return res.json({ ok: true, data: rows, total: rows.length, exportado_en: new Date().toISOString() });
  } catch (error) {
    console.error('Error al exportar inscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar reporte' });
  } finally {
    if (conn) conn.release();
  }
};

async function safeQuery(conn, sql, params) {
  try {
    const [rows] = await conn.execute(sql, params || []);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
      console.warn('Tabla no encontrada, devolviendo arreglo vacio:', sql.substring(0, 60));
      return [];
    }
    throw error;
  }
}

exports.getCatalogos = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [periodos, carreras, grupos, estados] = await Promise.all([
      safeQuery(conn,
        `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado
         FROM periodos ORDER BY id_periodo DESC`
      ),
      safeQuery(conn,
        `SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera`
      ),
      safeQuery(conn,
        `SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, p.nombre_periodo
         FROM grupos g
         INNER JOIN periodos p ON p.id_periodo = g.id_periodo
         ORDER BY g.id_grupo DESC`
      ),
      safeQuery(conn,
        `SELECT id_estado, codigo, nombre, descripcion, color, orden, activo
         FROM inscripciones_catalogos_estados
         ORDER BY orden ASC`
      )
    ]);

    return res.json({
      ok: true,
      data: { periodos, carreras, grupos, estados }
    });
  } catch (error) {
    console.error('Error al obtener catalogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catalogos' });
  } finally {
    if (conn) conn.release();
  }
};
