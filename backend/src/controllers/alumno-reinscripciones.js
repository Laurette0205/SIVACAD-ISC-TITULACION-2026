const pool = require('../config/db');

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

async function getIdAlumnoByUserId(conn, idUsuario) {
  const [rows] = await conn.execute(
    `SELECT id_alumno, matricula, id_carrera,
            CONCAT(nombres, ' ', apellido_paterno, ' ', apellido_materno) AS nombre_completo,
            nombres, apellido_paterno, apellido_materno
     FROM alumnos WHERE id_usuario = ? LIMIT 1`,
    [idUsuario]
  );
  return rows[0] || null;
}

async function getPeriodoActivo(conn) {
  const [rows] = await conn.execute(
    `SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin
     FROM periodos WHERE estado = 'Activo'
     ORDER BY id_periodo DESC LIMIT 1`
  );
  return rows[0] || null;
}

// =====================================================
// 1. MI INFORMACIÓN + PERIODO ACTIVO
// =====================================================
exports.getMiInformacion = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }
    const periodoActivo = await getPeriodoActivo(conn);

    const [reinscripcionesActivas] = await conn.execute(
      `SELECT COUNT(*) AS total FROM reinscripciones r
       INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
       WHERE i.id_alumno = ? AND i.estado IN ('Pendiente','Validada')`,
      [alumno.id_alumno]
    );

    const [carreras] = await conn.execute(
      `SELECT id_carrera, nombre_carrera FROM carreras ORDER BY nombre_carrera`
    );

    return res.json({
      ok: true,
      data: {
        alumno,
        periodoActivo,
        reinscripcionesActivas: reinscripcionesActivas[0]?.total || 0,
        carreras
      }
    });
  } catch (error) {
    console.error('Error getMiInformacion reinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al cargar información' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 2. SOLICITAR REINSCRIPCIÓN
// =====================================================
exports.solicitarReinscripcion = async (req, res) => {
  let conn;
  try {
    const { id_periodo, observaciones } = req.body;
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const alumno = await getIdAlumnoByUserId(conn, req.user.id_usuario);
    if (!alumno) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let periodoFinal = id_periodo;
    if (!periodoFinal) {
      const periodoActivo = await getPeriodoActivo(conn);
      if (!periodoActivo) {
        await conn.rollback();
        return res.status(400).json({ ok: false, message: 'No hay un periodo activo disponible' });
      }
      periodoFinal = periodoActivo.id_periodo;
    }

    const [duplicado] = await conn.execute(
      `SELECT i.id_inscripcion FROM inscripciones i
       WHERE i.id_alumno = ? AND i.id_periodo = ?
         AND i.tipo_inscripcion = 'Reinscripcion'
         AND i.estado IN ('Pendiente','Validada')
       LIMIT 1`,
      [alumno.id_alumno, periodoFinal]
    );
    if (duplicado.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, message: 'Ya tienes una solicitud de reinscripción activa para este periodo' });
    }

    const [insResult] = await conn.execute(
      `INSERT INTO inscripciones (id_alumno, id_periodo, fecha_inscripcion, tipo_inscripcion, estado, observaciones)
       VALUES (?, ?, NOW(), 'Reinscripcion', 'Pendiente', ?)`,
      [alumno.id_alumno, periodoFinal, observaciones?.trim() || null]
    );
    const id_inscripcion = insResult.insertId;

    const [reinsResult] = await conn.execute(
      `INSERT INTO reinscripciones (id_inscripcion, motivo, validada_por, fecha_solicitud)
       VALUES (?, ?, NULL, NOW())`,
      [id_inscripcion, observaciones?.trim() || 'Solicitud de reinscripción']
    );
    const id_reinscripcion = reinsResult.insertId;

    await conn.execute(
      `INSERT INTO reinscripcion_auditoria (id_reinscripcion, id_inscripcion, accion, estado_anterior, estado_nuevo, detalle, id_usuario)
       VALUES (?, ?, 'SOLICITAR', NULL, 'Pendiente', 'Solicitud de reinscripción creada por el alumno', ?)`,
      [id_reinscripcion, id_inscripcion, req.user.id_usuario]
    );

    await conn.commit();

    return res.status(201).json({
      ok: true,
      message: 'Solicitud de reinscripción registrada correctamente',
      data: { id_reinscripcion, id_inscripcion }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error solicitarReinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar la solicitud' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 3. ESTATUS DEL TRÁMITE
// =====================================================
exports.getMiEstatus = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let rows = [];

    try {
      const [r] = await conn.execute(
        `SELECT r.id_reinscripcion, i.id_inscripcion, i.id_periodo,
                p.nombre_periodo, i.estado, i.tipo_inscripcion,
                i.fecha_inscripcion, i.observaciones,
                r.motivo, r.fecha_solicitud, r.fecha_validacion,
                r.observaciones_alumno,
                COALESCE(i.comprobante_pago, i.comprobante_reinscripcion) AS comprobante,
                COALESCE(i.fecha_comprobante, i.fecha_comprobante_reinscripcion) AS fecha_comprobante,
                i.id_grupo, g.nombre_grupo,
                (SELECT COUNT(*) FROM reinscripcion_requisitos rr WHERE rr.id_reinscripcion = r.id_reinscripcion AND rr.cumplido = 1) AS requisitos_cumplidos,
                (SELECT COUNT(*) FROM reinscripcion_requisitos rr WHERE rr.id_reinscripcion = r.id_reinscripcion) AS requisitos_totales
         FROM reinscripciones r
         INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
         INNER JOIN periodos p ON p.id_periodo = i.id_periodo
         LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
         WHERE i.id_alumno = ?
         ORDER BY r.id_reinscripcion DESC`,
        [alumno.id_alumno]
      );
      rows = r;
    } catch (e) {
      console.warn('Error getMiEstatus (columns faltantes):', e.message);
      // Fallback: consulta básica sin columnas que pudieran faltar
      try {
        const [r2] = await conn.execute(
          `SELECT r.id_reinscripcion, i.id_inscripcion, i.id_periodo,
                  p.nombre_periodo, i.estado, i.tipo_inscripcion,
                  i.fecha_inscripcion, i.observaciones,
                  r.motivo, r.fecha_validacion
           FROM reinscripciones r
           INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
           INNER JOIN periodos p ON p.id_periodo = i.id_periodo
           WHERE i.id_alumno = ?
           ORDER BY r.id_reinscripcion DESC`,
          [alumno.id_alumno]
        );
        rows = r2;
      } catch (e2) {
        console.warn('Error getMiEstatus fallback:', e2.message);
        rows = [];
      }
    }

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error getMiEstatus reinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener estatus' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 4. HISTORIAL PERSONAL
// =====================================================
exports.getMiHistorial = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    let historial = [];
    let auditoria = [];
    let requisitos = [];

    try {
      const [h] = await conn.execute(
        `SELECT r.id_reinscripcion, i.id_inscripcion, i.id_periodo,
                p.nombre_periodo, i.estado, i.tipo_inscripcion,
                i.fecha_inscripcion, r.fecha_solicitud, r.fecha_validacion,
                r.motivo, i.observaciones
         FROM reinscripciones r
         INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
         INNER JOIN periodos p ON p.id_periodo = i.id_periodo
         WHERE i.id_alumno = ?
         ORDER BY r.id_reinscripcion DESC`,
        [alumno.id_alumno]
      );
      historial = h;
    } catch (e) {
      console.warn('Error obteniendo historial reinscripciones (columna faltante?):', e.message);
    }

    try {
      const [a] = await conn.execute(
        `SELECT ra.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_usuario
         FROM reinscripcion_auditoria ra
         LEFT JOIN usuarios u ON u.id_usuario = ra.id_usuario
         WHERE ra.id_inscripcion IN (
           SELECT i.id_inscripcion FROM reinscripciones r
           INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
           WHERE i.id_alumno = ?
         )
         ORDER BY ra.creado_en DESC`,
        [alumno.id_alumno]
      );
      auditoria = a;
    } catch (e) {
      console.warn('Error obteniendo auditoria (tabla no existe?):', e.message);
    }

    try {
      const [r] = await conn.execute(
        `SELECT rr.*, r.id_inscripcion
         FROM reinscripcion_requisitos rr
         INNER JOIN reinscripciones r ON r.id_reinscripcion = rr.id_reinscripcion
         INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
         WHERE i.id_alumno = ?
         ORDER BY rr.requisito`,
        [alumno.id_alumno]
      );
      requisitos = r;
    } catch (e) {
      console.warn('Error obteniendo requisitos (tabla no existe?):', e.message);
    }

    return res.json({
      ok: true,
      data: { reinscripciones: historial, auditoria, requisitos }
    });
  } catch (error) {
    console.error('Error getMiHistorial reinscripcion:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// 5. DESCARGAR COMPROBANTE (PDF / XLSX / SVG / PNG / JPG)
// =====================================================
exports.descargarComprobante = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const formato = (req.query.formato || 'pdf').toLowerCase();

    conn = await pool.getConnection();
    const alumno = await getIdAlumnoByUserId(conn, req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [rows] = await conn.execute(
      `SELECT i.id_inscripcion, i.fecha_inscripcion, i.estado, i.tipo_inscripcion,
              i.observaciones, p.nombre_periodo, g.nombre_grupo,
               c.nombre_carrera,
              r.id_reinscripcion, r.fecha_solicitud, r.fecha_validacion,
              r.motivo
       FROM reinscripciones r
       INNER JOIN inscripciones i ON i.id_inscripcion = r.id_inscripcion
       INNER JOIN periodos p ON p.id_periodo = i.id_periodo
       LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
       LEFT JOIN carreras c ON c.id_carrera = COALESCE(i.id_carrera, alumno.id_carrera)
       WHERE r.id_reinscripcion = ? AND i.id_alumno = ?
       LIMIT 1`,
      [Number(id), alumno.id_alumno]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Reinscripción no encontrada' });
    }

    const d = rows[0];
    const data = {
      folio: `RE-${String(d.id_reinscripcion).padStart(6, '0')}`,
      alumno: alumno.nombre_completo,
      matricula: alumno.matricula,
      carrera: d.nombre_carrera || '—',
      periodo: d.nombre_periodo,
      grupo: d.nombre_grupo || '—',
      estado: d.estado,
      tipo: 'Reinscripción',
      fechaSolicitud: d.fecha_solicitud,
      fechaValidacion: d.fecha_validacion,
      fechaEmision: new Date().toISOString(),
      motivo: d.motivo || '—',
      observaciones: d.observaciones || '—'
    };

    switch (formato) {
      case 'pdf':
        return await generarPDF(res, data);
      case 'xlsx':
        return await generarXLSX(res, data);
      case 'svg':
        return await generarSVG(res, data);
      case 'png':
        return await generarPNG(res, data);
      case 'jpg':
      case 'jpeg':
        return await generarJPG(res, data);
      default:
        return await generarPDF(res, data);
    }
  } catch (error) {
    console.error('Error descargarComprobante:', error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: 'Error al generar comprobante' });
    }
  } finally {
    if (conn) conn.release();
  }
};

// =====================================================
// FORMATOS DE EXPORTACIÓN
// =====================================================

function formatFecha(f) {
  if (!f) return '—';
  try {
    return new Date(f).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return f; }
}

async function generarPDF(res, data) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'letter', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_reinscripcion_${data.folio}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text('SIVACAD', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('Sistema Integral de Validación y Control Académico', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').text('COMPROBANTE DE REINSCRIPCIÓN', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('#64748b').text(`Folio: ${data.folio}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('DATOS DEL ALUMNO');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#334155');
  doc.text(`Nombre: ${data.alumno}`);
  doc.text(`Matrícula: ${data.matricula}`);
  doc.text(`Carrera: ${data.carrera}`);
  doc.text(`Período: ${data.periodo}`);
  doc.moveDown(0.5);

  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('DATOS DE LA REINSCRIPCIÓN');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#334155');
  doc.text(`Folio: ${data.folio}`);
  doc.text(`Tipo: ${data.tipo}`);
  doc.text(`Estado: ${data.estado}`);
  doc.text(`Grupo: ${data.grupo}`);
  doc.text(`Fecha de solicitud: ${formatFecha(data.fechaSolicitud)}`);
  doc.text(`Motivo: ${data.motivo}`);
  doc.moveDown(1);

  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#94a3b8').text(
    `Documento generado electrónicamente el ${formatFecha(data.fechaEmision)}.`,
    { align: 'center' }
  );
  doc.fontSize(8).fillColor('#94a3b8').text(
    'SIVACAD - Sistema Integral de Validación y Control Académico',
    { align: 'center' }
  );

  doc.end();
}

async function generarXLSX(res, data) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIVACAD';
  wb.created = new Date();

  const ws = wb.addWorksheet('Comprobante Reinscripción');

  ws.columns = [
    { header: 'Campo', key: 'campo', width: 25 },
    { header: 'Valor', key: 'valor', width: 45 }
  ];

  ws.getRow(1).font = { bold: true, size: 12 };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const rows = [
    ['Folio', data.folio],
    ['Alumno', data.alumno],
    ['Matrícula', data.matricula],
    ['Carrera', data.carrera],
    ['Período', data.periodo],
    ['Grupo', data.grupo],
    ['Tipo', data.tipo],
    ['Estado', data.estado],
    ['Fecha de solicitud', formatFecha(data.fechaSolicitud)],
    ['Fecha de validación', formatFecha(data.fechaValidacion)],
    ['Motivo', data.motivo],
    ['Observaciones', data.observaciones],
    ['Fecha de emisión', formatFecha(data.fechaEmision)]
  ];

  rows.forEach((r, i) => {
    const row = ws.addRow({ campo: r[0], valor: r[1] });
    if (i % 2 === 0) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_reinscripcion_${data.folio}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
}

function svgContent(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="520" viewBox="0 0 680 520">
  <rect width="680" height="520" fill="#ffffff"/>
  <text x="340" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">SIVACAD</text>
  <text x="340" y="53" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#475569">Sistema Integral de Validación y Control Académico</text>
  <text x="340" y="75" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1e40af">COMPROBANTE DE REINSCRIPCIÓN</text>
  <text x="340" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#64748b">Folio: ${data.folio}</text>

  <line x1="40" y1="105" x2="640" y2="105" stroke="#cbd5e1" stroke-width="1"/>

  <text x="40" y="130" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">DATOS DEL ALUMNO</text>
  <text x="40" y="150" font-family="Arial, sans-serif" font-size="10" fill="#334155">Nombre: ${escapeXml(data.alumno)}</text>
  <text x="40" y="168" font-family="Arial, sans-serif" font-size="10" fill="#334155">Matrícula: ${escapeXml(data.matricula)}</text>
  <text x="40" y="186" font-family="Arial, sans-serif" font-size="10" fill="#334155">Carrera: ${escapeXml(data.carrera)}</text>
  <text x="40" y="204" font-family="Arial, sans-serif" font-size="10" fill="#334155">Período: ${escapeXml(data.periodo)}</text>

  <text x="40" y="234" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">DATOS DE LA REINSCRIPCIÓN</text>
  <text x="40" y="254" font-family="Arial, sans-serif" font-size="10" fill="#334155">Folio: ${escapeXml(data.folio)}</text>
  <text x="40" y="272" font-family="Arial, sans-serif" font-size="10" fill="#334155">Tipo: ${escapeXml(data.tipo)}</text>
  <text x="40" y="290" font-family="Arial, sans-serif" font-size="10" fill="#334155">Estado: ${escapeXml(data.estado)}</text>
  <text x="40" y="308" font-family="Arial, sans-serif" font-size="10" fill="#334155">Grupo: ${escapeXml(data.grupo)}</text>
  <text x="40" y="326" font-family="Arial, sans-serif" font-size="10" fill="#334155">Fecha de solicitud: ${escapeXml(formatFecha(data.fechaSolicitud))}</text>
  <text x="40" y="344" font-family="Arial, sans-serif" font-size="10" fill="#334155">Motivo: ${escapeXml(data.motivo)}</text>

  <line x1="40" y1="365" x2="640" y2="365" stroke="#cbd5e1" stroke-width="1"/>

  <text x="340" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#94a3b8">Documento generado electrónicamente el ${escapeXml(formatFecha(data.fechaEmision))}.</text>
  <text x="340" y="406" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#94a3b8">SIVACAD - Sistema Integral de Validación y Control Académico</text>
</svg>`;
}

function escapeXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generarSVG(res, data) {
  const svg = svgContent(data);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_reinscripcion_${data.folio}.svg`);
  res.send(svg);
}

async function generarPNG(res, data) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    return await generarSVG(res, data);
  }
  const svg = svgContent(data);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_reinscripcion_${data.folio}.png`);
  res.send(png);
}

async function generarJPG(res, data) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    return await generarSVG(res, data);
  }
  const svg = svgContent(data);
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_reinscripcion_${data.folio}.jpg`);
  res.send(jpg);
}
