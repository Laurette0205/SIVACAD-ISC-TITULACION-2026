'use strict';

const express = require('express');
const pool = require('../config/db');
const { auth: verifyToken } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_TEMPLATES = [
  {
    codigo: 'FORMATIVA',
    nombre_plantilla: 'Evaluaci\u00f3n Formativa',
    descripcion: 'Instrumento de seguimiento continuo para identificar avances y \u00e1reas de oportunidad durante el periodo.',
    tipo_instrumento: 'POR_PERIODO',
    publico_objetivo: 'PERIODOS',
    escala: '1-5',
    ponderacion_total: 100,
    regla_convivencia: null,
    preguntas: [
      { criterio: 'Participaci\u00f3n y seguimiento', descripcion: 'Valora constancia, participaci\u00f3n y atenci\u00f3n.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 1 },
      { criterio: 'Comprensi\u00f3n progresiva', descripcion: 'Eval\u00faa el avance gradual en la comprensi\u00f3n.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 2 },
      { criterio: 'Aplicaci\u00f3n pr\u00e1ctica', descripcion: 'Mide la capacidad de aplicar lo aprendido.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 3 },
      { criterio: 'Trabajo colaborativo', descripcion: 'Considera la interacci\u00f3n con pares.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 4 },
      { criterio: 'Mejora continua', descripcion: 'Revisa evoluci\u00f3n y disposici\u00f3n para mejorar.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 5 }
    ]
  },
  {
    codigo: 'SUMATIVA',
    nombre_plantilla: 'Evaluaci\u00f3n Sumativa',
    descripcion: 'Instrumento para valorar resultados finales y desempe\u00f1o global.',
    tipo_instrumento: 'POR_MATERIA',
    publico_objetivo: 'MATERIAS',
    escala: '1-5',
    ponderacion_total: 100,
    regla_convivencia: null,
    preguntas: [
      { criterio: 'Cumplimiento de objetivos', descripcion: 'Valora el cumplimiento de metas.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 1 },
      { criterio: 'Calidad del resultado final', descripcion: 'Eval\u00faa la calidad del trabajo o producto.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 2 },
      { criterio: 'Dominio conceptual', descripcion: 'Mide el conocimiento acumulado.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 3 },
      { criterio: 'Desempe\u00f1o integral', descripcion: 'Considera el rendimiento general.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 4 }
    ]
  },
  {
    codigo: 'OBJETIVOS',
    nombre_plantilla: 'Evaluaci\u00f3n basada en objetivos',
    descripcion: 'Instrumento orientado al cumplimiento de metas e indicadores.',
    tipo_instrumento: 'POR_GRUPO',
    publico_objetivo: 'GRUPOS',
    escala: '1-5',
    ponderacion_total: 100,
    regla_convivencia: null,
    preguntas: [
      { criterio: 'Objetivo 1: logro esperado', descripcion: 'Grado de cumplimiento del primer objetivo.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 1 },
      { criterio: 'Objetivo 2: evidencia de aprendizaje', descripcion: 'Verifica la evidencia del segundo objetivo.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 2 },
      { criterio: 'Objetivo 3: impacto acad\u00e9mico', descripcion: 'Mide el efecto del trabajo realizado.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 3 },
      { criterio: 'Objetivo 4: consistencia', descripcion: 'Revisa coherencia entre lo planeado y lo obtenido.', peso: 25, tipo_respuesta: 'NUMERICA', orden_pregunta: 4 }
    ]
  },
  {
    codigo: 'IPSATIVA',
    nombre_plantilla: 'Evaluaci\u00f3n Ipsativa',
    descripcion: 'Instrumento que compara el progreso actual con el desempe\u00f1o previo.',
    tipo_instrumento: 'POR_PERIODO',
    publico_objetivo: 'ALUMNOS',
    escala: '1-5',
    ponderacion_total: 100,
    regla_convivencia: null,
    preguntas: [
      { criterio: 'Progreso respecto al periodo anterior', descripcion: 'Compara la mejora con el historial del estudiante.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 1 },
      { criterio: 'H\u00e1bitos de estudio', descripcion: 'Eval\u00faa disciplina y constancia.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 2 },
      { criterio: 'Autonom\u00eda', descripcion: 'Valora independencia y toma de decisiones.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 3 },
      { criterio: 'Autorregulaci\u00f3n', descripcion: 'Revisa capacidad para organizar el esfuerzo propio.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 4 },
      { criterio: 'Mejora comparativa', descripcion: 'Observa el avance general frente a ciclos previos.', peso: 20, tipo_respuesta: 'NUMERICA', orden_pregunta: 5 }
    ]
  },
  {
    codigo: 'ALUMNO_DOCENTE',
    nombre_plantilla: 'Alumno a Docente',
    descripcion: 'Instrumento para valorar la pr\u00e1ctica docente desde la experiencia del alumno.',
    tipo_instrumento: 'ALUMNO_POR_DOCENTES',
    publico_objetivo: 'DOCENTES',
    escala: '1-5',
    ponderacion_total: 100,
    regla_convivencia: 'La retroalimentaci\u00f3n debe ser acad\u00e9mica, respetuosa y objetiva.',
    preguntas: [
      { criterio: 'Dominio de la materia', descripcion: 'Explica con claridad los contenidos.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 1 },
      { criterio: 'Puntualidad y cumplimiento', descripcion: 'Llega a tiempo y cumple con lo planeado.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 2 },
      { criterio: 'Metodolog\u00eda y did\u00e1ctica', descripcion: 'Utiliza estrategias comprensibles y \u00fatiles.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 3 },
      { criterio: 'Claridad y comunicaci\u00f3n', descripcion: 'Comunica instrucciones y objetivos con claridad.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 4 },
      { criterio: 'Evaluaci\u00f3n justa y transparente', descripcion: 'Eval\u00faa con criterios claros y equilibrados.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 5 },
      { criterio: 'Calidad humana y trato', descripcion: 'Mantiene una relaci\u00f3n respetuosa y profesional.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 6 },
      { criterio: 'Retroalimentaci\u00f3n formativa', descripcion: 'Brinda observaciones \u00fatiles para mejorar.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 7 },
      { criterio: 'Uso de tecnolog\u00edas', descripcion: 'Integra recursos digitales adecuadamente.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 8 },
      { criterio: 'Pensamiento cr\u00edtico', descripcion: 'Promueve an\u00e1lisis y argumentaci\u00f3n acad\u00e9mica.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 9 },
      { criterio: 'Innovaci\u00f3n y actualizaci\u00f3n', descripcion: 'Demuestra actualizaci\u00f3n disciplinar.', peso: 10, tipo_respuesta: 'NUMERICA', orden_pregunta: 10 },
      { criterio: 'Retroalimentaci\u00f3n general', descripcion: 'Comentario final acad\u00e9mico y motivador.', peso: 0, tipo_respuesta: 'TEXTO', orden_pregunta: 11 }
    ]
  }
];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toMysqlDatetime(value) {
  if (!value) return null;
  const input = String(value).trim();
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input.replace('T', ' ').slice(0, 19);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sendError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

function authFromHeader(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return sendError(res, 401, 'Token no disponible');
  }
  return verifyToken(req, res, next);
}

function getRoleName(user) {
  return normalizeUpper(user?.rol_nombre || user?.rol || user?.role);
}

function getRoleId(user) {
  return Number(user?.rol_id || user?.id_rol || user?.role_id || 0);
}

function isAdmin(roleName, roleId) {
  return roleName === 'ADMINISTRADOR' || roleId === 1;
}

function isCoordinator(roleName, roleId) {
  return roleName === 'COORDINADOR' || roleId === 2;
}

function canAdminEvaluations(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);
  return isAdmin(roleName, roleId);
}

function canSuperviseEvaluations(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);
  return isAdmin(roleName, roleId) || isCoordinator(roleName, roleId);
}

async function logAuditoria(conn, idEvaluacion, idUsuario, accion, detalle = null, observaciones = null, ip = null) {
  try {
    await conn.execute(
      `INSERT INTO evaluacion_auditoria (id_evaluacion, id_usuario, accion, detalle, observaciones, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idEvaluacion || null, idUsuario, accion, detalle ? String(detalle).slice(0, 500) : null, observaciones ? String(observaciones).slice(0, 255) : null, ip || null]
    );
  } catch (err) {
    console.error('Error al registrar auditor\u00eda:', err);
  }
}

function mapQuestionRow(row) {
  return {
    id_pregunta: row.id_pregunta,
    id_pregunta_plantilla: row.id_pregunta_plantilla || null,
    id_plantilla: row.id_plantilla,
    criterio: row.criterio,
    descripcion: row.descripcion,
    peso: Number(row.peso ?? 0),
    tipo_respuesta: row.tipo_respuesta || 'NUMERICA',
    orden_pregunta: Number(row.orden_pregunta ?? 1),
    activo: Number(row.activo ?? 1)
  };
}

function mapTemplateRow(row, questions = []) {
  return {
    id_plantilla: row.id_plantilla,
    codigo: row.codigo_plantilla,
    nombre_plantilla: row.nombre_plantilla,
    descripcion: row.descripcion,
    tipo_instrumento: row.tipo_instrumento,
    publico_objetivo: row.publico_objetivo,
    escala: row.escala,
    ponderacion_total: Number(row.ponderacion_total ?? 100),
    regla_convivencia: row.regla_convivencia || null,
    activo: Number(row.activo ?? 1),
    preguntas: questions
      .filter((q) => Number(q.id_plantilla) === Number(row.id_plantilla))
      .sort((a, b) => Number(a.orden_pregunta) - Number(b.orden_pregunta))
      .map((q) => ({
        id_pregunta: q.id_pregunta,
        id_pregunta_plantilla: q.id_pregunta_plantilla || null,
        id_plantilla: q.id_plantilla,
        criterio: q.criterio,
        descripcion: q.descripcion,
        peso: Number(q.peso ?? 0),
        tipo_respuesta: q.tipo_respuesta || 'NUMERICA',
        orden_pregunta: Number(q.orden_pregunta ?? 1),
        activo: Number(q.activo ?? 1)
      }))
  };
}

async function ensureEvaluationSchema(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS evaluacion_preguntas (
      id_pregunta BIGINT AUTO_INCREMENT PRIMARY KEY,
      id_evaluacion BIGINT NOT NULL,
      id_pregunta_plantilla BIGINT NULL,
      criterio VARCHAR(180) NOT NULL,
      descripcion TEXT NULL,
      peso DECIMAL(6,2) DEFAULT 0,
      tipo_respuesta ENUM('NUMERICA','TEXTO','SELECT','SI_NO') DEFAULT 'NUMERICA',
      orden_pregunta INT DEFAULT 1,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_evaluacion_orden (id_evaluacion, orden_pregunta),
      KEY idx_evaluacion_preguntas_eval (id_evaluacion),
      KEY idx_evaluacion_preguntas_plantilla (id_pregunta_plantilla),
      CONSTRAINT fk_evaluacion_preguntas_eval
        FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones(id_evaluacion)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_evaluacion_preguntas_plantilla
        FOREIGN KEY (id_pregunta_plantilla) REFERENCES evaluacion_plantilla_preguntas(id_pregunta)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensureSeedCatalogs(conn) {
  for (const template of DEFAULT_TEMPLATES) {
    await conn.execute(
      `INSERT INTO evaluacion_plantillas
        (codigo_plantilla, nombre_plantilla, descripcion, tipo_instrumento, publico_objetivo, escala, ponderacion_total, regla_convivencia, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        nombre_plantilla = VALUES(nombre_plantilla),
        descripcion = VALUES(descripcion),
        tipo_instrumento = VALUES(tipo_instrumento),
        publico_objetivo = VALUES(publico_objetivo),
        escala = VALUES(escala),
        ponderacion_total = VALUES(ponderacion_total),
        regla_convivencia = VALUES(regla_convivencia),
        activo = 1`,
      [template.codigo, template.nombre_plantilla, template.descripcion, template.tipo_instrumento, template.publico_objetivo, template.escala, template.ponderacion_total, template.regla_convivencia]
    );
    const [tplRows] = await conn.execute('SELECT id_plantilla FROM evaluacion_plantillas WHERE codigo_plantilla = ? LIMIT 1', [template.codigo]);
    const idPlantilla = tplRows?.[0]?.id_plantilla;
    if (!idPlantilla) continue;
    for (const q of template.preguntas) {
      const [existing] = await conn.execute('SELECT id_pregunta FROM evaluacion_plantilla_preguntas WHERE id_plantilla = ? AND orden_pregunta = ? LIMIT 1', [idPlantilla, q.orden_pregunta]);
      if (existing.length) {
        await conn.execute('UPDATE evaluacion_plantilla_preguntas SET criterio = ?, descripcion = ?, peso = ?, tipo_respuesta = ?, activo = 1 WHERE id_pregunta = ?',
          [q.criterio, q.descripcion, q.peso, q.tipo_respuesta || 'NUMERICA', existing[0].id_pregunta]);
      } else {
        await conn.execute('INSERT INTO evaluacion_plantilla_preguntas (id_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [idPlantilla, q.criterio, q.descripcion, q.peso, q.tipo_respuesta || 'NUMERICA', q.orden_pregunta]);
      }
    }
  }
}

async function loadCatalogs(conn) {
  await ensureEvaluationSchema(conn);
  await ensureSeedCatalogs(conn);
  const [tplRows] = await conn.execute('SELECT id_plantilla, codigo_plantilla, nombre_plantilla, descripcion, tipo_instrumento, publico_objetivo, escala, ponderacion_total, regla_convivencia, activo FROM evaluacion_plantillas ORDER BY id_plantilla ASC');
  const [questionRows] = await conn.execute('SELECT id_pregunta, id_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo FROM evaluacion_plantilla_preguntas ORDER BY id_plantilla ASC, orden_pregunta ASC');
  const [periodRows] = await conn.execute('SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin, estado FROM periodos ORDER BY fecha_inicio DESC, id_periodo DESC');
  const plantillas = tplRows.map((row) => mapTemplateRow(row, questionRows));
  const resumen = { total_plantillas: plantillas.length, total_preguntas: questionRows.length, tipos: plantillas.length, objetivos: new Set(plantillas.map((p) => p.publico_objetivo)).size, escalas: new Set(plantillas.map((p) => p.escala)).size };
  return { plantillas, preguntas: questionRows.map(mapQuestionRow), resumen, periodos: periodRows };
}

async function loadEvaluations(conn, filters = {}) {
  const where = [];
  const params = [];
  if (filters.id_periodo) { where.push('e.id_periodo = ?'); params.push(Number(filters.id_periodo)); }
  if (filters.estado) { where.push('UPPER(e.estado) = ?'); params.push(normalizeUpper(filters.estado)); }
  if (filters.tipo_instrumento) { where.push('UPPER(e.tipo_instrumento) = ?'); params.push(normalizeUpper(filters.tipo_instrumento)); }
  if (filters.publico_objetivo) { where.push('UPPER(e.publico_objetivo) = ?'); params.push(normalizeUpper(filters.publico_objetivo)); }
  if (filters.escala) { where.push('e.escala = ?'); params.push(normalizeText(filters.escala)); }
  if (filters.q || filters.search) {
    const term = `%${normalizeText(filters.q || filters.search)}%`;
    where.push('(e.titulo LIKE ? OR e.descripcion LIKE ? OR p.nombre_periodo LIKE ? OR tp.nombre_plantilla LIKE ?)');
    params.push(term, term, term, term);
  }
  const [rows] = await conn.execute(`
    SELECT e.id_evaluacion, e.id_periodo, e.id_plantilla, e.titulo, e.descripcion,
      e.fecha_inicio, e.fecha_fin, UPPER(e.estado) AS estado,
      e.tipo_instrumento, e.publico_objetivo, e.escala, e.ponderacion_total,
      e.creado_por, e.creado_en, e.cerrado_por, e.cerrado_en, e.cerrado_observaciones,
      p.nombre_periodo, COALESCE(tp.nombre_plantilla, e.tipo_instrumento) AS nombre_tipo,
      COALESCE(tp.codigo_plantilla, e.tipo_instrumento) AS codigo_plantilla,
      COALESCE(tp.regla_convivencia, NULL) AS regla_convivencia,
      COUNT(pr.id_pregunta) AS total_preguntas,
      COUNT(DISTINCT r.id_resultado) AS total_resultados
    FROM evaluaciones e
    LEFT JOIN periodos p ON p.id_periodo = e.id_periodo
    LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
    LEFT JOIN evaluacion_preguntas pr ON pr.id_evaluacion = e.id_evaluacion
    LEFT JOIN evaluacion_resultados r ON r.id_evaluacion = e.id_evaluacion
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY e.id_evaluacion ORDER BY e.id_evaluacion DESC`, params);
  return rows;
}

async function loadEvaluationDetail(conn, idEvaluacion) {
  const [rows] = await conn.execute(`
    SELECT e.id_evaluacion, e.id_periodo, e.id_plantilla, e.titulo, e.descripcion,
      e.fecha_inicio, e.fecha_fin, UPPER(e.estado) AS estado,
      e.tipo_instrumento, e.publico_objetivo, e.escala, e.ponderacion_total,
      e.creado_por, e.creado_en, e.cerrado_por, e.cerrado_en, e.cerrado_observaciones, e.actualizado_por,
      p.nombre_periodo, tp.nombre_plantilla, tp.codigo_plantilla, tp.regla_convivencia
    FROM evaluaciones e
    LEFT JOIN periodos p ON p.id_periodo = e.id_periodo
    LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
    WHERE e.id_evaluacion = ? LIMIT 1`, [idEvaluacion]);
  const evaluation = rows?.[0] || null;
  if (!evaluation) return null;
  const [questions] = await conn.execute('SELECT id_pregunta, id_evaluacion, id_pregunta_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo FROM evaluacion_preguntas WHERE id_evaluacion = ? ORDER BY orden_pregunta ASC, id_pregunta ASC', [idEvaluacion]);
  const [results] = await conn.execute('SELECT r.id_resultado, r.id_evaluacion, r.id_evaluado, r.tipo_evaluado, r.promedio_final, r.observacion_general, r.validado_por, r.validado_en, r.estado_validacion, r.creado_en FROM evaluacion_resultados r WHERE r.id_evaluacion = ? ORDER BY r.creado_en DESC', [idEvaluacion]);
  const [responses] = await conn.execute('SELECT COUNT(*) AS total FROM respuestas_evaluacion WHERE id_evaluacion = ?', [idEvaluacion]);
  return { ...evaluation, preguntas: questions, resultados: results, total_respuestas: Number(responses?.[0]?.total || 0) };
}

async function loadResumen(conn) {
  const [rows] = await conn.execute(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN UPPER(estado) = 'ACTIVA' THEN 1 ELSE 0 END) AS activas,
      SUM(CASE WHEN UPPER(estado) = 'CERRADA' THEN 1 ELSE 0 END) AS cerradas,
      SUM(CASE WHEN UPPER(estado) = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
      SUM(CASE WHEN UPPER(estado) = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas,
      COUNT(DISTINCT id_periodo) AS periodos,
      COUNT(DISTINCT id_plantilla) AS plantillas,
      COUNT(DISTINCT tipo_instrumento) AS tipos,
      COUNT(DISTINCT publico_objetivo) AS objetivos,
      COUNT(DISTINCT escala) AS escalas
    FROM evaluaciones`);
  const base = rows?.[0] || {};
  return { total: Number(base.total || 0), activas: Number(base.activas || 0), cerradas: Number(base.cerradas || 0), borradores: Number(base.borradores || 0), canceladas: Number(base.canceladas || 0), periodos: Number(base.periodos || 0), plantillas: Number(base.plantillas || 0), tipos: Number(base.tipos || 0), objetivos: Number(base.objetivos || 0), escalas: Number(base.escalas || 0) };
}

async function insertEvaluationWithQuestions(conn, body, user, templateByCode, ip = null) {
  const titulo = normalizeText(body.titulo);
  const descripcion = normalizeText(body.descripcion);
  const fechaInicio = toMysqlDatetime(body.fecha_inicio);
  const fechaFin = toMysqlDatetime(body.fecha_fin);
  const idPeriodo = Number(body.id_periodo || 0);
  const idPlantilla = Number(body.id_plantilla || templateByCode?.id_plantilla || 0);
  const tipoInstrumento = normalizeUpper(body.tipo_instrumento || templateByCode?.tipo_instrumento || 'POR_PERIODO');
  const publicoObjetivo = normalizeUpper(body.publico_objetivo || templateByCode?.publico_objetivo || 'PERIODOS');
  const escala = normalizeText(body.escala || templateByCode?.escala || '1-5');
  const ponderacionTotal = Number(body.ponderacion_total || templateByCode?.ponderacion_total || 100);
  if (!idPeriodo) throw new Error('El ID de periodo es obligatorio.');
  if (!idPlantilla) throw new Error('El ID de plantilla es obligatorio.');
  if (!titulo) throw new Error('El t\u00edtulo es obligatorio.');
  if (!fechaInicio || !fechaFin) throw new Error('La fecha de inicio y la fecha de fin son obligatorias.');
  if (!body.preguntas || !Array.isArray(body.preguntas) || body.preguntas.length === 0) throw new Error('La evaluaci\u00f3n debe incluir al menos una pregunta.');
  await conn.beginTransaction();
  const [result] = await conn.execute(
    `INSERT INTO evaluaciones (id_periodo, id_plantilla, titulo, descripcion, fecha_inicio, fecha_fin, estado, creado_por, tipo_instrumento, publico_objetivo, escala, ponderacion_total)
     VALUES (?, ?, ?, ?, ?, ?, 'BORRADOR', ?, ?, ?, ?, ?)`,
    [idPeriodo, idPlantilla, titulo, descripcion || null, fechaInicio, fechaFin, Number(user?.id_usuario || 0), tipoInstrumento, publicoObjetivo, escala, ponderacionTotal]);
  const idEvaluacion = result.insertId;
  for (let i = 0; i < body.preguntas.length; i += 1) {
    const q = body.preguntas[i] || {};
    const criterio = normalizeText(q.criterio);
    const descripcionPregunta = normalizeText(q.descripcion);
    const peso = Number(q.peso || 0);
    const tipoRespuesta = normalizeUpper(q.tipo_respuesta || 'NUMERICA');
    const ordenPregunta = Number(q.orden_pregunta || i + 1);
    const idPreguntaPlantilla = Number(q.id_pregunta_plantilla || q.id_pregunta || 0) || null;
    if (!criterio) throw new Error(`La pregunta ${i + 1} no tiene criterio.`);
    await conn.execute('INSERT INTO evaluacion_preguntas (id_evaluacion, id_pregunta_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [idEvaluacion, idPreguntaPlantilla, criterio, descripcionPregunta || null, peso, tipoRespuesta, ordenPregunta]);
  }
  await logAuditoria(conn, idEvaluacion, Number(user?.id_usuario || 0), 'CREAR', `Evaluaci\u00f3n "${titulo}" creada con ${body.preguntas.length} preguntas`, null, ip);
  await conn.commit();
  return idEvaluacion;
}

// ==================== ROUTES ====================

router.get('/catalogos', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const catalogos = await loadCatalogs(conn);
    return res.json({ ok: true, catalogos, data: catalogos });
  } catch (error) {
    console.error('ERROR /evaluaciones/catalogos:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar los cat\u00e1logos de evaluaciones');
  } finally { conn.release(); }
});

router.get('/resumen', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const resumen = await loadResumen(conn);
    return res.json({ ok: true, resumen, data: resumen });
  } catch (error) {
    console.error('ERROR /evaluaciones/resumen:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar el resumen de evaluaciones');
  } finally { conn.release(); }
});

router.get('/', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const rows = await loadEvaluations(conn, req.query || {});
    return res.json({ ok: true, data: rows, evaluaciones: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar las evaluaciones');
  } finally { conn.release(); }
});

router.post('/', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para crear evaluaciones.');
    const body = req.body || {};
    const catalogos = await loadCatalogs(conn);
    const templateKey = normalizeUpper(body.codigo_plantilla || body.plantilla || body.template || body.tipo_instrumento || '');
    const templateByCode = catalogos.plantillas.find((tpl) => {
      const code = normalizeUpper(tpl.codigo);
      const label = normalizeUpper(tpl.nombre_plantilla);
      return code === templateKey || label === templateKey || normalizeUpper(tpl.tipo_instrumento) === templateKey;
    });
    const preguntasDesdePlantilla = Array.isArray(body.preguntas) && body.preguntas.length ? body.preguntas : templateByCode?.preguntas || [];
    if (!preguntasDesdePlantilla.length) return sendError(res, 400, 'La evaluaci\u00f3n debe incluir preguntas o una plantilla v\u00e1lida.');
    const idEvaluacion = await insertEvaluationWithQuestions(conn, { ...body, id_plantilla: body.id_plantilla || templateByCode?.id_plantilla, tipo_instrumento: body.tipo_instrumento || templateByCode?.tipo_instrumento || 'POR_PERIODO', publico_objetivo: body.publico_objetivo || templateByCode?.publico_objetivo || 'PERIODOS', escala: body.escala || templateByCode?.escala || '1-5', ponderacion_total: body.ponderacion_total || templateByCode?.ponderacion_total || 100, preguntas: preguntasDesdePlantilla }, req.user, templateByCode, req.ip);
    const [rows] = await conn.execute('SELECT e.id_evaluacion, e.id_periodo, e.id_plantilla, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin, UPPER(e.estado) AS estado, e.tipo_instrumento, e.publico_objetivo, e.escala, e.ponderacion_total, p.nombre_periodo FROM evaluaciones e LEFT JOIN periodos p ON p.id_periodo = e.id_periodo WHERE e.id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    return res.status(201).json({ ok: true, message: 'Evaluaci\u00f3n creada correctamente.', data: rows?.[0] || { id_evaluacion: idEvaluacion } });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    console.error('ERROR POST /evaluaciones:', error);
    return sendError(res, 500, error.message || 'Error al crear la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.get('/auditoria', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const limit = Math.min(Number(req.query?.limit || 100), 500);
    const [rows] = await conn.execute(`
      SELECT a.id_auditoria, a.id_evaluacion, a.id_usuario, a.accion, a.detalle, a.observaciones, a.creado_en,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario_nombre,
        COALESCE(r.nombre_rol, '\u2014') AS rol_nombre,
        COALESCE(ev.titulo, '\u2014') AS evaluacion_titulo
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN evaluaciones ev ON ev.id_evaluacion = a.id_evaluacion
      ORDER BY a.creado_en DESC
      LIMIT ?`, [limit]);
    return res.json({ ok: true, data: rows, auditoria: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/auditoria:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar la auditor\u00eda global');
  } finally { conn.release(); }
});

router.get('/resultados', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para consultar resultados.');
    const idEvaluacion = Number(req.query?.id_evaluacion || 0);
    const where = [];
    const params = [];
    if (idEvaluacion) { where.push('r.id_evaluacion = ?'); params.push(idEvaluacion); }
    if (req.query?.estado_validacion) { where.push('r.estado_validacion = ?'); params.push(normalizeUpper(req.query.estado_validacion)); }
    const [rows] = await conn.execute(`
      SELECT r.id_resultado, r.id_evaluacion, r.id_evaluado, r.tipo_evaluado,
        r.promedio_final, r.observacion_general, r.validado_por, r.validado_en, r.estado_validacion, r.creado_en,
        e.titulo AS evaluacion_titulo,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS validado_por_nombre
      FROM evaluacion_resultados r
      JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
      LEFT JOIN usuarios u ON u.id_usuario = r.validado_por
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.creado_en DESC
      LIMIT 200`, params);
    return res.json({ ok: true, data: rows, resultados: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/resultados:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar los resultados');
  } finally { conn.release(); }
});

router.get('/seguimiento', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para consultar seguimiento.');
    const [rows] = await conn.execute(`
      SELECT
        e.id_evaluacion, e.titulo, UPPER(e.estado) AS estado,
        e.fecha_inicio, e.fecha_fin, e.creado_en, e.cerrado_en,
        p.nombre_periodo,
        tp.codigo_plantilla, tp.nombre_plantilla,
        COUNT(DISTINCT pr.id_pregunta) AS total_preguntas,
        COUNT(DISTINCT rsp.id_respuesta) AS total_respuestas,
        COUNT(DISTINCT rr.id_resultado) AS total_resultados,
        SUM(CASE WHEN rr.estado_validacion = 'VALIDADO' THEN 1 ELSE 0 END) AS resultados_validados,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS creado_por_nombre
      FROM evaluaciones e
      JOIN periodos p ON p.id_periodo = e.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      LEFT JOIN evaluacion_preguntas pr ON pr.id_evaluacion = e.id_evaluacion
      LEFT JOIN respuestas_evaluacion rsp ON rsp.id_evaluacion = e.id_evaluacion
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion
      LEFT JOIN usuarios u ON u.id_usuario = e.creado_por
      GROUP BY e.id_evaluacion
      ORDER BY e.creado_en DESC
      LIMIT 200`, []);
    return res.json({ ok: true, data: rows, seguimiento: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/seguimiento:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar el seguimiento global');
  } finally { conn.release(); }
});

// ==================== COORDINADOR ENDPOINTS ====================

router.get('/grupos', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'Acceso restringido.');
    const idPeriodo = Number(req.query?.id_periodo || 0);
    const where = [];
    const params = [];
    if (idPeriodo) { where.push('e.id_periodo = ?'); params.push(idPeriodo); }
    const [rows] = await conn.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno,
        COUNT(DISTINCT e.id_evaluacion) AS total_evaluaciones,
        SUM(CASE WHEN UPPER(e.estado) = 'ACTIVA' THEN 1 ELSE 0 END) AS evaluaciones_activas,
        SUM(CASE WHEN UPPER(e.estado) = 'CERRADA' THEN 1 ELSE 0 END) AS evaluaciones_cerradas,
        COUNT(DISTINCT rsp.id_respuesta) AS total_respuestas,
        COUNT(DISTINCT rr.id_resultado) AS total_resultados,
        COALESCE(AVG(rr.promedio_final), 0) AS promedio_general
      FROM grupos g
      LEFT JOIN evaluaciones e ON e.id_periodo = g.id_periodo
      LEFT JOIN respuestas_evaluacion rsp ON rsp.id_evaluacion = e.id_evaluacion
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY g.id_grupo, g.nombre_grupo, g.semestre, g.turno
      ORDER BY g.semestre ASC, g.nombre_grupo ASC
      LIMIT 200`, params);
    return res.json({ ok: true, data: rows, grupos: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/grupos:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar evaluaciones por grupo');
  } finally { conn.release(); }
});

router.get('/seguimiento/grupos', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'Acceso restringido.');
    const idGrupo = Number(req.query?.id_grupo || 0);
    const where = [];
    const params = [];
    if (idGrupo) { where.push('g.id_grupo = ?'); params.push(idGrupo); }
    const [rows] = await conn.execute(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre,
        e.id_evaluacion, e.titulo AS evaluacion_titulo, UPPER(e.estado) AS estado,
        e.fecha_inicio, e.fecha_fin, e.creado_en,
        tp.nombre_plantilla,
        COUNT(DISTINCT pr.id_pregunta) AS total_preguntas,
        COUNT(DISTINCT rsp.id_respuesta) AS total_respuestas,
        COUNT(DISTINCT rr.id_resultado) AS total_resultados,
        COALESCE(AVG(rr.promedio_final), 0) AS promedio
      FROM grupos g
      JOIN evaluaciones e ON e.id_periodo = g.id_periodo
      LEFT JOIN evaluacion_plantillas tp ON tp.id_plantilla = e.id_plantilla
      LEFT JOIN evaluacion_preguntas pr ON pr.id_evaluacion = e.id_evaluacion
      LEFT JOIN respuestas_evaluacion rsp ON rsp.id_evaluacion = e.id_evaluacion
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY g.id_grupo, g.nombre_grupo, g.semestre, e.id_evaluacion, e.titulo, e.estado, e.fecha_inicio, e.fecha_fin, e.creado_en, tp.nombre_plantilla
      ORDER BY g.semestre ASC, g.nombre_grupo ASC, e.creado_en DESC
      LIMIT 200`, params);
    return res.json({ ok: true, data: rows, seguimiento_grupos: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/seguimiento/grupos:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar el seguimiento por grupo');
  } finally { conn.release(); }
});

router.get('/alertas', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'Acceso restringido.');
    const incluirAtendidas = req.query?.incluir_atendidas === '1';
    const where = incluirAtendidas ? [] : ['a.atendida = 0'];
    const params = [];
    if (req.query?.nivel) { where.push('a.nivel = ?'); params.push(normalizeUpper(req.query.nivel)); }
    if (req.query?.id_evaluacion) { where.push('a.id_evaluacion = ?'); params.push(Number(req.query.id_evaluacion)); }
    const [rows] = await conn.execute(`
      SELECT a.id_alerta, a.id_evaluacion, a.id_grupo, a.tipo_alerta, a.descripcion, a.nivel,
        a.atendida, a.atendida_por, a.atendida_en, a.creado_en,
        e.titulo AS evaluacion_titulo,
        g.nombre_grupo,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS atendida_por_nombre
      FROM evaluacion_alertas a
      LEFT JOIN evaluaciones e ON e.id_evaluacion = a.id_evaluacion
      LEFT JOIN grupos g ON g.id_grupo = a.id_grupo
      LEFT JOIN usuarios u ON u.id_usuario = a.atendida_por
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.nivel DESC, a.creado_en DESC
      LIMIT 100`, params);
    return res.json({ ok: true, data: rows, alertas: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/alertas:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar las alertas');
  } finally { conn.release(); }
});

router.patch('/alertas/:id/atender', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'Acceso restringido.');
    const idAlerta = Number(req.params.id || 0);
    if (!idAlerta) return sendError(res, 400, 'ID de alerta inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT id_alerta FROM evaluacion_alertas WHERE id_alerta = ? LIMIT 1', [idAlerta]);
    if (!rows.length) return sendError(res, 404, 'La alerta no existe.');
    await conn.execute('UPDATE evaluacion_alertas SET atendida = 1, atendida_por = ?, atendida_en = NOW() WHERE id_alerta = ?',
      [Number(req.user?.id_usuario || 0), idAlerta]);
    return res.json({ ok: true, message: 'Alerta marcada como atendida.' });
  } catch (error) {
    console.error('ERROR PATCH /evaluaciones/alertas/:id/atender:', error);
    return sendError(res, 500, error.message || 'No fue posible atender la alerta');
  } finally { conn.release(); }
});

router.get('/resultados/parciales', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'Acceso restringido.');
    const idEvaluacion = Number(req.query?.id_evaluacion || 0);
    const idGrupo = Number(req.query?.id_grupo || 0);
    const where = [];
    const params = [];
    if (idEvaluacion) { where.push('e.id_evaluacion = ?'); params.push(idEvaluacion); }
    if (idGrupo) { where.push('g.id_grupo = ?'); params.push(idGrupo); }
    const [rows] = await conn.execute(`
      SELECT e.id_evaluacion, e.titulo AS evaluacion_titulo,
        g.id_grupo, g.nombre_grupo, g.semestre,
        COUNT(DISTINCT rsp.id_respuesta) AS total_respuestas,
        COALESCE(AVG(rsp.valor_numero), 0) AS promedio_respuestas,
        COUNT(DISTINCT rr.id_resultado) AS total_resultados,
        COALESCE(AVG(rr.promedio_final), 0) AS promedio_resultados,
        COUNT(DISTINCT CASE WHEN rsp.valor_numero IS NOT NULL THEN rsp.id_respuesta END) AS respuestas_numericas,
        COUNT(DISTINCT CASE WHEN rsp.valor_texto IS NOT NULL THEN rsp.id_respuesta END) AS respuestas_texto
      FROM evaluaciones e
      JOIN grupos g ON g.id_periodo = e.id_periodo
      LEFT JOIN respuestas_evaluacion rsp ON rsp.id_evaluacion = e.id_evaluacion
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY e.id_evaluacion, e.titulo, g.id_grupo, g.nombre_grupo, g.semestre
      ORDER BY g.semestre ASC, g.nombre_grupo ASC
      LIMIT 200`, params);
    return res.json({ ok: true, data: rows, parciales: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/resultados/parciales:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar resultados parciales');
  } finally { conn.release(); }
});

router.get('/:id', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const detail = await loadEvaluationDetail(conn, idEvaluacion);
    if (!detail) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    return res.json({ ok: true, data: detail, evaluacion: detail });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/:id:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar el detalle de la evaluaci\u00f3n');
  } finally { conn.release(); }
});

async function updateEvaluation(req, res) {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para editar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [existsRows] = await conn.execute('SELECT id_evaluacion FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!existsRows.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    const body = req.body || {};
    const allowed = [
      ['id_periodo', Number(body.id_periodo || 0) || null],
      ['id_plantilla', Number(body.id_plantilla || 0) || null],
      ['titulo', normalizeText(body.titulo)],
      ['descripcion', typeof body.descripcion === 'undefined' ? undefined : normalizeText(body.descripcion)],
      ['fecha_inicio', toMysqlDatetime(body.fecha_inicio)],
      ['fecha_fin', toMysqlDatetime(body.fecha_fin)],
      ['tipo_instrumento', body.tipo_instrumento ? normalizeUpper(body.tipo_instrumento) : undefined],
      ['publico_objetivo', body.publico_objetivo ? normalizeUpper(body.publico_objetivo) : undefined],
      ['escala', normalizeText(body.escala)],
      ['ponderacion_total', body.ponderacion_total === undefined ? undefined : Number(body.ponderacion_total)]
    ];
    const updates = [];
    const params = [];
    for (const [field, value] of allowed) {
      if (value === undefined || value === null || value === '') continue;
      updates.push(`${field} = ?`);
      params.push(value);
    }
    if (!updates.length) return sendError(res, 400, 'No se recibieron campos v\u00e1lidos para actualizar.');
    params.push(idEvaluacion);
    await conn.execute(`UPDATE evaluaciones SET ${updates.join(', ')} WHERE id_evaluacion = ?`, params);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'EDITAR', `Evaluaci\u00f3n #${idEvaluacion} actualizada`, null, req.ip);
    const detail = await loadEvaluationDetail(conn, idEvaluacion);
    return res.json({ ok: true, message: 'Evaluaci\u00f3n actualizada correctamente.', data: detail });
  } catch (error) {
    console.error('ERROR UPDATE /evaluaciones/:id:', error);
    return sendError(res, 500, error.message || 'No fue posible actualizar la evaluaci\u00f3n');
  } finally { conn.release(); }
}
router.put('/:id', authFromHeader, updateEvaluation);
router.patch('/:id', authFromHeader, updateEvaluation);

router.delete('/:id', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para eliminar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [evalRow] = await conn.execute('SELECT titulo FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    const titulo = evalRow?.[0]?.titulo || `#${idEvaluacion}`;
    const [result] = await conn.execute('DELETE FROM evaluaciones WHERE id_evaluacion = ?', [idEvaluacion]);
    if (!result.affectedRows) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'ELIMINAR', `Evaluaci\u00f3n "${titulo}" eliminada`, null, req.ip);
    return res.json({ ok: true, message: 'Evaluaci\u00f3n eliminada correctamente.' });
  } catch (error) {
    console.error('ERROR DELETE /evaluaciones/:id:', error);
    return sendError(res, 500, error.message || 'No fue posible eliminar la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.get('/:id/preguntas', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT id_pregunta, id_evaluacion, id_pregunta_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo FROM evaluacion_preguntas WHERE id_evaluacion = ? ORDER BY orden_pregunta ASC, id_pregunta ASC', [idEvaluacion]);
    return res.json({ ok: true, preguntas: rows, data: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/:id/preguntas:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar las preguntas de la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.post('/responder', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};
    const idEvaluacion = Number(body.id_evaluacion || 0);
    const idPregunta = Number(body.id_pregunta || 0);
    if (!idEvaluacion || !idPregunta) return sendError(res, 400, 'ID de evaluaci\u00f3n e ID de pregunta son obligatorios.');
    const [evalRow] = await conn.execute('SELECT UPPER(estado) AS estado FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!evalRow.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (evalRow[0].estado !== 'ACTIVA') return sendError(res, 400, 'Solo se pueden responder evaluaciones en estado ACTIVA.');

    const roleName = getRoleName(req.user);
    const roleId = getRoleId(req.user);
    const isAlumnoUser = roleName === 'ALUMNO' || roleId === 4;
    const isDocenteUser = roleName === 'DOCENTE' || roleId === 3;

    let idAlumno = null;
    let idDocente = null;

    if (isAlumnoUser) {
      const [alumnoRow] = await conn.execute('SELECT id_alumno FROM alumnos WHERE id_usuario = ? LIMIT 1', [req.user.id_usuario]);
      if (!alumnoRow.length) return sendError(res, 404, 'No se encontr\u00f3 un registro de alumno vinculado a tu cuenta.');
      idAlumno = alumnoRow[0].id_alumno;
    } else if (isDocenteUser) {
      const [docenteRow] = await conn.execute('SELECT id_docente FROM docentes WHERE id_usuario = ? LIMIT 1', [req.user.id_usuario]);
      if (docenteRow.length) idDocente = docenteRow[0].id_docente;
    } else if (canAdminEvaluations(req.user)) {
      idAlumno = body.id_alumno ? Number(body.id_alumno) : null;
      idDocente = body.id_docente ? Number(body.id_docente) : null;
    } else {
      return sendError(res, 403, 'No tienes permisos para responder evaluaciones.');
    }

    const valorNumero = body.valor_numero === '' || body.valor_numero === null || typeof body.valor_numero === 'undefined' ? null : Number(body.valor_numero);
    const valorTexto = body.valor_texto === null || typeof body.valor_texto === 'undefined' ? null : normalizeText(body.valor_texto);
    const [questionRows] = await conn.execute('SELECT id_pregunta, id_pregunta_plantilla, tipo_respuesta FROM evaluacion_preguntas WHERE id_pregunta = ? AND id_evaluacion = ? LIMIT 1', [idPregunta, idEvaluacion]);
    if (!questionRows.length) return sendError(res, 404, 'La pregunta seleccionada no existe en esta evaluaci\u00f3n.');
    const tipoRespuesta = normalizeUpper(questionRows[0].tipo_respuesta);
    let sourceQuestionId = questionRows[0].id_pregunta_plantilla ? Number(questionRows[0].id_pregunta_plantilla) : null;
    if (!sourceQuestionId) {
      const pregunta = questionRows[0];
      const [pRows] = await conn.execute('SELECT e.id_plantilla FROM evaluacion_preguntas ep INNER JOIN evaluaciones e ON e.id_evaluacion = ep.id_evaluacion WHERE ep.id_pregunta = ? LIMIT 1', [idPregunta]);
      if (!pRows.length) return sendError(res, 500, 'No fue posible resolver la pregunta asociada.');
      const ordenPregunta = pregunta.orden_pregunta || 1;
      const [existingMirror] = await conn.execute('SELECT id_pregunta FROM evaluacion_plantilla_preguntas WHERE id_plantilla = ? AND orden_pregunta = ? LIMIT 1', [pRows[0].id_plantilla, ordenPregunta]);
      if (existingMirror.length) {
        sourceQuestionId = existingMirror[0].id_pregunta;
      } else {
        const [newPlantillaPregunta] = await conn.execute('INSERT INTO evaluacion_plantilla_preguntas (id_plantilla, criterio, descripcion, peso, tipo_respuesta, orden_pregunta, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [pRows[0].id_plantilla, pregunta.criterio || 'Criterio', pregunta.descripcion || '', pregunta.peso || 0, pregunta.tipo_respuesta || 'NUMERICA', ordenPregunta]);
        sourceQuestionId = newPlantillaPregunta.insertId;
      }
      await conn.execute('UPDATE evaluacion_preguntas SET id_pregunta_plantilla = ? WHERE id_pregunta = ?', [sourceQuestionId, idPregunta]);
    }
    if (!sourceQuestionId) return sendError(res, 500, 'No fue posible resolver la pregunta de plantilla asociada.');
    if (tipoRespuesta === 'TEXTO' && !valorTexto) return sendError(res, 400, 'Esta pregunta requiere retroalimentaci\u00f3n textual.');
    if (tipoRespuesta !== 'TEXTO' && (valorNumero === null || Number.isNaN(valorNumero))) return sendError(res, 400, 'Esta pregunta requiere una puntuaci\u00f3n num\u00e9rica v\u00e1lida.');

    const [existing] = await conn.execute(
      'SELECT id_respuesta FROM respuestas_evaluacion WHERE id_evaluacion = ? AND id_pregunta = ? AND id_alumno <=> ? AND id_docente <=> ? LIMIT 1',
      [idEvaluacion, sourceQuestionId, idAlumno, idDocente]
    );

    if (existing.length) {
      await conn.execute('UPDATE respuestas_evaluacion SET valor_numero = ?, valor_texto = ? WHERE id_respuesta = ?',
        [valorNumero, valorTexto, existing[0].id_respuesta]);
    } else {
      await conn.execute('INSERT INTO respuestas_evaluacion (id_evaluacion, id_pregunta, id_alumno, id_docente, valor_numero, valor_texto) VALUES (?, ?, ?, ?, ?, ?)',
        [idEvaluacion, sourceQuestionId, idAlumno, idDocente, valorNumero, valorTexto]);
    }
    return res.json({ ok: true, message: 'Respuesta guardada correctamente.', data: { id_evaluacion: idEvaluacion, id_pregunta: idPregunta, valor_numero: valorNumero, valor_texto: valorTexto } });
  } catch (error) {
    console.error('ERROR POST /evaluaciones/responder:', error);
    return sendError(res, 500, error.message || 'No fue posible registrar la respuesta');
  } finally { conn.release(); }
});

// ==================== ADMIN ENDPOINTS ====================

router.post('/:id/activar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para activar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT UPPER(estado) AS estado, titulo FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!rows.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (rows[0].estado === 'ACTIVA') return sendError(res, 400, 'La evaluaci\u00f3n ya est\u00e1 activa.');
    if (rows[0].estado === 'CERRADA') return sendError(res, 400, 'No se puede activar una evaluaci\u00f3n cerrada.');
    if (rows[0].estado === 'CANCELADA') return sendError(res, 400, 'No se puede activar una evaluaci\u00f3n cancelada.');
    await conn.execute('UPDATE evaluaciones SET estado = ? WHERE id_evaluacion = ?', ['ACTIVA', idEvaluacion]);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'ACTIVAR', `Evaluaci\u00f3n "${rows[0].titulo}" activada`, null, req.ip);
    return res.json({ ok: true, message: 'Evaluaci\u00f3n activada correctamente.' });
  } catch (error) {
    console.error('ERROR POST /evaluaciones/:id/activar:', error);
    return sendError(res, 500, error.message || 'No fue posible activar la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.post('/:id/cerrar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para cerrar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT UPPER(estado) AS estado, titulo FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!rows.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (rows[0].estado === 'CERRADA') return sendError(res, 400, 'La evaluaci\u00f3n ya est\u00e1 cerrada.');
    if (rows[0].estado === 'CANCELADA') return sendError(res, 400, 'No se puede cerrar una evaluaci\u00f3n cancelada.');
    const observaciones = normalizeText(req.body?.observaciones || req.body?.motivo || '');
    await conn.execute('UPDATE evaluaciones SET estado = ?, cerrado_por = ?, cerrado_en = NOW(), cerrado_observaciones = ? WHERE id_evaluacion = ?',
      ['CERRADA', Number(req.user?.id_usuario || 0), observaciones || null, idEvaluacion]);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'CERRAR', `Evaluaci\u00f3n "${rows[0].titulo}" cerrada`, observaciones || null, req.ip);
    return res.json({ ok: true, message: 'Evaluaci\u00f3n cerrada correctamente.' });
  } catch (error) {
    console.error('ERROR POST /evaluaciones/:id/cerrar:', error);
    return sendError(res, 500, error.message || 'No fue posible cerrar la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.post('/:id/cancelar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para cancelar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT UPPER(estado) AS estado, titulo FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!rows.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    if (rows[0].estado === 'CANCELADA') return sendError(res, 400, 'La evaluaci\u00f3n ya est\u00e1 cancelada.');
    const motivo = normalizeText(req.body?.observaciones || req.body?.motivo || 'Sin motivo especificado');
    await conn.execute('UPDATE evaluaciones SET estado = ?, cerrado_por = ?, cerrado_en = NOW(), cerrado_observaciones = ? WHERE id_evaluacion = ?',
      ['CANCELADA', Number(req.user?.id_usuario || 0), motivo, idEvaluacion]);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'CANCELAR', `Evaluaci\u00f3n "${rows[0].titulo}" cancelada`, motivo, req.ip);
    return res.json({ ok: true, message: 'Evaluaci\u00f3n cancelada correctamente.' });
  } catch (error) {
    console.error('ERROR POST /evaluaciones/:id/cancelar:', error);
    return sendError(res, 500, error.message || 'No fue posible cancelar la evaluaci\u00f3n');
  } finally { conn.release(); }
});

router.post('/:id/validar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para validar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute('SELECT UPPER(estado) AS estado, titulo FROM evaluaciones WHERE id_evaluacion = ? LIMIT 1', [idEvaluacion]);
    if (!rows.length) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    const idResultado = Number(req.body?.id_resultado || 0);
    if (!idResultado) return sendError(res, 400, 'ID de resultado es obligatorio.');
    const [resRows] = await conn.execute('SELECT id_resultado FROM evaluacion_resultados WHERE id_resultado = ? AND id_evaluacion = ? LIMIT 1', [idResultado, idEvaluacion]);
    if (!resRows.length) return sendError(res, 404, 'El resultado no existe para esta evaluaci\u00f3n.');
    const estadoValidacion = normalizeUpper(req.body?.estado_validacion || 'VALIDADO');
    if (!['VALIDADO', 'RECHAZADO', 'NO_VALIDADO'].includes(estadoValidacion)) return sendError(res, 400, 'Estado de validaci\u00f3n inv\u00e1lido.');
    await conn.execute('UPDATE evaluacion_resultados SET estado_validacion = ?, validado_por = ?, validado_en = NOW() WHERE id_resultado = ?',
      [estadoValidacion, Number(req.user?.id_usuario || 0), idResultado]);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'VALIDAR',
      `Resultado #${idResultado} ${estadoValidacion === 'VALIDADO' ? 'validado' : estadoValidacion === 'RECHAZADO' ? 'rechazado' : 'reabierto'} para evaluaci\u00f3n "${rows[0].titulo}"`, null, req.ip);
    const label = estadoValidacion === 'VALIDADO' ? 'validado' : estadoValidacion === 'RECHAZADO' ? 'rechazado' : 'actualizado';
    return res.json({ ok: true, message: `Resultado ${label} correctamente.` });
  } catch (error) {
    console.error('ERROR POST /evaluaciones/:id/validar:', error);
    return sendError(res, 500, error.message || 'No fue posible validar el resultado');
  } finally { conn.release(); }
});

router.get('/:id/auditoria', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canSuperviseEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para consultar auditor\u00eda.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const [rows] = await conn.execute(`
      SELECT a.id_auditoria, a.id_evaluacion, a.id_usuario, a.accion, a.detalle, a.observaciones, a.creado_en,
        CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellido_paterno, '')) AS usuario_nombre,
        COALESCE(r.nombre_rol, '—') AS rol_nombre
      FROM evaluacion_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE a.id_evaluacion = ?
      ORDER BY a.creado_en DESC
      LIMIT 100`, [idEvaluacion]);
    return res.json({ ok: true, data: rows, auditoria: rows });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/:id/auditoria:', error);
    return sendError(res, 500, error.message || 'No fue posible cargar la auditor\u00eda');
  } finally { conn.release(); }
});

router.get('/:id/exportar', authFromHeader, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!canAdminEvaluations(req.user)) return sendError(res, 403, 'No tienes permisos para exportar evaluaciones.');
    const idEvaluacion = Number(req.params.id || 0);
    if (!idEvaluacion) return sendError(res, 400, 'ID de evaluaci\u00f3n inv\u00e1lido.');
    const detail = await loadEvaluationDetail(conn, idEvaluacion);
    if (!detail) return sendError(res, 404, 'La evaluaci\u00f3n no existe.');
    const [respuestas] = await conn.execute(`
      SELECT r.id_respuesta, r.id_pregunta, r.id_alumno, r.id_docente, r.valor_numero, r.valor_texto, r.creado_en,
        CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellido_paterno, '')) AS alumno_nombre,
        CONCAT(COALESCE(d.nombres, ''), ' ', COALESCE(d.apellido_paterno, '')) AS docente_nombre
      FROM respuestas_evaluacion r
      LEFT JOIN alumnos a ON a.id_alumno = r.id_alumno
      LEFT JOIN docentes d ON d.id_docente = r.id_docente
      WHERE r.id_evaluacion = ?
      ORDER BY r.creado_en DESC`, [idEvaluacion]);
    await logAuditoria(conn, idEvaluacion, Number(req.user?.id_usuario || 0), 'EXPORTAR', `Evaluaci\u00f3n "${detail.titulo}" exportada en JSON`, null, req.ip);
    return res.json({
      ok: true,
      exported_at: new Date().toISOString(),
      exported_by: req.user?.id_usuario || null,
      evaluacion: detail,
      respuestas,
      total_respuestas: respuestas.length
    });
  } catch (error) {
    console.error('ERROR GET /evaluaciones/:id/exportar:', error);
    return sendError(res, 500, error.message || 'No fue posible exportar la evaluaci\u00f3n');
  } finally { conn.release(); }
});

module.exports = router;
