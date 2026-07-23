import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Users,
  XCircle
} from 'lucide-react';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function normalize(v) { return String(v || '').trim().toUpperCase(); }

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
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
  Cancelada: { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280' },
  Activo: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Aprobada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Completada: { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' }
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

const TABS = [
  { key: 'panel', label: 'Panel general', icon: BarChart3 },
  { key: 'lista', label: 'Historial institucional', icon: ClipboardList },
  { key: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
  { key: 'bitacora', label: 'Bitácora', icon: History },
  { key: 'exportar', label: 'Exportar reportes', icon: Download }
];

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={16} /> {tab.label}
    </button>
  );
}

export default function AdminReinscripcionesPage() {
  const { token } = useAuth();
  const [tab, setTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [metrics, setMetrics] = React.useState(null);
  const [reinscripciones, setReinscripciones] = React.useState([]);
  const [totalReinscripciones, setTotalReinscripciones] = React.useState(0);
  const [incidencias, setIncidencias] = React.useState(null);
  const [bitacora, setBitacora] = React.useState(null);
  const [catalogos, setCatalogos] = React.useState(null);
  const [historial, setHistorial] = React.useState(null);
  const [exportData, setExportData] = React.useState(null);

  const [filtros, setFiltros] = React.useState({ id_periodo: '', id_carrera: '', id_grupo: '', estado: '', busqueda: '' });
  const [pagina, setPagina] = React.useState(1);
  const [bitacoraFiltro, setBitacoraFiltro] = React.useState('');
  const [exportFiltros, setExportFiltros] = React.useState({ id_periodo: '', id_carrera: '', id_grupo: '', estado: '' });
  const [exportCargando, setExportCargando] = React.useState(false);
  const [exportFormato, setExportFormato] = React.useState('json');

  const cargarMetrics = React.useCallback(async () => {
    try {
      const res = await api.adminReinscripcionesMetrics(token);
      if (res.ok) setMetrics(res.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const cargarCatalogos = React.useCallback(async () => {
    try {
      const res = await api.adminReinscripcionesCatalogos(token);
      if (res.ok) setCatalogos(res.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const cargarReinscripciones = React.useCallback(async () => {
    try {
      const params = { ...filtros, pagina, limite: 100 };
      const res = await api.adminReinscripcionesList(token, params);
      if (res.ok) { setReinscripciones(res.data.reinscripciones || []); setTotalReinscripciones(res.data.total || 0); }
    } catch (e) { console.error(e); }
  }, [token, filtros, pagina]);

  const cargarIncidencias = React.useCallback(async () => {
    try {
      const res = await api.adminReinscripcionesIncidencias(token);
      if (res.ok) setIncidencias(res.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const cargarBitacora = React.useCallback(async () => {
    try {
      const params = bitacoraFiltro ? `?accion=${encodeURIComponent(bitacoraFiltro)}&limite=200` : '?limite=200';
      const res = await api.adminReinscripcionesBitacora(token, params);
      if (res.ok) setBitacora(res.data);
    } catch (e) { console.error(e); }
  }, [token, bitacoraFiltro]);

  const cargarHistorial = React.useCallback(async () => {
    try {
      const res = await api.adminReinscripcionesHistorial(token);
      if (res.ok) setHistorial(res.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchTab = React.useCallback(async (tabKey) => {
    setLoading(true);
    setError('');
    try {
      switch (tabKey) {
        case 'panel':
          await Promise.all([cargarMetrics(), cargarCatalogos(), cargarHistorial()]);
          break;
        case 'lista':
          await Promise.all([cargarReinscripciones(), cargarCatalogos()]);
          break;
        case 'incidencias':
          await cargarIncidencias();
          break;
        case 'bitacora':
          await cargarBitacora();
          break;
        case 'exportar':
          await cargarCatalogos();
          break;
      }
    } catch (err) {
      console.error('Error fetching tab:', err);
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [cargarMetrics, cargarCatalogos, cargarReinscripciones, cargarIncidencias, cargarBitacora, cargarHistorial]);

  React.useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const tryAgain = () => fetchTab(tab);

  const handleExport = async () => {
    setExportCargando(true);
    try {
      const params = { ...exportFiltros, formato: exportFormato };
      const res = await api.adminReinscripcionesExport(token, params);
      if (res.ok) {
        setExportData(res.data);
        if (exportFormato === 'csv') {
          const blob = new Blob(['\uFEFF' + res], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `reinscripciones_${Date.now()}.csv`; a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      setError(e?.message || 'Error al exportar');
    } finally {
      setExportCargando(false);
    }
  };

  const renderPanel = () => {
    if (!metrics) return <div className="auth-note">Cargando métricas...</div>;
    const { totales, porPeriodo, porCarrera, tendenciaMensual, periodosActivos, alumnosReinscritos } = metrics;

    return (
      <div className="stack">
        <SectionCard title="Métricas globales" subtitle="Resumen general del proceso de reinscripción">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            <StatCard icon={ClipboardList} label="Total reinscripciones" value={totales?.total || 0} />
            <StatCard icon={CheckCircle2} label="Validadas" value={totales?.validadas || 0} hint={`${totales?.total ? ((totales.validadas / totales.total) * 100).toFixed(1) : 0}%`} />
            <StatCard icon={XCircle} label="Rechazadas" value={totales?.rechazadas || 0} />
            <StatCard icon={Activity} label="Activas" value={totales?.activas || 0} />
            <StatCard icon={AlertTriangle} label="Pendientes" value={totales?.pendientes || 0} />
            <StatCard icon={Shield} label="Canceladas" value={totales?.canceladas || 0} />
            <StatCard icon={Users} label="Alumnos reinscritos" value={alumnosReinscritos || 0} />
          </div>
        </SectionCard>

        {periodosActivos?.length > 0 && (
          <SectionCard title="Periodos activos" subtitle="Periodos actualmente en curso">
            <div className="list">
              {periodosActivos.map(p => (
                <div key={p.id_periodo} className="list-item">
                  <strong>{p.nombre_periodo}</strong>
                  <span>{formatDate(p.fecha_inicio)} — {formatDate(p.fecha_fin)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {tendenciaMensual?.length > 0 && (
          <SectionCard title="Tendencia mensual (12 meses)" subtitle="Reinscripciones por mes">
            <div className="table-wrapper">
              <div className="table-responsive"><table className="table">
                <thead>
                  <tr><th>Mes</th><th>Total</th><th>Validadas</th><th>Rechazadas</th></tr>
                </thead>
                <tbody>
                  {tendenciaMensual.map((m, i) => (
                    <tr key={i}>
                      <td>{m.mes}</td>
                      <td>{m.total}</td>
                      <td><span style={{ color: 'var(--success)' }}>{m.validadas}</span></td>
                      <td><span style={{ color: 'var(--danger)' }}>{m.rechazadas}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </SectionCard>
        )}

        <div className="two-col">
          {porCarrera?.length > 0 && (
            <SectionCard title="Por carrera">
              <div className="list">
                {porCarrera.map((c, i) => (
                  <div key={i} className="list-item">
                    <strong>{c.nombre_carrera}</strong>
                    <span>{c.total} reinscripción(es)</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {porPeriodo?.length > 0 && (
            <SectionCard title="Por periodo">
              <div className="list">
                {porPeriodo.map((p, i) => (
                  <div key={i} className="list-item">
                    <strong>{p.nombre_periodo}</strong>
                    <span>{p.total} total · {p.validadas} validadas · {p.rechazadas} rechazadas</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {historial?.totalGeneral && (
          <SectionCard title="Historial institucional" subtitle="Datos acumulados históricos">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <StatCard icon={FileText} label="Total histórico" value={historial.totalGeneral.total || 0} />
              <StatCard icon={Users} label="Alumnos distintos" value={historial.totalGeneral.alumnos_distintos || 0} />
              <StatCard icon={Calendar} label="Periodos con reinscripciones" value={historial.totalGeneral.periodos_con_reinscripciones || 0} />
              <StatCard icon={History} label="Primera reinscripción" value={formatDate(historial.totalGeneral.primera_reinscripcion)} />
            </div>

            {historial?.porPeriodo?.length > 0 && (
              <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                <div className="table-responsive"><table className="table">
                  <thead>
                    <tr><th>Periodo</th><th>Total</th><th>Alumnos</th><th>Validadas</th><th>Rechazadas</th><th>Canceladas</th><th>Pendientes</th><th>Activas</th></tr>
                  </thead>
                  <tbody>
                    {historial.porPeriodo.filter(p => p.total_reinscripciones > 0).map((p, i) => (
                      <tr key={i}>
                        <td><strong>{p.nombre_periodo}</strong></td>
                        <td>{p.total_reinscripciones}</td>
                        <td>{p.alumnos_reinscritos}</td>
                        <td><span style={{ color: 'var(--success)' }}>{p.validadas}</span></td>
                        <td><span style={{ color: 'var(--danger)' }}>{p.rechazadas}</span></td>
                        <td>{p.canceladas}</td>
                        <td>{p.pendientes}</td>
                        <td>{p.activas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    );
  };

  const renderLista = () => {
    return (
      <div className="stack">
        <SectionCard
          title="Historial institucional"
          subtitle="Filtra por periodo, carrera, grupo, estado o busca por alumno"
          right={
            <button className="btn secondary" onClick={cargarReinscripciones}>
              <RefreshCw size={16} /> Actualizar
            </button>
          }
        >
          <div className="filters-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="Periodo">
              <select value={filtros.id_periodo} onChange={e => setFiltros(p => ({ ...p, id_periodo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </FormField>
            <FormField label="Carrera">
              <select value={filtros.id_carrera} onChange={e => setFiltros(p => ({ ...p, id_carrera: e.target.value }))} style={selectStyle}>
                <option value="">Todas</option>
                {(catalogos?.carreras || []).map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
              </select>
            </FormField>
            <FormField label="Grupo">
              <select value={filtros.id_grupo} onChange={e => setFiltros(p => ({ ...p, id_grupo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.grupos || []).map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={filtros.estado} onChange={e => setFiltros(p => ({ ...p, estado: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Validada">Validada</option>
                <option value="Rechazada">Rechazada</option>
                <option value="Cancelada">Cancelada</option>
                <option value="Activo">Activo</option>
              </select>
            </FormField>
            <FormField label="Buscar">
              <input type="text" placeholder="Matrícula o nombre..." value={filtros.busqueda} onChange={e => setFiltros(p => ({ ...p, busqueda: e.target.value }))} style={inputStyle} />
            </FormField>
            <button className="btn primary" onClick={() => { setPagina(1); cargarReinscripciones(); }}>
              <Filter size={16} /> Filtrar
            </button>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <span className="badge info">{totalReinscripciones} reinscripción(es) encontrada(s)</span>
          </div>

          {reinscripciones.length > 0 ? (
            <div className="table-wrapper">
              <div className="table-responsive"><table className="table">
                <thead>
                  <tr><th>ID</th><th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Grupo</th><th>Carrera</th><th>Estado</th><th>Motivo</th><th>Fecha</th><th>Validó</th></tr>
                </thead>
                <tbody>
                  {reinscripciones.map(r => (
                    <tr key={r.id_inscripcion}>
                      <td>{r.id_inscripcion}</td>
                      <td><strong>{r.matricula}</strong></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.nombre_completo}>{r.nombre_completo}</td>
                      <td>{r.nombre_periodo}</td>
                      <td>{r.nombre_grupo || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.nombre_carrera || '—'}</td>
                      <td><StatusBadge status={r.estado} /></td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.motivo || ''}>{r.motivo || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(r.fecha_inscripcion)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.validado_por_nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <ClipboardList size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No se encontraron reinscripciones con los filtros seleccionados.</p>
            </div>
          )}

          {totalReinscripciones > 100 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn secondary" disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button>
              <span className="badge info" style={{ alignSelf: 'center' }}>Página {pagina}</span>
              <button className="btn secondary" disabled={pagina * 100 >= totalReinscripciones} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderIncidencias = () => {
    if (!incidencias) return <div className="auth-note">Cargando incidencias...</div>;
    const { incidencias: items, resumen } = incidencias;

    return (
      <div className="stack">
        <SectionCard title="Incidencias" subtitle="Problemas detectados en el proceso de reinscripción">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            <StatCard icon={AlertTriangle} label="Sin grupo" value={resumen?.sin_grupo || 0} />
            <StatCard icon={XCircle} label="Rechazadas (30d)" value={resumen?.rechazadas_recientes || 0} />
            <StatCard icon={Shield} label="Sin registro" value={resumen?.sin_registro_reinscripcion || 0} />
            <StatCard icon={AlertTriangle} label="Duplicadas" value={resumen?.duplicadas || 0} />
          </div>
        </SectionCard>

        {items?.length > 0 ? (
          <SectionCard title="Detalle de incidencias" subtitle={items.length + ' incidencia(s) encontrada(s)'}>
            <div className="table-wrapper">
              <div className="table-responsive"><table className="table">
                <thead>
                  <tr><th>Tipo</th><th>Gravedad</th><th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Estado</th><th>Problema</th></tr>
                </thead>
                <tbody>
                  {items.map((inc, i) => (
                    <tr key={i}>
                      <td><span className="badge light">{inc.tipo?.replace(/_/g, ' ')}</span></td>
                      <td><span className={`badge ${inc.gravedad === 'critica' ? 'danger' : inc.gravedad === 'alta' ? 'warn' : 'light'}`}>{inc.gravedad}</span></td>
                      <td>{inc.matricula || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.nombre_completo}>{inc.nombre_completo || '—'}</td>
                      <td>{inc.nombre_periodo || '—'}</td>
                      <td><StatusBadge status={inc.estado} /></td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.problema}>{inc.problema}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </SectionCard>
        ) : (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No se detectaron incidencias en el proceso de reinscripción.</p>
          </div>
        )}
      </div>
    );
  };

  const renderBitacora = () => {
    return (
      <div className="stack">
        <SectionCard
          title="Bitácora de auditoría"
          subtitle="Movimientos y cambios en reinscripciones"
          right={
            <button className="btn secondary" onClick={cargarBitacora}>
              <RefreshCw size={16} /> Actualizar
            </button>
          }
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="Filtrar por acción">
              <select value={bitacoraFiltro} onChange={e => setBitacoraFiltro(e.target.value)} style={selectStyle}>
                <option value="">Todas</option>
                {(bitacora?.acciones || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </FormField>
            <button className="btn primary" onClick={cargarBitacora}>
              <Filter size={16} /> Filtrar
            </button>
          </div>

          {bitacora?.registros?.length > 0 ? (
            <div className="table-wrapper">
              <div className="table-responsive"><table className="table">
                <thead>
                  <tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th><th>Estado ant.</th><th>Estado nuevo</th><th>Alumno</th><th>Matrícula</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {bitacora.registros.map(r => (
                    <tr key={r.id_auditoria}>
                      <td>{r.id_auditoria}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.usuario_nombre || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.usuario_rol || '—'}</td>
                      <td><span className="badge light">{r.accion}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.detalle}>{r.detalle || '—'}</td>
                      <td><StatusBadge status={r.estado_anterior} /></td>
                      <td><StatusBadge status={r.estado_nuevo} /></td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.alumno_nombre}>{r.alumno_nombre || '—'}</td>
                      <td>{r.matricula || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.ip || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(r.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <History size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No se encontraron registros en la bitácora.</p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderExportar = () => {
    return (
      <div className="stack">
        <SectionCard
          title="Exportar reportes"
          subtitle="Descarga el listado de reinscripciones en JSON o CSV"
          right={
            <button className="btn secondary" onClick={cargarCatalogos}>
              <RefreshCw size={16} /> Recargar catálogos
            </button>
          }
        >
          <div className="filters-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="Periodo">
              <select value={exportFiltros.id_periodo} onChange={e => setExportFiltros(p => ({ ...p, id_periodo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </FormField>
            <FormField label="Carrera">
              <select value={exportFiltros.id_carrera} onChange={e => setExportFiltros(p => ({ ...p, id_carrera: e.target.value }))} style={selectStyle}>
                <option value="">Todas</option>
                {(catalogos?.carreras || []).map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
              </select>
            </FormField>
            <FormField label="Grupo">
              <select value={exportFiltros.id_grupo} onChange={e => setExportFiltros(p => ({ ...p, id_grupo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.grupos || []).map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={exportFiltros.estado} onChange={e => setExportFiltros(p => ({ ...p, estado: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Validada">Validada</option>
                <option value="Rechazada">Rechazada</option>
                <option value="Cancelada">Cancelada</option>
                <option value="Activo">Activo</option>
              </select>
            </FormField>
            <FormField label="Formato">
              <select value={exportFormato} onChange={e => setExportFormato(e.target.value)} style={selectStyle}>
                <option value="json">JSON</option>
                <option value="csv">CSV (.xlsx compatible)</option>
              </select>
            </FormField>
            <button className="btn primary" onClick={handleExport} disabled={exportCargando}>
              {exportCargando ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              {' '}{exportCargando ? 'Exportando...' : 'Exportar'}
            </button>
          </div>

          {exportData?.registros?.length > 0 && (
            <div className="auth-note" style={{ marginTop: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />{' '}
              {exportData.registros.length} registro(s) exportados correctamente.
              {exportFormato === 'json' && (
                <button className="btn secondary" style={{ marginLeft: '0.5rem' }} onClick={() => {
                  const blob = new Blob([JSON.stringify(exportData.registros, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `reinscripciones_${Date.now()}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={14} /> Descargar JSON
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="auth-note" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2rem' }}>
          <Loader2 className="animate-spin" size={18} /> <span>Cargando datos...</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="stack">
          <div className="alert error">{error}</div>
          <button className="btn secondary" onClick={tryAgain}>Reintentar</button>
        </div>
      );
    }
    switch (tab) {
      case 'panel': return renderPanel();
      case 'lista': return renderLista();
      case 'incidencias': return renderIncidencias();
      case 'bitacora': return renderBitacora();
      case 'exportar': return renderExportar();
      default: return null;
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Administración</div>
          <h1>Panel de administración — Reinscripciones</h1>
          <p>Supervisa el comportamiento general del proceso de reinscripción: métricas globales, historial institucional, incidencias, bitácora de auditoría y exportación de reportes en formato JSON y CSV.</p>
        </div>
      </section>

      <div className="tabs">
        {TABS.map(t => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {renderContent()}
    </div>
  );
}

const selectStyle = {
  padding: '0.5rem', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', minWidth: 150
};

const inputStyle = {
  padding: '0.5rem', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', minWidth: 200
};
