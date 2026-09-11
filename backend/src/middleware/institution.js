'use strict';

// backend/src/middleware/institution.js
// Middleware para resolver la institución del usuario autenticado
// y proveer helper byInstitution() para filtrar queries

const pool = require('../config/db');

// Cache en memoria con TTL de 5 minutos
const institutionCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedInstitution(idInstitucion) {
  const entry = institutionCache.get(idInstitucion);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    institutionCache.delete(idInstitucion);
    return null;
  }
  return entry.data;
}

function setCachedInstitution(idInstitucion, data) {
  institutionCache.set(idInstitucion, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function invalidateInstitutionCache(idInstitucion) {
  institutionCache.delete(idInstitucion);
}

// ==============================
// MIDDLEWARE: resolveInstitution
// ==============================
// Extrae id_institucion del JWT y resuelve configuración completa
// Adjunta req.institution con los datos de la institución
exports.resolveInstitution = async (req, res, next) => {
  try {
    const idInstitucion = req.user?.id_institucion || 1;

    let institution = getCachedInstitution(idInstitucion);

    if (!institution) {
      const [rows] = await pool.execute(
        `SELECT
          id_institucion,
          nombre_corto,
          nombre_completo,
          nombre_legal,
          dominios_email,
          logo_url,
          color_primario,
          color_secundario,
          telefono_crisis,
          frontend_url,
          formato_matricula,
          formato_folio_tramite
         FROM instituciones
         WHERE id_institucion = ? AND activa = 1
         LIMIT 1`,
        [idInstitucion]
      );

      if (!rows.length) {
        return res.status(400).json({
          ok: false,
          message: 'Institución no válida o inactiva'
        });
      }

      institution = rows[0];
      setCachedInstitution(idInstitucion, institution);
    }

    req.institution = institution;
    req.id_institucion = idInstitucion;
    next();
  } catch (error) {
    console.error('[INSTITUTION] Error resolviendo institución:', error.message);
    // Fallback a TESI si la tabla no existe aún
    req.institution = {
      id_institucion: 1,
      nombre_corto: 'TESI',
      nombre_completo: 'Tecnológico de Estudios Superiores de Ixtapaluca',
      nombre_legal: 'Tecnológico de Estudios Superiores de Ixtapaluca (TESI)',
      dominios_email: JSON.stringify(['tesi.edu.mx', 'ixtapaluca.tecnm.mx', 'ixtapaluca.tecnm.edu.mx', 'outlook.com', 'outlook.es']),
      logo_url: null,
      color_primario: '#1a56db',
      color_secundario: '#1e40af',
      telefono_crisis: null,
      frontend_url: 'http://localhost:5173',
      formato_matricula: 'ISC-{YYYY}-{NNN}',
      formato_folio_tramite: 'TRM-{YYYY}-{NNN}'
    };
    req.id_institucion = 1;
    next();
  }
};

// ==============================
// HELPER: byInstitution
// ==============================
// Filtra una query SQL por id_institucion
// Uso: const [rows] = await pool.execute(byInstitution('SELECT * FROM alumnos'), [idInstitucion]);
function byInstitution(baseQuery, idInstitucion) {
  const id = idInstitucion || 1;
  // Si ya tiene WHERE, agrega AND. Si no, agrega WHERE.
  const upperQuery = baseQuery.toUpperCase();
  if (upperQuery.includes('WHERE')) {
    return `${baseQuery} AND id_institucion = ?`;
  }
  return `${baseQuery} WHERE id_institucion = ?`;
}

exports.byInstitution = byInstitution;

// ==============================
// HELPER: byInstitutionParams
// ==============================
// Para queries con parámetros existentes, agrega id_institucion al final
function byInstitutionParams(existingParams, idInstitucion) {
  return [...(existingParams || []), idInstitucion || 1];
}

exports.byInstitutionParams = byInstitutionParams;

// ==============================
// MIDDLEWARE: requireInstitutionFeature
// ==============================
// Verifica que la institución tenga habilitado un feature específico
exports.requireInstitutionFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const idInstitucion = req.id_institucion || 1;

      const [rows] = await pool.execute(
        `SELECT habilitado
         FROM instituciones_features
         WHERE id_institucion = ? AND feature_key = ?
         LIMIT 1`,
        [idInstitucion, featureKey]
      );

      if (!rows.length || rows[0].habilitado !== 1) {
        return res.status(403).json({
          ok: false,
          message: `El módulo "${featureKey}" no está habilitado para su institución`
        });
      }

      next();
    } catch (error) {
      // Si la tabla no existe, permitir acceso (fallback)
      next();
    }
  };
};

exports.invalidateInstitutionCache = invalidateInstitutionCache;
