import React from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api, canAccessBienestarDocenteIA } from '../services/api';
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2, ClipboardList,
  Eye, FileText, Filter, HeartPulse, Loader2, MessageSquare, RefreshCw,
  Search, Sparkles, Target, Users, X, Clock, UserCheck, GraduationCap,
  Activity, ArrowUpRight
} from 'lucide-react';
import { playSuccessSound, playErrorSound } from '../utils/soundManager';
import SoundToggleButton from '../components/SoundToggleButton';
import { useAuth } from '../context/AuthContext';

const RISK_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Crítico': '#ef4444' };
const RISK_BADGE = { Bajo: 'status ok', Medio: 'status warn', Alto: 'status warn', 'Crítico': 'status error' };

function riskLevel(value) {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'BAJO') return 'Bajo';
  if (v === 'MEDIO') return 'Medio';
  if (v === 'ALTO') return 'Alto';
  if (v === 'CRITICO' || v === 'CRÍTICO') return 'Crítico';
  return value || 'Sin nivel';
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

export default function IABienestarDocentePage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccess = canAccessBienestarDocenteIA(user);

  const [activeTab, setActiveTab] = React.useState('grupos');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  // Grupos
  const [grupos, setGrupos] = React.useState([]);
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [alumnos, setAlumnos] = React.useState([]);

  // Alertas
  const [alertas, setAlertas] = React.useState([]);
  const [alertasMeta, setAlertasMeta] = React.useState({ total: 0, pagina: 1, totalPaginas: 0 });
  const [filtros, setFiltros] = React.useState({ nivel_riesgo: '', estado: '', periodoId: '', busqueda: '' });

  // Detalle
  const [detalle, setDetalle] = React.useState(null);
  const [detalleOpen, setDetalleOpen] = React.useState(false);

  // Observación
  const [obsForm, setObsForm] = React.useState({ id_alerta: '', accion_sugerida: '', observaciones: '' });

  // Recomendaciones
  const [recomendaciones, setRecomendaciones] = React.useState([]);

  // Historial
  const [historial, setHistorial] = React.useState(null);
  const [historialOpen, setHistorialOpen] = React.useState(false);

  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    if (isError) playErrorSound(); else playSuccessSound();
    setTimeout(() => setMessage(''), 5000);
  };

  // ── Cargar grupos ──
  const loadGrupos = React.useCallback(async () => {
    if (!token || !canAccess) return;
    try {
      setLoading(true);
      const res = await api.iaBienestarDocenteGrupos(token);
      if (res?.ok) setGrupos(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess]);

  // ── Cargar alumnos de un grupo ──
  const loadAlumnos = async (idGrupo) => {
    try {
      setLoading(true);
      setSelectedGroup(idGrupo);
      const res = await api.iaBienestarDocenteAlumnosGrupo(token, idGrupo);
      if (res?.ok) setAlumnos(res.data || []);
    } catch (e) {
      console.error(e);
      showMessage('Error al cargar alumnos', true);
    } finally {
      setLoading(false);
    }
  };

  // ── Cargar alertas ──
  const loadAlertas = React.useCallback(async (page = 1) => {
    if (!token || !canAccess) return;
    try {
      setLoading(true);
      const res = await api.iaBienestarDocenteAlertas(token, { ...filtros, pagina: page, limite: 15 });
      if (res?.ok) {
        setAlertas(res.data || []);
        setAlertasMeta({ total: res.total, pagina: res.pagina, totalPaginas: res.totalPaginas });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess, filtros]);

  // ── Cargar detalle ──
  const loadDetalle = async (idAlumno) => {
    try {
      setLoading(true);
      const res = await api.iaBienestarDocenteDetalleAlumno(token, idAlumno);
      if (res?.ok) {
        setDetalle(res.data);
        setDetalleOpen(true);
      }
    } catch (e) {
      console.error(e);
      showMessage('Error al cargar detalle', true);
    } finally {
      setLoading(false);
    }
  };

  // ── Cargar recomendaciones ──
  const loadRecomendaciones = React.useCallback(async () => {
    if (!token || !canAccess) return;
    try {
      setLoading(true);
      const res = await api.iaBienestarDocenteRecomendaciones(token);
      if (res?.ok) setRecomendaciones(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess]);

  // ── Cargar historial ──
  const loadHistorial = async (idAlumno) => {
    try {
      setLoading(true);
      const res = await api.iaBienestarDocenteHistorial(token, idAlumno);
      if (res?.ok) {
        setHistorial(res.data);
        setHistorialOpen(true);
      }
    } catch (e) {
      console.error(e);
      showMessage('Error al cargar historial', true);
    } finally {
      setLoading(false);
    }
  };

  // ── Registrar observación ──
  const handleObservacion = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.iaBienestarDocenteObservacion(token, {
        id_alerta: Number(obsForm.id_alerta),
        accion_sugerida: obsForm.accion_sugerida.trim() || 'INTERVENCION_DOCENTE',
        observaciones: obsForm.observaciones.trim()
      });
      showMessage('Observación registrada correctamente');
      setObsForm({ id_alerta: '', accion_sugerida: '', observaciones: '' });
      if (activeTab === 'alertas') loadAlertas();
    } catch (error) {
      showMessage(error?.message || 'Error al registrar observación', true);
    }
  };

  React.useEffect(() => {
    if (!authLoading && user && canAccess) {
      loadGrupos();
      loadAlertas();
      loadRecomendaciones();
    }
  }, [authLoading, user, canAccess, loadGrupos, loadAlertas, loadRecomendaciones]);

  if (authLoading) return <div className="page-center">Cargando sesión...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess) return <Navigate to={getHomeRouteByUser?.(user) || '/app/dashboard'} replace />;

  const totalAlertas = grupos.reduce((s, g) => s + (g.total_alertas || 0), 0);
  const totalCriticas = grupos.reduce((s, g) => s + (g.alertas_criticas || 0), 0);
  const totalPendientes = grupos.reduce((s, g) => s + (g.alertas_pendientes || 0), 0);
  const totalAlumnos = grupos.reduce((s, g) => s + (g.total_alumnos || 0), 0);

  const renderGroupCard = (g) => (
    <button key={g.id_carga_academica} type="button" className="list-item"
      onClick={() => { setActiveTab('alumnos'); loadAlumnos(g.id_grupo); }}
      style={{ textAlign: 'left', width: '100%', background: 'transparent', cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <strong>{g.nombre_grupo} — {g.nombre_materia}</strong>
        <span className="badge light">{g.nombre_periodo}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', color: '#64748B' }}>
        <span><Users size={14} /> {g.total_alumnos} alumnos</span>
        <span><AlertTriangle size={14} /> {g.total_alertas} alertas</span>
        {g.alertas_criticas > 0 && <span style={{ color: '#ef4444' }}>{g.alertas_criticas} críticas</span>}
        {g.alertas_pendientes > 0 && <span style={{ color: '#f97316' }}>{g.alertas_pendientes} pend.</span>}
      </div>
      <small style={{ color: '#94a3b8' }}>{g.clave_materia} • Semestre {g.semestre} • {g.turno} • {g.nombre_carrera}</small>
    </button>
  );

  const renderStudentRow = (a) => (
    <tr key={a.id_alumno}>
      <td><code>{a.matricula}</code></td>
      <td>{a.nombres} {a.apellido_paterno} {a.apellido_materno}</td>
      <td>{a.nombre_periodo || '-'}</td>
      <td><span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo || a.sesion_riesgo || 'Sin riesgo'}</span></td>
      <td>{a.estado_alerta ? (
        <span className={`badge ${a.estado_alerta === 'ATENDIDA' || a.estado_alerta === 'CERRADA' ? 'light' : 'warning'}`}>
          {a.estado_alerta}
        </span>
      ) : (
        <span className="badge light">Sin alerta</span>
      )}</td>
      <td style={{ display: 'flex', gap: '0.25rem' }}>
        <button className="btn ghost" onClick={() => loadDetalle(a.id_alumno)} style={{ padding: '0.25rem 0.5rem' }} title="Ver detalle"><Eye size={14} /></button>
        <button className="btn ghost" onClick={() => loadHistorial(a.id_alumno)} style={{ padding: '0.25rem 0.5rem' }} title="Historial"><Clock size={14} /></button>
        {a.id_alerta && <button className="btn ghost" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(a.id_alerta) }); setActiveTab('observaciones'); }} style={{ padding: '0.25rem 0.5rem' }} title="Observación"><MessageSquare size={14} /></button>}
      </td>
    </tr>
  );

  const TABS = [
    { key: 'grupos', label: 'Panel de grupo', icon: GraduationCap },
    { key: 'alumnos', label: 'Alumnos detectados', icon: Users },
    { key: 'alertas', label: 'Alertas tempranas', icon: AlertTriangle },
    { key: 'recomendaciones', label: 'Recomendaciones', icon: Target },
    { key: 'observaciones', label: 'Observaciones', icon: MessageSquare },
    { key: 'historial', label: 'Historial de intervención', icon: ClipboardList }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Activity size={14} /> IA institucional • {user?.rol || user?.rol_nombre || 'Docente'}</div>
          <h1><HeartPulse size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Supervisión IA de Acompañamiento Estudiantil</h1>
          <p>Identifica señales tempranas de dificultad académica y actúa oportunamente dentro del aula. Monitorea el bienestar de tus estudiantes, consulta alertas, registra observaciones y da seguimiento pedagógico.</p>
        </div>
        <div className="hero-meta">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <SoundToggleButton />
          </div>
          <div className="meta-card"><small>Grupos</small><strong>{grupos.length}</strong></div>
          <div className="meta-card"><small>Alumnos</small><strong>{totalAlumnos}</strong></div>
          <div className="meta-card"><small>Alertas</small><strong>{totalAlertas}</strong></div>
          <div className="meta-card"><small>Críticas</small><strong style={{ color: '#ef4444' }}>{totalCriticas}</strong></div>
        </div>
      </section>

      {message && <div className={`alert ${message.includes('Error') ? 'error' : 'info'}`}>{message}</div>}

      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', border: 'none',
              background: activeTab === tab.key ? '#4F46E5' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#64748B',
              borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: activeTab === tab.key ? 600 : 400, transition: 'all 0.2s'
            }}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} className="spin" /></div>}

      {/* ── PANEL DE GRUPO ── */}
      {activeTab === 'grupos' && (
        <SectionCard title={`Panel de grupo (${grupos.length})`} subtitle="Grupos con alertas activas de bienestar y acompañamiento estudiantil">
          {grupos.length === 0 ? (
            <div className="empty">No tienes grupos asignados en el periodo actual</div>
          ) : (
            <div className="list">{grupos.map(renderGroupCard)}</div>
          )}
        </SectionCard>
      )}

      {/* ── ALUMNOS DETECTADOS ── */}
      {activeTab === 'alumnos' && (
        <div className="stack">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button className="btn ghost" onClick={() => setActiveTab('grupos')}><BarChart3 size={16} /> Volver a grupos</button>
            <span className="badge light">{alumnos.length} alumnos</span>
            {selectedGroup && <span className="badge light">Grupo: {grupos.find(g => g.id_grupo === selectedGroup)?.nombre_grupo || selectedGroup}</span>}
          </div>
          <SectionCard title="Lista de alumnos detectados" subtitle="Estudiantes con alertas de bienestar en el grupo seleccionado">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Riesgo</th><th>Estado alerta</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin alumnos en este grupo</td></tr>
                  ) : alumnos.map(renderStudentRow)}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── ALERTAS TEMPRANAS ── */}
      {activeTab === 'alertas' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input placeholder="Buscar por matrícula o nombre..." value={filtros.busqueda}
                onChange={e => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                style={{ paddingLeft: '2rem', width: '100%' }} />
            </div>
            <select value={filtros.nivel_riesgo} onChange={e => setFiltros(prev => ({ ...prev, nivel_riesgo: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <option value="">Todos los niveles</option>
              <option value="Bajo">Bajo</option><option value="Medio">Medio</option>
              <option value="Alto">Alto</option><option value="Crítico">Crítico</option>
            </select>
            <select value={filtros.estado} onChange={e => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="ATENDIDA">Atendidas</option>
              <option value="CERRADA">Cerradas</option>
            </select>
            <button className="btn secondary" onClick={() => loadAlertas(1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={14} /> Filtrar
            </button>
            <button className="btn ghost" onClick={() => { setFiltros({ nivel_riesgo: '', estado: '', periodoId: '', busqueda: '' }); loadAlertas(1); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={14} /> Limpiar
            </button>
          </div>

          <SectionCard title={`Alertas tempranas (${alertasMeta.total})`} subtitle="Alertas de bienestar estudiantil en tus grupos">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>Matrícula</th><th>Alumno</th><th>Grupo</th><th>Materia</th>
                    <th>Riesgo</th><th>Tipo</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay alertas registradas</td></tr>
                  ) : alertas.map((a, i) => (
                    <tr key={a.id_alerta}>
                      <td>{a.id_alerta}</td>
                      <td><code>{a.matricula}</code></td>
                      <td>{a.nombres} {a.apellido_paterno} {a.apellido_materno}</td>
                      <td>{a.nombre_grupo || '-'}</td>
                      <td>{a.nombre_materia || '-'}</td>
                      <td><span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo}</span></td>
                      <td><span className="badge light">{a.tipo_alerta || '-'}</span></td>
                      <td>
                        <span className={`badge ${a.estado_alerta === 'ATENDIDA' || a.estado_alerta === 'CERRADA' ? 'light' : 'warning'}`}>
                          {a.estado_alerta || 'PENDIENTE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn ghost" onClick={() => loadDetalle(a.id_alumno)} title="Ver detalle"><Eye size={14} /></button>
                          <button className="btn ghost" onClick={() => loadHistorial(a.id_alumno)} title="Historial"><Clock size={14} /></button>
                          <button className="btn ghost" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(a.id_alerta) }); setActiveTab('observaciones'); }} title="Observación"><MessageSquare size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {alertasMeta.totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                {Array.from({ length: alertasMeta.totalPaginas }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => loadAlertas(p)}
                    style={{
                      padding: '0.3rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 6,
                      background: alertasMeta.pagina === p ? '#4F46E5' : '#fff',
                      color: alertasMeta.pagina === p ? '#fff' : '#334155', cursor: 'pointer'
                    }}>{p}</button>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* ── RECOMENDACIONES ── */}
      {activeTab === 'recomendaciones' && (
        <SectionCard title={`Recomendaciones (${recomendaciones.length})`} subtitle="Sugerencias pedagógicas para intervención temprana y acompañamiento">
          <div className="list">
            {recomendaciones.length === 0 ? (
              <div className="empty">Sin recomendaciones disponibles</div>
            ) : recomendaciones.map(r => (
              <div key={r.id_alerta} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong>{r.alumno_nombre}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={RISK_BADGE[r.nivel_riesgo]}>{r.nivel_riesgo}</span>
                    <span className="badge light">{r.nombre_grupo}</span>
                  </div>
                </div>
                <small style={{ color: '#64748B' }}>Matrícula: {r.matricula} • {r.nombre_materia} • {r.nombre_periodo}</small>
                <p style={{ fontSize: '0.9rem', margin: '0.25rem 0' }}>{r.descripcion}</p>
                {r.accion_sugerida && (
                  <div style={{ background: '#EEF2FF', padding: '0.5rem 0.75rem', borderRadius: 8, width: '100%' }}>
                    <small><strong>Acción sugerida:</strong> {r.accion_sugerida}</small>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button className="btn ghost" onClick={() => loadDetalle(r.id_alumno)}><Eye size={14} /> Ver detalle</button>
                  <button className="btn ghost" onClick={() => loadHistorial(r.id_alumno)}><Clock size={14} /> Historial</button>
                  <button className="btn ghost" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(r.id_alerta) }); setActiveTab('observaciones'); }}><MessageSquare size={14} /> Observar</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── OBSERVACIONES ── */}
      {activeTab === 'observaciones' && (
        <div className="two-col">
          <SectionCard title="Registrar observación" subtitle="Captura observaciones pedagógicas y sugiere acciones de apoyo">
            <form className="form-stack" onSubmit={handleObservacion}>
              <FormField label="ID de alerta">
                <input value={obsForm.id_alerta} onChange={e => setObsForm({ ...obsForm, id_alerta: e.target.value })} placeholder="ID de la alerta" />
              </FormField>
              <FormField label="Acción sugerida">
                <select value={obsForm.accion_sugerida} onChange={e => setObsForm({ ...obsForm, accion_sugerida: e.target.value })}>
                  <option value="">Seleccionar acción...</option>
                  <option value="TUTORIA_ACADEMICA">Tutoría académica</option>
                  <option value="APOYO_PSICOPEDAGOGICO">Apoyo psicopedagógico</option>
                  <option value="CANALIZACION_CONSEJERIA">Canalización a consejería</option>
                  <option value="ADEcuacion_curricular">Adecuación curricular</option>
                  <option value="ENTREVISTA_PADRES">Entrevista con padres/tutores</option>
                  <option value="SEGUIMIENTO_INDIVIDUAL">Seguimiento individual</option>
                  <option value="INTERVENCION_DOCENTE">Intervención en aula</option>
                </select>
              </FormField>
              <FormField label="Observaciones">
                <textarea value={obsForm.observaciones} onChange={e => setObsForm({ ...obsForm, observaciones: e.target.value })} rows={4} placeholder="Describe la situación del estudiante, patrones observados y acciones sugeridas..." />
              </FormField>
              <button className="btn accent" type="submit">Registrar observación</button>
            </form>
          </SectionCard>
          <SectionCard title="Alertas recientes" subtitle="Selecciona una para registrar observación">
            <div className="list" style={{ maxHeight: 400, overflow: 'auto' }}>
              {alertas.slice(0, 10).map(a => (
                <button key={a.id_alerta} type="button" className="list-item"
                  onClick={() => setObsForm({ ...obsForm, id_alerta: String(a.id_alerta) })}
                  style={{ textAlign: 'left', width: '100%', background: 'transparent', cursor: 'pointer' }}>
                  <strong>{a.nombres} {a.apellido_paterno}</strong>
                  <span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo} • {a.estado_alerta || 'PENDIENTE'}</span>
                  <small>#{a.id_alerta} • {a.matricula} • {a.nombre_grupo} • {a.nombre_materia}</small>
                </button>
              ))}
              {alertas.length === 0 && <div className="empty">Sin alertas disponibles</div>}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── HISTORIAL DE INTERVENCIÓN ── */}
      {activeTab === 'historial' && (
        <SectionCard title="Historial de intervención" subtitle="Busca el historial completo de un estudiante">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input id="historial-search" placeholder="Matrícula o nombre del alumno..."
                style={{ paddingLeft: '2rem', width: '100%' }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (!val) return;
                    setLoading(true);
                    try {
                      const res = await api.iaBienestarDocenteAlertas(token, { busqueda: val, limite: 1 });
                      if (res?.ok && res.data.length > 0) {
                        loadHistorial(res.data[0].id_alumno);
                      } else {
                        showMessage('No se encontraron alumnos con ese criterio', true);
                      }
                    } catch (err) {
                      showMessage('Error al buscar', true);
                    } finally {
                      setLoading(false);
                    }
                  }
                }} />
            </div>
          </div>
          <div className="list">
            {alertas.slice(0, 5).map(a => (
              <button key={a.id_alerta} type="button" className="list-item"
                onClick={() => loadHistorial(a.id_alumno)}
                style={{ textAlign: 'left', width: '100%', background: 'transparent', cursor: 'pointer' }}>
                <strong>{a.nombres} {a.apellido_paterno} {a.apellido_materno}</strong>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{a.matricula} • {a.nombre_grupo}</span>
                <span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo || 'Sin riesgo'}</span>
              </button>
            ))}
            {alertas.length === 0 && <div className="empty">Busca un alumno por nombre o matrícula para ver su historial</div>}
          </div>
        </SectionCard>
      )}

      {/* ── DETALLE MODAL ── */}
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)}
        title={detalle ? `${detalle.alumno.nombres} ${detalle.alumno.apellido_paterno} — Detalle de bienestar` : ''}>
        {detalle && (
          <div className="stack">
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card"><div><div className="stat-label">Matrícula</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alumno.matricula}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Carrera</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alumno.nombre_carrera || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Semestre</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alumno.semestre_actual || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Promedio</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alumno.promedio_general || '-'}</div></div></div>
            </div>

            <div className="eyebrow">Alertas de bienestar ({detalle.alertas.length})</div>
            <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
              <table className="table">
                <thead><tr><th>#</th><th>Tipo</th><th>Riesgo</th><th>Estado</th><th>Acción sugerida</th><th>Fecha</th></tr></thead>
                <tbody>
                  {detalle.alertas.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>Sin alertas registradas</td></tr>
                  ) : detalle.alertas.map(a => (
                    <tr key={a.id_alerta}>
                      <td>{a.id_alerta}</td>
                      <td><span className="badge light">{a.tipo_alerta}</span></td>
                      <td><span className={RISK_BADGE[a.nivel_riesgo]}>{a.nivel_riesgo}</span></td>
                      <td><span className={`badge ${a.estado_alerta === 'ATENDIDA' || a.estado_alerta === 'CERRADA' ? 'light' : 'warning'}`}>{a.estado_alerta}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{a.accion_sugerida || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="eyebrow">Check-ins recientes ({detalle.checkins.length})</div>
            <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
              <table className="table">
                <thead><tr><th>#</th><th>Plantilla</th><th>Score</th><th>Riesgo</th><th>Animo</th><th>Estrés</th><th>Fecha</th></tr></thead>
                <tbody>
                  {detalle.checkins.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>Sin check-ins registrados</td></tr>
                  ) : detalle.checkins.map(c => (
                    <tr key={c.id_checkin}>
                      <td>{c.id_checkin}</td>
                      <td><span className="badge light">{c.codigo_plantilla}</span></td>
                      <td><strong>{c.bienestar_score || '-'}</strong></td>
                      <td><span className={RISK_BADGE[c.nivel_riesgo] || 'status'}>{c.nivel_riesgo || '-'}</span></td>
                      <td>{c.animo || '-'}</td>
                      <td>{c.estres || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{c.creado_en ? new Date(c.creado_en).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="eyebrow">Intervenciones registradas ({detalle.derivaciones.length})</div>
            <div className="list" style={{ marginBottom: '1rem' }}>
              {detalle.derivaciones.length === 0 ? (
                <div className="empty">Sin intervenciones registradas</div>
              ) : detalle.derivaciones.map(d => (
                <div key={d.id_derivacion} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong>{d.destino}</strong>
                    <span className={`badge ${d.estado_derivacion === 'CERRADA' ? 'light' : 'warning'}`}>{d.estado_derivacion}</span>
                  </div>
                  <small>{d.motivo}</small>
                  <small style={{ color: '#94a3b8' }}>
                    {d.creado_en ? new Date(d.creado_en).toLocaleString('es-MX') : ''} — {d.usuario_nombre} {d.usuario_apellido || ''}
                  </small>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn primary" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(detalle.alertas[0]?.id_alerta || '') }); setDetalleOpen(false); setActiveTab('observaciones'); }}>
                <MessageSquare size={16} /> Registrar observación
              </button>
              <button className="btn secondary" onClick={() => { setDetalleOpen(false); loadHistorial(detalle.alumno.id_alumno); }}>
                <Clock size={16} /> Historial completo
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── HISTORIAL MODAL ── */}
      <Modal open={historialOpen} onClose={() => setHistorialOpen(false)}
        title={historial ? `Historial de intervención — ${historial.alumno.nombres} ${historial.alumno.apellido_paterno}` : ''}>
        {historial && (
          <div className="stack">
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card"><div><div className="stat-label">Matrícula</div><div className="stat-value" style={{ fontSize: '1rem' }}>{historial.alumno.matricula}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Carrera</div><div className="stat-value" style={{ fontSize: '1rem' }}>{historial.alumno.nombre_carrera || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Promedio</div><div className="stat-value" style={{ fontSize: '1rem' }}>{historial.alumno.promedio_general || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Créditos</div><div className="stat-value" style={{ fontSize: '1rem' }}>{historial.alumno.creditos_acumulados || '-'}</div></div></div>
            </div>

            <div className="eyebrow">Alertas registradas ({historial.alertas.length})</div>
            <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
              <table className="table">
                <thead><tr><th>#</th><th>Tipo</th><th>Riesgo</th><th>Estado</th><th>Acción sugerida</th><th>Fecha</th></tr></thead>
                <tbody>
                  {historial.alertas.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>Sin alertas</td></tr>
                  ) : historial.alertas.map(a => (
                    <tr key={a.id_alerta}>
                      <td>{a.id_alerta}</td>
                      <td><span className="badge light">{a.tipo_alerta}</span></td>
                      <td><span className={RISK_BADGE[a.nivel_riesgo]}>{a.nivel_riesgo}</span></td>
                      <td><span className={`badge ${a.estado_alerta === 'ATENDIDA' || a.estado_alerta === 'CERRADA' ? 'light' : 'warning'}`}>{a.estado_alerta}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{a.accion_sugerida || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="eyebrow">Intervenciones ({historial.intervenciones.length})</div>
            <div className="list">
              {historial.intervenciones.length === 0 ? (
                <div className="empty">Sin intervenciones registradas</div>
              ) : historial.intervenciones.map(d => (
                <div key={d.id_derivacion} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong>{d.destino}</strong>
                    <span className={`badge ${d.estado_derivacion === 'CERRADA' ? 'light' : 'warning'}`}>{d.estado_derivacion}</span>
                  </div>
                  <small>{d.motivo}</small>
                  {d.observaciones && <small style={{ color: '#64748B' }}>Notas: {d.observaciones}</small>}
                  <small style={{ color: '#94a3b8' }}>
                    {d.creado_en ? new Date(d.creado_en).toLocaleString('es-MX') : ''} — {d.usuario_nombre} {d.usuario_apellido || ''}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
