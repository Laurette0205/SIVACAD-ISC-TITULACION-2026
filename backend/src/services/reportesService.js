'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const { generateKardexPDF, generateKardexExcel } = require('./exportKardex');
const { generateKardexPdfWithPhp, generateKardexExcelWithPhp, isPhpAvailable } = require('./phpKardexBridge');

function generarFolio() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `K-${y}${m}${d}-${rand}`;
}

function formatFechaMX(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  } catch { return String(d); }
}

function getTzInfo() {
  return { zona_horaria: 'America/Mexico_City', utc_offset: 'UTC-6', timestamp: new Date().toISOString() };
}

async function getKardexData(id) {
  const [rows] = await pool.execute(
    `SELECT k.*,
            a.id_alumno, a.id_usuario, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
            a.curp, a.semestre_actual, a.fotografia,
            c.nombre_carrera
     FROM kardex_alumno k
     INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
     LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
     WHERE k.id_kardex = ? OR a.id_alumno = ? OR a.id_usuario = ?
     LIMIT 1`,
    [id, id, id]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function getKardexDataByUserId(idUsuario) {
  const [rows] = await pool.execute(
    `SELECT k.*,
            a.id_alumno, a.id_usuario, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
            a.curp, a.semestre_actual, a.fotografia,
            c.nombre_carrera
     FROM kardex_alumno k
     INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
     LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
     WHERE a.id_usuario = ?
     LIMIT 1`,
    [idUsuario]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function getHistorial(idAlumno) {
  try {
    const [rows] = await pool.execute(
      `SELECT kh.*, p.nombre_periodo, m.nombre_materia, m.clave_materia, m.creditos AS creditos_materia
       FROM kardex_historial_academico kh
       LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
       LEFT JOIN materias m ON m.id_materia = kh.id_materia
       WHERE kh.id_alumno = ?
       ORDER BY p.fecha_inicio DESC, kh.creado_en DESC`,
      [idAlumno]
    );
    return rows;
  } catch { return []; }
}

async function getSellos() {
  try {
    const [rows] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    return rows;
  } catch { return []; }
}

function publicUrlFn(baseUrl, relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
}

async function buildPreviewData(k, baseUrl) {
  if (!k) return null;

  const folio = k.folio_kardex || generarFolio();
  if (!k.folio_kardex && k.id_kardex) {
    try {
      await pool.execute('UPDATE kardex_alumno SET folio_kardex = ? WHERE id_kardex = ?', [folio, k.id_kardex]);
    } catch (e) { /* ignore */ }
  }

  const tz = getTzInfo();
  const nombreCompleto = `${k.nombres || ''} ${k.apellido_paterno || ''} ${k.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
  const creditosCubiertos = Number(k.creditos_acumulados || 0);
  const promedio = Number(k.promedio_general || 0);
  const fotografiaRel = k.foto_institucional || k.foto_alumno || k.fotografia;
  const fotografiaUrl = fotografiaRel ? publicUrlFn(baseUrl, fotografiaRel) : null;
  const qrUrl = k.url_qr ? publicUrlFn(baseUrl, k.url_qr) : null;

  const firmaUUID = crypto.randomUUID();
  const firmaData = JSON.stringify({ folio, alumno: nombreCompleto, matricula: k.matricula, emitido: new Date().toISOString(), tz, uuid: firmaUUID });
  const firmaHash = crypto.createHash('sha256').update(firmaData).digest('hex');

  if (k.id_kardex) {
    try {
      await pool.execute('UPDATE kardex_alumno SET firma_electronica = ? WHERE id_kardex = ?', [firmaHash, k.id_kardex]);
    } catch (e) { /* ignore */ }
  }

  const historial = await getHistorial(k.id_alumno);
  const sellosDB = await getSellos();

  const historialRows = historial.map(h => ({
    periodo: h.nombre_periodo || '—',
    clave: h.clave_materia || '—',
    materia: h.nombre_materia || '—',
    calificacion: h.calificacion != null ? Number(h.calificacion).toFixed(1) : '—',
    creditos: h.creditos || h.creditos_materia || 0,
    estado: h.estado || '—'
  }));

  const sellos = (sellosDB && sellosDB.length > 0 ? sellosDB : [
    { tipo: 'sivacad', titulo: 'Sello SIVACAD', descripcion: 'Sello oficial del Sistema Integral de Validación y Control Académico' },
    { tipo: 'division_isc', titulo: 'Sello División ISC', descripcion: 'Sello de la División de Ingeniería en Sistemas Computacionales' },
    { tipo: 'control_escolar', titulo: 'Sello Control Escolar', descripcion: 'Sello oficial de Control Escolar' }
  ]).map(s => ({
    tipo: s.tipo || s.titulo,
    titulo: s.titulo,
    descripcion: s.descripcion || ''
  }));

  return {
    folio,
    fecha_emision: formatFechaMX(new Date()),
    zona_horaria: tz.zona_horaria,
    alumno: {
      id_alumno: k.id_alumno,
      nombre_completo: nombreCompleto,
      matricula: k.matricula || '',
      curp: k.curp || '—',
      carrera: k.nombre_carrera || '—',
      semestre: k.semestre_actual || '—',
      promedio,
      creditos_cubiertos: creditosCubiertos,
      estatus: k.estatus || 'Vigente',
      fotografia_url: fotografiaUrl,
      url_qr: qrUrl
    },
    historial: historialRows,
    sellos,
    firma_electronica: firmaHash.substring(0, 48) + '…',
    nota_institucional: 'Si quieres visualizar o verificar qué materias acreditaste, estás en 2da oportunidad, si estás en recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de Gestión Académica y Administrativa) para más información.'
  };
}

async function generatePdfWithDompdf(id, reqBaseUrl) {
  const k = await getKardexData(id);
  if (!k) throw new Error('Kardex no encontrado');

  const baseUrl = reqBaseUrl || 'http://localhost:3000';
  const previewData = await buildPreviewData(k, baseUrl);

  try {
    const pdfBuffer = await generateKardexPdfWithPhp(previewData);
    return { pdfBuffer, folio: previewData.folio };
  } catch (phpError) {
    console.warn('PHP/Dompdf no disponible, usando Puppeteer como fallback:', phpError.message);
    return generateKardexPDF(id);
  }
}

async function generateExcelWithPhp(id) {
  const k = await getKardexData(id);
  if (!k) throw new Error('Kardex no encontrado');

  try {
    const excelBuffer = await generateKardexExcelWithPhp(id);
    const folio = k.folio_kardex || generarFolio();
    return { excelBuffer, folio };
  } catch (phpError) {
    console.warn('PHP/PhpSpreadsheet no disponible, usando ExcelJS como fallback:', phpError.message);
    const { workbook, folio: f } = await generateKardexExcel(id);
    try {
      const buf = await workbook.xlsx.writeBuffer();
      return { excelBuffer: Buffer.isBuffer(buf) ? buf : Buffer.from(buf), folio: f };
    } catch (writeErr) {
      const { Workbook } = require('exceljs');
      const wb = new Workbook();
      const ws = wb.addWorksheet('Error');
      ws.getCell('A1').value = 'Error al generar: ' + writeErr.message;
      return { excelBuffer: Buffer.from(await wb.xlsx.writeBuffer()), folio: 'ERR-' + Date.now() };
    }
  }
}

module.exports = {
  getKardexData,
  getKardexDataByUserId,
  getHistorial,
  getSellos,
  buildPreviewData,
  generateKardexPDF,
  generateKardexExcel,
  generatePdfWithDompdf,
  generateExcelWithPhp,
  isPhpAvailable,
  generarFolio,
  formatFechaMX,
  getTzInfo
};
