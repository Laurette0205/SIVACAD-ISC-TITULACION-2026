import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList,
  CalendarRange,
  CheckCircle2,
  Clock3,
  XCircle,
  RefreshCw,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  BadgeInfo,
  ShieldCheck,
  FileText,
  GraduationCap
} from 'lucide-react';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.inscripciones)) return payload.inscripciones;
  return [];
}

function getPeriodLabel(row) {
  return (
    row?.nombre_periodo ||
    row?.periodo ||
    row?.periodo_nombre ||
    row?.id_periodo ||
    'Sin período'
  );
}

function getTypeLabel(row) {
  const raw = normalize(row?.tipo_inscripcion);
  if (raw.includes('PRIMERA')) return 'Primera vez';
  if (raw.includes('REINSCRIP')) return 'Reinscripción';
  return row?.tipo_inscripcion || 'Sin tipo';
}

function getStatusLabel(row) {
  return row?.estado || 'Pendiente';
}

function getStudentLabel(row) {
  return (
    row?.matricula ||
    row?.numero_control ||
    row?.alumno_matricula ||
    `Alumno #${row?.id_alumno || '—'}`
  );
}

function getRoleName(user) {
  return normalize(user?.rol || user?.rol_nombre || user?.role);
}

function getRoleId(user) {
  return Number(user?.rol_id || user?.id_rol || 0);
}

function canManageInscripciones(user) {
  const roleName = getRoleName(user);
  const roleId = getRoleId(user);

  return (
    roleName === 'ADMINISTRADOR' ||
    roleName === 'COORDINADOR' ||
    roleId === 1 ||
    roleId === 2
  );
}

export default function InscripcionesPage() {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();

  const canManage = canManageInscripciones(user);

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');
  const [typeFilter, setTypeFilter] = React.useState('TODOS');

  const [form, setForm] = React.useState({
    id_alumno: '',
    id_periodo: '',
    tipo_inscripcion: 'Primera_Vez',
    observaciones: ''
  });

  const load = React.useCallback(async () => {
    try {
      setError('');
      setMessage('');

      if (!token) {
        throw new Error('Token no disponible');
      }

      setLoading(true);

      const res = await api.inscripciones(token);
      const list = safeArray(res);
      setRows(list);
    } catch (err) {
      console.error('Error al cargar inscripciones:', err);
      setRows([]);
      setError(err?.message || 'No fue posible cargar las inscripciones');
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  React.useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const filteredRows = React.useMemo(() => {
    const term = normalize(query);

    return rows.filter((row) => {
      const status = normalize(getStatusLabel(row));
      const type = normalize(getTypeLabel(row));

      if (statusFilter !== 'TODOS' && status !== normalize(statusFilter)) return false;
      if (typeFilter !== 'TODOS' && type !== normalize(typeFilter)) return false;

      if (!term) return true;

      const blob = normalize(
        [
          row?.id_inscripcion,
          row?.id_alumno,
          row?.matricula,
          row?.numero_control,
          row?.id_periodo,
          getPeriodLabel(row),
          getTypeLabel(row),
          getStatusLabel(row),
          row?.observaciones,
          row?.nombre_completo,
          row?.nombres,
          row?.apellido_paterno,
          row?.apellido_materno
        ]
          .filter(Boolean)
          .join(' ')
      );

      return blob.includes(term);
    });
  }, [rows, query, statusFilter, typeFilter]);

  const summary = React.useMemo(() => {
    const total = rows.length;
    const pendientes = rows.filter((row) => normalize(getStatusLabel(row)).includes('PEND')).length;
    const validadas = rows.filter((row) => normalize(getStatusLabel(row)).includes('VALID')).length;
    const rechazadas = rows.filter((row) => normalize(getStatusLabel(row)).includes('RECH')).length;
    const canceladas = rows.filter((row) => normalize(getStatusLabel(row)).includes('CANC')).length;
    const primeraVez = rows.filter((row) => normalize(getTypeLabel(row)).includes('PRIMERA')).length;
    const reinscripciones = rows.filter((row) => normalize(getTypeLabel(row)).includes('REINSCRIP')).length;
    const periodos = new Set(rows.map((row) => String(getPeriodLabel(row)))).size;

    return {
      total,
      pendientes,
      validadas,
      rechazadas,
      canceladas,
      primeraVez,
      reinscripciones,
      periodos
    };
  }, [rows]);

  const byPeriod = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(getPeriodLabel(row));
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          pendientes: 0,
          validadas: 0,
          rechazadas: 0,
          canceladas: 0
        });
      }

      const item = map.get(key);
      item.total += 1;

      const status = normalize(getStatusLabel(row));
      if (status.includes('PEND')) item.pendientes += 1;
      if (status.includes('VALID')) item.validadas += 1;
      if (status.includes('RECH')) item.rechazadas += 1;
      if (status.includes('CANC')) item.canceladas += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const byType = React.useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = getTypeLabel(row);
      if (!map.has(key)) {
        map.set(key, { name: key, total: 0 });
      }

      const item = map.get(key);
      item.total += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visibleRows = filteredRows.slice(0, 12);

  const stats = [
    {
      icon: ClipboardList,
      label: 'Total inscripciones',
      value: summary.total,
      hint: 'Movimientos registrados'
    },
    {
      icon: Clock3,
      label: 'Pendientes',
      value: summary.pendientes,
      hint: 'Por validar'
    },
    {
      icon: CheckCircle2,
      label: 'Validadas',
      value: summary.validadas,
      hint: 'Confirmadas'
    },
    {
      icon: XCircle,
      label: 'Rechazadas',
      value: summary.rechazadas,
      hint: 'No autorizadas'
    },
    {
      icon: CalendarRange,
      label: 'Períodos',
      value: summary.periodos,
      hint: 'Ciclos con actividad'
    },
    {
      icon: AlertTriangle,
      label: 'Reinscripciones',
      value: summary.reinscripciones,
      hint: 'Seguimiento académico'
    }
  ];

  const statusOptions = ['TODOS', 'Pendiente', 'Validada', 'Rechazada', 'Cancelada'];
  const typeOptions = ['TODOS', 'Primera vez', 'Reinscripción'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!canManage) {
      setError('Tu perfil solo tiene acceso de consulta a este módulo.');
      return;
    }

    try {
      const payload = {
        id_alumno: Number(form.id_alumno),
        id_periodo: Number(form.id_periodo),
        tipo_inscripcion: form.tipo_inscripcion,
        observaciones: String(form.observaciones || '').trim()
      };

      if (!payload.id_alumno) throw new Error('El ID del alumno es obligatorio');
      if (!payload.id_periodo) throw new Error('El ID del período es obligatorio');

      await api.crearInscripcion(token, payload);

      setMessage('Inscripción registrada correctamente');
      setForm({
        id_alumno: '',
        id_periodo: '',
        tipo_inscripcion: 'Primera_Vez',
        observaciones: ''
      });

      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No fue posible registrar la inscripción');
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            Panel de inscripciones • Control académico
          </div>

          <h1>Inscripciones</h1>

          <p>
            Registro, validación y seguimiento de movimientos académicos por período,
            tipo de inscripción, estatus y observaciones institucionales.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Período activo</small>
            <strong>2026-1</strong>
          </div>

          <div className="meta-card">
            <small>Total movimientos</small>
            <strong>{summary.total}</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Acciones del panel"
        subtitle="Alta de inscripción, filtros rápidos y recarga de historial"
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

            {canManage && (
              <button
                type="button"
                className="btn secondary"
                onClick={load}
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            )}
          </div>
        }
      >
        {!canManage ? (
          <div className="form-stack">
            <div className="alert info" style={{ display: 'grid', gap: 10, lineHeight: 1.75 }}>
              <div className="row gap">
                <BadgeInfo size={16} />
                <strong>Consulta informativa para el alumno.</strong>
              </div>

              <div>
                <u><b>Revisa la convocatoria oficial</b></u> publicada por la Jefatura de División antes de realizar cualquier trámite.
                <br />
                <u><b>Prepara la documentación física</b></u> que te solicite Control Escolar para inscripción o reinscripción.
                <br />
                <u><b>Entrega los documentos en físico</b></u> en la Jefatura de División y en Control Escolar.
                <br />
                <u><b>Espera la validación institucional</b></u> y confirma que tu movimiento aparezca como validado antes de continuar.
              </div>

              <div className="status-list">
                <div className="status ok">
                  <ShieldCheck size={18} />
                  El módulo administrativo está restringido para los alumnos. Únicamente tienen acceso el administrador y coordinador de la jefatura de división.
                </div>

                <div className="status warn">
                  <GraduationCap size={18} />
                  El alumno solo consulta instrucciones, estatus y seguimiento de sus movimientos académicos.
                </div>

                <div className="status ok">
                  <FileText size={18} />
                  Mantén a la mano tu matrícula, correo institucional, líneas de captura, comprobantes de pago y documentos oficiales durante el proceso.
                </div>
              </div>
            </div>

            {loading && (
              <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 className="animate-spin" size={18} />
                <span>Cargando historial de inscripciones...</span>
              </div>
            )}

            {error && <div className="alert error">{error}</div>}
            {message && <div className="alert success">{message}</div>}
          </div>
        ) : (
          <div className="form-stack">
            <div className="grid-two">
              <div className="field">
                <span>Buscar por alumno, matrícula, período o estado</span>
                <div className="row gap">
                  <Search size={18} className="muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ej. 2026, validada, 1, pendiente..."
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
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-two">
              <div className="field">
                <span>Tipo</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {typeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span>Nota operativa</span>
                <div className="alert info">
                  <BadgeInfo size={16} /> Las reinscripciones deben validarse desde el flujo académico correspondiente.
                </div>
              </div>
            </div>

            <form className="grid-two" onSubmit={handleSubmit}>
              <FormField label="ID Alumno">
                <input
                  value={form.id_alumno}
                  onChange={(e) => setForm({ ...form, id_alumno: e.target.value })}
                  inputMode="numeric"
                />
              </FormField>

              <FormField label="ID Período">
                <input
                  value={form.id_periodo}
                  onChange={(e) => setForm({ ...form, id_periodo: e.target.value })}
                  inputMode="numeric"
                />
              </FormField>

              <FormField label="Tipo de inscripción">
                <select
                  value={form.tipo_inscripcion}
                  onChange={(e) => setForm({ ...form, tipo_inscripcion: e.target.value })}
                >
                  <option value="Primera_Vez">Primera vez</option>
                  <option value="Reinscripcion">Reinscripción</option>
                </select>
              </FormField>

              <FormField label="Observaciones">
                <input
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Observaciones del movimiento"
                />
              </FormField>

              <div className="full row gap wrap">
                <button className="btn primary" type="submit">
                  Guardar inscripción
                </button>
              </div>
            </form>

            {loading && (
              <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 className="animate-spin" size={18} />
                <span>Cargando historial de inscripciones...</span>
              </div>
            )}

            {error && <div className="alert error">{error}</div>}
            {message && <div className="alert success">{message}</div>}
          </div>
        )}
      </SectionCard>

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="two-col">
        <SectionCard
          title="Desglose por período"
          subtitle="Conteo de movimientos por ciclo escolar y estado"
        >
          <div className="list">
            {byPeriod.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byPeriod.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>
                    Total: {item.total} • Pendientes: {item.pendientes} • Validadas: {item.validadas} • Rechazadas: {item.rechazadas} • Canceladas: {item.canceladas}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Desglose por tipo"
          subtitle="Distribución entre primera vez y reinscripción"
        >
          <div className="list">
            {byType.length === 0 ? (
              <div className="empty">Sin datos para mostrar.</div>
            ) : (
              byType.map((item) => (
                <div key={item.name} className="list-item">
                  <strong>{item.name}</strong>
                  <span>Total: {item.total}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Historial de inscripciones"
        subtitle="Detalle reciente de movimientos académicos"
      >
        <div className="list">
          {visibleRows.length === 0 ? (
            <div className="empty">Sin registros por mostrar.</div>
          ) : (
            visibleRows.map((row, index) => (
              <div key={row.id_inscripcion || `${row.id_alumno}-${index}`} className="list-item">
                <strong>{getStudentLabel(row)}</strong>

                <span>
                  Período: {getPeriodLabel(row)} •
                  Tipo: {getTypeLabel(row)} •
                  Estado: {getStatusLabel(row)} •
                  Observaciones: {row?.observaciones || '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
