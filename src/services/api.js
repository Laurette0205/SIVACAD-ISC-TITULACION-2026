const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

const ALLOWED_IA_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR']);
const ALLOWED_IA_DOCENTE_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE']);
const ALLOWED_IA_ALUMNO_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR', 'ALUMNO']);
const ALLOWED_IA_SOPORTE_ROLES = new Set(['ADMINISTRADOR', 'SOPORTE']);
const ALLOWED_IA_BIENESTAR_ADMIN_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR']);
const ALLOWED_IA_BIENESTAR_DOCENTE_ROLES = new Set(['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE']);

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function canAccessDesercionIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_ROLES.has(roleName) || [1, 2].includes(roleId);
}

function canAccessDesercionDocenteIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_DOCENTE_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_DOCENTE_ROLES.has(roleName) || [1, 2, 3].includes(roleId);
}

function canAccessDesercionAlumnoIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_ALUMNO_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_ALUMNO_ROLES.has(roleName) || [1, 2, 4].includes(roleId);
}

function canAccessDesercionSoporteIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_SOPORTE_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_SOPORTE_ROLES.has(roleName) || [1, 5].includes(roleId);
}

function canAccessBecasSoporteIA(userOrRole) {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_SOPORTE_ROLES.has(normalizeRoleName(userOrRole));
  }
  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );
  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);
  return ALLOWED_IA_SOPORTE_ROLES.has(roleName) || [1, 5].includes(roleId);
}

function canAccessBienestarDocenteIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_BIENESTAR_DOCENTE_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_BIENESTAR_DOCENTE_ROLES.has(roleName) || [1, 2, 3].includes(roleId);
}

function canAccessBienestarAdminIA(userOrRole) {
  if (!userOrRole) return false;

  if (typeof userOrRole === 'string') {
    return ALLOWED_IA_BIENESTAR_ADMIN_ROLES.has(normalizeRoleName(userOrRole));
  }

  const roleName = normalizeRoleName(
    userOrRole.rol_nombre || userOrRole.rol || userOrRole.role || ''
  );

  const roleId = Number(userOrRole.rol_id || userOrRole.id_rol || 0);

  return ALLOWED_IA_BIENESTAR_ADMIN_ROLES.has(roleName) || [1, 2].includes(roleId);
}

function buildUrl(path) {
  const cleanPath = String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`;

  return `${BASE}${cleanPath}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  return { message: text || '' };
}

function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    String(error?.message || '').toLowerCase().includes('fetch')
  );
}

function emitAuthError(status, message) {
  if (status !== 401) return;
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('sivacad:auth-error', {
      detail: { status, message: message || 'Tu sesi\u00f3n ha expirado. Inicia sesi\u00f3n nuevamente.' }
    })
  );
}

async function request(path, { token, method = 'GET', body, form = false, timeoutMs = 20000, responseType } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!form && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers,
      signal: controller.signal,
      body: form
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined
    });

    if (responseType === 'blob') {
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        emitAuthError(response.status, errData?.message || errData?.error);
        throw new Error(errData?.message || errData?.error || `Error ${response.status}`);
      }
      return response.blob();
    }

    const data = await parseResponse(response);

    if (!response.ok) {
      emitAuthError(response.status, data?.message || data?.error);

      const error = new Error(
        data?.message ||
          data?.error ||
          `Error HTTP ${response.status}`
      );

      error.status = response.status;
      error.data = data;
      error.path = path;

      throw error;
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al consultar ${buildUrl(path)}`);
    }

    if (isNetworkError(error)) {
      throw new Error(
        `No se pudo conectar con el backend en ${BASE}. Verifica que esté ejecutándose en el puerto correcto.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function download(path, token, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal
    });

    if (!response.ok) {
      const data = await parseResponse(response);
      emitAuthError(response.status);

      const error = new Error(
        data?.message ||
          data?.error ||
          'No fue posible descargar el archivo'
      );

      error.status = response.status;
      error.data = data;
      error.path = path;

      throw error;
    }

    return response.blob();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`La descarga tardó demasiado en responder: ${buildUrl(path)}`);
    }

    if (isNetworkError(error)) {
      throw new Error(`No se pudo conectar con el backend en ${BASE}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const api = {
  login: (body) =>
    request('/auth/login', {
      method: 'POST',
      body
    }),

  register: (body) =>
    request('/auth/register', {
      method: 'POST',
      body
    }),

  me: (token) =>
    request('/auth/me', { token }),

  forgotPassword: (body) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body
    }),

  resetPassword: (tokenValue, body) =>
    request(`/auth/reset-password/${encodeURIComponent(tokenValue)}`, {
      method: 'POST',
      body
    }),

  dashboard: (token) =>
    request('/dashboard', { token }),

  alumnos: (token) =>
    request('/alumnos', { token }),

  alumnoById: (token, id) =>
    request(`/alumnos/${id}`, { token }),

  updateAlumno: (token, id, body) =>
    request(`/alumnos/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  deleteAlumno: (token, id) =>
    request(`/alumnos/${id}`, {
      token,
      method: 'DELETE'
    }),

  docentes: (token) =>
    request('/docentes', { token }),

  docenteById: (token, id) =>
    request(`/docentes/${id}`, { token }),

  updateDocente: (token, id, body) =>
    request(`/docentes/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  deleteDocente: (token, id) =>
    request(`/docentes/${id}`, {
      token,
      method: 'DELETE'
    }),

  periodos: (token, filters = '') =>
    request(`/periodos${filters}`, { token }),

  crearPeriodo: (token, body) =>
    request('/periodos', {
      token,
      method: 'POST',
      body
    }),

  grupos: (token, filters = '') =>
    request(`/grupos${filters}`, { token }),

  crearGrupo: (token, body) =>
    request('/grupos', {
      token,
      method: 'POST',
      body
    }),

  bajas: (token) =>
    request('/bajas', { token }),

  inscripciones: (token) =>
    request('/inscripciones', { token }),

  crearInscripcion: (token, body) =>
    request('/inscripciones', {
      token,
      method: 'POST',
      body
    }),

  evaluaciones: (token, filters = '') =>
    request(`/evaluaciones${filters}`, { token }),

  evaluacionCatalogos: (token) =>
    request('/evaluaciones/catalogos', { token }),

  evaluacionResumen: (token) =>
    request('/evaluaciones/resumen', { token }),

  evaluacionPreguntas: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}/preguntas`, { token }),

  evaluacionDetalle: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}`, { token }),

  crearEvaluacion: (token, body) =>
    request('/evaluaciones', {
      token,
      method: 'POST',
      body
    }),

  actualizarEvaluacion: (token, idEvaluacion, body) =>
    request(`/evaluaciones/${idEvaluacion}`, {
      token,
      method: 'PATCH',
      body
    }),

  eliminarEvaluacion: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}`, {
      token,
      method: 'DELETE'
    }),

  responderEvaluacion: (token, body) =>
    request('/evaluaciones/responder', {
      token,
      method: 'POST',
      body
    }),

  activarEvaluacion: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}/activar`, {
      token,
      method: 'POST'
    }),

  cerrarEvaluacion: (token, idEvaluacion, body = {}) =>
    request(`/evaluaciones/${idEvaluacion}/cerrar`, {
      token,
      method: 'POST',
      body
    }),

  cancelarEvaluacion: (token, idEvaluacion, body = {}) =>
    request(`/evaluaciones/${idEvaluacion}/cancelar`, {
      token,
      method: 'POST',
      body
    }),

  validarResultado: (token, idEvaluacion, body) =>
    request(`/evaluaciones/${idEvaluacion}/validar`, {
      token,
      method: 'POST',
      body
    }),

  evaluacionAuditoria: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}/auditoria`, { token }),

  auditoriaGlobal: (token, query = '') =>
    request(`/evaluaciones/auditoria${query}`, { token }),

  exportarEvaluacion: (token, idEvaluacion) =>
    request(`/evaluaciones/${idEvaluacion}/exportar`, { token }),

  resultadosEvaluacion: (token, query = '') =>
    request(`/evaluaciones/resultados${query}`, { token }),

  seguimientoEvaluaciones: (token) =>
    request('/evaluaciones/seguimiento', { token }),

  // Coordinator endpoints
  evaluacionesGrupos: (token, query = '') =>
    request(`/evaluaciones/grupos${query}`, { token }),

  seguimientoGrupos: (token, query = '') =>
    request(`/evaluaciones/seguimiento/grupos${query}`, { token }),

  evaluacionAlertas: (token, query = '') =>
    request(`/evaluaciones/alertas${query}`, { token }),

  atenderAlerta: (token, idAlerta) =>
    request(`/evaluaciones/alertas/${idAlerta}/atender`, {
      token,
      method: 'PATCH'
    }),

  resultadosParciales: (token, query = '') =>
    request(`/evaluaciones/resultados/parciales${query}`, { token }),

  // Student evaluation endpoints
  misEvaluaciones: (token) =>
    request('/evaluaciones-alumno/mis-evaluaciones', { token }),

  evaluacionesRespondidas: (token) =>
    request('/evaluaciones-alumno/respondidas', { token }),

  estadoEnvioEvaluacion: (token, idEvaluacion) =>
    request(`/evaluaciones-alumno/${idEvaluacion}/estado-envio`, { token }),

  preguntasEvaluacionAlumno: (token, idEvaluacion) =>
    request(`/evaluaciones-alumno/${idEvaluacion}/preguntas`, { token }),

  responderEvaluacionAlumno: (token, body) =>
    request('/evaluaciones-alumno/responder', { token, method: 'POST', body }),

  guardarAvanceEvaluacion: (token, idEvaluacion, respuestas) =>
    request('/evaluaciones-alumno/guardar-avance', {
      token, method: 'POST',
      body: { id_evaluacion: idEvaluacion, respuestas }
    }),

  enviarEvaluacion: (token, idEvaluacion) =>
    request('/evaluaciones-alumno/enviar', {
      token, method: 'POST',
      body: { id_evaluacion: idEvaluacion }
    }),

  // Teacher evaluation endpoints
  evaluacionesDocente: (token) =>
    request('/evaluaciones-docente/mis-evaluaciones', { token }),

  resultadosDocente: (token) =>
    request('/evaluaciones-docente/resultados', { token }),

  resultadoDocenteDetalle: (token, idResultado) =>
    request(`/evaluaciones-docente/resultados/${idResultado}`, { token }),

  comparativosDocente: (token, query = '') =>
    request(`/evaluaciones-docente/comparativos${query}`, { token }),

  evolucionDocente: (token) =>
    request('/evaluaciones-docente/evolucion', { token }),

  retroalimentacionDocente: (token) =>
    request('/evaluaciones-docente/retroalimentacion', { token }),

  reporteDocente: (token, idResultado) =>
    request(`/evaluaciones-docente/reporte/${idResultado}`, { token }),

  // Support evaluation endpoints
  soporteDiagnostico: (token) =>
    request('/evaluaciones-soporte/diagnostico', { token }),

  soporteIncidencias: (token, query = '') =>
    request(`/evaluaciones-soporte/incidencias${query}`, { token }),

  soporteErroresValidacion: (token) =>
    request('/evaluaciones-soporte/errores-validacion', { token }),

  soporteRegistros: (token, query = '') =>
    request(`/evaluaciones-soporte/registros${query}`, { token }),

  soporteVerificarRutas: (token) =>
    request('/evaluaciones-soporte/verificar-rutas', { token }),

  actasOCR: {
    panel: (token) =>
      request('/actas-ocr/panel', { token }),

    catalogos: (token) =>
      request('/actas-ocr/catalogos', { token }),

    resumen: (token) =>
      request('/actas-ocr/resumen', { token }),

    cargas: (token, params = {}) => {
      const q = [];
      if (params.limit) q.push('limit=' + params.limit);
      if (params.offset) q.push('offset=' + params.offset);
      if (params.estado) q.push('estado=' + encodeURIComponent(params.estado));
      const query = q.length ? '?' + q.join('&') : '';
      return request('/actas-ocr/cargas' + query, { token });
    },

    cargaById: (token, idCarga) =>
      request(`/actas-ocr/cargas/${idCarga}`, { token }),

    subir: (token, formData) =>
      request('/actas-ocr/subir', {
        token,
        method: 'POST',
        body: formData,
        form: true
      }),

    validar: (token, idCarga) =>
      request(`/actas-ocr/cargas/${idCarga}/validar`, {
        token,
        method: 'POST'
      }),

    aprobar: (token, idCarga, comentario = '') =>
      request(`/actas-ocr/cargas/${idCarga}/aprobar`, {
        token,
        method: 'PUT',
        body: { comentario }
      }),

    rechazar: (token, idCarga, comentario = '') =>
      request(`/actas-ocr/cargas/${idCarga}/rechazar`, {
        token,
        method: 'PUT',
        body: { comentario }
      }),

    bitacora: (token, limit = 50) =>
      request('/actas-ocr/bitacora?limit=' + limit, { token }),

    auditoria: (token, limit = 50) =>
      request('/actas-ocr/auditoria?limit=' + limit, { token }),

    incidencias: (token) =>
      request('/actas-ocr/incidencias', { token }),

    configuracion: (token) =>
      request('/actas-ocr/configuracion', { token }),

    updateConfig: (token, clave, valor) =>
      request('/actas-ocr/configuracion', {
        token,
        method: 'PUT',
        body: { clave, valor }
      })
  },

  actasOCRCoord: {
    panel: (token) =>
      request('/actas-ocr/coordinador/panel', { token }),

    catalogos: (token) =>
      request('/actas-ocr/coordinador/catalogos', { token }),

    actasGrupo: (token, idGrupo) =>
      request('/actas-ocr/coordinador/actas-grupo?id_grupo=' + idGrupo, { token }),

    actasPeriodo: (token, idPeriodo) =>
      request('/actas-ocr/coordinador/actas-periodo?id_periodo=' + idPeriodo, { token }),

    actasSemestre: (token, semestre) =>
      request('/actas-ocr/coordinador/actas-semestre?semestre=' + semestre, { token }),

    actaById: (token, id) =>
      request(`/actas-ocr/coordinador/actas/${id}`, { token }),

    validar: (token, idCarga) =>
      request(`/actas-ocr/coordinador/actas/${idCarga}/validar`, {
        token,
        method: 'POST'
      }),

    reportes: (token) =>
      request('/actas-ocr/coordinador/reportes', { token })
  },

  actasOCRDocente: {
    panel: (token) =>
      request('/actas-ocr/docente/panel', { token }),

    misGrupos: (token) =>
      request('/actas-ocr/docente/mis-grupos', { token }),

    misActas: (token) =>
      request('/actas-ocr/docente/mis-actas', { token }),

    actaById: (token, id) =>
      request(`/actas-ocr/docente/actas/${id}`, { token }),

    subir: (token, formData) =>
      request('/actas-ocr/docente/subir', {
        token, method: 'POST', body: formData, form: true
      }),

    corregir: (token, idCarga, alumnos) =>
      request(`/actas-ocr/docente/actas/${idCarga}/corregir`, {
        token, method: 'PUT', body: { alumnos }
      }),

    confirmar: (token, idCarga) =>
      request(`/actas-ocr/docente/actas/${idCarga}/confirmar`, {
        token, method: 'POST'
      })
  },

  actasOCRSoporte: {
    panel: (token) =>
      request('/actas-ocr/soporte/panel', { token }),

    incidencias: (token) =>
      request('/actas-ocr/soporte/incidencias', { token }),

    archivos: (token) =>
      request('/actas-ocr/soporte/archivos', { token }),

    archivoDetalle: (token, id) =>
      request(`/actas-ocr/soporte/archivos/${id}`, { token }),

    recuperacion: (token) =>
      request('/actas-ocr/soporte/recuperacion', { token }),

    reintentarCarga: (token, id) =>
      request(`/actas-ocr/soporte/recuperacion/reintentar/${id}`, {
        token, method: 'POST'
      }),

    monitoreo: (token) =>
      request('/actas-ocr/soporte/monitoreo', { token })
  },

  actasOCRAlumno: {
    panel: (token) =>
      request('/actas-ocr/alumno/panel', { token }),

    historial: (token) =>
      request('/actas-ocr/alumno/historial', { token }),

    resultados: (token) =>
      request('/actas-ocr/alumno/resultados', { token }),

    actasValidadas: (token) =>
      request('/actas-ocr/alumno/actas-validadas', { token })
  },

  kardexAlumno: (token, id) =>
    request(`/kardex/alumno/${id}`, { token }),

  kardexAlumnoMe: (token) =>
    request('/kardex/alumno/me', { token }),

  kardexGrupo: (token, id) =>
    request(`/kardex/grupo/${id}`, { token }),

  subirFotoAlumno: (token, id, file) => {
    const formData = new FormData();
    formData.append('foto', file);

    return request(`/kardex/alumno/${id}/foto`, {
      token,
      method: 'POST',
      body: formData,
      form: true
    });
  },

  deleteFotoAlumno: (token, id) =>
    request(`/kardex/alumno/${id}/foto`, {
      token,
      method: 'DELETE'
    }),

  generarQrAlumno: (token, id) =>
    request(`/kardex/alumno/${id}/qr`, {
      token,
      method: 'POST'
    }),

  generarQrGrupo: (token, id) =>
    request(`/kardex/grupo/${id}/qr`, {
      token,
      method: 'POST'
    }),

  chatbot: (token, mensaje) =>
    request('/chatbot/mensaje', {
      token,
      method: 'POST',
      body: { mensaje }
    }),

  chatbotMensaje: (token, mensaje) =>
    request('/chatbot/mensaje', {
      token,
      method: 'POST',
      body: { mensaje }
    }),

  chatbotLimpiar: (token) =>
    request('/chatbot/limpiar', {
      token,
      method: 'POST'
    }),

  chatbotMetricas: (token) =>
    request('/chatbot/metricas', { token }),

  chatbotAuditoria: (token, params = '') =>
    request(`/chatbot/auditoria${params}`, { token }),

  chatbotConfiguracion: (token) =>
    request('/chatbot/configuracion', { token }),

  chatbotActualizarConfig: (token, clave, valor) =>
    request('/chatbot/configuracion', {
      token,
      method: 'PUT',
      body: { clave, valor }
    }),

  chatbotIncidencias: (token, params = '') =>
    request(`/chatbot/incidencias${params}`, { token }),

  chatbotCrearIncidencia: (token, body) =>
    request('/chatbot/incidencias', {
      token,
      method: 'POST',
      body
    }),

  chatbotActualizarIncidencia: (token, id, body) =>
    request(`/chatbot/incidencias/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  chatbotConversaciones: (token, params = '') =>
    request(`/chatbot/conversaciones${params}`, { token }),

  chatbotExportar: (token, tipo = 'conversaciones', params = '') =>
    request(`/chatbot/exportar?tipo=${tipo}${params}`, { token }),

  asistente: {
    contexto: (token) =>
      request('/asistente/contexto', { token }),

    mensaje: (token, body) =>
      request('/asistente/mensaje', {
        token,
        method: 'POST',
        body
      }),

    limpiar: (token) =>
      request('/asistente/limpiar', {
        token,
        method: 'POST'
      }),

    adminStats: (token) =>
      request('/asistente/admin/stats', { token }),

    adminAudit: (token, limit) =>
      request('/asistente/admin/auditoria', {
        token,
        params: { limit }
      }),

    adminUsers: (token) =>
      request('/asistente/admin/usuarios', { token }),

    adminConfig: (token) =>
      request('/asistente/admin/config', { token }),

    coordDashboard: (token) =>
      request('/asistente/coordinador/dashboard', { token }),

    coordGroups: (token, params) =>
      request('/asistente/coordinador/grupos', { token, params }),

    coordPeriods: (token) =>
      request('/asistente/coordinador/periodos', { token }),

    coordTracking: (token, params) =>
      request('/asistente/coordinador/seguimiento', { token, params }),

    coordAlerts: (token, params) =>
      request('/asistente/coordinador/alertas', { token, params }),

    coordGroupReport: (token, id_grupo) =>
      request(`/asistente/coordinador/reporte/grupo/${id_grupo}`, { token }),

    docDashboard: (token) =>
      request('/asistente/docente/dashboard', { token }),

    docGroups: (token) =>
      request('/asistente/docente/grupos', { token }),

    docEvaluations: (token) =>
      request('/asistente/docente/evaluaciones', { token }),

    docTracking: (token, params) =>
      request('/asistente/docente/seguimiento', { token, params }),

    docAlerts: (token) =>
      request('/asistente/docente/alertas', { token }),

    docKardex: (token, id_alumno) =>
      request(`/asistente/docente/kardex/${id_alumno}`, { token }),

    alumDashboard: (token) =>
      request('/asistente/alumno/dashboard', { token }),

    alumKardex: (token) =>
      request('/asistente/alumno/kardex', { token }),

    alumInscripciones: (token) =>
      request('/asistente/alumno/inscripciones', { token }),

    alumEvaluaciones: (token) =>
      request('/asistente/alumno/evaluaciones', { token }),

    sopDashboard: (token) =>
      request('/asistente/soporte/dashboard', { token }),

    sopIncidencias: (token) =>
      request('/asistente/soporte/incidencias', { token }),

    sopBitacora: (token, limit) =>
      request('/asistente/soporte/bitacora', { token, params: { limit } }),

    sopSesiones: (token) =>
      request('/asistente/soporte/sesiones', { token }),

    sopResets: (token) =>
      request('/asistente/soporte/resets', { token })
  },

  iaDesercion: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionResumen: (token) =>
    request('/ia/desercion/resumen', { token }),

  iaDesercionAlertas: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/alertas${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionDetalle: (token, id) =>
    request(`/ia/desercion/alertas/${id}`, { token }),

  iaDesercionExportarPdf: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/exportar/pdf${qs ? '?' + qs : ''}`, { token, responseType: 'blob' });
  },

  iaDesercionExportarExcel: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/exportar/excel${qs ? '?' + qs : ''}`, { token, responseType: 'blob' });
  },

  iaDesercionAuditoria: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/auditoria${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionAuditoriaEliminar: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/auditoria${qs ? '?' + qs : ''}`, { token, method: 'DELETE' });
  },

  iaDesercionAuditoriaExportar: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/auditoria/exportar${qs ? '?' + qs : ''}`, { token, responseType: 'blob' });
  },

  iaDesercionAuditoriaRespaldar: (token) =>
    request('/ia/desercion/auditoria/respaldar', { token, responseType: 'blob' }),

  desercion: (token) =>
    request('/ia/desercion', { token }),

  predecirDesercion: (token, body) =>
    request('/ia/desercion/predecir', {
      token,
      method: 'POST',
      body
    }),

  predecirDesercionML: (token, body) =>
    request('/ia/desercion/predecir-ml', {
      token,
      method: 'POST',
      body
    }),

  iaDesercionMLHealth: (token) =>
    request('/ia/desercion/ml-health', { token }),

  seguimientoIA: (token, body) =>
    request('/ia/desercion/seguimiento', {
      token,
      method: 'POST',
      body
    }),

  generarAlertaIA: (token, body) =>
    request('/ia/desercion/generar', {
      token,
      method: 'POST',
      body
    }),

  validarSeguimientoIA: (token, id, body) =>
    request(`/ia/desercion/alertas/${id}/validar`, {
      token,
      method: 'POST',
      body
    }),

  // ===== IA DESERCIÓN DOCENTE =====
  iaDesercionDocenteGrupos: (token) =>
    request('/ia/desercion/docente/mis-grupos', { token }),

  iaDesercionDocenteAlumnosGrupo: (token, idGrupo, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/docente/grupos/${idGrupo}/alumnos${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionDocenteAlertas: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/docente/alertas${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionDocenteDetalle: (token, id) =>
    request(`/ia/desercion/docente/alertas/${id}`, { token }),

  iaDesercionDocenteObservacion: (token, body) =>
    request('/ia/desercion/docente/observaciones', { token, method: 'POST', body }),

  iaDesercionDocenteHistorial: (token, idAlumno) =>
    request(`/ia/desercion/docente/alumnos/${idAlumno}/historial`, { token }),

  iaDesercionDocenteRecomendaciones: (token) =>
    request('/ia/desercion/docente/recomendaciones', { token }),

  // ===== IA DESERCIÓN ALUMNO =====
  iaDesercionAlumnoMiRiesgo: (token) =>
    request('/ia/desercion/alumno/mi-riesgo', { token }),

  iaDesercionAlumnoRecomendaciones: (token) =>
    request('/ia/desercion/alumno/recomendaciones', { token }),

  iaDesercionAlumnoHistorial: (token) =>
    request('/ia/desercion/alumno/historial', { token }),

  iaDesercionAlumnoProgreso: (token) =>
    request('/ia/desercion/alumno/progreso', { token }),

  // ===== IA DESERCIÓN SOPORTE =====
  iaDesercionSoporteEstado: (token) =>
    request('/ia/desercion/soporte/estado', { token }),

  iaDesercionSoporteLogs: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/soporte/logs${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionSoporteErrores: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/desercion/soporte/errores${qs ? '?' + qs : ''}`, { token });
  },

  iaDesercionSoporteConectividad: (token) =>
    request('/ia/desercion/soporte/conectividad', { token }),

  iaDesercionSoporteIntegridad: (token) =>
    request('/ia/desercion/soporte/integridad', { token }),

  iaDesercionSoporteVerificar: (token) =>
    request('/ia/desercion/soporte/verificar', { token, method: 'POST' }),

  iaDesercionSoporteRutas: (token) =>
    request('/ia/desercion/soporte/rutas', { token }),

  // ===== DESERCION REPORTE (nuevo módulo) =====
  desercionReportePreview: (token) =>
    request('/ia/desercion/reporte/preview', { token }),

  desercionReportePreviewResumen: (token) =>
    request('/ia/desercion/reporte/preview/resumen', { token }),

  desercionReportePreviewDistribucion: (token) =>
    request('/ia/desercion/reporte/preview/distribucion', { token }),

  desercionReportePreviewAlertas: (token) =>
    request('/ia/desercion/reporte/preview/alertas', { token }),

  desercionReporteDashboard: (token) =>
    request('/ia/desercion/reporte/dashboard', { token }),

  desercionReportePdf: (token) =>
    request('/ia/desercion/reporte/pdf', { token, responseType: 'blob' }),

  desercionReporteExcel: (token) =>
    request('/ia/desercion/reporte/excel', { token, responseType: 'blob' }),

  iaBecasCatalogos: (token) =>
    request('/ia/becas/catalogos', { token }),

  iaBecasResumen: (token) =>
    request('/ia/becas/resumen', { token }),

  iaBecasAlertas: (token) =>
    request('/ia/becas/alertas', { token }),

  iaBecasPreguntar: (token, body) =>
    request('/ia/becas/preguntar', {
      token,
      method: 'POST',
      body
    }),

  iaBecasElegibilidad: (token, body) =>
    request('/ia/becas/elegibilidad', {
      token,
      method: 'POST',
      body
    }),

  iaBecasPromedio: (token, body = {}) =>
    request('/ia/becas/promedio', {
      token,
      method: 'POST',
      body
    }),

  iaBecasIngestar: (token, body) =>
    request('/ia/becas/ingestar', {
      token,
      method: 'POST',
      body
    }),

  // === IA de Becas - ADMIN ===
  iaBecasAdminMetricas: (token) =>
    request('/ia/becas/admin/metricas', { token }),

  iaBecasAdminIndicadores: (token) =>
    request('/ia/becas/admin/indicadores', { token }),

  iaBecasAdminSolicitudes: (token, params = {}) =>
    request('/ia/becas/admin/solicitudes', { token, params }),

  iaBecasAdminSolicitud: (token, id) =>
    request(`/ia/becas/admin/solicitudes/${id}`, { token }),

  iaBecasAdminActualizarEstatus: (token, id, body) =>
    request(`/ia/becas/admin/solicitudes/${id}/estatus`, {
      token,
      method: 'PUT',
      body
    }),

  iaBecasAdminDictamenes: (token, params = {}) =>
    request('/ia/becas/admin/dictamenes', { token, params }),

  iaBecasAdminCrearDictamen: (token, body) =>
    request('/ia/becas/admin/dictamenes', {
      token,
      method: 'POST',
      body
    }),

  iaBecasAdminHistorial: (token, params = {}) =>
    request('/ia/becas/admin/historial', { token, params }),

  iaBecasAdminConvocatorias: (token, params = {}) =>
    request('/ia/becas/admin/convocatorias', { token, params }),

  iaBecasAdminCrearConvocatoria: (token, body) =>
    request('/ia/becas/admin/convocatorias', {
      token,
      method: 'POST',
      body
    }),

  iaBecasAdminActualizarConvocatoria: (token, id, body) =>
    request(`/ia/becas/admin/convocatorias/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  iaBecasAdminExportaciones: (token, params = {}) =>
    request('/ia/becas/admin/exportaciones', { token, params }),

  iaBecasAdminExportar: (token, body) =>
    request('/ia/becas/admin/exportar', {
      token,
      method: 'POST',
      body
    }),

  iaBecasAdminAuditoria: (token, params = {}) =>
    request('/ia/becas/admin/auditoria', { token, params }),

  iaBecasAdminValidarCriterios: (token, body) =>
    request('/ia/becas/admin/validar-criterios', {
      token,
      method: 'POST',
      body
    }),

  // === IA de Becas - COORDINADOR ===
  iaBecasCoordBandeja: (token, params = {}) =>
    request('/ia/becas/coordinador/bandeja', { token, params }),

  iaBecasCoordSolicitud: (token, id) =>
    request(`/ia/becas/coordinador/solicitudes/${id}`, { token }),

  iaBecasCoordCandidatos: (token, params = {}) =>
    request('/ia/becas/coordinador/candidatos', { token, params }),

  iaBecasCoordElegibilidad: (token, id) =>
    request(`/ia/becas/coordinador/elegibilidad/${id}`, { token }),

  iaBecasCoordObservaciones: (token, params = {}) =>
    request('/ia/becas/coordinador/observaciones', { token, params }),

  iaBecasCoordCrearObservacion: (token, body) =>
    request('/ia/becas/coordinador/observaciones', {
      token, method: 'POST', body
    }),

  iaBecasCoordCanalizar: (token, body) =>
    request('/ia/becas/coordinador/canalizar', {
      token, method: 'POST', body
    }),

  iaBecasCoordDictamenPreliminar: (token, body) =>
    request('/ia/becas/coordinador/dictamen-preliminar', {
      token, method: 'POST', body
    }),

  iaBecasCoordSeguimiento: (token, params = {}) =>
    request('/ia/becas/coordinador/seguimiento', { token, params }),

  iaBecasCoordAsignar: (token, id) =>
    request(`/ia/becas/coordinador/solicitudes/${id}/asignar`, {
      token, method: 'PUT'
    }),

  iaBecasCoordPrioridad: (token, id, body) =>
    request(`/ia/becas/coordinador/solicitudes/${id}/prioridad`, {
      token, method: 'PUT', body
    }),

  // === IA de Becas - ALUMNO ===
  iaBecasAlumnoPerfil: (token) =>
    request('/ia/becas/alumno/mi-perfil', { token }),

  iaBecasAlumnoElegibilidad: (token) =>
    request('/ia/becas/alumno/mi-elegibilidad', { token }),

  iaBecasAlumnoSolicitudes: (token) =>
    request('/ia/becas/alumno/mis-solicitudes', { token }),

  iaBecasAlumnoSolicitar: (token, body) =>
    request('/ia/becas/alumno/solicitar', {
      token, method: 'POST', body
    }),

  iaBecasAlumnoNotificaciones: (token) =>
    request('/ia/becas/alumno/mis-notificaciones', { token }),

  iaBecasAlumnoConvocatorias: (token) =>
    request('/ia/becas/alumno/convocatorias-activas', { token }),

  iaBecasAlumnoSeguimiento: (token, id) =>
    request(`/ia/becas/alumno/seguimiento/${id}`, { token }),

  iaBecasAlumnoRecomendaciones: (token) =>
    request('/ia/becas/alumno/recomendaciones', { token }),

  // === IA de Becas - DOCENTE ===
  iaBecasDocenteAlumnosSugeridos: (token, params = {}) =>
    request('/ia/becas/docente-becas/mis-alumnos-sugeridos', { token, params }),

  iaBecasDocenteAlertasAcademicas: (token, params = {}) =>
    request('/ia/becas/docente-becas/alertas-academicas', { token, params }),

  iaBecasDocenteCrearObservacion: (token, body) =>
    request('/ia/becas/docente-becas/observaciones', { token, method: 'POST', body }),

  iaBecasDocenteObservaciones: (token, idSolicitud) =>
    request(`/ia/becas/docente-becas/observaciones/${idSolicitud}`, { token }),

  iaBecasDocenteCanalizar: (token, body) =>
    request('/ia/becas/docente-becas/canalizar', { token, method: 'POST', body }),

  iaBecasDocenteSeguimiento: (token, params = {}) =>
    request('/ia/becas/docente-becas/seguimiento', { token, params }),

  iaBecasDocenteDetalleAlumno: (token, idAlumno) =>
    request(`/ia/becas/docente-becas/alumno/${idAlumno}/detalle`, { token }),

  // === IA de Becas - SOPORTE ===
  iaBecasSoporteEstado: (token) =>
    request('/ia/becas/soporte-becas/estado', { token }),

  iaBecasSoporteLogs: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/becas/soporte-becas/logs${qs ? '?' + qs : ''}`, { token });
  },

  iaBecasSoporteErrores: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/becas/soporte-becas/errores${qs ? '?' + qs : ''}`, { token });
  },

  iaBecasSoporteConectividad: (token) =>
    request('/ia/becas/soporte-becas/conectividad', { token }),

  iaBecasSoporteIntegridad: (token) =>
    request('/ia/becas/soporte-becas/integridad', { token }),

  iaBecasSoporteExportaciones: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/ia/becas/soporte-becas/exportaciones${qs ? '?' + qs : ''}`, { token });
  },

  iaBecasSoporteVerificar: (token) =>
    request('/ia/becas/soporte-becas/verificar', { token, method: 'POST' }),

  iaBecasSoporteRutas: (token) =>
    request('/ia/becas/soporte-becas/rutas', { token }),

  iaBienestarCatalogos: (token) =>
    request('/ia/bienestar/catalogos', { token }),

  iaBienestarResumen: (token) =>
    request('/ia/bienestar/resumen', { token }),

  iaBienestarHistorial: (token, query = '') =>
    request(`/ia/bienestar/historial${query}`, { token }),

  iaBienestarCheckin: (token, body) =>
    request('/ia/bienestar/checkin', {
      token,
      method: 'POST',
      body
    }),

  iaBienestarChat: (token, body) =>
    request('/ia/bienestar/chat', {
      token,
      method: 'POST',
      body
    }),

  iaBienestarPredecirML: (token, body) =>
    request('/ia/bienestar/predecir-ml', {
      token,
      method: 'POST',
      body
    }),

  // ===== IA BIENESTAR DOCENTE =====
iaBienestarDocenteGrupos: (token) =>
  request('/ia/bienestar/docente-bienestar/mis-grupos', { token }),

iaBienestarDocenteAlumnosGrupo: (token, idGrupo, params = {}) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request(`/ia/bienestar/docente-bienestar/grupos/${idGrupo}/alumnos${qs ? '?' + qs : ''}`, { token });
},

iaBienestarDocenteAlertas: (token, params = {}) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request(`/ia/bienestar/docente-bienestar/alertas${qs ? '?' + qs : ''}`, { token });
},

iaBienestarDocenteDetalleAlumno: (token, idAlumno) =>
  request(`/ia/bienestar/docente-bienestar/alumnos/${idAlumno}/detalle`, { token }),

iaBienestarDocenteObservacion: (token, body) =>
  request('/ia/bienestar/docente-bienestar/observaciones', { token, method: 'POST', body }),

iaBienestarDocenteHistorial: (token, idAlumno) =>
  request(`/ia/bienestar/docente-bienestar/alumnos/${idAlumno}/historial`, { token }),

iaBienestarDocenteRecomendaciones: (token) =>
  request('/ia/bienestar/docente-bienestar/recomendaciones', { token }),

// ===== IA BIENESTAR ALUMNO =====
iaBienestarEstadoAcompanamiento: (token) =>
  request('/ia/bienestar/estado-acompanamiento', { token }),

iaBienestarProgreso: (token) =>
  request('/ia/bienestar/progreso', { token }),

iaBienestarHistorialApoyo: (token) =>
  request('/ia/bienestar/historial-apoyo', { token }),

iaBienestarMensajesOrientacion: (token) =>
  request('/ia/bienestar/mensajes-orientacion', { token }),

iaBienestarRecomendacionesAlumno: (token) =>
  request('/ia/bienestar/recomendaciones-alumno', { token }),

// ===== IA BIENESTAR SOPORTE =====
iaBienestarSoporteEstado: (token) =>
  request('/ia/bienestar/soporte-bienestar/estado', { token }),

iaBienestarSoporteBitacora: (token, params = {}) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request(`/ia/bienestar/soporte-bienestar/bitacora${qs ? '?' + qs : ''}`, { token });
},

iaBienestarSoporteErrores: (token, params = {}) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request(`/ia/bienestar/soporte-bienestar/errores${qs ? '?' + qs : ''}`, { token });
},

iaBienestarSoporteConectividad: (token) =>
  request('/ia/bienestar/soporte-bienestar/conectividad', { token }),

iaBienestarSoporteIntegridad: (token) =>
  request('/ia/bienestar/soporte-bienestar/integridad', { token }),

iaBienestarSoporteExportar: (token, params = {}) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request(`/ia/bienestar/soporte-bienestar/exportar${qs ? '?' + qs : ''}`, { token });
},

iaBienestarSoporteSalud: (token) =>
  request('/ia/bienestar/soporte-bienestar/salud', { token, method: 'POST' }),

iaBienestarSoporteRutas: (token) =>
  request('/ia/bienestar/soporte-bienestar/rutas', { token }),

// ===== IA BIENESTAR ADMIN =====
  iaBienestarAdminResumen: (token) =>
    request('/bienestar-admin/resumen', { token }),

  iaBienestarAdminIndicadores: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/bienestar-admin/indicadores${qs ? '?' + qs : ''}`, { token });
  },

  iaBienestarAdminAlertas: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/bienestar-admin/alertas${qs ? '?' + qs : ''}`, { token });
  },

  iaBienestarAdminSeguimientos: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/bienestar-admin/seguimientos${qs ? '?' + qs : ''}`, { token });
  },

  iaBienestarAdminExportarPdf: (token) =>
    request('/bienestar-admin/exportar/pdf', { token, responseType: 'blob' }),

  iaBienestarAdminExportarExcel: (token) =>
    request('/bienestar-admin/exportar/excel', { token, responseType: 'blob' }),

  iaBienestarAdminAuditoria: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/bienestar-admin/auditoria${qs ? '?' + qs : ''}`, { token });
  },

  iaBienestarAdminGruposRiesgo: (token) =>
    request('/bienestar-admin/grupos-riesgo', { token }),

  iaBienestarAdminAlumnosRiesgo: (token, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request(`/bienestar-admin/alumnos-riesgo${qs ? '?' + qs : ''}`, { token });
  },

  iaBienestarAdminDetalleAlumno: (token, id) =>
    request(`/bienestar-admin/alumnos-riesgo/${id}`, { token }),

  iaBienestarAdminCatalogosFiltros: (token) =>
    request('/bienestar-admin/catalogos-filtros', { token }),

  iaBienestarAdminRegistrarSeguimiento: (token, body) =>
    request('/bienestar-admin/registrar-seguimiento', { token, method: 'POST', body }),

  iaBienestarAdminActualizarEstadoAlerta: (token, body) =>
    request('/bienestar-admin/actualizar-estado-alerta', { token, method: 'POST', body }),

  reportPdf: (token, query = '') =>
    download(`/reportes/pdf${query}`, token),

  reportExcel: (token, query = '') =>
    download(`/reportes/excel${query}`, token),

  inscripcionesAdminMetrics: (token) =>
    request('/inscripciones-admin/metrics', { token }),

  inscripcionesAdminList: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-admin/inscripciones${qs ? '?' + qs : ''}`, { token });
  },

  inscripcionesAdminUpdateEstado: (token, id, body) =>
    request(`/inscripciones-admin/inscripciones/${id}/estado`, {
      token,
      method: 'PUT',
      body
    }),

  inscripcionesAdminAuditoria: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-admin/auditoria${qs ? '?' + qs : ''}`, { token });
  },

  inscripcionesAdminExport: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-admin/export${qs ? '?' + qs : ''}`, {
      token,
      timeoutMs: 60000
    });
  },

  inscripcionesAdminCatalogos: (token) =>
    request('/inscripciones-admin/catalogos', { token }),

  // Coordinator Inscripciones endpoints
  coordinadorBandeja: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-coordinador/bandeja${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorValidacionGrupo: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-coordinador/validacion-grupo${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorCupos: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-coordinador/cupos${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorHistorial: (token, idInscripcion) =>
    request(`/inscripciones-coordinador/historial/${idInscripcion}`, { token }),

  coordinadorObservaciones: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/inscripciones-coordinador/observaciones${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorUpdateEstado: (token, id, body) =>
    request(`/inscripciones-coordinador/inscripciones/${id}/estado`, {
      token,
      method: 'PUT',
      body
    }),

  coordinadorAsignarGrupo: (token, id, body) =>
    request(`/inscripciones-coordinador/inscripciones/${id}/grupo`, {
      token,
      method: 'PUT',
      body
    }),

  coordinadorRegistrarObservacion: (token, id, body) =>
    request(`/inscripciones-coordinador/inscripciones/${id}/observaciones`, {
      token,
      method: 'POST',
      body
    }),

  coordinadorActualizarCupo: (token, id, body) =>
    request(`/inscripciones-coordinador/cupos/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  coordinadorCatalogos: (token) =>
    request('/inscripciones-coordinador/catalogos', { token }),

  // Coordinador Reinscripciones endpoints
  coordinadorReinscripcionesBandeja: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/coordinador-reinscripciones/bandeja${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorReinscripcionesValidacionGrupo: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/coordinador-reinscripciones/validacion-grupo${qs ? '?' + qs : ''}`, { token });
  },

  coordinadorReinscripcionesDetalle: (token, idInscripcion) =>
    request(`/coordinador-reinscripciones/detalle/${idInscripcion}`, { token }),

  coordinadorReinscripcionesCatalogos: (token) =>
    request('/coordinador-reinscripciones/catalogos', { token }),

  coordinadorReinscripcionesUpdateEstado: (token, id, body) =>
    request(`/coordinador-reinscripciones/inscripciones/${id}/estado`, {
      token,
      method: 'PUT',
      body
    }),

  coordinadorReinscripcionesAsignarGrupo: (token, id, body) =>
    request(`/coordinador-reinscripciones/inscripciones/${id}/grupo`, {
      token,
      method: 'PUT',
      body
    }),

  coordinadorReinscripcionesRegistrarObservacion: (token, id, body) =>
    request(`/coordinador-reinscripciones/inscripciones/${id}/observaciones`, {
      token,
      method: 'POST',
      body
    }),

  // Alumno Inscripciones endpoints
  alumnoInscripcionesInfo: (token) =>
    request('/inscripciones-alumno/mi-informacion', { token }),

  alumnoSolicitarInscripcion: (token, body) =>
    request('/inscripciones-alumno/solicitar', {
      token,
      method: 'POST',
      body
    }),

  alumnoMiEstatus: (token) =>
    request('/inscripciones-alumno/mi-estatus', { token }),

  alumnoDocumentos: (token) =>
    request('/inscripciones-alumno/documentos', { token }),

  // ---- Alumno Reinscripciones ----
  alumnoReinscripcionesInfo: (token) =>
    request('/alumno-reinscripciones/mi-informacion', { token }),

  alumnoSolicitarReinscripcion: (token, body) =>
    request('/alumno-reinscripciones/solicitar', { token, method: 'POST', body }),

  alumnoReinscripcionesEstatus: (token) =>
    request('/alumno-reinscripciones/mi-estatus', { token }),

  alumnoReinscripcionesHistorial: (token) =>
    request('/alumno-reinscripciones/historial', { token }),

  alumnoReinscripcionesComprobante: (token, id, formato = 'pdf') =>
    request(`/alumno-reinscripciones/comprobante/${id}?formato=${formato}`, {
      token,
      responseType: 'blob',
      timeoutMs: 30000
    }),

  alumnoSubirDocumento: (token, formData) =>
    request('/inscripciones-alumno/documentos/subir', {
      token,
      method: 'POST',
      body: formData,
      form: true,
      timeoutMs: 30000
    }),

  alumnoHistorial: (token) =>
    request('/inscripciones-alumno/historial', { token }),

  alumnoDescargarComprobante: (token, id) =>
    download(`/inscripciones-alumno/comprobante/${id}`, token, 30000),

  // Docente Inscripciones endpoints
  docenteMisGrupos: (token) =>
    request('/inscripciones-docente/mis-grupos', { token }),

  docenteListaAlumnos: (token, idGrupo, idPeriodo) =>
    request(`/inscripciones-docente/grupos/${idGrupo}/periodo/${idPeriodo}/lista-alumnos`, { token }),

  docenteCambiosInscripcion: (token, idGrupo, idPeriodo) =>
    request(`/inscripciones-docente/grupos/${idGrupo}/periodo/${idPeriodo}/cambios`, { token }),

  docenteCambiosInscripcionGeneral: (token) =>
    request('/inscripciones-docente/cambios', { token }),

  docenteNotificaciones: (token) =>
    request('/inscripciones-docente/notificaciones', { token }),

  docenteMarcarNotificacionLeida: (token, id) =>
    request(`/inscripciones-docente/notificaciones/${id}/leer`, {
      token,
      method: 'PUT'
    }),

  docenteMarcarTodasLeidas: (token) =>
    request('/inscripciones-docente/notificaciones/leer-todas', {
      token,
      method: 'PUT'
    }),

  docenteInconsistencias: (token, idGrupo, idPeriodo) =>
    request(`/inscripciones-docente/grupos/${idGrupo}/periodo/${idPeriodo}/inconsistencias`, { token }),

  docenteInconsistenciasGeneral: (token) =>
    request('/inscripciones-docente/inconsistencias', { token }),

  // ---- Docente Reinscripciones ----
  docenteReinscripcionesGrupos: (token) =>
    request('/docente-reinscripciones/grupos-actualizados', { token }),

  docenteReinscripcionesListaReinscritos: (token, idGrupo, idPeriodo) =>
    request(`/docente-reinscripciones/grupos/${idGrupo}/${idPeriodo}/lista-reinscritos`, { token }),

  docenteReinscripcionesCambios: (token, idGrupo, idPeriodo) =>
    request(`/docente-reinscripciones/grupos/${idGrupo}/${idPeriodo}/cambios`, { token }),

  docenteReinscripcionesCambiosGeneral: (token) =>
    request('/docente-reinscripciones/cambios', { token }),

  docenteReinscripcionesNotificaciones: (token, tipo) =>
    request(`/docente-reinscripciones/notificaciones${tipo ? `?tipo=${tipo}` : ''}`, { token }),

  docenteReinscripcionesMarcarNotificacionLeida: (token, id) =>
    request(`/docente-reinscripciones/notificaciones/${id}/leida`, {
      token,
      method: 'PUT'
    }),

  docenteReinscripcionesMarcarTodasLeidas: (token) =>
    request('/docente-reinscripciones/notificaciones/leer-todas', {
      token,
      method: 'PUT'
    }),

  docenteReinscripcionesResumen: (token) =>
    request('/docente-reinscripciones/resumen-grupos', { token }),

  docenteReinscripcionesCargaAcademica: (token) =>
    request('/docente-reinscripciones/carga-academica', { token }),

  // Soporte Inscripciones endpoints
  soporteInscripcionesPanel: (token) =>
    request('/inscripciones-soporte/panel', { token }),

  soporteInscripcionesIncidencias: (token, params = '') =>
    request(`/inscripciones-soporte/incidencias${params}`, { token }),

  soporteInscripcionesCrearIncidencia: (token, body) =>
    request('/inscripciones-soporte/incidencias', {
      token,
      method: 'POST',
      body
    }),

  soporteInscripcionesActualizarIncidencia: (token, id, body) =>
    request(`/inscripciones-soporte/incidencias/${id}`, {
      token,
      method: 'PUT',
      body
    }),

  soporteInscripcionesErrores: (token, params = '') =>
    request(`/inscripciones-soporte/errores-sistema${params}`, { token }),

  soporteInscripcionesConectividad: (token) =>
    request('/inscripciones-soporte/validacion-conectividad', { token }),

  soporteInscripcionesLogs: (token, params = '') =>
    request(`/inscripciones-soporte/logs${params}`, { token }),

  soporteInscripcionesRegistrarLog: (token, body) =>
    request('/inscripciones-soporte/logs', {
      token,
      method: 'POST',
      body
    }),

  soporteInscripcionesRevisionCarga: (token) =>
    request('/inscripciones-soporte/revision-carga', { token }),

  // ---- Soporte Reinscripciones ----
  soporteReinscripcionesPanel: (token) =>
    request('/soporte-reinscripciones/panel', { token }),

  soporteReinscripcionesIncidencias: (token, params = '') =>
    request(`/soporte-reinscripciones/incidencias${params}`, { token }),

  soporteReinscripcionesCrearIncidencia: (token, body) =>
    request('/soporte-reinscripciones/incidencias', { token, method: 'POST', body }),

  soporteReinscripcionesActualizarIncidencia: (token, id, body) =>
    request(`/soporte-reinscripciones/incidencias/${id}`, { token, method: 'PUT', body }),

  soporteReinscripcionesMonitoreo: (token, params = '') =>
    request(`/soporte-reinscripciones/monitoreo${params}`, { token }),

  soporteReinscripcionesIniciarMonitoreo: (token, body) =>
    request('/soporte-reinscripciones/monitoreo', { token, method: 'POST', body }),

  soporteReinscripcionesActualizarMonitoreo: (token, id, body) =>
    request(`/soporte-reinscripciones/monitoreo/${id}`, { token, method: 'PUT', body }),

  soporteReinscripcionesErrores: (token, params = '') =>
    request(`/soporte-reinscripciones/errores${params}`, { token }),

  soporteReinscripcionesLogs: (token, params = '') =>
    request(`/soporte-reinscripciones/logs${params}`, { token }),

  soporteReinscripcionesRegistrarLog: (token, body) =>
    request('/soporte-reinscripciones/logs', { token, method: 'POST', body }),

  soporteReinscripcionesVerificarIntegridad: (token) =>
    request('/soporte-reinscripciones/verificar-integridad', { token, method: 'POST' }),

  soporteReinscripcionesReintentar: (token, body) =>
    request('/soporte-reinscripciones/reintentar', { token, method: 'POST', body }),

  // Admin Reinscripciones endpoints
  adminReinscripcionesMetrics: (token) =>
    request('/admin-reinscripciones/metrics', { token }),

  adminReinscripcionesList: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/admin-reinscripciones/reinscripciones${qs ? '?' + qs : ''}`, { token });
  },

  adminReinscripcionesIncidencias: (token) =>
    request('/admin-reinscripciones/incidencias', { token }),

  adminReinscripcionesBitacora: (token, params = '') =>
    request(`/admin-reinscripciones/bitacora${params}`, { token }),

  adminReinscripcionesHistorial: (token) =>
    request('/admin-reinscripciones/historial', { token }),

  adminReinscripcionesCatalogos: (token) =>
    request('/admin-reinscripciones/catalogos', { token }),

  adminReinscripcionesExport: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/admin-reinscripciones/export${qs ? '?' + qs : ''}`, {
      token,
      timeoutMs: 60000
    });
  },

  // ---- Admin Kardex ----
  adminKardexGeneral: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/admin-kardex/general${qs ? '?' + qs : ''}`, { token });
  },

  adminKardexIndividual: (token, id) =>
    request(`/admin-kardex/individual/${id}`, { token }),

  adminKardexSubirFoto: (token, id, formData) =>
    request(`/admin-kardex/foto/${id}`, {
      token, method: 'POST', body: formData, form: true, timeoutMs: 30000
    }),
  adminKardexValidarQR: (token, qrToken) =>

    request(`/admin-kardex/qr/validar/${qrToken}`, { token }),

  adminKardexGenerarQR: (token, id) =>
    request(`/admin-kardex/qr/generar/${id}`, { token, method: 'POST' }),

  adminKardexHistorial: (token, id) =>
    request(`/admin-kardex/historial/${id}`, { token }),

  adminKardexAgregarHistorial: (token, body) =>
    request('/admin-kardex/historial', { token, method: 'POST', body }),

  adminKardexLimpiarAuditoria: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/admin-kardex/auditoria${qs ? '?' + qs : ''}`, {
      token, method: 'DELETE', timeoutMs: 30000
    });
  },

  adminKardexAuditoria: (token, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/admin-kardex/auditoria${qs ? '?' + qs : ''}`, { token });
  },

  adminKardexSellos: (token) =>
    request('/admin-kardex/sellos', { token }),

  adminKardexExportPDF: (token, id) =>
    request(`/admin-kardex/export/pdf/${id}`, {
      token, responseType: 'blob', timeoutMs: 30000
    }),

  adminKardexExportExcel: (token, id) =>
    request(`/admin-kardex/export/excel/${id}`, {
      token, responseType: 'blob', timeoutMs: 30000
    }),

  // ---- Kardex Export (HTML/CSS PDF + Excel mejorado) ----
  kardexExportInfo: (token, id) =>
    request(`/reportes/kardex/${id}/info`, { token }),

  kardexExportPDF: (token, id) =>
    request(`/reportes/kardex/${id}/pdf`, {
      token, responseType: 'blob', timeoutMs: 60000
    }),

  kardexExportExcel: (token, id) =>
    request(`/reportes/kardex/${id}/excel`, {
      token, responseType: 'blob', timeoutMs: 60000
    }),

  // ---- Kardex Preview ----
  kardexPreview: (token, id) =>
    request(`/reportes/kardex/${id}/preview`, { token }),

  // ---- Kardex "Me" endpoints (alumno autenticado) ----
  kardexMyPreview: (token) =>
    request('/reportes/kardex/me/preview', { token }),

  kardexMyPDF: (token) =>
    request('/reportes/kardex/me/pdf', {
      token, responseType: 'blob', timeoutMs: 60000
    }),

  kardexMyExcel: (token) =>
    request('/reportes/kardex/me/excel', {
      token, responseType: 'blob', timeoutMs: 60000
    }),

  // ── Coordinador Kardex ──
  kardexCoordinadorCatalogos: (token) =>
    request('/kardex-coordinador/catalogos', { token }),

  kardexCoordinadorGrupo: (token, idGrupo) =>
    request(`/kardex-coordinador/grupo/${idGrupo}`, { token }),

  kardexCoordinadorAlumno: (token, idAlumno) =>
    request(`/kardex-coordinador/alumno/${idAlumno}`, { token }),

  kardexCoordinadorResumenPeriodo: (token, idPeriodo) =>
    request(`/kardex-coordinador/resumen/periodo/${idPeriodo}`, { token }),

  kardexCoordinadorHistorialCarrera: (token, idCarrera) =>
    request(`/kardex-coordinador/historial/carrera/${idCarrera}`, { token }),

  kardexCoordinadorValidarTrayectoria: (token, idAlumno) =>
    request(`/kardex-coordinador/validar/trayectoria/${idAlumno}`, { token }),

  kardexCoordinadorDiagnosticoRezago: (token, params = {}) =>
    request('/kardex-coordinador/diagnostico/rezago', { token, params }),

  kardexCoordinadorDiagnosticoIrregularidades: (token, params = {}) =>
    request('/kardex-coordinador/diagnostico/irregularidades', { token, params }),

  // ── Docente Kardex ──
  kardexDocenteMisGrupos: (token) =>
    request('/kardex-docente/mis-grupos', { token }),

  kardexDocenteGrupo: (token, idGrupo) =>
    request(`/kardex-docente/grupo/${idGrupo}`, { token }),

  kardexDocenteAlumno: (token, idAlumno) =>
    request(`/kardex-docente/alumno/${idAlumno}`, { token }),

  kardexDocenteDesempeno: (token, idAlumno) =>
    request(`/kardex-docente/alumno/${idAlumno}/desempeno`, { token }),

  kardexDocenteHistorial: (token, idAlumno) =>
    request(`/kardex-docente/alumno/${idAlumno}/historial`, { token }),

  // ── Soporte Kardex ──
  soporteKardexDiagnostico: (token) =>
    request('/kardex-soporte/diagnostico', { token }),

  soporteKardexValidarQR: (token, qrToken) =>
    request(`/kardex-soporte/qr/validar/${encodeURIComponent(qrToken)}`, { token }),

  soporteKardexVerificarRutas: (token) =>
    request('/kardex-soporte/verificar-rutas', { token }),

  soporteKardexIncidencias: (token) =>
    request('/kardex-soporte/incidencias', { token }),

  soporteKardexCrearIncidencia: (token, body) =>
    request('/kardex-soporte/incidencias', { token, method: 'POST', body }),

  soporteKardexAtenderIncidencia: (token, id, body) =>
    request(`/kardex-soporte/incidencias/${id}`, { token, method: 'PATCH', body }),

  soporteKardexMonitoreoCarga: (token) =>
    request('/kardex-soporte/monitoreo-carga', { token }),

  soporteKardexVerificarIntegridad: (token) =>
    request('/kardex-soporte/verificar-integridad', { token, method: 'POST' })
};

export { api, canAccessDesercionIA, canAccessDesercionDocenteIA, canAccessDesercionAlumnoIA, canAccessDesercionSoporteIA, canAccessBienestarAdminIA, canAccessBienestarDocenteIA, canAccessBecasSoporteIA };
export default api;
