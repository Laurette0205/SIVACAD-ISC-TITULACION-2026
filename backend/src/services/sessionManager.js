'use strict';

// backend/src/services/sessionManager.js
// Servicio de gestión de sesiones con blacklist de tokens
// y control de sesiones concurrentes

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const MAX_CONCURRENT_SESSIONS = 3;

// ==============================
// HASHEAR TOKEN (SHA-256)
// ==============================
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ==============================
// EXTRAER TOKEN DEL HEADER
// ==============================
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

// ==============================
// AGREGAR TOKEN A BLACKLIST
// ==============================
exports.addToBlacklist = async (token, razon = 'logout', tipo = 'access') => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return;

    const tokenHash = hashToken(token);
    const expiraEn = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    const idUsuario = decoded.id_usuario;

    await pool.execute(
      `INSERT INTO token_blacklist (token_hash, tipo, id_usuario, razon, expira_en, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE razon = VALUES(razon)`,
      [tokenHash, tipo, idUsuario, razon, expiraEn]
    );
  } catch (error) {
    console.error('[SESSION] Error agregando a blacklist:', error.message);
  }
};

// ==============================
// VERIFICAR SI TOKEN ESTÁ EN BLACKLIST
// ==============================
exports.isBlacklisted = async (token) => {
  try {
    const tokenHash = hashToken(token);

    const [rows] = await pool.execute(
      `SELECT id FROM token_blacklist
       WHERE token_hash = ? AND expira_en > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    return rows.length > 0;
  } catch (_) {
    // Si la tabla no existe, permitir acceso
    return false;
  }
};

// ==============================
// CERRAR SESIÓN (logout)
// ==============================
exports.logout = async (token, razon = 'logout') => {
  const tipo = 'access';
  await exports.addToBlacklist(token, razon, tipo);
};

// ==============================
// CERRAR TODAS LAS SESIONES DE UN USUARIO
// ==============================
exports.logoutAllSessions = async (idUsuario, razon = 'logout_all') => {
  try {
    await pool.execute(
      `UPDATE token_blacklist
       SET razon = ?
       WHERE id_usuario = ? AND tipo = 'refresh' AND expira_en > NOW()`,
      [razon, idUsuario]
    );

    // También marcar sesiones activas como inactivas
    try {
      await pool.execute(
        `UPDATE sesiones_activas
         SET activa = 0
         WHERE id_usuario = ? AND activa = 1`,
        [idUsuario]
      );
    } catch (_) {}
  } catch (_) {}
};

// ==============================
// GESTIÓN DE SESIONES CONCURRENTES
// ==============================
exports.trackSession = async (idUsuario, token, req) => {
  try {
    const tokenHash = hashToken(token);
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || '0.0.0.0';
    const ua = req.headers['user-agent'] || '';

    const fingerprint = crypto
      .createHash('sha256')
      .update(ua)
      .digest('hex')
      .slice(0, 32);

    const expiraEn = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

    await pool.execute(
      `INSERT INTO sesiones_activas (id_usuario, token_hash, dispositivo_hash, ip_origen, user_agent, activa, created_at, ultimo_acceso, expira_en)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), ?)`,
      [idUsuario, tokenHash, fingerprint, ip, ua.slice(0, 500), expiraEn]
    );

    // Verificar sesiones concurrentes
    const [activeSessions] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM sesiones_activas
       WHERE id_usuario = ? AND activa = 1 AND expira_en > NOW()`,
      [idUsuario]
    );

    if (activeSessions[0].total > MAX_CONCURRENT_SESSIONS) {
      // Eliminar la sesión más antigua
      await pool.execute(
        `UPDATE sesiones_activas
         SET activa = 0
         WHERE id_usuario = ? AND activa = 1
         ORDER BY ultimo_acceso ASC
         LIMIT 1`,
        [idUsuario]
      );
    }
  } catch (_) {
    // No romper el login si el tracking falla
  }
};

// ==============================
// MIDDLEWARE: checkBlacklist
// ==============================
exports.checkBlacklistMiddleware = async (req, res, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return next();

  try {
    const isBlacklisted = await exports.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        ok: false,
        message: 'Sesión cerrada. Inicia sesión nuevamente.'
      });
    }
  } catch (_) {
    // Si falla, permitir (no bloquear por error de blacklist)
  }

  next();
};

exports.hashToken = hashToken;
exports.MAX_CONCURRENT_SESSIONS = MAX_CONCURRENT_SESSIONS;
