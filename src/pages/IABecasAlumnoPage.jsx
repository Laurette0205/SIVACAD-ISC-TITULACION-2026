import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import {
  AlertTriangle, ArrowLeft, BookMarked, CheckCircle2, Clock, ExternalLink,
  FileText, HeartPulse, History, Loader2, MessageSquare, Search, Send,
  Shield, ShieldCheck, Sparkles, Target, UserCheck, XCircle
} from 'lucide-react';

const TABS = [
  { id: 'estatus', label: 'Mi estatus', icon: UserCheck },
  { id: 'elegibilidad', label: 'Elegibilidad', icon: ShieldCheck },
  { id: 'solicitar', label: 'Solicitar beca', icon: Send },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'notificaciones', label: 'Notificaciones', icon: HeartPulse }
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

function badgeClass(st) {
  const m = { PENDIENTE: 'badge warning', EN_REVISION: 'badge light', VALIDADA: 'badge', APROBADA: 'badge success', RECHAZADA: 'badge danger', CANCELADA: 'badge' };
  return m[st] || 'badge';
}

const TIPO_ICONO = {
  check: <CheckCircle2 size={18} style={{ color: '#22c55e' }} />,
  x: <XCircle size={18} style={{ color: '#ef4444' }} />,
  eye: <Shield size={18} style={{ color: '#3b82f6' }} />,
  clock: <Clock size={18} style={{ color: '#f59e0b' }} />,
  megaphone: <Sparkles size={18} style={{ color: '#a855f7' }} />
};

export default function IABecasAlumnoPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('estatus');
  const [loading, setLoading] = React.useState({});
  const [error, setError] = React.useState(null);

  const [perfil, setPerfil] = React.useState(null);
  const [elegibilidad, setElegibilidad] = React.useState(null);
  const [solicitudes, setSolicitudes] = React.useState([]);
  const [notificaciones, setNotificaciones] = React.useState({ notificaciones: [], solicitudes: [], convocatorias: [] });
  const [convocatorias, setConvocatorias] = React.useState([]);
  const [recomendaciones, setRecomendaciones] = React.useState(null);
  const [seguimiento, setSeguimiento] = React.useState(null);
  const [solSeleccionada, setSolSeleccionada] = React.useState(null);

  const fullName = React.useMemo(() =>
    `${user?.nombres || ''} ${user?.apellido_paterno || ''}`.replace(/\s+/g, ' ').trim() || user?.nombre_completo || 'Alumno',
  [user]);

  async function loadPerfil() {
    setLoading(l => ({ ...l, perfil: true }));
    try { const r = await api.iaBecasAlumnoPerfil(token); setPerfil(r?.data || null); }
    catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, perfil: false })); }
  }

  async function loadElegibilidad() {
    setLoading(l => ({ ...l, elegibilidad: true }));
    try { const r = await api.iaBecasAlumnoElegibilidad(token); setElegibilidad(r?.data || null); }
    catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, elegibilidad: false })); }
  }

  async function loadSolicitudes() {
    setLoading(l => ({ ...l, solicitudes: true }));
    try { const r = await api.iaBecasAlumnoSolicitudes(token); setSolicitudes(r?.data?.solicitudes || []); }
    catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, solicitudes: false })); }
  }

  async function loadNotificaciones() {
    setLoading(l => ({ ...l, notificaciones: true }));
    try { const r = await api.iaBecasAlumnoNotificaciones(token); setNotificaciones(r?.data || { notificaciones: [], solicitudes: [], convocatorias: [] }); }
    catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, notificaciones: false })); }
  }

  async function loadConvocatorias() {
    setLoading(l => ({ ...l, convocatorias: true }));
    try { const r = await api.iaBecasAlumnoConvocatorias(token); setConvocatorias(r?.data?.convocatorias || []); }
    catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, convocatorias: false })); }
  }

  React.useEffect(() => {
    if (token) {
      loadPerfil();
      if (activeTab === 'elegibilidad') loadElegibilidad();
      if (activeTab === 'historial' || activeTab === 'estatus') loadSolicitudes();
      if (activeTab === 'notificaciones') loadNotificaciones();
      if (activeTab === 'solicitar') loadConvocatorias();
    }
  }, [activeTab, token]);

  const verSeguimiento = async (id) => {
    try {
      setLoading(l => ({ ...l, seguimiento: true }));
      const r = await api.iaBecasAlumnoSeguimiento(token, id);
      setSeguimiento(r?.data || null);
      setSolSeleccionada(id);
    } catch (e) { setError(e?.message); }
    finally { setLoading(l => ({ ...l, seguimiento: false })); }
  };

  const handleSolicitar = async (idConvocatoria) => {
    try {
      const r = await api.iaBecasAlumnoSolicitar(token, { id_convocatoria: idConvocatoria });
      alert(r?.message || 'Solicitud enviada');
      loadSolicitudes();
      setActiveTab('historial');
    } catch (e) { setError(e?.message); }
  };

  function renderEstatus() {
    const p = perfil;
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Mi estatus académico</div>
            <h1>Bienvenido, {fullName}</h1>
            <p>Consulta tu información académica y el estado de tus solicitudes de beca.</p>
          </div>
        </div>

        {loading.perfil ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
        : p ? <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-label">Promedio general</div><div className="stat-value">{p.promedio_general?.toFixed(2) ?? '—'}</div></div><div className="stat-icon"><Target size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Semestre actual</div><div className="stat-value">{p.semestre_actual ?? '—'}°</div></div><div className="stat-icon"><BookMarked size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Créditos</div><div className="stat-value">{p.creditos_acumulados ?? 0}</div></div><div className="stat-icon"><FileText size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Estatus académico</div><div className="stat-value" style={{ fontSize: '1rem' }}>{p.estatus_academico || '—'}</div></div><div className="stat-icon"><ShieldCheck size={22} /></div></div>
        </div> : <div className="empty">No se pudo cargar tu información. Asegúrate de usar una cuenta de alumno.</div>}

        {p && <div className="list" style={{ marginTop: '1rem' }}>
          <div className="list-item"><strong>Nombre</strong><span>{p.nombre_completo}</span></div>
          <div className="list-item"><strong>Matrícula</strong><span>{p.matricula}</span></div>
          <div className="list-item"><strong>Carrera</strong><span>{p.nombre_carrera || '—'}</span></div>
          <div className="list-item"><strong>Correo</strong><span>{p.correo || '—'}</span></div>
          <div className="list-item"><strong>Plan de estudios</strong><span>{p.nombre_plan || '—'} v{p.version_plan || '—'}</span></div>
        </div>}

        <SectionCard title="Mis solicitudes recientes" subtitle="Últimas solicitudes registradas">
          {solicitudes.length === 0 ? <div className="empty">No tienes solicitudes de beca registradas</div>
          : <div className="list">{solicitudes.slice(0, 5).map(s => (
            <div key={s.id_solicitud} className="list-item" style={{ cursor: 'pointer' }} onClick={() => { verSeguimiento(s.id_solicitud); setActiveTab('historial'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <strong>{s.convocatoria_titulo || 'Sin convocatoria'}</strong>
                  <span>Código: {s.codigo_solicitud} • {formatDate(s.fecha_solicitud)}</span>
                </div>
                <span className={badgeClass(s.estatus_solicitud)}>{s.estatus_solicitud}</span>
              </div>
            </div>
          ))}</div>}
        </SectionCard>
      </div>
    );
  }

  function renderElegibilidad() {
    const e = elegibilidad;
    return (
      <div className="stack">
        <div className="hero-banner">
          <div><div className="badge light">Evaluación de elegibilidad</div><h1>¿Eres elegible para una beca?</h1><p>Revisa los programas de becas disponibles y verifica si cumples con los requisitos.</p></div>
          <div className="hero-meta">
            <div className="meta-card"><small>Becas evaluadas</small><strong>{e?.total_evaluadas ?? '—'}</strong></div>
            <div className="meta-card"><small>Elegibles</small><strong>{e?.total_elegibles ?? '—'}</strong></div>
          </div>
        </div>

        {!e && <div className="flex-center"><button className="btn primary" onClick={loadElegibilidad} disabled={loading.elegibilidad}>{loading.elegibilidad ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Evaluar mi elegibilidad</button></div>}

        {e && <>
          <div className={`alert ${e.eligible ? 'success' : 'warning'}`} style={{ marginBottom: '1rem' }}>
            <strong>{e.eligible ? ' Eres elegible' : ' No eres elegible'}</strong>: {e.mensaje || 'Consulta los detalles por programa.'}
          </div>

          {e.alumno && <SectionCard title="Tus datos" subtitle="Información utilizada para la evaluación">
            <div className="list">
              <div className="list-item"><strong>Nombre</strong><span>{e.alumno.nombre_completo || fullName}</span></div>
              <div className="list-item"><strong>Promedio</strong><span>{e.alumno.promedio_general?.toFixed(2) ?? '—'}</span></div>
              <div className="list-item"><strong>Semestre</strong><span>{e.alumno.semestre_actual ?? '—'}°</span></div>
              <div className="list-item"><strong>Créditos</strong><span>{e.alumno.creditos_acumulados ?? '—'}</span></div>
              <div className="list-item"><strong>Carrera</strong><span>{e.alumno.nombre_carrera || '—'}</span></div>
            </div>
          </SectionCard>}

          {e.becas_evaluadas?.length > 0 && <SectionCard title={`Programas evaluados (${e.total_evaluadas})`} subtitle={`${e.total_elegibles} elegibles`}>
            {e.becas_evaluadas.map((beca, idx) => (
              <div key={beca.codigo_beca || idx} className="note" style={{ marginTop: '0.75rem', borderLeft: `4px solid ${beca.elegible ? 'var(--success)' : 'var(--danger)'}` }}>
                <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}><strong>{beca.titulo}</strong><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{beca.institucion} • {beca.codigo_beca}</div></div>
                  <span className={beca.elegible ? 'badge success' : 'badge danger'} style={{ whiteSpace: 'nowrap' }}>{beca.elegible ? ' Elegible' : ' No elegible'}</span>
                </div>
                {beca.url && <a href={beca.url} target="_blank" rel="noreferrer" className="btn secondary" style={{ marginTop: '0.5rem', width: 'fit-content', fontSize: '0.85rem' }}><ExternalLink size={14} /> Ver convocatoria</a>}
                <div className="list" style={{ marginTop: '0.5rem' }}>{beca.checks?.map((ch, ci) => (
                  <div key={ci} className="list-item" style={{ borderLeft: `3px solid ${ch.cumple ? 'var(--success)' : 'var(--danger)'}`, paddingLeft: '0.5rem' }}>
                    <strong>{ch.criterio}</strong><span>{ch.cumple ? ' Cumple' : ' No cumple'}</span><small>{ch.detalle}</small>
                  </div>
                ))}</div>
              </div>
            ))}
          </SectionCard>}
        </>}
      </div>
    );
  }

  function renderSolicitar() {
    return (
      <div className="stack">
        <div className="hero-banner">
          <div><div className="badge light">Solicitar beca</div><h1>Convocatorias activas</h1><p>Selecciona una convocatoria y envía tu solicitud.</p></div>
        </div>

        {loading.convocatorias ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
        : convocatorias.length === 0 ? <div className="empty">No hay convocatorias activas en este momento</div>
        : <div className="list">{convocatorias.map(c => (
          <div key={c.id_convocatoria} className="list-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <strong>{c.titulo}</strong>
                <span>{c.institucion} • {c.categoria}</span>
                <small>{c.resumen || c.descripcion || '—'} • {c.vigencia_texto || 'Consultar vigencia'}</small>
                {c.monto && <small>Monto: {formatCurrency(c.monto)}</small>}
              </div>
              <div style={{ textAlign: 'right', minWidth: 100 }}>
                {c.destacada && <div><small className="badge success">Destacada</small></div>}
                <button className="btn primary" style={{ marginTop: '0.25rem', fontSize: '0.85rem' }} onClick={() => handleSolicitar(c.id_convocatoria)}>
                  <Send size={14} /> Solicitar
                </button>
                {c.url_oficial && <div><a href={c.url_oficial} target="_blank" rel="noreferrer" className="btn secondary" style={{ marginTop: '0.25rem', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}><ExternalLink size={12} /> Convocatoria</a></div>}
              </div>
            </div>
            <div className="row gap wrap" style={{ marginTop: '0.5rem' }}>
              {c.requisitos && JSON.parse(c.requisitos || '[]').slice(0, 3).map((r, i) => <small key={i} className="badge light" style={{ fontSize: '0.75rem' }}>{r}</small>)}
              {c.requisitos && JSON.parse(c.requisitos || '[]').length > 3 && <small className="badge light" style={{ fontSize: '0.75rem' }}>+{JSON.parse(c.requisitos).length - 3} más</small>}
            </div>
          </div>
        ))}</div>}
      </div>
    );
  }

  function renderHistorial() {
    return (
      <div className="stack">
        <div className="hero-banner">
          <div><div className="badge light">Historial de solicitudes</div><h1>Mis solicitudes</h1><p>Seguimiento completo de tus solicitudes de beca.</p></div>
        </div>

        {seguimiento && solSeleccionada && (
          <SectionCard title={`Solicitud #${seguimiento.id_solicitud}`} subtitle={seguimiento.codigo_solicitud}>
            <div className="list">
              <div className="list-item"><strong>Convocatoria</strong><span>{seguimiento.convocatoria_titulo || '—'} ({seguimiento.institucion || '—'})</span></div>
              <div className="list-item"><strong>Estatus</strong><span className={badgeClass(seguimiento.estatus_solicitud)}>{seguimiento.estatus_solicitud}</span></div>
              <div className="list-item"><strong>Fecha de solicitud</strong><span>{formatDate(seguimiento.fecha_solicitud)}</span></div>
              {seguimiento.fecha_revision && <div className="list-item"><strong>Fecha de revisión</strong><span>{formatDate(seguimiento.fecha_revision)}</span></div>}
              {seguimiento.fecha_resolucion && <div className="list-item"><strong>Fecha de resolución</strong><span>{formatDate(seguimiento.fecha_resolucion)}</span></div>}
              {seguimiento.nota_solicitante && <div className="list-item"><strong>Tu nota</strong><span>{seguimiento.nota_solicitante}</span></div>}
              {seguimiento.nota_revisor && <div className="list-item"><strong>Nota del revisor</strong><span>{seguimiento.nota_revisor}</span></div>}
              {seguimiento.monto_solicitado && <div className="list-item"><strong>Monto solicitado</strong><span>{formatCurrency(seguimiento.monto_solicitado)}</span></div>}
              {seguimiento.monto_asignado && <div className="list-item"><strong>Monto asignado</strong><span>{formatCurrency(seguimiento.monto_asignado)}</span></div>}
            </div>

            {seguimiento.tipo_dictamen && <div className="note" style={{ marginTop: '1rem' }}>
              <strong>Dictamen: {seguimiento.tipo_dictamen}</strong>
              {seguimiento.fundamento && <div style={{ marginTop: '0.5rem' }}>Fundamento: {seguimiento.fundamento}</div>}
              {seguimiento.dictamen_observaciones && <div style={{ marginTop: '0.5rem' }}>Observaciones: {seguimiento.dictamen_observaciones}</div>}
              <small style={{ display: 'block', marginTop: '0.5rem' }}>Dictaminó: {seguimiento.nombre_dictamina} • {formatDate(seguimiento.fecha_dictamen)}{seguimiento.validado_por_ia ? ' • Validado por IA' : ''}</small>
            </div>}

            {seguimiento.observaciones?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Observaciones ({seguimiento.observaciones.length})</strong>
                {seguimiento.observaciones.map(o => (
                  <div key={o.id_observacion} className="note" style={{ marginTop: '0.5rem' }}>
                    <div className="row gap" style={{ justifyContent: 'space-between' }}><span className="badge light">{o.tipo_observacion}</span><small>{o.nombre_usuario || '—'} • {formatDate(o.fecha_observacion)}</small></div>
                    <div style={{ marginTop: '0.25rem' }}>{o.observacion}</div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn secondary" style={{ marginTop: '1rem' }} onClick={() => { setSeguimiento(null); setSolSeleccionada(null); }}><ArrowLeft size={16} /> Cerrar detalle</button>
          </SectionCard>
        )}

        <SectionCard title="Todas mis solicitudes">
          {loading.solicitudes ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          : solicitudes.length === 0 ? <div className="empty">No tienes solicitudes registradas. Ve a "Solicitar beca" para enviar una.</div>
          : <div className="list">{solicitudes.map(s => (
            <div key={s.id_solicitud} className="list-item" style={{ cursor: 'pointer' }} onClick={() => verSeguimiento(s.id_solicitud)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <strong>{s.convocatoria_titulo || 'Sin convocatoria'}</strong>
                  <span>{s.codigo_solicitud} • {s.institucion || '—'}</span>
                  <small style={{ display: 'block' }}>{formatDate(s.fecha_solicitud)} {s.tipo_dictamen ? `• Dictamen: ${s.tipo_dictamen}` : ''}</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={badgeClass(s.estatus_solicitud)}>{s.estatus_solicitud}</span>
                  {s.monto_asignado && <div><small>{formatCurrency(s.monto_asignado)}</small></div>}
                </div>
              </div>
            </div>
          ))}</div>}
        </SectionCard>
      </div>
    );
  }

  function renderNotificaciones() {
    const nots = notificaciones.notificaciones || [];
    return (
      <div className="stack">
        <div className="hero-banner">
          <div><div className="badge light">Notificaciones y novedades</div><h1>Centro de notificaciones</h1><p>Mantente al tanto del estatus de tus solicitudes y nuevas convocatorias.</p></div>
        </div>

        {loading.notificaciones ? <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
        : nots.length === 0 ? <div className="empty">No hay notificaciones nuevas</div>
        : <div className="list">{nots.map((n, idx) => (
          <div key={idx} className="list-item">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ marginTop: '0.15rem' }}>{TIPO_ICONO[n.icono] || <Shield size={18} />}</div>
              <div style={{ flex: 1 }}>
                <strong>{n.titulo}</strong>
                <span>{n.mensaje}</span>
                <small style={{ display: 'block' }}>{formatDate(n.fecha)}{n.id_solicitud ? ` • Solicitud #${n.id_solicitud}` : ''}</small>
              </div>
              {n.url && <a href={n.url} target="_blank" rel="noreferrer" className="btn secondary" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}><ExternalLink size={12} /> Ver</a>}
              {n.id_solicitud && <button className="btn secondary" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => { verSeguimiento(n.id_solicitud); setActiveTab('historial'); }}><Eye size={12} /> Seguir</button>}
            </div>
          </div>
        ))}</div>}

        {notificaciones.convocatorias?.length > 0 && (
          <SectionCard title="Convocatorias disponibles" subtitle="No te pierdas las oportunidades vigentes">
            <div className="list">{notificaciones.convocatorias.map((c, idx) => (
              <div key={c.id_convocatoria || idx} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div><strong>{c.titulo}</strong><span>{c.institucion} • {c.categoria}</span></div>
                  <div style={{ textAlign: 'right' }}>
                    <button className="btn primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleSolicitar(c.id_convocatoria)}><Send size={12} /> Solicitar</button>
                  </div>
                </div>
              </div>
            ))}</div>
          </SectionCard>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="hero-banner" style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <div className="badge light">Alumno • IA de Becas</div>
            <h2 style={{ margin: '0.25rem 0' }}>Portal de becas para estudiantes</h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>{fullName} • Acceso limitado a tu expediente</p>
          </div>
          <button className="btn secondary" onClick={() => navigate(-1)} style={{ whiteSpace: 'nowrap' }}>
            <ArrowLeft size={16} /> Volver
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

      {activeTab === 'estatus' && renderEstatus()}
      {activeTab === 'elegibilidad' && renderElegibilidad()}
      {activeTab === 'solicitar' && renderSolicitar()}
      {activeTab === 'historial' && renderHistorial()}
      {activeTab === 'notificaciones' && renderNotificaciones()}
    </div>
  );
}
