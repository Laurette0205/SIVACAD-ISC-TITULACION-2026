'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const docenteQueries = require('../services/chatbotDocente');
const alumnoQueries = require('../services/chatbotAlumno');
const soporteQueries = require('../services/chatbotSoporte');

const router = express.Router();

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const IS_GEMINI_VALID = GEMINI_API_KEY.startsWith('AIza');
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const GEMINI_TIMEOUT_MS = Math.max(5000, Number(process.env.GEMINI_TIMEOUT_MS || 15000));

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

const conversations = new Map();
const MAX_HISTORY_ITEMS = 12;

const SYSTEM_PROMPT = `
Eres el ChatBot institucional de SIVACAD, un sistema integral de gestion academica.
Responde en español, con claridad, franqueza, precision y de forma util.
Debes contestar con enfoque academico e institucional.
Si la pregunta no se puede resolver con certeza, dilo de forma directa.
No inventes datos.

Tienes acceso a informacion consolidada del sistema para apoyar la toma de decisiones.
Puedes orientar sobre: estado general del sistema, modulos, usuarios, reportes,
seguridad, actividad general, incidencias, accesos y flujos del sistema.

Cuando un Administrador o Coordinador consulte, proporciona respuestas ejecutivas
con sugerencias de accion inmediata cuando sea relevante.
`.trim();

function authMiddleware(req, res, next) {
  const auth = String(req.headers.authorization || '');
  let token = '';
  if (auth.startsWith('Bearer ')) {
    token = auth.slice(7).trim();
  } else if (req.query?.token) {
    token = String(req.query.token).trim();
  }
  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token no disponible' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token invalido o expirado' });
  }
}

function getRoleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
}

function getUserId(user) {
  return Number(user?.id || user?.id_usuario || user?.userId || 0);
}

function getConversationKey(req) {
  const fromUser = req.user?.id || req.user?.id_usuario || req.user?.correo || req.user?.email || req.user?.username;
  if (fromUser) return String(fromUser);
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return auth ? `token:${auth}` : 'anon';
}

function getConversation(key) {
  if (!conversations.has(key)) conversations.set(key, []);
  return conversations.get(key);
}

function trimHistory(history) {
  return history.slice(-MAX_HISTORY_ITEMS);
}

function toGeminiContents(history) {
  return history.map((item) => ({
    role: item.role === 'model' ? 'model' : 'user',
    parts: [{ text: item.text }]
  }));
}

function extractResponseText(data) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts.map((part) => String(part?.text || '').trim()).filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return '';
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function buildFallbackReply(mensaje, role) {
  const text = normalizeText(mensaje);
  const isAdmin = role === 'ADMINISTRADOR' || role === 'COORDINADOR';

  if (!text) return 'Escribe una pregunta para continuar.';

  if (isAdmin) {
    if (text.includes('incidencia') || text.includes('incidencias') || text.includes('reporte')) {
      return 'Puedo mostrarle un resumen ejecutivo de incidencias del sistema. Use la seccion de incidencias para ver el detalle completo por estado y prioridad.';
    }
    if (text.includes('acceso') || text.includes('accesos') || text.includes('permiso') || text.includes('sesion')) {
      return 'Puedo validar accesos activos y revisar intentos fallidos. Los accesos se gestionan desde la seccion de usuarios del panel administrativo.';
    }
    if (text.includes('usuario') || text.includes('usuarios') || text.includes('modulo') || text.includes('modulos')) {
      return 'Puedo orientarle sobre los modulos, usuarios y su actividad en el sistema. Para acciones administrativas concretas, use el panel de usuarios.';
    }
    if (text.includes('reporte') || text.includes('reportes') || text.includes('exportar') || text.includes('exportacion')) {
      return 'Puedo ayudarle a supervisar modulos y exportar informacion consolidada del sistema. Use la seccion de reportes para generar exportaciones detalladas.';
    }
    if (text.includes('seguridad') || text.includes('actividad') || text.includes('monitoreo') || text.includes('supervision')) {
      return 'Puedo proporcionarle informacion consolidada sobre la seguridad y actividad general del sistema. La supervision transversal esta disponible en el panel de auditoria.';
    }
    if (text.includes('estado') || text.includes('general') || text.includes('sistema') || text.includes('panel')) {
      return 'El sistema SIVACAD se encuentra operativo. Puedo consultar el estado general, metricas globales y actividad reciente para apoyar su toma de decisiones.';
    }
    if (text.includes('flujo') || text.includes('flujos') || text.includes('proceso') || text.includes('orientar')) {
      return 'Puedo orientarle sobre los flujos del sistema: inscripciones, reinscripciones, kardex, evaluaciones y mas. Indique el modulo sobre el que necesita orientacion.';
    }
  }

  if (text.includes('beca') || text.includes('becas') || text.includes('apoyo economico') || text.includes('edomex')) {
    return 'Puedo ayudarte con becas oficiales, elegibilidad academica y el portal de la SECTI. Si quieres, abre la seccion de IA de becas para revisar convocatorias y requisitos vigentes.';
  }
  if (text.includes('kardex') || text.includes('promedio') || text.includes('calificacion') || text.includes('calificación')) {
    return 'Puedo orientarte sobre kardex, promedio, materias y estado academico. Si necesitas un dato privado, el sistema lo revisa con tu sesion activa.';
  }
  if (text.includes('error') || text.includes('fallo') || text.includes('no funciona') || text.includes('problema')) {
    return 'Puedo ayudarte a diagnosticar el problema paso a paso. Dame que pantalla muestra el error y que mensaje exacto aparece.';
  }
  if (text.includes('inscripcion') || text.includes('reinscripcion')) {
    return 'Puedo explicarte el proceso de inscripcion o reinscripcion y que revisar antes de enviar tu solicitud.';
  }
  if (text.includes('evaluacion')) {
    return 'Puedo orientarte sobre evaluaciones, plantillas, preguntas y resultados institucionales.';
  }
  if (text.includes('bienestar') || text.includes('acompanamiento') || text.includes('emocional') || text.includes('salud mental')) {
    return 'Puedo darte orientacion general de acompanamiento y ayudarte a ubicar la IA de Acompanamiento Estudiantil del sistema.';
  }

  return 'Puedo ayudarte con SIVACAD, becas, kardex, evaluaciones, acompanamiento, asistencia institucional y soporte tecnico. Escribe tu consulta con mas detalle.';
}

async function saveToDatabase(id_usuario, rol_usuario, mensaje, respuesta, modo, proveedor, tiempo_ms) {
  if (!id_usuario) return;
  try {
    await pool.execute(
      `INSERT INTO chatbot_mensajes (id_usuario, rol_usuario, mensaje, respuesta, modo_respuesta, proveedor, tiempo_respuesta_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, rol_usuario, mensaje, respuesta, modo, proveedor, tiempo_ms || null]
    );
  } catch (err) {
    console.error('Error guardando mensaje chatbot en DB:', err.message);
  }
}

async function registrarAuditoria(id_usuario, rol_usuario, accion, detalle, ip) {
  if (!id_usuario) return;
  try {
    await pool.execute(
      `INSERT INTO chatbot_auditoria (id_usuario, rol_usuario, accion, detalle, ip_origen)
       VALUES (?, ?, ?, ?, ?)`,
      [id_usuario, rol_usuario, accion, detalle || null, ip || null]
    );
  } catch (err) {
    console.error('Error registrando auditoria chatbot:', err.message);
  }
}

async function generarRespuestaIA(req, mensaje, startTime) {
  const texto = String(mensaje || '').trim();
  if (!texto) {
    return { respuesta: 'Escribe una pregunta para continuar.', mode: 'FALLBACK', provider: 'local' };
  }

  const conversationKey = getConversationKey(req);
  const history = getConversation(conversationKey);
  const role = getRoleName(req.user);
  const fallbackReply = buildFallbackReply(texto, role);

  const rolePrompt = role === 'ADMINISTRADOR'
    ? '\nEl usuario es ADMINISTRADOR del sistema. Proporciona respuestas ejecutivas con datos concretos, sugerencias de accion inmediata y vision consolidada del sistema. Puede consultar estado general, incidencias, accesos, flujos, modulos y exportar informacion.'
    : role === 'COORDINADOR'
    ? '\nEl usuario es COORDINADOR. Proporciona supervision transversal y acceso a informacion consolidada para la toma de decisiones.'
    : role === 'SOPORTE'
    ? '\nEl usuario es SOPORTE TECNICO. Proporciona respuestas de diagnostico, mensajes de ayuda y rutas de solucion. Enfocate en: diagnosticar fallas tecnicas, atender incidencias, revisar errores del backend, validar sesiones de usuarios, orientar recuperacion de acceso y resolver problemas tecnicos. Mantener la continuidad operativa y apoyar la resolucion de incidencias. Cobertura sobre autenticacion, errores del backend, fallos de navegacion y reportes tecnicos.'
    : role === 'DOCENTE'
    ? '\nEl usuario es DOCENTE. Proporciona respuestas breves, concisas, detalladas, explicadas, directas, claras y orientadas a la accion sobre: grupos asignados, evaluaciones, seguimiento academico, kardex y estados de alumnos. Puede consultar informacion de sus grupos, revisar evaluaciones, identificar riesgo de desercion y resolver dudas operativas. Acceso limitado a sus grupos y funciones pedagogicas asignadas.'
    : '\nEl usuario es ALUMNO. Proporciona orientacion sobre servicios escolares, kardex, inscripciones, reinscripciones, evaluaciones, becas y acompanamiento. Usa lenguaje accesible, rutas guiadas y respuestas claras, directas, precisas, concisas, detalladas y explicadas. Incluye los nombres completos (Apellidos y Nombres) de los docentes y del coordinador cuando corresponda, junto con su correo institucional para que el alumno pueda contactarlos.';

  const fullSystemPrompt = SYSTEM_PROMPT + rolePrompt;

  if (!IS_GEMINI_VALID) {
    const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: fallbackReply }]);
    conversations.set(conversationKey, nextHistory);
    return { respuesta: fallbackReply, mode: 'FALLBACK', provider: 'local', warning: 'GEMINI_API_KEY no configurada' };
  }

  if (typeof fetch !== 'function') {
    const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: fallbackReply }]);
    conversations.set(conversationKey, nextHistory);
    return { respuesta: fallbackReply, mode: 'FALLBACK', provider: 'local', warning: 'Fetch no disponible en el entorno' };
  }

  const payload = {
    systemInstruction: { parts: [{ text: fullSystemPrompt }] },
    contents: [
      ...toGeminiContents(history),
      { role: 'user', parts: [{ text: texto }] }
    ],
    generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMessage = data?.error?.message || data?.message || 'Error al consultar Gemini';
      const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: fallbackReply }]);
      conversations.set(conversationKey, nextHistory);
      return { respuesta: fallbackReply, mode: 'FALLBACK', provider: 'local', warning: apiMessage };
    }

    const respuesta = extractResponseText(data);
    if (!respuesta) {
      const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: fallbackReply }]);
      conversations.set(conversationKey, nextHistory);
      return { respuesta: fallbackReply, mode: 'FALLBACK', provider: 'local', warning: 'Gemini no devolvio una respuesta valida' };
    }

    const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: respuesta }]);
    conversations.set(conversationKey, nextHistory);

    const elapsed = startTime ? Date.now() - startTime : null;

    return { respuesta, mode: 'GEMINI', provider: 'gemini', tiempo_ms: elapsed };
  } catch (error) {
    const nextHistory = trimHistory([...history, { role: 'user', text: texto }, { role: 'model', text: fallbackReply }]);
    conversations.set(conversationKey, nextHistory);
    const isAbort = String(error?.name || '').toLowerCase() === 'aborterror';
    const warning = isAbort ? 'Tiempo de espera agotado al consultar Gemini' : error?.message || 'No fue posible consultar Gemini';
    return { respuesta: fallbackReply, mode: 'FALLBACK', provider: 'local', warning };
  } finally {
    clearTimeout(timer);
  }
}

router.post('/mensaje', authMiddleware, async (req, res) => {
  try {
    const mensaje = req.body?.mensaje;
    if (!mensaje || !String(mensaje).trim()) {
      return res.status(400).json({ ok: false, message: 'El mensaje es obligatorio.' });
    }

    const startTime = Date.now();
    const role = getRoleName(req.user);
    const id_usuario = getUserId(req.user);
    const rol_usuario = role;

    if (role === 'DOCENTE') {
      const tipoConsulta = await docenteQueries.detectarTipoConsulta(mensaje);
      if (tipoConsulta.tipo !== 'GENERAL') {
        const periodoActivo = await docenteQueries.getPeriodoActivo();
        const result = await docenteQueries.ejecutarConsulta(tipoConsulta, {}, id_usuario, periodoActivo);
        if (result) {
          const respuestaFinal = result.respuesta + '\n\n* Esta informacion ha sido registrada y notificada a la division de Ingenieria en Sistemas Computacionales para conocimiento del Administrador y Coordinador.';
          saveToDatabase(id_usuario, rol_usuario, mensaje, respuestaFinal, 'DOCENTE_QUERY', 'database', Date.now() - startTime);
          docenteQueries.logQuery(id_usuario, mensaje, respuestaFinal, tipoConsulta.tipo);
          registrarAuditoria(id_usuario, rol_usuario, 'DOCENTE_CONSULTA', `Tipo: ${tipoConsulta.tipo} - Pregunta: "${mensaje.substring(0,150)}"`, req.ip);
          return res.json({ ok: true, respuesta: respuestaFinal, mode: 'DOCENTE_QUERY', provider: 'database', tipo: tipoConsulta.tipo, count: result.count });
        }
      }
    }

    if (role === 'ALUMNO') {
      const tipoConsulta = await alumnoQueries.detectarTipoConsulta(mensaje);
      if (tipoConsulta.tipo !== 'GENERAL') {
        const periodoActivo = await alumnoQueries.getPeriodoActivo();
        const result = await alumnoQueries.ejecutarConsulta(tipoConsulta, {}, id_usuario, periodoActivo);
        if (result) {
          const respuestaFinal = result.respuesta;
          saveToDatabase(id_usuario, rol_usuario, mensaje, respuestaFinal, 'ALUMNO_QUERY', 'database', Date.now() - startTime);
          alumnoQueries.logQuery(id_usuario, mensaje, respuestaFinal, tipoConsulta.tipo);
          registrarAuditoria(id_usuario, rol_usuario, 'ALUMNO_CONSULTA', `Tipo: ${tipoConsulta.tipo} - Pregunta: "${mensaje.substring(0,150)}"`, req.ip);
          return res.json({ ok: true, respuesta: respuestaFinal, mode: 'ALUMNO_QUERY', provider: 'database', tipo: tipoConsulta.tipo, count: result.count });
        }
      }
    }

    if (role === 'SOPORTE') {
      const tipoConsulta = await soporteQueries.detectarTipoConsulta(mensaje);
      if (tipoConsulta.tipo !== 'GENERAL') {
        const result = await soporteQueries.ejecutarConsulta(tipoConsulta, {});
        if (result) {
          const respuestaFinal = result.respuesta;
          saveToDatabase(id_usuario, rol_usuario, mensaje, respuestaFinal, 'SOPORTE_QUERY', 'database', Date.now() - startTime);
          soporteQueries.logQuery(id_usuario, mensaje, respuestaFinal, tipoConsulta.tipo);
          registrarAuditoria(id_usuario, rol_usuario, 'SOPORTE_CONSULTA', `Tipo: ${tipoConsulta.tipo} - Pregunta: "${mensaje.substring(0,150)}"`, req.ip);
          return res.json({ ok: true, respuesta: respuestaFinal, mode: 'SOPORTE_QUERY', provider: 'database', tipo: tipoConsulta.tipo, count: result.count });
        }
      }
    }

    const result = await generarRespuestaIA(req, mensaje, startTime);

    if (id_usuario) {
      saveToDatabase(id_usuario, rol_usuario, mensaje, result.respuesta, result.mode, result.provider, result.tiempo_ms || null);
      if (result.mode === 'FALLBACK' && result.warning) {
        registrarAuditoria(id_usuario, rol_usuario, 'FALLBACK_ACTIVADO', `Mensaje: "${mensaje.substring(0,100)}" - ${result.warning}`, req.ip);
      }
    }

    return res.json({
      ok: true,
      respuesta: result.respuesta,
      mode: result.mode,
      provider: result.provider,
      warning: result.warning || null
    });
  } catch (error) {
    console.error('Error en chatbot:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'No fue posible generar la respuesta del chatbot.' });
  }
});

router.post('/limpiar', authMiddleware, (req, res) => {
  try {
    const key = getConversationKey(req);
    conversations.delete(key);

    const id_usuario = getUserId(req.user);
    if (id_usuario) {
      registrarAuditoria(id_usuario, getRoleName(req.user), 'LIMPIAR_CONVERSACION', 'Contexto de conversacion limpiado', req.ip);
    }

    return res.json({ ok: true, message: 'Contexto del chatbot limpiado correctamente.' });
  } catch (error) {
    console.error('Error al limpiar contexto del chatbot:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible limpiar el contexto.' });
  }
});

router.get('/metricas', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR' && role !== 'DOCENTE') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado a metricas globales.' });
    }

    const [totalMensajes] = await pool.execute(
      'SELECT COUNT(*) AS total FROM chatbot_mensajes WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [mensajesHoy] = await pool.execute(
      'SELECT COUNT(*) AS total FROM chatbot_mensajes WHERE DATE(created_at) = CURDATE()'
    );
    const [modoStats] = await pool.execute(
      `SELECT modo_respuesta, COUNT(*) AS total FROM chatbot_mensajes
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY modo_respuesta`
    );
    const [rolStats] = await pool.execute(
      `SELECT rol_usuario, COUNT(*) AS total FROM chatbot_mensajes
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY rol_usuario ORDER BY total DESC`
    );
    const [tiempoPromedio] = await pool.execute(
      'SELECT AVG(tiempo_respuesta_ms) AS promedio FROM chatbot_mensajes WHERE tiempo_respuesta_ms IS NOT NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const [topUsuarios] = await pool.execute(
      `SELECT id_usuario, rol_usuario, COUNT(*) AS total FROM chatbot_mensajes
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY id_usuario, rol_usuario ORDER BY total DESC LIMIT 10`
    );
    const [incidenciasAbiertas] = await pool.execute(
      "SELECT COUNT(*) AS total FROM chatbot_incidencias WHERE estado IN ('ABIERTA','EN_REVISION')"
    );

    return res.json({
      ok: true,
      data: {
        total_30d: totalMensajes[0]?.total || 0,
        hoy: mensajesHoy[0]?.total || 0,
        modo_stats: modoStats || [],
        rol_stats: rolStats || [],
        tiempo_promedio_ms: Math.round(tiempoPromedio[0]?.promedio || 0),
        top_usuarios: topUsuarios || [],
        incidencias_abiertas: incidenciasAbiertas[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error al obtener metricas:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las metricas.' });
  }
});

router.get('/auditoria', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado a la auditoria.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const accion = req.query.accion ? String(req.query.accion).trim() : null;

    let sql = 'SELECT * FROM chatbot_auditoria';
    const params = [];

    if (accion) {
      sql += ' WHERE accion = ?';
      params.push(accion);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    const [total] = await pool.execute('SELECT COUNT(*) AS total FROM chatbot_auditoria');

    return res.json({
      ok: true,
      data: rows,
      total: total[0]?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error al obtener auditoria:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener la auditoria.' });
  }
});

router.get('/configuracion', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado a la configuracion del sistema.' });
    }

    const [rows] = await pool.execute('SELECT * FROM chatbot_configuracion ORDER BY id_config');
    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al obtener configuracion:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener la configuracion.' });
  }
});

router.put('/configuracion', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado a la configuracion del sistema.' });
    }

    const { clave, valor } = req.body;
    if (!clave || valor === undefined) {
      return res.status(400).json({ ok: false, message: 'clave y valor son requeridos.' });
    }

    const [existing] = await pool.execute('SELECT id_config, editable FROM chatbot_configuracion WHERE clave = ?', [clave]);
    if (existing.length === 0) {
      return res.status(404).json({ ok: false, message: 'Configuracion no encontrada.' });
    }
    if (!existing[0].editable) {
      return res.status(403).json({ ok: false, message: 'Esta configuracion no es editable.' });
    }

    await pool.execute('UPDATE chatbot_configuracion SET valor = ? WHERE clave = ?', [String(valor), clave]);

    const id_usuario = getUserId(req.user);
    if (id_usuario) {
      registrarAuditoria(id_usuario, role, 'ACTUALIZAR_CONFIG', `clave=${clave} valor=${String(valor).substring(0,50)}`, req.ip);
    }

    return res.json({ ok: true, message: 'Configuracion actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar configuracion:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la configuracion.' });
  }
});

router.get('/incidencias', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR' && role !== 'SOPORTE') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado a incidencias.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const estado = req.query.estado ? String(req.query.estado).trim().toUpperCase() : null;
    const prioridad = req.query.prioridad ? String(req.query.prioridad).trim().toUpperCase() : null;

    let sql = 'SELECT * FROM chatbot_incidencias';
    const conditions = [];
    const params = [];

    if (estado && ['ABIERTA','EN_REVISION','RESUELTA','CERRADA'].includes(estado)) {
      conditions.push('estado = ?');
      params.push(estado);
    }
    if (prioridad && ['BAJA','MEDIA','ALTA','CRITICA'].includes(prioridad)) {
      conditions.push('prioridad = ?');
      params.push(prioridad);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    const [total] = await pool.execute('SELECT COUNT(*) AS total FROM chatbot_incidencias');

    const [resumen] = await pool.execute(
      `SELECT estado, COUNT(*) AS total FROM chatbot_incidencias GROUP BY estado`
    );

    return res.json({
      ok: true,
      data: rows,
      resumen: resumen || [],
      total: total[0]?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error al obtener incidencias:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las incidencias.' });
  }
});

router.put('/incidencias/:id', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR' && role !== 'SOPORTE') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado para actualizar incidencias.' });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'ID de incidencia invalido.' });

    const { estado, prioridad, solucion } = req.body;

    const fields = [];
    const params = [];

    if (estado && ['ABIERTA','EN_REVISION','RESUELTA','CERRADA'].includes(estado)) {
      fields.push('estado = ?');
      params.push(estado);
      if (estado === 'RESUELTA' || estado === 'CERRADA') {
        fields.push('resuelto_por = ?');
        params.push(getUserId(req.user));
        fields.push('resuelto_en = NOW()');
      }
    }
    if (prioridad && ['BAJA','MEDIA','ALTA','CRITICA'].includes(prioridad)) {
      fields.push('prioridad = ?');
      params.push(prioridad);
    }
    if (solucion !== undefined) {
      fields.push('solucion = ?');
      params.push(solucion);
    }

    if (fields.length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay campos para actualizar.' });
    }

    params.push(id);
    await pool.execute(`UPDATE chatbot_incidencias SET ${fields.join(', ')} WHERE id_incidencia = ?`, params);

    const id_usuario = getUserId(req.user);
    if (id_usuario) {
      registrarAuditoria(id_usuario, role, 'ACTUALIZAR_INCIDENCIA', `id_incidencia=${id} estado=${estado||''} prioridad=${prioridad||''}`, req.ip);
    }

    return res.json({ ok: true, message: 'Incidencia actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar incidencia:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la incidencia.' });
  }
});

router.post('/incidencias', authMiddleware, async (req, res) => {
  try {
    const { categoria, descripcion, mensaje_original, respuesta_dada, prioridad } = req.body;
    if (!descripcion || !String(descripcion).trim()) {
      return res.status(400).json({ ok: false, message: 'La descripcion de la incidencia es requerida.' });
    }

    const id_usuario = getUserId(req.user);
    const rol_usuario = getRoleName(req.user);
    const cat = String(categoria || 'GENERAL').trim().toUpperCase();
    const pri = prioridad && ['BAJA','MEDIA','ALTA','CRITICA'].includes(String(prioridad).toUpperCase())
      ? String(prioridad).toUpperCase() : 'MEDIA';

    const [result] = await pool.execute(
      `INSERT INTO chatbot_incidencias (id_usuario, rol_usuario, categoria, descripcion, mensaje_original, respuesta_dada, prioridad)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, rol_usuario, cat, descripcion, mensaje_original || null, respuesta_dada || null, pri]
    );

    if (id_usuario) {
      registrarAuditoria(id_usuario, rol_usuario, 'CREAR_INCIDENCIA', `id_incidencia=${result.insertId} categoria=${cat}`, req.ip);
    }

    return res.status(201).json({
      ok: true,
      message: 'Incidencia registrada correctamente.',
      id_incidencia: result.insertId
    });
  } catch (error) {
    console.error('Error al crear incidencia:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible registrar la incidencia.' });
  }
});

router.get('/conversaciones', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR') {
      const currentUserId = getUserId(req.user);
      const [rows] = await pool.execute(
        `SELECT cm.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo FROM chatbot_mensajes cm
         LEFT JOIN usuarios u ON cm.id_usuario = u.id_usuario
         WHERE cm.id_usuario = ?
         ORDER BY cm.created_at DESC LIMIT 50`,
        [currentUserId]
      );
      return res.json({ ok: true, data: rows, propia: true });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const usuarioId = req.query.id_usuario ? Number(req.query.id_usuario) : null;

    let sql = `SELECT cm.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo FROM chatbot_mensajes cm LEFT JOIN usuarios u ON cm.id_usuario = u.id_usuario`;
    const params = [];

    if (usuarioId) {
      sql += ' WHERE cm.id_usuario = ?';
      params.push(usuarioId);
    }

    sql += ' ORDER BY cm.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    return res.json({ ok: true, data: rows, limit, offset });
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las conversaciones.' });
  }
});

router.get('/exportar', authMiddleware, async (req, res) => {
  try {
    const role = getRoleName(req.user);
    if (role !== 'ADMINISTRADOR' && role !== 'COORDINADOR') {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado para exportar datos.' });
    }

    const tipo = String(req.query.tipo || 'conversaciones').trim();
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    let data;
    if (tipo === 'conversaciones') {
      let sql = `SELECT cm.*, CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', u.apellido_materno) AS nombre_completo FROM chatbot_mensajes cm LEFT JOIN usuarios u ON cm.id_usuario = u.id_usuario`;
      const params = [];
      const conditions = [];
      if (desde) { conditions.push('cm.created_at >= ?'); params.push(desde); }
      if (hasta) { conditions.push('cm.created_at <= ?'); params.push(hasta); }
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY cm.created_at DESC';
      const [rows] = await pool.execute(sql, params);
      data = rows;
    } else if (tipo === 'auditoria') {
      let sql = 'SELECT * FROM chatbot_auditoria';
      const params = [];
      const conditions = [];
      if (desde) { conditions.push('created_at >= ?'); params.push(desde); }
      if (hasta) { conditions.push('created_at <= ?'); params.push(hasta); }
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at DESC';
      const [rows] = await pool.execute(sql, params);
      data = rows;
    } else if (tipo === 'incidencias') {
      let sql = 'SELECT * FROM chatbot_incidencias';
      const params = [];
      const conditions = [];
      if (desde) { conditions.push('created_at >= ?'); params.push(desde); }
      if (hasta) { conditions.push('created_at <= ?'); params.push(hasta); }
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at DESC';
      const [rows] = await pool.execute(sql, params);
      data = rows;
    } else {
      return res.status(400).json({ ok: false, message: 'Tipo de exportacion no valido. Use: conversaciones, auditoria, incidencias' });
    }

    const id_usuario = getUserId(req.user);
    if (id_usuario) {
      registrarAuditoria(id_usuario, role, 'EXPORTAR_DATOS', `tipo=${tipo} registros=${data.length}`, req.ip);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chatbot_${tipo}_${new Date().toISOString().split('T')[0]}.json"`);
    return res.json({ ok: true, data, total: data.length, tipo });
  } catch (error) {
    console.error('Error al exportar datos:', error);
    return res.status(500).json({ ok: false, message: 'No fue posible exportar los datos.' });
  }
});

module.exports = router;
