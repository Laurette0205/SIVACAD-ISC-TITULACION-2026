'use strict';

// ==============================
// 📦 IMPORTACIONES
// ==============================
const pool = require('../config/db');
const { createPdf, createExcel } = require('../services/files');
const {
  getAlumnoContext,
  buildRiskAnalysis,
  savePrediction
} = require('../services/iaDesercionPredictor');

// ==============================
// 🧠 UTILIDADES INTERNAS
// ==============================
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
    grupoId: source.grupoId ? toSafeNumber(source.grupoId, null) : null
  };
}

function buildRiskSummary(rows = []) {
  const totals = {
    bajo: 0,
    medio: 0,
    alto: 0,
    critico: 0
  };

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

function buildReportMetricsRows(metrics, query) {
  return [
    { campo: 'Tipo de reporte', valor: String(query.tipo || 'general') },
    { campo: 'Alumno ID', valor: query.alumnoId ?? 'N/D' },
    { campo: 'Grupo ID', valor: query.grupoId ?? 'N/D' },
    { campo: 'Periodo activo', valor: String(metrics?.periodo_activo || 'N/D') },
    { campo: 'Alumnos', valor: toSafeNumber(metrics?.alumnos) },
    { campo: 'Docentes', valor: toSafeNumber(metrics?.docentes) },
    { campo: 'Grupos', valor: toSafeNumber(metrics?.grupos) },
    { campo: 'Evaluaciones', valor: toSafeNumber(metrics?.evaluaciones) },
    { campo: 'Alertas pendientes', valor: toSafeNumber(metrics?.alertas_pendientes) },
    { campo: 'Alertas atendidas', valor: toSafeNumber(metrics?.alertas_atendidas) },
    { campo: 'Riesgo bajo', valor: toSafeNumber(metrics?.riesgo_bajo) },
    { campo: 'Riesgo medio', valor: toSafeNumber(metrics?.riesgo_medio) },
    { campo: 'Riesgo alto', valor: toSafeNumber(metrics?.riesgo_alto) },
    { campo: 'Riesgo crítico', valor: toSafeNumber(metrics?.riesgo_critico) }
  ];
}

function buildReportSummaryRows(metrics) {
  return [
    { label: 'Alumnos', value: toSafeNumber(metrics?.alumnos) },
    { label: 'Docentes', value: toSafeNumber(metrics?.docentes) },
    { label: 'Grupos', value: toSafeNumber(metrics?.grupos) },
    { label: 'Evaluaciones', value: toSafeNumber(metrics?.evaluaciones) },
    { label: 'Pendientes', value: toSafeNumber(metrics?.alertas_pendientes) },
    { label: 'Atendidas', value: toSafeNumber(metrics?.alertas_atendidas) }
  ];
}

function buildReportNarrative(metrics, query) {
  const alumnos = toSafeNumber(metrics?.alumnos);
  const docentes = toSafeNumber(metrics?.docentes);
  const grupos = toSafeNumber(metrics?.grupos);
  const evaluaciones = toSafeNumber(metrics?.evaluaciones);
  const pendientes = toSafeNumber(metrics?.alertas_pendientes);
  const atendidas = toSafeNumber(metrics?.alertas_atendidas);
  const riesgoBajo = toSafeNumber(metrics?.riesgo_bajo);
  const riesgoMedio = toSafeNumber(metrics?.riesgo_medio);
  const riesgoAlto = toSafeNumber(metrics?.riesgo_alto);
  const riesgoCritico = toSafeNumber(metrics?.riesgo_critico);

  return [
    `Este informe institucional presenta un panorama general del sistema SIVACAD correspondiente al periodo activo ${metrics?.periodo_activo || 'N/D'}.`,
    'La información se construye a partir de métricas consolidadas de alumnos, docentes, grupos, evaluaciones y alertas de riesgo académico.',
    `Tipo de reporte: ${query.tipo}. Alumno ID: ${query.alumnoId || 'N/D'}. Grupo ID: ${query.grupoId || 'N/D'}.`,
    `El sistema registra ${alumnos} alumnos, ${docentes} docentes y ${grupos} grupos en el periodo actual.`,
    `Se detectan ${evaluaciones} evaluaciones activas, ${pendientes} alertas pendientes y ${atendidas} alertas atendidas.`,
    `La distribución de riesgo académico se reporta como: bajo ${riesgoBajo}, medio ${riesgoMedio}, alto ${riesgoAlto} y crítico ${riesgoCritico}.`
  ];
}

async function getDashboardMetrics() {
  const [[totales]] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM alumnos) AS alumnos,
      (SELECT COUNT(*) FROM docentes) AS docentes,
      (SELECT COUNT(*) FROM grupos) AS grupos,
      (SELECT COUNT(*) FROM evaluaciones WHERE LOWER(estado) = 'activa') AS evaluaciones,
      (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
      (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas,
      (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total,
      (SELECT nombre_periodo
         FROM periodos
        WHERE LOWER(estado) = 'activo'
        ORDER BY id_periodo DESC
        LIMIT 1) AS periodo_activo
  `);

  const [riskRows] = await pool.execute(`
    SELECT nivel_riesgo AS nivel, COUNT(*) AS total
    FROM ia_alertas_desercion
    GROUP BY nivel_riesgo
  `);

  const risk = buildRiskSummary(riskRows);

  return {
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
    riesgo_critico: risk.critico
  };
}

// ==============================
// 📊 DASHBOARD
// ==============================
exports.dashboard = async (req, res) => {
  try {
    const metrics = await getDashboardMetrics();

    return res.json({
      ok: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener dashboard'
    });
  }
};

// ==============================
// 🤖 CHATBOT INSTITUCIONAL
// ==============================
exports.chatbot = async (req, res) => {
  try {
    const { mensaje } = req.body;

    if (!mensaje || !String(mensaje).trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El mensaje es obligatorio'
      });
    }

    return res.json({
      ok: true,
      respuesta:
        'Hola, soy el asistente institucional de SIVACAD. Puedo ayudarte con inscripciones, kardex, evaluaciones, reportes e IA académica.',
      intent: 'soporte_operativo',
      confianza: 0.96
    });
  } catch (error) {
    console.error('Error en chatbot:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible responder el mensaje'
    });
  }
};

// ==============================
// 🧠 LISTAR ALERTAS IA
// ==============================
exports.listIA = async (req, res) => {
  try {
    const query = `
      SELECT 
        ai.id_alerta,
        ai.id_alumno,
        ai.id_periodo,
        ai.nivel_riesgo,
        ai.puntaje_riesgo,
        ai.descripcion,
        ai.recomendacion,
        ai.atendida,
        ai.estado_seguimiento,
        ai.modelo_version,
        ai.explicacion,
        ai.factores_json,
        ai.revisado_en,
        a.matricula,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno
      FROM ia_alertas_desercion ai
      INNER JOIN alumnos a ON ai.id_alumno = a.id_alumno
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      ORDER BY ai.id_alerta DESC
    `;

    const [rows] = await pool.execute(query);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al listar alertas IA:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener alertas IA'
    });
  }
};

// ==============================
// 🧠 PREDECIR DESERCIÓN
// ==============================
exports.predecirDesercion = async (req, res) => {
  try {
    const { id_alumno, id_periodo } = req.body;

    if (!id_alumno || !id_periodo) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos obligatorios'
      });
    }

    const context = await getAlumnoContext(id_alumno, id_periodo);

    if (!context) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado'
      });
    }

    const analysis = buildRiskAnalysis(context);

    const id_alerta = await savePrediction({
      idAlumno: id_alumno,
      idPeriodo: id_periodo,
      analysis,
      responsableId: req.user?.id_usuario || null
    });

    return res.status(201).json({
      ok: true,
      message: 'Predicción generada correctamente',
      data: {
        id_alerta,
        id_alumno,
        id_periodo,
        ...analysis
      }
    });
  } catch (error) {
    console.error('Error al predecir deserción:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible generar la predicción'
    });
  }
};

// ==============================
// 📝 REGISTRAR SEGUIMIENTO
// ==============================
exports.registrarSeguimiento = async (req, res) => {
  try {
    const {
      id_alerta,
      accion,
      observaciones,
      estado = 'Pendiente'
    } = req.body;

    if (!id_alerta || !accion) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos obligatorios'
      });
    }

    await pool.execute(
      `
      INSERT INTO ia_seguimientos_desercion
        (id_alerta, id_usuario, accion, observaciones, estado)
      VALUES
        (?, ?, ?, ?, ?)
      `,
      [
        id_alerta,
        req.user.id_usuario,
        accion,
        observaciones || null,
        estado
      ]
    );

    await pool.execute(
      `
      UPDATE ia_alertas_desercion
      SET estado_seguimiento = ?, responsable_id = ?, revisado_en = NOW(),
          atendida = IF(? = 'Atendida', 1, atendida)
      WHERE id_alerta = ?
      `,
      [estado, req.user.id_usuario, estado, id_alerta]
    );

    return res.json({
      ok: true,
      message: 'Seguimiento registrado correctamente'
    });
  } catch (error) {
    console.error('Error al registrar seguimiento:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible registrar el seguimiento'
    });
  }
};

// ==============================
// 🧠 GENERAR ALERTA IA MANUAL
// ==============================
exports.genIA = async (req, res) => {
  try {
    const {
      id_alumno,
      id_periodo,
      nivel_riesgo = 'medio',
      puntaje_riesgo = 50,
      descripcion = 'Alerta generada por análisis institucional',
      recomendacion = 'Seguimiento académico'
    } = req.body;

    if (!id_alumno || !id_periodo) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos obligatorios'
      });
    }

    await pool.execute(
      `
      INSERT INTO ia_alertas_desercion
        (id_alumno, id_periodo, nivel_riesgo, puntaje_riesgo, descripcion, recomendacion, atendida, modelo_version, explicacion, estado_seguimiento, responsable_id)
      VALUES
        (?, ?, ?, ?, ?, ?, 0, 'manual-v1', ?, 'Pendiente', ?)
      `,
      [
        id_alumno,
        id_periodo,
        toDbRiskLevel(nivel_riesgo),
        puntaje_riesgo,
        descripcion,
        recomendacion,
        descripcion,
        req.user?.id_usuario || null
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Alerta de deserción generada correctamente'
    });
  } catch (error) {
    console.error('Error al generar alerta IA:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al generar alerta IA'
    });
  }
};

// ==============================
// 📄 REPORTE PDF
// ==============================
exports.reportPdf = async (req, res) => {
  try {
    const query = getReportQuery(req);
    const metrics = await getDashboardMetrics();

    const generatedAt = new Date();
    const generatedBy =
      [
        req.user?.nombres,
        req.user?.apellido_paterno,
        req.user?.apellido_materno
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Sistema SIVACAD';

    const sections = [
      {
        title: 'Resumen ejecutivo',
        lines: buildReportNarrative(metrics, query)
      },
      {
        title: 'Indicadores generales',
        metrics: [
          { label: 'Alumnos', value: toSafeNumber(metrics.alumnos) },
          { label: 'Docentes', value: toSafeNumber(metrics.docentes) },
          { label: 'Grupos', value: toSafeNumber(metrics.grupos) },
          { label: 'Evaluaciones', value: toSafeNumber(metrics.evaluaciones) },
          { label: 'Alertas pendientes', value: toSafeNumber(metrics.alertas_pendientes) },
          { label: 'Alertas atendidas', value: toSafeNumber(metrics.alertas_atendidas) }
        ]
      },
      {
        title: 'Distribución de riesgo académico',
        metrics: buildRiskRows(metrics)
      },
      {
        title: 'Interpretación institucional',
        lines: [
          'El nivel de riesgo dominante debe interpretarse junto con el total de alumnos, grupos y evaluaciones del periodo.',
          'Este informe se genera para fines institucionales, académicos y de seguimiento interno.',
          `Fecha y hora de generación: ${generatedAt.toLocaleString('es-MX')}.`
        ]
      }
    ];

    const file = await createPdf(
      `reporte-${Date.now()}.pdf`,
      'SIVACAD - Reporte Institucional',
      [],
      {
        generatedAt,
        generatedBy,
        subtitle: 'Indicadores académicos, de riesgo y seguimiento institucional',
        leftLabel: 'TESI',
        rightLabel: 'SIVACAD',
        metadata: {
          tipo: query.tipo,
          alumnoId: query.alumnoId || 'N/D',
          grupoId: query.grupoId || 'N/D',
          periodo_activo: metrics.periodo_activo || 'N/D'
        },
        sections,
        charts: [
          {
            title: 'Gráfica general de indicadores',
            items: [
              { label: 'Alumnos', value: toSafeNumber(metrics.alumnos) },
              { label: 'Docentes', value: toSafeNumber(metrics.docentes) },
              { label: 'Grupos', value: toSafeNumber(metrics.grupos) },
              { label: 'Evaluaciones', value: toSafeNumber(metrics.evaluaciones) },
              { label: 'Pendientes', value: toSafeNumber(metrics.alertas_pendientes) }
            ]
          },
          {
            title: 'Gráfica de riesgo académico',
            items: buildRiskRows(metrics)
          }
        ]
      }
    );

    return res.download(file);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Error al generar PDF'
    });
  }
};

// ==============================
// 📊 REPORTE EXCEL
// ==============================
exports.reportExcel = async (req, res) => {
  try {
    const query = getReportQuery(req);
    const metrics = await getDashboardMetrics();

    const generatedAt = new Date();
    const generatedBy =
      [
        req.user?.nombres,
        req.user?.apellido_paterno,
        req.user?.apellido_materno
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Sistema SIVACAD';

    const detailRows = buildReportMetricsRows(metrics, query);

    const file = await createExcel(
      `reporte-${Date.now()}.xlsx`,
      detailRows,
      {
        title: 'SIVACAD - Reporte Institucional',
        subtitle: 'Indicadores académicos, de riesgo y seguimiento institucional',
        generatedAt,
        generatedBy,
        leftLabel: 'TESI',
        rightLabel: 'SIVACAD',
        metadata: {
          tipo: query.tipo,
          alumnoId: query.alumnoId || 'N/D',
          grupoId: query.grupoId || 'N/D',
          periodo_activo: metrics.periodo_activo || 'N/D'
        },
        summaryRows: buildReportSummaryRows(metrics),
        narrative: buildReportNarrative(metrics, query),
        riskRows: buildRiskRows(metrics)
      }
    );

    return res.download(file);
  } catch (error) {
    console.error('Error al generar Excel:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Error al generar Excel'
    });
  }
};