import React from 'react';
import { useAuth } from '../context/AuthContext';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import {
  Activity, AlertTriangle, BarChart3, Bug, CheckCircle2,
  ClipboardList, Clock, Download,
  Eye, FileScan, FileText, HardDrive, HelpCircle,
  Loader2, RefreshCw, RotateCcw, Search, Server,
  Shield, Terminal, TrendingUp, Upload, Users, XCircle, Wifi
} from 'lucide-react';
import '../styles/global.css';

function normalize(v) { return String(v || '').trim().toUpperCase(); }
function safeArray(v) { return Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : []); }
function safeObj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
function formatDate(v) { if (!v) return '—'; try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)); } catch { return String(v); } }
function formatDateShort(v) { if (!v) return '—'; try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(new Date(v)); } catch { return String(v); } }
function statusClass(v) { const s = normalize(v); if (s.includes('VALIDAD') || s.includes('APROB') || s.includes('OK')) return 'status ok'; if (s.includes('RECHAZ') || s.includes('ERROR') || s.includes('FALL') || s.includes('BAJA') || s.includes('CRIT')) return 'status error'; if (s.includes('PEND') || s.includes('PROCE') || s.includes('MEDI')) return 'status warn'; return 'status'; }
function formatBytes(bytes) { if (!bytes || bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
function confianzaClass(v) { const n = Number(v || 0); if (n >= 80) return 'status ok'; if (n >= 50) return 'status warn'; return 'status error'; }

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--line)', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: '0.88rem' }}>
      <Icon size={16} /> {label}
    </button>
  );
}

function PanelTecnico({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRSoporte.panel(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const resumen = data?.resumen || {};
  const stats = [
    { icon: FileScan, label: 'Cargas totales', value: resumen.total_cargas || 0, hint: 'Total de actas recibidas' },
    { icon: XCircle, label: 'Rechazadas', value: resumen.rechazadas || 0, hint: 'Fallaron en proceso OCR' },
    { icon: Clock, label: 'Por procesar', value: resumen.por_procesar || 0, hint: 'En cola de extracción' },
    { icon: AlertTriangle, label: 'Baja confianza', value: resumen.baja_confianza || 0, hint: '< 50% de certeza' },
    { icon: HelpCircle, label: 'Pend. validación', value: resumen.pendientes_validacion || 0, hint: 'Revisión manual' },
    { icon: TrendingUp, label: 'Confianza prom.', value: `${Number(resumen.confianza_promedio || 0).toFixed(1)}%`, hint: 'Promedio global' },
    { icon: Activity, label: 'Errores 7 días', value: resumen.errores_recientes_7d || 0, hint: 'En auditoría' },
    { icon: Users, label: 'Docentes activos', value: resumen.docentes_con_actas || 0, hint: 'Con al menos 1 carga' }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Terminal size={16} /> Soporte técnico • Actas OCR</div>
          <h1>Panel técnico OCR</h1>
          <p>Diagnosticar errores, revisar fallos de lectura, validar formatos y apoyar la recuperación de procesos de actas OCR.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Última carga</small><strong>{formatDate(resumen.ultima_carga)}</strong></div>
          <div className="meta-card"><small>Grupos con actas</small><strong>{resumen.grupos_con_actas || 0}</strong></div>
        </div>
      </section>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {stats.map(item => { const Icon = item.icon; return (
          <div className="stat-card" key={item.label}>
            <div><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-hint">{item.hint}</div></div>
            <div className="stat-icon"><Icon size={22} /></div>
          </div>
        ); })}
      </div>

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando panel técnico...</div>}

      {data?.formatos?.length > 0 && (
        <SectionCard title="Distribución de formatos" subtitle="Tipos MIME de archivos cargados">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {data.formatos.map((f, i) => (
              <div key={i} className="stat-card" style={{ padding: '0.75rem' }}>
                <div><div className="stat-label">{f.mime_type || 'Desconocido'}</div><div className="stat-value">{f.total}</div></div>
                <div className="stat-icon"><HardDrive size={18} /></div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Objetivo funcional" subtitle="Garantizar continuidad operativa y resolver fallos técnicos">
        <div className="list">
          <div className="list-item"><Bug size={16} /> Diagnosticar errores de extracción OCR</div>
          <div className="list-item"><Eye size={16} /> Revisar fallos de lectura en documentos</div>
          <div className="list-item"><FileScan size={16} /> Validar formatos de archivo y compatibilidad</div>
          <div className="list-item"><RotateCcw size={16} /> Apoyar recuperación de procesos fallidos</div>
        </div>
      </SectionCard>

      <SectionCard title="Alcance e impacto" subtitle="Cobertura sobre archivo, lectura OCR, compatibilidad y procesamiento">
        <div className="list">
          <div className="list-item"><Server size={16} /> Monitorear estado de cargas y procesamiento OCR</div>
          <div className="list-item"><AlertTriangle size={16} /> Identificar incidencias recurrentes por docente/grupo</div>
          <div className="list-item"><Wifi size={16} /> Verificar conectividad con servicios de IA (Gemini)</div>
          <div className="list-item"><Download size={16} /> Coordinar reintentos y reprocesamiento de actas</div>
        </div>
      </SectionCard>

      {!loading && (
        <SectionCard title="Estrategia operativa" subtitle="Alertas, registros técnicos y rutas de reintento">
          <div className="list">
            <div className="list-item"><Activity size={16} /> Alertas tempranas por baja confianza o errores OCR</div>
            <div className="list-item"><ClipboardList size={16} /> Registros técnicos detallados en auditoría</div>
            <div className="list-item"><RotateCcw size={16} /> Rutas de reintento para cargas atascadas</div>
            <div className="list-item"><TrendingUp size={16} /> Monitoreo continuo de métricas de procesamiento</div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function IncidenciasOCR({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRSoporte.incidencias(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><AlertTriangle size={16} /> Incidencias OCR</div>
          <h1>Incidencias y errores</h1>
          <p>Cargas con problemas técnicos y auditoría de errores recientes. Revisar fallos de lectura y diagnosticar causas.</p>
        </div>
      </section>

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando incidencias...</div>}

      <SectionCard title="Cargas con problemas" subtitle="Rechazadas, pendientes o con baja confianza">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead>
              <tr>
                <th>Archivo</th><th>Formato</th><th>Estado</th><th>Confianza</th><th>Docente</th><th>Grupo</th><th>Materia</th><th>Periodo</th><th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(data?.cargas_problema).length === 0 ? (
                <tr><td colSpan={9} className="text-center">Sin incidencias activas</td></tr>
              ) : safeArray(data?.cargas_problema).map(c => (
                <tr key={c.id_carga_ocr}>
                  <td><strong>{c.nombre_archivo || '—'}</strong></td>
                  <td><span className="badge">{c.mime_type || '—'}</span></td>
                  <td><span className={statusClass(c.estado)}>{c.estado}</span></td>
                  <td><span className={confianzaClass(c.confianza_global)}>{Number(c.confianza_global || 0).toFixed(1)}%</span></td>
                  <td>{c.nombre_usuario || '—'}</td>
                  <td>{c.nombre_grupo || '—'}</td>
                  <td>{c.nombre_materia || '—'}</td>
                  <td>{c.nombre_periodo || '—'}</td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      <SectionCard title="Auditoría de errores" subtitle="Últimas 30 acciones registradas">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead>
              <tr><th>Acción</th><th>Archivo</th><th>Usuario</th><th>Detalle</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {safeArray(data?.errores_auditoria).length === 0 ? (
                <tr><td colSpan={5} className="text-center">Sin errores registrados</td></tr>
              ) : safeArray(data?.errores_auditoria).map((e, i) => (
                <tr key={i}>
                  <td><span className={statusClass(e.accion)}>{e.accion}</span></td>
                  <td>{e.nombre_archivo || '—'}</td>
                  <td>{e.nombre_usuario || '—'}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.detalle ? JSON.stringify(e.detalle).slice(0, 120) : '—'}
                  </td>
                  <td>{formatDate(e.creado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>
    </div>
  );
}

function RevisarArchivos({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRSoporte.archivos(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Search size={16} /> Revisión de archivos</div>
          <h1>Revisar archivos OCR</h1>
          <p>Listado completo de archivos cargados, estado, confianza y detalles técnicos. Validar formatos y compatibilidad.</p>
        </div>
      </section>

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando archivos...</div>}

      <SectionCard title="Archivos cargados" subtitle="Últimos 100 registros">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead>
              <tr><th>Archivo</th><th>Formato</th><th>Estado</th><th>Confianza</th><th>Grupo</th><th>Materia</th><th>Periodo</th><th>Docente</th><th>Fecha</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {safeArray(data).length === 0 ? (
                <tr><td colSpan={10} className="text-center">Sin archivos registrados</td></tr>
              ) : safeArray(data).map(c => (
                <tr key={c.id_carga_ocr}>
                  <td><strong>{c.nombre_archivo || '—'}</strong></td>
                  <td><span className="badge">{c.mime_type || '—'}</span></td>
                  <td><span className={statusClass(c.estado)}>{c.estado}</span></td>
                  <td><span className={confianzaClass(c.confianza_global)}>{Number(c.confianza_global || 0).toFixed(1)}%</span></td>
                  <td>{c.nombre_grupo || '—'}</td>
                  <td>{c.nombre_materia || '—'}</td>
                  <td>{c.nombre_periodo || '—'}</td>
                  <td>{c.usuario_carga || '—'}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelected(selected?.id_carga_ocr === c.id_carga_ocr ? null : c)} style={{ padding: '0.25rem 0.5rem' }}>
                      <Eye size={14} /> {selected?.id_carga_ocr === c.id_carga_ocr ? 'Ocultar' : 'Detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      {selected && <DetalleArchivo token={token} carga={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DetalleArchivo({ token, carga, onClose }) {
  const [detalle, setDetalle] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token || !carga) return;
    api.actasOCRSoporte.archivoDetalle(token, carga.id_carga_ocr).then(r => setDetalle(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token, carga]);

  return (
    <SectionCard title={`Detalle: ${carga.nombre_archivo}`} subtitle="Información técnica completa">
      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando detalle...</div>}
      {detalle && (
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><small>Estado</small><div><span className={statusClass(detalle.estado)}>{detalle.estado}</span></div></div>
            <div><small>Confianza global</small><div><span className={confianzaClass(detalle.confianza_global)}>{Number(detalle.confianza_global || 0).toFixed(1)}%</span></div></div>
            <div><small>Formato</small><div>{detalle.mime_type || '—'}</div></div>
            <div><small>Plantilla</small><div>{detalle.nombre_plantilla || '—'}</div></div>
            <div><small>Firma detectada</small><div>{detalle.firma_detectada ? 'Sí' : 'No'}</div></div>
            <div><small>Almacenamiento</small><div>{detalle.storage_path || '—'}</div></div>
            <div><small>Creado</small><div>{formatDate(detalle.created_at)}</div></div>
            <div><small>Actualizado</small><div>{formatDate(detalle.updated_at)}</div></div>
          </div>
          {detalle.observaciones_revision && (
            <div><small>Observaciones</small><div className="alert warn" style={{ marginTop: 4 }}>{detalle.observaciones_revision}</div></div>
          )}
          {detalle.json_resultado && (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Resultado OCR (JSON)</summary>
              <pre style={{ maxHeight: 300, overflow: 'auto', background: 'var(--surface)', padding: 8, borderRadius: 8, fontSize: '0.75rem' }}>{JSON.stringify(detalle.json_resultado, null, 2)}</pre>
            </details>
          )}
          {detalle.detalles?.length > 0 && (
            <div>
              <small>Detalles extraídos ({detalle.detalles.length})</small>
              <div className="table-container" style={{ marginTop: 4 }}>
                <div className="table-responsive"><table className="table">
                  <thead><tr><th>Alumno</th><th>Materia</th><th>Calificación</th><th>Estatus</th></tr></thead>
                  <tbody>
                    {detalle.detalles.map((d, i) => (
                      <tr key={i}>
                        <td>{d.nombre_alumno || '—'}</td>
                        <td>{d.nombre_materia || '—'}</td>
                        <td>{d.calificacion ?? '—'}</td>
                        <td><span className={statusClass(d.estatus || '')}>{d.estatus || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </div>
          )}
          {detalle.auditoria?.length > 0 && (
            <div>
              <small>Auditoría ({detalle.auditoria.length} eventos)</small>
              <div className="table-container" style={{ marginTop: 4 }}>
                <div className="table-responsive"><table className="table">
                  <thead><tr><th>Acción</th><th>Usuario</th><th>Detalle</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {detalle.auditoria.map((a, i) => (
                      <tr key={i}>
                        <td><span className={statusClass(a.accion)}>{a.accion}</span></td>
                        <td>{a.nombre_usuario || '—'}</td>
                        <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>{a.detalle ? JSON.stringify(a.detalle).slice(0, 100) : '—'}</td>
                        <td>{formatDate(a.creado_en)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-sm btn-outline" onClick={onClose}><Eye size={14} /> Cerrar detalle</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Recuperacion({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState(null);

  const load = React.useCallback(() => {
    if (!token) return;
    setLoading(true);
    api.actasOCRSoporte.recuperacion(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const handleReintentar = async (id) => {
    setRetrying(id);
    try {
      await api.actasOCRSoporte.reintentarCarga(token, id);
      load();
    } catch {}
    setRetrying(null);
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><RotateCcw size={16} /> Recuperación</div>
          <h1>Recuperación de procesos</h1>
          <p>Cargas atascadas en estado pendiente por más de 1 hora. Apoyar recuperación de procesos fallidos mediante reintentos controlados.</p>
        </div>
        <div className="hero-meta">
          <button type="button" className="btn btn-sm btn-outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </section>

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando datos de recuperación...</div>}

      <SectionCard title="Cargas atascadas" subtitle="En estado RECIBIDA/EXTRACCION_PENDIENTE por más de 1 hora">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead>
              <tr><th>Archivo</th><th>Estado</th><th>Usuario</th><th>Creado</th><th>Espera</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {safeArray(data?.cargas_atascadas).length === 0 ? (
                <tr><td colSpan={6} className="text-center">Sin cargas atascadas</td></tr>
              ) : safeArray(data?.cargas_atascadas).map(c => {
                const horas = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 3600000);
                return (
                  <tr key={c.id_carga_ocr}>
                    <td><strong>{c.nombre_archivo || '—'}</strong></td>
                    <td><span className={statusClass(c.estado)}>{c.estado}</span></td>
                    <td>{c.usuario_carga || '—'}</td>
                    <td>{formatDate(c.created_at)}</td>
                    <td><span className="badge warn">{horas}h</span></td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => handleReintentar(c.id_carga_ocr)} disabled={retrying === c.id_carga_ocr} style={{ padding: '0.25rem 0.5rem' }}>
                        {retrying === c.id_carga_ocr ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />} Reintentar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      <SectionCard title="Reintentos por acción (7 días)" subtitle="Actividad en auditoría">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Acción</th><th>Total</th><th>Último</th></tr></thead>
            <tbody>
              {safeArray(data?.reintentos_por_accion).length === 0 ? (
                <tr><td colSpan={3} className="text-center">Sin actividad registrada</td></tr>
              ) : safeArray(data?.reintentos_por_accion).map((r, i) => (
                <tr key={i}>
                  <td><span className="badge">{r.accion}</span></td>
                  <td><strong>{r.total}</strong></td>
                  <td>{formatDate(r.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      <SectionCard title="Estado de cargas por tiempo" subtitle="Cargas pendientes agrupadas por estado">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Estado</th><th>Total</th><th>Más antiguo</th><th>Más reciente</th><th>Espera máxima</th></tr></thead>
            <tbody>
              {safeArray(data?.estado_tiempo).length === 0 ? (
                <tr><td colSpan={5} className="text-center">Sin datos</td></tr>
              ) : safeArray(data?.estado_tiempo).map((et, i) => (
                <tr key={i}>
                  <td><span className={statusClass(et.estado)}>{et.estado}</span></td>
                  <td><strong>{et.total}</strong></td>
                  <td>{formatDate(et.mas_antiguo)}</td>
                  <td>{formatDate(et.mas_reciente)}</td>
                  <td><span className="badge warn">{et.horas_espera_max}h</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>
    </div>
  );
}

function Monitoreo({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRSoporte.monitoreo(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Activity size={16} /> Monitoreo</div>
          <h1>Monitoreo del sistema OCR</h1>
          <p>Alertas, registros técnicos y rutas de reintento. Disminuir tiempos de respuesta y mejorar la estabilidad del sistema.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Cargas totales</small><strong>{data?.total_cargas || 0}</strong></div>
          <div className="meta-card"><small>Usos Gemini 7d</small><strong>{data?.gemini?.usos_7d || 0}</strong></div>
        </div>
      </section>

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando monitoreo...</div>}

      <SectionCard title="Distribución por estado" subtitle="Todas las cargas OCR">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {safeArray(data?.por_estado).map((e, i) => (
            <div key={i} className="stat-card" style={{ padding: '0.75rem' }}>
              <div><div className="stat-label">Estado</div><div><span className={statusClass(e.estado)}>{e.estado}</span></div><div className="stat-value">{e.total}</div></div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Actividad diaria (30 días)" subtitle="Cargas, validadas y rechazadas por día">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Fecha</th><th>Cargas</th><th>Validadas</th><th>Rechazadas</th><th>% Éxito</th></tr></thead>
            <tbody>
              {safeArray(data?.por_dia).length === 0 ? (
                <tr><td colSpan={5} className="text-center">Sin datos en los últimos 30 días</td></tr>
              ) : safeArray(data?.por_dia).map((d, i) => {
                const tasa = d.total > 0 ? ((d.validadas / d.total) * 100).toFixed(0) : 0;
                return (
                  <tr key={i}>
                    <td>{formatDateShort(d.fecha)}</td>
                    <td><strong>{d.total}</strong></td>
                    <td><span className="status ok">{d.validadas}</span></td>
                    <td><span className="status error">{d.rechazadas}</span></td>
                    <td><span className={tasa >= 80 ? 'status ok' : tasa >= 50 ? 'status warn' : 'status error'}>{tasa}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      <SectionCard title="Rendimiento por docente" subtitle="Top 20 docentes por cargas">
        <div className="table-container">
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Docente</th><th>Cargas</th><th>Validadas</th><th>Confianza prom.</th></tr></thead>
            <tbody>
              {safeArray(data?.por_docente).length === 0 ? (
                <tr><td colSpan={4} className="text-center">Sin datos de docentes</td></tr>
              ) : safeArray(data?.por_docente).map((d, i) => (
                <tr key={i}>
                  <td>{d.docente || '—'}</td>
                  <td><strong>{d.total_cargas}</strong></td>
                  <td><span className="status ok">{d.validadas}</span></td>
                  <td><span className={confianzaClass(d.confianza_promedio)}>{Number(d.confianza_promedio || 0).toFixed(1)}%</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </SectionCard>

      <SectionCard title="Estado de Gemini" subtitle="Servicio de IA para extracción OCR">
        <div className="list">
          <div className="list-item"><Activity size={16} /> Usos en últimos 7 días: <strong>{data?.gemini?.usos_7d || 0}</strong></div>
          <div className="list-item"><Clock size={16} /> Último uso: <strong>{formatDate(data?.gemini?.ultimo_uso)}</strong></div>
        </div>
      </SectionCard>

      {data?.configuracion?.length > 0 && (
        <SectionCard title="Configuración activa" subtitle="Valores actuales del sistema OCR">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {data.configuracion.map((cfg, i) => (
              <div key={i} className="stat-card" style={{ padding: '0.5rem 0.75rem' }}>
                <div className="stat-label" style={{ fontSize: '0.75rem' }}>{cfg.clave}</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cfg.valor || '—'}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

const TABS = [
  { key: 'panel', label: 'Panel técnico', icon: Terminal },
  { key: 'incidencias', label: 'Incidencias OCR', icon: AlertTriangle },
  { key: 'archivos', label: 'Revisión de archivos', icon: Eye },
  { key: 'recuperacion', label: 'Recuperación', icon: RotateCcw },
  { key: 'monitoreo', label: 'Monitoreo', icon: Activity }
];

export default function ActasOCRSoportePage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = React.useState('panel');

  return (
    <div className="page-container">
      <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Actas OCR inteligentes • Soporte técnico</h2>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {TABS.map(tab => (
            <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} icon={tab.icon} label={tab.label} />
          ))}
        </div>

        <div className="fade-in">
          {activeTab === 'panel' && <PanelTecnico token={token} />}
          {activeTab === 'incidencias' && <IncidenciasOCR token={token} />}
          {activeTab === 'archivos' && <RevisarArchivos token={token} />}
          {activeTab === 'recuperacion' && <Recuperacion token={token} />}
          {activeTab === 'monitoreo' && <Monitoreo token={token} />}
        </div>
      </div>
    </div>
  );
}
