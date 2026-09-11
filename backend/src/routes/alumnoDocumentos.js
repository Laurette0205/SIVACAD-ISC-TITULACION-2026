'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const pool = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/auditoria');

// Storage para documentos sensibles
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/sensibles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const secureName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    cb(null, secureName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG, DOC, DOCX'), false);
  }
});

// GET — Listar documentos del alumno
router.get('/', auth, role('ALUMNO'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id_documento, tipo_documento, nombre_original, peso_bytes,
              fecha_documento, fecha_carga, estado, descripcion
       FROM documentos_sensibles
       WHERE id_alumno = (SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1)
       ORDER BY fecha_carga DESC`,
      [req.user.id_usuario]
    );
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al obtener documentos' });
  }
});

// POST — Subir documento
router.post('/', auth, role('ALUMNO'), (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, message: 'El archivo excede el límite de 10MB' });
      }
      return res.status(400).json({ ok: false, message: err.message || 'Error al subir archivo' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se proporcionó archivo' });
    }

    const { tipo_documento, fecha_documento, descripcion } = req.body;

    if (!tipo_documento || tipo_documento.trim().length === 0) {
      return res.status(400).json({ ok: false, message: 'El tipo de documento es requerido' });
    }

    const [alumnoRows] = await pool.execute(
      `SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!alumnoRows.length) {
      return res.status(404).json({ ok: false, message: 'Perfil de alumno no encontrado' });
    }

    const idAlumno = alumnoRows[0].id_alumno;
    const fileName = req.file.filename;

    const [result] = await pool.execute(
      `INSERT INTO documentos_sensibles
       (id_alumno, id_institucion, tipo_documento, nombre_original, nombre_seguro,
        mime_type, peso_bytes, fecha_documento, usuario_cargador, descripcion, ruta_segura)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idAlumno, tipo_documento.trim(), req.file.originalname, fileName,
       req.file.mimetype, req.file.size, fecha_documento || null,
       req.user.id_usuario, descripcion?.trim() || null, `/uploads/sensibles/${fileName}`]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'DOCUMENTOS',
      accion: 'DOCUMENTO_SUBIDO',
      descripcion: `Documento "${tipo_documento}" subido: ${req.file.originalname} (${req.file.size} bytes)`,
      entidad_afectada: 'documentos_sensibles',
      id_entidad: result.insertId,
      req
    });

    return res.status(201).json({
      ok: true,
      message: 'Documento subido correctamente',
      id: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al subir documento' });
  }
});

// DELETE — Eliminar documento
router.delete('/:id', auth, role('ALUMNO'), async (req, res) => {
  try {
    const [existing] = await pool.execute(
      `SELECT id_documento, nombre_original, ruta_segura
       FROM documentos_sensibles
       WHERE id_documento = ? AND id_alumno = (SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1)`,
      [req.params.id, req.user.id_usuario]
    );

    if (!existing.length) {
      return res.status(404).json({ ok: false, message: 'Documento no encontrado' });
    }

    // Eliminar archivo físico
    const filePath = path.join(__dirname, '../..', existing[0].ruta_segura);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.execute(
      `DELETE FROM documentos_sensibles WHERE id_documento = ?`,
      [req.params.id]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      modulo: 'DOCUMENTOS',
      accion: 'DOCUMENTO_ELIMINADO',
      descripcion: `Documento "${existing[0].nombre_original}" eliminado`,
      entidad_afectada: 'documentos_sensibles',
      id_entidad: Number(req.params.id),
      req
    });

    return res.json({ ok: true, message: 'Documento eliminado' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error al eliminar documento' });
  }
});

module.exports = router;
