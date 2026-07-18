'use strict';

const pool = require('../config/db');

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

function isSoporteRole(user) {
  const roleName = String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
  const roleId = Number(user?.rol_id || user?.id_rol || 0);
  return roleName === 'SOPORTE' || roleId === 5;
}

// =====================================================
// 1. PANEL / MESA TÉCNICA
// =====================================================
exports.getPanel = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [dbCheck] = await conn.execute('SELECT 1 AS ok');

    const [incidenciaStats] = await conn.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(estado = 'abierta') AS abiertas,
        SUM(estado = 'en_proceso') AS en_proceso,
        SUM(estado = 'resuelta') AS resueltas,
        SUM(estado = 'cerrada') AS cerradas,
        SUM(gravedad IN ('alta','critica') AND estado NOT IN ('resuelta','cerrada')) AS criticas_abiertas
      FROM soporte_reinscripciones_incidencias
    `);

    const [totalReinscripciones] = await conn.execute('SELECT COUNT(*) AS total FROM reinscripciones');
    const [totalAuditoria] = await conn.execute('SELECT COUNT(*) AS total FROM reinscripcion_auditoria');
    const [totalLogs] = await conn.execute('SELECT COUNT(*) AS total FROM soporte_reinscripciones_logs');
    const [totalMonitoreo] = await conn.execute('SELECT COUNT(*) AS total FROM soporte_reinscripciones_monitoreo');

    const [estadosReinscripcion] = await conn.execute(`
      SELECT UPPER(i.estado) AS estado, COUNT(*) AS total
      FROM reinscripciones r
      INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
      GROUP BY i.estado ORDER BY total DESC
    `);

    const [reinscripcionesHoy] = await conn.execute(`
      SELECT COUNT(*) AS total FROM reinscripciones r
      INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
      WHERE DATE(i.fecha_inscripcion) = CURDATE()
    `);

    const [erroresRecientes] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM soporte_reinscripciones_logs
      WHERE tipo IN ('error','critical')
        AND creado_en >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
    `);

    const [dbTables] = await conn.execute(`
      SELECT TABLE_NAME AS tabla, TABLE_ROWS AS filas,
        ROUND(DATA_LENGTH / 1024, 1) AS tamano_kb
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('reinscripciones','reinscripcion_auditoria','reinscripcion_requisitos',
                           'soporte_reinscripciones_incidencias','soporte_reinscripciones_logs',
                           'soporte_reinscripciones_monitoreo','docente_notificaciones_reinscripcion')
      ORDER BY TABLE_NAME
    `);

    return res.json({
      ok: true,
      data: {
        db: { estado: dbCheck.length ? 'CONECTADA' : 'FALLO', timestamp: new Date().toISOString() },
        incidencias: incidenciaStats[0] || { total: 0, abiertas: 0, en_proceso: 0, resueltas: 0, cerradas: 0, criticas_abiertas: 0 },
        conteos: {
          reinscripciones: totalReinscripciones[0]?.total || 0,
          auditoria: totalAuditoria[0]?.total || 0,
          logs: totalLogs[0]?.total || 0,
          monitoreo: totalMonitoreo[0]?.total || 0
        },
        estados_reinscripcion: estadosReinscripcion,
        reinscripciones_hoy: reinscripcionesHoy[0]?.total || 0,
        errores_recientes_72h: erroresRecientes[0]?.total || 0,
        tablas: dbTables
      }
    });
  } catch (error) {
    console.error('Error getPanel soporte reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener panel técnico' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 2. INCIDENCIAS TÉCNICAS
// =====================================================
exports.getIncidencias = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const filtroEstado = req.query.estado || '';
    const filtroGravedad = req.query.gravedad || '';
    const filtroTipo = req.query.tipo || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 100), 10), 500);

    const where = ['i.modulo = ?'];
    const params = ['reinscripciones'];
    if (filtroEstado) { where.push('i.estado = ?'); params.push(filtroEstado); }
    if (filtroGravedad) { where.push('i.gravedad = ?'); params.push(filtroGravedad); }
    if (filtroTipo) { where.push('i.tipo = ?'); params.push(filtroTipo); }

    const [rows] = await conn.execute(`
      SELECT i.*,
        CONCAT(u.nombre, ' ', u.apellido_paterno) AS reportado_por_nombre,
        CONCAT(ua.nombre, ' ', ua.apellido_paterno) AS asignado_a_nombre
      FROM soporte_reinscripciones_incidencias i
      LEFT JOIN usuarios u ON u.id_usuario = i.reportado_por
      LEFT JOIN usuarios ua ON ua.id_usuario = i.asignado_a
      WHERE ${where.join(' AND ')}
      ORDER BY i.creado_en DESC
      LIMIT ?
    `, [...params, String(limite)]);

    return res.json({ ok: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Error getIncidencias soporte reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  } finally {
    if (conn) conn.release();
  }
};

exports.crearIncidencia = async (req, res) => {
  let conn;
  try {
    const { tipo, gravedad, titulo, descripcion, id_reinscripcion, id_inscripcion, evidencia } = req.body;
    if (!tipo || !titulo) {
      return res.status(400).json({ ok: false, message: 'El tipo y el título son obligatorios' });
    }
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `INSERT INTO soporte_reinscripciones_incidencias
       (tipo, gravedad, titulo, descripcion, modulo, id_reinscripcion, id_inscripcion, evidencia, reportado_por)
       VALUES (?, COALESCE(?, 'media'), ?, ?, 'reinscripciones', ?, ?, ?, ?)`,
      [tipo, gravedad || 'media', titulo, descripcion || null,
       id_reinscripcion || null, id_inscripcion || null,
       evidencia || null, req.user.id_usuario]
    );

    await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs (tipo, accion, descripcion, modulo, usuario_id)
       VALUES ('info', 'CREAR_INCIDENCIA', ?, 'reinscripciones', ?)`,
      [`Incidencia #${result.insertId} creada: ${titulo}`, req.user.id_usuario]
    );

    return res.status(201).json({
      ok: true, message: 'Incidencia registrada correctamente',
      data: { id_incidencia: result.insertId }
    });
  } catch (error) {
    console.error('Error crearIncidencia soporte reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar incidencia' });
  } finally {
    if (conn) conn.release();
  }
};

exports.actualizarIncidencia = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { estado, gravedad, asignado_a, solucion } = req.body;

    conn = await pool.getConnection();

    const updates = [];
    const params = [];
    if (estado) { updates.push('estado = ?'); params.push(estado); }
    if (gravedad) { updates.push('gravedad = ?'); params.push(gravedad); }
    if (asignado_a !== undefined) { updates.push('asignado_a = ?'); params.push(asignado_a || null); }
    if (solucion !== undefined) { updates.push('solucion = ?'); params.push(solucion || null); }
    if (estado === 'resuelta' || estado === 'cerrada') {
      updates.push('resuelto_en = NOW()');
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, message: 'No hay campos para actualizar' });
    }

    params.push(Number(id));
    await conn.execute(
      `UPDATE soporte_reinscripciones_incidencias SET ${updates.join(', ')} WHERE id_incidencia = ?`,
      params
    );

    await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs (tipo, accion, descripcion, modulo, usuario_id)
       VALUES ('info', 'ACTUALIZAR_INCIDENCIA', ?, 'reinscripciones', ?)`,
      [`Incidencia #${id} actualizada`, req.user.id_usuario]
    );

    return res.json({ ok: true, message: 'Incidencia actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizarIncidencia soporte reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar incidencia' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 3. MONITOREO DE SINCRONIZACIÓN
// =====================================================
exports.getMonitoreo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const tipo = req.query.tipo || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 50), 10), 200);

    const where = [];
    const params = [];
    if (tipo) { where.push('m.tipo = ?'); params.push(tipo); }

    const [rows] = await conn.execute(`
      SELECT m.*, p.nombre_periodo,
        CONCAT(u.nombre, ' ', u.apellido_paterno) AS ejecutado_por_nombre
      FROM soporte_reinscripciones_monitoreo m
      LEFT JOIN periodos p ON p.id_periodo = m.id_periodo
      LEFT JOIN usuarios u ON u.id_usuario = m.ejecutado_por
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY m.creado_en DESC
      LIMIT ?
    `, [...params, String(limite)]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error getMonitoreo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener monitoreo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.iniciarMonitoreo = async (req, res) => {
  let conn;
  try {
    const { tipo, id_periodo, total_registros } = req.body;
    if (!tipo || !id_periodo) {
      return res.status(400).json({ ok: false, message: 'El tipo y período son obligatorios' });
    }
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `INSERT INTO soporte_reinscripciones_monitoreo
       (id_periodo, tipo, estado, total_registros, iniciado_en, ejecutado_por)
       VALUES (?, ?, 'en_curso', ?, NOW(), ?)`,
      [id_periodo, tipo, total_registros || 0, req.user.id_usuario]
    );

    await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs (tipo, accion, descripcion, modulo, usuario_id)
       VALUES ('info', 'INICIAR_MONITOREO', ?, 'reinscripciones', ?)`,
      [`Monitoreo #${result.insertId} iniciado: ${tipo}`, req.user.id_usuario]
    );

    return res.status(201).json({
      ok: true, message: 'Monitoreo iniciado',
      data: { id_monitoreo: result.insertId }
    });
  } catch (error) {
    console.error('Error iniciarMonitoreo:', error);
    return res.status(500).json({ ok: false, message: 'Error al iniciar monitoreo' });
  } finally {
    if (conn) conn.release();
  }
};

exports.actualizarMonitoreo = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { estado, procesados, errores, detalle } = req.body;

    conn = await pool.getConnection();
    const updates = ['actualizado_en = NOW()'];
    const params = [];
    if (estado) { updates.push('estado = ?'); params.push(estado); }
    if (procesados !== undefined) { updates.push('procesados = ?'); params.push(procesados); }
    if (errores !== undefined) { updates.push('errores = ?'); params.push(errores); }
    if (detalle !== undefined) { updates.push('detalle = ?'); params.push(JSON.stringify(detalle)); }
    if (estado === 'completado' || estado === 'fallido') {
      updates.push('completado_en = NOW()');
    }

    params.push(Number(id));
    await conn.execute(
      `UPDATE soporte_reinscripciones_monitoreo SET ${updates.join(', ')} WHERE id_monitoreo = ?`,
      params
    );

    return res.json({ ok: true, message: 'Monitoreo actualizado' });
  } catch (error) {
    console.error('Error actualizarMonitoreo:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar monitoreo' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 4. ERRORES DE PROCESO
// =====================================================
exports.getErroresProceso = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const desde = req.query.desde || '';
    const hasta = req.query.hasta || '';
    const tipo = req.query.tipo || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 100), 10), 500);

    const where = ["l.modulo = 'reinscripciones'", "l.tipo IN ('error','critical')"];
    const params = [];
    if (desde) { where.push('l.creado_en >= ?'); params.push(desde); }
    if (hasta) { where.push('l.creado_en <= ?'); params.push(hasta); }
    if (tipo) { where.push('l.tipo = ?'); params.push(tipo); }

    const [rows] = await conn.execute(`
      SELECT l.*, CONCAT(u.nombre, ' ', u.apellido_paterno) AS usuario_nombre
      FROM soporte_reinscripciones_logs l
      LEFT JOIN usuarios u ON u.id_usuario = l.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.creado_en DESC
      LIMIT ?
    `, [...params, String(limite)]);

    return res.json({ ok: true, data: rows, total: rows.length });
  } catch (error) {
    console.error('Error getErroresProceso:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener errores' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 5. LOGS DE OPERACIÓN
// =====================================================
exports.getLogs = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const tipo = req.query.tipo || '';
    const accion = req.query.accion || '';
    const desde = req.query.desde || '';
    const hasta = req.query.hasta || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 100), 10), 500);

    const where = ["l.modulo = 'reinscripciones'"];
    const params = [];
    if (tipo) { where.push('l.tipo = ?'); params.push(tipo); }
    if (accion) { where.push('l.accion = ?'); params.push(accion); }
    if (desde) { where.push('l.creado_en >= ?'); params.push(desde); }
    if (hasta) { where.push('l.creado_en <= ?'); params.push(hasta); }

    const [rows] = await conn.execute(`
      SELECT l.*, CONCAT(u.nombre, ' ', u.apellido_paterno) AS usuario_nombre
      FROM soporte_reinscripciones_logs l
      LEFT JOIN usuarios u ON u.id_usuario = l.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.creado_en DESC
      LIMIT ?
    `, [...params, String(limite)]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error getLogs soporte reinscripciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener logs' });
  } finally {
    if (conn) conn.release();
  }
};

exports.registrarLog = async (req, res) => {
  let conn;
  try {
    const { tipo, accion, descripcion, id_reinscripcion, id_inscripcion, metadata } = req.body;
    if (!tipo || !accion) {
      return res.status(400).json({ ok: false, message: 'El tipo y la acción son obligatorios' });
    }
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs
       (tipo, accion, descripcion, modulo, id_reinscripcion, id_inscripcion, ip_origen, usuario_id, metadata)
       VALUES (?, ?, ?, 'reinscripciones', ?, ?, ?, ?, ?)`,
      [tipo, accion, descripcion || null,
       id_reinscripcion || null, id_inscripcion || null,
       req.ip || null, req.user.id_usuario,
       metadata ? JSON.stringify(metadata) : null]
    );

    return res.status(201).json({
      ok: true, message: 'Log registrado', data: { id_log: result.insertId }
    });
  } catch (error) {
    console.error('Error registrarLog:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar log' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 6. VERIFICAR INTEGRIDAD DE DATOS
// =====================================================
exports.verificarIntegridad = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const resultados = [];

    // 1. Reinscripciones huérfanas (sin inscripcion)
    const [reinscripcionesHuerfanas] = await conn.execute(`
      SELECT COUNT(*) AS total FROM reinscripciones r
      LEFT JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
      WHERE i.id_inscripcion IS NULL
    `);
    resultados.push({
      prueba: 'Reinscripciones huérfanas',
      estado: reinscripcionesHuerfanas[0]?.total === 0 ? 'ok' : 'error',
      detalle: `${reinscripcionesHuerfanas[0]?.total || 0} reinscripciones sin inscripción asociada`,
      total: reinscripcionesHuerfanas[0]?.total || 0
    });

    // 2. Reinscripciones duplicadas
    const [reinscripcionesDuplicadas] = await conn.execute(`
      SELECT COUNT(*) AS total FROM (
        SELECT id_inscripcion, COUNT(*) AS cnt
        FROM reinscripciones GROUP BY id_inscripcion HAVING cnt > 1
      ) dup
    `);
    resultados.push({
      prueba: 'Reinscripciones duplicadas',
      estado: reinscripcionesDuplicadas[0]?.total === 0 ? 'ok' : 'error',
      detalle: `${reinscripcionesDuplicadas[0]?.total || 0} inscripciones con múltiples reinscripciones`,
      total: reinscripcionesDuplicadas[0]?.total || 0
    });

    // 3. Inscripciones "Reinscripcion" sin registro en reinscripciones
    const [sinRegistro] = await conn.execute(`
      SELECT COUNT(*) AS total FROM inscripciones i
      LEFT JOIN reinscripciones r ON r.id_inscripcion = i.id_inscripcion
      WHERE i.tipo_inscripcion = 'Reinscripcion' AND r.id_reinscripcion IS NULL
    `);
    resultados.push({
      prueba: 'Inscripciones Reinscripcion sin registro',
      estado: sinRegistro[0]?.total === 0 ? 'ok' : 'error',
      detalle: `${sinRegistro[0]?.total || 0} inscripciones tipo Reinscripcion sin metadatos en reinscripciones`,
      total: sinRegistro[0]?.total || 0
    });

    // 4. Alumnos en grupos sin inscripción
    const [alumnosSinInscripcion] = await conn.execute(`
      SELECT COUNT(*) AS total FROM grupos_alumnos ga
      LEFT JOIN inscripciones i ON i.id_alumno = ga.id_alumno AND i.id_periodo = ga.id_periodo
      WHERE i.id_inscripcion IS NULL
    `);
    resultados.push({
      prueba: 'Alumnos en grupos sin inscripción',
      estado: alumnosSinInscripcion[0]?.total === 0 ? 'ok' : 'warning',
      detalle: `${alumnosSinInscripcion[0]?.total || 0} alumnos en grupos sin inscripción asociada`,
      total: alumnosSinInscripcion[0]?.total || 0
    });

    // 5. Reinscripciones sin requisitos
    const [sinRequisitos] = await conn.execute(`
      SELECT COUNT(*) AS total FROM reinscripciones r
      WHERE NOT EXISTS (
        SELECT 1 FROM reinscripcion_requisitos rr WHERE rr.id_reinscripcion = r.id_reinscripcion
      )
    `);
    resultados.push({
      prueba: 'Reinscripciones sin requisitos',
      estado: sinRequisitos[0]?.total === 0 ? 'ok' : 'info',
      detalle: `${sinRequisitos[0]?.total || 0} reinscripciones sin registro de requisitos`,
      total: sinRequisitos[0]?.total || 0
    });

    const totalErrores = resultados.filter(r => r.estado === 'error').length;
    const totalWarnings = resultados.filter(r => r.estado === 'warning').length;

    await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs (tipo, accion, descripcion, modulo, usuario_id, metadata)
       VALUES (?, 'VERIFICAR_INTEGRIDAD', ?, 'reinscripciones', ?, ?)`,
      [totalErrores === 0 ? 'info' : 'warning',
       `Verificación de integridad completada: ${totalErrores} error(es), ${totalWarnings} advertencia(s)`,
       req.user.id_usuario,
       JSON.stringify(resultados)]
    );

    return res.json({
      ok: true,
      data: { resultados, resumen: { total: resultados.length, errores: totalErrores, warnings: totalWarnings } }
    });
  } catch (error) {
    console.error('Error verificarIntegridad:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar integridad' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 7. REINTENTAR PROCESOS FALLIDOS
// =====================================================
exports.reintentarProceso = async (req, res) => {
  let conn;
  try {
    const { id_monitoreo } = req.body;
    conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT * FROM soporte_reinscripciones_monitoreo WHERE id_monitoreo = ? AND estado = 'fallido' LIMIT 1`,
      [Number(id_monitoreo)]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Monitoreo fallido no encontrado' });
    }

    await conn.execute(
      `UPDATE soporte_reinscripciones_monitoreo
       SET estado = 'pendiente', procesados = 0, errores = 0,
           detalle = NULL, completado_en = NULL, iniciado_en = NOW()
       WHERE id_monitoreo = ?`,
      [Number(id_monitoreo)]
    );

    await conn.execute(
      `INSERT INTO soporte_reinscripciones_logs (tipo, accion, descripcion, modulo, usuario_id)
       VALUES ('info', 'REINTENTAR_PROCESO', ?, 'reinscripciones', ?)`,
      [`Reintento del monitoreo #${id_monitoreo} iniciado`, req.user.id_usuario]
    );

    return res.json({ ok: true, message: 'Reintento iniciado correctamente' });
  } catch (error) {
    console.error('Error reintentarProceso:', error);
    return res.status(500).json({ ok: false, message: 'Error al reintentar proceso' });
  } finally {
    if (conn) conn.release();
  }
};
