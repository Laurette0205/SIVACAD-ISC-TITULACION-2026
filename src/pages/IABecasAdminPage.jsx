import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  Target,
  Users,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Eye,
  UserCheck,
  ExternalLink,
  Calendar
} from 'lucide-react';

const ESTATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'VALIDADA', label: 'Validada' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

const TIPOS_DICTAMEN = [
  { value: '', label: 'Todos' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'CONDICIONADA', label: 'Condicionada' }
];

const TABS = [
  { id: 'panel', label: 'Panel general', icon: BarChart3 },
  { id: 'metricas', label: 'Métricas', icon: Target },
  { id: 'solicitudes', label: 'Solicitudes', icon: FileText },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'dictamenes', label: 'Dictámenes', icon: ClipboardCheck },
  { id: 'convocatorias', label: 'Convocatorias', icon: BookMarked },
  { id: 'exportaciones', label: 'Exportaciones', icon: Download },
  { id: 'auditoria', label: 'Auditoría', icon: Shield }
];

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch { return String(value); }
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function estatusBadge(estatus) {
  const map = {
    PENDIENTE: 'badge warning',
    EN_REVISION: 'badge light',
    VALIDADA: 'badge',
    APROBADA: 'badge success',
    RECHAZADA: 'badge danger',
    CANCELADA: 'badge'
  };
  return map[estatus] || 'badge';
}

function getNivel(num) {
  const map = { INFO: 'badge light', WARNING: 'badge warning', ERROR: 'badge danger', CRITICAL: 'badge danger' };
  return map[num] || 'badge light';
}

export default function IABecasAdminPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('panel');
  const [loading, setLoading] = React.useState({});
  const [error, setError] = React.useState(null);

  const [metricas, setMetricas] = React.useState(null);
  const [indicadores, setIndicadores] = React.useState(null);
  const [solicitudes, setSolicitudes] = React.useState({ data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
  const [solicitudDetalle, setSolicitudDetalle] = React.useState(null);
  const [historial, setHistorial] = React.useState({ data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
  const [dictamenes, setDictamenes] = React.useState({ data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
  const [convocatorias, setConvocatorias] = React.useState({ data: [], categorias: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
  const [exportaciones, setExportaciones] = React.useState({ data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
  const [auditoria, setAuditoria] = React.useState({ data: [], acciones: [], niveles: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });

  const [filtros, setFiltros] = React.useState({ estatus: '', busqueda: '', page: 1 });
  const [filtrosAudit, setFiltrosAudit] = React.useState({ accion: '', nivel: '', desde: '', hasta: '', page: 1 });
  const [filtrosConv, setFiltrosConv] = React.useState({ categoria: '', activo: -1, page: 1 });

  const fullName = React.useMemo(() => {
    return `${user?.nombres || ''} ${user?.apellido_paterno || ''} ${user?.apellido_materno || ''}`.replace(/\s+/g, ' ').trim() || user?.nombre_completo || 'Administrador';
  }, [user]);

  async function loadMetricas() {
    setLoading(p => ({ ...p, metricas: true }));
    try {
      const [m, i] = await Promise.all([api.iaBecasAdminMetricas(token), api.iaBecasAdminIndicadores(token)]);
      setMetricas(m?.data || m || {});
      setIndicadores(i?.data || i || {});
    } catch (err) {
      setError(err?.message || 'Error al cargar métricas');
    } finally { setLoading(p => ({ ...p, metricas: false })); }
  }

  async function loadSolicitudes(p = 1) {
    setLoading(p => ({ ...p, solicitudes: true }));
    try {
      const params = { page: p, limit: 20, estatus: filtros.estatus, busqueda: filtros.busqueda };
      const r = await api.iaBecasAdminSolicitudes(token, params);
      setSolicitudes(r?.data || { data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
      setFiltros(f => ({ ...f, page: p }));
    } catch (err) {
      setError(err?.message || 'Error al cargar solicitudes');
    } finally { setLoading(p => ({ ...p, solicitudes: false })); }
  }

  async function loadHistorial(p = 1) {
    setLoading(p => ({ ...p, historial: true }));
    try {
      const params = { page: p, limit: 20, estatus: filtros.estatus, busqueda: filtros.busqueda };
      const r = await api.iaBecasAdminHistorial(token, params);
      setHistorial(r?.data || { data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
    } finally { setLoading(p => ({ ...p, historial: false })); }
  }

  async function loadDictamenes(p = 1) {
    setLoading(p => ({ ...p, dictamenes: true }));
    try {
      const r = await api.iaBecasAdminDictamenes(token, { page: p, limit: 20 });
      setDictamenes(r?.data || { data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
    } finally { setLoading(p => ({ ...p, dictamenes: false })); }
  }

  async function loadConvocatorias(p = 1) {
    setLoading(p => ({ ...p, convocatorias: true }));
    try {
      const params = { page: p, limit: 20, categoria: filtrosConv.categoria, activo: filtrosConv.activo >= 0 ? filtrosConv.activo : undefined };
      const r = await api.iaBecasAdminConvocatorias(token, params);
      setConvocatorias(r?.data || { data: [], categorias: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
      setFiltrosConv(f => ({ ...f, page: p }));
    } finally { setLoading(p => ({ ...p, convocatorias: false })); }
  }

  async function loadExportaciones(p = 1) {
    setLoading(p => ({ ...p, exportaciones: true }));
    try {
      const r = await api.iaBecasAdminExportaciones(token, { page: p, limit: 20 });
      setExportaciones(r?.data || { data: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
    } finally { setLoading(p => ({ ...p, exportaciones: false })); }
  }

  async function loadAuditoria(p = 1) {
    setLoading(p => ({ ...p, auditoria: true }));
    try {
      const params = { page: p, limit: 20, accion: filtrosAudit.accion, nivel: filtrosAudit.nivel, desde: filtrosAudit.desde, hasta: filtrosAudit.hasta };
      const r = await api.iaBecasAdminAuditoria(token, params);
      setAuditoria(r?.data || { data: [], acciones: [], niveles: [], paginacion: { page: 1, limit: 20, total: 0, total_paginas: 0 } });
      setFiltrosAudit(f => ({ ...f, page: p }));
    } finally { setLoading(p => ({ ...p, auditoria: false })); }
  }

  React.useEffect(() => {
    if (token) {
      if (activeTab === 'panel' || activeTab === 'metricas') loadMetricas();
      if (activeTab === 'solicitudes') loadSolicitudes();
      if (activeTab === 'historial') loadHistorial();
      if (activeTab === 'dictamenes') loadDictamenes();
      if (activeTab === 'convocatorias') loadConvocatorias();
      if (activeTab === 'exportaciones') loadExportaciones();
      if (activeTab === 'auditoria') loadAuditoria();
    }
  }, [activeTab, token]);

  const handleSolicitudDetalle = async (id) => {
    try {
      setLoading(p => ({ ...p, detalle: true }));
      const r = await api.iaBecasAdminSolicitud(token, id);
      setSolicitudDetalle(r?.data || null);
    } catch (err) {
      setError(err?.message || 'Error al cargar detalle');
    } finally { setLoading(p => ({ ...p, detalle: false })); }
  };

  const handleCambiarEstatus = async (id, estatus) => {
    try {
      await api.iaBecasAdminActualizarEstatus(token, id, { estatus });
      loadSolicitudes(filtros.page);
      if (solicitudDetalle?.id_solicitud === id) setSolicitudDetalle(null);
    } catch (err) {
      setError(err?.message || 'Error al actualizar estatus');
    }
  };

  const handleValidarCriterios = async (id) => {
    try {
      setLoading(p => ({ ...p, validar: true }));
      const r = await api.iaBecasAdminValidarCriterios(token, { id_solicitud: id });
      alert(r?.message || 'Validación completada');
      loadSolicitudes(filtros.page);
    } catch (err) {
      setError(err?.message || 'Error al validar criterios');
    } finally { setLoading(p => ({ ...p, validar: false })); }
  };

  const handleExportar = async (tipo_reporte, formato) => {
    try {
      setLoading(p => ({ ...p, exportar: true }));
      const r = await api.iaBecasAdminExportar(token, { tipo_reporte, formato });
      if (r?.ok) {
        alert(`Reporte generado: ${r.message}`);
        loadExportaciones();
      }
    } catch (err) {
      setError(err?.message || 'Error al exportar');
    } finally { setLoading(p => ({ ...p, exportar: false })); }
  };

  function renderPanelGeneral() {
    const m = metricas?.metricas || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Panel Administrativo • IA de Becas</div>
            <h1>Panel General de IA de Becas</h1>
            <p>Administración integral del proceso de becas con trazabilidad, control y respaldo institucional.</p>
          </div>
          <div className="hero-meta">
            <div className="meta-card">
              <small>Total solicitudes</small>
              <strong>{m.total_solicitudes ?? 0}</strong>
            </div>
            <div className="meta-card">
              <small>Aprobadas</small>
              <strong>{m.solicitudes_aprobadas ?? 0}</strong>
            </div>
            <div className="meta-card">
              <small>Pendientes</small>
              <strong>{m.solicitudes_pendientes ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div>
              <div className="stat-label">Convocatorias activas</div>
              <div className="stat-value">{m.total_convocatorias_activas ?? 0}</div>
              <div className="stat-hint">De {m.total_convocatorias ?? 0} totales</div>
            </div>
            <div className="stat-icon"><BookMarked size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Solicitudes</div>
              <div className="stat-value">{m.total_solicitudes ?? 0}</div>
              <div className="stat-hint">{m.solicitudes_pendientes ?? 0} pendientes</div>
            </div>
            <div className="stat-icon"><FileText size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Dictámenes</div>
              <div className="stat-value">{m.total_dictamenes ?? 0}</div>
              <div className="stat-hint">{m.dictamenes_aprobados ?? 0} aprobados</div>
            </div>
            <div className="stat-icon"><ClipboardCheck size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Monto asignado</div>
              <div className="stat-value">{formatCurrency(m.monto_total_asignado)}</div>
              <div className="stat-hint">{m.alumnos_beneficiados ?? 0} alumnos</div>
            </div>
            <div className="stat-icon"><Target size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Carreras participantes</div>
              <div className="stat-value">{m.carreras_participantes ?? 0}</div>
              <div className="stat-hint">Transversal</div>
            </div>
            <div className="stat-icon"><Users size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Eventos auditoría</div>
              <div className="stat-value">{m.total_eventos_auditoria ?? 0}</div>
              <div className="stat-hint">Trazabilidad completa</div>
            </div>
            <div className="stat-icon"><Shield size={22} /></div>
          </div>
        </div>

        <div className="two-col">
          <SectionCard title="Convocatorias destacadas" subtitle="Publicadas desde fuentes oficiales">
            <div className="list">
              {(metricas?.convocatorias_destacadas || []).length === 0 ? (
                <div className="empty">Sin convocatorias destacadas</div>
              ) : (metricas?.convocatorias_destacadas || []).map((c, i) => (
                <div key={c.id_convocatoria || i} className="list-item">
                  <strong>{c.titulo}</strong>
                  <span>{c.institucion} • {c.categoria}</span>
                  <small>{c.destacada ? '★ Destacada' : 'Convocatoria'}</small>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Solicitudes recientes" subtitle="Últimas 5 solicitudes">
            <div className="list">
              {(metricas?.solicitudes_recientes || []).length === 0 ? (
                <div className="empty">Sin solicitudes recientes</div>
              ) : (metricas?.solicitudes_recientes || []).map((s, i) => (
                <div key={s.id_solicitud || i} className="list-item">
                  <strong>{s.nombre_alumno}</strong>
                  <span className={estatusBadge(s.estatus_solicitud)}>{s.estatus_solicitud}</span>
                  <small>{s.convocatoria_titulo || 'Sin convocatoria'} • {formatDate(s.fecha_solicitud)}</small>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Acciones rápidas" subtitle="Supervisión y control centralizado">
          <div className="row gap wrap">
            <button className="btn primary" onClick={() => setActiveTab('solicitudes')}><FileText size={16} /> Gestionar solicitudes</button>
            <button className="btn secondary" onClick={() => setActiveTab('dictamenes')}><ClipboardCheck size={16} /> Dictámenes</button>
            <button className="btn secondary" onClick={() => setActiveTab('convocatorias')}><BookMarked size={16} /> Convocatorias</button>
            <button className="btn secondary" onClick={() => setActiveTab('exportaciones')}><Download size={16} /> Exportar reportes</button>
            <button className="btn secondary" onClick={() => setActiveTab('auditoria')}><Shield size={16} /> Auditoría</button>
            <button className="btn secondary" onClick={() => navigate('/app/ia/becas')}><ArrowLeft size={16} /> Asistente IA de becas</button>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderMetricas() {
    const i = indicadores || {};
    const m = i?.metricas || metricas?.metricas || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Tablero de métricas</div>
            <h1>Indicadores globales de becas</h1>
            <p>Análisis comprensivo por periodo, semestre, carrera y perfil académico.</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-label">Total solicitudes</div><div className="stat-value">{m.total_solicitudes ?? 0}</div></div><div className="stat-icon"><FileText size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Aprobadas</div><div className="stat-value">{m.solicitudes_aprobadas ?? 0}</div></div><div className="stat-icon"><CheckCircle2 size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Rechazadas</div><div className="stat-value">{m.solicitudes_rechazadas ?? 0}</div></div><div className="stat-icon"><XCircle size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Pendientes</div><div className="stat-value">{m.solicitudes_pendientes ?? 0}</div></div><div className="stat-icon"><Clock size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">En revisión</div><div className="stat-value">{m.solicitudes_en_revision ?? 0}</div></div><div className="stat-icon"><Eye size={22} /></div></div>
          <div className="stat-card"><div><div className="stat-label">Alumnos beneficiados</div><div className="stat-value">{m.alumnos_beneficiados ?? 0}</div></div><div className="stat-icon"><UserCheck size={22} /></div></div>
        </div>

        <div className="two-col">
          <SectionCard title="Por carrera" subtitle="Desglose de solicitudes por carrera">
            <div className="list">
              {(i?.desglose_por_carrera || []).length === 0 ? (
                <div className="empty">Sin datos por carrera</div>
              ) : (i?.desglose_por_carrera || []).map((c, idx) => (
                <div key={idx} className="list-item">
                  <strong>{c.nombre_carrera}</strong>
                  <span>{c.total_solicitudes} solicitudes • {c.aprobadas} aprobadas</span>
                  <small>Promedio grupo: {c.promedio_grupo ? Number(c.promedio_grupo).toFixed(2) : '—'}</small>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Por periodo" subtitle="Distribución por periodo académico">
            <div className="list">
              {(i?.desglose_por_periodo || []).length === 0 ? (
                <div className="empty">Sin datos por periodo</div>
              ) : (i?.desglose_por_periodo || []).map((p, idx) => (
                <div key={idx} className="list-item">
                  <strong>{p.periodo_nombre}</strong>
                  <span>{p.total_solicitudes} solicitudes</span>
                  <small>{p.aprobadas} aprobadas • {p.rechazadas} rechazadas</small>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Por convocatoria" subtitle="Rendimiento por programa de becas">
          <div className="list">
            {(i?.desglose_por_convocatoria || []).length === 0 ? (
              <div className="empty">Sin datos por convocatoria</div>
            ) : (i?.desglose_por_convocatoria || []).map((c, idx) => (
              <div key={idx} className="list-item">
                <strong>{c.titulo}</strong>
                <span>{c.institucion}</span>
                <small>{c.total_solicitudes} solicitudes • {c.aprobadas} aprobadas</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderSolicitudes() {
    const s = solicitudes?.data || [];
    const p = solicitudes?.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Gestión de solicitudes</div>
            <h1>Solicitudes de becas</h1>
            <p>Valida criterios, aprueba o rechaza solicitudes con apoyo de IA.</p>
          </div>
        </div>

        {solicitudDetalle && (
          <SectionCard title={`Detalle de solicitud #${solicitudDetalle.id_solicitud}`} subtitle={solicitudDetalle.nombre_alumno}>
            <div className="list">
              <div className="list-item"><strong>Código</strong><span>{solicitudDetalle.codigo_solicitud}</span></div>
              <div className="list-item"><strong>Alumno</strong><span>{solicitudDetalle.nombre_alumno} ({solicitudDetalle.matricula})</span></div>
              <div className="list-item"><strong>Carrera</strong><span>{solicitudDetalle.nombre_carrera} • Semestre {solicitudDetalle.semestre_actual}</span></div>
              <div className="list-item"><strong>Promedio</strong><span>{solicitudDetalle.promedio_actual ?? '—'} • Créditos: {solicitudDetalle.creditos_acumulados ?? '—'}</span></div>
              <div className="list-item"><strong>Convocatoria</strong><span>{solicitudDetalle.convocatoria_titulo || 'Sin convocatoria'}</span></div>
              <div className="list-item"><strong>Estatus</strong><span className={estatusBadge(solicitudDetalle.estatus_solicitud)}>{solicitudDetalle.estatus_solicitud}</span></div>
              <div className="list-item"><strong>Monto solicitado</strong><span>{formatCurrency(solicitudDetalle.monto_solicitado)}</span></div>
              {solicitudDetalle.monto_aprobado && <div className="list-item"><strong>Monto aprobado</strong><span>{formatCurrency(solicitudDetalle.monto_aprobado)}</span></div>}
              {solicitudDetalle.nota_solicitante && <div className="list-item"><strong>Nota del solicitante</strong><span>{solicitudDetalle.nota_solicitante}</span></div>}
              {solicitudDetalle.nota_revisor && <div className="list-item"><strong>Nota del revisor</strong><span>{solicitudDetalle.nota_revisor}</span></div>}
              <div className="list-item"><strong>Fecha solicitud</strong><span>{formatDate(solicitudDetalle.fecha_solicitud)}</span></div>
              {solicitudDetalle.fecha_resolucion && <div className="list-item"><strong>Fecha resolución</strong><span>{formatDate(solicitudDetalle.fecha_resolucion)}</span></div>}
            </div>

            <div className="row gap wrap" style={{ marginTop: '1rem' }}>
              {solicitudDetalle.estatus_solicitud === 'PENDIENTE' && (
                <button className="btn primary" onClick={() => handleCambiarEstatus(solicitudDetalle.id_solicitud, 'EN_REVISION')}><Eye size={16} /> Iniciar revisión</button>
              )}
              {['PENDIENTE', 'EN_REVISION'].includes(solicitudDetalle.estatus_solicitud) && (
                <button className="btn secondary" onClick={() => handleValidarCriterios(solicitudDetalle.id_solicitud)} disabled={loading.validar}>
                  {loading.validar ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  Validar criterios (IA)
                </button>
              )}
              {['EN_REVISION', 'VALIDADA'].includes(solicitudDetalle.estatus_solicitud) && (
                <>
                  <button className="btn primary" onClick={() => handleCambiarEstatus(solicitudDetalle.id_solicitud, 'APROBADA')}><CheckCircle2 size={16} /> Aprobar</button>
                  <button className="btn secondary" onClick={() => handleCambiarEstatus(solicitudDetalle.id_solicitud, 'RECHAZADA')}><XCircle size={16} /> Rechazar</button>
                </>
              )}
              <button className="btn secondary" onClick={() => setSolicitudDetalle(null)}><ArrowLeft size={16} /> Cerrar detalle</button>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Filtros" subtitle="Buscar y filtrar solicitudes">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label>Estatus</label>
              <select value={filtros.estatus} onChange={e => setFiltros(f => ({ ...f, estatus: e.target.value }))}>
                {ESTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 2, minWidth: 250 }}>
              <label>Buscar</label>
              <input type="text" value={filtros.busqueda} onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))} placeholder="Nombre, matrícula o código" />
            </div>
            <button className="btn primary" onClick={() => loadSolicitudes(1)}><Search size={16} /> Buscar</button>
          </div>
        </SectionCard>

        <SectionCard title={`Solicitudes (${p.total || 0})`} subtitle={`Página ${p.page || 1} de ${p.total_paginas || 1}`}>
          {loading.solicitudes ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : s.length === 0 ? (
            <div className="empty">No hay solicitudes registradas</div>
          ) : (
            <div className="list">
              {s.map((item) => (
                <div key={item.id_solicitud} className="list-item" style={{ cursor: 'pointer' }} onClick={() => handleSolicitudDetalle(item.id_solicitud)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{item.nombre_alumno}</strong>
                      <span>{item.matricula} • {item.nombre_carrera || 'Sin carrera'}</span>
                      <small>{item.convocatoria_titulo || 'Sin convocatoria'} • {formatDate(item.fecha_solicitud)}</small>
                    </div>
                    <span className={estatusBadge(item.estatus_solicitud)} style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}>{item.estatus_solicitud}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {p.total_paginas > 1 && (
            <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadSolicitudes(p.page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
              <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadSolicitudes(p.page + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderHistorial() {
    const h = historial?.data || [];
    const p = historial?.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Historial de solicitudes</div>
            <h1>Historial completo</h1>
            <p>Trazabilidad total de solicitudes, dictámenes y resoluciones.</p>
          </div>
        </div>

        <div className="form-field" style={{ maxWidth: 400 }}>
          <label>Filtrar por estatus</label>
          <select value={filtros.estatus} onChange={e => { setFiltros(f => ({ ...f, estatus: e.target.value })); loadHistorial(1); }}>
            {ESTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SectionCard title={`Registros (${p.total || 0})`} subtitle={`Página ${p.page || 1}`}>
          {loading.historial ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : h.length === 0 ? (
            <div className="empty">Sin registros históricos</div>
          ) : (
            <div className="list">
              {h.map((item, idx) => (
                <div key={item.id_solicitud || idx} className="list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <strong>{item.nombre_alumno}</strong>
                      <span>{item.matricula} • {item.nombre_carrera || '—'} • Sem {item.semestre_actual || '—'}</span>
                      <small style={{ display: 'block' }}>{item.convocatoria_titulo || 'Sin convocatoria'}</small>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <span className={estatusBadge(item.estatus_solicitud)}>{item.estatus_solicitud}</span>
                      {item.tipo_dictamen && <div><span className="badge">{item.tipo_dictamen}</span></div>}
                      <small style={{ display: 'block', marginTop: '0.25rem' }}>{formatDate(item.fecha_solicitud)}</small>
                    </div>
                  </div>
                  {item.fundamento && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>Fundamento: {item.fundamento}</div>}
                </div>
              ))}
            </div>
          )}

          {p.total_paginas > 1 && (
            <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadHistorial(p.page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
              <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadHistorial(p.page + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderDictamenes() {
    const d = dictamenes?.data || [];
    const p = dictamenes?.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Dictámenes de becas</div>
            <h1>Resoluciones y dictámenes</h1>
            <p>Aprobación, rechazo o condicionamiento de solicitudes con respaldo institucional.</p>
          </div>
        </div>

        <SectionCard title={`Dictámenes (${p.total || 0})`} subtitle={`Página ${p.page || 1}`}>
          {loading.dictamenes ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : d.length === 0 ? (
            <div className="empty">No hay dictámenes registrados. Aprueba o rechaza solicitudes desde la sección Solicitudes.</div>
          ) : (
            <div className="list">
              {d.map((item, idx) => (
                <div key={item.id_dictamen || idx} className="list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <strong>{item.nombre_alumno}</strong>
                      <span>{item.matricula} • {item.nombre_carrera || '—'}</span>
                      <small>{item.convocatoria_titulo || '—'} • Dictaminó: {item.nombre_dictamina}</small>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <span className={estatusBadge(item.tipo_dictamen === 'APROBADA' ? 'APROBADA' : item.tipo_dictamen === 'RECHAZADA' ? 'RECHAZADA' : 'VALIDADA')}>{item.tipo_dictamen}</span>
                      <div><small>{formatCurrency(item.monto_asignado)}</small></div>
                      <small>{formatDate(item.fecha_dictamen)}</small>
                      {item.validado_por_ia ? <div><small className="badge success">Validado por IA</small></div> : null}
                    </div>
                  </div>
                  {item.fundamento && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>{item.fundamento}</div>}
                </div>
              ))}
            </div>
          )}

          {p.total_paginas > 1 && (
            <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadDictamenes(p.page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
              <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadDictamenes(p.page + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderConvocatorias() {
    const c = convocatorias?.data || [];
    const cats = convocatorias?.categorias || [];
    const p = convocatorias?.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Convocatorias de becas</div>
            <h1>Publicaciones oficiales</h1>
            <p>Convocatorias del Gobierno del Estado de México, COMECYT, BBVA, Santander y becas en el extranjero.</p>
          </div>
        </div>

        <SectionCard title="Filtros">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label>Categoría</label>
              <select value={filtrosConv.categoria} onChange={e => setFiltrosConv(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Todas</option>
                {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Estado</label>
              <select value={filtrosConv.activo} onChange={e => setFiltrosConv(f => ({ ...f, activo: Number(e.target.value) }))}>
                <option value={-1}>Todas</option>
                <option value={1}>Activas</option>
                <option value={0}>Inactivas</option>
              </select>
            </div>
            <button className="btn primary" onClick={() => loadConvocatorias(1)}><Filter size={16} /> Filtrar</button>
          </div>
        </SectionCard>

        <SectionCard title={`Convocatorias (${p.total || 0})`} subtitle={`Página ${p.page || 1} de ${p.total_paginas || 1}`}>
          {loading.convocatorias ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : c.length === 0 ? (
            <div className="empty">No hay convocatorias registradas</div>
          ) : (
            <div className="list">
              {c.map((item, idx) => (
                <div key={item.id_convocatoria || idx} className="list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.titulo}</strong>
                      <span>{item.institucion} • {item.categoria}</span>
                      <small style={{ display: 'block' }}>{item.alcance || '—'} • {item.vigencia_texto || 'Consultar vigencia'}</small>
                      {item.destacada ? <small className="badge success">★ Destacada</small> : null}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <span className={item.activo ? 'badge success' : 'badge' }>{item.activo ? 'Activa' : 'Inactiva'}</span>
                      {item.url_oficial && (
                        <div><a href={item.url_oficial} target="_blank" rel="noreferrer" className="btn secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginTop: '0.25rem' }}><ExternalLink size={12} /> Sitio</a></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {p.total_paginas > 1 && (
            <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadConvocatorias(p.page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
              <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadConvocatorias(p.page + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderExportaciones() {
    const e = exportaciones?.data || [];
    const p = exportaciones?.paginacion || {};
    const tipos = [
      { value: 'SOLICITUDES', label: 'Solicitudes' },
      { value: 'DICTAMENES', label: 'Dictámenes' },
      { value: 'CONVOCATORIAS', label: 'Convocatorias' },
      { value: 'AUDITORIA', label: 'Auditoría' },
      { value: 'METRICAS', label: 'Métricas' },
      { value: 'GENERAL', label: 'General' }
    ];
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Exportaciones</div>
            <h1>Exportar reportes</h1>
            <p>Genera reportes en PDF, XLSX o CSV con filtros aplicados.</p>
          </div>
        </div>

        <SectionCard title="Generar nuevo reporte" subtitle="Selecciona tipo y formato">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label>Tipo de reporte</label>
              <select id="tipo_reporte">
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Formato</label>
              <select id="formato_reporte">
                <option value="PDF">PDF</option>
                <option value="XLSX">XLSX (Excel)</option>
                <option value="CSV">CSV</option>
              </select>
            </div>
            <button className="btn primary" onClick={() => {
              const tipo = document.getElementById('tipo_reporte').value;
              const formato = document.getElementById('formato_reporte').value;
              handleExportar(tipo, formato);
            }} disabled={loading.exportar}>
              {loading.exportar ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Generar reporte
            </button>
          </div>
        </SectionCard>

        <SectionCard title={`Exportaciones realizadas (${p.total || 0})`}>
          {loading.exportaciones ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : e.length === 0 ? (
            <div className="empty">No hay exportaciones registradas</div>
          ) : (
            <div className="list">
              {e.map((item, idx) => (
                <div key={item.id_exportacion || idx} className="list-item">
                  <strong>{item.tipo_reporte}</strong>
                  <span>{item.formato} • {item.total_registros} registros</span>
                  <small>{item.nombre_usuario} • {formatDate(item.fecha_generacion)}</small>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderAuditoria() {
    const a = auditoria?.data || [];
    const accs = auditoria?.acciones || [];
    const nvs = auditoria?.niveles || [];
    const p = auditoria?.paginacion || {};
    return (
      <div className="stack">
        <div className="hero-banner">
          <div>
            <div className="badge light">Auditoría de eventos</div>
            <h1>Auditoría del módulo de becas</h1>
            <p>Trazabilidad completa de todas las acciones realizadas en el módulo.</p>
            <small>Total de eventos: {p.total || 0}</small>
          </div>
        </div>

        <SectionCard title="Filtros de auditoría">
          <div className="row gap wrap" style={{ alignItems: 'end' }}>
            <div className="form-field" style={{ flex: 1, minWidth: 180 }}>
              <label>Acción</label>
              <select value={filtrosAudit.accion} onChange={e => setFiltrosAudit(f => ({ ...f, accion: e.target.value }))}>
                <option value="">Todas</option>
                {accs.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 130 }}>
              <label>Nivel</label>
              <select value={filtrosAudit.nivel} onChange={e => setFiltrosAudit(f => ({ ...f, nivel: e.target.value }))}>
                <option value="">Todos</option>
                {nvs.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Desde</label>
              <input type="date" value={filtrosAudit.desde} onChange={e => setFiltrosAudit(f => ({ ...f, desde: e.target.value }))} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Hasta</label>
              <input type="date" value={filtrosAudit.hasta} onChange={e => setFiltrosAudit(f => ({ ...f, hasta: e.target.value }))} />
            </div>
            <button className="btn primary" onClick={() => loadAuditoria(1)}><Filter size={16} /> Filtrar</button>
          </div>
        </SectionCard>

        <SectionCard title={`Eventos de auditoría (${p.total || 0})`}>
          {loading.auditoria ? (
            <div className="flex-center"><Loader2 className="animate-spin" size={24} /></div>
          ) : a.length === 0 ? (
            <div className="empty">No hay eventos de auditoría registrados</div>
          ) : (
            <div className="list">
              {a.map((item, idx) => (
                <div key={item.id_auditoria || idx} className="list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.accion}</strong>
                      <span>{item.descripcion || 'Sin descripción'}</span>
                      <small style={{ display: 'block' }}>{item.nombre_usuario || 'Sistema'} • {item.entidad_tipo} #{item.entidad_id || '—'}</small>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 110 }}>
                      <span className={getNivel(item.nivel)}>{item.nivel || 'INFO'}</span>
                      <small style={{ display: 'block', marginTop: '0.25rem' }}>{formatDate(item.created_at)}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {p.total_paginas > 1 && (
            <div className="row gap" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <button className="btn secondary" disabled={p.page <= 1} onClick={() => loadAuditoria(p.page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem' }}>{p.page} / {p.total_paginas}</span>
              <button className="btn secondary" disabled={p.page >= p.total_paginas} onClick={() => loadAuditoria(p.page + 1)}>Siguiente</button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="hero-banner" style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <div className="badge light">Administración • IA de Becas</div>
            <h2 style={{ margin: '0.25rem 0' }}>Módulo de Administración de Becas</h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
              {fullName} • Acceso total de lectura y control • Supervisión y autorización final
            </p>
          </div>
          <button className="btn secondary" onClick={() => navigate('/app/ia/becas')} style={{ whiteSpace: 'nowrap' }}>
            <ArrowLeft size={16} /> Asistente IA
          </button>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ fontSize: '0.85rem' }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} />
          {error}
          <button className="btn secondary" style={{ marginLeft: '1rem' }} onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {activeTab === 'panel' && renderPanelGeneral()}
      {activeTab === 'metricas' && renderMetricas()}
      {activeTab === 'solicitudes' && renderSolicitudes()}
      {activeTab === 'historial' && renderHistorial()}
      {activeTab === 'dictamenes' && renderDictamenes()}
      {activeTab === 'convocatorias' && renderConvocatorias()}
      {activeTab === 'exportaciones' && renderExportaciones()}
      {activeTab === 'auditoria' && renderAuditoria()}
    </div>
  );
}
