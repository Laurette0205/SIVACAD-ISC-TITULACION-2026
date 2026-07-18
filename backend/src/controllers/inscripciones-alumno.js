const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const DOCS_DIR = path.join(UPLOADS_ROOT, 'documentos');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function getIdAlumnoByUserId(conn, id_usuario) {
  const [rows] = await conn.execute(
    `SELECT id_alumno, matricula, id_carrera, id_plan,
            CONCAT(nombres, ' ', apellido_paterno, ' ', apellido_materno) AS nombre_completo
     FROM alumnos WHERE id_usuario = ? LIMIT 1`,
    [id_usuario]
  );
  return rows[0] || null;
}

exports.getMiInformacion = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const id_usuario = req.user?.id_usuario;

    const alumno = await getIdAlumnoByUserId(conn, id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [periodos] = await conn.execute(
      `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado
       FROM periodos WHERE estado = 'Activo' ORDER BY id_periodo DESC LIMIT 1`
    );

    const [inscripciones] = await conn.execute(
      `SELECT i.id_inscripcion, i.id_periodo, p.nombre_periodo,
              i.tipo_inscripcion, i.estado, i.observaciones,
              i.motivo_rechazo, i.fecha_inscripcion, i.actualizado_en,
              i.fecha_validacion, i.id_grupo, g.nombre_grupo,
              i.comprobante_pago
       FROM inscripciones i
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
       WHERE i.id_alumno = ?
       ORDER BY i.fecha_inscripcion DESC`,
      [alumno.id_alumno]
    );

    return res.json({
      ok: true,
      data: {
        alumno,
        periodoActivo: periodos[0] || null,
        inscripciones
      }
    });
  } catch (error) {
    console.error('Error al obtener informacion del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener informacion' });
  } finally {
    if (conn) conn.release();
  }
};

exports.solicitarInscripcion = async (req, res) => {
  let conn;
  try {
    const { id_periodo, tipo_inscripcion } = req.body;
    conn = await pool.getConnection();

    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let periodoFinal = id_periodo;
    if (!periodoFinal) {
      const [periodos] = await conn.execute(
        `SELECT id_periodo FROM periodos WHERE estado = 'Activo' ORDER BY id_periodo DESC LIMIT 1`
      );
      if (!periodos[0]) {
        return res.status(400).json({ ok: false, message: 'No hay un periodo activo disponible' });
      }
      periodoFinal = periodos[0].id_periodo;
    }

    const [duplicado] = await conn.execute(
      `SELECT id_inscripcion, estado FROM inscripciones
       WHERE id_alumno = ? AND id_periodo = ? LIMIT 1`,
      [alumno.id_alumno, periodoFinal]
    );

    if (duplicado.length) {
      return res.json({
        ok: true,
        message: 'Ya tienes una solicitud para este periodo',
        data: duplicado[0]
      });
    }

    const tipo = tipo_inscripcion === 'Reinscripcion' ? 'Reinscripcion' : 'Primera_Vez';

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO inscripciones (id_alumno, id_periodo, fecha_inscripcion, tipo_inscripcion, estado, observaciones)
       VALUES (?, ?, NOW(), ?, 'Pendiente', 'Solicitud registrada por el alumno')`,
      [alumno.id_alumno, periodoFinal, tipo]
    );

    await conn.execute(
      `INSERT INTO inscripciones_auditoria (id_inscripcion, id_usuario, accion, detalle, estado_anterior, estado_nuevo)
       VALUES (?, ?, 'CREAR', 'Solicitud creada por el alumno desde autoservicio', NULL, 'Pendiente')`,
      [result.insertId, req.user?.id_usuario]
    );

    await conn.commit();

    return res.status(201).json({
      ok: true,
      message: 'Solicitud de inscripcion registrada correctamente',
      data: { id_inscripcion: result.insertId, estado: 'Pendiente' }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error al solicitar inscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar la solicitud' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getMiEstatus = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [inscripciones] = await conn.execute(
      `SELECT i.id_inscripcion, i.id_periodo, p.nombre_periodo,
              i.tipo_inscripcion, i.estado, i.observaciones,
              i.motivo_rechazo, i.fecha_inscripcion, i.actualizado_en,
              i.fecha_validacion, i.id_grupo, g.nombre_grupo,
              i.comprobante_pago, i.fecha_comprobante,
              c.nombre_carrera,
              (SELECT COUNT(*) FROM documentos_inscripcion d WHERE d.id_inscripcion = i.id_inscripcion) AS documentos_subidos
       FROM inscripciones i
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
       LEFT JOIN carreras c ON c.id_carrera = i.id_carrera
       WHERE i.id_alumno = ?
       ORDER BY i.fecha_inscripcion DESC
       LIMIT 20`,
      [alumno.id_alumno]
    );

    const totalDocs = 5;

    const estatusConDocs = inscripciones.map(ins => ({
      ...ins,
      documentos_requeridos: totalDocs,
      documentos_completos: ins.documentos_subidos >= totalDocs
    }));

    return res.json({
      ok: true,
      data: estatusConDocs
    });
  } catch (error) {
    console.error('Error al obtener estatus:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener estatus' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getDocumentosRequeridos = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const tiposDocumento = [
      { tipo: 'Acta_Nacimiento', nombre: 'Acta de Nacimiento', required: true },
      { tipo: 'CURP', nombre: 'CURP', required: true },
      { tipo: 'Comprobante_Domicilio', nombre: 'Comprobante de Domicilio', required: true },
      { tipo: 'Certificado', nombre: 'Certificado de Estudios', required: true },
      { tipo: 'Foto', nombre: 'Fotografia Tamaño Infantil', required: true }
    ];

    const [documentos] = await conn.execute(
      `SELECT d.id_documento, d.id_inscripcion, d.tipo_documento,
              d.nombre_archivo, d.estado, d.observaciones, d.subido_en
       FROM documentos_inscripcion d
       WHERE d.id_alumno = ?
       ORDER BY d.subido_en DESC`,
      [alumno.id_alumno]
    );

    const [inscripciones] = await conn.execute(
      `SELECT i.id_inscripcion, i.id_periodo, p.nombre_periodo, i.estado
       FROM inscripciones i
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       WHERE i.id_alumno = ?
       ORDER BY i.fecha_inscripcion DESC
       LIMIT 5`,
      [alumno.id_alumno]
    );

    const docsPorTipo = tiposDocumento.map(td => ({
      ...td,
      subido: documentos.filter(d => d.tipo_documento === td.tipo),
      estado: documentos.filter(d => d.tipo_documento === td.tipo && d.estado === 'Aprobado').length > 0 ? 'Completo' :
              documentos.filter(d => d.tipo_documento === td.tipo).length > 0 ? 'Subido' : 'Pendiente'
    }));

    return res.json({
      ok: true,
      data: {
        tiposDocumento: docsPorTipo,
        documentos,
        inscripciones
      }
    });
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener documentos' });
  } finally {
    if (conn) conn.release();
  }
};

exports.subirDocumento = async (req, res) => {
  let conn;
  try {
    const { id_inscripcion, tipo_documento } = req.body;

    if (!tipo_documento) {
      return res.status(400).json({ ok: false, message: 'El tipo de documento es obligatorio' });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe seleccionar un archivo' });
    }

    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let idPeriodo = null;
    if (id_inscripcion) {
      const [ins] = await conn.execute(
        `SELECT id_periodo FROM inscripciones WHERE id_inscripcion = ? AND id_alumno = ? LIMIT 1`,
        [Number(id_inscripcion), alumno.id_alumno]
      );
      if (!ins.length) {
        return res.status(404).json({ ok: false, message: 'Inscripcion no encontrada' });
      }
      idPeriodo = ins[0].id_periodo;
    } else {
      const [periodos] = await conn.execute(
        `SELECT id_periodo FROM periodos WHERE estado = 'Activo' ORDER BY id_periodo DESC LIMIT 1`
      );
      idPeriodo = periodos[0]?.id_periodo;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeName = `doc_${alumno.id_alumno}_${tipo_documento}_${Date.now()}${ext}`;
    const destPath = path.join(DOCS_DIR, safeName);

    fs.renameSync(req.file.path, destPath);

    const relativePath = `uploads/documentos/${safeName}`;

    await conn.execute(
      `INSERT INTO documentos_inscripcion
        (id_inscripcion, id_alumno, id_periodo, tipo_documento, nombre_archivo, ruta_archivo, mime_type, tamano_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_inscripcion ? Number(id_inscripcion) : null,
        alumno.id_alumno,
        idPeriodo,
        tipo_documento,
        req.file.originalname,
        relativePath,
        req.file.mimetype,
        req.file.size
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Documento subido correctamente',
      data: { ruta: relativePath, nombre: req.file.originalname }
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    return res.status(500).json({ ok: false, message: 'Error al subir el documento' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getMiHistorial = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [auditoria] = await conn.execute(
      `SELECT a.id_auditoria, a.id_inscripcion, a.accion, a.detalle,
              a.estado_anterior, a.estado_nuevo, a.creado_en,
              CONCAT(u.nombres, ' ', u.apellido_paterno) AS usuario_nombre,
              r.nombre_rol AS usuario_rol
       FROM inscripciones_auditoria a
       INNER JOIN inscripciones i ON i.id_inscripcion = a.id_inscripcion
       LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
       LEFT JOIN roles r ON r.id_rol = u.id_rol
       WHERE i.id_alumno = ?
       ORDER BY a.creado_en DESC
       LIMIT 100`,
      [alumno.id_alumno]
    );

    const incs = await conn.execute(
      `SELECT i.id_inscripcion, i.id_periodo, p.nombre_periodo,
              i.tipo_inscripcion, i.estado, i.fecha_inscripcion, i.actualizado_en
       FROM inscripciones i
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       WHERE i.id_alumno = ?
       ORDER BY i.fecha_inscripcion DESC`,
      [alumno.id_alumno]
    );

    return res.json({
      ok: true,
      data: {
        historial: auditoria[0] || [],
        inscripciones: incs[0] || []
      }
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  } finally {
    if (conn) conn.release();
  }
};

exports.descargarComprobante = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();

    const alumno = await getIdAlumnoByUserId(conn, req.user?.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [rows] = await conn.execute(
      `SELECT i.id_inscripcion, i.comprobante_pago, i.fecha_comprobante,
              i.tipo_inscripcion, i.estado, i.fecha_inscripcion,
              p.nombre_periodo,
              CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS alumno_nombre,
              a.matricula, c.nombre_carrera
       FROM inscripciones i
       INNER JOIN alumnos a ON a.id_alumno = i.id_alumno
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, a.id_carrera)
       WHERE i.id_inscripcion = ? AND i.id_alumno = ?
       LIMIT 1`,
      [Number(id), alumno.id_alumno]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Inscripcion no encontrada' });
    }

    const ins = rows[0];

    const PDFDocument = require('pdfkit');
    const PDFDoc = new PDFDocument({
      size: 'letter',
      margin: 50,
      info: {
        Title: `Comprobante de Inscripcion #${ins.id_inscripcion}`,
        Author: 'SIVACAD',
        Subject: 'Comprobante de Inscripcion'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=comprobante_${ins.id_inscripcion}.pdf`);

    PDFDoc.pipe(res);

    PDFDoc.fontSize(20).font('Helvetica-Bold').text('SIVACAD', { align: 'center' });
    PDFDoc.fontSize(12).font('Helvetica').text('Sistema Integral de Validacion y Control Academico', { align: 'center' });
    PDFDoc.moveDown(0.5);
    PDFDoc.fontSize(10).text('COMPROBANTE DE INSCRIPCION', { align: 'center' });
    PDFDoc.moveDown(0.3);

    PDFDoc.fontSize(9).fillColor('#64748b').text(
      `Fecha de emision: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      { align: 'center' }
    );
    PDFDoc.moveDown(0.8);

    PDFDoc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, PDFDoc.y).lineTo(562, PDFDoc.y).stroke();
    PDFDoc.moveDown(0.5);

    PDFDoc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('DATOS DEL ALUMNO');
    PDFDoc.moveDown(0.3);
    PDFDoc.fontSize(10).font('Helvetica').fillColor('#334155');
    PDFDoc.text(`Nombre: ${ins.alumno_nombre}`);
    PDFDoc.text(`Matricula: ${ins.matricula}`);
    PDFDoc.text(`Carrera: ${ins.nombre_carrera || '—'}`);
    PDFDoc.moveDown(0.5);

    PDFDoc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('DATOS DE LA INSCRIPCION');
    PDFDoc.moveDown(0.3);
    PDFDoc.fontSize(10).font('Helvetica').fillColor('#334155');
    PDFDoc.text(`Folio: #${ins.id_inscripcion}`);
    PDFDoc.text(`Periodo: ${ins.nombre_periodo}`);
    PDFDoc.text(`Tipo: ${ins.tipo_inscripcion === 'Primera_Vez' ? 'Primera Vez' : 'Reinscripcion'}`);
    PDFDoc.text(`Estado: ${ins.estado}`);
    PDFDoc.text(`Fecha de registro: ${new Date(ins.fecha_inscripcion).toLocaleDateString('es-MX')}`);
    if (ins.comprobante_pago) {
      PDFDoc.text(`Comprobante de pago: Adjunto`);
    }
    PDFDoc.moveDown(0.5);

    PDFDoc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, PDFDoc.y).lineTo(562, PDFDoc.y).stroke();
    PDFDoc.moveDown(0.5);

    PDFDoc.fontSize(8).fillColor('#94a3b8').text(
      'Este documento es un comprobante informativo generado por el sistema SIVACAD. ' +
      'No es un documento oficial hasta ser validado por la institucion.',
      { align: 'center', width: 460 }
    );

    PDFDoc.end();
  } catch (error) {
    console.error('Error al descargar comprobante:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al generar el comprobante' });
    }
  } finally {
    if (conn) conn.release();
  }
};
