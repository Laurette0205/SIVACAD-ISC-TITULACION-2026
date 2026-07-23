import React from 'react';
import {
  BarChart3,
  ClipboardList,
  Clock3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Download,
  FileText,
  Shield,
  History,
  Settings,
  AlertTriangle,
  Loader2,
  BadgeInfo,
  Filter,
  Eye,
  ArrowUpDown,
  GraduationCap,
  BookOpen,
  Calendar,
  Users,
  Activity,
  Ban
} from 'lucide-react';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return d;
  }
}

function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

const STATUS_COLORS = {
  Pendiente: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  Validada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Rechazada: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  Cancelada: { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280' }
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Pendiente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.15rem 0.55rem', borderRadius: 9999, fontSize: '0.8rem',
      fontWeight: 600, background: s.bg, color: s.text
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  const isPrimera = normalize(type).includes('PRIMERA');
  return (
    <span className={`badge ${isPrimera ? 'light' : 'info'}`} style={{ fontSize: '0.75rem' }}>
      {isPrimera ? 'Primera vez' : 'Reinscripción'}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, hint, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color || 'var(--primary)'}` }}>
      <div className="stat-card-header">
        <div className="stat-icon" style={{ color: color || 'var(--primary)' }}>
          <Icon size={20} />
        </div>
        <div className="stat-value">{value ?? '—'}</div>
      </div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

const TABS = [
  { id: 'panel', label: 'Panel General', icon: BarChart3 },
  { id: 'lista', label: 'Inscripciones', icon: ClipboardList },
  { id: 'auditoria', label: 'Auditoria', icon: History },
  { id: 'catalogos', label: 'Catalogos', icon: Settings },
  { id: 'exportar', label: 'Exportar', icon: Download }
];

export default function AdminInscripcionesPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [metrics, setMetrics] = React.useState(null);
  const [inscripciones, setInscripciones] = React.useState([]);
  const [auditoria, setAuditoria] = React.useState([]);
  const [catalogos, setCatalogos] = React.useState(null);

  const [filters, setFilters] = React.useState({ periodo: '', carrera: '', estado: '', tipo: '', busqueda: '' });
  const [auditFilters, setAuditFilters] = React.useState({ id_inscripcion: '', accion: '' });
  const [exportFilters, setExportFilters] = React.useState({ periodo: '', estado: '', tipo: '', carrera: '', formato: 'json' });

  const [statusForm, setStatusForm] = React.useState({ id: null, estado: 'Validada', observaciones: '' });
  const [showStatusModal, setShowStatusModal] = React.useState(false);

  const loadMetrics = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.inscripcionesAdminMetrics(token);
      setMetrics(res?.data || null);
    } catch (err) {
      console.error('Error metrics:', err);
      setError('Error al cargar metricas');
    }
  }, [token]);

  const loadInscripciones = React.useCallback(async (f = filters) => {
    try {
      setError('');
      const res = await api.inscripcionesAdminList(token, f);
      setInscripciones(safeArray(res));
    } catch (err) {
      console.error('Error inscripciones:', err);
      setError('Error al cargar inscripciones');
    }
  }, [token]);

  const loadAuditoria = React.useCallback(async (f = auditFilters) => {
    try {
      setError('');
      const res = await api.inscripcionesAdminAuditoria(token, f);
      setAuditoria(safeArray(res));
    } catch (err) {
      console.error('Error auditoria:', err);
      setError('Error al cargar auditoria');
    }
  }, [token]);

  const loadCatalogos = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.inscripcionesAdminCatalogos(token);
      setCatalogos(res?.data || null);
    } catch (err) {
      console.error('Error catalogos:', err);
      setError('Error al cargar catalogos');
    }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadMetrics(), loadInscripciones(), loadAuditoria(), loadCatalogos()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadMetrics, loadInscripciones, loadAuditoria, loadCatalogos]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const handleUpdateEstado = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.inscripcionesAdminUpdateEstado(token, statusForm.id, {
        estado: statusForm.estado,
        observaciones: statusForm.observaciones
      });
      setMessage(`Inscripcion #${statusForm.id} actualizada a "${statusForm.estado}"`);
      setShowStatusModal(false);
      setStatusForm({ id: null, estado: 'Validada', observaciones: '' });
      await Promise.all([loadInscripciones(), loadMetrics(), loadAuditoria()]);
    } catch (err) {
      setError(err?.message || 'Error al actualizar estado');
    }
  };

  const handleExport = async () => {
    setError('');
    setMessage('');
    try {
      const params = {};
      if (exportFilters.periodo) params.periodo = exportFilters.periodo;
      if (exportFilters.estado) params.estado = exportFilters.estado;
      if (exportFilters.tipo) params.tipo = exportFilters.tipo;
      if (exportFilters.carrera) params.carrera = exportFilters.carrera;
      params.formato = exportFilters.formato;

      const res = await api.inscripcionesAdminExport(token, params);

      const blob = exportFilters.formato === 'csv'
        ? new Blob([res], { type: 'text/csv;charset=utf-8' })
        : new Blob([JSON.stringify(res, null, 2)], { type: 'application/json;charset=utf-8' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscripciones_${Date.now()}.${exportFilters.formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage(`Reporte exportado en formato ${exportFilters.formato.toUpperCase()}`);
    } catch (err) {
      setError(err?.message || 'Error al exportar');
    }
  };

  const openStatusModal = (row) => {
    setStatusForm({ id: row.id_inscripcion, estado: row.estado === 'Validada' ? 'Rechazada' : 'Validada', observaciones: '' });
    setShowStatusModal(true);
  };

  const renderPanel = () => {
    const t = metrics?.totales || {};
    const stats = [
      { icon: ClipboardList, label: 'Total inscripciones', value: t.total, hint: 'Movimientos registrados', color: '#6366f1' },
      { icon: Clock3, label: 'Pendientes', value: t.pendientes, hint: 'Por validar', color: '#f59e0b' },
      { icon: CheckCircle2, label: 'Validadas', value: t.validadas, hint: 'Confirmadas', color: '#10b981' },
      { icon: XCircle, label: 'Rechazadas', value: t.rechazadas, hint: 'No autorizadas', color: '#ef4444' },
      { icon: Ban, label: 'Canceladas', value: t.canceladas, hint: 'Movimientos cancelados', color: '#6b7280' },
      { icon: BookOpen, label: 'Primera vez', value: t.primera_vez, hint: 'Nuevos ingresos', color: '#8b5cf6' },
      { icon: RefreshCw, label: 'Reinscripciones', value: t.reinscripciones, hint: 'Continuan estudios', color: '#ec4899' },
      { icon: Calendar, label: 'Periodos activos', value: metrics?.periodosActivos?.length || 0, hint: 'Ciclos vigentes', color: '#14b8a6' }
    ];

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {stats.map(s => <MetricCard key={s.label} {...s} />)}
        </div>

        <div className="two-col">
          <SectionCard title="Desglose por periodo" subtitle="Inscripciones agrupadas por ciclo escolar">
            {!metrics?.porPeriodo?.length ? (
              <div className="empty">Sin datos</div>
            ) : (
              <div className="list">
                {metrics.porPeriodo.map(p => (
                  <div key={p.id_periodo} className="list-item">
                    <strong>{p.nombre_periodo}</strong>
                    <span>
                      Total: {p.total} &middot;
                      Pend: {p.pendientes} &middot;
                      Val: {p.validadas} &middot;
                      Rech: {p.rechazadas} &middot;
                      Canc: {p.canceladas}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Desglose por tipo" subtitle="Distribucion primera vez vs reinscripcion">
            {!metrics?.porTipo?.length ? (
              <div className="empty">Sin datos</div>
            ) : (
              <div className="list">
                {metrics.porTipo.map(t => (
                  <div key={t.tipo_inscripcion} className="list-item">
                    <strong>{t.tipo_inscripcion === 'Primera_Vez' ? 'Primera vez' : 'Reinscripcion'}</strong>
                    <span>Total: {t.total}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Desglose por carrera" subtitle="Inscripciones por programa educativo">
          {!metrics?.porCarrera?.length ? (
            <div className="empty">Sin datos</div>
          ) : (
            <div className="list">
              {metrics.porCarrera.map(c => (
                <div key={c.id_carrera} className="list-item">
                  <strong>{c.nombre_carrera}</strong>
                  <span>Total: {c.total}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {metrics?.periodosActivos?.length > 0 && (
          <SectionCard title="Periodos activos" subtitle="Ciclos escolares vigentes">
            <div className="list">
              {metrics.periodosActivos.map(p => (
                <div key={p.id_periodo} className="list-item">
                  <strong>{p.nombre_periodo}</strong>
                  <span>
                    {formatDate(p.fecha_inicio)} — {formatDate(p.fecha_fin)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  const renderLista = () => (
    <div className="stack">
      <SectionCard
        title="Filtros de busqueda"
        subtitle="Periodo, carrera, estado, tipo y texto libre"
        right={
          <button type="button" className="btn secondary" onClick={() => loadInscripciones(filters)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="Periodo">
            <select value={filters.periodo} onChange={e => setFilters({ ...filters, periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={filters.carrera} onChange={e => setFilters({ ...filters, carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Estado">
            <select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Validada">Validada</option>
              <option value="Rechazada">Rechazada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </FormField>
          <FormField label="Tipo">
            <select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="Primera_Vez">Primera vez</option>
              <option value="Reinscripcion">Reinscripcion</option>
            </select>
          </FormField>
        </div>
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <span>Busqueda por matricula, nombre o periodo</span>
          <input
            value={filters.busqueda}
            onChange={e => setFilters({ ...filters, busqueda: e.target.value })}
            placeholder="Ej. 2026, Juan Perez, ISC-001..."
            onKeyDown={e => e.key === 'Enter' && loadInscripciones(filters)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Registros de inscripciones"
        subtitle={`${inscripciones.length} movimiento(s) encontrado(s)`}
        right={
          <button type="button" className="btn secondary" onClick={() => loadInscripciones(filters)}>
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      >
        {inscripciones.length === 0 ? (
          <div className="empty">No se encontraron inscripciones con los filtros actuales.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>ID</th>
                  <th style={{ padding: '0.5rem' }}>Matricula</th>
                  <th style={{ padding: '0.5rem' }}>Alumno</th>
                  <th style={{ padding: '0.5rem' }}>Periodo</th>
                  <th style={{ padding: '0.5rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem' }}>Estado</th>
                  <th style={{ padding: '0.5rem' }}>Carrera</th>
                  <th style={{ padding: '0.5rem' }}>Fecha</th>
                  <th style={{ padding: '0.5rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {inscripciones.map(row => (
                  <tr key={row.id_inscripcion} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>{row.id_inscripcion}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{row.matricula || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{row.nombre_completo || row.alumno || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{row.nombre_periodo}</td>
                    <td style={{ padding: '0.5rem' }}><TypeBadge type={row.tipo_inscripcion} /></td>
                    <td style={{ padding: '0.5rem' }}><StatusBadge status={row.estado} /></td>
                    <td style={{ padding: '0.5rem' }}>{row.nombre_carrera || '—'}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{formatDate(row.fecha_inscripcion)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <div className="row gap" style={{ gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => openStatusModal(row)}
                          title="Cambiar estado"
                        >
                          <ArrowUpDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderAuditoria = () => (
    <div className="stack">
      <SectionCard
        title="Filtros de auditoria"
        subtitle="Buscar por inscripcion o tipo de accion"
        right={
          <button type="button" className="btn secondary" onClick={() => loadAuditoria(auditFilters)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="ID Inscripcion">
            <input
              value={auditFilters.id_inscripcion}
              onChange={e => setAuditFilters({ ...auditFilters, id_inscripcion: e.target.value })}
              placeholder="Ej. 1, 5, 12"
              inputMode="numeric"
            />
          </FormField>
          <FormField label="Accion">
            <select value={auditFilters.accion} onChange={e => setAuditFilters({ ...auditFilters, accion: e.target.value })}>
              <option value="">Todas</option>
              <option value="CREAR">CREAR</option>
              <option value="VALIDAR">VALIDAR</option>
              <option value="RECHAZAR">RECHAZAR</option>
              <option value="CANCELAR">CANCELAR</option>
              <option value="EDITAR">EDITAR</option>
              <option value="EXPORTAR">EXPORTAR</option>
            </select>
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Bitacora de auditoria"
        subtitle={`${auditoria.length} registro(s) de actividad`}
        right={
          <button type="button" className="btn secondary" onClick={() => loadAuditoria({})}>
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      >
        {auditoria.length === 0 ? (
          <div className="empty">Sin registros de auditoria.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>ID</th>
                  <th style={{ padding: '0.4rem' }}>Inscripcion</th>
                  <th style={{ padding: '0.4rem' }}>Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Rol</th>
                  <th style={{ padding: '0.4rem' }}>Accion</th>
                  <th style={{ padding: '0.4rem' }}>Estado anterior</th>
                  <th style={{ padding: '0.4rem' }}>Estado nuevo</th>
                  <th style={{ padding: '0.4rem' }}>Detalle</th>
                  <th style={{ padding: '0.4rem' }}>IP</th>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map(a => (
                  <tr key={a.id_auditoria} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{a.id_auditoria}</td>
                    <td style={{ padding: '0.4rem' }}>{a.id_inscripcion || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{a.usuario_nombre || `Usuario #${a.id_usuario}`}</td>
                    <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{a.usuario_rol || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span className={`badge ${a.accion === 'VALIDAR' ? 'success' : a.accion === 'RECHAZAR' || a.accion === 'CANCELAR' ? 'error' : 'info'}`}
                        style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}
                      >
                        {a.accion}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem' }}><StatusBadge status={a.estado_anterior} /></td>
                    <td style={{ padding: '0.4rem' }}><StatusBadge status={a.estado_nuevo} /></td>
                    <td style={{ padding: '0.4rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.detalle || ''}>
                      {a.detalle || '—'}
                    </td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.ip || '—'}</td>
                    <td style={{ padding: '0.4rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDate(a.creado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderCatalogos = () => (
    <div className="stack">
      <SectionCard title="Estados de inscripcion" subtitle="Catalogos configurables de estados">
        {!catalogos?.estados?.length ? (
          <div className="empty">Sin catalogos de estados.</div>
        ) : (
          <div className="list">
            {catalogos.estados.map(e => (
              <div key={e.id_estado} className="list-item">
                <div className="row gap" style={{ alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
                  <strong>{e.nombre}</strong>
                  <span className="badge light" style={{ fontSize: '0.7rem' }}>{e.codigo}</span>
                </div>
                <span>{e.descripcion} {!e.activo && <span className="badge error" style={{ fontSize: '0.7rem' }}>Inactivo</span>}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Periodos registrados" subtitle="Ciclos escolares disponibles">
        {!catalogos?.periodos?.length ? (
          <div className="empty">Sin periodos.</div>
        ) : (
          <div className="list">
            {catalogos.periodos.map(p => (
              <div key={p.id_periodo} className="list-item">
                <strong>{p.nombre_periodo}</strong>
                <span>
                  {formatDate(p.fecha_inicio)} — {formatDate(p.fecha_fin)} &middot;
                  <span className={`badge ${p.estado === 'Activo' ? 'success' : p.estado === 'Cerrado' ? 'info' : 'light'}`}
                    style={{ fontSize: '0.7rem', marginLeft: '0.35rem' }}
                  >
                    {p.estado}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Carreras" subtitle="Programas educativos">
        {!catalogos?.carreras?.length ? (
          <div className="empty">Sin carreras.</div>
        ) : (
          <div className="list">
            {catalogos.carreras.map(c => (
              <div key={c.id_carrera} className="list-item">
                <strong>{c.nombre_carrera}</strong>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderExportar = () => (
    <div className="stack">
      <SectionCard
        title="Exportar reporte de inscripciones"
        subtitle="Descargue los datos filtrados en formato CSV o JSON"
      >
        <div className="grid-two">
          <FormField label="Periodo">
            <select value={exportFilters.periodo} onChange={e => setExportFilters({ ...exportFilters, periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={exportFilters.carrera} onChange={e => setExportFilters({ ...exportFilters, carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Estado">
            <select value={exportFilters.estado} onChange={e => setExportFilters({ ...exportFilters, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Validada">Validada</option>
              <option value="Rechazada">Rechazada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </FormField>
          <FormField label="Tipo">
            <select value={exportFilters.tipo} onChange={e => setExportFilters({ ...exportFilters, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="Primera_Vez">Primera vez</option>
              <option value="Reinscripcion">Reinscripcion</option>
            </select>
          </FormField>
        </div>

        <div className="field" style={{ marginTop: '0.75rem' }}>
          <span>Formato de exportacion</span>
          <div className="row gap" style={{ marginTop: '0.35rem' }}>
            <label className="row gap" style={{ cursor: 'pointer', alignItems: 'center' }}>
              <input
                type="radio"
                name="formato"
                value="json"
                checked={exportFilters.formato === 'json'}
                onChange={e => setExportFilters({ ...exportFilters, formato: e.target.value })}
              />
              JSON
            </label>
            <label className="row gap" style={{ cursor: 'pointer', alignItems: 'center' }}>
              <input
                type="radio"
                name="formato"
                value="csv"
                checked={exportFilters.formato === 'csv'}
                onChange={e => setExportFilters({ ...exportFilters, formato: e.target.value })}
              />
              CSV (Excel compatible)
            </label>
          </div>
        </div>

        <div className="full row gap wrap" style={{ marginTop: '1rem' }}>
          <button className="btn primary" type="button" onClick={handleExport}>
            <Download size={16} /> Exportar reporte
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Vista previa de columnas" subtitle="Datos incluidos en la exportacion">
        <div className="alert info" style={{ lineHeight: 1.75 }}>
          <BadgeInfo size={16} />
          El reporte incluye: ID, Matricula, Alumno, Nombre completo, Carrera, Periodo, Tipo de inscripcion,
          Estado, Observaciones, Fecha de inscripcion, Ultima actualizacion, Semestre actual y Estatus academico.
        </div>
      </SectionCard>
    </div>
  );

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <Shield size={14} /> Administracion de inscripciones
          </div>
          <h1>Panel de administracion</h1>
          <p>
            Supervision general del modulo de inscripciones: metricas globales, trazabilidad por evento,
            gestion de estados, catalogos y exportacion de reportes institucionales.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Modulo</small>
            <strong>Inscripciones</strong>
          </div>
          <div className="meta-card">
            <small>Acceso</small>
            <strong>Administrador</strong>
          </div>
        </div>
      </section>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${activeTab === tab.id ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando panel de inscripciones...</span>
        </div>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {activeTab === 'panel' && renderPanel()}
          {activeTab === 'lista' && renderLista()}
          {activeTab === 'auditoria' && renderAuditoria()}
          {activeTab === 'catalogos' && renderCatalogos()}
          {activeTab === 'exportar' && renderExportar()}
        </>
      )}

      {showStatusModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal" style={{
            background: 'var(--card-bg)', borderRadius: 'var(--radius)',
            padding: '1.5rem', maxWidth: 480, width: '90%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Cambiar estado</h3>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Inscripcion #{statusForm.id}
            </p>
            <form onSubmit={handleUpdateEstado}>
              <FormField label="Nuevo estado">
                <select
                  value={statusForm.estado}
                  onChange={e => setStatusForm({ ...statusForm, estado: e.target.value })}
                >
                  <option value="Validada">Validar</option>
                  <option value="Rechazada">Rechazar</option>
                  <option value="Cancelada">Cancelar</option>
                  <option value="Pendiente">Revertir a Pendiente</option>
                </select>
              </FormField>
              <FormField label="Observaciones (opcional)">
                <textarea
                  value={statusForm.observaciones}
                  onChange={e => setStatusForm({ ...statusForm, observaciones: e.target.value })}
                  placeholder="Motivo del cambio de estado..."
                  rows={3}
                />
              </FormField>
              <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => setShowStatusModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary">
                  Confirmar cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
