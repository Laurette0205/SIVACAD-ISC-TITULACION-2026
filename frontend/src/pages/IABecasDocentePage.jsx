import React from 'react';
import { Navigate } from 'react-router-dom';
import { api, canAccessBienestarDocenteIA } from '../services/api';
import {
  AlertTriangle, BarChart3, CheckCircle2, ClipboardList,
  Eye, FileText, Filter, Loader2, MessageSquare, RefreshCw,
  Search, Sparkles, Target, Users, X, Clock, UserCheck, GraduationCap,
  Activity, ArrowUpRight, Send, BookOpen, Shield, UserPlus
} from 'lucide-react';
import { playSuccessSound, playErrorSound } from '../utils/soundManager';
import SoundToggleButton from '../components/SoundToggleButton';
import { useAuth } from '../context/AuthContext';

const PRIORITY_COLORS = {
  CRITICO: '#ef4444', ALTO: '#f97316', MEDIO: '#eab308', BAJO: '#22c55e',
  'SIN_PROMEDIO': '#94a3b8'
};
const PRIORITY_BADGE = {
  CRITICO: 'status error', ALTO: 'status warn', MEDIO: 'status warn',
  BAJO: 'status ok', 'SIN_PROMEDIO': 'status'
};
const SEVERIDAD_COLORS = { ALTA: '#ef4444', MEDIA: '#f97316', BAJA: '#eab308' };
const ESTATUS_COLORS = {
  PENDIENTE: '#f59e0b', EN_REVISION: '#3b82f6', APROBADA: '#22c55e',
  RECHAZADA: '#ef4444', CANALIZADA: '#8b5cf6', OBSERVADA: '#f97316'
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)'
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 700,
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

export default function IABecasDocentePage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccess = canAccessBienestarDocenteIA(user);

  const [activeTab, setActiveTab] = React.useState('sugeridos');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const tabs = [
    { key: 'sugeridos', label: 'Alumnos sugeridos', icon: Users },
    { key: 'alertas', label: 'Alertas académicas', icon: AlertTriangle },
    { key: 'observaciones', label: 'Observaciones', icon: MessageSquare },
    { key: 'canalizar', label: 'Canalizar', icon: Send },
    { key: 'seguimiento', label: 'Seguimiento', icon: Activity }
  ];

  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    if (isError) playErrorSound(); else playSuccessSound();
    setTimeout(() => setMessage(''), 5000);
  };

  if (authLoading) {
    return <div className="loading-container"><Loader2 className="spinner" size={40} /></div>;
  }

  if (!token || !canAccess) {
    const home = getHomeRouteByUser ? getHomeRouteByUser() : '/login';
    return <Navigate to={home} replace />;
  }

  return (
    <div className="page-container">
      <SoundToggleButton />

      <div className="page-header">
        <div className="page-title-row">
          <h1><Sparkles size={24} /> IA de Becas - Docente</h1>
          <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ padding: '6px 12px' }}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
        <p style={{ color: '#64748b', margin: 0 }}>
          Panel de apoyo académico para la detección y canalización de candidatos a beca
        </p>
      </div>

      {message && (
        <div className={`alert ${message.includes('Error') || message.includes('error') ? 'alert-error' : 'alert-success'}`}>
          {message}
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

      {activeTab === 'sugeridos' && <AlumnosSugeridos token={token} user={user} showMessage={showMessage} />}
      {activeTab === 'alertas' && <AlertasAcademicas token={token} user={user} showMessage={showMessage} />}
      {activeTab === 'observaciones' && <Observaciones token={token} user={user} showMessage={showMessage} />}
      {activeTab === 'canalizar' && <Canalizar token={token} user={user} showMessage={showMessage} />}
      {activeTab === 'seguimiento' && <Seguimiento token={token} user={user} showMessage={showMessage} />}
    </div>
  );
}

function AlumnosSugeridos({ token, user, showMessage }) {
  const [alumnos, setAlumnos] = React.useState([]);
  const [meta, setMeta] = React.useState({ total: 0, pagina: 1, totalPaginas: 0 });
  const [loading, setLoading] = React.useState(true);
  const [selectedAlumno, setSelectedAlumno] = React.useState(null);
  const [detalleOpen, setDetalleOpen] = React.useState(false);

  const load = React.useCallback(async (page = 1) => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.iaBecasDocenteAlumnosSugeridos(token, { pagina: page, limite: 20 });
      if (res?.ok) { setAlumnos(res.data || []); setMeta(res.meta || {}); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const verDetalle = async (idAlumno) => {
    try {
      const res = await api.iaBecasDocenteDetalleAlumno(token, idAlumno);
      if (res?.ok) { setSelectedAlumno(res.data); setDetalleOpen(true); }
    } catch (e) { showMessage('Error al cargar detalle', true); }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3><Users size={18} /> Alumnos con necesidad potencial de beca ({meta.total})</h3>
        </div>
        {loading ? <div className="loading-container"><Loader2 className="spinner" size={32} /></div> : (
          <div className="table-responsive"><table className="table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nombre</th>
                <th>Carrera</th>
                <th>Semestre</th>
                <th>Promedio</th>
                <th>Créditos</th>
                <th>Prioridad</th>
                <th>Motivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map(a => (
                <tr key={a.id_alumno}>
                  <td>{a.matricula}</td>
                  <td>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</td>
                  <td>{a.nombre_carrera}</td>
                  <td>{a.semestre_actual}</td>
                  <td>{a.promedio_general ?? '-'}</td>
                  <td>{a.creditos_acumulados ?? '-'}</td>
                  <td><span className={PRIORITY_BADGE[a.nivel_prioridad] || 'status'} style={{ background: PRIORITY_COLORS[a.nivel_prioridad] }}>{a.nivel_prioridad}</span></td>
                  <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sugerencia_motivo}</td>
                  <td><button className="btn btn-sm" onClick={() => verDetalle(a.id_alumno)}><Eye size={14} /> Ver</button></td>
                </tr>
              ))}
              {!alumnos.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No se encontraron alumnos sugeridos</td></tr>}
            </tbody>
          </table></div>
        )}
        {meta.totalPaginas > 1 && (
          <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === meta.pagina ? 'btn-primary' : 'btn-outline'}`} onClick={() => load(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>

      <Modal open={detalleOpen} onClose={() => { setDetalleOpen(false); setSelectedAlumno(null); }} title="Detalle del alumno">
        {selectedAlumno && (
          <div>
            <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><strong>Nombre:</strong> {selectedAlumno.alumno?.apellido_paterno} {selectedAlumno.alumno?.apellido_materno} {selectedAlumno.alumno?.nombres}</div>
              <div><strong>Matrícula:</strong> {selectedAlumno.alumno?.matricula}</div>
              <div><strong>Carrera:</strong> {selectedAlumno.alumno?.nombre_carrera}</div>
              <div><strong>Semestre:</strong> {selectedAlumno.alumno?.semestre_actual}</div>
              <div><strong>Promedio:</strong> {selectedAlumno.alumno?.promedio_general ?? '-'}</div>
              <div><strong>Créditos:</strong> {selectedAlumno.alumno?.creditos_acumulados ?? '-'}</div>
              <div><strong>Estatus:</strong> {selectedAlumno.alumno?.estatus_academico}</div>
            </div>
            <h4>Solicitudes de beca ({selectedAlumno.solicitudes?.length || 0})</h4>
            {selectedAlumno.solicitudes?.length ? (
              <div className="table-responsive"><table className="table">
                <thead><tr><th>Código</th><th>Convocatoria</th><th>Estatus</th><th>Prioridad</th><th>Fecha</th></tr></thead>
                <tbody>
                  {selectedAlumno.solicitudes.map(s => (
                    <tr key={s.id_solicitud}>
                      <td>{s.codigo_solicitud}</td>
                      <td>{s.convocatoria_titulo}</td>
                      <td><span className="status" style={{ background: ESTATUS_COLORS[s.estatus_solicitud] || '#94a3b8' }}>{s.estatus_solicitud}</span></td>
                      <td>{s.prioridad}</td>
                      <td>{s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p style={{ color: '#94a3b8' }}>Sin solicitudes de beca registradas</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AlertasAcademicas({ token, user, showMessage }) {
  const [alertas, setAlertas] = React.useState([]);
  const [meta, setMeta] = React.useState({ total: 0, pagina: 1, totalPaginas: 0 });
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (page = 1) => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.iaBecasDocenteAlertasAcademicas(token, { pagina: page, limite: 20 });
      if (res?.ok) { setAlertas(res.data || []); setMeta(res.meta || {}); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3><AlertTriangle size={18} /> Alertas académicas ({meta.total})</h3>
        </div>
        {loading ? <div className="loading-container"><Loader2 className="spinner" size={32} /></div> : (
          <div className="table-responsive"><table className="table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nombre</th>
                <th>Carrera</th>
                <th>Grupo</th>
                <th>Tipo alerta</th>
                <th>Descripción</th>
                <th>Severidad</th>
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map(a => (
                <tr key={a.id_alumno}>
                  <td>{a.matricula}</td>
                  <td>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</td>
                  <td>{a.nombre_carrera}</td>
                  <td>{a.nombre_grupo} ({a.turno})</td>
                  <td>{a.tipo_alerta}</td>
                  <td style={{ fontSize: 12 }}>{a.descripcion_alerta}</td>
                  <td><span className="status" style={{ background: SEVERIDAD_COLORS[a.severidad] || '#94a3b8' }}>{a.severidad}</span></td>
                  <td>{a.promedio_general ?? '-'}</td>
                </tr>
              ))}
              {!alertas.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Sin alertas académicas activas</td></tr>}
            </tbody>
          </table></div>
        )}
        {meta.totalPaginas > 1 && (
          <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === meta.pagina ? 'btn-primary' : 'btn-outline'}`} onClick={() => load(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Observaciones({ token, user, showMessage }) {
  const [solicitudId, setSolicitudId] = React.useState('');
  const [observaciones, setObservaciones] = React.useState([]);
  const [loadingObs, setLoadingObs] = React.useState(false);

  const [tipoObs, setTipoObs] = React.useState('ACADEMICA');
  const [textoObs, setTextoObs] = React.useState('');
  const [esInterna, setEsInterna] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const tiposObs = ['ACADEMICA', 'CONDUCTA', 'APROVECHAMIENTO', 'ASISTENCIA', 'GENERAL', 'RECOMENDACION'];

  const cargarObservaciones = async () => {
    const id = Number(solicitudId);
    if (!id) { showMessage('Ingrese un ID de solicitud válido', true); return; }
    try {
      setLoadingObs(true);
      const res = await api.iaBecasDocenteObservaciones(token, id);
      if (res?.ok) setObservaciones(res.data || []);
    } catch (e) { showMessage('Error al cargar observaciones', true); } finally { setLoadingObs(false); }
  };

  const registrarObs = async () => {
    const id = Number(solicitudId);
    if (!id || !textoObs.trim()) { showMessage('Complete todos los campos', true); return; }
    try {
      setSaving(true);
      const res = await api.iaBecasDocenteCrearObservacion(token, { id_solicitud: id, tipo_observacion: tipoObs, observacion: textoObs, es_interna: esInterna });
      if (res?.ok) { showMessage('Observación registrada'); setTextoObs(''); cargarObservaciones(); }
      else showMessage(res?.message || 'Error al registrar', true);
    } catch (e) { showMessage('Error al registrar', true); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div className="card">
        <div className="card-header"><h3><MessageSquare size={18} /> Registrar observación</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label>ID de solicitud</label>
            <input className="form-control" type="number" value={solicitudId} onChange={e => setSolicitudId(e.target.value)} placeholder="Ej: 1" />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select className="form-control" value={tipoObs} onChange={e => setTipoObs(e.target.value)}>
              {tiposObs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Observación</label>
            <textarea className="form-control" rows={4} value={textoObs} onChange={e => setTextoObs(e.target.value)} placeholder="Describa la observación académica..." />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="interna" checked={esInterna} onChange={e => setEsInterna(e.target.checked)} />
            <label htmlFor="interna" style={{ margin: 0 }}>Observación interna (solo visible para coordinadores)</label>
          </div>
          <button className="btn btn-primary" onClick={registrarObs} disabled={saving}>
            {saving ? <Loader2 className="spinner" size={16} /> : <MessageSquare size={16} />} Registrar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><FileText size={18} /> Observaciones registradas</h3>
          <button className="btn btn-outline btn-sm" onClick={cargarObservaciones} disabled={loadingObs}>
            <RefreshCw size={14} /> {loadingObs ? 'Cargando...' : 'Consultar'}
          </button>
        </div>
        <div className="card-body">
          {observaciones.length ? (
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {observaciones.map(o => (
                <div key={o.id_observacion} style={{
                  padding: 12, marginBottom: 8, borderRadius: 8, background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="status" style={{ background: '#3b82f6', fontSize: 11 }}>{o.tipo_observacion}</span>
                    <small style={{ color: '#94a3b8' }}>{o.fecha_observacion ? new Date(o.fecha_observacion).toLocaleString() : ''}</small>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: 14 }}>{o.observacion}</p>
                  <small style={{ color: '#64748b' }}>Por: {o.nombre_usuario} ({o.rol_usuario})</small>
                  {o.es_interna ? <span className="status" style={{ background: '#8b5cf6', marginLeft: 8, fontSize: 11 }}>Interna</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
              {loadingObs ? 'Cargando...' : 'Consulte un ID de solicitud para ver sus observaciones'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Canalizar({ token, user, showMessage }) {
  const [form, setForm] = React.useState({ id_solicitud: '', area_destino: 'TUTORIAS', motivo: '' });
  const [saving, setSaving] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState('');
  const [solicitudes, setSolicitudes] = React.useState([]);
  const [loadingSol, setLoadingSol] = React.useState(false);

  const areas = ['TUTORIAS', 'PSICOLOGIA', 'TRABAJO_SOCIAL', 'COMITE_BECAS', 'COORDINACION_ACADEMICA', 'SERVICIOS_ESCOLARES', 'OTRO'];

  const buscarSolicitudes = async () => {
    if (!busqueda.trim()) return;
    try {
      setLoadingSol(true);
      const res = await api.iaBecasCoordBandeja(token, { busqueda, limite: 10 });
      if (res?.ok) setSolicitudes(res.data?.solicitudes || res.data || []);
    } catch (e) { console.error(e); } finally { setLoadingSol(false); }
  };

  const canalizar = async () => {
    if (!form.id_solicitud || !form.area_destino) { showMessage('Complete todos los campos', true); return; }
    try {
      setSaving(true);
      const res = await api.iaBecasDocenteCanalizar(token, {
        id_solicitud: Number(form.id_solicitud),
        area_destino: form.area_destino,
        motivo: form.motivo
      });
      if (res?.ok) { showMessage(res.message); setForm({ id_solicitud: '', area_destino: 'TUTORIAS', motivo: '' }); }
      else showMessage(res?.message || 'Error al canalizar', true);
    } catch (e) { showMessage('Error al canalizar', true); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div className="card">
        <div className="card-header"><h3><Send size={18} /> Recomendar canalización</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label>ID de solicitud</label>
            <input className="form-control" type="number" value={form.id_solicitud}
              onChange={e => setForm({ ...form, id_solicitud: e.target.value })}
              placeholder="Ej: 1" />
          </div>
          <div className="form-group">
            <label>Área destino</label>
            <select className="form-control" value={form.area_destino}
              onChange={e => setForm({ ...form, area_destino: e.target.value })}>
              {areas.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Motivo (opcional)</label>
            <textarea className="form-control" rows={3} value={form.motivo}
              onChange={e => setForm({ ...form, motivo: e.target.value })}
              placeholder="Describa el motivo de la canalización..." />
          </div>
          <button className="btn btn-primary" onClick={canalizar} disabled={saving}>
            {saving ? <Loader2 className="spinner" size={16} /> : <Send size={16} />} Canalizar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3><Search size={18} /> Buscar solicitudes</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="form-control" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, matrícula o código" onKeyDown={e => e.key === 'Enter' && buscarSolicitudes()} />
            <button className="btn btn-outline" onClick={buscarSolicitudes} disabled={loadingSol}>
              {loadingSol ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
            </button>
          </div>
          {solicitudes.length ? (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {solicitudes.map(s => (
                <div key={s.id_solicitud} style={{
                  padding: 10, marginBottom: 6, borderRadius: 8, background: '#f8fafc',
                  border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13
                }} onClick={() => setForm({ ...form, id_solicitud: String(s.id_solicitud) })}>
                  <strong>{s.codigo_solicitud}</strong> - {s.nombre_alumno}<br />
                  <small>{s.convocatoria_titulo} | <span className="status" style={{ background: ESTATUS_COLORS[s.estatus_solicitud] || '#94a3b8', fontSize: 11 }}>{s.estatus_solicitud}</span></small>
                </div>
              ))}
            </div>
          ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>{loadingSol ? 'Buscando...' : 'Realice una búsqueda para ver resultados'}</p>}
        </div>
      </div>
    </div>
  );
}

function Seguimiento({ token, user, showMessage }) {
  const [casos, setCasos] = React.useState([]);
  const [meta, setMeta] = React.useState({ total: 0, pagina: 1, totalPaginas: 0 });
  const [loading, setLoading] = React.useState(true);
  const [detalleOpen, setDetalleOpen] = React.useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = React.useState(null);

  const load = React.useCallback(async (page = 1) => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.iaBecasDocenteSeguimiento(token, { pagina: page, limite: 20 });
      if (res?.ok) { setCasos(res.data || []); setMeta(res.meta || {}); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const verDetalleCaso = async (idSolicitud) => {
    try {
      const res = await api.iaBecasDocenteObservaciones(token, idSolicitud);
      if (res?.ok) {
        setSelectedSolicitud({ id_solicitud: idSolicitud, observaciones: res.data || [] });
        setDetalleOpen(true);
      }
    } catch (e) { showMessage('Error al cargar detalle', true); }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3><Activity size={18} /> Seguimiento de casos ({meta.total})</h3>
        </div>
        {loading ? <div className="loading-container"><Loader2 className="spinner" size={32} /></div> : (
          <div className="table-responsive"><table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Alumno</th>
                <th>Convocatoria</th>
                <th>Estatus</th>
                <th>Prioridad</th>
                <th>Observaciones</th>
                <th>Canalizaciones</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {casos.map(s => (
                <tr key={s.id_solicitud}>
                  <td>{s.codigo_solicitud}</td>
                  <td>{s.nombre_alumno}</td>
                  <td style={{ fontSize: 12 }}>{s.convocatoria_titulo}</td>
                  <td><span className="status" style={{ background: ESTATUS_COLORS[s.estatus_solicitud] || '#94a3b8' }}>{s.estatus_solicitud}</span></td>
                  <td>{s.prioridad}</td>
                  <td style={{ textAlign: 'center' }}>{s.total_observaciones || 0}</td>
                  <td style={{ fontSize: 12 }}>{s.areas_canalizacion || '-'}</td>
                  <td style={{ fontSize: 12 }}>{s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString() : '-'}</td>
                  <td><button className="btn btn-sm" onClick={() => verDetalleCaso(s.id_solicitud)}><Eye size={14} /></button></td>
                </tr>
              ))}
              {!casos.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Sin casos en seguimiento</td></tr>}
            </tbody>
          </table></div>
        )}
        {meta.totalPaginas > 1 && (
          <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === meta.pagina ? 'btn-primary' : 'btn-outline'}`} onClick={() => load(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>

      <Modal open={detalleOpen} onClose={() => { setDetalleOpen(false); setSelectedSolicitud(null); }} title="Detalle de seguimiento">
        {selectedSolicitud && (
          <div>
            <p><strong>Solicitud ID:</strong> {selectedSolicitud.id_solicitud}</p>
            <h4>Observaciones ({selectedSolicitud.observaciones?.length || 0})</h4>
            {selectedSolicitud.observaciones?.length ? (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {selectedSolicitud.observaciones.map(o => (
                  <div key={o.id_observacion} style={{
                    padding: 12, marginBottom: 8, borderRadius: 8, background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="status" style={{ background: '#3b82f6', fontSize: 11 }}>{o.tipo_observacion}</span>
                      <small style={{ color: '#94a3b8' }}>{o.fecha_observacion ? new Date(o.fecha_observacion).toLocaleString() : ''}</small>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 14 }}>{o.observacion}</p>
                    <small style={{ color: '#64748b' }}>Por: {o.nombre_usuario} ({o.rol_usuario})</small>
                  </div>
                ))}
              </div>
            ) : <p style={{ color: '#94a3b8' }}>Sin observaciones registradas</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
