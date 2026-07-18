'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

const REPORT_DIR = path.join(__dirname, '..', '..', 'uploads', 'reportes');
const LOGO_TECNM = path.join(__dirname, '..', '..', 'uploads', 'Logo-TecNM.png');
const LOGO_TESI = path.join(__dirname, '..', '..', 'uploads', 'Logo-TESI.png');
const WATERMARK_PATH = path.join(__dirname, '..', '..', 'uploads', 'marcadeagua_SIVACAD.jpeg');

[REPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pctOf(value, total) {
  const t = Math.max(1, toNum(total, 1));
  return Math.min(100, Math.max(0, (toNum(value, 0) / t) * 100));
}

function riskColor(nivel) {
  const map = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Crítico': '#ef4444' };
  return map[nivel] || '#64748b';
}

function getNivel(value) {
  if (value >= 75) return 'Crítico';
  if (value >= 50) return 'Alto';
  if (value >= 25) return 'Medio';
  return 'Bajo';
}

async function gatherReportData(filters = {}) {
  const { periodoId, carreraId, grupoId } = filters;

  const [[resumen]] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM alumnos) AS alumnos,
      (SELECT COUNT(*) FROM docentes) AS docentes,
      (SELECT COUNT(*) FROM grupos) AS grupos,
      (SELECT COUNT(*) FROM ia_alertas_desercion) AS alertas_total,
      (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 0) AS alertas_pendientes,
      (SELECT COUNT(*) FROM ia_alertas_desercion WHERE atendida = 1) AS alertas_atendidas,
      (SELECT nombre_periodo FROM periodos WHERE LOWER(estado) = 'activo' ORDER BY id_periodo DESC LIMIT 1) AS periodo_activo
  `);

  const [riesgoRows] = await pool.execute(`
    SELECT nivel_riesgo AS nivel, COUNT(*) AS total FROM ia_alertas_desercion GROUP BY nivel_riesgo ORDER BY FIELD(nivel_riesgo,'Bajo','Medio','Alto','Crítico')
  `);
  const distribucion = riesgoRows.map(r => ({ nivel: r.nivel, total: toNum(r.total) }));

  const [porCarrera] = await pool.execute(`
    SELECT c.nombre_carrera, COUNT(ia.id_alerta) AS total_alertas,
      SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
      SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes
    FROM carreras c
    LEFT JOIN alumnos al ON al.id_carrera = c.id_carrera
    LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = al.id_alumno
    GROUP BY c.id_carrera, c.nombre_carrera HAVING total_alertas > 0 ORDER BY total_alertas DESC
  `);

  const [porMateria] = await pool.execute(`
    SELECT m.nombre_materia, COUNT(DISTINCT kh.id_alumno) AS alumnos_evaluados,
      ROUND(AVG(kh.calificacion), 1) AS promedio_materia,
      SUM(CASE WHEN kh.calificacion < 70 THEN 1 ELSE 0 END) AS reprobados
    FROM materias m INNER JOIN kardex_historial_academico kh ON kh.id_materia = m.id_materia
    GROUP BY m.id_materia, m.nombre_materia HAVING alumnos_evaluados > 0 ORDER BY reprobados DESC, promedio_materia ASC LIMIT 15
  `);

  const [progresion] = await pool.execute(`
    SELECT DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m') AS mes,
      SUM(CASE WHEN ia.nivel_riesgo = 'Bajo' THEN 1 ELSE 0 END) AS bajo,
      SUM(CASE WHEN ia.nivel_riesgo = 'Medio' THEN 1 ELSE 0 END) AS medio,
      SUM(CASE WHEN ia.nivel_riesgo = 'Alto' THEN 1 ELSE 0 END) AS alto,
      SUM(CASE WHEN ia.nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END) AS critico,
      COUNT(*) AS total
    FROM ia_alertas_desercion ia
    GROUP BY DATE_FORMAT(COALESCE(ia.revisado_en, ia.id_alerta), '%Y-%m') ORDER BY mes ASC LIMIT 24
  `);

  const [recientes] = await pool.execute(`
    SELECT ia.id_alerta, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno,
      ia.nivel_riesgo, ia.puntaje_riesgo, ia.atendida, ia.estado_seguimiento,
      c.nombre_carrera, p.nombre_periodo
    FROM ia_alertas_desercion ia
    INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
    INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
    LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
    LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
    ORDER BY ia.id_alerta DESC LIMIT 10
  `);

  const [parcialesRaw] = await pool.execute(`
    SELECT p.numero_parcial,
      ROUND(AVG(p.calificacion_promedio), 1) AS promedio_general,
      SUM(p.riesgos_detectados) AS total_riesgos,
      SUM(p.materias_reprobadas) AS total_reprobadas,
      COUNT(DISTINCT p.id_alumno) AS alumnos_afectados,
      SUM(p.alumnos_activos) AS total_activos,
      SUM(p.alumnos_desertores) AS total_desertores
    FROM ia_desercion_parciales p
    GROUP BY p.numero_parcial
    ORDER BY p.numero_parcial ASC
  `);

  const parciales = parcialesRaw.map(p => ({
    ...p,
    total_activos: toNum(p.total_activos),
    total_desertores: toNum(p.total_desertores),
    total_alumnos: toNum(p.total_activos) + toNum(p.total_desertores),
    tasa_desercion: toNum(p.total_activos) + toNum(p.total_desertores) > 0
      ? Math.round((toNum(p.total_desertores) / (toNum(p.total_activos) + toNum(p.total_desertores))) * 100)
      : 0
  }));

  const [ciclos] = await pool.execute(`
    SELECT p.nombre_periodo AS ciclo,
      COUNT(ia.id_alerta) AS alertas,
      SUM(CASE WHEN ia.nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alto_riesgo,
      ROUND(AVG(ia.puntaje_riesgo), 1) AS riesgo_promedio,
      (SELECT COUNT(*) FROM alumnos WHERE id_carrera IS NOT NULL) AS total_alumnos
    FROM periodos p
    LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo = p.id_periodo
    GROUP BY p.id_periodo, p.nombre_periodo
    ORDER BY p.id_periodo ASC LIMIT 10
  `);

  const ciclosConTasa = ciclos.map(c => ({
    ...c,
    alertas: toNum(c.alertas),
    alto_riesgo: toNum(c.alto_riesgo),
    riesgo_promedio: toNum(c.riesgo_promedio),
    total_alumnos: toNum(c.total_alumnos),
    tasa_desercion: toNum(c.total_alumnos) > 0
      ? Math.round((toNum(c.alertas) / toNum(c.total_alumnos)) * 100)
      : 0
  }));

  const [detalleAlumnos] = await pool.execute(`
    SELECT a.matricula,
      CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS alumno,
      c.nombre_carrera, p.nombre_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
      ia.atendida, ia.estado_seguimiento
    FROM ia_alertas_desercion ia
    INNER JOIN alumnos a ON ia.id_alumno = a.id_alumno
    INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
    LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
    LEFT JOIN periodos p ON ia.id_periodo = p.id_periodo
    ORDER BY ia.puntaje_riesgo DESC
  `);

  const [detalleParciales] = await pool.execute(`
    SELECT a.matricula,
      CONCAT(u.nombres, ' ', u.apellido_paterno) AS alumno,
      p.numero_parcial, p.calificacion_promedio, p.riesgos_detectados,
      p.materias_reprobadas, p.tendencia, p.alumnos_activos, p.alumnos_desertores
    FROM ia_desercion_parciales p
    INNER JOIN alumnos a ON p.id_alumno = a.id_alumno
    INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
    ORDER BY a.matricula, p.numero_parcial
  `);

  const criticos = distribucion.find(d => d.nivel === 'Crítico')?.total || 0;
  const alto = distribucion.find(d => d.nivel === 'Alto')?.total || 0;
  const totalAlertas = toNum(resumen?.alertas_total);
  const tasaAtencion = totalAlertas > 0 ? Math.round((toNum(resumen?.alertas_atendidas) / totalAlertas) * 100) : 0;
  const materiasCriticas = porMateria.filter(m => m.reprobados > 0).slice(0, 3);
  const tendenciaParciales = parciales.length >= 2
    ? (toNum(parciales[parciales.length - 1]?.promedio_general) < toNum(parciales[0]?.promedio_general) ? 'declive' : 'mejora')
    : 'estable';

  const insights = [];

  if (criticos > 0) {
    insights.push(`Se identificaron ${criticos} casos de riesgo crítico que requieren intervención institucional inmediata. Estos alumnos presentan una probabilidad de deserción superior al 75% según el modelo de análisis basado en factores como promedio general, créditos acumulados, estatus académico y alertas previas.`);
  }
  if (alto > 0) {
    insights.push(`${alto} alumnos se encuentran en riesgo alto (puntaje 50-74). Se recomienda priorizar su canalización a tutoría académica dentro de las próximas 48 horas hábiles, con un plan de acompañamiento personalizado.`);
  }
  insights.push(`La tasa de atención institucional es del ${tasaAtencion}%, ${tasaAtencion >= 50 ? 'reflejando un nivel adecuado de seguimiento de casos. Se sugiere mantener la capacidad de respuesta actual.' : 'lo que indica que más de la mitad de las alertas generadas aún no han sido atendidas. Se recomienda reforzar la capacidad de respuesta del equipo de seguimiento.'}`);
  if (materiasCriticas.length > 0) {
    const materiasStr = materiasCriticas.map(m => `${m.nombre_materia} (prom. ${m.promedio_materia}, ${m.reprobados} reprobados)`).join('; ');
    insights.push(`Las materias con mayor incidencia en el riesgo de deserción son: ${materiasStr}. Estas asignaturas concentran la mayor cantidad de reprobaciones y representan un factor crítico en la predicción de abandono escolar. Se recomienda reforzar los programas de tutoría académica en estas materias.`);
  }
  if (porCarrera.length > 0) {
    const maxCarrera = porCarrera[0];
    insights.push(`La carrera de ${maxCarrera.nombre_carrera} concentra la mayor cantidad de alertas (${maxCarrera.total_alertas}), con ${maxCarrera.alto_riesgo} casos de alto/crítico. Se recomienda un análisis cualitativo particular de esta población para identificar factores institucionales que puedan estar contribuyendo al riesgo.`);
  }
  if (parciales.length >= 2) {
    const primero = parciales[0];
    const ultimo = parciales[parciales.length - 1];
    insights.push(`Análisis por parciales académicos: En el Parcial 1 se registró un promedio general de ${primero.promedio_general} con ${primero.tasa_desercion}% de deserción. Para el Parcial ${ultimo.numero_parcial}, el promedio fue de ${ultimo.promedio_general} con ${ultimo.tasa_desercion}% de deserción. La tendencia general es de ${tendenciaParciales === 'declive' ? 'declive académico, lo que sugiere un aumento progresivo del riesgo a medida que avanza el ciclo escolar. Se recomienda implementar intervenciones tempranas desde el primer parcial.' : 'mejora progresiva, lo que indica que las intervenciones tempranas están teniendo un efecto positivo en la retención escolar.'}`);
  }
  if (progresion.length > 2) {
    const first = progresion[0];
    const last = progresion[progresion.length - 1];
    const trend = toNum(last.total) > toNum(first.total) ? 'incremento' : 'disminución';
    insights.push(`La progresión temporal mensual muestra un ${trend} en la generación de alertas: de ${first.total} (${first.mes}) a ${last.total} (${last.mes}). Esta tendencia permite evaluar el impacto de las intervenciones implementadas y ajustar la estrategia institucional de retención.`);
  }
  if (ciclosConTasa.length >= 2) {
    const primero = ciclosConTasa[0];
    const ultimo = ciclosConTasa[ciclosConTasa.length - 1];
    insights.push(`Comparativa entre ciclos: ${primero.ciclo} reportó ${primero.alertas} alertas (${primero.tasa_desercion}% de deserción), mientras que ${ultimo.ciclo} reportó ${ultimo.alertas} alertas (${ultimo.tasa_desercion}% de deserción). ${toNum(ultimo.alertas) < toNum(primero.alertas) ? 'Se observa una disminución de alertas entre ciclos, lo que podría indicar una mejora en las condiciones institucionales.' : 'El incremento de alertas entre ciclos sugiere la necesidad de reforzar las estrategias de prevención.'}`);
  }

  return {
    periodo_activo: resumen?.periodo_activo || 'N/D',
    resumen: {
      alumnos: toNum(resumen?.alumnos), docentes: toNum(resumen?.docentes), grupos: toNum(resumen?.grupos),
      alertas_total: totalAlertas, alertas_pendientes: toNum(resumen?.alertas_pendientes),
      alertas_atendidas: toNum(resumen?.alertas_atendidas), tasa_atencion: tasaAtencion
    },
    distribucion_riesgo: distribucion,
    por_carrera: porCarrera,
    por_materia: porMateria,
    progresion,
    alertas_recientes: recientes,
    parciales,
    ciclos: ciclosConTasa,
    detalle_alumnos: detalleAlumnos,
    detalle_parciales: detalleParciales,
    insights
  };
}

// ============================================================
// PDF GENERATION — Executive Dashboard Layout
// ============================================================

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 45;
const MR = 45;
const MT = 102;
const MB = 62;
const CW = PAGE_W - ML - MR;
const BOTTOM = PAGE_H - MB;

async function generatePdf(data, filters, user) {
  const fileName = `reporte-desercion-estrategico-${Date.now()}.pdf`;
  const filePath = path.resolve(REPORT_DIR, fileName);
  let pageCount = 1;
  const doc = new PDFDocument({
    size: 'A4', margin: 45,
    info: { Title: 'Reporte Estratégico de Deserción - SIVACAD', Author: user?.nombres || 'SIVACAD', Subject: 'Análisis de riesgo académico institucional' }
  });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const generatedBy = [user?.nombres, user?.apellido_paterno, user?.apellido_materno].filter(Boolean).join(' ').trim() || 'Sistema SIVACAD';
  const generatedAt = new Date();

  let bufTecnm = null, bufTesi = null, bufWm = null;
  try { if (fs.existsSync(LOGO_TECNM)) bufTecnm = fs.readFileSync(LOGO_TECNM); } catch (_) {}
  try { if (fs.existsSync(LOGO_TESI)) bufTesi = fs.readFileSync(LOGO_TESI); } catch (_) {}
  try { if (fs.existsSync(WATERMARK_PATH)) bufWm = fs.readFileSync(WATERMARK_PATH); } catch (_) {}

  // Logo height reduced 15% (was 52 → 44)
  const LOGO_H = 44;

  function drawHeader() {
    if (bufWm) {
      try {
        doc.save();
        doc.opacity(0.05);
        doc.image(bufWm, 0, 0, { width: PAGE_W, height: PAGE_H });
        doc.restore();
      } catch (_) {}
    }
    doc.save();
    doc.opacity(0.05);
    doc.fontSize(40).font('Helvetica-Bold').fillColor('#1E293B');
    doc.translate(PAGE_W / 2, PAGE_H / 2).rotate(-30);
    doc.text('CONFIDENCIAL - Uso Academico', { align: 'center', width: 500 });
    doc.restore();

    doc.rect(0, 0, PAGE_W, 84).fill('#0F172A');
    if (bufTecnm) { try { doc.image(bufTecnm, 14, 18, { height: LOGO_H }); } catch (_) {} }
    if (bufTesi) {
      try {
        const tmp = doc.openImage(bufTesi);
        doc.image(bufTesi, PAGE_W - 14 - (LOGO_H / tmp.height) * tmp.width, 18, { height: LOGO_H });
      } catch (_) {}
    }
    doc.fontSize(12.5).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('SIVACAD — Reporte Estratégico de Riesgo de Deserción', ML, 22, { width: CW, align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8')
      .text(`Generado por: ${generatedBy}  |  ${generatedAt.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  |  Periodo: ${data.periodo_activo}`, ML, 44, { width: CW, align: 'center' });
    doc.rect(0, 82, PAGE_W, 2).fill('#4F46E5');
    doc.y = MT;
  }

  function writeFooter() {
    doc.rect(0, PAGE_H - 50, PAGE_W, 1).fill('#E2E8F0');
    doc.fontSize(6.5).font('Helvetica').fillColor('#94A3B8')
      .text('SIVACAD — Sistema Integral para la Valoracion del Conocimiento y Aprovechamiento Academico', ML, PAGE_H - 46, { width: CW, align: 'center' });
    doc.fontSize(6).font('Helvetica').fillColor('#94A3B8')
      .text('Pagina ' + pageCount + ' • Generado el ' + generatedAt.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) + ' a las ' + generatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + ' por ' + generatedBy + ' • CONFIDENCIAL — Uso Academico Exclusivo', ML, PAGE_H - 36, { width: CW, align: 'center' });
  }

  function addNewPage() {
    writeFooter();
    doc.addPage();
    pageCount++;
    drawHeader();
  }

  function needs(pts) {
    if (doc.y + pts > BOTTOM) { addNewPage(); return true; }
    return false;
  }

  function moveY(pts) {
    if (doc.y + pts > BOTTOM) addNewPage();
    else doc.y += pts;
  }

  function sectionTitle(text) {
    needs(22);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text(text, ML, doc.y, { width: CW });
    doc.moveDown(0.1);
    doc.rect(ML, doc.y - 1, 120, 2).fill('#4F46E5');
    doc.moveDown(0.3);
  }

  function paragraph(text, opts) {
    opts = opts || {};
    needs(18);
    doc.fontSize(opts.size || 9).font('Helvetica').fillColor(opts.color || '#334155')
      .text(String(text), ML, doc.y, { width: CW, align: opts.align || 'justify', lineGap: 1.5 });
    doc.moveDown(opts.after || 0.1);
  }

  function metricCards(items) {
    const cols = 3, gap = 8, cardW = (CW - gap * (cols - 1)) / cols, cardH = 50;
    const rows = Math.ceil(items.length / cols);
    needs(rows * (cardH + gap));
    const startY = doc.y;
    items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = ML + col * (cardW + gap), cy = startY + row * (cardH + gap);
      doc.roundedRect(cx, cy, cardW, cardH, 5).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#64748B').font('Helvetica').fontSize(7).text(String(item.label).toUpperCase(), cx + 7, cy + 5, { width: cardW - 14 });
      doc.fillColor(item.color || '#0F172A').font('Helvetica-Bold').fontSize(15).text(String(item.value ?? 0), cx + 7, cy + 22, { width: cardW - 14 });
    });
    doc.y = startY + rows * (cardH + gap) + 2;
  }

  function drawTable(headers, rows, opts) {
    opts = opts || {};
    const colW = CW / headers.length;
    const rowH = opts.rowH || 15, headerH = opts.headerH || 17;
    needs(headerH + rows.length * rowH);

    let y = doc.y;
    function drawTableHeader(yPos) {
      doc.rect(ML, yPos, CW, headerH).fill(opts.headerColor || '#4F46E5');
      headers.forEach((h, i) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
          .text(h, ML + i * colW + 3, yPos + 3, { width: colW - 6, align: i === 0 ? 'left' : 'center' });
      });
    }
    drawTableHeader(y);
    y += headerH;

    rows.forEach((row, ri) => {
      if (y + rowH > BOTTOM) {
        addNewPage();
        y = doc.y;
        drawTableHeader(y);
        y += headerH;
      }
      if (ri % 2 === 0) doc.rect(ML, y, CW, rowH).fill('#F8FAFC');
      row.forEach((cell, i) => {
        doc.fillColor('#334155').font('Helvetica').fontSize(6.5)
          .text(String(cell ?? ''), ML + i * colW + 3, y + 2, { width: colW - 6, align: i === 0 ? 'left' : 'center' });
      });
      doc.moveTo(ML, y + rowH - 1).lineWidth(0.3).strokeColor('#E2E8F0').lineTo(PAGE_W - MR, y + rowH - 1).stroke();
      y += rowH;
    });
    doc.y = y + 3;
  }

  function drawDonut(cx, cy, r, items, totalField) {
    totalField = totalField || 'total';
    const total = items.reduce((s, i) => s + toNum(i[totalField]), 0) || 1;
    let startAngle = -90;
    items.forEach(item => {
      const val = toNum(item[totalField]);
      if (val <= 0) return;
      const angle = (val / total) * 360;
      const endAngle = startAngle + angle;
      const sr = (startAngle * Math.PI) / 180, er = (endAngle * Math.PI) / 180;
      const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
      const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
      doc.path('M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + (angle > 180 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z').fill(item.color || '#4F46E5');
      startAngle = endAngle;
    });
    doc.circle(cx, cy, r * 0.42).fill('#FFFFFF');
  }

  function drawBarChart(title, items, valueField, labelField, color) {
    valueField = valueField || 'value';
    labelField = labelField || 'label';
    color = color || '#4F46E5';
    needs(35);
    doc.y += 3;
    const chartX = ML;
    let chartY = doc.y;
    const chartW = CW, barH = 14, gap = 5, labelW = 130;
    const maxVal = Math.max(1, ...items.map(i => toNum(i[valueField])));

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0F172A').text(title, chartX, chartY, { width: chartW });
    chartY += 14;

    if (!items.length) {
      doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text('Sin datos disponibles', chartX, chartY);
      doc.y = chartY + 16;
      return;
    }

    items.forEach(item => {
      const val = toNum(item[valueField]);
      const barW = Math.max(3, ((chartW - labelW - 25) * val) / maxVal);
      if (chartY + barH + gap > BOTTOM) { addNewPage(); chartY = doc.y; }
      doc.fillColor('#334155').font('Helvetica').fontSize(7.5).text(String(item[labelField]), chartX, chartY, { width: labelW });
      doc.roundedRect(chartX + labelW, chartY, chartW - labelW - 18, barH, 3).fillAndStroke('#F1F5F9', '#E2E8F0');
      doc.roundedRect(chartX + labelW, chartY, barW, barH, 3).fill(item.color || color);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.5).text(String(val), chartX + chartW - 22, chartY, { width: 22, align: 'right' });
      chartY += barH + gap;
    });
    doc.y = chartY + 1;
  }

  // Multi-column layout: 42% chart/graphic + 58% text side by side
  function drawSideBySide(chartWidthPct, drawChartFn, drawTextFn) {
    const chartW = CW * chartWidthPct;
    const textW = CW - chartW - 8;
    const startY = doc.y;
    const chartX = ML;
    const textX = ML + chartW + 8;

    const savedX = doc.x, savedY = doc.y;

    doc.y = startY;
    drawChartFn(chartX, chartW);

    const chartEndY = doc.y;

    doc.y = startY;
    const textStartX = doc.x;
    drawTextFn(textX, textW);

    const textEndY = doc.y;

    doc.y = Math.max(chartEndY, textEndY) + 2;
  }

  // ========== BUILD PDF — Executive Dashboard ==========
  drawHeader();

  // PAGE 1: Executive Summary
  sectionTitle('Resumen Ejecutivo');
  const r = data.resumen;
  paragraph('El presente reporte estrategico consolida el analisis de riesgo academico del periodo ' + data.periodo_activo + '. El sistema SIVACAD tiene registrados ' + r.alumnos + ' alumnos, ' + r.docentes + ' docentes y ' + r.grupos + ' grupos bajo cobertura institucional. Se han generado ' + r.alertas_total + ' alertas de desercion, de las cuales ' + r.alertas_pendientes + ' estan pendientes de atencion y ' + r.alertas_atendidas + ' han sido atendidas (tasa de atencion: ' + r.tasa_atencion + '%).');

  metricCards([
    { label: 'Alertas totales', value: r.alertas_total, color: '#4F46E5' },
    { label: 'Pendientes', value: r.alertas_pendientes, color: '#F97316' },
    { label: 'Atendidas', value: r.alertas_atendidas, color: '#22C55E' },
    { label: 'Tasa de atencion', value: r.tasa_atencion + '%', color: r.tasa_atencion >= 50 ? '#22C55E' : '#EF4444' },
    { label: 'Alumnos registrados', value: r.alumnos, color: '#3B82F6' },
    { label: 'Grupos activos', value: r.grupos, color: '#8B5CF6' }
  ]);

  // Risk Distribution — with side-by-side chart + text
  sectionTitle('Distribucion de Riesgo Academico');
  const totalDist = data.distribucion_riesgo.reduce((s, d) => s + d.total, 0);

  drawSideBySide(0.42,
    function(cx, cw) {
      const r2 = 36;
      const pieCx = cx + cw / 2;
      const pieCy = doc.y + 42;
      drawDonut(pieCx, pieCy, r2, data.distribucion_riesgo.map(function(d) { return { ...d, color: riskColor(d.nivel) }; }));
      let ly = pieCy - r2 - 4;
      data.distribucion_riesgo.forEach(function(item) {
        doc.circle(pieCx + r2 + 12, ly + 3, 3.5).fill(riskColor(item.nivel));
        doc.fillColor('#334155').font('Helvetica').fontSize(7.5)
          .text(item.nivel + ': ' + item.total + ' (' + pctOf(item.total, totalDist).toFixed(1) + '%)', pieCx + r2 + 20, ly, { width: cw - r2 - 30 });
        ly += 14;
      });
      doc.y = Math.max(pieCy + r2 + 10, ly + 4);
    },
    function(tx, tw) {
      needs(18);
      paragraph('La distribucion de riesgo entre los ' + totalDist + ' casos analizados muestra la proporcion de alumnos en cada nivel de riesgo. El ' + pctOf(data.distribucion_riesgo.filter(function(d) { return d.nivel === 'Critico' || d.nivel === 'Alto'; }).reduce(function(s, d) { return s + d.total; }, 0), totalDist).toFixed(1) + '% de los casos se concentra en niveles Alto o Critico, lo que representa una senal de alerta institucional que requiere atencion inmediata por parte de las autoridades academicas.', { after: 0.1 });
      var nivelMap = { Bajo: 'bajo (riesgo controlado)', Medio: 'medio (seguimiento preventivo)', Alto: 'alto (intervencion prioritaria)', 'Critico': 'critico (accion inmediata requerida)' };
      data.distribucion_riesgo.forEach(function(d) {
        doc.fontSize(7.5).font('Helvetica').fillColor(riskColor(d.nivel))
          .text(d.nivel + ': ' + d.total + ' casos — ' + (nivelMap[d.nivel] || ''), tx, doc.y, { width: tw, lineGap: 1 });
        doc.moveDown(0.05);
      });
    }
  );

  drawBarChart('Comparativa por nivel de riesgo',
    data.distribucion_riesgo.map(function(d) { return { label: d.nivel, value: d.total, color: riskColor(d.nivel) }; }), 'value', 'label');

  // PER-PARCIAL ANALYSIS
  if (data.parciales.length > 0) {
    needs(10);
    sectionTitle('Analisis por Parciales Academicos');
    paragraph('El analisis por parciales academicos permite identificar tendencias tempranas de desercion y evaluar el impacto de las intervenciones pedagogicas implementadas durante el ciclo escolar ' + data.periodo_activo + '. A continuacion se presenta el desglose detallado del rendimiento y riesgo detectado en cada uno de los parciales evaluados.');

    drawTable(
      ['Parcial', 'Promedio', 'Riesgos', 'Reprob.', 'Afect.', 'Activos', 'Desert.', 'Tasa Deser.'],
      data.parciales.map(function(p) {
        return ['Parcial ' + p.numero_parcial, String(p.promedio_general), String(p.total_riesgos), String(p.total_reprobadas), String(p.alumnos_afectados), String(p.total_activos), String(p.total_desertores), p.tasa_desercion + '%'];
      }),
      { headerColor: '#3B82F6' }
    );

    // Per-parcial description + donut chart side by side
    data.parciales.forEach(function(p) {
      var nivel = getNivel(p.tasa_desercion);
      var tend = p.tendencia || 'Estable';

      drawSideBySide(0.40,
        function(cx2, cw2) {
          var r3 = 30;
          var pcx = cx2 + cw2 / 2;
          var pcy = doc.y + 35;
          drawDonut(pcx, pcy, r3, [
            { label: 'Activos', color: '#22C55E', total: p.total_activos },
            { label: 'Desertores', color: '#EF4444', total: p.total_desertores }
          ]);
          var ly2 = pcy - r3 - 2;
          [{ label: 'Activos', color: '#22C55E', total: p.total_activos }, { label: 'Desertores', color: '#EF4444', total: p.total_desertores }].forEach(function(it) {
            doc.circle(pcx + r3 + 10, ly2 + 3, 3).fill(it.color);
            doc.fillColor('#334155').font('Helvetica').fontSize(7)
              .text(it.label + ': ' + it.total + ' (' + (it.total > 0 ? ((it.total / p.total_alumnos) * 100).toFixed(1) : 0) + '%)', pcx + r3 + 16, ly2, { width: cw2 - r3 - 24 });
            ly2 += 12;
          });
          doc.y = Math.max(pcy + r3 + 8, ly2 + 2);
        },
        function(tx2, tw2) {
          needs(18);
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A')
            .text('Parcial ' + p.numero_parcial + ': ', tx2, doc.y, { width: 55, continued: true });
          doc.font('Helvetica').fillColor('#334155').fontSize(8)
            .text('Promedio general de ' + p.promedio_general + ' con ' + p.total_riesgos + ' eventos de riesgo. De ' + p.total_alumnos + ' alumnos, ' + p.total_activos + ' activos y ' + p.total_desertores + ' desertores (' + p.tasa_desercion + '% - nivel ' + nivel + '). ' + (p.numero_parcial === 1 ? 'Primer corte critico para intervenciones tempranas.' : p.numero_parcial === 3 ? 'Parcial final que consolida el panorama del ciclo.' : 'Parcial intermedio para evaluar intervenciones.'), { width: tw2, align: 'justify' });
        }
      );
    });
  }

  // PER-CYCLE ANALYSIS
  if (data.ciclos.length > 1) {
    needs(10);
    sectionTitle('Analisis Comparativo por Ciclos Escolares');
    paragraph('El analisis comparativo historico por ciclos escolares permite a la Direccion Academica evaluar la evolucion de la desercion estudiantil a lo largo del tiempo. Esta vision estrategica facilita la identificacion de patrones estacionales y el impacto de las politicas institucionales de retencion.');

    drawTable(
      ['Ciclo', 'Alertas', 'Alto/Critico', 'Riesgo Prom.', 'Total Alumnos', 'Tasa Deserc.'],
      data.ciclos.map(function(c) {
        return [c.ciclo, String(c.alertas), String(c.alto_riesgo), String(c.riesgo_promedio), String(c.total_alumnos), c.tasa_desercion + '%'];
      }),
      { headerColor: '#8B5CF6' }
    );

    data.ciclos.forEach(function(c, i) {
      needs(16);
      var tendencia = i > 0 ? (c.alertas > data.ciclos[i - 1].alertas ? 'incremento' : 'disminucion') : 'inicial';
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A')
        .text(c.ciclo + ': ', ML, doc.y, { width: 55, continued: true });
      doc.font('Helvetica').fillColor('#334155').fontSize(8)
        .text('Se registraron ' + c.alertas + ' alertas (' + c.alto_riesgo + ' alto/critico, riesgo promedio ' + c.riesgo_promedio + '). Tasa de desercion: ' + c.tasa_desercion + '% sobre ' + c.total_alumnos + ' alumnos. ' + (i > 0 ? 'Comparado con ' + data.ciclos[i - 1].ciclo + ': ' + tendencia + ' de ' + Math.abs(c.alertas - data.ciclos[i - 1].alertas) + ' alertas.' : 'Ciclo base para comparacion historica.') + (c.alto_riesgo > c.alertas / 2 ? ' La concentracion de casos graves requiere atencion prioritaria.' : ''), { width: CW - 55, align: 'justify' });
    });

    drawBarChart('Alertas por ciclo escolar', data.ciclos.map(function(c) { return { label: c.ciclo, value: c.alertas, color: '#8B5CF6' }; }), 'value', 'label', '#8B5CF6');
    drawBarChart('Tasa de desercion por ciclo', data.ciclos.map(function(c) { return { label: c.ciclo, value: c.tasa_desercion, color: '#EF4444' }; }), 'value', 'label', '#EF4444');
  }

  // STRATEGIC INSIGHTS — full-width text blocks, no orphans
  needs(10);
  sectionTitle('Insights Estrategicos');
  paragraph('A continuacion se presentan los hallazgos clave del analisis automatizado de desercion, generados mediante el modelo de inteligencia artificial de SIVACAD. Estas observaciones estan disenadas para apoyar la toma de decisiones del Consejo Universitario y las Direcciones Academicas.');

  data.insights.forEach(function(insight, i) {
    needs(30);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A')
      .text('' + (i + 1) + '.', ML, doc.y, { width: 16, continued: true });
    doc.font('Helvetica').fillColor('#334155').fontSize(8.5)
      .text(insight, { width: CW - 16, align: 'justify' });
    doc.moveDown(0.2);
  });

  // BY CAREER
  if (data.por_carrera.length > 0) {
    needs(10);
    sectionTitle('Analisis por Carrera');
    paragraph('El desglose por carrera permite identificar las areas academicas con mayor incidencia de riesgo de desercion. La carrera de ' + data.por_carrera[0].nombre_carrera + ' encabeza la lista con ' + data.por_carrera[0].total_alertas + ' alertas, de las cuales ' + data.por_carrera[0].alto_riesgo + ' son de nivel Alto o Critico.');

    drawTable(
      ['Carrera', 'Alertas Totales', 'Alto/Critico', 'Pendientes'],
      data.por_carrera.map(function(c) { return [c.nombre_carrera, String(c.total_alertas), String(c.alto_riesgo), String(c.pendientes)]; }),
      { headerColor: '#0EA5E9' }
    );

    drawBarChart('Alertas por carrera', data.por_carrera.map(function(c) { return { label: c.nombre_carrera.substring(0, 20), value: c.total_alertas, color: '#0EA5E9' }; }), 'value', 'label', '#0EA5E9');
  }

  // TEMPORAL PROGRESSION
  if (data.progresion.length > 0) {
    needs(10);
    sectionTitle('Progresion Temporal del Riesgo');
    paragraph('La evolucion mensual de las alertas de desercion muestra la dinamica del riesgo a lo largo del periodo analizado. Las barras apiladas representan la composicion por nivel de riesgo en cada mes.');

    drawTable(
      ['Mes', 'Bajo', 'Medio', 'Alto', 'Critico', 'Total'],
      data.progresion.map(function(p) { return [p.mes, String(p.bajo), String(p.medio), String(p.alto), String(p.critico), String(p.total)]; }),
      { headerColor: '#8B5CF6' }
    );

    var maxProg = Math.max(1, ...data.progresion.map(function(p) { return toNum(p.total); }));
    needs(data.progresion.length * 14);
    var py = doc.y + 3;
    data.progresion.forEach(function(p) {
      if (py + 13 > BOTTOM) { addNewPage(); py = doc.y; }
      var barH = 11, compW = CW - 110;
      doc.fillColor('#64748B').font('Helvetica').fontSize(6.5).text(p.mes, ML, py + 1, { width: 50 });
      doc.roundedRect(ML + 60, py, compW, barH, 2).fillAndStroke('#F1F5F9', '#E2E8F0');
      var bW = (toNum(p.bajo) / maxProg) * compW, mW = (toNum(p.medio) / maxProg) * compW;
      var aW = (toNum(p.alto) / maxProg) * compW, cW = (toNum(p.critico) / maxProg) * compW;
      doc.roundedRect(ML + 60, py, Math.max(bW, 1), barH, 2).fill('#22c55e');
      doc.roundedRect(ML + 60 + bW, py, Math.max(mW, 1), barH, 2).fill('#eab308');
      doc.roundedRect(ML + 60 + bW + mW, py, Math.max(aW, 1), barH, 2).fill('#f97316');
      doc.roundedRect(ML + 60 + bW + mW + aW, py, Math.max(cW, 1), barH, 2).fill('#ef4444');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(6.5).text(String(p.total), ML + 60 + compW + 5, py);
      py += barH + 2;
    });
    doc.y = py + 4;
  }

  // RECENT ALERTS
  if (data.alertas_recientes.length > 0) {
    needs(10);
    sectionTitle('Alertas Recientes');
    paragraph('Las siguientes son las alertas de desercion mas recientes registradas en el sistema. Se recomienda priorizar su atencion segun el nivel de riesgo.');

    drawTable(
      ['#', 'Matricula', 'Alumno', 'Riesgo', 'Puntaje', 'Estado', 'Periodo'],
      data.alertas_recientes.map(function(a) {
        return [String(a.id_alerta), a.matricula, a.nombres + ' ' + a.apellido_paterno + ' ' + a.apellido_materno, a.nivel_riesgo, String(a.puntaje_riesgo), a.atendida ? 'Atendida' : 'Pendiente', a.nombre_periodo || ''];
      }),
      { headerColor: '#4F46E5' }
    );
  }

  writeFooter();
  doc.end();
  await new Promise(function(resolve, reject) {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return filePath;
}

// ============================================================
// EXCEL GENERATION — Auto-fit columns, no merged cells in data
// ============================================================

async function generateExcel(data, filters, user) {
  const fileName = 'reporte-desercion-estrategico-' + Date.now() + '.xlsx';
  const filePath = path.resolve(REPORT_DIR, fileName);
  const workbook = new ExcelJS.Workbook();
  const generatedBy = [user?.nombres, user?.apellido_paterno, user?.apellido_materno].filter(Boolean).join(' ').trim() || 'Sistema SIVACAD';
  const generatedAt = new Date();

  workbook.creator = generatedBy;
  workbook.company = 'TESI';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.title = 'SIVACAD - Reporte Estrategico de Desercion';
  workbook.subject = 'Analisis de riesgo academico institucional';

  var SEM = { crit: 'FFFF4444', alto: 'FFF97316', med: 'FFEAB308', bajo: 'FF22C55E', info: 'FF3B82F6', acc: 'FF4F46E5', txt: 'FF334155', dark: 'FF0F172A', white: 'FFFFFFFF', bg: 'FFF8FAFC', bdr: 'FFE2E8F0' };

  function sc(cell, o) {
    o = o || {};
    cell.font = { name: 'Arial', size: o.size || 10, bold: o.bold || false, color: { argb: o.color || SEM.txt } };
    cell.alignment = { horizontal: o.align || 'left', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin', color: { argb: SEM.bdr } }, left: { style: 'thin', color: { argb: SEM.bdr } }, bottom: { style: 'thin', color: { argb: SEM.bdr } }, right: { style: 'thin', color: { argb: SEM.bdr } } };
    if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
    if (o.italic) cell.font.italic = true;
  }

  function autoCols(sheet, headers, data) {
    sheet.columns = headers.map(function(h, i) {
      var maxLen = h.length;
      data.forEach(function(row) {
        var v = String(row[i] || '');
        maxLen = Math.max(maxLen, v.length);
      });
      return { width: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
  }

  function hdr(sheet, rowNum, values, fillC) {
    var row = sheet.getRow(rowNum);
    row.values = values;
    row.eachCell(function(c) { sc(c, { size: 10, bold: true, color: SEM.white, align: 'center', fill: fillC }); });
    row.height = 22;
  }

  function dRow(sheet, rowNum, values, oArr) {
    var row = sheet.getRow(rowNum);
    row.values = values;
    row.eachCell(function(c, i) {
      var o = oArr && oArr[i] ? oArr[i] : {};
      sc(c, { size: 9.5, color: SEM.txt, align: o.align || (i === 0 ? 'left' : 'center'), bold: o.bold, fill: o.fill, color: o.color || SEM.txt });
    });
  }

  // SHEET 1: Portada (executive summary)
  var p = workbook.addWorksheet('Portada');
  p.views = [{ showGridLines: false }];
  p.columns = Array(8).fill().map(function() { return { width: 16 }; });
  p.mergeCells('A1:H1');
  sc(p.getCell('A1'), { size: 20, bold: true, color: SEM.dark, align: 'center' });
  p.getCell('A1').value = 'SIVACAD — Reporte Estrategico de Riesgo de Desercion';
  p.getRow(1).height = 36;

  p.mergeCells('A2:H2');
  sc(p.getCell('A2'), { size: 10, color: SEM.txt, align: 'center', italic: true });
  p.getCell('A2').value = 'Generado por: ' + generatedBy + ' | Fecha: ' + generatedAt.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) + ' | Periodo activo: ' + data.periodo_activo;

  p.mergeCells('A4:H4');
  sc(p.getCell('A4'), { size: 13, bold: true, color: SEM.dark });
  p.getCell('A4').value = 'Resumen Ejecutivo';

  var rr = data.resumen;
  p.mergeCells('A5:H5');
  sc(p.getCell('A5'), { size: 10, color: SEM.txt, align: 'justify' });
  p.getCell('A5').value = 'El sistema SIVACAD registra ' + rr.alumnos + ' alumnos, ' + rr.docentes + ' docentes y ' + rr.grupos + ' grupos. Se han generado ' + rr.alertas_total + ' alertas de desercion (' + rr.alertas_pendientes + ' pendientes, ' + rr.alertas_atendidas + ' atendidas). Tasa de atencion: ' + rr.tasa_atencion + '%.';
  p.getRow(5).height = 40;

  var metrics = [
    ['Alertas totales', rr.alertas_total, SEM.acc], ['Pendientes', rr.alertas_pendientes, SEM.alto],
    ['Atendidas', rr.alertas_atendidas, SEM.bajo], ['Tasa atencion', rr.tasa_atencion + '%', rr.tasa_atencion >= 50 ? SEM.bajo : SEM.crit],
    ['Alumnos', rr.alumnos, SEM.info], ['Docentes', rr.docentes, SEM.info], ['Grupos', rr.grupos, SEM.acc]
  ];
  metrics.forEach(function(m, i) {
    var col = (i % 4) * 2 + 1, row = 7 + Math.floor(i / 4) * 2;
    var lc = p.getCell(String.fromCharCode(64 + col) + '' + row);
    var vc = p.getCell(String.fromCharCode(64 + col + 1) + '' + row);
    sc(lc, { size: 8, color: '#64748B', align: 'center', fill: SEM.bg });
    lc.value = m[0].toUpperCase();
    sc(vc, { size: 14, bold: true, color: m[2], align: 'center', fill: SEM.bg });
    vc.value = m[1];
  });

  if (data.insights.length > 0) {
    var ir = 13;
    p.mergeCells('A' + ir + ':H' + ir);
    sc(p.getCell('A' + ir), { size: 12, bold: true, color: SEM.dark });
    p.getCell('A' + ir).value = 'Hallazgos Clave';
    data.insights.slice(0, 5).forEach(function(insight, i) {
      ir++;
      p.mergeCells('A' + ir + ':H' + ir);
      sc(p.getCell('A' + ir), { size: 9.5, color: SEM.txt, align: 'justify' });
      p.getCell('A' + ir).value = '' + (i + 1) + '. ' + insight;
      p.getRow(ir).height = 34;
    });
  }

  // SHEET 2: Datos por parcial (no merged cells in data)
  var d2 = workbook.addWorksheet('Parciales');
  var parHeaders = ['Parcial', 'Promedio Gral.', 'Riesgos', 'Reprobadas', 'Alumnos Afect.', 'Activos', 'Desertores', 'Total Alumnos', 'Tasa Desercion', 'Nivel'];
  var parData = data.parciales.map(function(p) {
    return ['Parcial ' + p.numero_parcial, p.promedio_general, p.total_riesgos, p.total_reprobadas, p.alumnos_afectados, p.total_activos, p.total_desertores, p.total_alumnos, p.tasa_desercion + '%', getNivel(p.tasa_desercion)];
  });
  autoCols(d2, parHeaders, parData);
  hdr(d2, 1, parHeaders, 'FF3B82F6');
  parData.forEach(function(row, i) {
    var pp = data.parciales[i];
    dRow(d2, i + 2, row, [
      { bold: true }, {}, {}, {}, {},
      { color: SEM.bajo }, { color: SEM.crit }, {},
      { bold: true, color: pp.tasa_desercion >= 50 ? SEM.crit : pp.tasa_desercion >= 25 ? SEM.med : SEM.bajo },
      { bold: true, color: riskColor(getNivel(pp.tasa_desercion)) }
    ]);
  });

  // SHEET 3: Datos por ciclo (no merged cells)
  var d3 = workbook.addWorksheet('Ciclos');
  var cicHeaders = ['Ciclo', 'Alertas', 'Alto/Critico', 'Riesgo Prom.', 'Total Alumnos', 'Tasa Desercion', 'Nivel'];
  var cicData = data.ciclos.map(function(c) {
    return [c.ciclo, c.alertas, c.alto_riesgo, c.riesgo_promedio, c.total_alumnos, c.tasa_desercion + '%', getNivel(c.tasa_desercion)];
  });
  autoCols(d3, cicHeaders, cicData);
  hdr(d3, 1, cicHeaders, 'FF8B5CF6');
  cicData.forEach(function(row, i) {
    var cc = data.ciclos[i];
    dRow(d3, i + 2, row, [
      { bold: true }, {},
      { color: cc.alto_riesgo > 0 ? SEM.crit : SEM.bajo }, {},
      {}, { bold: true, color: cc.tasa_desercion >= 50 ? SEM.crit : cc.tasa_desercion >= 25 ? SEM.med : SEM.bajo },
      { bold: true, color: riskColor(getNivel(cc.tasa_desercion)) }
    ]);
  });

  // SHEET 4: Distribucion riesgo
  var d4 = workbook.addWorksheet('Distribucion riesgo');
  var distHeaders = ['Nivel de Riesgo', 'Alertas', 'Porcentaje', 'Semaforo'];
  var distData = data.distribucion_riesgo.map(function(d) {
    return [d.nivel, d.total, pctOf(d.total, data.resumen.alertas_total).toFixed(1) + '%', d.nivel];
  });
  autoCols(d4, distHeaders, distData);
  hdr(d4, 1, distHeaders, 'FF4F46E5');
  distData.forEach(function(row, i) {
    dRow(d4, i + 2, row, [
      {}, { bold: true, color: SEM.dark, align: 'center' }, { color: SEM.dark, align: 'center' },
      { bold: true, color: riskColor(data.distribucion_riesgo[i].nivel), align: 'center', fill: riskColor(data.distribucion_riesgo[i].nivel) + '20' }
    ]);
  });

  // SHEET 5: Alertas recientes
  var d5 = workbook.addWorksheet('Alertas recientes');
  var alHeaders = ['#', 'Matricula', 'Alumno', 'Riesgo', 'Puntaje', 'Estado', 'Periodo'];
  var alData = data.alertas_recientes.map(function(a) {
    return [a.id_alerta, a.matricula, a.nombres + ' ' + a.apellido_paterno + ' ' + a.apellido_materno, a.nivel_riesgo, a.puntaje_riesgo, a.atendida ? 'Atendida' : 'Pendiente', a.nombre_periodo || ''];
  });
  autoCols(d5, alHeaders, alData);
  hdr(d5, 1, alHeaders, 'FF4F46E5');
  alData.forEach(function(row, i) {
    var a = data.alertas_recientes[i];
    dRow(d5, i + 2, row, [
      { align: 'center' }, {}, {},
      { bold: true, color: riskColor(a.nivel_riesgo), align: 'center', fill: riskColor(a.nivel_riesgo) + '20' },
      { bold: true, color: SEM.dark, align: 'center' },
      { color: a.atendida ? SEM.bajo : SEM.crit, align: 'center' },
      { align: 'center' }
    ]);
  });

  // SHEET 6: Insights (full wrapped text)
  var d6 = workbook.addWorksheet('Insights estrategicos');
  d6.columns = [{ width: 100 }];
  d6.mergeCells('A1:A1');
  sc(d6.getCell('A1'), { size: 14, bold: true, color: SEM.dark });
  d6.getCell('A1').value = 'Analisis Estrategico de Factores de Riesgo de Desercion';
  d6.mergeCells('A2:A2');
  sc(d6.getCell('A2'), { size: 10, color: '#64748B', italic: true });
  d6.getCell('A2').value = 'Generado por inteligencia artificial de SIVACAD basado en datos historicos de rendimiento academico.';
  data.insights.forEach(function(insight, i) {
    var r = i + 4;
    d6.mergeCells('A' + r + ':A' + r);
    d6.getCell('A' + r).value = '' + (i + 1) + '. ' + insight;
    sc(d6.getCell('A' + r), { size: 10.5, color: SEM.txt, align: 'justify' });
    d6.getRow(r).height = 48;
  });

  // SHEET 7: Datos crudos alumnos (no merged cells)
  if (data.detalle_alumnos.length > 0) {
    var d7 = workbook.addWorksheet('Datos crudos alumnos');
    var dalHeaders = ['Matricula', 'Alumno', 'Carrera', 'Periodo', 'Nivel Riesgo', 'Puntaje', 'Atendida', 'Seguimiento'];
    var dalData = data.detalle_alumnos.map(function(d) {
      return [d.matricula, d.alumno, d.nombre_carrera, d.nombre_periodo, d.nivel_riesgo, d.puntaje_riesgo, d.atendida ? 'Si' : 'No', d.estado_seguimiento];
    });
    autoCols(d7, dalHeaders, dalData);
    hdr(d7, 1, dalHeaders, 'FF1E293B');
    dalData.forEach(function(row, i) {
      var dd = data.detalle_alumnos[i];
      dRow(d7, i + 2, row, [
        {}, {}, {}, {},
        { bold: true, color: riskColor(dd.nivel_riesgo), align: 'center', fill: riskColor(dd.nivel_riesgo) + '20' },
        { bold: true, color: SEM.dark, align: 'center' },
        { color: dd.atendida ? SEM.bajo : SEM.crit, align: 'center' },
        {}
      ]);
    });
    d7.autoFilter = { from: 'A1', to: 'H1' };
  }

  // SHEET 8: Datos crudos parciales (no merged cells)
  if (data.detalle_parciales.length > 0) {
    var d8 = workbook.addWorksheet('Datos crudos parciales');
    var dpHeaders = ['Matricula', 'Alumno', 'Parcial', 'Promedio', 'Riesgos', 'Reprobadas', 'Tendencia', 'Activos', 'Desertores'];
    var dpData = data.detalle_parciales.map(function(d) {
      return [d.matricula, d.alumno, 'Parcial ' + d.numero_parcial, d.calificacion_promedio, d.riesgos_detectados, d.materias_reprobadas, d.tendencia, d.alumnos_activos, d.alumnos_desertores];
    });
    autoCols(d8, dpHeaders, dpData);
    hdr(d8, 1, dpHeaders, 'FF1E293B');
    dpData.forEach(function(row, i) {
      dRow(d8, i + 2, row);
    });
    d8.autoFilter = { from: 'A1', to: 'I1' };
  }

  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (_) {} }
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { gatherReportData, generatePdf, generateExcel };
