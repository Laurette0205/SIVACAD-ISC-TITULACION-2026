import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api, canAccessBienestarAdminIA } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2,
  ClipboardList, Clock, Download, Eye, FileCheck, FileText,
  Filter, GraduationCap, HeartPulse, LayoutDashboard, List,
  Loader2, MessageSquare, Phone, RefreshCw, RotateCcw, Search,
  Shield, TrendingUp, UserCheck, Users, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RIESGO_COLOR = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', Critico: '#ef4444' };
const ESTADO_COLOR = { PENDIENTE: '#ef4444', EN_REVISION: '#eab308', EN_CURSO: '#eab308', ATENDIDA: '#22c55e', CERRADA: '#22c55e' };
const TIPO_ALERTA_COLOR = { RIESGO_BIENESTAR: '#eab308', CRISIS: '#ef4444', ESCALAMIENTO_MANUAL: '#f97316', CRISIS_CHAT: '#ef4444' };

function MetricCard({ icon: Icon, label, value, color = '#4F46E5', sub }) {
  return (
    <div style={{
      background: 'var(--surface-card, #fff)', borderRadius: '12px', padding: '0.85rem 1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '1px solid var(--line, #f1f5f9)',
      display: 'flex', alignItems: 'center', gap: '0.75rem'
    }}>
      <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted, #64748B)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading, #0F172A)' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.68rem', color: 'var(--muted, #94a3b8)' }}>{sub}</div>}
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

function ModuleCard({ icon: Icon, title, description, status, statusColor, stats, color, onClick, active, actions }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface-card, #fff)', borderRadius: '14px', padding: '1rem',
        border: active ? `2px solid ${color}` : '1px solid var(--line, #f1f5f9)',
        cursor: 'pointer', transition: 'all 0.2s ease',
        boxShadow: active ? `0 4px 16px ${color}20` : '0 1px 3px rgba(0,0,0,.04)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
            <Icon size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-heading, #0F172A)' }}>{title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)' }}>{description}</div>
          </div>
        </div>
        {status && <StatusBadge label={status} color={statusColor || '#22c55e'} />}
      </div>
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-heading, #0F172A)' }}>{s.value}</span> {s.label}
            </div>
          ))}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {actions.map((a, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); a.onClick(); }}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4, color: a.color || '#4F46E5' }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      )}
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
        background: 'var(--surface-card, #fff)', borderRadius: 16, padding: '1.5rem', width: '90%', maxWidth: 800,
        maxHeight: '85vh', overflow: 'auto', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          cursor: 'pointer', padding: 4, color: 'var(--muted, #64748B)'
        }}><X size={20} /></button>
        {title && <h2 style={{ marginTop: 0, fontSize: '1.2rem', color: 'var(--text-heading, #0F172A)' }}>{title}</h2>}
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
  const [catalogos, setCatalogos] = useState({ periodos: [], carreras: [], grupos: [], plantillas: [], preguntas: [], recursos: [], preguntas_por_plantilla: {} });

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
  const [recursoBusqueda, setRecursoBusqueda] = useState('');
  const [recursoFiltro, setRecursoFiltro] = useState('');

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
      if (r?.ok) setCatalogos(prev => ({ ...prev, ...r.data }));
    } catch {}
  }, [token]);

  const fetchCatalogosBienestar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.iaBienestarCatalogos(token);
      if (r?.ok) setCatalogos(prev => ({
        ...prev,
        plantillas: r.data?.plantillas || [],
        preguntas: r.data?.preguntas || [],
        recursos: r.data?.recursos || [],
        preguntas_por_plantilla: r.data?.preguntas_por_plantilla || {}
      }));
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
    if (activeTab === 'panel') { fetchResumen(); fetchGruposRiesgo(); fetchCatalogos(); fetchCatalogosBienestar(); }
    else if (activeTab === 'chequeo') { fetchResumen(); fetchCatalogosBienestar(); }
    else if (activeTab === 'recursos') { fetchCatalogosBienestar(); }
    else if (activeTab === 'chat') { fetchResumen(); }
    else if (activeTab === 'indicadores') fetchIndicadores();
    else if (activeTab === 'alertas') { fetchAlertas(); fetchCatalogos(); }
    else if (activeTab === 'historial') { fetchSeguimientos(); fetchAuditoria(); }
    else if (activeTab === 'alumnos') { fetchAlumnosRiesgo(); fetchCatalogos(); }
  }, [activeTab, fetchResumen, fetchIndicadores, fetchAlertas, fetchSeguimientos, fetchAuditoria, fetchGruposRiesgo, fetchAlumnosRiesgo, fetchCatalogos, fetchCatalogosBienestar]);

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
    { key: 'panel', label: 'Panel general', icon: LayoutDashboard },
    { key: 'chequeo', label: 'Chequeo guiado', icon: FileCheck },
    { key: 'recursos', label: 'Tutoriales y recursos', icon: BookOpen },
    { key: 'chat', label: 'Chat de apoyo', icon: MessageSquare },
    { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { key: 'historial', label: 'Historial', icon: ClipboardList },
    { key: 'alumnos', label: 'Alumnos en riesgo', icon: Users }
  ];

  const resetAlumnosFilters = () => {
    setFiltroGrupo(''); setFiltroPeriodo(''); setFiltroCarrera('');
    setFiltroNivel(''); setBusqueda(''); setAlumnosPage(1);
  };

  /* ═══════════════════════════════════════════
     PANEL GENERAL — Dashboard overview
  ═══════════════════════════════════════════ */
  const renderPanelGeneral = () => {
    const totalCheckins = resumenData?.checkins?.total || 0;
    const totalAlertas = resumenData?.alertas?.total || 0;
    const alertasPendientes = resumenData?.alertas?.pendientes || 0;
    const totalRecursos = catalogos.recursos?.length || 0;
    const sesionesActivas = resumenData?.sesiones?.activas || 0;
    const totalDerivaciones = resumenData?.derivaciones?.total || 0;

    const chequeoStatus = totalCheckins > 0 ? 'Activo' : 'Sin actividad';
    const chequeoColor = totalCheckins > 0 ? '#22c55e' : '#94a3b8';
    const recursosStatus = totalRecursos > 0 ? `${totalRecursos} disponibles` : 'Sin recursos';
    const recursosColor = totalRecursos > 0 ? '#4F46E5' : '#94a3b8';
    const chatStatus = sesionesActivas > 0 ? 'En uso' : 'Disponible';
    const chatColor = sesionesActivas > 0 ? '#8b5cf6' : '#22c55e';
    const alertasStatus = alertasPendientes > 0 ? `${alertasPendientes} pendientes` : 'Al día';
    const alertasColor = alertasPendientes > 0 ? '#f97316' : '#22c55e';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <SectionCard title="Módulos de acompañamiento" subtitle="Estado general del sistema — selecciona un módulo para supervisar" icon={LayoutDashboard}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
            <ModuleCard
              icon={FileCheck} title="Chequeo guiado"
              description="Evaluaciones progresivas de bienestar estudiantil"
              status={chequeoStatus} statusColor={chequeoColor}
              color="#22c55e"
              stats={[
                { value: totalCheckins, label: 'realizados' },
                { value: sesionesActivas, label: 'sesiones activas' },
                { value: catalogos.plantillas?.length || 0, label: 'plantillas' }
              ]}
              onClick={() => setActiveTab('chequeo')}
              active={activeTab === 'chequeo'}
              actions={[
                { label: 'Supervisar', icon: <Eye size={12} />, onClick: () => setActiveTab('chequeo'), color: '#22c55e' }
              ]}
            />
            <ModuleCard
              icon={BookOpen} title="Tutoriales y recursos"
              description="Biblioteca de apoyo para acompañamiento"
              status={recursosStatus} statusColor={recursosColor}
              color="#4F46E5"
              stats={[
                { value: totalRecursos, label: 'recursos' },
                { value: catalogos.recursos?.filter(r => r.tipo === 'TUTORIAL')?.length || 0, label: 'tutoriales' },
                { value: catalogos.recursos?.filter(r => r.tipo === 'CONTACTO_CRISIS')?.length || 0, label: 'contactos crisis' }
              ]}
              onClick={() => setActiveTab('recursos')}
              active={activeTab === 'recursos'}
              actions={[
                { label: 'Ver recursos', icon: <BookOpen size={12} />, onClick: () => setActiveTab('recursos'), color: '#4F46E5' }
              ]}
            />
            <ModuleCard
              icon={MessageSquare} title="Chat de apoyo"
              description="Asistente conversacional de bienestar"
              status={chatStatus} statusColor={chatColor}
              color="#8b5cf6"
              stats={[
                { value: sesionesActivas, label: 'conversaciones activas' },
                { value: resumenData?.sesiones?.usuarios_unicos || 0, label: 'usuarios atendidos' },
                { value: resumenData?.alertas?.distribucion_tipo?.CRISIS_CHAT || 0, label: 'alertas de chat' }
              ]}
              onClick={() => setActiveTab('chat')}
              active={activeTab === 'chat'}
              actions={[
                { label: 'Monitorear', icon: <Activity size={12} />, onClick: () => setActiveTab('chat'), color: '#8b5cf6' }
              ]}
            />
            <ModuleCard
              icon={AlertTriangle} title="Historial y alertas"
              description="Seguimiento, derivaciones y registro de actividad"
              status={alertasStatus} statusColor={alertasColor}
              color="#f97316"
              stats={[
                { value: totalAlertas, label: 'alertas totales' },
                { value: alertasPendientes, label: 'pendientes' },
                { value: totalDerivaciones, label: 'derivaciones' }
              ]}
              onClick={() => setActiveTab('alertas')}
              active={activeTab === 'alertas'}
              actions={[
                { label: 'Alertas', icon: <AlertTriangle size={12} />, onClick: () => setActiveTab('alertas'), color: '#f97316' },
                { label: 'Historial', icon: <ClipboardList size={12} />, onClick: () => setActiveTab('historial'), color: '#eab308' }
              ]}
            />
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          <MetricCard icon={Users} label="Usuarios únicos" value={resumenData?.sesiones?.usuarios_unicos || 0} color="#4F46E5" sub={`${sesionesActivas} sesiones activas`} />
          <MetricCard icon={Activity} label="Check-ins totales" value={totalCheckins} color="#22c55e" sub={`Score prom: ${resumenData?.promedios?.bienestar_score || '—'}`} />
          <MetricCard icon={AlertTriangle} label="Alertas" value={totalAlertas} color="#f97316" sub={`${alertasPendientes} pendientes`} />
          <MetricCard icon={ClipboardList} label="Derivaciones" value={totalDerivaciones} color="#eab308" sub={`${resumenData?.derivaciones?.pendientes || 0} pendientes`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <SectionCard title="Grupos con alertas activas" icon={GraduationCap}>
            {loading.grupos ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
            ) : gruposRiesgo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gruposRiesgo.slice(0, 5).map(g => (
                  <div key={g.id_grupo} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.7rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '8px',
                    border: '1px solid var(--line, #f1f5f9)', cursor: 'pointer'
                  }} onClick={() => { setFiltroGrupo(String(g.id_grupo)); setActiveTab('alumnos'); }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-heading, #0F172A)' }}>{g.nombre_grupo}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)' }}>{g.nombre_carrera} · {g.total_alumnos} alumnos</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <StatusBadge label={`${g.alertas_criticas} críticas`} color="#ef4444" />
                      <StatusBadge label={`${g.alertas_pendientes} pendientes`} color="#f97316" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted, #94a3b8)' }}>Sin grupos con alertas activas.</p>
            )}
          </SectionCard>

          <SectionCard title="Distribución por nivel de riesgo" icon={BarChart3}>
            {resumenData?.alertas?.distribucion_riesgo && Object.keys(resumenData.alertas.distribucion_riesgo).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(resumenData.alertas.distribucion_riesgo).map(([nivel, total]) => {
                  const key = nivel === 'Critico' || nivel === 'Crítico' || nivel === 'Cr?tico' ? 'Critico' : nivel;
                  const color = RIESGO_COLOR[key] || '#94a3b8';
                  return (
                    <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 60, fontSize: '0.78rem', fontWeight: 600, color }}>{key}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--line, #f1f5f9)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (total / Math.max(1, resumenData.alertas.total)) * 100)}%`, background: color, borderRadius: '4px' }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-heading, #0F172A)', width: 40, textAlign: 'right' }}>{total}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p style={{ color: 'var(--muted, #94a3b8)', textAlign: 'center', padding: '1rem' }}>Sin datos de distribución</p>}
          </SectionCard>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     CHEQUEO GUIADO — Supervisión de actividad
  ═══════════════════════════════════════════ */
  const renderChequeoGuiado = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Chequeo guiado" subtitle="Evaluaciones progresivas de bienestar estudiantil" icon={FileCheck}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          <MetricCard icon={Activity} label="Check-ins realizados" value={resumenData?.checkins?.total || 0} color="#22c55e" />
          <MetricCard icon={HeartPulse} label="Score promedio" value={resumenData?.promedios?.bienestar_score || '—'} color="#4F46E5" sub="Bienestar general" />
          <MetricCard icon={AlertTriangle} label="Con riesgo alto/crítico" value={(resumenData?.alertas?.por_nivel?.find(n => n.nivel === 'Alto')?.total || 0) + (resumenData?.alertas?.por_nivel?.find(n => n.nivel === 'Critico')?.total || 0)} color="#ef4444" sub="Requieren seguimiento" />
          <MetricCard icon={Users} label="Sesiones activas" value={resumenData?.sesiones?.activas || 0} color="#8b5cf6" sub="Estudiantes en proceso" />
        </div>
      </SectionCard>

      <SectionCard title="Plantillas de evaluación" subtitle="Tipos de chequeo disponibles" icon={ClipboardList}>
        {loading.resumen ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
        ) : catalogos.plantillas?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {catalogos.plantillas.map(p => {
              const preguntasCount = catalogos.preguntas_por_plantilla?.[p.id_plantilla]?.length || 0;
              return (
                <div key={p.id_plantilla} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.8rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '8px',
                  border: '1px solid var(--line, #f1f5f9)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-heading, #0F172A)' }}>{p.nombre_plantilla}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)' }}>{p.descripcion || 'Sin descripción'}</div>
                  </div>
                  <StatusBadge label={`${preguntasCount} preguntas`} color="#4F46E5" />
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted, #94a3b8)' }}>No hay plantillas configuradas.</p>
        )}
      </SectionCard>

      <SectionCard title="Dimensiones evaluadas" subtitle="9 dimensiones del bienestar" icon={BarChart3}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
          {['ánimo', 'energía', 'sueño', 'estrés', 'carga_academica', 'carga_laboral', 'apoyo', 'ambiente', 'enfoque'].map(dim => (
            <div key={dim} style={{ padding: '0.5rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)', textTransform: 'capitalize', marginBottom: '0.15rem' }}>{dim.replace(/_/g, ' ')}</div>
              {resumenData?.promedios?.dimensiones?.[dim] != null ? (
                <>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: resumenData.promedios.dimensiones[dim] >= 7 ? '#22c55e' : resumenData.promedios.dimensiones[dim] >= 4 ? '#eab308' : '#ef4444' }}>
                    {resumenData.promedios.dimensiones[dim]}
                  </div>
                  <div style={{ height: 4, background: 'var(--line, #f1f5f9)', borderRadius: '2px', marginTop: '0.25rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(resumenData.promedios.dimensiones[dim] / 10) * 100}%`, background: resumenData.promedios.dimensiones[dim] >= 7 ? '#22c55e' : resumenData.promedios.dimensiones[dim] >= 4 ? '#eab308' : '#ef4444', borderRadius: '2px' }} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #94a3b8)' }}>—</div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  /* ═══════════════════════════════════════════
     TUTORIALES Y RECURSOS — Biblioteca
  ═══════════════════════════════════════════ */
  const renderRecursos = () => {
    const recursos = catalogos.recursos || [];
    const filtrados = recursos.filter(r => {
      if (recursoFiltro && r.tipo !== recursoFiltro) return false;
      if (recursoBusqueda) {
        const q = recursoBusqueda.toLowerCase();
        return (r.titulo || '').toLowerCase().includes(q) || (r.descripcion || '').toLowerCase().includes(q) || (r.categoria || '').toLowerCase().includes(q);
      }
      return true;
    });

    const tipos = [...new Set(recursos.map(r => r.tipo).filter(Boolean))];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionCard title="Tutoriales y recursos" subtitle={`${recursos.length} recursos disponibles para acompañamiento estudiantil`} icon={BookOpen}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <MetricCard icon={BookOpen} label="Total recursos" value={recursos.length} color="#4F46E5" />
            <MetricCard icon={FileText} label="Tutoriales" value={recursos.filter(r => r.tipo === 'TUTORIAL').length} color="#22c55e" />
            <MetricCard icon={Activity} label="Ejercicios" value={recursos.filter(r => r.tipo === 'EJERCICIO').length} color="#8b5cf6" />
            <MetricCard icon={Phone} label="Contactos de crisis" value={recursos.filter(r => r.tipo === 'CONTACTO_CRISIS').length} color="#ef4444" />
          </div>
        </SectionCard>

        <SectionCard title="Buscar y filtrar" icon={Filter}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={recursoFiltro} onChange={e => setRecursoFiltro(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={recursoBusqueda} onChange={e => setRecursoBusqueda(e.target.value)}
              placeholder="Buscar por título, descripción o categoría..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', flex: 1, minWidth: 200, background: 'var(--surface-input, #fff)', color: 'var(--text, #0F172A)' }} />
          </div>
        </SectionCard>

        {loading.catalogos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
        ) : filtrados.length > 0 ? (
          <SectionCard title={`Recursos encontrados (${filtrados.length})`} icon={List}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtrados.map(r => (
                <div key={r.id_recurso} style={{
                  padding: '0.7rem 0.85rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '10px',
                  border: '1px solid var(--line, #f1f5f9)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-heading, #0F172A)' }}>{r.titulo || 'Sin título'}</strong>
                        <StatusBadge label={r.tipo} color={r.tipo === 'TUTORIAL' ? '#22c55e' : r.tipo === 'EJERCICIO' ? '#8b5cf6' : r.tipo === 'CONTACTO_CRISIS' ? '#ef4444' : '#4F46E5'} />
                        {r.categoria && <StatusBadge label={r.categoria} color="#64748B" />}
                      </div>
                      {r.descripcion && <p style={{ fontSize: '0.78rem', color: 'var(--muted, #64748B)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{r.descripcion}</p>}
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--muted, #94a3b8)' }}>
                        {r.prioridad && <span>Prioridad: <strong>{r.prioridad}</strong></span>}
                        {r.fecha_actualizacion && <span>Actualizado: {new Date(r.fecha_actualizacion).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.75rem', flexShrink: 0 }}>
                      {r.url_recurso && (
                        <a href={r.url_recurso} target="_blank" rel="noopener noreferrer"
                          style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', fontSize: '0.72rem', color: '#4F46E5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={13} /> Abrir
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted, #94a3b8)' }}>
            {recursos.length === 0 ? 'No hay recursos registrados en el sistema.' : 'No se encontraron recursos con los filtros actuales.'}
          </p></SectionCard>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     CHAT DE APOYO — Monitoreo del servicio
  ═══════════════════════════════════════════ */
  const renderChat = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Chat de apoyo" subtitle="Monitoreo del asistente conversacional de bienestar" icon={MessageSquare}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          <MetricCard icon={MessageSquare} label="Sesiones activas" value={resumenData?.sesiones?.activas || 0} color="#8b5cf6" sub="Conversaciones en curso" />
          <MetricCard icon={Users} label="Usuarios atendidos" value={resumenData?.sesiones?.usuarios_unicos || 0} color="#4F46E5" sub="Alumnos únicos" />
          <MetricCard icon={Activity} label="Mensajes totales" value={resumenData?.checkins?.total || 0} color="#22c55e" sub="Interacciones registradas" />
          <MetricCard icon={AlertTriangle} label="Alertas de chat" value={(resumenData?.alertas?.distribucion_tipo?.CRISIS_CHAT || 0)} color="#ef4444" sub="Crisis detectadas en chat" />
        </div>
      </SectionCard>

      <SectionCard title="Información del servicio" icon={LayoutDashboard}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--line, #f1f5f9)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body, #334155)' }}>Motor de IA</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading, #0F172A)' }}>Google Gemini (gemini-2.5-flash)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--line, #f1f5f9)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body, #334155)' }}>Detección de crisis</span>
            <StatusBadge label="Activa" color="#22c55e" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--line, #f1f5f9)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body, #334155)' }}>Respuesta offline</span>
            <StatusBadge label="Disponible" color="#22c55e" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--line, #f1f5f9)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body, #334155)' }}>Línea de crisis</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>Línea de la Vida: 800 911 2000</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-body, #334155)' }}>Emergencias</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>911</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Accesos rápidos" icon={Activity}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('alertas')} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
            <AlertTriangle size={14} /> Ver alertas de chat
          </button>
          <button onClick={() => setActiveTab('chequeo')} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
            <FileCheck size={14} /> Ver chequeos
          </button>
          <button onClick={() => setActiveTab('historial')} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
            <ClipboardList size={14} /> Ver historial
          </button>
        </div>
      </SectionCard>
    </div>
  );

  /* ═══════════════════════════════════════════
     ALERTAS — Panel dedicado de alertas
  ═══════════════════════════════════════════ */
  const renderAlertas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Filtros de alertas" icon={Search}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setAlertasPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="ATENDIDA">Atendida</option>
            <option value="CERRADA">Cerrada</option>
          </select>
          <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setAlertasPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
            <option value="">Todos los tipos</option>
            <option value="RIESGO_BIENESTAR">Riesgo bienestar</option>
            <option value="CRISIS">Crisis</option>
            <option value="ESCALAMIENTO_MANUAL">Escalamiento manual</option>
            <option value="CRISIS_CHAT">Crisis en chat</option>
          </select>
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setAlertasPage(1); }} placeholder="Buscar por nombre o correo..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', flex: 1, minWidth: 180, background: 'var(--surface-input, #fff)', color: 'var(--text, #0F172A)' }} />
          <button onClick={() => { setAlertasPage(1); fetchAlertas(); }} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
            <Filter size={14} /> Filtrar
          </button>
        </div>
      </SectionCard>

      {loading.alertas ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
      ) : alertasData?.data?.length > 0 ? (
        <SectionCard title={`Alertas registradas (${alertasData.pagination?.total || 0})`} icon={AlertTriangle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {alertasData.data.map(a => (
              <div key={a.id_alerta} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '6px', border: (a.nivel_riesgo === 'Crítico' || a.nivel_riesgo === 'Cr?tico') ? '1px solid #fecaca' : '1px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#eab308'} />
                    <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr?tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                    <StatusBadge label={a.estado} color={ESTADO_COLOR[a.estado] || '#94a3b8'} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)' }}>{new Date(a.creado_en).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--muted, #64748B)' }}>{a.nombres} {a.apellido_paterno} ({a.correo_institucional})</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-body, #475569)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{a.descripcion}</p>
                {a.accion_sugerida && <p style={{ fontSize: '0.75rem', color: 'var(--muted, #94a3b8)', margin: '0.15rem 0 0' }}><strong>Sugerencia:</strong> {a.accion_sugerida}</p>}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                  <button onClick={() => { setSegForm({ ...segForm, id_alerta: String(a.id_alerta) }); setSegModalOpen(true); }}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--line, #e2e8f0)', background: '#eef2ff', cursor: 'pointer', fontSize: '0.7rem', color: '#4F46E5' }}>Seguimiento</button>
                  <button onClick={() => { setEstadoForm({ id_alerta: String(a.id_alerta), estado: 'ATENDIDA', nivel_riesgo: '' }); handleActualizarEstado({ preventDefault: () => {} }); }}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', fontSize: '0.7rem', color: '#16a34a' }}>Atender</button>
                </div>
              </div>
            ))}
          </div>
          {alertasData.pagination && alertasData.pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button disabled={alertasPage <= 1} onClick={() => setAlertasPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
              <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--muted, #64748B)' }}>Pág {alertasData.pagination.page} de {alertasData.pagination.pages}</span>
              <button disabled={alertasPage >= alertasData.pagination.pages} onClick={() => setAlertasPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted, #94a3b8)' }}>No se encontraron alertas con los filtros actuales.</p></SectionCard>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════
     HISTORIAL — Seguimientos + auditoría
  ═══════════════════════════════════════════ */
  const renderHistorial = () => {
    const [historialTab, setHistorialTab] = React.useState('seguimientos');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--line, #e2e8f0)', marginBottom: '0.5rem' }}>
          <button onClick={() => setHistorialTab('seguimientos')} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: historialTab === 'seguimientos' ? 600 : 400,
            color: historialTab === 'seguimientos' ? '#4F46E5' : 'var(--muted, #64748B)',
            borderBottom: historialTab === 'seguimientos' ? '2px solid #4F46E5' : '2px solid transparent',
            marginBottom: '-2px'
          }}>
            <ClipboardList size={16} /> Derivaciones
          </button>
          <button onClick={() => setHistorialTab('auditoria')} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: historialTab === 'auditoria' ? 600 : 400,
            color: historialTab === 'auditoria' ? '#4F46E5' : 'var(--muted, #64748B)',
            borderBottom: historialTab === 'auditoria' ? '2px solid #4F46E5' : '2px solid transparent',
            marginBottom: '-2px'
          }}>
            <Shield size={16} /> Registro de auditoría
          </button>
        </div>

        {historialTab === 'seguimientos' && (
          <>
            <SectionCard title="Filtro de estado" icon={Search}>
              <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setSegPage(1); }} style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="CERRADA">Cerrada</option>
              </select>
            </SectionCard>
            {loading.seguimientos ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
            ) : seguimientosData?.data?.length > 0 ? (
              <SectionCard title={`Derivaciones registradas (${seguimientosData.pagination?.total || 0})`} icon={ClipboardList}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {seguimientosData.data.map(d => (
                    <div key={d.id_derivacion} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <StatusBadge label={d.estado} color={d.estado === 'CERRADA' ? '#22c55e' : d.estado === 'EN_CURSO' ? '#eab308' : '#ef4444'} />
                          {d.tipo_alerta && <StatusBadge label={d.tipo_alerta} color="#4F46E5" />}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)' }}>{new Date(d.creado_en).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--muted, #64748B)' }}>{d.nombres} {d.apellido_paterno}</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-body, #475569)', margin: '0.25rem 0 0' }}><strong>Destino:</strong> {d.destino}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted, #64748B)', margin: '0.15rem 0 0' }}>{d.motivo}</p>
                    </div>
                  ))}
                </div>
                {seguimientosData.pagination && seguimientosData.pagination.pages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button disabled={segPage <= 1} onClick={() => setSegPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                    <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--muted, #64748B)' }}>Pág {seguimientosData.pagination.page} de {seguimientosData.pagination.pages}</span>
                    <button disabled={segPage >= seguimientosData.pagination.pages} onClick={() => setSegPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
                  </div>
                )}
              </SectionCard>
            ) : (
              <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted, #94a3b8)' }}>No hay derivaciones registradas.</p></SectionCard>
            )}
          </>
        )}

        {historialTab === 'auditoria' && (
          loading.auditoria ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
          ) : auditoriaData?.data?.length > 0 ? (
            <SectionCard title={`Registro de auditoría (${auditoriaData.pagination?.total || 0})`} icon={Shield}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {auditoriaData.data.map(a => (
                  <div key={a.id_auditoria} style={{ padding: '0.45rem 0.7rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '6px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-heading, #0F172A)', fontSize: '0.8rem' }}>{a.accion}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)' }}>{new Date(a.creado_en).toLocaleString()}</span>
                    </div>
                    {a.detalle && <div style={{ fontSize: '0.78rem', color: 'var(--muted, #64748B)', marginTop: '0.15rem' }}>{a.detalle}</div>}
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)', marginTop: '0.1rem' }}>{a.nombres ? `${a.nombres} ${a.apellido_paterno || ''}` : 'Sistema'}</div>
                  </div>
                ))}
              </div>
              {auditoriaData.pagination && auditoriaData.pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button disabled={audPage <= 1} onClick={() => setAudPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                  <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--muted, #64748B)' }}>Pág {auditoriaData.pagination.page} de {auditoriaData.pagination.pages}</span>
                  <button disabled={audPage >= auditoriaData.pagination.pages} onClick={() => setAudPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted, #94a3b8)' }}>No hay registros de auditoría.</p></SectionCard>
          )
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     ALUMNOS EN RIESGO
  ═══════════════════════════════════════════ */
  const renderAlumnosRiesgo = () => {
    const niveles = ['', 'Bajo', 'Medio', 'Alto', 'Critico'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SectionCard title="Alumnos en riesgo" subtitle="Filtrar y dar seguimiento a estudiantes identificados" icon={Users}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <MetricCard icon={Users} label="Total en riesgo" value={alumnosPagination?.total || 0} color="#f97316" />
            <MetricCard icon={AlertTriangle} label="Críticos" value={alumnosRiesgo.filter(a => a.nivel_riesgo === 'Critico' || a.nivel_riesgo === 'Cr?tico').length} color="#ef4444" />
            <MetricCard icon={Activity} label="En revisión" value={alumnosRiesgo.filter(a => a.estado_alerta === 'EN_REVISION').length} color="#eab308" />
          </div>
        </SectionCard>

        <SectionCard title="Filtros" icon={Filter}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroGrupo} onChange={e => { setFiltroGrupo(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
              <option value="">Todos los grupos</option>
              {catalogos.grupos.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
            </select>
            <select value={filtroPeriodo} onChange={e => { setFiltroPeriodo(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
              <option value="">Todos los periodos</option>
              {catalogos.periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
            </select>
            <select value={filtroCarrera} onChange={e => { setFiltroCarrera(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
              <option value="">Todas las carreras</option>
              {catalogos.carreras.map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
            </select>
            <select value={filtroNivel} onChange={e => { setFiltroNivel(e.target.value); setAlumnosPage(1); }}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
              <option value="">Todos los niveles</option>
              {niveles.filter(Boolean).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setAlumnosPage(1); }}
              placeholder="Buscar alumno..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', flex: 1, minWidth: 160, background: 'var(--surface-input, #fff)', color: 'var(--text, #0F172A)' }} />
            <button onClick={() => { setAlumnosPage(1); fetchAlumnosRiesgo(); }} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
              <Filter size={14} /> Filtrar
            </button>
            <button onClick={resetAlumnosFilters} className="btn ghost" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
              <RotateCcw size={14} /> Limpiar
            </button>
          </div>
        </SectionCard>

        {loading.alumnos ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" size={28} color="#4F46E5" /></div>
        ) : alumnosRiesgo.length > 0 ? (
          <SectionCard title={`Alumnos en riesgo (${alumnosPagination?.total || 0})`} icon={Users}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alumnosRiesgo.map(a => (
                <div key={a.id_alerta} style={{
                  padding: '0.6rem 0.8rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '8px',
                  border: (a.nivel_riesgo === 'Critico' || a.nivel_riesgo === 'Crítico' || a.nivel_riesgo === 'Cr?tico') ? '1px solid #fecaca' : '1px solid var(--line, #f1f5f9)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-heading, #0F172A)' }}>{a.nombres} {a.apellido_paterno}</strong>
                        <code style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)', background: 'var(--line, #f1f5f9)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{a.matricula}</code>
                        <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr?tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                        <StatusBadge label={a.estado_alerta} color={ESTADO_COLOR[a.estado_alerta] || '#94a3b8'} />
                        <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#4F46E5'} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted, #64748B)', marginTop: '0.25rem' }}>
                        {a.nombre_carrera} · {a.nombre_grupo || 'Sin grupo'} · Sem {a.semestre_actual || '—'} · Prom: {a.promedio_general || '—'}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-body, #475569)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{a.descripcion}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginLeft: '0.75rem' }}>
                      <button onClick={() => fetchDetalle(a.id_alumno)} style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)',
                        background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text, #0F172A)'
                      }}><Eye size={13} /> Revisar</button>
                      <button onClick={() => { setSegForm({ ...segForm, id_alerta: a.id_alerta }); setSegModalOpen(true); }} style={{
                        padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)',
                        background: '#eef2ff', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: '#4F46E5'
                      }}><UserCheck size={13} /> Seguir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {alumnosPagination && alumnosPagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button disabled={alumnosPage <= 1} onClick={() => setAlumnosPage(p => p - 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Anterior</button>
                <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--muted, #64748B)' }}>Pág {alumnosPagination.page} de {alumnosPagination.pages}</span>
                <button disabled={alumnosPage >= alumnosPagination.pages} onClick={() => setAlumnosPage(p => p + 1)} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', background: 'var(--surface-card, #fff)', cursor: 'pointer', fontSize: '0.8rem' }}>Siguiente</button>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard><p style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted, #94a3b8)' }}>No se encontraron alumnos en riesgo con los filtros actuales.</p></SectionCard>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <MetricCard icon={BookOpen} label="Carrera" value={alumno.nombre_carrera || '—'} color="#4F46E5" />
          <MetricCard icon={Users} label="Promedio" value={alumno.promedio_general || '—'} color="#22c55e" />
          <MetricCard icon={Clock} label="Créditos" value={alumno.creditos_acumulados || '—'} color="#f97316" />
          <MetricCard icon={Clock} label="Semestre" value={alumno.semestre_actual || '—'} color="#eab308" />
        </div>
        {evolucion && evolucion.length > 0 && (
          <SectionCard title="Evolución del bienestar" icon={TrendingUp}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {evolucion.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted, #64748B)' }}>{new Date(e.creado_en).toLocaleDateString()}</span>
                  <StatusBadge label={e.nivel_riesgo} color={RIESGO_COLOR[e.nivel_riesgo === 'Cr?tico' ? 'Critico' : e.nivel_riesgo] || '#94a3b8'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading, #0F172A)' }}>Score: {e.bienestar_score}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted, #64748B)' }}>Riesgo: {e.indice_riesgo}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {alertas && alertas.length > 0 && (
          <SectionCard title="Alertas registradas" subtitle={`${alertas.length} alertas`} icon={AlertTriangle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {alertas.map(a => (
                <div key={a.id_alerta} style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-2, #f8fafc)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <StatusBadge label={a.tipo_alerta} color={TIPO_ALERTA_COLOR[a.tipo_alerta] || '#4F46E5'} />
                      <StatusBadge label={a.nivel_riesgo} color={RIESGO_COLOR[a.nivel_riesgo === 'Cr?tico' ? 'Critico' : a.nivel_riesgo] || '#94a3b8'} />
                      <StatusBadge label={a.estado} color={ESTADO_COLOR[a.estado] || '#94a3b8'} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)' }}>{new Date(a.creado_en).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-body, #475569)', margin: '0.25rem 0 0' }}>{a.descripcion}</p>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-heading, #0F172A)', margin: 0 }}>
            <HeartPulse size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#4F46E5' }} />
            IA de Acompañamiento Estudiantil
          </h1>
          <p style={{ color: 'var(--muted, #64748B)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Supervisión centralizada — chequeo guiado, tutoriales, chat de apoyo, historial y alertas.
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

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--line, #e2e8f0)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? '#4F46E5' : 'var(--muted, #64748B)',
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

      {activeTab === 'panel' && renderPanelGeneral()}
      {activeTab === 'chequeo' && renderChequeoGuiado()}
      {activeTab === 'recursos' && renderRecursos()}
      {activeTab === 'chat' && renderChat()}
      {activeTab === 'alertas' && renderAlertas()}
      {activeTab === 'historial' && renderHistorial()}
      {activeTab === 'alumnos' && renderAlumnosRiesgo()}

      {renderDetalleModal()}
      {renderSegModal()}
      {renderEstadoModal()}
    </div>
  );
}
