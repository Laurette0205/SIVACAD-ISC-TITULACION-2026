'use strict';

const pool = require('../config/db');
const { createPdf, createExcel } = require('../services/files');
const { getAlumnoContext, buildRiskAnalysis, savePrediction, predictWithML, predictWithMLFull } = require('../services/iaDesercionPredictor');
const mlBridge = require('../services/mlBridge');
const phpDesercionBridge = require('../services/phpDesercionBridge');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDbRiskLevel(value) {
  const risk = normalizeText(value);
  if (risk === 'bajo') return 'Bajo';
  if (risk === 'alto') return 'Alto';
  if (risk === 'critico' || risk === 'crítico') return 'Crítico';
  return 'Medio';
}

function getReportQuery(req) {
  const source = req.reportQuery || req.query || {};
  return {
    tipo: String(source.tipo || 'general').trim().toLowerCase(),
    alumnoId: source.alumnoId ? toSafeNumber(source.alumnoId, null) : null,
    grupoId: source.grupoId ? toSafeNumber(source.grupoId, null) : null,
    periodoId: source.periodoId ? toSafeNumber(source.periodoId, null) : null,
    carreraId: source.carreraId ? toSafeNumber(source.carreraId, null) : null
  };
}

function buildRiskSummary(rows = []) {
  const totals = { bajo: 0, medio: 0, alto: 0, critico: 0 };
  for (const row of rows) {
    const level = normalizeText(row?.nivel);
    const total = toSafeNumber(row?.total, 0);
    if (level === 'bajo') totals.bajo = total;
    else if (level === 'medio') totals.medio = total;
    else if (level === 'alto') totals.alto = total;
    else if (level === 'critico') totals.critico = total;
  }
  return totals;
}

function buildRiskRows(metrics) {
  return [
    { label: 'Bajo', value: toSafeNumber(metrics?.riesgo_bajo) },
    { label: 'Medio', value: toSafeNumber(metrics?.riesgo_medio) },
    { label: 'Alto', value: toSafeNumber(metrics?.riesgo_alto) },
    { label: 'Crítico', value: toSafeNumber(metrics?.riesgo_critico) }
  ];
}

function buildNarrative(metrics, query) {
  const alumnos = toSafeNumber(metrics?.alumnos);
  const docentes = toSafeNumber(metrics?.docentes);
  const grupos = toSafeNumber(metrics?.grupos);
  const pendientes = toSafeNumber(metrics?.alertas_pendientes);
  const atendidas = toSafeNumber(metrics?.alertas_atendidas);
  const bajo = toSafeNumber(metrics?.riesgo_bajo);
  const medio = toSafeNumber(metrics?.riesgo_medio);
  const alto = toSafeNumber(metrics?.riesgo_alto);
  const critico = toSafeNumber(metrics?.riesgo_critico);
  const periodo = metrics?.periodo_activo || 'N/D';

  const lines = [
    `Informe institucional de riesgo académico — Periodo activo: ${periodo}.`,
    `El sistema SIVACAD reporta ${alumnos} alumnos, ${docentes} docentes y ${grupos} grupos bajo cobertura institucional.`,
    `Alertas de deserción: ${pendientes} pendientes, ${atendidas} atendidas. Total: ${pendientes + atendidas}.`,
    `Distribución de riesgo — Bajo: ${bajo}, Medio: ${medio}, Alto: ${alto}, Crítico: ${critico}.`,
    `Este reporte consolida información estratégica para la toma de decisiones a nivel institucional.`
  ];

  if (query.tipo !== 'general') {
    lines.push(`Filtro aplicado — Tipo: ${query.tipo}, Periodo: ${query.periodoId || 'N/D'}, Carrera: ${query.carreraId || 'N/D'}, Grupo: ${query.grupoId || 'N/D'}.`);
  }

  return lines;
}

async function registrarAuditoria({ id_usuario, accion, detalle, id_alerta = null }) {
  try {
    await pool.execute(
      `INSERT INTO ia_auditoria_desercion (id_usuario, accion, detalle, id_alerta)
       VALUES (?, ?, ?, ?)`,
      [id_usuario, accion, detalle || null, id_alerta]
    );
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}

// ==============================
// 🤖 ML HEALTH CHECK
// ==============================
exports.mlHealth = async (req, res) => {
  try {
    const result = await mlBridge.healthCheck();
    const modelos = result.success ? await mlBridge.getModelos() : { success: false };
    return res.json({
      ok: true,
      data: {
        online: result.success,
        flask: result.data || null,
        modelos: modelos.success ? modelos.data : [],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.json({ ok: true, data: { online: false, flask: null, modelos: [], timestamp: new Date().toISOString() } });
  }
};

// ==============================
// 📊 PANEL GLOBAL
// ==============================
exports.dashboard = async (req, res) => {
  try {
    const { periodoId, carreraId, grupoId } = req.query;

    const filters = [];
    const params = [];

    if (periodoId) { filters.push('ia.id_periodo = ?'); params.push(Number(periodoId)); }
    if (carreraId) { filters.push('al.id_carrera = ?'); params.push(Number(carreraId)); }
    if (grupoId) { filters.push('i.id_grupo = ?'); params.push(Number(grupoId)); }

    const whereClause = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const [[totales]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM alumnos) AS alumnos,
        (SELECT COUNT(*) FROM docentes) AS docentes,
        (SELECT COUNT(*) FROM grupos) AS grupos,
        (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado) = 'activa') AS evaluaciones,
        (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
        (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas,
        (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total,
        (SELECT nombre_periodo FROM periodos WHERE LOWER(estado) = 'activo' ORDER BY id_periodo DESC LIMIT 1) AS periodo_activo
    `);

    let riskRows;
    if (filters.length) {
      [riskRows] = await pool.execute(`
        SELECT ia.nivel_riesgo AS nivel, COUNT(*) AS total
        FROM ia_alertas_desercion ia
        INNER JOIN alumnos al ON ia.id_alumno = al.id_alumno
        LEFT JOIN inscripciones i ON i.id_alumno = al.id_alumno AND i.id_periodo = ia.id_periodo
        ${whereClause}
        GROUP BY ia.nivel_riesgo
      `, params);
    } else {
      [riskRows] = await pool.execute(`
        SELECT nivel_riesgo AS nivel, COUNT(*) AS total
        FROM ia_alertas_desercion
        GROUP BY nivel_riesgo
      `);
    }

    const risk = buildRiskSummary(riskRows);

    const [periodos] = await pool.execute(`SELECT id_periodo, nombre_periodo FROM periodos ORDER BY id_periodo DESC LIMIT 10`);
    const [carreras] = await pool.execute(`SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera`);

    return res.json({
      ok: true,
      data: {
        alumnos: toSafeNumber(totales?.alumnos),
        docentes: toSafeNumber(totales?.docentes),
        grupos: toSafeNumber(totales?.grupos),
        evaluaciones: toSafeNumber(totales?.evaluaciones),
        alertas_pendientes: toSafeNumber(totales?.alertas_pendientes),
        alertas_atendidas: toSafeNumber(totales?.alertas_atendidas),
        alertas_total: toSafeNumber(totales?.alertas_total),
        periodo_activo: totales?.periodo_activo || '2026-1',
        riesgo_bajo: risk.bajo,
        riesgo_medio: risk.medio,
        riesgo_alto: risk.alto,
        riesgo_critico: risk.critico,
        catalogos: { periodos, carreras }
      }
    });
  } catch (error) {
    console.error('Error en dashboard IA:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener panel global' });
  }
};

// ==============================
// 📋 RESUMEN GENERAL
// ==============================
exports.resumen = async (req, res) => {
  try {
    const [porPeriodo] = await pool.execute(`
      SELECT p.id_periodo, p.nombre_periodo,
        COUNT(ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN ia.atendida = 1 THEN 1 ELSE 0 END) AS atendidas,
        SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS criticos,
        SUM(CASE WHEN ia.nivel_riesgo = 'Alto' THEN 1 ELSE 0 END) AS alto,
        SUM(CASE WHEN ia.nivel_riesgo = 'Medio' THEN 1 ELSE 0 END) AS medio,
        SUM(CASE WHEN ia.nivel_riesgo = 'Bajo' THEN 1 ELSE 0 END) AS bajo
      FROM periodos p
      LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo = p.id_periodo
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.id_periodo DESC
      LIMIT 10
    `);

    const [porCarrera] = await pool.execute(`
      SELECT c.id_carrera, c.nombre_carrera,
        COUNT(ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN ia.atendida = 1 THEN 1 ELSE 0 END) AS atendidas,
        SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS criticos
      FROM carreras c
      LEFT JOIN alumnos al ON al.id_carrera = c.id_carrera
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = al.id_alumno
      GROUP BY c.id_carrera, c.nombre_carrera
      ORDER BY total_alertas DESC
    `);

    const [porGrupo] = await pool.execute(`
      SELECT g.id_grupo, g.nombre_grupo,
        COUNT(ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS criticos
      FROM grupos g
      LEFT JOIN inscripciones i ON i.id_grupo = g.id_grupo
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = i.id_alumno AND ia.id_periodo = i.id_periodo
      GROUP BY g.id_grupo, g.nombre_grupo
      HAVING total_alertas > 0
      ORDER BY total_alertas DESC
      LIMIT 20
    `);

    return res.json({
      ok: true,
      data: { porPeriodo, porCarrera, porGrupo }
    });
  } catch (error) {
    console.error('Error en resumen IA:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener resumen' });
  }
};

// ==============================
// 🔍 LISTAR ALERTAS (con filtros + paginación)
// ==============================
exports.listAlertas = async (req, res) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      nivel_riesgo,
      atendida,
      periodoId,
      carreraId,
      grupoId,
      busqueda
    } = req.query;

    const page = Math.max(1, parseInt(pagina, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (nivel_riesgo) {
      where.push('ia.nivel_riesgo = ?');
      params.push(nivel_riesgo);
    }
    if (atendida !== undefined && atendida !== '') {
      where.push('ia.atendida = ?');
      params.push(Number(atendida));
    }
    if (periodoId) {
      where.push('ia.id_periodo = ?');
      params.push(Number(periodoId));
    }
    if (carreraId) {
      where.push('al.id_carrera = ?');
      params.push(Number(carreraId));
    }
    if (grupoId) {
      where.push('i.id_grupo = ?');
      params.push(Number(grupoId));
    }
    if (busqueda) {
      where.push('(al.matricula LIKE ? OR u.nombres LIKE ? OR u.apellido_paterno LIKE ? OR u.apellido_materno LIKE ?)');
      const q = `%${busqueda}%`;
      params.push(q, q, q, q);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[countResult]] = await pool.execute(`
      SELECT COUNT(*) AS total
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos al ON ia.id_alumno = al.id_alumno
      INNER JOIN usuarios u ON al.id_usuario = u.id_usuario
      LEFT JOIN inscripciones i ON i.id_alumno = al.id_alumno AND i.id_periodo = ia.id_periodo
      ${whereClause}
    `, params);

    const total = toSafeNumber(countResult?.total);
    const totalPaginas = Math.ceil(total / limit);

    const [rows] = await pool.execute(`
      SELECT ia.id_alerta, ia.id_alumno, ia.id_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.descripcion, ia.recomendacion, ia.atendida, ia.estado_seguimiento,
        ia.modelo_version, ia.explicacion, ia.factores_json, ia.revisado_en,
        al.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        al.id_carrera, c.nombre_carrera, i.id_grupo, g.nombre_grupo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos al ON ia.id_alumno = al.id_alumno
      INNER JOIN usuarios u ON al.id_usuario = u.id_usuario
      LEFT JOIN carreras c ON al.id_carrera = c.id_carrera
      LEFT JOIN inscripciones i ON i.id_alumno = al.id_alumno AND i.id_periodo = ia.id_periodo
      LEFT JOIN grupos g ON i.id_grupo = g.id_grupo
      ${whereClause}
      ORDER BY ia.id_alerta DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      total,
      pagina: page,
      limite: limit,
      totalPaginas
    });
  } catch (error) {
    console.error('Error al listar alertas:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener alertas' });
  }
};

// ==============================
// 📄 DETALLE DE CASO
// ==============================
exports.detalleAlerta = async (req, res) => {
  try {
    const { id } = req.params;

    const [[alerta]] = await pool.execute(`
      SELECT ia.*, al.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
        u.correo_institucional AS email, al.semestre_actual, al.estatus_academico,
        al.id_carrera, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos al ON ia.id_alumno = al.id_alumno
      INNER JOIN usuarios u ON al.id_usuario = u.id_usuario
      LEFT JOIN carreras c ON al.id_carrera = c.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = al.id_alumno
      LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
      WHERE ia.id_alerta = ?
      LIMIT 1
    `, [Number(id)]);

    if (!alerta) {
      return res.status(404).json({ ok: false, message: 'Alerta no encontrada' });
    }

    const [seguimientos] = await pool.execute(`
      SELECT s.*, u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido
      FROM ia_seguimientos_desercion s
      LEFT JOIN usuarios u2 ON s.id_usuario = u2.id_usuario
      WHERE s.id_alerta = ?
      ORDER BY s.creado_en DESC
    `, [Number(id)]);

    const [alertasPrevias] = await pool.execute(`
      SELECT COUNT(*) AS total FROM ia_alertas_desercion
      WHERE id_alumno = ? AND id_alerta != ?
    `, [alerta.id_alumno, Number(id)]);

    return res.json({
      ok: true,
      data: {
        alerta,
        seguimientos,
        alertas_previas: toSafeNumber(alertasPrevias[0]?.total)
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener detalle del caso' });
  }
};

// ==============================
// 🧠 PREDECIR DESERCIÓN
// ==============================
exports.predecirDesercion = async (req, res) => {
  try {
    const { id_alumno, id_periodo } = req.body;

    if (!id_alumno || !id_periodo) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    }

    const context = await getAlumnoContext(id_alumno, id_periodo);
    if (!context) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let analysis = await predictWithML(context);
    const useML = !!analysis;
    if (!analysis) {
      analysis = buildRiskAnalysis(context);
    }

    const id_alerta = await savePrediction({
      idAlumno: id_alumno,
      idPeriodo: id_periodo,
      analysis,
      responsableId: req.user?.id_usuario || null
    });

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'PREDECIR',
      detalle: `[${useML ? 'ML' : 'RULE-V2'}] Predicción para alumno ${id_alumno} periodo ${id_periodo}. Riesgo: ${analysis.nivel} (${analysis.score})`,
      id_alerta
    });

    return res.status(201).json({
      ok: true,
      message: 'Predicción generada correctamente',
      origen: useML ? 'ML' : 'RULE-V2',
      data: { id_alerta, id_alumno, id_periodo, ...analysis }
    });
  } catch (error) {
    console.error('Error al predecir deserción:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible generar la predicción' });
  }
};

exports.predecirDesercionML = async (req, res) => {
  try {
    const { id_alumno, id_periodo } = req.body;

    if (!id_alumno || !id_periodo) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    }

    const context = await getAlumnoContext(id_alumno, id_periodo);
    if (!context) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const analysis = await predictWithML(context);
    if (!analysis) {
      return res.status(503).json({ ok: false, message: 'Servicio ML no disponible. Use /predecir como alternativa.' });
    }

    return res.json({
      ok: true,
      message: 'Predicción ML generada correctamente',
      origen: 'ML',
      data: { id_alumno, id_periodo, ...analysis }
    });
  } catch (error) {
    console.error('Error en predicción ML:', error);
    return res.status(500).json({ ok: false, message: 'Error al generar predicción ML' });
  }
};

// ==============================
// 📝 REGISTRAR SEGUIMIENTO
// ==============================
exports.registrarSeguimiento = async (req, res) => {
  try {
    const { id_alerta, accion, observaciones, estado = 'Pendiente' } = req.body;

    if (!id_alerta || !accion) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    }

    await pool.execute(
      `INSERT INTO ia_seguimientos_desercion (id_alerta, id_usuario, accion, observaciones, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [id_alerta, req.user.id_usuario, accion, observaciones || null, estado]
    );

    await pool.execute(
      `UPDATE ia_alertas_desercion
       SET estado_seguimiento = ?, responsable_id = ?, revisado_en = NOW(),
           atendida = IF(? IN ('Atendida','Cerrada'), 1, atendida)
       WHERE id_alerta = ?`,
      [estado, req.user.id_usuario, estado, id_alerta]
    );

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'SEGUIMIENTO',
      detalle: `Seguimiento registrado para alerta ${id_alerta}: ${accion} (${estado})`,
      id_alerta
    });

    return res.json({ ok: true, message: 'Seguimiento registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar seguimiento:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible registrar el seguimiento' });
  }
};

// ==============================
// ✅ VALIDAR SEGUIMIENTO
// ==============================
exports.validarSeguimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;

    if (!estado) {
      return res.status(400).json({ ok: false, message: 'El estado es obligatorio' });
    }

    await pool.execute(
      `UPDATE ia_alertas_desercion
       SET estado_seguimiento = ?, revisado_en = NOW(), responsable_id = ?,
           atendida = IF(? IN ('Atendida','Cerrada'), 1, 0)
       WHERE id_alerta = ?`,
      [estado, req.user.id_usuario, estado, Number(id)]
    );

    if (observaciones) {
      await pool.execute(
        `INSERT INTO ia_seguimientos_desercion (id_alerta, id_usuario, accion, observaciones, estado)
         VALUES (?, ?, 'Validación de seguimiento', ?, ?)`,
        [Number(id), req.user.id_usuario, observaciones, estado]
      );
    }

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'VALIDAR',
      detalle: `Seguimiento validado para alerta ${id}: estado=${estado}`,
      id_alerta: Number(id)
    });

    return res.json({ ok: true, message: 'Seguimiento validado correctamente' });
  } catch (error) {
    console.error('Error al validar seguimiento:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar seguimiento' });
  }
};

// ==============================
// ➕ GENERAR ALERTA MANUAL
// ==============================
exports.generarAlerta = async (req, res) => {
  try {
    const { id_alumno, id_periodo, nivel_riesgo = 'medio', puntaje_riesgo = 50,
            descripcion = 'Alerta generada por análisis institucional',
            recomendacion = 'Seguimiento académico' } = req.body;

    if (!id_alumno || !id_periodo) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    }

    await pool.execute(
      `INSERT INTO ia_alertas_desercion
        (id_alumno, id_periodo, nivel_riesgo, puntaje_riesgo, descripcion, recomendacion, atendida, modelo_version, explicacion, estado_seguimiento, responsable_id)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'manual-v1', ?, 'Pendiente', ?)`,
      [id_alumno, id_periodo, toDbRiskLevel(nivel_riesgo), puntaje_riesgo, descripcion, recomendacion, descripcion, req.user?.id_usuario || null]
    );

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'GENERAR',
      detalle: `Alerta manual generada para alumno ${id_alumno} periodo ${id_periodo}: ${nivel_riesgo}`
    });

    return res.status(201).json({ ok: true, message: 'Alerta de deserción generada correctamente' });
  } catch (error) {
    console.error('Error al generar alerta IA:', error);
    return res.status(500).json({ ok: false, message: 'Error al generar alerta IA' });
  }
};

// ==============================
// 📄 EXPORTAR PDF (PHP Dompdf)
// ==============================
exports.exportarPdf = async (req, res) => {
  try {
    const idAlumno = req.query.alumnoId ? Number(req.query.alumnoId) : null;
    const buffer = await phpDesercionBridge.generatePdfWithPhp(idAlumno);

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'EXPORTAR_PDF',
      detalle: `Reporte estratégico PDF exportado — IA de Deserción`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte_desercion_sivacad.pdf');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar PDF estratégico:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al exportar PDF' });
  }
};

// ==============================
// 📊 EXPORTAR EXCEL (PHP PhpSpreadsheet)
// ==============================
exports.exportarExcel = async (req, res) => {
  try {
    const idAlumno = req.query.alumnoId ? Number(req.query.alumnoId) : null;
    const buffer = await phpDesercionBridge.generateExcelWithPhp(idAlumno);

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'EXPORTAR_EXCEL',
      detalle: `Reporte estratégico Excel exportado — IA de Deserción`
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_desercion_sivacad.xlsx');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar Excel estratégico:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Error al exportar Excel' });
  }
};

// ==============================
// 📋 AUDITORÍA — LISTAR (con filtros)
// ==============================
exports.auditoria = async (req, res) => {
  try {
    const { pagina = 1, limite = 30, accion, desde, hasta, busqueda } = req.query;
    const page = Math.max(1, parseInt(pagina, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limite, 10) || 30));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (accion) {
      where.push('a.accion = ?');
      params.push(accion);
    }
    if (desde) {
      where.push('a.creado_en >= ?');
      params.push(desde);
    }
    if (hasta) {
      where.push('a.creado_en <= ?');
      params.push(hasta + ' 23:59:59');
    }
    if (busqueda) {
      where.push('(a.detalle LIKE ? OR u.nombres LIKE ? OR u.apellido_paterno LIKE ?)');
      const q = `%${busqueda}%`;
      params.push(q, q, q);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[countResult]] = await pool.execute(`SELECT COUNT(*) AS total FROM ia_auditoria_desercion a LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario ${whereClause}`, params);
    const total = toSafeNumber(countResult?.total);

    const [rows] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.apellido_materno
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      ${whereClause}
      ORDER BY a.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return res.json({
      ok: true,
      data: rows,
      total,
      pagina: page,
      totalPaginas: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener auditoría' });
  }
};

// ==============================
// 🗑️ ELIMINAR REGISTROS DE AUDITORÍA
// ==============================
exports.eliminarAuditoria = async (req, res) => {
  try {
    const { ids, antes, todo } = req.query;
    const where = [];
    const params = [];

    if (ids) {
      const idArr = ids.split(',').map(Number).filter(n => n > 0);
      if (idArr.length === 0) {
        return res.status(400).json({ ok: false, message: 'IDs inválidos' });
      }
      where.push(`id_auditoria IN (${idArr.map(() => '?').join(',')})`);
      params.push(...idArr);
    }
    if (antes) {
      where.push('creado_en <= ?');
      params.push(antes + ' 23:59:59');
    }
    if (todo === '1' || todo === 'true') {
      where.push('1=1');
    }

    if (where.length === 0) {
      return res.status(400).json({ ok: false, message: 'Especifica qué registros eliminar (ids, antes, o todo)' });
    }

    const whereClause = where.join(' AND ');
    const [result] = await pool.execute(`DELETE FROM ia_auditoria_desercion WHERE ${whereClause}`, params);
    const eliminados = result.affectedRows || 0;

    await registrarAuditoria({
      id_usuario: req.user?.id_usuario,
      accion: 'LIMPIAR_AUDITORIA',
      detalle: `Se eliminaron ${eliminados} registros de auditoría${ids ? ' (IDs seleccionados)' : antes ? ` (anteriores a ${antes})` : ' (todos)'}`
    });

    return res.json({ ok: true, message: `${eliminados} registro(s) eliminado(s)`, eliminados });
  } catch (error) {
    console.error('Error al eliminar auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al eliminar registros de auditoría' });
  }
};

// ==============================
// 📥 EXPORTAR AUDITORÍA (CSV)
// ==============================
exports.exportarAuditoria = async (req, res) => {
  try {
    const { accion, desde, hasta } = req.query;
    const where = [];
    const params = [];

    if (accion) { where.push('a.accion = ?'); params.push(accion); }
    if (desde) { where.push('a.creado_en >= ?'); params.push(desde); }
    if (hasta) { where.push('a.creado_en <= ?'); params.push(hasta + ' 23:59:59'); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.execute(`
      SELECT a.id_auditoria, a.accion, a.detalle, a.id_alerta, a.creado_en,
             u.nombres, u.apellido_paterno, u.apellido_materno, u.correo_institucional
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      ${whereClause}
      ORDER BY a.creado_en DESC
      `, params);

    const header = 'ID,Acción,Detalle,ID Alerta,Usuario,Correo,Fecha';
    const csvRows = rows.map(r => {
      const nombre = [r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ');
      const detalle = (r.detalle || '').replace(/"/g, '""');
      const correo = r.correo_institucional || '';
      return `${r.id_auditoria},"${r.accion}","${detalle}",${r.id_alerta || ''},"${nombre}","${correo}","${r.creado_en}"`;
    });
    const csv = '\uFEFF' + header + '\n' + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=auditoria_desercion_${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error al exportar auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al exportar auditoría' });
  }
};

// ==============================
// 💾 RESPALDAR AUDITORÍA (JSON)
// ==============================
exports.respaldarAuditoria = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.correo_institucional AS correo
      FROM ia_auditoria_desercion a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      ORDER BY a.creado_en ASC
    `);

    const backup = {
      sistema: 'SIVACAD-ISC',
      modulo: 'IA de Deserción',
      tabla: 'ia_auditoria_desercion',
      exportado_en: new Date().toISOString(),
      exportado_por: req.user?.id_usuario || null,
      total_registros: rows.length,
      registros: rows
    };

    const json = JSON.stringify(backup, null, 2);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=respaldo_auditoria_desercion_${Date.now()}.json`);
    return res.send(json);
  } catch (error) {
    console.error('Error al respaldar auditoría:', error);
    return res.status(500).json({ ok: false, message: 'Error al respaldar auditoría' });
  }
};
