'use strict';

const pool = require('../config/db');
const reportesService = require('../services/reportesService');

function getBaseUrl(req) {
  return String(process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function getPublicUrl(req, relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const base = getBaseUrl(req);
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${cleanPath}`;
}

async function registrarAuditoria(datos) {
  try {
    await pool.execute(
      `INSERT INTO kardex_auditoria (id_kardex, id_alumno, accion, detalle, id_usuario, ip_origen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [datos.id_kardex || null, datos.id_alumno || null, datos.accion,
       datos.detalle || null, datos.id_usuario || null, datos.ip_origen || null]
    );
  } catch (e) { /* ignore */ }
}

async function getKardexIds(identifier) {
  try {
    const [rows] = await pool.execute(
      'SELECT id_kardex, id_alumno FROM kardex_alumno WHERE id_alumno = ? OR id_kardex = ? LIMIT 1',
      [identifier, identifier]
    );
    return rows.length ? { id_kardex: rows[0].id_kardex, id_alumno: rows[0].id_alumno } : { id_kardex: null, id_alumno: null };
  } catch { return { id_kardex: null, id_alumno: null }; }
}

exports.exportKardexDompdfPDF = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const baseUrl = getBaseUrl(req);
    const { pdfBuffer, folio } = await reportesService.generatePdfWithDompdf(id, baseUrl);

    const ids = await getKardexIds(id);
    await registrarAuditoria({
      id_kardex: ids.id_kardex, id_alumno: ids.id_alumno,
      accion: 'EXPORTAR_PDF_DOMPDF',
      detalle: `PDF generado con Dompdf folio ${folio}`,
      id_usuario: req.user?.id_usuario, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('exportKardexDompdfPDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar PDF con Dompdf' });
    }
  }
};

exports.exportMyKardexDompdfPDF = async (req, res) => {
  try {
    const userId = req.user?.id_usuario;
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

    const k = await reportesService.getKardexDataByUserId(userId);
    if (!k) return res.status(404).json({ ok: false, message: 'No se encontró kardex' });

    const baseUrl = getBaseUrl(req);
    const { pdfBuffer, folio } = await reportesService.generatePdfWithDompdf(k.id_alumno, baseUrl);

    await registrarAuditoria({
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'EXPORTAR_MY_PDF_DOMPDF',
      detalle: `PDF Dompdf propio folio ${folio}`,
      id_usuario: userId, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('exportMyKardexDompdfPDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar tu PDF' });
    }
  }
};

exports.previewKardex = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const baseUrl = getBaseUrl(req);
    const k = await reportesService.getKardexData(id);
    if (!k) return res.status(404).json({ ok: false, message: 'Kardex no encontrado' });

    const data = await reportesService.buildPreviewData(k, baseUrl);

    await registrarAuditoria({
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'PREVIEW_KARDEX',
      detalle: `Vista previa del kardex generada para folio ${data.folio}`,
      id_usuario: req.user?.id_usuario, ip_origen: req.ip
    });

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('previewKardex:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener vista previa del kardex' });
  }
};

exports.exportKardexPDF = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { pdfBuffer, folio } = await reportesService.generateKardexPDF(id);
    const ids = await getKardexIds(id);

    await registrarAuditoria({
      id_kardex: ids.id_kardex, id_alumno: ids.id_alumno,
      accion: 'EXPORTAR_PDF',
      detalle: `PDF del kardex exportado con folio ${folio}`,
      id_usuario: req.user?.id_usuario, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('exportKardexPDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar PDF del kardex' });
    }
  }
};

exports.exportKardexExcel = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { excelBuffer, folio } = await reportesService.generateExcelWithPhp(id);
    const ids = await getKardexIds(id);

    await registrarAuditoria({
      id_kardex: ids.id_kardex, id_alumno: ids.id_alumno,
      accion: 'EXPORTAR_EXCEL',
      detalle: `Excel del kardex exportado con folio ${folio}`,
      id_usuario: req.user?.id_usuario, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.end(excelBuffer);
  } catch (error) {
    console.error('exportKardexExcel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar Excel del kardex' });
    }
  }
};

exports.previewMyKardex = async (req, res) => {
  try {
    const userId = req.user?.id_usuario;
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

    const baseUrl = getBaseUrl(req);
    const k = await reportesService.getKardexDataByUserId(userId);
    if (!k) return res.status(404).json({ ok: false, message: 'No se encontró kardex para el usuario autenticado' });

    const data = await reportesService.buildPreviewData(k, baseUrl);

    await registrarAuditoria({
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'PREVIEW_MY_KARDEX',
      detalle: `Vista previa del propio kardex (folio ${data.folio})`,
      id_usuario: userId, ip_origen: req.ip
    });

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('previewMyKardex:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener vista previa de tu kardex' });
  }
};

exports.exportMyKardexPDF = async (req, res) => {
  try {
    const userId = req.user?.id_usuario;
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

    const k = await reportesService.getKardexDataByUserId(userId);
    if (!k) return res.status(404).json({ ok: false, message: 'No se encontró kardex para el usuario autenticado' });

    const { pdfBuffer, folio } = await reportesService.generateKardexPDF(k.id_alumno);

    await registrarAuditoria({
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'EXPORTAR_MY_PDF',
      detalle: `PDF del propio kardex exportado con folio ${folio}`,
      id_usuario: userId, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('exportMyKardexPDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar tu PDF del kardex' });
    }
  }
};

exports.exportMyKardexExcel = async (req, res) => {
  try {
    const userId = req.user?.id_usuario;
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

    const k = await reportesService.getKardexDataByUserId(userId);
    if (!k) return res.status(404).json({ ok: false, message: 'No se encontró kardex para el usuario autenticado' });

    const { excelBuffer, folio } = await reportesService.generateExcelWithPhp(k.id_alumno);

    await registrarAuditoria({
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'EXPORTAR_MY_EXCEL',
      detalle: `Excel del propio kardex exportado con folio ${folio}`,
      id_usuario: userId, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.end(excelBuffer);
  } catch (error) {
    console.error('exportMyKardexExcel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar tu Excel del kardex' });
    }
  }
};
