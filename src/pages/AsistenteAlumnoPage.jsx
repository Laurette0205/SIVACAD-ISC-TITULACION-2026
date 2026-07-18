import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FileText, ClipboardList, ClipboardCheck, BarChart3,
  Brain, Loader2, GraduationCap, BookOpen, Sparkles, AlertTriangle,
  Activity, CheckCircle2, XCircle, Clock, User, SendHorizonal,
  RefreshCw, BadgeCheck, Calendar, Eye
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
  { key: 'personal', label: 'Panel personal', icon: LayoutDashboard },
  { key: 'kardex', label: 'Kardex individual', icon: FileText },
  { key: 'inscripciones', label: 'Inscripciones', icon: ClipboardList },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: BarChart3 },
  { key: 'asistente', label: 'Asistente académico', icon: Brain }
];

export default function AsistenteAlumnoPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('personal');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [dashboard, setDashboard] = React.useState(null);
  const [kardex, setKardex] = React.useState(null);
  const [inscripciones, setInscripciones] = React.useState([]);
  const [evaluaciones, setEvaluaciones] = React.useState([]);

  const [messages, setMessages] = React.useState([
    { role: 'bot', text: 'Hola, soy tu asistente estudiantil. Puedo ayudarte con tu kardex, inscripciones, evaluaciones y orientación académica.' }
  ]);
  const [texto, setTexto] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const [contexto, setContexto] = React.useState(null);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDashboard = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.alumDashboard(token);
      setDashboard(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar tu información personal.');
    } finally { setLoading(false); }
  };

  const loadKardex = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.alumKardex(token);
      setKardex(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar tu kardex.');
    } finally { setLoading(false); }
  };

  const loadInscripciones = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.alumInscripciones(token);
      setInscripciones(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar tus inscripciones.');
    } finally { setLoading(false); }
  };

  const loadEvaluaciones = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.alumEvaluaciones(token);
      setEvaluaciones(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las evaluaciones.');
    } finally { setLoading(false); }
  };

  React.useEffect(() => {
    switch (activeTab) {
      case 'personal': loadDashboard(); break;
      case 'kardex': loadKardex(); break;
      case 'inscripciones': loadInscripciones(); break;
      case 'evaluaciones': loadEvaluaciones(); break;
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

  if (!token) {
    return (
      <SectionCard title="Asistente Académico — Alumno" subtitle="Panel de autoservicio estudiantil">
        <p className="muted">Inicia sesión para acceder.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Asistente Académico Institucional — Alumno"
      subtitle="Panel personal, kardex, inscripciones, evaluaciones y asistente"
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

      {!loading && activeTab === 'personal' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><User size={14} /> Tu información personal</div>
          {dashboard?.alumno ? (
            <>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatCard icon={GraduationCap} label="Promedio" value={Number(dashboard.alumno.promedio_general).toFixed(2)} color="#22c55e" />
                <StatCard icon={BookOpen} label="Semestre" value={`${dashboard.alumno.semestre_actual || '—'}°`} color="var(--primary)" />
                <StatCard icon={Sparkles} label="Créditos" value={dashboard.alumno.creditos_acumulados || 0} color="#f59e0b" />
                <StatCard icon={ClipboardList} label="Inscripciones" value={dashboard.total_inscripciones} color="#8b5cf6" />
                <StatCard icon={AlertTriangle} label="Alertas" value={dashboard.alertas_pendientes} color="#ef4444" />
                <StatCard icon={BarChart3} label="Evaluaciones activas" value={dashboard.evaluaciones_activas} color="#06b6d4" />
              </div>
              <div style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><User size={14} /> Datos académicos</div>
                <div className="row gap wrap" style={{ gap: '1rem' }}>
                  <div><span className="muted">Nombre:</span> <strong>{dashboard.alumno.nombres} {dashboard.alumno.apellido_paterno} {dashboard.alumno.apellido_materno}</strong></div>
                  <div><span className="muted">Matrícula:</span> <strong>{dashboard.alumno.matricula}</strong></div>
                  <div><span className="muted">Carrera:</span> <strong>{dashboard.alumno.nombre_carrera}</strong></div>
                  <div><span className="muted">Plan:</span> <strong>{dashboard.alumno.nombre_plan} v{dashboard.alumno.version_plan}</strong></div>
                  <div><span className="muted">Estatus:</span> <Badge type={dashboard.alumno.estatus_academico === 'Regular' ? 'success' : 'warning'}>{dashboard.alumno.estatus_academico}</Badge></div>
                  <div><span className="muted">Periodo actual:</span> <strong>{dashboard.periodo_actual || '—'}</strong></div>
                </div>
              </div>
            </>
          ) : <p className="muted">No se pudo cargar tu información.</p>}
        </div>
      )}

      {!loading && activeTab === 'kardex' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><FileText size={14} /> Kardex académico — historial completo</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadKardex()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {kardex?.alumno ? (
            <>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatCard icon={BadgeCheck} label="Promedio" value={Number(kardex.alumno.promedio_general).toFixed(2)} color="#22c55e" />
                <StatCard icon={Sparkles} label="Créditos" value={kardex.alumno.creditos_acumulados || 0} color="#f59e0b" />
                <StatCard icon={CheckCircle2} label="Acreditadas" value={kardex.resumen?.acreditadas || 0} color="#22c55e" />
                <StatCard icon={XCircle} label="No acreditadas" value={kardex.resumen?.no_acreditadas || 0} color="#ef4444" />
                <StatCard icon={Clock} label="Cursando" value={kardex.resumen?.cursando || 0} color="#06b6d4" />
              </div>
              {kardex.historial?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th>Materia</th>
                        <th>Clave</th>
                        <th>Calificación</th>
                        <th>Créditos</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardex.historial.map(h => (
                        <tr key={h.id_historial}>
                          <td>{h.nombre_periodo}</td>
                          <td>{h.nombre_materia || h.clave_materia}</td>
                          <td><code style={{ fontSize: '0.7rem' }}>{h.clave_materia}</code></td>
                          <td><strong>{h.calificacion !== null ? Number(h.calificacion).toFixed(2) : '—'}</strong></td>
                          <td>{h.creditos}</td>
                          <td><Badge type="info">{h.tipo_materia}</Badge></td>
                          <td><Badge type={h.hist_estado === 'Acreditada' ? 'success' : h.hist_estado === 'Cursando' ? 'warning' : 'danger'}>{h.hist_estado}</Badge></td>
                          <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.observaciones || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No hay historial académico registrado.</p>}
            </>
          ) : <p className="muted">No se pudo cargar tu kardex.</p>}
        </div>
      )}

      {!loading && activeTab === 'inscripciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><ClipboardList size={14} /> Historial de inscripciones</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadInscripciones()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {inscripciones.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Tipo</th>
                    <th>Carrera</th>
                    <th>Grupo</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inscripciones.map(i => (
                    <tr key={i.id_inscripcion}>
                      <td><strong>{i.nombre_periodo}</strong></td>
                      <td><Badge type="info">{i.tipo_inscripcion === 'Primera_Vez' ? '1.ª vez' : 'Reinscripción'}</Badge></td>
                      <td>{i.nombre_carrera}</td>
                      <td>{i.nombre_grupo || '—'}</td>
                      <td>
                        <Badge type={i.insc_estado === 'Validada' ? 'success' : i.insc_estado === 'Pendiente' ? 'warning' : 'danger'}>
                          {i.insc_estado}
                        </Badge>
                      </td>
                      <td>{formatDate(i.fecha_inscripcion)}</td>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No tienes inscripciones registradas.</p>}
        </div>
      )}

      {!loading && activeTab === 'evaluaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><BarChart3 size={14} /> Evaluaciones</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadEvaluaciones()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {evaluaciones.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Respondiste</th>
                    <th>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map(e => (
                    <tr key={e.id_evaluacion}>
                      <td><strong>{e.titulo}</strong></td>
                      <td><Badge type="info">{(e.tipo_instrumento || '').replace(/_/g, ' ')}</Badge></td>
                      <td>{formatDate(e.fecha_inicio)}</td>
                      <td>{formatDate(e.fecha_fin)}</td>
                      <td><Badge type={e.eval_estado === 'ACTIVA' ? 'success' : 'light'}>{e.eval_estado}</Badge></td>
                      <td>{e.respondio ? <Badge type="success">Sí</Badge> : <Badge type="warning">No</Badge>}</td>
                      <td>{e.promedio_final > 0 ? Number(e.promedio_final).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No hay evaluaciones disponibles.</p>}
        </div>
      )}

      {!loading && activeTab === 'asistente' && (
        <div>
          <div className="auth-note" style={{ marginBottom: '1rem' }}>
            <div className="eyebrow"><Brain size={14} /> Asistente académico — modo alumno</div>
            <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
              Consulta sobre tu kardex, inscripciones, evaluaciones, becas y orientación académica.
            </p>
            {contexto?.rol && (
              <p style={{ margin: '0.6rem 0 0', lineHeight: 1.6 }} className="muted">
                Rol detectado: <strong>{contexto.rol}</strong>
                {contexto?.promedio ? <> · Promedio: <strong>{Number(contexto.promedio).toFixed(2)}</strong></> : null}
                {contexto?.semestre ? <> · Semestre: <strong>{contexto.semestre}°</strong></> : null}
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
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: ¿cuál es mi promedio?" disabled={chatLoading} />
            <button className="btn accent" type="submit" disabled={chatLoading || !texto.trim()}>
              {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />} Enviar
            </button>
          </form>
          <div className="row gap wrap" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cuál es mi situación académica?')}><User size={16} /> Mi situación</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cómo va mi kardex?')}><FileText size={16} /> Mi kardex</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Qué becas hay disponibles?')}><Sparkles size={16} /> Becas</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
