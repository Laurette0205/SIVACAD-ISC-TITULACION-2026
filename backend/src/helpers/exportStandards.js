'use strict';

// ==============================
// ESTÁNDAR COMPARTIDO DE FORMATO DE EXPORTACIÓN — SIVACAD-ISC
// Papel: Carta (Letter)
// Márgenes: APA 2.54 cm (1 in) en los 4 lados
// Encabezado/pie de página: 1.27 cm (0.5 in)
// ==============================

const APA = {
  MARGIN_CM: 2.54,
  MARGIN_IN: 1.0,
  MARGIN_PT: 72,        // 1 in = 72 pt
  HEADER_FOOTER_IN: 0.5,
  HEADER_FOOTER_CM: 1.27,
  PAGE_SIZE: 'LETTER',
  ORIENTATION_PORTRAIT: 'portrait',
  ORIENTATION_LANDSCAPE: 'landscape'
};

// CSS @page para Dompdf / HTML impreso / Puppeteer
function pageCss(options = {}) {
  const orientation = options.orientation === APA.ORIENTATION_LANDSCAPE
    ? APA.ORIENTATION_LANDSCAPE
    : APA.ORIENTATION_PORTRAIT;
  return `@page { size: letter ${orientation}; margin: ${APA.MARGIN_CM}cm; }`;
}

// Márgenes para page.pdf() de Puppeteer
function puppeteerMargins() {
  const m = `${APA.MARGIN_CM}cm`;
  return { top: m, right: m, bottom: m, left: m };
}

// Configuración de página para ExcelJS (fitToWidth=1, sin forzar fitToHeight)
function excelPageSetup(ws, options = {}) {
  const orientation = options.orientation === APA.ORIENTATION_PORTRAIT
    ? APA.ORIENTATION_PORTRAIT
    : APA.ORIENTATION_LANDSCAPE;
  ws.pageSetup.margins = {
    top: APA.MARGIN_IN,
    bottom: APA.MARGIN_IN,
    left: APA.MARGIN_IN,
    right: APA.MARGIN_IN,
    header: APA.HEADER_FOOTER_IN,
    footer: APA.HEADER_FOOTER_IN
  };
  ws.pageSetup.orientation = orientation;
  ws.pageSetup.paperSize = 1; // LETTER
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.verticalCentered = false;
  return ws;
}

// Opciones PDFKit alineadas al estándar
function pdfKitOptions(overrides = {}) {
  return {
    size: APA.PAGE_SIZE,
    margin: APA.MARGIN_PT,
    bufferPages: true,
    ...overrides
  };
}

module.exports = {
  APA,
  pageCss,
  puppeteerMargins,
  excelPageSetup,
  pdfKitOptions
};
