'use strict';

// backend/src/services/institutionConfig.js
// Servicio de configuración de institución con cache en memoria
// Resuelve dominios email, logos, prompts de IA, features, etc.

const pool = require('../config/db');

// Cache con TTL de 5 minutos
const configCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const entry = configCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    configCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  configCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function invalidateCache(pattern) {
  for (const key of configCache.keys()) {
    if (key.startsWith(pattern)) {
      configCache.delete(key);
    }
  }
}

// ==============================
// RESOLVER INSTITUCIÓN POR DOMINIO DE EMAIL
// ==============================
exports.resolveByDomain = async (email) => {
  const value = String(email || '').trim().toLowerCase();
  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1) return null;

  const domain = value.slice(atIndex + 1).trim();

  const cacheKey = `domain:${domain}`;
  let instituciones = getCached(cacheKey);

  if (instituciones === null) {
    try {
      const [rows] = await pool.execute(
        `SELECT id_institucion, nombre_corto, dominios_email
         FROM instituciones
         WHERE activa = 1`
      );

      instituciones = rows;
      setCache(cacheKey, instituciones);
    } catch (_) {
      return null;
    }
  }

  for (const inst of instituciones) {
    let dominios;
    try {
      dominios = typeof inst.dominios_email === 'string'
        ? JSON.parse(inst.dominios_email)
        : inst.dominios_email;
    } catch (_) {
      continue;
    }

    if (Array.isArray(dominios) && dominios.some(d => domain === d || domain.endsWith(`.${d}`))) {
      return inst.id_institucion;
    }
  }

  return null;
};

// ==============================
// OBTENER CONFIGURACIÓN COMPLETA
// ==============================
exports.getConfig = async (idInstitucion) => {
  const cacheKey = `config:${idInstitucion}`;
  let config = getCached(cacheKey);

  if (config) return config;

  try {
    const [instRows] = await pool.execute(
      `SELECT * FROM instituciones WHERE id_institucion = ? AND activa = 1 LIMIT 1`,
      [idInstitucion]
    );

    if (!instRows.length) return null;

    const [features] = await pool.execute(
      `SELECT feature_key, habilitado, config
       FROM instituciones_features
       WHERE id_institucion = ?`,
      [idInstitucion]
    );

    const [prompts] = await pool.execute(
      `SELECT id_prompt, modulo, rol, system_prompt, sufijo_rol
       FROM ia_prompts
       WHERE id_institucion = ? AND activo = 1`,
      [idInstitucion]
    );

    config = {
      institucion: instRows[0],
      features: features.reduce((acc, f) => {
        acc[f.feature_key] = {
          habilitado: f.habilitado === 1,
          config: f.config ? (typeof f.config === 'string' ? JSON.parse(f.config) : f.config) : null
        };
        return acc;
      }, {}),
      prompts: prompts.map(p => ({
        id_prompt: p.id_prompt,
        modulo: p.modulo,
        rol: p.rol,
        system_prompt: p.system_prompt,
        sufijo_rol: p.sufijo_rol
      }))
    };

    setCache(cacheKey, config);
    return config;
  } catch (error) {
    console.error('[INSTITUTION_CONFIG] Error obteniendo configuración:', error.message);
    return null;
  }
};

// ==============================
// OBTENER PROMPT DE IA
// ==============================
exports.getIAPrompt = async (idInstitucion, modulo, rol = null) => {
  const cacheKey = `prompt:${idInstitucion}:${modulo}:${rol || 'global'}`;
  let prompt = getCached(cacheKey);

  if (prompt) return prompt;

  try {
    let sql = `SELECT system_prompt, sufijo_rol
               FROM ia_prompts
               WHERE id_institucion = ? AND modulo = ? AND activo = 1`;

    const params = [idInstitucion, modulo];

    if (rol) {
      sql += ` AND (rol = ? OR rol IS NULL) ORDER BY FIELD(rol, ?) DESC LIMIT 1`;
      params.push(rol, rol);
    } else {
      sql += ` AND rol IS NULL LIMIT 1`;
    }

    const [rows] = await pool.execute(sql, params);

    if (rows.length) {
      prompt = {
        system_prompt: rows[0].system_prompt,
        sufijo_rol: rows[0].sufijo_rol
      };
      setCache(cacheKey, prompt);
    }

    return prompt || null;
  } catch (_) {
    return null;
  }
};

// ==============================
// VERIFICAR FEATURE HABILITADO
// ==============================
exports.isFeatureEnabled = async (idInstitucion, featureKey) => {
  const cacheKey = `feature:${idInstitucion}:${featureKey}`;
  let enabled = getCached(cacheKey);

  if (enabled !== null) return enabled;

  try {
    const [rows] = await pool.execute(
      `SELECT habilitado
       FROM instituciones_features
       WHERE id_institucion = ? AND feature_key = ?
       LIMIT 1`,
      [idInstitucion, featureKey]
    );

    enabled = rows.length > 0 && rows[0].habilitado === 1;
    setCache(cacheKey, enabled);
    return enabled;
  } catch (_) {
    return true; // Si la tabla no existe, asumir habilitado
  }
};

// ==============================
// INVALIDAR CACHES
// ==============================
exports.invalidateAll = (idInstitucion) => {
  invalidateCache(`${idInstitucion}`);
};

exports.invalidateConfig = (idInstitucion) => {
  configCache.delete(`config:${idInstitucion}`);
};

exports.invalidatePrompts = (idInstitucion) => {
  invalidateCache(`prompt:${idInstitucion}`);
};
