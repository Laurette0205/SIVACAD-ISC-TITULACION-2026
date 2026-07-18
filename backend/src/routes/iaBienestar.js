// ==============================
// 📦 IA DE BIENESTAR / ACOMPAÑAMIENTO
// ==============================
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

const router = express.Router();

const mlBridge = require('../services/mlBridge');

const CRISIS_PHONE = '800 911 2000';
const CRISIS_EMERGENCY = '911';
const FRONTEND_URL = String(
  process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'
).replace(/\/$/, '');

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const IS_GEMINI_VALID = GEMINI_API_KEY.startsWith('AIza');
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  const numbers = values
    .map((item) => toNumber(item, null))
    .filter((item) => Number.isFinite(item));

  if (!numbers.length) return null;

  return numbers.reduce((acc, item) => acc + item, 0) / numbers.length;
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: 'Token no disponible'
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o expirado'
    });
  }
}

function getRoleName(user) {
  return normalizeUpper(user?.rol_nombre || user?.rol || user?.role || '');
}

function getRoleLabel(user) {
  const role = getRoleName(user);

  switch (role) {
    case 'ADMINISTRADOR':
      return 'Administrador';
    case 'COORDINADOR':
      return 'Coordinador';
    case 'DOCENTE':
      return 'Docente';
    case 'ALUMNO':
      return 'Alumno';
    case 'SOPORTE':
      return 'Soporte';
    default:
      return 'Usuario institucional';
  }
}

function getCrisisResources() {
  return [
    {
      categoria: 'crisis',
      titulo: 'Línea de la Vida',
      descripcion:
        'Apoyo emocional 24/7, gratuito y confidencial para crisis, ansiedad, depresión y pensamientos suicidas.',
      telefono: CRISIS_PHONE,
      url: null,
      tipo_recurso: 'CONTACTO'
    },
    {
      categoria: 'crisis',
      titulo: 'Emergencia inmediata',
      descripcion:
        'Si existe peligro inmediato para ti o para otra persona, llama de inmediato a emergencias.',
      telefono: CRISIS_EMERGENCY,
      url: null,
      tipo_recurso: 'CONTACTO'
    }
  ];
}

function crisisKeywords() {
  return [
    'suicid',
    'matarme',
    'quitarme la vida',
    'no quiero vivir',
    'quiero morir',
    'hacerme daño',
    'lastimarme',
    'autolesion',
    'autolesión',
    'dañar a alguien',
    'matar a alguien',
    'amenaza de muerte',
    'amenazar de muerte',
    'acabar con mi vida',
    'ya no aguanto',
    'no soporto',
    'desaparecer'
  ];
}

function containsCrisisSignal(text) {
  const value = normalizeLower(text);
  if (!value) return false;

  return crisisKeywords().some((keyword) => value.includes(keyword));
}

function pickNumeric(map, ...aliases) {
  for (const alias of aliases) {
    const value = map[normalizeUpper(alias)];
    const numberValue = toNumber(value, null);
    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
}

function buildResponseMap(respuestas = []) {
  const map = {};

  for (const item of respuestas) {
    const code = normalizeUpper(
      item?.codigo_pregunta ||
        item?.codigo ||
        item?.campo ||
        item?.criterio ||
        item?.key
    );

    if (!code) continue;

    if (
      normalizeUpper(item?.tipo_respuesta) === 'TEXTO' ||
      typeof item?.valor_texto === 'string'
    ) {
      map[code] = normalizeText(item?.valor_texto ?? item?.valor ?? '');
      continue;
    }

    const numeric = toNumber(item?.valor_numero ?? item?.valor, null);
    if (Number.isFinite(numeric)) {
      map[code] = numeric;
    }
  }

  return map;
}

function resolveTemplateProfile(templateCode) {
  const code = normalizeUpper(templateCode);

  switch (code) {
    case 'BIENESTAR_GENERAL':
      return {
        positive: ['ANIMO_GENERAL', 'ENERGIA_DIARIA', 'SUENO_QUALIDAD', 'APOYO_RED', 'ENTORNO_SEGURIDAD'],
        negative: ['ESTRES_GENERAL'],
        focus: 'bienestar general'
      };
    case 'ACOMPAÑAMIENTO_ACADEMICO':
      return {
        positive: ['CONCENTRACION', 'ORGANIZACION', 'MOTIVACION', 'RETROALIMENTACION'],
        negative: ['CARGA_ACADEMICA'],
        focus: 'acompañamiento académico'
      };
    case 'BIENESTAR_LABORAL':
      return {
        positive: ['PAUSAS_ACTIVAS', 'CLIMA_LABORAL', 'BALANCE_VIDA', 'LIMITES_HORARIO'],
        negative: ['CARGA_LABORAL'],
        focus: 'bienestar laboral'
      };
    default:
      return {
        positive: ['ANIMO_GENERAL', 'ENERGIA_DIARIA', 'SUENO_QUALIDAD', 'APOYO_RED', 'ENTORNO_SEGURIDAD'],
        negative: ['ESTRES_GENERAL'],
        focus: 'bienestar general'
      };
  }
}

function computeWellbeingScore(templateCode, valueMap) {
  const profile = resolveTemplateProfile(templateCode);

  const positiveValues = profile.positive
    .map((code) => pickNumeric(valueMap, code))
    .filter((value) => Number.isFinite(value));

  const negativeValues = profile.negative
    .map((code) => pickNumeric(valueMap, code))
    .filter((value) => Number.isFinite(value));

  const positiveAvg = positiveValues.length ? average(positiveValues) : 3;
  const negativeAvg = negativeValues.length ? average(negativeValues) : 3;

  // Riesgo: 1 bajo, 5 alto.
  const riskIndex = clamp(((6 - positiveAvg) + negativeAvg) / 2, 1, 5);
  const wellbeingScore = clamp(Math.round(((6 - riskIndex) / 5) * 100), 0, 100);

  let level = 'Bajo';
  if (riskIndex > 1.7 && riskIndex <= 2.6) level = 'Medio';
  if (riskIndex > 2.6 && riskIndex <= 3.6) level = 'Alto';
  if (riskIndex > 3.6) level = 'Crítico';

  return {
    profile,
    riskIndex: Number(riskIndex.toFixed(2)),
    wellbeingScore,
    level
  };
}

function buildSupportActions(level, templateLabel) {
  const base = [
    'Haz una pausa breve y respira 4-4-6 durante 2 minutos.',
    'Define una sola acción pequeña para las próximas 2 horas.',
    'Reduce ruido, distracciones y notificaciones por un momento.'
  ];

  if (level === 'Medio') {
    return [
      ...base,
      `Agenda un espacio corto para revisar ${templateLabel}.`,
      'Si estás en clase o trabajo, pide apoyo o una pausa breve.'
    ];
  }

  if (level === 'Alto') {
    return [
      'No te quedes a solas con la carga emocional si puedes evitarlo.',
      'Escribe a una persona de confianza o tutor inmediato.',
      'Reduce tareas no urgentes y busca acompañamiento humano hoy mismo.',
      'Si el malestar sube, usa los recursos de crisis del sistema.'
    ];
  }

  if (level === 'Crítico') {
    return [
      'Busca a una persona de confianza ahora mismo.',
      'Llama a Línea de la Vida 800 911 2000 o al 911 si hay peligro inmediato.',
      'No te quedes solo/a con la crisis.',
      'El sistema puede ayudarte a ordenar el siguiente paso, pero no debe reemplazar apoyo humano.'
    ];
  }

  return base;
}

function buildTutorials(level, templateCode) {
  const profile = resolveTemplateProfile(templateCode);

  const library = {
    BIENESTAR_GENERAL: [
      {
        titulo: 'Respiración guiada 4-4-6',
        descripcion: 'Inhala 4 segundos, sostén 4 y exhala 6. Repite 6 veces.'
      },
      {
        titulo: 'Pausa de reconexión',
        descripcion: 'Levántate, toma agua y vuelve solo con una meta concreta.'
      }
    ],
    ACOMPAÑAMIENTO_ACADEMICO: [
      {
        titulo: 'Plan de estudio en bloques',
        descripcion: 'Divide la tarea en bloques de 25 minutos con descansos cortos.'
      },
      {
        titulo: 'Prioridad académica',
        descripcion: 'Hoy solo atiende lo urgente y lo que destraba tu evaluación o avance.'
      }
    ],
    BIENESTAR_LABORAL: [
      {
        titulo: 'Límites de horario',
        descripcion: 'Cierra la jornada con una lista corta de pendientes y una hora de corte.'
      },
      {
        titulo: 'Pausa activa',
        descripcion: 'Estírate, camina 3 minutos y regresa con foco renovado.'
      }
    ]
  };

  return library[normalizeUpper(templateCode)] || library.BIENESTAR_GENERAL;
}

function buildAssistantFallback({ templateLabel, level, wellbeingScore, observations }) {
  const actions = buildSupportActions(level, templateLabel);
  const tutorials = buildTutorials(level, templateLabel);

  let opening = `Te acompaño con ${templateLabel}. Tu acompañamiento estimado es ${wellbeingScore}% y el nivel actual es ${level}.`;

  if (level === 'Alto') {
    opening =
      `Veo señales de carga importante en ${templateLabel}. Vamos a bajar la intensidad y ordenar el siguiente paso.`;
  }

  if (level === 'Crítico') {
    opening =
      'Detecté señales de riesgo alto. Lo más importante ahora es tu seguridad y el contacto humano inmediato.';
  }

  return {
    mensaje: opening,
    resumen:
      observations
        ? `Tomé en cuenta tus observaciones: ${observations.slice(0, 240)}`
        : 'Tomé en cuenta tu chequeo actual.',
    recomendaciones: actions,
    ejercicios: tutorials,
    cierre:
      level === 'Crítico'
        ? `Llama a Línea de la Vida ${CRISIS_PHONE} o al ${CRISIS_EMERGENCY} si existe peligro inmediato.`
        : 'Si quieres, podemos seguir con un plan breve para hoy.'
  };
}

function buildCrisisReply() {
  return {
    mensaje:
      `Detecté una señal de crisis. No estás solo/a. Busca apoyo humano inmediato. En México puedes llamar a Línea de la Vida ${CRISIS_PHONE} y, si hay peligro inmediato, a emergencias ${CRISIS_EMERGENCY}.`,
    recomendaciones: [
      'No te quedes solo/a con esto.',
      'Comparte el estado contigo mismo/a con una persona de confianza ahora.',
      'Aléjate de cualquier objeto o situación de riesgo inmediato.',
      'Usa el apoyo humano antes de continuar la conversación.'
    ],
    ejercicios: [
      {
        titulo: 'Pausa de seguridad',
        descripcion: 'Respira lentamente y acércate a una persona real de confianza.'
      }
    ],
    cierre:
      'La prioridad es tu seguridad. El sistema puede registrar la alerta y orientarte, pero la ayuda humana inmediata es lo más importante.',
    recursos: getCrisisResources()
  };
}

async function callGeminiSupport({ templateLabel, level, wellbeingScore, history = [], observations = '', profileLabel = 'Usuario institucional' }) {
  if (!IS_GEMINI_VALID) return null;

  const systemPrompt = `
Eres la IA de Acompañamiento Estudiantil de SIVACAD.
Respondes en español, con tono cálido, claro, breve y no clínico.
Tu misión es acompañar, ordenar ideas, sugerir micro-acciones y promover apoyo humano.
No diagnostiques, no etiquetes trastornos y no sustituyas terapia.
Si percibes riesgo de autolesión, suicidio o daño a terceros, evita instrucciones detalladas y prioriza ayuda humana inmediata.
Usa lenguaje respetuoso, neutral y motivador.
`.trim();

  const recentHistory = history
    .slice(-8)
    .map((item) => `${normalizeUpper(item.rol_mensaje || item.role || 'user')}: ${normalizeText(item.mensaje || item.content)}`)
    .join('\n');

  const userPrompt = `
Perfil: ${profileLabel}
Plantilla: ${templateLabel}
Nivel estimado: ${level}
Acompañamiento estimado: ${wellbeingScore}%
Observaciones del usuario: ${observations || 'Sin observaciones'}
Historial breve:
${recentHistory || 'Sin historial previo'}

Necesito una respuesta breve con:
1. Validación emocional.
2. Una acción concreta para hoy.
3. Un cierre amable y motivador.
4. Si el nivel es Alto o Crítico, incluye recomendación de apoyo humano.
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    throw new Error('No fue posible generar la respuesta de IA');
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part?.text || '').join('').trim();

  return text || null;
}

async function loadCatalogos(conn) {
  const [plantillas] = await conn.execute(
    `SELECT
      id_plantilla,
      codigo_plantilla,
      nombre_plantilla,
      descripcion,
      tipo_instrumento,
      publico_objetivo,
      escala,
      ponderacion_total,
      regla_oro,
      estado,
      orden_visual
     FROM ia_bienestar_plantillas
     WHERE estado = 'ACTIVA'
     ORDER BY orden_visual ASC, id_plantilla ASC`
  );

  const [preguntas] = await conn.execute(
    `SELECT
      p.id_pregunta,
      p.id_plantilla,
      pl.codigo_plantilla,
      pl.nombre_plantilla,
      p.codigo_pregunta,
      p.criterio,
      p.descripcion,
      p.peso,
      p.tipo_respuesta,
      p.orden_pregunta,
      p.min_valor,
      p.max_valor
     FROM ia_bienestar_plantilla_preguntas p
     INNER JOIN ia_bienestar_plantillas pl ON pl.id_plantilla = p.id_plantilla
     WHERE pl.estado = 'ACTIVA'
     ORDER BY pl.orden_visual ASC, p.orden_pregunta ASC`
  );

  const [recursos] = await conn.execute(
    `SELECT
      id_recurso,
      codigo_recurso,
      categoria,
      tipo_recurso,
      titulo,
      descripcion,
      telefono,
      url,
      orden_visual
     FROM ia_bienestar_recursos
     WHERE activo = 1
     ORDER BY orden_visual ASC, id_recurso ASC`
  );

  const preguntasPorPlantilla = preguntas.reduce((acc, item) => {
    const key = item.codigo_plantilla;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return {
    plantillas,
    preguntas,
    preguntas_por_plantilla: preguntasPorPlantilla,
    recursos
  };
}

async function getLatestSession(conn, userId) {
  const [rows] = await conn.execute(
    `SELECT
      id_sesion,
      id_usuario,
      perfil_usuario,
      titulo,
      objetivo,
      estado,
      nivel_riesgo_actual,
      actualizado_en,
      creado_en
     FROM ia_bienestar_sesiones
     WHERE id_usuario = ?
     ORDER BY actualizado_en DESC, id_sesion DESC
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function createSession(conn, user, payload = {}) {
  const title = normalizeText(payload.titulo_sesion || payload.titulo || '') ||
    `IA de Acompañamiento Estudiantil - ${getRoleLabel(user)}`;

  const objective = normalizeText(payload.objetivo || '') ||
    'Acompañamiento preventivo y seguimiento estudiantil';

  const [result] = await conn.execute(
    `INSERT INTO ia_bienestar_sesiones
      (id_usuario, perfil_usuario, titulo, objetivo, estado, nivel_riesgo_actual, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, 'ACTIVA', 'Bajo', NOW(), NOW())`,
    [
      user.id_usuario,
      getRoleLabel(user),
      title,
      objective
    ]
  );

  return result.insertId;
}

async function saveMessage(conn, sessionId, userId, role, content, riskLevel = 'Bajo', metadata = {}) {
  await conn.execute(
    `INSERT INTO ia_bienestar_mensajes
      (id_sesion, id_usuario, rol_mensaje, mensaje, nivel_riesgo, metadata_json, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      sessionId,
      userId,
      role,
      content,
      riskLevel,
      JSON.stringify(metadata || {})
    ]
  );
}

async function saveCheckin(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO ia_bienestar_checkins
      (id_usuario, id_sesion, codigo_plantilla, bienestar_score, indice_riesgo, nivel_riesgo,
       animo, energia, sueno, estres, apoyo, ambiente, carga_academica, carga_laboral, enfoque,
       observaciones, analisis_json, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.id_usuario,
      data.id_sesion,
      data.codigo_plantilla,
      data.bienestar_score,
      data.indice_riesgo,
      data.nivel_riesgo,
      data.animo,
      data.energia,
      data.sueno,
      data.estres,
      data.apoyo,
      data.ambiente,
      data.carga_academica,
      data.carga_laboral,
      data.enfoque,
      data.observaciones,
      JSON.stringify(data.analisis_json || {})
    ]
  );

  return result.insertId;
}

async function saveAlert(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO ia_bienestar_alertas
      (id_usuario, id_sesion, codigo_plantilla, tipo_alerta, nivel_riesgo, descripcion,
       accion_sugerida, requiere_derivacion, estado, metadata_json, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.id_usuario,
      data.id_sesion,
      data.codigo_plantilla,
      data.tipo_alerta,
      data.nivel_riesgo,
      data.descripcion,
      data.accion_sugerida,
      data.requiere_derivacion ? 1 : 0,
      data.estado || 'PENDIENTE',
      JSON.stringify(data.metadata_json || {})
    ]
  );

  return result.insertId;
}

function buildCheckinValues(templateCode, body) {
  const respuestas = Array.isArray(body?.respuestas) ? body.respuestas : [];
  const valuesMap = buildResponseMap(respuestas);

  const explicit = {
    animo: toNumber(body?.animo, null),
    energia: toNumber(body?.energia, null),
    sueno: toNumber(body?.sueno, null),
    estres: toNumber(body?.estres, null),
    apoyo: toNumber(body?.apoyo, null),
    ambiente: toNumber(body?.ambiente, null),
    carga_academica: toNumber(body?.carga_academica, null),
    carga_laboral: toNumber(body?.carga_laboral, null),
    enfoque: toNumber(body?.enfoque, null)
  };

  const code = normalizeUpper(templateCode);
  const templateFields = {
    BIENESTAR_GENERAL: {
      animo: pickNumeric(valuesMap, 'ANIMO_GENERAL', 'ANIMO') ?? explicit.animo,
      energia: pickNumeric(valuesMap, 'ENERGIA_DIARIA', 'ENERGIA') ?? explicit.energia,
      sueno: pickNumeric(valuesMap, 'SUENO_QUALIDAD', 'SUENO') ?? explicit.sueno,
      estres: pickNumeric(valuesMap, 'ESTRES_GENERAL', 'ESTRES') ?? explicit.estres,
      apoyo: pickNumeric(valuesMap, 'APOYO_RED', 'APOYO') ?? explicit.apoyo,
      ambiente: pickNumeric(valuesMap, 'ENTORNO_SEGURIDAD', 'AMBIENTE') ?? explicit.ambiente,
      carga_academica: pickNumeric(valuesMap, 'CARGA_ACADEMICA') ?? explicit.carga_academica,
      carga_laboral: pickNumeric(valuesMap, 'CARGA_LABORAL') ?? explicit.carga_laboral,
      enfoque: pickNumeric(valuesMap, 'ENFOQUE', 'CONCENTRACION') ?? explicit.enfoque
    },
    ACOMPAÑAMIENTO_ACADEMICO: {
      animo: pickNumeric(valuesMap, 'MOTIVACION', 'ANIMO') ?? explicit.animo,
      energia: pickNumeric(valuesMap, 'CONCENTRACION', 'ENERGIA') ?? explicit.energia,
      sueno: pickNumeric(valuesMap, 'ORGANIZACION', 'SUENO') ?? explicit.sueno,
      estres: pickNumeric(valuesMap, 'CARGA_ACADEMICA', 'ESTRES') ?? explicit.estres,
      apoyo: pickNumeric(valuesMap, 'RETROALIMENTACION', 'APOYO') ?? explicit.apoyo,
      ambiente: pickNumeric(valuesMap, 'CLIMA_AULA', 'AMBIENTE') ?? explicit.ambiente,
      carga_academica: pickNumeric(valuesMap, 'CARGA_ACADEMICA') ?? explicit.carga_academica,
      carga_laboral: pickNumeric(valuesMap, 'CARGA_LABORAL') ?? explicit.carga_laboral,
      enfoque: pickNumeric(valuesMap, 'PROXIMO_PASO', 'ENFOQUE') ?? explicit.enfoque
    },
    BIENESTAR_LABORAL: {
      animo: pickNumeric(valuesMap, 'CLIMA_LABORAL', 'ANIMO') ?? explicit.animo,
      energia: pickNumeric(valuesMap, 'PAUSAS_ACTIVAS', 'ENERGIA') ?? explicit.energia,
      sueno: pickNumeric(valuesMap, 'BALANCE_VIDA', 'SUENO') ?? explicit.sueno,
      estres: pickNumeric(valuesMap, 'CARGA_LABORAL', 'ESTRES') ?? explicit.estres,
      apoyo: pickNumeric(valuesMap, 'LIMITES_HORARIO', 'APOYO') ?? explicit.apoyo,
      ambiente: pickNumeric(valuesMap, 'ENTORNO_LABORAL', 'AMBIENTE') ?? explicit.ambiente,
      carga_academica: pickNumeric(valuesMap, 'CARGA_ACADEMICA') ?? explicit.carga_academica,
      carga_laboral: pickNumeric(valuesMap, 'CARGA_LABORAL') ?? explicit.carga_laboral,
      enfoque: pickNumeric(valuesMap, 'ENFOQUE', 'CONCENTRACION') ?? explicit.enfoque
    }
  };

  const selected = templateFields[code] || templateFields.BIENESTAR_GENERAL;

  return {
    ...selected,
    observaciones: normalizeText(body?.observaciones || ''),
    respuestas_json: respuestas,
    value_map: valuesMap
  };
}

function calculateScoreFromValues(values) {
  const positive = [
    values.animo,
    values.energia,
    values.sueno,
    values.apoyo,
    values.ambiente,
    values.enfoque
  ].filter((n) => Number.isFinite(n));

  const negative = [
    values.estres,
    values.carga_academica,
    values.carga_laboral
  ].filter((n) => Number.isFinite(n));

  const positiveAvg = positive.length ? average(positive) : 3;
  const negativeAvg = negative.length ? average(negative) : 3;

  const indiceRiesgo = clamp(((6 - positiveAvg) + negativeAvg) / 2, 1, 5);
  const bienestarScore = clamp(Math.round(((6 - indiceRiesgo) / 5) * 100), 0, 100);

  let nivelRiesgo = 'Bajo';
  if (indiceRiesgo > 1.7 && indiceRiesgo <= 2.6) nivelRiesgo = 'Medio';
  if (indiceRiesgo > 2.6 && indiceRiesgo <= 3.6) nivelRiesgo = 'Alto';
  if (indiceRiesgo > 3.6) nivelRiesgo = 'Crítico';

  return {
    indiceRiesgo: Number(indiceRiesgo.toFixed(2)),
    bienestarScore,
    nivelRiesgo
  };
}

router.get('/catalogos', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const catalogos = await loadCatalogos(conn);

    return res.json({
      ok: true,
      catalogos: {
        ...catalogos,
        escalas: [1, 2, 3, 4, 5],
        crisis: {
          telefono: CRISIS_PHONE,
          emergencia: CRISIS_EMERGENCY
        }
      }
    });
  } catch (error) {
    console.error('Error al cargar catálogos IA bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible cargar los catálogos de acompañamiento.'
    });
  } finally {
    conn.release();
  }
});

router.get('/resumen', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = Number(req.user.id_usuario || 0);

    const [metricsRows] = await conn.execute(
      `SELECT
        COUNT(*) AS total_checkins,
        COALESCE(ROUND(AVG(bienestar_score), 0), 0) AS promedio_bienestar,
        COALESCE(SUM(CASE WHEN nivel_riesgo = 'Crítico' THEN 1 ELSE 0 END), 0) AS alertas_criticas,
        COALESCE(SUM(CASE WHEN nivel_riesgo = 'Alto' THEN 1 ELSE 0 END), 0) AS alertas_altas,
        COALESCE(SUM(CASE WHEN nivel_riesgo = 'Medio' THEN 1 ELSE 0 END), 0) AS alertas_medias
       FROM ia_bienestar_checkins
       WHERE id_usuario = ?`,
      [userId]
    );

    const [sessionRows] = await conn.execute(
      `SELECT
        COUNT(*) AS sesiones_activas
       FROM ia_bienestar_sesiones
       WHERE id_usuario = ? AND estado = 'ACTIVA'`,
      [userId]
    );

    const [lastRows] = await conn.execute(
      `SELECT
        id_checkin,
        bienestar_score,
        nivel_riesgo,
        creado_en
       FROM ia_bienestar_checkins
       WHERE id_usuario = ?
       ORDER BY creado_en DESC, id_checkin DESC
       LIMIT 1`,
      [userId]
    );

    return res.json({
      ok: true,
      data: {
        total_checkins: Number(metricsRows[0]?.total_checkins || 0),
        promedio_bienestar: Number(metricsRows[0]?.promedio_bienestar || 0),
        alertas_criticas: Number(metricsRows[0]?.alertas_criticas || 0),
        alertas_altas: Number(metricsRows[0]?.alertas_altas || 0),
        alertas_medias: Number(metricsRows[0]?.alertas_medias || 0),
        sesiones_activas: Number(sessionRows[0]?.sesiones_activas || 0),
        ultima_revision: lastRows[0] || null
      }
    });
  } catch (error) {
    console.error('Error al obtener resumen de bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible obtener el resumen de acompañamiento.'
    });
  } finally {
    conn.release();
  }
});

router.get('/historial', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = Number(req.user.id_usuario || 0);
    const limite = clamp(Number(req.query.limite || 20), 5, 50);

    const session = await getLatestSession(conn, userId);

    if (!session) {
      return res.json({
        ok: true,
        data: {
          sesion: null,
          mensajes: [],
          checkins: [],
          alertas: []
        }
      });
    }

    const [messages] = await conn.execute(
      `SELECT
        id_mensaje,
        id_sesion,
        rol_mensaje,
        mensaje,
        nivel_riesgo,
        metadata_json,
        creado_en
       FROM ia_bienestar_mensajes
       WHERE id_sesion = ?
       ORDER BY id_mensaje DESC
       LIMIT ?`,
      [session.id_sesion, limite]
    );

    const [checkins] = await conn.execute(
      `SELECT
        id_checkin,
        codigo_plantilla,
        bienestar_score,
        indice_riesgo,
        nivel_riesgo,
        observaciones,
        creado_en
       FROM ia_bienestar_checkins
       WHERE id_sesion = ?
       ORDER BY id_checkin DESC
       LIMIT 10`,
      [session.id_sesion]
    );

    const [alerts] = await conn.execute(
      `SELECT
        id_alerta,
        codigo_plantilla,
        tipo_alerta,
        nivel_riesgo,
        descripcion,
        accion_sugerida,
        estado,
        creado_en
       FROM ia_bienestar_alertas
       WHERE id_sesion = ?
       ORDER BY id_alerta DESC
       LIMIT 10`,
      [session.id_sesion]
    );

    return res.json({
      ok: true,
      data: {
        sesion: session,
        mensajes: messages.reverse(),
        checkins: checkins.reverse(),
        alertas: alerts.reverse()
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: 'No fue posible cargar el historial de acompañamiento.'
    });
  } finally {
    conn.release();
  }
});

router.post('/checkin', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = Number(req.user.id_usuario || 0);
    const perfilUsuario = getRoleLabel(req.user);
    const codigoPlantilla = normalizeUpper(
      req.body?.codigo_plantilla || req.body?.plantilla || 'BIENESTAR_GENERAL'
    );

    const [templateRows] = await conn.execute(
      `SELECT
        id_plantilla,
        codigo_plantilla,
        nombre_plantilla,
        descripcion,
        tipo_instrumento,
        publico_objetivo,
        escala,
        ponderacion_total,
        regla_oro,
        estado,
        orden_visual
       FROM ia_bienestar_plantillas
       WHERE codigo_plantilla = ?
       LIMIT 1`,
      [codigoPlantilla]
    );

    const template = templateRows[0];

    if (!template) {
      return res.status(400).json({
        ok: false,
        message: 'Plantilla de acompañamiento no encontrada.'
      });
    }

    let session = null;

    if (req.body?.id_sesion) {
      const [sessionRows] = await conn.execute(
        `SELECT id_sesion, id_usuario, perfil_usuario, estado
         FROM ia_bienestar_sesiones
         WHERE id_sesion = ? AND id_usuario = ?
         LIMIT 1`,
        [Number(req.body.id_sesion), userId]
      );
      session = sessionRows[0] || null;
    }

    if (!session) {
      const sessionId = await createSession(conn, req.user, {
        titulo_sesion: template.nombre_plantilla,
        objetivo: `Seguimiento de ${template.nombre_plantilla}`
      });

      session = {
        id_sesion: sessionId
      };
    }

    const values = buildCheckinValues(codigoPlantilla, req.body);
    const score = calculateScoreFromValues(values);

    const crisis = containsCrisisSignal(values.observaciones || JSON.stringify(values.respuestas_json || []));
    const nivelRiesgo = crisis ? 'Crítico' : score.nivelRiesgo;
    const indiceRiesgo = crisis ? 5 : score.indiceRiesgo;
    const bienestarScore = crisis ? 0 : score.bienestarScore;

    const checkinId = await saveCheckin(conn, {
      id_usuario: userId,
      id_sesion: session.id_sesion,
      codigo_plantilla: codigoPlantilla,
      bienestar_score: bienestarScore,
      indice_riesgo: indiceRiesgo,
      nivel_riesgo: nivelRiesgo,
      animo: values.animo,
      energia: values.energia,
      sueno: values.sueno,
      estres: values.estres,
      apoyo: values.apoyo,
      ambiente: values.ambiente,
      carga_academica: values.carga_academica,
      carga_laboral: values.carga_laboral,
      enfoque: values.enfoque,
      observaciones: values.observaciones,
      analisis_json: {
        perfil_usuario: perfilUsuario,
        plantilla: template.nombre_plantilla,
        riesgo_crisis: crisis,
        codigo_plantilla: codigoPlantilla
      }
    });

    await conn.execute(
      `UPDATE ia_bienestar_sesiones
       SET nivel_riesgo_actual = ?, bienestar_score = ?, indice_riesgo = ?, actualizado_en = NOW()
       WHERE id_sesion = ?`,
      [nivelRiesgo, bienestarScore, indiceRiesgo, session.id_sesion]
    );

    let alertaId = null;

    if (nivelRiesgo === 'Alto' || nivelRiesgo === 'Crítico') {
      alertaId = await saveAlert(conn, {
        id_usuario: userId,
        id_sesion: session.id_sesion,
        codigo_plantilla: codigoPlantilla,
        tipo_alerta: crisis ? 'CRISIS' : 'RIESGO_BIENESTAR',
        nivel_riesgo: nivelRiesgo,
        descripcion: crisis
          ? 'Se detectó lenguaje asociado a crisis o autolesión.'
          : `Chequeo con nivel ${nivelRiesgo} en ${template.nombre_plantilla}.`,
        accion_sugerida: crisis
          ? `Contactar apoyo humano inmediato. Línea de la Vida ${CRISIS_PHONE} o ${CRISIS_EMERGENCY} si hay peligro inmediato.`
          : 'Dar seguimiento breve, reducir carga inmediata y buscar acompañamiento humano.',
        requiere_derivacion: true,
        estado: 'PENDIENTE',
        metadata_json: {
          checkin_id: checkinId,
          bienestar_score: bienestarScore,
          indice_riesgo: indiceRiesgo
        }
      });
    }

    const fallback = buildAssistantFallback({
      templateLabel: template.nombre_plantilla,
      level: nivelRiesgo,
      wellbeingScore: bienestarScore,
      observations: values.observaciones
    });

    const responseText = crisis
      ? buildCrisisReply().mensaje
      : (await callGeminiSupport({
          templateLabel: template.nombre_plantilla,
          level: nivelRiesgo,
          wellbeingScore: bienestarScore,
          history: [],
          observations: values.observaciones,
          profileLabel: perfilUsuario
        })) || fallback.mensaje;

    await saveMessage(
      conn,
      session.id_sesion,
      userId,
      'user',
      `Check-in: ${template.nombre_plantilla}`,
      nivelRiesgo,
      {
        type: 'checkin',
        checkin_id: checkinId,
        codigo_plantilla: codigoPlantilla
      }
    );

    await saveMessage(
      conn,
      session.id_sesion,
      userId,
      'assistant',
      responseText,
      nivelRiesgo,
      {
        type: 'assistant-checkin',
        checkin_id: checkinId,
        alerta_id: alertaId
      }
    );

    return res.json({
      ok: true,
      message:
        nivelRiesgo === 'Crítico'
          ? 'Se detectó una señal de riesgo alto. Se generó orientación inmediata.'
          : 'Chequeo de acompañamiento guardado correctamente.',
      data: {
        id_sesion: session.id_sesion,
        checkin_id: checkinId,
        alerta_id: alertaId,
        codigo_plantilla: codigoPlantilla,
        nombre_plantilla: template.nombre_plantilla,
        bienestar_score: bienestarScore,
        indice_riesgo: indiceRiesgo,
        nivel_riesgo: nivelRiesgo,
        mensaje: responseText,
        recomendaciones: fallback.recomendaciones,
        ejercicios: fallback.ejercicios,
        cierre: fallback.cierre,
        recursos: nivelRiesgo === 'Crítico' ? getCrisisResources() : (await loadCatalogos(conn)).recursos.slice(0, 4),
        requiere_atencion_inmediata: crisis || nivelRiesgo === 'Crítico',
        regla_oro: template.regla_oro || null
      }
    });
  } catch (error) {
    console.error('Error al registrar check-in de bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'No fue posible registrar el chequeo de acompañamiento.'
    });
  } finally {
    conn.release();
  }
});

router.post('/chat', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = Number(req.user.id_usuario || 0);
    const perfilUsuario = getRoleLabel(req.user);
    const mensaje = normalizeText(req.body?.mensaje);

    if (!mensaje) {
      return res.status(400).json({
        ok: false,
        message: 'El mensaje es obligatorio.'
      });
    }

    const codigoPlantilla = normalizeUpper(req.body?.codigo_plantilla || 'BIENESTAR_GENERAL');

    let session = null;

    if (req.body?.id_sesion) {
      const [sessionRows] = await conn.execute(
        `SELECT id_sesion, id_usuario, perfil_usuario, estado
         FROM ia_bienestar_sesiones
         WHERE id_sesion = ? AND id_usuario = ?
         LIMIT 1`,
        [Number(req.body.id_sesion), userId]
      );
      session = sessionRows[0] || null;
    }

    if (!session) {
      const sessionId = await createSession(conn, req.user, {
        titulo_sesion: 'Chat de acompañamiento',
        objetivo: 'Acompañamiento emocional, académico y laboral'
      });

      session = { id_sesion: sessionId };
    }

    const [templateRows] = await conn.execute(
      `SELECT
        id_plantilla,
        codigo_plantilla,
        nombre_plantilla,
        descripcion,
        regla_oro
       FROM ia_bienestar_plantillas
       WHERE codigo_plantilla = ?
       LIMIT 1`,
      [codigoPlantilla]
    );

    const template = templateRows[0] || {
      codigo_plantilla: 'BIENESTAR_GENERAL',
      nombre_plantilla: 'Acompañamiento general',
      descripcion: ''
    };

    const crisis = containsCrisisSignal(mensaje);
    const recentHistory = await conn.execute(
      `SELECT
        rol_mensaje,
        mensaje,
        nivel_riesgo,
        creado_en
       FROM ia_bienestar_mensajes
       WHERE id_sesion = ?
       ORDER BY id_mensaje DESC
       LIMIT 8`,
      [session.id_sesion]
    );

    const history = (recentHistory[0] || []).reverse();

    await saveMessage(conn, session.id_sesion, userId, 'user', mensaje, crisis ? 'Crítico' : 'Bajo', {
      type: 'chat'
    });

    let responseText = '';
    let nivelRiesgo = 'Bajo';
    let bienestarScore = 80;
    let indiceRiesgo = 1.00;
    let alertaId = null;
    let resources = [];

    if (crisis) {
      const crisisReply = buildCrisisReply();
      responseText = crisisReply.mensaje;
      nivelRiesgo = 'Crítico';
      bienestarScore = 0;
      indiceRiesgo = 5.00;
      resources = crisisReply.recursos;

      alertaId = await saveAlert(conn, {
        id_usuario: userId,
        id_sesion: session.id_sesion,
        codigo_plantilla: template.codigo_plantilla,
        tipo_alerta: 'CRISIS_CHAT',
        nivel_riesgo: 'Crítico',
        descripcion: 'Se detectó un mensaje con riesgo de crisis en el chat.',
        accion_sugerida: `Contactar apoyo humano inmediato. Línea de la Vida ${CRISIS_PHONE} o ${CRISIS_EMERGENCY} si hay peligro inmediato.`,
        requiere_derivacion: true,
        estado: 'PENDIENTE',
        metadata_json: {
          mensaje
        }
      });
    } else {
      try {
        const geminiText = await callGeminiSupport({
          templateLabel: template.nombre_plantilla,
          level: 'Bajo',
          wellbeingScore: 80,
          history,
          observations: mensaje,
          profileLabel: perfilUsuario
        });

        responseText =
          geminiText ||
          buildAssistantFallback({
            templateLabel: template.nombre_plantilla,
            level: 'Bajo',
            wellbeingScore: 80,
            observations: mensaje
          }).mensaje;
      } catch (geminiError) {
        console.warn('Gemini no disponible en bienestar:', geminiError);
        responseText = buildAssistantFallback({
          templateLabel: template.nombre_plantilla,
          level: 'Bajo',
          wellbeingScore: 80,
          observations: mensaje
        }).mensaje;
      }
    }

    await saveMessage(conn, session.id_sesion, userId, 'assistant', responseText, nivelRiesgo, {
      type: 'chat-reply',
      alerta_id: alertaId
    });

    await conn.execute(
      `UPDATE ia_bienestar_sesiones
       SET nivel_riesgo_actual = ?, bienestar_score = ?, indice_riesgo = ?, actualizado_en = NOW()
       WHERE id_sesion = ?`,
      [nivelRiesgo, bienestarScore, indiceRiesgo, session.id_sesion]
    );

    const fallback = buildAssistantFallback({
      templateLabel: template.nombre_plantilla,
      level: nivelRiesgo,
      wellbeingScore: bienestarScore,
      observations: mensaje
    });

    if (!resources.length) {
      const catalogos = await loadCatalogos(conn);
      resources = catalogos.recursos.slice(0, 4);
    }

    return res.json({
      ok: true,
      message: 'Respuesta generada correctamente.',
      data: {
        id_sesion: session.id_sesion,
        respuesta: responseText,
        nivel_riesgo: nivelRiesgo,
        bienestar_score: bienestarScore,
        recomendaciones: fallback.recomendaciones,
        ejercicios: fallback.ejercicios,
        cierre: fallback.cierre,
        recursos: resources,
        alerta_id: alertaId,
        requiere_atencion_inmediata: crisis
      }
    });
  } catch (error) {
    console.error('Error en chat de bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'No fue posible procesar el mensaje de acompañamiento.'
    });
  } finally {
    conn.release();
  }
});

router.post('/predecir-ml', authRequired, async (req, res) => {
  try {
    const features = {
      animo: toNumber(req.body?.animo, 3),
      energia: toNumber(req.body?.energia, 3),
      sueno: toNumber(req.body?.sueno, 3),
      estres: toNumber(req.body?.estres, 3),
      apoyo: toNumber(req.body?.apoyo, 3),
      ambiente: toNumber(req.body?.ambiente, 3),
      carga_academica: toNumber(req.body?.carga_academica, 3),
      carga_laboral: toNumber(req.body?.carga_laboral, 3),
      enfoque: toNumber(req.body?.enfoque, 3),
      bienestar_score: toNumber(req.body?.bienestar_score, 50),
      indice_riesgo: toNumber(req.body?.indice_riesgo, 2.5),
      dimensiones_promedio: toNumber(req.body?.dimensiones_promedio, 3),
      dimensiones_min: toNumber(req.body?.dimensiones_min, 1),
      dimensiones_std: toNumber(req.body?.dimensiones_std, 1),
      dimensiones_riesgo_count: toNumber(req.body?.dimensiones_riesgo_count, 0),
      estres_sqrt: Math.sqrt(toNumber(req.body?.estres, 3)),
      plant_ACOMPANAMIENTO_ACADEMICO: normalizeUpper(req.body?.codigo_plantilla || '') === 'ACOMPANAMIENTO_ACADEMICO' ? 1 : 0,
      plant_BIENESTAR_GENERAL: normalizeUpper(req.body?.codigo_plantilla || '') === 'BIENESTAR_GENERAL' ? 1 : 0,
      plant_BIENESTAR_LABORAL: normalizeUpper(req.body?.codigo_plantilla || '') === 'BIENESTAR_LABORAL' ? 1 : 0
    };

    const result = await mlBridge.predictBienestar(features);
    if (!result.success) {
      return res.status(503).json({ ok: false, message: 'Servicio ML no disponible', error: result.error });
    }

    return res.json({
      ok: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error en predicción ML bienestar:', error);
    return res.status(500).json({ ok: false, message: 'Error al generar predicción ML' });
  }
});

router.post('/escalar', authRequired, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = Number(req.user.id_usuario || 0);
    const motivo = normalizeText(req.body?.motivo || req.body?.descripcion || '');
    const nivelRiesgo = normalizeText(req.body?.nivel_riesgo || 'Alto');
    const codigoPlantilla = normalizeUpper(req.body?.codigo_plantilla || 'BIENESTAR_GENERAL');
    const sessionId = req.body?.id_sesion ? Number(req.body.id_sesion) : null;

    if (!motivo) {
      return res.status(400).json({
        ok: false,
        message: 'El motivo es obligatorio.'
      });
    }

    const alertaId = await saveAlert(conn, {
      id_usuario: userId,
      id_sesion: sessionId,
      codigo_plantilla: codigoPlantilla,
      tipo_alerta: 'ESCALAMIENTO_MANUAL',
      nivel_riesgo: nivelRiesgo,
      descripcion: motivo,
      accion_sugerida: `Seguimiento humano requerido. Línea de la Vida ${CRISIS_PHONE} o ${CRISIS_EMERGENCY} si hay peligro inmediato.`,
      requiere_derivacion: true,
      estado: 'PENDIENTE',
      metadata_json: {
        origen: 'manual'
      }
    });

    await conn.execute(
      `INSERT INTO ia_bienestar_derivaciones
        (id_alerta, id_usuario, destino, motivo, estado, observaciones, creado_en)
       VALUES (?, ?, ?, ?, 'PENDIENTE', ?, NOW())`,
      [
        alertaId,
        userId,
        'Orientación / Tutoría / Acompañamiento',
        motivo,
        normalizeText(req.body?.observaciones || '')
      ]
    );

    return res.json({
      ok: true,
      message: 'Escalamiento registrado correctamente.',
      data: {
        alerta_id: alertaId
      }
    });
  } catch (error) {
    console.error('Error al escalar bienestar:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'No fue posible registrar el escalamiento.'
    });
  } finally {
    conn.release();
  }
});

// ── ALUMNO: Estado de acompañamiento ──
router.get('/estado-acompanamiento', authRequired, async (req, res) => {
  try {
    const userId = Number(req.user.id_usuario || 0);
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no identificado' });

    const [[alumnoRow]] = await pool.execute(`
      SELECT a.id_alumno, a.matricula, a.semestre_actual, a.estatus_academico,
        u.nombres, u.apellido_paterno, u.apellido_materno, u.correo_institucional AS email,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos a
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_usuario = ?
      LIMIT 1
    `, [userId]);

    const [[sesionRow]] = await pool.execute(`
      SELECT id_sesion, estado, nivel_riesgo_actual AS nivel_riesgo,
        bienestar_score, indice_riesgo,
        creado_en AS iniciada_en, DATE_ADD(creado_en, INTERVAL 30 DAY) AS expira_en
      FROM ia_bienestar_sesiones
      WHERE id_usuario = ? AND estado = 'ACTIVA'
      ORDER BY creado_en DESC
      LIMIT 1
    `, [userId]);

    const [[ultimoCheckin]] = await pool.execute(`
      SELECT id_checkin, codigo_plantilla, bienestar_score, indice_riesgo,
        nivel_riesgo, animo, energia, estres, creado_en
      FROM ia_bienestar_checkins
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 1
    `, [userId]);

    const [alertasRows] = await pool.execute(`
      SELECT COUNT(*) AS total_alertas,
        SUM(CASE WHEN nivel_riesgo IN ('Alto','Crítico') THEN 1 ELSE 0 END) AS alertas_criticas,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS alertas_pendientes,
        SUM(CASE WHEN estado IN ('ATENDIDA','CERRADA') THEN 1 ELSE 0 END) AS alertas_atendidas
      FROM ia_bienestar_alertas
      WHERE id_usuario = ?
    `, [userId]);

    const [derivacionesRows] = await pool.execute(`
      SELECT COUNT(*) AS total_intervenciones
      FROM ia_bienestar_derivaciones d
      INNER JOIN ia_bienestar_alertas a ON a.id_alerta = d.id_alerta
      WHERE a.id_usuario = ?
    `, [userId]);

    const [checkinsRecientes] = await pool.execute(`
      SELECT creado_en, bienestar_score, nivel_riesgo
      FROM ia_bienestar_checkins
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 5
    `, [userId]);

    return res.json({
      ok: true,
      data: {
        alumno: alumnoRow || null,
        sesion_activa: sesionRow || null,
        ultimo_checkin: ultimoCheckin || null,
        alertas: {
          total: Number(alertasRows[0]?.total_alertas || 0),
          criticas: Number(alertasRows[0]?.alertas_criticas || 0),
          pendientes: Number(alertasRows[0]?.alertas_pendientes || 0),
          atendidas: Number(alertasRows[0]?.alertas_atendidas || 0)
        },
        total_intervenciones: Number(derivacionesRows[0]?.total_intervenciones || 0),
        tendencia: checkinsRecientes.length >= 2
          ? (checkinsRecientes[0].bienestar_score > checkinsRecientes[checkinsRecientes.length - 1].bienestar_score ? 'mejora' : 'declive')
          : 'estable'
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de acompañamiento:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener estado de acompañamiento' });
  }
});

// ── ALUMNO: Progreso (check-in scores timeline) ──
router.get('/progreso', authRequired, async (req, res) => {
  try {
    const userId = Number(req.user.id_usuario || 0);
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no identificado' });

    const [rows] = await pool.execute(`
      SELECT id_checkin, codigo_plantilla, bienestar_score, indice_riesgo,
        nivel_riesgo, animo, energia, sueno, estres, apoyo, ambiente,
        carga_academica, carga_laboral, enfoque, creado_en
      FROM ia_bienestar_checkins
      WHERE id_usuario = ?
      ORDER BY creado_en ASC
      LIMIT 50
    `, [userId]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener progreso:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener progreso' });
  }
});

// ── ALUMNO: Historial de apoyo (derivaciones/observaciones) ──
router.get('/historial-apoyo', authRequired, async (req, res) => {
  try {
    const userId = Number(req.user.id_usuario || 0);
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no identificado' });

    const [rows] = await pool.execute(`
      SELECT d.id_derivacion, d.destino, d.motivo, d.observaciones,
        d.estado AS estado_derivacion, d.creado_en,
        a.nivel_riesgo, a.tipo_alerta, a.descripcion,
        u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido
      FROM ia_bienestar_derivaciones d
      INNER JOIN ia_bienestar_alertas a ON a.id_alerta = d.id_alerta
      LEFT JOIN usuarios u2 ON d.id_usuario = u2.id_usuario
      WHERE a.id_usuario = ?
      ORDER BY d.creado_en DESC
      LIMIT 30
    `, [userId]);

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener historial de apoyo:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial de apoyo' });
  }
});

// ── ALUMNO: Mensajes de orientación (chat system messages) ──
router.get('/mensajes-orientacion', authRequired, async (req, res) => {
  try {
    const userId = Number(req.user.id_usuario || 0);
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no identificado' });

    const [rows] = await pool.execute(`
      SELECT m.id_mensaje, m.rol_mensaje, m.mensaje, m.nivel_riesgo,
        m.metadata_json, m.creado_en
      FROM ia_bienestar_mensajes m
      INNER JOIN ia_bienestar_sesiones s ON s.id_sesion = m.id_sesion
      WHERE s.id_usuario = ? AND m.rol_mensaje IN ('assistant','system')
      ORDER BY m.creado_en DESC
      LIMIT 30
    `, [userId]);

    const data = rows.map(r => ({
      ...r,
      metadata: (() => { try { return JSON.parse(r.metadata_json || '{}'); } catch { return {}; } })()
    }));

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('Error al obtener mensajes de orientación:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener mensajes de orientación' });
  }
});

// ── ALUMNO: Recomendaciones personalizadas ──
router.get('/recomendaciones-alumno', authRequired, async (req, res) => {
  try {
    const userId = Number(req.user.id_usuario || 0);
    if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no identificado' });

    const [alertas] = await pool.execute(`
      SELECT id_alerta, tipo_alerta, nivel_riesgo, descripcion,
        accion_sugerida, estado, creado_en
      FROM ia_bienestar_alertas
      WHERE id_usuario = ? AND estado IN ('PENDIENTE','EN_REVISION')
      ORDER BY creado_en DESC
      LIMIT 10
    `, [userId]);

    const [ultimoCheckin] = await pool.execute(`
      SELECT bienestar_score, nivel_riesgo, animo, energia, estres,
        carga_academica, apoyo, observaciones, creado_en
      FROM ia_bienestar_checkins
      WHERE id_usuario = ?
      ORDER BY creado_en DESC
      LIMIT 1
    `, [userId]);

    const recomendaciones = [];

    if (alertas.length > 0) {
      recomendaciones.push({
        tipo: 'ALERTA_ACTIVA',
        mensaje: `Tienes ${alertas.length} alerta(s) pendiente(s) de revisión. Revisa las acciones sugeridas y confirma la atención recibida.`,
        prioridad: alertas.some(a => a.nivel_riesgo === 'Alto' || a.nivel_riesgo === 'Crítico') ? 'alta' : 'media'
      });
    }

    if (ultimoCheckin.length > 0) {
      const c = ultimoCheckin[0];
      if (c.nivel_riesgo === 'Crítico' || c.nivel_riesgo === 'Alto') {
        recomendaciones.push({
          tipo: 'BIENESTAR',
          mensaje: 'Tu último registro muestra señales de alerta. Te recomendamos buscar apoyo en la línea de acompañamiento institucional.',
          prioridad: 'alta'
        });
      }
      if (Number(c.bienestar_score) < 50) {
        recomendaciones.push({
          tipo: 'BIENESTAR',
          mensaje: 'Tu puntuación de bienestar ha disminuido. Considera realizar actividades de cuidado personal y contactar a servicios de apoyo estudiantil.',
          prioridad: 'media'
        });
      }
      if (Number(c.carga_academica) > 7) {
        recomendaciones.push({
          tipo: 'ACADEMICO',
          mensaje: 'Reportas una carga académica elevada. Te sugerimos organizar tu tiempo y solicitar asesoría si lo requieres.',
          prioridad: 'media'
        });
      }
      if (Number(c.estres) > 7) {
        recomendaciones.push({
          tipo: 'BIENESTAR',
          mensaje: 'Tu nivel de estrés reportado es alto. Prueba técnicas de respiración, pausas activas y busca apoyo si es necesario.',
          prioridad: 'media'
        });
      }
    }

    if (recomendaciones.length === 0) {
      recomendaciones.push({
        tipo: 'GENERAL',
        mensaje: 'Tu acompañamiento va bien. Sigue realizando tus check-ins periódicos para mantener un registro de tu bienestar.',
        prioridad: 'baja'
      });
    }

    return res.json({ ok: true, data: recomendaciones });
  } catch (error) {
    console.error('Error al obtener recomendaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener recomendaciones' });
  }
});

module.exports = router;