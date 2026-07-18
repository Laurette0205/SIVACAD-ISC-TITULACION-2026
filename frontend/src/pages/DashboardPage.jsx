import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Bot,
  FileText,
  BarChart3,
  ChevronRight,
  Loader2
} from 'lucide-react';

const STAT_CARDS = [
  {
    key: 'alumnos',
    icon: Users,
    label: 'Alumnos',
    hint: 'Control académico ISC',
    route: '/app/usuarios'
  },
  {
    key: 'docentes',
    icon: GraduationCap,
    label: 'Docentes',
    hint: 'Asignación institucional',
    route: '/app/usuarios'
  },
  {
    key: 'evaluaciones',
    icon: BookOpen,
    label: 'Evaluaciones',
    hint: 'Activas en el periodo',
    route: null
  },
  {
    key: 'alertas_pendientes',
    icon: AlertTriangle,
    label: 'Alertas pendientes',
    hint: 'Seguimiento institucional',
    route: '/app/ia'
  },
  {
    key: 'riesgo_bajo',
    icon: CheckCircle2,
    label: 'Riesgo bajo',
    hint: 'Alumnos estables',
    route: '/app/ia'
  },
  {
    key: 'riesgo_medio',
    icon: Sparkles,
    label: 'Riesgo medio',
    hint: 'Seguimiento preventivo',
    route: '/app/ia'
  },
  {
    key: 'riesgo_alto',
    icon: AlertTriangle,
    label: 'Riesgo alto',
    hint: 'Atención prioritaria',
    route: '/app/ia'
  },
  {
    key: 'riesgo_critico',
    icon: AlertTriangle,
    label: 'Riesgo crítico',
    hint: 'Intervención urgente',
    route: '/app/ia'
  }
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const userRole = String(user?.rol || user?.rol_nombre || user?.role || '').trim().toUpperCase();
  const evalRoute = userRole === 'ALUMNO' ? '/app/estudiante-evaluaciones'
    : userRole === 'DOCENTE' ? '/app/docente-evaluaciones'
    : userRole === 'SOPORTE' ? '/app/soporte-evaluaciones'
    : '/app/evaluaciones';

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        if (!token) {
          throw new Error('Token no disponible');
        }

        const response = await api.dashboard(token);
        setData(response?.data || null);
      } catch (err) {
        console.error('Error al cargar dashboard:', err);
        setData(null);
        setError(err?.message || 'Error al cargar dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  const fullName = user?.nombres
    ? `${user.nombres} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`
        .replace(/\s+/g, ' ')
        .trim()
    : user?.nombre_completo || user?.nombre || 'Usuario';

  const roleLabel = user?.rol_nombre || user?.rol || 'Usuario';

  const stats = STAT_CARDS.map((item) => ({
    ...item,
    value: data?.[item.key] ?? '—',
    route: item.key === 'evaluaciones' ? evalRoute : item.route
  }));

  const quickActions = [
    { label: 'Inscripciones', icon: ClipboardList, path: '/app/inscripciones' },
    { label: 'Reinscripciones', icon: FileText, path: '/app/reinscripciones' },
    { label: 'Kardex', icon: FileText, path: '/app/kardex' },
    { label: 'Evaluaciones', icon: BookOpen, path: evalRoute },
    { label: 'ChatBot', icon: Bot, path: '/app/chatbot' },
    { label: 'IA de deserción', icon: Sparkles, path: '/app/ia' },
    { label: 'Reportes', icon: BarChart3, path: '/app/reportes' }
  ];

  const iaSummary = [
    {
      label: 'Bajo',
      value: data?.riesgo_bajo ?? 0,
      icon: CheckCircle2,
      route: '/app/ia'
    },
    {
      label: 'Medio',
      value: data?.riesgo_medio ?? 0,
      icon: Sparkles,
      route: '/app/ia'
    },
    {
      label: 'Alto',
      value: data?.riesgo_alto ?? 0,
      icon: AlertTriangle,
      route: '/app/ia'
    },
    {
      label: 'Crítico',
      value: data?.riesgo_critico ?? 0,
      icon: AlertTriangle,
      route: '/app/ia'
    }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel institucional de {roleLabel}
          </div>

          <h1>Bienvenido, {fullName}</h1>

          <p>
            Plataforma exclusiva para Ingeniería en Sistemas Computacionales:
            inscripciones, kardex, evaluaciones, chatbot, IA y reportes.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Periodo activo</small>
            <strong>{data?.periodo_activo || '2026-1'}</strong>
          </div>

          <div className="meta-card">
            <small>Carrera</small>
            <strong>Ingeniería en Sistemas Computacionales</strong>
          </div>
        </div>
      </section>

      {loading && (
        <div
          className="auth-note"
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando información del dashboard...</span>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            onClick={() => navigate(stat.route)}
          />
        ))}
      </div>

      <div className="two-col">
        <SectionCard
          title="Accesos rápidos"
          subtitle="Módulos operativos principales"
        >
          <div className="quick-grid">
            {quickActions.map(({ label, icon: Icon, path }) => (
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
                    <span>Acceso rápido</span>
                  </div>
                </div>

                <ChevronRight size={16} className="muted" />
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="IA de deserción"
          subtitle="Panorama de riesgo académico en tiempo real"
        >
          <div className="status-list">
            {iaSummary.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`status ${item.label === 'Crítico' ? 'warn' : 'ok'}`}
                  onClick={() => navigate(item.route)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <Icon size={18} />
                  <span>
                    <strong style={{ display: 'block' }}>
                      Riesgo {item.label}
                    </strong>
                    {item.value} alumnos detectados
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="two-col">
        <SectionCard
          title="Estado institucional"
          subtitle="Control y seguimiento académico"
        >
          <div className="status-list">
            <div className="status ok">
              <CheckCircle2 size={18} />
              Inscripción y kardex activos
            </div>

            <div className="status warn">
              <AlertTriangle size={18} />
              Seguimiento de riesgo académico
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Resumen de riesgo"
          subtitle="Clasificación general de alumnos detectados por IA"
        >
          <div className="list">
            <div className="list-item">
              <strong>Riesgo bajo</strong>
              <span>{data?.riesgo_bajo ?? 0} alumnos</span>
            </div>

            <div className="list-item">
              <strong>Riesgo medio</strong>
              <span>{data?.riesgo_medio ?? 0} alumnos</span>
            </div>

            <div className="list-item">
              <strong>Riesgo alto</strong>
              <span>{data?.riesgo_alto ?? 0} alumnos</span>
            </div>

            <div className="list-item">
              <strong>Riesgo crítico</strong>
              <span>{data?.riesgo_critico ?? 0} alumnos</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}