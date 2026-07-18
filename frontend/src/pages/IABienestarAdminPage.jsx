import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api, canAccessBienestarAdminIA } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2,
  ClipboardList, Download, FileText, HeartPulse, LayoutDashboard,
  List, Loader2, RefreshCw, Search, Shield, TrendingUp, Users,
  XCircle, Clock, Database, FileSpreadsheet, Flag, UserCheck,
  Eye, Filter, RotateCcw, X, ArrowUpDown, GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RIESGO_COLOR = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', Critico: '#ef4444' };
const ESTADO_COLOR = { PENDIENTE: '#ef4444', EN_REVISION: '#eab308', EN_CURSO: '#eab308', ATENDIDA: '#22c55e', CERRADA: '#22c55e' };
const TIPO_ALERTA_COLOR = { RIESGO_BIENESTAR: '#eab308', CRISIS: '#ef4444', ESCALAMIENTO_MANUAL: '#f97316', CRISIS_CHAT: '#ef4444' };

function MetricCard({ icon: Icon, label, value, color = '#4F46E5', sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '0.85rem 1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: '0.75rem'
    }}>
      <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem',
      fontWeight: 600, background: `${color}15`, color
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
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
        background: '#fff', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 800,
        maxHeight: '85vh', overflow: 'auto', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          cursor: 'pointer', padding: 4
        }}><X size={20} /></button>
        {title && <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export default function IABienestarAdminPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const [resumenData, setResumenData] = useState(null);
  const [indicadoresData, setIndicadoresData] = useState(null);
  const [alertasData, setAlertasData] = useState(null);
  const [seguimientosData, setSeguimientosData] = useState(null);
  const [auditoriaData, setAuditoriaData] = useState(null);
  const [gruposRiesgo, setGruposRiesgo] = useState([]);
  const [alumnosRiesgo, setAlumnosRiesgo] = useState([]);
  const [alumnosPagination, setAlumnosPagination] = useState(null);
  const [catalogos, setCatalogos] = useState({ periodos: [], carreras: [], grupos: [] });

  const [alertasPage, setAlertasPage] = useState(1);
  const [segPage, setSegPage] = useState(1);
  const [audPage, setAudPage] = useState(1);
  const [alumnosPage, setAlumnosPage] = useState(1);

  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [periodoIndicador, setPeriodoIndicador] = useState('');

  const [detalleAlumno, setDetalleAlumno] = useState(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [segForm, setSegForm] = useState({ id_alerta: '', accion: '', observaciones: '', destino: 'Coordinación / Tutoría' });
  const [segModalOpen, setSegModalOpen] = useState(false);
  const [estadoForm, setEstadoForm] = useState({ id_alerta: '', estado: '', nivel_riesgo: '' });
  const [estadoModalOpen, setEstadoModalOpen] = useState(false);

  if (!canAccessBienestarAdminIA(user)) {
    return <Navigate to="/app" replace />;
  }

  const setLoad = (k) => (v) => setLoading(p => ({ ...p, [k]: v }));

  const fetchCatalogos = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.iaBienestarAdminCatalogosFiltros(token);
      if (r?.ok) setCatalogos(r.data);
    } catch {}
  }, [token]);

  const fetchResumen = useCallback(async () => {
    if (!token) return;
    setLoad('resumen')(true); setError(null);
    try { const r = await api.iaBienestarAdminResumen(token); if (r?.ok) setResumenData(r.data); }
    catch (e) { setError('Error al cargar resumen'); } finally { setLoad('resumen')(false); }
  }, [token]);

  const fetchIndicadores = useCallback(async () => {
    if (!token) return;
    setLoad('indicadores')(true); setError(null);
    try { const r = await api.iaBienestarAdminIndicadores(token, { periodo: periodoIndicador }); if (r?.ok) setIndicadoresData(r.data); }
    catch (e) { setError('Error al cargar indicadores'); } finally { setLoad('indicadores')(false); }
  }, [token, periodoIndicador]);

  const fetchAlertas = useCallback(async () => {
    if (!token) return;
    setLoad('alertas')(true); setError(null);
    try {
      const params = { page: alertasPage, limit: 15 };
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroTipo) params.tipo = filtroTipo;
      if (busqueda) params.q = busqueda;
      const r = await api.iaBienestarAdminAlertas(token, params);
      if (r?.ok) setAlertasData(r);
    } catch (e) { setError('Error al cargar alertas'); } finally { setLoad('alertas')(false); }
  }, [token, alertasPage, filtroEstado, filtroTipo, busqueda]);

  const fetchSeguimientos = useCallback(async () => {
    if (!token) return;
    setLoad('seguimientos')(true); setError(null);
    try {
      const params = { page: segPage, limit: 15 };
      if (filtroEstado) params.estado = filtroEstado;
      const r = await api.iaBienestarAdminSeguimientos(token, params);
      if (r?.ok) setSeguimientosData(r);
    } catch (e) { setError('Error al cargar seguimientos'); } finally { setLoad('seguimientos')(false); }
  }, [token, segPage, filtroEstado]);

  const fetchAuditoria = useCallback(async () => {
    if (!token) return;
    setLoad('auditoria')(true); setError(null);
    try { const r = await api.iaBienestarAdminAuditoria(token, { page: audPage, limit: 20 }); if (r?.ok) setAuditoriaData(r); }
    catch (e) { setError('Error al cargar auditoría'); } finally { setLoad('auditoria')(false); }
  }, [token, audPage]);

  const fetchGruposRiesgo = useCallback(async () => {
    if (!token) return;
    setLoad('grupos')(true);
    try { const r = await api.iaBienestarAdminGruposRiesgo(token); if (r?.ok) setGruposRiesgo(r.data || []); }
    catch (e) { setError('Error al cargar grupos'); } finally { setLoad('grupos')(false); }
  }, [token]);

  const fetchAlumnosRiesgo = useCallback(async () => {
    if (!token) return;
    setLoad('alumnos')(true);
    try {
      const params = { page: alumnosPage, limit: 15 };
      if (filtroGrupo) params.grupoId = filtroGrupo;
      if (filtroPeriodo) params.periodoId = filtroPeriodo;
      if (filtroCarrera) params.carreraId = filtroCarrera;
      if (filtroNivel) params.nivel_riesgo = filtroNivel;
      if (busqueda) params.q = busqueda;
      const r = await api.iaBienestarAdminAlumnosRiesgo(token, params);
      if (r?.ok) { setAlumnosRiesgo(r.data || []); setAlumnosPagination(r.pagination); }
    } catch (e) { setError('Error al cargar alumnos'); } finally { setLoad('alumnos')(false); }
  }, [token, alumnosPage, filtroGrupo, filtroPeriodo, filtroCarrera, filtroNivel, busqueda]);

  const fetchDetalle = async (id) => {
    if (!token) return;
    setLoad('detalle')(true);
    try {
      const r = await api.iaBienestarAdminDetalleAlumno(token, id);
      if (r?.ok) { setDetalleAlumno(r.data); setDetalleOpen(true); }
    } catch (e) { setError('Error al cargar detalle'); } finally { setLoad('detalle')(false); }
  };

  useEffect(() => {
    if (activeTab === 'resumen') fetchResumen();
    else if (activeTab === 'indicadores') fetchIndicadores();
    else if (activeTab === 'alertas') fetchAlertas();
    else if (activeTab === 'seguimientos') fetchSeguimientos();
    else if (activeTab === 'auditoria') fetchAuditoria();
    else if (activeTab === 'panel') { fetchGruposRiesgo(); fetchCatalogos(); }
    else if (activeTab === 'alumnos') { fetchAlumnosRiesgo(); fetchCatalogos(); }
  }, [activeTab, fetchResumen, fetchIndicadores, fetchAlertas, fetchSeguimientos, fetchAuditoria, fetchGruposRiesgo, fetchAlumnosRiesgo, fetchCatalogos]);

  const handleRegistrarSeguimiento = async (e) => {
    e.preventDefault();
    try {
      const r = await api.iaBienestarAdminRegistrarSeguimiento(token, segForm);
      if (r?.ok) {
        setSegModalOpen(false);
        setSegForm({ id_alerta: '', accion: '', observaciones: '', destino: 'Coordinación / Tutoría' });
        setError(null);
        fetchAlumnosRiesgo();
        fetchAlertas();
      }
    } catch (err) { setError('Error al registrar seguimiento'); }
  };

  const handleActualizarEstado = async (e) => {
    e.preventDefault();
    try {
      const r = await api.iaBienestarAdminActualizarEstadoAlerta(token, estadoForm);
      if (r?.ok) {
        setEstadoModalOpen(false);
        setEstadoForm({ id_alerta: '', estado: '', nivel_riesgo: '' });
        setError(null);
        fetchAlumnosRiesgo();
        fetchAlertas();
      }
    } catch (err) { setError('Error al actualizar estado'); }
  };

  const tabs = [
    { key: 'panel', label: 'Panel operativo', icon: LayoutDashboard },
    { key: 'alumnos', label: 'Alumnos en riesgo', icon: Users },
    { key: 'resumen', label: 'Resumen ejecutivo', icon: BarChart3 },
    { key: 'indicadores', label: 'Indicadores', icon: TrendingUp },
    { key: 'alertas', label: 'Alertas activas', icon: AlertTriangle },
    { key: 'seguimientos', label: 'Seguimiento', icon: ClipboardList },
    { key: 'auditoria', label: 'Auditoría', icon: Shield }
  ];

  const resetAlumnosFilters = () => {
    setFiltroGrupo(''); setFiltroPeriodo(''); setFiltroCarrera('');
    setFiltroNivel(''); setBusqueda(''); setAlumnosPage(1);
  };

  const renderPanelOperativo = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Grupos con alertas activas" subtitle="Panel operativo por grupo académico" icon={GraduationCap}>
        {loading.grupos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={28} color="#4F46E5" />
          </div>
        ) : gruposRiesgo.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {gruposRiesgo.map(g => (
              <div key={g.id_grupo} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '8px',
                border: '1px solid #f1f5f9', cursor: 'pointer'
              }} onClick={() => { setFiltroGrupo(String(g.id_grupo)); setActiveTab('alumnos'); }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{g.nombre_grupo}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{g.nombre_carrera} · {g.total_alumnos} alumnos</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <StatusBadge label={`${g.alertas_criticas} críticas`} color="#ef4444" />
                  <StatusBadge label={`${g.alertas_pendientes} pendientes`} color="#f97316" />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{g.total_alertas} total</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin grupos con alertas activas.</p>
        )}
      </SectionCard>
    </div>
  );

  const renderAlumnosRiesgo = () => {
    const niveles = ['', 'Bajo', 'Medio', 'Alto', 'Critico'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionCard title="Filtros dinámicos" icon={Filter}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroGrupo} onChange={e => { setFiltroGrupo(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
              <option value="">Todos los grupos</option>
              {catalogos.grupos.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
            </select>
            <select value={filtroPeriodo} onChange={e => { setFiltroPeriodo(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
              <option value="">Todos los periodos</option>
              {catalogos.periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
            </select>
            <select value={filtroCarrera} onChange={e => { setFiltroCarrera(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
              <option value="">Todas las carreras</option>
              {catalogos.carreras.map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
            </select>
            <select value={filtroNivel} onChange={e => { setFiltroNivel(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
              <option value="">Todos los niveles</option>
              {niveles.filter(Boolean).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setAlumnosPage(1); }}
              placeholder="Buscar alumno..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', flex: 1, minWidth: 160 }} />
            <button onClick={() => { setAlumnosPage(1); fetchAlumnosRiesgo(); }} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
              <Filter size={14} /> Filtrar
            </button>
            <button onClick={resetAlumnosFilters} className="btn ghost" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
              <RotateCcw size={14} /> Limpiar
            </button>
          </div>
        </SectionCard>

        {loading.alumnos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={28} color="#4F46E5" />
          </div>
        ) : alumnosRiesgo.length > 0 ? (
          <SectionCard title={`Alumnos en riesgo (${alumnosPagination?.total || 0})`} icon={Users}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alumnosRiesgo.map(a => (
                <div key={a.id_alerta} style={{
                  padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '8px',
                  border: a.nivel_riesgo === 'Critico' || a.nivel_riesgo === 'Crítico' || a.nivel_riesgo === 'Cr�tico' ? '1px solid #fecaca' : '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{a.nombres} {a.apellido_paterno}</strong>
                        <code style={{ fontSize: '0.72rem', color: '#64748B', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{a.matricula}</code>
                        <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr�tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                        <StatusBadge label={a.estado_alerta} color={ESTADO_COLOR[a.estado_alerta] || '#94a3b8'} />
                        <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#4F46E5'} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                        {a.nombre_carrera} · {a.nombre_grupo || 'Sin grupo'} · Sem {a.semestre_actual || '—'} · Prom: {a.promedio_general || '—'}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                        {a.descripcion}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginLeft: '0.75rem' }}>
                      <button onClick={() => fetchDetalle(a.id_alumno)} style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                        background: '#fff', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <Eye size={13} /> Revisar
                      </button>
                      <button onClick={() => { setSegForm({ ...segForm, id_alerta: a.id_alerta }); setSegModalOpen(true); }} style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                        background: '#eef2ff', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: '#4F46E5'
                      }}>
                        <UserCheck size={13} /> Seguir
                      </button>
                      <button onClick={() => { setEstadoForm({ ...estadoForm, id_alerta: a.id_alerta, estado: 'EN_REVISION' }); setEstadoModalOpen(true); }} style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                        background: '#fefce8', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: '#a16207'
                      }}>
                        <ArrowUpDown size={13} /> Prioridad
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {alumnosPagination && alumnosPagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button disabled={alumnosPage <= 1} onClick={() => setAlumnosPage(p => p - 1)}
                  style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Anterior
                </button>
                <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#64748B' }}>
                  Pág {alumnosPagination.page} de {alumnosPagination.pages}
                </span>
                <button disabled={alumnosPage >= alumnosPagination.pages} onClick={() => setAlumnosPage(p => p + 1)}
                  style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Siguiente
                </button>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No se encontraron alumnos en riesgo con los filtros actuales.</p></SectionCard>
        )}
      </div>
    );
  };

  const renderDetalleModal = () => {
    if (!detalleAlumno) return null;
    const { alumno, alertas, checkins, sesiones, evolucion } = detalleAlumno;
    return (
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)}
        title={`${alumno.nombres} ${alumno.apellido_paterno} (${alumno.matricula})`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <MetricCard icon={BookOpen} label="Carrera" value={alumno.nombre_carrera || '—'} color="#4F46E5" />
          <MetricCard icon={Users} label="Promedio" value={alumno.promedio_general || '—'} color="#22c55e" />
          <MetricCard icon={Database} label="Créditos" value={alumno.creditos_acumulados || '—'} color="#f97316" />
          <MetricCard icon={Clock} label="Semestre" value={alumno.semestre_actual || '—'} color="#eab308" />
        </div>
        {evolucion && evolucion.length > 0 && (
          <SectionCard title="Evolución del bienestar" subtitle="Progresión de scores a lo largo del tiempo" icon={TrendingUp}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {evolucion.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{new Date(e.creado_en).toLocaleDateString()}</span>
                  <StatusBadge label={e.nivel_riesgo} color={RIESGO_COLOR[e.nivel_riesgo === 'Cr�tico' ? 'Critico' : e.nivel_riesgo] || '#94a3b8'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>Score: {e.bienestar_score}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Riesgo: {e.indice_riesgo}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {alertas && alertas.length > 0 && (
          <SectionCard title="Alertas registradas" subtitle={`${alertas.length} alertas`} icon={AlertTriangle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {alertas.map(a => (
                <div key={a.id_alerta} style={{ padding: '0.4rem 0.6rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#4F46E5'} />
                      <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr�tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                      <StatusBadge label={a.estado} color={ESTADO_COLOR[a.estado] || '#94a3b8'} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(a.creado_en).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.25rem 0 0' }}>{a.descripcion}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={() => { setSegForm({ ...segForm, id_alerta: alertas?.[0]?.id_alerta || '' }); setSegModalOpen(true); }}
            className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <UserCheck size={16} /> Registrar seguimiento
          </button>
        </div>
      </Modal>
    );
  };

  const renderSegModal = () => (
    <Modal open={segModalOpen} onClose={() => setSegModalOpen(false)} title="Registrar seguimiento">
      <form onSubmit={handleRegistrarSeguimiento} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <FormField label="ID de alerta">
          <input value={segForm.id_alerta} onChange={e => setSegForm({ ...segForm, id_alerta: e.target.value })} placeholder="ID de la alerta" required />
        </FormField>
        <FormField label="Acción / Motivo">
          <textarea value={segForm.accion} onChange={e => setSegForm({ ...segForm, accion: e.target.value })} rows={2} placeholder="Describe la acción a realizar" required />
        </FormField>
        <FormField label="Destino">
          <select value={segForm.destino} onChange={e => setSegForm({ ...segForm, destino: e.target.value })}>
            <option value="Coordinación / Tutoría">Coordinación / Tutoría</option>
            <option value="Orientación psicológica">Orientación psicológica</option>
            <option value="Servicio social">Servicio social</option>
            <option value="Dirección de carrera">Dirección de carrera</option>
            <option value="Bienestar universitario">Bienestar universitario</option>
          </select>
        </FormField>
        <FormField label="Observaciones">
          <textarea value={segForm.observaciones} onChange={e => setSegForm({ ...segForm, observaciones: e.target.value })} rows={2} placeholder="Observaciones adicionales" />
        </FormField>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setSegModalOpen(false)} className="btn ghost" style={{ padding: '0.4rem 1rem' }}>Cancelar</button>
          <button type="submit" className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserCheck size={16} /> Guardar seguimiento</button>
        </div>
      </form>
    </Modal>
  );

  const renderEstadoModal = () => (
    <Modal open={estadoModalOpen} onClose={() => setEstadoModalOpen(false)} title="Actualizar estado de alerta">
      <form onSubmit={handleActualizarEstado} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <FormField label="ID de alerta">
          <input value={estadoForm.id_alerta} onChange={e => setEstadoForm({ ...estadoForm, id_alerta: e.target.value })} placeholder="ID de la alerta" required />
        </FormField>
        <FormField label="Nuevo estado">
          <select value={estadoForm.estado} onChange={e => setEstadoForm({ ...estadoForm, estado: e.target.value })} required>
            <option value="">Seleccionar...</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="ATENDIDA">Atendida</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </FormField>
        <FormField label="Reasignar prioridad (opcional)">
          <select value={estadoForm.nivel_riesgo} onChange={e => setEstadoForm({ ...estadoForm, nivel_riesgo: e.target.value })}>
            <option value="">Sin cambio</option>
            <option value="Bajo">Bajo</option>
            <option value="Medio">Medio</option>
            <option value="Alto">Alto</option>
            <option value="Critico">Crítico</option>
          </select>
        </FormField>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setEstadoModalOpen(false)} className="btn ghost" style={{ padding: '0.4rem 1rem' }}>Cancelar</button>
          <button type="submit" className="btn accent" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={16} /> Actualizar</button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            <HeartPulse size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#4F46E5' }} />
            Supervisión IA de Acompañamiento
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Panel de coordinación operativa — grupos, alumnos en riesgo, seguimiento y alertas activas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => { window.location.reload(); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem',
            background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500
          }}>
            <RefreshCw size={16} /> Refrescar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? '#4F46E5' : '#64748B',
            borderBottom: activeTab === t.key ? '2px solid #4F46E5' : '2px solid transparent',
            marginBottom: '-2px'
          }}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
        </div>
      )}

      {activeTab === 'panel' && renderPanelOperativo()}
      {activeTab === 'alumnos' && renderAlumnosRiesgo()}

      {/* ═══ RESUMEN EJECUTIVO (sin cambios) ═══ */}
      {activeTab === 'resumen' && (
        loading.resumen ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} color="#4F46E5" />
          </div>
        ) : resumenData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              <MetricCard icon={Users} label="Usuarios únicos" value={resumenData.sesiones?.usuarios_unicos || 0} color="#4F46E5" sub={`${resumenData.sesiones?.activas || 0} sesiones activas`} />
              <MetricCard icon={Activity} label="Check-ins" value={resumenData.checkins?.total || 0} color="#22c55e" sub={`Score prom: ${resumenData.promedios?.bienestar_score || '—'}`} />
              <MetricCard icon={AlertTriangle} label="Alertas" value={resumenData.alertas?.total || 0} color="#f97316" sub={`${resumenData.alertas?.pendientes || 0} pendientes`} />
              <MetricCard icon={ClipboardList} label="Derivaciones" value={resumenData.derivaciones?.total || 0} color="#eab308" sub={`${resumenData.derivaciones?.pendientes || 0} pendientes`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <SectionCard title="Distribución por nivel de riesgo" icon={BarChart3}>
                {resumenData.alertas?.distribucion_riesgo && Object.keys(resumenData.alertas.distribucion_riesgo).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(resumenData.alertas.distribucion_riesgo).map(([nivel, total]) => {
                      const key = nivel === 'Critico' || nivel === 'Crítico' || nivel === 'Cr�tico' ? 'Critico' : nivel;
                      const color = RIESGO_COLOR[key] || '#94a3b8';
                      return (
                        <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 60, fontSize: '0.78rem', fontWeight: 600, color }}>{key}</span>
                          <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (total / Math.max(1, resumenData.alertas.total)) * 100)}%`, background: color, borderRadius: '4px' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A', width: 40, textAlign: 'right' }}>{total}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>Sin datos</p>}
              </SectionCard>
              <SectionCard title="Distribución por tipo de alerta" icon={Activity}>
                {resumenData.alertas?.distribucion_tipo && Object.keys(resumenData.alertas.distribucion_tipo).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(resumenData.alertas.distribucion_tipo).map(([tipo, total]) => (
                      <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: '#f8fafc', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#334155' }}>{tipo}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{total}</span>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>Sin datos</p>}
              </SectionCard>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <MetricCard icon={BookOpen} label="Sesiones totales" value={resumenData.sesiones?.total || 0} color="#4F46E5" />
              <MetricCard icon={Database} label="Índice de riesgo promedio" value={resumenData.promedios?.indice_riesgo || '—'} color="#eab308" />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}><p>Cargando información del módulo...</p></div>
        )
      )}

      {/* ═══ INDICADORES ═══ */}
      {activeTab === 'indicadores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionCard title="Filtro temporal" icon={Clock}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[{ value: '', label: 'Todo' }, { value: '7d', label: 'Últimos 7 días' }, { value: '30d', label: 'Últimos 30 días' }, { value: '90d', label: 'Últimos 90 días' }].map(p => (
                <button key={p.value} onClick={() => setPeriodoIndicador(p.value)} style={{
                  padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem',
                  border: periodoIndicador === p.value ? '2px solid #4F46E5' : '1px solid #e2e8f0',
                  background: periodoIndicador === p.value ? '#eef2ff' : '#fff',
                  color: periodoIndicador === p.value ? '#4F46E5' : '#64748B',
                  cursor: 'pointer', fontWeight: periodoIndicador === p.value ? 600 : 400
                }}>{p.label}</button>
              ))}
            </div>
          </SectionCard>
          {loading.indicadores ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
          ) : indicadoresData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <MetricCard icon={BarChart3} label="Check-ins analizados" value={indicadoresData.total_checkins} color="#4F46E5" sub={`Período: ${indicadoresData.periodo}`} />
                {indicadoresData.por_nivel?.map(n => (
                  <MetricCard key={n.nivel} icon={AlertTriangle} label={`Nivel ${n.nivel}`} value={n.total} color={RIESGO_COLOR[n.nivel] || '#94a3b8'} sub={`${n.porcentaje}% del total`} />
                ))}
              </div>
              {indicadoresData.dimensiones_promedio && Object.keys(indicadoresData.dimensiones_promedio).length > 0 && (
                <SectionCard title="Dimensiones promedio" icon={BarChart3}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                    {Object.entries(indicadoresData.dimensiones_promedio).map(([dim, val]) => (
                      <div key={dim} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748B', textTransform: 'capitalize', marginBottom: '0.15rem' }}>{dim.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: val >= 7 ? '#22c55e' : val >= 4 ? '#eab308' : '#ef4444' }}>{val}</div>
                        <div style={{ height: 4, background: '#f1f5f9', borderRadius: '2px', marginTop: '0.25rem', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(val / 10) * 100}%`, background: val >= 7 ? '#22c55e' : val >= 4 ? '#eab308' : '#ef4444', borderRadius: '2px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}><p>Selecciona un período para cargar los indicadores.</p></div>
          )}
        </div>
      )}

      {/* ═══ ALERTAS ACTIVAS ═══ */}
      {activeTab === 'alertas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionCard title="Filtros" icon={Search}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setAlertasPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_REVISION">En revisión</option>
                <option value="ATENDIDA">Atendida</option>
                <option value="CERRADA">Cerrada</option>
              </select>
              <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setAlertasPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
                <option value="">Todos los tipos</option>
                <option value="RIESGO_BIENESTAR">Riesgo bienestar</option>
                <option value="CRISIS">Crisis</option>
                <option value="ESCALAMIENTO_MANUAL">Escalamiento manual</option>
              </select>
              <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setAlertasPage(1); }} placeholder="Buscar usuario..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', flex: 1, minWidth: 180 }} />
            </div>
          </SectionCard>
          {loading.alertas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
          ) : alertasData?.data?.length > 0 ? (
            <SectionCard title={`Alertas (${alertasData.pagination?.total || 0})`} icon={AlertTriangle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {alertasData.data.map(a => (
                  <div key={a.id_alerta} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: a.nivel_riesgo === 'Crítico' || a.nivel_riesgo === 'Cr�tico' ? '1px solid #fecaca' : '1px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#eab308'} />
                        <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr�tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                        <StatusBadge label={a.estado} color={ESTADO_COLOR[a.estado] || '#94a3b8'} />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(a.creado_en).toLocaleString()}</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748B' }}>{a.nombres} {a.apellido_paterno} ({a.correo_institucional})</div>
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{a.descripcion}</p>
                    {a.accion_sugerida && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.15rem 0 0' }}><strong>Sugerencia:</strong> {a.accion_sugerida}</p>}
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                      <button onClick={() => { setSegForm({ ...segForm, id_alerta: String(a.id_alerta) }); setSegModalOpen(true); }}
                        style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#eef2ff', cursor: 'pointer', fontSize: '0.7rem', color: '#4F46E5' }}>
                        Seguimiento
                      </button>
                      <button onClick={() => { setEstadoForm({ id_alerta: String(a.id_alerta), estado: 'ATENDIDA', nivel_riesgo: '' }); handleActualizarEstado({ preventDefault: () => {} }); }}
                        style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', fontSize: '0.7rem', color: '#16a34a' }}>
                        Atender
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {alertasData.pagination && alertasData.pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button disabled={alertasPage <= 1} onClick={() => setAlertasPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                  <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#64748B' }}>Pág {alertasData.pagination.page} de {alertasData.pagination.pages}</span>
                  <button disabled={alertasPage >= alertasData.pagination.pages} onClick={() => setAlertasPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No se encontraron alertas.</p></SectionCard>
          )}
        </div>
      )}

      {/* ═══ SEGUIMIENTO ═══ */}
      {activeTab === 'seguimientos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionCard title="Filtro de estado" icon={Search}>
            <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setSegPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', background: '#fff' }}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </SectionCard>
          {loading.seguimientos ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
          ) : seguimientosData?.data?.length > 0 ? (
            <SectionCard title={`Derivaciones (${seguimientosData.pagination?.total || 0})`} icon={ClipboardList}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {seguimientosData.data.map(d => (
                  <div key={d.id_derivacion} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <StatusBadge label={d.estado} color={d.estado === 'CERRADA' ? '#22c55e' : d.estado === 'EN_CURSO' ? '#eab308' : '#ef4444'} />
                        {d.tipo_alerta && <StatusBadge label={d.tipo_alerta} color="#4F46E5" />}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(d.creado_en).toLocaleString()}</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748B' }}>{d.nombres} {d.apellido_paterno}</div>
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.25rem 0 0' }}><strong>Destino:</strong> {d.destino}</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.15rem 0 0' }}>{d.motivo}</p>
                  </div>
                ))}
              </div>
              {seguimientosData.pagination && seguimientosData.pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button disabled={segPage <= 1} onClick={() => setSegPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                  <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#64748B' }}>Pág {seguimientosData.pagination.page} de {seguimientosData.pagination.pages}</span>
                  <button disabled={segPage >= seguimientosData.pagination.pages} onClick={() => setSegPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay seguimientos registrados.</p></SectionCard>
          )}
        </div>
      )}

      {/* ═══ AUDITORÍA ═══ */}
      {activeTab === 'auditoria' && (
        loading.auditoria ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
        ) : auditoriaData?.data?.length > 0 ? (
          <SectionCard title={`Registro de auditoría (${auditoriaData.pagination?.total || 0})`} icon={Shield}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {auditoriaData.data.map(a => (
                <div key={a.id_auditoria} style={{ padding: '0.45rem 0.7rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.8rem' }}>{a.accion}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(a.creado_en).toLocaleString()}</span>
                  </div>
                  {a.detalle && <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.15rem' }}>{a.detalle}</div>}
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>{a.nombres ? `${a.nombres} ${a.apellido_paterno || ''}` : 'Sistema'}</div>
                </div>
              ))}
            </div>
            {auditoriaData.pagination && auditoriaData.pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button disabled={audPage <= 1} onClick={() => setAudPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#64748B' }}>Pág {auditoriaData.pagination.page} de {auditoriaData.pagination.pages}</span>
                <button disabled={audPage >= auditoriaData.pagination.pages} onClick={() => setAudPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay registros de auditoría.</p></SectionCard>
        )
      )}

      {renderDetalleModal()}
      {renderSegModal()}
      {renderEstadoModal()}
    </div>
  );
}
