// backend/src/controllers/kardex.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../config/db');

function getBaseUrl(req) {
  const fallback = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return String(fallback).replace(/\/$/, '');
}

function publicUrl(req, relativePath) {
  if (!relativePath) return null;

  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath;
  }

  const base = getBaseUrl(req);
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${cleanPath}`;
}

function toPublicKardexAlumno(req, row) {
  if (!row) return null;

  const nombreCompleto = `${row.nombres || ''} ${row.apellido_paterno || ''} ${row.apellido_materno || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  const fotografiaRel = row.fotografia || row.foto_alumno || null;
  const qrRel = row.url_qr || null;

  return {
    id_kardex: row.id_kardex,
    id_alumno: row.id_alumno,
    id_usuario: row.id_usuario,
    nombre: row.nombres || '',
    apellidos: `${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim(),
    nombre_completo: nombreCompleto,
    nombres: row.nombres || '',
    apellido_paterno: row.apellido_paterno || '',
    apellido_materno: row.apellido_materno || '',
    matricula: row.matricula || '',
    curp: row.curp || '',
    semestre_actual: row.semestre_actual || 1,
    promedio_general: row.promedio_general ?? 0,
    creditos_acumulados: row.creditos_acumulados ?? 0,
    estatus: row.estatus || row.estatus_academico || 'Vigente',
    estatus_academico: row.estatus_academico || row.estatus || 'Regular',
    fotografia_url: fotografiaRel ? publicUrl(req, fotografiaRel) : null,
    url_qr: qrRel ? publicUrl(req, qrRel) : null,
    qr_token: row.qr_token || null,
    folio_kardex: row.folio_kardex || null
  };
}

function absoluteFromRelative(relativePath) {
  if (!relativePath) return null;
  const clean = String(relativePath).replace(/^\/+/, '');
  return path.resolve(process.cwd(), clean);
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('No se pudo eliminar archivo:', filePath, error.message);
  }
}

async function writeQrImage(filePath, qrContent) {
  await QRCode.toFile(filePath, qrContent, {
    type: 'png',
    width: 520,
    margin: 1,
    errorCorrectionLevel: 'H'
  });
}

exports.getMyKardexAlumno = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        k.id_kardex,
        k.id_alumno,
        k.numero_control,
        k.foto_alumno,
        k.foto_institucional,
        k.promedio_general,
        k.creditos_acumulados,
        k.estatus,
        k.qr_token,
        k.url_qr,
        k.folio_kardex,
        k.firma_electronica,
        a.id_usuario,
        a.nombres,
        a.apellido_paterno,
        a.apellido_materno,
        a.matricula,
        a.curp,
        a.semestre_actual,
        a.fotografia,
        a.estatus_academico,
        c.nombre_carrera
      FROM kardex_alumno k
      INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      WHERE a.id_usuario = ?
      LIMIT 1`,
      [req.user.id_usuario]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró kardex para el alumno autenticado'
      });
    }

    const kardex = toPublicKardexAlumno(req, rows[0]);
    kardex.nombre_carrera = rows[0].nombre_carrera || null;
    kardex.folio_kardex = rows[0].folio_kardex || null;
    kardex.estatus_academico = rows[0].estatus_academico || rows[0].estatus || 'Vigente';
    kardex.foto_institucional = rows[0].foto_institucional
      ? publicUrl(req, rows[0].foto_institucional) : null;

    const [historial] = await pool.execute(
      `SELECT
        kh.id_historial, kh.calificacion, kh.creditos, kh.tipo_materia, kh.estado AS estado_materia,
        kh.observaciones, kh.creado_en,
        p.nombre_periodo,
        m.clave_materia, m.nombre_materia, m.semestre_sugerido
      FROM kardex_historial_academico kh
      LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
      LEFT JOIN materias m ON m.id_materia = kh.id_materia
      WHERE kh.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.semestre_sugerido
      `,
      [rows[0].id_alumno]
    );

    const totalMaterias = historial.length;
    const acreditadas = historial.filter(h => h.estado_materia === 'Acreditada').length;
    const noAcreditadas = historial.filter(h => h.estado_materia === 'No Acreditada').length;
    const extraordinarios = historial.filter(h => h.tipo_materia === 'Extraordinario').length;

    return res.json({
      ok: true,
      data: {
        ...kardex,
        resumen: {
          totalMaterias,
          acreditadas,
          noAcreditadas,
          extraordinarios,
          creditosAcumulados: rows[0].creditos_acumulados || 0
        },
        historial
      }
    });
  } catch (error) {
    console.error('getMyKardexAlumno:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible cargar el kardex del alumno'
    });
  }
};

exports.getKardexAlumno = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'ID de alumno inválido'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
        k.id_kardex,
        k.id_alumno,
        k.numero_control,
        k.foto_alumno,
        k.promedio_general,
        k.creditos_acumulados,
        k.estatus,
        k.qr_token,
        k.url_qr,
        a.id_usuario,
        a.nombres,
        a.apellido_paterno,
        a.apellido_materno,
        a.matricula,
        a.curp,
        a.semestre_actual,
        a.fotografia
      FROM kardex_alumno k
      INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
      WHERE a.id_alumno = ? OR a.id_usuario = ?
      LIMIT 1`,
      [id, id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el kardex del alumno'
      });
    }

    return res.json({
      ok: true,
      data: toPublicKardexAlumno(req, rows[0])
    });
  } catch (error) {
    console.error('getKardexAlumno:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible cargar el kardex del alumno'
    });
  }
};

exports.uploadAlumnoPhoto = async (req, res) => {
  let oldFilePath = null;

  try {
    const id = Number(req.params.id);

    if (!id) {
      if (req.file?.path) safeUnlink(req.file.path);
      return res.status(400).json({
        ok: false,
        message: 'ID de alumno inválido'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No se recibió una imagen válida'
      });
    }

    const [alumnoRows] = await pool.execute(
      `SELECT id_alumno, fotografia
       FROM alumnos
       WHERE id_alumno = ?
       LIMIT 1`,
      [id]
    );

    if (!alumnoRows.length) {
      safeUnlink(req.file.path);
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el alumno'
      });
    }

    const alumno = alumnoRows[0];
    oldFilePath = absoluteFromRelative(alumno.fotografia);

    const relativePath = `/uploads/alumnos/${req.file.filename}`;

    await pool.execute(
      `UPDATE alumnos
       SET fotografia = ?
       WHERE id_alumno = ?`,
      [relativePath, id]
    );

    await pool.execute(
      `UPDATE kardex_alumno
       SET foto_alumno = ?
       WHERE id_alumno = ?`,
      [relativePath, id]
    );

    safeUnlink(oldFilePath);

    const [rows] = await pool.execute(
      `SELECT
        k.id_kardex,
        k.id_alumno,
        k.numero_control,
        k.foto_alumno,
        k.promedio_general,
        k.creditos_acumulados,
        k.estatus,
        k.qr_token,
        k.url_qr,
        a.id_usuario,
        a.nombres,
        a.apellido_paterno,
        a.apellido_materno,
        a.matricula,
        a.curp,
        a.semestre_actual,
        a.fotografia
      FROM kardex_alumno k
      INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
      WHERE a.id_alumno = ?
      LIMIT 1`,
      [id]
    );

    return res.json({
      ok: true,
      message:
        'Fotografía institucional actualizada correctamente. Solo se aceptan imágenes tomadas por Control Escolar. No se permiten selfies, filtros, Photoshop ni fotos para redes sociales.',
      data: toPublicKardexAlumno(req, rows[0])
    });
  } catch (error) {
    console.error('uploadAlumnoPhoto:', error);

    if (req.file?.path) {
      safeUnlink(req.file.path);
    }

    return res.status(500).json({
      ok: false,
      message: 'No fue posible actualizar la fotografía del alumno'
    });
  }
};

exports.getKardexGrupo = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'ID de grupo inválido'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
        g.id_grupo,
        g.nombre_grupo,
        g.semestre,
        g.turno,
        g.estado,
        p.nombre_periodo,
        p.estado AS estado_periodo
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      WHERE g.id_grupo = ?
      LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el grupo'
      });
    }

    const [alumnos] = await pool.execute(
      `SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        k.estatus AS estatus_kardex
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO'
      ORDER BY a.apellido_paterno, a.apellido_materno`,
      [id]
    );

    const [qrRows] = await pool.execute(
      `SELECT url_qr, qr_token
       FROM kardex_grupo_qr
       WHERE id_grupo = ?
       ORDER BY id_kardex_grupo DESC
       LIMIT 1`,
      [id]
    );

    const url_qr = qrRows.length ? publicUrl(req, qrRows[0].url_qr) : null;

    return res.json({
      ok: true,
      data: {
        id_grupo: rows[0].id_grupo,
        nombre_grupo: rows[0].nombre_grupo,
        semestre: rows[0].semestre,
        turno: rows[0].turno,
        estado: rows[0].estado,
        nombre_periodo: rows[0].nombre_periodo,
        estado_periodo: rows[0].estado_periodo,
        alumnos,
        url_qr
      }
    });
  } catch (error) {
    console.error('getKardexGrupo:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible cargar el kardex del grupo'
    });
  }
};

exports.generateQrAlumno = async (req, res) => {
  let previousQrPath = null;

  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'ID de alumno inválido'
      });
    }

    const [rows] = await pool.execute(
      `SELECT a.id_alumno, a.nombres, a.apellido_paterno, a.apellido_materno, k.url_qr
       FROM alumnos a
       INNER JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
       WHERE a.id_alumno = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el alumno'
      });
    }

    previousQrPath = absoluteFromRelative(rows[0].url_qr);

    const token = crypto.randomUUID();
    const baseUrl = getBaseUrl(req);
    const qrContent = `${baseUrl}/api/kardex/alumno/${id}`;

    const relativePath = `/uploads/qrs/alumno-${id}-${Date.now()}.png`;
    const absolutePath = absoluteFromRelative(relativePath);

    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await writeQrImage(absolutePath, qrContent);

    await pool.execute(
      `UPDATE kardex_alumno
       SET qr_token = ?, url_qr = ?
       WHERE id_alumno = ?`,
      [token, relativePath, id]
    );

    safeUnlink(previousQrPath);

    return res.json({
      ok: true,
      message: 'QR institucional del alumno generado correctamente',
      data: {
        qr_token: token,
        url_qr: publicUrl(req, relativePath)
      }
    });
  } catch (error) {
    console.error('generateQrAlumno:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible generar el QR del alumno'
    });
  }
};

exports.generateQrGrupo = async (req, res) => {
  let previousQrPath = null;

  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'ID de grupo inválido'
      });
    }

    const [grupoRows] = await pool.execute(
      `SELECT g.id_grupo, g.id_periodo, g.nombre_grupo
       FROM grupos g
       WHERE g.id_grupo = ?
       LIMIT 1`,
      [id]
    );

    if (!grupoRows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el grupo'
      });
    }

    const [existingRows] = await pool.execute(
      `SELECT qr_token, url_qr
       FROM kardex_grupo_qr
       WHERE id_grupo = ?
       LIMIT 1`,
      [id]
    );

    previousQrPath = absoluteFromRelative(existingRows[0]?.url_qr || null);

    const token = crypto.randomUUID();
    const baseUrl = getBaseUrl(req);
    const qrContent = `${baseUrl}/api/kardex/grupo/${id}`;

    const relativePath = `/uploads/qrs/grupo-${id}-${Date.now()}.png`;
    const absolutePath = absoluteFromRelative(relativePath);

    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await writeQrImage(absolutePath, qrContent);

    if (existingRows.length) {
      await pool.execute(
        `UPDATE kardex_grupo_qr
         SET qr_token = ?, url_qr = ?
         WHERE id_grupo = ?`,
        [token, relativePath, id]
      );
    } else {
      await pool.execute(
        `INSERT INTO kardex_grupo_qr
         (id_grupo, id_periodo, qr_token, url_qr, generado_por)
         VALUES (?, ?, ?, ?, ?)`,
        [id, grupoRows[0].id_periodo, token, relativePath, req.user.id_usuario]
      );
    }

    safeUnlink(previousQrPath);

    return res.json({
      ok: true,
      message: 'QR institucional del grupo generado correctamente',
      data: {
        qr_token: token,
        url_qr: publicUrl(req, relativePath)
      }
    });
  } catch (error) {
    console.error('generateQrGrupo:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible generar el QR del grupo'
    });
  }
};
exports.deleteAlumnoPhoto = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'ID de alumno inválido'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
        a.fotografia,
        k.foto_alumno
       FROM alumnos a
       INNER JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
       WHERE a.id_alumno = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontró el alumno'
      });
    }

    const currentPhoto = rows[0].fotografia || rows[0].foto_alumno || null;

    if (currentPhoto) {
      const oldAbs = absoluteFromRelative(currentPhoto);
      safeUnlink(oldAbs);
    }

    await pool.execute(
      `UPDATE alumnos
       SET fotografia = NULL
       WHERE id_alumno = ?`,
      [id]
    );

    await pool.execute(
      `UPDATE kardex_alumno
       SET foto_alumno = NULL
       WHERE id_alumno = ?`,
      [id]
    );

    return res.json({
      ok: true,
      message: 'Fotografía institucional eliminada correctamente. El kardex permanece intacto.',
      data: {
        fotografia_url: null
      }
    });
  } catch (error) {
    console.error('deleteAlumnoPhoto:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible eliminar la fotografía institucional'
    });
  }
};