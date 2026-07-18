import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  XCircle,
  Eye,
  Search,
  Clock,
  AlertTriangle,
  Layers,
  PieChart
} from 'lucide-react';
import '../styles/global.css';

const ADMIN_TABS = [
  { key: 'general', label: 'Panel General', icon: BarChart3 },
  { key: 'plantillas', label: 'Plantillas', icon: FileText },
  { key: 'periodos', label: 'Periodos', icon: CalendarRange },
  { key: 'resultados', label: 'Resultados', icon: Activity },
  { key: 'auditoria', label: 'Auditoría', icon: Eye },
  { key: 'seguimiento', label: 'Seguimiento', icon: Clock }
];

const COORDINATOR_TABS = [
  { key: 'evaluaciones_grupo', label: 'Evaluaciones por grupo', icon: Layers },
  { key: 'seguimiento_grupos', label: 'Seguimiento por grupo', icon: Users },
  { key: 'resultados_parciales', label: 'Resultados parciales', icon: PieChart },
  { key: 'alertas', label: 'Alertas de avance', icon: AlertTriangle },
  { key: 'seguimiento', label: 'Seguimiento global', icon: Clock }
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeArray(payload, keys = ['data', 'items', 'evaluaciones', 'rows']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function safeObject(payload, keys = ['data', 'catalogos', 'resumen']) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of keys) if (payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key])) return payload[key];
    return payload;
  }
  return {};
}

function pickPeriod(row) { return row?.nombre_periodo || row?.periodo || row?.id_periodo || 'Sin periodo'; }
function pickStatus(row) { return row?.estado || row?.estatus || 'SIN ESTADO'; }
function pickType(row) { return row?.tipo_instrumento || row?.nombre_tipo || row?.tipo || 'Sin tipo'; }
function pickObjective(row) { return row?.publico_objetivo || row?.objetivo || 'Sin objetivo'; }
function pickScale(row) { return row?.escala || 'Sin escala'; }
function pickTitle(row) { return row?.titulo || row?.nombre || 'Sin título'; }
function pickDescription(row) { return row?.descripcion || ''; }
function pickLabel(value, map) { const k = normalize(value); return map?.[k] || map?.[value] || value || '—'; }

const INSTRUMENT_LABELS = {
  'DOCENTE_POR_ALUMNOS': 'Docente por alumnos',
  'ALUMNO_POR_DOCENTES': 'Alumno por docentes',
  'POR_GRUPO': 'Por grupo',
  'POR_PERIODO': 'Por periodo',
  'POR_MATERIA': 'Por materia'
};

const OBJECTIVE_LABELS = {
  'ALUMNOS': 'Alumnos', 'DOCENTES': 'Docentes', 'GRUPOS': 'Grupos', 'PERIODOS': 'Periodos', 'MATERIAS': 'Materias'
};

const SCALE_LABELS = { '1-5': 'Escala 1 a 5', '1-10': 'Escala 1 a 10', '0-100': 'Escala 0 a 100' };

function statusColor(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return '#059669';
  if (s.includes('CERR') || s.includes('FIN')) return '#2563eb';
  if (s.includes('CANC')) return '#e11d48';
  if (s.includes('BORR')) return '#d97706';
  return '#64748b';
}

function statusBg(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return 'rgba(16,185,129,0.10)';
  if (s.includes('CERR') || s.includes('FIN')) return 'rgba(37,99,235,0.10)';
  if (s.includes('CANC')) return 'rgba(225,29,72,0.10)';
  if (s.includes('BORR')) return 'rgba(217,119,6,0.10)';
  return 'rgba(100,116,139,0.10)';
}

const STATUS_OPTIONS = ['TODOS', 'BORRADOR', 'ACTIVA', 'CERRADA', 'CANCELADA'];

export default function EvaluacionesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const role = normalize(user?.rol || user?.rol_nombre || user?.role);
  const isAdmin = role === 'ADMINISTRADOR';
  const isCoordinator = role === 'COORDINADOR';
  const canView = isAdmin || isCoordinator;
  const TABS = isAdmin ? ADMIN_TABS : COORDINATOR_TABS;

  const [activeTab, setActiveTab] = React.useState('general');
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [rows, setRows] = React.useState([]);
  const [catalogos, setCatalogos] = React.useState({ plantillas: [], preguntas: [], resumen: {}, periodos: [] });
  const [resumenApi, setResumenApi] = React.useState(null);
  const [periodos, setPeriodos] = React.useState([]);
  const [auditoria, setAuditoria] = React.useState([]);
  const [resultados, setResultados] = React.useState([]);
  const [seguimiento, setSeguimiento] = React.useState([]);
  const [detailData, setDetailData] = React.useState(null);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('TODOS');
  const [periodFilter, setPeriodFilter] = React.useState('TODOS');

  const [templateId, setTemplateId] = React.useState('');
  const [form, setForm] = React.useState({ id_periodo: '', titulo: '', descripcion: '', fecha_inicio: '', fecha_fin: '', tipo_instrumento: 'POR_PERIODO', publico_objetivo: 'PERIODOS', escala: '1-5', ponderacion_total: 100 });
  const [closeObs, setCloseObs] = React.useState('');
  const [cancelObs, setCancelObs] = React.useState('');
  const [selectedEval, setSelectedEval] = React.useState(null);
  const [periodForm, setPeriodForm] = React.useState({ nombre_periodo: '', fecha_inicio: '', fecha_fin: '', estado: 'Planeado' });
  const [validateResultId, setValidateResultId] = React.useState('');
  const [gruposData, setGruposData] = React.useState([]);
  const [seguimientoGrupos, setSeguimientoGrupos] = React.useState([]);
  const [alertas, setAlertas] = React.useState([]);
  const [resultadosParciales, setResultadosParciales] = React.useState([]);

  const loadAll = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      if (!token) throw new Error('Token no disponible');
      const [evaluacionesRes, resumenRes, catalogosRes] = await Promise.allSettled([
        api.evaluaciones(token), api.evaluacionResumen(token), api.evaluacionCatalogos(token)
      ]);
      if (evaluacionesRes.status === 'fulfilled') setRows(safeArray(evaluacionesRes.value));
      else setRows([]);
      if (resumenRes.status === 'fulfilled') setResumenApi(resumenRes.value?.resumen || resumenRes.value?.data || null);
      else setResumenApi(null);
      if (catalogosRes.status === 'fulfilled') {
        const d = catalogosRes.value;
        const cat = d?.catalogos || d?.data || {};
        setCatalogos({ plantillas: cat.plantillas || [], preguntas: cat.preguntas || [], resumen: cat.resumen || {}, periodos: cat.periodos || [] });
        setPeriodos(cat.periodos || []);
      } else setCatalogos({ plantillas: [], preguntas: [], resumen: {}, periodos: [] });
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Error al cargar datos');
    } finally { setLoading(false); }
  }, [token]);

  const loadTabData = React.useCallback(async (tab) => {
    if (!token) return;
    try {
      if (tab === 'auditoria') {
        const res = await api.auditoriaGlobal(token);
        setAuditoria(safeArray(res, ['data', 'auditoria']));
      } else if (tab === 'resultados') {
        const res = await api.resultadosEvaluacion(token);
        setResultados(safeArray(res, ['data', 'resultados']));
      } else if (tab === 'seguimiento') {
        const res = await api.seguimientoEvaluaciones(token);
        setSeguimiento(safeArray(res, ['data', 'seguimiento']));
      } else if (tab === 'evaluaciones_grupo') {
        const res = await api.evaluacionesGrupos(token);
        setGruposData(safeArray(res, ['data', 'grupos']));
      } else if (tab === 'seguimiento_grupos') {
        const res = await api.seguimientoGrupos(token);
        setSeguimientoGrupos(safeArray(res, ['data', 'seguimiento_grupos']));
      } else if (tab === 'alertas') {
        const res = await api.evaluacionAlertas(token);
        setAlertas(safeArray(res, ['data', 'alertas']));
      } else if (tab === 'resultados_parciales') {
        const res = await api.resultadosParciales(token);
        setResultadosParciales(safeArray(res, ['data', 'parciales']));
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  React.useEffect(() => { loadAll(); }, [loadAll]);
  React.useEffect(() => { loadTabData(activeTab); }, [activeTab, loadTabData]);

  const summary = React.useMemo(() => {
    const r = resumenApi || catalogos.resumen || {};
    const computed = {
      total: rows.length,
      activas: rows.filter(r => normalize(pickStatus(r)).includes('ACTIV')).length,
      cerradas: rows.filter(r => normalize(pickStatus(r)).includes('CERR') || normalize(pickStatus(r)).includes('FIN')).length,
      borradores: rows.filter(r => normalize(pickStatus(r)).includes('BORR')).length,
      canceladas: rows.filter(r => normalize(pickStatus(r)).includes('CANC')).length,
      periodos: new Set(rows.map(r => String(pickPeriod(r)))).size,
      tipos: new Set(rows.map(r => String(pickType(r)))).size,
      objetivos: new Set(rows.map(r => String(pickObjective(r)))).size,
      escalas: new Set(rows.map(r => String(pickScale(r)))).size
    };
    return { ...computed, total: r.total ?? computed.total, activas: r.activas ?? computed.activas, cerradas: r.cerradas ?? computed.cerradas, borradores: r.borradores ?? computed.borradores, periodos: r.periodos ?? computed.periodos, tipos: r.tipos ?? computed.tipos, objetivos: r.objetivos ?? computed.objetivos, escalas: r.escalas ?? computed.escalas };
  }, [rows, resumenApi, catalogos]);

  const filteredRows = React.useMemo(() => rows.filter(row => {
    if (statusFilter !== 'TODOS' && normalize(pickStatus(row)) !== normalize(statusFilter)) return false;
    if (periodFilter !== 'TODOS' && normalize(pickPeriod(row)) !== normalize(periodFilter)) return false;
    const term = normalize(query);
    if (!term) return true;
    const blob = normalize([row.id_evaluacion, row.titulo, row.descripcion, pickStatus(row), pickPeriod(row), pickType(row), pickObjective(row)].filter(Boolean).join(' '));
    return blob.includes(term);
  }), [rows, query, statusFilter, periodFilter]);

  const periodOptions = ['TODOS', ...Array.from(new Set(rows.map(r => String(pickPeriod(r))))).filter(Boolean)];

  const activeTemplate = React.useMemo(() => {
    if (!templateId || !catalogos.plantillas.length) return catalogos.plantillas[0] || null;
    return catalogos.plantillas.find((t, i) => String(t.id_plantilla ?? t.codigo ?? i) === templateId || normalize(t.codigo || '') === normalize(templateId)) || null;
  }, [catalogos.plantillas, templateId]);

  const activeTemplateQuestions = React.useMemo(() => {
    if (!activeTemplate) return [];
    const qs = catalogos.preguntas?.filter(q => String(q.id_plantilla) === String(activeTemplate.id_plantilla)) || [];
    return qs.length ? qs : (activeTemplate.preguntas || []);
  }, [catalogos, activeTemplate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) { setError('Solo administradores pueden crear evaluaciones.'); return; }
    if (!activeTemplate) { setError('Selecciona una plantilla.'); return; }
    if (!form.id_periodo) { setError('Selecciona un periodo.'); return; }
    setActionLoading(true); setError(''); setMessage('');
    try {
      await api.crearEvaluacion(token, {
        id_periodo: Number(form.id_periodo), titulo: form.titulo.trim(), descripcion: form.descripcion.trim(),
        fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null,
        tipo_instrumento: form.tipo_instrumento, publico_objetivo: form.publico_objetivo,
        escala: form.escala, ponderacion_total: Number(form.ponderacion_total || 100),
        id_plantilla: Number(activeTemplate.id_plantilla || 0), codigo_plantilla: activeTemplate.codigo,
        preguntas: activeTemplateQuestions.map(q => ({ criterio: q.criterio, descripcion: q.descripcion, peso: Number(q.peso ?? 0), tipo_respuesta: q.tipo_respuesta || 'NUMERICA', orden_pregunta: Number(q.orden_pregunta || 1) }))
      });
      setMessage('Evaluación creada correctamente.');
      setForm(f => ({ ...f, id_periodo: '', titulo: '', descripcion: '', fecha_inicio: '', fecha_fin: '' }));
      await loadAll();
    } catch (err) { setError(err?.message || 'Error al crear.'); }
    finally { setActionLoading(false); }
  };

  const confirmAction = (action, label) => {
    const messages = {
      activar: `¿Estás seguro de activar "${label}"?`,
      cerrar: `¿Estás seguro de cerrar "${label}"? Esta acción no se puede deshacer fácilmente.`,
      cancelar: `¿Estás seguro de cancelar "${label}"? Esta acción no se puede deshacer.`,
      eliminar: `¿Estás seguro de eliminar "${label}"? Todos los datos asociados se perderán.`,
      validar: `¿Estás seguro de validar este resultado?`,
      rechazar: `¿Estás seguro de rechazar este resultado?`,
      exportar: `¿Deseas exportar "${label}" en formato JSON?`
    };
    return window.confirm(messages[action] || `¿Confirmas la acción "${action}" sobre "${label}"?`);
  };

  const handleAction = async (action, idEvaluacion, extra = {}) => {
    setActionLoading(true); setError(''); setMessage('');
    try {
      const actions = {
        activar: () => api.activarEvaluacion(token, idEvaluacion),
        cerrar: async () => {
          const obs = extra.observaciones || '';
          if (obs) return api.cerrarEvaluacion(token, idEvaluacion, { observaciones: obs });
          const motivo = window.prompt('Observaciones al cerrar la evaluación (opcional):', '');
          return api.cerrarEvaluacion(token, idEvaluacion, { observaciones: motivo || '' });
        },
        cancelar: async () => {
          const motivo = window.prompt('Motivo de cancelación (obligatorio):', '');
          if (!motivo || !motivo.trim()) throw new Error('Debes proporcionar un motivo para cancelar la evaluación.');
          return api.cancelarEvaluacion(token, idEvaluacion, { observaciones: motivo.trim() });
        },
        eliminar: () => api.eliminarEvaluacion(token, idEvaluacion),
        validar: () => api.validarResultado(token, extra.id_evaluacion || idEvaluacion, { id_resultado: extra.id_resultado, estado_validacion: extra.estado_validacion || 'VALIDADO' }),
        exportar: async () => {
          const res = await api.exportarEvaluacion(token, idEvaluacion);
          const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `evaluacion-${idEvaluacion}.json`; a.click();
          URL.revokeObjectURL(url);
        }
      };
      if (actions[action]) await actions[action]();
      const labels = { activar: 'activada', cerrar: 'cerrada', cancelar: 'cancelada', eliminar: 'eliminada', validar: 'validada', exportar: 'exportada' };
      setMessage(`Evaluación ${labels[action] || action} correctamente.`);
      await loadAll();
      if (activeTab === 'resultados' || activeTab === 'auditoria' || activeTab === 'seguimiento') await loadTabData(activeTab);
    } catch (err) { setError(err?.message || `Error al ${action}. Verifica que tengas permisos suficientes.`); }
    finally { setActionLoading(false); }
  };

  const handleCreatePeriodo = async (e) => {
    e.preventDefault(); setActionLoading(true); setError(''); setMessage('');
    try {
      await api.crearPeriodo(token, periodForm);
      setMessage('Periodo creado correctamente.');
      setPeriodForm({ nombre_periodo: '', fecha_inicio: '', fecha_fin: '', estado: 'Planeado' });
      await loadAll();
    } catch (err) { setError(err?.message || 'Error al crear periodo.'); }
    finally { setActionLoading(false); }
  };

  const handleViewDetail = async (ev) => {
    try {
      const res = await api.evaluacionDetalle(token, ev.id_evaluacion);
      setDetailData(res?.data || res?.evaluacion || null);
    } catch (err) { setDetailData(null); }
  };

  const renderStatusBadge = (status) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, background: statusBg(status), color: statusColor(status) }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(status), display: 'inline-block' }} />
      {status}
    </span>
  );

  const renderTabNav = () => (
    <div className="eval-tabs" style={{ display: 'flex', gap: 4, overflow: 'auto', padding: '0 0 1rem' }}>
      {TABS.map(tab => {
        const Icon = tab.icon;
        return (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`eval-tab ${activeTab === tab.key ? 'active' : ''}`}>
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderGeneral = () => (
    <>
      <SectionCard title="Acciones del panel" subtitle="Filtro, recarga y navegación"
        right={
          <div className="row gap wrap">
            <button type="button" className="btn secondary" onClick={() => navigate('/app/dashboard')}><ArrowLeft size={16} /> Volver</button>
            <button type="button" className="btn secondary" onClick={loadAll}><RefreshCw size={16} /> Actualizar</button>
          </div>
        }>
        <div className="form-stack">
          <div className="grid-two">
            <div className="field">
              <span>Buscar evaluación</span>
              <div className="row gap"><Search size={18} className="muted" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, periodo, tipo..." /></div>
            </div>
            <div className="field">
              <span>Estatus</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o === 'TODOS' ? 'Todos' : o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-two">
            <div className="field">
              <span>Periodo</span>
              <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
                {periodOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field" />
          </div>
          {loading && <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Loader2 className="animate-spin" size={18} /><span>Cargando...</span></div>}
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
        </div>
      </SectionCard>

      <div className="stats-grid">
        <StatCard icon={ClipboardList} label="Total" value={summary.total} hint="Registro institucional" />
        <StatCard icon={CheckCircle2} label="Activas" value={summary.activas} hint="Abiertas en periodo" />
        <StatCard icon={Target} label="Cerradas" value={summary.cerradas} hint="Ciclo completado" />
        <StatCard icon={Sparkles} label="Borradores" value={summary.borradores} hint="Pendientes" />
        <StatCard icon={XCircle} label="Canceladas" value={summary.canceladas || 0} hint="Dadas de baja" />
        <StatCard icon={CalendarRange} label="Periodos" value={summary.periodos} hint="Cobertura temporal" />
        <StatCard icon={BarChart3} label="Tipos" value={summary.tipos} hint="Clasificación" />
        <StatCard icon={Users} label="Objetivos" value={summary.objetivos} hint="Alumnos, docentes..." />
      </div>

      <SectionCard title="Evaluaciones registradas" subtitle={`${filteredRows.length} resultados`}>
        {filteredRows.length === 0 ? <div className="empty">No hay registros.</div> : (
          <div className="list">
            {filteredRows.slice(0, 20).map(ev => (
              <div key={ev.id_evaluacion} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setSelectedEval(ev); handleViewDetail(ev); }}>
                  <strong>{pickTitle(ev)}</strong>
                  <span>{pickPeriod(ev)} {renderStatusBadge(pickStatus(ev))}</span>
                  <small className="muted" style={{ display: 'block' }}>{pickLabel(pickType(ev), INSTRUMENT_LABELS)} | {pickLabel(pickObjective(ev), OBJECTIVE_LABELS)} | {pickLabel(pickScale(ev), SCALE_LABELS)}</small>
                </div>
                <div className="list-actions" style={{ flexShrink: 0 }}>
                  {normalize(pickStatus(ev)) === 'BORRADOR' && isAdmin && <button className="btn-sm btn-edit" onClick={() => { if (confirmAction('activar', pickTitle(ev))) handleAction('activar', ev.id_evaluacion); }}>Activar</button>}
                  {(normalize(pickStatus(ev)) === 'ACTIVA' || normalize(pickStatus(ev)) === 'BORRADOR') && isAdmin && <button className="btn-sm" style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.22)' }} onClick={() => { if (confirmAction('cerrar', pickTitle(ev))) handleAction('cerrar', ev.id_evaluacion); }}>Cerrar</button>}
                  {(normalize(pickStatus(ev)) !== 'CANCELADA' && normalize(pickStatus(ev)) !== 'CERRADA') && isAdmin && <button className="btn-sm btn-delete" onClick={() => { if (confirmAction('cancelar', pickTitle(ev))) handleAction('cancelar', ev.id_evaluacion); }}>Cancelar</button>}
                  {isAdmin && <button className="btn-sm" style={{ background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.22)' }} onClick={() => { if (confirmAction('exportar', pickTitle(ev))) handleAction('exportar', ev.id_evaluacion); }}>Exportar</button>}
                  {isAdmin && <button className="btn-sm btn-delete" onClick={() => { if (confirmAction('eliminar', pickTitle(ev))) handleAction('eliminar', ev.id_evaluacion); }}>Eliminar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {isAdmin && (
        <div className="two-col">
          <SectionCard title="Crear evaluación" subtitle="Alta institucional de nuevo instrumento">
            <form className="form-stack" onSubmit={handleCreate}>
              <div className="grid-two">
                <FormField label="Periodo">
                  <select value={form.id_periodo} onChange={e => setForm({ ...form, id_periodo: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
                  </select>
                </FormField>
                <FormField label="Plantilla">
                  <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
                    {catalogos.plantillas.map((t, i) => <option key={t.id_plantilla || i} value={t.id_plantilla || t.codigo || i}>{t.nombre_plantilla}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Evaluación diagnóstica" /></FormField>
              <FormField label="Descripción"><textarea rows="2" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></FormField>
              <div className="grid-two">
                <FormField label="Tipo instrumento">
                  <select value={form.tipo_instrumento} onChange={e => setForm({ ...form, tipo_instrumento: e.target.value })}>
                    {Object.entries(INSTRUMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FormField>
                <FormField label="Público objetivo">
                  <select value={form.publico_objetivo} onChange={e => setForm({ ...form, publico_objetivo: e.target.value })}>
                    {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid-two">
                <FormField label="Escala">
                  <select value={form.escala} onChange={e => setForm({ ...form, escala: e.target.value })}>
                    {Object.entries(SCALE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FormField>
                <FormField label="Ponderación"><input type="number" step="0.1" value={form.ponderacion_total} onChange={e => setForm({ ...form, ponderacion_total: e.target.value })} /></FormField>
              </div>
              <div className="grid-two">
                <FormField label="Inicio"><input type="datetime-local" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></FormField>
                <FormField label="Fin"><input type="datetime-local" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} /></FormField>
              </div>
              <div className="auth-note">
                <div className="eyebrow">Vista previa de preguntas ({activeTemplateQuestions.length})</div>
                <div className="list" style={{ marginTop: '0.5rem', maxHeight: 200, overflow: 'auto' }}>
                  {activeTemplateQuestions.length === 0 ? <div className="empty">Sin preguntas.</div> :
                    activeTemplateQuestions.map((q, i) => (
                      <div key={q.id_pregunta || i} className="list-item" style={{ padding: '0.5rem 0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{q.orden_pregunta || i + 1}. {q.criterio}</strong>
                        <small className="muted">Peso: {q.peso ?? 0} | {q.tipo_respuesta}</small>
                      </div>
                    ))}
                </div>
              </div>
              <button className="btn primary" type="submit" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
                Crear evaluación
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Detalle de evaluación" subtitle="Información ampliada">
            {detailData ? (
              <div className="list">
                <div className="list-item">
                  <strong>{detailData.titulo}</strong>
                  <span>Periodo: {detailData.nombre_periodo || '—'} | Estado: {renderStatusBadge(detailData.estado)}</span>
                  <span>Tipo: {pickLabel(detailData.tipo_instrumento, INSTRUMENT_LABELS)} | Objetivo: {pickLabel(detailData.publico_objetivo, OBJECTIVE_LABELS)}</span>
                  <span>Escala: {detailData.escala} | Ponderación: {detailData.ponderacion_total}%</span>
                  <span>Inicio: {detailData.fecha_inicio ? new Date(detailData.fecha_inicio).toLocaleString() : '—'} | Fin: {detailData.fecha_fin ? new Date(detailData.fecha_fin).toLocaleString() : '—'}</span>
                  <span>Preguntas: {detailData.preguntas?.length || 0} | Respuestas: {detailData.total_respuestas || 0} | Resultados: {detailData.resultados?.length || 0}</span>
                  {detailData.cerrado_en && <span>Cerrado: {new Date(detailData.cerrado_en).toLocaleString()} {detailData.cerrado_observaciones ? `— ${detailData.cerrado_observaciones}` : ''}</span>}
                  {detailData.descripcion && <small className="muted">{detailData.descripcion}</small>}
                </div>
                {(detailData.preguntas || []).length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginTop: '0.5rem' }}>Preguntas</div>
                    {detailData.preguntas.map((q, i) => (
                      <div key={q.id_pregunta || i} className="list-item" style={{ padding: '0.5rem 0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{q.orden_pregunta || i + 1}. {q.criterio}</strong>
                        <small className="muted">Peso: {q.peso ?? 0} | Tipo: {q.tipo_respuesta} {q.descripcion ? `— ${q.descripcion}` : ''}</small>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="empty">Selecciona una evaluación del listado para ver su detalle.</div>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );

  const renderPlantillas = () => (
    <SectionCard title="Plantillas institucionales" subtitle="Catálogo de instrumentos de evaluación">
      <div className="grid-two">
        {catalogos.plantillas.length === 0 ? <div className="empty">Sin plantillas.</div> :
          catalogos.plantillas.map((tpl, i) => (
            <div key={tpl.id_plantilla || i} className="role-card" style={{ cursor: 'default' }}>
              <div className="row gap"><Sparkles size={18} /><strong>{tpl.nombre_plantilla}</strong></div>
              <span className="role-card-hint">{tpl.descripcion}</span>
              <small className="muted" style={{ display: 'block', marginTop: 8 }}>
                Instrumento: {pickLabel(tpl.tipo_instrumento, INSTRUMENT_LABELS)} | Público: {pickLabel(tpl.publico_objetivo, OBJECTIVE_LABELS)} | Escala: {pickLabel(tpl.escala, SCALE_LABELS)} | Preguntas: {tpl.preguntas?.length || 0}
              </small>
              {tpl.preguntas && tpl.preguntas.length > 0 && (
                <div className="list" style={{ marginTop: '0.5rem', maxHeight: 180, overflow: 'auto' }}>
                  {tpl.preguntas.map((q, qi) => (
                    <div key={q.id_pregunta || qi} className="list-item" style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}>
                      <strong>{q.orden_pregunta || qi + 1}. {q.criterio}</strong>
                      <small className="muted">Peso: {q.peso ?? 0} | {q.tipo_respuesta}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </SectionCard>
  );

  const renderPeriodos = () => (
    <div className="two-col">
      <SectionCard title="Periodos académicos" subtitle="Listado institucional">
        <div className="list" style={{ maxHeight: 400, overflow: 'auto' }}>
          {periodos.length === 0 ? <div className="empty">Sin periodos.</div> :
            periodos.map(p => (
              <div key={p.id_periodo} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{p.nombre_periodo}</strong>
                  <span>{p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString() : '—'} al {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString() : '—'} {renderStatusBadge(p.estado)}</span>
                </div>
                <small className="muted">Evaluaciones: {p.total_evaluaciones || 0} | Grupos: {p.total_grupos || 0}</small>
              </div>
            ))}
        </div>
      </SectionCard>
      {isAdmin && (
        <SectionCard title="Crear periodo" subtitle="Alta de nuevo periodo">
          <form className="form-stack" onSubmit={handleCreatePeriodo}>
            <FormField label="Nombre"><input value={periodForm.nombre_periodo} onChange={e => setPeriodForm({ ...periodForm, nombre_periodo: e.target.value })} placeholder="Ej. 2026-2" /></FormField>
            <div className="grid-two">
              <FormField label="Inicio"><input type="date" value={periodForm.fecha_inicio} onChange={e => setPeriodForm({ ...periodForm, fecha_inicio: e.target.value })} /></FormField>
              <FormField label="Fin"><input type="date" value={periodForm.fecha_fin} onChange={e => setPeriodForm({ ...periodForm, fecha_fin: e.target.value })} /></FormField>
            </div>
            <FormField label="Estado">
              <select value={periodForm.estado} onChange={e => setPeriodForm({ ...periodForm, estado: e.target.value })}>
                <option value="Planeado">Planeado</option><option value="Activo">Activo</option><option value="Cerrado">Cerrado</option>
              </select>
            </FormField>
            <button className="btn primary" type="submit" disabled={actionLoading}>
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />} Crear periodo
            </button>
          </form>
        </SectionCard>
      )}
    </div>
  );

  const renderResultados = () => (
    <SectionCard title="Gestión de resultados" subtitle="Administración y validación de resultados de evaluación">
      <div className="list" style={{ maxHeight: 500, overflow: 'auto' }}>
        {resultados.length === 0 ? <div className="empty">Sin resultados registrados.</div> :
          resultados.map(r => (
            <div key={r.id_resultado} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <strong>{r.evaluacion_titulo || `Evaluación #${r.id_evaluacion}`}</strong>
                  <span>Resultado #{r.id_resultado} | Tipo evaluado: {r.tipo_evaluado} | ID: {r.id_evaluado}</span>
                  <span>Promedio: <strong>{Number(r.promedio_final || 0).toFixed(2)}</strong> | Validación: {renderStatusBadge(r.estado_validacion || 'NO_VALIDADO')}</span>
                  {r.validado_por_nombre && <small className="muted">Validado por: {r.validado_por_nombre} {r.validado_en ? new Date(r.validado_en).toLocaleString() : ''}</small>}
                  {r.observacion_general && <small className="muted">{r.observacion_general}</small>}
                </div>
                {isAdmin && (
                  <div className="list-actions">
                    {r.estado_validacion !== 'VALIDADO' && <button className="btn-sm btn-edit" onClick={() => { if (confirmAction('validar', r.evaluacion_titulo || `#${r.id_evaluacion}`)) handleAction('validar', r.id_evaluacion, { id_resultado: r.id_resultado, id_evaluacion: r.id_evaluacion, estado_validacion: 'VALIDADO' }); }}>Validar</button>}
                    {r.estado_validacion !== 'RECHAZADO' && <button className="btn-sm btn-delete" onClick={() => { if (confirmAction('rechazar', r.evaluacion_titulo || `#${r.id_evaluacion}`)) handleAction('validar', r.id_evaluacion, { id_resultado: r.id_resultado, id_evaluacion: r.id_evaluacion, estado_validacion: 'RECHAZADO' }); }}>Rechazar</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );

  const renderAuditoria = () => (
    <SectionCard title="Auditoría de evaluaciones" subtitle="Trazabilidad completa de acciones sobre el módulo">
      <div className="list" style={{ maxHeight: 500, overflow: 'auto' }}>
        {auditoria.length === 0 ? <div className="empty">Sin registros de auditoría.</div> :
          auditoria.map(a => (
            <div key={a.id_auditoria} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ textTransform: 'uppercase', fontSize: '0.82rem', color: statusColor(a.accion) }}>{a.accion}</strong>
                  <span>{a.evaluacion_titulo ? `Evaluación: ${a.evaluacion_titulo}` : `ID Evaluación: ${a.id_evaluacion || '—'}`}</span>
                  <span>Usuario: {a.usuario_nombre || `#${a.id_usuario}`} ({a.rol_nombre || '—'})</span>
                  {a.detalle && <small className="muted">{a.detalle}</small>}
                  {a.observaciones && <small className="muted">Obs: {a.observaciones}</small>}
                </div>
                <small className="muted" style={{ flexShrink: 0 }}>{a.creado_en ? new Date(a.creado_en).toLocaleString() : '—'}</small>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );

  const renderSeguimiento = () => (
    <SectionCard title="Seguimiento global" subtitle="Monitoreo integral del ciclo de evaluación">
      <div className="list" style={{ maxHeight: 500, overflow: 'auto' }}>
        {seguimiento.length === 0 ? <div className="empty">Sin datos de seguimiento.</div> :
          seguimiento.map(s => (
            <div key={s.id_evaluacion} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{s.titulo}</strong>
                  <span>Periodo: {s.nombre_periodo} | Estado: {renderStatusBadge(s.estado)} | Plantilla: {s.nombre_plantilla || '—'}</span>
                  <span>Preguntas: {s.total_preguntas || 0} | Respuestas: {s.total_respuestas || 0} | Resultados: {s.total_resultados || 0} | Validados: {s.resultados_validados || 0}</span>
                  <span>Creado: {s.creado_en ? new Date(s.creado_en).toLocaleString() : '—'} {s.cerrado_en ? `| Cerrado: ${new Date(s.cerrado_en).toLocaleString()}` : ''}</span>
                  {s.creado_por_nombre && <small className="muted">Creado por: {s.creado_por_nombre}</small>}
                </div>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );

  const renderEvaluacionesGrupo = () => (
    <SectionCard title="Evaluaciones por grupo" subtitle="Distribución de evaluaciones por grupo académico">
      {gruposData.length === 0 ? <div className="empty">No hay datos de grupos.</div> : (
        <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
          {gruposData.map(g => (
            <div key={g.id_grupo} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{g.nombre_grupo}</strong>
                <span>Semestre: {g.semestre || '—'} | Turno: {g.turno || '—'}</span>
                <span>Evaluaciones: <strong>{g.total_evaluaciones || 0}</strong> ({g.evaluaciones_activas || 0} activas, {g.evaluaciones_cerradas || 0} cerradas)</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small className="muted">Respuestas: {g.total_respuestas || 0}</small>
                <br />
                <small className="muted">Resultados: {g.total_resultados || 0}</small>
                <br />
                <strong style={{ color: '#059669' }}>Promedio: {Number(g.promedio_general || 0).toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );

  const renderSeguimientoGrupos = () => (
    <SectionCard title="Seguimiento por grupo" subtitle="Monitoreo detallado de evaluaciones por grupo">
      {seguimientoGrupos.length === 0 ? <div className="empty">Sin datos de seguimiento por grupo.</div> : (
        <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
          {seguimientoGrupos.map(sg => (
            <div key={`${sg.id_grupo}-${sg.id_evaluacion}`} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{sg.nombre_grupo}</strong>
                  <span>Semestre: {sg.semestre || '—'} | Evaluación: {sg.evaluacion_titulo || '—'}</span>
                  <span>Estado: {renderStatusBadge(sg.estado)} | Plantilla: {sg.nombre_plantilla || '—'}</span>
                  <span>Preguntas: {sg.total_preguntas || 0} | Respuestas: {sg.total_respuestas || 0} | Resultados: {sg.total_resultados || 0}</span>
                  <span>Inicio: {sg.fecha_inicio ? new Date(sg.fecha_inicio).toLocaleString() : '—'} | Fin: {sg.fecha_fin ? new Date(sg.fecha_fin).toLocaleString() : '—'}</span>
                </div>
                <strong style={{ color: '#059669' }}>Promedio: {Number(sg.promedio || 0).toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );

  const renderAlertasView = () => (
    <SectionCard title="Alertas de avance" subtitle="Notificaciones sobre el progreso de evaluaciones">
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span className="badge light" style={{ background: '#fef3c7', color: '#92400e' }}>No atendidas: {alertas.filter(a => !a.atendida).length}</span>
        <span className="badge light" style={{ background: '#d1fae5', color: '#065f46' }}>Atendidas: {alertas.filter(a => a.atendida).length}</span>
      </div>
      {alertas.length === 0 ? <div className="empty">Sin alertas registradas.</div> : (
        <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
          {alertas.map(a => (
            <div key={a.id_alerta} className="list-item" style={{ borderLeft: `4px solid ${a.nivel === 'ALTO' ? '#e11d48' : a.nivel === 'MEDIO' ? '#d97706' : '#64748b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{a.evaluacion_titulo || `Evaluación #${a.id_evaluacion}`}</strong>
                    {renderStatusBadge(a.tipo_alerta)}
                    <span className={`badge ${a.nivel === 'ALTO' ? 'error' : a.nivel === 'MEDIO' ? 'warning' : 'light'}`}>{a.nivel}</span>
                  </div>
                  <span>{a.descripcion}</span>
                  {a.nombre_grupo && <small className="muted">Grupo: {a.nombre_grupo}</small>}
                  {a.atendida ? (
                    <small className="muted">Atendida por: {a.atendida_por_nombre || '—'} el {a.atendida_en ? new Date(a.atendida_en).toLocaleString() : '—'}</small>
                  ) : (
                    <small className="muted">Creada: {a.creado_en ? new Date(a.creado_en).toLocaleString() : '—'}</small>
                  )}
                </div>
                {!a.atendida && (
                  <button className="btn-sm btn-edit" onClick={async () => {
                    try {
                      await api.atenderAlerta(token, a.id_alerta);
                      setAlertas(prev => prev.map(al => al.id_alerta === a.id_alerta ? { ...al, atendida: 1, atendida_en: new Date().toISOString() } : al));
                    } catch (err) { console.error(err); }
                  }}>Atender</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );

  const renderResultadosParcialesView = () => (
    <SectionCard title="Resultados parciales" subtitle="Avance de resultados por evaluación y grupo">
      {resultadosParciales.length === 0 ? <div className="empty">Sin datos parciales.</div> : (
        <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
          {resultadosParciales.map(rp => (
            <div key={`${rp.id_evaluacion}-${rp.id_grupo}`} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <strong>{rp.evaluacion_titulo || `Evaluación #${rp.id_evaluacion}`}</strong>
                  <span>Grupo: {rp.nombre_grupo || '—'} (Semestre: {rp.semestre || '—'})</span>
                  <div className="row gap wrap" style={{ marginTop: '0.25rem' }}>
                    <small>Respuestas: <strong>{rp.total_respuestas || 0}</strong></small>
                    <small>Resp. numéricas: <strong>{rp.respuestas_numericas || 0}</strong></small>
                    <small>Resp. texto: <strong>{rp.respuestas_texto || 0}</strong></small>
                    <small>Resultados: <strong>{rp.total_resultados || 0}</strong></small>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                  <small className="muted">Prom. respuestas</small>
                  <br />
                  <strong style={{ color: '#2563eb' }}>{Number(rp.promedio_respuestas || 0).toFixed(2)}</strong>
                  <br />
                  <small className="muted">Prom. resultados</small>
                  <br />
                  <strong style={{ color: '#059669' }}>{Number(rp.promedio_resultados || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Panel de evaluaciones | {user?.rol || user?.rol_nombre || 'Institucional'}</div>
          <h1>{isAdmin ? 'Administración de evaluaciones' : 'Supervisión de evaluaciones'}</h1>
          <p>{isAdmin
            ? 'Control institucional, plantillas, periodos, resultados, auditoría y seguimiento global del ciclo de evaluación académica.'
            : 'Monitoreo y seguimiento de evaluaciones por grupo, resultados parciales y alertas de avance del ciclo académico.'}</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Periodo activo</small><strong>2026-1</strong></div>
          <div className="meta-card"><small>Carrera</small><strong>Ingeniería en Sistemas Computacionales</strong></div>
        </div>
      </section>

      {renderTabNav()}

      {loading ? (
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /><span>Cargando módulo de evaluaciones...</span>
        </div>
      ) : (
        <>
          {activeTab === 'general' && renderGeneral()}
          {activeTab === 'plantillas' && renderPlantillas()}
          {activeTab === 'periodos' && renderPeriodos()}
          {activeTab === 'resultados' && renderResultados()}
          {activeTab === 'auditoria' && renderAuditoria()}
          {activeTab === 'seguimiento' && renderSeguimiento()}
          {activeTab === 'evaluaciones_grupo' && renderEvaluacionesGrupo()}
          {activeTab === 'seguimiento_grupos' && renderSeguimientoGrupos()}
          {activeTab === 'alertas' && renderAlertasView()}
          {activeTab === 'resultados_parciales' && renderResultadosParcialesView()}
        </>
      )}
    </div>
  );
}
