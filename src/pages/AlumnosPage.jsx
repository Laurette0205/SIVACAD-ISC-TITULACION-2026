import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import {
  ArrowLeft,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  BarChart3,
  GraduationCap,
  RefreshCw,
  Search
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function getSafeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.alumnos)) return payload.alumnos;
  return [];
}

function pickName(row) {
  const full =
    row?.nombre_completo ||
    row?.nombre ||
    `${row?.nombres || ''} ${row?.apellido_paterno || ''} ${row?.apellido_materno || ''}`;
  return String(full).replace(/\s+/g, ' ').trim() || 'Sin nombre';
}

function pickGroup(row) {
  return (
    row?.nombre_grupo ||
    row?.grupo ||
    row?.grupo_nombre ||
    row?.id_grupo ||
    'Sin grupo'
  );
}

function pickStatus(row) {
  return (
    row?.estatus_academico ||
    row?.estado ||
    row?.estatus ||
    row?.situacion ||
    'Sin estatus'
  );
}

export default function AlumnosPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');

  const loadAlumnos = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      const response = await api.alumnos(token);
      const list = getSafeList(response);
      setRows(list);
    } catch (err) {
      console.error('Error al cargar alumnos:', err);
      setRows([]);
      setError(
        err?.message ||
          'No fue posible cargar el panel de alumnos'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadAlumnos();
  }, [loadAlumnos]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);
    if (!term) return rows;

    return rows.filter((row) => {
      const blob = normalize(
        [
          row?.id_alumno,
          row?.matricula,
          row?.nombre_completo,
          row?.nombre,
          row?.nombres,
          row?.apellido_paterno,
          row?.apellido_materno,
          row?.nombre_grupo,
          row?.grupo,
          row?.estatus_academico,
          row?.estado
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query]);

  const summary = React.useMemo(() => {
    const total = rows.length;

    const reinscritos = rows.filter((row) => {
      const tipo = normalize(row?.tipo_inscripcion || row?.tipo || row?.inscripcion_tipo);
      return (
        tipo.includes('REINSCRIP') ||
        tipo.includes('REINSCRITO')
      );
    }).length;

    const inscritos = rows.filter((row) => {
      const tipo = normalize(row?.tipo_inscripcion || row?.tipo || row?.inscripcion_tipo);
      return tipo.includes('PRIMER') || tipo.includes('INSCRIP');
    }).length;

    const bajas = rows.filter((row) => {
      const status = normalize(row?.estatus_academico || row?.estatus || row?.estado);
      return status.includes('BAJA');
    }).length;

    const desercion = rows.filter((row) => {
      const risk = normalize(row?.nivel_riesgo || row?.riesgo || row?.alerta);
      return risk === 'ALTO' || risk === 'CRÍTICO' || risk === 'CRITICO';
    }).length;

    return { total, reinscritos, inscritos, bajas, desercion };
  }, [rows]);

  const groupBreakdown = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickGroup(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          reinscritos: 0,
          bajas: 0,
          riesgo: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const tipo = normalize(row?.tipo_inscripcion || row?.tipo || row?.inscripcion_tipo);
      if (tipo.includes('REINSCRIP')) item.reinscritos += 1;

      const status = normalize(row?.estatus_academico || row?.estatus || row?.estado);
      if (status.includes('BAJA')) item.bajas += 1;

      const risk = normalize(row?.nivel_riesgo || row?.riesgo || row?.alerta);
      if (risk === 'ALTO' || risk === 'CRÍTICO' || risk === 'CRITICO') item.riesgo += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const stats = [
    {
      icon: Users,
      label: 'Total alumnos',
      value: summary.total,
      hint: 'Registro global en el sistema'
    },
    {
      icon: UserCheck,
      label: 'Inscritos',
      value: summary.inscritos,
      hint: 'Primera vez y altas vigentes'
    },
    {
      icon: RefreshCw,
      label: 'Reinscritos',
      value: summary.reinscritos,
      hint: 'Movimiento académico del periodo'
    },
    {
      icon: UserX,
      label: 'Bajas',
      value: summary.bajas,
      hint: 'Temporales o definitivas'
    },
    {
      icon: AlertTriangle,
      label: 'Riesgo IA',
      value: summary.desercion,
      hint: 'Alertas de deserción'
    },
    {
      icon: BarChart3,
      label: 'Grupos',
      value: groupBreakdown.length,
      hint: 'Distribución por grupo'
    }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de alumnos • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>Alumnos</h1>

          <p>
            Este panel concentra el control académico de alumnos por grupo,
            inscripción, reinscripción, bajas y riesgo de deserción.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Periodo activo</small>
            <strong>2026-1</strong>
          </div>

          <div className="meta-card">
            <small>Carrera</small>
            <strong>Ingeniería en Sistemas Computacionales</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Acciones del panel"
        subtitle="Consulta, filtro y actualización del listado"
        right={
          <div className="row gap wrap">
            <button type="button" className="btn secondary" onClick={() => navigate('/app/dashboard')}>
              <ArrowLeft size={16} />
              Volver al dashboard
            </button>
            <button type="button" className="btn secondary" onClick={loadAlumnos}>
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
        }
      >
        <div className="form-stack">
          <div className="field">
            <span>Buscar alumno, matrícula, grupo o estatus</span>
            <div className="row gap">
              <Search size={18} className="muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. 202613598, 1A, baja, reinscrito..."
              />
            </div>
          </div>

          {loading && (
            <div className="alert info">Cargando alumnos...</div>
          )}

          {error && (
            <div className="alert error">{error}</div>
          )}
        </div>
      </SectionCard>

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="two-col">
        <SectionCard
          title="Distribución por grupo"
          subtitle="Cantidad de alumnos, reinscritos, bajas y riesgo por grupo"
        >
          <div className="list">
            {groupBreakdown.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              groupBreakdown.map((group) => (
                <div key={group.name} className="list-item">
                  <strong>{group.name}</strong>
                  <span>
                    Total: {group.total} • Reinscritos: {group.reinscritos} • Bajas: {group.bajas} • Riesgo IA: {group.riesgo}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Detalle académico"
          subtitle="Listado resumido de alumnos visibles"
        >
          <div className="list">
            {visibleRows.length === 0 ? (
              <div className="empty">No hay registros filtrados.</div>
            ) : (
              visibleRows.map((row) => (
                <div key={row.id_alumno || row.matricula || crypto.randomUUID?.() || Math.random()} className="list-item">
                  <strong>{pickName(row)}</strong>
                  <span>
                    Matrícula: {row?.matricula || '—'} • Grupo: {pickGroup(row)} • Estatus: {pickStatus(row)}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}