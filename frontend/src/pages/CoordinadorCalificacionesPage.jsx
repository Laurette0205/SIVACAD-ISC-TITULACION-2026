/**
 * SIVACAD-ISC — Tablero de Seguimiento Académico (Coordinador)
 * Monitoreo en tiempo real del avance de calificaciones por periodo
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Loader2, AlertTriangle, CheckCircle2,
  RefreshCw, Eye, ChevronDown, ChevronUp, AlertCircle, Filter,
  Users, BookOpen, Clock, TrendingUp, XCircle, Calendar, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ESTADO_COLORS = {
  'SIN_DATOS': { bg: 'var(--badge-gray-bg, #f3f4f6)', text: 'var(--badge-gray-text, #6b7280)', label: 'Sin datos' },
  'BORRADOR': { bg: 'var(--badge-yellow-bg, #fef3c7)', text: 'var(--badge-yellow-text, #92400e)', label: 'Borrador' },
  'EN_PROCESO': { bg: 'var(--badge-blue-bg, #dbeafe)', text: 'var(--badge-blue-text, #1e40af)', label: 'En proceso' },
  'VALIDADA': { bg: 'var(--badge-green-bg, #d1fae5)', text: 'var(--badge-green-text, #065f46)', label: 'Validada' },
  'PUBLICADA': { bg: 'var(--badge-green-bg, #d1fae5)', text: 'var(--badge-green-text, #065f46)', label: 'Publicada' },
  'CERRADA': { bg: 'var(--badge-gray-bg, #f3f4f6)', text: 'var(--badge-gray-text, #374151)', label: 'Cerrada' }
};

const PERIODO_ESTADO_STYLES = {
  'Activo': { bg: 'var(--accent-primary, #1e40af)', text: '#fff', glow: true },
  'Cerrado': { bg: 'var(--badge-gray-bg, #e5e7eb)', text: 'var(--badge-gray-text, #6b7280)', glow: false },
  'Proximo': { bg: 'var(--badge-yellow-bg, #fef3c7)', text: 'var(--badge-yellow-text, #92400e)', glow: false },
  'Inactivo': { bg: 'var(--badge-gray-bg, #f3f4f6)', text: 'var(--text-secondary, #9ca3af)', glow: false }
};

const ALERTA_ICONS = {
  'DOCENTE_PENDIENTE': Clock,
  'GRUPO_INCOMPLETO': XCircle,
  'ALUMNO_SIN_CALIFICACION': Users,
  'CALIFICACION_MODIFICADA': RefreshCw,
  'PERIODO_CIERRE': Calendar
};

const ALERTA_COLORS = {
  'CRITICO': { bg: 'var(--alert-critical-bg, #fef2f2)', border: 'var(--alert-critical-border, #dc2626)', text: 'var(--alert-critical-text, #991b1b)' },
  'ALTO': { bg: 'var(--alert-high-bg, #fef3c7)', border: 'var(--alert-high-border, #f59e0b)', text: 'var(--alert-high-text, #92400e)' },
  'MEDIO': { bg: 'var(--alert-medium-bg, #eff6ff)', border: 'var(--alert-medium-border, #3b82f6)', text: 'var(--alert-medium-text, #1e40af)' },
  'BAJO': { bg: 'var(--alert-low-bg, #f9fafb)', border: 'var(--alert-low-border, #d1d5db)', text: 'var(--alert-low-text, #374151)' }
};

function ParcialBar({ capturados, total, label }) {
  const pct = total > 0 ? Math.round((capturados / total) * 100) : 0;
  const color = pct === 100 ? 'var(--success, #059669)' : pct > 0 ? 'var(--warning, #f59e0b)' : 'var(--danger, #dc2626)';
  return (
    <div style={{ textAlign: 'center', minWidth: 70 }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ width: '100%', height: 6, background: 'var(--progress-bg, #e5e7eb)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '0.65rem', marginTop: 2, color }}>{capturados}/{total}</div>
    </div>
  );
}

export default function CoordinadorCalificacionesPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [periodos, setPeriodos] = useState([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState(null);
  const [tablero, setTablero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTablero, setLoadingTablero] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Filtros
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [filtroSemestre, setFiltroSemestre] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);

  // Alertas expandidas
  const [alertasExpandidas, setAlertasExpandidas] = useState(true);

  const clearFeedback = useCallback(() => { setTimeout(() => setFeedback(null), 5000); }, []);

  // Cargar periodos
  const loadPeriodos = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) { navigate('/login', { replace: true }); return; }
      const data = await api.request('/periodos', { token });
      const list = data?.data || data || [];
      setPeriodos(list);
      const activo = list.find(p => p.estado === 'Activo');
      setSelectedPeriodo(acto ? activo.id_periodo : list[0]?.id_periodo || null);
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
    } finally { setLoading(false); }
  }, [token, navigate]);

  // Cargar tablero
  const loadTablero = useCallback(async () => {
    if (!selectedPeriodo) return;
    try {
      setLoadingTablero(true);
      const data = await api.request(`/cal-seguimiento/tablero/${selectedPeriodo}`, { token });
      setTablero(data);
    } catch (err) {
      console.error('Error tablero:', err);
    } finally { setLoadingTablero(false); }
  }, [token, selectedPeriodo]);

  useEffect(() => { loadPeriodos(); }, [loadPeriodos]);
  useEffect(() => { loadTablero(); }, [loadTablero]);

  const handleRecalcular = async () => {
    if (!tablero?.filas?.length) return;
    try {
      setFeedback({ type: 'info', message: 'Recalculando...' });
      const grupos = [...new Set(tablero.filas.map(f => f.id_grupo))];
      for (const idGrupo of grupos) {
        await api.request('/cal-seguimiento/recalcular', {
          token, method: 'POST', body: { idGrupo, idPeriodo: selectedPeriodo }
        });
      }
      setFeedback({ type: 'success', message: 'Tablero recalculado correctamente' });
      clearFeedback();
      await loadTablero();
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error recalculando' });
      clearFeedback();
    }
  };

  // Listas únicas para filtros
  const grupos = useMemo(() => {
    if (!tablero?.filas) return [];
    const map = new Map();
    for (const f of tablero.filas) map.set(f.id_grupo, f.nombre_grupo);
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [tablero]);

  const docentes = useMemo(() => {
    if (!tablero?.filas) return [];
    const map = new Map();
    for (const f of tablero.filas) map.set(f.id_docente, f.nombre_docente);
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [tablero]);

  const materias = useMemo(() => {
    if (!tablero?.filas) return [];
    const map = new Map();
    for (const f of tablero.filas) map.set(f.id_materia, f.nombre_materia);
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [tablero]);

  const semestres = useMemo(() => {
    if (!tablero?.filas) return [];
    return [...new Set(tablero.filas.map(f => f.semestre))].sort((a, b) => a - b);
  }, [tablero]);

  // Filtrado
  const filasFiltradas = useMemo(() => {
    if (!tablero?.filas) return [];
    return tablero.filas.filter(f => {
      if (filtroGrupo && String(f.id_grupo) !== filtroGrupo) return false;
      if (filtroDocente && String(f.id_docente) !== filtroDocente) return false;
      if (filtroMateria && String(f.id_materia) !== filtroMateria) return false;
      if (filtroSemestre && String(f.semestre) !== filtroSemestre) return false;
      if (filtroEstado && f.estado_predominante !== filtroEstado) return false;
      return true;
    });
  }, [tablero, filtroGrupo, filtroDocente, filtroMateria, filtroSemestre, filtroEstado]);

  const hasFiltros = filtroGrupo || filtroDocente || filtroMateria || filtroSemestre || filtroEstado;

  const periodoSeleccionado = periodos.find(p => p.id_periodo === selectedPeriodo);

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando datos...</div>;
  }

  const resumen = tablero?.resumen || {};
  const alertas = tablero?.alertas || [];

  return (
    <div className="page-container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}><BarChart3 size={20} /> Tablero de Seguimiento Académico</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Avance de calificaciones por periodo — Coordinador ISC
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleRecalcular}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <RefreshCw size={14} /> Recalcular
        </button>
      </div>

      {feedback && (
        <div className={`alert alert-${feedback.type === 'error' ? 'error' : feedback.type === 'success' ? 'success' : ''}`}
          style={{ marginBottom: '1rem' }}>
          {feedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {feedback.message}
        </div>
      )}

      {/* Selector de periodo mejorado */}
      <div className="section-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Periodo:
          </label>
          <select value={selectedPeriodo || ''} onChange={e => setSelectedPeriodo(Number(e.target.value))}
            style={{
              padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)',
              fontSize: '0.85rem', background: 'var(--bg-primary)', color: 'var(--text-primary)',
              minWidth: 220
            }}>
            {periodos.map(p => {
              const estado = PERIODO_ESTADO_STYLES[p.estado] || PERIODO_ESTADO_STYLES['Inactivo'];
              return (
                <option key={p.id_periodo} value={p.id_periodo}>
                  {p.nombre_periodo} — {p.estado || 'Sin estado'}
                </option>
              );
            })}
          </select>
          {periodoSeleccionado && (
            <span style={{
              fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 600,
              background: (PERIODO_ESTADO_STYLES[periodoSeleccionado.estado] || PERIODO_ESTADO_STYLES['Inactivo']).bg,
              color: (PERIODO_ESTADO_STYLES[periodoSeleccionado.estado] || PERIODO_ESTADO_STYLES['Inactivo']).text
            }}>
              {periodoSeleccionado.estado || 'Sin estado'}
            </span>
          )}
          <button className="btn btn-ghost" onClick={() => setShowFiltros(!showFiltros)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
            <Filter size={14} /> Filtros {hasFiltros && <span style={{ background: 'var(--accent-primary, #1e40af)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>●</span>}
          </button>
          {hasFiltros && (
            <button className="btn btn-ghost" onClick={() => { setFiltroGrupo(''); setFiltroDocente(''); setFiltroMateria(''); setFiltroSemestre(''); setFiltroEstado(''); }}
              style={{ fontSize: '0.8rem', color: 'var(--danger, #dc2626)' }}>
              Limpiar filtros
            </button>
          )}
          <div style={{ flex: 1 }} />
          {resumen.dias_restantes_periodo != null && (
            <span style={{
              fontSize: '0.8rem',
              color: resumen.dias_restantes_periodo <= 5 ? 'var(--danger, #dc2626)' : 'var(--text-secondary, #6b7280)'
            }}>
              <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {resumen.dias_restantes_periodo > 0 ? `${resumen.dias_restantes_periodo} días para cierre` : 'Periodo cerrado'}
            </span>
          )}
        </div>

        {/* Panel de filtros expandible */}
        {showFiltros && (
          <div style={{
            marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)',
            borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.5rem', border: '1px solid var(--border)'
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--text-primary)' }}>Grupo</label>
              <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="">Todos</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--text-primary)' }}>Docente</label>
              <select value={filtroDocente} onChange={e => setFiltroDocente(e.target.value)} style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="">Todos</option>
                {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--text-primary)' }}>Materia</label>
              <select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)} style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="">Todas</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--text-primary)' }}>Semestre</label>
              <select value={filtroSemestre} onChange={e => setFiltroSemestre(e.target.value)} style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="">Todos</option>
                {semestres.map(s => <option key={s} value={s}>{s}°</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--text-primary)' }}>Estado</label>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="">Todos</option>
                <option value="SIN_DATOS">Sin datos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="VALIDADA">Validada</option>
                <option value="PUBLICADA">Publicada</option>
                <option value="CERRADA">Cerrada</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Resumen general */}
      {resumen.total_materias > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            { label: 'Grupos', value: resumen.total_grupos, icon: Users, color: 'var(--accent-primary, #1e40af)' },
            { label: 'Docentes', value: resumen.total_docentes, icon: Users, color: 'var(--info, #7c3aed)' },
            { label: 'Materias', value: resumen.total_materias, icon: BookOpen, color: 'var(--text-primary, #374151)' },
            { label: 'Alumnos', value: resumen.total_alumnos, icon: Users, color: 'var(--success, #059669)' },
            { label: '% Captura', value: `${resumen.porcentaje_general}%`, icon: TrendingUp, color: resumen.porcentaje_general >= 80 ? 'var(--success, #059669)' : resumen.porcentaje_general >= 50 ? 'var(--warning, #f59e0b)' : 'var(--danger, #dc2626)' },
            { label: 'Completas', value: resumen.materias_completas, icon: CheckCircle2, color: 'var(--success, #059669)' },
            { label: 'En proceso', value: resumen.materias_en_proceso, icon: Clock, color: 'var(--warning, #f59e0b)' },
            { label: 'Sin datos', value: resumen.materias_sin_datos, icon: XCircle, color: 'var(--danger, #dc2626)' },
            { label: 'Pendientes', value: resumen.total_pendientes, icon: AlertCircle, color: 'var(--warning-dark, #d97706)' },
            { label: 'Cambios', value: resumen.total_modificaciones, icon: RefreshCw, color: 'var(--text-secondary, #6b7280)' }
          ].map((item, i) => (
            <div key={i} className="section-card" style={{ textAlign: 'center', padding: '0.6rem', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="section-card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--warning, #f59e0b)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setAlertasExpandidas(!alertasExpandidas)}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Bell size={16} style={{ color: 'var(--warning, #f59e0b)' }} /> Alertas ({alertas.length})
            </h3>
            {alertasExpandidas ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
          </div>
          {alertasExpandidas && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alertas.map((a, i) => {
                const colors = ALERTA_COLORS[a.nivel] || ALERTA_COLORS['BAJO'];
                const IconComp = ALERTA_ICONS[a.tipo] || AlertCircle;
                return (
                  <div key={i} style={{ padding: '0.6rem 0.8rem', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <IconComp size={16} style={{ color: colors.border, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: colors.text }}>{a.titulo}</div>
                      <div style={{ fontSize: '0.78rem', color: colors.text, opacity: 0.8 }}>{a.descripcion}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '9999px', background: colors.border, color: 'white', fontWeight: 600, flexShrink: 0 }}>
                      {a.nivel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabla principal */}
      {loadingTablero ? (
        <div className="section-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-primary)' }}>
          <Loader2 size={24} className="spin" /> Cargando tablero...
        </div>
      ) : (
        <div className="section-card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Detalle por Grupo / Materia / Docente</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {filasFiltradas.length} registro(s)
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['Grupo', 'Materia', 'Docente', 'Alumnos', 'P1', 'P2', 'P3', 'Promedio', 'Pendientes', 'Cambios', 'Estado'].map(h => (
                    <th key={h} style={{
                      padding: '0.5rem 0.4rem', textAlign: h === 'Grupo' || h === 'Materia' || h === 'Docente' ? 'left' : 'center',
                      position: 'sticky', top: 0, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      borderBottom: '2px solid var(--border)'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f, i) => {
                  const estadoInfo = ESTADO_COLORS[f.estado_predominante] || ESTADO_COLORS['SIN_DATOS'];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {f.nombre_grupo}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{f.turno}</div>
                      </td>
                      <td style={{ padding: '0.4rem', color: 'var(--text-primary)' }}>{f.nombre_materia}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{f.nombre_docente}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{f.total_alumnos}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <ParcialBar capturados={f.p1_capturados} total={f.total_alumnos} label="P1" />
                      </td>
                      <td style={{ padding: '0.4rem' }}>
                        <ParcialBar capturados={f.p2_capturados} total={f.total_alumnos} label="P2" />
                      </td>
                      <td style={{ padding: '0.4rem' }}>
                        <ParcialBar capturados={f.p3_capturados} total={f.total_alumnos} label="P3" />
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                        {f.promedio_grupal != null ? (
                          <span style={{ color: Number(f.promedio_grupal) >= 6 ? 'var(--success, #059669)' : 'var(--danger, #dc2626)' }}>
                            {Number(f.promedio_grupal).toFixed(1)}
                          </span>
                        ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        {f.calificaciones_pendientes > 0 ? (
                          <span style={{ color: 'var(--danger, #dc2626)', fontWeight: 600 }}>{f.calificaciones_pendientes}</span>
                        ) : (
                          <span style={{ color: 'var(--success, #059669)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        {f.modificaciones > 0 ? (
                          <span style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600 }}>{f.modificaciones}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '9999px',
                          background: estadoInfo.bg, color: estadoInfo.text, fontWeight: 600
                        }}>
                          {estadoInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filasFiltradas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>No hay datos para los filtros seleccionados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
