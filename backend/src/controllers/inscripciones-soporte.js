'use strict';

const pool = require('../config/db');

async function getPanel(req, res) {
  const conn = await pool.getConnection();
  try {
    const [dbCheck] = await conn.execute('SELECT 1 AS ok');

    const [incidenciaStats] = await conn.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(estado = 'abierta') AS abiertas,
        SUM(estado = 'en_proceso') AS en_proceso,
        SUM(estado = 'resuelta') AS resueltas,
        SUM(estado = 'cerrada') AS cerradas,
        SUM(gravedad IN ('alta','critica') AND estado NOT IN ('resuelta','cerrada')) AS criticas_abiertas
      FROM incidencias_soporte
    `);

    const [totalInscripciones] = await conn.execute('SELECT COUNT(*) AS total FROM inscripciones');
    const [totalAuditoria] = await conn.execute('SELECT COUNT(*) AS total FROM inscripciones_auditoria');
    const [totalAlumnos] = await conn.execute('SELECT COUNT(*) AS total FROM grupos_alumnos');
    const [totalCargas] = await conn.execute('SELECT COUNT(*) AS total FROM cargas_academicas');

    const [estadosInscripcion] = await conn.execute(`
      SELECT UPPER(estado) AS estado, COUNT(*) AS total
      FROM inscripciones GROUP BY estado ORDER BY total DESC
    `);

    const [erroresRecientes] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM inscripciones_auditoria
      WHERE accion IN ('RECHAZAR','CANCELAR','ERROR')
        AND creado_en >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
    `);

    const [dbTables] = await conn.execute(`
      SELECT TABLE_NAME AS tabla, TABLE_ROWS AS filas,
        ROUND(DATA_LENGTH / 1024, 1) AS tamano_kb
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('inscripciones','inscripciones_auditoria','grupos_alumnos','cargas_academicas','cupos_grupos','documentos_inscripcion','incidencias_soporte','logs_soporte_inscripciones')
      ORDER BY TABLE_NAME
    `);

    return res.json({
      ok: true,
      data: {
        db: { estado: dbCheck.length ? 'CONECTADA' : 'FALLO', timestamp: new Date().toISOString() },
        incidencias: incidenciaStats[0] || { total: 0, abiertas: 0, en_proceso: 0, resueltas: 0, cerradas: 0, criticas_abiertas: 0 },
        conteos: {
          inscripciones: totalInscripciones[0]?.total || 0,
          auditoria: totalAuditoria[0]?.total || 0,
          grupos_alumnos: totalAlumnos[0]?.total || 0,
          cargas_academicas: totalCargas[0]?.total || 0
        },
        estados_inscripcion: estadosInscripcion,
        errores_recientes_72h: erroresRecientes[0]?.total || 0,
        tablas: dbTables
      }
    });
  } catch (error) {
    console.error('Error en getPanel:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener panel de soporte' });
  } finally { conn.release(); }
}

async function getIncidencias(req, res) {
  const conn = await pool.getConnection();
  try {
    const filtroEstado = req.query.estado || '';
    const filtroGravedad = req.query.gravedad || '';
    const filtroTipo = req.query.tipo || '';
    const limite = Math.min(Math.max(Number(req.query.limite || 100), 10), 500);

    const where = [];
    const params = [];
    if (filtroEstado) { where.push('i.estado = ?'); params.push(filtroEstado); }
    if (filtroGravedad) { where.push('i.gravedad = ?'); params.push(filtroGravedad); }
    if (filtroTipo) { where.push('i.tipo = ?'); params.push(filtroTipo); }

    const [rows] = await conn.execute(`
      SELECT i.id_incidencia, i.id_usuario, i.tipo, i.gravedad, i.titulo,
        i.descripcion, i.modulo_afectado, i.estado, i.solucion, i.created_at, i.updated_at,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre,
        u.correo_institucional AS usuario_correo
      FROM incidencias_soporte i
      LEFT JOIN usuarios u ON u.id_usuario = i.id_usuario
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        FIELD(i.gravedad, 'critica','alta','media','baja'),
        i.created_at DESC
      LIMIT ?
    `, [...params, limite]);

    const [stats] = await conn.execute(`
      SELECT estado, COUNT(*) AS total FROM incidencias_soporte GROUP BY estado
    `);

    return res.json({ ok: true, data: { incidencias: rows, stats, total: rows.length } });
  } catch (error) {
    console.error('Error en getIncidencias:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  } finally { conn.release(); }
}

async function crearIncidencia(req, res) {
  try {
    const { tipo, gravedad, titulo, descripcion, modulo_afectado } = req.body;
    if (!titulo || !descripcion) {
      return res.status(400).json({ ok: false, message: 'Título y descripción son obligatorios' });
    }

    const idUsuario = req.user.id_usuario || req.user.id;
    if (!idUsuario) {
      return res.status(400).json({ ok: false, message: 'Usuario no identificado' });
    }

    const [result] = await pool.execute(
      `INSERT INTO incidencias_soporte (id_usuario, tipo, gravedad, titulo, descripcion, modulo_afectado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idUsuario,
        tipo || 'tecnica',
        gravedad || 'media',
        titulo,
        descripcion,
        modulo_afectado || null
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Incidencia registrada correctamente',
      data: { id_incidencia: result.insertId }
    });
  } catch (error) {
    console.error('Error en crearIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar incidencia' });
  }
}

async function actualizarIncidencia(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID de incidencia inválido' });

    const { estado, solucion, gravedad } = req.body;

    const [existing] = await pool.execute(
      'SELECT id_incidencia FROM incidencias_soporte WHERE id_incidencia = ? LIMIT 1',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Incidencia no encontrada' });
    }

    const updates = [];
    const params = [];
    if (estado) { updates.push('estado = ?'); params.push(estado); }
    if (solucion !== undefined) { updates.push('solucion = ?'); params.push(solucion); }
    if (gravedad) { updates.push('gravedad = ?'); params.push(gravedad); }

    if (estado === 'cerrada' || estado === 'resuelta') {
      const idUsuario = req.user.id_usuario || req.user.id;
      updates.push('cerrada_por = ?');
      params.push(idUsuario);
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, message: 'No hay campos para actualizar' });
    }

    params.push(id);
    await pool.execute(
      `UPDATE incidencias_soporte SET ${updates.join(', ')} WHERE id_incidencia = ?`,
      params
    );

    return res.json({ ok: true, message: 'Incidencia actualizada correctamente' });
  } catch (error) {
    console.error('Error en actualizarIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar incidencia' });
  }
}

async function getErroresSistema(req, res) {
  const conn = await pool.getConnection();
  try {
    const horas = Math.min(Math.max(Number(req.query.horas || 168), 1), 720);
    const limite = Math.min(Math.max(Number(req.query.limite || 100), 10), 500);

    const [erroresAuditoria] = await conn.execute(`
      SELECT a.id_auditoria, a.id_inscripcion, a.accion, a.detalle, a.estado_anterior,
        a.estado_nuevo, a.ip, a.creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario_nombre,
        COALESCE(r.nombre_rol, '—') AS rol_usuario
      FROM inscripciones_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE a.accion IN ('RECHAZAR','CANCELAR','ERROR')
        AND a.creado_en >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY a.creado_en DESC
      LIMIT ?
    `, [horas, limite]);

    const [logs] = await conn.execute(`
      SELECT l.id_log, l.nivel, l.modulo, l.accion, l.mensaje, l.detalle_tecnico,
        l.ip, l.created_at,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre
      FROM logs_soporte_inscripciones l
      LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
      WHERE l.nivel IN ('error','warning')
      ORDER BY l.created_at DESC
      LIMIT ?
    `, [limite]);

    return res.json({
      ok: true,
      data: {
        horas_consulta: horas,
        errores_auditoria: erroresAuditoria,
        logs_error: logs,
        total_errores: erroresAuditoria.length,
        total_logs: logs.length
      }
    });
  } catch (error) {
    console.error('Error en getErroresSistema:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener errores del sistema' });
  } finally { conn.release(); }
}

async function getValidacionConectividad(req, res) {
  const conn = await pool.getConnection();
  try {
    const checks = [];

    const tablasVerificar = [
      'inscripciones', 'inscripciones_auditoria', 'grupos_alumnos',
      'cargas_academicas', 'cupos_grupos', 'documentos_inscripcion',
      'incidencias_soporte', 'logs_soporte_inscripciones'
    ];

    for (const tabla of tablasVerificar) {
      try {
        const [row] = await conn.execute(
          `SELECT COUNT(*) AS total FROM ?? WHERE 1=1`,
          [tabla]
        );
        checks.push({ tabla, accesible: true, registros: row[0]?.total || 0, error: null });
      } catch (e) {
        checks.push({ tabla, accesible: false, registros: 0, error: e.message });
      }
    }

    const [fkChecks] = await conn.execute(`
      SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('inscripciones','inscripciones_auditoria','grupos_alumnos','cargas_academicas')
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

    return res.json({
      ok: true,
      data: {
        timestamp: new Date().toISOString(),
        tablas: checks,
        total_accesibles: checks.filter(c => c.accesible).length,
        total_no_accesibles: checks.filter(c => !c.accesible).length,
        foreign_keys: fkChecks
      }
    });
  } catch (error) {
    console.error('Error en getValidacionConectividad:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar conectividad' });
  } finally { conn.release(); }
}

async function getLogs(req, res) {
  const conn = await pool.getConnection();
  try {
    const limite = Math.min(Math.max(Number(req.query.limite || 200), 10), 1000);
    const nivel = req.query.nivel || '';
    const modulo = req.query.modulo || '';

    const union = [];

    union.push(`
      SELECT 'auditoria' AS origen, a.id_auditoria AS id_registro,
        CASE
          WHEN a.accion IN ('RECHAZAR','CANCELAR','ERROR') THEN 'error'
          WHEN a.accion IN ('VALIDAR','APROBAR') THEN 'info'
          ELSE 'info'
        END AS nivel,
        'inscripciones' AS modulo, a.accion, COALESCE(a.detalle, '') AS mensaje,
        NULL AS detalle_tecnico, a.ip, a.creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario_nombre
      FROM inscripciones_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    `);

    union.push(`
      SELECT 'log_sistema' AS origen, l.id_log AS id_registro,
        l.nivel, l.modulo, l.accion, l.mensaje, l.detalle_tecnico, l.ip, l.created_at AS creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS usuario_nombre
      FROM logs_soporte_inscripciones l
      LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
    `);

    let whereExtra = '';
    const params = [];
    if (nivel) {
      whereExtra = ' AND nivel = ?';
      params.push(nivel);
    }
    if (modulo) {
      whereExtra += ' AND modulo = ?';
      params.push(modulo);
    }

    const sql = `SELECT * FROM (${union.join(' UNION ALL ')}) AS combined
      ${whereExtra ? 'WHERE 1=1' + whereExtra : ''}
      ORDER BY creado_en DESC
      LIMIT ?`;

    params.push(limite);
    const [rows] = await conn.execute(sql, params);

    const [niveles] = await conn.execute(`
      SELECT DISTINCT nivel FROM logs_soporte_inscripciones ORDER BY nivel
    `);
    const [modulos] = await conn.execute(`
      SELECT DISTINCT modulo FROM logs_soporte_inscripciones ORDER BY modulo
    `);

    return res.json({
      ok: true,
      data: {
        logs: rows,
        total: rows.length,
        filtros: {
          niveles: niveles.map(r => r.nivel),
          modulos: modulos.map(r => r.modulo)
        }
      }
    });
  } catch (error) {
    console.error('Error en getLogs:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener logs' });
  } finally { conn.release(); }
}

async function registrarLog(req, res) {
  try {
    const { nivel, modulo, accion, mensaje, detalle_tecnico } = req.body;
    if (!nivel || !modulo || !accion || !mensaje) {
      return res.status(400).json({ ok: false, message: 'Faltan campos requeridos (nivel, modulo, accion, mensaje)' });
    }

    const idUsuario = req.user.id_usuario || req.user.id || null;
    const ip = req.ip || req.connection?.remoteAddress || null;

    const [result] = await pool.execute(
      `INSERT INTO logs_soporte_inscripciones (nivel, modulo, accion, mensaje, detalle_tecnico, id_usuario, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nivel, modulo, accion, mensaje, detalle_tecnico || null, idUsuario, ip]
    );

    return res.status(201).json({
      ok: true,
      message: 'Log registrado correctamente',
      data: { id_log: result.insertId }
    });
  } catch (error) {
    console.error('Error en registrarLog:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar log' });
  }
}

async function getRevisionCarga(req, res) {
  const conn = await pool.getConnection();
  try {
    const inconsistencias = [];
    const advertencias = [];
    const stats = {};

    const [totalInscripciones] = await conn.execute('SELECT COUNT(*) AS total FROM inscripciones');
    stats.total_inscripciones = totalInscripciones[0]?.total || 0;

    const [inscripcionesSinGrupo] = await conn.execute(`
      SELECT COUNT(*) AS total FROM inscripciones
      WHERE id_grupo IS NULL AND estado IN ('Activo', 'Pendiente', 'Validada', 'Aprobada', 'Completada')
    `);
    stats.sin_grupo = inscripcionesSinGrupo[0]?.total || 0;
    if (inscripcionesSinGrupo[0]?.total > 0) {
      advertencias.push({
        tipo: 'inscripciones_sin_grupo',
        mensaje: `${inscripcionesSinGrupo[0].total} inscripciones activas sin grupo asignado`,
        gravedad: 'alta'
      });
    }

    const [alumnosSinGrupoAlumno] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM inscripciones i
      LEFT JOIN grupos_alumnos ga ON ga.id_alumno = i.id_alumno AND ga.id_grupo = i.id_grupo AND ga.id_periodo = i.id_periodo
      WHERE i.estado IN ('Activo', 'Validada', 'Aprobada', 'Completada')
        AND ga.id_grupo_alumno IS NULL
    `);
    stats.alumnos_sin_grupo_alumno = alumnosSinGrupoAlumno[0]?.total || 0;
    if (alumnosSinGrupoAlumno[0]?.total > 0) {
      inconsistencias.push({
        tipo: 'inscripcion_sin_grupo_alumnos',
        mensaje: `${alumnosSinGrupoAlumno[0].total} inscripciones activas sin registro en grupos_alumnos`,
        gravedad: 'critica'
      });
    }

    const [gruposAlumnoSinInscripcion] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM grupos_alumnos ga
      LEFT JOIN inscripciones i ON i.id_alumno = ga.id_alumno AND i.id_grupo = ga.id_grupo AND i.id_periodo = ga.id_periodo
      WHERE ga.estado = 'ACTIVO' AND i.id_inscripcion IS NULL
    `);
    stats.grupos_alumno_sin_inscripcion = gruposAlumnoSinInscripcion[0]?.total || 0;
    if (gruposAlumnoSinInscripcion[0]?.total > 0) {
      inconsistencias.push({
        tipo: 'grupo_alumno_sin_inscripcion',
        mensaje: `${gruposAlumnoSinInscripcion[0].total} alumnos en grupos_alumnos sin inscripción formal`,
        gravedad: 'critica'
      });
    }

    const [bajasRecientes] = await conn.execute(`
      SELECT COUNT(*) AS total
      FROM grupos_alumnos
      WHERE estado IN ('BAJA', 'TRANSFERIDO')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 168 HOUR)
    `);
    stats.bajas_recientes_7d = bajasRecientes[0]?.total || 0;
    if (bajasRecientes[0]?.total > 0) {
      advertencias.push({
        tipo: 'bajas_recientes',
        mensaje: `${bajasRecientes[0].total} bajas/transferencias en los últimos 7 días`,
        gravedad: 'media'
      });
    }

    const [duplicados] = await conn.execute(`
      SELECT id_alumno, id_periodo, COUNT(*) AS total
      FROM inscripciones
      GROUP BY id_alumno, id_periodo
      HAVING total > 1
      LIMIT 20
    `);
    stats.duplicados = duplicados.length;
    if (duplicados.length > 0) {
      inconsistencias.push({
        tipo: 'inscripciones_duplicadas',
        mensaje: `${duplicados.length} alumno(s) con múltiples inscripciones en el mismo periodo`,
        gravedad: 'alta'
      });
    }

    const [cargasSinAlumnos] = await conn.execute(`
      SELECT ca.id_carga_academica, ca.id_grupo, ca.id_periodo, ca.id_materia,
        g.nombre_grupo, m.nombre_materia
      FROM cargas_academicas ca
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      WHERE ca.estado = 'ACTIVA'
      GROUP BY ca.id_carga_academica
      HAVING COUNT(ga.id_grupo_alumno) = 0
      LIMIT 20
    `);
    stats.cargas_sin_alumnos = cargasSinAlumnos.length;
    if (cargasSinAlumnos.length > 0) {
      advertencias.push({
        tipo: 'cargas_sin_alumnos',
        mensaje: `${cargasSinAlumnos.length} carga(s) académica(s) sin alumnos asignados`,
        gravedad: 'alta'
      });
    }

    return res.json({
      ok: true,
      data: {
        stats,
        inconsistencias,
        advertencias,
        total_problemas: inconsistencias.length + advertencias.length,
        detalle_duplicados: duplicados,
        detalle_cargas_sin_alumnos: cargasSinAlumnos
      }
    });
  } catch (error) {
    console.error('Error en getRevisionCarga:', error);
    return res.status(500).json({ ok: false, message: 'Error al revisar carga de datos' });
  } finally { conn.release(); }
}

module.exports = {
  getPanel,
  getIncidencias,
  crearIncidencia,
  actualizarIncidencia,
  getErroresSistema,
  getValidacionConectividad,
  getLogs,
  registrarLog,
  getRevisionCarga
};
