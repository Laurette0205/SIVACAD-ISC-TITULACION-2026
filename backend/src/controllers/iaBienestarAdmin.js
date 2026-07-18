'use strict';

const pool = require('../config/db');

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── 1. RESUMEN EJECUTIVO ──
async function resumen(req, res) {
  try {
    const [
      [sesiones],
      [sesionesActivas],
      [checkins],
      [alertas],
      [alertasPendientes],
      [derivaciones],
      [derivacionesPendientes],
      [usuariosUnicos],
      [riesgoDist],
      [tipoAlertaDist],
      [promedios]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_sesiones'),
      pool.execute("SELECT COUNT(*) AS total FROM ia_bienestar_sesiones WHERE estado = 'ACTIVA'"),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_checkins'),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_alertas'),
      pool.execute("SELECT COUNT(*) AS total FROM ia_bienestar_alertas WHERE estado IN ('PENDIENTE','EN_REVISION')"),
      pool.execute('SELECT COUNT(*) AS total FROM ia_bienestar_derivaciones'),
      pool.execute("SELECT COUNT(*) AS total FROM ia_bienestar_derivaciones WHERE estado IN ('PENDIENTE','EN_CURSO')"),
      pool.execute('SELECT COUNT(DISTINCT id_usuario) AS total FROM ia_bienestar_sesiones'),
      pool.execute(`
        SELECT nivel_riesgo, COUNT(*) AS total
        FROM ia_bienestar_alertas GROUP BY nivel_riesgo
      `),
      pool.execute(`
        SELECT tipo_alerta, COUNT(*) AS total
        FROM ia_bienestar_alertas GROUP BY tipo_alerta
      `),
      pool.execute(`
        SELECT ROUND(AVG(bienestar_score), 1) AS score_promedio,
               ROUND(AVG(indice_riesgo), 2) AS riesgo_promedio
        FROM ia_bienestar_checkins
      `)
    ]);

    const distribucionRiesgo = {};
    for (const r of riesgoDist) {
      let key = r.nivel_riesgo;
      if (key === 'Cr�tico' || key === 'Crítico') key = 'Critico';
      distribucionRiesgo[key] = r.total;
    }

    const distribucionTipoAlerta = {};
    for (const r of tipoAlertaDist) {
      distribucionTipoAlerta[r.tipo_alerta] = r.total;
    }

    return res.json({
      ok: true,
      data: {
        sesiones: {
          total: sesiones[0].total,
          activas: sesionesActivas[0].total,
          usuarios_unicos: usuariosUnicos[0].total
        },
        checkins: { total: checkins[0].total },
        alertas: {
          total: alertas[0].total,
          pendientes: alertasPendientes[0].total,
          distribucion_riesgo: distribucionRiesgo,
          distribucion_tipo: distribucionTipoAlerta
        },
        derivaciones: {
          total: derivaciones[0].total,
          pendientes: derivacionesPendientes[0].total
        },
        promedios: {
          bienestar_score: promedios[0]?.score_promedio || 0,
          indice_riesgo: promedios[0]?.riesgo_promedio || 0
        }
      }
    });
  } catch (error) {
    console.error('Error en resumen ejecutivo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen' });
  }
}

// ── 2. INDICADORES DE RIESGO ──
async function indicadores(req, res) {
  try {
    const periodo = String(req.query.periodo || '').trim();

    let filtroFecha = '';
    const params = [];

    if (periodo === '7d') {
      filtroFecha = 'WHERE c.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (periodo === '30d') {
      filtroFecha = 'WHERE c.creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (periodo === '90d') {
      filtroFecha = 'WHERE c.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
    }

    const [checkinsRecientes] = await pool.execute(`
      SELECT c.nivel_riesgo, c.bienestar_score, c.indice_riesgo,
        c.animo, c.energia, c.sueno, c.estres, c.apoyo,
        c.ambiente, c.carga_academica, c.carga_laboral, c.enfoque,
        c.creado_en, u.nombres, u.apellido_paterno, u.correo_institucional
      FROM ia_bienestar_checkins c
      INNER JOIN usuarios u ON u.id_usuario = c.id_usuario
      ${filtroFecha}
      ORDER BY c.creado_en DESC
      LIMIT 500
    `, params);

    const porNivel = {};
    const totalDim = { animo: 0, energia: 0, sueno: 0, estres: 0, apoyo: 0, ambiente: 0, carga_academica: 0, carga_laboral: 0, enfoque: 0 };
    let countDim = 0;

    for (const c of checkinsRecientes) {
      let key = c.nivel_riesgo;
      if (key === 'Cr�tico' || key === 'Crítico') key = 'Critico';
      porNivel[key] = (porNivel[key] || 0) + 1;

      for (const dim of Object.keys(totalDim)) {
        if (c[dim] !== null && c[dim] !== undefined) {
          totalDim[dim] += c[dim];
        }
      }
      countDim++;
    }

    const promediosDim = {};
    for (const [dim, total] of Object.entries(totalDim)) {
      promediosDim[dim] = countDim > 0 ? Math.round((total / countDim) * 10) / 10 : 0;
    }

    const resultado = [];
    for (const [nivel, total] of Object.entries(porNivel)) {
      const colores = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', Critico: '#ef4444' };
      resultado.push({
        nivel,
        total,
        porcentaje: checkinsRecientes.length > 0
          ? Math.round((total / checkinsRecientes.length) * 100)
          : 0,
        color: colores[nivel] || '#94a3b8'
      });
    }

    return res.json({
      ok: true,
      data: {
        total_checkins: checkinsRecientes.length,
        por_nivel: resultado.sort((a, b) => b.total - a.total),
        dimensiones_promedio: promediosDim,
        periodo: periodo || 'total'
      }
    });
  } catch (error) {
    console.error('Error en indicadores:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener indicadores' });
  }
}

// ── 3. CATÁLOGO DE ALERTAS ──
async function catalogoAlertas(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const filtroEstado = String(req.query.estado || '').trim();
    const filtroTipo = String(req.query.tipo || '').trim();
    const busqueda = String(req.query.q || '').trim();

    let where = ['1=1'];
    const params = [];

    if (filtroEstado) {
      where.push('a.estado = ?');
      params.push(filtroEstado);
    }
    if (filtroTipo) {
      where.push('a.tipo_alerta = ?');
      params.push(filtroTipo);
    }
    if (busqueda) {
      where.push('(u.nombres LIKE ? OR u.apellido_paterno LIKE ? OR u.correo_institucional LIKE ?)');
      const like = `%${busqueda}%`;
      params.push(like, like, like);
    }

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(*) AS total
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE ${where.join(' AND ')}
    `, params);

    const [rows] = await pool.execute(`
      SELECT a.*,
        u.nombres, u.apellido_paterno, u.correo_institucional
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE ${where.join(' AND ')}
      ORDER BY a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total: countRes.total, pages: Math.ceil(countRes.total / limit) }
    });
  } catch (error) {
    console.error('Error en catálogo de alertas:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alertas' });
  }
}

// ── 4. HISTORIAL DE SEGUIMIENTOS (derivaciones) ──
async function historialSeguimientos(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const filtroEstado = String(req.query.estado || '').trim();

    let where = ['1=1'];
    const params = [];

    if (filtroEstado) {
      where.push('d.estado = ?');
      params.push(filtroEstado);
    }

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(*) AS total
      FROM ia_bienestar_derivaciones d
      WHERE ${where.join(' AND ')}
    `, params);

    const [rows] = await pool.execute(`
      SELECT d.*,
        u.nombres, u.apellido_paterno, u.correo_institucional,
        a.tipo_alerta, a.nivel_riesgo AS alerta_nivel, a.descripcion AS alerta_descripcion
      FROM ia_bienestar_derivaciones d
      INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
      LEFT JOIN ia_bienestar_alertas a ON a.id_alerta = d.id_alerta
      WHERE ${where.join(' AND ')}
      ORDER BY d.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total: countRes.total, pages: Math.ceil(countRes.total / limit) }
    });
  } catch (error) {
    console.error('Error en historial de seguimientos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener seguimientos' });
  }
}

// ── 5. EXPORTAR REPORTE PDF ──
async function exportarPdf(req, res) {
  try {
    const [data] = await Promise.all([
      (async () => {
        const [s] = await pool.execute('SELECT COUNT(*) AS t FROM ia_bienestar_sesiones');
        const [c] = await pool.execute('SELECT COUNT(*) AS t FROM ia_bienestar_checkins');
        const [a] = await pool.execute('SELECT COUNT(*) AS t FROM ia_bienestar_alertas');
        const [d] = await pool.execute('SELECT COUNT(*) AS t FROM ia_bienestar_derivaciones');
        return { sesiones: s[0].t, checkins: c[0].t, alertas: a[0].t, derivaciones: d[0].t };
      })()
    ]);

    const lineas = [
      '=== REPORTE IA DE ACOMPAÑAMIENTO ESTUDIANTIL ===',
      `Generado: ${new Date().toISOString()}`,
      '',
      '--- RESUMEN EJECUTIVO ---',
      `Sesiones totales: ${data.sesiones}`,
      `Check-ins totales: ${data.checkins}`,
      `Alertas totales: ${data.alertas}`,
      `Derivaciones totales: ${data.derivaciones}`,
      '',
      '--- INDICADORES DE RIESGO ---',
      ...((await (async () => {
        const [r] = await pool.execute(`
          SELECT nivel_riesgo, COUNT(*) AS total
          FROM ia_bienestar_alertas GROUP BY nivel_riesgo
        `);
        return r.map(r => `${r.nivel_riesgo}: ${r.total}`);
      })())),
      '',
      `--- FIN DEL REPORTE ---`,
      `Exportado por: ${req.user?.id_usuario || 'Sistema'}`
    ];

    const content = lineas.join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="acompanamiento_${new Date().toISOString().slice(0, 10)}.txt"`);
    return res.send(content);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar reporte' });
  }
}

// ── 6. EXPORTAR EXCEL (CSV) ──
async function exportarExcel(req, res) {
  try {
    const [alertas] = await pool.execute(`
      SELECT a.id_alerta, a.tipo_alerta, a.nivel_riesgo, a.descripcion,
        a.accion_sugerida, a.estado, a.creado_en,
        CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario
      FROM ia_bienestar_alertas a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      ORDER BY a.creado_en DESC
      LIMIT 1000
    `);

    const headers = ['ID', 'Tipo', 'Nivel', 'Descripcion', 'Accion Sugerida', 'Estado', 'Creado', 'Usuario'];
    const csvLines = [headers.join(',')];

    for (const a of alertas) {
      const row = [
        a.id_alerta,
        `"${(a.tipo_alerta || '').replace(/"/g, '""')}"`,
        `"${(a.nivel_riesgo || '').replace(/"/g, '""')}"`,
        `"${(a.descripcion || '').replace(/"/g, '""')}"`,
        `"${(a.accion_sugerida || '').replace(/"/g, '""')}"`,
        `"${(a.estado || '').replace(/"/g, '""')}"`,
        a.creado_en ? new Date(a.creado_en).toISOString() : '',
        `"${(a.usuario || '').replace(/"/g, '""')}"`
      ];
      csvLines.push(row.join(','));
    }

    const content = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="alertas_acompanamiento_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(content);
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar Excel' });
  }
}

// ── 7. AUDITORÍA DE CAMBIOS (usando tabla ia_auditoria_desercion como log central) ──
async function auditoria(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(*) AS total FROM ia_auditoria_desercion
      WHERE accion LIKE '%BIENESTAR%' OR accion LIKE '%SOPORTE%' OR detalle LIKE '%bienestar%'
    `);

    const [rows] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.correo_institucional
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.accion LIKE '%BIENESTAR%' OR a.accion LIKE '%SOPORTE%' OR a.detalle LIKE '%bienestar%'
      ORDER BY a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total: countRes.total, pages: Math.ceil(countRes.total / limit) }
    });
  } catch (error) {
    console.error('Error en auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener auditoría' });
  }
}

// ── 8. GRUPOS EN RIESGO (panel operativo) ──
async function gruposRiesgo(req, res) {
  try {
    const [rows] = await pool.execute(`
      SELECT
        g.id_grupo, g.nombre_grupo,
        c.id_carrera, c.nombre_carrera,
        COUNT(DISTINCT a.id_usuario) AS total_alumnos,
        COUNT(DISTINCT al.id_alerta) AS total_alertas,
        SUM(CASE WHEN al.nivel_riesgo IN ('Alto','Crítico','Cr\u00edtico') THEN 1 ELSE 0 END) AS alertas_criticas,
        SUM(CASE WHEN al.estado IN ('PENDIENTE','EN_REVISION') THEN 1 ELSE 0 END) AS alertas_pendientes,
        MAX(al.creado_en) AS ultima_alerta
      FROM grupos g
      LEFT JOIN carreras c ON c.id_carrera = g.id_carrera
      LEFT JOIN inscripciones i ON i.id_grupo = g.id_grupo AND i.estado = 'ACTIVA'
      LEFT JOIN alumnos a ON a.id_alumno = i.id_alumno
      LEFT JOIN ia_bienestar_alertas al ON al.id_usuario = a.id_usuario
      GROUP BY g.id_grupo, g.nombre_grupo, c.id_carrera, c.nombre_carrera
      HAVING total_alertas > 0
      ORDER BY alertas_criticas DESC, total_alertas DESC
      LIMIT 50
    `);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en grupos riesgo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener grupos en riesgo' });
  }
}

// ── 9. ALUMNOS EN RIESGO (tablero con filtros) ──
async function alumnosRiesgo(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const grupoId = String(req.query.grupoId || '').trim();
    const periodoId = String(req.query.periodoId || '').trim();
    const carreraId = String(req.query.carreraId || '').trim();
    const nivelRiesgo = String(req.query.nivel_riesgo || '').trim();
    const busqueda = String(req.query.q || '').trim();

    let where = ['1=1'];
    const params = [];

    if (grupoId) { where.push('i.id_grupo = ?'); params.push(grupoId); }
    if (periodoId) { where.push('i.id_periodo = ?'); params.push(periodoId); }
    if (carreraId) { where.push('a.id_carrera = ?'); params.push(carreraId); }
    if (nivelRiesgo) { where.push('al.nivel_riesgo = ?'); params.push(nivelRiesgo); }
    if (busqueda) {
      where.push('(u.nombres LIKE ? OR u.apellido_paterno LIKE ? OR u.matricula LIKE ?)');
      const q = `%${busqueda}%`;
      params.push(q, q, q);
    }

    const [[countRes]] = await pool.execute(`
      SELECT COUNT(DISTINCT a.id_alumno) AS total
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN inscripciones i ON i.id_alumno = a.id_alumno AND i.estado = 'ACTIVA'
      LEFT JOIN ia_bienestar_alertas al ON al.id_usuario = a.id_usuario
      WHERE ${where.join(' AND ')}
    `, params);

    const [rows] = await pool.execute(`
      SELECT DISTINCT
        a.id_alumno, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        a.semestre_actual, a.id_carrera, c.nombre_carrera,
        g.id_grupo, g.nombre_grupo,
        al.id_alerta, al.tipo_alerta, al.nivel_riesgo, al.estado AS estado_alerta,
        al.descripcion, al.accion_sugerida, al.creado_en AS alerta_creada,
        COALESCE(k.promedio_general, 0) AS promedio_general
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN inscripciones i ON i.id_alumno = a.id_alumno AND i.estado = 'ACTIVA'
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN ia_bienestar_alertas al ON al.id_usuario = a.id_usuario
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE ${where.join(' AND ')} AND al.id_alerta IS NOT NULL
      ORDER BY al.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total: countRes.total, pages: Math.ceil(countRes.total / limit) }
    });
  } catch (error) {
    console.error('Error en alumnos riesgo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alumnos en riesgo' });
  }
}

// ── 10. DETALLE + EVOLUCIÓN DE ALUMNO ──
async function detalleAlumno(req, res) {
  try {
    const idAlumno = Number(req.params.id);
    if (!idAlumno) return res.status(400).json({ ok: false, message: 'ID de alumno inválido' });

    const [[alumno]] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.correo_institucional,
        c.nombre_carrera, COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
      LIMIT 1
    `, [idAlumno]);

    if (!alumno) return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });

    const [alertas] = await pool.execute(`
      SELECT * FROM ia_bienestar_alertas
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 20
    `, [idAlumno]);

    const [checkins] = await pool.execute(`
      SELECT * FROM ia_bienestar_checkins
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 20
    `, [idAlumno]);

    const [sesiones] = await pool.execute(`
      SELECT * FROM ia_bienestar_sesiones
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 10
    `, [idAlumno]);

    const [evolucion] = await pool.execute(`
      SELECT c.bienestar_score, c.indice_riesgo, c.nivel_riesgo, c.creado_en
      FROM ia_bienestar_checkins c
      WHERE c.id_usuario = ?
      ORDER BY c.creado_en ASC
      LIMIT 50
    `, [idAlumno]);

    return res.json({
      ok: true,
      data: { alumno, alertas, checkins, sesiones, evolucion }
    });
  } catch (error) {
    console.error('Error en detalle alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener detalle del alumno' });
  }
}

// ── 11. REGISTRAR SEGUIMIENTO (desde admin) ──
async function registrarSeguimiento(req, res) {
  try {
    const { id_alerta, id_alumno, accion, observaciones, destino } = req.body;
    if (!id_alerta || !accion) {
      return res.status(400).json({ ok: false, message: 'Faltan campos: id_alerta, accion' });
    }

    const usuarioId = (req.user && (req.user.id_usuario || req.user.id)) || null;

    const [result] = await pool.execute(
      `INSERT INTO ia_bienestar_derivaciones
        (id_alerta, id_usuario, destino, motivo, estado, observaciones, creado_en)
       VALUES (?, ?, ?, ?, 'EN_CURSO', ?, NOW())`,
      [id_alerta, usuarioId, destino || 'Coordinación / Tutoría', accion, observaciones || null]
    );

    await pool.execute(
      `UPDATE ia_bienestar_alertas SET estado = 'EN_REVISION'
       WHERE id_alerta = ? AND estado = 'PENDIENTE'`,
      [id_alerta]
    );

    await pool.execute(
      `INSERT INTO ia_auditoria_desercion (id_usuario, accion, detalle)
       VALUES (?, 'BIENESTAR_SEGUIMIENTO', ?)`,
      [usuarioId, `Seguimiento registrado en alerta ${id_alerta}: ${accion}`]
    );

    return res.status(201).json({
      ok: true,
      message: 'Seguimiento registrado correctamente',
      data: { id_derivacion: result.insertId }
    });
  } catch (error) {
    console.error('Error al registrar seguimiento:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar seguimiento' });
  }
}

// ── 12. ACTUALIZAR ESTADO DE ALERTA / REASIGNAR PRIORIDAD ──
async function actualizarEstadoAlerta(req, res) {
  try {
    const { id_alerta, estado, nivel_riesgo } = req.body;
    if (!id_alerta || !estado) {
      return res.status(400).json({ ok: false, message: 'Faltan campos: id_alerta, estado' });
    }

    const usuarioId = (req.user && (req.user.id_usuario || req.user.id)) || null;
    const updates = ['estado = ?'];
    const params = [estado];

    if (nivel_riesgo) {
      updates.push('nivel_riesgo = ?');
      params.push(nivel_riesgo);
    }

    params.push(id_alerta);

    await pool.execute(
      `UPDATE ia_bienestar_alertas SET ${updates.join(', ')} WHERE id_alerta = ?`,
      params
    );

    await pool.execute(
      `INSERT INTO ia_auditoria_desercion (id_usuario, accion, detalle)
       VALUES (?, 'BIENESTAR_ESTADO', ?)`,
      [usuarioId, `Alerta ${id_alerta} actualizada: estado=${estado}${nivel_riesgo ? ', prioridad=' + nivel_riesgo : ''}`]
    );

    return res.json({ ok: true, message: 'Alerta actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar alerta:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar alerta' });
  }
}

// ── 13. CATÁLOGOS (periodos, carreras, grupos) para filtros ──
async function catalogosFiltros(req, res) {
  try {
    const [[periodos], [carreras], [grupos]] = await Promise.all([
      pool.execute('SELECT id_periodo, nombre_periodo FROM periodos ORDER BY id_periodo DESC LIMIT 10'),
      pool.execute('SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera'),
      pool.execute('SELECT id_grupo, nombre_grupo FROM grupos ORDER BY nombre_grupo LIMIT 100')
    ]);
    return res.json({ ok: true, data: { periodos, carreras, grupos } });
  } catch (error) {
    console.error('Error en catálogos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener catálogos' });
  }
}

module.exports = {
  resumen,
  indicadores,
  catalogoAlertas,
  historialSeguimientos,
  exportarPdf,
  exportarExcel,
  auditoria,
  gruposRiesgo,
  alumnosRiesgo,
  detalleAlumno,
  registrarSeguimiento,
  actualizarEstadoAlerta,
  catalogosFiltros
};
