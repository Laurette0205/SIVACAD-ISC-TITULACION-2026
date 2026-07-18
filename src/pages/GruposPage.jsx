import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import {
  ArrowLeft,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Loader2,
  Layers3,
  CalendarDays,
  MapPin,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  ChevronRight
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.grupos)) return payload.grupos;
  return [];
}

function pickGroupName(row) {
  return (
    row?.nombre_grupo ||
    row?.grupo ||
    row?.grupo_nombre ||
    row?.clave_grupo ||
    `Grupo ${row?.id_grupo || '—'}`
  );
}

function pickStatus(row) {
  return row?.estado || row?.estatus || row?.situacion || 'SIN ESTADO';
}

function pickTurn(row) {
  return row?.turno || row?.turno_escolar || row?.jornada || 'Sin turno';
}

function pickSemester(row) {
  return row?.semestre || row?.semestre_actual || row?.grado || '—';
}

function pickPeriod(row) {
  return row?.nombre_periodo || row?.periodo || row?.periodo_nombre || '—';
}

function pickCareer(row) {
  return row?.nombre_carrera || row?.carrera || row?.carrera_nombre || '—';
}

export default function GruposPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');
  const [turnFilter, setTurnFilter] = React.useState('TODOS');

  const [form, setForm] = React.useState({
    id_periodo: '',
    id_carrera: '',
    nombre_grupo: '',
    semestre: '',
    turno: 'Matutino',
    estado: 'Abierto'
  });

  const loadGrupos = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      if (typeof api.grupos !== 'function') {
        throw new Error('El servicio api.grupos aún no está definido');
      }

      const response = await api.grupos(token);
      setRows(safeList(response));
    } catch (err) {
      console.error('Error al cargar grupos:', err);
      setRows([]);
      setError(err?.message || 'No fue posible cargar el panel de grupos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadGrupos();
  }, [loadGrupos]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);

    return rows.filter((row) => {
      const status = normalize(pickStatus(row));
      const turn = normalize(pickTurn(row));

      if (statusFilter !== 'TODOS' && status !== normalize(statusFilter)) {
        return false;
      }

      if (turnFilter !== 'TODOS' && turn !== normalize(turnFilter)) {
        return false;
      }

      if (!term) return true;

      const blob = normalize(
        [
          row?.id_grupo,
          row?.nombre_grupo,
          row?.grupo,
          row?.grupo_nombre,
          row?.clave_grupo,
          row?.id_periodo,
          row?.nombre_periodo,
          row?.id_carrera,
          row?.nombre_carrera,
          row?.semestre,
          row?.turno,
          row?.estado,
          row?.estatus
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query, statusFilter, turnFilter]);

  const summary = React.useMemo(() => {
    const total = rows.length;

    const abiertos = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('ABIER');
    }).length;

    const cerrados = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('CERR');
    }).length;

    const cancelados = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('CANCEL');
    }).length;

    const turnos = new Set(rows.map((row) => normalize(pickTurn(row)))).size;

    const periodos = new Set(rows.map((row) => String(pickPeriod(row)))).size;

    return { total, abiertos, cerrados, cancelados, turnos, periodos };
  }, [rows]);

  const bySemester = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickSemester(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          abiertos: 0,
          cerrados: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(pickStatus(row));
      if (status.includes('ABIER')) item.abiertos += 1;
      if (status.includes('CERR')) item.cerrados += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      const aNum = Number(a.name);
      const bNum = Number(b.name);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return b.total - a.total;
    });
  }, [rows]);

  const byTurn = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickTurn(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0
        });
      }

      map.get(key).total += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const statusOptions = ['TODOS', 'Abierto', 'Cerrado', 'Cancelado'];
  const turnOptions = ['TODOS', 'Matutino', 'Vespertino', 'Discontinuo'];

  const stats = [
    {
      icon: Layers3,
      label: 'Total grupos',
      value: summary.total,
      hint: 'Secciones registradas'
    },
    {
      icon: UserCheck,
      label: 'Abiertos',
      value: summary.abiertos,
      hint: 'Operativos'
    },
    {
      icon: UserX,
      label: 'Cerrados',
      value: summary.cerrados,
      hint: 'Finalizados'
    },
    {
      icon: Sparkles,
      label: 'Cancelados',
      value: summary.cancelados,
      hint: 'No operativos'
    },
    {
      icon: CalendarDays,
      label: 'Periodos',
      value: summary.periodos,
      hint: 'Concentración académica'
    },
    {
      icon: MapPin,
      label: 'Turnos',
      value: summary.turnos,
      hint: 'Distribución institucional'
    }
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      if (typeof api.crearGrupo !== 'function') {
        throw new Error('El servicio api.crearGrupo aún no está definido');
      }

      await api.crearGrupo(token, {
        id_periodo: Number(form.id_periodo),
        id_carrera: Number(form.id_carrera),
        nombre_grupo: form.nombre_grupo.trim(),
        semestre: Number(form.semestre),
        turno: form.turno,
        estado: form.estado
      });

      setMessage('Grupo creado correctamente.');
      setForm({
        id_periodo: '',
        id_carrera: '',
        nombre_grupo: '',
        semestre: '',
        turno: 'Matutino',
        estado: 'Abierto'
      });

      await loadGrupos();
    } catch (err) {
      console.error('Error al crear grupo:', err);
      setError(err?.message || 'No fue posible crear el grupo');
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de grupos • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>Grupos académicos</h1>

          <p>
            Administración de grupos por periodo, carrera, semestre, turno y estatus dentro de SIVACAD.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Entidad</small>
            <strong>Ingeniería en Sistemas Computacionales</strong>
          </div>

          <div className="meta-card">
            <small>Enfoque</small>
            <strong>Control de secciones y asignación</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Acciones del panel"
        subtitle="Consulta, filtro, recarga y creación de grupos"
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
              onClick={loadGrupos}
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
              <span>Buscar grupo, periodo, carrera o semestre</span>
              <div className="row gap">
                <Search size={18} className="muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej. A, 2026-1, ISC, 1, abierto..."
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

          <div className="grid-two">
            <div className="field">
              <span>Turno</span>
              <select
                value={turnFilter}
                onChange={(e) => setTurnFilter(e.target.value)}
              >
                {turnOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'TODOS' ? 'Todos' : opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span>Resumen del panel</span>
              <div className="alert info" style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={16} />
                Vista institucional de grupos por periodo y carrera
              </div>
            </div>
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} />
              <span>Cargando grupos...</span>
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
          title="Distribución por semestre"
          subtitle="Cantidad de grupos por nivel académico"
        >
          <div className="list">
            {bySemester.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              bySemester.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>Semestre {item.name}</strong>
                  <span>
                    Total: {item.total} • Abiertos: {item.abiertos} • Cerrados: {item.cerrados}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Distribución por turno"
          subtitle="Concentración institucional de horarios"
        >
          <div className="list">
            {byTurn.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byTurn.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>Total: {item.total}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="two-col">
        <SectionCard
          title="Detalle resumido"
          subtitle="Vista rápida de grupos visibles"
        >
          <div className="list">
            {visibleRows.length === 0 ? (
              <div className="empty">No hay registros filtrados.</div>
            ) : (
              visibleRows.map((row, index) => (
                <div key={row.id_grupo || `${index}`} className="list-item">
                  <strong>{pickGroupName(row)}</strong>
                  <span>
                    Periodo: {pickPeriod(row)} • Carrera: {pickCareer(row)} • Semestre: {pickSemester(row)} • Turno: {pickTurn(row)} • Estado: {pickStatus(row)}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Crear grupo"
          subtitle="Alta institucional de nueva sección académica"
        >
          <form className="form-stack" onSubmit={handleCreate}>
            <div className="grid-two">
              <FormField label="ID Periodo">
                <input
                  value={form.id_periodo}
                  onChange={(e) => setForm({ ...form, id_periodo: e.target.value })}
                  placeholder="1"
                />
              </FormField>

              <FormField label="ID Carrera">
                <input
                  value={form.id_carrera}
                  onChange={(e) => setForm({ ...form, id_carrera: e.target.value })}
                  placeholder="1"
                />
              </FormField>
            </div>

            <FormField label="Nombre del grupo">
              <input
                value={form.nombre_grupo}
                onChange={(e) => setForm({ ...form, nombre_grupo: e.target.value })}
                placeholder="Ej. A"
              />
            </FormField>

            <div className="grid-two">
              <FormField label="Semestre">
                <input
                  type="number"
                  min="1"
                  value={form.semestre}
                  onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                  placeholder="1"
                />
              </FormField>

              <FormField label="Turno">
                <select
                  value={form.turno}
                  onChange={(e) => setForm({ ...form, turno: e.target.value })}
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                  <option value="Discontinuo">Discontinuo</option>
                </select>
              </FormField>
            </div>

            <FormField label="Estado">
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Cerrado">Cerrado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </FormField>

            <button className="btn primary" type="submit">
              <PlusCircle size={16} />
              Crear grupo
            </button>

            <div className="alert info">
              <ShieldCheck size={16} /> El grupo debe quedar asociado a un periodo y una carrera válidos para alimentar inscripciones, kardex y evaluaciones.
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="Observación institucional"
        subtitle="Control, trazabilidad y operación académica"
      >
        <div className="status-list">
          <div className="status ok">
            <Layers3 size={18} />
            Grupos estructurados para la operación por semestre
          </div>

          <div className="status warn">
            <ChevronRight size={18} />
            Los cambios de estatus deben validarse antes de cerrar un grupo
          </div>
        </div>
      </SectionCard>
    </div>
  );
}