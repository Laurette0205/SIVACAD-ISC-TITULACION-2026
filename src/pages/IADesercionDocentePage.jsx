import React from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api, canAccessDesercionDocenteIA } from '../services/api';
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2, ClipboardList,
  Eye, FileText, Filter, Loader2, MessageSquare, RefreshCw,
  Search, Sparkles, Target, Users, X, Clock, UserCheck, GraduationCap
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

export default function IADesercionDocentePage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccess = canAccessDesercionDocenteIA(user);

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
  const [filtros, setFiltros] = React.useState({ nivel_riesgo: '', atendida: '', periodoId: '', busqueda: '' });

  // Detalle
  const [detalle, setDetalle] = React.useState(null);
  const [detalleOpen, setDetalleOpen] = React.useState(false);

  // Observación
  const [obsForm, setObsForm] = React.useState({ id_alerta: '', observaciones: '', accion: '' });
  const [detalleAlertas, setDetalleAlertas] = React.useState([]);

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
      const res = await api.iaDesercionDocenteGrupos(token);
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
      const res = await api.iaDesercionDocenteAlumnosGrupo(token, idGrupo);
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
      const res = await api.iaDesercionDocenteAlertas(token, { ...filtros, pagina: page, limite: 15 });
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
  const loadDetalle = async (id) => {
    try {
      setLoading(true);
      const res = await api.iaDesercionDocenteDetalle(token, id);
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
      const res = await api.iaDesercionDocenteRecomendaciones(token);
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
      const res = await api.iaDesercionDocenteHistorial(token, idAlumno);
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
      await api.iaDesercionDocenteObservacion(token, {
        id_alerta: Number(obsForm.id_alerta),
        observaciones: obsForm.observaciones.trim(),
        accion: obsForm.accion.trim() || 'Observación docente'
      });
      showMessage('Observación registrada correctamente');
      setObsForm({ id_alerta: '', observaciones: '', accion: '' });
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
      <small style={{ color: '#94a3b8' }}>{g.clave_materia} • Semestre {g.semestre} • {g.turno}</small>
    </button>
  );

  const renderStudentRow = (a) => (
    <tr key={a.id_alumno}>
      <td><code>{a.matricula}</code></td>
      <td>{a.nombres} {a.apellido_paterno} {a.apellido_materno}</td>
      <td>{a.nombre_periodo || '-'}</td>
      <td><span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo || 'Sin riesgo'}</span></td>
      <td><strong>{a.puntaje_riesgo || '-'}</strong></td>
      <td>{a.atendida ? <span className="status ok">Atendida</span> : <span className="status error">Pendiente</span>}</td>
      <td style={{ display: 'flex', gap: '0.25rem' }}>
        {a.id_alerta && <button className="btn ghost" onClick={() => loadDetalle(a.id_alerta)} style={{ padding: '0.25rem 0.5rem' }}><Eye size={14} /></button>}
        <button className="btn ghost" onClick={() => loadHistorial(a.id_alumno)} style={{ padding: '0.25rem 0.5rem' }} title="Historial"><Clock size={14} /></button>
        {a.id_alerta && <button className="btn ghost" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(a.id_alerta) }); setActiveTab('observaciones'); }} style={{ padding: '0.25rem 0.5rem' }} title="Observación"><MessageSquare size={14} /></button>}
      </td>
    </tr>
  );

  const renderFactores = (factoresJson) => {
    try {
      const factores = JSON.parse(factoresJson || '[]');
      if (!factores.length) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin factores detectados</p>;
      return factores.map((f, i) => (
        <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
          <span><strong>{f.factor}</strong><br /><small>{f.detalle}</small></span>
          <span style={{ fontWeight: 600, color: '#ef4444' }}>+{f.peso}</span>
        </div>
      ));
    } catch { return null; }
  };

  const TABS = [
    { key: 'grupos', label: 'Mis grupos', icon: GraduationCap },
    { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { key: 'recomendaciones', label: 'Recomendaciones', icon: Target },
    { key: 'observaciones', label: 'Observaciones', icon: MessageSquare }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">IA institucional • {user?.rol || user?.rol_nombre || 'Docente'}</div>
          <h1>IA de deserción — Docente</h1>
          <p>Monitorea el riesgo académico de tus estudiantes, consulta alertas, registra observaciones y da seguimiento personalizado.</p>
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

      {/* ── MIS GRUPOS ── */}
      {activeTab === 'grupos' && (
        <SectionCard title={`Mis grupos (${grupos.length})`} subtitle="Grupos con alertas activas de riesgo de deserción">
          {grupos.length === 0 ? (
            <div className="empty">No tienes grupos asignados en el periodo actual</div>
          ) : (
            <div className="list">{grupos.map(renderGroupCard)}</div>
          )}
        </SectionCard>
      )}

      {/* ── ALUMNOS DEL GRUPO ── */}
      {activeTab === 'alumnos' && (
        <div className="stack">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button className="btn ghost" onClick={() => setActiveTab('grupos')}><BarChart3 size={16} /> Volver a grupos</button>
            <span className="badge light">{alumnos.length} alumnos</span>
          </div>
          <SectionCard title="Alumnos del grupo" subtitle="Riesgo de deserción por estudiante">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin alumnos en este grupo</td></tr>
                  ) : alumnos.map(renderStudentRow)}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── ALERTAS ── */}
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
            <select value={filtros.atendida} onChange={e => setFiltros(prev => ({ ...prev, atendida: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <option value="">Todas</option><option value="0">Pendientes</option><option value="1">Atendidas</option>
            </select>
            <button className="btn secondary" onClick={() => loadAlertas(1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={14} /> Filtrar
            </button>
            <button className="btn ghost" onClick={() => { setFiltros({ nivel_riesgo: '', atendida: '', periodoId: '', busqueda: '' }); loadAlertas(1); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={14} /> Limpiar
            </button>
          </div>

          <SectionCard title={`Alertas de riesgo (${alertasMeta.total})`} subtitle="Estudiantes con alertas activas en tus grupos">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>Matrícula</th><th>Alumno</th><th>Grupo</th><th>Materia</th>
                    <th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Acciones</th>
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
                      <td><strong>{a.puntaje_riesgo}</strong></td>
                      <td>{a.atendida ? <span className="status ok">Atendida</span> : <span className="status error">Pendiente</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn ghost" onClick={() => loadDetalle(a.id_alerta)} title="Ver detalle"><Eye size={14} /></button>
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
        <SectionCard title={`Recomendaciones (${recomendaciones.length})`} subtitle="Sugerencias pedagógicas para intervención temprana">
          <div className="list">
            {recomendaciones.length === 0 ? (
              <div className="empty">Sin recomendaciones disponibles</div>
            ) : recomendaciones.map(r => (
              <div key={r.id_alerta} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong>{r.alumno_nombre}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={RISK_BADGE[r.nivel_riesgo]}>{r.nivel_riesgo} • {r.puntaje_riesgo}</span>
                    <span className="badge light">{r.nombre_grupo}</span>
                  </div>
                </div>
                <small style={{ color: '#64748B' }}>Matrícula: {r.matricula} • {r.nombre_materia} • {r.nombre_periodo}</small>
                {r.recomendacion && (
                  <div style={{ background: '#F0FDF4', padding: '0.5rem 0.75rem', borderRadius: 8, width: '100%' }}>
                    <small><strong>Recomendación:</strong> {r.recomendacion}</small>
                  </div>
                )}
                {r.factores && r.factores.length > 0 && (
                  <details style={{ width: '100%' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#4F46E5' }}>Ver factores de riesgo</summary>
                    <div style={{ marginTop: '0.5rem' }}>{renderFactores(JSON.stringify(r.factores))}</div>
                  </details>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button className="btn ghost" onClick={() => loadDetalle(r.id_alerta)}><Eye size={14} /> Ver alerta</button>
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
          <SectionCard title="Registrar observación" subtitle="Retroalimentación pedagógica sobre un caso">
            <form className="form-stack" onSubmit={handleObservacion}>
              <FormField label="ID de alerta">
                <input value={obsForm.id_alerta} onChange={e => setObsForm({ ...obsForm, id_alerta: e.target.value })} placeholder="ID de la alerta" />
              </FormField>
              <FormField label="Título / Acción">
                <input value={obsForm.accion} onChange={e => setObsForm({ ...obsForm, accion: e.target.value })} placeholder="Ej. Reporte de aprovechamiento" />
              </FormField>
              <FormField label="Observaciones">
                <textarea value={obsForm.observaciones} onChange={e => setObsForm({ ...obsForm, observaciones: e.target.value })} rows={4} placeholder="Describe la situación académica del estudiante..." />
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
                  <span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo} • {a.estado_seguimiento || 'Pendiente'}</span>
                  <small>#{a.id_alerta} • {a.matricula} • {a.nombre_grupo}</small>
                </button>
              ))}
              {alertas.length === 0 && <div className="empty">Sin alertas disponibles</div>}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── DETALLE MODAL ── */}
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)}
        title={detalle ? `Caso #${detalle.alerta.id_alerta} — ${detalle.alerta.nombres} ${detalle.alerta.apellido_paterno}` : ''}>
        {detalle && (
          <div className="stack">
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card"><div><div className="stat-label">Matrícula</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alerta.matricula}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Carrera</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alerta.nombre_carrera || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Semestre</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alerta.semestre_actual || '-'}</div></div></div>
              <div className="stat-card"><div><div className="stat-label">Grupo</div><div className="stat-value" style={{ fontSize: '1rem' }}>{detalle.alerta.nombre_grupo || '-'}</div></div></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="eyebrow">Nivel de riesgo</div>
                <span className={RISK_BADGE[detalle.alerta.nivel_riesgo] || 'status'} style={{ fontSize: '1.1rem', padding: '0.4rem 0.8rem' }}>
                  {detalle.alerta.nivel_riesgo} • {detalle.alerta.puntaje_riesgo}/100
                </span>
              </div>
              <div>
                <div className="eyebrow">Estado</div>
                <span className={`badge ${detalle.alerta.atendida ? 'light' : 'warning'}`} style={{ fontSize: '1rem' }}>
                  {detalle.alerta.atendida ? 'Atendida' : 'Pendiente'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div><div className="eyebrow">Promedio</div><strong>{detalle.alerta.promedio_general || 'N/D'}</strong></div>
              <div><div className="eyebrow">Créditos</div><strong>{detalle.alerta.creditos_acumulados || 'N/D'}</strong></div>
              <div><div className="eyebrow">Alertas previas</div><strong>{detalle.alertas_previas || 0}</strong></div>
              <div><div className="eyebrow">Estatus</div><strong>{detalle.alerta.estatus_academico || 'N/D'}</strong></div>
            </div>

            {detalle.alerta.factores_json && (
              <div style={{ marginBottom: '1rem' }}>
                <div className="eyebrow">Factores de riesgo</div>
                <div className="list">{renderFactores(detalle.alerta.factores_json)}</div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div className="eyebrow">Descripción</div>
              <p>{detalle.alerta.descripcion}</p>
              {detalle.alerta.recomendacion && (
                <>
                  <div className="eyebrow">Recomendación</div>
                  <p>{detalle.alerta.recomendacion}</p>
                </>
              )}
              {detalle.alerta.explicacion && (
                <>
                  <div className="eyebrow">Explicación del modelo</div>
                  <p style={{ fontSize: '0.9rem', color: '#475569' }}>{detalle.alerta.explicacion}</p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button className="btn primary" onClick={() => { setObsForm({ ...obsForm, id_alerta: String(detalle.alerta.id_alerta) }); setDetalleOpen(false); setActiveTab('observaciones'); }}>
                <MessageSquare size={16} /> Registrar observación
              </button>
              <button className="btn secondary" onClick={() => { setDetalleOpen(false); loadHistorial(detalle.alerta.id_alumno); }}>
                <Clock size={16} /> Historial completo
              </button>
            </div>

            <div>
              <div className="eyebrow">Seguimientos registrados</div>
              <div className="list">
                {detalle.seguimientos.length === 0 ? (
                  <div className="empty">Sin seguimientos registrados</div>
                ) : detalle.seguimientos.map(s => (
                  <div key={s.id_seguimiento} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong>{s.accion}</strong>
                      <span className={`badge ${s.estado === 'Atendida' || s.estado === 'Cerrada' ? 'light' : 'warning'}`}>{s.estado}</span>
                    </div>
                    <small>{s.observaciones}</small>
                    <small style={{ color: '#94a3b8' }}>
                      {s.creado_en ? new Date(s.creado_en).toLocaleString('es-MX') : ''} — {s.usuario_nombre} {s.usuario_apellido || ''}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── HISTORIAL MODAL ── */}
      <Modal open={historialOpen} onClose={() => setHistorialOpen(false)}
        title={historial ? `Historial — ${historial.alumno.nombres} ${historial.alumno.apellido_paterno}` : ''}>
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
                <thead><tr><th>#</th><th>Periodo</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {historial.alertas.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>Sin alertas</td></tr>
                  ) : historial.alertas.map(a => (
                    <tr key={a.id_alerta}>
                      <td>{a.id_alerta}</td><td>{a.nombre_periodo}</td>
                      <td><span className={RISK_BADGE[a.nivel_riesgo]}>{a.nivel_riesgo}</span></td>
                      <td><strong>{a.puntaje_riesgo}</strong></td>
                      <td>{a.atendida ? <span className="status ok">Atendida</span> : <span className="status error">Pendiente</span>}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.creado_en ? new Date(a.creado_en).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="eyebrow">Seguimientos ({historial.seguimientos.length})</div>
            <div className="list">
              {historial.seguimientos.length === 0 ? (
                <div className="empty">Sin seguimientos</div>
              ) : historial.seguimientos.map(s => (
                <div key={s.id_seguimiento} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong>{s.accion}</strong>
                    <span className={`badge ${s.estado === 'Atendida' || s.estado === 'Cerrada' ? 'light' : 'warning'}`}>{s.estado}</span>
                  </div>
                  <small>{s.observaciones}</small>
                  <small style={{ color: '#94a3b8' }}>
                    {s.creado_en ? new Date(s.creado_en).toLocaleString('es-MX') : ''} — {s.usuario_nombre} {s.usuario_apellido || ''}
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
