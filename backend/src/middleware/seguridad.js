'use strict';

// backend/src/middleware/seguridad.js
// Middleware de seguridad global: rate limiting, sanitización XSS, fingerprint de dispositivo

const crypto = require('crypto');
const pool = require('../config/db');

// ==============================
// UTILIDADES
// ==============================

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || ''
  ];
  return crypto
    .createHash('sha256')
    .update(components.join('|||'))
    .digest('hex')
    .slice(0, 32);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      clean[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// ==============================
// RATE LIMITING EN MEMORIA (simple, sin dependencias extra)
// ==============================

const rateLimitStore = new Map();

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

function rateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Demasiadas solicitudes. Intenta más tarde.' } = {}) {
  cleanupExpiredEntries();
  return (req, res, next) => {
    const key = `${getClientIp(req)}:${req.path}`;
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
      res.set('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    entry.count++;
    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      logSuspiciousActivity(req, 'RATE_LIMIT_EXCEEDED', { path: req.path, count: entry.count });
      return res.status(429).json({ ok: false, message });
    }
    next();
  };
}

// ==============================
// SANITIZACIÓN XSS
// ==============================

function xssSanitizer(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

// ==============================
// LOG DE ACTIVIDAD SOSPECHOSA
// ==============================

async function logSuspiciousActivity(req, tipo, detalle = {}) {
  try {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const userId = req.user?.id_usuario || null;
    const fingerprint = generateDeviceFingerprint(req);

    await pool.execute(
      `INSERT INTO intentos_sospechosos
       (id_usuario, tipo_evento, ip_origen, user_agent, dispositivo_hash, detalle_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        tipo,
        ip,
        ua.slice(0, 500),
        fingerprint,
        JSON.stringify(detalle).slice(0, 2000)
      ]
    );
  } catch (_) {
    // No romper el request si el log falla (tabla puede no existir aún)
  }
}

// ==============================
// VERIFICACIÓN DE IP BLOQUEADA
// ==============================

function ipBlockCheck(req, res, next) {
  const ip = getClientIp(req);
  const sql = `SELECT id FROM ips_bloqueadas WHERE ip_address = ? AND activo = 1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`;
  pool.execute(sql, [ip])
    .then(([rows]) => {
      if (rows.length > 0) {
        logSuspiciousActivity(req, 'BLOCKED_IP_ACCESS');
        return res.status(403).json({ ok: false, message: 'Acceso denegado.' });
      }
      next();
    })
    .catch(() => {
      // Si la tabla no existe, permitir acceso
      next();
    });
}

// ==============================
// TRACKING DE DISPOSITIVO
// ==============================

async function trackDevice(req, userId) {
  try {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const fingerprint = generateDeviceFingerprint(req);

    // Verificar si el dispositivo ya es conocido
    const [existing] = await pool.execute(
      `SELECT id, es_confiable FROM dispositivos_conocidos
       WHERE id_usuario = ? AND dispositivo_hash = ? LIMIT 1`,
      [userId, fingerprint]
    );

    if (existing.length > 0) {
      // Actualizar último visto
      await pool.execute(
        `UPDATE dispositivos_conocidos SET ultimo_visto = NOW(), ip_ultima_sesion = ? WHERE id = ?`,
        [ip, existing[0].id]
      );
      return { isNew: false, isTrusted: existing[0].es_confiable === 1 };
    }

    // Dispositivo nuevo: registrar
    await pool.execute(
      `INSERT INTO dispositivos_conocidos
       (id_usuario, dispositivo_hash, user_agent, ip_primera_sesion, ip_ultima_sesion, es_confiable, created_at, ultimo_visto)
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [userId, fingerprint, ua.slice(0, 500), ip, ip]
    );

    logSuspiciousActivity(req, 'NEW_DEVICE_LOGIN', { userId, fingerprint: fingerprint.slice(0, 8) });

    // Auditoría específica para login desde dispositivo nuevo
    try {
      const { registrarAuditoria } = require('./auditoria');
      await registrarAuditoria({
        id_usuario: userId,
        modulo: 'SEGURIDAD',
        accion: 'NEW_DEVICE_LOGIN',
        descripcion: `Login desde dispositivo nuevo — IP: ${ip}, UA: ${ua.slice(0, 100)}`,
        nivel: 'WARNING',
        req
      });
    } catch (_) {}

    return { isNew: true, isTrusted: false };
  } catch (_) {
    return { isNew: false, isTrusted: true };
  }
}

// ==============================
// HEADERS DE SEGURIDAD ADICIONALES
// ==============================

function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// ==============================
// EXPORTS
// ==============================

module.exports = {
  rateLimiter,
  xssSanitizer,
  securityHeaders,
  ipBlockCheck,
  trackDevice,
  logSuspiciousActivity,
  generateDeviceFingerprint,
  getClientIp
};
