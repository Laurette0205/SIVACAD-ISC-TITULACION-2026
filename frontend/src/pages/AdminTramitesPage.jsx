import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft, RefreshCw, Search, FileText, Shield, ShieldCheck, ShieldAlert,
  UserCheck, UserX, Clock, CheckCircle, XCircle, Loader2, Download,
  Upload, Plus, Eye, FolderOpen, BookOpen, GraduationCap, AlertTriangle,
  Settings, Activity, ClipboardList, Ban, Send, Lock, Building2,
  ScrollText, Stethoscope, FileSignature, Folders, Printer, Archive,
  BarChart3, History, Monitor, Key, Megaphone, Library, Award
} from 'lucide-react';

const ESTADOS = ['SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'EMITIDO', 'CERRADO'];

const TIPOS_TRAMITE = {
  BAJA: { label: 'Baja', icon: Ban },
  TRASLADO: { label: 'Traslado', icon: Send },
  CAMBIO_CARRERA: { label: 'Cambio de Carrera', icon: BookOpen },
  EQUIVALENCIA: { label: 'Equivalencia', icon: Library },
  REVALIDACION: { label: 'Revalidación', icon: Award },
  CERTIFICADO_PARCIAL: { label: 'Certificado Parcial', icon: ScrollText },
  HISTORIAL_ACADEMICO: { label: 'Historial Académico', icon: FileText },
  CONSTANCIA: { label: 'Constancia', icon: ClipboardList }
};

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function tramiteIcon(codigo) {
  const t = TIPOS_TRAMITE[codigo];
  return t?.icon || FileText;
}

function pickTipoLabel(tipo) {
  const t = TIPOS_TRAMITE[tipo];
  return t?.label || tipo || '—';
}

function EstadoBadge({ estado }) {
  const map = {
    SOLICITADO: { cls: 'info', icon: Clock },
    EN_REVISION: { cls: 'warn', icon: Search },
    APROBADO: { cls: 'ok', icon: CheckCircle },
    RECHAZADO: { cls: 'error', icon: XCircle },
    EMITIDO: { cls: 'ok', icon: FileText },
    CERRADO: { cls: 'info', icon: Archive }
  };
  const m = map[estado] || { cls: 'info', icon: Clock };
  const Icon = m.icon;
  return (
    <span className={`badge ${m.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={13} />
      {estado?.replace(/_/g, ' ')}
    </span>
  );
}

export default function AdminTramitesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [resumen, setResumen] = React.useState(null);
  const [tramites, setTramites] = React.useState([]);
  const [detalle, setDetalle] = React.useState(null);
  const [catalogos, setCatalogos] = React.useState(null);
  const [bitacoraData, setBitacoraData] = React.useState([]);
  const [auditoriaData, setAuditoriaData] = React.useState([]);
  const [configuracion, setConfiguracion] = React.useState([]);

  const [query, setQuery] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState('');

  const [showCrear, setShowCrear] = React.useState(false);
  const [showDetalle, setShowDetalle] = React.useState(null);
  const [showDictamen, setShowDictamen] = React.useState(null);
  const [showRechazo, setShowRechazo] = React.useState(null);
  const [showEmitir, setShowEmitir] = React.useState(null);
  const [showCierre, setShowCierre] = React.useState(null);
  const [showDocUpload, setShowDocUpload] = React.useState(null);

  const [formCrear, setFormCrear] = React.useState({ id_tipo: '', id_alumno: '', motivo: '', id_periodo: '' });
  const [formDictamen, setFormDictamen] = React.useState({ dictamen: '', dictamen_tipo: 'FAVORABLE' });
  const [formRechazo, setFormRechazo] = React.useState({ motivo_rechazo: '' });
  const [formEmitir, setFormEmitir] = React.useState({ folio_documento: '', observaciones: '' });
  const [formDocUpload, setFormDocUpload] = React.useState({ tipo_documento: '', observaciones: '', archivo: null });
  const [formConfig, setFormConfig] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);

  const roleName = normalize(user?.rol_nombre || user?.rol || user?.role);

  React.useEffect(() => {
    if (roleName && roleName !== 'ADMINISTRADOR') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [roleName, navigate]);

  const loadResumen = React.useCallback(async () => {
    try {
      const r = await api.adminTramites.resumen(token);
      setResumen(r?.data || r);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadTramites = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroEstado) params.estado = filtroEstado;
      if (query) params.search = query;
      const r = await api.adminTramites.listar(token, params);
      setTramites(safeList(r));
    } catch (e) {
      setError(e?.message || 'Error al cargar trámites');
      setTramites([]);
    } finally {
      setLoading(false);
    }
  }, [token, query, filtroTipo, filtroEstado]);

  const loadCatalogos = React.useCallback(async () => {
    try {
      const r = await api.adminTramites.catalogos(token);
      setCatalogos(r?.data || r);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadBitacora = React.useCallback(async () => {
    try {
      const r = await api.adminTramites.bitacora(token);
      setBitacoraData(safeList(r));
    } catch (e) { console.error(e); }
  }, [token]);

  const loadAuditoria = React.useCallback(async () => {
    try {
      const r = await api.adminTramites.auditoria(token);
      setAuditoriaData(safeList(r));
    } catch (e) { console.error(e); }
  }, [token]);

  const loadConfig = React.useCallback(async () => {
    try {
      const r = await api.adminTramites.configuracion(token);
      const items = safeList(r);
      setConfiguracion(items);
      const map = {};
      items.forEach(i => { map[i.id_config] = i.valor; });
      setFormConfig(map);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadDetalle = React.useCallback(async (id) => {
    try {
      setLoading(true);
      const r = await api.adminTramites.obtener(token, id);
      setDetalle(r?.data || r);
    } catch (e) {
      setError(e?.message || 'Error al cargar detalle');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    loadResumen();
    loadCatalogos();
  }, [token, loadResumen, loadCatalogos]);

  React.useEffect(() => {
    if (!token || activeTab !== 'tramites') return;
    loadTramites();
  }, [token, activeTab, loadTramites]);

  React.useEffect(() => {
    if (!token || activeTab !== 'bitacora') return;
    loadBitacora();
  }, [token, activeTab, loadBitacora]);

  React.useEffect(() => {
    if (!token || activeTab !== 'auditoria') return;
    loadAuditoria();
  }, [token, activeTab, loadAuditoria]);

  React.useEffect(() => {
    if (!token || activeTab !== 'configuracion') return;
    loadConfig();
  }, [token, activeTab, loadConfig]);

  const handleCrear = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.adminTramites.crear(token, formCrear);
      setShowCrear(false);
      setFormCrear({ id_tipo: '', id_alumno: '', motivo: '', id_periodo: '' });
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al crear trámite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidarSolicitud = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.validarSolicitud(token, id);
      loadDetalle(id);
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al validar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmitirDictamen = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.emitirDictamen(token, id, formDictamen);
      setShowDictamen(null);
      setFormDictamen({ dictamen: '', dictamen_tipo: 'FAVORABLE' });
      loadDetalle(id);
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al emitir dictamen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRechazar = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.rechazar(token, id, formRechazo);
      setShowRechazo(null);
      setFormRechazo({ motivo_rechazo: '' });
      loadDetalle ? loadDetalle(id) : loadTramites();
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al rechazar trámite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutorizarCE = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.autorizarControlEscolar(token, id);
      loadDetalle(id);
      loadTramites();
    } catch (e) {
      setError(e?.message || 'Error al autorizar Control Escolar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutorizarDIV = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.autorizarDivisionISC(token, id);
      loadDetalle(id);
      loadTramites();
    } catch (e) {
      setError(e?.message || 'Error al autorizar División ISC');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmitirDocumento = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.emitirDocumento(token, id, formEmitir);
      setShowEmitir(null);
      setFormEmitir({ folio_documento: '', observaciones: '' });
      loadDetalle(id);
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al emitir documento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCerrar = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.cerrar(token, id, { observaciones: formCierre || '' });
      setShowCierre(null);
      loadDetalle(id);
      loadTramites();
      loadResumen();
    } catch (e) {
      setError(e?.message || 'Error al cerrar trámite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubirDocumento = async (id) => {
    try {
      if (!formDocUpload.archivo) {
        setError('Seleccione un archivo');
        return;
      }
      setSubmitting(true);
      const fd = new FormData();
      fd.append('archivo', formDocUpload.archivo);
      fd.append('tipo_documento', formDocUpload.tipo_documento);
      if (formDocUpload.observaciones) fd.append('observaciones', formDocUpload.observaciones);
      await api.adminTramites.subirDocumento(token, id, fd);
      setShowDocUpload(null);
      setFormDocUpload({ tipo_documento: '', observaciones: '', archivo: null });
      loadDetalle(id);
    } catch (e) {
      setError(e?.message || 'Error al subir documento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateConfig = async (id) => {
    try {
      setSubmitting(true);
      await api.adminTramites.actualizarConfig(token, id, formConfig[id]);
      loadConfig();
    } catch (e) {
      setError(e?.message || 'Error al actualizar configuración');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'panel', label: 'Panel Institucional', icon: Activity },
    { id: 'tramites', label: 'Trámites', icon: FileText },
    { id: 'detalle', label: 'Detalle / Autorización', icon: Eye },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
    { id: 'bitacora', label: 'Bitácora', icon: History },
    { id: 'auditoria', label: 'Auditoría', icon: Shield }
  ];

  const stats = resumen ? [
    { icon: FileText, label: 'Total trámites', value: resumen.total || 0, hint: 'Base institucional' },
    { icon: Clock, label: 'Pendientes', value: resumen.pendientes || 0, hint: 'Solicitado / En Revisión' },
    { icon: CheckCircle, label: 'Emitidos', value: resumen.emitidos || 0, hint: 'Documento emitido' },
    { icon: Archive, label: 'Cerrados', value: resumen.cerrados || 0, hint: 'Expediente resuelto' }
  ] : [];

  const [formCierre, setFormCierre] = React.useState('');

  function renderCrearModal() {
    if (!showCrear) return null;
    const tipos = safeList(catalogos?.tipos);
    const alumnos = safeList(catalogos?.alumnos);
    return (
      <div className="modal-backdrop" onClick={() => setShowCrear(false)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Nuevo Trámite</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowCrear(false)}>✕</button>
          </div>
          <form onSubmit={handleCrear} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Tipo de trámite *</span>
              <select value={formCrear.id_tipo} onChange={e => setFormCrear({ ...formCrear, id_tipo: e.target.value })} required>
                <option value="">Seleccionar</option>
                {tipos.map(t => <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <span>Alumno *</span>
              <select value={formCrear.id_alumno} onChange={e => setFormCrear({ ...formCrear, id_alumno: e.target.value })} required>
                <option value="">Seleccionar</option>
                {alumnos.map(a => (
                  <option key={a.id_alumno} value={a.id_alumno}>
                    {a.nombre_completo} — {a.matricula} ({a.nombre_carrera})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Motivo</span>
              <textarea value={formCrear.motivo} onChange={e => setFormCrear({ ...formCrear, motivo: e.target.value })} rows={3} />
            </div>
            {catalogos?.periodos && (
              <div className="field">
                <span>Período</span>
                <select value={formCrear.id_periodo} onChange={e => setFormCrear({ ...formCrear, id_periodo: e.target.value })}>
                  <option value="">Sin período</option>
                  {catalogos.periodos.map(p => (
                    <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowCrear(false)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Creando...' : 'Crear Trámite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderDictamenModal() {
    if (!showDictamen) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowDictamen(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Emitir Dictamen — {showDictamen.folio}</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowDictamen(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleEmitirDictamen(showDictamen.id_tramite); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Tipo de dictamen *</span>
              <select value={formDictamen.dictamen_tipo} onChange={e => setFormDictamen({ ...formDictamen, dictamen_tipo: e.target.value })} required>
                <option value="FAVORABLE">Favorable (Aprobar)</option>
                <option value="DESFAVORABLE">Desfavorable (Rechazar)</option>
              </select>
            </div>
            <div className="field">
              <span>Dictamen *</span>
              <textarea value={formDictamen.dictamen} onChange={e => setFormDictamen({ ...formDictamen, dictamen: e.target.value })} rows={5} required placeholder="Escriba el dictamen del coordinador..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowDictamen(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Emitir Dictamen'}
              </button>
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
              <textarea value={formRechazo.motivo_rechazo} onChange={e => setFormRechazo({ ...formRechazo, motivo_rechazo: e.target.value })} rows={4} required placeholder="Indique la razón del rechazo..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowRechazo(null)}>Cancelar</button>
              <button type="submit" className="btn danger" disabled={submitting}>
                {submitting ? 'Rechazando...' : 'Rechazar Trámite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderEmitirModal() {
    if (!showEmitir) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowEmitir(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Emitir Documento Oficial — {showEmitir.folio}</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowEmitir(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleEmitirDocumento(showEmitir.id_tramite); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Folio del documento oficial</span>
              <input value={formEmitir.folio_documento} onChange={e => setFormEmitir({ ...formEmitir, folio_documento: e.target.value })} placeholder="Ej. DOC-2026-0001" />
            </div>
            <div className="field">
              <span>Observaciones</span>
              <textarea value={formEmitir.observaciones} onChange={e => setFormEmitir({ ...formEmitir, observaciones: e.target.value })} rows={3} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowEmitir(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Emitiendo...' : 'Emitir Documento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderDocUploadModal() {
    if (!showDocUpload) return null;
    return (
      <div className="modal-backdrop" onClick={() => setShowDocUpload(null)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Subir Documento</h3>
            <button type="button" className="icon-btn modal-close" onClick={() => setShowDocUpload(null)}>✕</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubirDocumento(showDocUpload); }} className="form-stack" style={{ padding: '1.25rem' }}>
            <div className="field">
              <span>Tipo de documento *</span>
              <select value={formDocUpload.tipo_documento} onChange={e => setFormDocUpload({ ...formDocUpload, tipo_documento: e.target.value })} required>
                <option value="">Seleccionar</option>
                <option value="Solicitud Validada">Solicitud Validada</option>
                <option value="Dictamen del Coordinador">Dictamen del Coordinador</option>
                <option value="Identificaciones">Identificaciones</option>
                <option value="Expediente Completo">Expediente Completo</option>
                <option value="Firma/Autorización Institucional">Firma/Autorización Institucional</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="field">
              <span>Archivo *</span>
              <input type="file" onChange={e => setFormDocUpload({ ...formDocUpload, archivo: e.target.files[0] })} required />
            </div>
            <div className="field">
              <span>Observaciones</span>
              <textarea value={formDocUpload.observaciones} onChange={e => setFormDocUpload({ ...formDocUpload, observaciones: e.target.value })} rows={2} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowDocUpload(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderDetallePanel() {
    if (!detalle) {
      return (
        <SectionCard title="Detalle del trámite" subtitle="Seleccione un trámite de la lista para ver su detalle">
          <div className="empty">Ningún trámite seleccionado</div>
        </SectionCard>
      );
    }

    const d = detalle;
    const puedeValidar = d.estado_actual === 'SOLICITADO';
    const puedeDictaminar = d.estado_actual === 'EN_REVISION' && !d.id_coordinador_dictamen;
    const puedeAutorizarCE = d.estado_actual === 'APROBADO' && !d.autorizacion_control_escolar;
    const puedeAutorizarDIV = d.autorizacion_control_escolar && !d.autorizacion_division_isc;
    const puedeEmitir = d.autorizacion_control_escolar && d.autorizacion_division_isc && !d.documento_oficial_emitido;
    const puedeCerrar = d.documento_oficial_emitido && !d.cerrado;
    const puedeRechazar = ['SOLICITADO', 'EN_REVISION'].includes(d.estado_actual);

    return (
      <SectionCard
        title={`Trámite: ${d.folio}`}
        subtitle={`${d.tipo_tramite} — ${d.alumno_nombre}`}
        right={<EstadoBadge estado={d.estado_actual} />}
      >
        <div className="form-stack">
          <div className="grid-two">
            <div className="field">
              <span>Folio</span>
              <strong>{d.folio}</strong>
            </div>
            <div className="field">
              <span>Fecha de creación</span>
              <strong>{new Date(d.creado_en).toLocaleString('es-MX')}</strong>
            </div>
            <div className="field">
              <span>Alumno</span>
              <strong>{d.alumno_nombre}</strong>
            </div>
            <div className="field">
              <span>Matrícula</span>
              <strong>{d.matricula}</strong>
            </div>
            <div className="field">
              <span>Carrera</span>
              <strong>{d.nombre_carrera}</strong>
            </div>
            <div className="field">
              <span>CURP</span>
              <strong>{d.curp || '—'}</strong>
            </div>
            <div className="field">
              <span>Semestre</span>
              <strong>{d.semestre_actual || '—'}</strong>
            </div>
            <div className="field">
              <span>Solicitante</span>
              <strong>{d.solicitante_nombre} {d.solicitante_apellido}</strong>
            </div>
          </div>

          {d.motivo && (
            <div className="field">
              <span>Motivo</span>
              <p style={{ whiteSpace: 'pre-wrap' }}>{d.motivo}</p>
            </div>
          )}

          <div className="status-list" style={{ marginTop: 16 }}>
            <div className={`status ${d.solicitud_validada ? 'ok' : 'warn'}`}>
              <CheckCircle size={18} />
              Solicitud Validada {d.solicitud_validada ? `por ${d.validador_nombre || ''} ${d.validador_apellido || ''}` : '(pendiente)'}
            </div>
            <div className={`status ${d.id_coordinador_dictamen ? 'ok' : (d.estado_actual !== 'SOLICITADO' ? 'warn' : 'info')}`}>
              <FileText size={18} />
              Dictamen del Coordinador {d.id_coordinador_dictamen ? `(${d.dictamen_tipo})` : '(pendiente)'}
            </div>
            <div className={`status ${d.autorizacion_control_escolar ? 'ok' : 'warn'}`}>
              <Building2 size={18} />
              Autorización Control Escolar {d.autorizacion_control_escolar ? '✓' : '(pendiente)'}
              {d.control_escolar_nombre && <small> — {d.control_escolar_nombre} {d.control_escolar_apellido}</small>}
            </div>
            <div className={`status ${d.autorizacion_division_isc ? 'ok' : 'warn'}`}>
              <Shield size={18} />
              Autorización División ISC {d.autorizacion_division_isc ? '✓' : '(pendiente)'}
              {d.division_isc_nombre && <small> — {d.division_isc_nombre} {d.division_isc_apellido}</small>}
            </div>
            <div className={`status ${d.documento_oficial_emitido ? 'ok' : 'warn'}`}>
              <ScrollText size={18} />
              Documento Oficial Emitido {d.documento_oficial_emitido ? `(Folio: ${d.folio_documento_oficial || 'N/A'})` : '(pendiente)'}
            </div>
            <div className={`status ${d.cerrado ? 'ok' : 'info'}`}>
              <Archive size={18} />
              Expediente {d.cerrado ? 'Cerrado' : 'Abierto'}
            </div>
          </div>

          <div className="grid-two" style={{ marginTop: 16 }}>
            {puedeValidar && (
              <button type="button" className="btn primary" onClick={() => handleValidarSolicitud(d.id_tramite)} disabled={submitting}>
                <CheckCircle size={16} /> Validar Solicitud
              </button>
            )}
            {puedeDictaminar && (
              <button type="button" className="btn primary" onClick={() => setShowDictamen(d)}>
                <FileText size={16} /> Emitir Dictamen
              </button>
            )}
            {puedeAutorizarCE && (
              <button type="button" className="btn primary" onClick={() => handleAutorizarCE(d.id_tramite)} disabled={submitting}>
                <Building2 size={16} /> Autorizar Control Escolar
              </button>
            )}
            {puedeAutorizarDIV && (
              <button type="button" className="btn primary" onClick={() => handleAutorizarDIV(d.id_tramite)} disabled={submitting}>
                <Shield size={16} /> Autorizar División ISC
              </button>
            )}
            {puedeEmitir && (
              <button type="button" className="btn primary" onClick={() => setShowEmitir(d)}>
                <ScrollText size={16} /> Emitir Documento Oficial
              </button>
            )}
            {puedeCerrar && (
              <button type="button" className="btn primary" onClick={() => setShowCierre(d.id_tramite)}>
                <Archive size={16} /> Cerrar Expediente
              </button>
            )}
            {puedeRechazar && (
              <button type="button" className="btn danger" onClick={() => setShowRechazo(d)}>
                <XCircle size={16} /> Rechazar Trámite
              </button>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={() => setShowDocUpload(d.id_tramite)}>
              <Upload size={16} /> Subir Documento
            </button>
          </div>

          {d.documentos && d.documentos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Documentos ({d.documentos.length})</h4>
              <div className="list">
                {d.documentos.map(doc => (
                  <div key={doc.id_documento} className="list-item">
                    <strong>{doc.tipo_documento}</strong>
                    <span>{doc.nombre_original} — {new Date(doc.subido_en).toLocaleString('es-MX')}</span>
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
                    {h.observaciones && <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{h.observaciones}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  function renderPanel() {
    return (
      <>
        <section className="hero-banner">
          <div>
            <div className="badge light">Panel Institucional • Trámites Administrativos</div>
            <h1>Control de Trámites Académicos</h1>
            <p>Gestión centralizada de bajas, traslados, cambio de carrera, equivalencias, revalidaciones, certificados, historiales académicos y constancias.</p>
          </div>
          <div className="hero-meta">
            <div className="meta-card">
              <small>Responsable</small>
              <strong>Administrador Institucional</strong>
            </div>
            <div className="meta-card">
              <small>Alcance</small>
              <strong>Control Escolar + División ISC</strong>
            </div>
          </div>
        </section>

        {resumen && (
          <div className="stats-grid">
            {stats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {resumen?.por_estado && (
          <SectionCard title="Distribución por Estado" subtitle="Estado actual de los trámites en el sistema">
            <div className="list">
              {resumen.por_estado.map(e => (
                <div key={e.estado_actual} className="list-item">
                  <EstadoBadge estado={e.estado_actual} />
                  <span>{e.cantidad} trámite(s)</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {resumen?.por_tipo && (
          <SectionCard title="Distribución por Tipo de Trámite" subtitle="Volumen por tipo de trámite">
            <div className="list">
              {resumen.por_tipo.map(t => {
                const Icon = tramiteIcon(t.codigo);
                return (
                  <div key={t.codigo} className="list-item">
                    <Icon size={18} />
                    <strong>{t.nombre}</strong>
                    <span>{t.cantidad} trámite(s)</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Estado del Sistema" subtitle="Indicadores clave del módulo de trámites">
          <div className="status-list">
            <div className="status ok"><ShieldCheck size={18} /> Control centralizado con validación final y auditoría</div>
            <div className="status ok"><Activity size={18} /> Trazabilidad documental completa</div>
            <div className="status info"><AlertTriangle size={18} /> Las resoluciones finales requieren firma institucional</div>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderTramites() {
    return (
      <>
        <SectionCard
          title="Gestión de Trámites"
          subtitle="Listado completo de trámites administrativos"
          right={
            <div className="row gap wrap">
              <button type="button" className="btn secondary" onClick={() => { setShowCrear(true); }}>
                <Plus size={16} /> Nuevo Trámite
              </button>
              <button type="button" className="btn secondary" onClick={loadTramites}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          }
        >
          <div className="form-stack">
            <div className="grid-three">
              <div className="field">
                <span>Buscar</span>
                <div className="row gap">
                  <Search size={18} className="muted" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Folio, matrícula, nombre..." />
                </div>
              </div>
              <div className="field">
                <span>Tipo de trámite</span>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogos?.tipos?.map(t => <option key={t.id_tipo} value={t.codigo}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <span>Estado</span>
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            {loading && (
              <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 className="animate-spin" size={18} /> Cargando trámites...
              </div>
            )}
            {error && <div className="alert error">{error}</div>}

            <div className="list">
              {!loading && tramites.length === 0 && <div className="empty">No se encontraron trámites</div>}
              {tramites.map(t => {
                const Icon = tramiteIcon(t.tipo_codigo);
                return (
                  <div
                    key={t.id_tramite}
                    className="list-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setDetalle(null); setActiveTab('detalle'); loadDetalle(t.id_tramite); }}
                  >
                    <Icon size={18} />
                    <div>
                      <strong>{t.folio}</strong>
                      <small style={{ display: 'block', color: 'var(--muted)' }}>
                        {t.tipo_tramite} — {t.alumno_nombre} ({t.matricula})
                      </small>
                    </div>
                    <EstadoBadge estado={t.estado_actual} />
                    <small style={{ color: 'var(--muted)' }}>{new Date(t.creado_en).toLocaleDateString('es-MX')}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderBitacora() {
    return (
      <SectionCard
        title="Bitácora de Trámites"
        subtitle="Registro cronológico de acciones realizadas"
        right={<button type="button" className="btn secondary" onClick={loadBitacora}><RefreshCw size={16} /> Actualizar</button>}
      >
        {loading ? (
          <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 className="animate-spin" size={18} /> Cargando bitácora...
          </div>
        ) : (
          <div className="list">
            {bitacoraData.length === 0 && <div className="empty">Sin registros</div>}
            {bitacoraData.map(b => (
              <div key={b.id_auditoria || Math.random()} className="list-item">
                <Activity size={16} />
                <div>
                  <strong>{b.accion}</strong>
                  {b.folio && <small style={{ display: 'block' }}>Trámite: {b.folio}</small>}
                  {b.detalle && <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>{b.detalle}</p>}
                </div>
                <small style={{ color: 'var(--muted)' }}>
                  {b.nombres} {b.apellido_paterno}<br />
                  {new Date(b.creado_en).toLocaleString('es-MX')}
                </small>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  function renderAuditoria() {
    return (
      <SectionCard
        title="Auditoría de Trámites"
        subtitle="Registro completo con trazabilidad documental"
        right={<button type="button" className="btn secondary" onClick={loadAuditoria}><RefreshCw size={16} /> Actualizar</button>}
      >
        {loading ? (
          <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 className="animate-spin" size={18} /> Cargando auditoría...
          </div>
        ) : (
          <div className="list">
            {auditoriaData.length === 0 && <div className="empty">Sin registros</div>}
            {auditoriaData.map(a => (
              <div key={a.id_auditoria || Math.random()} className="list-item">
                <Shield size={16} />
                <div>
                  <strong>{a.accion}</strong>
                  <small style={{ display: 'block' }}>Trámite: {a.folio} ({a.tipo_tramite || '—'})</small>
                  {a.detalle && <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>{a.detalle}</p>}
                </div>
                <small style={{ color: 'var(--muted)' }}>
                  {a.nombres} {a.apellido_paterno}<br />
                  IP: {a.ip || '—'}<br />
                  {new Date(a.creado_en).toLocaleString('es-MX')}
                </small>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  function renderConfiguracion() {
    return (
      <SectionCard
        title="Configuración del Módulo de Trámites"
        subtitle="Parámetros generales del sistema"
        right={<button type="button" className="btn secondary" onClick={loadConfig}><RefreshCw size={16} /> Actualizar</button>}
      >
        <div className="form-stack">
          {configuracion.map(c => (
            <div key={c.id_config} className="field">
              <span>{c.descripcion || c.clave}</span>
              <div className="row gap">
                <input
                  value={formConfig[c.id_config] || ''}
                  onChange={e => setFormConfig({ ...formConfig, [c.id_config]: e.target.value })}
                />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => handleUpdateConfig(c.id_config)}
                  disabled={submitting}
                >
                  Guardar
                </button>
              </div>
              <small style={{ color: 'var(--muted)' }}>Clave: {c.clave}</small>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <div className="tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`btn ${activeTab === tab.id ? 'primary' : 'secondary'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'panel' && renderPanel()}
      {activeTab === 'tramites' && renderTramites()}
      {activeTab === 'detalle' && renderDetallePanel()}
      {activeTab === 'configuracion' && renderConfiguracion()}
      {activeTab === 'bitacora' && renderBitacora()}
      {activeTab === 'auditoria' && renderAuditoria()}

      {renderCrearModal()}
      {renderDictamenModal()}
      {renderRechazoModal()}
      {renderEmitirModal()}
      {renderDocUploadModal()}
    </div>
  );
}
