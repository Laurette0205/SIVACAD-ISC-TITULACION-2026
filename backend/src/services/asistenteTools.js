function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function getUserId(user) {
  return Number(user?.id_usuario || user?.idUser || user?.usuario_id || user?.sub || 0);
}

async function getStudentAverage(pool, user) {
  const idUsuario = getUserId(user);

  if (!idUsuario) return null;

  const [rows] = await pool.query(
    `
    SELECT
      u.id_usuario,
      a.id_alumno,
      a.matricula,
      a.nombres,
      a.apellido_paterno,
      a.apellido_materno,
      a.semestre_actual,
      a.estatus_academico,
      COALESCE(k.promedio_general, 0) AS promedio_general,
      COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
      k.numero_control,
      c.nombre_carrera,
      p.nombre_plan,
      p.version_plan
    FROM usuarios u
    INNER JOIN alumnos a ON a.id_usuario = u.id_usuario
    LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
    LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
    LEFT JOIN planes_estudio p ON p.id_plan = a.id_plan
    WHERE u.id_usuario = ?
    LIMIT 1
    `,
    [idUsuario]
  );

  return rows[0] || null;
}

async function getStudentEligibility(pool, user) {
  const student = await getStudentAverage(pool, user);

  if (!student) return null;

  const promedio = Number(student.promedio_general || 0);
  const estatus = normalizeRoleName(student.estatus_academico).toLowerCase();

  const elegible = promedio >= 80 && (estatus === 'regular' || estatus === 'vigente');

  return {
    ...student,
    elegible_beca: elegible,
    motivo: elegible
      ? 'Cumple con el promedio y el estatus académico base.'
      : 'No cumple con los criterios base de elegibilidad.'
  };
}

async function getSystemStats(pool) {
  try {
    const [userRows] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    const [matRows] = await pool.query('SELECT COUNT(*) AS total FROM materias');
    const [aluRows] = await pool.query('SELECT COUNT(*) AS total FROM alumnos');
    const [docRows] = await pool.query('SELECT COUNT(*) AS total FROM docentes');

    return {
      usuarios: Number(userRows[0]?.total || 0),
      materias: Number(matRows[0]?.total || 0),
      alumnos: Number(aluRows[0]?.total || 0),
      docentes: Number(docRows[0]?.total || 0)
    };
  } catch {
    return null;
  }
}

async function getScholarshipContext(pool, user) {
  const eligibility = await getStudentEligibility(pool, user);
  let convocatorias = [];

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id_fuente AS id_beca,
        titulo,
        resumen,
        texto_completo AS requisitos,
        vigencia_inicio AS fecha_inicio,
        vigencia_fin AS fecha_fin,
        url_origen,
        activo
      FROM becas_fuentes
      WHERE activo = 1
      ORDER BY vigencia_fin ASC, id_fuente DESC
      LIMIT 5
      `
    );
    convocatorias = Array.isArray(rows) ? rows : [];
  } catch {
    convocatorias = [];
  }

  return {
    elegibilidad: eligibility,
    convocatorias
  };
}

async function getSystemAudit(pool, limit = 50) {
  try {
    const [rows] = await pool.query(
      `
      SELECT a.id_auditoria, a.id_usuario, a.rol_usuario, a.intencion,
             a.herramienta, a.pregunta, a.respuesta_resumen, a.permitido,
             a.creado_en, u.nombre_usuario
      FROM asistente_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      ORDER BY a.creado_en DESC
      LIMIT ?
      `,
      [Math.min(limit, 200)]
    );
    return rows || [];
  } catch {
    return [];
  }
}

async function getUserSummary(pool) {
  try {
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM alumnos) AS total_alumnos,
        (SELECT COUNT(*) FROM docentes) AS total_docentes,
        (SELECT COUNT(*) FROM administradores) AS total_administradores
    `);
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function getSystemConfig(pool) {
  try {
    const [periodos] = await pool.query(`
      SELECT id_periodo, nombre_periodo, fecha_inicio, fecha_fin,
             CASE WHEN estado = 'Activo' THEN 1 ELSE 0 END AS activo
      FROM periodos
      ORDER BY estado = 'Activo' DESC, fecha_inicio DESC
      LIMIT 5
    `);
    const [carreras] = await pool.query(`
      SELECT id_carrera, nombre_carrera
      FROM carreras
      ORDER BY nombre_carrera
    `);
    return {
      periodos: periodos || [],
      carreras: carreras || []
    };
  } catch {
    return { periodos: [], carreras: [] };
  }
}

// =============================================
// COORDINADOR — Tools
// =============================================

async function getCoordDashboard(pool) {
  try {
    const [alumnos] = await pool.query('SELECT COUNT(*) AS total FROM alumnos');
    const [grupos] = await pool.query('SELECT COUNT(*) AS total FROM grupos WHERE estado = ?', ['Abierto']);
    const [docentes] = await pool.query('SELECT COUNT(*) AS total FROM docentes');
    const [alertas] = await pool.query(`
      SELECT COUNT(*) AS total FROM ia_alertas_desercion
      WHERE atendida = 0
    `);
    const [evaluaciones] = await pool.query(`
      SELECT COUNT(*) AS total FROM evaluaciones WHERE estado = 'ACTIVA'
    `);
    return {
      total_alumnos: Number(alumnos[0]?.total || 0),
      total_grupos_abiertos: Number(grupos[0]?.total || 0),
      total_docentes: Number(docentes[0]?.total || 0),
      alertas_pendientes: Number(alertas[0]?.total || 0),
      evaluaciones_activas: Number(evaluaciones[0]?.total || 0)
    };
  } catch {
    return null;
  }
}

async function getCoordGroups(pool, filters = {}) {
  try {
    const { id_periodo, id_carrera, semestre } = filters;
    let where = ['1=1'];
    const params = [];
    if (id_periodo) { where.push('g.id_periodo = ?'); params.push(id_periodo); }
    if (id_carrera) { where.push('g.id_carrera = ?'); params.push(id_carrera); }
    if (semestre) { where.push('g.semestre = ?'); params.push(semestre); }

    const [rows] = await pool.query(`
      SELECT g.id_grupo, g.nombre_grupo, g.semestre, g.turno, g.estado,
             p.nombre_periodo, p.id_periodo,
             c.nombre_carrera, c.id_carrera,
             COALESCE(ga.inscritos, 0) AS inscritos,
             COALESCE(ka.con_promedio, 0) AS con_promedio,
             COALESCE(al.alertas, 0) AS alertas
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      LEFT JOIN (SELECT id_grupo, COUNT(*) AS inscritos FROM grupos_alumnos WHERE estado = 'ACTIVO' GROUP BY id_grupo) ga ON ga.id_grupo = g.id_grupo
      LEFT JOIN (SELECT ga2.id_grupo, COUNT(*) AS con_promedio FROM grupos_alumnos ga2 INNER JOIN kardex_alumno k ON k.id_alumno = ga2.id_alumno AND k.promedio_general > 0 WHERE ga2.estado = 'ACTIVO' GROUP BY ga2.id_grupo) ka ON ka.id_grupo = g.id_grupo
      LEFT JOIN (SELECT ga3.id_grupo, COUNT(*) AS alertas FROM grupos_alumnos ga3 INNER JOIN ia_alertas_desercion ia ON ia.id_alumno = ga3.id_alumno AND ia.atendida = 0 WHERE ga3.estado = 'ACTIVO' GROUP BY ga3.id_grupo) al ON al.id_grupo = g.id_grupo
      WHERE ${where.join(' AND ')}
      ORDER BY p.fecha_inicio DESC, c.nombre_carrera, g.semestre, g.nombre_grupo
      LIMIT 50
    `, params);
    return rows || [];
  } catch {
    return [];
  }
}

async function getCoordPeriods(pool) {
  try {
    const [rows] = await pool.query(`
      SELECT p.id_periodo, p.nombre_periodo, p.fecha_inicio, p.fecha_fin, p.estado,
             COALESCE(g.grupos_total, 0) AS grupos_total,
             COALESCE(g.grupos_abiertos, 0) AS grupos_abiertos,
             COALESCE(i.inscritos_total, 0) AS inscritos_total
      FROM periodos p
      LEFT JOIN (SELECT id_periodo, COUNT(*) AS grupos_total, SUM(CASE WHEN estado = 'Abierto' THEN 1 ELSE 0 END) AS grupos_abiertos FROM grupos GROUP BY id_periodo) g ON g.id_periodo = p.id_periodo
      LEFT JOIN (SELECT id_periodo, COUNT(*) AS inscritos_total FROM inscripciones WHERE estado IN ('Validada','Pendiente') GROUP BY id_periodo) i ON i.id_periodo = p.id_periodo
      ORDER BY p.fecha_inicio DESC
      LIMIT 10
    `);
    return rows || [];
  } catch {
    return [];
  }
}

async function getCoordStudentTracking(pool, filters = {}) {
  try {
    const { id_grupo, id_periodo, estatus, search } = filters;
    let where = ['ga.estado = ?'];
    const params = ['ACTIVO'];
    if (id_grupo) { where.push('ga.id_grupo = ?'); params.push(id_grupo); }
    if (id_periodo) { where.push('ga.id_periodo = ?'); params.push(id_periodo); }
    if (estatus) { where.push('a.estatus_academico = ?'); params.push(estatus); }
    if (search) { where.push('(a.nombres LIKE ? OR a.apellido_paterno LIKE ? OR a.matricula LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }

    const [rows] = await pool.query(`
      SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             COALESCE(k.promedio_general, 0) AS promedio_general,
             COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
             g.id_grupo, g.nombre_grupo, g.semestre AS grupo_semestre,
             p.nombre_periodo, p.id_periodo,
             c.nombre_carrera,
             COALESCE(ia.nivel_riesgo, 'Sin riesgo') AS nivel_riesgo,
             COALESCE(ia.puntaje_riesgo, 0) AS puntaje_riesgo,
             COALESCE(ia.id_alerta, 0) AS id_alerta,
             COALESCE(ia.atendida, 1) AS alerta_atendida
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN grupos g ON g.id_grupo = ga.id_grupo
      INNER JOIN periodos p ON p.id_periodo = ga.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = a.id_alumno AND ia.id_periodo = ga.id_periodo
      WHERE ${where.join(' AND ')}
      ORDER BY a.apellido_paterno, a.apellido_materno
      LIMIT 100
    `, params);
    return rows || [];
  } catch {
    return [];
  }
}

async function getCoordAlerts(pool, filters = {}) {
  try {
    const { nivel, atendida } = filters;
    let where = ['1=1'];
    const params = [];
    if (nivel) { where.push('ia.nivel_riesgo = ?'); params.push(nivel); }
    if (atendida !== undefined) { where.push('ia.atendida = ?'); params.push(atendida ? 1 : 0); }

    const [rows] = await pool.query(`
      SELECT ia.id_alerta, ia.nivel_riesgo, ia.puntaje_riesgo, ia.descripcion,
             ia.recomendacion, ia.atendida, ia.estado_seguimiento,
             ia.revisado_en AS fecha_alerta,
             a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             c.nombre_carrera,
             p.nombre_periodo,
             g.nombre_grupo
      FROM ia_alertas_desercion ia
      INNER JOIN alumnos a ON a.id_alumno = ia.id_alumno
      INNER JOIN periodos p ON p.id_periodo = ia.id_periodo
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN grupos_alumnos ga ON ga.id_alumno = a.id_alumno AND ga.id_periodo = ia.id_periodo AND ga.estado = 'ACTIVO'
      LEFT JOIN grupos g ON g.id_grupo = ga.id_grupo
      WHERE ${where.join(' AND ')}
      ORDER BY ia.puntaje_riesgo DESC
      LIMIT 100
    `, params);
    return rows || [];
  } catch {
    return [];
  }
}

async function getCoordGroupReport(pool, id_grupo) {
  try {
    const [grupo] = await pool.query(`
      SELECT g.*, p.nombre_periodo, c.nombre_carrera
      FROM grupos g
      INNER JOIN periodos p ON p.id_periodo = g.id_periodo
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      WHERE g.id_grupo = ?
    `, [id_grupo]);

    const [alumnos] = await pool.query(`
      SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             COALESCE(k.promedio_general, 0) AS promedio_general,
             COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM grupos_alumnos ga
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO'
      ORDER BY a.apellido_paterno, a.apellido_materno
    `, [id_grupo]);

    const [alertas] = await pool.query(`
      SELECT COUNT(*) AS total, nivel_riesgo
      FROM ia_alertas_desercion ia
      INNER JOIN grupos_alumnos ga ON ga.id_alumno = ia.id_alumno
      WHERE ga.id_grupo = ? AND ga.estado = 'ACTIVO'
      GROUP BY nivel_riesgo
    `, [id_grupo]);

    return {
      grupo: grupo[0] || null,
      alumnos: alumnos || [],
      alertas: alertas || [],
      total_alumnos: alumnos.length,
      promedio_grupo: alumnos.length
        ? (alumnos.reduce((s, a) => s + Number(a.promedio_general || 0), 0) / alumnos.length).toFixed(2)
        : 0
    };
  } catch {
    return null;
  }
}

// =============================================
// DOCENTE — Tools
// =============================================

function getDocenteId(user) {
  return Number(user?.id_docente || user?.docente_id || 0);
}

async function getDocDashboard(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return null;

    const [grupos] = await pool.query(`
      SELECT COUNT(DISTINCT ca.id_grupo) AS total_grupos
      FROM cargas_academicas ca
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
    `, [idDocente]);

    const [materias] = await pool.query(`
      SELECT COUNT(DISTINCT ca.id_materia) AS total_materias
      FROM cargas_academicas ca
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
    `, [idDocente]);

    const [alumnos] = await pool.query(`
      SELECT COUNT(DISTINCT ga.id_alumno) AS total_alumnos
      FROM cargas_academicas ca
      INNER JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
    `, [idDocente]);

    const [alertas] = await pool.query(`
      SELECT COUNT(DISTINCT ia.id_alerta) AS total_alertas
      FROM cargas_academicas ca
      INNER JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      INNER JOIN ia_alertas_desercion ia ON ia.id_alumno = ga.id_alumno AND ia.atendida = 0
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
    `, [idDocente]);

    const [evaluaciones] = await pool.query(`
      SELECT COUNT(DISTINCT e.id_evaluacion) AS total_evaluaciones
      FROM evaluaciones e
      WHERE e.estado = 'ACTIVA'
    `);

    return {
      total_grupos: Number(grupos[0]?.total_grupos || 0),
      total_materias: Number(materias[0]?.total_materias || 0),
      total_alumnos: Number(alumnos[0]?.total_alumnos || 0),
      alertas_pendientes: Number(alertas[0]?.total_alertas || 0),
      evaluaciones_activas: Number(evaluaciones[0]?.total_evaluaciones || 0)
    };
  } catch {
    return null;
  }
}

async function getDocGroups(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return [];

    const [rows] = await pool.query(`
      SELECT ca.id_carga_academica, ca.id_grupo, ca.id_materia,
             g.nombre_grupo, g.semestre, g.turno, g.estado AS grupo_estado,
             g.id_periodo, p.nombre_periodo,
             m.clave_materia, m.nombre_materia, m.creditos,
             c.nombre_carrera,
             COALESCE(ga.inscritos, 0) AS alumnos_inscritos,
             COALESCE(al.alertas, 0) AS alertas_activas
      FROM cargas_academicas ca
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      INNER JOIN carreras c ON c.id_carrera = g.id_carrera
      LEFT JOIN (SELECT id_grupo, id_periodo, COUNT(*) AS inscritos FROM grupos_alumnos WHERE estado = 'ACTIVO' GROUP BY id_grupo, id_periodo) ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo
      LEFT JOIN (SELECT ga2.id_grupo, ga2.id_periodo, COUNT(*) AS alertas FROM grupos_alumnos ga2 INNER JOIN ia_alertas_desercion ia ON ia.id_alumno = ga2.id_alumno AND ia.atendida = 0 WHERE ga2.estado = 'ACTIVO' GROUP BY ga2.id_grupo, ga2.id_periodo) al ON al.id_grupo = ca.id_grupo AND al.id_periodo = ca.id_periodo
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
      ORDER BY p.nombre_periodo DESC, g.nombre_grupo, m.nombre_materia
      LIMIT 50
    `, [idDocente]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getDocEvaluations(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return [];

    const [rows] = await pool.query(`
      SELECT DISTINCT e.id_evaluacion, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
             e.estado AS eval_estado, e.tipo_instrumento,
             COALESCE(rr.promedio_final, 0) AS promedio_final,
             COALESCE(rsp.total_respuestas, 0) AS total_respuestas,
             g.id_grupo, g.nombre_grupo,
             m.nombre_materia,
             p.nombre_periodo
      FROM evaluaciones e
      INNER JOIN cargas_academicas ca ON ca.id_periodo = e.id_periodo
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      LEFT JOIN materias m ON m.id_materia = ca.id_materia
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion AND rr.tipo_evaluado = 'DOCENTE' AND rr.id_evaluado = ca.id_docente
      LEFT JOIN (SELECT id_evaluacion, COUNT(*) AS total_respuestas FROM respuestas_evaluacion GROUP BY id_evaluacion) rsp ON rsp.id_evaluacion = e.id_evaluacion
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
      ORDER BY e.fecha_inicio DESC
      LIMIT 50
    `, [idDocente]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getDocTracking(pool, user, filters = {}) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return [];

    const { id_grupo, id_materia, search } = filters;
    let where = ['ca.id_docente = ?', 'ca.estado = ?', 'ga.estado = ?'];
    const params = [idDocente, 'ACTIVA', 'ACTIVO'];
    if (id_grupo) { where.push('ga.id_grupo = ?'); params.push(id_grupo); }
    if (id_materia) { where.push('ca.id_materia = ?'); params.push(id_materia); }
    if (search) { where.push('(a.nombres LIKE ? OR a.apellido_paterno LIKE ? OR a.matricula LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }

    const [rows] = await pool.query(`
      SELECT DISTINCT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             COALESCE(k.promedio_general, 0) AS promedio_general,
             COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
             g.id_grupo, g.nombre_grupo,
             m.id_materia, m.nombre_materia,
             p.nombre_periodo,
             COALESCE(ia.nivel_riesgo, 'Sin riesgo') AS nivel_riesgo,
             COALESCE(ia.puntaje_riesgo, 0) AS puntaje_riesgo
      FROM cargas_academicas ca
      INNER JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      INNER JOIN periodos p ON p.id_periodo = ca.id_periodo
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      LEFT JOIN ia_alertas_desercion ia ON ia.id_alumno = a.id_alumno AND ia.id_periodo = ca.id_periodo
      WHERE ${where.join(' AND ')}
      ORDER BY a.apellido_paterno, a.nombres
      LIMIT 100
    `, params);
    return rows || [];
  } catch {
    return [];
  }
}

async function getDocAlerts(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return [];

    const [rows] = await pool.query(`
      SELECT DISTINCT ia.id_alerta, ia.nivel_riesgo, ia.puntaje_riesgo, ia.descripcion,
             ia.recomendacion, ia.atendida, ia.estado_seguimiento,
             a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             g.nombre_grupo, m.nombre_materia
      FROM cargas_academicas ca
      INNER JOIN grupos_alumnos ga ON ga.id_grupo = ca.id_grupo AND ga.id_periodo = ca.id_periodo AND ga.estado = 'ACTIVO'
      INNER JOIN ia_alertas_desercion ia ON ia.id_alumno = ga.id_alumno AND ia.id_periodo = ca.id_periodo
      INNER JOIN alumnos a ON a.id_alumno = ga.id_alumno
      INNER JOIN grupos g ON g.id_grupo = ca.id_grupo
      INNER JOIN materias m ON m.id_materia = ca.id_materia
      WHERE ca.id_docente = ? AND ca.estado = 'ACTIVA'
      ORDER BY ia.puntaje_riesgo DESC
      LIMIT 100
    `, [idDocente]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getDocKardex(pool, user, id_alumno) {
  try {
    const idUsuario = getUserId(user);
    const [doc] = await pool.query('SELECT id_docente FROM docentes WHERE id_usuario = ?', [idUsuario]);
    const idDocente = doc[0]?.id_docente;
    if (!idDocente) return null;

    const [alumno] = await pool.query(`
      SELECT a.id_alumno, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno,
             a.semestre_actual, a.estatus_academico,
             c.nombre_carrera,
             COALESCE(k.promedio_general, 0) AS promedio_general,
             COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados
      FROM alumnos a
      LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
      LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
      WHERE a.id_alumno = ?
    `, [id_alumno]);

    const [historial] = await pool.query(`
      SELECT h.id_historial, h.calificacion, h.creditos, h.tipo_materia, h.estado AS hist_estado,
             h.observaciones, h.creado_en,
             m.clave_materia, m.nombre_materia,
             p.nombre_periodo
      FROM kardex_historial_academico h
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.nombre_materia
    `, [id_alumno]);

    return {
      alumno: alumno[0] || null,
      historial: historial || []
    };
  } catch {
    return null;
  }
}

// =============================================
// ALUMNO — Tools
// =============================================

async function getAlumDashboard(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const student = await getStudentAverage(pool, user);
    if (!student) return null;

    const [inscripciones] = await pool.query(`
      SELECT COUNT(*) AS total FROM inscripciones WHERE id_alumno = ?
    `, [student.id_alumno]);

    const [periodoActual] = await pool.query(`
      SELECT id_periodo, nombre_periodo FROM periodos WHERE estado = 'Activo' LIMIT 1
    `);

    const [alertas] = await pool.query(`
      SELECT COUNT(*) AS total FROM ia_alertas_desercion WHERE id_alumno = ? AND atendida = 0
    `, [student.id_alumno]);

    const [evaluacionesPend] = await pool.query(`
      SELECT COUNT(*) AS total FROM evaluaciones WHERE estado = 'ACTIVA'
    `);

    return {
      alumno: student,
      total_inscripciones: Number(inscripciones[0]?.total || 0),
      periodo_actual: periodoActual[0]?.nombre_periodo || null,
      alertas_pendientes: Number(alertas[0]?.total || 0),
      evaluaciones_activas: Number(evaluacionesPend[0]?.total || 0)
    };
  } catch {
    return null;
  }
}

async function getAlumKardexDetalle(pool, user) {
  try {
    const student = await getStudentAverage(pool, user);
    if (!student) return null;

    const [historial] = await pool.query(`
      SELECT h.id_historial, h.calificacion, h.creditos, h.tipo_materia, h.estado AS hist_estado,
             h.observaciones, h.creado_en,
             m.clave_materia, m.nombre_materia,
             p.nombre_periodo
      FROM kardex_historial_academico h
      LEFT JOIN materias m ON m.id_materia = h.id_materia
      LEFT JOIN periodos p ON p.id_periodo = h.id_periodo
      WHERE h.id_alumno = ?
      ORDER BY p.fecha_inicio DESC, m.nombre_materia
    `, [student.id_alumno]);

    const acreditadas = historial.filter(h => h.hist_estado === 'Acreditada').length;
    const noAcreditadas = historial.filter(h => h.hist_estado === 'No Acreditada').length;
    const cursando = historial.filter(h => h.hist_estado === 'Cursando').length;

    return {
      alumno: student,
      historial: historial || [],
      resumen: {
        total_materias: historial.length,
        acreditadas,
        no_acreditadas: noAcreditadas,
        cursando
      }
    };
  } catch {
    return null;
  }
}

async function getAlumInscripciones(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [alum] = await pool.query('SELECT id_alumno FROM alumnos WHERE id_usuario = ?', [idUsuario]);
    const idAlumno = alum[0]?.id_alumno;
    if (!idAlumno) return [];

    const [rows] = await pool.query(`
      SELECT i.id_inscripcion, i.fecha_inscripcion, i.tipo_inscripcion, i.estado AS insc_estado,
             i.observaciones,
             p.nombre_periodo, p.fecha_inicio, p.fecha_fin,
             g.nombre_grupo, g.semestre, g.turno,
             c.nombre_carrera
      FROM inscripciones i
      INNER JOIN periodos p ON p.id_periodo = i.id_periodo
      LEFT JOIN grupos g ON g.id_grupo = i.id_grupo
      LEFT JOIN carreras c ON c.id_carrera = i.id_carrera
      WHERE i.id_alumno = ?
      ORDER BY p.fecha_inicio DESC
      LIMIT 20
    `, [idAlumno]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getAlumEvaluaciones(pool, user) {
  try {
    const idUsuario = getUserId(user);
    const [alum] = await pool.query('SELECT id_alumno FROM alumnos WHERE id_usuario = ?', [idUsuario]);
    const idAlumno = alum[0]?.id_alumno;
    if (!idAlumno) return [];

    const [rows] = await pool.query(`
      SELECT e.id_evaluacion, e.titulo, e.descripcion, e.fecha_inicio, e.fecha_fin,
             e.estado AS eval_estado, e.tipo_instrumento,
             COALESCE(rr.promedio_final, 0) AS promedio_final,
             COALESCE(rsp.respondio, 0) AS respondio
      FROM evaluaciones e
      LEFT JOIN evaluacion_resultados rr ON rr.id_evaluacion = e.id_evaluacion AND rr.tipo_evaluado = 'ALUMNO' AND rr.id_evaluado = ?
      LEFT JOIN (SELECT id_evaluacion, COUNT(*) > 0 AS respondio FROM respuestas_evaluacion WHERE id_evaluado = ? GROUP BY id_evaluacion) rsp ON rsp.id_evaluacion = e.id_evaluacion
      WHERE e.estado IN ('ACTIVA', 'CERRADA')
      ORDER BY e.fecha_inicio DESC
      LIMIT 20
    `, [idAlumno, idAlumno]);
    return rows || [];
  } catch {
    return [];
  }
}

// =============================================
// SOPORTE — Tools
// =============================================

async function getSopDashboard(pool) {
  try {
    const [stats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM alumnos) AS total_alumnos,
        (SELECT COUNT(*) FROM docentes) AS total_docentes
    `);

    const [sesionesActivas] = await pool.query(`
      SELECT COUNT(*) AS total FROM asistente_sesiones WHERE estado = 'ACTIVA'
    `);

    const [bitacoraReciente] = await pool.query(`
      SELECT COUNT(*) AS total FROM asistente_auditoria WHERE creado_en >= NOW() - INTERVAL 24 HOUR
    `);

    const [resetPendientes] = await pool.query(`
      SELECT COUNT(*) AS total FROM password_resets WHERE used = 0 AND expires_at > NOW()
    `);

    return {
      total_usuarios: Number(stats[0]?.total_usuarios || 0),
      total_alumnos: Number(stats[0]?.total_alumnos || 0),
      total_docentes: Number(stats[0]?.total_docentes || 0),
      sesiones_activas_asistente: Number(sesionesActivas[0]?.total || 0),
      bitacora_24h: Number(bitacoraReciente[0]?.total || 0),
      resets_pendientes: Number(resetPendientes[0]?.total || 0)
    };
  } catch {
    return null;
  }
}

async function getSopPasswordResets(pool, limit = 20) {
  try {
    const [rows] = await pool.query(`
      SELECT pr.id_reseteo, pr.token, pr.expires_at, pr.used, pr.created_at,
             u.id_usuario, u.nombres, u.apellido_paterno, u.correo_institucional
      FROM password_resets pr
      INNER JOIN usuarios u ON u.id_usuario = pr.id_usuario
      ORDER BY pr.created_at DESC
      LIMIT ?
    `, [Math.min(limit, 50)]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getSopSesiones(pool, limit = 20) {
  try {
    const [rows] = await pool.query(`
      SELECT s.id_sesion, s.id_usuario, s.rol_usuario, s.tema_actual, s.estado,
             s.creado_en, s.actualizado_en,
             u.nombres, u.apellido_paterno, u.correo_institucional,
             (SELECT COUNT(*) FROM asistente_mensajes m WHERE m.id_sesion = s.id_sesion) AS total_mensajes
      FROM asistente_sesiones s
      LEFT JOIN usuarios u ON u.id_usuario = s.id_usuario
      ORDER BY s.actualizado_en DESC
      LIMIT ?
    `, [Math.min(limit, 50)]);
    return rows || [];
  } catch {
    return [];
  }
}

async function getSopIncidencias(pool, limit = 30) {
  try {
    const audit = await getSystemAudit(pool, limit);
    return audit.filter(a => !a.permitido || a.intencion === 'SOPORTE');
  } catch {
    return [];
  }
}

module.exports = {
  getStudentAverage,
  getStudentEligibility,
  getSystemStats,
  getScholarshipContext,
  getSystemAudit,
  getUserSummary,
  getSystemConfig,
  getCoordDashboard,
  getCoordGroups,
  getCoordPeriods,
  getCoordStudentTracking,
  getCoordAlerts,
  getCoordGroupReport,
  getDocDashboard,
  getDocGroups,
  getDocEvaluations,
  getDocTracking,
  getDocAlerts,
  getDocKardex,
  getAlumDashboard,
  getAlumKardexDetalle,
  getAlumInscripciones,
  getAlumEvaluaciones,
  getSopDashboard,
  getSopPasswordResets,
  getSopSesiones,
  getSopIncidencias
};