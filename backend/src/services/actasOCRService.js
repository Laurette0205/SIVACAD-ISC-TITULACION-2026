const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'actas-ocr');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IS_GEMINI_VALID = GEMINI_API_KEY.startsWith('AIza');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeBase = String(file.originalname || 'acta')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    const ext = path.extname(safeBase) || '';
    const base = ext ? safeBase.slice(0, -ext.length) : safeBase;
    cb(null, `${Date.now()}-${base || 'acta'}${ext || '.png'}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    if (!allowed.has(String(file?.mimetype || '').toLowerCase())) {
      return cb(new Error('Formato no permitido. Usa imagen JPG, PNG, WEBP o PDF.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 }
});

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function extractJsonFromModel(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return safeJsonParse(fenced[1], null);
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return safeJsonParse(raw.slice(firstBrace, lastBrace + 1), null);
  }
  return safeJsonParse(raw, null);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickUserId(req) {
  return Number(req.user?.id_usuario || req.user?.id || req.headers['x-user-id'] || 0) || 1;
}

function rowToDetail(row) {
  return {
    matricula: String(row.matricula || row.id_alumno || '').trim().toUpperCase(),
    nombre_completo: String(row.nombre_completo || row.nombre || row.alumno || `${row.nombres || ''} ${row.apellido_paterno || ''} ${row.apellido_materno || ''}`).replace(/\s+/g, ' ').trim(),
    calificacion: toNumber(row.calificacion ?? row.nota ?? row.valor ?? 0, 0),
    observaciones: String(row.observaciones || '').trim()
  };
}

function normalizeExtractionPayload(payload) {
  const obj = payload && typeof payload === 'object' ? payload : {};
  const alumnoRows = Array.isArray(obj.alumnos) ? obj.alumnos
    : Array.isArray(obj.detalle) ? obj.detalle
    : Array.isArray(obj.rows) ? obj.rows
    : Array.isArray(obj.registros) ? obj.registros : [];
  return {
    cabecera: {
      periodo: String(obj.periodo || obj.nombre_periodo || '').trim(),
      grupo: String(obj.grupo || obj.nombre_grupo || '').trim(),
      materia: String(obj.materia || obj.nombre_materia || '').trim(),
      docente: String(obj.docente || obj.nombre_docente || '').trim(),
      observaciones: String(obj.observaciones || '').trim()
    },
    firma_detectada: Boolean(obj.firma_detectada || obj.signature_detected || obj.tiene_firma || false),
    firma_coincide: Boolean(obj.firma_coincide || obj.signature_matches || obj.coincide_firma || false),
    confianza_global: toNumber(obj.confianza_global ?? obj.confidence ?? obj.confianza ?? 0, 0),
    alumnos: alumnoRows.map(rowToDetail)
  };
}

async function callGeminiOCR({ filePath, mimeType, fileName, prompt }) {
  if (!IS_GEMINI_VALID) throw new Error('GEMINI_API_KEY no está configurada.');
  const fileBuffer = await fsp.readFile(filePath);
  const base64Data = fileBuffer.toString('base64');
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
    generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: 4096, responseMimeType: 'application/json' }
  };
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || 'Error en Gemini.');
  const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('\n').trim() || '';
  const parsed = extractJsonFromModel(rawText);
  if (!parsed) throw new Error('Gemini no devolvió JSON válido.');
  return { modelo: GEMINI_MODEL, rawText, parsed };
}

async function getResumen() {
  const [[totales]] = await pool.execute(`
    SELECT COUNT(*) AS total_cargas,
      SUM(CASE WHEN estado = 'VALIDADA' THEN 1 ELSE 0 END) AS validadas,
      SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas,
      SUM(CASE WHEN estado IN ('RECIBIDA','EXTRACCION_PENDIENTE','VALIDACION_PENDIENTE') THEN 1 ELSE 0 END) AS pendientes,
      AVG(NULLIF(confianza_global, 0)) AS confianza_promedio,
      MAX(updated_at) AS ultima_revision
    FROM actas_ocr_cargas
  `);
  const [[importados]] = await pool.execute(`SELECT COUNT(*) AS total FROM actas_calificaciones_detalle`).catch(() => [[{ total: 0 }]]);
  return {
    total_cargas: Number(totales?.total_cargas || 0),
    validadas: Number(totales?.validadas || 0),
    rechazadas: Number(totales?.rechazadas || 0),
    pendientes: Number(totales?.pendientes || 0),
    confianza_promedio: Number(totales?.confianza_promedio || 0),
    ultima_revision: totales?.ultima_revision || null,
    total_detalles_importados: Number(importados?.total || 0)
  };
}

async function getCatalogos() {
  const [plantillas] = await pool.execute(`SELECT * FROM actas_ocr_plantillas WHERE activo = 1 ORDER BY orden_visual ASC, id_plantilla_ocr ASC`);
  const [periodos] = await pool.execute(`SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado FROM periodos ORDER BY id_periodo DESC`);
  const [grupos] = await pool.execute(`SELECT g.*, p.nombre_periodo, c.nombre_carrera FROM grupos g INNER JOIN periodos p ON p.id_periodo = g.id_periodo INNER JOIN carreras c ON c.id_carrera = g.id_carrera ORDER BY g.id_grupo DESC`);
  const [materias] = await pool.execute(`SELECT id_materia, clave_materia, nombre_materia, creditos, semestre_sugerido FROM materias ORDER BY id_materia ASC`);
  const [docentes] = await pool.execute(`SELECT d.*, u.nombres, u.apellido_paterno, u.apellido_materno FROM docentes d INNER JOIN usuarios u ON u.id_usuario = d.id_usuario ORDER BY d.id_docente DESC`);
  const [firmas] = await pool.execute(`SELECT f.*, u.nombres, u.apellido_paterno, u.apellido_materno FROM docentes_firmas_registradas f INNER JOIN docentes d ON d.id_docente = f.id_docente INNER JOIN usuarios u ON u.id_usuario = d.id_usuario WHERE f.activo = 1 ORDER BY f.id_firma DESC`).catch(() => []);
  return { plantillas, periodos, grupos, materias, docentes, firmas };
}

async function listCargas(limit = 50, offset = 0, estado = null) {
  let sql = `SELECT c.*, p.nombre_plantilla, p.codigo_plantilla, per.nombre_periodo, g.nombre_grupo, m.nombre_materia, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr LEFT JOIN periodos per ON per.id_periodo = c.id_periodo LEFT JOIN grupos g ON g.id_grupo = c.id_grupo LEFT JOIN materias m ON m.id_materia = c.id_materia INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga`;
  const params = [];
  if (estado) {
    sql += ` WHERE c.estado = ?`;
    params.push(estado);
  }
  sql += ` ORDER BY c.id_carga_ocr DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const [rows] = await pool.execute(sql, params);
  const ids = rows.map(r => r.id_carga_ocr);
  const detailsMap = new Map();
  if (ids.length) {
    const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr IN (${ids.map(() => '?').join(',')}) ORDER BY id_detalle_ocr ASC`, ids);
    details.forEach(d => {
      if (!detailsMap.has(d.id_carga_ocr)) detailsMap.set(d.id_carga_ocr, []);
      detailsMap.get(d.id_carga_ocr).push(d);
    });
  }
  return rows.map(row => ({
    ...row,
    json_resultado: safeJsonParse(row.json_resultado, null),
    detalles: detailsMap.get(row.id_carga_ocr) || []
  }));
}

async function getCargaById(id) {
  const [rows] = await pool.execute(`SELECT c.*, p.nombre_plantilla, p.codigo_plantilla, per.nombre_periodo, g.nombre_grupo, m.nombre_materia, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr LEFT JOIN periodos per ON per.id_periodo = c.id_periodo LEFT JOIN grupos g ON g.id_grupo = c.id_grupo LEFT JOIN materias m ON m.id_materia = c.id_materia INNER JOIN usuarios u ON u.id_usuario = c.id_usuario_carga WHERE c.id_carga_ocr = ? LIMIT 1`, [id]);
  if (!rows.length) return null;
  const [details] = await pool.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr = ? ORDER BY id_detalle_ocr ASC`, [id]);
  return { ...rows[0], json_resultado: safeJsonParse(rows[0].json_resultado, null), detalles: details };
}

async function subirActa({ body, file, userId }) {
  const conn = await pool.getConnection();
  try {
    const { id_plantilla_ocr, codigo_plantilla, id_periodo, id_grupo = null, id_materia = null, id_docente = null, regla_manual = '' } = body;
    if (!file) throw Object.assign(new Error('Debes adjuntar una imagen o PDF del acta.'), { status: 400 });

    const plantillaCode = String(codigo_plantilla || '').trim().toUpperCase();
    let plantillaId = Number(id_plantilla_ocr || 0);
    if (!plantillaId && plantillaCode) {
      const [plantillas] = await conn.execute(`SELECT id_plantilla_ocr FROM actas_ocr_plantillas WHERE codigo_plantilla = ? AND activo = 1 LIMIT 1`, [plantillaCode]);
      if (!plantillas.length) throw Object.assign(new Error('La plantilla seleccionada no existe o está inactiva.'), { status: 400 });
      plantillaId = plantillas[0].id_plantilla_ocr;
    }
    if (!plantillaId) throw Object.assign(new Error('Debes seleccionar una plantilla OCR válida.'), { status: 400 });

    const [plantillasCheck] = await conn.execute(`SELECT * FROM actas_ocr_plantillas WHERE id_plantilla_ocr = ? AND activo = 1 LIMIT 1`, [plantillaId]);
    if (!plantillasCheck.length) throw Object.assign(new Error('La plantilla OCR no está disponible.'), { status: 400 });

    const plantilla = plantillasCheck[0];
    const uploadedPath = file.filename;
    const fullPath = path.join(UPLOAD_DIR, uploadedPath);

    const prompt = `Eres un sistema OCR institucional para actas de calificaciones. Extrae los datos del documento y responde SOLO JSON válido, sin markdown. Necesito esta estructura exacta: { "cabecera": { "periodo": "", "grupo": "", "materia": "", "docente": "", "observaciones": "" }, "firma_detectada": true, "firma_coincide": false, "confianza_global": 0.0, "alumnos": [ { "matricula": "", "nombre_completo": "", "calificacion": 0, "observaciones": "" } ] } Reglas: - Conserva la calificación como número. - Si no puedes leer un dato, usa cadena vacía o 0. - Devuelve el JSON limpio, sin explicaciones adicionales. - El archivo es: ${file.originalname} - Plantilla activa: ${plantilla.nombre_plantilla} - Regla institucional: ${String(regla_manual || '').trim()}`.trim();

    let extraction;
    try { extraction = await callGeminiOCR({ filePath: fullPath, mimeType: file.mimetype, fileName: file.originalname, prompt }); }
    catch (ocrError) { throw Object.assign(new Error(ocrError?.message || 'No fue posible leer el acta.'), { status: 502 }); }

    const normalized = normalizeExtractionPayload(extraction.parsed);
    await conn.beginTransaction();

    const [insertResult] = await conn.execute(`INSERT INTO actas_ocr_cargas (id_plantilla_ocr, id_periodo, id_grupo, id_materia, id_docente, id_usuario_carga, nombre_archivo, mime_type, storage_path, estado, confianza_global, firma_detectada, firma_coincide, json_resultado, texto_extraido, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALIDACION_PENDIENTE', ?, ?, ?, ?, ?, NOW())`, [plantillaId, Number(id_periodo || 0) || null, id_grupo ? Number(id_grupo) : null, id_materia ? Number(id_materia) : null, id_docente ? Number(id_docente) : null, userId, file.originalname, file.mimetype, uploadedPath, normalized.confianza_global || 0, normalized.firma_detectada ? 1 : 0, normalized.firma_coincide ? 1 : 0, JSON.stringify({ ...normalized, modelo: extraction.modelo }), extraction.rawText || null]);

    const cargaId = insertResult.insertId;
    for (const alumno of normalized.alumnos) {
      await conn.execute(`INSERT INTO actas_ocr_detalles (id_carga_ocr, matricula, nombre_completo, calificacion, observaciones, validado, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())`, [cargaId, alumno.matricula, alumno.nombre_completo, alumno.calificacion, alumno.observaciones || null]);
    }
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'EXTRACCION_OCR', ?, NOW())`, [cargaId, userId, JSON.stringify({ archivo: file.originalname, plantilla: plantilla.codigo_plantilla, confianza_global: normalized.confianza_global, alumnos_detectados: normalized.alumnos.length })]);
    await conn.commit();

    return { id_carga_ocr: cargaId, plantilla, archivo: { nombre: file.originalname, mime_type: file.mimetype, path: uploadedPath }, json_resultado: { ...normalized, modelo: extraction.modelo } };
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally { conn.release(); }
}

async function validarCarga(cargaId, userId) {
  const conn = await pool.getConnection();
  try {
    const [cargaRows] = await conn.execute(`SELECT c.*, p.codigo_plantilla, p.nombre_plantilla FROM actas_ocr_cargas c INNER JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr WHERE c.id_carga_ocr = ? LIMIT 1`, [cargaId]);
    if (!cargaRows.length) throw Object.assign(new Error('La carga OCR no existe.'), { status: 404 });
    const cargaRow = cargaRows[0];

    const [detalleRows] = await conn.execute(`SELECT * FROM actas_ocr_detalles WHERE id_carga_ocr = ? ORDER BY id_detalle_ocr ASC`, [cargaId]);
    const validations = [];
    const detallesValidados = [];

    for (const detalle of detalleRows) {
      const matricula = String(detalle.matricula || '').trim().toUpperCase();
      const calificacion = toNumber(detalle.calificacion, 0);

      if (!matricula) {
        validations.push({ id_detalle_ocr: detalle.id_detalle_ocr, valido: false, error: 'Matrícula vacía.' });
        detallesValidados.push({ ...detalle, id_alumno: null, validado: 0, error_validacion: 'Matrícula vacía.' });
        continue;
      }
      const [alumnoRows] = await conn.execute(`SELECT a.id_alumno, a.matricula, u.nombres, u.apellido_paterno, u.apellido_materno FROM alumnos a INNER JOIN usuarios u ON u.id_usuario = a.id_usuario WHERE a.matricula = ? LIMIT 1`, [matricula]);
      if (!alumnoRows.length) {
        validations.push({ id_detalle_ocr: detalle.id_detalle_ocr, valido: false, error: 'Matrícula no existe.' });
        detallesValidados.push({ ...detalle, id_alumno: null, validado: 0, error_validacion: 'Matrícula no existe en alumnos.' });
        continue;
      }
      const alumno = alumnoRows[0];
      let perteneceGrupo = true;
      if (cargaRow.id_grupo && cargaRow.id_periodo) {
        const [grupoRows] = await conn.execute(`SELECT 1 FROM grupos_alumnos WHERE id_grupo = ? AND id_periodo = ? AND id_alumno = ? LIMIT 1`, [cargaRow.id_grupo, cargaRow.id_periodo, alumno.id_alumno]).catch(() => []);
        perteneceGrupo = grupoRows.length > 0;
      }
      if (!perteneceGrupo) {
        validations.push({ id_detalle_ocr: detalle.id_detalle_ocr, valido: false, error: 'Alumno no pertenece al grupo/período.' });
        detallesValidados.push({ ...detalle, id_alumno: alumno.id_alumno, validado: 0, error_validacion: 'No pertenece al grupo/período.' });
        continue;
      }
      if (calificacion < 0 || calificacion > 100) {
        validations.push({ id_detalle_ocr: detalle.id_detalle_ocr, valido: false, error: 'Calificación fuera de rango.' });
        detallesValidados.push({ ...detalle, id_alumno: alumno.id_alumno, validado: 0, error_validacion: 'Calificación fuera de rango.' });
        continue;
      }
      validations.push({ id_detalle_ocr: detalle.id_detalle_ocr, valido: true, error: null });
      detallesValidados.push({ ...detalle, id_alumno: alumno.id_alumno, validado: 1, error_validacion: null });
    }

    const hasErrors = validations.some(v => !v.valido);
    await conn.beginTransaction();

    await conn.execute(`UPDATE actas_ocr_cargas SET estado = ?, observaciones_revision = ?, firma_detectada = ?, firma_coincide = ?, updated_at = NOW() WHERE id_carga_ocr = ?`, [hasErrors ? 'VALIDACION_PENDIENTE' : 'VALIDADA', hasErrors ? 'Inconsistencias detectadas; revise los detalles.' : 'Validación completada.', cargaRow.firma_detectada ? 1 : 0, cargaRow.firma_coincide ? 1 : 0, cargaId]);

    for (const d of detallesValidados) {
      await conn.execute(`UPDATE actas_ocr_detalles SET id_alumno = ?, validado = ?, error_validacion = ? WHERE id_detalle_ocr = ?`, [d.id_alumno || null, d.validado ? 1 : 0, d.error_validacion || null, d.id_detalle_ocr]);
    }

    if (!hasErrors) {
      const [actaInsert] = await conn.execute(`INSERT INTO actas_calificaciones (id_carga_ocr, id_plantilla_ocr, id_periodo, id_grupo, id_materia, id_docente, id_usuario_registro, estado, total_alumnos, observaciones, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'IMPORTADA', ?, ?, NOW())`, [cargaId, cargaRow.id_plantilla_ocr, cargaRow.id_periodo || null, cargaRow.id_grupo || null, cargaRow.id_materia || null, cargaRow.id_docente || null, userId, detallesValidados.length, 'Importación desde OCR.']);
      const actaId = actaInsert.insertId;
      for (const d of detallesValidados) {
        await conn.execute(`INSERT INTO actas_calificaciones_detalle (id_acta_calificacion, id_alumno, matricula, nombre_completo, calificacion, observaciones, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [actaId, d.id_alumno, d.matricula, d.nombre_completo, d.calificacion, d.observaciones || null]);
      }
    }

    await conn.execute(`INSERT INTO actas_ocr_validaciones (id_carga_ocr, id_usuario, resultado, comentario, creado_en) VALUES (?, ?, ?, ?, NOW())`, [cargaId, userId, hasErrors ? 'RECHAZADA' : 'APROBADA', hasErrors ? 'Requiere revisión manual.' : 'Aprobada e importada.']);

    if (!hasErrors) {
      await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'IMPORTACION_EXITOSA', ?, NOW())`, [cargaId, userId, JSON.stringify({ alumnos_validados: detallesValidados.filter(d => d.validado).length, acta_generada: true })]);
    } else {
      await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'VALIDACION_RECHAZADA', ?, NOW())`, [cargaId, userId, JSON.stringify({ errores: validations.filter(v => !v.valido).length })]);
    }

    await conn.commit();
    return { id_carga_ocr: cargaId, resultado: hasErrors ? 'RECHAZADA' : 'APROBADA', validations, detalles: detallesValidados };
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally { conn.release(); }
}

async function aprobarCarga(cargaId, userId, comentario = '') {
  const conn = await pool.getConnection();
  try {
    const carga = await getCargaById(cargaId);
    if (!carga) throw Object.assign(new Error('La carga no existe.'), { status: 404 });
    await conn.beginTransaction();
    await conn.execute(`UPDATE actas_ocr_cargas SET estado = 'VALIDADA', observaciones_revision = ?, updated_at = NOW(), reviewed_at = NOW() WHERE id_carga_ocr = ?`, [comentario || 'Aprobada por administrador.', cargaId]);
    await conn.execute(`INSERT INTO actas_ocr_validaciones (id_carga_ocr, id_usuario, resultado, comentario, creado_en) VALUES (?, ?, 'APROBADA', ?, NOW())`, [cargaId, userId, comentario || 'Aprobación manual.']);
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'APROBACION_ADMIN', ?, NOW())`, [cargaId, userId, JSON.stringify({ comentario })]);
    await conn.commit();
    return { ok: true, message: 'Carga aprobada correctamente.' };
  } catch (error) { await conn.rollback().catch(() => {}); throw error; }
  finally { conn.release(); }
}

async function rechazarCarga(cargaId, userId, comentario = '') {
  const conn = await pool.getConnection();
  try {
    const carga = await getCargaById(cargaId);
    if (!carga) throw Object.assign(new Error('La carga no existe.'), { status: 404 });
    await conn.beginTransaction();
    await conn.execute(`UPDATE actas_ocr_cargas SET estado = 'RECHAZADA', observaciones_revision = ?, updated_at = NOW(), reviewed_at = NOW() WHERE id_carga_ocr = ?`, [comentario || 'Rechazada por administrador.', cargaId]);
    await conn.execute(`INSERT INTO actas_ocr_validaciones (id_carga_ocr, id_usuario, resultado, comentario, creado_en) VALUES (?, ?, 'RECHAZADA', ?, NOW())`, [cargaId, userId, comentario || 'Rechazo manual.']);
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (?, ?, 'RECHAZO_ADMIN', ?, NOW())`, [cargaId, userId, JSON.stringify({ comentario })]);
    await conn.commit();
    return { ok: true, message: 'Carga rechazada.' };
  } catch (error) { await conn.rollback().catch(() => {}); throw error; }
  finally { conn.release(); }
}

async function getBitacora(limite = 50) {
  const [rows] = await pool.execute(`
    SELECT a.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario,
      c.nombre_archivo, c.estado AS estado_carga
    FROM actas_ocr_auditoria a
    INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
    LEFT JOIN actas_ocr_cargas c ON c.id_carga_ocr = a.id_carga_ocr
    ORDER BY a.creado_en DESC LIMIT ?
  `, [limite]);
  return rows.map(r => ({ ...r, detalle: safeJsonParse(r.detalle, null) }));
}

async function getAuditoria(limite = 50) {
  const [rows] = await pool.execute(`
    SELECT a.*,
      CONCAT(uc.nombres, ' ', uc.apellido_paterno, ' ', uc.apellido_materno) AS nombre_usuario,
      c.nombre_archivo, c.estado AS estado_carga,
      c.confianza_global, c.created_at AS carga_creada_en,
      p.nombre_plantilla, per.nombre_periodo, g.nombre_grupo, m.nombre_materia
    FROM actas_ocr_auditoria a
    INNER JOIN usuarios uc ON uc.id_usuario = a.id_usuario
    LEFT JOIN actas_ocr_cargas c ON c.id_carga_ocr = a.id_carga_ocr
    LEFT JOIN actas_ocr_plantillas p ON p.id_plantilla_ocr = c.id_plantilla_ocr
    LEFT JOIN periodos per ON per.id_periodo = c.id_periodo
    LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
    LEFT JOIN materias m ON m.id_materia = c.id_materia
    ORDER BY a.creado_en DESC LIMIT ?
  `, [limite]);
  return rows.map(r => ({ ...r, detalle: safeJsonParse(r.detalle, null) }));
}

async function getIncidencias() {
  const [rows] = await pool.execute(`
    SELECT v.*,
      CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_validador,
      c.nombre_archivo, c.estado AS estado_carga, c.confianza_global
    FROM actas_ocr_validaciones v
    INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
    INNER JOIN actas_ocr_cargas c ON c.id_carga_ocr = v.id_carga_ocr
    WHERE v.resultado IN ('RECHAZADA', 'AJUSTADA')
    ORDER BY v.creado_en DESC LIMIT 50
  `);
  return rows;
}

async function getConfiguracion() {
  const [rows] = await pool.execute(`SELECT * FROM actas_ocr_configuracion ORDER BY id_configuracion ASC`);
  const configMap = {};
  rows.forEach(r => { configMap[r.clave] = r.valor; });
  return configMap;
}

async function updateConfiguracion(clave, valor, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`INSERT INTO actas_ocr_configuracion (clave, valor, actualizado_por, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por), updated_at = NOW()`, [clave, String(valor), userId]);
    await conn.execute(`INSERT INTO actas_ocr_auditoria (id_carga_ocr, id_usuario, accion, detalle, creado_en) VALUES (0, ?, 'CONFIG_UPDATE', ?, NOW())`, [userId, JSON.stringify({ clave, valor })]);
    await conn.commit();
    return { ok: true };
  } catch (error) { await conn.rollback().catch(() => {}); throw error; }
  finally { conn.release(); }
}

module.exports = {
  upload, pickUserId, getResumen, getCatalogos, listCargas, getCargaById,
  subirActa, validarCarga, aprobarCarga, rechazarCarga,
  getBitacora, getAuditoria, getIncidencias,
  getConfiguracion, updateConfiguracion
};
