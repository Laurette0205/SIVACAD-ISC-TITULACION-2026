import React from 'react';
import api from '../services/api';

const AuthContext = React.createContext(null);

const STORAGE_USER = 'sivacad_user';
const STORAGE_TOKEN = 'sivacad_token';
const STORAGE_REFRESH_TOKEN = 'sivacad_refresh_token';

const ROLE_ROUTE_BY_NAME = {
  ADMINISTRADOR: '/app/admin',
  COORDINADOR: '/app/coordinador',
  DOCENTE: '/app/docente',
  ALUMNO: '/app/alumno',
  SOPORTE: '/app/soporte'
};

const ROLE_ROUTE_BY_ID = {
  1: '/app/admin',
  2: '/app/coordinador',
  3: '/app/docente',
  4: '/app/alumno',
  5: '/app/soporte'
};

function safeParseJSON(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeRoleName(value) {
  const role = String(value || '').trim().toUpperCase();

  const aliases = {
    ADMIN: 'ADMINISTRADOR',
    ADMINISTRADOR: 'ADMINISTRADOR',
    COORDINADOR: 'COORDINADOR',
    DOCENTE: 'DOCENTE',
    ALUMNO: 'ALUMNO',
    SOPORTE: 'SOPORTE'
  };

  return aliases[role] || role || null;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function extractUserFromResponse(data) {
  if (!data) return null;

  const u = data.usuario || data.user || data.data || data;

  if (!u || typeof u !== 'object') return null;

  const roleName = normalizeRoleName(
    u.rol_nombre || u.rol || u.role || u.roleName || ''
  );

  const roleId = Number(u.rol_id || u.id_rol || u.roleId || u.role_id || 0);

  if (!roleName && !roleId) return null;

  return {
    id_usuario: Number(u.id_usuario || u.id || u.userId || 0),
    id_alumno: u.id_alumno ? Number(u.id_alumno) : undefined,
    id_docente: u.id_docente ? Number(u.id_docente) : undefined,
    nombres: String(u.nombres || u.nombre || u.firstName || '').trim(),
    apellido_paterno: String(u.apellido_paterno || u.apellidoPaterno || '').trim(),
    apellido_materno: String(u.apellido_materno || u.apellidoMaterno || '').trim(),
    nombre_completo: String(
      u.nombre_completo || u.nombreCompleto || ''
    ).trim() || undefined,
    correo: normalizeEmail(
      u.correo || u.correo_institucional || u.correoInstitucional || u.email || ''
    ),
    rol: roleName,
    rol_nombre: roleName,
    rol_id: roleId,
    matricula: String(u.matricula || '').trim(),
    curp: String(u.curp || '').trim(),
    numero_empleado: String(u.numero_empleado || '').trim(),
    especialidad: String(u.especialidad || '').trim(),
    semestre_actual: Number(u.semestre_actual || u.semestreActual || 1),
    id_carrera: Number(u.id_carrera || u.idCarrera || 1),
    id_plan: Number(u.id_plan || u.idPlan || 1)
  };
}

function buildLoginPayload(credentialsOrCorreo, contrasenaMaybe) {
  if (credentialsOrCorreo && typeof credentialsOrCorreo === 'object' && credentialsOrCorreo.correo) {
    return credentialsOrCorreo;
  }

  return {
    correo: String(credentialsOrCorreo || '').trim(),
    contrasena: String(contrasenaMaybe || '').trim()
  };
}

function buildRegisterPayload(data) {
  if (!data || typeof data !== 'object') return {};

  return {
    nombres: String(data.nombres || '').trim(),
    apellido_paterno: String(data.apellido_paterno || '').trim(),
    apellido_materno: String(data.apellido_materno || '').trim(),
    correo: normalizeEmail(data.correo),
    contrasena: String(data.contrasena || '').trim(),
    rol: String(data.rol || 'alumno').trim().toLowerCase(),
    matricula: String(data.matricula || '').trim() || undefined,
    curp: String(data.curp || '').trim() || undefined,
    numero_empleado: String(data.numero_empleado || '').trim() || undefined,
    especialidad: String(data.especialidad || '').trim() || undefined,
    semestre_actual: Number(data.semestre_actual || data.semestreActual || 1),
    id_carrera: Number(data.id_carrera || data.idCarrera || 1),
    id_plan: Number(data.id_plan || data.idPlan || 1)
  };
}

function normalizeUser(data) {
  if (!data) return null;
  const roleName = normalizeRoleName(data.rol_nombre || data.rol || data.role || '');
  const roleId = Number(data.rol_id || data.id_rol || 0);
  if (!roleName && !roleId) return null;
  return {
    id_usuario: Number(data.id_usuario || data.id || 0),
    id_alumno: data.id_alumno ? Number(data.id_alumno) : undefined,
    id_docente: data.id_docente ? Number(data.id_docente) : undefined,
    nombres: String(data.nombres || data.nombre || '').trim(),
    apellido_paterno: String(data.apellido_paterno || '').trim(),
    apellido_materno: String(data.apellido_materno || '').trim(),
    nombre_completo: String(data.nombre_completo || '').trim() || undefined,
    correo: normalizeEmail(data.correo || ''),
    rol: roleName,
    rol_nombre: roleName,
    rol_id: roleId,
    matricula: String(data.matricula || '').trim(),
    curp: String(data.curp || '').trim(),
    numero_empleado: String(data.numero_empleado || '').trim(),
    especialidad: String(data.especialidad || '').trim(),
    semestre_actual: Number(data.semestre_actual || 1),
    id_carrera: Number(data.id_carrera || 1),
    id_plan: Number(data.id_plan || 1)
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(() =>
    normalizeUser(safeParseJSON(localStorage.getItem(STORAGE_USER), null))
  );

  const [token, setToken] = React.useState(() => {
    const t = localStorage.getItem(STORAGE_TOKEN);
    if (t) return t;
    const u = safeParseJSON(localStorage.getItem(STORAGE_USER), null);
    if (u?.token) {
      localStorage.setItem(STORAGE_TOKEN, u.token);
      return u.token;
    }
    return '';
  });

  const [refreshToken, setRefreshToken] = React.useState(() =>
    localStorage.getItem(STORAGE_REFRESH_TOKEN) || ''
  );

  const [loading, setLoading] = React.useState(true);

  const clearSession = React.useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
    setToken('');
    setRefreshToken('');
  }, []);

  const refreshSession = React.useCallback(async () => {
    const currentRefreshToken = localStorage.getItem(STORAGE_REFRESH_TOKEN);
    if (!currentRefreshToken) {
      clearSession();
      return false;
    }

    try {
      const response = await api.refreshToken(currentRefreshToken);

      if (response?.ok && response?.token) {
        localStorage.setItem(STORAGE_TOKEN, response.token);
        setToken(response.token);

        if (response.refreshToken) {
          localStorage.setItem(STORAGE_REFRESH_TOKEN, response.refreshToken);
          setRefreshToken(response.refreshToken);
        }

        return true;
      }

      clearSession();
      return false;
    } catch (error) {
      console.warn('Error al refrescar sesion:', error);
      clearSession();
      return false;
    }
  }, [clearSession]);

  React.useEffect(() => {
    const handleAuthError = (event) => {
      if (Number(event?.detail?.status || 0) === 401) {
        const message = event?.detail?.message || 'Tu sesion ha expirado. Inicia sesion nuevamente.';
        sessionStorage.setItem('sivacad_auth_error', message);
        clearSession();
      }
    };

    window.addEventListener('sivacad:auth-error', handleAuthError);

    return () => {
      window.removeEventListener('sivacad:auth-error', handleAuthError);
    };
  }, [clearSession]);

  // Auto-refresh timer
  React.useEffect(() => {
    if (!token || !refreshToken) return;

    let timeoutId;

    const scheduleRefresh = () => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresIn = payload.exp * 1000 - Date.now();
        const refreshIn = Math.max(expiresIn - 5 * 60 * 1000, 60000);

        timeoutId = setTimeout(async () => {
          const success = await refreshSession();
          if (success) {
            scheduleRefresh();
          }
        }, refreshIn);
      } catch (_) {
        // If token is malformed, try to refresh immediately
        refreshSession();
      }
    };

    scheduleRefresh();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, refreshToken, refreshSession]);

  React.useEffect(() => {
    const validateSession = async () => {
      try {
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await api.me(token);
        const normalizedUser = extractUserFromResponse(response);

        if (normalizedUser) {
          setUser(normalizedUser);
          localStorage.setItem(STORAGE_USER, JSON.stringify(normalizedUser));
        } else {
          clearSession();
        }
      } catch (error) {
        console.warn('Sesion invalida:', error);

        // Try refresh token before clearing
        if (refreshToken) {
          const success = await refreshSession();
          if (!success) {
            clearSession();
          }
        } else {
          clearSession();
        }
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, [token, clearSession, refreshSession]);

  const login = async (credentialsOrCorreo, contrasenaMaybe) => {
    const payload = buildLoginPayload(credentialsOrCorreo, contrasenaMaybe);

    if (!payload.correo || !payload.contrasena) {
      throw new Error('Correo y contrasena son obligatorios');
    }

    const response = await api.login(payload);
    const normalizedUser = extractUserFromResponse(response);
    const jwtToken = response?.token || '';
    const refresh = response?.refreshToken || '';

    if (!jwtToken) {
      throw new Error('Token no recibido del servidor');
    }

    localStorage.setItem(STORAGE_TOKEN, jwtToken);
    setToken(jwtToken);

    if (refresh) {
      localStorage.setItem(STORAGE_REFRESH_TOKEN, refresh);
      setRefreshToken(refresh);
    }

    if (normalizedUser) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
    }

    return {
      ...response,
      usuario: normalizedUser,
      redirectTo: getHomeRouteByUser(normalizedUser)
    };
  };

  const register = async (data) => {
    const payload = buildRegisterPayload(data);

    if (!payload.nombres) throw new Error('Los nombres son obligatorios');
    if (!payload.apellido_paterno) throw new Error('El apellido paterno es obligatorio');
    if (!payload.apellido_materno) throw new Error('El apellido materno es obligatorio');
    if (!payload.correo) throw new Error('El correo es obligatorio');
    if (!payload.contrasena) throw new Error('La contrasena es obligatoria');

    const response = await api.register(payload);
    const normalizedUser = extractUserFromResponse(response);
    const jwtToken = response?.token || '';
    const refresh = response?.refreshToken || '';

    if (jwtToken) {
      localStorage.setItem(STORAGE_TOKEN, jwtToken);
      setToken(jwtToken);
    }

    if (refresh) {
      localStorage.setItem(STORAGE_REFRESH_TOKEN, refresh);
      setRefreshToken(refresh);
    }

    if (normalizedUser) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
    }

    return {
      ...response,
      usuario: normalizedUser,
      redirectTo: normalizedUser ? getHomeRouteByUser(normalizedUser) : '/login'
    };
  };

  const forgotPassword = async (correo) => {
    const email = normalizeEmail(correo);
    if (!email) throw new Error('El correo es obligatorio');
    return api.forgotPassword({ correo: email });
  };

  const resetPassword = async (tokenValue, contrasena, confirmarContrasena) => {
    const resetToken = String(tokenValue || '').trim();
    const password = String(contrasena || '').trim();
    const confirmPassword = String(confirmarContrasena || contrasena || '').trim();

    if (!resetToken) throw new Error('Token de recuperacion requerido');
    if (!password) throw new Error('La contrasena es obligatoria');
    if (password.length < 8) throw new Error('La contrasena debe tener al menos 8 caracteres');
    if (password !== confirmPassword) throw new Error('Las contrasenas no coinciden');

    return api.resetPassword(resetToken, password);
  };

  const logout = React.useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshMe = React.useCallback(async () => {
    try {
      const t = token || localStorage.getItem(STORAGE_TOKEN);
      if (!t) return;
      const response = await api.me(t);
      const normalizedUser = extractUserFromResponse(response);
      if (normalizedUser) {
        localStorage.setItem(STORAGE_USER, JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      }
    } catch (error) {
      console.warn('Error al refrescar usuario:', error);
    }
  }, [token]);

  const getHomeRouteByUser = React.useCallback((u) => {
    if (!u) return '/login';
    const roleName = normalizeRoleName(u.rol_nombre || u.rol);
    const roleId = Number(u.rol_id || 0);

    if (roleName === 'ALUMNO' || roleId === 4) return '/app/alumno';

    const routeByName = ROLE_ROUTE_BY_NAME[roleName];
    if (routeByName) return routeByName;

    const routeById = ROLE_ROUTE_BY_ID[roleId];
    if (routeById) return routeById;

    return '/app/dashboard';
  }, []);

  const value = React.useMemo(() => ({
    user, token, refreshToken, loading,
    isAuthenticated: Boolean(token && user),
    login, register, forgotPassword, resetPassword,
    logout, refreshMe, refreshSession, setUser, setToken,
    getHomeRouteByUser, clearSession
  }), [user, token, refreshToken, loading, login, register, forgotPassword, resetPassword, logout, refreshMe, refreshSession, setUser, setToken, getHomeRouteByUser, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
}
