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
  QrCode,
  FolderOpen
} from 'lucide-react';

const TABS = [
  { key: 'diagnostico', label: 'Diagnóstico técnico', icon: Cpu },
  { key: 'qr', label: 'Verificación de QR', icon: QrCode },
  { key: 'rutas', label: 'Validación de rutas', icon: Route },
  { key: 'incidencias', label: 'Incidencias técnicas', icon: AlertTriangle },
  { key: 'monitoreo', label: 'Monitoreo de carga', icon: Database },
  { key: 'integridad', label: 'Integridad de archivos', icon: Shield }
];

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={16} /> {tab.label}
    </button>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color || 'var(--accent)' }}>
      <Icon size={22} style={{ color: color || 'var(--accent)' }} />
      <div>
        <strong style={{ fontSize: '1.4rem' }}>{value ?? '\u2014'}</strong>
        <span className="muted">{label}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, ok }) {
  return (
    <div className="list-item">
      <strong>{label}</strong>
      <span style={{ color: ok === false ? '#dc2626' : ok === true ? '#16a34a' : 'inherit' }}>
        {value ?? '\u2014'}
      </span>
    </div>
  );
}

export default function SoporteKardexPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('diagnostico');
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');

  // QR validation state
  const [qrToken, setQrToken] = React.useState('');
  const [qrResult, setQrResult] = React.useState(null);
  const [qrLoading, setQrLoading] = React.useState(false);

  // Incidencia form state
  const [incidenciaForm, setIncidenciaForm] = React.useState({ tipo: '', descripcion: '', modulo: 'KARDEX', nivel: 'MEDIA' });
  const [showIncidenciaForm, setShowIncidenciaForm] = React.useState(false);
  const [incidenciaLoading, setIncidenciaLoading] = React.useState(false);

  const loadData = React.useCallback(async (tab) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      let res;
      switch (tab) {
        case 'diagnostico':
          res = await api.soporteKardexDiagnostico(token);
          break;
        case 'rutas':
          res = await api.soporteKardexVerificarRutas(token);
          break;
        case 'incidencias':
          res = await api.soporteKardexIncidencias(token);
          break;
        case 'monitoreo':
          res = await api.soporteKardexMonitoreoCarga(token);
          break;
        case 'integridad':
          res = await api.soporteKardexVerificarIntegridad(token);
          break;
        default:
          break;
      }
      setData(res?.data ?? res);
    } catch (err) {
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (activeTab !== 'qr' && activeTab !== 'incidencias') {
      loadData(activeTab);
    }
  }, [activeTab, loadData]);

  React.useEffect(() => {
    if (activeTab === 'incidencias') {
      loadData('incidencias');
    }
  }, [activeTab, loadData]);

  const handleValidarQR = async () => {
    if (!qrToken.trim()) return;
    setQrLoading(true);
    setQrResult(null);
    try {
      const res = await api.soporteKardexValidarQR(token, qrToken.trim());
      setQrResult(res);
    } catch (err) {
      setQrResult({ ok: false, message: err?.message || 'QR inválido' });
    } finally {
      setQrLoading(false);
    }
  };

  const handleCrearIncidencia = async () => {
    if (!incidenciaForm.tipo || !incidenciaForm.descripcion) {
      setError('Tipo y descripción son requeridos');
      return;
    }
    setIncidenciaLoading(true);
    try {
      await api.soporteKardexCrearIncidencia(token, incidenciaForm);
      setShowIncidenciaForm(false);
      setIncidenciaForm({ tipo: '', descripcion: '', modulo: 'KARDEX', nivel: 'MEDIA' });
      loadData('incidencias');
    } catch (err) {
      setError(err?.message || 'Error al crear incidencia');
    } finally {
      setIncidenciaLoading(false);
    }
  };

  const handleAtenderIncidencia = async (id, solucion) => {
    try {
      await api.soporteKardexAtenderIncidencia(token, id, { solucion, estado: 'ATENDIDA' });
      loadData('incidencias');
    } catch (err) {
      setError(err?.message || 'Error al atender incidencia');
    }
  };

  function renderTabContent() {
    if (activeTab === 'qr') {
      return (
        <div className="form-stack">
          <div className="section-card">
            <div className="section-head">
              <QrCode size={18} />
              <h3>Validar código QR</h3>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Ingresa el token QR de un kardex para verificar su autenticidad.
            </p>
            <div className="grid-two" style={{ alignItems: 'end' }}>
              <div className="form-field">
                <label>Token QR</label>
                <input value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="Ej: a5bfb166-2724-40bb-a7a5-deaee92b3a5f" />
              </div>
              <button className="btn primary" onClick={handleValidarQR} disabled={qrLoading}>
                {qrLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                Validar
              </button>
            </div>
          </div>

          {qrResult && (
            <div className={`section-card ${qrResult.valido ? '' : 'warn'}`}>
              <div className="section-head">
                {qrResult.valido ? <CheckCircle2 size={18} style={{ color: '#16a34a' }} /> : <XCircle size={18} style={{ color: '#dc2626' }} />}
                <h3>{qrResult.valido ? 'QR válido' : 'QR inválido'}</h3>
              </div>
              {qrResult.valido ? (
                <div className="list">
                  <InfoRow label="Alumno" value={qrResult.data?.nombre_completo} />
                  <InfoRow label="Matrícula" value={qrResult.data?.matricula} />
                  <InfoRow label="CURP" value={qrResult.data?.curp} />
                  <InfoRow label="Carrera" value={qrResult.data?.carrera} />
                  <InfoRow label="Verificado" value={new Date(qrResult.data?.verificado_en).toLocaleString()} />
                  {qrResult.data?.url_qr && (
                    <a className="btn secondary mt" href={qrResult.data.url_qr} target="_blank" rel="noreferrer">
                      Ver QR
                    </a>
                  )}
                </div>
              ) : (
                <p style={{ color: '#dc2626' }}>{qrResult.message || 'El QR no es válido o ha expirado'}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'incidencias') {
      return (
        <div className="form-stack">
          <div className="section-head" style={{ justifyContent: 'space-between' }}>
            <h3>Incidencias técnicas del Kardex</h3>
            <button className="btn primary" onClick={() => setShowIncidenciaForm(!showIncidenciaForm)} type="button">
              <Plus size={16} /> Nueva incidencia
            </button>
          </div>

          {showIncidenciaForm && (
            <div className="section-card">
              <div className="form-stack">
                <div className="grid-two">
                  <div className="form-field">
                    <label>Tipo</label>
                    <select value={incidenciaForm.tipo} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, tipo: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      <option value="QR_NO_GENERADO">QR no generado</option>
                      <option value="ARCHIVO_FALTANTE">Archivo faltante</option>
                      <option value="ERROR_GENERACION">Error de generación</option>
                      <option value="RUTA_INVALIDA">Ruta inválida</option>
                      <option value="DATOS_INCONSISTENTES">Datos inconsistentes</option>
                      <option value="FOTO_NO_CARGADA">Foto no cargada</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Nivel</label>
                    <select value={incidenciaForm.nivel} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, nivel: e.target.value })}>
                      <option value="BAJA">Baja</option>
                      <option value="MEDIA">Media</option>
                      <option value="ALTA">Alta</option>
                      <option value="CRITICA">Crítica</option>
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label>Descripción</label>
                  <textarea value={incidenciaForm.descripcion} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, descripcion: e.target.value })} rows={3} />
                </div>
                <div className="row gap">
                  <button className="btn primary" onClick={handleCrearIncidencia} disabled={incidenciaLoading}>
                    {incidenciaLoading ? <Loader2 size={16} className="spin" /> : null}
                    Registrar
                  </button>
                  <button className="btn secondary" onClick={() => setShowIncidenciaForm(false)} type="button">Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {data?.incidencias?.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Nivel</th>
                    <th>Estado</th>
                    <th>Reportado por</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidencias.map((inc, i) => (
                    <tr key={inc.id_incidencia}>
                      <td>{inc.id_incidencia}</td>
                      <td><code>{inc.tipo}</code></td>
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inc.descripcion}
                      </td>
                      <td><span className={`badge ${getNivelClass(inc.nivel)}`}>{inc.nivel}</span></td>
                      <td><span className={`badge ${inc.estado === 'ABIERTA' ? 'warn' : inc.estado === 'ATENDIDA' ? 'ok' : ''}`}>{inc.estado}</span></td>
                      <td>{inc.reportado_por_correo || '\u2014'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(inc.creado_en).toLocaleDateString()}</td>
                      <td>
                        {(inc.estado === 'ABIERTA' || inc.estado === 'EN_PROCESO') && (
                          <button className="btn primary small" onClick={() => handleAtenderIncidencia(inc.id_incidencia, 'Atendido por soporte técnico')} type="button">
                            Atender
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading ? (
            <div className="empty">No hay incidencias registradas.</div>
          ) : null}
        </div>
      );
    }

    // For tabs that require data loading
    if (loading) {
      return <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>;
    }

    if (error) {
      return <div className="alert error">{error}</div>;
    }

    if (!data) {
      return <div className="empty">Selecciona una opción para cargar datos.</div>;
    }

    switch (activeTab) {
      case 'diagnostico':
        return renderDiagnostico(data);
      case 'rutas':
        return renderRutas(data);
      case 'monitoreo':
        return renderMonitoreo(data);
      case 'integridad':
        return renderIntegridad(data);
      default:
        return null;
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 4px' }}>Kardex - Soporte técnico</h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
          Diagnóstico, verificación y monitoreo del módulo de Kardex académico.
        </p>
      </div>

      <div className="tab-bar" style={{ marginBottom: '16px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />
        ))}
      </div>

      {renderTabContent()}

      {error && activeTab !== 'diagnostico' && activeTab !== 'rutas' && activeTab !== 'monitoreo' && activeTab !== 'integridad' && (
        <div className="alert error" style={{ marginTop: '8px' }}>{error}</div>
      )}
    </div>
  );
}

function getNivelClass(nivel) {
  if (!nivel) return '';
  const n = String(nivel).toUpperCase();
  if (n === 'ALTA' || n === 'CRITICA') return 'warn';
  if (n === 'MEDIA' || n === 'MEDIO') return '';
  return 'ok';
}

function renderDiagnostico(data) {
  const r = data?.resumen || {};
  return (
    <div className="form-stack">
      <div className="section-card">
        <div className="section-head"><Cpu size={18} /><h3>Resumen del módulo Kardex</h3></div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <StatBox icon={FileText} label="Kardex emitidos" value={r.kardex_emitidos} color="#1e40af" />
          <StatBox icon={AlertCircle} label="Alumnos sin kardex" value={r.alumnos_sin_kardex} color={r.alumnos_sin_kardex > 0 ? '#dc2626' : '#16a34a'} />
          <StatBox icon={Database} label="Registros historial" value={r.registros_historial} color="#2563eb" />
          <StatBox icon={XCircle} label="QR sin URL" value={r.qr_sin_url} color={r.qr_sin_url > 0 ? '#dc2626' : '#16a34a'} />
          <StatBox icon={Server} label="Total alumnos" value={r.total_alumnos} color="#64748b" />
          <StatBox icon={Shield} label="Sellos activos" value={r.sellos_activos} color="#16a34a" />
          <StatBox icon={Activity} label="Registros auditoría" value={r.registros_auditoria} color="#9333ea" />
        </div>
      </div>

      {data?.actividad_reciente?.length > 0 && (
        <div className="section-card">
          <div className="section-head"><Activity size={18} /><h3>Actividad reciente</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.actividad_reciente.map((a, i) => (
                  <tr key={i}>
                    <td><code>{a.accion}</code></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle}</td>
                    <td style={{ fontSize: '0.8rem' }}>{a.correo_institucional || '\u2014'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(a.creado_en).toLocaleString()}</td>
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

function renderRutas(data) {
  return (
    <div className="form-stack">
      <div className="section-card">
        <div className="section-head"><Route size={18} /><h3>Directorios del sistema</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ruta</th>
                <th>Existe</th>
                <th>Directorio</th>
                <th>Legible</th>
              </tr>
            </thead>
            <tbody>
              {(data?.directorios || []).map((d, i) => (
                <tr key={i}>
                  <td><code>{d.ruta}</code></td>
                  <td>{d.existe ? <span className="badge ok">Sí</span> : <span className="badge warn">No</span>}</td>
                  <td>{d.es_directorio ? <span className="badge ok">Sí</span> : '\u2014'}</td>
                  <td>{d.permisos_lectura ? <span className="badge ok">Sí</span> : <span className="badge warn">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stats-grid" style={{ marginTop: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          <StatBox icon={FolderOpen} label="Archivos QR total" value={data?.archivos_qr?.total} color="#2563eb" />
          <StatBox icon={CheckCircle2} label="QR en disco" value={data?.archivos_qr?.existentes} color="#16a34a" />
          <StatBox icon={XCircle} label="QR faltantes" value={data?.archivos_qr?.faltantes} color={data?.archivos_qr?.faltantes > 0 ? '#dc2626' : '#16a34a'} />
        </div>
      </div>
    </div>
  );
}

function renderMonitoreo(data) {
  return (
    <div className="form-stack">
      <div className="section-card">
        <div className="section-head"><Database size={18} /><h3>Estadísticas de carga documental</h3></div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          <StatBox icon={FileText} label="Total registros" value={data?.estadisticas?.total_registros} color="#1e40af" />
          <StatBox icon={CheckCircle2} label="Acreditadas" value={data?.estadisticas?.acreditadas} color="#16a34a" />
          <StatBox icon={XCircle} label="No acreditadas" value={data?.estadisticas?.no_acreditadas} color="#dc2626" />
          <StatBox icon={Activity} label="Cursando" value={data?.estadisticas?.cursando} color="#2563eb" />
          <StatBox icon={AlertTriangle} label="Extraordinarios" value={data?.estadisticas?.extraordinarios} color="#d97706" />
        </div>
      </div>

      {data?.cargas_por_periodo?.length > 0 && (
        <div className="section-card">
          <div className="section-head"><Server size={18} /><h3>Cargas por periodo</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Periodo</th><th>Registros</th></tr>
              </thead>
              <tbody>
                {data.cargas_por_periodo.map((p, i) => (
                  <tr key={i}>
                    <td>{p.nombre_periodo}</td>
                    <td><strong>{p.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.cargas_recientes?.length > 0 && (
        <div className="section-card">
          <div className="section-head"><Activity size={18} /><h3>Cargas recientes</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Alumno</th>
                  <th>Materia</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.cargas_recientes.map((c, i) => (
                  <tr key={c.id_historial || i}>
                    <td>{c.matricula}</td>
                    <td>{c.alumno_nombre}</td>
                    <td>{c.nombre_materia}</td>
                    <td>{c.nombre_periodo}</td>
                    <td><span className={`badge ${c.estado === 'Acreditada' ? 'ok' : c.estado === 'No Acreditada' ? 'warn' : ''}`}>{c.estado}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(c.creado_en).toLocaleString()}</td>
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

function renderIntegridad(data) {
  const danados = data?.danados ?? 0;
  return (
    <div className="form-stack">
      <div className="section-card">
        <div className="section-head"><Shield size={18} /><h3>Integridad de archivos QR</h3></div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <StatBox icon={FileText} label="Total archivos" value={data?.total_archivos} color="#1e40af" />
          <StatBox icon={CheckCircle2} label="Íntegros" value={data?.integros} color="#16a34a" />
          <StatBox icon={XCircle} label="Dañados" value={danados} color={danados > 0 ? '#dc2626' : '#16a34a'} />
        </div>
      </div>

      {data?.detalle?.length > 0 && (
        <div className="section-card">
          <div className="section-head"><FolderOpen size={18} /><h3>Detalle por alumno</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Token QR</th>
                  <th>Archivo en disco</th>
                  <th>Tamaño</th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((d, i) => (
                  <tr key={d.id_alumno} style={{ background: d.archivo_existe ? '' : '#fef2f2' }}>
                    <td>{d.matricula}</td>
                    <td>{d.qr_token_valido ? <span className="badge ok">Válido</span> : <span className="badge warn">Inválido</span>}</td>
                    <td>{d.archivo_existe ? <span className="badge ok">Sí</span> : <span className="badge warn">No</span>}</td>
                    <td>{d.tamano_bytes ? `${(d.tamano_bytes / 1024).toFixed(1)} KB` : '\u2014'}</td>
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
