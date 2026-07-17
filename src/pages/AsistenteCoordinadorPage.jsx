import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Calendar, BarChart3, Activity,
  Brain, Loader2, Shield, AlertTriangle, GraduationCap,
  BookOpen, Search, RefreshCw, SendHorizonal, FileText,
  Sparkles, UserCheck, Clock, Filter, Download, Eye,
  MessageCircle, CheckCircle2, XCircle
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
  { key: 'academico', label: 'Panel académico', icon: LayoutDashboard },
  { key: 'grupos', label: 'Grupos', icon: Users },
  { key: 'periodos', label: 'Periodos', icon: Calendar },
  { key: 'reportes', label: 'Reportes', icon: BarChart3 },
  { key: 'seguimiento', label: 'Seguimiento alumnos', icon: Activity },
  { key: 'asistente', label: 'Asistente académico', icon: Brain }
];

export default function AsistenteCoordinadorPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('academico');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [dashboard, setDashboard] = React.useState(null);
  const [groups, setGroups] = React.useState([]);
  const [periods, setPeriods] = React.useState([]);
  const [tracking, setTracking] = React.useState([]);
  const [alerts, setAlerts] = React.useState([]);
  const [groupReport, setGroupReport] = React.useState(null);

  const [messages, setMessages] = React.useState([
    { role: 'bot', text: 'Hola, soy tu asistente de coordinación. Puedo ayudarte con grupos, periodos, seguimiento de alumnos, alertas y reportes académicos.' }
  ]);
  const [texto, setTexto] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const [contexto, setContexto] = React.useState(null);
  const endRef = React.useRef(null);

  const [filterGrupo, setFilterGrupo] = React.useState('');
  const [filterPeriodo, setFilterPeriodo] = React.useState('');
  const [filterEstatus, setFilterEstatus] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDashboard = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordDashboard(token);
      setDashboard(res?.data?.dashboard || null);
      setGroups(res?.data?.groups || []);
    } catch (e) {
      setError('No se pudo cargar el panel académico.');
    } finally { setLoading(false); }
  };

  const loadGroups = async (filters = {}) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordGroups(token, filters);
      setGroups(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar los grupos.');
    } finally { setLoading(false); }
  };

  const loadPeriods = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordPeriods(token);
      setPeriods(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar los periodos.');
    } finally { setLoading(false); }
  };

  const loadTracking = async (filters = {}) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordTracking(token, filters);
      setTracking(res?.data || []);
    } catch (e) {
      setError('No se pudo cargar el seguimiento.');
    } finally { setLoading(false); }
  };

  const loadAlerts = async (filters = {}) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordAlerts(token, filters);
      setAlerts(res?.data || []);
    } catch (e) {
      setError('No se pudieron cargar las alertas.');
    } finally { setLoading(false); }
  };

  const loadGroupReport = async (id_grupo) => {
    setLoading(true); setError('');
    try {
      const res = await api.asistente.coordGroupReport(token, id_grupo);
      setGroupReport(res?.data || null);
    } catch (e) {
      setError('No se pudo cargar el reporte del grupo.');
    } finally { setLoading(false); }
  };

  React.useEffect(() => {
    switch (activeTab) {
      case 'academico': loadDashboard(); break;
      case 'grupos': loadGroups(); break;
      case 'periodos': loadPeriods(); break;
      case 'seguimiento': loadTracking(); break;
      case 'reportes': loadAlerts(); break;
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
    if (filterPeriodo) filters.id_periodo = filterPeriodo;
    if (filterEstatus) filters.estatus = filterEstatus;
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
      <SectionCard title="Asistente Académico — Coordinador" subtitle="Panel de coordinación académica">
        <p className="muted">Inicia sesión para acceder.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Asistente Académico Institucional — Coordinador"
      subtitle="Panel académico, grupos, periodos, reportes, seguimiento de alumnos y asistente"
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

      {!loading && activeTab === 'academico' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><LayoutDashboard size={14} /> Panel académico — resumen general</div>
          {dashboard ? (
            <>
              <div className="row gap wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatCard icon={GraduationCap} label="Alumnos" value={dashboard.total_alumnos} color="#22c55e" />
                <StatCard icon={Users} label="Grupos abiertos" value={dashboard.total_grupos_abiertos} color="var(--primary)" />
                <StatCard icon={BookOpen} label="Docentes" value={dashboard.total_docentes} color="#f59e0b" />
                <StatCard icon={AlertTriangle} label="Alertas pendientes" value={dashboard.alertas_pendientes} color="#ef4444" />
                <StatCard icon={Activity} label="Evaluaciones activas" value={dashboard.evaluaciones_activas} color="#8b5cf6" />
              </div>
              {groups.length > 0 && (
                <div style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><Users size={14} /> Grupos recientes</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Grupo</th>
                          <th>Carrera</th>
                          <th>Semestre</th>
                          <th>Turno</th>
                          <th>Inscritos</th>
                          <th>Con promedio</th>
                          <th>Alertas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.slice(0, 10).map(g => (
                          <tr key={g.id_grupo}>
                            <td><strong>{g.nombre_grupo}</strong></td>
                            <td>{g.nombre_carrera}</td>
                            <td>{g.semestre}°</td>
                            <td>{g.turno}</td>
                            <td>{g.inscritos}</td>
                            <td>{g.con_promedio}</td>
                            <td>{g.alertas > 0 ? <Badge type="danger">{g.alertas}</Badge> : '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : <p className="muted">No hay datos del panel académico.</p>}
        </div>
      )}

      {!loading && activeTab === 'grupos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Users size={14} /> Grupos académicos</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => loadGroups()}><RefreshCw size={14} /> Recargar</button>
          </div>
          <div className="row gap wrap" style={{ marginBottom: '0.75rem' }}>
            <select className="input" style={{ flex: 1, minWidth: 150 }} value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value)}>
              <option value="">Todos los periodos</option>
              {periods.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
            </select>
            <button className="btn accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }} onClick={() => loadGroups({ id_periodo: filterPeriodo || undefined })}>
              <Filter size={14} /> Filtrar
            </button>
          </div>
          {groups.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Carrera</th>
                    <th>Semestre</th>
                    <th>Turno</th>
                    <th>Periodo</th>
                    <th>Inscritos</th>
                    <th>Con promedio</th>
                    <th>Alertas</th>
                    <th>Estado</th>
                    <th>Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id_grupo}>
                      <td><strong>{g.nombre_grupo}</strong></td>
                      <td>{g.nombre_carrera}</td>
                      <td>{g.semestre}°</td>
                      <td>{g.turno}</td>
                      <td>{g.nombre_periodo}</td>
                      <td>{g.inscritos}</td>
                      <td>{g.con_promedio}</td>
                      <td>{g.alertas > 0 ? <Badge type="danger">{g.alertas}</Badge> : '0'}</td>
                      <td><Badge type={g.estado === 'Abierto' ? 'success' : 'light'}>{g.estado}</Badge></td>
                      <td>
                        <button className="btn secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => { setActiveTab('reportes'); loadGroupReport(g.id_grupo); }}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No hay grupos registrados.</p>}
        </div>
      )}

      {!loading && activeTab === 'periodos' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}><Calendar size={14} /> Períodos académicos</div>
          {periods.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Grupos</th>
                    <th>Abiertos</th>
                    <th>Inscritos</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => (
                    <tr key={p.id_periodo}>
                      <td><strong>{p.nombre_periodo}</strong></td>
                      <td>{formatDate(p.fecha_inicio)}</td>
                      <td>{formatDate(p.fecha_fin)}</td>
                      <td><Badge type={p.estado === 'Activo' ? 'success' : p.estado === 'Cerrado' ? 'light' : 'warning'}>{p.estado}</Badge></td>
                      <td>{p.grupos_total ?? '—'}</td>
                      <td>{p.grupos_abiertos ?? '—'}</td>
                      <td>{p.inscritos_total ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No hay periodos registrados.</p>}
        </div>
      )}

      {!loading && activeTab === 'reportes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><BarChart3 size={14} /> Reportes académicos y alertas</div>
            <div className="row gap" style={{ gap: 4 }}>
              <button className="btn secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => loadAlerts()}><RefreshCw size={14} /> Recargar</button>
            </div>
          </div>

          {groupReport ? (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="eyebrow"><FileText size={14} /> Reporte del grupo {groupReport.grupo?.nombre_grupo || ''}</div>
                <div className="row gap" style={{ gap: 4 }}>
                  <button className="btn secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleExportCSV(groupReport.alumnos, `grupo_${groupReport.grupo?.nombre_grupo || 'reporte'}`)}>
                    <Download size={14} /> CSV
                  </button>
                  <button className="btn secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setGroupReport(null)}>
                    <XCircle size={14} /> Cerrar
                  </button>
                </div>
              </div>
              <div className="row gap wrap" style={{ marginBottom: '0.5rem' }}>
                <span><strong>Periodo:</strong> {groupReport.grupo?.nombre_periodo || '—'}</span>
                <span><strong>Carrera:</strong> {groupReport.grupo?.nombre_carrera || '—'}</span>
                <span><strong>Promedio grupo:</strong> {groupReport.promedio_grupo || '—'}</span>
                <span><strong>Total alumnos:</strong> {groupReport.total_alumnos || 0}</span>
              </div>
              <p><strong>Alertas por nivel:</strong> {groupReport.alertas?.length > 0
                ? groupReport.alertas.map(a => `${a.nivel_riesgo}: ${a.total}`).join(', ')
                : 'Sin alertas'}</p>
              {groupReport.alumnos.length > 0 && (
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
                      </tr>
                    </thead>
                    <tbody>
                      {groupReport.alumnos.map(a => (
                        <tr key={a.id_alumno}>
                          <td>{a.matricula}</td>
                          <td>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</td>
                          <td>{a.semestre_actual}°</td>
                          <td><Badge type={a.estatus_academico === 'Regular' ? 'success' : a.estatus_academico === 'Irregular' ? 'warning' : 'danger'}>{a.estatus_academico}</Badge></td>
                          <td>{Number(a.promedio_general).toFixed(2)}</td>
                          <td>{a.creditos_acumulados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <div style={{ padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div className="eyebrow" style={{ marginBottom: '0.5rem' }}><AlertTriangle size={14} /> Alertas de deserción y riesgo</div>
            {alerts.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Carrera</th>
                      <th>Grupo</th>
                      <th>Nivel riesgo</th>
                      <th>Puntaje</th>
                      <th>Estado</th>
                      <th>Descripción</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id_alerta}>
                        <td>{a.apellido_paterno} {a.nombres}</td>
                        <td>{a.nombre_carrera}</td>
                        <td>{a.nombre_grupo || '—'}</td>
                        <td>
                          <Badge type={a.nivel_riesgo === 'Crítico' ? 'danger' : a.nivel_riesgo === 'Alto' ? 'danger' : a.nivel_riesgo === 'Medio' ? 'warning' : 'info'}>
                            {a.nivel_riesgo}
                          </Badge>
                        </td>
                        <td>{a.puntaje_riesgo}</td>
                        <td><Badge type={a.estado_seguimiento === 'Atendida' || a.estado_seguimiento === 'Cerrada' ? 'success' : 'warning'}>{a.estado_seguimiento || (a.atendida ? 'Atendida' : 'Pendiente')}</Badge></td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</td>
                        <td>{formatDate(a.fecha_alerta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted">No hay alertas activas.</p>}
          </div>
        </div>
      )}

      {!loading && activeTab === 'seguimiento' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="eyebrow"><Activity size={14} /> Seguimiento de alumnos</div>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => { setFilterGrupo(''); setFilterPeriodo(''); setFilterEstatus(''); setSearchTerm(''); loadTracking(); }}>
              <RefreshCw size={14} /> Limpiar filtros
            </button>
          </div>
          <div className="row gap wrap" style={{ marginBottom: '0.75rem', alignItems: 'end' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Grupo</label>
              <select className="input" value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)}>
                <option value="">Todos</option>
                {groups.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Periodo</label>
              <select className="input" value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value)}>
                <option value="">Todos</option>
                {periods.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Estatus</label>
              <select className="input" value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="Regular">Regular</option>
                <option value="Irregular">Irregular</option>
                <option value="Baja_Temporal">Baja Temporal</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Buscar</label>
              <input className="input" type="text" placeholder="Nombre o matrícula" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button className="btn accent" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', marginTop: 4 }} onClick={handleFilterTracking}>
              <Search size={14} /> Buscar
            </button>
            <button className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem', marginTop: 4 }} onClick={() => handleExportCSV(tracking, 'seguimiento_alumnos')}>
              <Download size={14} /> CSV
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
                    <th>Periodo</th>
                    <th>Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.map(a => (
                    <tr key={a.id_alumno}>
                      <td>{a.matricula}</td>
                      <td>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</td>
                      <td>{a.semestre_actual}°</td>
                      <td><Badge type={a.estatus_academico === 'Regular' ? 'success' : 'warning'}>{a.estatus_academico}</Badge></td>
                      <td>{Number(a.promedio_general).toFixed(2)}</td>
                      <td>{a.creditos_acumulados}</td>
                      <td>{a.nombre_grupo || '—'}</td>
                      <td>{a.nombre_periodo || '—'}</td>
                      <td>
                        <Badge type={a.nivel_riesgo === 'Crítico' ? 'danger' : a.nivel_riesgo === 'Alto' ? 'danger' : a.nivel_riesgo === 'Medio' ? 'warning' : 'info'}>
                          {a.nivel_riesgo}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>{tracking.length} alumno(s) encontrado(s).</p>
            </div>
          ) : <p className="muted">No se encontraron alumnos con esos criterios.</p>}
        </div>
      )}

      {!loading && activeTab === 'asistente' && (
        <div>
          <div className="auth-note" style={{ marginBottom: '1rem' }}>
            <div className="eyebrow"><Brain size={14} /> Asistente académico — modo coordinación</div>
            <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
              Consulta sobre grupos, periodos, seguimiento de alumnos, alertas y reportes académicos.
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
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: ¿cuántos grupos hay?" disabled={chatLoading} />
            <button className="btn accent" type="submit" disabled={chatLoading || !texto.trim()}>
              {chatLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />} Enviar
            </button>
          </form>
          <div className="row gap wrap" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn secondary" onClick={() => quickFill('¿Cuál es el avance de los grupos?')}><Users size={16} /> Avance grupos</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('Alumnos en riesgo de deserción')}><AlertTriangle size={16} /> Alertas</button>
            <button type="button" className="btn secondary" onClick={() => quickFill('Seguimiento de alumnos por grupo')}><Activity size={16} /> Seguimiento</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
