import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BookOpen, CheckCircle, ClipboardList, FileText, FolderOpen,
  LayoutDashboard, MessageSquare, Search, ThumbsUp, ThumbsDown,
  User, X, AlertCircle, RefreshCw, Eye, Send, BarChart3, Clock,
  Activity, GraduationCap, AlertTriangle, ArrowLeft, Save
} from 'lucide-react';

const ESTADOS_DOCENTE = ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'OBSERVADO', 'DICTAMINADO', 'VALIDADO'];

function EstadoBadge({ estado }) {
  const colors = {
    SOLICITADO: 'var(--color-info)',
    EN_REVISION: 'var(--color-warning)',
    EN_ANALISIS: 'var(--color-accent)',
    OBSERVADO: 'var(--color-danger)',
    DICTAMINADO: 'var(--color-success)',
    VALIDADO: 'var(--color-primary)',
    RECHAZADO: 'var(--color-danger)',
    CERRADO: 'var(--color-muted)',
  };
  const labels = {
    SOLICITADO: 'Solicitado',
    EN_REVISION: 'En Revisión',
    EN_ANALISIS: 'En Análisis',
    OBSERVADO: 'Observado',
    DICTAMINADO: 'Dictaminado',
    VALIDADO: 'Validado',
    RECHAZADO: 'Rechazado',
    CERRADO: 'Cerrado',
  };
  return (
    <span className="badge" style={{
      backgroundColor: colors[estado] || 'var(--color-muted)',
      color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '1rem',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {labels[estado] || estado}
    </span>
  );
}

export default function DocenteTramitesPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [misGrupos, setMisGrupos] = useState([]);
  const [bandeja, setBandeja] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [trayectoria, setTrayectoria] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [catalogos, setCatalogos] = useState({ tipos: [], estados: [], carreras: [] });
  const [alumnosGrupo, setAlumnosGrupo] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [filtrosBandeja, setFiltrosBandeja] = useState({ tipo: '', estado: '', search: '', opinion_pendiente: '' });

  const [showOpinion, setShowOpinion] = useState(null);
  const [showCompatibilidad, setShowCompatibilidad] = useState(null);
  const [formOpinion, setFormOpinion] = useState({ opinion: '', tipo_dictamen: '', observaciones: '' });
  const [formCompatibilidad, setFormCompatibilidad] = useState({ compatible: null, fundamento: '', materias: '' });
  const [showObservacion, setShowObservacion] = useState(null);
  const [formObs, setFormObs] = useState({ observacion: '', tipo: 'OPINION_DOCENTE' });
  const [showTrayectoria, setShowTrayectoria] = useState(null);

  const loadResumen = useCallback(async () => {
    try {
      const r = await api.docenteTramites.resumen(token);
      if (r.ok) setResumen(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadCatalogos = useCallback(async () => {
    try {
      const r = await api.docenteTramites.catalogos(token);
      if (r.ok) setCatalogos(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadMisGrupos = useCallback(async () => {
    try {
      const r = await api.docenteTramites.misGrupos(token);
      if (r.ok) setMisGrupos(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadBandeja = useCallback(async () => {
    try {
      const r = await api.docenteTramites.bandeja(token, filtrosBandeja);
      if (r.ok) setBandeja(r.data);
    } catch (e) { console.error(e); }
  }, [token, filtrosBandeja]);

  const loadDetalle = useCallback(async (id) => {
    if (!id) return;
    try {
      const r = await api.docenteTramites.obtener(token, id);
      if (r.ok) setDetalle(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadTrayectoria = useCallback(async (id) => {
    try {
      setShowTrayectoria('loading');
      const r = await api.docenteTramites.trayectoria(token, id);
      if (r.ok) { setTrayectoria(r.data); setShowTrayectoria('loaded'); }
    } catch (e) { setShowTrayectoria(null); console.error(e); }
  }, [token]);

  const loadReportes = useCallback(async () => {
    try {
      const r = await api.docenteTramites.reportes(token);
      if (r.ok) setReportes(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadBitacora = useCallback(async () => {
    try {
      const r = await api.docenteTramites.bitacora(token);
      if (r.ok) setBitacora(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadAlumnosGrupo = useCallback(async (idGrupo, idPeriodo) => {
    try {
      const r = await api.docenteTramites.alumnosGrupo(token, idGrupo, idPeriodo);
      if (r.ok) setAlumnosGrupo(r.data);
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadResumen(), loadCatalogos(), loadMisGrupos(), loadBandeja()])
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [loadResumen, loadCatalogos, loadMisGrupos, loadBandeja]);

  const handleEmitirOpinion = async (id) => {
    try {
      setSubmitting(true);
      const r = await api.docenteTramites.emitirOpinion(token, id, formOpinion);
      if (r.ok) {
        setShowOpinion(null);
        setFormOpinion({ opinion: '', tipo_dictamen: '', observaciones: '' });
        loadDetalle(id);
        loadBandeja();
        loadResumen();
      } else {
        setError(r.message);
      }
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); }
  };

  const handleConfirmarCompatibilidad = async (id) => {
    try {
      setSubmitting(true);
      const r = await api.docenteTramites.confirmarCompatibilidad(token, id, {
        compatible: formCompatibilidad.compatible,
        fundamento: formCompatibilidad.fundamento,
        materias: formCompatibilidad.materias ? formCompatibilidad.materias.split('\n').filter(Boolean) : []
      });
      if (r.ok) {
        setShowCompatibilidad(null);
        setFormCompatibilidad({ compatible: null, fundamento: '', materias: '' });
        loadDetalle(id);
      } else {
        setError(r.message);
      }
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); }
  };

  const handleAgregarObservacion = async (id) => {
    try {
      setSubmitting(true);
      const r = await api.docenteTramites.agregarObservacion(token, id, formObs);
      if (r.ok) {
        setShowObservacion(null);
        setFormObs({ observacion: '', tipo: 'OPINION_DOCENTE' });
        loadDetalle(id);
      } else {
        setError(r.message);
      }
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); }
  };

  const handleValidarObservaciones = async (id) => {
    try {
      setSubmitting(true);
      await api.docenteTramites.validarObservaciones(token, id);
      loadDetalle(id);
      loadBandeja();
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); }
  };

  const puedeOpinar = (d) => d && ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS'].includes(d.estado_actual);
  const puedeValidarObs = (d) => d && ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS', 'OBSERVADO'].includes(d.estado_actual);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><ClipboardList size={24} /> Trámites Académicos — Docente</h1>
        <p className="text-muted">Opinión académica, validación de materias y seguimiento de solicitudes vinculadas</p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={18} /></button>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {[
          { key: 'panel', label: 'Panel Docente', icon: LayoutDashboard },
          { key: 'solicitudes', label: 'Solicitudes Vinculadas', icon: FolderOpen },
          { key: 'detalle', label: 'Detalle / Opinión', icon: MessageSquare },
          { key: 'grupos', label: 'Mis Grupos', icon: GraduationCap },
          { key: 'reportes', label: 'Reportes', icon: BarChart3 },
          { key: 'bitacora', label: 'Bitácora', icon: Activity },
        ].map(tab => (
          <button key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); if (tab.key === 'reportes') loadReportes(); if (tab.key === 'bitacora') loadBitacora(); }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ────────────── PANEL DOCENTE ────────────── */}
      {activeTab === 'panel' && (
        <div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon"><ClipboardList size={24} /></div>
              <div className="stat-value">{resumen?.total || 0}</div>
              <div className="stat-label">Trámites vinculados</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={24} /></div>
              <div className="stat-value">{resumen?.pendientes_opinion || 0}</div>
              <div className="stat-label">Pendientes de opinión</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CheckCircle size={24} /></div>
              <div className="stat-value">{resumen?.opiniones_emitidas || 0}</div>
              <div className="stat-label">Opiniones emitidas</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><GraduationCap size={24} /></div>
              <div className="stat-value">{resumen?.mis_grupos || 0}</div>
              <div className="stat-label">Grupos activos</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Distribución por estado</h3>
            {resumen?.por_estado?.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {resumen.por_estado.map(e => (
                  <div key={e.estado_actual} className="stat-card" style={{ flex: '1 0 120px', textAlign: 'center' }}>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>{e.cantidad}</div>
                    <div className="stat-label"><EstadoBadge estado={e.estado_actual} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No hay trámites vinculados a tus grupos.</p>
            )}
          </div>

          <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Acciones rápidas</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => { setActiveTab('solicitudes'); setFiltrosBandeja(f => ({ ...f, opinion_pendiente: '1' })); }}>
                <MessageSquare size={16} /> Opinar en pendientes ({resumen?.pendientes_opinion || 0})
              </button>
              <button className="btn secondary" onClick={() => setActiveTab('grupos')}>
                <GraduationCap size={16} /> Ver mis grupos ({resumen?.mis_grupos || 0})
              </button>
              <button className="btn secondary" onClick={() => { setActiveTab('solicitudes'); setFiltrosBandeja(f => ({ ...f, opinion_pendiente: '' })); }}>
                <FolderOpen size={16} /> Todas las solicitudes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────── SOLICITUDES VINCULADAS ────────────── */}
      {activeTab === 'solicitudes' && (
        <div>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="Buscar (folio, matrícula, alumno)..."
                className="form-input" style={{ flex: '1 1 200px' }}
                value={filtrosBandeja.search} onChange={e => setFiltrosBandeja(f => ({ ...f, search: e.target.value }))} />
              <select className="form-input" style={{ width: 'auto' }}
                value={filtrosBandeja.tipo} onChange={e => setFiltrosBandeja(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos los tipos</option>
                {catalogos.tipos?.map(t => <option key={t.id_tipo} value={t.codigo}>{t.nombre}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }}
                value={filtrosBandeja.estado} onChange={e => setFiltrosBandeja(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos los estados</option>
                {ESTADOS_DOCENTE.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={filtrosBandeja.opinion_pendiente === '1'}
                  onChange={e => setFiltrosBandeja(f => ({ ...f, opinion_pendiente: e.target.checked ? '1' : '' }))} />
                Solo pendientes de opinión
              </label>
              <button className="btn primary btn-sm" onClick={loadBandeja}><Search size={16} /> Filtrar</button>
            </div>
          </div>

          <div className="list">
            {bandeja.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                <FolderOpen size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                <p>No se encontraron solicitudes vinculadas a tus grupos.</p>
              </div>
            ) : (
              bandeja.map(t => (
                <div key={t.id_tramite} className="list-item" style={{
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--color-border)'
                }}
                  onClick={() => { setDetalle(null); setActiveTab('detalle'); loadDetalle(t.id_tramite); }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {t.tipo_tramite} — {t.alumno_nombre}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', gap: '1rem' }}>
                      <span>Folio: {t.folio}</span>
                      <span>Matrícula: {t.matricula}</span>
                      <span>{t.nombre_carrera}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!t.docente_opinion_emitida && ['SOLICITADO', 'EN_REVISION', 'EN_ANALISIS'].includes(t.estado_actual) && (
                      <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600 }}>OPINIÓN PENDIENTE</span>
                    )}
                    <EstadoBadge estado={t.estado_actual} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ────────────── DETALLE / OPINIÓN ────────────── */}
      {activeTab === 'detalle' && (
        <div>
          {!detalle ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
              <MessageSquare size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <p>Selecciona una solicitud de la bandeja para ver su detalle.</p>
              <button className="btn secondary" onClick={() => setActiveTab('solicitudes')}>
                <FolderOpen size={16} /> Ir a solicitudes
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>{detalle.tipo_tramite}</h3>
                  <EstadoBadge estado={detalle.estado_actual} />
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>Folio: {detalle.folio}</p>

                <div className="form-group">
                  <label>Alumno</label>
                  <p style={{ fontWeight: 600 }}>{detalle.alumno_nombre}</p>
                </div>
                <div className="form-group">
                  <label>Matrícula / CURP</label>
                  <p>{detalle.matricula} / {detalle.curp}</p>
                </div>
                <div className="form-group">
                  <label>Carrera / Semestre</label>
                  <p>{detalle.nombre_carrera} — {detalle.semestre_actual}° semestre</p>
                </div>
                {detalle.motivo && (
                  <div className="form-group">
                    <label>Motivo</label>
                    <p>{detalle.motivo}</p>
                  </div>
                )}
                <div className="form-group">
                  <label>Solicitante</label>
                  <p>{detalle.sol_nombre} {detalle.sol_apellido}</p>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn primary btn-sm" onClick={() => loadTrayectoria(detalle.id_tramite)}>
                    <Eye size={16} /> Revisar trayectoria
                  </button>
                  {puedeOpinar(detalle) && !detalle.docente_opinion_emitida && (
                    <button className="btn btn-sm" style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
                      onClick={() => setShowOpinion(detalle.id_tramite)}>
                      <Send size={16} /> Emitir opinión académica
                    </button>
                  )}
                  {puedeOpinar(detalle) && (
                    <button className="btn secondary btn-sm" onClick={() => setShowCompatibilidad(detalle.id_tramite)}>
                      <ThumbsUp size={16} /> Confirmar compatibilidad
                    </button>
                  )}
                  {puedeValidarObs(detalle) && (
                    <button className="btn secondary btn-sm" onClick={() => setShowObservacion(detalle.id_tramite)}>
                      <MessageSquare size={16} /> Agregar observación
                    </button>
                  )}
                  {puedeValidarObs(detalle) && detalle.observaciones?.length > 0 && (
                    <button className="btn secondary btn-sm" onClick={() => handleValidarObservaciones(detalle.id_tramite)} disabled={submitting}>
                      <CheckCircle size={16} /> Validar observaciones
                    </button>
                  )}
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Estado del trámite</h3>
                {detalle.docente_opinion_emitida && (
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-success-bg, #e8f5e9)', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    Opinión docente emitida el {new Date(detalle.docente_opinion_en).toLocaleDateString()}
                  </div>
                )}

                <h4 style={{ marginBottom: '0.5rem' }}>Documentos</h4>
                {detalle.documentos?.length > 0 ? (
                  <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>
                    {detalle.documentos.map(doc => (
                      <li key={doc.id_documento}>
                        {doc.tipo_documento} — {doc.nombre_original}
                        {doc.validado ? ' ✅' : ' ⏳'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin documentos adjuntos</p>
                )}

                <h4 style={{ margin: '1rem 0 0.5rem' }}>Observaciones</h4>
                {detalle.observaciones?.length > 0 ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    {detalle.observaciones.map(obs => (
                      <div key={obs.id_observacion} style={{ padding: '0.5rem', marginBottom: '0.5rem', backgroundColor: 'var(--color-bg-secondary, #f5f5f5)', borderRadius: '0.4rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                          {obs.nombres} {obs.apellido_paterno} — {obs.tipo?.replace(/_/g, ' ')}
                        </div>
                        <p style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap' }}>{obs.observacion}</p>
                        <small style={{ color: 'var(--color-muted)' }}>{new Date(obs.creado_en).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin observaciones</p>
                )}

                <h4 style={{ margin: '1rem 0 0.5rem' }}>Historial de estados</h4>
                {detalle.historial_estados?.length > 0 ? (
                  <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem' }}>
                    {detalle.historial_estados.map(h => (
                      <div key={h.id_historial} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--color-border)' }}>
                        <span>{h.estado_anterior || '-'} → {h.estado_nuevo}</span>
                        <span style={{ color: 'var(--color-muted)' }}>{new Date(h.creado_en).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin historial</p>
                )}
              </div>

              {/* ---- Modal Opinión ---- */}
              {showOpinion === detalle.id_tramite && (
                <div className="modal-overlay" onClick={() => setShowOpinion(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div className="modal-header">
                      <h3>Emitir opinión académica</h3>
                      <button className="modal-close" onClick={() => setShowOpinion(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>Opinión académica *</label>
                        <textarea className="form-input" rows={5} placeholder="Describa su opinión técnica, análisis de la solicitud, observaciones curriculares..."
                          value={formOpinion.opinion} onChange={e => setFormOpinion(f => ({ ...f, opinion: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Tipo de dictamen (opcional)</label>
                        <select className="form-input" value={formOpinion.tipo_dictamen}
                          onChange={e => setFormOpinion(f => ({ ...f, tipo_dictamen: e.target.value }))}>
                          <option value="">Sin cambio de estado</option>
                          <option value="OBSERVADO">Observado (requiere atención)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Observaciones adicionales</label>
                        <textarea className="form-input" rows={3} placeholder="Notas adicionales..."
                          value={formOpinion.observaciones} onChange={e => setFormOpinion(f => ({ ...f, observaciones: e.target.value }))} />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn secondary" onClick={() => setShowOpinion(null)} disabled={submitting}>Cancelar</button>
                      <button className="btn primary" onClick={() => handleEmitirOpinion(detalle.id_tramite)}
                        disabled={submitting || !formOpinion.opinion.trim()}>
                        {submitting ? 'Enviando...' : <><Send size={16} /> Emitir opinión</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Modal Compatibilidad ---- */}
              {showCompatibilidad === detalle.id_tramite && (
                <div className="modal-overlay" onClick={() => setShowCompatibilidad(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div className="modal-header">
                      <h3>Confirmar compatibilidad de materias</h3>
                      <button className="modal-close" onClick={() => setShowCompatibilidad(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>¿Las materias son compatibles?</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                          <button className={`btn ${formCompatibilidad.compatible === true ? 'primary' : 'secondary'} btn-sm`}
                            onClick={() => setFormCompatibilidad(f => ({ ...f, compatible: true }))}>
                            <ThumbsUp size={16} /> Compatible
                          </button>
                          <button className={`btn ${formCompatibilidad.compatible === false ? 'danger' : 'secondary'} btn-sm`}
                            onClick={() => setFormCompatibilidad(f => ({ ...f, compatible: false }))}>
                            <ThumbsDown size={16} /> No compatible
                          </button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Fundamento</label>
                        <textarea className="form-input" rows={4} placeholder="Explique el fundamento técnico-académico de su dictamen..."
                          value={formCompatibilidad.fundamento} onChange={e => setFormCompatibilidad(f => ({ ...f, fundamento: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Materias (una por línea)</label>
                        <textarea className="form-input" rows={4} placeholder="Materia 1&#10;Materia 2&#10;Materia 3"
                          value={formCompatibilidad.materias} onChange={e => setFormCompatibilidad(f => ({ ...f, materias: e.target.value }))} />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn secondary" onClick={() => setShowCompatibilidad(null)} disabled={submitting}>Cancelar</button>
                      <button className="btn primary" onClick={() => handleConfirmarCompatibilidad(detalle.id_tramite)}
                        disabled={submitting || formCompatibilidad.compatible === null}>
                        {submitting ? 'Enviando...' : <><Save size={16} /> Confirmar</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Modal Observación ---- */}
              {showObservacion === detalle.id_tramite && (
                <div className="modal-overlay" onClick={() => setShowObservacion(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div className="modal-header">
                      <h3>Agregar observación docente</h3>
                      <button className="modal-close" onClick={() => setShowObservacion(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>Tipo</label>
                        <select className="form-input" value={formObs.tipo} onChange={e => setFormObs(f => ({ ...f, tipo: e.target.value }))}>
                          <option value="OPINION_DOCENTE">Opinión Docente</option>
                          <option value="VALIDACION_MATERIAS">Validación de Materias</option>
                          <option value="OBSERVACION_GRAL">Observación General</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Observación *</label>
                        <textarea className="form-input" rows={5} placeholder="Describa su observación..."
                          value={formObs.observacion} onChange={e => setFormObs(f => ({ ...f, observacion: e.target.value }))} />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn secondary" onClick={() => setShowObservacion(null)} disabled={submitting}>Cancelar</button>
                      <button className="btn primary" onClick={() => handleAgregarObservacion(detalle.id_tramite)}
                        disabled={submitting || !formObs.observacion.trim()}>
                        {submitting ? 'Enviando...' : <><Save size={16} /> Guardar</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Modal Trayectoria ---- */}
              {showTrayectoria && (
                <div className="modal-overlay" onClick={() => { setShowTrayectoria(null); setTrayectoria(null); }}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div className="modal-header">
                      <h3><BookOpen size={18} /> Trayectoria académica</h3>
                      <button className="modal-close" onClick={() => { setShowTrayectoria(null); setTrayectoria(null); }}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                      {showTrayectoria === 'loading' ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
                      ) : trayectoria ? (
                        <>
                          <div className="form-group">
                            <label>Alumno</label>
                            <p style={{ fontWeight: 600 }}>{trayectoria.alumno?.nombres} {trayectoria.alumno?.apellido_paterno} {trayectoria.alumno?.apellido_materno}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                              Matrícula: {trayectoria.alumno?.matricula} — {trayectoria.alumno?.nombre_carrera} — {trayectoria.alumno?.semestre_actual}° semestre
                              — Estatus: {trayectoria.alumno?.estatus_academico}
                            </p>
                          </div>

                          <h4 style={{ margin: '1rem 0 0.5rem' }}>Historial académico</h4>
                          {trayectoria.historial?.length > 0 ? (
                            <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                              <thead>
                                <tr>
                                  <th>Periodo</th>
                                  <th>Semestre</th>
                                  <th>Promedio</th>
                                  <th>Acreditadas</th>
                                  <th>Reprobadas</th>
                                  <th>Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trayectoria.historial.map(h => (
                                  <tr key={h.id_inscripcion}>
                                    <td>{h.nombre_periodo}</td>
                                    <td>{h.semestre}°</td>
                                    <td>{h.promedio_general?.toFixed(2) || '-'}</td>
                                    <td>{h.materias_acreditadas || 0}</td>
                                    <td>{h.materias_reprobadas || 0}</td>
                                    <td>{h.estado_inscripcion}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table></div>
                          ) : (
                            <p className="text-muted">Sin historial académico registrado</p>
                          )}

                          <h4 style={{ margin: '1rem 0 0.5rem' }}>Kardex / Materias cursadas</h4>
                          {trayectoria.kardex?.length > 0 ? (
                            <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                              <thead>
                                <tr>
                                  <th>Clave</th>
                                  <th>Materia</th>
                                  <th>Créditos</th>
                                  <th>Calificación</th>
                                  <th>Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trayectoria.kardex.map(k => (
                                  <tr key={k.id_kardex || `${k.id_materia}-${k.periodo_cursado}`}>
                                    <td>{k.clave_materia}</td>
                                    <td>{k.nombre_materia}</td>
                                    <td>{k.creditos || '-'}</td>
                                    <td>{k.calificacion ?? '-'}</td>
                                    <td>{k.estado || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table></div>
                          ) : (
                            <p className="text-muted">Sin materias registradas en kardex</p>
                          )}
                        </>
                      ) : null}
                    </div>
                    <div className="modal-footer">
                      <button className="btn secondary" onClick={() => { setShowTrayectoria(null); setTrayectoria(null); }}>
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────── MIS GRUPOS ────────────── */}
      {activeTab === 'grupos' && (
        <div>
          {!grupoSeleccionado ? (
            <div>
              <div className="list">
                {misGrupos.length === 0 ? (
                  <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                    <GraduationCap size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    <p>No tienes grupos asignados en el período actual.</p>
                  </div>
                ) : (
                  misGrupos.map(g => (
                    <div key={g.id_carga_academica} className="list-item" style={{
                      cursor: 'pointer', padding: '1rem',
                      borderBottom: '1px solid var(--color-border)'
                    }}
                      onClick={() => { setGrupoSeleccionado(g); loadAlumnosGrupo(g.id_grupo, g.id_periodo); }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {g.nombre_grupo} — {g.nombre_materia}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                            {g.clave_materia} | {g.nombre_periodo} | {g.semestre}° semestre | {g.turno}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600 }}>{g.alumnos_activos}</div>
                          <div style={{ color: 'var(--color-muted)' }}>alumnos</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className="btn secondary btn-sm" onClick={() => { setGrupoSeleccionado(null); setAlumnosGrupo(null); }}>
                  <ArrowLeft size={16} /> Volver a grupos
                </button>
                <h3 style={{ margin: 0 }}>{grupoSeleccionado.nombre_grupo} — {grupoSeleccionado.nombre_materia}</h3>
              </div>

              <div className="card" style={{ padding: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Alumnos del grupo ({alumnosGrupo?.length || 0})</h4>
                {alumnosGrupo?.length > 0 ? (
                  <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Nombre</th>
                        <th>Carrera</th>
                        <th>Semestre</th>
                        <th>Estatus</th>
                        <th>Trámites</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosGrupo.map(a => (
                        <tr key={a.id_alumno}>
                          <td>{a.matricula}</td>
                          <td>{a.nombres} {a.apellido_paterno}</td>
                          <td>{a.nombre_carrera}</td>
                          <td>{a.semestre_actual}°</td>
                          <td>{a.estatus_academico}</td>
                          <td>{a.tramites_activos}</td>
                          <td>
                            <button className="btn secondary btn-sm" onClick={() => {
                              setFiltrosBandeja(f => ({ ...f, search: a.matricula }));
                              setActiveTab('solicitudes');
                            }}>
                              <Search size={14} /> Ver trámites
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <p className="text-muted">No hay alumnos activos en este grupo.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────── REPORTES ────────────── */}
      {activeTab === 'reportes' && (
        <div>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Reportes de trámites</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn secondary btn-sm" onClick={loadReportes}><RefreshCw size={16} /> Actualizar</button>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            {reportes.length === 0 ? (
              <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron reportes.</p>
            ) : (
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Tipo</th>
                    <th>Alumno</th>
                    <th>Carrera</th>
                    <th>Estado</th>
                    <th>Docente</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map(r => (
                    <tr key={r.id_tramite} style={{ cursor: 'pointer' }}
                      onClick={() => { setDetalle(null); setActiveTab('detalle'); loadDetalle(r.id_tramite); }}>
                      <td>{r.folio}</td>
                      <td>{r.tipo_tramite}</td>
                      <td>{r.alumno}</td>
                      <td>{r.nombre_carrera}</td>
                      <td><EstadoBadge estado={r.estado_actual} /></td>
                      <td>{r.docente_opinion_emitida ? '✅' : '⏳'}</td>
                      <td>{new Date(r.creado_en).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {/* ────────────── BITÁCORA ────────────── */}
      {activeTab === 'bitacora' && (
        <div>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Bitácora de actividad docente</h3>
            <button className="btn secondary btn-sm" onClick={loadBitacora}><RefreshCw size={16} /> Actualizar</button>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            {bitacora.length === 0 ? (
              <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Sin actividad registrada.</p>
            ) : (
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacora.map(b => (
                    <tr key={b.id_auditoria}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(b.creado_en).toLocaleString()}</td>
                      <td>{b.nombres} {b.apellido_paterno}</td>
                      <td><span className="badge" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: '0.7rem' }}>{b.accion}</span></td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.detalle}</td>
                      <td>{b.folio}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
