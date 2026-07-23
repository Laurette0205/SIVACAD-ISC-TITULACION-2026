import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  AlertCircle, ArrowLeft, BarChart3, CheckCircle, ChevronRight,
  ClipboardList, Clock, Download, ExternalLink, FileText,
  FolderOpen, HelpCircle, Loader, MessageSquare, Plus,
  RefreshCw, Save, Search, Send, Upload, User, X
} from 'lucide-react';

function EstadoBadge({ estado }) {
  const cfg = {
    SOLICITADO:  { color: 'var(--color-info)',    label: 'Solicitado' },
    EN_REVISION: { color: 'var(--color-warning)',  label: 'En Revisión' },
    EN_ANALISIS: { color: 'var(--color-accent)',   label: 'En Análisis' },
    OBSERVADO:   { color: 'var(--color-danger)',   label: 'Observado' },
    DICTAMINADO: { color: 'var(--color-success)',  label: 'Dictaminado' },
    VALIDADO:    { color: 'var(--color-primary)',  label: 'Validado' },
    EMITIDO:     { color: '#7b1fa2',               label: 'Emitido' },
    ENTREGADO:   { color: '#2e7d32',               label: 'Entregado' },
    RECHAZADO:   { color: 'var(--color-danger)',   label: 'Rechazado' },
    CERRADO:     { color: 'var(--color-muted)',    label: 'Cerrado' },
  };
  const c = cfg[estado] || { color: 'var(--color-muted)', label: estado };
  return (
    <span className="badge" style={{
      backgroundColor: c.color, color: '#fff',
      padding: '0.25rem 0.6rem', borderRadius: '1rem',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap'
    }}>{c.label}</span>
  );
}

export default function AlumnoTramitesPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('mis-tramites');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const [catalogos, setCatalogos] = useState({ tipos: [], periodos: [], alumno: null, tramites_activos: 0 });
  const [misTramites, setMisTramites] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [seguimiento, setSeguimiento] = useState(null);
  const [historialData, setHistorialData] = useState([]);
  const [filtros, setFiltros] = useState({ tipo: '', estado: '' });

  const [showSolicitar, setShowSolicitar] = useState(false);
  const [formSolicitud, setFormSolicitud] = useState({ id_tipo: '', motivo: '', id_periodo: '' });

  const loadCatalogos = useCallback(async () => {
    try { const r = await api.alumnoTramites.catalogos(token); if (r.ok) setCatalogos(r.data); }
    catch (e) { console.error(e); }
  }, [token]);

  const loadMisTramites = useCallback(async () => {
    try {
      const r = await api.alumnoTramites.misTramites(token, filtros);
      if (r.ok) setMisTramites(r.data);
    } catch (e) { console.error(e); }
  }, [token, filtros]);

  const loadDetalle = useCallback(async (id) => {
    if (!id) return;
    try { const r = await api.alumnoTramites.obtener(token, id); if (r.ok) setDetalle(r.data); }
    catch (e) { console.error(e); }
  }, [token]);

  const loadSeguimiento = useCallback(async (id) => {
    if (!id) return;
    try { const r = await api.alumnoTramites.seguimiento(token, id); if (r.ok) setSeguimiento(r.data); }
    catch (e) { console.error(e); }
  }, [token]);

  const loadHistorial = useCallback(async () => {
    try { const r = await api.alumnoTramites.historial(token); if (r.ok) setHistorialData(r.data); }
    catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCatalogos(), loadMisTramites()])
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [loadCatalogos, loadMisTramites]);

  const handleSolicitar = async (e) => {
    e.preventDefault();
    if (!formSolicitud.id_tipo) { setError('Selecciona un tipo de trámite'); return; }
    try {
      setSubmitting(true);
      const r = await api.alumnoTramites.solicitar(token, formSolicitud);
      if (r.ok) {
        setShowSolicitar(false);
        setFormSolicitud({ id_tipo: '', motivo: '', id_periodo: '' });
        loadMisTramites();
        loadCatalogos();
      } else {
        setError(r.message);
      }
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); }
  };

  const handleSubirDocumento = async (id) => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setError('Selecciona un archivo'); return; }
    const formData = new FormData();
    formData.append('documento', file);
    formData.append('tipo_documento', 'GENERAL');
    try {
      setUploadingId(id);
      setSubmitting(true);
      const r = await api.alumnoTramites.subirDocumento(token, id, formData);
      if (r.ok) {
        fileInputRef.current.value = '';
        loadDetalle(id);
      } else {
        setError(r.message);
      }
    } catch (e) { setError(e?.message); }
    finally { setSubmitting(false); setUploadingId(null); }
  };

  const handleDescargar = async (idTramite, idDocumento, nombre) => {
    try {
      const blob = await api.alumnoTramites.descargarDocumento(token, idTramite, idDocumento);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre || 'documento';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Error al descargar el documento');
    }
  };

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
        <h1><ClipboardList size={24} /> Mis Trámites</h1>
        <p className="text-muted">Solicita, da seguimiento y consulta tus trámites académicos</p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={18} /></button>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {[
          { key: 'mis-tramites', label: 'Mis Trámites', icon: ClipboardList },
          { key: 'solicitar', label: 'Nueva Solicitud', icon: Plus },
          { key: 'detalle', label: 'Detalle', icon: FileText },
          { key: 'seguimiento', label: 'Seguimiento', icon: Clock },
          { key: 'historial', label: 'Historial', icon: BarChart3 },
        ].map(tab => (
          <button key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === 'solicitar') setShowSolicitar(true);
              if (tab.key === 'historial') loadHistorial();
              if (tab.key === 'mis-tramites') { setDetalle(null); setSeguimiento(null); }
            }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ────────────── MIS TRÁMITES ────────────── */}
      {activeTab === 'mis-tramites' && (
        <div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon"><ClipboardList size={24} /></div>
              <div className="stat-value">{misTramites.length}</div>
              <div className="stat-label">Total trámites</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={24} /></div>
              <div className="stat-value">{catalogos.tramites_activos}</div>
              <div className="stat-label">Activos</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 'auto' }}
                value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos los tipos</option>
                {catalogos.tipos?.map(t => <option key={t.id_tipo} value={t.codigo}>{t.nombre}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }}
                value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos los estados</option>
                {['SOLICITADO','EN_REVISION','EN_ANALISIS','OBSERVADO','DICTAMINADO','VALIDADO','EMITIDO','ENTREGADO','RECHAZADO','CERRADO'].map(e =>
                  <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
                )}
              </select>
              <button className="btn primary btn-sm" onClick={loadMisTramites}><Search size={16} /> Filtrar</button>
              <button className="btn secondary btn-sm" onClick={() => setShowSolicitar(true)}><Plus size={16} /> Nueva solicitud</button>
            </div>
          </div>

          <div className="list">
            {misTramites.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                <ClipboardList size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                <p>Aún no has realizado ningún trámite.</p>
                <button className="btn primary" onClick={() => setShowSolicitar(true)}>
                  <Plus size={16} /> Solicitar trámite
                </button>
              </div>
            ) : (
              misTramites.map(t => (
                <div key={t.id_tramite} className="list-item" style={{
                  cursor: 'pointer', padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--color-border)'
                }}
                  onClick={() => { setDetalle(null); setActiveTab('detalle'); loadDetalle(t.id_tramite); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.tipo_tramite}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>Folio: {t.folio}</span>
                        <span>{new Date(t.creado_en).toLocaleDateString()}</span>
                        <span>{t.docs_subidos} documento(s)</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {t.entregado ? <CheckCircle size={16} color="var(--color-success)" /> : null}
                      <EstadoBadge estado={t.estado_actual} />
                      <ChevronRight size={16} style={{ color: 'var(--color-muted)' }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ────────────── SOLICITAR ────────────── */}
      {(activeTab === 'solicitar' || showSolicitar) && (
        <div className="modal-overlay" onClick={() => { setShowSolicitar(false); setActiveTab('mis-tramites'); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3><Plus size={18} /> Nueva solicitud de trámite</h3>
              <button className="modal-close" onClick={() => { setShowSolicitar(false); setActiveTab('mis-tramites'); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSolicitar}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                  {catalogos.alumno?.nombre_completo} — Matrícula: {catalogos.alumno?.matricula}
                </p>
                <div className="form-group">
                  <label>Tipo de trámite *</label>
                  <select className="form-input" value={formSolicitud.id_tipo}
                    onChange={e => setFormSolicitud(f => ({ ...f, id_tipo: e.target.value }))} required>
                    <option value="">Seleccionar...</option>
                    {catalogos.tipos?.map(t => (
                      <option key={t.id_tipo} value={t.id_tipo}>
                        {t.nombre}{t.descripcion ? ` — ${t.descripcion}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Periodo (opcional)</label>
                  <select className="form-input" value={formSolicitud.id_periodo}
                    onChange={e => setFormSolicitud(f => ({ ...f, id_periodo: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {catalogos.periodos?.map(p => (
                      <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Motivo</label>
                  <textarea className="form-input" rows={4}
                    placeholder="Describe el motivo de tu solicitud (opcional)"
                    value={formSolicitud.motivo}
                    onChange={e => setFormSolicitud(f => ({ ...f, motivo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    <HelpCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    Una vez creada la solicitud, podrás adjuntar documentos en la sección de detalle.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn secondary" onClick={() => { setShowSolicitar(false); setActiveTab('mis-tramites'); }} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={submitting || !formSolicitud.id_tipo}>
                  {submitting ? 'Enviando...' : <><Send size={16} /> Solicitar trámite</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────── DETALLE ────────────── */}
      {activeTab === 'detalle' && (
        <div>
          {!detalle ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
              <FileText size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <p>Selecciona un trámite de la lista para ver su detalle.</p>
              <button className="btn secondary" onClick={() => setActiveTab('mis-tramites')}>
                <ArrowLeft size={16} /> Volver a mis trámites
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>{detalle.tipo_tramite}</h3>
                  <EstadoBadge estado={detalle.estado_actual} />
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Folio: {detalle.folio}</p>

                <div className="form-group">
                  <label>Fecha de solicitud</label>
                  <p>{new Date(detalle.creado_en).toLocaleString()}</p>
                </div>
                <div className="form-group">
                  <label>Periodo</label>
                  <p>{detalle.nombre_periodo || 'No especificado'}</p>
                </div>
                {detalle.motivo && (
                  <div className="form-group">
                    <label>Motivo</label>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{detalle.motivo}</p>
                  </div>
                )}
                {detalle.dictamen && (
                  <div className="form-group">
                    <label>Dictamen</label>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{detalle.dictamen}</p>
                    {detalle.dictamen_tipo && (
                      <span className="badge" style={{
                        backgroundColor: detalle.dictamen_tipo === 'FAVORABLE' ? 'var(--color-success)' : 'var(--color-danger)',
                        color: '#fff'
                      }}>{detalle.dictamen_tipo}</span>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn secondary btn-sm"
                    onClick={() => { loadSeguimiento(detalle.id_tramite); setActiveTab('seguimiento'); }}>
                    <Clock size={16} /> Ver seguimiento
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Documentos</h3>

                <div style={{ marginBottom: '1rem', padding: '1rem', border: '2px dashed var(--color-border)', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                    onChange={() => handleSubirDocumento(detalle.id_tramite)} />
                  <button className="btn secondary" disabled={submitting || !['SOLICITADO', 'EN_REVISION', 'OBSERVADO'].includes(detalle.estado_actual)}
                    onClick={() => fileInputRef.current?.click()}>
                    {uploadingId === detalle.id_tramite ? <Loader size={16} className="spin" /> : <Upload size={16} />}
                    {' '}Adjuntar documento
                  </button>
                  {!['SOLICITADO', 'EN_REVISION', 'OBSERVADO'].includes(detalle.estado_actual) && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
                      No se pueden subir documentos en el estado actual
                    </p>
                  )}
                </div>

                {detalle.documentos?.length > 0 ? (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {detalle.documentos.map(doc => (
                      <div key={doc.id_documento} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem', marginBottom: '0.3rem',
                        backgroundColor: 'var(--color-bg-secondary, #f5f5f5)', borderRadius: '0.4rem'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{doc.tipo_documento}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            {doc.nombre_original} — {(doc.peso_bytes / 1024).toFixed(1)} KB
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            {new Date(doc.subido_en).toLocaleString()}
                            {doc.validado ? ' — ✅ Validado' : ' — ⏳ Pendiente'}
                          </div>
                        </div>
                        <button className="btn secondary btn-sm"
                          onClick={() => handleDescargar(detalle.id_tramite, doc.id_documento, doc.nombre_original)}>
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted" style={{ textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>
                    No has subido documentos todavía.
                  </p>
                )}
              </div>

              {/* Observaciones */}
              <div className="card" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Observaciones</h3>
                {detalle.observaciones?.length > 0 ? (
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {detalle.observaciones.map(obs => (
                      <div key={obs.id_observacion} style={{
                        padding: '0.5rem', marginBottom: '0.5rem',
                        backgroundColor: 'var(--color-bg-secondary, #f5f5f5)', borderRadius: '0.4rem'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                          {obs.nombres} {obs.apellido_paterno} — {obs.tipo?.replace(/_/g, ' ')}
                        </div>
                        <p style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{obs.observacion}</p>
                        <small style={{ color: 'var(--color-muted)' }}>{new Date(obs.creado_en).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin observaciones registradas.</p>
                )}
              </div>

              {/* Historial de estados */}
              <div className="card" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Historial de cambios</h3>
                {detalle.historial_estados?.length > 0 ? (
                  <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Anterior</th>
                        <th>Nuevo</th>
                        <th>Cambiado por</th>
                        <th>Observaciones</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.historial_estados.map(h => (
                        <tr key={h.id_historial}>
                          <td>{h.estado_anterior || '-'}</td>
                          <td><EstadoBadge estado={h.estado_nuevo} /></td>
                          <td>{h.nombres} {h.apellido_paterno}</td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.observaciones || '-'}</td>
                          <td>{new Date(h.creado_en).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sin cambios registrados.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────── SEGUIMIENTO ────────────── */}
      {activeTab === 'seguimiento' && (
        <div>
          {!seguimiento ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
              <Clock size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <p>Selecciona un trámite y ve a Detalle, luego haz clic en "Ver seguimiento".</p>
              <button className="btn secondary" onClick={() => setActiveTab('mis-tramites')}>
                <ArrowLeft size={16} /> Ir a mis trámites
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{seguimiento.tramite?.tipo_tramite}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Folio: {seguimiento.tramite?.folio}</p>
                </div>
                <EstadoBadge estado={seguimiento.tramite?.estado_actual} />
              </div>

              {seguimiento.tramite?.motivo && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary, #f5f5f5)', borderRadius: '0.4rem' }}>
                  <strong>Motivo:</strong> {seguimiento.tramite.motivo}
                </div>
              )}

              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                {seguimiento.pasos?.map((paso, idx) => (
                  <div key={idx} style={{
                    position: 'relative', paddingBottom: idx < seguimiento.pasos.length - 1 ? '1.5rem' : 0,
                    paddingLeft: '1.5rem', borderLeft: idx < seguimiento.pasos.length - 1 ? '2px solid ' + (paso.completed ? 'var(--color-success)' : 'var(--color-border)') : 'none',
                    marginLeft: '0.5rem'
                  }}>
                    <div style={{
                      position: 'absolute', left: '-0.65rem', top: '0',
                      width: '1.3rem', height: '1.3rem', borderRadius: '50%',
                      backgroundColor: paso.completed ? 'var(--color-success)' : 'var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '0.7rem', fontWeight: 700
                    }}>
                      {paso.completed ? '✓' : idx + 1}
                    </div>
                    <div style={{ fontWeight: paso.completed ? 600 : 400, color: paso.completed ? 'inherit' : 'var(--color-muted)' }}>
                      {paso.label}
                      {paso.date && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginLeft: '0.5rem' }}>
                          {new Date(paso.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────── HISTORIAL ────────────── */}
      {activeTab === 'historial' && (
        <div>
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Historial de cambios en tus trámites</h3>
            <button className="btn secondary btn-sm" onClick={loadHistorial}><RefreshCw size={16} /> Actualizar</button>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            {historialData.length === 0 ? (
              <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Sin actividad registrada.</p>
            ) : (
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Folio</th>
                    <th>Trámite</th>
                    <th>Cambio</th>
                    <th>Realizado por</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialData.map((h, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(h.cambio_en).toLocaleString()}</td>
                      <td>{h.folio}</td>
                      <td>{h.tipo_tramite}</td>
                      <td>{h.estado_anterior || '-'} → <EstadoBadge estado={h.estado_nuevo} /></td>
                      <td>{h.cambiado_por_nombre} {h.cambiado_por_apellido || ''}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.observaciones || '-'}</td>
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
