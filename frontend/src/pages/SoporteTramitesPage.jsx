import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Database,
  FileText,
  FileWarning,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  Search,
  Server,
  Shield,
  Upload,
  Download,
  XCircle,
  UserCheck,
  Wrench
} from 'lucide-react';

const TABS = [
  { key: 'panel', label: 'Panel técnico', icon: Cpu },
  { key: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
  { key: 'archivos', label: 'Carga de archivos', icon: Upload },
  { key: 'recuperacion', label: 'Recuperación', icon: Download },
  { key: 'integridad', label: 'Validación de integridad', icon: Shield },
  { key: 'historial', label: 'Historial técnico', icon: Activity }
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

const ESTADOS_INCIDENCIA = [
  { value: 'EN_PROCESO', label: 'En proceso', color: '#2563eb' },
  { value: 'EN_REVISION_TECNICA', label: 'En revisión técnica', color: '#d97706' },
  { value: 'CORREGIDO', label: 'Corregido', color: '#16a34a' },
  { value: 'REINTENTADO', label: 'Reintentado', color: '#9333ea' },
  { value: 'CERRADO', label: 'Cerrado', color: '#64748b' }
];

function BadgeEstado({ estado }) {
  const e = ESTADOS_INCIDENCIA.find((e) => e.value === estado);
  if (!e) return <span className="badge">{estado}</span>;
  return <span className="badge" style={{ background: e.color, color: '#fff' }}>{e.label}</span>;
}

function BadgeNivel({ nivel }) {
  if (!nivel) return null;
  const n = String(nivel).toUpperCase();
  const color = n === 'CRITICA' || n === 'ALTA' ? '#dc2626' : n === 'MEDIA' || n === 'MEDIO' ? '#d97706' : '#16a34a';
  return <span className="badge" style={{ background: color, color: '#fff' }}>{nivel}</span>;
}

export default function SoporteTramitesPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');

  // Incidencia form
  const [showIncidenciaForm, setShowIncidenciaForm] = React.useState(false);
  const [incidenciaForm, setIncidenciaForm] = React.useState({
    id_tramite: '', folio_tramite: '', id_tipo_tramite: '',
    tipo_incidencia: 'FALLA_GENERACION', titulo: '', descripcion: '', nivel: 'MEDIA'
  });
  const [incidenciaLoading, setIncidenciaLoading] = React.useState(false);

  // Recuperacion form
  const [showRecuperacionForm, setShowRecuperacionForm] = React.useState(false);
  const [recuperacionForm, setRecuperacionForm] = React.useState({
    id_incidencia: '', id_tramite: '', id_tramite_documento: '', tipo_recuperacion: 'ARCHIVO', observaciones: ''
  });
  const [recuperacionLoading, setRecuperacionLoading] = React.useState(false);

  // Compatibilidad form
  const [compatibilidadId, setCompatibilidadId] = React.useState('');
  const [compatibilidadResult, setCompatibilidadResult] = React.useState(null);
  const [compatibilidadLoading, setCompatibilidadLoading] = React.useState(false);

  // Reintentar
  const [reintentarLoading, setReintentarLoading] = React.useState(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');

  const loadData = React.useCallback(async (tab, extra = {}) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      let res;
      switch (tab) {
        case 'panel':
          res = await api.soporteTramitesPanel(token);
          break;
        case 'incidencias':
          res = await api.soporteTramitesIncidencias(token, { estado: extra.estado || '', tipo: extra.tipo || '' });
          break;
        case 'archivos':
          res = await api.soporteTramitesArchivos(token, { estado: extra.estado || '', accion: extra.accion || '' });
          break;
        case 'recuperacion':
          res = await api.soporteTramitesRecuperacion(token, { estado: extra.estado || '' });
          break;
        case 'historial':
          res = await api.soporteTramitesHistorial(token, { accion: extra.accion || '' });
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
    if (activeTab !== 'integridad' && activeTab !== 'archivos' && activeTab !== 'recuperacion') {
      loadData(activeTab);
    }
    if (activeTab === 'archivos') loadData('archivos', {});
    if (activeTab === 'recuperacion') loadData('recuperacion', {});
  }, [activeTab, loadData]);

  const handleCrearIncidencia = async () => {
    if (!incidenciaForm.titulo) {
      setError('El título es requerido');
      return;
    }
    setIncidenciaLoading(true);
    try {
      const body = { ...incidenciaForm };
      body.id_tramite = body.id_tramite ? Number(body.id_tramite) : null;
      body.id_tipo_tramite = body.id_tipo_tramite ? Number(body.id_tipo_tramite) : null;
      await api.soporteTramitesCrearIncidencia(token, body);
      setShowIncidenciaForm(false);
      setIncidenciaForm({ id_tramite: '', folio_tramite: '', id_tipo_tramite: '', tipo_incidencia: 'FALLA_GENERACION', titulo: '', descripcion: '', nivel: 'MEDIA' });
      loadData('incidencias', {});
    } catch (err) {
      setError(err?.message || 'Error al crear incidencia');
    } finally {
      setIncidenciaLoading(false);
    }
  };

  const handleActualizarIncidencia = async (id, estado, solucion) => {
    try {
      await api.soporteTramitesActualizarIncidencia(token, id, { estado, solucion: solucion || '' });
      loadData('incidencias', { estado: filtroEstado, tipo: filtroTipo });
    } catch (err) {
      setError(err?.message || 'Error al actualizar incidencia');
    }
  };

  const handleReintentar = async (id) => {
    setReintentarLoading(id);
    try {
      await api.soporteTramitesReintentar(token, id);
      loadData('incidencias', { estado: filtroEstado, tipo: filtroTipo });
    } catch (err) {
      setError(err?.message || 'Error al reintentar');
    } finally {
      setReintentarLoading(null);
    }
  };

  const handleRealizarRecuperacion = async () => {
    if (!recuperacionForm.id_tramite_documento) {
      setError('ID de documento requerido');
      return;
    }
    setRecuperacionLoading(true);
    try {
      const body = { ...recuperacionForm };
      body.id_incidencia = body.id_incidencia ? Number(body.id_incidencia) : null;
      body.id_tramite = body.id_tramite ? Number(body.id_tramite) : null;
      body.id_tramite_documento = Number(body.id_tramite_documento);
      await api.soporteTramitesRealizarRecuperacion(token, body);
      setShowRecuperacionForm(false);
      setRecuperacionForm({ id_incidencia: '', id_tramite: '', id_tramite_documento: '', tipo_recuperacion: 'ARCHIVO', observaciones: '' });
      loadData('recuperacion', {});
    } catch (err) {
      setError(err?.message || 'Error al recuperar documento');
    } finally {
      setRecuperacionLoading(false);
    }
  };

  const handleValidarCompatibilidad = async () => {
    if (!compatibilidadId) return;
    setCompatibilidadLoading(true);
    setCompatibilidadResult(null);
    try {
      const res = await api.soporteTramitesValidarCompatibilidad(token, { id_tramite: Number(compatibilidadId) });
      setCompatibilidadResult(res?.data ?? res);
    } catch (err) {
      setCompatibilidadResult({ compatible: false, observaciones: err?.message || 'Error al validar' });
    } finally {
      setCompatibilidadLoading(false);
    }
  };

  const handleValidarIntegridad = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.soporteTramitesValidarIntegridad(token);
      setData(res?.data ?? res);
    } catch (err) {
      setError(err?.message || 'Error al validar integridad');
    } finally {
      setLoading(false);
    }
  };

  function renderTabContent() {
    if (activeTab === 'incidencias') {
      return (
        <div className="form-stack">
          <div className="section-head" style={{ justifyContent: 'space-between' }}>
            <h3>Incidencias de trámites</h3>
            <div className="row gap">
              <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); loadData('incidencias', { estado: e.target.value, tipo: filtroTipo }); }} style={{ fontSize: '0.85rem' }}>
                <option value="">Todos los estados</option>
                {ESTADOS_INCIDENCIA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <button className="btn primary" onClick={() => setShowIncidenciaForm(!showIncidenciaForm)} type="button">
                <Plus size={16} /> Nueva incidencia
              </button>
            </div>
          </div>

          {showIncidenciaForm && (
            <div className="section-card">
              <div className="form-stack">
                <div className="grid-two">
                  <div className="form-field">
                    <label>Título *</label>
                    <input value={incidenciaForm.titulo} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, titulo: e.target.value })} placeholder="Ej: Error al generar documento de baja" />
                  </div>
                  <div className="form-field">
                    <label>Tipo de incidencia</label>
                    <select value={incidenciaForm.tipo_incidencia} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, tipo_incidencia: e.target.value })}>
                      <option value="FALLA_GENERACION">Falla de generación</option>
                      <option value="ARCHIVO_CORRUPTO">Archivo corrupto</option>
                      <option value="ERROR_CARGA">Error en carga documental</option>
                      <option value="INCOMPATIBILIDAD">Incompatibilidad de archivo</option>
                      <option value="RECUPERACION">Recuperación de documento</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                </div>
                <div className="grid-two">
                  <div className="form-field">
                    <label>ID Trámite</label>
                    <input value={incidenciaForm.id_tramite} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, id_tramite: e.target.value })} placeholder="ID numérico" />
                  </div>
                  <div className="form-field">
                    <label>Folio trámite</label>
                    <input value={incidenciaForm.folio_tramite} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, folio_tramite: e.target.value })} placeholder="Ej: TRM-2026-000001" />
                  </div>
                </div>
                <div className="grid-two">
                  <div className="form-field">
                    <label>Tipo de trámite</label>
                    <select value={incidenciaForm.id_tipo_tramite} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, id_tipo_tramite: e.target.value })}>
                      <option value="">Genérico</option>
                      <option value="1">Baja</option>
                      <option value="2">Traslado (Cambio de escuela)</option>
                      <option value="3">Cambio de Carrera</option>
                      <option value="4">Equivalencia</option>
                      <option value="5">Revalidación</option>
                      <option value="6">Certificado Parcial</option>
                      <option value="7">Historial Académico</option>
                      <option value="8">Constancia</option>
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
                  <textarea value={incidenciaForm.descripcion} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, descripcion: e.target.value })} rows={3} placeholder="Describe el problema técnico detectado..." />
                </div>
                <div className="row gap">
                  <button className="btn primary" onClick={handleCrearIncidencia} disabled={incidenciaLoading}>
                    {incidenciaLoading ? <Loader2 size={16} className="spin" /> : null}
                    Registrar incidencia
                  </button>
                  <button className="btn secondary" onClick={() => setShowIncidenciaForm(false)} type="button">Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>}
          {error && activeTab !== 'panel' && <div className="alert error" style={{ margin: '8px 0' }}>{error}</div>}

          {data?.incidencias?.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Trámite</th>
                    <th>Nivel</th>
                    <th>Estado</th>
                    <th>Reportó</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidencias.map((inc) => (
                    <tr key={inc.id_incidencia}>
                      <td>{inc.id_incidencia}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.titulo}</td>
                      <td><code style={{ fontSize: '0.75rem' }}>{inc.tipo_incidencia}</code></td>
                      <td style={{ fontSize: '0.8rem' }}>{inc.folio || inc.tipo_tramite_nombre || '\u2014'}</td>
                      <td><BadgeNivel nivel={inc.nivel} /></td>
                      <td><BadgeEstado estado={inc.estado} /></td>
                      <td style={{ fontSize: '0.75rem' }}>{inc.reportado_por_correo || '\u2014'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{new Date(inc.creado_en).toLocaleDateString()}</td>
                      <td>
                        <div className="row gap" style={{ flexWrap: 'nowrap' }}>
                          {inc.estado === 'EN_PROCESO' && (
                            <button className="btn primary small" onClick={() => handleActualizarIncidencia(inc.id_incidencia, 'EN_REVISION_TECNICA', '')} type="button">Revisar</button>
                          )}
                          {inc.estado === 'EN_REVISION_TECNICA' && (
                            <>
                              <button className="btn primary small" onClick={() => handleActualizarIncidencia(inc.id_incidencia, 'CORREGIDO', 'Corregido por soporte técnico')} type="button">Corregir</button>
                              <button className="btn secondary small" onClick={() => handleReintentar(inc.id_incidencia)} disabled={reintentarLoading === inc.id_incidencia} type="button">
                                {reintentarLoading === inc.id_incidencia ? <Loader2 size={12} className="spin" /> : null} Reintentar
                              </button>
                            </>
                          )}
                          {(inc.estado === 'CORREGIDO' || inc.estado === 'REINTENTADO') && (
                            <button className="btn secondary small" onClick={() => handleActualizarIncidencia(inc.id_incidencia, 'CERRADO', 'Incidencia cerrada')} type="button">Cerrar</button>
                          )}
                        </div>
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

    if (activeTab === 'archivos') {
      return (
        <div className="form-stack">
          <div className="section-head">
            <h3>Carga de archivos - Soporte a trámites</h3>
          </div>

          {data?.resumen?.length > 0 && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: '12px' }}>
              {data.resumen.map((r, i) => (
                <StatBox key={i} icon={r.accion === 'CARGA' ? Upload : Download} label={r.accion} value={`${r.validados}/${r.total}`} color="#2563eb" />
              ))}
            </div>
          )}

          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>}
          {error && <div className="alert error" style={{ margin: '8px 0' }}>{error}</div>}

          <div className="section-head" style={{ justifyContent: 'space-between', marginTop: '8px' }}>
            <h4>Documentos</h4>
            <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); loadData('archivos', { estado: e.target.value }); }} style={{ fontSize: '0.85rem' }}>
              <option value="">Todos</option>
              <option value="RECIBIDO">Recibidos</option>
              <option value="VALIDADO">Validados</option>
              <option value="RECHAZADO">Rechazados</option>
            </select>
          </div>

          {data?.archivos?.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Archivo</th>
                    <th>Acción</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Validado</th>
                    <th>Subido por</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.archivos.map((a) => (
                    <tr key={a.id_archivo}>
                      <td>{a.id_archivo}</td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre_original}</td>
                      <td><code style={{ fontSize: '0.75rem' }}>{a.accion}</code></td>
                      <td style={{ fontSize: '0.8rem' }}>{a.tipo_documento}</td>
                      <td><span className={`badge ${a.estado_archivo === 'VALIDADO' ? 'ok' : ''}`}>{a.estado_archivo}</span></td>
                      <td>{a.validado ? <span className="badge ok">Sí</span> : <span className="badge warn">No</span>}</td>
                      <td style={{ fontSize: '0.75rem' }}>{a.subido_por_correo || '\u2014'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{new Date(a.subido_en).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading ? (
            <div className="empty">No hay archivos registrados.</div>
          ) : null}
        </div>
      );
    }

    if (activeTab === 'recuperacion') {
      return (
        <div className="form-stack">
          <div className="section-head" style={{ justifyContent: 'space-between' }}>
            <h3>Recuperación de documentos</h3>
            <button className="btn primary" onClick={() => setShowRecuperacionForm(!showRecuperacionForm)} type="button">
              <Plus size={16} /> Nueva recuperación
            </button>
          </div>

          {showRecuperacionForm && (
            <div className="section-card">
              <div className="form-stack">
                <div className="grid-two">
                  <div className="form-field">
                    <label>ID Documento *</label>
                    <input value={recuperacionForm.id_tramite_documento} onChange={(e) => setRecuperacionForm({ ...recuperacionForm, id_tramite_documento: e.target.value })} placeholder="ID del documento en tramites_documentos" />
                  </div>
                  <div className="form-field">
                    <label>Tipo</label>
                    <select value={recuperacionForm.tipo_recuperacion} onChange={(e) => setRecuperacionForm({ ...recuperacionForm, tipo_recuperacion: e.target.value })}>
                      <option value="ARCHIVO">Archivo</option>
                      <option value="QR">QR</option>
                      <option value="METADATA">Metadatos</option>
                    </select>
                  </div>
                </div>
                <div className="grid-two">
                  <div className="form-field">
                    <label>ID Incidencia (opcional)</label>
                    <input value={recuperacionForm.id_incidencia} onChange={(e) => setRecuperacionForm({ ...recuperacionForm, id_incidencia: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>ID Trámite (opcional)</label>
                    <input value={recuperacionForm.id_tramite} onChange={(e) => setRecuperacionForm({ ...recuperacionForm, id_tramite: e.target.value })} />
                  </div>
                </div>
                <div className="form-field">
                  <label>Observaciones</label>
                  <textarea value={recuperacionForm.observaciones} onChange={(e) => setRecuperacionForm({ ...recuperacionForm, observaciones: e.target.value })} rows={2} />
                </div>
                <div className="row gap">
                  <button className="btn primary" onClick={handleRealizarRecuperacion} disabled={recuperacionLoading}>
                    {recuperacionLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                    Recuperar documento
                  </button>
                  <button className="btn secondary" onClick={() => setShowRecuperacionForm(false)} type="button">Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>}
          {error && <div className="alert error" style={{ margin: '8px 0' }}>{error}</div>}

          {data?.recuperaciones?.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Incidencia</th>
                    <th>Trámite</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Integridad</th>
                    <th>Realizado por</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recuperaciones.map((r) => (
                    <tr key={r.id_recuperacion}>
                      <td>{r.id_recuperacion}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.incidencia_titulo || `#${r.id_incidencia}` || '\u2014'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.folio || '\u2014'}</td>
                      <td><code style={{ fontSize: '0.75rem' }}>{r.tipo_recuperacion}</code></td>
                      <td><BadgeEstado estado={r.estado} /></td>
                      <td>{r.integridad_ok ? <span className="badge ok">Íntegro</span> : <span className="badge warn">Dañado</span>}</td>
                      <td style={{ fontSize: '0.75rem' }}>{r.realizado_por_correo || '\u2014'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{new Date(r.creado_en).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading ? (
            <div className="empty">No hay recuperaciones registradas.</div>
          ) : null}
        </div>
      );
    }

    if (activeTab === 'integridad') {
      return (
        <div className="form-stack">
          <div className="section-card">
            <div className="section-head"><Shield size={18} /><h3>Validación de integridad de archivos</h3></div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Verifica que los documentos adjuntos a los trámites existan en disco, tengan extensión válida y su peso coincida.
            </p>
            <button className="btn primary" onClick={handleValidarIntegridad} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <Shield size={16} />}
              Ejecutar validación
            </button>
          </div>

          {error && <div className="alert error" style={{ margin: '8px 0' }}>{error}</div>}

          {data && (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                <StatBox icon={FileText} label="Total documentos" value={data.total} color="#1e40af" />
                <StatBox icon={CheckCircle2} label="Íntegros" value={data.integros} color="#16a34a" />
                <StatBox icon={XCircle} label="Dañados" value={data.danados} color={data.danados > 0 ? '#dc2626' : '#16a34a'} />
              </div>

              {data.detalle?.length > 0 && (
                <div className="section-card">
                  <div className="section-head"><FolderOpen size={18} /><h3>Detalle por documento</h3></div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Documento</th>
                          <th>Ext.</th>
                          <th>Existe</th>
                          <th>Peso</th>
                          <th>Íntegro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.detalle.map((d, i) => (
                          <tr key={d.id_documento || i} style={{ background: d.integro ? '' : '#fef2f2' }}>
                            <td style={{ fontSize: '0.8rem' }}>{d.folio || '\u2014'}</td>
                            <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{d.nombre}</td>
                            <td style={{ fontSize: '0.75rem' }}>{d.extension_valida ? <span className="badge ok">OK</span> : <span className="badge warn">Inválida</span>}</td>
                            <td>{d.archivo_existe ? <span className="badge ok">Sí</span> : <span className="badge warn">No</span>}</td>
                            <td style={{ fontSize: '0.75rem' }}>{d.peso_coincide ? <span className="badge ok">Coincide</span> : <span className="badge warn">Difiere</span>}</td>
                            <td>{d.integro ? <CheckCircle2 size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'historial') {
      return (
        <div className="form-stack">
          <div className="section-head">
            <h3>Historial técnico - Bitácora de operaciones</h3>
          </div>

          {loading && <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>}
          {error && <div className="alert error" style={{ margin: '8px 0' }}>{error}</div>}

          {data?.logs?.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Acción</th>
                    <th>Descripción</th>
                    <th>Nivel</th>
                    <th>Módulo</th>
                    <th>Usuario</th>
                    <th>IP</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l.id_log}>
                      <td>{l.id_log}</td>
                      <td><code style={{ fontSize: '0.75rem' }}>{l.accion}</code></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{l.descripcion}</td>
                      <td><span className={`badge ${l.nivel === 'ERROR' || l.nivel === 'CRITICO' ? 'warn' : l.nivel === 'WARN' ? '' : 'ok'}`}>{l.nivel}</span></td>
                      <td style={{ fontSize: '0.75rem' }}>{l.modulo}</td>
                      <td style={{ fontSize: '0.75rem' }}>{l.usuario_correo || '\u2014'}</td>
                      <td style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{l.ip_origen || '\u2014'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{new Date(l.creado_en).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading ? (
            <div className="empty">No hay registros en el historial técnico.</div>
          ) : null}
        </div>
      );
    }

    if (loading) {
      return <div className="empty"><Loader2 size={24} className="spin" /> Cargando...</div>;
    }
    if (error) {
      return <div className="alert error">{error}</div>;
    }

    // PANEL TÉCNICO
    const r = data?.resumen || {};
    return (
      <div className="form-stack">
        <div className="section-card">
          <div className="section-head"><Cpu size={18} /><h3>Panel técnico - Trámites</h3></div>
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Resumen operativo del módulo de trámites. Alcance técnico sobre plataforma, sin modificar criterios académicos.
          </p>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            <StatBox icon={ClipboardList} label="Total trámites" value={r.total_tramites} color="#1e40af" />
            <StatBox icon={AlertTriangle} label="Incidencias abiertas" value={r.incidencias_abiertas} color={r.incidencias_abiertas > 0 ? '#dc2626' : '#16a34a'} />
            <StatBox icon={Upload} label="Archivos pendientes" value={r.archivos_pendientes} color={r.archivos_pendientes > 0 ? '#d97706' : '#16a34a'} />
            <StatBox icon={Download} label="Recuperaciones pendientes" value={r.recuperaciones_pendientes} color={r.recuperaciones_pendientes > 0 ? '#9333ea' : '#16a34a'} />
          </div>
        </div>

        {data?.tramites_por_tipo?.length > 0 && (
          <div className="section-card">
            <div className="section-head"><ClipboardList size={18} /><h3>Trámites por tipo</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tipo</th><th>Código</th><th>Total</th></tr></thead>
                <tbody>
                  {data.tramites_por_tipo.map((t, i) => (
                    <tr key={i}>
                      <td>{t.nombre}</td>
                      <td><code>{t.codigo}</code></td>
                      <td><strong>{t.total}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data?.incidencias_por_estado?.length > 0 && (
          <div className="section-card">
            <div className="section-head"><AlertTriangle size={18} /><h3>Incidencias por estado</h3></div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {data.incidencias_por_estado.map((ie, i) => {
                const e = ESTADOS_INCIDENCIA.find((es) => es.value === ie.estado);
                return (
                  <StatBox key={i} icon={Activity} label={e?.label || ie.estado} value={ie.total} color={e?.color || '#64748b'} />
                );
              })}
            </div>
          </div>
        )}

        {/* SECCIÓN: Trámites de Baja, Cambio de Escuela y Cambio de Carrera */}
        <div className="section-card">
          <div className="section-head"><FileWarning size={18} /><h3>Trámites de Baja, Cambio de Escuela y Cambio de Carrera</h3></div>
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Monitoreo técnico de los trámites más críticos. Soporte en carga documental y validación de archivos.
          </p>
          <div className="form-field" style={{ marginBottom: '12px' }}>
            <label>Validar compatibilidad de archivos (ingresa ID de trámite)</label>
            <div className="grid-two" style={{ alignItems: 'end' }}>
              <input value={compatibilidadId} onChange={(e) => setCompatibilidadId(e.target.value)} placeholder="Ej: 1, 2, 3..." />
              <button className="btn primary" onClick={handleValidarCompatibilidad} disabled={compatibilidadLoading}>
                {compatibilidadLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                Validar compatibilidad
              </button>
            </div>
          </div>

          {compatibilidadResult && (
            <div className={`section-card ${compatibilidadResult.compatible ? '' : 'warn'}`} style={{ marginBottom: '12px' }}>
              <div className="section-head">
                {compatibilidadResult.compatible ? <CheckCircle2 size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
                <h3>{compatibilidadResult.compatible ? 'Documentos compatibles' : 'Problemas de compatibilidad'}</h3>
              </div>
              <p>{compatibilidadResult.observaciones}</p>
              {compatibilidadResult.documentos?.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Documento</th><th>Formato</th><th>Tamaño</th><th>Compatible</th></tr></thead>
                    <tbody>
                      {compatibilidadResult.documentos.map((d, i) => (
                        <tr key={i} style={{ background: d.compatible ? '' : '#fef2f2' }}>
                          <td style={{ fontSize: '0.85rem' }}>{d.nombre}</td>
                          <td><code style={{ fontSize: '0.75rem' }}>{d.tipo}</code></td>
                          <td style={{ fontSize: '0.8rem' }}>{d.tamano_ok ? `${(d.tamano_bytes / 1024).toFixed(1)} KB` : 'Excede límite'}</td>
                          <td>{d.compatible ? <CheckCircle2 size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Acciones rápidas de soporte */}
          <div style={{ marginTop: '16px' }}>
            <h4>Acciones de soporte técnico</h4>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginTop: '8px' }}>
              <button className="btn primary" onClick={() => setActiveTab('incidencias')} type="button"><AlertCircle size={16} /> Revisar errores</button>
              <button className="btn primary" onClick={() => setActiveTab('archivos')} type="button"><Upload size={16} /> Apoyar carga documental</button>
              <button className="btn primary" onClick={() => setActiveTab('recuperacion')} type="button"><Download size={16} /> Recuperar documentos</button>
              <button className="btn primary" onClick={() => setActiveTab('integridad')} type="button"><Shield size={16} /> Validar archivos</button>
            </div>
          </div>
        </div>

        <div className="section-card" style={{ background: '#f8fafc' }}>
          <div className="section-head"><Wrench size={18} /><h3>Información del módulo</h3></div>
          <div className="list">
            <InfoRow label="Responsable" value="Personal de soporte" />
            <InfoRow label="Permisos" value="Apoyo técnico, sin autorización académica de fondo" />
            <InfoRow label="Alcance" value="Técnico sobre plataforma, sin modificar criterios académicos" />
            <InfoRow label="Estrategia" value="Diagnóstico técnico, monitoreo de errores y recuperación asistida" />
            <InfoRow label="Objetivo funcional" value="Mantener operativo el flujo de trámites y resolver fallas técnicas" />
            <InfoRow label="Beneficio institucional" value="Disminuye tiempos de respuesta y evita interrupciones operativas" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 4px' }}>Trámites - Soporte técnico</h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
          Panel técnico, incidencias, carga de archivos, recuperación, validación de integridad e historial técnico.
          Incidencias de trámite, recuperación de archivos, fallas de generación, soporte en carga documental.
        </p>
      </div>

      <div className="tab-bar" style={{ marginBottom: '16px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />
        ))}
      </div>

      {renderTabContent()}
    </div>
  );
}
