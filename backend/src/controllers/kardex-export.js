'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const { generateKardexPDF, generateKardexExcel } = require('../services/exportKardex');

function getBaseUrl(req) {
  return String(process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function publicUrl(req, relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const base = getBaseUrl(req);
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${cleanPath}`;
}

async function registrarAuditoria(pool, datos) {
  await pool.execute(
    `INSERT INTO kardex_auditoria (id_kardex, id_alumno, accion, detalle, id_usuario, ip_origen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [datos.id_kardex || null, datos.id_alumno || null, datos.accion,
     datos.detalle || null, datos.id_usuario || null, datos.ip_origen || null]
  );
}

exports.exportKardexPDF = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const { pdfBuffer, folio } = await generateKardexPDF(id);

    let idKardex = null;
    let idAlumno = null;
    try {
      const [rows] = await pool.execute(
        'SELECT id_kardex, id_alumno FROM kardex_alumno WHERE id_alumno = ? OR id_kardex = ? LIMIT 1',
        [id, id]
      );
      if (rows.length) {
        idKardex = rows[0].id_kardex;
        idAlumno = rows[0].id_alumno;
      }
    } catch (e) { /* ignore */ }

    await registrarAuditoria(pool, {
      id_kardex: idKardex, id_alumno: idAlumno,
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

    const { workbook, folio } = await generateKardexExcel(id);

    let idKardex = null;
    let idAlumno = null;
    try {
      const [rows] = await pool.execute(
        'SELECT id_kardex, id_alumno FROM kardex_alumno WHERE id_alumno = ? OR id_kardex = ? LIMIT 1',
        [id, id]
      );
      if (rows.length) {
        idKardex = rows[0].id_kardex;
        idAlumno = rows[0].id_alumno;
      }
    } catch (e) { /* ignore */ }

    await registrarAuditoria(pool, {
      id_kardex: idKardex, id_alumno: idAlumno,
      accion: 'EXPORTAR_EXCEL',
      detalle: `Excel del kardex exportado con folio ${folio}`,
      id_usuario: req.user?.id_usuario, ip_origen: req.ip
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${folio}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('exportKardexExcel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al exportar Excel del kardex' });
    }
  }
};

exports.getKardexExportInfo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const [rows] = await pool.execute(
      `SELECT k.*,
              a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual, a.fotografia,
              c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       WHERE k.id_kardex = ? OR a.id_alumno = ? OR a.id_usuario = ?
       LIMIT 1`,
      [id, id, id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Kardex no encontrado' });

    const k = rows[0];
    const folio = k.folio_kardex || null;

    const nombreCompleto = `${k.nombres || ''} ${k.apellido_paterno || ''} ${k.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
    const fotografiaUrl = k.foto_institucional || k.foto_alumno || k.fotografia;

    return res.json({
      ok: true,
      data: {
        folio,
        nombre_completo: nombreCompleto,
        matricula: k.matricula,
        curp: k.curp,
        carrera: k.nombre_carrera,
        semestre: k.semestre_actual,
        promedio: Number(k.promedio_general || 0),
        creditos_cubiertos: Number(k.creditos_acumulados || 0),
        estatus: k.estatus,
        fotografia_url: fotografiaUrl ? publicUrl(req, fotografiaUrl) : null,
        url_qr: k.url_qr ? publicUrl(req, k.url_qr) : null,
        pdf_url: `/api/reportes/kardex/${id}/pdf`,
        excel_url: `/api/reportes/kardex/${id}/excel`
      }
    });
  } catch (error) {
    console.error('getKardexExportInfo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener información del kardex' });
  }
};