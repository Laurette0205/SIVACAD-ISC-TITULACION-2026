import React from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api, canAccessDesercionIA } from '../services/api';
import {
  AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Download,
  FileText, FileSpreadsheet, Filter, Loader2, Search, Shield,
  Sparkles, Target, Eye, X, Activity, Clock, UserCheck, Users,
  Trash2, RefreshCw, Save, RotateCcw, Cpu, Gauge, BrainCircuit
} from 'lucide-react';
import { playSuccessSound, playErrorSound } from '../utils/soundManager';
import SoundToggleButton from '../components/SoundToggleButton';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'panel', label: 'Panel global', icon: BarChart3 },
  { key: 'resumen', label: 'Resumen general', icon: Activity },
  { key: 'alertas', label: 'Historial de alertas', icon: ClipboardList },
  { key: 'prediccion', label: 'Predecir riesgo', icon: Target },
  { key: 'seguimiento', label: 'Seguimiento', icon: UserCheck },
  { key: 'auditoria', label: 'Auditoría', icon: Shield }
];

const RISK_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Crítico': '#ef4444' };
const RISK_BADGE = { Bajo: 'status ok', Medio: 'status warn', Alto: 'status warn', 'Crítico': 'status error' };

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function riskLevel(value) {
  const v = normalize(value);
  if (v === 'BAJO') return 'Bajo';
  if (v === 'MEDIO') return 'Medio';
  if (v === 'ALTO') return 'Alto';
  if (v === 'CRITICO' || v === 'CRÍTICO') return 'Crítico';
  return value || 'Sin nivel';
}

function BarChart({ data = [], title, height = 200 }) {
  const maxVal = Math.max(1, ...data.map(d => d.value));
  const barW = Math.max(30, Math.min(80, (600 / Math.max(data.length, 1)) - 16));

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {title && <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>{title}</div>}
      <svg width="100%" height={height} style={{ overflow: 'visible' }}>
        {data.map((d, i) => {
          const pct = d.value / maxVal;
          const barH = Math.max(4, pct * (height - 40));
          const x = i * (barW + 16) + 20;
          const y = height - 20 - barH;
          const color = RISK_COLORS[d.label] || '#4F46E5';
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.85}>
                <title>{d.label}: {d.value}</title>
              </rect>
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="#64748B">{d.label}</text>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="#0F172A" fontWeight="bold">{d.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data = [], size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size * 0.32, ir = size * 0.18;
  let offset = 0;
  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const angle = pct * 360;
    const startAngle = offset;
    offset += angle;
    const endAngle = offset;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = angle > 180 ? 1 : 0;
    const path = `M ${cx + ir * Math.cos(startRad)} ${cy + ir * Math.sin(startRad)} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx + ir * Math.cos(endRad)} ${cy + ir * Math.sin(endRad)} A ${ir} ${ir} 0 ${large} 0 ${cx + ir * Math.cos(startRad)} ${cy + ir * Math.sin(startRad)} Z`;
    return { path, color: RISK_COLORS[d.label] || '#94a3b8', label: d.label, value: d.value, pct: (pct * 100).toFixed(1) };
  });

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color}><title>{s.label}: {s.value} ({s.pct}%)</title></path>)}
      {data.map((d, i) => (
        <g key={`l${i}`}>
          <circle cx={size + 10} cy={20 + i * 22} r={6} fill={RISK_COLORS[d.label] || '#94a3b8'} />
          <text x={size + 22} y={24 + i * 22} fontSize={11} fill="#334155">{d.label}: {d.value}</text>
        </g>
      ))}
    </svg>
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

export default function IADesercionPage() {
  const { token, user, loading: authLoading, getHomeRouteByUser } = useAuth();
  const canAccessIA = canAccessDesercionIA(user);
  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  // Panel global
  const [dashboard, setDashboard] = React.useState(null);
  const [filtros, setFiltros] = React.useState({ periodoId: '', carreraId: '', grupoId: '' });

  // Resumen
  const [resumen, setResumen] = React.useState(null);

  // Alertas
  const [alertas, setAlertas] = React.useState([]);
  const [alertasMeta, setAlertasMeta] = React.useState({ total: 0, pagina: 1, totalPaginas: 0 });
  const [filtrosAlertas, setFiltrosAlertas] = React.useState({ nivel_riesgo: '', atendida: '', periodoId: '', busqueda: '' });

  // Detalle
  const [detalle, setDetalle] = React.useState(null);
  const [detalleOpen, setDetalleOpen] = React.useState(false);

  // ML Health
  const [mlOnline, setMlOnline] = React.useState(false);
  const [mlHealthLoading, setMlHealthLoading] = React.useState(true);

  // Predicción
  const [formPred, setFormPred] = React.useState({ id_alumno: '', id_periodo: '' });
  const [prediction, setPrediction] = React.useState(null);
  const [modelSelector, setModelSelector] = React.useState('auto'); // 'auto' | 'ml' | 'rules'

  // Seguimiento
  const [segForm, setSegForm] = React.useState({ id_alerta: '', accion: '', observaciones: '', estado: 'Pendiente' });

  // Auditoría
  const [auditoria, setAuditoria] = React.useState([]);
  const [auditoriaPagina, setAuditoriaPagina] = React.useState(1);
  const [auditoriaTotal, setAuditoriaTotal] = React.useState(0);
  const [auditoriaTotalPaginas, setAuditoriaTotalPaginas] = React.useState(0);
  const [auditoriaFiltros, setAuditoriaFiltros] = React.useState({ accion: '', desde: '', hasta: '', busqueda: '' });
  const [auditoriaSeleccion, setAuditoriaSeleccion] = React.useState(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [confirmDeleteMode, setConfirmDeleteMode] = React.useState('');

  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    if (isError) playErrorSound(); else playSuccessSound();
    setTimeout(() => setMessage(''), 5000);
  };

  // Cargar dashboard
  const loadDashboard = React.useCallback(async (params = {}) => {
    if (!token || !canAccessIA) return;
    try {
      setLoading(true);
      const res = await api.iaDesercion(token, { ...filtros, ...params });
      if (res?.ok) setDashboard(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccessIA, filtros]);

  // Cargar resumen
  const loadResumen = React.useCallback(async () => {
    if (!token || !canAccessIA) return;
    try {
      setLoading(true);
      const res = await api.iaDesercionResumen(token);
      if (res?.ok) setResumen(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccessIA]);

  // Cargar alertas
  const loadAlertas = React.useCallback(async (page = 1) => {
    if (!token || !canAccessIA) return;
    try {
      setLoading(true);
      const res = await api.iaDesercionAlertas(token, { ...filtrosAlertas, pagina: page, limite: 15 });
      if (res?.ok) {
        setAlertas(res.data || []);
        setAlertasMeta({ total: res.total, pagina: res.pagina, totalPaginas: res.totalPaginas });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccessIA, filtrosAlertas]);

  // Cargar detalle
  const loadDetalle = async (id) => {
    try {
      setLoading(true);
      const res = await api.iaDesercionDetalle(token, id);
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

  // Cargar auditoría
  const loadAuditoria = React.useCallback(async (page = 1) => {
    if (!token || !canAccessIA) return;
    try {
      setLoading(true);
      const res = await api.iaDesercionAuditoria(token, {
        pagina: page, limite: 20,
        accion: auditoriaFiltros.accion || undefined,
        desde: auditoriaFiltros.desde || undefined,
        hasta: auditoriaFiltros.hasta || undefined,
        busqueda: auditoriaFiltros.busqueda || undefined
      });
      if (res?.ok) {
        setAuditoria(res.data || []);
        setAuditoriaPagina(res.pagina);
        setAuditoriaTotal(res.total || 0);
        setAuditoriaTotalPaginas(res.totalPaginas || 0);
        setAuditoriaSeleccion(new Set());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, canAccessIA, auditoriaFiltros]);

  const loadMLHealth = React.useCallback(async () => {
    if (!token || !canAccessIA) return;
    try {
      setMlHealthLoading(true);
      const res = await api.iaDesercionMLHealth(token);
      if (res?.ok) setMlOnline(res.data?.online === true);
      else setMlOnline(false);
    } catch {
      setMlOnline(false);
    } finally {
      setMlHealthLoading(false);
    }
  }, [token, canAccessIA]);

  React.useEffect(() => {
    if (!authLoading && user && canAccessIA) {
      loadDashboard();
      loadResumen();
      loadAlertas();
      loadMLHealth();
    }
  }, [authLoading, user, canAccessIA, loadDashboard, loadResumen, loadAlertas, loadMLHealth]);

  React.useEffect(() => {
    if (!authLoading && user && canAccessIA && activeTab === 'auditoria') {
      loadAuditoria();
    }
  }, [authLoading, user, canAccessIA, activeTab, loadAuditoria]);

  const handleFilterChange = (key, value) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    loadDashboard();
  };

  // Predicción
  const handlePredict = async (e) => {
    e.preventDefault();
    setMessage('');
    setPrediction(null);
    setLoading(true);
    try {
      const idAlumno = Number(formPred.id_alumno);
      const idPeriodo = Number(formPred.id_periodo);
      if (!Number.isInteger(idAlumno) || idAlumno <= 0) throw new Error('ID de alumno inválido');
      if (!Number.isInteger(idPeriodo) || idPeriodo <= 0) throw new Error('ID de periodo inválido');
      const body = { id_alumno: idAlumno, id_periodo: idPeriodo };
      let res;
      if (modelSelector === 'ml') {
        res = await api.predecirDesercionML(token, body);
      } else if (modelSelector === 'rules') {
        res = await api.predecirDesercion(token, body);
      } else {
        res = await api.predecirDesercion(token, body);
      }
      if (res?.ok) {
        const data = res.data || res;
        setPrediction({ ...data, origen: res.origen || data.origen || modelSelector });
        const risk = normalize(data?.nivel);
        if (risk === 'ALTO' || risk === 'CRITICO' || risk === 'CRÍTICO') await playErrorSound();
        else await playSuccessSound();
        showMessage('Predicción generada correctamente');
        loadAlertas();
      }
    } catch (error) {
      showMessage(error?.message || 'Error al predecir', true);
    } finally {
      setLoading(false);
    }
  };

  // Seguimiento
  const handleSeguimiento = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.seguimientoIA(token, {
        id_alerta: Number(segForm.id_alerta || 0),
        accion: segForm.accion.trim(),
        observaciones: segForm.observaciones.trim(),
        estado: segForm.estado
      });
      showMessage('Seguimiento registrado correctamente');
      setSegForm({ id_alerta: '', accion: '', observaciones: '', estado: 'Pendiente' });
      loadAlertas();
    } catch (error) {
      showMessage(error?.message || 'Error al registrar seguimiento', true);
    }
  };

  // Validar
  const handleValidar = async (id, estado) => {
    try {
      const res = await api.validarSeguimientoIA(token, id, { estado });
      if (res?.ok) {
        showMessage(`Seguimiento actualizado a ${estado}`);
        loadAlertas();
        if (detalle?.alerta?.id_alerta === id) loadDetalle(id);
      }
    } catch (error) {
      showMessage('Error al validar', true);
    }
  };

  // Exportar
  const handleExportPdf = async () => {
    try {
      const blob = await api.iaDesercionExportarPdf(token, filtros);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url; a.download = `reporte-desercion-${Date.now()}.pdf`;
      a.click(); window.URL.revokeObjectURL(url);
      showMessage('PDF exportado correctamente');
    } catch (e) {
      showMessage('Error al exportar PDF', true);
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await api.iaDesercionExportarExcel(token, filtros);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url; a.download = `reporte-desercion-${Date.now()}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
      showMessage('Excel exportado correctamente');
    } catch (e) {
      showMessage('Error al exportar Excel', true);
    }
  };

  // ── Auditoría handlers ──
  const handleAuditoriaFilterChange = (key, value) => {
    setAuditoriaFiltros(prev => ({ ...prev, [key]: value }));
  };

  const handleAuditoriaClear = () => {
    setAuditoriaFiltros({ accion: '', desde: '', hasta: '', busqueda: '' });
    setAuditoriaSeleccion(new Set());
    loadAuditoria(1);
  };

  const handleToggleSelect = (id) => {
    setAuditoriaSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (auditoriaSeleccion.size === auditoria.length) {
      setAuditoriaSeleccion(new Set());
    } else {
      setAuditoriaSeleccion(new Set(auditoria.map(a => a.id_auditoria)));
    }
  };

  const handleDeleteClick = (mode) => {
    setConfirmDeleteMode(mode);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setConfirmDeleteOpen(false);
      let params = {};
      if (confirmDeleteMode === 'selected') {
        params.ids = Array.from(auditoriaSeleccion).join(',');
      } else if (confirmDeleteMode === 'date') {
        params.antes = auditoriaFiltros.hasta || new Date().toISOString().split('T')[0];
      } else {
        params.todo = '1';
      }
      const res = await api.iaDesercionAuditoriaEliminar(token, params);
      if (res?.ok) {
        showMessage(res.message || 'Registros eliminados');
        setAuditoriaSeleccion(new Set());
        loadAuditoria(1);
      }
    } catch (err) {
      showMessage('Error al eliminar registros', true);
    }
  };

  const handleExportAuditoria = async () => {
    try {
      const blob = await api.iaDesercionAuditoriaExportar(token, {
        accion: auditoriaFiltros.accion || undefined,
        desde: auditoriaFiltros.desde || undefined,
        hasta: auditoriaFiltros.hasta || undefined
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url; a.download = `auditoria_desercion_${Date.now()}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
      showMessage('Auditoría exportada correctamente');
    } catch (err) {
      showMessage('Error al exportar auditoría', true);
    }
  };

  const handleBackupAuditoria = async () => {
    try {
      const blob = await api.iaDesercionAuditoriaRespaldar(token);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url; a.download = `respaldo_auditoria_desercion_${Date.now()}.json`;
      a.click(); window.URL.revokeObjectURL(url);
      showMessage('Respaldo descargado correctamente');
    } catch (err) {
      showMessage('Error al respaldar auditoría', true);
    }
  };

  if (authLoading) return <div className="page-center">Cargando sesión...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessIA) return <Navigate to={getHomeRouteByUser?.(user) || '/app/dashboard'} replace />;

  const renderTabNav = () => (
    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
      {TABS.map(tab => (
        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', border: 'none',
            background: activeTab === tab.key ? '#4F46E5' : 'transparent', color: activeTab === tab.key ? '#fff' : '#64748B',
            borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeTab === tab.key ? 600 : 400,
            transition: 'all 0.2s'
          }}>
          <tab.icon size={16} /> {tab.label}
        </button>
      ))}
    </div>
  );

  const renderPanelGlobal = () => {
    const metrics = dashboard || {};
    const riskData = [
      { label: 'Bajo', value: metrics.riesgo_bajo || 0 },
      { label: 'Medio', value: metrics.riesgo_medio || 0 },
      { label: 'Alto', value: metrics.riesgo_alto || 0 },
      { label: 'Crítico', value: metrics.riesgo_critico || 0 }
    ];

    return (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtros.periodoId} onChange={e => handleFilterChange('periodoId', e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <option value="">Todos los periodos</option>
              {(metrics?.catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
            </select>
            <select value={filtros.carreraId} onChange={e => handleFilterChange('carreraId', e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <option value="">Todas las carreras</option>
              {(metrics?.catalogos?.carreras || []).map(c => <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>)}
            </select>
            <button className="btn secondary" onClick={applyFilters} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Filter size={14} /> Filtrar</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="btn secondary" onClick={handleExportPdf} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={14} /> PDF</button>
            <button className="btn secondary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileSpreadsheet size={14} /> Excel</button>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Alertas totales', value: metrics.alertas_total || 0, icon: AlertTriangle, color: '#4F46E5' },
            { label: 'Críticos', value: metrics.riesgo_critico || 0, icon: Target, color: '#ef4444' },
            { label: 'Pendientes', value: metrics.alertas_pendientes || 0, icon: Clock, color: '#f97316' },
            { label: 'Atendidas', value: metrics.alertas_atendidas || 0, icon: CheckCircle2, color: '#22c55e' },
            { label: 'Alumnos', value: metrics.alumnos || 0, icon: Users, color: '#3b82f6' },
            { label: 'Grupos', value: metrics.grupos || 0, icon: BarChart3, color: '#8b5cf6' }
          ].map((stat, i) => (
            <div key={i} className="stat-card">
              <div>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
              </div>
              <div className="stat-icon" style={{ color: stat.color }}><stat.icon size={22} /></div>
            </div>
          ))}
        </div>

        <div className="two-col">
          <SectionCard title="Distribución de riesgo académico" subtitle="Alumnos clasificados por nivel de riesgo">
            <BarChart data={riskData} title="" height={180} />
          </SectionCard>
          <SectionCard title="Proporción de riesgo" subtitle="Distribución porcentual">
            <DonutChart data={riskData} size={200} />
          </SectionCard>
        </div>
      </>
    );
  };

  const renderResumen = () => {
    if (!resumen) return <div className="empty">Cargando resumen...</div>;
    return (
      <div className="stack">
        <SectionCard title="Alertas por periodo" subtitle="Distribución histórica por periodo académico">
          <div className="table-wrapper">
            <div className="table-responsive"><table className="table">
              <thead><tr><th>Periodo</th><th>Total</th><th>Pendientes</th><th>Atendidas</th><th>Críticos</th><th>Alto</th><th>Medio</th><th>Bajo</th></tr></thead>
              <tbody>
                {(resumen.porPeriodo || []).map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.nombre_periodo}</strong></td>
                    <td>{p.total_alertas}</td>
                    <td style={{ color: '#f97316' }}>{p.pendientes}</td>
                    <td style={{ color: '#22c55e' }}>{p.atendidas}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>{p.criticos}</td>
                    <td>{p.alto}</td>
                    <td>{p.medio}</td>
                    <td>{p.bajo}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>

        <div className="two-col">
          <SectionCard title="Alertas por carrera" subtitle="Concentración de riesgo por programa educativo">
            <div className="list">
              {(resumen.porCarrera || []).map((c, i) => (
                <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{c.nombre_carrera}</strong></span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: '#f97316' }}>{c.pendientes} pend.</span>
                    <span style={{ color: '#22c55e' }}>{c.atendidas} at.</span>
                    <span className="status error">{c.criticos} críticos</span>
                    <span className="badge light">{c.total_alertas} total</span>
                  </div>
                </div>
              ))}
              {(!resumen.porCarrera || resumen.porCarrera.length === 0) && <div className="empty">Sin datos por carrera</div>}
            </div>
          </SectionCard>

          <SectionCard title="Grupos con mayor riesgo" subtitle="Top 20 grupos con alertas activas">
            <div className="list">
              {(resumen.porGrupo || []).map((g, i) => (
                <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{g.nombre_grupo}</strong></span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="status error">{g.criticos} críticos</span>
                    <span className="badge light">{g.total_alertas} alertas</span>
                  </div>
                </div>
              ))}
              {(!resumen.porGrupo || resumen.porGrupo.length === 0) && <div className="empty">Sin datos por grupo</div>}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  };

  const renderAlertas = () => (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
          <input placeholder="Buscar por matrícula o nombre..." value={filtrosAlertas.busqueda}
            onChange={e => setFiltrosAlertas(prev => ({ ...prev, busqueda: e.target.value }))}
            style={{ paddingLeft: '2rem', width: '100%' }} />
        </div>
        <select value={filtrosAlertas.nivel_riesgo} onChange={e => setFiltrosAlertas(prev => ({ ...prev, nivel_riesgo: e.target.value }))}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <option value="">Todos los niveles</option>
          <option value="Bajo">Bajo</option>
          <option value="Medio">Medio</option>
          <option value="Alto">Alto</option>
          <option value="Crítico">Crítico</option>
        </select>
        <select value={filtrosAlertas.atendida} onChange={e => setFiltrosAlertas(prev => ({ ...prev, atendida: e.target.value }))}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <option value="">Todas</option>
          <option value="0">Pendientes</option>
          <option value="1">Atendidas</option>
        </select>
        <select value={filtrosAlertas.periodoId} onChange={e => setFiltrosAlertas(prev => ({ ...prev, periodoId: e.target.value }))}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <option value="">Todos los periodos</option>
          {(dashboard?.catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
        </select>
        <button className="btn secondary" onClick={() => loadAlertas(1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Filter size={14} /> Filtrar</button>
      </div>

      <SectionCard title={`Historial de alertas (${alertasMeta.total})`} subtitle="Casos registrados de riesgo de deserción">
        <div className="table-wrapper">
          <div className="table-responsive"><table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Matrícula</th>
                <th>Alumno</th>
                <th>Periodo</th>
                <th>Riesgo</th>
                <th>Puntaje</th>
                <th>Estado</th>
                <th>Seguimiento</th>
                <th>Acciones</th>
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
                  <td>{a.nombre_periodo || a.id_periodo}</td>
                  <td><span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo}</span></td>
                  <td><strong>{a.puntaje_riesgo}</strong></td>
                  <td>{a.atendida ? <span className="status ok">Atendida</span> : <span className="status error">Pendiente</span>}</td>
                  <td><span className={`badge ${a.estado_seguimiento === 'Atendida' || a.estado_seguimiento === 'Cerrada' ? 'light' : 'warning'}`}>{a.estado_seguimiento || 'Pendiente'}</span></td>
                  <td>
                    <button className="btn ghost" onClick={() => loadDetalle(a.id_alerta)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={14} /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
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
  );

  const renderFeatureImportance = (factores = []) => {
    if (!factores.length) return null;
    const maxPeso = Math.max(1, ...factores.map(f => f.peso));
    return (
      <div style={{ marginTop: '0.75rem' }}>
        <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>
          <BrainCircuit size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Factores con mayor impacto (ML)
        </div>
        {factores.map((f, i) => (
          <div key={i} style={{ marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.15rem' }}>
              <span>{f.factor}</span>
              <span style={{ fontWeight: 600, color: '#4F46E5' }}>{f.peso}%</span>
            </div>
            <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(f.peso / maxPeso) * 100}%`, height: '100%', background: '#4F46E5', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderProbabilityGauge = (score) => {
    const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#eab308' : '#22c55e';
    return (
      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        <div className="eyebrow">Probabilidad de riesgo</div>
        <div style={{ position: 'relative', width: 140, height: 70, margin: '0.5rem auto', overflow: 'hidden' }}>
          <svg width="140" height="70" viewBox="0 0 140 70">
            <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
            <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 188.5} 188.5`} />
          </svg>
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem', fontWeight: 700, color }}>{score}%</div>
        </div>
      </div>
    );
  };

  const renderPrediccion = () => (
    <div className="two-col">
      <SectionCard title="Predecir riesgo de deserción" subtitle="Análisis temprano con factores explicables">
        {/* Model Selector */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', padding: '0.25rem', background: '#f1f5f9', borderRadius: 10, alignSelf: 'flex-start' }}>
          {[
            { key: 'auto', label: 'Automático', icon: Cpu },
            { key: 'ml', label: 'ML (XGBoost)', icon: BrainCircuit },
            { key: 'rules', label: 'Reglas (v2)', icon: Gauge }
          ].map(opt => (
            <button key={opt.key} type="button" onClick={() => setModelSelector(opt.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.75rem', border: 'none',
                background: modelSelector === opt.key ? '#4F46E5' : 'transparent',
                color: modelSelector === opt.key ? '#fff' : '#64748B',
                borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: modelSelector === opt.key ? 600 : 400,
                transition: 'all 0.2s'
              }}>
              <opt.icon size={14} /> {opt.label}
            </button>
          ))}
          {!mlOnline && modelSelector !== 'rules' && (
            <span style={{ fontSize: '0.7rem', color: '#ef4444', padding: '0.35rem 0.5rem' }}>ML no disponible</span>
          )}
        </div>

        <form className="form-stack" onSubmit={handlePredict}>
          <div className="grid-two">
            <FormField label="ID del alumno">
              <input value={formPred.id_alumno} onChange={e => setFormPred({ ...formPred, id_alumno: e.target.value })} placeholder="Ej. 15" />
            </FormField>
            <FormField label="ID del periodo">
              <input value={formPred.id_periodo} onChange={e => setFormPred({ ...formPred, id_periodo: e.target.value })} placeholder="Ej. 1" />
            </FormField>
          </div>
          <button className="btn primary" type="submit" disabled={loading || (modelSelector === 'ml' && !mlOnline)}>
            {loading ? <><Loader2 size={16} className="spin" /> Analizando...</> : 'Analizar riesgo'}
          </button>
          {modelSelector === 'ml' && !mlOnline && (
            <small style={{ color: '#ef4444', display: 'block', marginTop: '0.25rem' }}>El servidor ML no está disponible. Selecciona 'Automático' o 'Reglas (v2)'.</small>
          )}
        </form>

        {prediction && (
          <div className="note" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '1.1rem' }}>Resultado: {riskLevel(prediction.nivel)}</strong>
                <span className={`badge ${prediction.origen === 'ML' ? 'light' : 'warning'}`} style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                  {prediction.origen || modelSelector}
                </span>
              </div>
              <span className={RISK_BADGE[prediction.nivel]}>{prediction.score}/100</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div><small>Confianza</small><br /><strong>{(prediction.confianza * 100).toFixed(1) || prediction.confianza}%</strong></div>
              <div><small>Modelo</small><br /><strong>{prediction.modelo_version || 'rule-v2'}</strong></div>
            </div>

            {prediction.origen === 'ML' && renderProbabilityGauge(prediction.score)}

            {prediction.origen === 'ML' && prediction.ml_raw?.factores_importantes && (
              renderFeatureImportance(
                prediction.ml_raw.factores_importantes.map(f => ({
                  factor: f.variable,
                  peso: Math.round(f.importancia * 100)
                }))
              )
            )}

            {(!prediction.ml_raw || prediction.origen !== 'ML') && prediction.factores?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <small>Factores detectados</small>
                {prediction.factores.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span>{f.factor}</span>
                    <span style={{ fontWeight: 600 }}>+{f.peso}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <small>Recomendación</small>
              <p style={{ margin: '0.25rem 0', color: '#334155' }}>{prediction.recomendacion}</p>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <small>Explicación</small>
              <p style={{ fontSize: '0.9rem', color: '#475569' }}>{prediction.explicacion}</p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Generar alerta manual" subtitle="Registro institucional sin predicción automática">
        <form className="form-stack" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const form = new FormData(e.target);
            await api.generarAlertaIA(token, Object.fromEntries(form));
            showMessage('Alerta generada correctamente');
            loadAlertas();
            e.target.reset();
          } catch (err) {
            showMessage('Error al generar alerta', true);
          }
        }}>
          <div className="grid-two">
            <FormField label="ID Alumno"><input name="id_alumno" required placeholder="Ej. 15" /></FormField>
            <FormField label="ID Periodo"><input name="id_periodo" required placeholder="Ej. 1" /></FormField>
          </div>
          <FormField label="Nivel de riesgo">
            <select name="nivel_riesgo" defaultValue="medio">
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
              <option value="critico">Crítico</option>
            </select>
          </FormField>
          <FormField label="Descripción">
            <textarea name="descripcion" rows={2} defaultValue="Alerta generada por análisis institucional" />
          </FormField>
          <button className="btn accent" type="submit">Generar alerta</button>
        </form>
      </SectionCard>
    </div>
  );

  const renderSeguimiento = () => (
    <div className="two-col">
      <SectionCard title="Registrar seguimiento" subtitle="Acciones institucionales sobre alertas">
        <form className="form-stack" onSubmit={handleSeguimiento}>
          <FormField label="ID de alerta">
            <input value={segForm.id_alerta} onChange={e => setSegForm({ ...segForm, id_alerta: e.target.value })} placeholder="ID de la alerta" />
          </FormField>
          <FormField label="Estado">
            <select value={segForm.estado} onChange={e => setSegForm({ ...segForm, estado: e.target.value })}>
              <option value="Pendiente">Pendiente</option>
              <option value="En_proceso">En proceso</option>
              <option value="Atendida">Atendida</option>
              <option value="Cerrada">Cerrada</option>
            </select>
          </FormField>
          <FormField label="Acción">
            <input value={segForm.accion} onChange={e => setSegForm({ ...segForm, accion: e.target.value })} placeholder="Ej. Canalización a tutoría" />
          </FormField>
          <FormField label="Observaciones">
            <textarea value={segForm.observaciones} onChange={e => setSegForm({ ...segForm, observaciones: e.target.value })} rows={3} placeholder="Describe la intervención" />
          </FormField>
          <button className="btn accent" type="submit">Guardar seguimiento</button>
        </form>
      </SectionCard>

      <SectionCard title="Alertas recientes" subtitle="Selecciona una para gestionar su seguimiento">
        <div className="list" style={{ maxHeight: 400, overflow: 'auto' }}>
          {alertas.slice(0, 10).map(a => (
            <button key={a.id_alerta} type="button" className="list-item"
              onClick={() => setSegForm(prev => ({ ...prev, id_alerta: String(a.id_alerta) }))}
              style={{ textAlign: 'left', width: '100%', background: 'transparent', cursor: 'pointer' }}>
              <strong>{a.nombres} {a.apellido_paterno}</strong>
              <span className={RISK_BADGE[a.nivel_riesgo] || 'status'}>{a.nivel_riesgo} • {a.estado_seguimiento || 'Pendiente'}</span>
              <small>#{a.id_alerta} • {a.matricula}</small>
            </button>
          ))}
          {alertas.length === 0 && <div className="empty">Sin alertas disponibles</div>}
        </div>
      </SectionCard>
    </div>
  );

  const renderAuditoria = () => {
    const acciones = ['PREDECIR', 'SEGUIMIENTO', 'VALIDAR', 'GENERAR', 'EXPORTAR_PDF', 'EXPORTAR_EXCEL', 'LIMPIAR_AUDITORIA'];
    const haySeleccion = auditoriaSeleccion.size > 0;

    return (
      <div className="stack">
        {/* Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input placeholder="Buscar por detalle o usuario..." value={auditoriaFiltros.busqueda}
              onChange={e => handleAuditoriaFilterChange('busqueda', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadAuditoria(1)}
              style={{ paddingLeft: '2rem', width: '100%' }} />
          </div>
          <select value={auditoriaFiltros.accion} onChange={e => { handleAuditoriaFilterChange('accion', e.target.value); }}
            style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
            <option value="">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={auditoriaFiltros.desde} onChange={e => handleAuditoriaFilterChange('desde', e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
            title="Desde" />
          <input type="date" value={auditoriaFiltros.hasta} onChange={e => handleAuditoriaFilterChange('hasta', e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
            title="Hasta" />
          <button className="btn secondary" onClick={() => loadAuditoria(1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Filtrar
          </button>
          <button className="btn ghost" onClick={handleAuditoriaClear} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={14} /> Limpiar
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button className="btn secondary" onClick={() => loadAuditoria(1)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button className="btn secondary" onClick={handleExportAuditoria} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={14} /> Exportar CSV
          </button>
          <button className="btn secondary" onClick={handleBackupAuditoria} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={14} /> Respaldar JSON
          </button>
          <button className="btn danger" onClick={() => handleDeleteClick(haySeleccion ? 'selected' : 'all')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
            disabled={auditoria.length === 0}>
            <Trash2 size={14} /> {haySeleccion ? `Eliminar (${auditoriaSeleccion.size})` : 'Eliminar todo'}
          </button>
        </div>

        <SectionCard
          title={`Supervisión de auditoría (${auditoriaTotal})`}
          subtitle="Registro de todas las acciones realizadas en el módulo">
          <div className="table-wrapper">
            <div className="table-responsive"><table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={auditoria.length > 0 && auditoriaSeleccion.size === auditoria.length}
                      onChange={handleToggleSelectAll} style={{ cursor: 'pointer' }} />
                  </th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin registros de auditoría</td></tr>
                ) : auditoria.map((a, i) => (
                  <tr key={a.id_auditoria || i} style={{ background: auditoriaSeleccion.has(a.id_auditoria) ? '#EEF2FF' : undefined }}>
                    <td>
                      <input type="checkbox" checked={auditoriaSeleccion.has(a.id_auditoria)}
                        onChange={() => handleToggleSelect(a.id_auditoria)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{new Date(a.creado_en).toLocaleString('es-MX')}</td>
                    <td>{a.nombres} {a.apellido_paterno || ''}</td>
                    <td><span className="badge light">{a.accion}</span></td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 300 }}>{a.detalle}</td>
                    <td>{a.id_alerta || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {auditoriaTotalPaginas > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              {Array.from({ length: auditoriaTotalPaginas }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => loadAuditoria(p)}
                  style={{
                    padding: '0.3rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 6,
                    background: auditoriaPagina === p ? '#4F46E5' : '#fff',
                    color: auditoriaPagina === p ? '#fff' : '#334155', cursor: 'pointer'
                  }}>{p}</button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Confirmación de eliminación */}
        <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Confirmar eliminación">
          <div style={{ padding: '0.5rem 0' }}>
            {confirmDeleteMode === 'selected' ? (
              <p>¿Estás seguro de eliminar <strong>{auditoriaSeleccion.size}</strong> registro(s) de auditoría seleccionados? Esta acción no se puede deshacer.</p>
            ) : confirmDeleteMode === 'date' ? (
              <p>¿Estás seguro de eliminar todos los registros de auditoría <strong>anteriores a {auditoriaFiltros.hasta}</strong>? Esta acción no se puede deshacer.</p>
            ) : (
              <p>¿Estás seguro de eliminar <strong>todos</strong> los registros de auditoría? Esta acción no se puede deshacer.</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</button>
              <button className="btn danger" onClick={handleConfirmDelete}>
                <Trash2 size={14} /> Sí, eliminar
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  const renderDetalleModal = () => {
    if (!detalle) return null;
    const { alerta, seguimientos, alertas_previas } = detalle;
    const factores = (() => {
      try { return JSON.parse(alerta.factores_json || '[]'); } catch { return []; }
    })();

    return (
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)} title={`Caso #${alerta.id_alerta} — ${alerta.nombres} ${alerta.apellido_paterno}`}>
        <div className="stack">
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card"><div><div className="stat-label">Matrícula</div><div className="stat-value" style={{ fontSize: '1rem' }}>{alerta.matricula}</div></div></div>
            <div className="stat-card"><div><div className="stat-label">Carrera</div><div className="stat-value" style={{ fontSize: '1rem' }}>{alerta.nombre_carrera || '-'}</div></div></div>
            <div className="stat-card"><div><div className="stat-label">Semestre</div><div className="stat-value" style={{ fontSize: '1rem' }}>{alerta.semestre_actual || '-'}</div></div></div>
            <div className="stat-card"><div><div className="stat-label">Periodo</div><div className="stat-value" style={{ fontSize: '1rem' }}>{alerta.nombre_periodo || alerta.id_periodo}</div></div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div className="eyebrow">Nivel de riesgo</div>
              <span className={RISK_BADGE[alerta.nivel_riesgo] || 'status'} style={{ fontSize: '1.1rem', padding: '0.4rem 0.8rem' }}>{alerta.nivel_riesgo} • {alerta.puntaje_riesgo}/100</span>
            </div>
            <div>
              <div className="eyebrow">Estado de seguimiento</div>
              <span className={`badge ${alerta.atendida ? 'light' : 'warning'}`} style={{ fontSize: '1rem' }}>
                {alerta.atendida ? 'Atendida' : 'Pendiente'} ({alerta.estado_seguimiento || 'Sin seguimiento'})
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div className="eyebrow">Promedio general</div>
              <strong style={{ fontSize: '1.2rem' }}>{alerta.promedio_general || 'N/D'}</strong>
            </div>
            <div>
              <div className="eyebrow">Créditos acumulados</div>
              <strong style={{ fontSize: '1.2rem' }}>{alerta.creditos_acumulados || 'N/D'}</strong>
            </div>
            <div>
              <div className="eyebrow">Alertas previas</div>
              <strong style={{ fontSize: '1.2rem' }}>{alertas_previas || 0}</strong>
            </div>
            <div>
              <div className="eyebrow">Estatus académico</div>
              <strong style={{ fontSize: '1.2rem' }}>{alerta.estatus_academico || 'N/D'}</strong>
            </div>
          </div>

          {factores.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="eyebrow">Factores de riesgo</div>
              <div className="list">
                {factores.map((f, i) => (
                  <div key={i} className="list-item" style={{ justifyContent: 'space-between' }}>
                    <span><strong>{f.factor}</strong><br /><small>{f.detalle}</small></span>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>+{f.peso}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div className="eyebrow">Descripción</div>
            <p>{alerta.descripcion}</p>
            <div className="eyebrow">Recomendación</div>
            <p>{alerta.recomendacion}</p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button className="btn success" onClick={() => handleValidar(alerta.id_alerta, 'Atendida')} disabled={alerta.atendida === 1}>
              <CheckCircle2 size={16} /> Marcar como atendida
            </button>
            <button className="btn primary" onClick={() => handleValidar(alerta.id_alerta, 'En_proceso')}>
              Iniciar seguimiento
            </button>
            <button className="btn secondary" onClick={() => handleValidar(alerta.id_alerta, 'Cerrada')}>
              Cerrar caso
            </button>
          </div>

          <div>
            <div className="eyebrow">Historial de seguimientos</div>
            <div className="list">
              {seguimientos.length === 0 ? (
                <div className="empty">Sin seguimientos registrados</div>
              ) : seguimientos.map((s, i) => (
                <div key={s.id_seguimiento || i} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong>{s.accion}</strong>
                    <span className={`badge ${s.estado === 'Atendida' || s.estado === 'Cerrada' ? 'light' : 'warning'}`}>{s.estado}</span>
                  </div>
                  <small>{s.observaciones}</small>
                  <small style={{ color: '#94a3b8' }}>
                    {new Date(s.creado_en).toLocaleString('es-MX')} — {s.usuario_nombre} {s.usuario_apellido || ''}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">IA institucional • {user?.rol || user?.rol_nombre || 'Administrador'}</div>
          <h1>IA de deserción</h1>
          <p>Panel global de riesgo académico, resumen general, historial de alertas, detalles de casos y exportación de reportes con gráficas explicativas. Centraliza el control estratégico del riesgo académico en toda la institución.</p>
        </div>
          <div className="hero-meta">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className={`badge ${mlOnline ? 'light' : 'error'}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
                <Cpu size={12} /> ML {mlHealthLoading ? '...' : mlOnline ? 'Online' : 'Offline'}
              </span>
              <SoundToggleButton />
            </div>
            <div className="meta-card">
              <small>Alertas totales</small>
              <strong>{dashboard?.alertas_total || 0}</strong>
            </div>
            <div className="meta-card">
              <small>Riesgo crítico</small>
              <strong style={{ color: '#ef4444' }}>{dashboard?.riesgo_critico || 0}</strong>
            </div>
          </div>
      </section>

      {message && <div className={`alert ${message.includes('Error') ? 'error' : 'info'}`}>{message}</div>}

      {renderTabNav()}

      {loading && !detalleOpen && <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} className="spin" /></div>}

      {activeTab === 'panel' && renderPanelGlobal()}
      {activeTab === 'resumen' && renderResumen()}
      {activeTab === 'alertas' && renderAlertas()}
      {activeTab === 'prediccion' && renderPrediccion()}
      {activeTab === 'seguimiento' && renderSeguimiento()}
      {activeTab === 'auditoria' && renderAuditoria()}

      {renderDetalleModal()}
    </div>
  );
}
