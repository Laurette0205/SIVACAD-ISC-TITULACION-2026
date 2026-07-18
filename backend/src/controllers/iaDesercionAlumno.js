'use strict';

const pool = require('../config/db');

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function resolveAlumnoId(idUsuario) {
  const [rows] = await pool.execute(
    `SELECT id_alumno, matricula, CONCAT(nombres, ' ', apellido_paterno, ' ', apellido_materno) AS nombre_completo
     FROM alumnos WHERE id_usuario = ? LIMIT 1`,
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

// ── 1. PANEL PERSONAL DE RIESGO ──
async function miRiesgo(req, res) {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [kardexRows] = await pool.execute(`
      SELECT promedio_general, creditos_acumulados, estatus
      FROM kardex_alumno WHERE id_alumno = ? LIMIT 1
    `, [alumno.id_alumno]);
    const kardex = kardexRows[0] || {};

    const [[alumnoRow]] = await pool.execute(`
      SELECT a.semestre_actual, a.estatus_academico, c.nombre_carrera,
        p.nombre_periodo AS periodo_activo
      FROM alumnos a
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN periodos p ON p.estado = 'Activo'
      WHERE a.id_alumno = ?
      LIMIT 1
    `, [alumno.id_alumno]);

    const [alertas] = await pool.execute(`
      SELECT ia.id_alerta, ia.id_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.descripcion, ia.recomendacion, ia.explicacion, ia.factores_json,
        ia.atendida, ia.estado_seguimiento, ia.creado_en, ia.revisado_en,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      WHERE ia.id_alumno = ?
      ORDER BY ia.creado_en DESC
      LIMIT 5
    `, [alumno.id_alumno]);

    const alertasConFactores = alertas.map(a => ({
      ...a,
      factores: (() => { try { return JSON.parse(a.factores_json || '[]'); } catch { return []; } })()
    }));

    const alertaActiva = alertasConFactores.find(a => !a.atendida);
    const riesgoActual = alertaActiva ? {
      nivel: alertaActiva.nivel_riesgo,
      puntaje: alertaActiva.puntaje_riesgo,
      descripcion: alertaActiva.descripcion,
      recomendacion: alertaActiva.recomendacion,
      factores: alertaActiva.factores
    } : null;

    const interpretacion = (() => {
      if (!riesgoActual) return 'No tienes alertas activas. Sigue manteniendo tu buen rendimiento académico.';
      const p = toNum(riesgoActual.puntaje);
      if (p >= 75) return 'Tu situación requiere atención inmediata. Es importante que busques apoyo académico cuanto antes.';
      if (p >= 50) return 'Presentas factores de riesgo importantes. Te recomendamos acercarte a tutoría para recibir orientación.';
      if (p >= 25) return 'Hay algunos aspectos que podrías mejorar. Revisa las recomendaciones y mantén una comunicación activa con tus docentes.';
      return 'Tu riesgo es bajo, pero no bajes la guardia. Sigue esforzándote y aprovecha los recursos institucionales.';
    })();

    return res.json({
      ok: true,
      data: {
        alumno: {
          id_alumno: alumno.id_alumno,
          matricula: alumno.matricula,
          nombre: alumno.nombre_completo,
          semestre: alumnoRow?.semestre_actual,
          carrera: alumnoRow?.nombre_carrera,
          estatus: alumnoRow?.estatus_academico,
          periodo_activo: alumnoRow?.periodo_activo
        },
        kardex: {
          promedio: toNum(kardex.promedio_general),
          creditos: toNum(kardex.creditos_acumulados),
          estatus_kardex: kardex.estatus
        },
        riesgo_actual: riesgoActual,
        interpretacion,
        alertas_recientes: alertasConFactores,
        total_alertas: alertas.length,
        alertas_pendientes: alertas.filter(a => !a.atendida).length,
        alertas_atendidas: alertas.filter(a => a.atendida).length
      }
    });
  } catch (error) {
    console.error('Error al obtener riesgo del alumno:', error);
    return res.status(500).json({ ok: false, message: 'Error al consultar tu información' });
  }
}

// ── 2. RECOMENDACIONES ──
async function recomendaciones(req, res) {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [rows] = await pool.execute(`
      SELECT ia.id_alerta, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.recomendacion, ia.descripcion, ia.explicacion, ia.factores_json,
        ia.creado_en, ia.atendida, ia.estado_seguimiento,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      WHERE ia.id_alumno = ?
      ORDER BY ia.puntaje_riesgo DESC, ia.creado_en DESC
    `, [alumno.id_alumno]);

    const data = rows.map(r => ({
      ...r,
      factores: (() => { try { return JSON.parse(r.factores_json || '[]'); } catch { return []; } })()
    }));

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('Error al obtener recomendaciones:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener recomendaciones' });
  }
}

// ── 3. HISTORIAL PROPIO ──
async function historial(req, res) {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [alertas] = await pool.execute(`
      SELECT ia.id_alerta, ia.id_periodo, ia.nivel_riesgo, ia.puntaje_riesgo,
        ia.descripcion, ia.recomendacion, ia.explicacion, ia.factores_json,
        ia.atendida, ia.estado_seguimiento, ia.creado_en, ia.revisado_en,
        p.nombre_periodo
      FROM ia_alertas_desercion ia
      LEFT JOIN periodos p ON p.id_periodo = ia.id_periodo
      WHERE ia.id_alumno = ?
      ORDER BY ia.creado_en DESC
    `, [alumno.id_alumno]);

    const [seguimientos] = await pool.execute(`
      SELECT s.*, u2.nombres AS usuario_nombre, u2.apellido_paterno AS usuario_apellido
      FROM ia_seguimientos_desercion s
      INNER JOIN ia_alertas_desercion ia ON ia.id_alerta = s.id_alerta
      LEFT JOIN usuarios u2 ON s.id_usuario = u2.id_usuario
      WHERE ia.id_alumno = ?
      ORDER BY s.creado_en DESC
    `, [alumno.id_alumno]);

    return res.json({
      ok: true,
      data: {
        alertas: alertas.map(a => ({
          ...a,
          factores: (() => { try { return JSON.parse(a.factores_json || '[]'); } catch { return []; } })()
        })),
        seguimientos
      }
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener historial' });
  }
}

// ── 4. PROGRESO ──
async function progreso(req, res) {
  try {
    const alumno = await resolveAlumnoId(req.user.id_usuario);
    if (!alumno) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [alertasPorPeriodo] = await pool.execute(`
      SELECT p.nombre_periodo, p.id_periodo,
        COUNT(ia.id_alerta) AS total_alertas,
        SUM(CASE WHEN ia.atendida = 1 THEN 1 ELSE 0 END) AS atendidas,
        SUM(CASE WHEN ia.atendida = 0 THEN 1 ELSE 0 END) AS pendientes,
        MAX(ia.puntaje_riesgo) AS riesgo_maximo,
        MIN(ia.puntaje_riesgo) AS riesgo_minimo,
        AVG(ia.puntaje_riesgo) AS riesgo_promedio
      FROM periodos p
      LEFT JOIN ia_alertas_desercion ia ON ia.id_periodo = p.id_periodo AND ia.id_alumno = ?
      GROUP BY p.id_periodo, p.nombre_periodo
      ORDER BY p.id_periodo ASC
      LIMIT 20
    `, [alumno.id_alumno]);

    const evolutions = [];
    for (let i = 1; i < alertasPorPeriodo.length; i++) {
      const prev = alertasPorPeriodo[i - 1];
      const curr = alertasPorPeriodo[i];
      const diff = toNum(curr.riesgo_promedio) - toNum(prev.riesgo_promedio);
      evolutions.push({
        desde: prev.nombre_periodo,
        hasta: curr.nombre_periodo,
        cambio: diff > 0 ? 'aumento' : diff < 0 ? 'mejora' : 'estable',
        diferencia: Math.abs(Math.round(diff * 10) / 10)
      });
    }

    return res.json({
      ok: true,
      data: {
        por_periodo: alertasPorPeriodo.map(p => ({
          ...p,
          total_alertas: toNum(p.total_alertas),
          atendidas: toNum(p.atendidas),
          pendientes: toNum(p.pendientes),
          riesgo_maximo: toNum(p.riesgo_maximo),
          riesgo_minimo: toNum(p.riesgo_minimo),
          riesgo_promedio: Math.round(toNum(p.riesgo_promedio) * 10) / 10
        })),
        evolucion: evolutions
      }
    });
  } catch (error) {
    console.error('Error al obtener progreso:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener progreso' });
  }
}

module.exports = { miRiesgo, recomendaciones, historial, progreso };
