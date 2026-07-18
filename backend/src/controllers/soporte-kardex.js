'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

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

async function registrarLog(accion, detalle, id_usuario, ip) {
  try {
    await pool.execute(
      `INSERT INTO kardex_auditoria (accion, detalle, id_usuario, ip_origen, creado_en)
       VALUES (?, ?, ?, ?, NOW())`,
      ['SOPORTE_' + accion, detalle, id_usuario || null, ip || null]
    );
  } catch (_) {}
}

// =====================================================
// 1. DIAGNÓSTICO TÉCNICO DEL KARDEX
// =====================================================
exports.diagnostico = async (req, res) => {
  try {
    const [
      [kardexCount],
      [alumnosSinKardex],
      [historialCount],
      [qrSinUrl],
      [alumnosConKardex],
      [sellosCount],
      [auditoriaCount]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS total FROM kardex_alumno'),
      pool.execute(
        `SELECT COUNT(*) AS total FROM alumnos a
         LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
         WHERE k.id_alumno IS NULL`
      ),
      pool.execute('SELECT COUNT(*) AS total FROM kardex_historial_academico'),
      pool.execute(
        `SELECT COUNT(*) AS total FROM kardex_alumno
         WHERE url_qr IS NULL OR url_qr = ''`
      ),
      pool.execute('SELECT COUNT(*) AS total FROM alumnos'),
      pool.execute('SELECT COUNT(*) AS total FROM kardex_sellos WHERE activo = 1'),
      pool.execute('SELECT COUNT(*) AS total FROM kardex_auditoria')
    ]);

    // Top 5 recent auditoria entries
    const [recientes] = await pool.execute(
      `SELECT ka.accion, ka.detalle, ka.creado_en,
              u.correo_institucional
       FROM kardex_auditoria ka
       LEFT JOIN usuarios u ON u.id_usuario = ka.id_usuario
       ORDER BY ka.creado_en DESC LIMIT 5`
    );

    await registrarLog('DIAGNOSTICO', 'Diagnóstico técnico ejecutado', req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        resumen: {
          kardex_emitidos: kardexCount[0].total,
          alumnos_sin_kardex: alumnosSinKardex[0].total,
          registros_historial: historialCount[0].total,
          qr_sin_url: qrSinUrl[0].total,
          total_alumnos: alumnosConKardex[0].total,
          sellos_activos: sellosCount[0].total,
          registros_auditoria: auditoriaCount[0].total
        },
        actividad_reciente: recientes
      }
    });
  } catch (error) {
    console.error('diagnostico:', error);
    return res.status(500).json({ ok: false, message: 'Error al ejecutar diagnóstico' });
  }
};

// =====================================================
// 2. VERIFICACIÓN DE QR
// =====================================================
exports.validarQR = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ ok: false, message: 'Token QR requerido' });

    const [rows] = await pool.execute(
      `SELECT k.id_kardex, k.id_alumno, k.qr_token, k.url_qr,
              a.matricula,
              CONCAT(a.nombres, ' ', a.apellido_paterno, ' ', a.apellido_materno) AS nombre_completo,
              a.curp, c.nombre_carrera
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
       WHERE k.qr_token = ? LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'QR inválido o expirado', valido: false });
    }

    await registrarLog('VALIDAR_QR', 'QR validado: ' + rows[0].matricula, req.user?.id_usuario, req.ip);

    return res.json({
      ok: true, valido: true,
      data: {
        nombre_completo: rows[0].nombre_completo?.replace(/\s+/g, ' ').trim(),
        matricula: rows[0].matricula,
        curp: rows[0].curp,
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
// 3. VALIDACIÓN DE RUTAS
// =====================================================
exports.verificarRutas = async (req, res) => {
  try {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const subdirs = ['qrs', 'kardex', 'alumnos', 'fotos', 'kardex/fotos', 'kardex/qrs', 'logos'];

    const directorios = subdirs.map((sub) => {
      const fullPath = path.join(uploadsDir, sub);
      const existe = fs.existsSync(fullPath);
      let stats = null;
      if (existe) {
        try { stats = fs.statSync(fullPath); } catch (_) {}
      }
      return {
        ruta: `/uploads/${sub}`,
        existe,
        es_directorio: stats?.isDirectory() || false,
        permisos_lectura: existe
      };
    });

    const [qrFiles] = await pool.execute(
      `SELECT url_qr FROM kardex_alumno WHERE url_qr IS NOT NULL AND url_qr != ''`
    );
    const archivosQr = qrFiles.map((r) => {
      const absPath = path.resolve(process.cwd(), r.url_qr.replace(/^\//, ''));
      return {
        url: r.url_qr,
        existe_en_disco: fs.existsSync(absPath),
        tamano: fs.existsSync(absPath) ? fs.statSync(absPath).size : null
      };
    });
    const qrExistentes = archivosQr.filter((a) => a.existe_en_disco).length;
    const qrFaltantes = archivosQr.filter((a) => !a.existe_en_disco).length;

    await registrarLog('VERIFICAR_RUTAS', 'Validación de rutas completada', req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        directorios,
        archivos_qr: { total: archivosQr.length, existentes: qrExistentes, faltantes: qrFaltantes },
        uploads_existe: fs.existsSync(uploadsDir)
      }
    });
  } catch (error) {
    console.error('verificarRutas:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar rutas' });
  }
};

// =====================================================
// 4. REVISIÓN DE INCIDENCIAS
// =====================================================
exports.incidencias = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT si.*, u.correo_institucional AS reportado_por_correo
       FROM soporte_kardex_incidencias si
       LEFT JOIN usuarios u ON u.id_usuario = si.reportado_por
       ORDER BY si.creado_en DESC LIMIT 50`
    );

    const [pendientes] = await pool.execute(
      `SELECT COUNT(*) AS total FROM soporte_kardex_incidencias WHERE estado = 'ABIERTA'`
    );

    return res.json({
      ok: true,
      data: {
        incidencias: rows,
        pendientes: pendientes[0].total
      }
    });
  } catch (error) {
    console.error('incidencias:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener incidencias' });
  }
};

// =====================================================
// 5. CREAR INCIDENCIA
// =====================================================
exports.crearIncidencia = async (req, res) => {
  try {
    const { tipo, descripcion, modulo, nivel } = req.body;
    if (!tipo || !descripcion) {
      return res.status(400).json({ ok: false, message: 'Tipo y descripción requeridos' });
    }

    const [result] = await pool.execute(
      `INSERT INTO soporte_kardex_incidencias
       (tipo, descripcion, modulo, nivel, estado, reportado_por, creado_en)
       VALUES (?, ?, ?, ?, 'ABIERTA', ?, NOW())`,
      [
        tipo,
        descripcion,
        modulo || 'KARDEX',
        nivel || 'MEDIA',
        req.user?.id_usuario || null
      ]
    );

    await registrarLog('CREAR_INCIDENCIA', 'Incidencia #' + result.insertId + ': ' + tipo, req.user?.id_usuario, req.ip);

    return res.status(201).json({
      ok: true,
      message: 'Incidencia registrada correctamente',
      data: { id_incidencia: result.insertId }
    });
  } catch (error) {
    console.error('crearIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al registrar incidencia' });
  }
};

// =====================================================
// 6. ATENDER INCIDENCIA
// =====================================================
exports.atenderIncidencia = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID de incidencia inválido' });

    const { solucion, estado } = req.body;

    await pool.execute(
      `UPDATE soporte_kardex_incidencias
       SET estado = ?, solucion = ?, atendido_por = ?, atendido_en = NOW()
       WHERE id_incidencia = ?`,
      [
        estado || 'ATENDIDA',
        solucion || null,
        req.user?.id_usuario || null,
        id
      ]
    );

    await registrarLog('ATENDER_INCIDENCIA', 'Incidencia #' + id + ' -> ' + (estado || 'ATENDIDA'), req.user?.id_usuario, req.ip);

    return res.json({ ok: true, message: 'Incidencia actualizada correctamente' });
  } catch (error) {
    console.error('atenderIncidencia:', error);
    return res.status(500).json({ ok: false, message: 'Error al actualizar incidencia' });
  }
};

// =====================================================
// 7. MONITOREO DE CARGA DOCUMENTAL
// =====================================================
exports.monitoreoCarga = async (req, res) => {
  try {
    const [historialReciente] = await pool.execute(
      `SELECT kh.id_historial, kh.creado_en, kh.estado,
              a.matricula,
              CONCAT(a.nombres, ' ', a.apellido_paterno) AS alumno_nombre,
              m.nombre_materia,
              p.nombre_periodo
       FROM kardex_historial_academico kh
       INNER JOIN alumnos a ON a.id_alumno = kh.id_alumno
       LEFT JOIN materias m ON m.id_materia = kh.id_materia
       LEFT JOIN periodos p ON p.id_periodo = kh.id_periodo
       ORDER BY kh.creado_en DESC LIMIT 20`
    );

    const [cargasPorPeriodo] = await pool.execute(
      `SELECT p.nombre_periodo, COUNT(kh.id_historial) AS total
       FROM kardex_historial_academico kh
       INNER JOIN periodos p ON p.id_periodo = kh.id_periodo
       GROUP BY p.id_periodo, p.nombre_periodo
       ORDER BY p.fecha_inicio DESC`
    );

    const [estadisticas] = await pool.execute(
      `SELECT
         COUNT(*) AS total_registros,
         COALESCE(SUM(CASE WHEN estado = 'Acreditada' THEN 1 ELSE 0 END), 0) AS acreditadas,
         COALESCE(SUM(CASE WHEN estado = 'No Acreditada' THEN 1 ELSE 0 END), 0) AS no_acreditadas,
         COALESCE(SUM(CASE WHEN estado = 'Cursando' THEN 1 ELSE 0 END), 0) AS cursando,
         COALESCE(SUM(CASE WHEN tipo_materia = 'Extraordinario' THEN 1 ELSE 0 END), 0) AS extraordinarios
       FROM kardex_historial_academico`
    );

    return res.json({
      ok: true,
      data: {
        cargas_recientes: historialReciente,
        cargas_por_periodo: cargasPorPeriodo,
        estadisticas: estadisticas[0]
      }
    });
  } catch (error) {
    console.error('monitoreoCarga:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener monitoreo de carga' });
  }
};

// =====================================================
// 8. VERIFICAR INTEGRIDAD DE ARCHIVOS
// =====================================================
exports.verificarIntegridad = async (req, res) => {
  try {
    const [qrRows] = await pool.execute(
      `SELECT k.id_alumno, a.matricula, k.qr_token, k.url_qr
       FROM kardex_alumno k
       INNER JOIN alumnos a ON a.id_alumno = k.id_alumno
       WHERE k.url_qr IS NOT NULL AND k.url_qr != ''`
    );

    const resultados = qrRows.map((r) => {
      const absPath = r.url_qr
        ? path.resolve(process.cwd(), r.url_qr.replace(/^\//, ''))
        : null;
      const existe = absPath ? fs.existsSync(absPath) : false;
      let tamano = null;
      if (existe) {
        try { tamano = fs.statSync(absPath).size; } catch (_) {}
      }
      return {
        id_alumno: r.id_alumno,
        matricula: r.matricula,
        qr_token_valido: !!r.qr_token,
        archivo_existe: existe,
        tamano_bytes: tamano
      };
    });

    const integros = resultados.filter((r) => r.archivo_existe && r.qr_token_valido).length;
    const danados = resultados.filter((r) => !r.archivo_existe || !r.qr_token_valido).length;

    await registrarLog('VERIFICAR_INTEGRIDAD', `Integridad: ${integros} ok, ${danados} dañados`, req.user?.id_usuario, req.ip);

    return res.json({
      ok: true,
      data: {
        total_archivos: resultados.length,
        integros,
        danados,
        detalle: resultados
      }
    });
  } catch (error) {
    console.error('verificarIntegridad:', error);
    return res.status(500).json({ ok: false, message: 'Error al verificar integridad' });
  }
};
