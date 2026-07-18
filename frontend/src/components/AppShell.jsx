import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Users,
  HeartPulse,
  Brain,
  Shield,
  AlertTriangle,
  Folders
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { canAccessDesercionIA } from '../services/api';
import SoundToggleButton from '../components/SoundToggleButton';

const ROLE_LABELS = {
  ADMINISTRADOR: 'Administrador',
  COORDINADOR: 'Coordinador',
  DOCENTE: 'Docente',
  ALUMNO: 'Alumno',
  SOPORTE: 'Soporte'
};

const ROLE_HOME_LABEL = {
  ADMINISTRADOR: 'Panel administrativo',
  COORDINADOR: 'Panel de coordinación',
  DOCENTE: 'Panel docente',
  ALUMNO: 'Panel del alumno',
  SOPORTE: 'Panel de soporte'
};

const ROLE_SECTIONS = {
  ADMINISTRADOR: [
    {
      title: 'Inicio',
      items: [
        { to: '/app/admin', label: 'Panel administrativo', icon: LayoutDashboard },
        { to: '/app/asistente/admin', label: 'Asistente académico', icon: Brain }
      ]
    },
    {
      title: 'Gestión académica',
      items: [
        { to: '/app/admin/kardex', label: 'Kardex administrativo', icon: FileText },
        { to: '/app/evaluaciones', label: 'Evaluaciones', icon: BookOpen }
      ]
    },
    {
      title: 'Inteligencia institucional',
      items: [
        { to: '/app/ia', label: 'IA de deserción', icon: Sparkles },
        { to: '/app/ia/bienestar', label: 'IA de Acompañamiento Estudiantil', icon: HeartPulse },
        { to: '/app/bienestar-admin', label: 'Supervisión IA de Acompañamiento', icon: Shield },
        { to: '/app/ia/becas', label: 'IA de becas', icon: Sparkles },
        { to: '/app/ia/becas/admin', label: 'Admin IA de becas', icon: Shield },
        { to: '/app/actas-ocr', label: 'Actas OCR inteligentes', icon: FileText },
        { to: '/app/chatbot', label: 'ChatBot', icon: Bot },
        { to: '/app/reportes', label: 'Reportes', icon: BarChart3 }
      ]
    },
    {
      title: 'Administración',
      items: [
        { to: '/app/usuarios', label: 'Usuarios', icon: Users },
        { to: '/app/admin/tramites', label: 'Trámites', icon: Folders },
        { to: '/app/admin/inscripciones', label: 'Admin Inscripciones', icon: Shield },
        { to: '/app/admin/reinscripciones', label: 'Admin Reinscripciones', icon: ClipboardList }
      ]
    }
  ],
  COORDINADOR: [
    {
      title: 'Inicio',
      items: [
        { to: '/app/coordinador', label: 'Panel de coordinación', icon: LayoutDashboard },
        { to: '/app/asistente/coordinador', label: 'Asistente académico', icon: Brain }
      ]
    },
    {
      title: 'Gestión académica',
      items: [
        { to: '/app/coordinador/tramites', label: 'Trámites', icon: ClipboardList },
        { to: '/app/coordinador/inscripciones', label: 'Inscripciones', icon: Shield },
        { to: '/app/coordinador/reinscripciones', label: 'Reinscripciones', icon: ClipboardCheck },
        { to: '/app/coordinador/kardex', label: 'Kardex', icon: FileText },
        { to: '/app/evaluaciones', label: 'Evaluaciones', icon: BookOpen }
      ]
    },
    {
      title: 'Inteligencia institucional',
      items: [
        { to: '/app/ia', label: 'IA de deserción', icon: Sparkles },
        { to: '/app/ia/bienestar', label: 'IA de Acompañamiento Estudiantil', icon: HeartPulse },
        { to: '/app/bienestar-admin', label: 'Supervisión IA de Acompañamiento', icon: Activity },
        { to: '/app/ia/becas', label: 'IA de becas', icon: Sparkles },
        { to: '/app/ia/becas/coordinador', label: 'Coord. IA de becas', icon: ClipboardCheck },
        { to: '/app/actas-ocr-coordinador', label: 'Actas OCR inteligentes', icon: FileText },
        { to: '/app/chatbot', label: 'ChatBot', icon: Bot },
        { to: '/app/reportes', label: 'Reportes', icon: BarChart3 }
      ]
    },
    {
      title: 'Administración',
      items: [{ to: '/app/usuarios', label: 'Usuarios', icon: Users }]
    }
  ],
  DOCENTE: [
    {
      title: 'Inicio',
      items: [
        { to: '/app/docente', label: 'Panel docente', icon: LayoutDashboard },
        { to: '/app/asistente/docente', label: 'Asistente académico', icon: Brain }
      ]
    },
    {
      title: 'Gestión académica',
      items: [
        { to: '/app/docente/inscripciones', label: 'Inscripciones', icon: ClipboardList },
        { to: '/app/docente/reinscripciones', label: 'Reinscripciones', icon: ClipboardCheck },
        { to: '/app/docente/kardex', label: 'Kardex', icon: FileText },
        { to: '/app/docente/tramites', label: 'Trámites académicos', icon: ClipboardList },
        { to: '/app/docente-evaluaciones', label: 'Evaluaciones', icon: BookOpen }
      ]
    },
    {
      title: 'Inteligencia institucional',
      items: [
        { to: '/app/docente/ia', label: 'IA de deserción', icon: Sparkles },
        { to: '/app/docente/bienestar', label: 'Supervisión IA de Acompañamiento Estudiantil', icon: HeartPulse },
        { to: '/app/ia/becas/docente', label: 'IA de becas', icon: Sparkles },
        { to: '/app/actas-ocr-docente', label: 'Actas OCR inteligentes', icon: FileText },
        { to: '/app/chatbot', label: 'ChatBot', icon: Bot }
      ]
    }
  ],
  ALUMNO: [
    {
      title: 'Inicio',
      items: [
        { to: '/app/alumno', label: 'Panel del alumno', icon: LayoutDashboard },
        { to: '/app/asistente/alumno', label: 'Asistente académico', icon: Brain }
      ]
    },
    {
      title: 'Servicios escolares',
      items: [
        { to: '/app/alumno/inscripciones', label: 'Inscripciones', icon: ClipboardList },
        { to: '/app/alumno/reinscripciones', label: 'Reinscripciones', icon: ClipboardCheck },
        { to: '/app/alumno/tramites', label: 'Trámites', icon: ClipboardList },
        { to: '/app/kardex', label: 'Kardex', icon: FileText },
        { to: '/app/estudiante-evaluaciones', label: 'Evaluaciones', icon: BookOpen }
      ]
    },
    {
      title: 'Inteligencia institucional',
      items: [
        { to: '/app/alumno/ia', label: 'IA de deserción', icon: AlertTriangle },
        { to: '/app/alumno/bienestar', label: 'Supervisión IA de Acompañamiento Estudiantil', icon: HeartPulse },
        { to: '/app/ia/becas/alumno', label: 'IA de becas', icon: Sparkles },
        { to: '/app/actas-ocr-alumno', label: 'Actas OCR inteligentes', icon: FileText },
        { to: '/app/chatbot', label: 'ChatBot', icon: Bot }
      ]
    }
  ],
  SOPORTE: [
    {
      title: 'Inicio',
      items: [
        { to: '/app/soporte', label: 'Panel de soporte', icon: LayoutDashboard },
        { to: '/app/asistente/soporte', label: 'Asistente académico', icon: Brain }
      ]
    },
    {
      title: 'Diagnóstico técnico',
      items: [
        { to: '/app/soporte/inscripciones', label: 'Inscripciones', icon: ClipboardList },
        { to: '/app/soporte/reinscripciones', label: 'Reinscripciones', icon: ClipboardCheck },
        { to: '/app/soporte/kardex', label: 'Kardex', icon: FileText },
        { to: '/app/soporte-evaluaciones', label: 'Evaluaciones', icon: BookOpen }
      ]
    },
    {
      title: 'Inteligencia institucional',
      items: [
        { to: '/app/soporte/ia', label: 'IA de deserción', icon: AlertTriangle },
        { to: '/app/soporte/bienestar', label: 'Supervisión IA de Acompañamiento Estudiantil', icon: HeartPulse },
        { to: '/app/ia/becas/soporte', label: 'IA de becas', icon: Sparkles },
        { to: '/app/actas-ocr-soporte', label: 'Actas OCR inteligentes', icon: FileText },
        { to: '/app/chatbot', label: 'ChatBot', icon: Bot }
      ]
    }
  ]
};

function normalizeRoleName(value) {
  return String(value || '').trim().toUpperCase();
}

function getUserRoleName(user) {
  return normalizeRoleName(user?.rol_nombre || user?.rol || user?.role);
}

function getShellRoleClass(roleName) {
  switch (roleName) {
    case 'ADMINISTRADOR':
      return 'role-admin';
    case 'COORDINADOR':
      return 'role-coordinador';
    case 'DOCENTE':
      return 'role-docente';
    case 'ALUMNO':
      return 'role-alumno';
    case 'SOPORTE':
      return 'role-soporte';
    default:
      return 'role-default';
  }
}

function MenuSection({ title, items, collapsed }) {
  return (
    <div className="nav-section">
      {!collapsed && <div className="nav-section-title">{title}</div>}

      <div className="nav-section-items">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

function IAFeatureCard({ collapsed, onClick }) {
  return (
    <button
      type="button"
      className="auth-note"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: '22px',
        padding: '1rem',
        marginBottom: '0.25rem',
        border: '1px solid rgba(148, 163, 184, 0.14)'
      }}
    >
      <div className="eyebrow">Módulo estratégico</div>

      {!collapsed && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.55rem'
            }}
          >
            <div className="quick-icon" style={{ width: 40, height: 40 }}>
              <ShieldAlert size={18} />
            </div>

            <div>
              <strong style={{ display: 'block' }}>IA de deserción</strong>
              <span className="muted" style={{ fontSize: '0.9rem' }}>
                Riesgo académico, explicación y seguimiento
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              marginTop: '0.75rem'
            }}
          >
            <Activity size={15} />
            <span style={{ fontSize: '0.88rem' }}>Abrir análisis predictivo</span>
          </div>
        </>
      )}
    </button>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const { user, logout, getHomeRouteByUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = React.useState(false);

  const roleName = getUserRoleName(user);
  const roleLabel = ROLE_LABELS[roleName] || 'Usuario';
  const homeLabel = ROLE_HOME_LABEL[roleName] || 'Portal institucional';
  const shellRoleClass = getShellRoleClass(roleName);

  const showIAFeature = canAccessDesercionIA(user);

  const sections = ROLE_SECTIONS[roleName] || [
    {
      title: 'Inicio',
      items: [
        {
          to: getHomeRouteByUser?.(user) || '/app/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard
        }
      ]
    }
  ];

  const initial = (
    user?.nombres ||
    user?.nombre_completo ||
    user?.nombre ||
    'U'
  )
    .charAt(0)
    .toUpperCase();

  return (
    <div className={`shell ${shellRoleClass}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">ISC</div>

          {!collapsed && (
            <div>
              <div className="brand-title">SIVACAD</div>
              <div className="brand-subtitle">
                Ingeniería en Sistemas Computacionales
              </div>
            </div>
          )}

          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="profile-card">
          <div className="avatar">{initial}</div>

          {!collapsed && (
            <div>
              <div className="profile-name">
                {user?.nombre_completo || user?.nombre || 'Usuario'}
              </div>
              <div className="profile-role">{roleLabel}</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="auth-note" style={{ marginBottom: '0.25rem' }}>
            <div className="eyebrow">Acceso actual</div>
            <p style={{ margin: '0.45rem 0 0', lineHeight: 1.65 }}>
              {homeLabel}. El menú muestra únicamente los módulos permitidos
              para tu perfil institucional.
            </p>
          </div>
        )}

        {showIAFeature && (
          <IAFeatureCard
            collapsed={collapsed}
            onClick={() => navigate('/app/ia')}
          />
        )}

        <nav className="nav-list">
          {sections.map((section) => (
            <MenuSection
              key={section.title}
              title={section.title}
              items={section.items}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {showIAFeature && !collapsed && (
          <button
            type="button"
            className="btn secondary w-full"
            onClick={() => navigate('/app/ia/bienestar')}
            style={{ marginTop: '0.25rem' }}
          >
            <HeartPulse size={16} />
            IA de Acompañamiento Estudiantil
          </button>
        )}

        <button
          type="button"
          className="btn secondary w-full mt-auto"
          onClick={logout}
        >
          <LogOut size={16} />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">SIVACAD • ISC</div>
            <h1>Portal institucional</h1>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => navigate('/app/ia/bienestar')}
              title="Abrir IA de Acompañamiento Estudiantil"
            >
              <HeartPulse size={16} />
              IA de Acompañamiento Estudiantil
            </button>

            <SoundToggleButton />

            <button
              type="button"
              className="btn secondary"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={logout}
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}