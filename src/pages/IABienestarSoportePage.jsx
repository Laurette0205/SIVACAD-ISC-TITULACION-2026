import React from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardList,
  Database, Download, Eye, FileText, Filter, HeartPulse, Loader2,
  RefreshCw, Search, Server, Shield, Wifi, X, Clock, Terminal,
  Cpu, HardDrive, BookOpen, CheckSquare, AlertOctagon, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RISK_BADGE = { Bajo: 'status ok', Medio: 'status warn', Alto: 'status warn', 'Crítico': 'status error' };

function formatDate(value) {
  if (!value) return '-';
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }
  catch { return String(value); }
}

function formatShortDate(value) {
  if (!value) return '-';
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(new Date(value)); }
  catch { return String(value); }
}

function StatusBadge({ ok, label }) {
  return (
    <span className={`badge ${ok ? 'light' : 'error'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
      {label || (ok ? 'OK' : 'Fallo')}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)'
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 800,
        maxHeight: '85vh', overflow: 'auto', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          cursor: 'pointer', padding: 4
        }}><X size={20} /></button>
        {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export default function IABienestarSoportePage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccess = !!user;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Data sections
  const [estado, setEstado] = React.useState(null);
  const [bitacora, setBitacora] = React.useState({ data: [], pagination: null });
  const [errores, setErrores] = React.useState({ data: [], stats: null });
  const [conectividad, setConectividad] = React.useState(null);
  const [integridad, setIntegridad] = React.useState(null);
  const [salud, setSalud] = React.useState(null);
  const [rutas, setRutas] = React.useState(null);
  const [exportacion, setExportacion] = React.useState(null);

  // Active tab
  const [activeTab, setActiveTab] = React.useState('panel');

  // Modals
  const [detalleTabla, setDetalleTabla] = React.useState(null);
  const [detalleTablaOpen, setDetalleTablaOpen] = React.useState(false);
  const [exportForm, setExportForm] = React.useState({ tipo: 'alertas', formato: 'json' });

  const tabs = [
    { key: 'panel', label: 'Panel técnico', icon: Terminal },
    { key: 'estado', label: 'Estado del servicio', icon: HeartPulse },
    { key: 'bitacora', label: 'Bitácora', icon: ClipboardList },
    { key: 'errores', label: 'Errores del sistema', icon: AlertOctagon },
    { key: 'rutas', label: 'Monitoreo de rutas', icon: FileText },
    { key: 'exportar', label: 'Exportaciones', icon: Download },
    { key: 'salud', label: 'Salud de módulos', icon: Cpu }
  ];

  const fetchEstado = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteEstado(token); if (r?.ok) setEstado(r.data); } catch (_) {}
  }, [token]);

  const fetchBitacora = React.useCallback(async (page = 1) => {
    if (!token) return;
    try {
      const r = await api.iaBienestarSoporteBitacora(token, { page, limit: 15 });
      if (r?.ok) setBitacora({ data: r.data || [], pagination: r.pagination });
    } catch (_) {}
  }, [token]);

  const fetchErrores = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteErrores(token, { limit: 20 }); if (r?.ok) setErrores({ data: r.data || [], stats: r.stats }); } catch (_) {}
  }, [token]);

  const fetchConectividad = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteConectividad(token); if (r?.ok) setConectividad(r.data); } catch (_) {}
  }, [token]);

  const fetchIntegridad = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteIntegridad(token); if (r?.ok) setIntegridad(r.data); } catch (_) {}
  }, [token]);

  const fetchSalud = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteSalud(token); if (r?.ok) setSalud(r.data); } catch (_) {}
  }, [token]);

  const fetchRutas = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.iaBienestarSoporteRutas(token); if (r?.ok) setRutas(r.data); } catch (_) {}
  }, [token]);

  const fetchExportacion = React.useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.iaBienestarSoporteExportar(token, exportForm);
      if (r?.ok) setExportacion(r);
    } catch (_) {}
  }, [token, exportForm]);

  const fetchAll = React.useCallback(async () => {
    setLoading(true); setError('');
    await Promise.all([
      fetchEstado(), fetchBitacora(), fetchErrores(),
      fetchConectividad(), fetchIntegridad(), fetchRutas()
    ]);
    setLoading(false);
  }, [fetchEstado, fetchBitacora, fetchErrores, fetchConectividad, fetchIntegridad, fetchRutas]);

  React.useEffect(() => {
    if (!authLoading && user) fetchAll();
  }, [authLoading, user, fetchAll]);

  if (authLoading) return <div className="page-center">Cargando sesión...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const renderTablaRow = (nombre, info) => (
    <tr key={nombre}>
      <td><code>{nombre}</code></td>
      <td><StatusBadge ok={info.ok} /></td>
      <td style={{ textAlign: 'right' }}>{info.registros ?? '-'}</td>
    </tr>
  );

  return (
    <div className="stack">
      {/* ── HERO ── */}
      <section className="hero-banner">
        <div>
          <div className="badge light"><Shield size={14} /> Soporte técnico • IA de Acompañamiento</div>
          <h1><Server size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Supervisión IA de Acompañamiento Estudiantil</h1>
          <p>Panel técnico de monitoreo, diagnóstico y verificación del módulo de bienestar y acompañamiento estudiantil.</p>
        </div>
        <div className="hero-meta">
          <button className="btn secondary" onClick={fetchAll} disabled={loading} style={{ marginBottom: '0.5rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar todo
          </button>
          <div className="meta-card"><small>Tablas</small><strong>{estado?.tablas ? Object.keys(estado.tablas).length : '-'}</strong></div>
          <div className="meta-card"><small>Alertas</small><strong>{estado?.metricas?.alertas_pendientes ?? '-'}</strong></div>
          <div className="meta-card"><small>Check-ins</small><strong>{estado?.metricas?.total_checkins ?? '-'}</strong></div>
          <div className="meta-card"><small>Estado</small><strong style={{ color: estado?.estado === 'operativo' ? '#22c55e' : '#ef4444' }}>{estado?.estado || '—'}</strong></div>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'salud') fetchSalud(); if (tab.key === 'rutas') fetchRutas(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', border: 'none',
              background: activeTab === tab.key ? '#4F46E5' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#64748B',
              borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: activeTab === tab.key ? 600 : 400
            }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} className="spin" /></div>}

      {/* ════════════════════════════════════════ */}
      {/* PANEL TÉCNICO */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'panel' && (
        <div className="stack">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <Database size={24} color="#4F46E5" />
              <div className="stat-label">Tablas bienestar</div>
              <div className="stat-value">{estado?.tablas ? Object.keys(estado.tablas).length : '-'}</div>
              <StatusBadge ok={estado?.estado === 'operativo'} label={estado?.estado} />
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <AlertTriangle size={24} color="#f97316" />
              <div className="stat-label">Alertas pendientes</div>
              <div className="stat-value" style={{ color: (estado?.metricas?.alertas_pendientes || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                {estado?.metricas?.alertas_pendientes ?? '-'}
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <HeartPulse size={24} color="#ec4899" />
              <div className="stat-label">Check-ins totales</div>
              <div className="stat-value">{estado?.metricas?.total_checkins ?? '-'}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <Server size={24} color="#0891b2" />
              <div className="stat-label">Sesiones</div>
              <div className="stat-value">{estado?.metricas?.total_sesiones ?? '-'}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <MessageSquare size={24} color="#7c3aed" />
              <div className="stat-label">Mensajes</div>
              <div className="stat-value">{estado?.metricas?.total_mensajes ?? '-'}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <Activity size={24} color="#0d9488" />
              <div className="stat-label">Derivaciones</div>
              <div className="stat-value">{estado?.metricas?.total_derivaciones ?? '-'}</div>
            </div>
          </div>

          {integridad && (
            <SectionCard title="Integridad del módulo" subtitle={integridad.verificado_en ? `Verificado: ${formatDate(integridad.verificado_en)}` : ''}>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <div className="stat-card" style={{ textAlign: 'center', background: integridad.integro ? '#F0FDF4' : '#FEF2F2' }}>
                  <div className="stat-label">Estado</div>
                  <StatusBadge ok={integridad.integro} label={integridad.integro ? 'Íntegro' : 'Incompleto'} />
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Tablas requeridas</div>
                  <div className="stat-value">{integridad.tablas_requeridas?.length || 0}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Presentes</div>
                  <div className="stat-value">{integridad.tablas_existentes?.length || 0}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center', background: (integridad.tablas_faltantes?.length || 0) > 0 ? '#FEF2F2' : '#F0FDF4' }}>
                  <div className="stat-label">Faltantes</div>
                  <div className="stat-value" style={{ color: (integridad.tablas_faltantes?.length || 0) > 0 ? '#ef4444' : '#22c55e' }}>
                    {integridad.tablas_faltantes?.length || 0}
                  </div>
                </div>
              </div>
              {integridad.tablas_faltantes?.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div className="eyebrow">Tablas faltantes</div>
                  {integridad.tablas_faltantes.map(t => <div key={t} className="alert error" style={{ padding: '0.3rem 0.6rem', margin: '0.25rem 0' }}><code>{t}</code></div>)}
                </div>
              )}
              <button className="btn ghost" onClick={() => { setDetalleTabla(integridad.estructura); setDetalleTablaOpen(true); }} style={{ marginTop: '0.5rem' }}>
                <Eye size={14} /> Ver estructura de tablas
              </button>
            </SectionCard>
          )}

          {conectividad && (
            <SectionCard title="Conectividad BD" subtitle={conectividad.base_datos?.timestamp ? formatDate(conectividad.base_datos.timestamp) : ''}>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <Wifi size={20} color="#22c55e" />
                  <div className="stat-label">Estado</div>
                  <StatusBadge ok={conectividad.base_datos?.estado === 'conectado'} label={conectividad.base_datos?.estado} />
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Latencia</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{conectividad.base_datos?.latencia_ms ?? '-'} ms</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Tablas IA</div>
                  <div className="stat-value">{conectividad.tablas?.length || 0}</div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* ESTADO DEL SERVICIO */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'estado' && (
        <div className="stack">
          <SectionCard title="Estado de tablas" subtitle="Disponibilidad y registro de cada tabla del módulo">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Tabla</th><th>Estado</th><th style={{ textAlign: 'right' }}>Registros</th></tr></thead>
                <tbody>
                  {estado?.tablas ? Object.entries(estado.tablas).map(([k, v]) => renderTablaRow(k, v)) : (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {estado?.metricas && (
            <div className="two-col">
              <SectionCard title="Alertas" subtitle="Distribución por estado">
                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat-card" style={{ textAlign: 'center', background: '#FEF2F2' }}>
                    <div className="stat-label">Pendientes</div>
                    <div className="stat-value" style={{ color: '#ef4444' }}>{estado.metricas.alertas_pendientes}</div>
                  </div>
                  <div className="stat-card" style={{ textAlign: 'center', background: '#F0FDF4' }}>
                    <div className="stat-label">Atendidas</div>
                    <div className="stat-value" style={{ color: '#22c55e' }}>{estado.metricas.alertas_atendidas}</div>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Distribución de riesgo" subtitle="Alertas por nivel">
                <div className="list">
                  {Object.entries(estado.metricas.distribucion_riesgo || {}).length === 0 ? (
                    <div className="empty">Sin datos</div>
                  ) : Object.entries(estado.metricas.distribucion_riesgo).map(([nivel, total]) => (
                    <div key={nivel} className="list-item" style={{ justifyContent: 'space-between' }}>
                      <span className={RISK_BADGE[nivel] || 'status'}>{nivel}</span>
                      <strong>{total}</strong>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {estado?.metricas?.rango_fechas && (
            <SectionCard title="Rango de fechas" subtitle="Actividad registrada en alertas">
              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="stat-card"><div className="stat-label">Primer registro</div><div className="stat-value" style={{ fontSize: '1rem' }}>{estado.metricas.rango_fechas.primera ? formatDate(estado.metricas.rango_fechas.primera) : '-'}</div></div>
                <div className="stat-card"><div className="stat-label">Último registro</div><div className="stat-value" style={{ fontSize: '1rem' }}>{estado.metricas.rango_fechas.ultima ? formatDate(estado.metricas.rango_fechas.ultima) : '-'}</div></div>
              </div>
            </SectionCard>
          )}

          <button className="btn secondary" onClick={fetchEstado} style={{ alignSelf: 'center' }}>
            <RefreshCw size={14} /> Refrescar estado
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* BITÁCORA */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'bitacora' && (
        <SectionCard title={`Bitácora (${bitacora.pagination?.total || 0})`} subtitle="Registro de auditoría del módulo de acompañamiento">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>ID</th><th>Acción</th><th>Detalle</th><th>Usuario</th><th>Fecha</th></tr></thead>
              <tbody>
                {bitacora.data.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin registros de bitácora</td></tr>
                ) : bitacora.data.map(r => (
                  <tr key={r.id_auditoria || r.id}>
                    <td><code>{r.id_auditoria || r.id}</code></td>
                    <td><span className="badge light" style={{ fontSize: '0.75rem' }}>{r.accion}</span></td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalle}</td>
                    <td>{r.nombres} {r.apellido_paterno || ''}</td>
                    <td style={{ fontSize: '0.85rem' }}>{r.creado_en ? formatDate(r.creado_en) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bitacora.pagination?.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              {Array.from({ length: bitacora.pagination.pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => fetchBitacora(p)}
                  style={{
                    padding: '0.3rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 6,
                    background: bitacora.pagination.page === p ? '#4F46E5' : '#fff',
                    color: bitacora.pagination.page === p ? '#fff' : '#334155', cursor: 'pointer'
                  }}>{p}</button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ════════════════════════════════════════ */}
      {/* ERRORES DEL SISTEMA */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'errores' && (
        <div className="stack">
          {errores.stats && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div className="stat-card" style={{ textAlign: 'center', background: '#FEF2F2' }}>
                <div className="stat-label">Críticas totales</div>
                <div className="stat-value" style={{ color: '#ef4444' }}>{errores.stats.total_criticas}</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center', background: '#FFFBEB' }}>
                <div className="stat-label">Pendientes</div>
                <div className="stat-value" style={{ color: '#f97316' }}>{errores.stats.pendientes}</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center', background: '#FEF2F2' }}>
                <div className="stat-label">Requieren derivación</div>
                <div className="stat-value" style={{ color: '#ef4444' }}>{errores.stats.requieren_derivacion}</div>
              </div>
            </div>
          )}
          <SectionCard title={`Incidencias técnicas (${errores.data.length})`} subtitle="Alertas de nivel Alto o Crítico del módulo de acompañamiento">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>#</th><th>Usuario</th><th>Tipo</th><th>Riesgo</th><th>Estado</th><th>Derivar</th><th>Fecha</th></tr></thead>
                <tbody>
                  {errores.data.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin incidencias críticas</td></tr>
                  ) : errores.data.map(a => (
                    <tr key={a.id_alerta}>
                      <td><code>{a.id_alerta}</code></td>
                      <td>{a.nombres} {a.apellido_paterno || ''}<br /><small style={{ color: '#94a3b8' }}>{a.email}</small></td>
                      <td><span className="badge light">{a.tipo_alerta}</span></td>
                      <td><span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo}</span></td>
                      <td><span className={`badge ${a.estado === 'ATENDIDA' || a.estado === 'CERRADA' ? 'light' : 'warning'}`}>{a.estado}</span></td>
                      <td>{a.requiere_derivacion ? <span className="status error">Sí</span> : <span className="status ok">No</span>}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatShortDate(a.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* MONITOREO DE RUTAS */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'rutas' && (
        <div className="stack">
          <SectionCard title="Monitoreo de rutas" subtitle="Archivos del módulo de bienestar en el backend">
            {rutas ? (
              <>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Rutas montadas</div>
                    <div className="stat-value">{rutas.total_rutas}</div>
                  </div>
                  <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Archivos ruta</div>
                    <div className="stat-value">{rutas.total_archivos_ruta}</div>
                  </div>
                  <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Controllers</div>
                    <div className="stat-value">{rutas.total_archivos_controller}</div>
                  </div>
                  <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Archivos ML</div>
                    <div className="stat-value">{rutas.total_archivos_ml}</div>
                  </div>
                </div>

                <div className="eyebrow" style={{ marginTop: '1rem' }}>Rutas montadas en index.js</div>
                <div className="list">
                  {rutas.rutas_montadas?.length === 0 ? <div className="empty">Sin rutas</div> :
                    rutas.rutas_montadas?.map((r, i) => <div key={i} className="list-item"><code>{r}</code></div>)}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div className="eyebrow">Archivos de ruta</div>
                  <div className="list">
                    {rutas.archivos_ruta?.length === 0 ? <div className="empty">Sin archivos</div> :
                      rutas.archivos_ruta?.map((a, i) => (
                        <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
                          <code>{a.archivo}</code>
                          <small style={{ color: '#94a3b8' }}>{(a.peso / 1024).toFixed(1)} KB • {a.modificado ? formatShortDate(a.modificado) : ''}</small>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div className="eyebrow">Archivos ML</div>
                  <div className="list">
                    {rutas.archivos_ml?.length === 0 ? <div className="empty">Sin archivos</div> :
                      rutas.archivos_ml?.map((a, i) => (
                        <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
                          <span><FileText size={14} /> {a.archivo}{a.esDirectorio ? '/' : ''}</span>
                          <small style={{ color: '#94a3b8' }}>{a.esDirectorio ? '-' : (a.peso / 1024).toFixed(1) + ' KB'}</small>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">Carga los datos de monitoreo</div>
            )}
            <button className="btn secondary" onClick={fetchRutas} style={{ marginTop: '1rem' }}>
              <RefreshCw size={14} /> Refrescar
            </button>
          </SectionCard>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* EXPORTACIONES */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'exportar' && (
        <div className="two-col">
          <SectionCard title="Exportar datos" subtitle="Descarga datos del módulo de acompañamiento">
            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">Tipo de datos</label>
                <select value={exportForm.tipo} onChange={e => setExportForm(prev => ({ ...prev, tipo: e.target.value }))}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%' }}>
                  <option value="alertas">Alertas</option>
                  <option value="derivaciones">Derivaciones</option>
                  <option value="checkins">Check-ins</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Formato</label>
                <select value={exportForm.formato} onChange={e => setExportForm(prev => ({ ...prev, formato: e.target.value }))}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%' }}>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <button className="btn accent" onClick={fetchExportacion} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={16} /> Exportar
              </button>
            </div>
          </SectionCard>
          <SectionCard title="Resultado" subtitle={exportacion ? `${exportacion.total} registros exportados` : ''}>
            {exportacion ? (
              exportacion.formato === 'csv' ? (
                <div className="empty">Archivo CSV generado y descargado</div>
              ) : (
                <pre style={{ fontSize: '0.75rem', maxHeight: 400, overflow: 'auto', background: '#F8FAFC', padding: '0.5rem', borderRadius: 8 }}>
                  {JSON.stringify(exportacion.data?.slice(0, 5), null, 2)}
                  {exportacion.data?.length > 5 ? '\n\n...' : ''}
                </pre>
              )
            ) : (
              <div className="empty">Selecciona tipo y formato, luego presiona Exportar</div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* SALUD DE MÓDULOS */}
      {/* ════════════════════════════════════════ */}
      {activeTab === 'salud' && (
        <div className="stack">
          {salud && (
            <SectionCard title="Salud de módulos" subtitle={`Verificado: ${formatDate(salud.timestamp)}`}>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: '1rem' }}>
                <div className="stat-card" style={{ textAlign: 'center', background: salud.estado === 'operativo' ? '#F0FDF4' : '#FEF2F2' }}>
                  <div className="stat-label">Estado general</div>
                  <strong style={{ color: salud.estado === 'operativo' ? '#22c55e' : salud.estado === 'fallo_parcial' ? '#f97316' : '#ef4444', fontSize: '1.2rem' }}>
                    {salud.estado}
                  </strong>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Módulos OK</div>
                  <div className="stat-value" style={{ color: '#22c55e' }}>{salud.resumen?.operativos}/{salud.resumen?.total_modulos}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Fallos</div>
                  <div className="stat-value" style={{ color: salud.resumen?.fallos > 0 ? '#ef4444' : '#22c55e' }}>{salud.resumen?.fallos || 0}</div>
                </div>
              </div>

              <div className="list">
                {Object.entries(salud.modulos || {}).map(([modulo, info]) => (
                  <div key={modulo} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{modulo.replace(/_/g, ' ')}</strong>
                      <StatusBadge ok={info.ok} />
                    </div>
                    {info.latencia_ms !== undefined && <small style={{ color: '#64748B' }}>Latencia: {info.latencia_ms} ms</small>}
                    {info.total !== undefined && <small style={{ color: '#64748B' }}>Tablas: {info.total}</small>}
                    {info.criticas_pendientes !== undefined && <small style={{ color: info.criticas_pendientes > 0 ? '#ef4444' : '#64748B' }}>Críticas pendientes: {info.criticas_pendientes}</small>}
                    {info.sesiones_activas !== undefined && <small style={{ color: '#64748B' }}>Sesiones activas: {info.sesiones_activas}</small>}
                    {info.checkins_24h !== undefined && <small style={{ color: '#64748B' }}>Check-ins (24h): {info.checkins_24h}</small>}
                    {info.modelos !== undefined && <small style={{ color: '#64748B' }}>Modelos: {Array.isArray(info.modelos) ? info.modelos.join(', ') : info.modelos}</small>}
                    {info.tablas !== undefined && Array.isArray(info.tablas) && info.tablas.length > 0 &&
                      <small style={{ color: '#94a3b8' }}>Tablas: {info.tablas.join(', ')}</small>}
                    {info.error && <small style={{ color: '#ef4444' }}>Error: {info.error}</small>}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          <button className="btn secondary" onClick={fetchSalud} style={{ alignSelf: 'center' }}>
            <RefreshCw size={14} /> Ejecutar verificación completa
          </button>
        </div>
      )}

      {/* ── MODAL: Estructura de tablas ── */}
      <Modal open={detalleTablaOpen} onClose={() => setDetalleTablaOpen(false)} title="Estructura de tablas del módulo">
        {detalleTabla && Object.entries(detalleTabla).map(([tabla, columnas]) => (
          <div key={tabla} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}><Database size={16} /> <code>{tabla}</code></h3>
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr><th>Columna</th><th>Tipo</th><th>Nulo</th><th>Llave</th><th>Default</th></tr></thead>
                <tbody>
                  {columnas.map((c, i) => (
                    <tr key={i}>
                      <td><code>{c.columna}</code></td>
                      <td>{c.tipo}</td>
                      <td>{c.nullable ? 'Sí' : 'No'}</td>
                      <td>{c.llave || '-'}</td>
                      <td>{c.defecto ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}
