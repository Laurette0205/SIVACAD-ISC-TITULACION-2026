import React from 'react';
import api from '../services/api';

const AuthContext = React.createContext(null);

const STORAGE_USER = 'sivacad_user';
const STORAGE_TOKEN = 'sivacad_token';

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

function normalizeUser(rawUser) {
  if (!rawUser) return null;

  const nombres = String(rawUser.nombres || rawUser.nombre || '').trim();
  const apellidoPaterno = String(
    rawUser.apellido_paterno || rawUser.apellidoPaterno || ''
  ).trim();
  const apellidoMaterno = String(
    rawUser.apellido_materno || rawUser.apellidoMaterno || ''
  ).trim();

  const roleName = normalizeRoleName(
    rawUser.rol_nombre || rawUser.rol || rawUser.role || rawUser.nombre_rol
  );

  const roleId = Number(rawUser.rol_id || rawUser.id_rol || 0);

  const nombreCompleto =
    String(rawUser.nombre_completo || '').trim() ||
    `${nombres} ${apellidoPaterno} ${apellidoMaterno}`
      .replace(/\s+/g, ' ')
      .trim();

  const correoInstitucional = normalizeEmail(
    rawUser.correo_institucional || rawUser.correo || rawUser.email
  );

  const idUsuario = Number(
    rawUser.id_usuario || rawUser.id || rawUser.user_id || 0
  );

  const idAlumno = Number(
    rawUser.id_alumno || rawUser.alumno_id || rawUser.student_id || 0
  );

  const matricula = String(rawUser.matricula || '').trim();

  return {
    ...rawUser,
    id_usuario: idUsuario || null,
    id_alumno: idAlumno || null,
    nombres,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    nombre_completo: nombreCompleto || String(rawUser.nombre || '').trim() || 'Usuario',
    correo_institucional: correoInstitucional,
    correo: correoInstitucional,
    matricula,
    rol_id: roleId || null,
    rol_nombre: roleName,
    rol: roleName,
    role: roleName
  };
}

function getHomeRouteByUser(user) {
  if (!user) return '/login';

  if (user.rol_id && ROLE_ROUTE_BY_ID[user.rol_id]) {
    return ROLE_ROUTE_BY_ID[user.rol_id];
  }

  const roleName =
    normalizeRoleName(user.rol_nombre) ||
    normalizeRoleName(user.rol) ||
    normalizeRoleName(user.role);

  return ROLE_ROUTE_BY_NAME[roleName] || '/app';
}

function extractUserFromResponse(response) {
  const candidate =
    response?.usuario ||
    response?.user ||
    response?.data?.usuario ||
    response?.data?.user ||
    response?.data ||
    response?.resultado?.usuario ||
    response?.resultado?.user ||
    response?.resultado ||
    null;

  return normalizeUser(candidate);
}

function buildLoginPayload(credentialsOrCorreo, contrasenaMaybe) {
  if (
    typeof credentialsOrCorreo === 'object' &&
    credentialsOrCorreo !== null
  ) {
    return {
      correo: normalizeEmail(
        credentialsOrCorreo.correo ||
          credentialsOrCorreo.correo_institucional ||
          credentialsOrCorreo.email
      ),
      contrasena: String(
        credentialsOrCorreo.contrasena ||
          credentialsOrCorreo.password ||
          ''
      )
    };
  }

  return {
    correo: normalizeEmail(credentialsOrCorreo),
    contrasena: String(contrasenaMaybe || '')
  };
}

function buildRegisterPayload(data = {}) {
  const nombres = String(data.nombres || data.nombre || '').trim();
  const apellidoPaterno = String(
    data.apellido_paterno || data.apellidoPaterno || ''
  ).trim();
  const apellidoMaterno = String(
    data.apellido_materno || data.apellidoMaterno || ''
  ).trim();
  const correo = normalizeEmail(
    data.correo || data.correo_institucional || data.email
  );
  const contrasena = String(data.contrasena || data.password || '').trim();
  const rol = normalizeRoleName(data.rol || 'ALUMNO');

  return {
    nombres,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    nombre_completo: `${nombres} ${apellidoPaterno} ${apellidoMaterno}`
      .replace(/\s+/g, ' ')
      .trim(),
    correo,
    correo_institucional: correo,
    contrasena,
    password: contrasena,
    confirmar_contrasena: String(
      data.confirmar_contrasena ||
        data.confirmarContrasena ||
        data.confirm_password ||
        ''
    ).trim(),
    rol: rol ? rol.toLowerCase() : 'alumno',
    matricula: String(data.matricula || '').trim(),
    curp: String(data.curp || '').trim().toUpperCase(),
    clave_docente: String(data.clave_docente || data.claveDocente || '').trim(),
    numero_empleado: String(
      data.numero_empleado || data.numeroEmpleado || ''
    ).trim(),
    especialidad: String(data.especialidad || '').trim(),
    semestre_actual: Number(data.semestre_actual || data.semestreActual || 1),
    id_carrera: Number(data.id_carrera || data.idCarrera || 1),
    id_plan: Number(data.id_plan || data.idPlan || 1)
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

  const [loading, setLoading] = React.useState(true);

  const clearSession = React.useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
    setToken('');
  }, []);

  React.useEffect(() => {
    const handleAuthError = (event) => {
      if (Number(event?.detail?.status || 0) === 401) {
        const message = event?.detail?.message || 'Tu sesi\u00f3n ha expirado. Inicia sesi\u00f3n nuevamente.';
        sessionStorage.setItem('sivacad_auth_error', message);
        clearSession();
      }
    };

    window.addEventListener('sivacad:auth-error', handleAuthError);

    return () => {
      window.removeEventListener('sivacad:auth-error', handleAuthError);
    };
  }, [clearSession]);

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
        console.warn('Sesión inválida:', error);
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, [token, clearSession]);

  const login = async (credentialsOrCorreo, contrasenaMaybe) => {
    const payload = buildLoginPayload(credentialsOrCorreo, contrasenaMaybe);

    if (!payload.correo || !payload.contrasena) {
      throw new Error('Correo y contraseña son obligatorios');
    }

    const response = await api.login(payload);
    const normalizedUser = extractUserFromResponse(response);
    const jwtToken = response?.token || '';

    if (!jwtToken) {
      throw new Error('Token no recibido del servidor');
    }

    localStorage.setItem(STORAGE_TOKEN, jwtToken);
    setToken(jwtToken);

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
    if (!payload.apellido_paterno) {
      throw new Error('El apellido paterno es obligatorio');
    }
    if (!payload.apellido_materno) {
      throw new Error('El apellido materno es obligatorio');
    }
    if (!payload.correo) throw new Error('El correo es obligatorio');
    if (!payload.contrasena) {
      throw new Error('La contraseña es obligatoria');
    }

    const response = await api.register(payload);
    const normalizedUser = extractUserFromResponse(response);
    const jwtToken = response?.token || '';

    if (jwtToken) {
      localStorage.setItem(STORAGE_TOKEN, jwtToken);
      setToken(jwtToken);
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

    if (!email) {
      throw new Error('El correo es obligatorio');
    }

    return api.forgotPassword({ correo: email });
  };

  const resetPassword = async (tokenValue, contrasena, confirmarContrasena) => {
    const resetToken = String(tokenValue || '').trim();
    const password = String(contrasena || '').trim();
    const confirmPassword = String(confirmarContrasena || '').trim();

    if (!resetToken) throw new Error('El token es obligatorio');
    if (!password) throw new Error('La nueva contraseña es obligatoria');
    if (password !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden');
    }

    return api.resetPassword(resetToken, {
      contrasena: password,
      confirmar_contrasena: confirmPassword,
      password
    });
  };

  const logout = () => {
    clearSession();
  };

  const refreshMe = async () => {
    if (!token) return null;

    const response = await api.me(token);
    const normalizedUser = extractUserFromResponse(response);

    if (normalizedUser) {
      setUser(normalizedUser);
      localStorage.setItem(STORAGE_USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    }

    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        refreshMe,
        setUser,
        setToken,
        getHomeRouteByUser,
        clearSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
