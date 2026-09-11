'use strict';

// backend/src/services/privacyManager.js
// Servicio de gestión de privacidad y datos personales

const pool = require('../config/db');

// ==============================
// REGISTRAR CONSENTIMIENTO
// ==============================
exports.recordConsent = async (idUsuario, tipo, version, aceptado, ipOrigen) => {
  try {
    await pool.execute(
      `INSERT INTO consentimientos
       (id_usuario, tipo_consentimiento, version_documento, aceptado, ip_origen, aceptado_en, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [idUsuario, tipo, version, aceptado ? 1 : 0, ipOrigen]
    );
    return true;
  } catch (error) {
    console.error('[PRIVACY] Error registrando consentimiento:', error.message);
    return false;
  }
};

// ==============================
// VERIFICAR CONSENTIMIENTO
// ==============================
exports.hasConsent = async (idUsuario, tipo) => {
  try {
    const [rows] = await pool.execute(
      `SELECT aceptado
       FROM consentimientos
       WHERE id_usuario = ? AND tipo_consentimiento = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [idUsuario, tipo]
    );

    if (!rows.length) return false;
    return rows[0].aceptado === 1;
  } catch (_) {
    return false;
  }
};

// ==============================
// REVOCAR CONSENTIMIENTO
// ==============================
exports.revokeConsent = async (idUsuario, tipo, motivo) => {
  try {
    await pool.execute(
      `UPDATE consentimientos
       SET aceptado = 0, revocado_en = NOW(), motivo_revocacion = ?
       WHERE id_usuario = ? AND tipo_consentimiento = ? AND aceptado = 1`,
      [motivo || 'Revocado por el usuario', idUsuario, tipo]
    );
    return true;
  } catch (error) {
    console.error('[PRIVACY] Error revocando consentimiento:', error.message);
    return false;
  }
};

// ==============================
// OBTENER HISTORIAL DE CONSENTIMIENTOS
// ==============================
exports.getConsentHistory = async (idUsuario) => {
  try {
    const [rows] = await pool.execute(
      `SELECT tipo_consentimiento, version_documento, aceptado, aceptado_en, revocado_en, motivo_revocacion
       FROM consentimientos
       WHERE id_usuario = ?
       ORDER BY created_at DESC`,
      [idUsuario]
    );
    return rows;
  } catch (_) {
    return [];
  }
};

// ==============================
// SOLICITUD ARCO
// ==============================
exports.submitARCORequest = async (idUsuario, tipoSolicitud, datosSolicitados, motivo) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO derechos_arco
       (id_usuario, tipo_solicitud, datos_solicitados, motivo, estado, created_at)
       VALUES (?, ?, ?, ?, 'pendiente', NOW())`,
      [idUsuario, tipoSolicitud, JSON.stringify(datosSolicitados), motivo]
    );
    return { id: result.insertId, success: true };
  } catch (error) {
    console.error('[PRIVACY] Error creando solicitud ARCO:', error.message);
    return { id: null, success: false };
  }
};

// ==============================
// OBTENER POLÍTICAS DE RETENCIÓN
// ==============================
exports.getRetentionPolicies = async (idInstitucion) => {
  try {
    const [rows] = await pool.execute(
      `SELECT tabla, columna, tipo_dato, nivel_sensibilidad, retencion_dias, accion_fin_vida
       FROM politica_retencion
       WHERE id_institucion = ? AND activa = 1`,
      [idInstitucion]
    );
    return rows;
  } catch (_) {
    return [];
  }
};

// ==============================
// VERIFICAR SI UN CAMPO ES SENSIBLE
// ==============================
exports.isSensitiveField = async (tabla, columna) => {
  try {
    const [rows] = await pool.execute(
      `SELECT tipo_dato, nivel_sensibilidad
       FROM politica_retencion
       WHERE tabla = ? AND columna = ?
       LIMIT 1`,
      [tabla, columna]
    );

    if (!rows.length) return false;
    return ['alto', 'critico'].includes(rows[0].nivel_sensibilidad);
  } catch (_) {
    return false;
  }
};

// ==============================
// OBTENER DATOS PERSONALES DE UN USUARIO
// ==============================
exports.getPersonalData = async (idUsuario) => {
  try {
    const [usuario] = await pool.execute(
      `SELECT nombres, apellido_paterno, apellido_materno, correo_institucional, id_rol, id_institucion
       FROM usuarios WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    const [alumno] = await pool.execute(
      `SELECT matricula, curp, fotografia, semestre_actual, estatus_academico
       FROM alumnos WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    const [consentimientos] = await pool.execute(
      `SELECT tipo_consentimiento, aceptado, aceptado_en
       FROM consentimientos WHERE id_usuario = ? ORDER BY created_at DESC`,
      [idUsuario]
    );

    return {
      usuario: usuario[0] || null,
      alumno: alumno[0] || null,
      consentimientos
    };
  } catch (_) {
    return { usuario: null, alumno: null, consentimientos: [] };
  }
};

// ==============================
// ELIMINAR/ANONIMIZAR DATOS
// ==============================
exports.anonymizeUser = async (idUsuario) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generar identificador anónimo único (sin exponer ID real)
    const crypto = require('crypto');
    const anonId = crypto.randomBytes(8).toString('hex');

    // Anonimizar usuario
    await conn.execute(
      `UPDATE usuarios SET
        nombres = 'ELIMINADO',
        apellido_paterno = 'ELIMINADO',
        apellido_materno = 'ELIMINADO',
        correo_institucional = CONCAT('anonimo_', ?, '@eliminado.com'),
        estado = 'Inactivo'
       WHERE id_usuario = ?`,
      [anonId, idUsuario]
    );

    // Anonimizar alumno
    await conn.execute(
      `UPDATE alumnos SET
        nombres = 'ELIMINADO',
        apellido_paterno = 'ELIMINADO',
        apellido_materno = 'ELIMINADO',
        curp = 'ELIMINADO',
        fotografia = NULL
       WHERE id_usuario = ?`,
      [idUsuario]
    );

    // Eliminar datos sensibles de bienestar
    await conn.execute(`DELETE FROM ia_bienestar_mensajes WHERE id_usuario = ?`, [idUsuario]);
    await conn.execute(`DELETE FROM ia_bienestar_checkins WHERE id_usuario = ?`, [idUsuario]);

    // Eliminar mensajes de chatbot
    await conn.execute(`DELETE FROM chatbot_mensajes WHERE id_usuario = ?`, [idUsuario]);

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    console.error('[PRIVACY] Error anonimizando usuario:', error.message);
    return false;
  } finally {
    conn.release();
  }
};
