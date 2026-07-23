import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity, AlertTriangle, Shield, Users, Clock, Brain,
  Loader2, Server, Terminal, RefreshCw, SendHorizonal,
  Key, CheckCircle2, XCircle, FileText, Eye, Search,
  Wifi, Database, Lock, Unlock, GraduationCap, BookOpen
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
  { key: 'tecnico', label: 'Panel técnico', icon: Server },
  { key: 'incidencias', label: 'Incidencias', icon: AlertTriangle },
  { key: 'resets', label: 'Recuperación acceso', icon: Key },
  { key: 'bitacora', label: 'Bitácora', icon: FileText },
  { key: 'sesiones', label: 'Validación sesiones', icon: Users },
  { key: 'asistente', label: 'Asistente académico', icon: Brain }
];

export default function AsistenteSoportePage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('tecnico');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [dashboard, setDashboard] = React.useState(null);
  const [incidencias, setIncidencias] = React.useState([]);
  const [bitacora, setBitacora] = React.useState([]);
  const [sesiones, setSesiones] = React.useState([]);
  const [resets, setResets] = React.useState([]);

  const [messages, setMessages] = React.useState([
    { role: 'bot', text: 'Hola, soy tu asistente técnico. Puedo ayudarte con diagnóstico del sistema, incidencias, bitácora, sesiones y recuperación de acceso.' }
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
      const res = await api.asistente.sopDashboard(token);
      setDashboard(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar el panel técnico.');
    } finally { setLoading(false); }
  };

  const loadIncidencias = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.sopIncidencias(token);
      setIncidencias(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las incidencias.');
    } finally { setLoading(false); }
  };

  const loadBitacora = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.sopBitacora(token);
      setBitacora(res?.data || []);
    } catch (e) {
      setError('No se pudo cargar la bitácora.');
    } finally { setLoading(false); }
  };

  const loadSesiones = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.sopSesiones(token);
      setSesiones(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las sesiones.');
    } finally { setLoading(false); }
  };

  const loadResets = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.sopResets(token);
      setResets(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar los resets.');
    } finally { setLoading(false); }
  };

  React.useEffect(() => {
    switch (activeTab) {
      case 'tecnico': loadDashboard(); break;
      case 'incidencias': loadIncidencias(); break;
      case 'bitacora': loadBitacora(); break;
      case 'sesiones': loadSesiones(); break;
      case 'resets': loadResets(); break;
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
      <SectionCard title="Asistente Académico — Soporte" subtitle="Panel de soporte técnico">
        <p className="muted">Inicia sesión para acceder.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Asistente Académico Institucional — Soporte"
      subtitle="Panel técnico, incidencias, recuperación de acceso, bitácora, sesiones y asistente"
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

      {!loading && activeTab === 'tecnico' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><Server size={14} /> Panel técnico — estado del sistema</div>
          {dashboard ? (
            <>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatCard icon={Users} label="Usuarios totales" value={dashboard.total_usuarios} color="var(--primary)" />
                <StatCard icon={GraduationCap} label="Alumnos" value={dashboard.total_alumnos} color="#22c55e" />
                <StatCard icon={BookOpen} label="Docentes" value={dashboard.total_docentes} color="#f59e0b" />
                <StatCard icon={Users} label="Sesiones activas" value={dashboard.sesiones_activas_asistente} color="#8b5cf6" />
                <StatCard icon={FileText} label="Bitácora 24h" value={dashboard.bitacora_24h} color="#06b6d4" />
                <StatCard icon={Key} label="Resets pendientes" value={dashboard.resets_pendientes} color="#ef4444" />
              </div>
              <div style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><Terminal size={14} /> Diagnóstico rápido</div>
                <div className="row gap wrap" style={{ gap: '0.75rem' }}>
                  <div><CheckCircle2 size={16} color="#22c55e" style={{ verticalAlign: 'middle' }} /> Backend: <strong>Operativo</strong></div>
                  <div><Wifi size={16} color="#22c55e" style={{ verticalAlign: 'middle' }} /> API: <strong>Respondiendo</strong></div>
                  <div><Database size={16} color="#22c55e" style={{ verticalAlign: 'middle' }} /> Base de datos: <strong>Conectada</strong></div>
                </div>
              </div>
            </>
          ) : <p className="muted">No se pudo cargar el estado del sistema.</p>}
        </div>
      )}

      {!loading && activeTab === 'incidencias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><AlertTriangle size={14} /> Incidencias recientes (no permitidas / soporte)</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadIncidencias()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {incidencias.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
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
                  {incidencias.map(a => (
                    <tr key={a.id_auditoria}>
                      <td>{a.id_auditoria}</td>
                      <td>{a.nombre_usuario || a.id_usuario}</td>
                      <td><Badge type="info">{a.rol_usuario}</Badge></td>
                      <td><Badge type="warning">{a.intencion}</Badge></td>
                      <td>{a.herramienta || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pregunta}</td>
                      <td><Badge type={a.permitido ? 'success' : 'danger'}>{a.permitido ? 'Sí' : 'No'}</Badge></td>
                      <td>{formatDate(a.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : <p className="muted">No hay incidencias registradas.</p>}
        </div>
      )}

      {!loading && activeTab === 'bitacora' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><FileText size={14} /> Bitácora del asistente</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadBitacora()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {bitacora.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Intención</th>
                    <th>Pregunta</th>
                    <th>Permitido</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacora.map(a => (
                    <tr key={a.id_auditoria}>
                      <td>{a.id_auditoria}</td>
                      <td>{a.nombre_usuario || a.id_usuario}</td>
                      <td><Badge type="info">{a.rol_usuario}</Badge></td>
                      <td><Badge type="warning">{a.intencion}</Badge></td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pregunta}</td>
                      <td><Badge type={a.permitido ? 'success' : 'danger'}>{a.permitido ? 'Sí' : 'No'}</Badge></td>
                      <td>{formatDate(a.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : <p className="muted">No hay registros en la bitácora.</p>}
        </div>
      )}

      {!loading && activeTab === 'sesiones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Users size={14} /> Sesiones del asistente</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadSesiones()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {sesiones.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>ID sesión</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Tema</th>
                    <th>Mensajes</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {sesiones.map(s => (
                    <tr key={s.id_sesion}>
                      <td>{s.id_sesion}</td>
                      <td>{s.nombres} {s.apellido_paterno}<br /><small className="muted">{s.correo_institucional}</small></td>
                      <td><Badge type="info">{s.rol_usuario}</Badge></td>
                      <td><Badge type="warning">{s.tema_actual}</Badge></td>
                      <td>{s.total_mensajes}</td>
                      <td><Badge type={s.estado === 'ACTIVA' ? 'success' : 'light'}>{s.estado}</Badge></td>
                      <td>{formatDate(s.creado_en)}</td>
                      <td>{formatDate(s.actualizado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : <p className="muted">No hay sesiones registradas.</p>}
        </div>
      )}

      {!loading && activeTab === 'resets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Key size={14} /> Solicitudes de restablecimiento de acceso</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadResets()}><RefreshCw size={14} /> Recargar</button>
          </div>
          {resets.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <div className="table-responsive"><table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Creado</th>
                    <th>Expira</th>
                    <th>Usado</th>
                  </tr>
                </thead>
                <tbody>
                  {resets.map(r => (
                    <tr key={r.id_reseteo}>
                      <td>{r.id_reseteo}</td>
                      <td>{r.nombres} {r.apellido_paterno}</td>
                      <td><small>{r.correo_institucional}</small></td>
                      <td>{formatDate(r.created_at)}</td>
                      <td>{formatDate(r.expires_at)}</td>
                      <td><Badge type={r.used ? 'success' : 'warning'}>{r.used ? 'Usado' : 'Pendiente'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ) : <p className="muted">No hay solicitudes de restablecimiento.</p>}
        </div>
      )}

      {!loading && activeTab === 'asistente' && (
        <div>
          <div className="auth-note" style={{ marginBottom: '1rem' }}>
            <div className="eyebrow"><Brain size={14} /> Asistente académico — modo soporte</div>
            <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
              Consulta sobre el estado del sistema, incidencias, bitácora, sesiones activas y restablecimiento de acceso.
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
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: ¿cuál es el estado del sistema?" disabled={chatLoading} />
            <button className="btn accent" type="submit" disabled={chatLoading || !texto.trim()}>
              {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />} Enviar
            </button>
          </form>
          <div className="row gap wrap" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cuál es el estado del sistema?')}><Server size={16} /> Estado</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('Muéstrame incidencias recientes')}><AlertTriangle size={16} /> Incidencias</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Hay sesiones activas?')}><Users size={16} /> Sesiones</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
