const {
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
} = require('./asistenteTools');

const {
  searchScholarships,
  rankScholarshipResults,
  buildScholarshipContextMessage,
  getAsistenteContenido,
  buildContenidoContext
} = require('./asistenteRAG');

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function getUserRoleName(user) {
  return normalizeRoleName(user?.rol_nombre || user?.rol || user?.role);
}

function getUserId(user) {
  return Number(user?.id_usuario || user?.idUser || user?.usuario_id || user?.sub || 0);
}

function classifyIntent(message, role) {
  const text = String(message || '').toLowerCase();
  const rol = String(role || '').toUpperCase();

  // Greeting / help detection
  if (/^(hola|buen[oa]s?\s*(d[ií]a|tardes|noches)?|saludos|hey|qu[ée]\s+pasa|c[oó]mo\s+(est[aá]s|te\s+va)|bienvenido|auxilio|ayuda|help|opciones?|qu[ée]\s+puedes|hazte\s+eco)/.test(text)) return 'WELCOME';

  // Role declaration: "soy docente/alumno/etc"
  if (/^soy\s+(docente|alumno|coordinador|administrador|soporte)/.test(text)) return 'ROL';

  // System statistics
  if (/(?:cu[áa]ntos?\s+(?:usuarios?|alumnos?|docentes?|maestros?|profesores?|materias?|personas?)|cu[áa]ntas?\s+(?:materias?|personas?)|total\s+de\s+(?:usuarios?|alumnos?|docentes?|maestros?|profesores?|materias?|personas?)|cantidad\s+de\s+(?:usuarios?|alumnos?|docentes?|maestros?|profesores?|materias?|personas?)|estad[ií]sticas?)/.test(text)) return 'STATS';

  if (/(beca|becas|convocatoria|gaceta|edomex|apoyo económico)/.test(text)) return 'BECAS';
  if (/(bienestar|acompañamiento|ansiedad|estr[eé]s|depresi[oó]n|emocional|salud mental)/.test(text)) return 'BIENESTAR';
  if (/(error|falla|ticket|traza|log|no funciona|mantenimiento|diagn[oó]stico)/.test(text)) return 'SOPORTE';

  // Soporte-specific intents
  if (/(panel\s+t[ée]cnico|diagn[oó]stico|estado\s+del\s+sistema|c[oó]mo\s+(est[aá]\s+)?el\s+sistema|health|chequeo|salud\s+del?\s+sistema)/.test(text)) return 'SOP_DASHBOARD';
  if (/(incidencia|bug|problema\s+t[ée]cnico)/.test(text)) return 'SOP_INCIDENCIAS';
  if (/(bit[áa]cora|registro\s+actividad)/.test(text)) return 'SOP_BITACORA';
  if (/(sesiones?\s+activas|sesiones?\s+asistente|validar\s+sesi[oó]n)/.test(text)) return 'SOP_SESIONES';
  if (/(recuperar\s+acceso|restablecer|password|contraseña|credenciales|reset)/.test(text)) return 'SOP_RESETS';

  // Admin-specific intents
  if (/(auditor[ií]a|historial\s+asistente)/.test(text)) return 'ADMIN_AUDIT';
  if (/(config|configuraci[oó]n|parametros)/.test(text)) return 'ADMIN_CONFIG';
  if (/(panel\s+principal|dashboard\s+admin|resumen\s+general)/.test(text)) return 'ADMIN_DASHBOARD';
  // Admin academic queries - handle accented chars: aá, eé, ií, oó, uú
  if (/(consulta|consultas)\s+acad[eé]micas?/.test(text)) return 'ADMIN_ACADEMICO';
  if (/(orientaci[oó]n|reporte|reportes|estad[ií]sticas?|seguimiento|panel)\s+acad[eé]micas?/.test(text)) return 'ADMIN_ACADEMICO';

  // Coordinator-specific intents
  if (/(avance\s+grupos|panel\s+acad[eé]mico|dashboard\s+coordinador|resumen\s+acad[eé]mico)/.test(text)) return 'COORD_DASHBOARD';
  if (/(seguimiento\s+alumno|estado\s+acad[eé]mico\s+alumno|tracking)/.test(text)) return 'COORD_TRACKING';
  if (/(alerta|riesgo|deserci[oó]n|rezago|irregular)/.test(text)) return 'COORD_ALERTS';
  if (/(reporte\s+(grupo|acad[eé]mico)|exportar|pdf|excel|csv|descargar)/.test(text)) return 'COORD_REPORT';

  // Admin-specific academic fallbacks (role-aware)
  if (rol === 'ADMINISTRADOR') {
    if (/(?:consulta|consultas)\s+acad[eé]mica/.test(text) || /orientaci[oó]n/.test(text) || /reporte\s+acad[eé]mico/.test(text) || /seguimiento\s+acad[eé]mico/.test(text)) return 'ADMIN_ACADEMICO';
    if (/(evaluaciones?|grupos?|alumnos?|kardex|inscripciones?|promedio|calificaci[oó]n|reinscripci[oó]n|horario|estado\s+acad|materia)/.test(text)) return 'ADMIN_ACADEMICO';
  }

  // Role-specific intents: check in priority order within each role
  if (rol === 'DOCENTE') {
    if (/(?:mis?\s+)?evaluaciones?(?:\s+(?:activas?|del\s+grupo|que\s+tengo|asignadas?|docente|pendientes?))?|resultados?\s+evaluaci[oó]n|cu[áa]ntas?\s+evaluaciones|qu[ée]\s+evaluaciones/.test(text)) return 'DOC_EVALS';
    if (/(?:mis?\s+)?alumnos?(?:\s+(?:del\s+grupo|asignados?|registrados?))?|lista\s+(?:de\s+)?alumnos|cu[áa]ntos?\s+alumnos/.test(text)) return 'DOC_STUDENTS';
    if (/(?:mis?\s+)?grupos?(?:\s+(?:asignados?|activos?|que\s+tengo|que\s+imparto))?|materias?\s+asignadas?|cargas?\s+acad[ée]micas?|qu[ée]\s+grupos?\s+(?:tengo|imparto|doy)/.test(text)) return 'DOC_GROUPS';
    if (/(?:mi?\s+)?kardex|historial\s+acad[ée]mico|calificaciones?\s+alumno|expediente/.test(text)) return 'DOC_KARDEX';
  }

  if (rol === 'ALUMNO') {
    if (/(?:mi?\s+)?panel|situaci[oó]n\s+acad[ée]mica|(?:mis?\s+)?datos|resumen\s+personal/.test(text)) return 'ALUM_DASHBOARD';
    if (/(?:mi?\s+)?kardex|mi?\s+historial|mis?\s+calificaciones|mis?\s+materias|promedio|cr[eé]ditos?/.test(text)) return 'ALUM_KARDEX';
    if (/(?:mis?\s+)?inscripci[oó]n(?:es)?|inscripci[oó]n(?:es)?/.test(text)) return 'ALUM_INSCRIPCIONES';
    if (/(?:mis?\s+)?evaluaciones?(?:\s+(?:activas?|que\s+tengo|del\s+alumno|pendientes?))?|evaluaciones?\s+alumno|mis?\s+resultados|cu[áa]ntas?\s+evaluaciones|qu[ée]\s+evaluaciones/.test(text)) return 'ALUM_EVALUACIONES';
  }

  // Generic role-agnostic fallback for academic terms (role-aware)
  if (/(?:mis?\s+)?evaluaciones?(?:\s+(?:activas?|que\s+tengo|pendientes?))?|cu[áa]ntas?\s+evaluaciones|qu[ée]\s+evaluaciones/.test(text)) return rol === 'ALUMNO' ? 'ALUM_EVALUACIONES' : 'DOC_EVALS';
  if (/(?:mis?\s+)?alumnos?(?:\s+(?:del\s+grupo|asignados?|registrados?))?|lista\s+(?:de\s+)?alumnos|cu[áa]ntos?\s+alumnos/.test(text)) return rol === 'ALUMNO' ? 'ALUM_DASHBOARD' : 'DOC_STUDENTS';
  if (/(?:mis?\s+)?grupos?(?:\s+(?:asignados?|activos?|que\s+tengo|que\s+imparto))?|materias?\s+asignadas?|cargas?\s+acad[ée]micas?/.test(text)) return rol === 'ALUMNO' ? 'ALUM_INSCRIPCIONES' : 'DOC_GROUPS';
  if (/(?:mi?\s+)?kardex|historial\s+acad[ée]mico|calificaciones?|expediente/.test(text)) return rol === 'ALUMNO' ? 'ALUM_KARDEX' : 'DOC_KARDEX';

  // ACADEMICO (after all specific intents)
  if (/(promedio|calificaci[oó]n|reinscripci[oó]n|horario|estado\s+acad|materia)/.test(text)) return 'ACADEMICO';

  // Generic ROL (very last before GENERAL)
  if (/(docente|alumno|coordinador|administrador|soporte)/.test(text)) return 'ROL';

  return 'GENERAL';
}

async function getAsistenteContext(pool, user) {
  const roleName = getUserRoleName(user);
  const idUsuario = getUserId(user);

  let profile = null;

  if (idUsuario) {
    try {
      profile = await getStudentAverage(pool, user);
    } catch {
      profile = null;
    }
  }

  return {
    id_usuario: idUsuario || null,
    rol: roleName,
    perfil: profile,
    puede_ver_becas: true,
    puede_ver_privado: ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO', 'SOPORTE'].includes(roleName)
  };
}

async function clearAsistenteSession(pool, user) {
  const idUsuario = getUserId(user);
  if (!idUsuario) return;

  await pool.query(
    'DELETE FROM asistente_mensajes WHERE id_sesion IN (SELECT id_sesion FROM asistente_sesiones WHERE id_usuario = ?)',
    [idUsuario]
  );

  await pool.query('DELETE FROM asistente_sesiones WHERE id_usuario = ?', [idUsuario]);
}

async function ensureSession(pool, user) {
  const idUsuario = getUserId(user);
  const roleName = getUserRoleName(user);

  if (!idUsuario) {
    return { id_sesion: null };
  }

  const [rows] = await pool.query(
    `
    SELECT id_sesion
    FROM asistente_sesiones
    WHERE id_usuario = ?
    ORDER BY actualizado_en DESC
    LIMIT 1
    `,
    [idUsuario]
  );

  if (rows[0]?.id_sesion) {
    return rows[0];
  }

  const [insertResult] = await pool.query(
    `
    INSERT INTO asistente_sesiones (id_usuario, rol_usuario, tema_actual, estado)
    VALUES (?, ?, 'GENERAL', 'ACTIVA')
    `,
    [idUsuario, roleName]
  );

  return { id_sesion: insertResult.insertId };
}

async function saveMessage(pool, idSesion, role, contenido, intent = 'GENERAL', tool = null) {
  if (!idSesion) return;

  await pool.query(
    `
    INSERT INTO asistente_mensajes
      (id_sesion, rol_mensaje, contenido, tipo_intencion, herramienta_usada)
    VALUES (?, ?, ?, ?, ?)
    `,
    [idSesion, role, String(contenido || ''), intent, tool]
  );
}

async function writeAudit(pool, user, intent, tool, pregunta, respuesta, permitido = 1) {
  const idUsuario = getUserId(user);
  if (!idUsuario) return;

  await pool.query(
    `
    INSERT INTO asistente_auditoria
      (id_usuario, rol_usuario, intencion, herramienta, pregunta, respuesta_resumen, permitido)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      idUsuario,
      getUserRoleName(user),
      intent,
      tool,
      String(pregunta || ''),
      String(respuesta || '').slice(0, 1000),
      permitido ? 1 : 0
    ]
  );
}

function capitalizeRole(roleName) {
  const map = {
    ADMINISTRADOR: 'Administrador',
    COORDINADOR: 'Coordinador',
    DOCENTE: 'Docente',
    ALUMNO: 'Alumno',
    SOPORTE: 'Soporte'
  };
  return map[normalizeRoleName(roleName)] || roleName;
}

function buildWelcomeMessage(rol) {
  const display = capitalizeRole(rol);
  return `Hola. Soy el Asistente Acad\u00e9mico de SIVACAD para ${display}. Puedo ayudarte con consultas acad\u00e9micas, becas, kardex, evaluaciones, a\u00f1adenimiento y soporte. \u00bfEn qu\u00e9 puedo orientarte?`;
}

function buildAnswer({ rol, intent, data, mensaje }) {
  if (intent === 'WELCOME') {
    return buildWelcomeMessage(rol);
  }

  if (intent === 'STATS') {
    const s = data?.stats;
    if (!s) return 'No pude obtener las estadísticas del sistema.';

    const parts = [];
    if (s.usuarios !== undefined) parts.push(`Usuarios: ${s.usuarios}`);
    if (s.alumnos !== undefined) parts.push(`Alumnos: ${s.alumnos}`);
    if (s.docentes !== undefined) parts.push(`Docentes: ${s.docentes}`);
    if (s.materias !== undefined) parts.push(`Materias: ${s.materias}`);

    return parts.length
      ? `Actualmente en el sistema hay: ${parts.join(', ')}.`
      : 'No pude obtener las estadísticas del sistema.';
  }

  if (intent === 'BECAS') {
    const convocatorias = Array.isArray(data?.convocatorias) ? data.convocatorias : [];
    const eligibilidad = data?.elegibilidad || null;

    if (!convocatorias.length) {
      return 'No encontré convocatorias vigentes con ese criterio.';
    }

    const top = convocatorias[0];
    const eligibilityText = eligibilidad
      ? eligibilidad.elegible_beca
        ? `Además, con tu promedio actual (${eligibilidad.promedio_general ?? 'N/D'}) sí pareces cumplir la base mínima de elegibilidad.`
        : `Además, con tu promedio actual (${eligibilidad.promedio_general ?? 'N/D'}) todavía no cumples la base mínima de elegibilidad.`
      : '';

    return [
      `Encontré ${convocatorias.length} convocatoria(s) vigente(s).`,
      `La más cercana es "${top.titulo}".`,
      top.resumen ? top.resumen : '',
      eligibilityText
    ].filter(Boolean).join(' ');
  }

  if (intent === 'ACADEMICO') {
    if (!data) return 'No pude localizar tu información académica.';
    return `Tu promedio actual es ${data.promedio_general ?? 'N/D'} y tu estatus académico es ${data.estatus_academico || 'N/D'}. También puedo ayudarte con kardex, materias, reinscripción o becas.`;
  }

  if (intent === 'BIENESTAR') {
    return 'Puedo orientarte con acompañamiento emocional, académico y laboral. Si sientes riesgo inmediato o una crisis, busca apoyo institucional y contacto humano de inmediato.';
  }

  if (intent === 'SOPORTE') {
    return 'Describe el error con el módulo, el navegador y el momento exacto en que ocurre. Con eso te ayudo a aislar la falla.';
  }

  if (intent === 'ROL') {
    return `Hola, te atiendo como asistente institucional para el rol ${rol}. Puedo adaptar respuestas sobre becas, kardex, acompañamiento, soporte y tutoría académica.`;
  }

  if (intent === 'DOC_GROUPS') {
    const g = Array.isArray(data?.groups) ? data.groups : [];
    if (!g.length) return 'No tienes grupos asignados en el periodo actual.';
    return `Tienes ${g.length} carga(s) académica(s) asignada(s).`;
  }

  if (intent === 'DOC_STUDENTS') {
    const t = Array.isArray(data?.tracking) ? data.tracking : [];
    if (!t.length) return 'No se encontraron alumnos en tus grupos.';
    return `Tienes ${t.length} alumno(s) registrado(s) en tus grupos.`;
  }

  if (intent === 'DOC_EVALS') {
    const e = Array.isArray(data?.evaluations) ? data.evaluaciones || data.evaluations : [];
    if (!e.length) return 'No tienes evaluaciones activas registradas actualmente.';
    const count = e.length;
    const lines = e.slice(0, 10).map((ev, i) => {
      const parts = [];
      if (ev.titulo) parts.push(ev.titulo);
      if (ev.nombre_materia) parts.push(ev.nombre_materia);
      if (ev.nombre_grupo) parts.push(ev.nombre_grupo);
      if (ev.nombre_periodo) parts.push(ev.nombre_periodo);
      if (ev.eval_estado) parts.push(`Estado: ${ev.eval_estado}`);
      return `${i + 1}. ${parts.join(' | ')}`;
    });
    const extra = count > 10 ? `\n... y ${count - 10} m\u00e1s.` : '';
    return `Tienes ${count} evaluaci\u00f3n(es) activa(s):\n${lines.join('\n')}${extra}`;
  }

  if (intent === 'DOC_KARDEX') {
    const k = data?.kardex;
    if (!k?.alumno) return 'No se encontró el kardex del alumno.';
    return `Kardex de ${k.alumno.nombres} ${k.alumno.apellido_paterno}: promedio ${Number(k.alumno.promedio_general).toFixed(2)}, créditos ${k.alumno.creditos_acumulados}, estatus ${k.alumno.estatus_academico}.`;
  }

  if (intent === 'ALUM_DASHBOARD') {
    const d = data?.dashboard;
    if (!d?.alumno) return 'No pude obtener tu información personal.';
    return `Tu situación académica — Promedio: ${Number(d.alumno.promedio_general).toFixed(2)}, Semestre: ${d.alumno.semestre_actual}°, Créditos: ${d.alumno.creditos_acumulados}, Estatus: ${d.alumno.estatus_academico}.`;
  }

  if (intent === 'ALUM_KARDEX') {
    const k = data?.kardex;
    if (!k?.alumno) return 'No pude obtener tu kardex.';
    return `Tu kardex — Promedio general: ${Number(k.alumno.promedio_general).toFixed(2)}, Créditos acumulados: ${k.alumno.creditos_acumulados}, Materias acreditadas: ${k.resumen?.acreditadas || 0}, Pendientes: ${k.resumen?.no_acreditadas || 0}.`;
  }

  if (intent === 'ALUM_INSCRIPCIONES') {
    const ins = Array.isArray(data?.inscripciones) ? data.inscripciones : [];
    if (!ins.length) return 'No tienes inscripciones registradas.';
    return `Tienes ${ins.length} inscripción(es). La más reciente es del período ${ins[0]?.nombre_periodo || 'N/D'} (${ins[0]?.insc_estado || 'N/D'}).`;
  }

  if (intent === 'ALUM_EVALUACIONES') {
    const ev = Array.isArray(data?.evaluaciones) ? data.evaluaciones : [];
    if (!ev.length) return 'No hay evaluaciones disponibles.';
    const activas = ev.filter(e => e.eval_estado === 'ACTIVA');
    return `Hay ${ev.length} evaluacion(es), ${activas.length} activa(s).`;
  }

  if (intent === 'SOP_DASHBOARD') {
    const d = data?.dashboard;
    if (!d) return 'No pude obtener el estado del sistema.';
    return `Estado del sistema — Usuarios: ${d.total_usuarios}, Sesiones activas: ${d.sesiones_activas_asistente}, Bitácora 24h: ${d.bitacora_24h}, Resets pendientes: ${d.resets_pendientes}.`;
  }

  if (intent === 'SOP_INCIDENCIAS') {
    const inc = Array.isArray(data?.incidencias) ? data.incidencias : [];
    if (!inc.length) return 'No se encontraron incidencias recientes.';
    return `Se encontraron ${inc.length} incidencia(s) en los registros recientes.`;
  }

  if (intent === 'SOP_BITACORA') {
    const audit = Array.isArray(data?.bitacora) ? data.bitacora : [];
    if (!audit.length) return 'No hay registros en la bitácora.';
    return `Bitácora con ${audit.length} registro(s). El más reciente: "${audit[0]?.pregunta || 'N/D'}" — ${audit[0]?.rol_usuario || 'N/D'}.`;
  }

  if (intent === 'SOP_SESIONES') {
    const ses = Array.isArray(data?.sesiones) ? data.sesiones : [];
    if (!ses.length) return 'No hay sesiones activas del asistente.';
    const activas = ses.filter(s => s.estado === 'ACTIVA');
    return `Hay ${ses.length} sesión(es) registrada(s), ${activas.length} activa(s).`;
  }

  if (intent === 'SOP_RESETS') {
    const resets = Array.isArray(data?.resets) ? data.resets : [];
    if (!resets.length) return 'No hay solicitudes de restablecimiento pendientes.';
    const pendientes = resets.filter(r => !r.used && new Date(r.expires_at) > new Date());
    return `Hay ${resets.length} solicitudes de restablecimiento, ${pendientes.length} pendiente(s).`;
  }

  if (intent === 'COORD_DASHBOARD') {
    const d = data?.dashboard;
    if (!d) return 'No pude obtener el panel académico.';
    return `Panel académico — Alumnos: ${d.total_alumnos}, Grupos: ${d.total_grupos_abiertos}, Docentes: ${d.total_docentes}, Alertas pendientes: ${d.alertas_pendientes}, Evaluaciones activas: ${d.evaluaciones_activas}.`;
  }

  if (intent === 'COORD_TRACKING') {
    const t = Array.isArray(data?.tracking) ? data.tracking : [];
    if (!t.length) return 'No se encontraron alumnos en seguimiento.';
    const riesgos = t.filter(a => a.nivel_riesgo !== 'Sin riesgo');
    return `Se encontraron ${t.length} alumnos en seguimiento, ${riesgos.length} con nivel de riesgo detectado.`;
  }

  if (intent === 'COORD_ALERTS') {
    const a = Array.isArray(data?.alerts) ? data.alerts : [];
    if (!a.length) return 'No hay alertas activas.';
    const criticas = a.filter(al => al.nivel_riesgo === 'Crítico' || al.nivel_riesgo === 'Alto');
    return `Hay ${a.length} alerta(s) activa(s), ${criticas.length} de nivel crítico o alto.`;
  }

  if (intent === 'COORD_REPORT') {
    return 'Puedo generar reportes de grupos, periodos y alumnos. Usa el panel de Reportes para exportar a PDF, Excel o CSV.';
  }

  if (intent === 'ADMIN_DASHBOARD') {
    const s = data?.stats;
    const u = data?.users;
    if (!s && !u) return 'No pude obtener el resumen del sistema.';
    const parts = [];
    if (s?.usuarios !== undefined) parts.push(`Usuarios: ${s.usuarios}`);
    if (s?.alumnos !== undefined) parts.push(`Alumnos: ${s.alumnos}`);
    if (s?.docentes !== undefined) parts.push(`Docentes: ${s.docentes}`);
    if (s?.materias !== undefined) parts.push(`Materias: ${s.materias}`);
    return parts.length
      ? `Resumen del sistema — ${parts.join(', ')}.`
      : 'No pude obtener el resumen del sistema.';
  }

  if (intent === 'ADMIN_AUDIT') {
    const audit = Array.isArray(data?.audit) ? data.audit : [];
    if (!audit.length) return 'No hay registros de auditoría recientes.';
    return `Se encontraron ${audit.length} registros de auditoría. El más reciente fue: "${audit[0]?.pregunta || 'N/D'}" por ${audit[0]?.rol_usuario || 'N/D'} (${audit[0]?.intencion || 'N/D'}).`;
  }

  if (intent === 'ADMIN_CONFIG') {
    const cfg = data?.config;
    const periodos = Array.isArray(cfg?.periodos) ? cfg.periodos : [];
    const carreras = Array.isArray(cfg?.carreras) ? cfg.carreras : [];
    const p = periodos.find(p => p.activo) || periodos[0];
    const periodoStr = p ? `Período activo: ${p.nombre_periodo}` : 'Sin período activo.';
    return `${periodoStr}. Carreras activas: ${carreras.length}.`;
  }

  if (intent === 'ADMIN_ACADEMICO') {
    const s = data?.stats;
    const u = data?.users;
    const cfg = data?.config;
    const a = data?.audit;

    const parts = [];
    if (s?.usuarios !== undefined) parts.push(`Usuarios: ${s.usuarios}`);
    if (s?.alumnos !== undefined) parts.push(`Alumnos: ${s.alumnos}`);
    if (s?.docentes !== undefined) parts.push(`Docentes: ${s.docentes}`);
    if (s?.materias !== undefined) parts.push(`Materias: ${s.materias}`);

    const resumen = parts.length ? `Estadísticas del sistema: ${parts.join(', ')}.` : 'Sistema operativo.';

    const periodoActivo = cfg?.periodos?.find(p => p.activo);
    const periodoStr = periodoActivo ? `Período activo: ${periodoActivo.nombre_periodo} (${periodoActivo.ciclo_escolar}).` : 'Sin período activo configurado.';
    const carrerasCount = Array.isArray(cfg?.carreras) ? cfg.carreras.length : 0;

    const auditoriaReciente = Array.isArray(a) && a.length > 0
      ? `Últimas consultas al asistente: ${a.length} registro(s). La más reciente: "${a[0]?.pregunta || 'N/D'}" por ${a[0]?.rol_usuario || 'N/D'}.`
      : 'Sin auditoría reciente del asistente.';

    return [
      resumen,
      periodoStr,
      `Carreras activas: ${carrerasCount}.`,
      auditoriaReciente,
      'Puedo ayudarte con estadísticas, configuración, usuarios, auditoría, becas, evaluaciones, kardex y reportes académicos.'
    ].filter(Boolean).join(' ');
  }

  return `No identifiqué una acci\u00f3n espec\u00edfica para tu consulta. Puedo ayudarte con evaluaciones, grupos, alumnos, kardex, becas, inscripciones, soporte t\u00e9cnico u orientaci\u00f3n. \u00bfQu\u00e9 necesitas?`;
}

async function handleAsistenteMessage(pool, user, mensaje) {
  const idUsuario = getUserId(user);
  const rol = getUserRoleName(user);
  const intent = classifyIntent(mensaje, rol);
  const session = await ensureSession(pool, user);

  await saveMessage(pool, session.id_sesion, 'user', mensaje, intent, null);

  let tool = 'GENERAL';
  let data = null;
  let ragInfo = null;

  try {
    const ragRows = await getAsistenteContenido(pool, intent, rol);
    const ragContext = buildContenidoContext(ragRows, rol);

    if (intent === 'WELCOME') {
      data = { mensaje: `Bienvenido, ${rol}.`, rag: ragRows, ragContext };
      tool = 'WELCOME';
    } else if (intent === 'BECAS') {
      const scholarshipContext = await getScholarshipContext(pool, user);
      const rgRows = await searchScholarships(pool, mensaje);
      const ranked = rankScholarshipResults(rgRows.length ? rgRows : scholarshipContext.convocatorias || []);
      const eligibility = await getStudentEligibility(pool, user);

      data = {
        ...scholarshipContext,
        convocatorias: ranked,
        resumen: buildScholarshipContextMessage(ranked),
        elegibilidad: eligibility,
        rag: ragRows,
        ragContext
      };
      tool = 'RAG_BECA';
    } else if (intent === 'STATS') {
      const stats = await getSystemStats(pool);

      data = {
        stats,
        pregunta: mensaje,
        rag: ragRows,
        ragContext
      };
      tool = 'STATS';
    } else if (intent === 'ACADEMICO') {
      const profile = await getStudentAverage(pool, user);
      const eligibility = await getStudentEligibility(pool, user);

      data = {
        perfil: profile,
        elegibilidad: eligibility,
        rag: ragRows,
        ragContext
      };
      tool = 'MYSQL_ACADEMICO';
    } else if (intent === 'BIENESTAR') {
      data = {
        mensaje:
          'Puedo orientarte con acompañamiento emocional y académico, pero no reemplazo atención profesional.',
        rag: ragRows,
        ragContext
      };
      tool = 'BIENESTAR';
    } else if (intent === 'SOPORTE') {
      data = {
        mensaje:
          'Puedo ayudarte a revisar fallas, tickets, trazas y mantenimiento del sistema.',
        rag: ragRows,
        ragContext
      };
      tool = 'SOPORTE';
    } else if (intent === 'DOC_GROUPS') {
      const groups = await getDocGroups(pool, user);
      data = { groups, rag: ragRows, ragContext };
      tool = 'DOC_GROUPS';
    } else if (intent === 'DOC_STUDENTS') {
      const tracking = await getDocTracking(pool, user);
      data = { tracking, rag: ragRows, ragContext };
      tool = 'DOC_STUDENTS';
    } else if (intent === 'DOC_EVALS') {
      const evaluations = await getDocEvaluations(pool, user);
      data = { evaluations, rag: ragRows, ragContext };
      tool = 'DOC_EVALS';
    } else if (intent === 'DOC_KARDEX') {
      const groups = await getDocGroups(pool, user);
      data = { groups, rag: ragRows, ragContext, msg: 'Para consultar el kardex, selecciona un alumno en el panel de seguimiento académico.' };
      tool = 'DOC_KARDEX';
    } else if (intent === 'ALUM_DASHBOARD') {
      const dashboard = await getAlumDashboard(pool, user);
      data = { dashboard, rag: ragRows, ragContext };
      tool = 'ALUM_DASHBOARD';
    } else if (intent === 'ALUM_KARDEX') {
      const kardex = await getAlumKardexDetalle(pool, user);
      data = { kardex, rag: ragRows, ragContext };
      tool = 'ALUM_KARDEX';
    } else if (intent === 'ALUM_INSCRIPCIONES') {
      const inscripciones = await getAlumInscripciones(pool, user);
      data = { inscripciones, rag: ragRows, ragContext };
      tool = 'ALUM_INSCRIPCIONES';
    } else if (intent === 'ALUM_EVALUACIONES') {
      const evaluaciones = await getAlumEvaluaciones(pool, user);
      data = { evaluaciones, rag: ragRows, ragContext };
      tool = 'ALUM_EVALUACIONES';
    } else if (intent === 'SOP_DASHBOARD') {
      const dashboard = await getSopDashboard(pool);
      data = { dashboard, rag: ragRows, ragContext };
      tool = 'SOP_DASHBOARD';
    } else if (intent === 'SOP_INCIDENCIAS') {
      const incidencias = await getSopIncidencias(pool);
      data = { incidencias, rag: ragRows, ragContext };
      tool = 'SOP_INCIDENCIAS';
    } else if (intent === 'SOP_BITACORA') {
      const bitacora = await getSystemAudit(pool, 30);
      data = { bitacora, rag: ragRows, ragContext };
      tool = 'SOP_BITACORA';
    } else if (intent === 'SOP_SESIONES') {
      const sesiones = await getSopSesiones(pool);
      data = { sesiones, rag: ragRows, ragContext };
      tool = 'SOP_SESIONES';
    } else if (intent === 'SOP_RESETS') {
      const resets = await getSopPasswordResets(pool);
      data = { resets, rag: ragRows, ragContext };
      tool = 'SOP_RESETS';
    } else if (intent === 'COORD_DASHBOARD') {
      const dashboard = await getCoordDashboard(pool);
      const groups = await getCoordGroups(pool);
      data = { dashboard, groups, rag: ragRows, ragContext };
      tool = 'COORD_DASHBOARD';
    } else if (intent === 'COORD_TRACKING') {
      const tracking = await getCoordStudentTracking(pool);
      data = { tracking, rag: ragRows, ragContext };
      tool = 'COORD_TRACKING';
    } else if (intent === 'COORD_ALERTS') {
      const alerts = await getCoordAlerts(pool);
      data = { alerts, rag: ragRows, ragContext };
      tool = 'COORD_ALERTS';
    } else if (intent === 'COORD_REPORT') {
      const groups = await getCoordGroups(pool);
      const periods = await getCoordPeriods(pool);
      data = { groups, periods, rag: ragRows, ragContext };
      tool = 'COORD_REPORT';
    } else if (intent === 'ADMIN_AUDIT') {
      const audit = await getSystemAudit(pool);
      data = { audit, rag: ragRows, ragContext };
      tool = 'ADMIN_AUDIT';
    } else if (intent === 'ADMIN_CONFIG') {
      const config = await getSystemConfig(pool);
      data = { config, rag: ragRows, ragContext };
      tool = 'ADMIN_CONFIG';
    } else if (intent === 'ADMIN_DASHBOARD') {
      const stats = await getSystemStats(pool);
      const users = await getUserSummary(pool);
      data = { stats, users, rag: ragRows, ragContext };
      tool = 'ADMIN_DASHBOARD';
    } else if (intent === 'ADMIN_ACADEMICO') {
      const stats = await getSystemStats(pool);
      const users = await getUserSummary(pool);
      const config = await getSystemConfig(pool);
      const audit = await getSystemAudit(pool, 10);
      data = {
        stats,
        users,
        config,
        audit,
        rag: ragRows,
        ragContext
      };
      tool = 'ADMIN_ACADEMICO';
    } else {
      data = {
        mensaje: 'Asistente institucional listo.',
        rag: ragRows,
        ragContext
      };
      tool = 'GENERAL';
    }

    ragInfo = '';

    const respuesta = buildAnswer({ rol, intent, data, mensaje }) + ragInfo;

    await saveMessage(pool, session.id_sesion, 'assistant', respuesta, intent, tool);
    await writeAudit(pool, user, intent, tool, mensaje, respuesta, 1);

    await pool.query(
      `
      UPDATE asistente_sesiones
      SET tema_actual = ?, estado = 'ACTIVA'
      WHERE id_sesion = ?
      `,
      [intent, session.id_sesion]
    );

    return {
      intent,
      tool,
      respuesta,
      data,
      sesion: {
        id_sesion: session.id_sesion
      }
    };
  } catch (error) {
    const fallback = 'No fue posible generar la respuesta en este momento.';

    if (session.id_sesion) {
      await saveMessage(pool, session.id_sesion, 'assistant', fallback, intent, tool);
    }

    await writeAudit(pool, user, intent, tool, mensaje, fallback, 0);

    throw error;
  }
}

module.exports = {
  handleAsistenteMessage,
  getAsistenteContext,
  clearAsistenteSession
};