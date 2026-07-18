import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft, RefreshCw, Search, FileText, Shield, ShieldCheck, ShieldAlert,
  Clock, CheckCircle, XCircle, Loader2, Eye, FolderOpen, BookOpen, AlertTriangle,
  Settings, Activity, ClipboardList, Ban, Send, ScrollText, Archive,
  BarChart3, History, UserCheck, ThumbsUp, ThumbsDown, MessageSquare,
  Users, GraduationCap, Award, Library, Filter
} from 'lucide-react';

const ESTADOS_COORD = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'DICTAMINADO', 'VALIDADO', 'RECHAZADO'];
const TIPOS_OBSERVACION = ['REVISION_DOCUMENTAL', 'ANALISIS_CURRICULAR', 'OBSERVACION_GRAL', 'VALIDACION', 'DICTAMEN_PREVIO'];

function normalize(v) { return String(v || '').trim().toUpperCase(); }
function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function EstadoBadge({ estado }) {
  const map = {
    SOLICITADO: { cls: 'info', icon: Clock },
    EN_REVISION: { cls: 'warn', icon: Search },
    EN_ANALISIS: { cls: 'warn', icon: BookOpen },
    DICTAMINADO: { cls: 'ok', icon: FileText },
    VALIDADO: { cls: 'ok', icon: CheckCircle },
    RECHAZADO: { cls: 'error', icon: XCircle }
  };
  const m = map[estado] || { cls: 'info', icon: Clock };
  const Icon = m.icon;
  return (
    <span className={`badge ${m.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={13} /> {estado?.replace(/_/g, ' ')}
    </span>
  );
}

export default function CoordinadorTramitesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('bandeja');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [resumen, setResumen] = React.useState(null);
  const [tramites, setTramites] = React.useState([]);
  const [detalle, setDetalle] = React.useState(null);
  const [catalogos, setCatalogos] = React.useState(null);
  const [reportesData, setReportesData] = React.useState([]);
  const [bitacoraData, setBitacoraData] = React.useState([]);

  const [query, setQuery] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState('');
  const [filtroCarrera, setFiltroCarrera] = React.useState('');

  const [showObservacion, setShowObservacion] = React.useState(null);
  const [showProcedencia, setShowProcedencia] = React.useState(null);
  const [showRechazo, setShowRechazo] = React.useState(null);
  const [showAnalisis, setShowAnalisis] = React.useState(null);

  const [formObs, setFormObs] = React.useState({ tipo: 'OBSERVACION_GRAL', observacion: '', documento_referencia: '' });
  const [formProc, setFormProc] = React.useState({ procede: true, fundamento: '', observaciones: '' });
  const [formRech, setFormRech] = React.useState({ motivo_rechazo: '' });
  const [formAnalisis, setFormAnalisis] = React.useState({ analisis_curricular: '' });
  const [submitting, setSubmitting] = React.useState(false);

  const roleName = normalize(user?.rol_nombre || user?.rol || user?.role);

  React.useEffect(() => {
    if (roleName && !['ADMINISTRADOR', 'COORDINADOR'].includes(roleName)) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [roleName, navigate]);

  const loadResumen = React.useCallback(async () => {
    try { const r = await api.coordinadorTramites.resumen(token); setResumen(r?.data || r); } catch (e) { console.error(e); }
  }, [token]);

  const loadBandeja = React.useCallback(async () => {
    try {
      setLoading(true); setError('');
      const p = {};
      if (filtroTipo) p.tipo = filtroTipo;
      if (filtroEstado) p.estado = filtroEstado;
      if (filtroCarrera) p.carrera = filtroCarrera;
      if (query) p.search = query;
      const r = await api.coordinadorTramites.bandeja(token, p);
      setTramites(safeList(r));
    } catch (e) { setError(e?.message || 'Error'); setTramites([]); } finally { setLoading(false); }
  }, [token, query, filtroTipo, filtroEstado, filtroCarrera]);

  const loadCatalogos = React.useCallback(async () => {
    try { const r = await api.coordinadorTramites.catalogos(token); setCatalogos(r?.data || r); } catch (e) { console.error(e); }
  }, [token]);

  const loadDetalle = React.useCallback(async (id) => {
    try { setLoading(true); const r = await api.coordinadorTramites.obtener(token, id); setDetalle(r?.data || r); } catch (e) { setError(e?.message); } finally { setLoading(false); }
  }, [token]);

  const loadReportes = React.useCallback(async () => {
    try { setLoading(true); const r = await api.coordinadorTramites.reportes(token); setReportesData(safeList(r)); } catch (e) { setError(e?.message); } finally { setLoading(false); }
  }, [token]);

  const loadBitacora = React.useCallback(async () => {
    try { setLoading(true); const r = await api.coordinadorTramites.bitacora(token); setBitacoraData(safeList(r)); } catch (e) { setError(e?.message); } finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { if (!token) return; loadResumen(); loadCatalogos(); }, [token, loadResumen, loadCatalogos]);
  React.useEffect(() => { if (!token || activeTab !== 'bandeja') return; loadBandeja(); }, [token, activeTab, loadBandeja]);
  React.useEffect(() => { if (!token || activeTab !== 'reportes') return; loadReportes(); }, [token, activeTab, loadReportes]);
  React.useEffect(() => { if (!token || activeTab !== 'bitacora') return; loadBitacora(); }, [token, activeTab, loadBitacora]);

  const handlePasarRevision = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.pasarARevision(token, id); loadBandeja(); loadResumen(); if (detalle?.id_tramite === id) loadDetalle(id); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handlePasarAnalisis = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.pasarAAnalisis(token, id, formAnalisis); setShowAnalisis(null); setFormAnalisis({ analisis_curricular: '' }); loadDetalle(id); loadBandeja(); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handleDeterminarProcedencia = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.determinarProcedencia(token, id, formProc); setShowProcedencia(null); setFormProc({ procede: true, fundamento: '', observaciones: '' }); loadDetalle(id); loadBandeja(); loadResumen(); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handleValidar = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.validar(token, id); loadDetalle(id); loadBandeja(); loadResumen(); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handleRechazar = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.rechazar(token, id, formRech); setShowRechazo(null); setFormRech({ motivo_rechazo: '' }); loadDetalle(id); loadBandeja(); loadResumen(); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handleAgregarObs = async (id) => {
    try { setSubmitting(true); await api.coordinadorTramites.agregarObservacion(token, id, formObs); setShowObservacion(null); setFormObs({ tipo: 'OBSERVACION_GRAL', observacion: '', documento_referencia: '' }); loadDetalle(id); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const handleValidarDoc = async (idTramite, idDocumento) => {
    try { setSubmitting(true); await api.coordinadorTramites.validarDocumento(token, idTramite, idDocumento); loadDetalle(idTramite); } catch (e) { setError(e?.message); } finally { setSubmitting(false); }
  };

  const tabs = [
    { id: 'bandeja', label: 'Bandeja de Trámites', icon: ClipboardList },
    { id: 'detalle', label: 'Revisión Documental', icon: Eye },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
    { id: 'bitacora', label: 'Bitácora', icon: History }
  ];

  function renderObsModal() {
    if (!showObservacion) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowObservacion(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Agregar Observación</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowObservacion(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleAgregarObs(showObservacion); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Tipo</span>
              <select value={formObs.tipo} onChange={e => setFormObs({ ...formObs, tipo: e.target.value })}>
                {TIPOS_OBSERVACION.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="field">
              <span>Observación *</span>
              <textarea value={formObs.observacion} onChange={e => setFormObs({ ...formObs, observacion: e.target.value })} rows={4} required />
            </div>
            <div className="field">
              <span>Documento de referencia</span>
              <input value={formObs.documento_referencia} onChange={e => setFormObs({ ...formObs, documento_referencia: e.target.value })} placeholder="Nombre del documento (opcional)" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowObservacion(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Agregar Observación'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderProcedenciaModal() {
    if (!showProcedencia) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowProcedencia(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Determinar Procedencia — {showProcedencia.folio}</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowProcedencia(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleDeterminarProcedencia(showProcedencia.id_tramite); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>¿El trámite procede académicamente? *</span>
              <select value={formProc.procede} onChange={e => setFormProc({ ...formProc, procede: e.target.value === 'true' })} required>
                <option value="true">Sí, procede</option>
                <option value="false">No procede</option>
              </select>
            </div>
            <div className="field">
              <span>Fundamento académico *</span>
              <textarea value={formProc.fundamento} onChange={e => setFormProc({ ...formProc, fundamento: e.target.value })} rows={4} required placeholder="Explique el fundamento académico, comparación curricular, etc." />
            </div>
            <div className="field">
              <span>Observaciones adicionales</span>
              <textarea value={formProc.observaciones} onChange={e => setFormProc({ ...formProc, observaciones: e.target.value })} rows={2} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowProcedencia(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Determinar Procedencia'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderRechazoModal() {
    if (!showRechazo) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowRechazo(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Rechazar Trámite — {showRechazo.folio}</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowRechazo(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleRechazar(showRechazo.id_tramite); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Motivo de rechazo *</span>
              <textarea value={formRech.motivo_rechazo} onChange={e => setFormRech({ ...formRech, motivo_rechazo: e.target.value })} rows={4} required placeholder="Indique la razón del rechazo académico..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowRechazo(null)}>Cancelar</button>
              <button type="submit" className="btn danger" disabled={submitting}>{submitting ? 'Rechazando...' : 'Rechazar Trámite'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderAnalisisModal() {
    if (!showAnalisis) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowAnalisis(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Iniciar Análisis Curricular</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowAnalisis(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handlePasarAnalisis(showAnalisis); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Análisis curricular</span>
              <textarea value={formAnalisis.analisis_curricular} onChange={e => setFormAnalisis({ ...formAnalisis, analisis_curricular: e.target.value })} rows={5} placeholder="Describa el análisis curricular, comparación de planes, materias equivalentes, etc." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowAnalisis(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Iniciar Análisis'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderDetallePanel() {
    if (!detalle) {
      return (
        <SectionCard title="Revisión Documental" subtitle="Seleccione un trámite de la bandeja para revisar">
          <div className="empty">Ningún trámite seleccionado</div>
        </SectionCard>
      );
    }

    const d = detalle;
    const puedeTomarRevision = d.estado_actual === 'SOLICITADO';
    const puedePasarAnalisis = d.estado_actual === 'EN_REVISION';
    const puedeDeterminarProc = ['EN_REVISION', 'EN_ANALISIS'].includes(d.estado_actual);
    const puedeValidar = d.estado_actual === 'DICTAMINADO';
    const puedeRechazar = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS'].includes(d.estado_actual);

    return (
      <SectionCard
        title={`Revisión: ${d.folio}`}
        subtitle={`${d.tipo_tramite} — ${d.alumno_nombre}`}
        right={<EstadoBadge estado={d.estado_actual} />}
      >
        <div className="form-stack">
          <div className="grid-two">
            <div className="field"><span>Folio</span><strong>{d.folio}</strong></div>
            <div className="field"><span>Fecha</span><strong>{new Date(d.creado_en).toLocaleString('es-MX')}</strong></div>
            <div className="field"><span>Alumno</span><strong>{d.alumno_nombre}</strong></div>
            <div className="field"><span>Matrícula</span><strong>{d.matricula}</strong></div>
            <div className="field"><span>Carrera</span><strong>{d.nombre_carrera}</strong></div>
            <div className="field"><span>Semestre</span><strong>{d.semestre_actual || '—'}</strong></div>
          </div>

          {d.motivo && <div className="field"><span>Motivo</span><p style={{ whiteSpace: 'pre-wrap' }}>{d.motivo}</p></div>}

          <div className="status-list" style={{ marginTop: 16 }}>
            <div className={`status ${d.solicitud_validada ? 'ok' : 'warn'}`}>
              <CheckCircle size={18} /> Solicitud {d.solicitud_validada ? 'Validada' : 'Pendiente de validación'}
            </div>
            <div className={`status ${d.estado_actual !== 'SOLICITADO' ? 'ok' : 'info'}`}>
              <Search size={18} /> Revisión {d.estado_actual === 'SOLICITADO' ? 'Pendiente' : 'Iniciada'}
            </div>
            <div className={`status ${d.analisis_curricular ? 'ok' : 'info'}`}>
              <BookOpen size={18} /> Análisis Curricular {d.analisis_curricular ? 'Realizado' : 'Pendiente'}
            </div>
            <div className={`status ${d.procedencia_academica !== null ? 'ok' : 'info'}`}>
              {d.procedencia_academica ? <ThumbsUp size={18} /> : <ThumbsDown size={18} />}
              Procedencia: {d.procedencia_academica === null ? 'Sin determinar' : d.procedencia_academica ? 'Procede' : 'No procede'}
              {d.proc_nombre && <small> — {d.proc_nombre} {d.proc_apellido}</small>}
            </div>
            <div className={`status ${d.validado_coordinador ? 'ok' : 'info'}`}>
              <CheckCircle size={18} /> Validación Coordinador: {d.validado_coordinador ? 'Validado' : 'Pendiente'}
              {d.val_nombre && <small> — {d.val_nombre} {d.val_apellido}</small>}
            </div>
          </div>

          <div className="grid-two" style={{ marginTop: 16 }}>
            {puedeTomarRevision && (
              <button type="button" className="btn primary" onClick={() => handlePasarRevision(d.id_tramite)} disabled={submitting}>
                <Search size={16} /> Tomar para Revisión
              </button>
            )}
            {puedePasarAnalisis && (
              <button type="button" className="btn primary" onClick={() => setShowAnalisis(d.id_tramite)}>
                <BookOpen size={16} /> Iniciar Análisis Curricular
              </button>
            )}
            {puedeDeterminarProc && (
              <button type="button" className="btn primary" onClick={() => setShowProcedencia(d)}>
                {d.procedencia_academica !== null ? <RefreshCw size={16} /> : <ThumbsUp size={16} />}
                Determinar Procedencia
              </button>
            )}
            {puedeValidar && (
              <button type="button" className="btn primary" onClick={() => handleValidar(d.id_tramite)} disabled={submitting}>
                <CheckCircle size={16} /> Validar Trámite
              </button>
            )}
            {puedeRechazar && (
              <button type="button" className="btn danger" onClick={() => setShowRechazo(d)}>
                <XCircle size={16} /> Rechazar Trámite
              </button>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={() => setShowObservacion(d.id_tramite)}>
              <MessageSquare size={16} /> Agregar Observación
            </button>
          </div>

          {d.documentos && d.documentos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Documentos ({d.documentos.length})</h4>
              <div className="list">
                {d.documentos.map(doc => (
                  <div key={doc.id_documento} className="list-item">
                    <div>
                      <strong>{doc.tipo_documento}</strong>
                      <small style={{ display: 'block' }}>{doc.nombre_original}</small>
                    </div>
                    <span className={`badge ${doc.validado ? 'ok' : 'warn'}`}>
                      {doc.validado ? 'Validado' : 'Pendiente'}
                    </span>
                    {!doc.validado && (
                      <button type="button" className="btn secondary btn-sm" onClick={() => handleValidarDoc(d.id_tramite, doc.id_documento)} disabled={submitting}>
                        Validar
                      </button>
                    )}
                    <small style={{ color: 'var(--muted)' }}>{new Date(doc.subido_en).toLocaleDateString('es-MX')}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.observaciones && d.observaciones.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Observaciones ({d.observaciones.length})</h4>
              <div className="list">
                {d.observaciones.map(o => (
                  <div key={o.id_observacion} className="list-item">
                    <MessageSquare size={16} />
                    <div>
                      <strong>{o.tipo?.replace(/_/g, ' ')}</strong>
                      <p style={{ margin: '2px 0' }}>{o.observacion}</p>
                      {o.documento_referencia && <small>Ref: {o.documento_referencia}</small>}
                    </div>
                    <small style={{ color: 'var(--muted)' }}>{o.nombres} {o.apellido_paterno}<br />{new Date(o.creado_en).toLocaleString('es-MX')}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.historial_estados && d.historial_estados.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Historial de Estados</h4>
              <div className="list">
                {d.historial_estados.map(h => (
                  <div key={h.id_historial} className="list-item">
                    <strong>{h.estado_anterior || '—'} → {h.estado_nuevo}</strong>
                    <span>{h.nombres} {h.apellido_paterno} — {new Date(h.creado_en).toLocaleString('es-MX')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  function renderBandeja() {
    const stats = resumen ? [
      { icon: ClipboardList, label: 'Total en bandeja', value: resumen.total || 0, hint: 'Trámites activos' },
      { icon: Clock, label: 'Pendientes', value: resumen.pendientes || 0, hint: 'Rev./Análisis' },
      { icon: FileText, label: 'Dictaminados', value: resumen.dictaminados || 0, hint: 'Con dictamen' },
      { icon: CheckCircle, label: 'Validados', value: resumen.validados || 0, hint: 'Validados' }
    ] : [];

    return (
      <>
        {stats.length > 0 && <div className="stats-grid">{stats.map(s => <StatCard key={s.label} {...s} />)}</div>}

        <SectionCard
          title="Bandeja de Trámites"
          subtitle="Trámites pendientes de revisión académica"
          right={
            <div className="row gap wrap">
              <button type="button" className="btn secondary" onClick={loadBandeja}><RefreshCw size={16} /> Actualizar</button>
            </div>
          }
        >
          <div className="form-stack">
            <div className="grid-three">
              <div className="field">
                <span>Buscar</span>
                <div className="row gap"><Search size={18} className="muted" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Folio, matrícula, nombre..." /></div>
              </div>
              <div className="field">
                <span>Tipo</span>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogos?.tipos?.map(t => <option key={t.id_tipo} value={t.codigo}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <span>Estado</span>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {ESTADOS_COORD.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            {loading && <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Loader2 className="animate-spin" size={18} /> Cargando...</div>}
            {error && <div className="alert error">{error}</div>}

            <div className="list">
              {!loading && tramites.length === 0 && <div className="empty">No hay trámites en la bandeja</div>}
              {tramites.map(t => (
                <div key={t.id_tramite} className="list-item" style={{ cursor: 'pointer' }}
                  onClick={() => { setDetalle(null); setActiveTab('detalle'); loadDetalle(t.id_tramite); }}>
                  <div>
                    <strong>{t.folio}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{t.tipo_tramite} — {t.alumno_nombre} ({t.matricula})</small>
                  </div>
                  <EstadoBadge estado={t.estado_actual} />
                  {t.procedencia_academica !== null && (
                    <span className={`badge ${t.procedencia_academica ? 'ok' : 'error'}`}>
                      {t.procedencia_academica ? 'Procede' : 'No procede'}
                    </span>
                  )}
                  <small style={{ color: 'var(--muted)' }}>{new Date(t.creado_en).toLocaleDateString('es-MX')}</small>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderReportes() {
    return (
      <SectionCard title="Reportes Académicos" subtitle="Trámites dictaminados por periodo, tipo y carrera"
        right={<button type="button" className="btn secondary" onClick={loadReportes}><RefreshCw size={16} /> Actualizar</button>}>
        {loading ? (
          <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div>
        ) : (
          <div className="list">
            {reportesData.length === 0 && <div className="empty">Sin datos</div>}
            {reportesData.map(r => (
              <div key={r.id_tramite} className="list-item">
                <div>
                  <strong>{r.folio}</strong>
                  <small style={{ display: 'block' }}>{r.tipo_tramite} — {r.alumno} ({r.matricula})</small>
                  <small style={{ display: 'block', color: 'var(--muted)' }}>{r.nombre_carrera}</small>
                </div>
                <EstadoBadge estado={r.estado_actual} />
                {r.dictamen_tipo && <span className={`badge ${r.dictamen_tipo === 'FAVORABLE' ? 'ok' : 'error'}`}>{r.dictamen_tipo}</span>}
                {r.procedencia_academica !== null && <span className={`badge ${r.procedencia_academica ? 'ok' : 'error'}`}>{r.procedencia_academica ? 'Procede' : 'No'}</span>}
                <small style={{ color: 'var(--muted)' }}>{r.coord_nombre} {r.coord_apellido}<br />{new Date(r.creado_en).toLocaleDateString('es-MX')}</small>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  function renderBitacora() {
    return (
      <SectionCard title="Bitácora de Actividades" subtitle="Acciones del coordinador en el módulo de trámites"
        right={<button type="button" className="btn secondary" onClick={loadBitacora}><RefreshCw size={16} /> Actualizar</button>}>
        {loading ? (
          <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div>
        ) : (
          <div className="list">
            {bitacoraData.length === 0 && <div className="empty">Sin registros</div>}
            {bitacoraData.map(b => (
              <div key={b.id_auditoria || Math.random()} className="list-item">
                <Activity size={16} />
                <div>
                  <strong>{b.accion?.replace(/_/g, ' ')}</strong>
                  {b.folio && <small style={{ display: 'block' }}>Trámite: {b.folio}</small>}
                  {b.detalle && <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>{b.detalle}</p>}
                </div>
                <small style={{ color: 'var(--muted)' }}>{b.nombres} {b.apellido_paterno}<br />{new Date(b.creado_en).toLocaleString('es-MX')}</small>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Coordinación Académica • Trámites</div>
          <h1>Panel de Revisión de Trámites</h1>
          <p>Bandeja de trámites, revisión documental, dictamen académico, equivalencias, análisis curricular y control de procedencia.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Responsable</small><strong>Coordinador Académico</strong></div>
          <div className="meta-card"><small>Alcance</small><strong>Periodo, semestre, grupo, carrera</strong></div>
        </div>
      </section>

      <div className="tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={`btn ${activeTab === tab.id ? 'primary' : 'secondary'}`}
              onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'bandeja' && renderBandeja()}
      {activeTab === 'detalle' && renderDetallePanel()}
      {activeTab === 'reportes' && renderReportes()}
      {activeTab === 'bitacora' && renderBitacora()}

      {renderObsModal()}
      {renderProcedenciaModal()}
      {renderRechazoModal()}
      {renderAnalisisModal()}
    </div>
  );
}
