'use strict';

// backend/src/services/mfa.js
// Servicio MFA (Multi-Factor Authentication) con TOTP — CORREGIDO

const crypto = require('crypto');
const pool = require('../config/db');

const TOTP_PERIOD = 30; // segundos
const TOTP_DIGITS = 6;
const RECOVERY_CODES_COUNT = 8;

// Clave de cifrado para secrets (en producción usar vault/KMS)
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'sivacad-mfa-dev-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

// ==============================
// CIFRAR / DESCIFRAR SECRET
// ==============================
function encryptSecret(plainText) {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(encryptedText) {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ==============================
// GENERAR SECRET TOTP
// ==============================
exports.generateSecret = () => {
  return crypto.randomBytes(20).toString('base32');
};

// ==============================
// GENERAR URL OTPAUTH
// ==============================
exports.generateOTPAuthURL = (secret, email, issuer = 'SIVACAD') => {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
};

// ==============================
// GENERAR CÓDIGO TOTP
// ==============================
function generateTOTP(secret, timeOffset = 0) {
  const epoch = Math.floor(Date.now() / 1000) + (timeOffset * TOTP_PERIOD);
  const counter = Math.floor(epoch / TOTP_PERIOD);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);

  const secretBuffer = Buffer.from(secret, 'base32');
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);

  return String(code).padStart(TOTP_DIGITS, '0');
}

// ==============================
// VERIFICAR CÓDIGO TOTP
// ==============================
exports.verifyTOTP = (secret, token) => {
  if (!secret || !token) return false;
  const tokenStr = String(token).trim();
  if (tokenStr.length !== TOTP_DIGITS) return false;

  for (let offset = -1; offset <= 1; offset++) {
    const expected = generateTOTP(secret, offset);
    try {
      if (crypto.timingSafeEqual(Buffer.from(tokenStr), Buffer.from(expected))) {
        return true;
      }
    } catch (_) {
      return false;
    }
  }
  return false;
};

// ==============================
// GENERAR CÓDIGOS DE RECUPERACIÓN
// ==============================
exports.generateRecoveryCodes = () => {
  const codes = [];
  for (let i = 0; i < RECOVERY_CODES_COUNT; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
};

// ==============================
// HASHEAR CÓDIGO DE RECUPERACIÓN
// ==============================
exports.hashRecoveryCode = (code) => {
  return crypto.createHash('sha256').update(code.replace('-', '').toLowerCase()).digest('hex');
};

// ==============================
// CONFIGURAR MFA
// ==============================
exports.setupMFA = async (idUsuario, email) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const secret = exports.generateSecret();
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const secretEncrypted = encryptSecret(secret);
    const recoveryCodes = exports.generateRecoveryCodes();
    const recoveryHashes = recoveryCodes.map(c => exports.hashRecoveryCode(c));

    // Verificar si ya existe configuración
    const [existing] = await conn.execute(
      `SELECT id FROM mfa_config WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (existing.length) {
      await conn.execute(
        `UPDATE mfa_config
         SET secret_hash = ?, secret_encrypted = ?, recovery_codes = ?, activo = 0
         WHERE id_usuario = ?`,
        [secretHash, secretEncrypted, JSON.stringify(recoveryHashes), idUsuario]
      );
    } else {
      await conn.execute(
        `INSERT INTO mfa_config (id_usuario, secret_hash, secret_encrypted, activo, recovery_codes, created_at)
         VALUES (?, ?, ?, 0, ?, NOW())`,
        [idUsuario, secretHash, secretEncrypted, JSON.stringify(recoveryHashes)]
      );
    }

    await conn.commit();

    const otpauthURL = exports.generateOTPAuthURL(secret, email);

    return {
      secret,
      otpauthURL,
      recoveryCodes,
      message: 'Escanea el código QR con tu app de autenticación. Guarda los códigos de recuperación en un lugar seguro.'
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// ==============================
// ACTIVAR MFA (verifica primer código TOTP)
// ==============================
exports.enableMFA = async (idUsuario, token) => {
  try {
    const [rows] = await pool.execute(
      `SELECT secret_encrypted, activo FROM mfa_config WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) {
      return { success: false, message: 'MFA no configurado' };
    }

    if (rows[0].activo) {
      return { success: false, message: 'MFA ya está activo' };
    }

    if (!rows[0].secret_encrypted) {
      return { success: false, message: 'Secret MFA no encontrado. Reconfigura MFA.' };
    }

    // Descifrar secret y verificar código TOTP
    const secret = decryptSecret(rows[0].secret_encrypted);
    const isValid = exports.verifyTOTP(secret, token);

    if (!isValid) {
      return { success: false, message: 'Código TOTP inválido. Verifica tu app de autenticación.' };
    }

    // Código correcto: activar MFA
    await pool.execute(
      `UPDATE mfa_config SET activo = 1 WHERE id_usuario = ?`,
      [idUsuario]
    );

    return { success: true, message: 'MFA activado correctamente' };
  } catch (error) {
    console.error('[MFA] Error activando:', error.message);
    return { success: false, message: 'Error activando MFA' };
  }
};

// ==============================
// VERIFICAR MFA EN LOGIN
// ==============================
exports.verifyMFALogin = async (idUsuario, token) => {
  try {
    const [rows] = await pool.execute(
      `SELECT secret_encrypted, activo, recovery_codes FROM mfa_config WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length || !rows[0].activo) {
      return { required: false };
    }

    if (!token || !String(token).trim()) {
      return { required: true, verified: false, message: 'Código MFA requerido' };
    }

    const tokenStr = String(token).trim();

    // Verificar si es código de recuperación (formato: XXXX-XXXX)
    if (/^[A-F0-9]{4}-[A-F0-9]{4}$/i.test(tokenStr)) {
      return await verifyRecoveryCode(idUsuario, tokenStr, rows[0]);
    }

    // Verificar TOTP
    if (!rows[0].secret_encrypted) {
      return { required: true, verified: false, message: 'Secret MFA no encontrado' };
    }

    const secret = decryptSecret(rows[0].secret_encrypted);
    const isValid = exports.verifyTOTP(secret, tokenStr);

    if (!isValid) {
      return { required: true, verified: false, message: 'Código MFA inválido' };
    }

    return { required: true, verified: true };
  } catch (error) {
    console.error('[MFA] Error verificando:', error.message);
    return { required: false };
  }
};

// ==============================
// VERIFICAR CÓDIGO DE RECUPERACIÓN
// ==============================
async function verifyRecoveryCode(idUsuario, code, mfaConfig) {
  const codeHash = exports.hashRecoveryCode(code);

  try {
    let recoveryCodes;
    try {
      recoveryCodes = typeof mfaConfig.recovery_codes === 'string'
        ? JSON.parse(mfaConfig.recovery_codes)
        : mfaConfig.recovery_codes;
    } catch (_) {
      return { required: true, verified: false, message: 'Código inválido' };
    }

    if (!Array.isArray(recoveryCodes)) {
      return { required: true, verified: false, message: 'Código inválido' };
    }

    const codeIndex = recoveryCodes.indexOf(codeHash);
    if (codeIndex === -1) {
      return { required: true, verified: false, message: 'Código de recuperación inválido' };
    }

    // Eliminar código usado
    recoveryCodes.splice(codeIndex, 1);
    await pool.execute(
      `UPDATE mfa_config SET recovery_codes = ? WHERE id_usuario = ?`,
      [JSON.stringify(recoveryCodes), idUsuario]
    );

    return { required: true, verified: true, isRecoveryCode: true };
  } catch (error) {
    return { required: true, verified: false, message: 'Error verificando código' };
  }
}

// ==============================
// DESHABILITAR MFA
// ==============================
exports.disableMFA = async (idUsuario, token) => {
  try {
    const [rows] = await pool.execute(
      `SELECT secret_encrypted, activo FROM mfa_config WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length || !rows[0].activo) {
      return { success: false, message: 'MFA no está activo' };
    }

    // Verificar código antes de deshabilitar
    if (token && rows[0].secret_encrypted) {
      const secret = decryptSecret(rows[0].secret_encrypted);
      const isValid = exports.verifyTOTP(secret, String(token).trim());
      if (!isValid) {
        return { success: false, message: 'Código MFA inválido' };
      }
    }

    await pool.execute(
      `UPDATE mfa_config SET activo = 0 WHERE id_usuario = ?`,
      [idUsuario]
    );

    return { success: true, message: 'MFA deshabilitado correctamente' };
  } catch (error) {
    console.error('[MFA] Error deshabilitando:', error.message);
    return { success: false, message: 'Error deshabilitando MFA' };
  }
};

// ==============================
// OBTENER ESTADO MFA
// ==============================
exports.getMFAStatus = async (idUsuario) => {
  try {
    const [rows] = await pool.execute(
      `SELECT activo, created_at FROM mfa_config WHERE id_usuario = ? LIMIT 1`,
      [idUsuario]
    );

    if (!rows.length) {
      return { configured: false, active: false };
    }

    return {
      configured: true,
      active: rows[0].activo === 1,
      createdAt: rows[0].created_at
    };
  } catch (_) {
    return { configured: false, active: false };
  }
};
