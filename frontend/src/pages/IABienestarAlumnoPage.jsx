import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api, canAccessBienestarDocenteIA } from '../services/api';
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2, ClipboardList,
  Eye, FileText, Filter, HeartPulse, Loader2, MessageSquare, RefreshCw,
  Search, Sparkles, Target, Users, X, Clock, UserCheck, GraduationCap,
  Activity, ArrowUpRight, TrendingUp, TrendingDown, Minus,
  Brain, ShieldCheck, MessageSquareText, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RISK_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Crítico': '#ef4444' };
const RISK_BADGE = { Bajo: 'status ok', Medio: 'status warn', Alto: 'status warn', 'Crítico': 'status error' };

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch { return String(value); }
}

function formatShortDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(new Date(value));
  } catch { return String(value); }
}

function riskLevel(value) {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'BAJO') return 'Bajo';
  if (v === 'MEDIO') return 'Medio';
  if (v === 'ALTO') return 'Alto';
  if (v === 'CRITICO' || v === 'CRÍTICO') return 'Crítico';
  return value || 'Sin nivel';
}

function MiniGauge({ value, max = 100, label, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: `conic-gradient(${color || '#4F46E5'} ${pct}deg, #e2e8f0 ${pct}deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.25rem'
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', fontWeight: 700, color: color || '#334155'
        }}>{value}</div>
      </div>
      <small style={{ color: '#64748B', fontSize: '0.75rem' }}>{label}</small>
    </div>
  );
}

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

export default function IABienestarAlumnoPage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const navigate = useNavigate();
  const canAccess = !!user;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Data
  const [estado, setEstado] = React.useState(null);
  const [progreso, setProgreso] = React.useState([]);
  const [historialApoyo, setHistorialApoyo] = React.useState([]);
  const [mensajes, setMensajes] = React.useState([]);
  const [recomendaciones, setRecomendaciones] = React.useState([]);

  // Active section
  const [activeSection, setActiveSection] = React.useState('panel');

  // Modals
  const [mensajeOpen, setMensajeOpen] = React.useState(false);
  const [selectedMensaje, setSelectedMensaje] = React.useState(null);
  const [apoyoOpen, setApoyoOpen] = React.useState(false);
  const [selectedApoyo, setSelectedApoyo] = React.useState(null);

  const fetchAll = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [estadoRes, progresoRes, apoyoRes, mensajesRes, recsRes] = await Promise.all([
        api.iaBienestarEstadoAcompanamiento(token).catch(() => ({ ok: false })),
        api.iaBienestarProgreso(token).catch(() => ({ ok: false })),
        api.iaBienestarHistorialApoyo(token).catch(() => ({ ok: false })),
        api.iaBienestarMensajesOrientacion(token).catch(() => ({ ok: false })),
        api.iaBienestarRecomendacionesAlumno(token).catch(() => ({ ok: false }))
      ]);
      if (estadoRes?.ok) setEstado(estadoRes.data);
      if (progresoRes?.ok) setProgreso(progresoRes.data || []);
      if (apoyoRes?.ok) setHistorialApoyo(apoyoRes.data || []);
      if (mensajesRes?.ok) setMensajes(mensajesRes.data || []);
      if (recsRes?.ok) setRecomendaciones(recsRes.data || []);
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar algunos datos.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (!authLoading && user) fetchAll();
  }, [authLoading, user, fetchAll]);

  if (authLoading) return <div className="page-center">Cargando sesión...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const tabs = [
    { key: 'panel', label: 'Panel personal', icon: HeartPulse },
    { key: 'estado', label: 'Estado de acompañamiento', icon: Activity },
    { key: 'recomendaciones', label: 'Recomendaciones', icon: Target },
    { key: 'progreso', label: 'Progreso', icon: TrendingUp },
    { key: 'historial', label: 'Historial de apoyo', icon: ClipboardList },
    { key: 'mensajes', label: 'Mensajes de orientación', icon: MessageSquareText }
  ];

  const recsPorPrioridad = (recomendaciones || []).sort((a, b) => {
    const orden = { alta: 0, media: 1, baja: 2 };
    return (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1);
  });

  const progresoTimeline = React.useMemo(() => {
    if (!progreso || progreso.length < 2) return [];
    return progreso.map((p, i) => ({
      ...p,
      delta: i > 0 ? Number(p.bienestar_score) - Number(progreso[i - 1].bienestar_score) : 0
    }));
  }, [progreso]);

  const ultimoScore = progreso.length > 0 ? progreso[progreso.length - 1].bienestar_score : estado?.ultimo_checkin?.bienestar_score;
  const scoreDelta = progresoTimeline.length > 0 ? progresoTimeline[progresoTimeline.length - 1].delta : 0;

  const getDimensionColor = (val) => {
    const n = Number(val);
    if (n >= 7) return '#22c55e';
    if (n >= 4) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="stack">
      {/* ── HERO ── */}
      <section className="hero-banner" style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)' }}>
        <div>
          <div className="badge light"><HeartPulse size={14} /> Mi acompañamiento</div>
          <h1 style={{ color: '#1e1b4b' }}>
            Hola, {estado?.alumno?.nombres?.split(' ')[0] || user?.nombres?.split(' ')[0] || 'estudiante'}
          </h1>
          <p style={{ color: '#4338ca' }}>
            Este es tu espacio de acompañamiento personal. Aquí puedes consultar tu estado, revisar recomendaciones, conocer las observaciones registradas sobre tu proceso y visualizar tu progreso.
          </p>
        </div>
        <div className="hero-meta">
          {loading && <Loader2 size={20} className="spin" style={{ marginBottom: '0.5rem' }} />}
          {error && <div className="alert error" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>{error}</div>}
          <button className="btn ghost" onClick={fetchAll} style={{ marginBottom: '0.5rem' }} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
          </button>
          <div className="meta-card"><small>Check-ins</small><strong>{estado?.alertas?.total ?? '-'}</strong></div>
          <div className="meta-card"><small>Alertas</small><strong>{progreso.length}</strong></div>
          <div className="meta-card"><small>Intervenciones</small><strong>{estado?.total_intervenciones ?? 0}</strong></div>
          <div className="meta-card">
            <small>Tendencia</small>
            <strong style={{ color: estado?.tendencia === 'mejora' ? '#22c55e' : estado?.tendencia === 'declive' ? '#ef4444' : '#64748B' }}>
              {estado?.tendencia === 'mejora' ? <><TrendingUp size={14} /> Mejora</> :
               estado?.tendencia === 'declive' ? <><TrendingDown size={14} /> Declive</> :
               <><Minus size={14} /> Estable</>}
            </strong>
          </div>
        </div>
      </section>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', border: 'none',
              background: activeSection === tab.key ? '#4F46E5' : 'transparent',
              color: activeSection === tab.key ? '#fff' : '#64748B',
              borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: activeSection === tab.key ? 600 : 400, transition: 'all 0.2s'
            }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading && !estado && <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="spin" /></div>}

      {/* ════════════════════════════════════════ */}
      {/* PANEL PERSONAL */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'panel' && (
        <div className="stack">
          {/* Estado rápido */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Último check-in</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: RISK_COLORS[estado?.ultimo_checkin?.nivel_riesgo] || '#64748B' }}>
                {estado?.ultimo_checkin?.bienestar_score ?? '—'}
              </div>
              <small style={{ color: '#94a3b8' }}>/{estado?.ultimo_checkin?.nivel_riesgo || 'Sin datos'}</small>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Alertas activas</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: (estado?.alertas?.pendientes || 0) > 0 ? '#f97316' : '#22c55e' }}>
                {estado?.alertas?.pendientes ?? 0}
              </div>
              <small style={{ color: '#94a3b8' }}>{estado?.alertas?.atendidas ?? 0} atendidas</small>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Intervenciones</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{estado?.total_intervenciones ?? 0}</div>
              <small style={{ color: '#94a3b8' }}>registradas</small>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Promedio académico</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{estado?.alumno?.promedio_general || '—'}</div>
              <small style={{ color: '#94a3b8' }}>{estado?.alumno?.semestre_actual ? `Semestre ${estado.alumno.semestre_actual}` : ''}</small>
            </div>
          </div>

          {/* Recomendaciones destacadas */}
          {recsPorPrioridad.length > 0 && (
            <SectionCard title="Recomendaciones para ti" subtitle="Basadas en tu actividad y estado actual">
              <div className="list">
                {recsPorPrioridad.slice(0, 3).map((r, i) => (
                  <div key={i} className="list-item" style={{
                    gap: '0.5rem',
                    background: r.prioridad === 'alta' ? '#FEF2F2' : r.prioridad === 'media' ? '#FFFBEB' : '#F0FDF4',
                    borderRadius: 8
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: r.prioridad === 'alta' ? '#FEE2E2' : r.prioridad === 'media' ? '#FEF3C7' : '#DCFCE7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {r.prioridad === 'alta' ? <AlertTriangle size={16} color="#ef4444" /> :
                       r.prioridad === 'media' ? <Target size={16} color="#f97316" /> :
                       <CheckCircle2 size={16} color="#22c55e" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem' }}>{r.mensaje}</div>
                      <span className={`badge ${r.prioridad === 'alta' ? 'error' : r.prioridad === 'media' ? 'warning' : 'light'}`} style={{ marginTop: '0.25rem' }}>
                        {r.tipo} • {r.prioridad}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {recsPorPrioridad.length > 3 && (
                <button className="btn ghost" onClick={() => setActiveSection('recomendaciones')} style={{ marginTop: '0.5rem' }}>
                  Ver todas ({recsPorPrioridad.length}) <ChevronRight size={14} />
                </button>
              )}
            </SectionCard>
          )}

          {/* Acceso rápido */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <button className="stat-card" onClick={() => setActiveSection('estado')} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid #e2e8f0' }}>
              <Activity size={20} color="#4F46E5" />
              <div className="stat-label">Estado de acompañamiento</div>
              <small style={{ color: '#64748B' }}>Tu situación actual</small>
            </button>
            <button className="stat-card" onClick={() => navigate('/app/ia/bienestar')} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid #e2e8f0' }}>
              <HeartPulse size={20} color="#ec4899" />
              <div className="stat-label">Realizar check-in</div>
              <small style={{ color: '#64748B' }}>Registra tu estado</small>
            </button>
            <button className="stat-card" onClick={() => setActiveSection('progreso')} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid #e2e8f0' }}>
              <TrendingUp size={20} color="#0891b2" />
              <div className="stat-label">Ver progreso</div>
              <small style={{ color: '#64748B' }}>Evolución en el tiempo</small>
            </button>
            <button className="stat-card" onClick={() => setActiveSection('mensajes')} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid #e2e8f0' }}>
              <MessageSquareText size={20} color="#7c3aed" />
              <div className="stat-label">Mensajes</div>
              <small style={{ color: '#64748B' }}>Orientación recibida</small>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* ESTADO DE ACOMPAÑAMIENTO */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'estado' && (
        <div className="stack">
          <SectionCard title="Tu información" subtitle="Datos generales de tu perfil académico">
            {estado?.alumno ? (
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <div className="stat-card"><div className="stat-label">Matrícula</div><div className="stat-value" style={{ fontSize: '1rem' }}>{estado.alumno.matricula || '-'}</div></div>
                <div className="stat-card"><div className="stat-label">Carrera</div><div className="stat-value" style={{ fontSize: '1rem' }}>{estado.alumno.nombre_carrera || '-'}</div></div>
                <div className="stat-card"><div className="stat-label">Semestre</div><div className="stat-value" style={{ fontSize: '1rem' }}>{estado.alumno.semestre_actual || '-'}</div></div>
                <div className="stat-card"><div className="stat-label">Estatus</div><div className="stat-value" style={{ fontSize: '1rem' }}><span className={estado.alumno.estatus_academico === 'Regular' ? 'status ok' : 'status warn'}>{estado.alumno.estatus_academico || '-'}</span></div></div>
              </div>
            ) : <div className="empty">No se encontraron datos del alumno</div>}
          </SectionCard>

          <div className="two-col">
            <SectionCard title="Sesión activa" subtitle="Estado de tu acompañamiento actual">
              {estado?.sesion_activa ? (
                <div className="stack">
                  <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <MiniGauge value={estado.sesion_activa.bienestar_score || 0} label="Score" color={RISK_COLORS[estado.sesion_activa.nivel_riesgo] || '#4F46E5'} />
                    <div>
                      <div className="eyebrow">Nivel de riesgo</div>
                      <span className={RISK_BADGE[estado.sesion_activa.nivel_riesgo] || 'status'} style={{ fontSize: '1rem' }}>{estado.sesion_activa.nivel_riesgo || 'Sin definir'}</span>
                      <div className="eyebrow" style={{ marginTop: '0.5rem' }}>Iniciada</div>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(estado.sesion_activa.iniciada_en)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stack" style={{ alignItems: 'center', padding: '1rem', textAlign: 'center' }}>
                  <HeartPulse size={40} color="#94a3b8" />
                  <p style={{ color: '#64748B' }}>No tienes una sesión activa de acompañamiento.</p>
                  <button className="btn primary" onClick={() => navigate('/app/ia/bienestar')}>
                    Iniciar check-in
                  </button>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Alertas" subtitle="Resumen de tus alertas de bienestar">
              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="stat-card" style={{ textAlign: 'center', background: '#FEF2F2' }}>
                  <div className="stat-label">Críticas</div>
                  <div className="stat-value" style={{ color: '#ef4444', fontSize: '1.5rem' }}>{estado?.alertas?.criticas ?? 0}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center', background: '#FFFBEB' }}>
                  <div className="stat-label">Pendientes</div>
                  <div className="stat-value" style={{ color: '#f97316', fontSize: '1.5rem' }}>{estado?.alertas?.pendientes ?? 0}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center', background: '#F0FDF4' }}>
                  <div className="stat-label">Atendidas</div>
                  <div className="stat-value" style={{ color: '#22c55e', fontSize: '1.5rem' }}>{estado?.alertas?.atendidas ?? 0}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">Total</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>{estado?.alertas?.total ?? 0}</div>
                </div>
              </div>
            </SectionCard>
          </div>

          {estado?.ultimo_checkin && (
            <SectionCard title="Último check-in" subtitle={formatDate(estado.ultimo_checkin.creado_en)}>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
                <MiniGauge value={estado.ultimo_checkin.animo || 0} max={10} label="Ánimo" color={getDimensionColor(estado.ultimo_checkin.animo)} />
                <MiniGauge value={estado.ultimo_checkin.energia || 0} max={10} label="Energía" color={getDimensionColor(estado.ultimo_checkin.energia)} />
                <MiniGauge value={estado.ultimo_checkin.estres ? 10 - estado.ultimo_checkin.estres : 0} max={10} label="Calma" color={getDimensionColor(10 - (estado.ultimo_checkin.estres || 0))} />
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* RECOMENDACIONES */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'recomendaciones' && (
        <SectionCard title={`Recomendaciones (${recsPorPrioridad.length})`} subtitle="Recomendaciones personalizadas para tu bienestar y rendimiento académico">
          <div className="list">
            {recsPorPrioridad.length === 0 ? (
              <div className="empty">No hay recomendaciones disponibles en este momento. Realiza un check-in para obtener sugerencias personalizadas.</div>
            ) : recsPorPrioridad.map((r, i) => (
              <div key={i} className="list-item" style={{
                flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem',
                background: r.prioridad === 'alta' ? '#FEF2F2' : r.prioridad === 'media' ? '#FFFBEB' : '#F0FDF4',
                borderRadius: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: r.prioridad === 'alta' ? '#FEE2E2' : r.prioridad === 'media' ? '#FEF3C7' : '#DCFCE7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {r.prioridad === 'alta' ? <AlertTriangle size={18} color="#ef4444" /> :
                     r.prioridad === 'media' ? <Target size={18} color="#f97316" /> :
                     <CheckCircle2 size={18} color="#22c55e" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${r.prioridad === 'alta' ? 'error' : r.prioridad === 'media' ? 'warning' : 'light'}`}>
                        {r.prioridad === 'alta' ? 'Prioritaria' : r.prioridad === 'media' ? 'Sugerencia' : 'Informativa'}
                      </span>
                      <span className="badge light">{r.tipo}</span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{r.mensaje}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ════════════════════════════════════════ */}
      {/* PROGRESO */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'progreso' && (
        <SectionCard title={`Progreso (${progreso.length} registros)`} subtitle="Evolución de tu bienestar a través del tiempo">
          {progreso.length < 2 ? (
            <div className="empty">
              {progreso.length === 0 ? (
                <>Aún no tienes registros de check-in. <button className="btn primary" onClick={() => navigate('/app/ia/bienestar')} style={{ marginLeft: '0.5rem' }}>Realizar check-in</button></>
              ) : (
                'Solo tienes un registro. Realiza más check-ins para ver tu evolución.'
              )}
            </div>
          ) : (
            <div className="stack">
              {/* Timeline visual */}
              <div style={{ position: 'relative', padding: '1rem 0' }}>
                {progresoTimeline.map((p, i) => (
                  <div key={p.id_checkin || i} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.5rem 0', borderLeft: '2px solid #e2e8f0',
                    marginLeft: '1rem', paddingLeft: '1.5rem', position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute', left: '-9px', width: 16, height: 16,
                      borderRadius: '50%', background: RISK_COLORS[p.nivel_riesgo] || '#4F46E5',
                      border: '2px solid #fff'
                    }} />
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{p.bienestar_score}</strong>
                        <span className={`badge light`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>{p.nivel_riesgo}</span>
                        <span style={{ marginLeft: '0.5rem', color: p.delta > 0 ? '#22c55e' : p.delta < 0 ? '#ef4444' : '#64748B', fontSize: '0.8rem' }}>
                          {p.delta > 0 ? `+${p.delta}` : p.delta < 0 ? p.delta : '—'}
                        </span>
                      </div>
                      <small style={{ color: '#94a3b8' }}>{formatShortDate(p.creado_en)}</small>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dimensiones del último check-in */}
              {progreso.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="eyebrow">Dimensiones (último registro)</div>
                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                    {['animo','energia','sueno','estres','apoyo','ambiente','carga_academica','carga_laboral','enfoque'].map(dim => {
                      const val = progreso[progreso.length - 1][dim];
                      if (val === null || val === undefined) return null;
                      const isInverted = dim === 'estres' || dim === 'carga_academica' || dim === 'carga_laboral';
                      const displayVal = isInverted ? 10 - Number(val) : Number(val);
                      return (
                        <div key={dim} className="stat-card" style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <div className="stat-label" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>{dim.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: getDimensionColor(displayVal) }}>{val}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ════════════════════════════════════════ */}
      {/* HISTORIAL DE APOYO */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'historial' && (
        <SectionCard title={`Historial de apoyo (${historialApoyo.length})`} subtitle="Intervenciones y observaciones registradas sobre tu proceso">
          <div className="list">
            {historialApoyo.length === 0 ? (
              <div className="empty">No hay intervenciones registradas en tu historial de acompañamiento.</div>
            ) : historialApoyo.map(d => (
              <div key={d.id_derivacion} className="list-item"
                onClick={() => { setSelectedApoyo(d); setApoyoOpen(true); }}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong style={{ color: '#4F46E5' }}>{d.destino || 'Intervención'}</strong>
                  <span className={`badge ${d.estado_derivacion === 'CERRADA' ? 'light' : 'warning'}`}>
                    {d.estado_derivacion || 'PENDIENTE'}
                  </span>
                </div>
                <small style={{ color: '#475569' }}>{d.motivo}</small>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>{formatDate(d.creado_en)}</span>
                  {d.usuario_nombre && <span>— {d.usuario_nombre} {d.usuario_apellido || ''}</span>}
                  <span className={RISK_BADGE[d.nivel_riesgo] || 'status'} style={{ fontSize: '0.75rem' }}>{d.nivel_riesgo}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ════════════════════════════════════════ */}
      {/* MENSAJES DE ORIENTACIÓN */}
      {/* ════════════════════════════════════════ */}
      {activeSection === 'mensajes' && (
        <SectionCard title={`Mensajes de orientación (${mensajes.length})`} subtitle="Consejos y orientaciones del sistema de acompañamiento">
          <div className="list">
            {mensajes.length === 0 ? (
              <div className="empty">No hay mensajes de orientación. Inicia una conversación en el chat de acompañamiento para recibir orientación personalizada.</div>
            ) : mensajes.map(m => (
              <div key={m.id_mensaje} className="list-item"
                onClick={() => { setSelectedMensaje(m); setMensajeOpen(true); }}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Brain size={16} color="#7c3aed" />
                    <strong style={{ color: '#4F46E5' }}>Asistente de acompañamiento</strong>
                  </div>
                  <small style={{ color: '#94a3b8' }}>{formatShortDate(m.creado_en)}</small>
                </div>
                <p style={{ fontSize: '0.9rem', margin: '0.25rem 0', color: '#334155', lineHeight: 1.4 }}>
                  {m.mensaje?.length > 200 ? m.mensaje.slice(0, 200) + '...' : m.mensaje}
                </p>
                {m.nivel_riesgo && <span className={RISK_BADGE[m.nivel_riesgo] || 'status'} style={{ fontSize: '0.75rem' }}>{m.nivel_riesgo}</span>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button className="btn primary" onClick={() => navigate('/app/ia/bienestar')}>
              <MessageSquare size={16} /> Ir al chat de acompañamiento
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── MODAL: Detalle de intervención ── */}
      <Modal open={apoyoOpen} onClose={() => setApoyoOpen(false)} title="Detalle de intervención">
        {selectedApoyo && (
          <div className="stack">
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card"><div className="stat-label">Destino</div><div className="stat-value" style={{ fontSize: '1rem' }}>{selectedApoyo.destino}</div></div>
              <div className="stat-card"><div className="stat-label">Estado</div><span className={`badge ${selectedApoyo.estado_derivacion === 'CERRADA' ? 'light' : 'warning'}`}>{selectedApoyo.estado_derivacion}</span></div>
              <div className="stat-card"><div className="stat-label">Riesgo asociado</div><span className={RISK_BADGE[selectedApoyo.nivel_riesgo] || 'status'}>{selectedApoyo.nivel_riesgo}</span></div>
              <div className="stat-card"><div className="stat-label">Fecha</div><div className="stat-value" style={{ fontSize: '0.9rem' }}>{formatDate(selectedApoyo.creado_en)}</div></div>
            </div>
            <div className="eyebrow">Motivo</div>
            <p>{selectedApoyo.motivo}</p>
            {selectedApoyo.observaciones && (
              <>
                <div className="eyebrow">Observaciones</div>
                <p>{selectedApoyo.observaciones}</p>
              </>
            )}
            {selectedApoyo.usuario_nombre && (
              <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Registrado por: {selectedApoyo.usuario_nombre} {selectedApoyo.usuario_apellido || ''}</p>
            )}
            {selectedApoyo.descripcion && (
              <>
                <div className="eyebrow">Descripción de la alerta</div>
                <p style={{ fontSize: '0.9rem', background: '#F8FAFC', padding: '0.5rem', borderRadius: 8 }}>{selectedApoyo.descripcion}</p>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── MODAL: Mensaje completo ── */}
      <Modal open={mensajeOpen} onClose={() => setMensajeOpen(false)} title="Mensaje de orientación">
        {selectedMensaje && (
          <div className="stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={20} color="#7c3aed" />
                <strong>Asistente de acompañamiento</strong>
              </div>
              <small style={{ color: '#94a3b8' }}>{formatDate(selectedMensaje.creado_en)}</small>
            </div>
            {selectedMensaje.nivel_riesgo && (
              <span className={RISK_BADGE[selectedMensaje.nivel_riesgo] || 'status'}>{selectedMensaje.nivel_riesgo}</span>
            )}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem', color: '#334155' }}>
              {selectedMensaje.mensaje}
            </div>
            {selectedMensaje.metadata?.recursos && selectedMensaje.metadata.recursos.length > 0 && (
              <div>
                <div className="eyebrow">Recursos recomendados</div>
                <div className="list">
                  {selectedMensaje.metadata.recursos.map((r, i) => (
                    <div key={i} className="list-item" style={{ fontSize: '0.85rem' }}>{r}</div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn primary" onClick={() => navigate('/app/ia/bienestar')}>
              <MessageSquare size={16} /> Ir al chat
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
