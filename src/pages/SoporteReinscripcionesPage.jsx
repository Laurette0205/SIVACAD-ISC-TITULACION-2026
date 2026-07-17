import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, Cpu,
  Database, FileText, Globe, Loader2, Plus, Route, Search,
  Server, Shield, Wifi, XCircle, RefreshCw, BookOpen, UserCheck, UserX
} from 'lucide-react';

const TABS = [
  { key: 'panel', label: 'Mesa técnica', icon: Cpu },
  { key: 'incidencias', label: 'Incidencias técnicas', icon: AlertTriangle },
  { key: 'monitoreo', label: 'Monitoreo de sincronización', icon: Activity },
  { key: 'errores', label: 'Errores de proceso', icon: Shield },
  { key: 'logs', label: 'Registros de operación', icon: FileText }
];

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color || 'var(--accent)' }}>
      <Icon size={22} style={{ color: color || 'var(--accent)' }} />
      <div>
        <strong style={{ fontSize: '1.4rem' }}>{value ?? '—'}</strong>
        <span className="muted">{label}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="list-item">
      <strong>{label}</strong>
      <span>{value ?? '—'}</span>
    </div>
  );
}

function getNivelClass(nivel) {
  if (!nivel) return '';
  const n = String(nivel).toUpperCase();
  if (n === 'ALTO' || n === 'ALTA' || n === 'CRITICA' || n === 'CRÍTICA') return 'warn';
  if (n === 'MEDIO' || n === 'MEDIA') return '';
  return 'ok';
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function BadgeType({ type, children }) {
  const cls = type === 'success' ? 'badge badge-success' :
    type === 'danger' || type === 'critical' || type === 'error' ? 'badge badge-danger' :
    type === 'warning' ? 'badge badge-warning' :
    type === 'info' ? 'badge badge-info' : 'badge badge-light';
  return <span className={cls}>{children}</span>;
}

export default function SoporteReinscripcionesPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState({ panel: false, incidencias: false, monitoreo: false, errores: false, logs: false });

  const [panelData, setPanelData] = React.useState(null);
  const [incidencias, setIncidencias] = React.useState([]);
  const [monitoreo, setMonitoreo] = React.useState([]);
  const [errores, setErrores] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [integridad, setIntegridad] = React.useState(null);

  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [filtroIncidencias, setFiltroIncidencias] = React.useState({ estado: '', gravedad: '', tipo: '' });
  const [filtroMonitoreo, setFiltroMonitoreo] = React.useState({ tipo: '' });
  const [filtroErrores, setFiltroErrores] = React.useState({ tipo: '' });
  const [filtroLogs, setFiltroLogs] = React.useState({ tipo: '', accion: '' });

  const [nuevaIncidencia, setNuevaIncidencia] = React.useState({ tipo: 'sistema', gravedad: 'media', titulo: '', descripcion: '' });
  const [mostrarFormIncidencia, setMostrarFormIncidencia] = React.useState(false);
  const [nuevoMonitoreo, setNuevoMonitoreo] = React.useState({ tipo: 'sincronizacion', id_periodo: '', total_registros: '' });

  // ========== LOADERS ==========

  const loadPanel = React.useCallback(async () => {
    if (!token) return;
    setLoading(p => ({ ...p, panel: true }));
    setError('');
    try {
      const res = await api.soporteReinscripcionesPanel(token);
      setPanelData(res?.data || null);
    } catch (err) {
      console.error('Error panel soporte reinscripciones:', err);
      setError(err?.message || 'Error al cargar panel');
    } finally {
      setLoading(p => ({ ...p, panel: false }));
    }
  }, [token]);

  const loadIncidencias = React.useCallback(async (params = '') => {
    if (!token) return;
    setLoading(p => ({ ...p, incidencias: true }));
    setError('');
    try {
      const res = await api.soporteReinscripcionesIncidencias(token, params);
      setIncidencias(res?.data || []);
    } catch (err) {
      console.error('Error incidencias soporte reinscripciones:', err);
      setError(err?.message || 'Error al cargar incidencias');
    } finally {
      setLoading(p => ({ ...p, incidencias: false }));
    }
  }, [token]);

  const loadMonitoreo = React.useCallback(async (params = '') => {
    if (!token) return;
    setLoading(p => ({ ...p, monitoreo: true }));
    setError('');
    try {
      const res = await api.soporteReinscripcionesMonitoreo(token, params);
      setMonitoreo(res?.data || []);
    } catch (err) {
      console.error('Error monitoreo soporte reinscripciones:', err);
      setError(err?.message || 'Error al cargar monitoreo');
    } finally {
      setLoading(p => ({ ...p, monitoreo: false }));
    }
  }, [token]);

  const loadErrores = React.useCallback(async (params = '') => {
    if (!token) return;
    setLoading(p => ({ ...p, errores: true }));
    setError('');
    try {
      const res = await api.soporteReinscripcionesErrores(token, params);
      setErrores(res?.data || []);
    } catch (err) {
      console.error('Error errores soporte reinscripciones:', err);
      setError(err?.message || 'Error al cargar errores');
    } finally {
      setLoading(p => ({ ...p, errores: false }));
    }
  }, [token]);

  const loadLogs = React.useCallback(async (params = '') => {
    if (!token) return;
    setLoading(p => ({ ...p, logs: true }));
    setError('');
    try {
      const res = await api.soporteReinscripcionesLogs(token, params);
      setLogs(res?.data || []);
    } catch (err) {
      console.error('Error logs soporte reinscripciones:', err);
      setError(err?.message || 'Error al cargar logs');
    } finally {
      setLoading(p => ({ ...p, logs: false }));
    }
  }, [token]);

  React.useEffect(() => {
    loadPanel();
    loadIncidencias();
    loadMonitoreo();
    loadErrores();
    loadLogs();
  }, [loadPanel, loadIncidencias, loadMonitoreo, loadErrores, loadLogs]);

  // ========== HANDLERS ==========

  const buildQueryString = (filtros) => {
    const parts = Object.entries(filtros).filter(([, v]) => v);
    return parts.length ? '?' + parts.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  };

  const handleFiltrarIncidencias = () => {
    loadIncidencias(buildQueryString(filtroIncidencias));
  };

  const handleCrearIncidencia = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.soporteReinscripcionesCrearIncidencia(token, nuevaIncidencia);
      setMessage('Incidencia registrada correctamente');
      setNuevaIncidencia({ tipo: 'sistema', gravedad: 'media', titulo: '', descripcion: '' });
      setMostrarFormIncidencia(false);
      await loadIncidencias();
      await loadPanel();
    } catch (err) {
      setError(err?.message || 'Error al registrar incidencia');
    }
  };

  const handleActualizarIncidencia = async (id, campos) => {
    try {
      await api.soporteReinscripcionesActualizarIncidencia(token, id, campos);
      setMessage('Incidencia actualizada');
      await loadIncidencias();
      await loadPanel();
    } catch (err) {
      setError(err?.message || 'Error al actualizar incidencia');
    }
  };

  const handleIniciarMonitoreo = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.soporteReinscripcionesIniciarMonitoreo(token, {
        ...nuevoMonitoreo,
        total_registros: Number(nuevoMonitoreo.total_registros) || 0
      });
      setMessage('Monitoreo iniciado');
      setNuevoMonitoreo({ tipo: 'sincronizacion', id_periodo: '', total_registros: '' });
      await loadMonitoreo();
    } catch (err) {
      setError(err?.message || 'Error al iniciar monitoreo');
    }
  };

  const handleReintentar = async (idMonitoreo) => {
    try {
      await api.soporteReinscripcionesReintentar(token, { id_monitoreo: idMonitoreo });
      setMessage('Reintento iniciado');
      await loadMonitoreo();
    } catch (err) {
      setError(err?.message || 'Error al reintentar');
    }
  };

  const handleVerificarIntegridad = async () => {
    setError('');
    setMessage('');
    try {
      const res = await api.soporteReinscripcionesVerificarIntegridad(token);
      setIntegridad(res?.data || null);
      setMessage('Verificación de integridad completada');
    } catch (err) {
      setError(err?.message || 'Error al verificar integridad');
    }
  };

  // ========== RENDER TABS ==========

  const renderPanel = () => {
    if (loading.panel) return <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando panel técnico...</div>;
    if (!panelData) return <div className="alert info">Selecciona "Cargar panel" para ver el estado del sistema.</div>;

    const { db, incidencias: incStats, conteos, estados_reinscripcion, reinscripciones_hoy, errores_recientes_72h, tablas } = panelData;

    return (
      <div className="stack">
        <div className="stats-grid">
          <StatBox icon={Server} label="Estado BD" value={db.estado} color={db.estado === 'CONECTADA' ? '#10b981' : '#ef4444'} />
          <StatBox icon={AlertTriangle} label="Incidencias abiertas" value={incStats?.abiertas || 0} color="#f59e0b" />
          <StatBox icon={XCircle} label="Críticas abiertas" value={incStats?.criticas_abiertas || 0} color="#ef4444" />
          <StatBox icon={BookOpen} label="Reinscripciones hoy" value={reinscripciones_hoy} color="#3b82f6" />
          <StatBox icon={Shield} label="Errores (72h)" value={errores_recientes_72h} color={errores_recientes_72h > 0 ? '#ef4444' : '#10b981'} />
          <StatBox icon={Database} label="Total reinscripciones" value={conteos?.reinscripciones || 0} color="#6366f1" />
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-header"><h3>Conteos del módulo</h3></div>
            <div className="card-body">
              <InfoRow label="Reinscripciones registradas" value={conteos?.reinscripciones} />
              <InfoRow label="Auditoría" value={conteos?.auditoria} />
              <InfoRow label="Logs de soporte" value={conteos?.logs} />
              <InfoRow label="Monitoreos" value={conteos?.monitoreo} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Estados de reinscripción</h3></div>
            <div className="card-body">
              {estados_reinscripcion?.length ? estados_reinscripcion.map(e => (
                <InfoRow key={e.estado} label={e.estado} value={e.total} />
              )) : <p className="muted">Sin datos</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Tablas del módulo</h3></div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Tabla</th>
                    <th>Filas</th>
                    <th>Tamaño (KB)</th>
                  </tr>
                </thead>
                <tbody>
                  {tablas?.map(t => (
                    <tr key={t.tabla}>
                      <td><code>{t.tabla}</code></td>
                      <td>{t.filas ?? '—'}</td>
                      <td>{t.tamano_kb ?? '—'}</td>
                    </tr>
                  )) || <tr><td colSpan="3" className="muted">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-outline" onClick={loadPanel}><RefreshCw size={16} /> Actualizar panel</button>
          </div>
        </div>
      </div>
    );
  };

  const renderIncidencias = () => (
    <div className="stack">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Mesa técnica de incidencias</h3>
          <button className="btn btn-primary" onClick={() => setMostrarFormIncidencia(!mostrarFormIncidencia)}>
            <Plus size={16} /> {mostrarFormIncidencia ? 'Cancelar' : 'Nueva incidencia'}
          </button>
        </div>

        {mostrarFormIncidencia && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <form onSubmit={handleCrearIncidencia}>
              <div className="grid-two">
                <div className="field">
                  <small>Tipo</small>
                  <select value={nuevaIncidencia.tipo} onChange={e => setNuevaIncidencia({ ...nuevaIncidencia, tipo: e.target.value })}>
                    <option value="sistema">Sistema</option>
                    <option value="carga">Carga de datos</option>
                    <option value="sincronizacion">Sincronización</option>
                    <option value="integridad">Integridad</option>
                    <option value="conectividad">Conectividad</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="field">
                  <small>Gravedad</small>
                  <select value={nuevaIncidencia.gravedad} onChange={e => setNuevaIncidencia({ ...nuevaIncidencia, gravedad: e.target.value })}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <small>Título *</small>
                <input value={nuevaIncidencia.titulo} onChange={e => setNuevaIncidencia({ ...nuevaIncidencia, titulo: e.target.value })} required placeholder="Describe el problema..." />
              </div>
              <div className="field">
                <small>Descripción</small>
                <textarea value={nuevaIncidencia.descripcion} onChange={e => setNuevaIncidencia({ ...nuevaIncidencia, descripcion: e.target.value })} rows={3} />
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={16} /> Registrar incidencia</button>
            </form>
          </div>
        )}

        <div className="card-body">
          <div className="row gap wrap" style={{ marginBottom: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <small>Estado</small>
              <select value={filtroIncidencias.estado} onChange={e => setFiltroIncidencias({ ...filtroIncidencias, estado: e.target.value })}>
                <option value="">Todos</option>
                <option value="abierta">Abierta</option>
                <option value="en_proceso">En proceso</option>
                <option value="resuelta">Resuelta</option>
                <option value="cerrada">Cerrada</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <small>Gravedad</small>
              <select value={filtroIncidencias.gravedad} onChange={e => setFiltroIncidencias({ ...filtroIncidencias, gravedad: e.target.value })}>
                <option value="">Todas</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <small>Tipo</small>
              <select value={filtroIncidencias.tipo} onChange={e => setFiltroIncidencias({ ...filtroIncidencias, tipo: e.target.value })}>
                <option value="">Todos</option>
                <option value="sistema">Sistema</option>
                <option value="carga">Carga</option>
                <option value="sincronizacion">Sincronización</option>
                <option value="integridad">Integridad</option>
                <option value="conectividad">Conectividad</option>
              </select>
            </div>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-outline" onClick={handleFiltrarIncidencias}><Search size={16} /> Filtrar</button>
            </div>
          </div>

          {loading.incidencias ? (
            <p className="muted">Cargando incidencias...</p>
          ) : incidencias.length === 0 ? (
            <div className="text-center py-4">
              <AlertTriangle size={48} className="muted mb-2" />
              <p className="muted">No hay incidencias técnicas registradas en reinscripciones.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {incidencias.map(inc => (
                <div key={inc.id_incidencia} className={`card ${inc.estado === 'abierta' ? 'border-warning' : inc.estado === 'en_proceso' ? 'border-info' : ''}`}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div className="row gap" style={{ alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <BadgeType type={inc.gravedad === 'critica' || inc.gravedad === 'alta' ? 'danger' : inc.gravedad === 'media' ? 'warning' : 'info'}>
                            {inc.gravedad?.toUpperCase()}
                          </BadgeType>
                          <BadgeType type={inc.estado === 'resuelta' || inc.estado === 'cerrada' ? 'success' : inc.estado === 'en_proceso' ? 'warning' : 'danger'}>
                            {inc.estado?.replace('_', ' ')}
                          </BadgeType>
                          <BadgeType type="info">{inc.tipo}</BadgeType>
                          <small className="muted">#{inc.id_incidencia}</small>
                        </div>
                        <strong>{inc.titulo}</strong>
                        {inc.descripcion && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#6b7280' }}>{inc.descripcion}</p>}
                        <small className="muted">
                          {formatDate(inc.creado_en)}
                          {inc.reportado_por_nombre ? ` • Reportó: ${inc.reportado_por_nombre}` : ''}
                          {inc.asignado_a_nombre ? ` • Asignado: ${inc.asignado_a_nombre}` : ''}
                        </small>
                        {inc.solucion && <div className="alert alert-success mt-1" style={{ fontSize: '0.85rem' }}>Solución: {inc.solucion}</div>}
                      </div>
                      <div className="row gap" style={{ flexWrap: 'wrap' }}>
                        {inc.estado === 'abierta' && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleActualizarIncidencia(inc.id_incidencia, { estado: 'en_proceso' })}>
                            Tomar en proceso
                          </button>
                        )}
                        {inc.estado === 'en_proceso' && (
                          <button className="btn btn-sm btn-outline" onClick={() => {
                            const sol = prompt('Describa la solución:');
                            if (sol) handleActualizarIncidencia(inc.id_incidencia, { estado: 'resuelta', solucion: sol });
                          }}>
                            Resolver
                          </button>
                        )}
                        {inc.estado !== 'cerrada' && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleActualizarIncidencia(inc.id_incidencia, { estado: 'cerrada' })}>
                            Cerrar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMonitoreo = () => (
    <div className="stack">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Monitoreo de sincronización</h3>
          <button className="btn btn-outline" onClick={loadMonitoreo}><RefreshCw size={16} /> Actualizar</button>
        </div>

        <div className="card-body">
          <form onSubmit={handleIniciarMonitoreo} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Iniciar nuevo monitoreo</h4>
            <div className="row gap wrap">
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <small>Tipo</small>
                <select value={nuevoMonitoreo.tipo} onChange={e => setNuevoMonitoreo({ ...nuevoMonitoreo, tipo: e.target.value })}>
                  <option value="sincronizacion">Sincronización</option>
                  <option value="carga_masiva">Carga masiva</option>
                  <option value="validacion">Validación</option>
                  <option value="integridad">Integridad</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <small>ID Período</small>
                <input type="number" value={nuevoMonitoreo.id_periodo} onChange={e => setNuevoMonitoreo({ ...nuevoMonitoreo, id_periodo: e.target.value })} required placeholder="Ej: 1" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 100 }}>
                <small>Total registros</small>
                <input type="number" value={nuevoMonitoreo.total_registros} onChange={e => setNuevoMonitoreo({ ...nuevoMonitoreo, total_registros: e.target.value })} placeholder="0" />
              </div>
              <div className="field" style={{ alignSelf: 'flex-end' }}>
                <button className="btn btn-primary" type="submit"><Activity size={16} /> Iniciar</button>
              </div>
            </div>
          </form>

          <div className="field" style={{ marginBottom: '0.75rem' }}>
            <small>Filtrar por tipo</small>
            <select value={filtroMonitoreo.tipo} onChange={e => {
              setFiltroMonitoreo({ tipo: e.target.value });
              loadMonitoreo(buildQueryString({ tipo: e.target.value }));
            }}>
              <option value="">Todos</option>
              <option value="sincronizacion">Sincronización</option>
              <option value="carga_masiva">Carga masiva</option>
              <option value="validacion">Validación</option>
              <option value="integridad">Integridad</option>
            </select>
          </div>

          {loading.monitoreo ? (
            <p className="muted">Cargando monitoreo...</p>
          ) : monitoreo.length === 0 ? (
            <div className="text-center py-4">
              <Activity size={48} className="muted mb-2" />
              <p className="muted">No hay registros de monitoreo.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Período</th>
                    <th>Estado</th>
                    <th>Registros</th>
                    <th>Procesados</th>
                    <th>Errores</th>
                    <th>Inicio</th>
                    <th>Completado</th>
                    <th>Ejecutor</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoreo.map(m => (
                    <tr key={m.id_monitoreo}>
                      <td><code>#{m.id_monitoreo}</code></td>
                      <td><BadgeType type="info">{m.tipo?.replace('_', ' ')}</BadgeType></td>
                      <td>{m.nombre_periodo || m.id_periodo}</td>
                      <td>
                        <BadgeType type={m.estado === 'completado' ? 'success' : m.estado === 'fallido' ? 'danger' : m.estado === 'en_curso' ? 'warning' : 'info'}>
                          {m.estado?.replace('_', ' ')}
                        </BadgeType>
                      </td>
                      <td>{m.total_registros}</td>
                      <td>{m.procesados}</td>
                      <td>{m.errores > 0 ? <span style={{ color: '#ef4444', fontWeight: 600 }}>{m.errores}</span> : m.errores}</td>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(m.iniciado_en)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(m.completado_en)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{m.ejecutado_por_nombre || '—'}</td>
                      <td>
                        {m.estado === 'fallido' && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleReintentar(m.id_monitoreo)}>
                            <RefreshCw size={14} /> Reintentar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderErrores = () => (
    <div className="stack">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Errores de proceso</h3>
          <div className="row gap">
            <button className="btn btn-outline" onClick={handleVerificarIntegridad}><Shield size={16} /> Verificar integridad</button>
            <button className="btn btn-outline" onClick={() => loadErrores()}><RefreshCw size={16} /> Actualizar</button>
          </div>
        </div>

        {integridad && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <h4>Resultados de verificación de integridad</h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <BadgeType type={integridad.resumen?.errores === 0 ? 'success' : 'danger'}>
                {integridad.resumen?.errores || 0} errores
              </BadgeType>
              <BadgeType type={integridad.resumen?.warnings === 0 ? 'success' : 'warning'}>
                {integridad.resumen?.warnings || 0} advertencias
              </BadgeType>
            </div>
            <div className="list">
              {integridad.resultados?.map((r, i) => (
                <div key={i} className="list-item">
                  <div className="row gap" style={{ alignItems: 'center' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: r.estado === 'ok' ? '#d1fae5' : r.estado === 'warning' ? '#fef3c7' : '#fee2e2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: r.estado === 'ok' ? '#10b981' : r.estado === 'warning' ? '#f59e0b' : '#ef4444',
                      fontSize: '0.75rem', fontWeight: 700
                    }}>
                      {r.estado === 'ok' ? '✓' : r.estado === 'warning' ? '!' : '✗'}
                    </div>
                    <div>
                      <strong>{r.prueba}</strong>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>{r.detalle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-body">
          <div className="field" style={{ marginBottom: '0.75rem' }}>
            <small>Filtrar por tipo</small>
            <select value={filtroErrores.tipo} onChange={e => {
              setFiltroErrores({ tipo: e.target.value });
              loadErrores(buildQueryString({ tipo: e.target.value }));
            }}>
              <option value="">Todos</option>
              <option value="error">Error</option>
              <option value="critical">Crítico</option>
            </select>
          </div>

          {loading.errores ? (
            <p className="muted">Cargando errores...</p>
          ) : errores.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} style={{ color: '#10b981', opacity: 0.5 }} />
              <p className="muted">No hay errores de proceso registrados en las últimas 72h.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Acción</th>
                    <th>Descripción</th>
                    <th>Usuario</th>
                    <th>Reinscripción</th>
                    <th>Inscripción</th>
                  </tr>
                </thead>
                <tbody>
                  {errores.map(e => (
                    <tr key={e.id_log}>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(e.creado_en)}</td>
                      <td>
                        <BadgeType type={e.tipo === 'critical' ? 'danger' : 'warning'}>
                          {e.tipo}
                        </BadgeType>
                      </td>
                      <td><code style={{ fontSize: '0.75rem' }}>{e.accion}</code></td>
                      <td style={{ maxWidth: 250, fontSize: '0.85rem' }}>{e.descripcion || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{e.usuario_nombre || '—'}</td>
                      <td>{e.id_reinscripcion ? <code>#{e.id_reinscripcion}</code> : '—'}</td>
                      <td>{e.id_inscripcion ? <code>#{e.id_inscripcion}</code> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="stack">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Registros de operación</h3>
          <button className="btn btn-outline" onClick={() => loadLogs()}><RefreshCw size={16} /> Actualizar</button>
        </div>
        <div className="card-body">
          <div className="row gap wrap" style={{ marginBottom: '0.75rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <small>Tipo</small>
              <select value={filtroLogs.tipo} onChange={e => setFiltroLogs({ ...filtroLogs, tipo: e.target.value })}>
                <option value="">Todos</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 150 }}>
              <small>Acción</small>
              <input value={filtroLogs.accion} onChange={e => setFiltroLogs({ ...filtroLogs, accion: e.target.value })} placeholder="Ej: CREAR_INCIDENCIA" />
            </div>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => loadLogs(buildQueryString(filtroLogs))}><Search size={16} /> Filtrar</button>
            </div>
          </div>

          {loading.logs ? (
            <p className="muted">Cargando logs...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-4">
              <FileText size={48} style={{ opacity: 0.3 }} />
              <p className="muted">No hay registros de operación.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Acción</th>
                    <th>Descripción</th>
                    <th>Usuario</th>
                    <th>IP</th>
                    <th>Reinscripción</th>
                    <th>Inscripción</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id_log}>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(log.creado_en)}</td>
                      <td>
                        <BadgeType type={log.tipo === 'critical' ? 'danger' : log.tipo === 'error' ? 'danger' : log.tipo === 'warning' ? 'warning' : 'info'}>
                          {log.tipo}
                        </BadgeType>
                      </td>
                      <td><code style={{ fontSize: '0.75rem' }}>{log.accion}</code></td>
                      <td style={{ maxWidth: 250, fontSize: '0.85rem' }}>{log.descripcion || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{log.usuario_nombre || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}><code>{log.ip_origen || '—'}</code></td>
                      <td>{log.id_reinscripcion ? <code>#{log.id_reinscripcion}</code> : '—'}</td>
                      <td>{log.id_inscripcion ? <code>#{log.id_inscripcion}</code> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ========== RENDER PRINCIPAL ==========

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Cpu size={14} /> Soporte técnico • Reinscripciones</div>
          <h1>Soporte — Reinscripciones</h1>
          <p>
            Mesa técnica de incidencias, monitoreo de sincronización, errores de proceso
            y registros de operación del módulo de reinscripciones.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Estado</small>
            <strong>{panelData?.db?.estado || '—'}</strong>
          </div>
          <div className="meta-card">
            <small>Incidencias abiertas</small>
            <strong>{panelData?.incidencias?.abiertas || 0}</strong>
          </div>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} type="button"
            className={`btn ${activeTab === tab.key ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'panel' && renderPanel()}
      {activeTab === 'incidencias' && renderIncidencias()}
      {activeTab === 'monitoreo' && renderMonitoreo()}
      {activeTab === 'errores' && renderErrores()}
      {activeTab === 'logs' && renderLogs()}
    </div>
  );
}
