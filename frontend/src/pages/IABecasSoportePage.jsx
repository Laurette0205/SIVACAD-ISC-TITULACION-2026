import React from 'react';
import { Navigate } from 'react-router-dom';
import { api, canAccessBecasSoporteIA } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardList,
  Database, Download, Eye, FileText, Filter, Loader2,
  RefreshCw, Search, Server, Shield, Wifi, X, Clock, Terminal,
  Cpu, HardDrive, BookOpen, CheckSquare, AlertOctagon, ArrowUpRight,
  Sparkles, Bug, Route, Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return '-';
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }
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

export default function IABecasSoportePage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccess = canAccessBecasSoporteIA(user);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [estado, setEstado] = React.useState(null);
  const [logs, setLogs] = React.useState({ data: [], meta: null });
  const [errores, setErrores] = React.useState({ data: [], meta: null });
  const [conectividad, setConectividad] = React.useState(null);
  const [integridad, setIntegridad] = React.useState(null);
  const [exportaciones, setExportaciones] = React.useState({ data: [], meta: null });
  const [verificacion, setVerificacion] = React.useState(null);
  const [rutas, setRutas] = React.useState(null);

  const [activeTab, setActiveTab] = React.useState('panel');

  const [detalleTabla, setDetalleTabla] = React.useState(null);
  const [detalleTablaOpen, setDetalleTablaOpen] = React.useState(false);

  const tabs = [
    { key: 'panel', label: 'Panel general', icon: Activity },
    { key: 'logs', label: 'Registro de errores', icon: Bug },
    { key: 'rutas', label: 'Validación de rutas', icon: Route },
    { key: 'exportaciones', label: 'Exportaciones', icon: Download },
    { key: 'estado', label: 'Estado del servicio', icon: Server }
  ];

  if (authLoading) {
    return <div className="loading-container"><Loader2 className="spinner" size={40} /></div>;
  }

  if (!token || !canAccess) {
    const home = getHomeRouteByUser ? getHomeRouteByUser() : '/login';
    return <Navigate to={home} replace />;
  }

  const loadEstado = async () => {
    try { setLoading(true); const r = await api.iaBecasSoporteEstado(token); if (r?.ok) setEstado(r.data); else setError(r?.message || 'Error'); } catch (e) { setError('Error al cargar estado'); } finally { setLoading(false); }
  };

  const loadLogs = async (page = 1) => {
    try { setLoading(true); const r = await api.iaBecasSoporteLogs(token, { pagina: page, limite: 25 }); if (r?.ok) setLogs({ data: r.data, meta: r.meta }); } catch (e) { setError('Error al cargar logs'); } finally { setLoading(false); }
  };

  const loadErrores = async (page = 1) => {
    try { setLoading(true); const r = await api.iaBecasSoporteErrores(token, { pagina: page, limite: 25 }); if (r?.ok) setErrores({ data: r.data, meta: r.meta }); } catch (e) { setError('Error al cargar errores'); } finally { setLoading(false); }
  };

  const loadConectividad = async () => {
    try { setLoading(true); const r = await api.iaBecasSoporteConectividad(token); if (r?.ok) setConectividad(r.data); } catch (e) { setError('Error al verificar conectividad'); } finally { setLoading(false); }
  };

  const loadIntegridad = async () => {
    try { setLoading(true); const r = await api.iaBecasSoporteIntegridad(token); if (r?.ok) setIntegridad(r.data); } catch (e) { setError('Error al verificar integridad'); } finally { setLoading(false); }
  };

  const loadExportaciones = async (page = 1) => {
    try { setLoading(true); const r = await api.iaBecasSoporteExportaciones(token, { pagina: page, limite: 25 }); if (r?.ok) setExportaciones({ data: r.data, meta: r.meta }); } catch (e) { setError('Error al cargar exportaciones'); } finally { setLoading(false); }
  };

  const loadVerificacion = async () => {
    try { setLoading(true); const r = await api.iaBecasSoporteVerificar(token); if (r?.ok) setVerificacion(r.data); } catch (e) { setError('Error en verificación'); } finally { setLoading(false); }
  };

  const loadRutas = async () => {
    try { setLoading(true); const r = await api.iaBecasSoporteRutas(token); if (r?.ok) setRutas(r.data); } catch (e) { setError('Error al cargar rutas'); } finally { setLoading(false); }
  };

  React.useEffect(() => {
    if (token) {
      if (activeTab === 'panel') { loadEstado(); loadIntegridad(); loadConectividad(); }
      else if (activeTab === 'logs') loadErrores();
      else if (activeTab === 'rutas') loadRutas();
      else if (activeTab === 'exportaciones') loadExportaciones();
      else if (activeTab === 'estado') { loadEstado(); loadVerificacion(); loadConectividad(); }
    }
  }, [activeTab, token]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-row">
          <h1><Wrench size={24} /> IA de Becas - Soporte Técnico</h1>
          <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ padding: '6px 12px' }}>
            <RefreshCw size={16} /> Recargar
          </button>
        </div>
        <p style={{ color: '#64748b', margin: 0 }}>
          Monitoreo, depuración y validación técnica del módulo IA de Becas
        </p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'panel' && (
        <PanelGeneral
          estado={estado} integridad={integridad} conectividad={conectividad}
          loading={loading} loadEstado={loadEstado} loadIntegridad={loadIntegridad}
          loadConectividad={loadConectividad}
          setDetalleTabla={setDetalleTabla} setDetalleTablaOpen={setDetalleTablaOpen}
        />
      )}
      {activeTab === 'logs' && (
        <RegistroErrores
          errores={errores} loading={loading}
          loadErrores={loadErrores} loadLogs={loadLogs}
        />
      )}
      {activeTab === 'rutas' && (
        <ValidacionRutas
          rutas={rutas} loading={loading} loadRutas={loadRutas}
        />
      )}
      {activeTab === 'exportaciones' && (
        <Exportaciones
          exportaciones={exportaciones} loading={loading} loadExportaciones={loadExportaciones}
        />
      )}
      {activeTab === 'estado' && (
        <EstadoServicio
          estado={estado} verificacion={verificacion} conectividad={conectividad}
          loading={loading} loadEstado={loadEstado} loadVerificacion={loadVerificacion}
          loadConectividad={loadConectividad}
        />
      )}

      <Modal open={detalleTablaOpen} onClose={() => { setDetalleTablaOpen(false); setDetalleTabla(null); }} title="Detalle de tabla">
        {detalleTabla && (
          <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13, maxHeight: 400 }}>
            {JSON.stringify(detalleTabla, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}

function PanelGeneral({ estado, integridad, conectividad, loading, loadEstado, loadIntegridad, loadConectividad, setDetalleTabla, setDetalleTablaOpen }) {
  React.useEffect(() => { if (!estado) loadEstado(); if (!integridad) loadIntegridad(); if (!conectividad) loadConectividad(); }, []);

  if (loading && !estado) return <div className="loading-container"><Loader2 className="spinner" size={32} /></div>;

  return (
    <div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <Database size={24} color="#3b82f6" />
          <div className="stat-value">{estado?.total_tablas || 0}</div>
          <div className="stat-label">Tablas del módulo</div>
        </div>
        <div className="stat-card">
          <ClipboardList size={24} color="#22c55e" />
          <div className="stat-value">{estado?.total_registros || 0}</div>
          <div className="stat-label">Registros totales</div>
        </div>
        <div className="stat-card">
          <Activity size={24} color="#8b5cf6" />
          <div className="stat-value">{integridad?.resumen?.tablas_ok || 0}/{integridad?.resumen?.total_tablas || 0}</div>
          <div className="stat-label">Tablas íntegras</div>
        </div>
        <div className="stat-card">
          <Wifi size={24} color={conectividad?.db === 'conectado' ? '#22c55e' : '#ef4444'} />
          <div className="stat-value">{conectividad?.latencia_ms || 0}ms</div>
          <div className="stat-label">Latencia DB</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3><Database size={18} /> Tablas del módulo</h3>
            <button className="btn btn-outline btn-sm" onClick={loadEstado} disabled={loading}><RefreshCw size={14} /></button>
          </div>
          <div className="card-body" style={{ maxHeight: 350, overflow: 'auto' }}>
            {estado?.tablas ? (
              <table className="table">
                <thead><tr><th>Tabla</th><th>Registros</th><th>Estado</th></tr></thead>
                <tbody>
                  {Object.entries(estado.tablas).map(([name, info]) => (
                    <tr key={name} style={{ cursor: 'pointer' }} onClick={() => { setDetalleTabla(info); setDetalleTablaOpen(true); }}>
                      <td style={{ fontSize: 13 }}>{name}</td>
                      <td>{info.registros}</td>
                      <td><StatusBadge ok={info.existe} label={info.existe ? 'OK' : 'AUSENTE'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>Sin datos</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><CheckSquare size={18} /> Integridad de tablas</h3>
            <button className="btn btn-outline btn-sm" onClick={loadIntegridad} disabled={loading}><RefreshCw size={14} /></button>
          </div>
          <div className="card-body" style={{ maxHeight: 350, overflow: 'auto' }}>
            {integridad?.tablas ? (
              <table className="table">
                <thead><tr><th>Tabla</th><th>Columnas</th><th>Faltantes</th><th>Estado</th></tr></thead>
                <tbody>
                  {integridad.tablas.map(t => (
                    <tr key={t.tabla}>
                      <td style={{ fontSize: 13 }}>{t.tabla}</td>
                      <td>{t.columnas_existentes}/{t.columnas_requeridas}</td>
                      <td>{t.columnas_faltantes?.length || 0}</td>
                      <td><StatusBadge ok={t.estado === 'OK'} label={t.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>Sin datos</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistroErrores({ errores, loading, loadErrores, loadLogs }) {
  const [nivelFiltro, setNivelFiltro] = React.useState('ERROR');
  const [busqueda, setBusqueda] = React.useState('');

  React.useEffect(() => { loadErrores(); }, []);

  const items = errores?.data || [];
  const meta = errores?.meta;

  return (
    <div className="card">
      <div className="card-header">
        <h3><Bug size={18} /> Registro de errores e incidencias ({meta?.total || 0})</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${nivelFiltro === 'ERROR' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setNivelFiltro('ERROR'); loadErrores(); }}>Errores</button>
          <button className={`btn btn-sm ${nivelFiltro === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setNivelFiltro('ALL'); loadLogs(); }}>Todos</button>
          <button className="btn btn-outline btn-sm" onClick={() => nivelFiltro === 'ALL' ? loadLogs() : loadErrores()} disabled={loading}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="card-body">
        {loading ? <div className="loading-container"><Loader2 className="spinner" size={24} /></div> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nivel</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Descripción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id_auditoria}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}</td>
                    <td><span className={`badge ${item.nivel === 'ERROR' || item.nivel === 'CRITICAL' ? 'error' : item.nivel === 'WARNING' ? 'warn' : 'light'}`}>{item.nivel}</span></td>
                    <td style={{ fontSize: 13 }}>{item.nombre_usuario || '-'}</td>
                    <td style={{ fontSize: 13 }}>{item.accion}</td>
                    <td style={{ fontSize: 12 }}>{item.entidad_tipo}{item.entidad_id ? ` #${item.entidad_id}` : ''}</td>
                    <td style={{ fontSize: 12, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion}</td>
                    <td>
                      {item.detalle_json ? (
                        <button className="btn btn-sm" onClick={() => alert(JSON.stringify(JSON.parse(item.detalle_json), null, 2))}>
                          <Eye size={14} />
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Sin registros</td></tr>}
              </tbody>
            </table>
            {meta?.totalPaginas > 1 && (
              <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
                {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`btn btn-sm ${p === meta.pagina ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => nivelFiltro === 'ALL' ? loadLogs(p) : loadErrores(p)}>{p}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ValidacionRutas({ rutas, loading, loadRutas }) {
  React.useEffect(() => { if (!rutas) loadRutas(); }, []);

  if (loading && !rutas) return <div className="loading-container"><Loader2 className="spinner" size={32} /></div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div className="card">
        <div className="card-header">
          <h3><Terminal size={18} /> Archivos Backend ({rutas?.backend?.length || 0})</h3>
          <button className="btn btn-outline btn-sm" onClick={loadRutas} disabled={loading}><RefreshCw size={14} /></button>
        </div>
        <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
          {rutas?.backend?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rutas.backend.map((f, i) => (
                <li key={i} style={{
                  padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                  background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13,
                  fontFamily: 'monospace'
                }}>
                  <FileText size={14} style={{ marginRight: 8, color: '#3b82f6' }} />{f}
                </li>
              ))}
            </ul>
          ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>Sin archivos</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><BookOpen size={18} /> Archivos Frontend ({rutas?.frontend?.length || 0})</h3>
        </div>
        <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
          {rutas?.frontend?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rutas.frontend.map((f, i) => (
                <li key={i} style={{
                  padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                  background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13,
                  fontFamily: 'monospace'
                }}>
                  <FileText size={14} style={{ marginRight: 8, color: '#22c55e' }} />{f}
                </li>
              ))}
            </ul>
          ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>Sin archivos</p>}
        </div>
      </div>
    </div>
  );
}

function Exportaciones({ exportaciones, loading, loadExportaciones }) {
  React.useEffect(() => { loadExportaciones(); }, []);

  const items = exportaciones?.data || [];
  const meta = exportaciones?.meta;

  return (
    <div className="card">
      <div className="card-header">
        <h3><Download size={18} /> Historial de exportaciones ({meta?.total || 0})</h3>
        <button className="btn btn-outline btn-sm" onClick={() => loadExportaciones()} disabled={loading}><RefreshCw size={14} /></button>
      </div>
      <div className="card-body">
        {loading ? <div className="loading-container"><Loader2 className="spinner" size={24} /></div> : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Tipo reporte</th>
                <th>Formato</th>
                <th>Registros</th>
                <th>Tamaño</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id_exportacion}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(e.fecha_generacion)}</td>
                  <td style={{ fontSize: 13 }}>{e.nombre_usuario || '-'}</td>
                  <td>{e.tipo_reporte}</td>
                  <td><span className="badge light">{e.formato}</span></td>
                  <td>{e.total_registros}</td>
                  <td>{e.tamano_bytes ? `${(e.tamano_bytes / 1024).toFixed(1)} KB` : '-'}</td>
                  <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.ruta_archivo || '-'}
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Sin exportaciones</td></tr>}
            </tbody>
          </table>
        )}
        {meta?.totalPaginas > 1 && (
          <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === meta.pagina ? 'btn-primary' : 'btn-outline'}`} onClick={() => loadExportaciones(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstadoServicio({ estado, verificacion, conectividad, loading, loadEstado, loadVerificacion, loadConectividad }) {
  React.useEffect(() => {
    if (!estado) loadEstado();
    if (!verificacion) loadVerificacion();
    if (!conectividad) loadConectividad();
  }, []);

  if (loading && !verificacion) return <div className="loading-container"><Loader2 className="spinner" size={32} /></div>;

  const v = verificacion?.verificaciones || [];
  const resumen = verificacion?.resumen;

  return (
    <div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <CheckCircle2 size={24} color="#22c55e" />
          <div className="stat-value">{resumen?.ok || 0}</div>
          <div className="stat-label">Verificaciones OK</div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={24} color={resumen?.alertas > 0 ? '#f59e0b' : '#94a3b8'} />
          <div className="stat-value">{resumen?.alertas || 0}</div>
          <div className="stat-label">Alertas</div>
        </div>
        <div className="stat-card">
          <AlertOctagon size={24} color={resumen?.errores > 0 ? '#ef4444' : '#94a3b8'} />
          <div className="stat-value">{resumen?.errores || 0}</div>
          <div className="stat-label">Errores</div>
        </div>
        <div className="stat-card">
          <Wifi size={24} color={conectividad?.db === 'conectado' ? '#22c55e' : '#ef4444'} />
          <div className="stat-value">{conectividad?.latencia_ms || 0}ms</div>
          <div className="stat-label">Latencia DB</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={loadVerificacion} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Verificando...' : 'Ejecutar verificación completa'}
        </button>
        <button className="btn btn-outline" onClick={loadEstado} disabled={loading}>
          <Database size={16} /> Estado tablas
        </button>
        <button className="btn btn-outline" onClick={loadConectividad} disabled={loading}>
          <Wifi size={16} /> Probar conectividad
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3><Activity size={18} /> Resultados de verificación</h3></div>
        <div className="card-body">
          {v.length ? (
            <table className="table">
              <thead><tr><th>Prueba</th><th>Estado</th><th>Detalle</th></tr></thead>
              <tbody>
                {v.map((item, i) => (
                  <tr key={i}>
                    <td>{item.prueba}</td>
                    <td>
                      <StatusBadge
                        ok={item.estado === 'OK'}
                        label={
                          item.estado === 'OK' ? 'OK' :
                          item.estado === 'ALERTA' ? 'Alerta' :
                          item.estado === 'SIN_DATOS' ? 'Sin datos' : 'Fallo'
                        }
                      />
                    </td>
                    <td style={{ fontSize: 13 }}>{item.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Sin datos de verificación</p>}
        </div>
      </div>

      {conectividad && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3><Server size={18} /> Tablas en base de datos</h3></div>
          <div className="card-body" style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="table">
              <thead><tr><th>Tabla</th><th>Registros</th><th>Creación</th><th>Última actualización</th></tr></thead>
              <tbody>
                {conectividad.tablas_becas?.map(t => (
                  <tr key={t.TABLE_NAME}>
                    <td style={{ fontSize: 13 }}>{t.TABLE_NAME}</td>
                    <td>{t.TABLE_ROWS}</td>
                    <td style={{ fontSize: 12 }}>{t.CREATE_TIME ? formatDate(t.CREATE_TIME) : '-'}</td>
                    <td style={{ fontSize: 12 }}>{t.UPDATE_TIME ? formatDate(t.UPDATE_TIME) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
