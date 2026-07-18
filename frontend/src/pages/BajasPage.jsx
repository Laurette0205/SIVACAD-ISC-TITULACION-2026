import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  TrendingDown,
  GraduationCap,
  ShieldAlert,
  Loader2
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeList(payload) {
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

function pickStatus(row) {
  return row?.estatus_academico || row?.estatus || row?.estado || 'SIN ESTATUS';
}

function pickRisk(row) {
  return row?.nivel_riesgo || row?.riesgo || row?.alerta || 'SIN RIESGO';
}

function pickGroup(row) {
  return row?.nombre_grupo || row?.grupo || row?.grupo_nombre || row?.id_grupo || 'Sin grupo';
}

function pickCareer(row) {
  return row?.nombre_carrera || row?.carrera || row?.carrera_nombre || '—';
}

function hasCareerChange(row) {
  const flag =
    row?.cambio_carrera ||
    row?.cambio_de_carrera ||
    row?.transferido ||
    row?.movimiento_carrera ||
    row?.cambio_programa;

  if (typeof flag === 'boolean') return flag;

  const text = normalize(
    row?.detalle_movimiento ||
      row?.tipo_movimiento ||
      row?.observaciones ||
      row?.movimiento ||
      ''
  );

  return (
    text.includes('CAMBIO DE CARRERA') ||
    text.includes('TRANSFERENCIA') ||
    text.includes('CAMBIO DE PROGRAMA') ||
    text.includes('REUBICACION')
  );
}

export default function BajasPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');
  const [riskFilter, setRiskFilter] = React.useState('TODOS');

  const roleName = normalize(user?.rol_nombre || user?.rol || user?.role);

  React.useEffect(() => {
    if (roleName && roleName !== 'ADMINISTRADOR') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [roleName, navigate]);

  const loadBajas = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      const response = await api.bajas(token);
      setRows(safeList(response));
    } catch (err) {
      console.error('Error al cargar bajas:', err);
      setRows([]);
      setError(err?.message || 'No fue posible cargar el panel de bajas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadBajas();
  }, [loadBajas]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);

    return rows.filter((row) => {
      const status = normalize(pickStatus(row));
      const risk = normalize(pickRisk(row));

      if (statusFilter !== 'TODOS' && status !== normalize(statusFilter)) {
        return false;
      }

      if (riskFilter !== 'TODOS' && risk !== normalize(riskFilter)) {
        return false;
      }

      if (!term) return true;

      const blob = normalize(
        [
          row?.id_alumno,
          row?.id_usuario,
          row?.matricula,
          row?.curp,
          row?.numero_control,
          row?.semestre_actual,
          row?.id_grupo,
          pickName(row),
          pickStatus(row),
          pickRisk(row),
          pickGroup(row),
          pickCareer(row),
          row?.observaciones
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query, statusFilter, riskFilter]);

  const summary = React.useMemo(() => {
    const total = rows.length;

    const vigentes = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('REGULAR') || status.includes('VIGENTE');
    }).length;

    const temporales = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('TEMPORAL');
    }).length;

    const definitivas = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('DEFINIT') || status.includes('BAJA');
    }).length;

    const desercion = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      const risk = normalize(pickRisk(row));
      return (
        status.includes('DESER') ||
        risk === 'ALTO' ||
        risk === 'CRITICO' ||
        risk === 'CRÍTICO'
      );
    }).length;

    const cambiosCarrera = rows.filter((row) => hasCareerChange(row)).length;

    return { total, vigentes, temporales, definitivas, desercion, cambiosCarrera };
  }, [rows]);

  const byGroup = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickGroup(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          vigentes: 0,
          temporales: 0,
          definitivas: 0,
          desercion: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(pickStatus(row));
      const risk = normalize(pickRisk(row));

      if (status.includes('REGULAR') || status.includes('VIGENTE')) item.vigentes += 1;
      if (status.includes('TEMPORAL')) item.temporales += 1;
      if (status.includes('DEFINIT') || status.includes('BAJA')) item.definitivas += 1;
      if (status.includes('DESER') || risk === 'ALTO' || risk === 'CRITICO' || risk === 'CRÍTICO') {
        item.desercion += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const byCareer = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickCareer(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          cambios: 0,
          bajas: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(pickStatus(row));
      if (status.includes('DEFINIT') || status.includes('BAJA')) item.bajas += 1;
      if (hasCareerChange(row)) item.cambios += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const statusOptions = ['TODOS', 'Regular', 'Vigente', 'Baja_Temporal', 'Baja_Definitiva'];
  const riskOptions = ['TODOS', 'Bajo', 'Medio', 'Alto', 'Crítico'];

  const stats = [
    { icon: Users, label: 'Total alumnos', value: summary.total, hint: 'Base institucional' },
    { icon: UserCheck, label: 'Vigentes', value: summary.vigentes, hint: 'Con estatus activo' },
    { icon: UserX, label: 'Bajas temporales', value: summary.temporales, hint: 'Suspensión temporal' },
    { icon: AlertTriangle, label: 'Bajas definitivas', value: summary.definitivas, hint: 'Salida definitiva' },
    { icon: TrendingDown, label: 'Deserción / riesgo', value: summary.desercion, hint: 'Alertas académicas' },
    { icon: GraduationCap, label: 'Cambios de carrera', value: summary.cambiosCarrera, hint: 'Movilidad institucional' }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de bajas • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>Bajas académicas y deserción</h1>

          <p>
            Control institucional de alumnos con baja temporal, baja definitiva,
            riesgo de deserción y cambios de carrera dentro de SIVACAD.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Periodo activo</small>
            <strong>2026-1</strong>
          </div>

          <div className="meta-card">
            <small>Seguimiento</small>
            <strong>Control escolar e IA</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Acciones del panel"
        subtitle="Consulta, filtro y actualización del listado de bajas"
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
              onClick={loadBajas}
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
              <span>Buscar alumno, matrícula, grupo, carrera o estatus</span>
              <div className="row gap">
                <Search size={18} className="muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej. 2026, A, ISC, baja temporal, deserción..."
                />
              </div>
            </div>

            <div className="field">
              <span>Estatus académico</span>
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
              <span>Nivel de riesgo</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                {riskOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'TODOS' ? 'Todos' : opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span>Observación institucional</span>
              <div className="alert info" style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldAlert size={16} />
                La deserción y el riesgo académico pueden derivarse automáticamente desde IA cuando exista el dato en la base.
              </div>
            </div>
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} />
              <span>Cargando bajas y deserción...</span>
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
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
          subtitle="Concentración de bajas y deserción por grupo académico"
        >
          <div className="list">
            {byGroup.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byGroup.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>
                    Total: {item.total} • Vigentes: {item.vigentes} • Temporales: {item.temporales} • Definitivas: {item.definitivas} • Deserción: {item.desercion}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Movilidad por carrera"
          subtitle="Cambios de carrera y salidas por programa"
        >
          <div className="list">
            {byCareer.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byCareer.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>
                    Total: {item.total} • Cambios de carrera: {item.cambios} • Bajas: {item.bajas}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Detalle resumido"
        subtitle="Vista rápida de alumnos filtrados"
      >
        <div className="list">
          {visibleRows.length === 0 ? (
            <div className="empty">No hay registros filtrados.</div>
          ) : (
            visibleRows.map((row, index) => (
              <div key={row.id_alumno || row.id_usuario || `${index}`} className="list-item">
                <strong>{pickName(row)}</strong>
                <span>
                  Matrícula: {row?.matricula || '—'} • Grupo: {pickGroup(row)} • Carrera: {pickCareer(row)} • Estatus: {pickStatus(row)} • Riesgo: {pickRisk(row)}
                </span>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Aviso institucional"
        subtitle="Uso responsable y trazabilidad académica"
      >
        <div className="status-list">
          <div className="status ok">
            <GraduationCap size={18} />
            Seguimiento académico centralizado por Control Escolar
          </div>

          <div className="status warn">
            <AlertTriangle size={18} />
            Las bajas definitivas y deserciones deben validarse con soporte documental
          </div>
        </div>
      </SectionCard>
    </div>
  );
}