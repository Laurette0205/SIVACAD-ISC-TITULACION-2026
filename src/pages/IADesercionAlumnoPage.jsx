import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api, canAccessDesercionAlumnoIA } from '../services/api';
import {
  AlertTriangle, BarChart3, CheckCircle2, Clock, History, Lightbulb,
  Loader2, Minus, Sparkles, Target, TrendingDown, TrendingUp, User, BookOpen,
  Shield, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RISK_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Crítico': '#ef4444' };

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

function RiskBadge({ nivel }) {
  const color = RISK_COLORS[nivel] || '#94a3b8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.2rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem',
      fontWeight: 600, color: '#fff', backgroundColor: color
    }}>
      <AlertTriangle size={14} />
      {nivel}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color = '#4F46E5', sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: '1rem'
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '12px', background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function IADesercionAlumnoPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState({ panel: false, recomendaciones: false, historial: false, progreso: false });
  const [panelData, setPanelData] = useState(null);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [historialData, setHistorialData] = useState(null);
  const [progresoData, setProgresoData] = useState(null);
  const [error, setError] = useState(null);
  const [detailAlert, setDetailAlert] = useState(null);

  if (!canAccessDesercionAlumnoIA(user)) {
    return <Navigate to="/app" replace />;
  }

  const fetchPanel = useCallback(async () => {
    if (!token) return;
    setLoading(p => ({ ...p, panel: true })); setError(null);
    try {
      const res = await api.iaDesercionAlumnoMiRiesgo(token);
      if (res?.ok) setPanelData(res.data);
    } catch (e) { setError('Error al cargar panel'); } finally {
      setLoading(p => ({ ...p, panel: false }));
    }
  }, [token]);

  const fetchRecomendaciones = useCallback(async () => {
    if (!token) return;
    setLoading(p => ({ ...p, recomendaciones: true })); setError(null);
    try {
      const res = await api.iaDesercionAlumnoRecomendaciones(token);
      if (res?.ok) setRecomendaciones(res.data);
    } catch (e) { setError('Error al cargar recomendaciones'); } finally {
      setLoading(p => ({ ...p, recomendaciones: false }));
    }
  }, [token]);

  const fetchHistorial = useCallback(async () => {
    if (!token) return;
    setLoading(p => ({ ...p, historial: true })); setError(null);
    try {
      const res = await api.iaDesercionAlumnoHistorial(token);
      if (res?.ok) setHistorialData(res.data);
    } catch (e) { setError('Error al cargar historial'); } finally {
      setLoading(p => ({ ...p, historial: false }));
    }
  }, [token]);

  const fetchProgreso = useCallback(async () => {
    if (!token) return;
    setLoading(p => ({ ...p, progreso: true })); setError(null);
    try {
      const res = await api.iaDesercionAlumnoProgreso(token);
      if (res?.ok) setProgresoData(res.data);
    } catch (e) { setError('Error al cargar progreso'); } finally {
      setLoading(p => ({ ...p, progreso: false }));
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'panel') fetchPanel();
    else if (activeTab === 'recomendaciones') fetchRecomendaciones();
    else if (activeTab === 'historial') fetchHistorial();
    else if (activeTab === 'progreso') fetchProgreso();
  }, [activeTab, fetchPanel, fetchRecomendaciones, fetchHistorial, fetchProgreso]);

  const tabs = [
    { key: 'panel', label: 'Panel personal', icon: User },
    { key: 'recomendaciones', label: 'Recomendaciones', icon: Lightbulb },
    { key: 'progreso', label: 'Progreso', icon: TrendingUp },
    { key: 'historial', label: 'Historial', icon: History }
  ];

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            <Sparkles size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#4F46E5' }} />
            IA de Deserción
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Tu espacio personal para conocer tu estado académico y recibir orientación preventiva.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? '#4F46E5' : '#64748B',
            borderBottom: activeTab === t.key ? '2px solid #4F46E5' : '2px solid transparent',
            marginBottom: '-2px', transition: 'all 0.2s'
          }}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ═══ PANEL PERSONAL ═══ */}
      {activeTab === 'panel' && (
        loading.panel ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} color="#4F46E5" />
          </div>
        ) : panelData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Fila de tarjetas de estadísticas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <StatCard
                icon={BookOpen} label="Carrera"
                value={panelData.alumno?.carrera || '—'} color="#4F46E5"
                sub={`Semestre ${panelData.alumno?.semestre || '—'} · ${panelData.alumno?.matricula || ''}`}
              />
              <StatCard
                icon={BarChart3} label="Promedio general"
                value={panelData.kardex?.promedio?.toFixed(2) || '—'} color="#22c55e"
                sub={`${panelData.kardex?.creditos || 0} créditos`}
              />
              <StatCard
                icon={AlertTriangle} label="Alertas activas"
                value={panelData.alertas_pendientes || 0} color="#f97316"
                sub={`${panelData.alertas_atendidas || 0} atendidas`}
              />
              <StatCard
                icon={Target} label="Nivel de riesgo"
                value={panelData.riesgo_actual ? riskLevel(panelData.riesgo_actual.nivel) : 'Sin riesgo'}
                color={panelData.riesgo_actual ? (RISK_COLORS[riskLevel(panelData.riesgo_actual.nivel)] || '#22c55e') : '#22c55e'}
                sub={panelData.riesgo_actual ? `Puntaje: ${panelData.riesgo_actual.puntaje?.toFixed(0) || 0}%` : 'Todo bien'}
              />
            </div>

            {/* Mensaje orientativo / Interpretación */}
            <SectionCard title="Mensaje orientativo" icon={Info}>
              <div style={{
                padding: '1rem', borderRadius: '8px',
                background: panelData.riesgo_actual ? '#fefce8' : '#f0fdf4',
                border: `1px solid ${panelData.riesgo_actual ? '#fde047' : '#bbf7d0'}`,
                color: '#334155', lineHeight: 1.6, fontSize: '0.9rem'
              }}>
                <p style={{ margin: 0 }}>{panelData.interpretacion}</p>
                {panelData.riesgo_actual && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff', borderRadius: '6px' }}>
                    <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#0F172A' }}>¿Qué hacer ahora?</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{panelData.riesgo_actual.recomendacion}</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Factores detectados (si hay alerta activa) */}
            {panelData.riesgo_actual && panelData.riesgo_actual.factores?.length > 0 && (
              <SectionCard title="Factores detectados" icon={AlertTriangle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {panelData.riesgo_actual.factores.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{ color: '#334155' }}>{f.nombre || f.factor || 'Factor'}</span>
                      <span style={{
                        padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600,
                        background: (f.puntaje || f.valor || 0) > 50 ? '#fef2f2' : (f.puntaje || f.valor || 0) > 25 ? '#fefce8' : '#f0fdf4',
                        color: (f.puntaje || f.valor || 0) > 50 ? '#dc2626' : (f.puntaje || f.valor || 0) > 25 ? '#a16207' : '#16a34a'
                      }}>
                        {f.puntaje || f.valor || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Alertas recientes */}
            {panelData.alertas_recientes?.length > 0 && (
              <SectionCard title="Alertas recientes" icon={Clock}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {panelData.alertas_recientes.slice(0, 5).map(a => (
                    <div key={a.id_alerta} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px',
                      cursor: 'pointer', transition: 'background 0.15s',
                      border: detailAlert?.id_alerta === a.id_alerta ? '1px solid #4F46E5' : '1px solid transparent'
                    }} onClick={() => setDetailAlert(detailAlert?.id_alerta === a.id_alerta ? null : a)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RiskBadge nivel={riskLevel(a.nivel_riesgo)} />
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                          {a.periodo_activo || a.nombre_periodo || ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        {a.atendida ? <CheckCircle2 size={16} color="#22c55e" /> : <Clock size={16} color="#f97316" />}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Detalle expandido de alerta */}
            {detailAlert && (
              <SectionCard title="Detalle de alerta" icon={Shield}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div><strong>Nivel:</strong> <RiskBadge nivel={riskLevel(detailAlert.nivel_riesgo)} /></div>
                  <div><strong>Puntaje:</strong> {detailAlert.puntaje_riesgo?.toFixed(0) || '0'}%</div>
                  <div><strong>Estado:</strong> {detailAlert.atendida ? 'Atendida' : 'Pendiente'}</div>
                  <div><strong>Periodo:</strong> {detailAlert.periodo_activo || detailAlert.nombre_periodo || '—'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Descripción:</strong> {detailAlert.descripcion}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Recomendación:</strong> {detailAlert.recomendacion}</div>
                  {detailAlert.explicacion && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Explicación del modelo:</strong>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', background: '#f1f5f9', padding: '0.75rem', borderRadius: '6px', marginTop: '0.3rem' }}>{detailAlert.explicacion}</pre>
                    </div>
                  )}
                </div>
                {detailAlert.factores?.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Factores:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {detailAlert.factores.map((f, i) => (
                        <span key={i} style={{
                          padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem',
                          background: '#f1f5f9', color: '#334155'
                        }}>
                          {f.nombre || f.factor}: {f.puntaje || f.valor || 0}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>No hay datos disponibles. Presiona "Cargar información" para empezar.</p>
          </div>
        )
      )}

      {/* ═══ RECOMENDACIONES ═══ */}
      {activeTab === 'recomendaciones' && (
        loading.recomendaciones ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} color="#4F46E5" />
          </div>
        ) : recomendaciones.length === 0 ? (
          <SectionCard>
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
              <Sparkles size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p>No tienes recomendaciones pendientes. Sigue así.</p>
            </div>
          </SectionCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recomendaciones.map(r => (
              <SectionCard key={r.id_alerta}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RiskBadge nivel={riskLevel(r.nivel_riesgo)} />
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{r.nombre_periodo}</span>
                  </div>
                  <div style={{
                    padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                    background: r.atendida ? '#f0fdf4' : '#fefce8',
                    color: r.atendida ? '#16a34a' : '#a16207'
                  }}>
                    {r.atendida ? 'Atendida' : 'Pendiente'}
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: '0.5rem 0' }}>
                  {r.recomendacion}
                </p>
                {r.descripcion && (
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.25rem 0' }}>
                    {r.descripcion}
                  </p>
                )}
                {r.factores?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {r.factores.map((f, i) => (
                      <span key={i} style={{
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem',
                        background: '#f1f5f9', color: '#475569'
                      }}>
                        {f.nombre || f.factor}: {f.puntaje || f.valor || 0}%
                      </span>
                    ))}
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )
      )}

      {/* ═══ PROGRESO ═══ */}
      {activeTab === 'progreso' && (
        loading.progreso ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} color="#4F46E5" />
          </div>
        ) : progresoData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <SectionCard title="Evolución por periodo" icon={TrendingUp}>
              {progresoData.por_periodo?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {progresoData.por_periodo.map(p => (
                    <div key={p.id_periodo} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>{p.nombre_periodo}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                          {p.total_alertas} alertas · {p.atendidas} atendidas · {p.pendientes} pendientes
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                          background: p.riesgo_promedio >= 50 ? '#fef2f2' : p.riesgo_promedio >= 25 ? '#fefce8' : '#f0fdf4',
                          color: p.riesgo_promedio >= 50 ? '#dc2626' : p.riesgo_promedio >= 25 ? '#a16207' : '#16a34a'
                        }}>
                          Riesgo: {p.riesgo_promedio}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>Sin datos de periodos anteriores.</p>
              )}
            </SectionCard>

            {progresoData.evolucion?.length > 0 && (
              <SectionCard title="Tendencia" icon={TrendingDown}>
                {progresoData.evolucion.map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0', borderBottom: i < progresoData.evolucion.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: e.cambio === 'mejora' ? '#f0fdf4' : e.cambio === 'aumento' ? '#fef2f2' : '#f8fafc',
                      color: e.cambio === 'mejora' ? '#16a34a' : e.cambio === 'aumento' ? '#dc2626' : '#94a3b8'
                    }}>
                      {e.cambio === 'mejora' ? <TrendingDown size={16} /> : e.cambio === 'aumento' ? <TrendingUp size={16} /> : <Minus size={16} />}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.85rem', color: '#334155' }}>
                      De <strong>{e.desde}</strong> a <strong>{e.hasta}</strong>
                    </div>
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600,
                      color: e.cambio === 'mejora' ? '#16a34a' : e.cambio === 'aumento' ? '#dc2626' : '#64748B'
                    }}>
                      {e.cambio === 'mejora' ? '−' : e.cambio === 'aumento' ? '+' : '−'}{e.diferencia}%
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>No hay información de progreso disponible.</p>
          </div>
        )
      )}

      {/* ═══ HISTORIAL ═══ */}
      {activeTab === 'historial' && (
        loading.historial ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} color="#4F46E5" />
          </div>
        ) : historialData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Alertas */}
            <SectionCard title="Historial de alertas" icon={History}>
              {historialData.alertas?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {historialData.alertas.map(a => (
                    <div key={a.id_alerta} style={{
                      padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <RiskBadge nivel={riskLevel(a.nivel_riesgo)} />
                          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{a.nombre_periodo}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {new Date(a.creado_en).toLocaleDateString()}
                        </div>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.25rem 0' }}>{a.descripcion}</p>
                      {a.recomendacion && (
                        <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0.15rem 0' }}>
                          <strong>Recomendación:</strong> {a.recomendacion}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{
                          padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                          background: a.atendida ? '#f0fdf4' : '#fefce8',
                          color: a.atendida ? '#16a34a' : '#a16207'
                        }}>
                          {a.atendida ? 'Atendida' : 'Pendiente'}
                        </span>
                        {a.estado_seguimiento && (
                          <span style={{
                            padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem',
                            background: '#e0e7ff', color: '#4338ca'
                          }}>
                            {a.estado_seguimiento}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
                  No hay alertas registradas en tu historial.
                </p>
              )}
            </SectionCard>

            {/* Seguimientos */}
            {historialData.seguimientos?.length > 0 && (
              <SectionCard title="Seguimientos recibidos" icon={CheckCircle2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {historialData.seguimientos.map(s => (
                    <div key={s.id_seguimiento} style={{
                      padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          {s.usuario_nombre || 'Usuario'} {s.usuario_apellido || ''}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {new Date(s.creado_en).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#334155', margin: '0.25rem 0', lineHeight: 1.5 }}>
                        {s.comentario || s.observacion || 'Sin detalle'}
                      </p>
                      {s.tipo_seguimiento && (
                        <span style={{
                          padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem',
                          background: '#e0e7ff', color: '#4338ca'
                        }}>
                          {s.tipo_seguimiento}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>No hay información de historial disponible.</p>
          </div>
        )
      )}
    </div>
  );
}
