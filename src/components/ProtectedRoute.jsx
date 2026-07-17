import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function userHasAccess(user, allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!user) return false;

  const roleName = normalizeRoleName(user.rol_nombre || user.rol || user.role);
  const roleId = Number(user.rol_id || user.id_rol || 0);

  return allowedRoles.some((role) => {
    if (typeof role === 'number') return role === roleId;
    return normalizeRoleName(role) === roleName;
  });
}

/**
 * Protege rutas privadas verificando:
 * 1) Sesión cargando
 * 2) Usuario autenticado
 * 3) Permisos por rol, si se envían allowedRoles
 */
export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, getHomeRouteByUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-center">
        Cargando sesión...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!userHasAccess(user, allowedRoles)) {
    return (
      <Navigate
        to={getHomeRouteByUser(user)}
        replace
      />
    );
  }

  return children;
}