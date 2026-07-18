'use strict';

// ==============================
// 📦 IMPORTACIONES
// ==============================
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const crypto = require('crypto');

// ==============================
// 📁 RUTAS BASE DEL SISTEMA
// ==============================
const BASE_DIR = path.join(__dirname, '..', '..', 'uploads');
const QR_DIR = path.join(BASE_DIR, 'qr');
const REPORT_DIR = path.join(BASE_DIR, 'reportes');
const ALUMNOS_DIR = path.join(BASE_DIR, 'alumnos');

// ==============================
// 📁 CREAR DIRECTORIOS SI NO EXISTEN
// ==============================
[BASE_DIR, QR_DIR, REPORT_DIR, ALUMNOS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==============================
// 🌐 GENERAR URL SEGURA DE ARCHIVO
// ==============================
exports.safeUrl = (relativePath) => {
  if (!relativePath) return null;

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl}/${String(relativePath).replace(/\\/g, '/')}`;
};

// ==============================
// 🔑 GENERAR TOKEN ÚNICO
// ==============================
exports.randomToken = () => crypto.randomUUID();

// ==============================
// 📱 GENERAR CÓDIGO QR
// ==============================
exports.generateQr = async (text, fileName) => {
  const filePath = path.join(QR_DIR, fileName);

  await QRCode.toFile(filePath, text, {
    type: 'png',
    width: 650,
    margin: 2,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF'
    }
  });

  return filePath;
};

// ==============================
// 🧩 UTILIDADES INTERNAS
// ==============================
function formatDateTime(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value || '');
  }
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentOf(value, total) {
  const a = safeNumber(value, 0);
  const b = safeNumber(total, 0);
  if (!b) return 0;
  return clamp((a / b) * 100, 0, 100);
}

function makeBarText(value, maxValue, width = 24) {
  const pct = maxValue > 0 ? clamp(safeNumber(value) / maxValue, 0, 1) : 0;
  const fill = Math.max(1, Math.round(width * pct));
  return `${'█'.repeat(fill)}${'░'.repeat(Math.max(0, width - fill))}`;
}

function resolveExistingFile(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;

  const raw = candidate.trim();
  if (!raw) return null;

  const candidates = [];

  if (path.isAbsolute(raw)) {
    candidates.push(raw);
  } else {
    candidates.push(path.resolve(process.cwd(), raw));
    candidates.push(path.resolve(__dirname, '..', '..', raw));
    candidates.push(path.resolve(__dirname, '..', '..', '..', raw));
  }

  for (const current of candidates) {
    try {
      if (current && fs.existsSync(current) && fs.statSync(current).isFile()) {
        return current;
      }
    } catch (_) {}
  }

  return null;
}

function resolveLogoPath(envKey, fallbackCandidates = []) {
  const envValue = String(process.env[envKey] || '').trim();
  const candidates = [envValue, ...fallbackCandidates].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = resolveExistingFile(candidate);
    if (resolved) return resolved;
  }

  return null;
}

function getSupportedImageInfo(imagePath = '') {
  if (!imagePath) return null;

  try {
    if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
      return null;
    }

    const buffer = fs.readFileSync(imagePath);
    if (!buffer || buffer.length < 8) return null;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    if (isPng) {
      return { buffer, extension: 'png' };
    }

    if (isJpeg) {
      return { buffer, extension: 'jpeg' };
    }

    return null;
  } catch {
    return null;
  }
}

function drawLogoBox(doc, x, y, w, h, label, imagePath = '') {
  const imageInfo = getSupportedImageInfo(imagePath);

  if (imageInfo) {
    try {
      doc.image(imageInfo.buffer, x, y, {
        fit: [w, h],
        align: 'center',
        valign: 'center'
      });
      return;
    } catch (_) {
      // Fallback institucional.
    }
  }

  doc
    .save()
    .roundedRect(x, y, w, h, 10)
    .fillAndStroke('#F1F5F9', '#CBD5E1')
    .restore();

  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(String(label || 'LOGO'), x, y + h / 2 - 5, {
      width: w,
      align: 'center'
    });
}

function drawFooter(doc, pageNumber, totalPages) {
  const footerY = doc.page.height - 45;

  doc
    .save()
    .strokeColor('#E2E8F0')
    .lineWidth(1)
    .moveTo(50, footerY)
    .lineTo(doc.page.width - 50, footerY)
    .stroke()
    .restore();

  doc
    .fillColor('#64748B')
    .font('Helvetica')
    .fontSize(8.3)
    .text(
      `SIVACAD • Documento institucional • Página ${pageNumber}${totalPages ? ` de ${totalPages}` : ''}`,
      50,
      footerY + 8,
      {
        width: doc.page.width - 100,
        align: 'center'
      }
    );
}

function drawSectionTitle(doc, title, y) {
  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(12.8)
    .text(String(title || ''), 50, y, { width: 495 });

  return doc.y + 6;
}

function drawParagraph(doc, text, opts = {}) {
  doc
    .fillColor('#334155')
    .font('Helvetica')
    .fontSize(10.5)
    .text(String(text || ''), {
      width: opts.width || 495,
      align: opts.align || 'justify',
      lineGap: 2
    });
}

function drawMetricCards(doc, metrics = [], startY = doc.y + 10) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const cols = 3;
  const cardW = (pageWidth - gap * (cols - 1)) / cols;
  const cardH = 62;

  metrics.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    const cx = 50 + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);

    doc
      .save()
      .roundedRect(cx, cy, cardW, cardH, 12)
      .fillAndStroke('#F8FAFC', '#E2E8F0')
      .restore();

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(9)
      .text(String(item.label || ''), cx + 10, cy + 10, { width: cardW - 20 });

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(String(item.value ?? 0), cx + 10, cy + 28, {
        width: cardW - 20
      });
  });

  const rows = Math.ceil(metrics.length / cols);
  return startY + rows * (cardH + gap);
}

function drawBarChart(doc, title, items = [], startY = doc.y + 12) {
  const chartX = 50;
  const chartY = startY;
  const chartW = 495;
  const barH = 18;
  const gap = 10;
  const labelW = 120;
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(1, ...safeItems.map((item) => safeNumber(item.value)));

  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(String(title || ''), chartX, chartY, { width: chartW });

  if (!safeItems.length) {
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(10)
      .text('Sin datos disponibles', chartX, chartY + 20, { width: chartW });
    return chartY + 40;
  }

  let cursorY = chartY + 22;

  safeItems.forEach((item) => {
    const value = safeNumber(item.value);
    const pct = percentOf(value, maxValue);
    const barW = Math.max(8, ((chartW - labelW - 34) * value) / maxValue);

    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(9.4)
      .text(String(item.label || ''), chartX, cursorY + 2, { width: labelW });

    doc
      .save()
      .roundedRect(chartX + labelW, cursorY, chartW - labelW - 20, barH, 6)
      .fillAndStroke('#E2E8F0', '#CBD5E1')
      .restore();

    doc
      .save()
      .roundedRect(chartX + labelW, cursorY, barW, barH, 6)
      .fill('#4F46E5')
      .restore();

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(9.3)
      .text(`${value} (${pct.toFixed(1)}%)`, chartX + chartW - 88, cursorY + 2, {
        width: 88,
        align: 'right'
      });

    cursorY += barH + gap;
  });

  return cursorY + 4;
}

function safeNumberExcel(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateTimeExcel(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value || '');
  }
}

function percentOfExcel(value, max) {
  const safeValue = safeNumberExcel(value, 0);
  const safeMax = Math.max(1, safeNumberExcel(max, 1));
  return (safeValue / safeMax) * 100;
}

function makeBarTextExcel(value, max, width = 24) {
  const safeMax = Math.max(1, safeNumberExcel(max, 1));
  const ratio = Math.max(0, Math.min(1, safeNumberExcel(value, 0) / safeMax));
  const filled = Math.max(1, Math.round(width * ratio));
  const empty = Math.max(0, width - filled);
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${(ratio * 100).toFixed(1)}%`;
}

function styleCellExcel(
  cell,
  {
    size = 10,
    bold = false,
    italic = false,
    color = 'FF334155',
    align = 'left',
    fill = null
  } = {}
) {
  cell.font = {
    name: 'Arial',
    size,
    bold,
    italic,
    color: { argb: color }
  };

  cell.alignment = {
    horizontal: align,
    vertical: 'middle',
    wrapText: true
  };

  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  if (fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fill }
    };
  }
}

function applyHeaderRowStyleExcel(sheet, rowNumber, fillColor) {
  const row = sheet.getRow(rowNumber);
  row.eachCell((cell) => {
    styleCellExcel(cell, {
      size: 10,
      bold: true,
      color: 'FFFFFFFF',
      align: 'center',
      fill: fillColor
    });
  });
  row.height = 22;
}

function buildWorkbookTitleExcel(title, leftLabel, rightLabel) {
  return `${leftLabel || 'TESI'} • ${title || 'SIVACAD - Reporte Institucional'} • ${
    rightLabel || 'SIVACAD'
  }`;
}

function tryInsertExcelLogo(workbook, sheet, imagePath, position) {
  const imageInfo = getSupportedImageInfo(imagePath);
  if (!imageInfo) return;

  try {
    const imageId = workbook.addImage({
      buffer: imageInfo.buffer,
      extension: imageInfo.extension
    });

    sheet.addImage(imageId, position);
  } catch (error) {
    console.warn('No fue posible insertar el logo en Excel:', error?.message || error);
  }
}

// ==============================
// 📄 GENERAR PDF
// ==============================
exports.createPdf = async (fileName, title, lines = [], options = {}) => {
  const safeFileName = String(fileName || '').trim();
  if (!safeFileName) {
    throw new Error('El nombre del archivo PDF es obligatorio.');
  }

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const filePath = path.resolve(REPORT_DIR, safeFileName);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const generatedAt = options.generatedAt || new Date();
  const generatedBy = options.generatedBy || 'Sistema SIVACAD';
  const subtitle = options.subtitle || 'Informe institucional';
  const metadata = options.metadata || {};
  const sections = Array.isArray(options.sections) ? options.sections : [];
  const charts = Array.isArray(options.charts) ? options.charts : [];
  const leftLabel = options.leftLabel || 'TESI';
  const rightLabel = options.rightLabel || 'SIVACAD';

  const logoLeftPath =
    resolveLogoPath('TESI_LOGO_PATH', [
      'uploads/logos/Logo-TESI.png',
      'uploads/logos/Logo-TESI.jpg',
      'uploads/logos/Logo-TESI.jpeg',
      'uploads/Logo-TESI.png',
      'uploads/Logo-TESI.jpg',
      'uploads/Logo-TESI.jpeg'
    ]) || null;

  const logoRightPath =
    resolveLogoPath('SIVACAD_LOGO_PATH', [
      'uploads/logos/Logo-SIVACAD.png',
      'uploads/logos/Logo-SIVACAD.jpg',
      'uploads/logos/Logo-SIVACAD.jpeg',
      'uploads/Logo-SIVACAD.png',
      'uploads/Logo-SIVACAD.jpg',
      'uploads/Logo-SIVACAD.jpeg'
    ]) || null;

  const renderHeader = () => {
    const topY = 34;

    drawLogoBox(doc, 50, topY, 62, 42, leftLabel, logoLeftPath);
    drawLogoBox(doc, doc.page.width - 112, topY, 62, 42, rightLabel, logoRightPath);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(String(title || ''), 122, 38, {
        width: doc.page.width - 244,
        align: 'center'
      });

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(9.5)
      .text(subtitle, 122, 60, {
        width: doc.page.width - 244,
        align: 'center'
      });

    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(8.8)
      .text(`Generado por: ${generatedBy}`, 50, 86, {
        width: 230,
        align: 'left'
      });

    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(8.8)
      .text(`Fecha y hora: ${formatDateTime(generatedAt)}`, 50, 98, {
        width: 280,
        align: 'left'
      });

    const metaText = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' • ');

    if (metaText) {
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(8.4)
        .text(metaText, 50, 112, {
          width: doc.page.width - 100,
          align: 'center'
        });
    }

    doc
      .save()
      .strokeColor('#CBD5E1')
      .lineWidth(1)
      .moveTo(50, 128)
      .lineTo(doc.page.width - 50, 128)
      .stroke()
      .restore();

    doc.y = 140;
  };

  const renderBody = () => {
    if (Array.isArray(lines) && lines.length > 0) {
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Resumen textual', 50, doc.y, { width: 495 });

      doc.moveDown(0.4);

      lines.forEach((line) => {
        if (doc.y > 710) {
          doc.addPage();
          renderHeader();
        }

        drawParagraph(doc, line);
        doc.moveDown(0.15);
      });

      doc.moveDown(0.5);
    }

    sections.forEach((section) => {
      if (doc.y > 680) {
        doc.addPage();
        renderHeader();
      }

      doc.y = drawSectionTitle(doc, section.title, doc.y + 4);

      if (Array.isArray(section.lines) && section.lines.length) {
        section.lines.forEach((line) => {
          if (doc.y > 720) {
            doc.addPage();
            renderHeader();
          }
          drawParagraph(doc, line);
          doc.moveDown(0.2);
        });
      }

      if (Array.isArray(section.metrics) && section.metrics.length) {
        doc.y = drawMetricCards(doc, section.metrics, doc.y + 10);
        doc.moveDown(0.2);
      }

      doc.moveDown(0.45);
    });

    charts.forEach((chart) => {
      if (doc.y > 650) {
        doc.addPage();
        renderHeader();
      }

      doc.y = drawBarChart(doc, chart.title, chart.items || [], doc.y + 4);
      doc.moveDown(0.35);
    });
  };

  renderHeader();
  renderBody();

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, i + 1, range.count);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return filePath;
};

// ==============================
// 📊 GENERAR EXCEL
// ==============================
exports.createExcel = async (fileName, rows = [], options = {}) => {
  const safeFileName = String(fileName || '').trim();
  if (!safeFileName) {
    throw new Error('El nombre del archivo Excel es obligatorio.');
  }

  if (!Array.isArray(rows)) {
    rows = [];
  }

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  const filePath = path.resolve(REPORT_DIR, safeFileName);

  const generatedAt = options.generatedAt || new Date();
  const generatedBy = options.generatedBy || 'Sistema SIVACAD';
  const title = options.title || 'SIVACAD - Reporte Institucional';
  const subtitle = options.subtitle || 'Informe institucional';
  const metadata = options.metadata || {};
  const summaryRows = Array.isArray(options.summaryRows) ? options.summaryRows : [];
  const narrative = Array.isArray(options.narrative) ? options.narrative : [];
  const riskRows = Array.isArray(options.riskRows) ? options.riskRows : [];
  const leftLabel = options.leftLabel || 'TESI';
  const rightLabel = options.rightLabel || 'SIVACAD';

  const logoLeftPath =
    resolveLogoPath('TESI_LOGO_PATH', [
      'uploads/logos/Logo-TESI.png',
      'uploads/logos/Logo-TESI.jpg',
      'uploads/logos/Logo-TESI.jpeg',
      'uploads/Logo-TESI.png',
      'uploads/Logo-TESI.jpg',
      'uploads/Logo-TESI.jpeg'
    ]) || null;

  const logoRightPath =
    resolveLogoPath('SIVACAD_LOGO_PATH', [
      'uploads/logos/Logo-SIVACAD.png',
      'uploads/logos/Logo-SIVACAD.jpg',
      'uploads/logos/Logo-SIVACAD.jpeg',
      'uploads/Logo-SIVACAD.png',
      'uploads/Logo-SIVACAD.jpg',
      'uploads/Logo-SIVACAD.jpeg'
    ]) || null;

  workbook.creator = generatedBy;
  workbook.company = 'TESI';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.title = title;
  workbook.subject = subtitle;
  workbook.keywords = 'SIVACAD, TESI, Reporte institucional';

  // =========================
  // HOJA 1: PORTADA
  // =========================
  const portada = workbook.addWorksheet('Portada');
  portada.views = [{ showGridLines: false }];
  portada.columns = [
    { width: 4 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 }
  ];

  for (let i = 1; i <= 24; i += 1) {
    portada.getRow(i).height = 20;
  }

  portada.mergeCells('A1:H1');
  portada.mergeCells('A2:H2');
  portada.mergeCells('A3:H3');
  portada.mergeCells('A4:H4');
  portada.mergeCells('A5:H5');
  portada.mergeCells('A7:H7');
  portada.mergeCells('A8:H8');

  portada.getCell('A1').value = buildWorkbookTitleExcel(title, leftLabel, rightLabel);
  portada.getCell('A2').value = subtitle;
  portada.getCell('A3').value = `Generado por: ${generatedBy}`;
  portada.getCell('A4').value = `Fecha y hora: ${formatDateTimeExcel(generatedAt)}`;
  portada.getCell('A5').value = Object.keys(metadata).length
    ? Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join(' • ')
    : 'Reporte institucional generado automáticamente.';
  portada.getCell('A7').value = 'Resumen ejecutivo';
  portada.getCell('A8').value =
    'Este archivo integra una portada formal, una hoja de análisis visual y una hoja de datos detallada.';

  styleCellExcel(portada.getCell('A1'), {
    size: 16,
    bold: true,
    color: 'FF0F172A',
    align: 'center'
  });
  styleCellExcel(portada.getCell('A2'), {
    size: 11,
    italic: true,
    color: 'FF475569',
    align: 'center'
  });
  styleCellExcel(portada.getCell('A3'), { size: 10, color: 'FF334155', align: 'center' });
  styleCellExcel(portada.getCell('A4'), { size: 10, color: 'FF334155', align: 'center' });
  styleCellExcel(portada.getCell('A5'), { size: 9.5, color: 'FF475569', align: 'center' });
  styleCellExcel(portada.getCell('A7'), {
    size: 12,
    bold: true,
    color: 'FF0F172A',
    align: 'left'
  });
  styleCellExcel(portada.getCell('A8'), { size: 10, color: 'FF334155', align: 'justify' });

  if (narrative.length) {
    let r = 10;
    portada.mergeCells(`A${r}:H${r}`);
    portada.getCell(`A${r}`).value = 'Interpretación institucional';
    styleCellExcel(portada.getCell(`A${r}`), {
      size: 12,
      bold: true,
      color: 'FF0F172A'
    });

    narrative.forEach((line) => {
      r += 1;
      portada.mergeCells(`A${r}:H${r}`);
      const cell = portada.getCell(`A${r}`);
      cell.value = String(line || '');
      styleCellExcel(cell, { size: 10, color: 'FF334155', align: 'justify' });
    });
  }

  tryInsertExcelLogo(workbook, portada, logoLeftPath, {
    tl: { col: 0.35, row: 0.2 },
    ext: { width: 120, height: 70 }
  });

  tryInsertExcelLogo(workbook, portada, logoRightPath, {
    tl: { col: 5.85, row: 0.2 },
    ext: { width: 120, height: 70 }
  });

  // =========================
  // HOJA 2: RESUMEN VISUAL
  // =========================
  const resumen = workbook.addWorksheet('Resumen visual', {
    views: [{ state: 'frozen', ySplit: 8 }]
  });

  resumen.columns = [
    { width: 32 },
    { width: 14 },
    { width: 12 },
    { width: 30 },
    { width: 18 },
    { width: 18 }
  ];

  resumen.mergeCells('A1:F1');
  resumen.mergeCells('A2:F2');
  resumen.mergeCells('A3:F3');
  resumen.mergeCells('A4:F4');

  resumen.getCell('A1').value = title;
  resumen.getCell('A2').value = subtitle;
  resumen.getCell('A3').value = `Generado por: ${generatedBy}`;
  resumen.getCell('A4').value = `Fecha y hora: ${formatDateTimeExcel(generatedAt)}`;

  styleCellExcel(resumen.getCell('A1'), {
    size: 15,
    bold: true,
    color: 'FF0F172A',
    align: 'center'
  });
  styleCellExcel(resumen.getCell('A2'), {
    size: 11,
    italic: true,
    color: 'FF475569',
    align: 'center'
  });
  styleCellExcel(resumen.getCell('A3'), { size: 10, color: 'FF334155', align: 'center' });
  styleCellExcel(resumen.getCell('A4'), { size: 10, color: 'FF334155', align: 'center' });

  if (Object.keys(metadata).length) {
    resumen.mergeCells('A5:F5');
    resumen.getCell('A5').value = Object.entries(metadata)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' • ');
    styleCellExcel(resumen.getCell('A5'), { size: 9.5, color: 'FF475569', align: 'center' });
  }

  const topSummary = summaryRows.length
    ? summaryRows.map((item) => ({
        label: String(item.label || item.campo || ''),
        value: safeNumberExcel(item.value ?? item.valor ?? 0)
      }))
    : rows.slice(0, 6).map((row) => ({
        label: String(row.campo || row.label || ''),
        value: safeNumberExcel(row.valor ?? row.value ?? 0)
      }));

  const summaryMax = Math.max(1, ...topSummary.map((item) => safeNumberExcel(item.value)));

  resumen.mergeCells('A7:F7');
  resumen.getCell('A7').value = 'Indicadores institucionales';
  styleCellExcel(resumen.getCell('A7'), {
    size: 12,
    bold: true,
    color: 'FF0F172A'
  });

  resumen.getRow(8).values = ['Indicador', 'Valor', '%', 'Barra visual', 'Detalle', 'Observación'];
  applyHeaderRowStyleExcel(resumen, 8, 'FF4F46E5');

  let rowIndex = 9;
  topSummary.forEach((item) => {
    const value = safeNumberExcel(item.value);
    const pct = percentOfExcel(value, summaryMax);

    resumen.getCell(`A${rowIndex}`).value = item.label || '';
    resumen.getCell(`B${rowIndex}`).value = value;
    resumen.getCell(`C${rowIndex}`).value = `${pct.toFixed(1)}%`;
    resumen.getCell(`D${rowIndex}`).value = makeBarTextExcel(value, summaryMax, 24);
    resumen.getCell(`E${rowIndex}`).value = 'Métrica consolidada';
    resumen.getCell(`F${rowIndex}`).value = value > 0 ? 'Con dato disponible' : 'Sin dato';

    styleCellExcel(resumen.getCell(`A${rowIndex}`), { size: 10, color: 'FF334155' });
    styleCellExcel(resumen.getCell(`B${rowIndex}`), {
      size: 10,
      bold: true,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(resumen.getCell(`C${rowIndex}`), {
      size: 10,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(resumen.getCell(`D${rowIndex}`), {
      size: 10,
      color: 'FF475569',
      align: 'left',
      fill: 'FFF8FAFC'
    });
    styleCellExcel(resumen.getCell(`E${rowIndex}`), { size: 10, color: 'FF334155' });
    styleCellExcel(resumen.getCell(`F${rowIndex}`), { size: 10, color: 'FF334155' });

    rowIndex += 1;
  });

  const totalSummary = topSummary.reduce((sum, item) => sum + safeNumberExcel(item.value), 0);

  resumen.mergeCells(`A${rowIndex + 1}:F${rowIndex + 1}`);
  resumen.getCell(`A${rowIndex + 1}`).value = 'Resumen interpretativo';
  styleCellExcel(resumen.getCell(`A${rowIndex + 1}`), {
    size: 12,
    bold: true,
    color: 'FF0F172A'
  });

  resumen.mergeCells(`A${rowIndex + 2}:F${rowIndex + 2}`);
  resumen.getCell(`A${rowIndex + 2}`).value =
    totalSummary > 0
      ? `El total visualizado en esta hoja es de ${totalSummary} registros o incidencias consolidadas, distribuidas de forma proporcional en los indicadores principales.`
      : 'No se detectaron datos suficientes para construir un resumen consolidado.';
  styleCellExcel(resumen.getCell(`A${rowIndex + 2}`), {
    size: 10,
    color: 'FF334155',
    align: 'justify'
  });

  const vizStart = rowIndex + 4;
  resumen.mergeCells(`A${vizStart}:F${vizStart}`);
  resumen.getCell(`A${vizStart}`).value = 'Visualización de barras';
  styleCellExcel(resumen.getCell(`A${vizStart}`), {
    size: 12,
    bold: true,
    color: 'FF0F172A'
  });

  let vizRow = vizStart + 1;
  topSummary.forEach((item) => {
    const value = safeNumberExcel(item.value);
    const bar = makeBarTextExcel(value, summaryMax, 28);

    resumen.getCell(`A${vizRow}`).value = item.label || '';
    resumen.getCell(`B${vizRow}`).value = value;
    resumen.getCell(`C${vizRow}`).value = `${percentOfExcel(value, summaryMax).toFixed(1)}%`;
    resumen.mergeCells(`D${vizRow}:F${vizRow}`);
    resumen.getCell(`D${vizRow}`).value = bar;

    styleCellExcel(resumen.getCell(`A${vizRow}`), { size: 10, color: 'FF334155' });
    styleCellExcel(resumen.getCell(`B${vizRow}`), {
      size: 10,
      bold: true,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(resumen.getCell(`C${vizRow}`), {
      size: 10,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(resumen.getCell(`D${vizRow}`), {
      size: 10,
      color: 'FF4F46E5',
      fill: 'FFF8FAFC'
    });

    vizRow += 1;
  });

  // =========================
  // HOJA 3: ANÁLISIS VISUAL
  // =========================
  const analisis = workbook.addWorksheet('Analisis visual', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  analisis.columns = [
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 36 },
    { width: 18 }
  ];

  analisis.getRow(1).values = ['Categoría', 'Valor', '%', 'Barra visual', 'Interpretación'];
  applyHeaderRowStyleExcel(analisis, 1, 'FF0EA5E9');

  const analysisRows = [
    ...topSummary,
    ...riskRows.map((item) => ({
      label: String(item.label || item.campo || 'Riesgo'),
      value: safeNumberExcel(item.value ?? item.valor ?? 0)
    }))
  ];

  const analysisMax = Math.max(1, ...analysisRows.map((item) => safeNumberExcel(item.value)));

  let analysisIndex = 2;
  analysisRows.forEach((item) => {
    const value = safeNumberExcel(item.value);
    const pct = percentOfExcel(value, analysisMax);

    analisis.getCell(`A${analysisIndex}`).value = item.label || '';
    analisis.getCell(`B${analysisIndex}`).value = value;
    analisis.getCell(`C${analysisIndex}`).value = `${pct.toFixed(1)}%`;
    analisis.getCell(`D${analysisIndex}`).value = makeBarTextExcel(value, analysisMax, 30);
    analisis.getCell(`E${analysisIndex}`).value =
      value >= analysisMax * 0.75
        ? 'Nivel alto dentro del conjunto'
        : value >= analysisMax * 0.4
          ? 'Nivel medio dentro del conjunto'
          : 'Nivel bajo dentro del conjunto';

    styleCellExcel(analisis.getCell(`A${analysisIndex}`), { size: 10, color: 'FF334155' });
    styleCellExcel(analisis.getCell(`B${analysisIndex}`), {
      size: 10,
      bold: true,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(analisis.getCell(`C${analysisIndex}`), {
      size: 10,
      color: 'FF0F172A',
      align: 'center'
    });
    styleCellExcel(analisis.getCell(`D${analysisIndex}`), {
      size: 10,
      color: 'FF4F46E5',
      fill: 'FFF8FAFC'
    });
    styleCellExcel(analisis.getCell(`E${analysisIndex}`), { size: 10, color: 'FF334155' });

    analysisIndex += 1;
  });

  // =========================
  // HOJA 4: DATOS
  // =========================
  const detailSheet = workbook.addWorksheet(options.detailSheetName || 'Datos', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  detailSheet.columns = [
    { header: 'Campo', key: 'campo', width: 32 },
    { header: 'Valor', key: 'valor', width: 66 }
  ];

  rows.forEach((row) => {
    detailSheet.addRow({
      campo: String(row.campo ?? row.label ?? ''),
      valor: row.valor ?? row.value ?? ''
    });
  });

  applyHeaderRowStyleExcel(detailSheet, 1, 'FF4F46E5');

  detailSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      styleCellExcel(cell, { size: 10, color: 'FF334155' });
    });
  });

  detailSheet.autoFilter = {
    from: 'A1',
    to: 'B1'
  };

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}
  }

  await workbook.xlsx.writeFile(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error('El archivo Excel no fue generado correctamente en disco.');
  }

  return filePath;
};