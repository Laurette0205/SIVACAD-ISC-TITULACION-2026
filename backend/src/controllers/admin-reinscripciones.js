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

exports.getMetrics = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [totales] = await conn.execute(`
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

    const [porPeriodo] = await conn.execute(`
      SELECT
        p.id_periodo, p.nombre_periodo,
        COUNT(*) AS total,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN i.estado IN ('Activo','Aprobada','Completada') THEN 1 ELSE 0 END) AS activas
      FROM inscripciones i
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      WHERE i.tipo_inscripcion = 'Reinscripcion'
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.id_periodo DESC
    `);

    const [porCarrera] = await conn.execute(`
      SELECT
        c.id_carrera, c.nombre_carrera,
        COUNT(*) AS total
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE i.tipo_inscripcion = 'Reinscripcion'
      GROUP BY c.id_carrera, c.nombre_carrera
      ORDER BY total DESC
    `);

    const [porGrupo] = await conn.execute(`
      SELECT
        g.id_grupo, g.nombre_grupo,
        COUNT(*) AS total
      FROM inscripciones i
      INNER JOIN grupos g ON g.id_grupo = i.id_grupo
      WHERE i.tipo_inscripcion = 'Reinscripcion' AND i.id_grupo IS NOT NULL
      GROUP BY g.id_grupo, g.nombre_grupo
      ORDER BY total DESC
      LIMIT 20
    `);

    const [tendenciaMensual] = await conn.execute(`
      SELECT
        DATE_FORMAT(i.fecha_inscripcion, '%Y-%m') AS mes,
        COUNT(*) AS total,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas
      FROM inscripciones i
      WHERE i.tipo_inscripcion = 'Reinscripcion'
        AND i.fecha_inscripcion >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(i.fecha_inscripcion, '%Y-%m')
      ORDER BY mes ASC
    `);

    const [periodosActivos] = await conn.execute(`
      SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin
      FROM periodos WHERE estado = 'Activo'
      ORDER BY id_periodo DESC LIMIT 5
    `);

    const [alumnosReinscritos] = await conn.execute(`
      SELECT COUNT(DISTINCT i.id_alumno) AS total
      FROM inscripciones i
      WHERE i.tipo_inscripcion = 'Reinscripcion'
        AND i.estado IN ('Validada', 'Activo', 'Aprobada', 'Completada')
    `);

    return res.json({
      ok: true,
      data: {
        totales: totales[0] || { total: 0, pendientes: 0, validadas: 0, rechazadas: 0, canceladas: 0, activas: 0 },
        porPeriodo,
        porCarrera,
        porGrupo,
        tendenciaMensual,
        periodosActivos,
        alumnosReinscritos: alumnosReinscritos[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error en getMetrics reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener métricas de reinscripciones' });
  } finally {
    if (conn) conn.release();
  }
};

exports.listarReinscripciones = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const idPeriodo = Number(req.query.id_periodo) || 0;
    const idCarrera = Number(req.query.id_carrera) || 0;
    const idGrupo = Number(req.query.id_grupo) || 0;
    const estado = req.query.estado || '';
    const busqueda = req.query.busqueda || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 200), 10), 1000);
    const pagina = Math.max(Number(req.query.pagina || 1), 1);
    const offset = (pagina - 1) * limite;

    const where = ["i.tipo_inscripcion = 'Reinscripcion'"];
    const params = [];

    if (idPeriodo) { where.push('i.id_periodo = ?'); params.push(idPeriodo); }
    if (idCarrera) {
      where.push('a.id_carrera = ?');
      params.push(idCarrera);
    }
    if (idGrupo) { where.push('i.id_grupo = ?'); params.push(idGrupo); }
    if (estado) { where.push('i.estado = ?'); params.push(estado); }
    if (busqueda) {
      where.push('(a.matricula LIKE ? OR CONCAT(u.nombres, " ", u.apellido_paterno, " ", u.apellido_materno) LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [countResult] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      ${whereClause}
    `, params);

    const total = countResult[0]?.total || 0;

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
        CONCAT(uv.nombres, ' ', uv.apellido_paterno) AS validado_por_nombre
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      LEFT JOIN usuarios uv ON uv.id_usuario = r.validada_por
      ${whereClause}
      ORDER BY i.fecha_inscripcion DESC, i.id_inscripcion DESC
      LIMIT ? OFFSET ?
    `, [...params, limite, offset]);

    return res.json({
      ok: true,
      data: { reinscripciones: rows, total, pagina, limite, totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    console.error('Error en listarReinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al listar reinscripciones' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getIncidencias = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [sinGrupo] = await conn.execute(`
      SELECT i.id_inscripcion, i.id_alumno, i.id_periodo, i.estado, i.fecha_inscripcion,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        p.nombre_periodo,
        'Sin grupo asignado' AS problema,
        'critica' AS gravedad
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      WHERE i.tipo_inscripcion = 'Reinscripcion'
        AND i.id_grupo IS NULL
        AND i.estado IN ('Pendiente', 'Validada')
      ORDER BY i.fecha_inscripcion DESC
    `);

    const [rechazadasRecientes] = await conn.execute(`
      SELECT i.id_inscripcion, i.id_alumno, i.estado, i.motivo_rechazo, i.fecha_inscripcion,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        p.nombre_periodo,
        CONCAT('Rechazada: ', COALESCE(i.motivo_rechazo, 'Sin motivo')) AS problema,
        'alta' AS gravedad
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      WHERE i.tipo_inscripcion = 'Reinscripcion'
        AND i.estado = 'Rechazada'
        AND i.fecha_inscripcion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY i.fecha_inscripcion DESC
    `);

    const [sinReinscripcionRegistro] = await conn.execute(`
      SELECT i.id_inscripcion, i.id_alumno, i.estado, i.fecha_inscripcion,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        p.nombre_periodo,
        'Inscripción como Reinscripcion sin registro en tabla reinscripciones' AS problema,
        'critica' AS gravedad
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      WHERE i.tipo_inscripcion = 'Reinscripcion'
        AND r.id_reinscripcion IS NULL
      ORDER BY i.fecha_inscripcion DESC
    `);

    const [duplicadas] = await conn.execute(`
      SELECT i.id_alumno, i.id_periodo, COUNT(*) AS total,
        a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo,
        p.nombre_periodo,
        CONCAT('Múltiples reinscripciones en mismo periodo (', COUNT(*), ')') AS problema,
        'alta' AS gravedad
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      WHERE i.tipo_inscripcion = 'Reinscripcion'
      GROUP BY i.id_alumno, i.id_periodo
      HAVING COUNT(*) > 1
      ORDER BY total DESC
    `);

    const incidencias = [
      ...sinGrupo.map(r => ({ ...r, tipo: 'sin_grupo' })),
      ...rechazadasRecientes.map(r => ({ ...r, tipo: 'rechazada' })),
      ...sinReinscripcionRegistro.map(r => ({ ...r, tipo: 'sin_registro_reinscripcion' })),
      ...duplicadas.map(r => ({ ...r, tipo: 'duplicada' }))
    ];

    return res.json({
      ok: true,
      data: {
        incidencias,
        total: incidencias.length,
        resumen: {
          sin_grupo: sinGrupo.length,
          rechazadas_recientes: rechazadasRecientes.length,
          sin_registro_reinscripcion: sinReinscripcionRegistro.length,
          duplicadas: duplicadas.length
        }
      }
    });
  } catch (error) {
    console.error('Error en getIncidencias:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getBitacora = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const limite = Math.min(Math.max(Number(req.query.limite || 200), 10), 1000);
    const accion = req.query.accion || '';

    const where = [
      'i.tipo_inscripcion = \'Reinscripcion\''
    ];
    const params = [];

    if (accion) { where.push('a.accion = ?'); params.push(accion); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await conn.execute(`
      SELECT a.id_auditoria, a.id_inscripcion, a.id_usuario, a.accion, a.detalle,
        a.estado_anterior, a.estado_nuevo, a.ip, a.creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre,
        COALESCE(r.nombre_rol, '—') AS usuario_rol,
        al.matricula,
        CONCAT(ual.nombres, ' ', ual.apellido_paterno, ' ', ual.apellido_materno) AS alumno_nombre
      FROM inscripciones_auditoria a
      INNER JOIN inscripciones i ON i.id_inscripcion = a.id_inscripcion
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN alumnos al ON al.id_alumno = i.id_alumno
      LEFT JOIN usuarios ual ON ual.id_usuario = al.id_usuario
      ${whereClause}
      ORDER BY a.creado_en DESC
      LIMIT ?
    `, [...params, limite]);

    const [accionesDisponibles] = await conn.execute(`
      SELECT DISTINCT a.accion
      FROM inscripciones_auditoria a
      INNER JOIN inscripciones i ON i.id_inscripcion = a.id_inscripcion
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE i.tipo_inscripcion = 'Reinscripcion'
      ORDER BY a.accion
    `);

    return res.json({
      ok: true,
      data: { registros: rows, total: rows.length, acciones: accionesDisponibles.map(r => r.accion) }
    });
  } catch (error) {
    console.error('Error en getBitacora:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener bitácora' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getHistorialInstitucional = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [porPeriodoDetallado] = await conn.execute(`
      SELECT
        p.id_periodo, p.nombre_periodo, p.fecha_inicio, p.fecha_fin,
        COUNT(*) AS total_reinscripciones,
        COUNT(DISTINCT i.id_alumno) AS alumnos_reinscritos,
        SUM(CASE WHEN i.estado = 'Validada' THEN 1 ELSE 0 END) AS validadas,
        SUM(CASE WHEN i.estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN i.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN i.estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN i.estado IN ('Activo','Aprobada','Completada') THEN 1 ELSE 0 END) AS activas
      FROM periodos p
      LEFT JOIN inscripciones i ON i.id_periodo = p.id_periodo AND i.tipo_inscripcion = 'Reinscripcion'
      GROUP BY p.id_periodo, p.nombre_periodo, p.fecha_inicio, p.fecha_fin
      ORDER BY p.id_periodo DESC
    `);

    const [totalGeneral] = await conn.execute(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT id_alumno) AS alumnos_distintos,
        COUNT(DISTINCT id_periodo) AS periodos_con_reinscripciones,
        MIN(fecha_inscripcion) AS primera_reinscripcion,
        MAX(fecha_inscripcion) AS ultima_reinscripcion
      FROM inscripciones
      WHERE tipo_inscripcion = 'Reinscripcion'
    `);

    return res.json({
      ok: true,
      data: {
        totalGeneral: totalGeneral[0] || {},
        porPeriodo: porPeriodoDetallado
      }
    });
  } catch (error) {
    console.error('Error en getHistorialInstitucional:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial institucional' });
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
      FROM periodos ORDER BY id_periodo DESC
    `);

    const [carreras] = await conn.execute(`
      SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera
    `);

    const [grupos] = await conn.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, p.nombre_periodo
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      ORDER BY p.id_periodo DESC, g.nombre_grupo
    `);

    return res.json({
      ok: true,
      data: { periodos, carreras, grupos }
    });
  } catch (error) {
    console.error('Error en getCatalogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  } finally {
    if (conn) conn.release();
  }
};

exports.exportReport = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const formato = req.query.formato || 'json';
    const idPeriodo = Number(req.query.id_periodo) || 0;
    const idCarrera = Number(req.query.id_carrera) || 0;
    const idGrupo = Number(req.query.id_grupo) || 0;
    const estado = req.query.estado || '';

    const where = ["i.tipo_inscripcion = 'Reinscripcion'"];
    const params = [];

    if (idPeriodo) { where.push('i.id_periodo = ?'); params.push(idPeriodo); }
    if (idCarrera) { where.push('a.id_carrera = ?'); params.push(idCarrera); }
    if (idGrupo) { where.push('i.id_grupo = ?'); params.push(idGrupo); }
    if (estado) { where.push('i.estado = ?'); params.push(estado); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await conn.execute(`
      SELECT
        i.id_inscripcion, a.matricula,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno,
        u.correo_institucional AS correo,
        p.nombre_periodo AS periodo,
        g.nombre_grupo AS grupo,
        c.nombre_carrera AS carrera,
        i.tipo_inscripcion, i.estado,
        i.fecha_inscripcion AS fecha_solicitud,
        i.fecha_validacion,
        COALESCE(r.motivo, '') AS motivo_reinscripcion,
        COALESCE(i.motivo_rechazo, '') AS motivo_rechazo,
        COALESCE(i.observaciones, '') AS observaciones,
        CONCAT(uv.nombres, ' ', uv.apellido_paterno) AS validado_por
      FROM inscripciones i
      INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      LEFT JOIN usuarios uv ON uv.id_usuario = r.validada_por
      ${whereClause}
      ORDER BY i.fecha_inscripcion DESC
    `, params);

    if (formato === 'csv') {
      const headers = ['ID', 'Matrícula', 'Alumno', 'Correo', 'Periodo', 'Grupo', 'Carrera', 'Tipo', 'Estado', 'Fecha Solicitud', 'Fecha Validación', 'Motivo Reinscripción', 'Motivo Rechazo', 'Observaciones', 'Validado Por'];
      const csvLines = [headers.join(',')];

      for (const r of rows) {
        const line = [
          r.id_inscripcion, r.matricula,
          `"${(r.alumno || '').replace(/"/g, '""')}"`,
          `"${(r.correo || '').replace(/"/g, '""')}"`,
          `"${(r.periodo || '').replace(/"/g, '""')}"`,
          `"${(r.grupo || '').replace(/"/g, '""')}"`,
          `"${(r.carrera || '').replace(/"/g, '""')}"`,
          r.tipo_inscripcion, r.estado,
          r.fecha_solicitud || '', r.fecha_validacion || '',
          `"${(r.motivo_reinscripcion || '').replace(/"/g, '""')}"`,
          `"${(r.motivo_rechazo || '').replace(/"/g, '""')}"`,
          `"${(r.observaciones || '').replace(/"/g, '""')}"`,
          `"${(r.validado_por || '').replace(/"/g, '""')}"`
        ];
        csvLines.push(line.join(','));
      }

      const csv = '\uFEFF' + csvLines.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reinscripciones_${Date.now()}.csv"`);
      return res.send(csv);
    }

    return res.json({ ok: true, data: { registros: rows, total: rows.length } });
  } catch (error) {
    console.error('Error en exportReport:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar reporte' });
  } finally {
    if (conn) conn.release();
  }
};
