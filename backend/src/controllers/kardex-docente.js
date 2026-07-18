'use strict';

const pool = require('../config/db');

function kardexRoleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '').trim().toUpperCase();
}

function kardexRoleId(user) {
  return Number(user?.rol_id || user?.id_rol || 0);
}

function hasKardexAccess(user) {
  const rn = kardexRoleName(user);
  const ri = kardexRoleId(user);
  return rn === 'DOCENTE' || ri === 3 ||
         rn === 'ADMINISTRADOR' || ri === 1 ||
         rn === 'COORDINADOR' || ri === 2;
}

function isAdminOrCoord(user) {
  const rn = kardexRoleName(user);
  const ri = kardexRoleId(user);
  return rn === 'ADMINISTRADOR' || ri === 1 ||
         rn === 'COORDINADOR' || ri === 2;
}

async function resolveDocenteId(conn, idUsuario) {
  const [rows] = await conn.execute(
    'SELECT id_docente, clave_docente FROM docentes WHERE id_usuario = ? LIMIT 1',
    [idUsuario]
  );
  return rows.length ? rows[0] : null;
}

// ── VERIFICA QUE EL DOCENTE TENGA ACCESO AL GRUPO ──
async function docenteTieneAccesoAGrupo(conn, idDocente, idGrupo) {
  if (idDocente == null) return true; // admin/coord full access
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS cnt FROM cargas_academicas WHERE id_docente = ? AND id_grupo = ?',
    [idDocente, idGrupo]
  );
  return rows[0].cnt > 0;
}

// ── VERIFICA QUE EL DOCENTE TENGA ACCESO AL ALUMNO ──
async function docenteTieneAccesoAAlumno(conn, idDocente, idAlumno) {
  if (idDocente == null) return true; // admin/coord full access
  const [rows] = await conn.execute(`
    SELECT COUNT(*) AS cnt
    FROM grupos_alumnos ga
    JOIN cargas_academicas ca ON ca.id_grupo = ga.id_grupo AND ca.id_periodo = ga.id_periodo
    WHERE ca.id_docente = ? AND ga.id_alumno = ? AND ga.estado = 'ACTIVO'
  `, [idDocente, idAlumno]);
  return rows[0].cnt > 0;
}

// ── 1. MIS GRUPOS (carga académica del docente) ──
async function getMisGrupos(req, res) {
  try {
    if (!hasKardexAccess(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }

    const esAdminOCoord = isAdminOrCoord(req.user);
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente && !esAdminOCoord) {
      return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });
    }

    let grupos;
    if (esAdminOCoord && !docente) {
      // Admin/coord: ver todos los grupos
      [grupos] = await pool.execute(`
        SELECT
          ca.id_carga_academica, ca.id_periodo, ca.id_grupo, ca.id_materia,
          p.nombre_periodo,
          g.nombre_grupo, g.semestre, g.turno,
          m.nombre_materia, m.clave_materia,
          COUNT(DISTINCT ga.id_alumno) AS total_alumnos
        FROM cargas_academicas ca
        INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
        INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
        INNER JOIN materias m ON m.id_materia = ca.id_materia
        LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
        GROUP BY ca.id_carga_academica
        ORDER BY p.fecha_inicio DESC, g.semestre, g.nombre_grupo, m.nombre_materia
      `);
    } else {
      // Docente: solo sus grupos
      [grupos] = await pool.execute(`
        SELECT
          ca.id_carga_academica, ca.id_periodo, ca.id_grupo, ca.id_materia,
          p.nombre_periodo,
          g.nombre_grupo, g.semestre, g.turno,
          m.nombre_materia, m.clave_materia,
          COUNT(DISTINCT ga.id_alumno) AS total_alumnos
        FROM cargas_academicas ca
        INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
        INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
        INNER JOIN materias m ON m.id_materia = ca.id_materia
        LEFT JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
        WHERE ca.id_docente = ?
        GROUP BY ca.id_carga_academica
        ORDER BY p.fecha_inicio DESC, g.semestre, g.nombre_grupo, m.nombre_materia
      `, [docente.id_docente]);
    }

    res.json({ ok: true, data: grupos, docente });
  } catch (error) {
    console.error('Error en getMisGrupos (kardex-docente):', error);
    res.status(500).json({ ok: false, message: 'Error al obtener grupos asignados' });
  }
}

// ── 2. KARDEX DE ALUMNOS DEL GRUPO ──
async function getKardexGrupo(req, res) {
  try {
    if (!hasKardexAccess(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }

    const esAdminOCoord = isAdminOrCoord(req.user);
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente && !esAdminOCoord) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });

    const { idGrupo } = req.params;
    const idDocente = docente ? docente.id_docente : null;

    const tieneAcceso = await docenteTieneAccesoAGrupo(pool, idDocente, idGrupo);
    if (!tieneAcceso) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso a este grupo' });
    }

    const [grupo] = await pool.query(`
      SELECT g.*, p.nombre_periodo, c.nombre_carrera
      FROM grupos g
      JOIN periodos p ON p.id_periodo = g.id_periodo
      JOIN carreras c ON c.id_carrera = g.id_carrera
      WHERE g.id_grupo = ?
    `, [idGrupo]);

    const [alumnos] = await pool.query(`
      SELECT
        a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula, a.semestre_actual, a.estatus_academico,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        k.estatus AS estatus_kardex,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.estado = 'No Acreditada') AS materias_reprobadas,
        (SELECT COUNT(*) FROM kardex_historial_academico h
         WHERE h.id_alumno = a.id_alumno AND h.tipo_materia = 'Extraordinario') AS extraordinarios
      FROM grupos_alumnos ga
      JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO'
      ORDER BY a.apellido_paterno, a.apellido_materno
    `, [idGrupo]);

    const total = alumnos.length;
    const conRezago = alumnos.filter(a => a.promedio_general < 70 || a.materias_reprobadas > 2).length;
    const promedioGrupo = total > 0
      ? alumnos.reduce((s, a) => s + (parseFloat(a.promedio_general) || 0), 0) / total
      : 0;

    res.json({
      ok: true,
      data: {
        grupo: grupo[0] || null,
        alumnos,
        estadisticas: {
          total, conRezago,
          promedioGrupo: Math.round(promedioGrupo * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Error en getKardexGrupo (docente):', error);
    res.status(500).json({ ok: false, message: 'Error al consultar kardex del grupo' });
  }
}

// ── 3. CONSULTA INDIVIDUAL DE KARDEX (restringido a alumnos del docente) ──
async function getKardexAlumno(req, res) {
  try {
    if (!hasKardexAccess(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }

    const esAdminOCoord = isAdminOrCoord(req.user);
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente && !esAdminOCoord) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });

    const { idAlumno } = req.params;
    const idDocente = docente ? docente.id_docente : null;

    const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente, idAlumno);
    if (!tieneAcceso) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso al kardex de este alumno' });
    }

    const [alumno] = await pool.query(`
      SELECT
        a.*, c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        k.estatus AS estatus_kardex, k.folio_kardex,
        k.foto_institucional, k.url_qr, k.numero_control
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [idAlumno]);

    if (alumno.length === 0) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [historial] = await pool.query(`
      SELECT h.*, p.nombre_periodo, m.clave_materia, m.nombre_materia, g.nombre_grupo
      FROM kardex_historial_academico h
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN grupos g ON g.id_grupo = h.id_grupo
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.semestre_sugerido
    `, [idAlumno]);

    res.json({
      ok: true,
      data: { alumno: alumno[0], historial }
    });
  } catch (error) {
    console.error('Error en getKardexAlumno (docente):', error);
    res.status(500).json({ ok: false, message: 'Error al consultar kardex del alumno' });
  }
}

// ── 4. RESUMEN DE DESEMPEÑO ──
async function getResumenDesempeno(req, res) {
  try {
    if (!hasKardexAccess(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }

    const esAdminOCoord = isAdminOrCoord(req.user);
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente && !esAdminOCoord) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });

    const { idAlumno } = req.params;
    const idDocente = docente ? docente.id_docente : null;

    const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente, idAlumno);
    if (!tieneAcceso) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
    }

    const [alumno] = await pool.query(`
      SELECT a.id_alumno,
        CONCAT(a.apellido_paterno, ' ', a.apellido_materno, ' ', a.nombres) AS nombre_completo,
        a.matricula, a.semestre_actual, a.estatus_academico,
        c.nombre_carrera,
        COALESCE(k.promedio_general, 0) AS promedio_general,
        COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
        k.estatus AS estatus_kardex
      FROM alumnos a
      JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [idAlumno]);

    if (alumno.length === 0) {
      return res.status(404).json({ ok: false, message: 'Alumno no encontrado' });
    }

    const [historial] = await pool.query(`
      SELECT h.estado, h.tipo_materia, h.calificacion, h.creditos,
        p.nombre_periodo, m.nombre_materia, m.clave_materia, m.semestre_sugerido,
        g.nombre_grupo
      FROM kardex_historial_academico h
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN grupos g ON g.id_grupo = h.id_grupo
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC
    `, [idAlumno]);

    const totalMaterias = historial.length;
    const acreditadas = historial.filter(h => h.estado === 'Acreditada').length;
    const noAcreditadas = historial.filter(h => h.estado === 'No Acreditada').length;
    const extraordinarios = historial.filter(h => h.tipo_materia === 'Extraordinario').length;
    const creditosTotales = historial.reduce((s, h) => s + (parseFloat(h.creditos) || 0), 0);
    const creditosAcreditados = historial.filter(h => h.estado === 'Acreditada')
      .reduce((s, h) => s + (parseFloat(h.creditos) || 0), 0);

    const ultimosPeriodos = [];
    const periodosAgrupados = {};
    for (const h of historial) {
      if (!periodosAgrupados[h.nombre_periodo]) {
        periodosAgrupados[h.nombre_periodo] = { periodo: h.nombre_periodo, materias: 0, acreditadas: 0, promedio: 0, sumCalif: 0 };
      }
      periodosAgrupados[h.nombre_periodo].materias++;
      if (h.estado === 'Acreditada') periodosAgrupados[h.nombre_periodo].acreditadas++;
      if (h.calificacion) {
        periodosAgrupados[h.nombre_periodo].sumCalif += parseFloat(h.calificacion);
      }
    }
    for (const p of Object.values(periodosAgrupados)) {
      p.promedio = p.sumCalif > 0 ? (p.sumCalif / p.materias).toFixed(2) : '—';
      ultimosPeriodos.push(p);
    }
    ultimosPeriodos.sort((a, b) => b.periodo.localeCompare(a.periodo));

    const rezagoDetectado = parseFloat(alumno[0].promedio_general) < 70 || noAcreditadas > 2;

    res.json({
      ok: true,
      data: {
        alumno: alumno[0],
        metricas: {
          totalMaterias, acreditadas, noAcreditadas, extraordinarios,
          creditosTotales, creditosAcreditados,
          avanceCreditos: creditosTotales > 0
            ? Math.round((creditosAcreditados / creditosTotales) * 100) : 0,
          rezagoDetectado
        },
        desempenoPorPeriodo: ultimosPeriodos.slice(0, 6)
      }
    });
  } catch (error) {
    console.error('Error en getResumenDesempeno:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener resumen de desempeño' });
  }
}

// ── 5. HISTORIAL DE EVALUACIÓN ──
async function getHistorialEvaluacion(req, res) {
  try {
    if (!hasKardexAccess(req.user)) {
      return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    }

    const esAdminOCoord = isAdminOrCoord(req.user);
    const docente = await resolveDocenteId(pool, req.user.id_usuario || req.user.id);
    if (!docente && !esAdminOCoord) return res.status(404).json({ ok: false, message: 'Perfil docente no encontrado' });

    const { idAlumno } = req.params;
    const idDocente = docente ? docente.id_docente : null;

    const tieneAcceso = await docenteTieneAccesoAAlumno(pool, idDocente, idAlumno);
    if (!tieneAcceso) {
      return res.status(403).json({ ok: false, message: 'No tienes acceso a este alumno' });
    }

    const [historial] = await pool.query(`
      SELECT
        h.id_historial, h.calificacion, h.creditos, h.tipo_materia, h.estado, h.observaciones, h.creado_en,
        p.nombre_periodo, p.fecha_inicio, p.fecha_fin,
        m.clave_materia, m.nombre_materia, m.semestre_sugerido, m.creditos AS creditos_materia,
        g.nombre_grupo,
        CONCAT(d.apellido_paterno, ' ', d.apellido_materno, ' ', d.nombres) AS docente_materia
      FROM kardex_historial_academico h
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN grupos g ON g.id_grupo = h.id_grupo
      LEFT JOIN cargas_academicas ca ON ca.id_grupo = h.id_grupo AND ca.id_periodo = h.id_periodo AND ca.id_materia = h.id_materia
      LEFT JOIN docentes d ON d.id_docente = ca.id_docente
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.semestre_sugerido
    `, [idAlumno]);

    const acreditadas = historial.filter(h => h.estado === 'Acreditada').length;
    const noAcreditadas = historial.filter(h => h.estado === 'No Acreditada').length;
    const promedioGeneral = historial.length > 0
      ? (historial.reduce((s, h) => s + (parseFloat(h.calificacion) || 0), 0) / historial.length).toFixed(2)
      : '0.00';

    res.json({
      ok: true,
      data: {
        historial,
        resumen: {
          totalMaterias: historial.length,
          acreditadas, noAcreditadas,
          promedioGeneral
        }
      }
    });
  } catch (error) {
    console.error('Error en getHistorialEvaluacion:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener historial de evaluación' });
  }
}

module.exports = {
  getMisGrupos,
  getKardexGrupo,
  getKardexAlumno,
  getResumenDesempeno,
  getHistorialEvaluacion
};
