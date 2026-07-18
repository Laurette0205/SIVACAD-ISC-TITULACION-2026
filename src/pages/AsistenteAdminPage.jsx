import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Settings, BarChart3, Users, Shield,
  MessageCircle, Brain, Loader2, Activity, Clock,
  UserCheck, BookOpen, Sparkles, AlertTriangle, CheckCircle2,
  Search, RefreshCw, SendHorizonal, FileText, Calendar,
  GraduationCap, BadgeCheck
} from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
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
  { key: 'principal', label: 'Panel principal', icon: LayoutDashboard },
  { key: 'config', label: 'Configuración general', icon: Settings },
  { key: 'analitica', label: 'Analítica institucional', icon: BarChart3 },
  { key: 'usuarios', label: 'Gestión de usuarios', icon: Users },
  { key: 'auditoria', label: 'Auditoría', icon: Shield },
  { key: 'asistente', label: 'Asistente académico', icon: Brain }
];

export default function AsistenteAdminPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('principal');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [stats, setStats] = React.useState(null);
  const [auditLog, setAuditLog] = React.useState([]);
  const [userSummary, setUserSummary] = React.useState(null);
  const [config, setConfig] = React.useState(null);

  const [messages, setMessages] = React.useState([
    { role: 'bot', text: 'Hola, soy tu asistente de administración. Puedo ayudarte con estadísticas, configuración, usuarios y auditoría del sistema.' }
  ]);
  const [texto, setTexto] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const [contexto, setContexto] = React.useState(null);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, u] = await Promise.all([
        api.asistente.adminStats(token).catch(() => null),
        api.asistente.adminUsers(token).catch(() => null)
      ]);
      setStats(s?.data || null);
      setUserSummary(u?.data || null);
    } catch (e) {
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.asistente.adminAudit(token);
      setAuditLog(res?.data || []);
    } catch (e) {
      setError('No se pudo cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.asistente.adminConfig(token);
      setConfig(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'principal') loadStats();
    else if (activeTab === 'auditoria') loadAudit();
    else if (activeTab === 'config') loadConfig();
    else if (activeTab === 'usuarios') {
      setLoading(true);
      api.asistente.adminUsers(token).then(r => setUserSummary(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
    } else if (activeTab === 'analitica') {
      setLoading(true);
      Promise.all([
        api.asistente.adminStats(token).catch(() => null),
        api.asistente.adminConfig(token).catch(() => null)
      ]).then(([s, c]) => {
        setStats(s?.data || null);
        setConfig(c?.data || null);
      }).finally(() => setLoading(false));
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
    } finally {
      setChatLoading(false);
    }
  };

  const quickFill = (t) => setTexto(t);

  if (!token) {
    return (
      <SectionCard title="Asistente Académico Administrador" subtitle="Panel de control del asistente institucional">
        <p className="muted">Inicia sesión para acceder.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Asistente Académico Institucional — Administrador"
      subtitle="Panel de control, configuración, analítica, usuarios, auditoría y asistente"
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

      {!loading && activeTab === 'principal' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><Activity size={14} /> Resumen del sistema</div>
          <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <StatCard icon={Users} label="Usuarios" value={stats?.usuarios ?? '—'} color="var(--primary)" />
            <StatCard icon={GraduationCap} label="Alumnos" value={stats?.alumnos ?? '—'} color="#22c55e" />
            <StatCard icon={BookOpen} label="Docentes" value={stats?.docentes ?? '—'} color="#f59e0b" />
            <StatCard icon={FileText} label="Materias" value={stats?.materias ?? '—'} color="#8b5cf6" />
          </div>
          {userSummary && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><UserCheck size={14} /> Distribución de usuarios</div>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                <div><span className="muted">Total:</span> <strong>{userSummary.total_usuarios || 0}</strong></div>
                <div><span className="muted">Alumnos:</span> <strong>{userSummary.total_alumnos || 0}</strong></div>
                <div><span className="muted">Docentes:</span> <strong>{userSummary.total_docentes || 0}</strong></div>
                <div><span className="muted">Administradores:</span> <strong>{userSummary.total_administradores || 0}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'config' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><Settings size={14} /> Configuración del sistema</div>
          {config?.periodos && config.periodos.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Períodos</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Ciclo</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.periodos.map(p => (
                      <tr key={p.id_periodo}>
                        <td>{p.nombre_periodo}</td>
                        <td>{p.ciclo_escolar}</td>
                        <td>{formatDate(p.fecha_inicio)}</td>
                        <td>{formatDate(p.fecha_fin)}</td>
                        <td><Badge type={p.activo ? 'success' : 'light'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {config?.carreras && config.carreras.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Carreras activas</h4>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem' }}>
                {config.carreras.map(c => (
                  <div key={c.id_carrera} style={{ padding: '0.6rem 0.8rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <strong>{c.nombre_carrera}</strong>
                    <small className="muted" style={{ display: 'block' }}>{c.clave_oficial}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!config?.periodos?.length && !config?.carreras?.length) && <p className="muted">No hay configuración disponible.</p>}
        </div>
      )}

      {!loading && activeTab === 'analitica' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><BarChart3 size={14} /> Analítica institucional</div>
          <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <StatCard icon={Users} label="Total usuarios" value={stats?.usuarios ?? '—'} color="var(--primary)" />
            <StatCard icon={GraduationCap} label="Alumnos" value={stats?.alumnos ?? '—'} color="#22c55e" />
            <StatCard icon={BookOpen} label="Docentes" value={stats?.docentes ?? '—'} color="#f59e0b" />
            <StatCard icon={FileText} label="Materias" value={stats?.materias ?? '—'} color="#8b5cf6" />
          </div>
          {config?.periodos && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><Calendar size={14} /> Períodos registrados</div>
              <p>{config.periodos.length} período(s) en el sistema.{config.periodos.find(p => p.activo) ? ` Activo: ${config.periodos.find(p => p.activo).nombre_periodo}` : ''}</p>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'usuarios' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><Users size={14} /> Gestión de usuarios</div>
          {userSummary ? (
            <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <StatCard icon={Users} label="Total" value={userSummary.total_usuarios || 0} color="var(--primary)" />
              <StatCard icon={GraduationCap} label="Alumnos" value={userSummary.total_alumnos || 0} color="#22c55e" />
              <StatCard icon={BookOpen} label="Docentes" value={userSummary.total_docentes || 0} color="#f59e0b" />
              <StatCard icon={Shield} label="Administradores" value={userSummary.total_administradores || 0} color="#ef4444" />
            </div>
          ) : <p className="muted">No se pudieron cargar los datos de usuarios.</p>}
        </div>
      )}

      {!loading && activeTab === 'auditoria' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Shield size={14} /> Registros de auditoría del asistente</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={loadAudit}>
              <RefreshCw size={14} /> Recargar
            </button>
          </div>
          {auditLog.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Intención</th>
                    <th>Herramienta</th>
                    <th>Pregunta</th>
                    <th>Permitido</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(entry => (
                    <tr key={entry.id_auditoria}>
                      <td>{entry.id_auditoria}</td>
                      <td>{entry.nombre_usuario || `ID ${entry.id_usuario}`}</td>
                      <td><Badge type="info">{entry.rol_usuario}</Badge></td>
                      <td><Badge type="warning">{entry.intencion}</Badge></td>
                      <td>{entry.herramienta || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.pregunta}</td>
                      <td><Badge type={entry.permitido ? 'success' : 'danger'}>{entry.permitido ? 'Sí' : 'No'}</Badge></td>
                      <td>{formatDate(entry.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No hay registros de auditoría.</p>
          )}
        </div>
      )}

      {!loading && activeTab === 'asistente' && (
        <div>
          <div className="auth-note" style={{ marginBottom: '1rem' }}>
            <div className="eyebrow"><Brain size={14} /> Asistente académico — modo administración</div>
            <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
              Haz consultas sobre estadísticas, configuración, usuarios o auditoría. El asistente usa la base de datos para responder.
            </p>
            {contexto?.rol && (
              <p style={{ margin: '0.6rem 0 0', lineHeight: 1.6 }} className="muted">
                Rol detectado: <strong>{contexto.rol}</strong>
              </p>
            )}
          </div>
          <div className="chat-box">
            {messages.map((msg, index) => (
              <div key={index} className={`bubble ${msg.role}`}>
                <span>{msg.text}</span>
              </div>
            ))}
            {chatLoading && (
              <div className="bubble bot" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Loader2 className="animate-spin" size={16} /> Analizando...
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form className="chat-form" onSubmit={handleSend}>
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: ¿cuántos usuarios hay?" disabled={chatLoading} />
            <button className="btn accent" type="submit" disabled={chatLoading || !texto.trim()}>
              {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />} Enviar
            </button>
          </form>
          <div className="row gap wrap" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cuántos usuarios hay en el sistema?')}><Activity size={16} /> Estadísticas</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('Muéstrame la auditoría del asistente')}><Shield size={16} /> Auditoría</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Qué configuración tiene el sistema?')}><Settings size={16} /> Configuración</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
