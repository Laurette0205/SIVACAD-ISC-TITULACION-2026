import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Globe,
  Loader2,
  Route,
  Server,
  Shield,
  Wifi
} from 'lucide-react';

const TABS = [
  { key: 'diagnostico', label: 'Diagnóstico técnico', icon: Cpu },
  { key: 'incidencias', label: 'Incidencias de carga', icon: AlertTriangle },
  { key: 'errores', label: 'Errores de validación', icon: Shield },
  { key: 'registros', label: 'Registros de falla', icon: FileText },
  { key: 'rutas', label: 'Verificación de rutas', icon: Route },
  { key: 'auditoria', label: 'Auditoría', icon: Database }
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
  if (n === 'ALTO') return 'warn';
  if (n === 'MEDIO') return '';
  return 'ok';
}

export default function SoporteEvaluacionesPage() {
  const { token } = useAuth();
  const [tab, setTab] = React.useState('diagnostico');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [diagnostico, setDiagnostico] = React.useState(null);
  const [incidencias, setIncidencias] = React.useState(null);
  const [errores, setErrores] = React.useState(null);
  const [registros, setRegistros] = React.useState(null);
  const [rutas, setRutas] = React.useState(null);
  const [auditoria, setAuditoria] = React.useState(null);

  const horaFiltro = React.useRef(72);

  const fetchTab = async (tabKey) => {
    setLoading(true);
    setError('');
    try {
      let res;
      switch (tabKey) {
        case 'diagnostico':
          res = await api.soporteDiagnostico(token);
          setDiagnostico(res?.data || null);
          break;
        case 'incidencias':
          res = await api.soporteIncidencias(token, `?horas=${horaFiltro.current}`);
          setIncidencias(res?.data || null);
          break;
        case 'errores':
          res = await api.soporteErroresValidacion(token);
          setErrores(res?.data || null);
          break;
        case 'registros':
          res = await api.soporteRegistros(token, '?limite=100');
          setRegistros(res?.data || null);
          break;
        case 'rutas':
          res = await api.soporteVerificarRutas(token);
          setRutas(res?.data || null);
          break;
        case 'auditoria':
          res = await api.soporteRegistros(token, '?limite=200');
          setAuditoria(res?.data || null);
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

  const renderDiagnostico = () => {
    if (!diagnostico) {
      return <div className="auth-note">No hay datos de diagnóstico disponibles.</div>;
    }

    const { db, conteos, estados_evaluacion, accesos_recientes, alertas_recientes, tablas } = diagnostico;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatBox
            icon={db?.estado === 'CONECTADA' ? CheckCircle2 : AlertTriangle}
            label="Estado DB"
            value={db?.estado || '—'}
            color={db?.estado === 'CONECTADA' ? 'var(--success)' : 'var(--danger)'}
          />
          <StatBox icon={Server} label="Evaluaciones" value={conteos?.evaluaciones ?? '—'} />
          <StatBox icon={Activity} label="Resultados" value={conteos?.resultados ?? '—'} />
          <StatBox icon={FileText} label="Respuestas" value={conteos?.respuestas ?? '—'} />
          <StatBox icon={Database} label="Auditoría" value={conteos?.auditoria ?? '—'} />
          <StatBox icon={AlertTriangle} label="Alertas" value={conteos?.alertas ?? '—'} />
        </div>

        {tablas?.length > 0 && (
          <div className="section-card">
            <h3>Tablas del módulo</h3>
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

        {estados_evaluacion?.length > 0 && (
          <div className="section-card">
            <h3>Evaluaciones por estado</h3>
            <div className="list">
              {estados_evaluacion.map((e, i) => (
                <InfoRow key={i} label={e.estado} value={`${e.total} evaluación(es)`} />
              ))}
            </div>
          </div>
        )}

        <div className="two-col">
          {accesos_recientes?.length > 0 && (
            <div className="section-card">
              <h3>Accesos recientes</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Usuario</th><th>Acción</th><th>Detalle</th><th>Fecha</th></tr>
                  </thead>
                  <tbody>
                    {(accesos_recientes || []).slice(0, 10).map((a, i) => (
                      <tr key={i}>
                        <td>{a.usuario || '—'}</td>
                        <td>{a.accion || '—'}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle || '—'}</td>
                        <td>{a.creado_en ? new Date(a.creado_en).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {alertas_recientes?.length > 0 && (
            <div className="section-card">
              <h3>Alertas recientes</h3>
              <div className="list">
                {(alertas_recientes || []).slice(0, 8).map((a, i) => (
                  <div key={i} className={`list-item ${getNivelClass(a.nivel)}`}>
                    <strong>{a.tipo_alerta || 'Alerta'}</strong>
                    <span>{a.descripcion?.substring(0, 80) || '—'}</span>
                    <small className="muted">
                      {a.creado_en ? new Date(a.creado_en).toLocaleString() : ''}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIncidencias = () => {
    if (!incidencias) {
      return <div className="auth-note">No hay datos de incidencias.</div>;
    }

    const { periodo_horas, errores, evaluaciones_sin_resultados, alertas_criticas } = incidencias;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatBox icon={AlertTriangle} label="Errores (últimas h)" value={errores?.length || 0} />
          <StatBox icon={FileText} label="Sin resultados" value={evaluaciones_sin_resultados?.length || 0} />
          <StatBox icon={Shield} label="Alertas críticas" value={alertas_criticas?.length || 0} color="var(--danger)" />
        </div>

        <div className="auth-note">
          Mostrando incidencias de las últimas {periodo_horas} horas.
        </div>

        {errores?.length > 0 && (
          <div className="section-card">
            <h3>Errores recientes</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th><th>Evaluación</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {(errores || []).slice(0, 20).map((e, i) => (
                    <tr key={i}>
                      <td>{e.usuario || '—'}</td>
                      <td>{e.rol_usuario || '—'}</td>
                      <td>{e.accion || '—'}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detalle || '—'}</td>
                      <td>{e.evaluacion_titulo || '—'}</td>
                      <td>{e.creado_en ? new Date(e.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errores?.length > 20 && (
              <div className="auth-note" style={{ marginTop: 8 }}>Se muestran 20 de {errores.length} registros.</div>
            )}
          </div>
        )}

        {evaluaciones_sin_resultados?.length > 0 && (
          <div className="section-card">
            <h3>Evaluaciones sin resultados</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Título</th><th>Estado</th><th>Fecha fin</th><th>Creado</th></tr>
                </thead>
                <tbody>
                  {evaluaciones_sin_resultados.map((e, i) => (
                    <tr key={i}>
                      <td>{e.titulo || '—'}</td>
                      <td><span className={`badge ${e.estado === 'ACTIVA' ? 'light' : 'warn'}`}>{e.estado}</span></td>
                      <td>{e.fecha_fin ? new Date(e.fecha_fin).toLocaleString() : '—'}</td>
                      <td>{e.creado_en ? new Date(e.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {alertas_criticas?.length > 0 && (
          <div className="section-card">
            <h3>Alertas críticas sin atender</h3>
            <div className="list">
              {alertas_criticas.map((a, i) => (
                <div key={i} className="list-item warn">
                  <strong>{a.tipo_alerta}</strong>
                  <span>{a.descripcion?.substring(0, 100) || '—'}</span>
                  <small className="muted">{a.creado_en ? new Date(a.creado_en).toLocaleString() : ''}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {!errores?.length && !evaluaciones_sin_resultados?.length && !alertas_criticas?.length && (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No se detectaron incidencias en el periodo consultado.</p>
          </div>
        )}
      </div>
    );
  };

  const renderErrores = () => {
    if (!errores) {
      return <div className="auth-note">No hay datos de errores de validación.</div>;
    }

    const { total_errores_validacion, total_resultados_rechazados, errores_validacion, resultados_rechazados } = errores;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatBox icon={Shield} label="Errores validación" value={total_errores_validacion || 0} />
          <StatBox icon={AlertTriangle} label="Resultados rechazados" value={total_resultados_rechazados || 0} color="var(--danger)" />
        </div>

        {errores_validacion?.length > 0 && (
          <div className="section-card">
            <h3>Errores de validación (últimos 7 días)</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th><th>Evaluación</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {(errores_validacion || []).slice(0, 30).map((e, i) => (
                    <tr key={i}>
                      <td>{e.usuario || '—'}</td>
                      <td>{e.rol_usuario || '—'}</td>
                      <td><span className="badge warn">{e.accion}</span></td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detalle || '—'}</td>
                      <td>{e.evaluacion_titulo || '—'}</td>
                      <td>{e.ip || '—'}</td>
                      <td>{e.creado_en ? new Date(e.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {resultados_rechazados?.length > 0 && (
          <div className="section-card">
            <h3>Resultados rechazados</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Evaluación</th><th>Periodo</th><th>Promedio</th><th>Observación</th><th>Fecha rechazo</th></tr>
                </thead>
                <tbody>
                  {resultados_rechazados.map((r, i) => (
                    <tr key={i}>
                      <td>{r.evaluacion_titulo || '—'}</td>
                      <td>{r.nombre_periodo || '—'}</td>
                      <td>{r.promedio_final ?? '—'}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.observacion_general || '—'}</td>
                      <td>{r.validado_en ? new Date(r.validado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!errores_validacion?.length && !resultados_rechazados?.length && (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
            <p>No se encontraron errores de validación ni resultados rechazados.</p>
          </div>
        )}
      </div>
    );
  };

  const renderRegistros = () => {
    if (!registros) {
      return <div className="auth-note">No hay registros de falla disponibles.</div>;
    }

    const { registros: items, total } = registros;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatBox icon={FileText} label="Total registros" value={total || 0} />
          <StatBox icon={Activity} label="Mostrando" value={items?.length || 0} />
        </div>

        {items?.length > 0 ? (
          <div className="section-card">
            <h3>&Uacute;ltimos registros</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>Evaluación</th><th>IP</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.id_auditoria || i}>
                      <td>{r.id_auditoria || '—'}</td>
                      <td>{r.usuario || '—'}</td>
                      <td><span className={`badge ${['ERROR', 'RECHAZAR', 'CANCELAR'].includes(r.accion) ? 'warn' : 'light'}`}>{r.accion || '—'}</span></td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalle || '—'}</td>
                      <td>{r.evaluacion_titulo || '—'}</td>
                      <td>{r.ip || '—'}</td>
                      <td>{r.creado_en ? new Date(r.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="auth-note">No se encontraron registros.</div>
        )}
      </div>
    );
  };

  const renderRutas = () => {
    if (!rutas) {
      return <div className="auth-note">No hay datos de verificación de rutas.</div>;
    }

    const { verificaciones, total, operativas, fallando, timestamp } = rutas;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatBox icon={Route} label="Total rutas" value={total || 0} />
          <StatBox icon={CheckCircle2} label="Operativas" value={operativas || 0} color="var(--success)" />
          <StatBox icon={AlertTriangle} label="Fallando" value={fallando || 0} color={fallando > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        <div className="auth-note">
          Última verificación: {timestamp ? new Date(timestamp).toLocaleString() : '—'}
        </div>

        <div className="section-card">
          <h3>Estado de rutas API</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Método</th><th>Ruta</th><th>Descripción</th><th>Estado</th><th>HTTP</th></tr>
              </thead>
              <tbody>
                {(verificaciones || []).map((v, i) => (
                  <tr key={i}>
                    <td><span className="badge light">{v.metodo || 'GET'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{v.ruta || '—'}</td>
                    <td>{v.descripcion || '—'}</td>
                    <td>
                      {v.ok ? (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> OK
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={14} /> FALLO
                        </span>
                      )}
                    </td>
                    <td>{v.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAuditoria = () => {
    if (!auditoria) {
      return <div className="auth-note">No hay registros de auditoría disponibles.</div>;
    }

    const { registros: items, total, filtros } = auditoria;

    return (
      <div className="stack">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatBox icon={Database} label="Total auditoría" value={total || 0} />
          <StatBox icon={Activity} label="Mostrando" value={items?.length || 0} />
        </div>

        {filtros?.periodo && (
          <div className="auth-note">
            Registros desde {filtros.periodo.mas_antiguo ? new Date(filtros.periodo.mas_antiguo).toLocaleString() : '—'} hasta {filtros.periodo.mas_reciente ? new Date(filtros.periodo.mas_reciente).toLocaleString() : '—'}
          </div>
        )}

        {items?.length > 0 ? (
          <div className="section-card">
            <h3>Registros de auditoría</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th><th>Observaciones</th><th>IP</th><th>Evaluación</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.id_auditoria || i}>
                      <td>{r.id_auditoria || '—'}</td>
                      <td>{r.usuario || '—'}</td>
                      <td>{r.rol_usuario || '—'}</td>
                      <td><span className={`badge ${['ERROR', 'RECHAZAR', 'CANCELAR'].includes(r.accion) ? 'warn' : 'light'}`}>{r.accion || '—'}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalle || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.observaciones || '—'}</td>
                      <td>{r.ip || '—'}</td>
                      <td>{r.evaluacion_titulo || '—'}</td>
                      <td>{r.creado_en ? new Date(r.creado_en).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="auth-note">No se encontraron registros de auditoría.</div>
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
      case 'diagnostico':
        return renderDiagnostico();
      case 'incidencias':
        return renderIncidencias();
      case 'errores':
        return renderErrores();
      case 'registros':
        return renderRegistros();
      case 'rutas':
        return renderRutas();
      case 'auditoria':
        return renderAuditoria();
      default:
        return null;
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Soporte técnico</div>
          <h1>Panel de soporte - Evaluaciones</h1>
          <p>Diagnóstico técnico, monitoreo de incidencias, errores de validación, verificación de rutas y registros de auditoría del módulo de evaluaciones.</p>
        </div>
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
