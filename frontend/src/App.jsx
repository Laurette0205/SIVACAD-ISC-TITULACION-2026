import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

// Contextos globales
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

// Componentes base
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';

// Páginas públicas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Páginas privadas
import DashboardPage from './pages/DashboardPage';
import AlumnoPage from './pages/AlumnoPage';
import AlumnosPage from './pages/AlumnosPage';
import DocentesPage from './pages/DocentesPage';
import InscripcionesPage from './pages/InscripcionesPage';

import KardexPage from './pages/KardexPage';
import EstudianteEvaluacionesPage from './pages/EstudianteEvaluacionesPage';
import DocenteEvaluacionesPage from './pages/DocenteEvaluacionesPage';
import SoporteEvaluacionesPage from './pages/SoporteEvaluacionesPage';
import EvaluacionesPage from './pages/EvaluacionesPage';
import PeriodosPage from './pages/PeriodosPage';
import GruposPage from './pages/GruposPage';
import BajasPage from './pages/BajasPage';
import AdminTramitesPage from './pages/AdminTramitesPage';
import CoordinadorTramitesPage from './pages/CoordinadorTramitesPage';
import DocenteTramitesPage from './pages/DocenteTramitesPage';
import AlumnoTramitesPage from './pages/AlumnoTramitesPage';
import ChatbotPage from './pages/ChatbotPage';
import AsistentePage from './pages/AsistentePage';
import AsistenteAdminPage from './pages/AsistenteAdminPage';
import AsistenteCoordinadorPage from './pages/AsistenteCoordinadorPage';
import AsistenteDocentePage from './pages/AsistenteDocentePage';
import AsistenteAlumnoPage from './pages/AsistenteAlumnoPage';
import AsistenteSoportePage from './pages/AsistenteSoportePage';
import IADesercionPage from './pages/IADesercionPage';
import IADesercionDocentePage from './pages/IADesercionDocentePage';
import IADesercionAlumnoPage from './pages/IADesercionAlumnoPage';
import IADesercionSoportePage from './pages/IADesercionSoportePage';
import IABienestarPage from './pages/IABienestarPage';
import IABienestarAdminPage from './pages/IABienestarAdminPage';
import IABienestarDocentePage from './pages/IABienestarDocentePage';
import IABienestarAlumnoPage from './pages/IABienestarAlumnoPage';
import IABienestarSoportePage from './pages/IABienestarSoportePage';
import IABecasPage from './pages/IABecasPage';
import IABecasAdminPage from './pages/IABecasAdminPage';
import IABecasCoordinadorPage from './pages/IABecasCoordinadorPage';
import IABecasAlumnoPage from './pages/IABecasAlumnoPage';
import IABecasDocentePage from './pages/IABecasDocentePage';
import IABecasSoportePage from './pages/IABecasSoportePage';
import ActasOCRPage from './pages/ActasOCRPage';
import ActasOCRCoordinadorPage from './pages/ActasOCRCoordinadorPage';
import ActasOCRDocentePage from './pages/ActasOCRDocentePage';
import ActasOCRAlumnoPage from './pages/ActasOCRAlumnoPage';
import ActasOCRSoportePage from './pages/ActasOCRSoportePage';
import ReportesPage from './pages/ReportesPage';
import UsuariosPage from './pages/UsuariosPage';
import AdminInscripcionesPage from './pages/AdminInscripcionesPage';
import CoordinadorInscripcionesPage from './pages/CoordinadorInscripcionesPage';
import AlumnoInscripcionesPage from './pages/AlumnoInscripcionesPage';
import DocenteInscripcionesPage from './pages/DocenteInscripcionesPage';
import DocenteReinscripcionesPage from './pages/DocenteReinscripcionesPage';
import DocenteKardexPage from './pages/DocenteKardexPage';
import SoporteInscripcionesPage from './pages/SoporteInscripcionesPage';
import SoporteReinscripcionesPage from './pages/SoporteReinscripcionesPage';
import AdminReinscripcionesPage from './pages/AdminReinscripcionesPage';
import CoordinadorReinscripcionesPage from './pages/CoordinadorReinscripcionesPage';
import AlumnoReinscripcionesPage from './pages/AlumnoReinscripcionesPage';
import AdminKardexPage from './pages/AdminKardexPage';
import CoordinadorKardexPage from './pages/CoordinadorKardexPage';
import SoporteKardexPage from './pages/SoporteKardexPage';

const ROLE_NAMES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  COORDINADOR: 'COORDINADOR',
  DOCENTE: 'DOCENTE',
  ALUMNO: 'ALUMNO',
  SOPORTE: 'SOPORTE'
};

const ALL_ROLES = [
  ROLE_NAMES.ADMINISTRADOR,
  ROLE_NAMES.COORDINADOR,
  ROLE_NAMES.DOCENTE,
  ROLE_NAMES.ALUMNO,
  ROLE_NAMES.SOPORTE,
  1,
  2,
  3,
  4,
  5
];

const IA_ROLES = [ROLE_NAMES.ADMINISTRADOR, ROLE_NAMES.COORDINADOR, 1, 2];
const IA_DOCENTE_ROLES = [ROLE_NAMES.ADMINISTRADOR, ROLE_NAMES.COORDINADOR, ROLE_NAMES.DOCENTE, 1, 2, 3];
const IA_ALUMNO_ROLES = [ROLE_NAMES.ADMINISTRADOR, ROLE_NAMES.COORDINADOR, ROLE_NAMES.ALUMNO, 1, 2, 4];
const IA_SOPORTE_ROLES = [ROLE_NAMES.ADMINISTRADOR, ROLE_NAMES.SOPORTE, 1, 5];

const ADMIN_COORD_ROLES = [
  ROLE_NAMES.ADMINISTRADOR,
  ROLE_NAMES.COORDINADOR,
  1,
  2
];

const ADMIN_COORD_ALUMNO_ROLES = [
  ROLE_NAMES.ADMINISTRADOR,
  ROLE_NAMES.COORDINADOR,
  ROLE_NAMES.ALUMNO,
  1,
  2,
  4
];

function getUserRoleName(user) {
  return String(user?.rol_nombre || user?.rol || user?.role || '')
    .trim()
    .toUpperCase();
}

function RootRedirect() {
  const { user, getHomeRouteByUser } = useAuth();

  return (
    <Navigate
      to={user ? getHomeRouteByUser(user) : '/login'}
      replace
    />
  );
}

function PublicOnlyRoute({ children }) {
  const { user, getHomeRouteByUser } = useAuth();

  if (user) {
    return <Navigate to={getHomeRouteByUser(user)} replace />;
  }

  return children;
}

function RoleHomeRedirect() {
  const { user, getHomeRouteByUser } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getHomeRouteByUser(user)} replace />;
}

function AppRoutes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('sivacad_theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (user) {
      const roleName = getUserRoleName(user);
      const roleId = Number(user?.rol_id || user?.id_rol || 0);

      const homeRoute =
        roleName === ROLE_NAMES.ALUMNO || roleId === 4
          ? '/app/alumno'
          : '/app/dashboard';

      const currentPath = location.pathname;
      const isAuthRoute =
        currentPath === '/login' ||
        currentPath === '/register' ||
        currentPath === '/forgot-password' ||
        currentPath.startsWith('/reset-password');

      if (isAuthRoute) return;

      const shouldRedirect =
        currentPath === '/' ||
        currentPath === '/app' ||
        currentPath === '/app/' ||
        currentPath === '/app/*';

      if (shouldRedirect) {
        window.history.replaceState(null, '', homeRoute);
      }
    }
  }, [user, location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/reset-password/:token"
        element={
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/app"
        element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHomeRedirect />} />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/inscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <AdminInscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/reinscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <AdminReinscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/kardex"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <AdminKardexPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="coordinador"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="coordinador/inscripciones"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <CoordinadorInscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="coordinador/reinscripciones"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <CoordinadorReinscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="coordinador/kardex"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <CoordinadorKardexPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="coordinador/tramites"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <CoordinadorTramitesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.DOCENTE,
              3,
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente/inscripciones"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.DOCENTE,
              3,
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DocenteInscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente/tramites"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.DOCENTE,
              3,
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DocenteTramitesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente/reinscripciones"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.DOCENTE,
              3,
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DocenteReinscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente/kardex"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.DOCENTE,
              3,
              ROLE_NAMES.COORDINADOR,
              2,
              ROLE_NAMES.ADMINISTRADOR,
              1
            ]}>
              <DocenteKardexPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, 4]}>
              <AlumnoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno/inscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, 4]}>
              <AlumnoInscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno/tramites"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, 4]}>
              <AlumnoTramitesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno/reinscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, 4]}>
              <AlumnoReinscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno/ia"
          element={
            <ProtectedRoute allowedRoles={IA_ALUMNO_ROLES}>
              <IADesercionAlumnoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumno/bienestar"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <IABienestarAlumnoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="actas-ocr-alumno"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, ROLE_NAMES.ADMINISTRADOR, 1, 4]}>
              <ActasOCRAlumnoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte/inscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <SoporteInscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte/reinscripciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <SoporteReinscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte/kardex"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <SoporteKardexPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte/ia"
          element={
            <ProtectedRoute allowedRoles={IA_SOPORTE_ROLES}>
              <IADesercionSoportePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte/bienestar"
          element={
            <ProtectedRoute allowedRoles={IA_SOPORTE_ROLES}>
              <IABienestarSoportePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="actas-ocr-soporte"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <ActasOCRSoportePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alumnos"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              ROLE_NAMES.ALUMNO,
              1,
              2,
              3,
              4
            ]}>
              <AlumnosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docentes"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              1,
              2,
              3
            ]}>
              <DocentesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="periodos"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <PeriodosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="grupos"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <GruposPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="bajas"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <BajasPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="inscripciones"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ALUMNO_ROLES}>
              <InscripcionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="kardex"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              ROLE_NAMES.ALUMNO,
              1,
              2,
              3,
              4
            ]}>
              <KardexPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="evaluaciones"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              ROLE_NAMES.ALUMNO,
              1,
              2,
              3,
              4
            ]}>
              <EvaluacionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="estudiante-evaluaciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ALUMNO, 4]}>
              <EstudianteEvaluacionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente-evaluaciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.DOCENTE, 3]}>
              <DocenteEvaluacionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="soporte-evaluaciones"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5]}>
              <SoporteEvaluacionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="chatbot"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              ROLE_NAMES.ALUMNO,
              ROLE_NAMES.SOPORTE,
              1,
              2,
              3,
              4,
              5
            ]}>
              <ChatbotPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="asistente/admin"
          element={
          <ProtectedRoute allowedRoles={['ADMINISTRADOR']}>
            <AsistenteAdminPage />
            </ProtectedRoute>
            }
        />

        <Route
          path="asistente/coordinador"
          element={
          <ProtectedRoute allowedRoles={['COORDINADOR', 'ADMINISTRADOR']}>
            <AsistenteCoordinadorPage />
            </ProtectedRoute>
            }
        />

        <Route
          path="asistente/docente"
          element={
          <ProtectedRoute allowedRoles={['DOCENTE', 'ADMINISTRADOR']}>
            <AsistenteDocentePage />
            </ProtectedRoute>
            }
        />

        <Route
          path="asistente/alumno"
          element={
          <ProtectedRoute allowedRoles={['ALUMNO', 'ADMINISTRADOR']}>
            <AsistenteAlumnoPage />
            </ProtectedRoute>
            }
        />

        <Route
          path="asistente/soporte"
          element={
          <ProtectedRoute allowedRoles={['SOPORTE', 'ADMINISTRADOR']}>
            <AsistenteSoportePage />
            </ProtectedRoute>
            }
        />

        <Route
          path="asistente"
          element={
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            <AsistentePage />
            </ProtectedRoute>
            }
        />

        <Route
          path="docente/ia"
          element={
            <ProtectedRoute allowedRoles={IA_DOCENTE_ROLES}>
              <IADesercionDocentePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="docente/bienestar"
          element={
            <ProtectedRoute allowedRoles={IA_DOCENTE_ROLES}>
              <IABienestarDocentePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="actas-ocr-docente"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.DOCENTE, ROLE_NAMES.ADMINISTRADOR, 1, 3]}>
              <ActasOCRDocentePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia"
          element={
            <ProtectedRoute allowedRoles={IA_ROLES}>
              <IADesercionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/bienestar"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <IABienestarPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="bienestar-admin"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <IABienestarAdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <IABecasPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas/admin"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <IABecasAdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas/coordinador"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <IABecasCoordinadorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas/alumno"
          element={
            <ProtectedRoute allowedRoles={['ALUMNO']}>
              <IABecasAlumnoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas/docente"
          element={
            <ProtectedRoute allowedRoles={['DOCENTE', 'ADMINISTRADOR', 'COORDINADOR']}>
              <IABecasDocentePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="ia/becas/soporte"
          element={
            <ProtectedRoute allowedRoles={IA_SOPORTE_ROLES}>
              <IABecasSoportePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="actas-ocr"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <ActasOCRPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="actas-ocr-coordinador"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.COORDINADOR, ROLE_NAMES.ADMINISTRADOR, 1, 2]}>
              <ActasOCRCoordinadorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/tramites"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.ADMINISTRADOR, 1]}>
              <AdminTramitesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="reportes"
          element={
            <ProtectedRoute allowedRoles={[
              ROLE_NAMES.ADMINISTRADOR,
              ROLE_NAMES.COORDINADOR,
              ROLE_NAMES.DOCENTE,
              ROLE_NAMES.ALUMNO,
              1,
              2,
              3,
              4
            ]}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="usuarios"
          element={
            <ProtectedRoute allowedRoles={ADMIN_COORD_ROLES}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
