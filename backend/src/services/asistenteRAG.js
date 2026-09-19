'use strict';

const { searchScholarships: searchScholarshipsVector } = require('./becasVectorStore');
const { searchOfficialScholarships, buildScholarshipSummary } = require('./BecasEdomexService');

const CONTENT_CATEGORY_MAP = {
  BECAS: ['BECAS'],
  STATS: ['ESTADISTICAS'],
  WELCOME: ['GENERAL', 'ROL'],
  ACADEMICO: ['ACADEMICO', 'ROL'],
  BIENESTAR: ['BIENESTAR'],
  SOPORTE: ['SOPORTE'],
  DOC_GROUPS: ['ROL'],
  DOC_STUDENTS: ['ROL'],
  DOC_EVALS: ['ROL'],
  DOC_KARDEX: ['ROL'],
  ALUM_DASHBOARD: ['ACADEMICO', 'ROL'],
  ALUM_KARDEX: ['ACADEMICO', 'ROL'],
  ALUM_INSCRIPCIONES: ['ACADEMICO', 'ROL'],
  ALUM_EVALUACIONES: ['ACADEMICO', 'ROL'],
  SOP_DASHBOARD: ['SOPORTE'],
  SOP_INCIDENCIAS: ['SOPORTE'],
  SOP_BITACORA: ['SOPORTE'],
  SOP_SESIONES: ['SOPORTE'],
  SOP_RESETS: ['SOPORTE'],
  COORD_DASHBOARD: ['ROL'],
  COORD_TRACKING: ['ROL'],
  COORD_ALERTS: ['ROL'],
  COORD_REPORT: ['ROL'],
  ADMIN_DASHBOARD: ['ROL'],
  ADMIN_AUDIT: ['ROL'],
  ADMIN_CONFIG: ['ROL'],
  GENERAL: ['GENERAL', 'ROL']
};

async function getAsistenteContenido(pool, intent, roleName) {
  const categories = CONTENT_CATEGORY_MAP[intent] || (intent === 'GENERAL' ? ['GENERAL'] : []);
  const role = normalizeRoleName(roleName);

  if (!categories.length) return [];

  const [rows] = await pool.query(
    `
    SELECT codigo_contenido, categoria, titulo, contenido, rol_objetivo, etiquetas
    FROM asistente_contenidos
    WHERE activo = 1
      AND (rol_objetivo = 'TODOS' OR rol_objetivo = ? OR ? = 'TODOS')
      AND categoria IN (?)
    ORDER BY orden_visual ASC
    LIMIT 5
    `,
    [role, role, categories]
  );

  if (intent === 'WELCOME') return rows || [];

  return (rows || []).filter(r => {
    const title = String(r.titulo || '').toLowerCase();
    return !title.includes('bienvenida') && !title.includes('ayuda para');
  });
}

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function buildContenidoContext(rows = [], roleName) {
  if (!rows.length) return '';

  const role = normalizeRoleName(roleName);
  const relevant = rows.filter(
    (r) => r.rol_objetivo === 'TODOS' || normalizeRoleName(r.rol_objetivo) === role || role === 'TODOS'
  );

  return relevant
    .map((r) => `[${r.categoria}] ${r.titulo}: ${r.contenido}`)
    .join('\n\n');
}

async function searchScholarships(pool, query, options = {}) {
  const limit = Math.max(1, Number(options.limit || 5));
  const vectorResults = await searchScholarshipsVector(pool, query, { limit }).catch(() => []);
  const officialResults = searchOfficialScholarships(query, { limit });

  const merged = [...vectorResults, ...officialResults]
    .filter(Boolean)
    .reduce((acc, item) => {
      const key = item.codigo_fuente || item.codigo || item.titulo;
      if (!acc.has(key)) acc.set(key, item);
      return acc;
    }, new Map());

  return Array.from(merged.values()).slice(0, limit);
}

function rankScholarshipResults(items = []) {
  return [...items].sort((a, b) => {
    const scoreA = Number(a?.score || 0);
    const scoreB = Number(b?.score || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;

    const dateA = new Date(a?.fecha_fin || a?.vigencia_fin || 0).getTime();
    const dateB = new Date(b?.fecha_fin || b?.vigencia_fin || 0).getTime();
    return dateA - dateB;
  });
}

function buildScholarshipContextMessage(items = []) {
  if (!items.length) {
    return 'No encontré convocatorias vigentes con ese criterio. Revisa el portal oficial de becas de la SECTI.';
  }

  const ranked = rankScholarshipResults(items);
  const first = ranked[0];
  const bullets = ranked.slice(0, 3).map((item, index) => {
    const title = item?.titulo || `Convocatoria ${index + 1}`;
    const summary = item?.resumen || item?.descripcion || buildScholarshipSummary(item);
    return `${index + 1}. ${title} — ${summary}`;
  });

  return [
    `Encontré ${ranked.length} convocatoria(s) relacionada(s).`,
    `La primera opción es "${first?.titulo || 'N/D'}".`,
    ...bullets
  ].join('\n');
}

module.exports = {
  searchScholarships,
  rankScholarshipResults,
  buildScholarshipContextMessage,
  getAsistenteContenido,
  buildContenidoContext
};