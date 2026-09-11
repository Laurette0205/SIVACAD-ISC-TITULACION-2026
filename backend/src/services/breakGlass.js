'use strict';

// backend/src/services/breakGlass.js
// Servicio de acceso de emergencia (break-glass)

const crypto = require('crypto');
const pool = require('../config/db');

const PIN_LENGTH = 8;
const MAX_EXPIRATION_HOURS = 24;

// ==============================
// GENERAR CREDENCIAL DE EMERGENCIA
// ==============================
exports.grantEmergencyAccess = async (emisorId, receptorId, permisos, motivo, expirationHours = 8) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generar PIN numerico de 8 digitos
    const pin = String(Math.floor(10000000 + Math.random() * 90000000));
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    const fechaEmision = new Date();
    const fechaExpiracion = new Date(Date.now() + Math.min(expirationHours, MAX_EXPIRATION_HOURS) * 60 * 60 * 1000);

    const [result] = await conn.execute(
      `INSERT INTO break_glass_credentials
       (id_usuario_emisor, id_usuario_receptor, pin_hash, permisos, fecha_emision, fecha_expiracion, motivo, activo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [emisorId, receptorId, pinHash, JSON.stringify(permisos), fechaEmision, fechaExpiracion, motivo]
    );

    await conn.commit();

    return {
      id: result.insertId,
      pin,
      fechaEmision,
      fechaExpiracion,
      permisos,
      mensaje: `PIN de emergencia generado. Comparte de forma segura. Expira: ${fechaExpiracion.toISOString()}`
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// ==============================
// VERIFICAR ACCESO DE EMERGENCIA
// ==============================
exports.verifyEmergencyAccess = async (receptorId, pin) => {
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

  const [rows] = await pool.execute(
    `SELECT id, permisos, fecha_expiracion, motivo
     FROM break_glass_credentials
     WHERE id_usuario_receptor = ? AND pin_hash = ? AND activo = 1
     AND fecha_expiracion > NOW()
     LIMIT 1`,
    [receptorId, pinHash]
  );

  if (!rows.length) {
    return { valid: false, message: 'PIN inválido o expirado' };
  }

  const credencial = rows[0];

  // Marcar como usada
  await pool.execute(
    `UPDATE break_glass_credentials SET usado_en = NOW() WHERE id = ?`,
    [credencial.id]
  );

  // Registrar en log de auditoría
  await pool.execute(
    `INSERT INTO emergency_access_log
     (id_usuario, id_credencial, fecha_acceso, datos_consultados, created_at)
     VALUES (?, ?, NOW(), ?, NOW())`,
    [receptorId, credencial.id, JSON.stringify({ permisos: credencial.permisos })]
  );

  return {
    valid: true,
    permisos: typeof credencial.permisos === 'string' ? JSON.parse(credencial.permisos) : credencial.permisos,
    motivo: credencial.motivo
  };
};

// ==============================
// OBTENER DATOS MÍNIMOS PARA EMERGENCIA
// ==============================
exports.getEmergencyData = async (idUsuario) => {
  try {
    const [alumno] = await pool.execute(
      `SELECT a.nombres, a.apellido_paterno, a.apellido_materno, a.matricula, a.curp,
              c.nombre_carrera, a.semestre_actual, a.estatus_academico
       FROM alumnos a
       LEFT JOIN carreras c ON a.id_carrera = c.id_carrera
       WHERE a.id_usuario = ?
       LIMIT 1`,
      [idUsuario]
    );

    const [contactos] = await pool.execute(
      `SELECT nombre, parentesco, telefono, telefono_alt, correo
       FROM contactos_emergencia
       WHERE id_usuario = ?
       ORDER BY principal DESC
       LIMIT 3`,
      [idUsuario]
    );

    const [salud] = await pool.execute(
      `SELECT tipo, condicion, observaciones
       FROM docente_salud_estudiantil
       WHERE id_alumno IN (
         SELECT id_alumno FROM alumnos WHERE id_usuario = ?
       ) AND confidencial = 0
       LIMIT 5`,
      [idUsuario]
    );

    return {
      identificacion: alumno[0] || null,
      contactos_emergencia: contactos,
      salud_basica: salud
    };
  } catch (_) {
    return { identificacion: null, contactos_emergencia: [], salud_basica: [] };
  }
};

// ==============================
// REVOCAR CREDENCIAL
// ==============================
exports.revokeCredential = async (credentialId, usuarioId) => {
  try {
    await pool.execute(
      `UPDATE break_glass_credentials SET activo = 0
       WHERE id = ? AND id_usuario_emisor = ?`,
      [credentialId, usuarioId]
    );
    return true;
  } catch (_) {
    return false;
  }
};

// ==============================
// LISTAR CREDENCIALES ACTIVAS
// ==============================
exports.listActiveCredentials = async (usuarioId) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, fecha_emision, fecha_expiracion, permisos, motivo, usado_en
       FROM break_glass_credentials
       WHERE id_usuario_emisor = ? AND activo = 1
       ORDER BY fecha_emision DESC`,
      [usuarioId]
    );
    return rows;
  } catch (_) {
    return [];
  }
};
