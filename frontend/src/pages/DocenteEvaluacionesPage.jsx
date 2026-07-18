import React from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import {
  BarChart3, TrendingUp, MessageSquareText, History, Download,
  Eye, RefreshCw, Loader2, FileText, CheckCircle2,
  Clock, Star, AlertCircle, ChevronRight, ArrowLeft,
  CalendarRange, Activity, Users, PieChart, Sparkles
} from 'lucide-react';

const TEACHER_TABS = [
  { key: 'resultados', label: 'Resultados recibidos', icon: BarChart3 },
  { key: 'comparativos', label: 'Comparativos por periodo', icon: CalendarRange },
  { key: 'evolucion', label: 'Evolución histórica', icon: TrendingUp },
  { key: 'retroalimentacion', label: 'Retroalimentación', icon: MessageSquareText }
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeArray(payload, keys = ['data', 'resultados', 'items', 'retroalimentacion', 'evaluaciones']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function statusColor(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return '#059669';
  if (s.includes('CERR') || s.includes('FIN')) return '#2563eb';
  if (s.includes('VALID')) return '#059669';
  if (s.includes('RECHA')) return '#e11d48';
  if (s.includes('CANC')) return '#e11d48';
  return '#64748b';
}

function statusBg(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return 'rgba(16,185,129,0.10)';
  if (s.includes('VALID')) return 'rgba(16,185,129,0.10)';
  if (s.includes('CERR') || s.includes('FIN')) return 'rgba(37,99,235,0.10)';
  if (s.includes('RECHA')) return 'rgba(225,29,72,0.10)';
  if (s.includes('CANC')) return 'rgba(225,29,72,0.10)';
  return 'rgba(100,116,139,0.10)';
}

function renderStatusBadge(status) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, background: statusBg(status), color: statusColor(status) }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(status), display: 'inline-block' }} />
      {status}
    </span>
  );
}

function MiniBar({ value, max = 5, color = '#2563eb', label }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {label && <small style={{ minWidth: 120, fontSize: '0.8rem' }}>{label}</small>}
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <small style={{ minWidth: 30, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>{value.toFixed(1)}</ small>
    </div>
  );
}

const INSTRUMENT_LABELS = {
  'DOCENTE_POR_ALUMNOS': 'Docente por alumnos',
  'ALUMNO_POR_DOCENTES': 'Alumno por docentes',
  'POR_GRUPO': 'Por grupo',
  'POR_PERIODO': 'Por periodo',
  'POR_MATERIA': 'Por materia'
};

export default function DocenteEvaluacionesPage() {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('resultados');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [resultados, setResultados] = React.useState([]);
  const [resultadoDetalle, setResultadoDetalle] = React.useState(null);
  const [comparativos, setComparativos] = React.useState(null);
  const [evolucion, setEvolucion] = React.useState(null);
  const [retroalimentacion, setRetroalimentacion] = React.useState([]);

  const cargarResultados = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.resultadosDocente(token);
      setResultados(safeArray(res, ['data', 'resultados']));
    } catch (err) { console.error(err); setResultados([]); }
  }, [token]);

  const cargarComparativos = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.comparativosDocente(token);
      setComparativos(res?.data || null);
    } catch (err) { console.error(err); setComparativos(null); }
  }, [token]);

  const cargarEvolucion = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.evolucionDocente(token);
      setEvolucion(res?.data || null);
    } catch (err) { console.error(err); setEvolucion(null); }
  }, [token]);

  const cargarRetroalimentacion = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.retroalimentacionDocente(token);
      setRetroalimentacion(safeArray(res, ['data', 'retroalimentacion']));
    } catch (err) { console.error(err); setRetroalimentacion([]); }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true); setError('');
    await Promise.all([cargarResultados(), cargarComparativos(), cargarEvolucion(), cargarRetroalimentacion()]);
    setLoading(false);
  }, [cargarResultados, cargarComparativos, cargarEvolucion, cargarRetroalimentacion]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const verDetalle = async (idResultado) => {
    try {
      setError('');
      const res = await api.resultadoDocenteDetalle(token, idResultado);
      setResultadoDetalle(res?.data || null);
      setActiveTab('resultados');
    } catch (err) {
      setError(err?.message || 'Error al cargar detalle');
    }
  };

  const descargarReporte = async (idResultado) => {
    try {
      const res = await api.reporteDocente(token, idResultado);
      const blob = new Blob([JSON.stringify(res?.data || res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-docente-${idResultado}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Reporte descargado correctamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err?.message || 'Error al descargar reporte');
    }
  };

  const promedioGeneral = React.useMemo(() => {
    if (!resultados.length) return 0;
    return resultados.reduce((s, r) => s + Number(r.promedio_final || 0), 0) / resultados.length;
  }, [resultados]);

  const resultadosCount = resultados.length;

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><BarChart3 size={14} /> Evaluaciones | Docente</div>
          <h1>Mis evaluaciones docentes</h1>
          <p>Consulta tus resultados, compara tu desempeño entre periodos, revisa la retroalimentación y descarga reportes personales.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Evaluaciones recibidas</small><strong>{resultadosCount}</strong></div>
          <div className="meta-card"><small>Promedio general</small><strong>{promedioGeneral.toFixed(2)}</strong></div>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {!resultadoDetalle && (
        <>
          <div className="eval-tabs" style={{ display: 'flex', gap: 4, overflow: 'auto', padding: '0 0 1rem' }}>
            {TEACHER_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setError(''); }}
                  className={`eval-tab ${activeTab === tab.key ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button type="button" className="btn secondary" onClick={loadAll} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', marginLeft: 'auto' }}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} /> Cargando datos...
            </div>
          )}

          {activeTab === 'resultados' && !loading && (
            <SectionCard title="Resultados recibidos" subtitle="Evaluaciones aplicadas a tu desempeño docente">
              {resultados.length === 0 ? (
                <div className="empty"><FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} /> Aún no tienes resultados registrados.</div>
              ) : (
                <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
                  {resultados.map(r => (
                    <div key={r.id_resultado} className="list-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{r.evaluacion_titulo}</strong>
                          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {r.nombre_periodo && <small className="muted">{r.nombre_periodo}</small>}
                            {renderStatusBadge(r.estado_validacion || 'NO_VALIDADO')}
                            <small className="muted">{r.tipo_instrumento ? (INSTRUMENT_LABELS[normalize(r.tipo_instrumento)] || r.tipo_instrumento) : ''}</small>
                          </span>
                          {r.observacion_general && <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>{r.observacion_general}</small>}
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                            <small>Creado: {r.creado_en ? new Date(r.creado_en).toLocaleDateString() : '—'}</small>
                            {r.validado_por_nombre && <small className="muted">Validado por: {r.validado_por_nombre}</small>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                            {Number(r.promedio_final || 0).toFixed(1)}
                          </div>
                          <small className="muted">/ {r.escala || '5'}</small>
                          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                            <button className="btn-sm btn-edit" onClick={() => verDetalle(r.id_resultado)} title="Ver detalle">
                              <Eye size={12} /> Detalle
                            </button>
                            <button className="btn-sm" style={{ background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.22)' }}
                              onClick={() => descargarReporte(r.id_resultado)} title="Descargar reporte">
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'comparativos' && !loading && (
            <SectionCard title="Comparativos por periodo" subtitle="Evolución de tu desempeño entre periodos académicos">
              {!comparativos || !comparativos.periodos || !comparativos.periodos.length ? (
                <div className="empty"><CalendarRange size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} /> No hay datos comparativos disponibles.</div>
              ) : (
                <div>
                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                    <StatCard icon={CalendarRange} label="Periodos" value={comparativos.total_periodos || 0} hint="Con evaluaciones" />
                    <StatCard icon={Activity} label="Promedio general" value={comparativos.promedio_general?.toFixed(2) || '0'} hint="Todos los periodos" />
                    <StatCard icon={Star} label="Mejor periodo" value={comparativos.periodos?.reduce?.((best, p) => Number(p.promedio_periodo || 0) > Number(best.promedio_periodo || 0) ? p : best, comparativos.periodos[0])?.nombre_periodo || '—'} hint="Mayor promedio" />
                  </div>

                  <div className="list">
                    {comparativos.periodos.map(p => (
                      <div key={p.id_periodo} className="list-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <strong>{p.nombre_periodo}</strong>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                              <small className="muted">Evaluaciones: {p.total_evaluaciones || 0}</small>
                              <small className="muted">Máximo: {Number(p.max_promedio || 0).toFixed(2)}</small>
                              <small className="muted">Mínimo: {Number(p.min_promedio || 0).toFixed(2)}</small>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 100 }}>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                              {Number(p.promedio_periodo || 0).toFixed(2)}
                            </div>
                            <small className="muted">promedio</small>
                          </div>
                        </div>
                        <MiniBar value={Number(p.promedio_periodo || 0)} max={5} color="#2563eb" />
                      </div>
                    ))}
                  </div>

                  {comparativos.detalle && comparativos.detalle.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Desglose por evaluación</div>
                      <div className="list" style={{ maxHeight: 300, overflow: 'auto' }}>
                        {comparativos.detalle.map((d, i) => (
                          <div key={i} className="list-item" style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: '0.85rem' }}>{d.evaluacion_titulo}</strong>
                                <small className="muted" style={{ display: 'block' }}>{d.nombre_periodo}</small>
                              </div>
                              <strong style={{ color: '#059669' }}>{Number(d.promedio_final || 0).toFixed(2)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'evolucion' && !loading && (
            <SectionCard title="Evolución histórica" subtitle="Trayectoria de tus evaluaciones a lo largo del tiempo">
              {!evolucion || !evolucion.evolucion || !evolucion.evolucion.length ? (
                <div className="empty"><TrendingUp size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} /> No hay datos históricos disponibles.</div>
              ) : (
                <div>
                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                    <StatCard icon={Activity} label="Total evaluaciones" value={evolucion.evolucion.length} hint="Histórico completo" />
                    <StatCard icon={Star} label="Promedio general" value={evolucion.promedio_general?.toFixed(2) || '0'} hint="Toda la trayectoria" />
                    <StatCard icon={CalendarRange} label="Periodos" value={evolucion.periodos?.length || 0} hint="Cobertura temporal" />
                  </div>

                  <div className="list" style={{ maxHeight: 500, overflow: 'auto' }}>
                    {evolucion.evolucion.map((e, i) => (
                      <div key={i} className="list-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: '0.9rem' }}>{e.evaluacion}</strong>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.15rem', fontSize: '0.82rem' }}>
                              <small className="muted">{e.periodo}</small>
                              <small className="muted">{e.fecha ? new Date(e.fecha).toLocaleDateString() : ''}</small>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 60 }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: Number(e.promedio) >= 3 ? '#059669' : '#d97706', lineHeight: 1 }}>
                              {e.promedio.toFixed(1)}
                            </div>
                            <small className="muted">/ {e.escala || '5'}</small>
                          </div>
                        </div>
                        <MiniBar value={e.promedio} max={Number(e.escala || 5)} color={e.promedio >= 3 ? '#059669' : '#d97706'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'retroalimentacion' && !loading && (
            <SectionCard title="Retroalimentación recibida" subtitle="Comentarios y observaciones de los alumnos">
              {retroalimentacion.length === 0 ? (
                <div className="empty"><MessageSquareText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} /> No hay retroalimentación disponible.</div>
              ) : (
                <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
                  {retroalimentacion.map(r => (
                    <div key={r.id_respuesta} className="list-item" style={{ borderLeft: '4px solid rgba(37,99,235,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{r.evaluacion_titulo}</strong>
                            <span className="badge light" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>{r.nombre_periodo}</span>
                          </div>
                          <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.1)' }}>
                            <em style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>{r.valor_texto}</em>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                            {r.criterio && <small className="muted">Criterio: {r.criterio}</small>}
                            {r.alumno_nombre && <small className="muted">— {r.alumno_nombre}</small>}
                            <small className="muted">{r.creado_en ? new Date(r.creado_en).toLocaleString() : ''}</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}

      {resultadoDetalle && (
        <div>
          <SectionCard title={resultadoDetalle.evaluacion_titulo || 'Detalle del resultado'}
            subtitle={resultadoDetalle.nombre_periodo || ''}
            right={
              <button type="button" className="btn secondary" onClick={() => setResultadoDetalle(null)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                <ArrowLeft size={14} /> Volver
              </button>
            }>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1rem' }}>
              <StatCard icon={Star} label="Promedio final" value={Number(resultadoDetalle.promedio_final || 0).toFixed(2)} hint={`Escala: ${resultadoDetalle.escala || '5'}`} />
              <StatCard icon={CheckCircle2} label="Validación" value={resultadoDetalle.estado_validacion || '—'} hint={resultadoDetalle.validado_en ? new Date(resultadoDetalle.validado_en).toLocaleDateString() : ''} />
              <StatCard icon={Activity} label="Preguntas" value={`${resultadoDetalle.preguntas?.length || 0}`} hint="Criterios evaluados" />
            </div>

            {resultadoDetalle.observacion_general && (
              <div style={{ padding: '1rem', borderRadius: 18, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', marginBottom: '1rem' }}>
                <small style={{ fontWeight: 700, color: '#d97706', display: 'block', marginBottom: '0.35rem' }}>Observación general</small>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{resultadoDetalle.observacion_general}</p>
              </div>
            )}

            {resultadoDetalle.preguntas && resultadoDetalle.preguntas.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Desglose por criterio</div>
                <div className="list" style={{ maxHeight: 400, overflow: 'auto' }}>
                  {resultadoDetalle.preguntas.map((p, i) => (
                    <div key={i} className="list-item" style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '0.85rem' }}>{p.orden_pregunta}. {p.criterio}</strong>
                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.15rem', fontSize: '0.82rem' }}>
                            <small className="muted">Tipo: {p.tipo_respuesta}</small>
                            <small className="muted">Peso: {p.peso ?? 0}</small>
                            <small className="muted">Respuestas: {p.total_respuestas || 0}</small>
                            <small className="muted">Alumnos: {p.alumnos_respondieron || 0}</small>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 50 }}>
                          <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>
                            {p.promedio_pregunta !== null ? Number(p.promedio_pregunta).toFixed(2) : '—'}
                          </strong>
                        </div>
                      </div>
                      {p.promedio_pregunta !== null && (
                        <MiniBar value={Number(p.promedio_pregunta)} max={5} color="#2563eb" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultadoDetalle.retroalimentacion && resultadoDetalle.retroalimentacion.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                  <MessageSquareText size={14} /> Retroalimentación ({resultadoDetalle.retroalimentacion.length})
                </div>
                <div className="list" style={{ maxHeight: 300, overflow: 'auto' }}>
                  {resultadoDetalle.retroalimentacion.map(r => (
                    <div key={r.id_respuesta} className="list-item" style={{ padding: '0.75rem', borderLeft: '4px solid rgba(37,99,235,0.3)' }}>
                      <em style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{r.valor_texto}</em>
                      <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                        {r.alumno_nombre && <small className="muted">— {r.alumno_nombre}</small>}
                        <small className="muted">{r.creado_en ? new Date(r.creado_en).toLocaleString() : ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn primary" onClick={() => descargarReporte(resultadoDetalle.id_resultado)}>
                <Download size={16} /> Descargar reporte completo
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
