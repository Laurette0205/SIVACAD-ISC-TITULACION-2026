'use strict';

// backend/src/services/accountLockout.js
// Servicio de bloqueo de cuenta por intentos fallidos

const crypto = require('crypto');
const pool = require('../config/db');

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // Ventana de 15 minutos para resetear

// ==============================
// VERIFICAR SI LA CUENTA ESTÁ BLOQUEADA
// ==============================
exports.isAccountLocked = async (idUsuario) => {
  try {
    const [rows] = await pool.execute(
      `SELECT intentos_fallidos, bloqueado_hasta
       FROM bloqueos_cuenta
       WHERE id_usuario = ?
       LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) return false;

    const lock = rows[0];

    if (lock.bloqueado_hasta) {
      const lockExpiry = new Date(lock.bloqueado_hasta).getTime();
      if (Date.now() < lockExpiry) {
        const remainingMin = Math.ceil((lockExpiry - Date.now()) / 60000);
        return {
          locked: true,
          remainingMinutes: remainingMin,
          message: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${remainingMin} minutos.`
        };
      }
      // Lock expirado — resetear
      await pool.execute(
        `UPDATE bloqueos_cuenta SET intentos_fallidos = 0, bloqueado_hasta = NULL
         WHERE id_usuario = ?`,
        [idUsuario]
      );
    }

    return false;
  } catch (_) {
    return false;
  }
};

// ==============================
// REGISTRAR INTENTO FALLIDO
// ==============================
exports.recordFailedAttempt = async (idUsuario) => {
  try {
    const now = new Date();

    // Upsert
    await pool.execute(
      `INSERT INTO bloqueos_cuenta (id_usuario, intentos_fallidos, ultimo_intento_fallido, created_at)
       VALUES (?, 1, ?, NOW())
       ON DUPLICATE KEY UPDATE
         intentos_fallidos = IF(
           TIMESTAMPDIFF(MINUTE, ultimo_intento_fallido, NOW()) > 15,
           1,
           intentos_fallidos + 1
         ),
         ultimo_intento_fallido = ?,
         bloqueado_hasta = IF(
           intentos_fallidos >= ${MAX_ATTEMPTS - 1},
           DATE_ADD(NOW(), INTERVAL 30 MINUTE),
           bloqueado_hasta
         )`,
      [idUsuario, now, now]
    );

    // Verificar si alcanzó el límite
    const [rows] = await pool.execute(
      `SELECT intentos_fallidos, bloqueado_hasta
       FROM bloqueos_cuenta
       WHERE id_usuario = ?
       LIMIT 1`,
      [idUsuario]
    );

    if (rows.length) {
      const lock = rows[0];
      if (lock.intentos_fallidos >= MAX_ATTEMPTS && !lock.bloqueado_hasta) {
        await pool.execute(
          `UPDATE bloqueos_cuenta
           SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
           WHERE id_usuario = ?`,
          [idUsuario]
        );
        return {
          locked: true,
          remainingMinutes: 30,
          message: 'Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en 30 minutos.'
        };
      }

      if (lock.bloqueado_hasta) {
        const lockExpiry = new Date(lock.bloqueado_hasta).getTime();
        if (Date.now() < lockExpiry) {
          const remainingMin = Math.ceil((lockExpiry - Date.now()) / 60000);
          return {
            locked: true,
            remainingMinutes: remainingMin,
            message: `Cuenta bloqueada. Intenta de nuevo en ${remainingMin} minutos.`
          };
        }
      }

      return {
        locked: false,
        attempts: lock.intentos_fallidos,
        maxAttempts: MAX_ATTEMPTS
      };
    }

    return { locked: false, attempts: 1, maxAttempts: MAX_ATTEMPTS };
  } catch (_) {
    return { locked: false, attempts: 0, maxAttempts: MAX_ATTEMPTS };
  }
};

// ==============================
// REGISTRAR INTENTO EXITOSO (resetear contadores)
// ==============================
exports.recordSuccessfulLogin = async (idUsuario) => {
  try {
    await pool.execute(
      `UPDATE bloqueos_cuenta
       SET intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE id_usuario = ?`,
      [idUsuario]
    );
  } catch (_) {
    // No romper el login si la tabla no existe
  }
};

// ==============================
// OBTENER ESTADO DE BLOQUEO
// ==============================
exports.getLockStatus = async (idUsuario) => {
  try {
    const [rows] = await pool.execute(
      `SELECT intentos_fallidos, bloqueado_hasta, ultimo_intento_fallido
       FROM bloqueos_cuenta
       WHERE id_usuario = ?
       LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) {
      return { attempts: 0, maxAttempts: MAX_ATTEMPTS, locked: false };
    }

    const lock = rows[0];
    const isLocked = lock.bloqueado_hasta && new Date(lock.bloqueado_hasta).getTime() > Date.now();

    return {
      attempts: lock.intentos_fallidos,
      maxAttempts: MAX_ATTEMPTS,
      locked: isLocked,
      lockedUntil: lock.bloqueado_hasta,
      lastAttempt: lock.ultimo_intento_fallido
    };
  } catch (_) {
    return { attempts: 0, maxAttempts: MAX_ATTEMPTS, locked: false };
  }
};

exports.MAX_ATTEMPTS = MAX_ATTEMPTS;
exports.LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MS;
