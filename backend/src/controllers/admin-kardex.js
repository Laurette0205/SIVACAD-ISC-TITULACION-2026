'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const QRCode = require('qrcode');

const WATERMARK_PATH = path.resolve(process.cwd(), '..', 'frontend', 'src', 'assets', 'marcadeagua_SIVACAD.jpeg');
const LOGO_TECNM = path.resolve(process.cwd(), '..', 'frontend', 'src', 'assets', 'Logo-TecNM.png');
const LOGO_TESI = path.resolve(process.cwd(), '..', 'frontend', 'src', 'assets', 'Logo-TESI.png');
const LOGO_SIVACAD = path.resolve(process.cwd(), '..', 'frontend', 'src', 'assets', 'Logo-SIVACAD.jpeg');

function getBaseUrl(req) {
  const fallback = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return String(fallback).replace(/\/$/, '');
}

function publicUrl(req, relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const base = getBaseUrl(req);
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${cleanPath}`;
}

function absoluteFromRelative(relativePath) {
  if (!relativePath) return null;
  const clean = String(relativePath).replace(/^\/+/, '');
  return path.resolve(process.cwd(), clean);
}

function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch (e) { /* ignore */ }
}

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
  const tz = 'America/Mexico_City';
  const now = new Date();
  const offset = -360; // UTC-6 CST, UTC-5 CDT
  return {
    zona_horaria: tz,
    utc_offset: `UTC${offset >= 0 ? '+' : ''}${Math.floor(offset / 60)}:${String(Math.abs(offset) % 60).padStart(2, '0')}`,
    timestamp: now.toISOString()
  };
}

async function registrarAuditoria(conn, datos) {
  await conn.execute(
    `INSERT INTO kardex_auditoria (id_kardex, id_alumno, accion, campo_modificado, valor_anterior, valor_nuevo, detalle, id_usuario, ip_origen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.id_kardex || null, datos.id_alumno || null, datos.accion, datos.campo || null,
     datos.valor_anterior || null, datos.valor_nuevo || null, datos.detalle || null,
     datos.id_usuario || null, datos.ip_origen || null]
  );
}

// =====================================================
// 1. KARDEX GENERAL (listado paginado)
// =====================================================
exports.getKardexGeneral = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const estatus = req.query.estatus || '';

    const where = [];
    const params = [];
    if (search) {
      where.push('(a.matricula LIKE ? OR a.nombres LIKE ? OR a.apellido_paterno LIKE ? OR a.apellido_materno LIKE ? OR k.folio_kardex LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (estatus) { where.push('k.estatus = ?'); params.push(estatus); }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM kardex_alumno k INNER JOIN alumnos a ON a.id_alumno = k.id_alumno ${whereSQL}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT k.id_kardex, k.id_alumno, k.numero_control, k.promedio_general,
              k.creditos_acumulados, k.estatus, k.folio_kardex, k.foto_institucional,
              k.foto_alumno, k.url_qr, k.ultima_actualizacion,
              a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual,
              COALESCE(c.nombre_carrera, '—') AS nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       ${whereSQL}
       ORDER BY a.apellido_paterno ASC, a.apellido_materno ASC
       LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return res.json({
      ok: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('getKardexGeneral:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener kardex general' });
  }
};

// =====================================================
// 2. KARDEX INDIVIDUAL
// =====================================================
exports.getKardexIndividual = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const [kardexRows] = await pool.execute(
      `SELECT k.*,
              a.id_usuario, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual, a.fotografia,
              u.correo_institucional,
              c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
       WHERE a.id_alumno = ? OR a.id_usuario = ? OR k.id_kardex = ?
       LIMIT 1`,
      [id, id, id]
    );
    if (!kardexRows.length) return res.status(404).json({ ok: false, message: 'Kardex no encontrado' });

    const k = kardexRows[0];

    let historial = [];
    try {
      [historial] = await pool.execute(
        `SELECT kh.*, p.nombre_periodo, m.nombre_materia, m.clave_materia, g.nombre_grupo
         FROM kardex_historial_academico kh
         LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
         LEFT JOIN materias m ON m.id_materia = kh.id_materia
         LEFT JOIN grupos g ON g.id_grupo = kh.id_grupo
         WHERE kh.id_alumno = ?
         ORDER BY kh.creado_en DESC`,
        [k.id_alumno]
      );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    let auditoria = [];
    try {
      [auditoria] = await pool.execute(
        `SELECT ka.*, CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario_nombre
         FROM kardex_auditoria ka
         LEFT JOIN usuarios u ON u.id_usuario = ka.id_usuario
         WHERE ka.id_alumno = ? OR ka.id_kardex = ?
         ORDER BY ka.creado_en DESC LIMIT 50`,
        [k.id_alumno, k.id_kardex]
      );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    let sellos = [];
    try {
      [sellos] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    const fotografiaUrl = k.foto_institucional || k.foto_alumno || k.fotografia;

    return res.json({
      ok: true,
      data: {
        id_kardex: k.id_kardex,
        id_alumno: k.id_alumno,
        folio_kardex: k.folio_kardex,
        numero_control: k.numero_control,
        matricula: k.matricula,
        nombre_completo: `${k.nombres || ''} ${k.apellido_paterno || ''} ${k.apellido_materno || ''}`.replace(/\s+/g, ' ').trim(),
        nombres: k.nombres,
        apellido_paterno: k.apellido_paterno,
        apellido_materno: k.apellido_materno,
        curp: k.curp,
        semestre_actual: k.semestre_actual,
        promedio_general: Number(k.promedio_general || 0),
        creditos_acumulados: Number(k.creditos_acumulados || 0),
        estatus: k.estatus,
        carrera: k.nombre_carrera,
        correo: k.correo_institucional || null,
        fotografia_url: fotografiaUrl ? publicUrl(req, fotografiaUrl) : null,
        url_qr: k.url_qr ? publicUrl(req, k.url_qr) : null,
        firma_electronica: k.firma_electronica,
        historial,
        auditoria,
        sellos
      }
    });
  } catch (error) {
    console.error('getKardexIndividual:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener kardex individual' });
  }
};

// =====================================================
// 3. CARGA DE FOTOGRAFÍA INSTITUCIONAL
// =====================================================
exports.cargarFotoInstitucional = async (req, res) => {
  let oldFilePath = null;
  try {
    const id = Number(req.params.id);
    if (!id) { if (req.file?.path) safeUnlink(req.file.path); return res.status(400).json({ ok: false, message: 'ID inválido' }); }
    if (!req.file) return res.status(400).json({ ok: false, message: 'No se recibió imagen' });

    const [alumnoRows] = await pool.execute('SELECT id_alumno, fotografia FROM alumnos WHERE id_alumno = ? LIMIT 1', [id]);
    if (!alumnoRows.length) { safeUnlink(req.file.path); return res.status(404).json({ ok: false, message: 'Alumno no encontrado' }); }

    const [kardexRow] = await pool.execute('SELECT id_kardex, foto_institucional FROM kardex_alumno WHERE id_alumno = ? LIMIT 1', [id]);
    oldFilePath = absoluteFromRelative(kardexRow[0]?.foto_institucional || alumnoRows[0]?.fotografia);

    const relativePath = `/uploads/kardex/fotos/${req.file.filename}`;
    await fs.promises.mkdir(path.dirname(absoluteFromRelative(relativePath)), { recursive: true });

    await pool.execute(
      `UPDATE kardex_alumno SET foto_institucional = ?, foto_autorizada_por = ?, foto_autorizada_en = NOW() WHERE id_alumno = ?`,
      [relativePath, req.user.id_usuario, id]
    );
    await pool.execute(`UPDATE alumnos SET fotografia = ? WHERE id_alumno = ?`, [relativePath, id]);

    await registrarAuditoria(pool, {
      id_kardex: kardexRow[0]?.id_kardex, id_alumno: id,
      accion: 'CARGAR_FOTO_INSTITUCIONAL', campo: 'foto_institucional',
      detalle: `Fotografía institucional cargada por ${req.user.id_usuario}`,
      id_usuario: req.user.id_usuario, ip_origen: req.ip
    });

    safeUnlink(oldFilePath);
    return res.json({ ok: true, message: 'Fotografía institucional cargada correctamente (autorizada por Control Escolar)' });
  } catch (error) {
    if (req.file?.path) safeUnlink(req.file.path);
    console.error('cargarFotoInstitucional:', error);
    return res.status(500).json({ ok: false, message: 'Error al cargar fotografía' });
  }
};

// =====================================================
// 4. VALIDACIÓN QR
// =====================================================
exports.validarQR = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ ok: false, message: 'Token QR requerido' });

    const [rows] = await pool.execute(
      `SELECT k.id_kardex, k.id_alumno, k.qr_token, k.url_qr,
              a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       WHERE k.qr_token = ? LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'QR inválido o expirado', valido: false });
    }

    return res.json({
      ok: true, valido: true,
      data: {
        alumno: `${rows[0].nombres} ${rows[0].apellido_paterno} ${rows[0].apellido_materno}`.replace(/\s+/g, ' ').trim(),
        matricula: rows[0].matricula, curp: rows[0].curp,
        carrera: rows[0].nombre_carrera,
        url_qr: rows[0].url_qr ? publicUrl(req, rows[0].url_qr) : null,
        verificado_en: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('validarQR:', error);
    return res.status(500).json({ ok: false, message: 'Error al validar QR' });
  }
};

// =====================================================
// 5. GENERAR QR
// =====================================================
exports.generarQR = async (req, res) => {
  let previousQrPath = null;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const [rows] = await pool.execute(
      'SELECT id_alumno, qr_token, url_qr FROM kardex_alumno WHERE id_alumno = ? LIMIT 1', [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });

    previousQrPath = absoluteFromRelative(rows[0].url_qr);
    const token = crypto.randomUUID();
    const baseUrl = getBaseUrl(req);
    const qrContent = `${baseUrl}/api/admin-kardex/qr/validar/${token}`;
    const relativePath = `/uploads/kardex/qrs/alumno-${id}-${Date.now()}.png`;
    const absolutePath = absoluteFromRelative(relativePath);
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await QRCode.toFile(absolutePath, qrContent, { type: 'png', width: 520, margin: 1, errorCorrectionLevel: 'H' });

    await pool.execute('UPDATE kardex_alumno SET qr_token = ?, url_qr = ? WHERE id_alumno = ?', [token, relativePath, id]);
    safeUnlink(previousQrPath);

    await registrarAuditoria(pool, {
      id_alumno: id, accion: 'GENERAR_QR', detalle: 'QR institucional generado',
      id_usuario: req.user.id_usuario, ip_origen: req.ip
    });

    return res.json({ ok: true, message: 'QR generado', data: { qr_token: token, url_qr: publicUrl(req, relativePath) } });
  } catch (error) {
    console.error('generarQR:', error);
    return res.status(500).json({ ok: false, message: 'Error al generar QR' });
  }
};

// =====================================================
// 6. HISTORIAL ACADÉMICO
// =====================================================
exports.getHistorialAcademico = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    let rows = [];
    try {
      [rows] = await pool.execute(
      `SELECT kh.*, p.nombre_periodo, m.nombre_materia, m.clave_materia, m.creditos AS creditos_materia,
              g.nombre_grupo,
              CONCAT(u.nombres, ' ', u.apellido_paterno) AS registrado_por_nombre
       FROM kardex_historial_academico kh
       LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
       LEFT JOIN materias m ON m.id_materia = kh.id_materia
       LEFT JOIN grupos g ON g.id_grupo = kh.id_grupo
       LEFT JOIN usuarios u ON u.id_usuario = kh.registrado_por
       WHERE kh.id_alumno = ?
       ORDER BY p.fecha_inicio DESC, kh.creado_en DESC`,
      [id]
    );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    const resumen = {
      total_materias: rows.length,
      acreditadas: rows.filter(r => r.estado === 'Acreditada').length,
      no_acreditadas: rows.filter(r => r.estado === 'No Acreditada').length,
      cursando: rows.filter(r => r.estado === 'Cursando').length,
      creditos_acumulados: rows.reduce((s, r) => s + Number(r.creditos || 0), 0),
      promedio: rows.filter(r => r.calificacion).reduce((s, r, _, arr) => s + Number(r.calificacion || 0) / (arr.length || 1), 0)
    };

    return res.json({ ok: true, data: rows, resumen });
  } catch (error) {
    console.error('getHistorialAcademico:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial académico' });
  }
};

exports.agregarHistorialAcademico = async (req, res) => {
  try {
    const { id_alumno, id_periodo, id_materia, id_grupo, calificacion, creditos, tipo_materia, estado, observaciones } = req.body;
    if (!id_alumno || !id_periodo) return res.status(400).json({ ok: false, message: 'Alumno y período requeridos' });

    const [result] = await pool.execute(
      `INSERT INTO kardex_historial_academico (id_alumno, id_periodo, id_materia, id_grupo, calificacion, creditos, tipo_materia, estado, observaciones, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_alumno, id_periodo, id_materia || null, id_grupo || null, calificacion || null, creditos || 0,
       tipo_materia || 'Ordinaria', estado || 'Cursando', observaciones || null, req.user.id_usuario]
    );

    await registrarAuditoria(pool, {
      id_alumno, accion: 'AGREGAR_HISTORIAL', detalle: `Materia registrada en historial académico`,
      id_usuario: req.user.id_usuario, ip_origen: req.ip
    });

    return res.status(201).json({ ok: true, message: 'Registro académico agregado', data: { id_historial: result.insertId } });
  } catch (error) {
    console.error('agregarHistorialAcademico:', error);
    return res.status(500).json({ ok: false, message: 'Error al agregar historial' });
  }
};

// =====================================================
// 7. AUDITORÍA DE EXPEDIENTES
// =====================================================
exports.getAuditoria = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
    const offset = (page - 1) * limit;
    const idAlumno = req.query.id_alumno || '';
    const accion = req.query.accion || '';

    const where = [];
    const params = [];
    if (idAlumno) { where.push('ka.id_alumno = ?'); params.push(Number(idAlumno)); }
    if (accion) { where.push('ka.accion = ?'); params.push(accion); }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    let total = 0;
    try {
      const [[cnt]] = await pool.execute(`SELECT COUNT(*) AS total FROM kardex_auditoria ka ${whereSQL}`, params);
      total = cnt.total;
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    let rows = [];
    try {
      [rows] = await pool.execute(
        `SELECT ka.*,
                CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
                a.matricula,
                CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario_nombre
         FROM kardex_auditoria ka
         LEFT JOIN alumnos a ON a.id_alumno = ka.id_alumno
         LEFT JOIN usuarios u ON u.id_usuario = ka.id_usuario
         ${whereSQL}
         ORDER BY ka.creado_en DESC
         LIMIT ? OFFSET ?`,
        [...params, String(limit), String(offset)]
      );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    return res.json({ ok: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('getAuditoria:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener auditoría' });
  }
};

// =====================================================
// 8. SELLOS
// =====================================================
// =====================================================
// 8. LIMPIAR AUDITORÍA (solo ADMINISTRADOR)
// =====================================================
exports.limpiarAuditoria = async (req, res) => {
  try {
    const { dias, hasta, confirmacion } = req.query;

    if (confirmacion !== 'SI_LIMPIAR') {
      return res.status(400).json({
        ok: false,
        message: 'Debe confirmar la limpieza con confirmacion=SI_LIMPIAR'
      });
    }

    let registroEliminados = 0;
    let beforeCount = 0;

    try {
      const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM kardex_auditoria');
      beforeCount = cnt;
    } catch (e) { /* no table */ }

    if (hasta) {
      const [result] = await pool.execute(
        'DELETE FROM kardex_auditoria WHERE creado_en <= ?',
        [hasta]
      );
      registroEliminados = result.affectedRows;
    } else if (dias) {
      const limite = new Date();
      limite.setDate(limite.getDate() - Number(dias));
      const [result] = await pool.execute(
        'DELETE FROM kardex_auditoria WHERE creado_en <= ?',
        [limite]
      );
      registroEliminados = result.affectedRows;
    } else {
      const [result] = await pool.execute('DELETE FROM kardex_auditoria');
      registroEliminados = result.affectedRows;
    }

    return res.json({
      ok: true,
      message: `Auditoría limpiada correctamente. Eliminados: ${registroEliminados} registros.`,
      data: {
        antes: beforeCount,
        eliminados: registroEliminados,
        restantes: Math.max(0, beforeCount - registroEliminados)
      }
    });
  } catch (error) {
    console.error('limpiarAuditoria:', error);
    return res.status(500).json({ ok: false, message: 'Error al limpiar auditoría' });
  }
};

exports.getSellos = async (req, res) => {
  try {
    let rows = [];
    try {
      [rows] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('getSellos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener sellos' });
  }
};

// =====================================================
// 9. EXPORTAR PDF
// =====================================================
exports.exportPDF = async (req, res) => {
  let doc;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const [rows] = await pool.execute(
      `SELECT k.*, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual, a.fotografia,
              u.correo_institucional,
              c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
       WHERE k.id_kardex = ? OR a.id_alumno = ?
       LIMIT 1`,
      [id, id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Kardex no encontrado' });

    const k = rows[0];
    const folio = k.folio_kardex || generarFolio();
    if (!k.folio_kardex) {
      await pool.execute('UPDATE kardex_alumno SET folio_kardex = ? WHERE id_kardex = ?', [folio, k.id_kardex]);
    }

    const creditosCubiertos = Number(k.creditos_acumulados || 0);

    let sellos = [];
    try {
      [sellos] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    // Generar firma electrónica
    const firmaUUID = crypto.randomUUID();
    const nombreCompleto = `${k.apellido_paterno || ''} ${k.apellido_materno || ''} ${k.nombres || ''}`.replace(/\s+/g, ' ').trim();
    const firmaData = JSON.stringify({
      folio, alumno: nombreCompleto,
      matricula: k.matricula, emitido: new Date().toISOString(),
      tz: getTzInfo(), uuid: firmaUUID
    });
    const firmaHash = crypto.createHash('sha256').update(firmaData).digest('hex');

    await pool.execute(
      `UPDATE kardex_alumno SET firma_electronica = ?, ultima_actualizacion = NOW(), actualizado_por = ? WHERE id_kardex = ?`,
      [firmaHash, req.user.id_usuario, k.id_kardex]
    );

    const PDFDocument = require('pdfkit');
    doc = new PDFDocument({ size: 'letter', margin: 40, info: { Title: `Kardex ${folio}`, Author: 'SIVACAD' } });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=kardex_${folio}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    });
    doc.on('error', (err) => {
      console.error('PDF stream error:', err);
      doc.removeAllListeners('data');
      doc.removeAllListeners('end');
      if (!res.headersSent) {
        return res.status(500).json({ ok: false, message: 'Error al generar PDF' });
      }
    });

    const M = 40;
    const PW = doc.page.width;
    const CW = PW - M * 2;

    // ===== MARCA DE AGUA =====
    if (fs.existsSync(WATERMARK_PATH)) {
      doc.opacity(0.09);
      doc.image(WATERMARK_PATH, M, 40, { width: CW, height: 712, fit: [CW, 712], align: 'center', valign: 'center' });
      doc.opacity(1);
    }

    // ===== LOGOS =====
    if (fs.existsSync(LOGO_TECNM)) doc.image(LOGO_TECNM, M, 45, { height: 45 });
    if (fs.existsSync(LOGO_SIVACAD)) doc.image(LOGO_SIVACAD, (PW - 80) / 2, 45, { width: 80 });
    if (fs.existsSync(LOGO_TESI)) doc.image(LOGO_TESI, PW - M - 100, 45, { height: 45 });

    // ===== TÍTULO =====
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('KARDEX DEL ALUMNO', M, 100, { align: 'center' });

    // ===== SUB-ENCABEZADO (Folio | Emitido | Zona horaria) =====
    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    const subY = 122;
    const subLine = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date()).split(',')[0]}  |  Zona horaria: ${getTzInfo().zona_horaria}`;
    doc.text(subLine, M, subY, { align: 'center' });
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, subY + 14).lineTo(PW - M, subY + 14).stroke();

    // ===== SECCIÓN: DATOS DEL ALUMNO =====
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e40af');
    const secY = subY + 22;
    doc.text('DATOS DEL ALUMNO', M, secY);

    // === DOS COLUMNAS ===
    // Izquierda: datos del alumno
    // Derecha: foto institucional (5x2.5cm), QR, firma

    const leftX = M;
    const leftW = 290;
    const rightX = leftX + leftW + 10;
    const rightW = PW - M - rightX;

    const dataRowH = 14.5;
    let dy = secY + 20;

    // Foto institucional (derecha)
    const photoW = Math.min(142, rightW - 10);
    const photoH = Math.min(71, photoW * 0.5);
    const photoX = rightX + (rightW - photoW) / 2;
    // Try to load photo
    let photoLoaded = false;
    const tryPhotoPaths = [
      k.foto_institucional, k.foto_alumno, k.fotografia,
      (k.foto_institucional ? absoluteFromRelative(k.foto_institucional) : null),
      (k.foto_alumno ? absoluteFromRelative(k.foto_alumno) : null),
      (k.fotografia ? absoluteFromRelative(k.fotografia) : null)
    ].filter(Boolean);
    for (const p of tryPhotoPaths) {
      try {
        if (fs.existsSync(p)) {
          doc.image(p, photoX, dy, { width: photoW, height: photoH, fit: [photoW, photoH], align: 'center', valign: 'center' });
          photoLoaded = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!photoLoaded) {
      // Placeholder border for photo
      doc.rect(photoX, dy, photoW, photoH).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
      doc.fillColor('#94a3b8').fontSize(5.5).font('Helvetica').text('Aquí se inserta la foto\ninstitucional del alumno del\nsiguiente tamaño: 5 x 2.5cm', photoX + 2, dy + 4, { width: photoW - 4, align: 'center' });
    }

    // Datos del alumno (izquierda)
    const fields = [
      ['Nombre Completo:', nombreCompleto],
      ['Matrícula:', k.matricula],
      ['CURP:', k.curp || '—'],
      ['Carrera:', k.nombre_carrera || '—'],
      ['Semestre:', String(k.semestre_actual || '—')],
      ['Promedio:', Number(k.promedio_general || 0).toFixed(2)],
      ['Créditos cubiertos:', String(creditosCubiertos)],
      ['Estatus:', k.estatus || 'Vigente']
    ];
    fields.forEach(([label, value], i) => {
      const fy = dy + i * dataRowH;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text(label, leftX, fy);
      doc.font('Helvetica').fillColor('#334155');
      doc.text(value, leftX + 110, fy, { width: leftW - 110 });
    });

    // QR (derecha, debajo de la foto)
    const qrY = dy + 3 * dataRowH + 10;
    if (k.url_qr) {
      const qrAbs = absoluteFromRelative(k.url_qr);
      const qrSize = Math.min(65, rightW - 10);
      const qrX = rightX + (rightW - qrSize) / 2;
      if (qrAbs && fs.existsSync(qrAbs)) {
        doc.image(qrAbs, qrX, qrY, { width: qrSize });
        doc.fontSize(5.5).fillColor('#64748b').text('Código QR de verificación', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' });
      }
    }

    // FIRMA ELECTRÓNICA (derecha, debajo del QR)
    const firmaY = qrY + 85;
    const firmaX = rightX;
    const firmaW = rightW;
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(firmaX, firmaY).lineTo(firmaX + firmaW, firmaY).stroke();
    doc.fontSize(6).fillColor('#334155').font('Helvetica-Bold');
    doc.text('FIRMA ELECTRÓNICA', firmaX, firmaY + 5, { width: firmaW, align: 'center' });
    doc.text('DEL SISTEMA SIVACAD', firmaX, firmaY + 13, { width: firmaW, align: 'center' });
    doc.fontSize(5).fillColor('#64748b').font('Helvetica');
    doc.text(`SHA-256: ${firmaHash.substring(0, 32)}...`, firmaX, firmaY + 24, { width: firmaW, align: 'center' });

    // Altura máxima entre las dos columnas
    const rightBottom = firmaY + 42;
    const leftBottom = dy + fields.length * dataRowH;
    const contentEnd = Math.max(rightBottom, leftBottom) + 15;

    // ===== TEXTO SIGAA =====
    const sigaaY = Math.max(contentEnd, 400);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, sigaaY).lineTo(PW - M, sigaaY).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    doc.text(
      'Si quieres visualizar o verificar qué materias acreditaste, estás en 2da oportunidad, si estás en ' +
      'recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de ' +
      'Gestión Académica y Administrativa) para más información. El link de la plataforma oficial es el ' +
      'siguiente: https://sigaa.tesi.org.mx/index.php',
      M, sigaaY + 8, { align: 'justify' }
    );

    // ===== SELLOS =====
    const sellosY = sigaaY + 55;
    if (sellos.length > 0) {
      const selloW = Math.min(160, (PW - 2 * M) / Math.min(sellos.length, 3));
      const totalSelloW = Math.min(sellos.length, 3) * selloW;
      const startX = (PW - totalSelloW) / 2;
      sellos.slice(0, 3).forEach((s, i) => {
        const sx = startX + i * selloW;
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(s.titulo, sx, sellosY, { width: selloW, align: 'center' });
        doc.fontSize(5.5).fillColor('#64748b').font('Helvetica').text(s.descripcion || '', sx, sellosY + 12, { width: selloW, align: 'center' });
      });
    }

    // ===== PIE DE PÁGINA =====
    const footerY = sellosY + 55;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, footerY).lineTo(PW - M, footerY).stroke();
    doc.fontSize(6).fillColor('#94a3b8').text(
      `Documento generado electrónicamente el ${formatFechaMX(new Date())}  |  Folio: ${folio}  |  Zona horaria: ${getTzInfo().zona_horaria}  |  SIVACAD`,
      M, footerY + 5, { align: 'center' }
    );

    doc.end();

    await registrarAuditoria(pool, {
      id_kardex: k.id_kardex, id_alumno: k.id_alumno,
      accion: 'EXPORTAR_PDF', detalle: `PDF exportado con folio ${folio}`,
      id_usuario: req.user.id_usuario, ip_origen: req.ip
    });
  } catch (error) {
    console.error('exportPDF:', error);
    if (typeof doc !== 'undefined') {
      doc.removeAllListeners('data');
      doc.removeAllListeners('end');
      doc.removeAllListeners('error');
    }
    if (!res.headersSent) return res.status(500).json({ ok: false, message: 'Error al exportar PDF' });
  }
};

// =====================================================
// 10. EXPORTAR EXCEL
// =====================================================
exports.exportExcel = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const [rows] = await pool.execute(
      `SELECT k.*, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
              a.curp, a.semestre_actual, a.fotografia,
              c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(a.id_carrera, 1)
       WHERE k.id_kardex = ? OR a.id_alumno = ? LIMIT 1`,
      [id, id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Kardex no encontrado' });

    const k = rows[0];
    const folio = k.folio_kardex || generarFolio();
    const creditosCubiertos = Number(k.creditos_acumulados || 0);

    let sellos = [];
    try {
      [sellos] = await pool.execute('SELECT * FROM kardex_sellos WHERE activo = 1');
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIVACAD';
    wb.created = new Date();

    const ws = wb.addWorksheet('Kardex del Alumno');
    ws.headerFooter.oddHeader = '&C&"Helvetica"&8 SIVACAD - Kardex del Alumno';
    ws.headerFooter.oddFooter = `&L${formatFechaMX(new Date())}&CFolio: ${folio}&R${getTzInfo().zona_horaria}`;

    // Logos
    if (fs.existsSync(LOGO_TECNM)) {
      const lid = wb.addImage(LOGO_TECNM);
      ws.addImage(lid, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 40 } });
    }
    if (fs.existsSync(LOGO_SIVACAD)) {
      const lid = wb.addImage(LOGO_SIVACAD);
      ws.addImage(lid, { tl: { col: 3, row: 0 }, ext: { width: 70, height: 40 } });
    }
    if (fs.existsSync(LOGO_TESI)) {
      const lid = wb.addImage(LOGO_TESI);
      ws.addImage(lid, { tl: { col: 6, row: 0 }, ext: { width: 80, height: 40 } });
    }

    // Título
    ws.mergeCells(3, 1, 3, 8);
    ws.getCell('A3').value = 'KARDEX DEL ALUMNO';
    ws.getCell('A3').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    ws.getCell('A3').alignment = { horizontal: 'center' };

    // Sub-encabezado
    const nombreCompleto = `${k.apellido_paterno || ''} ${k.apellido_materno || ''} ${k.nombres || ''}`.replace(/\s+/g, ' ').trim();
    ws.mergeCells(4, 1, 4, 8);
    ws.getCell('A4').value = `Folio: ${folio}  |  Emitido: ${formatFechaMX(new Date()).split(',')[0]}  |  Zona horaria: ${getTzInfo().zona_horaria}`;
    ws.getCell('A4').font = { size: 8, color: { argb: 'FF475569' } };
    ws.getCell('A4').alignment = { horizontal: 'center' };

    // DATOS DEL ALUMNO
    ws.mergeCells(6, 1, 6, 8);
    ws.getCell('A6').value = 'DATOS DEL ALUMNO';
    ws.getCell('A6').font = { bold: true, size: 11, color: { argb: 'FF1E40AF' } };

    // Datos en formato label: value
    let r = 8;
    const dataFields = [
      ['Nombre Completo:', nombreCompleto],
      ['Matrícula:', k.matricula],
      ['CURP:', k.curp || '—'],
      ['Carrera:', k.nombre_carrera || '—'],
      ['Semestre:', String(k.semestre_actual || '—')],
      ['Promedio:', Number(k.promedio_general || 0).toFixed(2)],
      ['Créditos cubiertos:', String(creditosCubiertos)],
      ['Estatus:', k.estatus || 'Vigente']
    ];
    dataFields.forEach(([label, value]) => {
      ws.getCell(`A${r}`).value = label;
      ws.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      ws.getCell(`B${r}`).value = value;
      ws.getCell(`B${r}`).font = { size: 10, color: { argb: 'FF334155' } };
      r++;
    });

    // SIGAA
    r += 1;
    ws.mergeCells(`A${r}:H${r}`);
    ws.getCell(`A${r}`).value =
      'Si quieres visualizar o verificar qué materias acreditaste, estás en 2da oportunidad, si estás en ' +
      'recurse o te fuiste a materia especial, visita la plataforma oficial SIGAA (Sistema Integral de ' +
      'Gestión Académica y Administrativa) para más información. El link de la plataforma oficial es el ' +
      'siguiente: https://sigaa.tesi.org.mx/index.php';
    ws.getCell(`A${r}`).font = { size: 8, color: { argb: 'FF475569' } };
    ws.getCell(`A${r}`).alignment = { wrapText: true };

    // Sellos
    if (sellos.length > 0) {
      r += 2;
      ws.getCell(`A${r}`).value = 'SELLOS INSTITUCIONALES';
      ws.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
      r++;
      sellos.slice(0, 3).forEach(s => {
        ws.getCell(`A${r}`).value = s.titulo;
        ws.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: 'FF0F172A' } };
        ws.getCell(`B${r}`).value = s.descripcion || '';
        ws.getCell(`B${r}`).font = { size: 8, color: { argb: 'FF64748B' } };
        r++;
      });
    }

    // Footer
    r += 2;
    ws.mergeCells(`A${r}:H${r}`);
    ws.getCell(`A${r}`).value =
      `Documento generado electrónicamente el ${formatFechaMX(new Date())}  |  Folio: ${folio}  |  Zona horaria: ${getTzInfo().zona_horaria}  |  SIVACAD`;
    ws.getCell(`A${r}`).font = { size: 7, color: { argb: 'FF94A3B8' } };
    ws.getCell(`A${r}`).alignment = { horizontal: 'center' };

    // Ajustar columnas
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 55;
    for (let i = 3; i <= 8; i++) ws.getColumn(i).width = 15;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kardex_${folio}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('exportExcel:', error);
    if (!res.headersSent) return res.status(500).json({ ok: false, message: 'Error al exportar Excel' });
  }
};
