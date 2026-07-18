import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.periodos)) return payload.periodos;
  return [];
}

function pickName(row) {
  return row?.nombre_periodo || row?.nombre || row?.periodo || `Periodo ${row?.id_periodo || '—'}`;
}

function pickStatus(row) {
  return row?.estado || row?.estatus || row?.situacion || 'SIN ESTADO';
}

function pickDate(row) {
  return row?.fecha_inicio || row?.inicio || row?.fecha || '—';
}

function pickEndDate(row) {
  return row?.fecha_fin || row?.fin || '—';
}

export default function PeriodosPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');

  const [form, setForm] = React.useState({
    nombre_periodo: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'Planeado'
  });

  const loadPeriodos = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      if (typeof api.periodos !== 'function') {
        throw new Error('El servicio api.periodos aún no está definido');
      }

      const response = await api.periodos(token);
      setRows(safeList(response));
    } catch (err) {
      console.error('Error al cargar periodos:', err);
      setRows([]);
      setError(err?.message || 'No fue posible cargar el panel de periodos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadPeriodos();
  }, [loadPeriodos]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);

    return rows.filter((row) => {
      const status = normalize(pickStatus(row));

      if (statusFilter !== 'TODOS' && status !== normalize(statusFilter)) {
        return false;
      }

      if (!term) return true;

      const blob = normalize(
        [
          row?.id_periodo,
          row?.nombre_periodo,
          row?.fecha_inicio,
          row?.fecha_fin,
          row?.estado,
          row?.estatus,
          row?.situacion
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query, statusFilter]);

  const summary = React.useMemo(() => {
    const total = rows.length;

    const activos = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('ACTIV');
    }).length;

    const planeados = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('PLAN');
    }).length;

    const cerrados = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('CERR');
    }).length;

    const activosSet = new Set(rows.map((row) => String(pickStatus(row)))).size;

    return { total, activos, planeados, cerrados, activosSet };
  }, [rows]);

  const byStatus = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickStatus(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0
        });
      }

      const item = map.get(key);
      item.total += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const statusOptions = ['TODOS', 'Planeado', 'Activo', 'Cerrado'];

  const stats = [
    {
      icon: CalendarRange,
      label: 'Total periodos',
      value: summary.total,
      hint: 'Calendario institucional'
    },
    {
      icon: CheckCircle2,
      label: 'Activos',
      value: summary.activos,
      hint: 'Periodo vigente'
    },
    {
      icon: Clock3,
      label: 'Planeados',
      value: summary.planeados,
      hint: 'Pendientes de inicio'
    },
    {
      icon: Target,
      label: 'Cerrados',
      value: summary.cerrados,
      hint: 'Ciclo concluido'
    },
    {
      icon: TrendingUp,
      label: 'Estatus únicos',
      value: summary.activosSet,
      hint: 'Distribución histórica'
    },
    {
      icon: Sparkles,
      label: 'Vista dinámica',
      value: 'ISC',
      hint: 'Control académico'
    }
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (typeof api.crearPeriodo !== 'function') {
        throw new Error('El servicio api.crearPeriodo aún no está definido');
      }

      await api.crearPeriodo(token, {
        nombre_periodo: form.nombre_periodo.trim(),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        estado: form.estado
      });

      setMessage('Periodo creado correctamente.');
      setForm({
        nombre_periodo: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'Planeado'
      });

      await loadPeriodos();
    } catch (err) {
      console.error('Error al crear periodo:', err);
      setError(err?.message || 'No fue posible crear el periodo');
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de periodos • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>Periodos académicos</h1>

          <p>
            Control institucional de periodos, estados, calendario y seguimiento académico dentro de SIVACAD.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Carrera</small>
            <strong>Ingeniería en Sistemas Computacionales</strong>
          </div>

          <div className="meta-card">
            <small>Enfoque</small>
            <strong>Planeación, activación y cierre</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Acciones del panel"
        subtitle="Consulta, filtro, recarga y creación de periodos"
        right={
          <div className="row gap wrap">
            <button
              type="button"
              className="btn secondary"
              onClick={() => navigate('/app/dashboard')}
            >
              <ArrowLeft size={16} />
              Volver al dashboard
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={loadPeriodos}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
        }
      >
        <div className="form-stack">
          <div className="grid-two">
            <div className="field">
              <span>Buscar periodo o fecha</span>
              <div className="row gap">
                <Search size={18} className="muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej. 2026-1, activo, 2026..."
                />
              </div>
            </div>

            <div className="field">
              <span>Estatus</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'TODOS' ? 'Todos' : opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} />
              <span>Cargando periodos...</span>
            </div>
          )}

          {error && <div className="alert error">{error}</div>}

          {message && <div className="alert success">{message}</div>}
        </div>
      </SectionCard>

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="two-col">
        <SectionCard
          title="Distribución por estatus"
          subtitle="Cantidad de periodos por situación administrativa"
        >
          <div className="list">
            {byStatus.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byStatus.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>Total: {item.total}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Detalle resumido"
          subtitle="Vista rápida de los periodos visibles"
        >
          <div className="list">
            {visibleRows.length === 0 ? (
              <div className="empty">No hay registros filtrados.</div>
            ) : (
              visibleRows.map((row, index) => (
                <div key={row.id_periodo || `${index}`} className="list-item">
                  <strong>{pickName(row)}</strong>
                  <span>
                    {pickDate(row)} • {pickEndDate(row)} • {pickStatus(row)}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="two-col">
        <SectionCard
          title="Crear periodo"
          subtitle="Alta institucional de nuevo periodo académico"
        >
          <form className="form-stack" onSubmit={handleCreate}>
            <FormField label="Nombre del periodo">
              <input
                value={form.nombre_periodo}
                onChange={(e) =>
                  setForm({ ...form, nombre_periodo: e.target.value })
                }
                placeholder="Ej. 2026-2"
              />
            </FormField>

            <div className="grid-two">
              <FormField label="Fecha inicio">
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) =>
                    setForm({ ...form, fecha_inicio: e.target.value })
                  }
                />
              </FormField>

              <FormField label="Fecha fin">
                <input
                  type="date"
                  value={form.fecha_fin}
                  onChange={(e) =>
                    setForm({ ...form, fecha_fin: e.target.value })
                  }
                />
              </FormField>
            </div>

            <FormField label="Estado">
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Planeado">Planeado</option>
                <option value="Activo">Activo</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </FormField>

            <button className="btn primary" type="submit">
              <PlusCircle size={16} />
              Crear periodo
            </button>

            <div className="alert info">
              <ShieldCheck size={16} /> El periodo debe conservar fechas coherentes para activar inscripciones, evaluaciones y kardex.
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Observación institucional"
          subtitle="Control académico y trazabilidad"
        >
          <div className="status-list">
            <div className="status ok">
              <CalendarDays size={18} />
              Planeación y calendario académico centralizados
            </div>

            <div className="status warn">
              <Sparkles size={18} />
              Los periodos activos habilitan módulos operativos del sistema
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}