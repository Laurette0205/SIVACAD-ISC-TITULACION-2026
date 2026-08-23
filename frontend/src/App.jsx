import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

// Contextos globales
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

// Componentes base
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Páginas públicas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Páginas legales
import TerminosPage from './pages/TerminosPage';
import AvisoPrivacidadPage from './pages/AvisoPrivacidadPage';

// Páginas privadas
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const AlumnoPage = React.lazy(() => import('./pages/AlumnoPage'));
const AlumnosPage = React.lazy(() => import('./pages/AlumnosPage'));
const DocentesPage = React.lazy(() => import('./pages/DocentesPage'));
const InscripcionesPage = React.lazy(() => import('./pages/InscripcionesPage'));

const KardexPage = React.lazy(() => import('./pages/KardexPage'));
const EstudianteEvaluacionesPage = React.lazy(() => import('./pages/EstudianteEvaluacionesPage'));
const DocenteEvaluacionesPage = React.lazy(() => import('./pages/DocenteEvaluacionesPage'));
const SoporteEvaluacionesPage = React.lazy(() => import('./pages/SoporteEvaluacionesPage'));
const EvaluacionesPage = React.lazy(() => import('./pages/EvaluacionesPage'));
const PeriodosPage = React.lazy(() => import('./pages/PeriodosPage'));
const GruposPage = React.lazy(() => import('./pages/GruposPage'));
const BajasPage = React.lazy(() => import('./pages/BajasPage'));
const AdminTramitesPage = React.lazy(() => import('./pages/AdminTramitesPage'));
const CoordinadorTramitesPage = React.lazy(() => import('./pages/CoordinadorTramitesPage'));
const DocenteTramitesPage = React.lazy(() => import('./pages/DocenteTramitesPage'));
const AlumnoTramitesPage = React.lazy(() => import('./pages/AlumnoTramitesPage'));
const ChatbotPage = React.lazy(() => import('./pages/ChatbotPage'));
const AsistentePage = React.lazy(() => import('./pages/AsistentePage'));
const AsistenteAdminPage = React.lazy(() => import('./pages/AsistenteAdminPage'));
const AsistenteCoordinadorPage = React.lazy(() => import('./pages/AsistenteCoordinadorPage'));
const AsistenteDocentePage = React.lazy(() => import('./pages/AsistenteDocentePage'));
const AsistenteAlumnoPage = React.lazy(() => import('./pages/AsistenteAlumnoPage'));
const AsistenteSoportePage = React.lazy(() => import('./pages/AsistenteSoportePage'));
const IADesercionPage = React.lazy(() => import('./pages/IADesercionPage'));
const IADesercionDocentePage = React.lazy(() => import('./pages/IADesercionDocentePage'));
const IADesercionAlumnoPage = React.lazy(() => import('./pages/IADesercionAlumnoPage'));
const IADesercionSoportePage = React.lazy(() => import('./pages/IADesercionSoportePage'));
const IABienestarPage = React.lazy(() => import('./pages/IABienestarPage'));
const IABienestarAdminPage = React.lazy(() => import('./pages/IABienestarAdminPage'));
const IABienestarDocentePage = React.lazy(() => import('./pages/IABienestarDocentePage'));
const IABienestarAlumnoPage = React.lazy(() => import('./pages/IABienestarAlumnoPage'));
const IABienestarSoportePage = React.lazy(() => import('./pages/IABienestarSoportePage'));
const IABecasPage = React.lazy(() => import('./pages/IABecasPage'));
const IABecasAdminPage = React.lazy(() => import('./pages/IABecasAdminPage'));
const IABecasCoordinadorPage = React.lazy(() => import('./pages/IABecasCoordinadorPage'));
const IABecasAlumnoPage = React.lazy(() => import('./pages/IABecasAlumnoPage'));
const IABecasDocentePage = React.lazy(() => import('./pages/IABecasDocentePage'));
const IABecasSoportePage = React.lazy(() => import('./pages/IABecasSoportePage'));
const ActasOCRPage = React.lazy(() => import('./pages/ActasOCRPage'));
const ActasOCRCoordinadorPage = React.lazy(() => import('./pages/ActasOCRCoordinadorPage'));
const ActasOCRDocentePage = React.lazy(() => import('./pages/ActasOCRDocentePage'));
const ActasOCRAlumnoPage = React.lazy(() => import('./pages/ActasOCRAlumnoPage'));
const ActasOCRSoportePage = React.lazy(() => import('./pages/ActasOCRSoportePage'));
const ReportesPage = React.lazy(() => import('./pages/ReportesPage'));
const UsuariosPage = React.lazy(() => import('./pages/UsuariosPage'));
const AdminInscripcionesPage = React.lazy(() => import('./pages/AdminInscripcionesPage'));
const CoordinadorInscripcionesPage = React.lazy(() => import('./pages/CoordinadorInscripcionesPage'));
const AlumnoInscripcionesPage = React.lazy(() => import('./pages/AlumnoInscripcionesPage'));
const DocenteInscripcionesPage = React.lazy(() => import('./pages/DocenteInscripcionesPage'));
const DocenteReinscripcionesPage = React.lazy(() => import('./pages/DocenteReinscripcionesPage'));
const DocenteKardexPage = React.lazy(() => import('./pages/DocenteKardexPage'));
const SoporteInscripcionesPage = React.lazy(() => import('./pages/SoporteInscripcionesPage'));
const SoporteReinscripcionesPage = React.lazy(() => import('./pages/SoporteReinscripcionesPage'));
const AdminReinscripcionesPage = React.lazy(() => import('./pages/AdminReinscripcionesPage'));
const CoordinadorReinscripcionesPage = React.lazy(() => import('./pages/CoordinadorReinscripcionesPage'));
const AlumnoReinscripcionesPage = React.lazy(() => import('./pages/AlumnoReinscripcionesPage'));
const AdminKardexPage = React.lazy(() => import('./pages/AdminKardexPage'));
const CoordinadorKardexPage = React.lazy(() => import('./pages/CoordinadorKardexPage'));
const SoporteKardexPage = React.lazy(() => import('./pages/SoporteKardexPage'));
const SoporteTramitesPage = React.lazy(() => import('./pages/SoporteTramitesPage'));

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
    <Suspense fallback={<LoadingSpinner text="Cargando pagina..." />}>
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

      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/aviso-privacidad" element={<AvisoPrivacidadPage />} />

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
          path="soporte/tramites"
          element={
            <ProtectedRoute allowedRoles={[ROLE_NAMES.SOPORTE, 5, ROLE_NAMES.ADMINISTRADOR, 1]}>
              <SoporteTramitesPage />
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
    </Suspense>
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
