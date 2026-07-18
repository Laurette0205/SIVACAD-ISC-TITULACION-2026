'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let becasEdomexService = {};
try {
  becasEdomexService = require('../services/BecasEdomexService');
} catch (error) {
  console.warn('[iaBecas] BecasEdomexService no encontrado. Se usará fallback vacío.');
}

const becasVectorStore = require('../services/becasVectorStore');
const becasTools = require('../services/becasTools');

// ...mantén tu lógica, pero usa valores por defecto seguros
const {
  OFFICIAL_BECAS_CATALOG = [],
  BECAS_PORTAL_OFICIAL_URL = 'https://secti.edomex.gob.mx/becas',
  searchOfficialScholarships = () => [],
  buildScholarshipNotification = () => null,
  scholarshipToSource = (item) => item,
  getScholarshipById: getOfficialScholarshipById = () => null
} = becasEdomexService || {};

// ...el resto del archivo puede quedarse igual

const {
  ensureBecasTables = async () => {},
  searchScholarships = async () => [],
  getScholarshipContext = async () => ({ results: [], sources: [] }),
  getScholarshipById = async () => null,
  ingestScholarshipsFromSources = async () => ({ ingested: 0, sources: [] }),
  seedOfficialScholarships = async () => {},
  DEFAULT_BECAS_SOURCES = []
} = becasVectorStore || {};

const {
  getStudentAverage = async () => null,
  getStudentEligibility = async () => ({ eligible: false, mensaje: 'No disponible' }),
  resolveStudentIdentity = async () => null
} = becasTools || {};

const router = express.Router();

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const IS_GEMINI_VALID = GEMINI_API_KEY.startsWith('AIza');
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const GEMINI_TIMEOUT_MS = Math.max(5000, Number(process.env.GEMINI_TIMEOUT_MS || 15000));
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

const ADMIN_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR']);

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeLower(value) {
  return String(value || '').trim().toLowerCase();
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token no disponible' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
}

function canManageBecas(user) {
  const role = normalize(user?.rol_nombre || user?.rol || user?.role);
  const roleId = Number(user?.rol_id || user?.id_rol || 0);
  return ADMIN_ROLES.has(role) || [1, 2].includes(roleId);
}

function extractJsonCandidate(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeScholarshipItem(item = {}) {
  return {
    id_fuente: Number(item.id_fuente || item.id || 0),
    codigo_fuente: String(item.codigo_fuente || item.codigo || '').trim(),
    titulo: String(item.titulo || '').trim(),
    url_origen: String(item.url_origen || item.url || '').trim(),
    tipo_fuente: String(item.tipo_fuente || item.categoria || 'OFICIAL').trim(),
    fecha_publicacion: item.fecha_publicacion || null,
    vigencia_inicio: item.vigencia_inicio || null,
    vigencia_fin: item.vigencia_fin || null,
    vigencia_texto: item.vigencia_texto || item.vigencia?.registro || 'Consultar convocatoria vigente',
    resumen: String(item.resumen || '').trim(),
    descripcion: String(item.descripcion || '').trim(),
    estado: String(item.estado || 'Consultar convocatoria').trim(),
    alcance: String(item.alcance || 'Estado de México').trim(),
    nivel: Array.isArray(item.nivel) ? item.nivel : [],
    requisitos: Array.isArray(item.requisitos) ? item.requisitos : [],
    beneficios: Array.isArray(item.beneficios) ? item.beneficios : [],
    portal_oficial: String(item.portal_oficial || BECAS_PORTAL_OFICIAL_URL).trim(),
    score: Number(item.score || 0),
    snippet: String(item.snippet || item.resumen || item.descripcion || '').trim()
  };
}

function dedupeScholarships(items = []) {
  const map = new Map();

  for (const item of items) {
    const normalized = normalizeScholarshipItem(item);
    const key = normalized.codigo_fuente || normalized.titulo || String(normalized.id_fuente);
    const current = map.get(key);

    if (!current || normalized.score > current.score) {
      map.set(key, normalized);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function classifyIntent(message) {
  const text = normalizeLower(message);

  const privateSignals = [
    'mi promedio',
    'mis materias',
    'mi calificacion',
    'mi calificación',
    'soy elegible',
    'tengo derecho',
    'estatus académico',
    'estatus academico',
    'mi kardex',
    'mi historial',
    'puedo aplicar',
    'beca para mí',
    'beca para mi',
    'mi beca',
    'mi elegibilidad'
  ];

  const publicSignals = [
    'beca',
    'becas',
    'convocatoria',
    'convocatorias',
    'requisitos',
    'apoyo económico',
    'apoyo economico',
    'edomex',
    'gaceta',
    'comecyt',
    'santander',
    'bbva'
  ];

  if (privateSignals.some((term) => text.includes(term))) return 'PRIVATE';
  if (publicSignals.some((term) => text.includes(term))) return 'RAG';
  return 'GENERAL';
}

function buildScholarshipPrompt({ message, context = [], student = null }) {
  const contextText = context
    .map((item, index) => {
      const source = item.codigo_fuente || item.titulo || `Fuente ${index + 1}`;
      const excerpt = item.snippet || item.resumen || item.descripcion || '';
      const url = item.url_origen || item.url || '';
      return `FUENTE ${index + 1} (${source})\nURL: ${url}\nTEXTO: ${excerpt}`;
    })
    .join('\n\n');

  const studentText = student
    ? JSON.stringify(student, null, 2)
    : 'No hay datos privados del alumno en esta consulta.';

  return `
Eres el asistente institucional de becas de SIVACAD.
Responde en español, claro, breve y preciso.
Prioriza fuentes oficiales de SECTI, COMECYT, Santander Open Academy y Fundación BBVA.
No inventes fechas. Si la fecha de registro no aparece en el contexto, responde: "consulta la convocatoria vigente en el portal oficial".
Si la consulta es privada, usa únicamente los datos del alumno proporcionados.
Si detectas una beca o convocatoria, sugiere el portal oficial de la SECTI:
${BECAS_PORTAL_OFICIAL_URL}

Consulta:
${String(message || '').trim()}

Datos del alumno:
${studentText}

Contexto recuperado:
${contextText}

Devuelve SOLO JSON válido con esta forma exacta:
{
  "respuesta": "texto final para el usuario",
  "tipo": "RAG|PRIVATE|GENERAL",
  "acciones_sugeridas": ["..."],
  "fuentes_utilizadas": [
    {
      "id_fuente": 1,
      "titulo": "..."
    }
  ]
}
`.trim();
}

async function geminiGenerate(prompt) {
  if (!IS_GEMINI_VALID || typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || 'No fue posible consultar Gemini.');
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join('\n')
      .trim();

    return extractJsonCandidate(text);
  } catch (error) {
    if (String(error?.name || '').toLowerCase() === 'aborterror') return null;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildFallbackAnswer({ intent, results = [], average = null, eligibility = null }) {
  const top = results[0] || null;
  const title = top?.titulo || 'Portal oficial de becas';
  const summary = top?.snippet || top?.resumen || top?.descripcion || `Consulta el portal oficial en ${BECAS_PORTAL_OFICIAL_URL}.`;

  if (intent === 'PRIVATE') {
    const averageText = average?.promedio_general !== undefined && average?.promedio_general !== null
      ? `Tu promedio actual es ${Number(average.promedio_general).toFixed(2)}.`
      : 'No pude consultar tu promedio.';
    const eligibilityText = eligibility?.mensaje || 'Puedo ayudarte a revisar tu elegibilidad si me indicas la beca que quieres.';
    return {
      respuesta: `${averageText} ${eligibilityText} ${top ? `Te sugiero revisar: ${title}. ${summary}` : `Revisa el portal oficial para confirmar la convocatoria vigente.`}`.trim(),
      acciones_sugeridas: [
        'Revisar convocatoria oficial',
        'Confirmar requisitos',
        'Abrir portal oficial'
      ]
    };
  }

  return {
    respuesta: `${title}. ${summary} ${top?.vigencia_texto || 'Consulta la convocatoria vigente para confirmar fechas y registro.'}`.trim(),
    acciones_sugeridas: [
      'Abrir portal oficial',
      'Revisar requisitos',
      'Guardar convocatoria'
    ]
  };
}

async function buildAnswer({ message, user, mode = 'AUTO', scholarshipId = 0 }) {
  const normalizedMode = normalize(mode);
  const intent = normalizedMode === 'RAG' || normalizedMode === 'PRIVATE'
    ? normalizedMode
    : classifyIntent(message);

  let officialResults = await Promise.resolve(searchOfficialScholarships(message, { limit: 5 })).catch(() => []);

  if (scholarshipId > 0) {
    const pinnedOfficial = getOfficialScholarshipById(scholarshipId);
    if (pinnedOfficial) {
      officialResults = dedupeScholarships([pinnedOfficial, ...officialResults]);
    } else {
      const storedScholarship = await getScholarshipById(pool, scholarshipId).catch(() => null);
      if (storedScholarship) {
        officialResults = dedupeScholarships([storedScholarship, ...officialResults]);
      }
    }
  }

  const dbContext = await getScholarshipContext(pool, message, { limit: 5 }).catch(() => ({ results: [], sources: [] }));
  const results = dedupeScholarships([...(dbContext.results || []), ...officialResults]).slice(0, 5);

  const fuentes = dedupeScholarships([...(dbContext.results || []), ...results]).map((item) => ({
    id_fuente: item.id_fuente,
    codigo_fuente: item.codigo_fuente,
    titulo: item.titulo,
    url_origen: item.url_origen,
    tipo_fuente: item.tipo_fuente,
    fecha_publicacion: item.fecha_publicacion || null,
    vigencia_inicio: item.vigencia_inicio || null,
    vigencia_fin: item.vigencia_fin || null,
    vigencia_texto: item.vigencia_texto || item.vigencia?.registro || 'Consultar convocatoria vigente',
    resumen: item.resumen || item.snippet || '',
    estado: item.estado || 'Consultar convocatoria',
    alcance: item.alcance || 'Estado de México',
    nivel: item.nivel || []
  }));

  const notification = buildScholarshipNotification(results);

  if (intent === 'PRIVATE') {
    let student = null;
    let average = null;
    let eligibility = null;

    try {
      student = await resolveStudentIdentity(pool, user);
      average = await getStudentAverage(pool, student);
      eligibility = await getStudentEligibility(pool, student, message);
    } catch (error) {
      student = null;
      average = null;
      eligibility = {
        eligible: false,
        mensaje: 'No fue posible calcular la elegibilidad con la sesión actual.'
      };
    }

    try {
      const prompt = buildScholarshipPrompt({
        message,
        context: results,
        student: {
          estudiante: student,
          promedio_actual: average,
          elegibilidad: eligibility
        }
      });

      const ai = await geminiGenerate(prompt);
      const fallback = buildFallbackAnswer({
        intent,
        results,
        average,
        eligibility
      });

      return {
        ok: true,
        mode: 'PRIVATE',
        respuesta: ai?.respuesta || fallback.respuesta,
        acciones_sugeridas: Array.isArray(ai?.acciones_sugeridas) && ai.acciones_sugeridas.length
          ? ai.acciones_sugeridas
          : fallback.acciones_sugeridas,
        notificacion: notification,
        notification,
        data: {
          promedio: average,
          elegibilidad: eligibility,
          contexto: results,
          fuentes
        },
        fuentes
      };
    } catch (error) {
      const fallback = buildFallbackAnswer({
        intent,
        results,
        average,
        eligibility
      });

      return {
        ok: true,
        mode: 'PRIVATE',
        respuesta: fallback.respuesta,
        acciones_sugeridas: fallback.acciones_sugeridas,
        notificacion: notification,
        notification,
        data: {
          promedio: average,
          elegibilidad: eligibility,
          contexto: results,
          fuentes
        },
        fuentes
      };
    }
  }

  if (intent === 'RAG') {
    try {
      const prompt = buildScholarshipPrompt({
        message,
        context: results,
        student: null
      });

      const ai = await geminiGenerate(prompt);
      const fallback = buildFallbackAnswer({
        intent,
        results
      });

      return {
        ok: true,
        mode: 'RAG',
        respuesta: ai?.respuesta || fallback.respuesta,
        acciones_sugeridas: Array.isArray(ai?.acciones_sugeridas) && ai.acciones_sugeridas.length
          ? ai.acciones_sugeridas
          : fallback.acciones_sugeridas,
        notificacion: notification,
        notification,
        data: {
          contexto: results,
          fuentes
        },
        fuentes
      };
    } catch (error) {
      const fallback = buildFallbackAnswer({
        intent,
        results
      });

      return {
        ok: true,
        mode: 'RAG',
        respuesta: fallback.respuesta,
        acciones_sugeridas: fallback.acciones_sugeridas,
        notificacion: notification,
        notification,
        data: {
          contexto: results,
          fuentes
        },
        fuentes
      };
    }
  }

  const fallback = buildFallbackAnswer({ intent, results });

  return {
    ok: true,
    mode: 'GENERAL',
    respuesta: fallback.respuesta,
    acciones_sugeridas: fallback.acciones_sugeridas,
    notificacion: notification,
    notification,
    data: {
      contexto: results,
      fuentes
    },
    fuentes
  };
}

router.get('/catalogos', authRequired, async (req, res) => {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    return res.json({
      ok: true,
      portal_oficial: BECAS_PORTAL_OFICIAL_URL,
      catalogos: {
        plantillas: OFFICIAL_BECAS_CATALOG.slice(0, 8).map(scholarshipToSource),
        preguntas: [
          { id: 1, texto: '¿Qué becas Edomex están vigentes para universitarios?' },
          { id: 2, texto: '¿Qué requisitos pide Exención Edomex?' },
          { id: 3, texto: '¿Qué becas COMECYT puedo revisar?' },
          { id: 4, texto: '¿Santander o BBVA tienen becas para estudiantes?' },
          { id: 5, texto: '¿Soy elegible para una beca según mi promedio?' }
        ],
        recursos: OFFICIAL_BECAS_CATALOG.map(scholarshipToSource),
        preguntas_por_plantilla: {}
      },
      notification: {
        title: 'Catálogo oficial listo',
        message: `Se cargaron ${OFFICIAL_BECAS_CATALOG.length} programas base desde fuentes oficiales. Revisa el portal para confirmar si la convocatoria está abierta.`,
        actionLabel: 'Abrir portal oficial',
        actionUrl: BECAS_PORTAL_OFICIAL_URL,
        variant: 'info'
      }
    });
  } catch (error) {
    console.error('Error en catalogos becas:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible cargar los catálogos de becas.'
    });
  }
});

router.get('/resumen', authRequired, async (req, res) => {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    const [statsRows] = await pool.query(
      `SELECT
         COUNT(*) AS total_fuentes,
         COALESCE(SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END), 0) AS fuentes_activas
       FROM becas_fuentes`
    );

    const [chunkRows] = await pool.query(
      `SELECT COUNT(*) AS total_chunks FROM becas_chunks`
    );

    return res.json({
      ok: true,
      data: {
        total_fuentes: Number(statsRows?.[0]?.total_fuentes || OFFICIAL_BECAS_CATALOG.length),
        fuentes_activas: Number(statsRows?.[0]?.fuentes_activas || OFFICIAL_BECAS_CATALOG.length),
        total_chunks: Number(chunkRows?.[0]?.total_chunks || 0)
      },
      notification: {
        title: 'Catálogo oficial listo',
        message: `El asistente de becas ya tiene ${OFFICIAL_BECAS_CATALOG.length} programas base cargados. Consulta el portal oficial para confirmar las fechas vigentes.`,
        actionLabel: 'Abrir portal oficial',
        actionUrl: BECAS_PORTAL_OFICIAL_URL,
        variant: 'info'
      }
    });
  } catch (error) {
    console.error('Error en resumen becas:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible cargar el resumen de becas.'
    });
  }
});

router.get('/alertas', authRequired, async (req, res) => {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    const results = await Promise.resolve(searchOfficialScholarships('', { limit: 5 })).catch(() => []);
    const notification = buildScholarshipNotification(results);

    return res.json({
      ok: true,
      notification,
      data: {
        fuentes: results
      }
    });
  } catch (error) {
    console.error('Error en alertas becas:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible obtener alertas de becas.'
    });
  }
});

router.post('/preguntar', authRequired, async (req, res) => {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    const message = String(req.body?.mensaje || req.body?.pregunta || '').trim();
    const mode = String(req.body?.modo || 'AUTO').trim();
    const scholarshipId = Number(req.body?.id_fuente || req.body?.id_beca || 0);

    if (!message) {
      return res.status(400).json({
        ok: false,
        message: 'La pregunta es obligatoria.'
      });
    }

    const result = await buildAnswer({
      message,
      user: req.user,
      mode: mode.toUpperCase(),
      scholarshipId
    });

    const fuentes = Array.isArray(result?.fuentes) ? result.fuentes : [];

    return res.json({
      ok: true,
      mode: result.mode,
      respuesta: result.respuesta,
      acciones_sugeridas: result.acciones_sugeridas || [],
      notificacion: result.notificacion || result.notification || null,
      notification: result.notification || result.notificacion || null,
      fuentes,
      data: {
        ...(result.data || {}),
        fuentes
      },
      contexto: result.data?.contexto || []
    });
  } catch (error) {
    console.error('Error en IA de becas:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible procesar la consulta de becas.'
    });
  }
});

router.post('/ingestar', authRequired, async (req, res) => {
  try {
    if (!canManageBecas(req.user)) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para ejecutar el ingestor de becas.'
      });
    }

    await ensureBecasTables(pool);

    const result = await ingestScholarshipsFromSources(pool, {
      sources: Array.isArray(req.body?.sources) && req.body.sources.length
        ? req.body.sources
        : DEFAULT_BECAS_SOURCES
    });

    return res.json({
      ok: true,
      message: 'Ingesta completada.',
      data: result
    });
  } catch (error) {
    console.error('Error al ingestar becas:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible ejecutar la ingesta de becas.'
    });
  }
});

router.post('/elegibilidad', authRequired, async (req, res) => {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    const student = await resolveStudentIdentity(pool, req.user, req.body || {});

    if (!student) {
      return res.status(400).json({
        ok: false,
        message:
          'No se pudo identificar al alumno para calcular elegibilidad. Si tu cuenta no es de alumno, envía matrícula o correo.'
      });
    }

    const eligibility = await getStudentEligibility(pool, student, req.body || {});

    return res.json({
      ok: true,
      data: eligibility
    });
  } catch (error) {
    console.error('Error al calcular elegibilidad:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible calcular la elegibilidad.'
    });
  }
});

async function handlePromedio(req, res) {
  try {
    await ensureBecasTables(pool);
    await seedOfficialScholarships(pool);

    const student = await resolveStudentIdentity(pool, req.user, req.body || {});

    if (!student) {
      return res.status(400).json({
        ok: false,
        message:
          'No se pudo identificar al alumno para consultar el promedio. Envía matrícula/correo o usa una sesión de alumno.'
      });
    }

    const average = await getStudentAverage(pool, student);

    return res.json({
      ok: true,
      data: average
    });
  } catch (error) {
    console.error('Error al consultar promedio:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible consultar el promedio.'
    });
  }
}

router.get('/promedio', authRequired, handlePromedio);
router.post('/promedio', authRequired, handlePromedio);

module.exports = router;