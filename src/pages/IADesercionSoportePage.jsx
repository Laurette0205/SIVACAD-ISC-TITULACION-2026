import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api, canAccessDesercionSoporteIA } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Database,
  FileText, LayoutDashboard, List, Loader2, RefreshCw, Search,
  Server, Shield, Terminal, TrendingUp, Wifi, XCircle, Clock,
  FileWarning
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function StatusDot({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.8rem', fontWeight: 500
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: ok ? '#22c55e' : '#ef4444',
        display: 'inline-block'
      }} />
      {label || (ok ? 'OK' : 'Fallo')}
    </span>
  );
}

function MetricBox({ icon: Icon, label, value, color = '#4F46E5', sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '0.85rem 1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: '0.75rem'
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '10px',
        background: `${color}15`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color
      }}>
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

export default function IADesercionSoportePage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState({});
  const [estadoData, setEstadoData] = useState(null);
  const [logsData, setLogsData] = useState(null);
  const [erroresData, setErroresData] = useState(null);
  const [conectividadData, setConectividadData] = useState(null);
  const [integridadData, setIntegridadData] = useState(null);
  const [verificacionData, setVerificacionData] = useState(null);
  const [rutasData, setRutasData] = useState(null);
  const [error, setError] = useState(null);
  const [logPage, setLogPage] = useState(1);

  if (!canAccessDesercionSoporteIA(user)) {
    return <Navigate to="/app" replace />;
  }

  const setLoad = (key) => (v) => setLoading(p => ({ ...p, [key]: v }));

  const fetchEstado = useCallback(async () => {
    if (!token) return;
    setLoad('estado')(true); setError(null);
    try { const r = await api.iaDesercionSoporteEstado(token); if (r?.ok) setEstadoData(r.data); }
    catch (e) { setError('Error al consultar estado'); }
    finally { setLoad('estado')(false); }
  }, [token]);

  const fetchLogs = useCallback(async (page) => {
    if (!token) return;
    setLoad('logs')(true); setError(null);
    try {
      const r = await api.iaDesercionSoporteLogs(token, { page, limit: 15 });
      if (r?.ok) setLogsData(r);
    } catch (e) { setError('Error al obtener logs'); }
    finally { setLoad('logs')(false); }
  }, [token]);

  const fetchErrores = useCallback(async () => {
    if (!token) return;
    setLoad('errores')(true); setError(null);
    try { const r = await api.iaDesercionSoporteErrores(token, { limit: 20 }); if (r?.ok) setErroresData(r); }
    catch (e) { setError('Error al obtener errores'); }
    finally { setLoad('errores')(false); }
  }, [token]);

  const fetchConectividad = useCallback(async () => {
    if (!token) return;
    setLoad('conectividad')(true); setError(null);
    try { const r = await api.iaDesercionSoporteConectividad(token); if (r?.ok) setConectividadData(r.data); }
    catch (e) { setError('Error al verificar conectividad'); }
    finally { setLoad('conectividad')(false); }
  }, [token]);

  const fetchIntegridad = useCallback(async () => {
    if (!token) return;
    setLoad('integridad')(true); setError(null);
    try { const r = await api.iaDesercionSoporteIntegridad(token); if (r?.ok) setIntegridadData(r.data); }
    catch (e) { setError('Error al verificar integridad'); }
    finally { setLoad('integridad')(false); }
  }, [token]);

  const fetchVerificacion = useCallback(async () => {
    if (!token) return;
    setLoad('verificacion')(true); setError(null);
    try { const r = await api.iaDesercionSoporteVerificar(token); if (r?.ok) setVerificacionData(r.data); }
    catch (e) { setError('Error en verificación completa'); }
    finally { setLoad('verificacion')(false); }
  }, [token]);

  const fetchRutas = useCallback(async () => {
    if (!token) return;
    setLoad('rutas')(true); setError(null);
    try { const r = await api.iaDesercionSoporteRutas(token); if (r?.ok) setRutasData(r.data); }
    catch (e) { setError('Error al consultar rutas'); }
    finally { setLoad('rutas')(false); }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'dashboard') { fetchEstado(); fetchVerificacion(); }
    else if (activeTab === 'logs') fetchLogs(logPage);
    else if (activeTab === 'errores') fetchErrores();
    else if (activeTab === 'conectividad') fetchConectividad();
    else if (activeTab === 'integridad') fetchIntegridad();
    else if (activeTab === 'rutas') fetchRutas();
  }, [activeTab, logPage, fetchEstado, fetchLogs, fetchErrores, fetchConectividad, fetchIntegridad, fetchVerificacion, fetchRutas]);

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'logs', label: 'Auditoría', icon: List },
    { key: 'errores', label: 'Alertas críticas', icon: AlertTriangle },
    { key: 'conectividad', label: 'Conectividad', icon: Wifi },
    { key: 'integridad', label: 'Integridad', icon: Shield },
    { key: 'rutas', label: 'Rutas', icon: FileText }
  ];

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            <Terminal size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#4F46E5' }} />
            IA de Deserción — Soporte Técnico
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Monitoreo, diagnóstico y mantenimiento del módulo de inteligencia institucional.
          </p>
        </div>
        <button onClick={() => { setActiveTab(activeTab); }} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem',
          background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px',
          cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500
        }}>
          <RefreshCw size={16} />
          Refrescar
        </button>
      </div>

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

      {/* ═══ DASHBOARD ═══ */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Estado del servicio */}
          <SectionCard title="Estado del servicio" icon={Server}>
            {loading.estado ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="animate-spin" size={28} color="#4F46E5" />
              </div>
            ) : estadoData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <StatusDot ok={estadoData.estado === 'operativo'} label={
                    estadoData.estado === 'operativo' ? 'Operativo' :
                    estadoData.estado === 'fallo_parcial' ? 'Fallo parcial' : 'Crítico'
                  } />
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {estadoData.estado === 'operativo' ? 'Todos los módulos responden correctamente' : 'Se detectaron anomalías'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {Object.entries(estadoData.tablas || {}).map(([nombre, info]) => (
                    <div key={nombre} style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px',
                      background: info.ok ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${info.ok ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>{nombre}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: info.ok ? '#16a34a' : '#dc2626' }}>
                        {info.ok ? `${info.registros} registros` : 'Sin acceso'}
                      </div>
                    </div>
                  ))}
                </div>
                {(estadoData.metricas?.distribucion_riesgo && Object.keys(estadoData.metricas.distribucion_riesgo).length > 0) && (
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Distribución por nivel de riesgo</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {Object.entries(estadoData.metricas.distribucion_riesgo).map(([nivel, total]) => (
                        <span key={nivel} style={{
                          padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                          background: nivel === 'Crítico' ? '#fef2f2' : nivel === 'Alto' ? '#fff7ed' : nivel === 'Medio' ? '#fefce8' : '#f0fdf4',
                          color: nivel === 'Crítico' ? '#dc2626' : nivel === 'Alto' ? '#ea580c' : nivel === 'Medio' ? '#a16207' : '#16a34a'
                        }}>
                          {nivel}: {total}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                <p>Haz clic en "Refrescar" para cargar el estado.</p>
              </div>
            )}
          </SectionCard>

          {/* Verificación completa */}
          <SectionCard title="Verificación completa del módulo" icon={CheckCircle2}>
            {loading.verificacion ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="animate-spin" size={28} color="#4F46E5" />
              </div>
            ) : verificacionData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <StatusDot ok={verificacionData.estado === 'operativo'} label={
                    verificacionData.estado === 'operativo' ? 'Operativo' :
                    verificacionData.estado === 'fallo_parcial' ? 'Fallo parcial' : 'Crítico'
                  } />
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {verificacionData.timestamp ? new Date(verificacionData.timestamp).toLocaleString() : ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {Object.entries(verificacionData.modulos || {}).map(([key, val]) => (
                    <div key={key} style={{
                      padding: '0.6rem 0.75rem', borderRadius: '8px',
                      background: val?.ok ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${val?.ok ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'capitalize' }}>{key}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        {val?.ok ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: val?.ok ? '#16a34a' : '#dc2626' }}>
                          {val?.ok ? 'Correcto' : val?.error || 'Error'}
                        </span>
                      </div>
                      {val?.alertas !== undefined && (
                        <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem', display: 'block' }}>
                          {val.alertas} alertas · {val.seguimientos} seguimientos · {val.auditoria} auditorías
                        </span>
                      )}
                      {val?.criticas !== undefined && (
                        <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem', display: 'block' }}>
                          {val.criticas} alertas críticas
                        </span>
                      )}
                      {val?.latencia_ms !== undefined && (
                        <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem', display: 'block' }}>
                          {val.latencia_ms}ms de latencia
                        </span>
                      )}
                      {val?.tablas?.length > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.15rem', display: 'block' }}>
                          {val.tablas.length} tablas encontradas
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                <p>Ejecuta la verificación desde el panel.</p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ═══ LOGS / AUDITORÍA ═══ */}
      {activeTab === 'logs' && (
        <SectionCard title="Registro de auditoría" icon={List}>
          {loading.logs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} color="#4F46E5" />
            </div>
          ) : logsData?.data?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {logsData.data.map(log => (
                <div key={log.id_auditoria} style={{
                  padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px',
                  fontSize: '0.82rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.8rem' }}>{log.accion}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {new Date(log.creado_en).toLocaleString()}
                    </span>
                  </div>
                  {log.detalle && (
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.15rem' }}>{log.detalle}</div>
                  )}
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                    {log.nombres ? `${log.nombres} ${log.apellido_paterno || ''}` : 'Sistema'} · {log.correo_institucional || '—'}
                  </div>
                </div>
              ))}
              {logsData.pagination && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button disabled={logPage <= 1} onClick={() => { setLogPage(p => p - 1); }}
                    style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Anterior
                  </button>
                  <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#64748B' }}>
                    Pág {logsData.pagination.page} de {logsData.pagination.pages} ({logsData.pagination.total} registros)
                  </span>
                  <button disabled={logPage >= logsData.pagination.pages} onClick={() => { setLogPage(p => p + 1); }}
                    style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <p>No hay registros de auditoría disponibles.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══ ERRORES / ALERTAS CRÍTICAS ═══ */}
      {activeTab === 'errores' && (
        <SectionCard title="Alertas críticas (puntaje ≥ 80)" icon={FileWarning}>
          {loading.errores ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} color="#4F46E5" />
            </div>
          ) : erroresData?.data?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {erroresData.data.map(e => (
                <div key={e.id_alerta} style={{
                  padding: '0.6rem 0.75rem', background: '#fef2f2', borderRadius: '6px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={14} color="#dc2626" />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>
                        #{e.id_alerta}
                      </span>
                      <span style={{
                        padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                        background: '#fef2f2', color: '#dc2626'
                      }}>
                        {e.puntaje_riesgo?.toFixed(0)}%
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {new Date(e.creado_en).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', fontSize: '0.78rem', color: '#64748B' }}>
                    <span><strong>Alumno:</strong> {e.alumno_nombre || e.matricula || '—'}</span>
                    <span><strong>Matrícula:</strong> {e.matricula || '—'}</span>
                    <span><strong>Estado:</strong> {e.atendida ? 'Atendida' : 'Pendiente'}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                    {e.descripcion}
                  </p>
                </div>
              ))}
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.25rem' }}>
                Total: {erroresData.total} alertas críticas
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p>No se encontraron alertas críticas. El módulo opera sin incidencias graves.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══ CONECTIVIDAD ═══ */}
      {activeTab === 'conectividad' && (
        <SectionCard title="Estado de conectividad" icon={Wifi}>
          {loading.conectividad ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} color="#4F46E5" />
            </div>
          ) : conectividadData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '8px',
                background: conectividadData.base_datos?.estado === 'conectado' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${conectividadData.base_datos?.estado === 'conectado' ? '#bbf7d0' : '#fecaca'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <Database size={18} color={conectividadData.base_datos?.estado === 'conectado' ? '#16a34a' : '#dc2626'} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>Base de datos</span>
                  <StatusDot ok={conectividadData.base_datos?.estado === 'conectado'} />
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Latencia: {conectividadData.base_datos?.latencia_ms || '—'}ms ·
                  Última verificación: {conectividadData.base_datos?.timestamp ? new Date(conectividadData.base_datos.timestamp).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                  Tablas del módulo ({conectividadData.tablas?.length || 0})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {conectividadData.tablas?.map(t => (
                    <div key={t.nombre} style={{
                      padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>{t.nombre}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {t.registros || 0} registros
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <p>Verifica la conectividad desde el panel.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══ INTEGRIDAD ═══ */}
      {activeTab === 'integridad' && (
        <SectionCard title="Integridad del módulo" icon={Shield}>
          {loading.integridad ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} color="#4F46E5" />
            </div>
          ) : integridadData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '8px',
                background: integridadData.integro ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${integridadData.integro ? '#bbf7d0' : '#fecaca'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {integridadData.integro ? <CheckCircle2 size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>
                    {integridadData.integro ? 'Integridad correcta' : 'Faltan tablas'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    · {integridadData.base_datos} · {integridadData.version_sql}
                  </span>
                </div>
                {integridadData.tablas_faltantes?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#dc2626' }}>
                    Tablas faltantes: {integridadData.tablas_faltantes.join(', ')}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                  Estructura de tablas
                </div>
                {Object.entries(integridadData.estructura || {}).map(([tabla, columnas]) => (
                  <div key={tabla} style={{ marginBottom: '0.75rem' }}>
                    <div style={{
                      fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 600,
                      color: '#4F46E5', marginBottom: '0.25rem'
                    }}>
                      {tabla} ({columnas.length} columnas)
                    </div>
                    <div style={{
                      background: '#f8fafc', borderRadius: '6px', padding: '0.5rem',
                      maxHeight: '200px', overflow: 'auto', fontSize: '0.72rem', fontFamily: 'monospace'
                    }}>
                      {columnas.map(c => (
                        <div key={c.columna} style={{ padding: '0.1rem 0', color: '#334155' }}>
                          <span style={{ color: '#4F46E5' }}>{c.columna}</span>
                          <span style={{ color: '#64748B' }}> {c.tipo}</span>
                          {c.llave && <span style={{ color: '#f97316' }}> [{c.llave}]</span>}
                          {c.nullable && <span style={{ color: '#94a3b8' }}> NULL</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right' }}>
                Verificado: {new Date(integridadData.verificado_en).toLocaleString()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <p>Verifica la integridad desde el panel.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══ RUTAS ═══ */}
      {activeTab === 'rutas' && (
        <SectionCard title="Rutas y archivos del módulo" icon={FileText}>
          {loading.rutas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={28} color="#4F46E5" />
            </div>
          ) : rutasData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <MetricBox icon={FileText} label="Rutas registradas" value={rutasData.total_rutas || 0} />
                <MetricBox icon={Terminal} label="Archivos de ruta" value={rutasData.total_archivos_ruta || 0} />
                <MetricBox icon={Database} label="Archivos controller" value={rutasData.total_archivos_controller || 0} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Rutas montadas en index.js
                </div>
                <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '0.75rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6 }}>
                  {rutasData.rutas?.length > 0 ? rutasData.rutas.map((r, i) => <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{r}</div>) : <span style={{ color: '#94a3b8' }}>Sin rutas relacionadas</span>}
                </div>
              </div>
              {rutasData.archivos_ruta?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Archivos de ruta relacionados
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {rutasData.archivos_ruta.map(a => (
                      <span key={a.archivo} style={{
                        padding: '0.3rem 0.6rem', background: '#f1f5f9', borderRadius: '6px',
                        fontSize: '0.78rem', fontFamily: 'monospace', color: '#334155'
                      }}>
                        {a.archivo} ({(a.peso / 1024).toFixed(1)} KB)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {rutasData.archivos_controller?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Archivos controller relacionados
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {rutasData.archivos_controller.map(a => (
                      <span key={a.archivo} style={{
                        padding: '0.3rem 0.6rem', background: '#f1f5f9', borderRadius: '6px',
                        fontSize: '0.78rem', fontFamily: 'monospace', color: '#334155'
                      }}>
                        {a.archivo} ({(a.peso / 1024).toFixed(1)} KB)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <p>Consulta las rutas desde el panel.</p>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
