import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, Activity, Brain,
  Loader2, AlertTriangle, GraduationCap, FileText,
  Search, RefreshCw, SendHorizonal, BarChart3,
  Sparkles, UserCheck, Clock, Filter, Download, Eye,
  MessageCircle, CheckCircle2, XCircle, ClipboardList
} from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

function Badge({ type, children }) {
  const cls = type === 'success' ? 'badge badge-success' :
    type === 'danger' ? 'badge badge-danger' :
    type === 'warning' ? 'badge badge-warning' :
    type === 'info' ? 'badge badge-info' : 'badge badge-light';
  return <span className={cls}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="admin-stat-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={24} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>{value ?? '—'}</div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'docente', label: 'Panel docente', icon: LayoutDashboard },
  { key: 'grupos', label: 'Grupos asignados', icon: Users },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: BarChart3 },
  { key: 'seguimiento', label: 'Seguimiento académico', icon: Activity },
  { key: 'asistente', label: 'Asistente académico', icon: Brain }
];

export default function AsistenteDocentePage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('docente');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [dashboard, setDashboard] = React.useState(null);
  const [groups, setGroups] = React.useState([]);
  const [evaluations, setEvaluations] = React.useState([]);
  const [tracking, setTracking] = React.useState([]);
  const [alerts, setAlerts] = React.useState([]);
  const [kardexView, setKardexView] = React.useState(null);

  const [messages, setMessages] = React.useState([
    { role: 'bot', text: 'Hola, soy tu asistente docente. Puedo ayudarte con tus grupos, evaluaciones, seguimiento de alumnos y alertas.' }
  ]);
  const [texto, setTexto] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const [contexto, setContexto] = React.useState(null);
  const endRef = React.useRef(null);

  const [filterGrupo, setFilterGrupo] = React.useState('');
  const [filterMateria, setFilterMateria] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDashboard = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docDashboard(token);
      setDashboard(res?.data?.dashboard || null);
      setGroups(res?.data?.groups || []);
    } catch (e) {
      setError('No se pudo cargar el panel docente.');
    } finally { setLoading(false); }
  };

  const loadGroups = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docGroups(token);
      setGroups(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar los grupos.');
    } finally { setLoading(false); }
  };

  const loadEvaluations = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docEvaluations(token);
      setEvaluations(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las evaluaciones.');
    } finally { setLoading(false); }
  };

  const loadTracking = async (filters = {}) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docTracking(token, filters);
      setTracking(res?.data || []);
    } catch (e) {
      setError('No se pudo cargar el seguimiento.');
    } finally { setLoading(false); }
  };

  const loadAlerts = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docAlerts(token);
      setAlerts(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las alertas.');
    } finally { setLoading(false); }
  };

  const loadKardex = async (id_alumno) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.docKardex(token, id_alumno);
      setKardexView(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar el kardex.');
    } finally { setLoading(false); }
  };

  React.useEffect(() => {
    switch (activeTab) {
      case 'docente': loadDashboard(); break;
      case 'grupos': loadGroups(); break;
      case 'evaluaciones': loadEvaluations(); break;
      case 'seguimiento': loadTracking(); break;
      case 'alertas': loadAlerts(); break;
    }
  }, [activeTab, token]);

  React.useEffect(() => {
    let mounted = true;
    if (!token) return;
    api.asistente.contexto(token).then(r => { if (mounted) setContexto(r?.data || null); }).catch(() => {});
    return () => { mounted = false; };
  }, [token]);

  const handleSend = async (e) => {
    e.preventDefault();
    const value = texto.trim();
    if (!value || chatLoading) return;
    setMessages(prev => [...prev, { role: 'user', text: value }]);
    setTexto('');
    setChatLoading(true);
    try {
      const res = await api.asistente.mensaje(token, { mensaje: value });
      setMessages(prev => [...prev, { role: 'bot', text: res?.respuesta || 'Respuesta generada.', data: res?.data || null, intent: res?.intent || null }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: err?.message || 'Error al contactar al asistente.', error: true }]);
    } finally { setChatLoading(false); }
  };

  const quickFill = (t) => setTexto(t);

  const handleFilterTracking = () => {
    const filters = {};
    if (filterGrupo) filters.id_grupo = filterGrupo;
    if (filterMateria) filters.id_materia = filterMateria;
    if (searchTerm) filters.search = searchTerm;
    loadTracking(filters);
  };

  const handleExportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(String(row[h] || '').replace(/,/g, ' '))).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  if (!token) {
    return (
      <SectionCard title="Asistente Académico — Docente" subtitle="Panel de apoyo docente">
        <p className="muted">Inicia sesión para acceder.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Asistente Académico Institucional — Docente"
      subtitle="Panel docente, grupos asignados, evaluaciones, seguimiento académico y asistente"
    >
      <div className="tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`btn ${activeTab === tab.key ? 'accent' : 'secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2rem', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={20} /> Cargando...
        </div>
      )}

      {!loading && activeTab === 'docente' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><LayoutDashboard size={14} /> Panel docente — resumen</div>
          {dashboard ? (
            <>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatCard icon={Users} label="Grupos asignados" value={dashboard.total_grupos} color="var(--primary)" />
                <StatCard icon={BookOpen} label="Materias" value={dashboard.total_materias} color="#22c55e" />
                <StatCard icon={GraduationCap} label="Alumnos" value={dashboard.total_alumnos} color="#f59e0b" />
                <StatCard icon={AlertTriangle} label="Alertas pendientes" value={dashboard.alertas_pendientes} color="#ef4444" />
                <StatCard icon={BarChart3} label="Evaluaciones activas" value={dashboard.evaluaciones_activas} color="#8b5cf6" />
              </div>
              {groups.length > 0 && (
                <div style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><ClipboardList size={14} /> Tus cargas académicas</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Grupo</th>
                          <th>Materia</th>
                          <th>Carrera</th>
                          <th>Semestre</th>
                          <th>Turno</th>
                          <th>Periodo</th>
                          <th>Alumnos</th>
                          <th>Alertas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.slice(0, 10).map(g => (
                          <tr key={g.id_carga_academica}>
                            <td><strong>{g.nombre_grupo}</strong></td>
                            <td>{g.nombre_materia}</td>
                            <td>{g.nombre_carrera}</td>
                            <td>{g.semestre}°</td>
                            <td>{g.turno}</td>
                            <td>{g.nombre_periodo}</td>
                            <td>{g.alumnos_inscritos}</td>
                            <td>{g.alertas_activas > 0 ? <Badge type="danger">{g.alertas_activas}</Badge> : '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : <p className="muted">No hay datos del panel docente.</p>}
        </div>
      )}

      {!loading && activeTab === 'grupos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Users size={14} /> Grupos y materias asignadas</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadGroups()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {groups.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Grupo</th>
                    <th>Materia</th>
                    <th>Clave</th>
                    <th>Créditos</th>
                    <th>Semestre</th>
                    <th>Turno</th>
                    <th>Carrera</th>
                    <th>Alumnos</th>
                    <th>Alertas</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id_carga_academica}>
                      <td>{g.nombre_periodo}</td>
                      <td><strong>{g.nombre_grupo}</strong></td>
                      <td>{g.nombre_materia}</td>
                      <td><code style={{ fontSize: '0.75rem' }}>{g.clave_materia}</code></td>
                      <td>{g.creditos}</td>
                      <td>{g.semestre}°</td>
                      <td>{g.turno}</td>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre_carrera}</td>
                      <td>{g.alumnos_inscritos}</td>
                      <td>{g.alertas_activas > 0 ? <Badge type="danger">{g.alertas_activas}</Badge> : '0'}</td>
                      <td><Badge type={g.grupo_estado === 'Abierto' ? 'success' : 'light'}>{g.grupo_estado}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No tienes grupos asignados.</p>}
        </div>
      )}

      {!loading && activeTab === 'evaluaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><BarChart3 size={14} /> Evaluaciones</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadEvaluations()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {evaluations.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Grupo</th>
                    <th>Materia</th>
                    <th>Periodo</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Respuestas</th>
                    <th>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map(e => (
                    <tr key={`${e.id_evaluacion}-${e.id_grupo}`}>
                      <td><strong>{e.titulo}</strong></td>
                      <td>{e.nombre_grupo || '—'}</td>
                      <td>{e.nombre_materia || '—'}</td>
                      <td>{e.nombre_periodo}</td>
                      <td><Badge type="info">{e.tipo_instrumento || '—'}</Badge></td>
                      <td>{formatDate(e.fecha_inicio)}</td>
                      <td>{formatDate(e.fecha_fin)}</td>
                      <td><Badge type={e.eval_estado === 'ACTIVA' ? 'success' : e.eval_estado === 'CERRADA' ? 'light' : 'warning'}>{e.eval_estado}</Badge></td>
                      <td>{e.total_respuestas || 0}</td>
                      <td>{Number(e.promedio_final || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No hay evaluaciones relacionadas con tus grupos.</p>}
        </div>
      )}

      {!loading && activeTab === 'seguimiento' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Activity size={14} /> Seguimiento académico de alumnos</div>
            <div className="row gap" style={{ gap: 4 }}>
              <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => { setFilterGrupo(''); setFilterMateria(''); setSearchTerm(''); loadTracking(); }}>
                <RefreshCw size={14} /> Limpiar
              </button>
              <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleExportCSV(tracking, 'seguimiento_docente')}>
                <Download size={14} /> CSV
              </button>
            </div>
          </div>
          <div className="row gap wrap" style={{ marginBottom: '0.75rem', alignItems: 'end' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Grupo</label>
              <select className="input" value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)}>
                <option value="">Todos</option>
                {[...new Set(groups.map(g => g.id_grupo))].map(id => {
                  const grp = groups.find(g => g.id_grupo === id);
                  return <option key={id} value={id}>{grp?.nombre_grupo || id}</option>;
                })}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Materia</label>
              <select className="input" value={filterMateria} onChange={e => setFilterMateria(e.target.value)}>
                <option value="">Todas</option>
                {[...new Set(groups.map(g => g.id_materia))].map(id => {
                  const grp = groups.find(g => g.id_materia === id);
                  return <option key={id} value={id}>{grp?.nombre_materia || id}</option>;
                })}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Buscar alumno</label>
              <input className="input" type="text" placeholder="Nombre o matrícula" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button className="btn accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', marginTop: 4 }} onClick={handleFilterTracking}>
              <Search size={14} /> Buscar
            </button>
          </div>
          {tracking.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Nombre</th>
                    <th>Semestre</th>
                    <th>Estatus</th>
                    <th>Promedio</th>
                    <th>Créditos</th>
                    <th>Grupo</th>
                    <th>Materia</th>
                    <th>Riesgo</th>
                    <th>Kardex</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.map(a => (
                    <tr key={`${a.id_alumno}-${a.id_materia}`}>
                      <td>{a.matricula}</td>
                      <td>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</td>
                      <td>{a.semestre_actual}°</td>
                      <td><Badge type={a.estatus_academico === 'Regular' ? 'success' : 'warning'}>{a.estatus_academico}</Badge></td>
                      <td>{Number(a.promedio_general).toFixed(2)}</td>
                      <td>{a.creditos_acumulados}</td>
                      <td>{a.nombre_grupo || '—'}</td>
                      <td>{a.nombre_materia || '—'}</td>
                      <td>
                        <Badge type={a.nivel_riesgo === 'Crítico' ? 'danger' : a.nivel_riesgo === 'Alto' ? 'danger' : a.nivel_riesgo === 'Medio' ? 'warning' : 'info'}>
                          {a.nivel_riesgo}
                        </Badge>
                      </td>
                      <td>
                        <button className="btn secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }} onClick={() => loadKardex(a.id_alumno)}>
                          <Eye size={12} /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>{tracking.length} alumno(s).</p>
            </div>
          ) : <p className="muted">No se encontraron alumnos.</p>}

          {kardexView && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="eyebrow"><FileText size={14} /> Kardex académico — {kardexView.alumno?.nombres} {kardexView.alumno?.apellido_paterno}</div>
                <button className="btn secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setKardexView(null)}><XCircle size={14} /> Cerrar</button>
              </div>
              <div className="row gap wrap" style={{ marginBottom: '0.75rem' }}>
                <span><strong>Matrícula:</strong> {kardexView.alumno?.matricula || '—'}</span>
                <span><strong>Carrera:</strong> {kardexView.alumno?.nombre_carrera || '—'}</span>
                <span><strong>Semestre:</strong> {kardexView.alumno?.semestre_actual || '—'}°</span>
                <span><strong>Promedio:</strong> {Number(kardexView.alumno?.promedio_general || 0).toFixed(2)}</span>
                <span><strong>Créditos:</strong> {kardexView.alumno?.creditos_acumulados || 0}</span>
                <span><strong>Estatus:</strong> <Badge type={kardexView.alumno?.estatus_academico === 'Regular' ? 'success' : 'warning'}>{kardexView.alumno?.estatus_academico}</Badge></span>
              </div>
              {kardexView.historial?.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th>Materia</th>
                        <th>Calificación</th>
                        <th>Créditos</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexView.historial.map(h => (
                        <tr key={h.id_historial}>
                          <td>{h.nombre_periodo}</td>
                          <td>{h.nombre_materia || h.clave_materia}</td>
                          <td>{h.calificacion !== null ? Number(h.calificacion).toFixed(2) : '—'}</td>
                          <td>{h.creditos}</td>
                          <td><Badge type="info">{h.tipo_materia}</Badge></td>
                          <td><Badge type={h.hist_estado === 'Acreditada' ? 'success' : h.hist_estado === 'Cursando' ? 'warning' : 'danger'}>{h.hist_estado}</Badge></td>
                          <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.observaciones || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'asistente' && (
        <div>
          <div className="auth-note" style={{ marginBottom: '1rem' }}>
            <div className="eyebrow"><Brain size={14} /> Asistente académico — modo docente</div>
            <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
              Consulta sobre tus grupos, materias, alumnos, evaluaciones y alertas académicas.
            </p>
            {contexto?.rol && (
              <p style={{ margin: '0.6rem 0 0', lineHeight: 1.6 }} className="muted">
                Rol detectado: <strong>{contexto.rol}</strong>
              </p>
            )}
          </div>
          <div className="chat-box">
            {messages.map((msg, index) => (
              <div key={index} className={`bubble ${msg.role}`}><span>{msg.text}</span></div>
            ))}
            {chatLoading && (
              <div className="bubble bot" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Loader2 className="animate-spin" size={16} /> Analizando...
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form className="chat-form" onSubmit={handleSend}>
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: ¿qué grupos tengo asignados?" disabled={chatLoading} />
            <button className="btn accent" type="submit" disabled={chatLoading || !texto.trim()}>
              {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />} Enviar
            </button>
          </form>
          <div className="row gap wrap" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cuáles son mis grupos asignados?')}><Users size={16} /> Mis grupos</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Qué evaluaciones tengo activas?')}><BarChart3 size={16} /> Evaluaciones</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('Alumnos con alertas en mis grupos')}><AlertTriangle size={16} /> Alertas</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
