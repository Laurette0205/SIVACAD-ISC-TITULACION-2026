import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Briefcase,
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
  if (Array.isArray(payload?.docentes)) return payload.docentes;
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
    row?.estatus ||
    row?.estado ||
    row?.situacion ||
    row?.estatus_academico ||
    'Sin estatus'
  );
}

function pickSpecialty(row) {
  return (
    row?.especialidad ||
    row?.area ||
    row?.materia ||
    row?.departamento ||
    'Sin especialidad'
  );
}

export default function DocentesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');
  const [specialtyFilter, setSpecialtyFilter] = React.useState('TODOS');

  const loadDocentes = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      const response = await api.docentes(token);
      setRows(safeList(response));
    } catch (err) {
      console.error('Error al cargar docentes:', err);
      setRows([]);
      setError(err?.message || 'No fue posible cargar el panel de docentes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadDocentes();
  }, [loadDocentes]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);

    return rows.filter((row) => {
      const status = normalize(pickStatus(row));
      const specialty = normalize(pickSpecialty(row));

      if (statusFilter !== 'TODOS' && status !== normalize(statusFilter)) return false;
      if (specialtyFilter !== 'TODOS' && specialty !== normalize(specialtyFilter)) return false;

      if (!term) return true;

      const blob = normalize(
        [
          row?.id_docente,
          row?.id_usuario,
          row?.numero_empleado,
          row?.clave_docente,
          row?.especialidad,
          row?.correo,
          row?.correo_institucional,
          row?.nombre_grupo,
          row?.grupo,
          row?.estado,
          row?.estatus,
          row?.situacion,
          pickName(row)
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query, statusFilter, specialtyFilter]);

  const summary = React.useMemo(() => {
    const total = rows.length;

    const activos = rows.filter((row) => normalize(pickStatus(row)).includes('ACTIVO')).length;
    const inactivos = rows.filter((row) => {
      const status = normalize(pickStatus(row));
      return status.includes('INACTIVO') || status.includes('BAJA');
    }).length;

    const alertas = rows.filter((row) => {
      const risk = normalize(row?.nivel_riesgo || row?.riesgo || row?.alerta);
      return ['ALTO', 'CRÍTICO', 'CRITICO', 'MEDIO'].includes(risk);
    }).length;

    const grupos = new Set(rows.map((row) => String(pickGroup(row)))).size;

    return { total, activos, inactivos, alertas, grupos };
  }, [rows]);

  const bySpecialty = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickSpecialty(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          activos: 0,
          inactivos: 0,
          alertas: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(pickStatus(row));
      if (status.includes('ACTIVO')) item.activos += 1;
      if (status.includes('INACTIVO') || status.includes('BAJA')) item.inactivos += 1;

      const risk = normalize(row?.nivel_riesgo || row?.riesgo || row?.alerta);
      if (['ALTO', 'CRÍTICO', 'CRITICO', 'MEDIO'].includes(risk)) {
        item.alertas += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const byGroup = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(pickGroup(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          activos: 0,
          inactivos: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(pickStatus(row));
      if (status.includes('ACTIVO')) item.activos += 1;
      if (status.includes('INACTIVO') || status.includes('BAJA')) item.inactivos += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const stats = [
    {
      icon: Users,
      label: 'Total docentes',
      value: summary.total,
      hint: 'Registro institucional'
    },
    {
      icon: UserCheck,
      label: 'Activos',
      value: summary.activos,
      hint: 'Con acceso vigente'
    },
    {
      icon: UserX,
      label: 'Inactivos / baja',
      value: summary.inactivos,
      hint: 'Sin acceso operativo'
    },
    {
      icon: AlertTriangle,
      label: 'Alertas',
      value: summary.alertas,
      hint: 'Seguimiento académico'
    },
    {
      icon: Briefcase,
      label: 'Especialidades',
      value: bySpecialty.length,
      hint: 'Áreas de formación'
    },
    {
      icon: GraduationCap,
      label: 'Grupos vinculados',
      value: summary.grupos,
      hint: 'Concentración por grupo'
    }
  ];

  const statusOptions = ['TODOS', 'ACTIVO', 'INACTIVO', 'BAJA'];
  const specialtyOptions = [
    'TODOS',
    ...Array.from(new Set(rows.map((row) => String(pickSpecialty(row)))))
  ].filter(Boolean);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de docentes • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>Docentes</h1>

          <p>
            Este panel concentra el control del personal docente por grupo,
            especialidad, estatus y alertas institucionales.
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
        subtitle="Consulta, filtro y actualización del listado docente"
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
              onClick={loadDocentes}
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
              <span>Buscar docente, empleado, especialidad o grupo</span>
              <div className="row gap">
                <Search size={18} className="muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej. DOC-2026, Matemáticas, 1A, activo..."
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
              <span>Especialidad</span>
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
              >
                {specialtyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span>Nota operativa</span>
              <div className="alert info">
                <ShieldAlert size={16} /> Seguimiento docente por estatus, grupo y especialidad.
              </div>
            </div>
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} />
              <span>Cargando docentes...</span>
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
          title="Distribución por especialidad"
          subtitle="Cantidad de docentes por área, estatus y alertas"
        >
          <div className="list">
            {bySpecialty.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              bySpecialty.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>
                    Total: {item.total} • Activos: {item.activos} • Inactivos: {item.inactivos} • Alertas: {item.alertas}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Distribución por grupo"
          subtitle="Listado resumido de docentes vinculados a cada grupo"
        >
          <div className="list">
            {byGroup.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byGroup.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>
                    Total: {item.total} • Activos: {item.activos} • Inactivos: {item.inactivos}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Detalle docente"
        subtitle="Listado resumido de docentes visibles"
      >
        <div className="list">
          {visibleRows.length === 0 ? (
            <div className="empty">No hay registros filtrados.</div>
          ) : (
            visibleRows.map((row, index) => (
              <div
                key={row.id_docente || row.id_usuario || row.numero_empleado || `${index}`}
                className="list-item"
              >
                <strong>{pickName(row)}</strong>
                <span>
                  Empleado: {row?.numero_empleado || '—'} •
                  Especialidad: {pickSpecialty(row)} •
                  Grupo: {pickGroup(row)} •
                  Estatus: {pickStatus(row)}
                </span>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Alertas institucionales"
        subtitle="Seguimiento de docentes con riesgo, incidencias o cambios de estatus"
      >
        <div className="status-list">
          <div className="status ok">
            <BookOpen size={18} />
            Docentes activos con seguimiento académico
          </div>

          <div className="status warn">
            <ShieldAlert size={18} />
            Revisar docentes con estatus inactivo, baja o alerta
          </div>
        </div>
      </SectionCard>
    </div>
  );
}