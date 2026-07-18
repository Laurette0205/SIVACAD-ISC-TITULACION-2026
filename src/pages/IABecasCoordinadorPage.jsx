import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft, BarChart3, BookMarked, CheckCircle2, ClipboardCheck, ClipboardList,
  Clock, Download, Eye, FileText, Filter, History, Loader2, MessageSquare,
  Search, Send, Shield, ShieldCheck, Target, UserCheck, Users, XCircle,
  AlertTriangle, ExternalLink, Flag, UserPlus, UserMinus, Activity
} from 'lucide-react';

const ESTATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'VALIDADA', label: 'Validada' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

const PRIORIDAD_OPTS = [
  { value: '', label: 'Todas' },
  { value: 'URGENTE', label: 'Urgente' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'BAJA', label: 'Baja' }
];

const TIPO_OBS_OPTS = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ACADEMICA', label: 'Académica' },
  { value: 'DOCUMENTAL', label: 'Documental' },
  { value: 'CANALIZACION', label: 'Canalización' },
  { value: 'DICTAMEN_PRELIMINAR', label: 'Dictamen preliminar' }
];

const AREAS_CANALIZACION = [
  { value: 'COORDINACION_ACADEMICA', label: 'Coordinación Académica' },
  { value: 'SERVICIOS_ESCOLARES', label: 'Servicios Escolares' },
  { value: 'FINANZAS', label: 'Finanzas' },
  { value: 'DIRECCION', label: 'Dirección' },
  { value: 'COMITE_BECAS', label: 'Comité de Becas' }
];

const TABS = [
  { id: 'bandeja', label: 'Bandeja', icon: ClipboardList },
  { id: 'candidatos', label: 'Candidatos', icon: Users },
  { id: 'elegibilidad', label: 'Elegibilidad', icon: ShieldCheck },
  { id: 'seguimiento', label: 'Seguimiento', icon: Activity },
  { id: 'observaciones', label: 'Observaciones', icon: MessageSquare }
];

function formatDate(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return String(value); }
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function badgeClass(estatus) {
  const m = { PENDIENTE: 'badge warning', EN_REVISION: 'badge light', VALIDADA: 'badge', APROBADA: 'badge success', RECHAZADA: 'badge danger', CANCELADA: 'badge' };
  return m[estatus] || 'badge';
}

export default function IABecasCoordinadorPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('bandeja');
  const [loading, setLoading] = React.useState({});
  const [error, setError] = React.useState(null);

  // Bandeja
  const [bandeja, setBandeja] = React.useState({ solicitudes: [], carreras: [], grupos: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
  const [filtrosB, setFiltrosB] = React.useState({ estatus: '', prioridad: '', id_carrera: '', id_grupo: '', busqueda: '' });
  const [solDetalle, setSolDetalle] = React.useState(null);

  // Candidatos
  const [candidatos, setCandidatos] = React.useState({ candidatos: [], carreras: [], semestres: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
  const [filtrosC, setFiltrosC] = React.useState({ id_carrera: '', semestre: '', busqueda: '', promedio_min: '' });

  // Elegibilidad
  const [elegibilidad, setElegibilidad] = React.useState(null);
  const [elegId, setElegId] = React.useState('');

  // Observaciones
  const [observaciones, setObservaciones] = React.useState({ observaciones: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
  const [nuevaObs, setNuevaObs] = React.useState({ id_solicitud: '', tipo_observacion: 'GENERAL', observacion: '', es_interna: false });

  // Seguimiento
  const [seguimiento, setSeguimiento] = React.useState({ seguimiento: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
  const [filtrosS, setFiltrosS] = React.useState({ estatus: '' });

  const fullName = React.useMemo(() => `${user?.nombres || ''} ${user?.apellido_paterno || ''}`.replace(/\s+/g, ' ').trim() || user?.nombre_completo || 'Coordinador', [user]);

  async function loadBandeja(p = 1) {
    setLoading(l => ({ ...l, bandeja: true }));
    try {
      const params = { page: p, limit: 20, ...filtrosB };
      const r = await api.iaBecasCoordBandeja(token, params);
      setBandeja(r?.data || { solicitudes: [], carreras: [], grupos: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, bandeja: false })); }
  }

  async function loadCandidatos(p = 1) {
    setLoading(l => ({ ...l, candidatos: true }));
    try {
      const params = { page: p, limit: 20, ...filtrosC };
      const r = await api.iaBecasCoordCandidatos(token, params);
      setCandidatos(r?.data || { candidatos: [], carreras: [], semestres: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, candidatos: false })); }
  }

  async function loadObservaciones(p = 1) {
    setLoading(l => ({ ...l, observaciones: true }));
    try {
      const r = await api.iaBecasCoordObservaciones(token, { page: p, limit: 20 });
      setObservaciones(r?.data || { observaciones: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, observaciones: false })); }
  }

  async function loadSeguimiento(p = 1) {
    setLoading(l => ({ ...l, seguimiento: true }));
    try {
      const params = { page: p, limit: 20, ...filtrosS };
      const r = await api.iaBecasCoordSeguimiento(token, params);
      setSeguimiento(r?.data || { seguimiento: [], paginacion: { page: 1, total: 0, total_paginas: 0 } });
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, seguimiento: false })); }
  }

  React.useEffect(() => {
    if (token) {
      if (activeTab === 'bandeja') loadBandeja();
      if (activeTab === 'candidatos') loadCandidatos();
      if (activeTab === 'seguimiento') loadSeguimiento();
      if (activeTab === 'observaciones') loadObservaciones();
    }
  }, [activeTab, token]);

  const verDetalle = async (id) => {
    try {
      setLoading(l => ({ ...l, detalle: true }));
      const r = await api.iaBecasCoordSolicitud(token, id);
      setSolDetalle(r?.data || null);
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, detalle: false })); }
  };

  const handleAsignar = async (id) => {
    try {
      await api.iaBecasCoordAsignar(token, id);
      loadBandeja();
      setSolDetalle(null);
    } catch (e) { setError(e?.message); }
  };

  const handlePrioridad = async (id, prioridad) => {
    try {
      await api.iaBecasCoordPrioridad(token, id, { prioridad });
      loadBandeja();
    } catch (e) { setError(e?.message); }
  };

  const handleCanalizar = async () => {
    const area = document.getElementById('area_canalizar')?.value;
    if (!solDetalle?.id_solicitud || !area) return;
    try {
      await api.iaBecasCoordCanalizar(token, { id_solicitud: solDetalle.id_solicitud, area_destino: area });
      alert(`Caso canalizado a ${area}`);
      verDetalle(solDetalle.id_solicitud);
    } catch (e) { setError(e?.message); }
  };

  const handleDictamenPreliminar = async (tipo) => {
    if (!solDetalle?.id_solicitud) return;
    const fundamento = prompt(`Fundamento para dictamen "${tipo}":`);
    if (!fundamento) return;
    try {
      const r = await api.iaBecasCoordDictamenPreliminar(token, { id_solicitud: solDetalle.id_solicitud, tipo_dictamen: tipo, fundamento });
      alert(r?.message);
      verDetalle(solDetalle.id_solicitud);
    } catch (e) { setError(e?.message); }
  };

  const handleElegibilidad = async () => {
    if (!elegId) return;
    try {
      setLoading(l => ({ ...l, elegibilidad: true }));
      const r = await api.iaBecasCoordElegibilidad(token, Number(elegId));
      setElegibilidad(r?.data || null);
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, elegibilidad: false })); }
  };

  const handleCrearObs = async (e) => {
    e.preventDefault();
    if (!nuevaObs.id_solicitud || !nuevaObs.observacion) return;
    try {
      await api.iaBecasCoordCrearObservacion(token, nuevaObs);
      setNuevaObs({ id_solicitud: '', tipo_observacion: 'GENERAL', observacion: '', es_interna: false });
      loadObservaciones();
    } catch (e) { setError(e?.message); }
  };

  function renderPaginacion(p, loadFn) {
    if (!p || p.total_paginas <= 1) return null;
    return (
      <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
        <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadFn(p.page - 1)}>Anterior</button>
        <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
        <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadFn(p.page + 1)}>Siguiente</button>
      </div>
    );
  }

  function renderBandeja() {
    const s = bandeja.solicitudes || [];
    const p = bandeja.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Bandeja de solicitudes</div>
            <h1>Gestión operativa de becas</h1>
            <p>Filtra, revisa perfiles, canaliza casos y emite dictámenes preliminares.</p>
          </div>
        </div>

        {solDetalle && (
          <SectionCard title={`Solicitud #${solDetalle.id_solicitud} - ${solDetalle.nombre_alumno}`} subtitle={solDetalle.matricula}>
            <div className="list">
              <div className="list-item"><strong>Código</strong><span>{solDetalle.codigo_solicitud}</span></div>
              <div className="list-item"><strong>Alumno</strong><span>{solDetalle.nombre_alumno} ({solDetalle.matricula})</span></div>
              <div className="list-item"><strong>Carrera / Grupo</strong><span>{solDetalle.nombre_carrera} • {solDetalle.nombre_grupo || 'Sin grupo'} • {solDetalle.turno || '—'}</span></div>
              <div className="list-item"><strong>Semestre / Promedio</strong><span>{solDetalle.semestre_actual}° • {solDetalle.promedio_actual ?? '—'}</span></div>
              <div className="list-item"><strong>Convocatoria</strong><span>{solDetalle.convocatoria_titulo || '—'} ({solDetalle.convocatoria_institucion || '—'})</span></div>
              <div className="list-item"><strong>Estatus</strong><span className={badgeClass(solDetalle.estatus_solicitud)}>{solDetalle.estatus_solicitud}</span></div>
              <div className="list-item"><strong>Prioridad</strong><span className="badge">{solDetalle.prioridad || 'NORMAL'}</span></div>
              <div className="list-item"><strong>Coordinador asignado</strong><span>{solDetalle.nombre_coordinador_asignado || 'Sin asignar'}</span></div>
              <div className="list-item"><strong>Canalizado a</strong><span>{solDetalle.canalizado_a || 'No canalizado'}</span></div>
              <div className="list-item"><strong>Total observaciones</strong><span>{solDetalle.total_observaciones ?? 0}</span></div>
              <div className="list-item"><strong>Total canalizaciones</strong><span>{solDetalle.total_canalizaciones ?? 0}</span></div>
              <div className="list-item"><strong>Fecha solicitud</strong><span>{formatDate(solDetalle.fecha_solicitud)}</span></div>
              {solDetalle.nota_solicitante && <div className="list-item"><strong>Nota del alumno</strong><span>{solDetalle.nota_solicitante}</span></div>}
            </div>

            {solDetalle.observaciones?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Observaciones ({solDetalle.observaciones.length})</strong>
                {solDetalle.observaciones.map(o => (
                  <div key={o.id_observacion} className="note" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    <div className="row gap" style={{ justifyContent: 'space-between' }}>
                      <span className="badge light">{o.tipo_observacion}</span>
                      <small>{o.nombre_usuario} • {formatDate(o.fecha_observacion)}</small>
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>{o.observacion}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1rem' }} className="row gap wrap">
              {!solDetalle.id_coordinador_asignado && (
                <button className="btn primary" onClick={() => handleAsignar(solDetalle.id_solicitud)}><UserPlus size={16} /> Asignarme</button>
              )}
              <select id="area_canalizar" className="form-field" style={{ width: 'auto', padding: '0.5rem' }}>
                <option value="">Canalizar a...</option>
                {AREAS_CANALIZACION.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <button className="btn secondary" onClick={handleCanalizar}><Send size={16} /> Canalizar</button>
              {['PENDIENTE', 'EN_REVISION'].includes(solDetalle.estatus_solicitud) && (
                <>
                  <button className="btn primary" onClick={() => handleDictamenPreliminar('APROBADA')}><CheckCircle2 size={16} /> Dictamen aprobatorio</button>
                  <button className="btn secondary" onClick={() => handleDictamenPreliminar('RECHAZADA')}><XCircle size={16} /> Dictamen rechazo</button>
                  <button className="btn secondary" onClick={() => handleDictamenPreliminar('CONDICIONADA')}><Shield size={16} /> Condicionada</button>
                </>
              )}
              <select onChange={e => { if (e.target.value) handlePrioridad(solDetalle.id_solicitud, e.target.value); }} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">Prioridad...</option>
                {PRIORIDAD_OPTS.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="btn secondary" onClick={() => setSolDetalle(null)}><ArrowLeft size={16} /> Cerrar</button>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Filtros" subtitle="Buscar por carrera, grupo, semestre y prioridad">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Estatus</label>
              <select value={filtrosB.estatus} onChange={e => setFiltrosB(f => ({ ...f, estatus: e.target.value }))}>{ESTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 130 }}>
              <label>Prioridad</label>
              <select value={filtrosB.prioridad} onChange={e => setFiltrosB(f => ({ ...f, prioridad: e.target.value }))}>{PRIORIDAD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 170 }}>
              <label>Carrera</label>
              <select value={filtrosB.id_carrera} onChange={e => setFiltrosB(f => ({ ...f, id_carrera: e.target.value }))}>
                <option value="">Todas</option>
                {(bandeja.carreras || []).map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 130 }}>
              <label>Grupo</label>
              <select value={filtrosB.id_grupo} onChange={e => setFiltrosB(f => ({ ...f, id_grupo: e.target.value }))}>
                <option value="">Todos</option>
                {(bandeja.grupos || []).map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
              <label>Buscar</label>
              <input type="text" value={filtrosB.busqueda} onChange={e => setFiltrosB(f => ({ ...f, busqueda: e.target.value }))} placeholder="Nombre, matrícula o código" />
            </div>
            <button className="btn primary" onClick={() => loadBandeja(1)}><Search size={16} /> Filtrar</button>
          </div>
        </SectionCard>

        <SectionCard title={`Solicitudes (${p.total || 0})`} subtitle={`Página ${p.page || 1} de ${p.total_paginas || 1}`}>
          {loading.bandeja ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          : s.length === 0 ? <div className="empty">No hay solicitudes en la bandeja</div>
          : <div className="list">{s.map(item => (
              <div key={item.id_solicitud} className="list-item" style={{ cursor: 'pointer' }} onClick={() => verDetalle(item.id_solicitud)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{item.nombre_alumno}</strong>
                    <span>{item.matricula} • {item.nombre_carrera || '—'} • {item.nombre_grupo || '—'}</span>
                    <small>{item.convocatoria_titulo || '—'} • {formatDate(item.fecha_solicitud)}</small>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span className={badgeClass(item.estatus_solicitud)}>{item.estatus_solicitud}</span>
                    {item.prioridad === 'ALTA' || item.prioridad === 'URGENTE' ? <div><small className="badge danger">{item.prioridad}</small></div> : null}
                  </div>
                </div>
              </div>
          ))}</div>}
          {renderPaginacion(p, loadBandeja)}
        </SectionCard>
      </div>
    );
  }

  function renderCandidatos() {
    const c = candidatos.candidatos || [];
    const p = candidatos.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Estudiantes candidatos</div>
            <h1>Perfiles académicos</h1>
            <p>Alumnos regulares por carrera, grupo, semestre y promedio para identificar candidatos a becas.</p>
          </div>
        </div>
        <SectionCard title="Filtros">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 170 }}>
              <label>Carrera</label>
              <select value={filtrosC.id_carrera} onChange={e => setFiltrosC(f => ({ ...f, id_carrera: e.target.value }))}>
                <option value="">Todas</option>
                {(candidatos.carreras || []).map(ca => <option key={ca.id_carrera} value={ca.id_carrera}>{ca.nombre_carrera}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 100 }}>
              <label>Semestre</label>
              <select value={filtrosC.semestre} onChange={e => setFiltrosC(f => ({ ...f, semestre: e.target.value }))}>
                <option value="">Todos</option>
                {(candidatos.semestres || []).map(s => <option key={s} value={s}>{s}°</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 120 }}>
              <label>Promedio mínimo</label>
              <input type="number" step="0.1" min="0" max="10" value={filtrosC.promedio_min} onChange={e => setFiltrosC(f => ({ ...f, promedio_min: e.target.value }))} placeholder="Ej: 8.0" />
            </div>
            <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
              <label>Buscar</label>
              <input type="text" value={filtrosC.busqueda} onChange={e => setFiltrosC(f => ({ ...f, busqueda: e.target.value }))} placeholder="Nombre o matrícula" />
            </div>
            <button className="btn primary" onClick={() => loadCandidatos(1)}><Search size={16} /> Buscar</button>
          </div>
        </SectionCard>
        <SectionCard title={`Candidatos (${p.total || 0})`}>
          {loading.candidatos ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          : c.length === 0 ? <div className="empty">No se encontraron candidatos</div>
          : <div className="list">{c.map((item, idx) => (
              <div key={item.id_alumno || idx} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <strong>{item.nombre_completo}</strong>
                    <span>{item.matricula} • {item.nombre_carrera || '—'} • {item.nombre_grupo || '—'} ({item.turno || '—'})</span>
                    <small>{item.correo || '—'} • Semestre {item.semestre_actual || '—'}</small>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 140 }}>
                    <div><strong>Prom: {Number(item.promedio_general || 0).toFixed(2)}</strong></div>
                    <small>Créditos: {item.creditos_acumulados || 0}</small>
                    <div><small className="badge light">Solicitudes: {item.solicitudes_previas || 0} | Becas: {item.becas_aprobadas || 0}</small></div>
                  </div>
                </div>
              </div>
          ))}</div>}
          {renderPaginacion(p, loadCandidatos)}
        </SectionCard>
      </div>
    );
  }

  function renderElegibilidad() {
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Evaluación de elegibilidad</div>
            <h1>Validación asistida por IA</h1>
            <p>Evalúa criterios académicos contra requisitos de convocatoria por solicitud.</p>
          </div>
        </div>
        <SectionCard title="Consultar elegibilidad">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 250 }}>
              <label>ID de solicitud</label>
              <input type="number" value={elegId} onChange={e => setElegId(e.target.value)} placeholder="Ej: 1" />
            </div>
            <button className="btn primary" onClick={handleElegibilidad} disabled={loading.elegibilidad || !elegId}>
              {loading.elegibilidad ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Evaluar elegibilidad
            </button>
          </div>
        </SectionCard>
        {elegibilidad && (
          <SectionCard title={`Resultado: ${elegibilidad.nombre_alumno}`} subtitle={elegibilidad.matricula}>
            <div className="list">
              <div className="list-item"><strong>Convocatoria</strong><span>{elegibilidad.convocatoria} ({elegibilidad.institucion})</span></div>
              <div className="list-item"><strong>Carrera / Grupo</strong><span>{elegibilidad.carrera || '—'} • {elegibilidad.grupo || '—'} ({elegibilidad.turno || '—'})</span></div>
              <div className="list-item"><strong>Semestre / Promedio</strong><span>{elegibilidad.semestre_actual}° • {elegibilidad.promedio_actual ?? '—'}</span></div>
              <div className="list-item"><strong>Créditos</strong><span>{elegibilidad.creditos_acumulados}</span></div>
              <div className="list-item"><strong>Estatus académico</strong><span>{elegibilidad.estatus_academico}</span></div>
              <div className="list-item"><strong>Elegible</strong><span className={elegibilidad.elegible ? 'badge success' : 'badge danger'}>{elegibilidad.elegible ? ' Elegible' : ' No elegible'}</span></div>
              <div className="list-item"><strong>Puntuación</strong><span>{elegibilidad.puntuacion}% ({elegibilidad.cumplidos}/{elegibilidad.total_criterios} criterios)</span></div>
            </div>
            {elegibilidad.criterios?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Criterios evaluados</strong>
                {elegibilidad.criterios.map((cr, idx) => (
                  <div key={idx} className="note" style={{ marginTop: '0.5rem', borderLeft: `4px solid ${cr.cumple ? 'var(--success)' : 'var(--danger)'}`, padding: '0.5rem' }}>
                    <div className="row gap" style={{ justifyContent: 'space-between' }}>
                      <span>{cr.criterio}</span>
                      <span className={cr.cumple ? 'badge success' : 'badge danger'}>{cr.cumple ? ' Cumple' : ' No cumple'}</span>
                    </div>
                    <small>{cr.detalle}</small>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    );
  }

  function renderObservaciones() {
    const o = observaciones.observaciones || [];
    const p = observaciones.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Observaciones y notas</div>
            <h1>Seguimiento de observaciones</h1>
            <p>Agrega notas académicas, documentales o generales a las solicitudes.</p>
          </div>
        </div>
        <SectionCard title="Nueva observación">
          <form className="form-stack" onSubmit={handleCrearObs}>
            <div className="two-col">
              <div className="form-field">
                <label>ID de solicitud</label>
                <input type="number" value={nuevaObs.id_solicitud} onChange={e => setNuevaObs(f => ({ ...f, id_solicitud: e.target.value }))} placeholder="Ej: 1" required />
              </div>
              <div className="form-field">
                <label>Tipo</label>
                <select value={nuevaObs.tipo_observacion} onChange={e => setNuevaObs(f => ({ ...f, tipo_observacion: e.target.value }))}>
                  {TIPO_OBS_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label>Observación</label>
              <textarea rows="3" value={nuevaObs.observacion} onChange={e => setNuevaObs(f => ({ ...f, observacion: e.target.value }))} placeholder="Describe la observación..." required />
            </div>
            <label className="row gap" style={{ alignItems: 'center', marginBottom: '0.75rem' }}>
              <input type="checkbox" checked={nuevaObs.es_interna} onChange={e => setNuevaObs(f => ({ ...f, es_interna: e.target.checked }))} />
              Observación interna (solo visible para coordinadores)
            </label>
            <button className="btn primary" type="submit"><MessageSquare size={16} /> Agregar observación</button>
          </form>
        </SectionCard>
        <SectionCard title={`Observaciones registradas (${p.total || 0})`}>
          {loading.observaciones ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          : o.length === 0 ? <div className="empty">No hay observaciones registradas</div>
          : <div className="list">{o.map(item => (
              <div key={item.id_observacion} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <strong>{item.nombre_alumno} (#{item.id_solicitud})</strong>
                    <span className="badge light">{item.tipo_observacion}</span>
                    <span>{item.observacion}</span>
                    <small>{item.nombre_usuario || '—'} • {formatDate(item.fecha_observacion)}{item.es_interna ? ' • Interna' : ''}</small>
                  </div>
                </div>
              </div>
          ))}</div>}
          {renderPaginacion(p, loadObservaciones)}
        </SectionCard>
      </div>
    );
  }

  function renderSeguimiento() {
    const s = seguimiento.seguimiento || [];
    const p = seguimiento.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Seguimiento de casos</div>
            <h1>Monitoreo de solicitudes</h1>
            <p>Clasificación por prioridad, estado, coordinador asignado y canalización.</p>
          </div>
        </div>
        <SectionCard title="Filtrar seguimiento">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 180 }}>
              <label>Estatus</label>
              <select value={filtrosS.estatus} onChange={e => { setFiltrosS(f => ({ ...f, estatus: e.target.value })); loadSeguimiento(1); }}>
                {ESTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </SectionCard>
        <SectionCard title={`Casos en seguimiento (${p.total || 0})`}>
          {loading.seguimiento ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          : s.length === 0 ? <div className="empty">No hay casos en seguimiento</div>
          : <div className="list">{s.map((item, idx) => (
              <div key={item.id_solicitud || idx} className="list-item" style={{ cursor: 'pointer' }} onClick={() => { setActiveTab('bandeja'); verDetalle(item.id_solicitud); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.nombre_alumno}</strong>
                    <span>{item.matricula} • {item.nombre_carrera || '—'} • {item.nombre_grupo || '—'}</span>
                    <small>{item.convocatoria_titulo || '—'} • {formatDate(item.fecha_solicitud)}</small>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 140 }}>
                    <span className={badgeClass(item.estatus_solicitud)}>{item.estatus_solicitud}</span>
                    {item.prioridad === 'URGENTE' && <div><small className="badge danger">URGENTE</small></div>}
                    {item.tipo_dictamen && <div><small className="badge">{item.tipo_dictamen}</small></div>}
                    <small style={{ display: 'block' }}>
                      {item.total_observaciones > 0 ? `${item.total_observaciones} obs.` : ''}
                      {item.total_canalizaciones > 0 ? ` | ${item.total_canalizaciones} can.` : ''}
                    </small>
                  </div>
                </div>
                {item.nombre_coordinador_asignado && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>Asignado: {item.nombre_coordinador_asignado}</div>}
                {item.canalizado_a && <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Canalizado: {item.canalizado_a}</div>}
              </div>
          ))}</div>}
          {renderPaginacion(p, loadSeguimiento)}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="hero-banner" style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <div className="badge light">Coordinación • IA de Becas</div>
            <h2 style={{ margin: '0.25rem 0' }}>Módulo de Coordinación de Becas</h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>{fullName} • Validación parcial • Seguimiento académico</p>
          </div>
          <button className="btn secondary" onClick={() => navigate('/app/ia/becas')} style={{ whiteSpace: 'nowrap' }}>
            <ArrowLeft size={16} /> Asistente IA
          </button>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {TABS.map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'primary' : 'secondary'}`} onClick={() => setActiveTab(tab.id)} style={{ fontSize: '0.85rem' }}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
          <button className="btn secondary" style={{ marginLeft: '1rem' }} onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {activeTab === 'bandeja' && renderBandeja()}
      {activeTab === 'candidatos' && renderCandidatos()}
      {activeTab === 'elegibilidad' && renderElegibilidad()}
      {activeTab === 'seguimiento' && renderSeguimiento()}
      {activeTab === 'observaciones' && renderObservaciones()}
    </div>
  );
}
