'use strict';

const academicExportService = require('../services/academicExportService');
const { registrarExportAudit } = require('../helpers/excelHelpers');
const { denegarSiNoEsAlumnoPropio } = require('../helpers/ownership');

// ==============================
// 1. CONCENTRADO GENERAL (CON)
// ==============================
async function exportConcentradoGeneral(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const { workbook, folio, totalAlumnos, totalMaterias } = await academicExportService.exportConcentradoGeneral(
      Number(idGrupo), Number(idPeriodo)
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_CON',
      `Concentrado CON — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}, Materias: ${totalMaterias}`,
      req
    );

    const filename = `concentrado_grupo_${idGrupo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando CON:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 2-4. CONCENTRADO PARCIAL (P1-P3)
// ==============================
async function exportConcentradoParcial(req, res) {
  try {
    const { idGrupo, idPeriodo, parcial } = req.params;
    const p = parseInt(parcial, 10);

    const { workbook, folio, totalAlumnos } = await academicExportService.exportConcentradoParcial(
      Number(idGrupo), Number(idPeriodo), p
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_PARCIAL',
      `Concentrado P${p} — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}`,
      req
    );

    const filename = `parcial_${p}_grupo_${idGrupo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Parcial:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 5. CONCENTRADO PERÍODO (PG)
// ==============================
async function exportConcentradoPeriodo(req, res) {
  try {
    const { idPeriodo } = req.params;

    const { workbook, folio, totalGrupos, totalAlumnos } = await academicExportService.exportConcentradoPeriodo(
      Number(idPeriodo)
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_PG',
      `Concentrado PG — Periodo ${idPeriodo} — Folio: ${folio} — Grupos: ${totalGrupos}, Alumnos: ${totalAlumnos}`,
      req
    );

    const filename = `concentrado_periodo_${idPeriodo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando PG:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

// ==============================
// 6. PREBOLETA INDIVIDUAL
// ==============================
async function exportPreboletaIndividual(req, res) {
  try {
    const { idAlumno, idPeriodo } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la preboleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { workbook, folio, totalMaterias } = await academicExportService.exportPreboletaIndividual(
      Number(idAlumno), Number(idPeriodo)
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_PREBOLETA',
      `Preboleta individual — Alumno ${idAlumno}, Periodo ${idPeriodo} — Folio: ${folio} — Materias: ${totalMaterias}`,
      req
    );

    const filename = `preboleta_alumno_${idAlumno}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Preboleta:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 7. BOLETA INDIVIDUAL
// ==============================
async function exportBoletaIndividual(req, res) {
  try {
    const { idAlumno, idPeriodo } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar la boleta de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { workbook, folio, totalMaterias } = await academicExportService.exportBoletaIndividual(
      Number(idAlumno), Number(idPeriodo)
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_BOLETA',
      `Boleta individual — Alumno ${idAlumno}, Periodo ${idPeriodo} — Folio: ${folio} — Materias: ${totalMaterias}`,
      req
    );

    const filename = `boleta_alumno_${idAlumno}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Boleta:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 8. HISTORIAL ACADÉMICO
// ==============================
async function exportHistorialAcademico(req, res) {
  try {
    const { idAlumno } = req.params;

    const denegado = await denegarSiNoEsAlumnoPropio(req, idAlumno, 'No puedes exportar el historial de otro alumno');
    if (denegado) return res.status(denegado.status).json({ ok: false, message: denegado.message });

    const { workbook, folio, totalMaterias } = await academicExportService.exportHistorialAcademico(Number(idAlumno));

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_HISTORIAL',
      `Historial académico — Alumno ${idAlumno} — Folio: ${folio} — Materias: ${totalMaterias}`,
      req
    );

    const filename = `historial_alumno_${idAlumno}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Historial:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 9. REPORTE POR GRUPO
// ==============================
async function exportReporteGrupo(req, res) {
  try {
    const { idGrupo, idPeriodo } = req.params;

    const { workbook, folio, totalAlumnos, totalMaterias } = await academicExportService.exportReporteGrupo(
      Number(idGrupo), Number(idPeriodo)
    );

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_REPORTE_GRUPO',
      `Reporte grupo — Grupo ${idGrupo}, Periodo ${idPeriodo} — Folio: ${folio} — Alumnos: ${totalAlumnos}, Materias: ${totalMaterias}`,
      req
    );

    const filename = `reporte_grupo_${idGrupo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Reporte Grupo:', error.message);
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ ok: false, message: error.message });
  }
}

// ==============================
// 10. REPORTE DE SEGUIMIENTO
// ==============================
async function exportReporteSeguimiento(req, res) {
  try {
    const { idPeriodo } = req.params;

    const { workbook, folio, totalGrupos } = await academicExportService.exportReporteSeguimiento(Number(idPeriodo));

    await registrarExportAudit(
      req.user.id_usuario,
      'EXPORT_SEGUIMIENTO',
      `Reporte seguimiento — Periodo ${idPeriodo} — Folio: ${folio} — Grupos: ${totalGrupos}`,
      req
    );

    const filename = `seguimiento_periodo_${idPeriodo}_${folio}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Folio', folio);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[ACAD-EXPORT] Error exportando Seguimiento:', error.message);
    res.status(500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  exportConcentradoGeneral,
  exportConcentradoParcial,
  exportConcentradoPeriodo,
  exportPreboletaIndividual,
  exportBoletaIndividual,
  exportHistorialAcademico,
  exportReporteGrupo,
  exportReporteSeguimiento
};
