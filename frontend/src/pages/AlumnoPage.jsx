import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import {
  BookOpen,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Users,
  FileText,
  Sparkles
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

export default function AlumnoPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const fullName = user?.nombres
    ? `${user.nombres} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`
        .replace(/\s+/g, ' ')
        .trim()
    : user?.nombre || 'Alumno';

  const roleLabel = normalize(user?.rol || user?.rol_nombre || 'ALUMNO') || 'ALUMNO';

  const loadDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) throw new Error('Token no disponible');

      const response = await api.dashboard(token);
      setData(response?.data || response || null);
    } catch (err) {
      console.error('Error al cargar panel del alumno:', err);
      setData(null);
      setError(err?.message || 'No fue posible cargar el panel del alumno');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = [
    {
      icon: Users,
      label: 'Alumnos',
      value: data?.alumnos ?? '—',
      hint: 'Control académico ISC',
      onClick: () => navigate('/app/alumnos')
    },
    {
      icon: ClipboardList,
      label: 'Inscripciones',
      value: data?.inscripciones ?? '—',
      hint: 'Altas del periodo',
      onClick: () => navigate('/app/inscripciones')
    },
    {
      icon: RefreshCw,
      label: 'Reinscripciones',
      value: data?.reinscripciones ?? '—',
      hint: 'Seguimiento del alumno',
      onClick: () => navigate('/app/reinscripciones')
    },
    {
      icon: FileText,
      label: 'Kardex',
      value: data?.kardex ?? '—',
      hint: 'Historial académico',
      onClick: () => navigate('/app/kardex')
    },
    {
      icon: BookOpen,
      label: 'Evaluaciones',
      value: data?.evaluaciones ?? '—',
      hint: 'Actividades y seguimiento',
      onClick: () => navigate('/app/estudiante-evaluaciones')
    },
    {
      icon: Sparkles,
      label: 'ChatBot',
      value: data?.chatbot ?? '—',
      hint: 'Soporte institucional',
      onClick: () => navigate('/app/chatbot')
    }
  ];

  const quickActions = [
    {
      label: 'Inscripciones',
      icon: ClipboardList,
      path: '/app/inscripciones',
      description: 'Consulta tu proceso de inscripción'
    },
    {
      label: 'Reinscripciones',
      icon: RefreshCw,
      path: '/app/reinscripciones',
      description: 'Revisa tu estatus de reinscripción'
    },
    {
      label: 'Kardex',
      icon: FileText,
      path: '/app/kardex',
      description: 'Abre tu historial académico'
    },
    {
      label: 'Evaluaciones',
      icon: BookOpen,
      path: '/app/estudiante-evaluaciones',
      description: 'Accede a tus evaluaciones'
    },
    {
      label: 'ChatBot',
      icon: MessageSquareText,
      path: '/app/chatbot',
      description: 'Resuelve dudas del sistema'
    },
    {
      label: 'Reportes',
      icon: CalendarRange,
      path: '/app/reportes',
      description: 'Visualiza reportes disponibles'
    }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel institucional de ALUMNO
          </div>

          <h1>Bienvenido, {fullName}</h1>

          <p>
            Plataforma exclusiva para Ingeniería en Sistemas Computacionales.
            Desde aquí puedes consultar tus módulos autorizados, tu progreso y
            los servicios escolares disponibles.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Rol activo</small>
            <strong>{roleLabel}</strong>
          </div>

          <div className="meta-card">
            <small>Periodo activo</small>
            <strong>{data?.periodo_activo || '2026-1'}</strong>
          </div>
        </div>
      </section>

      {loading && (
        <div className="auth-note" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando panel del alumno...</span>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="two-col">
        <SectionCard
          title="Accesos rápidos"
          subtitle="Módulos permitidos para tu perfil"
        >
          <div className="quick-grid">
            {quickActions.map(({ label, icon: Icon, path, description }) => (
              <button
                key={label}
                type="button"
                className="quick-item"
                onClick={() => navigate(path)}
              >
                <div className="quick-left">
                  <div className="quick-icon">
                    <Icon size={18} />
                  </div>

                  <div>
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </div>
                </div>

                <ChevronRight size={16} className="muted" />
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Estado institucional"
          subtitle="Tu acceso y seguimiento académico"
        >
          <div className="status-list">
            <div className="status ok">
              <ShieldCheck size={18} />
              Tu sesión está activa y validada por el sistema
            </div>

            <div className="status warn">
              <GraduationCap size={18} />
              Revisa periódicamente tus evaluaciones, kardex y servicios escolares
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}