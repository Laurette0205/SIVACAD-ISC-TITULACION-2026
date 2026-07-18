const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { handleAsistenteMessage, getAsistenteContext, clearAsistenteSession } = require('../services/asistenteOrchestrator');
const { getAsistenteContenido, buildContenidoContext } = require('../services/asistenteRAG');
const { getSystemStats, getSystemAudit, getUserSummary, getSystemConfig, getStudentAverage,
  getCoordDashboard, getCoordGroups, getCoordPeriods, getCoordStudentTracking, getCoordAlerts, getCoordGroupReport,
  getDocDashboard, getDocGroups, getDocEvaluations, getDocTracking, getDocAlerts, getDocKardex,
  getAlumDashboard, getAlumKardexDetalle, getAlumInscripciones, getAlumEvaluaciones,
  getSopDashboard, getSopPasswordResets, getSopSesiones, getSopIncidencias } = require('../services/asistenteTools');

const router = express.Router();

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');

  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      message: 'Token no disponible'
    });
  }

  const token = auth.slice(7).trim();

  try {
    const secret =
      process.env.JWT_SECRET ||
      process.env.JWT_KEY ||
      process.env.SECRET_KEY ||
      null;

    req.token = token;

    if (secret) {
      const decoded = jwt.verify(token, secret);
      req.user = decoded?.usuario || decoded?.user || decoded || null;
    } else {
      req.user = null;
    }

    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o expirado'
    });
  }
}

function getUserRoleName(user) {
  return normalizeRoleName(user?.rol_nombre || user?.rol || user?.role);
}

function getAssistantProfile(user) {
  const role = getUserRoleName(user);

  switch (role) {
    case 'ALUMNO':
      return {
        rol: role,
        nombre: 'Alumno',
        capacidades: [
          'horarios',
          'kardex',
          'materias',
          'becas',
          'reinscripción',
          'inscripción',
          'estado académico',
          'acompañamiento'
        ],
        saludo:
          'Hola, soy tu asistente académico institucional para ayudarte con temas escolares, becas, acompañamiento y seguimiento académico.'
      };

    case 'DOCENTE':
      return {
        rol: role,
        nombre: 'Docente',
        capacidades: [
          'grupos asignados',
          'evaluaciones',
          'listas',
          'incidencias',
          'reportes',
          'faltas grupales',
          'faltas por alumno'
        ],
        saludo:
          'Hola, soy tu asistente académico institucional para apoyo docente, seguimiento de grupos, evaluaciones e incidencias.'
      };

    case 'COORDINADOR':
      return {
        rol: role,
        nombre: 'Coordinador',
        capacidades: [
          'alertas',
          'deserción',
          'mapas de riesgo',
          'indicadores',
          'gráficas',
          'juntas',
          'comisiones'
        ],
        saludo:
          'Hola, soy tu asistente académico institucional para coordinación, alertas, riesgo académico e indicadores de gestión.'
      };

    case 'ADMINISTRADOR':
      return {
        rol: role,
        nombre: 'Administrador',
        capacidades: [
          'usuarios',
          'periodos',
          'validaciones',
          'estadísticas',
          'inscripciones',
          'reinscripciones',
          'control del sistema'
        ],
        saludo:
          'Hola, soy tu asistente institucional para control administrativo, usuarios, periodos y validaciones del sistema.'
      };

    case 'SOPORTE':
      return {
        rol: role,
        nombre: 'Soporte',
        capacidades: [
          'diagnóstico de errores',
          'trazas',
          'tickets',
          'fallas',
          'mantenimiento',
          'integridad del sistema'
        ],
        saludo:
          'Hola, soy tu asistente institucional para diagnóstico técnico, trazas, mantenimiento y atención de incidencias.'
      };

    default:
      return {
        rol: role || 'GENERAL',
        nombre: 'Asistente',
        capacidades: [
          'orientación general',
          'consultas institucionales',
          'ayuda académica'
        ],
        saludo:
          'Hola, soy el asistente académico institucional de SIVACAD.'
      };
  }
}

router.get('/contexto', authFromHeader, async (req, res) => {
  try {
    const profile = getAssistantProfile(req.user);
    const dbContext = await getAsistenteContext(pool, req.user).catch(() => ({}));

    return res.json({
      ok: true,
      data: {
        perfil: profile,
        contexto: {
          rol: profile.rol,
          nombre: profile.nombre,
          saludo: profile.saludo,
          capacidades: profile.capacidades,
          estado: 'ACTIVO',
          promedio: dbContext?.perfil?.promedio_general || null,
          semestre: dbContext?.perfil?.semestre_actual || null,
          carrera: dbContext?.perfil?.nombre_carrera || null
        }
      }
    });
  } catch (error) {
    console.error('Error en GET /api/asistente/contexto:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible cargar el contexto.'
    });
  }
});

router.post('/mensaje', authFromHeader, async (req, res) => {
  try {
    const mensaje = String(req.body?.mensaje || '').trim();

    if (!mensaje) {
      return res.status(400).json({
        ok: false,
        message: 'El mensaje es obligatorio.'
      });
    }

    const result = await handleAsistenteMessage(pool, req.user, mensaje);

    return res.json({
      ok: true,
      intent: result.intent,
      respuesta: result.respuesta,
      data: result.data || {},
      sesion: result.sesion || null
    });
  } catch (error) {
    console.error('Error en POST /api/asistente/mensaje:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible generar la respuesta.',
      respuesta: 'Lo siento, no pude procesar tu consulta. Intenta de nuevo o reformula tu pregunta.'
    });
  }
});

router.post('/limpiar', authFromHeader, async (req, res) => {
  try {
    await clearAsistenteSession(pool, req.user);

    return res.json({
      ok: true,
      message: 'Sesión del asistente limpiada.',
      data: {
        limpiado: true
      }
    });
  } catch (error) {
    console.error('Error en POST /api/asistente/limpiar:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'No fue posible limpiar la sesión.'
    });
  }
});

// =============================================
// ALUMNO — Endpoints exclusivos para Alumno
// =============================================

function requireAlum(req, res, next) {
  const userRole = normalizeRoleName(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  if (userRole !== 'ALUMNO' && userRole !== 'ADMINISTRADOR') {
    return res.status(403).json({ ok: false, message: 'Solo alumnos o administradores.' });
  }
  next();
}

router.get('/alumno/dashboard', authFromHeader, requireAlum, async (req, res) => {
  try {
    const dashboard = await getAlumDashboard(pool, req.user);
    return res.json({ ok: true, data: dashboard });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/alumno/kardex', authFromHeader, requireAlum, async (req, res) => {
  try {
    const kardex = await getAlumKardexDetalle(pool, req.user);
    if (!kardex) return res.status(404).json({ ok: false, message: 'Kardex no encontrado.' });
    return res.json({ ok: true, data: kardex });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/alumno/inscripciones', authFromHeader, requireAlum, async (req, res) => {
  try {
    const inscripciones = await getAlumInscripciones(pool, req.user);
    return res.json({ ok: true, data: inscripciones });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/alumno/evaluaciones', authFromHeader, requireAlum, async (req, res) => {
  try {
    const evaluaciones = await getAlumEvaluaciones(pool, req.user);
    return res.json({ ok: true, data: evaluaciones });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// =============================================
// SOPORTE — Endpoints exclusivos para Soporte
// =============================================

function requireSop(req, res, next) {
  const userRole = normalizeRoleName(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  if (userRole !== 'SOPORTE' && userRole !== 'ADMINISTRADOR') {
    return res.status(403).json({ ok: false, message: 'Solo soporte o administradores.' });
  }
  next();
}

router.get('/soporte/dashboard', authFromHeader, requireSop, async (req, res) => {
  try {
    const dashboard = await getSopDashboard(pool);
    return res.json({ ok: true, data: dashboard });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/soporte/incidencias', authFromHeader, requireSop, async (req, res) => {
  try {
    const incidencias = await getSopIncidencias(pool);
    return res.json({ ok: true, data: incidencias });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/soporte/bitacora', authFromHeader, requireSop, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const bitacora = await getSystemAudit(pool, limit);
    return res.json({ ok: true, data: bitacora });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/soporte/sesiones', authFromHeader, requireSop, async (req, res) => {
  try {
    const sesiones = await getSopSesiones(pool);
    return res.json({ ok: true, data: sesiones });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/soporte/resets', authFromHeader, requireSop, async (req, res) => {
  try {
    const resets = await getSopPasswordResets(pool);
    return res.json({ ok: true, data: resets });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// =============================================
// DOCENTE — Endpoints exclusivos para Docente
// =============================================

function requireDoc(req, res, next) {
  const userRole = normalizeRoleName(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  if (userRole !== 'DOCENTE' && userRole !== 'ADMINISTRADOR') {
    return res.status(403).json({ ok: false, message: 'Solo docentes o administradores.' });
  }
  next();
}

router.get('/docente/dashboard', authFromHeader, requireDoc, async (req, res) => {
  try {
    const dashboard = await getDocDashboard(pool, req.user);
    const groups = await getDocGroups(pool, req.user);
    return res.json({ ok: true, data: { dashboard, groups } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/docente/grupos', authFromHeader, requireDoc, async (req, res) => {
  try {
    const groups = await getDocGroups(pool, req.user);
    return res.json({ ok: true, data: groups });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/docente/evaluaciones', authFromHeader, requireDoc, async (req, res) => {
  try {
    const evaluations = await getDocEvaluations(pool, req.user);
    return res.json({ ok: true, data: evaluations });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/docente/seguimiento', authFromHeader, requireDoc, async (req, res) => {
  try {
    const filters = {};
    if (req.query.id_grupo) filters.id_grupo = Number(req.query.id_grupo);
    if (req.query.id_materia) filters.id_materia = Number(req.query.id_materia);
    if (req.query.search) filters.search = req.query.search;
    const tracking = await getDocTracking(pool, req.user, filters);
    return res.json({ ok: true, data: tracking });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/docente/alertas', authFromHeader, requireDoc, async (req, res) => {
  try {
    const alerts = await getDocAlerts(pool, req.user);
    return res.json({ ok: true, data: alerts });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/docente/kardex/:id_alumno', authFromHeader, requireDoc, async (req, res) => {
  try {
    const id_alumno = Number(req.params.id_alumno);
    if (!id_alumno) return res.status(400).json({ ok: false, message: 'ID de alumno requerido.' });
    const kardex = await getDocKardex(pool, req.user, id_alumno);
    if (!kardex) return res.status(404).json({ ok: false, message: 'Kardex no encontrado.' });
    return res.json({ ok: true, data: kardex });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// =============================================
// COORDINADOR — Endpoints exclusivos para Coordinador
// =============================================

function requireCoord(req, res, next) {
  const userRole = normalizeRoleName(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  if (userRole !== 'COORDINADOR' && userRole !== 'ADMINISTRADOR') {
    return res.status(403).json({ ok: false, message: 'Solo coordinadores o administradores.' });
  }
  next();
}

router.get('/coordinador/dashboard', authFromHeader, requireCoord, async (req, res) => {
  try {
    const dashboard = await getCoordDashboard(pool);
    const groups = await getCoordGroups(pool);
    return res.json({ ok: true, data: { dashboard, groups } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/coordinador/grupos', authFromHeader, requireCoord, async (req, res) => {
  try {
    const filters = {};
    if (req.query.id_periodo) filters.id_periodo = Number(req.query.id_periodo);
    if (req.query.id_carrera) filters.id_carrera = Number(req.query.id_carrera);
    if (req.query.semestre) filters.semestre = Number(req.query.semestre);
    const groups = await getCoordGroups(pool, filters);
    return res.json({ ok: true, data: groups });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/coordinador/periodos', authFromHeader, requireCoord, async (req, res) => {
  try {
    const periods = await getCoordPeriods(pool);
    return res.json({ ok: true, data: periods });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/coordinador/seguimiento', authFromHeader, requireCoord, async (req, res) => {
  try {
    const filters = {};
    if (req.query.id_grupo) filters.id_grupo = Number(req.query.id_grupo);
    if (req.query.id_periodo) filters.id_periodo = Number(req.query.id_periodo);
    if (req.query.estatus) filters.estatus = req.query.estatus;
    if (req.query.search) filters.search = req.query.search;
    const tracking = await getCoordStudentTracking(pool, filters);
    return res.json({ ok: true, data: tracking });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/coordinador/alertas', authFromHeader, requireCoord, async (req, res) => {
  try {
    const filters = {};
    if (req.query.nivel) filters.nivel = req.query.nivel;
    if (req.query.atendida !== undefined) filters.atendida = req.query.atendida === 'true' || req.query.atendida === '1';
    const alerts = await getCoordAlerts(pool, filters);
    return res.json({ ok: true, data: alerts });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/coordinador/reporte/grupo/:id_grupo', authFromHeader, requireCoord, async (req, res) => {
  try {
    const id_grupo = Number(req.params.id_grupo);
    if (!id_grupo) return res.status(400).json({ ok: false, message: 'ID de grupo requerido.' });
    const report = await getCoordGroupReport(pool, id_grupo);
    if (!report) return res.status(404).json({ ok: false, message: 'Grupo no encontrado.' });
    return res.json({ ok: true, data: report });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// =============================================
// ADMIN — Endpoints exclusivos para Administrador
// =============================================

function requireAdmin(req, res, next) {
  const userRole = normalizeRoleName(req.user?.rol_nombre || req.user?.rol || req.user?.role);
  if (userRole !== 'ADMINISTRADOR') {
    return res.status(403).json({ ok: false, message: 'Solo administradores.' });
  }
  next();
}

router.get('/admin/stats', authFromHeader, requireAdmin, async (req, res) => {
  try {
    const stats = await getSystemStats(pool);
    return res.json({ ok: true, data: stats });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/admin/auditoria', authFromHeader, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const audit = await getSystemAudit(pool, limit);
    return res.json({ ok: true, data: audit });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/admin/usuarios', authFromHeader, requireAdmin, async (req, res) => {
  try {
    const summary = await getUserSummary(pool);
    return res.json({ ok: true, data: summary });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/admin/config', authFromHeader, requireAdmin, async (req, res) => {
  try {
    const config = await getSystemConfig(pool);
    return res.json({ ok: true, data: config });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;