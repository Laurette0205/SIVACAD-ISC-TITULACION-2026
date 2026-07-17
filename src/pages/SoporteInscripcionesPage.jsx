import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Globe,
  Loader2,
  Plus,
  Route,
  Search,
  Server,
  Shield,
  Wifi,
  XCircle,
  RefreshCw,
  BookOpen,
  UserCheck,
  UserX
} from 'lucide-react';

const TABS = [
  { key: 'panel', label: 'Panel general', icon: Cpu },
  { key: 'incidencias', label: 'Incidencias técnicas', icon: AlertTriangle },
  { key: 'errores', label: 'Registro de errores', icon: Shield },
  { key: 'conectividad', label: 'Validación de conectividad', icon: Wifi },
  { key: 'logs', label: 'Logs del sistema', icon: FileText },
  { key: 'carga', label: 'Revisión de carga de datos', icon: Database }
];

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      className={`tab-btn ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <Icon size={16} />
      {tab.label}
    </button>
  );
}

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

export default function SoporteInscripcionesPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [panelData, setPanelData] = React.useState(null);
  const [incidenciasData, setIncidenciasData] = React.useState(null);
  const [erroresData, setErroresData] = React.useState(null);
  const [conectividadData, setConectividadData] = React.useState(null);
  const [logsData, setLogsData] = React.useState(null);
  const [cargaData, setCargaData] = React.useState(null);

  const [showForm, setShowForm] = React.useState(false);
  const [nuevaIncidencia, setNuevaIncidencia] = React.useState({ tipo: 'tecnica', gravedad: 'media', titulo: '', descripcion: '', modulo_afectado: '' });

  const fetchTab = async (tabKey) => {
    setLoading(true);
    setError('');
    try {
      let res;
      switch (tabKey) {
        case 'panel':
          res = await api.soporteInscripcionesPanel(token);
          setPanelData(res?.data || null);
          break;
        case 'incidencias':
          res = await api.soporteInscripcionesIncidencias(token);
          setIncidenciasData(res?.data || null);
          break;
        case 'errores':
          res = await api.soporteInscripcionesErrores(token, '?horas=168&limite=100');
          setErroresData(res?.data || null);
          break;
        case 'conectividad':
          res = await api.soporteInscripcionesConectividad(token);
          setConectividadData(res?.data || null);
          break;
        case 'logs':
          res = await api.soporteInscripcionesLogs(token, '?limite=200');
          setLogsData(res?.data || null);
          break;
        case 'carga':
          res = await api.soporteInscripcionesRevisionCarga(token);
          setCargaData(res?.data || null);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error fetching support data:', err);
      setError(err?.message || 'Error al consultar datos de soporte');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTab(tab);
  }, [tab]);

  const tryAgain = () => fetchTab(tab);

  const handleCrearIncidencia = async (e) => {
    e.preventDefault();
    try {
      await api.soporteInscripcionesCrearIncidencia(token, nuevaIncidencia);
      setShowForm(false);
      setNuevaIncidencia({ tipo: 'tecnica', gravedad: 'media', titulo: '', descripcion: '', modulo_afectado: '' });
      fetchTab('incidencias');
    } catch (err) {
      setError(err?.message || 'Error al crear incidencia');
    }
  };

  const handleCerrarIncidencia = async (id, estado, solucion) => {
    try {
      await api.soporteInscripcionesActualizarIncidencia(token, id, { estado, solucion: solucion || 'Resuelto por soporte técnico.' });
      fetchTab('incidencias');
    } catch (err) {
      setError(err?.message || 'Error al actualizar incidencia');
    }
  };

  const renderPanelGeneral = () => {
    if (!panelData) return <div className="auth-note">No hay datos de diagnóstico disponibles.</div>;

    const { db, incidencias, conteos, estados_inscripcion, errores_recientes_72h, tablas } = panelData;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          <StatBox
            icon={db?.estado === 'CONECTADA' ? CheckCircle2 : AlertTriangle}
            label="Estado DB"
            value={db?.estado || '—'}
            color={db?.estado === 'CONECTADA' ? 'var(--success)' : 'var(--danger)'}
          />
          <StatBox icon={Server} label="Inscripciones" value={conteos?.inscripciones ?? '—'} />
          <StatBox icon={Database} label="Auditoría" value={conteos?.auditoria ?? '—'} />
          <StatBox icon={UserCheck} label="Grupos_alumnos" value={conteos?.grupos_alumnos ?? '—'} />
          <StatBox icon={BookOpen} label="Cargas acad." value={conteos?.cargas_academicas ?? '—'} />
          <StatBox icon={AlertTriangle} label="Errores (72h)" value={errores_recientes_72h ?? '—'} color={errores_recientes_72h > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          <StatBox icon={AlertCircle} label="Incidencias total" value={incidencias?.total ?? '—'} />
          <StatBox icon={XCircle} label="Abiertas" value={incidencias?.abiertas ?? '—'} color={incidencias?.abiertas > 0 ? 'var(--danger)' : 'var(--success)'} />
          <StatBox icon={Activity} label="En proceso" value={incidencias?.en_proceso ?? '—'} color="var(--warning)" />
          <StatBox icon={CheckCircle2} label="Resueltas" value={incidencias?.resueltas ?? '—'} color="var(--success)" />
          <StatBox icon={AlertTriangle} label="Críticas abiertas" value={incidencias?.criticas_abiertas ?? '—'} color={incidencias?.criticas_abiertas > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        {tablas?.length > 0 && (
          <div className="section-card">
            <h3>Tablas del módulo inscripciones</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Tabla</th><th>Filas</th><th>Tamaño (KB)</th></tr>
                </thead>
                <tbody>
                  {tablas.map((t, i) => (
                    <tr key={i}>
                      <td>{t.tabla}</td>
                      <td>{t.filas ?? '—'}</td>
                      <td>{t.tamano_kb ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {estados_inscripcion?.length > 0 && (
          <div className="section-card">
            <h3>Inscripciones por estado</h3>
            <div className="list">
              {estados_inscripcion.map((e, i) => (
                <InfoRow key={i} label={e.estado} value={`${e.total} inscripción(es)`} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIncidencias = () => {
    if (!incidenciasData) return <div className="auth-note">No hay datos de incidencias.</div>;

    const { incidencias: items, stats } = incidenciasData;

    return (
      <div className="stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', flex: 1 }}>
            <StatBox icon={AlertCircle} label="Total" value={items?.length || 0} />
            {stats?.map((s, i) => (
              <StatBox key={i} icon={s.estado === 'abierta' ? XCircle : s.estado === 'en_proceso' ? Activity : CheckCircle2}
                label={s.estado} value={s.total} color={
                  s.estado === 'abierta' ? 'var(--danger)' : s.estado === 'en_proceso' ? 'var(--warning)' : 'var(--success)'
                } />
            ))}
            <StatBox icon={AlertTriangle} label="Críticas" value={items?.filter(i => i.gravedad === 'critica' && i.estado !== 'cerrada').length || 0} color="var(--danger)" />
          </div>
          <button className="btn primary" onClick={() => setShowForm(true)} style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Nueva incidencia
          </button>
        </div>

        {showForm && (
          <div className="section-card">
            <h3>Registrar nueva incidencia técnica</h3>
            <form onSubmit={handleCrearIncidencia} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select
                  value={nuevaIncidencia.tipo}
                  onChange={e => setNuevaIncidencia(p => ({ ...p, tipo: e.target.value }))}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="tecnica">Técnica</option>
                  <option value="acceso">Acceso</option>
                  <option value="datos">Datos</option>
                  <option value="conectividad">Conectividad</option>
                  <option value="otro">Otro</option>
                </select>
                <select
                  value={nuevaIncidencia.gravedad}
                  onChange={e => setNuevaIncidencia(p => ({ ...p, gravedad: e.target.value }))}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
                <input
                  type="text"
                  placeholder="Módulo afectado (ej: inscripciones, grupos, etc.)"
                  value={nuevaIncidencia.modulo_afectado}
                  onChange={e => setNuevaIncidencia(p => ({ ...p, modulo_afectado: e.target.value }))}
                  style={{ flex: 2, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>
              <input
                type="text"
                placeholder="Título de la incidencia"
                value={nuevaIncidencia.titulo}
                onChange={e => setNuevaIncidencia(p => ({ ...p, titulo: e.target.value }))}
                required
                style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <textarea
                placeholder="Descripción detallada del problema..."
                value={nuevaIncidencia.descripcion}
                onChange={e => setNuevaIncidencia(p => ({ ...p, descripcion: e.target.value }))}
                required
                rows={3}
                style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn primary">Registrar incidencia</button>
                <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {items?.length > 0 ? (
          <div className="section-card">
            <h3>Incidencias registradas</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Fecha</th><th>Tipo</th><th>Gravedad</th><th>Título</th><th>Módulo</th><th>Estado</th><th>Usuario</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {items.map((inc) => (
                    <tr key={inc.id_incidencia}>
                      <td>{inc.id_incidencia}</td>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(inc.created_at).toLocaleString()}</td>
                      <td><span className="badge light">{inc.tipo}</span></td>
                      <td><span className={`badge ${inc.gravedad === 'critica' || inc.gravedad === 'alta' ? 'warn' : 'light'}`}>{inc.gravedad}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.titulo}>{inc.titulo}</td>
                      <td>{inc.modulo_afectado || '—'}</td>
                      <td>
                        <span className={`badge ${inc.estado === 'abierta' ? 'warn' : inc.estado === 'en_proceso' ? 'light' : 'badge-success'}`}>
                          {inc.estado}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{inc.usuario_nombre || '—'}</td>
                      <td>
                        {inc.estado !== 'cerrada' && inc.estado !== 'resuelta' && (
                          <button className="btn secondary btn-sm" onClick={() => handleCerrarIncidencia(inc.id_incidencia, 'resuelta', '')}>
                            <CheckCircle2 size={14} /> Resolver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No hay incidencias registradas.</p>
          </div>
        )}
      </div>
    );
  };

  const renderErrores = () => {
    if (!erroresData) return <div className="auth-note">No hay datos de errores.</div>;

    const { horas_consulta, errores_auditoria, logs_error, total_errores, total_logs } = erroresData;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatBox icon={Shield} label="Errores auditoría" value={total_errores || 0} color={total_errores > 0 ? 'var(--danger)' : 'var(--success)'} />
          <StatBox icon={AlertTriangle} label="Logs error/warning" value={total_logs || 0} color={total_logs > 0 ? 'var(--warning)' : 'var(--success)'} />
        </div>

        <div className="auth-note">
          Mostrando errores de las últimas {horas_consulta || 168} horas.
        </div>

        {errores_auditoria?.length > 0 && (
          <div className="section-card">
            <h3>Errores en inscripciones_auditoria</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th><th>Estado ant.</th><th>Estado nuevo</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {errores_auditoria.map((e, i) => (
                    <tr key={e.id_auditoria || i}>
                      <td>{e.id_auditoria || '—'}</td>
                      <td>{e.usuario_nombre || '—'}</td>
                      <td>{e.rol_usuario || '—'}</td>
                      <td><span className="badge warn">{e.accion}</span></td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detalle || '—'}</td>
                      <td><span className="badge light">{e.estado_anterior || '—'}</span></td>
                      <td><span className="badge light">{e.estado_nuevo || '—'}</span></td>
                      <td>{e.ip || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{e.creado_en ? new Date(e.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {logs_error?.length > 0 && (
          <div className="section-card">
            <h3>Logs del sistema (error/warning)</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Nivel</th><th>Módulo</th><th>Acción</th><th>Mensaje</th><th>Usuario</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {logs_error.map((l, i) => (
                    <tr key={l.id_log || i}>
                      <td>{l.id_log || '—'}</td>
                      <td><span className={`badge ${l.nivel === 'error' ? 'warn' : 'light'}`}>{l.nivel}</span></td>
                      <td>{l.modulo}</td>
                      <td>{l.accion}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.mensaje}</td>
                      <td style={{ fontSize: '0.85rem' }}>{l.usuario_nombre || '—'}</td>
                      <td>{l.ip || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!errores_auditoria?.length && !logs_error?.length && (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No se detectaron errores en el sistema.</p>
          </div>
        )}
      </div>
    );
  };

  const renderConectividad = () => {
    if (!conectividadData) return <div className="auth-note">No hay datos de conectividad.</div>;

    const { tablas, total_accesibles, total_no_accesibles, foreign_keys } = conectividadData;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatBox icon={Server} label="Tablas verificadas" value={tablas?.length || 0} />
          <StatBox icon={CheckCircle2} label="Accesibles" value={total_accesibles || 0} color="var(--success)" />
          <StatBox icon={XCircle} label="No accesibles" value={total_no_accesibles || 0} color={total_no_accesibles > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        <div className="section-card">
          <h3>Estado de tablas</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Tabla</th><th>Accesible</th><th>Registros</th><th>Error</th></tr>
              </thead>
              <tbody>
                {tablas?.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace' }}>{t.tabla}</td>
                    <td>
                      {t.accesible ? (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> Sí
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={14} /> No
                        </span>
                      )}
                    </td>
                    <td>{t.registros ?? '—'}</td>
                    <td style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{t.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {foreign_keys?.length > 0 && (
          <div className="section-card">
            <h3>Integridad referencial (FKs)</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Tabla</th><th>FK</th><th>Referencia</th></tr>
                </thead>
                <tbody>
                  {foreign_keys.map((fk, i) => (
                    <tr key={i}>
                      <td>{fk.TABLE_NAME}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{fk.CONSTRAINT_NAME}</td>
                      <td>{fk.REFERENCED_TABLE_NAME}.{fk.REFERENCED_COLUMN_NAME}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLogs = () => {
    if (!logsData) return <div className="auth-note">No hay logs disponibles.</div>;

    const { logs, total, filtros } = logsData;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatBox icon={FileText} label="Total logs" value={total || 0} />
          <StatBox icon={Activity} label="Mostrando" value={logs?.length || 0} />
        </div>

        {filtros?.niveles?.length > 0 && (
          <div className="auth-note">
            Niveles disponibles: {filtros.niveles.join(', ')}
            {filtros?.modulos?.length > 0 && ` | Módulos: ${filtros.modulos.join(', ')}`}
          </div>
        )}

        {logs?.length > 0 ? (
          <div className="section-card">
            <h3>Logs del sistema de inscripciones</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Origen</th><th>ID</th><th>Nivel</th><th>Módulo</th><th>Acción</th><th>Mensaje</th><th>Usuario</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={i}>
                      <td><span className="badge light">{l.origen}</span></td>
                      <td>{l.id_registro}</td>
                      <td><span className={`badge ${l.nivel === 'error' ? 'warn' : l.nivel === 'warning' ? 'light' : 'badge-success'}`}>{l.nivel}</span></td>
                      <td>{l.modulo}</td>
                      <td>{l.accion}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.mensaje}>{l.mensaje}</td>
                      <td style={{ fontSize: '0.85rem' }}>{l.usuario_nombre || '—'}</td>
                      <td>{l.ip || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{l.creado_en ? new Date(l.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="auth-note">No se encontraron logs.</div>
        )}
      </div>
    );
  };

  const renderRevisionCarga = () => {
    if (!cargaData) return <div className="auth-note">No hay datos de revisión de carga.</div>;

    const { stats, inconsistencias, advertencias, total_problemas, detalle_duplicados, detalle_cargas_sin_alumnos } = cargaData;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatBox icon={Database} label="Total inscripciones" value={stats?.total_inscripciones ?? '—'} />
          <StatBox icon={XCircle} label="Sin grupo" value={stats?.sin_grupo ?? '—'} color={stats?.sin_grupo > 0 ? 'var(--danger)' : 'var(--success)'} />
          <StatBox icon={UserX} label="Sin grupos_alumnos" value={stats?.alumnos_sin_grupo_alumno ?? '—'} color={stats?.alumnos_sin_grupo_alumno > 0 ? 'var(--danger)' : 'var(--success)'} />
          <StatBox icon={AlertTriangle} label="Bajas (7d)" value={stats?.bajas_recientes_7d ?? '—'} color={stats?.bajas_recientes_7d > 0 ? 'var(--warning)' : 'var(--success)'} />
          <StatBox icon={AlertCircle} label="Problemas" value={total_problemas || 0} color={total_problemas > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        {inconsistencias?.length > 0 && (
          <div className="section-card">
            <h3>Inconsistencias críticas</h3>
            <div className="list">
              {inconsistencias.map((inc, i) => (
                <div key={i} className="list-item warn">
                  <strong>{inc.tipo?.replace(/_/g, ' ')}</strong>
                  <span>{inc.mensaje}</span>
                  <small className="muted">Gravedad: {inc.gravedad}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {advertencias?.length > 0 && (
          <div className="section-card">
            <h3>Advertencias</h3>
            <div className="list">
              {advertencias.map((adv, i) => (
                <div key={i} className={`list-item ${getNivelClass(adv.gravedad)}`}>
                  <strong>{adv.tipo?.replace(/_/g, ' ')}</strong>
                  <span>{adv.mensaje}</span>
                  <small className="muted">Gravedad: {adv.gravedad}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {detalle_duplicados?.length > 0 && (
          <div className="section-card">
            <h3>Inscripciones duplicadas ({detalle_duplicados.length})</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>ID Alumno</th><th>ID Periodo</th><th>Total</th></tr></thead>
                <tbody>
                  {detalle_duplicados.map((d, i) => (
                    <tr key={i}><td>{d.id_alumno}</td><td>{d.id_periodo}</td><td>{d.total}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detalle_cargas_sin_alumnos?.length > 0 && (
          <div className="section-card">
            <h3>Cargas académicas sin alumnos ({detalle_cargas_sin_alumnos.length})</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Grupo</th><th>Materia</th><th>ID Periodo</th></tr></thead>
                <tbody>
                  {detalle_cargas_sin_alumnos.map((c, i) => (
                    <tr key={i}><td>{c.nombre_grupo}</td><td>{c.nombre_materia}</td><td>{c.id_periodo}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!inconsistencias?.length && !advertencias?.length && (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No se detectaron problemas en la carga de datos. La información está íntegra.</p>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="auth-note" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2rem' }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando datos...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="stack">
          <div className="alert error">{error}</div>
          <button type="button" className="btn secondary" onClick={tryAgain}>
            Reintentar
          </button>
        </div>
      );
    }

    switch (tab) {
      case 'panel': return renderPanelGeneral();
      case 'incidencias': return renderIncidencias();
      case 'errores': return renderErrores();
      case 'conectividad': return renderConectividad();
      case 'logs': return renderLogs();
      case 'carga': return renderRevisionCarga();
      default: return null;
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Soporte técnico</div>
          <h1>Panel de soporte — Inscripciones</h1>
          <p>Incidencias técnicas, registro de errores, validación de conectividad, logs del sistema y revisión de carga de datos del módulo de inscripciones. Alcance técnico transversal a todo el sistema.</p>
        </div>
        <button className="btn secondary" onClick={tryAgain} style={{ alignSelf: 'flex-start' }}>
          <RefreshCw size={16} /> Recargar
        </button>
      </section>

      <div className="tabs">
        {TABS.map((t) => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {renderContent()}
    </div>
  );
}
