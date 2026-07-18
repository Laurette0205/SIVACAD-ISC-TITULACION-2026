let OFFICIAL_BECAS_CATALOG = [];
try {
  const official = require('./BecasEdomexService');
  OFFICIAL_BECAS_CATALOG = official.OFFICIAL_BECAS_CATALOG || [];
} catch (error) {
  console.warn('[becasTools] BecasEdomexService no disponible.');
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function toNumber(value, fallback = null) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferMinimumAverage(text) {
  const content = normalize(text).toLowerCase();
  const matches = [];

  const regexes = [
    /promedio\s*(?:mínimo|minimo|general)?\s*[:=]?\s*(\d{1,3}(?:\.\d{1,2})?)/i,
    /media\s*mínima\s*[:=]?\s*(\d{1,3}(?:\.\d{1,2})?)/i,
    /a partir de\s*(\d{1,3}(?:\.\d{1,2})?)/i,
    /mínimo\s*(\d{1,3}(?:\.\d{1,2})?)/i
  ];

  for (const regex of regexes) {
    const match = content.match(regex);
    if (match?.[1]) {
      const value = toNumber(match[1], null);
      if (Number.isFinite(value)) matches.push(value);
    }
  }

  if (!matches.length) {
    if (content.includes('excelencia') || content.includes('alto rendimiento')) return 90;
    if (content.includes('manutencion') || content.includes('mantenimiento')) return 80;
    if (content.includes('transporte') || content.includes('alimentacion')) return 75;
    return 80;
  }

  return Math.max(0, Math.min(100, Math.min(...matches)));
}

function inferRequiredSemester(text) {
  const content = normalize(text).toLowerCase();
  const match = content.match(/semestre\s*(?:mínimo|minimo|máximo|maximo)?\s*[:=]?\s*(\d{1,2})/i);
  if (match?.[1]) return Math.max(1, Math.min(12, Number(match[1])));

  if (content.includes('nuevo ingreso')) return 1;
  if (content.includes('egresado')) return 8;
  return 1;
}

async function resolveStudentIdentity(pool, user = {}, lookup = {}) {
  const idUsuario = Number(
    lookup.id_usuario || user?.id_usuario || user?.id || user?.user_id || 0
  );
  const idAlumno = Number(lookup.id_alumno || user?.id_alumno || 0);
  const correo = String(
    lookup.correo || user?.correo || user?.correo_institucional || user?.email || ''
  ).trim();
  const matricula = String(lookup.matricula || user?.matricula || '').trim();

  if (!idUsuario && !idAlumno && !correo && !matricula) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      u.id_usuario,
      u.nombres AS usuario_nombres,
      u.apellido_paterno AS usuario_apellido_paterno,
      u.apellido_materno AS usuario_apellido_materno,
      u.correo_institucional,
      u.id_rol,
      a.id_alumno,
      a.nombres,
      a.apellido_paterno,
      a.apellido_materno,
      a.matricula,
      a.curp,
      a.id_carrera,
      a.id_plan,
      a.semestre_actual,
      a.estatus_academico,
      k.promedio_general,
      k.creditos_acumulados,
      k.estatus AS kardex_estatus,
      c.nombre_carrera,
      p.nombre_plan,
      p.version_plan
    FROM usuarios u
    LEFT JOIN alumnos a ON a.id_usuario = u.id_usuario
    LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
    LEFT JOIN carreras c ON c.id_carrera = a.id_carrera
    LEFT JOIN planes_estudio p ON p.id_plan = a.id_plan
    WHERE
      (? > 0 AND u.id_usuario = ?)
      OR (? > 0 AND a.id_alumno = ?)
      OR (u.correo_institucional = ?)
      OR (a.matricula = ?)
    LIMIT 1
    `,
    [idUsuario, idUsuario, idAlumno, idAlumno, correo, matricula]
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    id_usuario: Number(row.id_usuario || idUsuario || 0),
    id_alumno: Number(row.id_alumno || 0),
    nombre_completo:
      `${row.nombres || row.usuario_nombres || ''} ${row.apellido_paterno || row.usuario_apellido_paterno || ''} ${row.apellido_materno || row.usuario_apellido_materno || ''}`
        .replace(/\s+/g, ' ')
        .trim(),
    correo: row.correo_institucional || correo,
    matricula: row.matricula || matricula,
    curp: row.curp || '',
    semestre_actual: Number(row.semestre_actual || 0),
    id_carrera: Number(row.id_carrera || 0),
    id_plan: Number(row.id_plan || 0),
    estatus_academico: row.estatus_academico || 'Regular',
    nombre_carrera: row.nombre_carrera || '',
    nombre_plan: row.nombre_plan || '',
    version_plan: row.version_plan || '',
    promedio_general: Number(row.promedio_general || 0),
    creditos_acumulados: Number(row.creditos_acumulados || 0),
    kardex_estatus: row.kardex_estatus || 'Vigente'
  };
}

async function getStudentAverage(pool, student) {
  const idAlumno = Number(student?.id_alumno || student?.idAlumno || 0);
  const matricula = String(student?.matricula || '').trim();

  if (!idAlumno && !matricula) {
    throw new Error('No se pudo consultar el promedio del alumno.');
  }

  const [rows] = await pool.query(
    `
    SELECT
      a.id_alumno,
      a.matricula,
      a.semestre_actual,
      a.estatus_academico,
      COALESCE(k.promedio_general, 0) AS promedio_general,
      COALESCE(k.creditos_acumulados, 0) AS creditos_acumulados,
      COALESCE(k.estatus, 'Vigente') AS kardex_estatus
    FROM alumnos a
    LEFT JOIN kardex_alumno k ON k.id_alumno = a.id_alumno
    WHERE (? > 0 AND a.id_alumno = ?) OR (a.matricula = ?)
    LIMIT 1
    `,
    [idAlumno, idAlumno, matricula]
  );

  const row = rows?.[0];
  if (!row) {
    return {
      promedio_general: null,
      creditos_acumulados: null,
      estatus_academico: null,
      kardex_estatus: null,
      mensaje: 'No se encontró kardex del alumno.'
    };
  }

  return {
    id_alumno: Number(row.id_alumno || idAlumno || 0),
    matricula: row.matricula || matricula,
    semestre_actual: Number(row.semestre_actual || 0),
    estatus_academico: row.estatus_academico || 'Regular',
    promedio_general: Number(row.promedio_general || 0),
    creditos_acumulados: Number(row.creditos_acumulados || 0),
    kardex_estatus: row.kardex_estatus || 'Vigente'
  };
}

async function getStudentEligibility(pool, student, questionOrContext = {}) {
  if (!student) {
    return {
      eligible: false,
      mensaje:
        'No se pudo identificar al alumno para calcular la elegibilidad. Inicia sesión con una cuenta de alumno o envía matrícula/correo en la consulta.',
      criterios_estimados: {
        promedio_minimo: null,
        semestre_minimo: null
      },
      alumno: null
    };
  }

  const average = await getStudentAverage(pool, student);
  const promedioAlumno = average?.promedio_general ?? 0;
  const semestreAlumno = average?.semestre_actual ?? 0;
  const creditosAlumno = average?.creditos_acumulados ?? 0;

  const becasAplicables = OFFICIAL_BECAS_CATALOG.filter((b) => {
    const niveles = (b.nivel || []).map((n) => normalizeUpper(n));
    return niveles.some(
      (n) =>
        n.includes('LICENCIAT') ||
        n.includes('INGENIER') ||
        n.includes('TSU') ||
        n.includes('SUPERIOR') ||
        n.includes('UNIVERSIDAD')
    );
  });

  if (!becasAplicables.length) {
    return {
      eligible: false,
      mensaje: 'No se encontraron becas aplicables a tu nivel educativo.',
      alumno: {
        promedio_general: promedioAlumno,
        semestre_actual: semestreAlumno,
        creditos_acumulados: creditosAlumno
      },
      becas_evaluadas: []
    };
  }

  const resultados = [];
  let algunaElegible = false;

  for (const beca of becasAplicables) {
    const textoRequisitos = [
      beca.titulo,
      beca.descripcion,
      beca.resumen,
      ...(beca.requisitos || [])
    ].join(' ');

    const promedioMinimo = inferMinimumAverage(textoRequisitos);
    const semestreMinimo = inferRequiredSemester(textoRequisitos);

    const creditosMinimos = textoRequisitos.includes('30%')
      ? Math.ceil(300 * 0.3)
      : textoRequisitos.includes('50%')
        ? 150
        : textoRequisitos.includes('75%')
          ? 225
          : null;

    const checks = [];

    checks.push({
      criterio: 'Promedio mínimo requerido',
      requerido: promedioMinimo,
      obtenido: promedioAlumno,
      cumple: promedioAlumno >= promedioMinimo,
      detalle: promedioAlumno >= promedioMinimo
        ? `El alumno tiene ${promedioAlumno.toFixed(2)} ≥ ${promedioMinimo} requerido`
        : `El alumno tiene ${promedioAlumno.toFixed(2)} < ${promedioMinimo} requerido`
    });

    if (semestreMinimo > 1) {
      checks.push({
        criterio: 'Semestre mínimo requerido',
        requerido: semestreMinimo,
        obtenido: semestreAlumno,
        cumple: semestreAlumno >= semestreMinimo,
        detalle: semestreAlumno >= semestreMinimo
          ? `El alumno cursa ${semestreAlumno}° semestre ≥ ${semestreMinimo} requerido`
          : `El alumno cursa ${semestreAlumno}° semestre < ${semestreMinimo} requerido`
      });
    }

    if (creditosMinimos !== null) {
      checks.push({
        criterio: 'Créditos mínimos acumulados',
        requerido: creditosMinimos,
        obtenido: creditosAlumno,
        cumple: creditosAlumno >= creditosMinimos,
        detalle: creditosAlumno >= creditosMinimos
          ? `El alumno tiene ${creditosAlumno} créditos ≥ ${creditosMinimos} requeridos`
          : `El alumno tiene ${creditosAlumno} créditos < ${creditosMinimos} requeridos`
      });
    }

    const cumpleTodos = checks.every((c) => c.cumple);
    if (cumpleTodos) algunaElegible = true;

    resultados.push({
      id_beca: beca.id,
      codigo_beca: beca.codigo,
      titulo: beca.titulo,
      institucion: beca.institucion,
      url: beca.url,
      elegible: cumpleTodos,
      checks,
      resumen_requisitos: textoRequisitos.substring(0, 300)
    });
  }

  return {
    eligible: algunaElegible,
    mensaje: algunaElegible
      ? `Eres elegible para al menos una beca de las ${resultados.length} evaluadas. Revisa el desglose por cada programa.`
      : `No cumples los requisitos para ninguna de las ${resultados.length} becas evaluadas con tus datos actuales.`,
    alumno: {
      promedio_general: promedioAlumno,
      semestre_actual: semestreAlumno,
      creditos_acumulados: creditosAlumno,
      nombre_completo: student.nombre_completo,
      matricula: student.matricula,
      correo: student.correo,
      nombre_carrera: student.nombre_carrera
    },
    becas_evaluadas: resultados,
    total_evaluadas: resultados.length,
    total_elegibles: resultados.filter((r) => r.elegible).length
  };
}

module.exports = {
  resolveStudentIdentity,
  getStudentAverage,
  getStudentEligibility,
  inferMinimumAverage,
  inferRequiredSemester
};
