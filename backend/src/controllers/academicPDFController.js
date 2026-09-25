'use strict';

const academicPDFService = require('../services/academicPDFService');
const { registrarExportAudit } = require('../helpers/excelHelpers');
const { denegarSiNoEsAlumnoPropio } = require('../helpers/ownership');

// Helper para enviar PDF como stream
function sendPDF(res, filePath, fileName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  const stream = require('fs').createReadStream(filePath);
  stream.pipe(res);
}

// ==============================
// 1. PREBOLETA PDF
// ==============================
async function preboletaPDF(req, res) {
  try {
    const { idAlumno, idPeriodo } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes generar la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { filePath, fileName, folio, totalMaterias } = await academicPDFService.generarPreboletaPDF(
      Number(idAlumno), Number(idPeriodo)
    );

    await registrarExportAudit(req.user.id_usuario, 'PDF_PREBOLETA',
      `Preboleta PDF — Alumno ${idAlumno}, Periodo ${idPeriodo} — Folio: ${folio} — Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error preboleta:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 2. BOLETA PDF
// ==============================
async function boletaPDF(req, res) {
  try {
    const { idAlumno, idPeriodo } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes generar la boleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { filePath, fileName, folio, totalMaterias } = await academicPDFService.generarBoletaPDF(
      Number(idAlumno), Number(idPeriodo)
    );

    await registrarExportAudit(req.user.id_usuario, 'PDF_BOLETA',
      `Boleta PDF — Alumno ${idAlumno}, Periodo ${idPeriodo} — Folio: ${folio} — Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error boleta:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 3. CALIFICACIONES POR PARCIAL
// ==============================
async function calificacionesParcialPDF(req, res) {
  try {
    const { idGrupo, idPeriodo, parcial } = req.params;
    const p = parseInt(parcial, 10);

    const { filePath, fileName, folio, totalAlumnos, totalMaterias } = await academicPDFService.generarCalificacionesParcialPDF(
      Number(idGrupo), Number(idPeriodo), p
    );

    await registrarExportAudit(req.user.id_usuario, 'PDF_PARCIAL',
      `Calificaciones P${p} PDF — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}, Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error parcial:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 4. CALIFICACIONES POR PERÍODO
// ==============================
async function calificacionesPeriodoPDF(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const { filePath, fileName, folio, totalAlumnos, totalMaterias } = await academicPDFService.generarCalificacionesPeriodoPDF(
      Number(idGrupo), Number(idPeriodo)
    );

    await registrarExportAudit(req.user.id_usuario, 'PDF_PERIODO',
      `Calificaciones Periodo PDF — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}, Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error periodo:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 5. HISTORIAL ACADÉMICO
// ==============================
async function historialPDF(req, res) {
  try {
    const { idAlumno } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes generar el historial de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { filePath, fileName, folio, totalMaterias } = await academicPDFService.generarHistorialPDF(Number(idAlumno));

    await registrarExportAudit(req.user.id_usuario, 'PDF_HISTORIAL',
      `Historial PDF — Alumno ${idAlumno} — Folio: ${folio} — Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error historial:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 6. REPORTE POR GRUPO
// ==============================
async function reporteGrupoPDF(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const { filePath, fileName, folio, totalAlumnos, totalMaterias } = await academicPDFService.generarReporteGrupoPDF(
      Number(idGrupo), Number(idPeriodo)
    );

    await registrarExportAudit(req.user.id_usuario, 'PDF_REPORTE_GRUPO',
      `Reporte Grupo PDF — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}, Materias: ${totalMaterias}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error reporte grupo:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 7. REPORTE DE SEGUIMIENTO
// ==============================
async function reporteSeguimientoPDF(req, res) {
  try {
    const { idPeriodo } = req.params;

    const { filePath, fileName, folio, totalGrupos } = await academicPDFService.generarReporteSeguimientoPDF(Number(idPeriodo));

    await registrarExportAudit(req.user.id_usuario, 'PDF_SEGUIMIENTO',
      `Seguimiento PDF — Periodo ${idPeriodo} — Folio: ${folio} — Grupos: ${totalGrupos}`, req);

    sendPDF(res, filePath, fileName);
  } catch (error) {
    console.error('[PDF] Error seguimiento:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  preboletaPDF,
  boletaPDF,
  calificacionesParcialPDF,
  calificacionesPeriodoPDF,
  historialPDF,
  reporteGrupoPDF,
  reporteSeguimientoPDF
};
