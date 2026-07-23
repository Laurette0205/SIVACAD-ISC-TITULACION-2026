import React from 'react';
import { useAuth } from '../context/AuthContext';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import {
  Activity, AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, FileScan, FileText, GraduationCap, Loader2, RefreshCw, Save,
  Search, Shield, Sparkles, Users, XCircle, BarChart3, PieChart, CalendarRange
} from 'lucide-react';
import '../styles/global.css';

function normalize(v) { return String(v || '').trim().toUpperCase(); }
function safeArray(payload) { if (Array.isArray(payload)) return payload; if (payload && Array.isArray(payload.data)) return payload.data; return []; }
function safeObj(payload) { return (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {}; }
function formatDate(v) { if (!v) return '—'; try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)); } catch { return String(v); } }
function statusClass(v) { const s = normalize(v); if (s.includes('VALIDAD') || s.includes('APROB')) return 'status ok'; if (s.includes('RECHAZ')) return 'status error'; if (s.includes('PEND')) return 'status warn'; return 'status'; }

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--line)', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: '0.88rem' }}>
      <Icon size={16} /> {label}
    </button>
  );
}

function PanelAcademico({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRCoord.panel(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const resumen = data?.resumen || {};
  const stats = [
    { icon: FileScan, label: 'Cargas totales', value: resumen.total_cargas || 0, hint: 'Actas recibidas' },
    { icon: CheckCircle2, label: 'Validadas', value: resumen.validadas || 0, hint: 'Aprobadas e importadas' },
    { icon: AlertTriangle, label: 'Pendientes', value: resumen.pendientes || 0, hint: 'Revisión manual' },
    { icon: XCircle, label: 'Rechazadas', value: resumen.rechazadas || 0, hint: 'Requieren corrección' },
    { icon: Sparkles, label: 'Confianza prom.', value: `${Number(resumen.confianza_promedio || 0).toFixed(1)}%`, hint: 'Promedio global' },
    { icon: Users, label: 'Detalles importados', value: resumen.total_detalles_importados || 0, hint: 'Calificaciones en BD' }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><FileScan size={16} /> OCR de actas • Coordinador académico</div>
          <h1>Actas OCR inteligentes</h1>
          <p>Agilizar la revisión académica de actas y resultados. Enfoque en grupos, periodos, materias y seguimiento documental. Usar filtros por grupo, periodo, semestre y estado de validación.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Última revisión</small><strong>{formatDate(resumen.ultima_revision)}</strong></div>
          <div className="meta-card"><small>Detalles importados</small><strong>{resumen.total_detalles_importados || 0}</strong></div>
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

      {loading && <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando panel...</div>}

      <SectionCard title="Objetivo funcional" subtitle="Agilizar la revisión académica de actas y resultados">
        <div className="list">
          <div className="list-item"><Eye size={16} /> Consultar actas cargadas y revisar resultados</div>
          <div className="list-item"><Search size={16} /> Identificar inconsistencias en calificaciones</div>
          <div className="list-item"><CheckCircle2 size={16} /> Validar por grupo, semestre o periodo</div>
          <div className="list-item"><BookOpen size={16} /> Enfoque en grupos, periodos y materias</div>
        </div>
      </SectionCard>

      <SectionCard title="Alcance" subtitle="Grupos, periodos y materias disponibles en OCR">
        <div className="row gap wrap">
          <span className="badge light">Grupos: {data?.grupos_disponibles?.length || 0}</span>
          <span className="badge light">Periodos: {data?.periodos_disponibles?.length || 0}</span>
        </div>
      </SectionCard>
    </div>
  );
}

function ActasPorGrupo({ token }) {
  const [grupos, setGrupos] = React.useState([]);
  const [cargas, setCargas] = React.useState([]);
  const [idGrupo, setIdGrupo] = React.useState('');
  const [loadingG, setLoadingG] = React.useState(true);
  const [loadingC, setLoadingC] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRCoord.panel(token).then(r => {
      const g = r?.data?.grupos_disponibles || [];
      setGrupos(g);
      if (g.length) setIdGrupo(String(g[0].id_grupo));
    }).catch(() => {}).finally(() => setLoadingG(false));
  }, [token]);

  React.useEffect(() => {
    if (!token || !idGrupo) return;
    setLoadingC(true);
    api.actasOCRCoord.actasGrupo(token, idGrupo).then(r => setCargas(safeArray(r))).catch(() => {}).finally(() => setLoadingC(false));
  }, [token, idGrupo]);

  return (
    <div className="stack">
      <SectionCard title="Actas por grupo" subtitle="Consulta las actas OCR agrupadas por grupo">
        {loadingG ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando grupos...</div> : (
          <FormField label="Seleccionar grupo">
            <select value={idGrupo} onChange={e => setIdGrupo(e.target.value)}>
              {grupos.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo} (Sem. {g.semestre}) — {g.nombre_carrera}</option>)}
            </select>
          </FormField>
        )}
      </SectionCard>

      {loadingC ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando actas...</div> : cargas.length === 0 ? <div className="empty">No hay actas OCR para este grupo.</div> : cargas.map(c => (
        <SectionCard key={c.id_carga_ocr} title={`${c.nombre_archivo}`} subtitle={`${c.nombre_periodo || '—'} • ${c.nombre_materia || '—'}`}>
          <div className="list">
            <div className="list-item">
              <span className={statusClass(c.estado)}>{c.estado}</span>
              <span>Confianza: {Number(c.confianza_global || 0).toFixed(1)}%</span>
              <small>Materia: {c.nombre_materia || '—'} • Docente: {c.nombre_usuario || '—'}</small>
              <small>Alumnos: {(c.detalles || []).length} • Validados: {c.detalles?.filter(d => d.validado).length || 0} • {formatDate(c.created_at)}</small>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function ActasPorPeriodo({ token }) {
  const [periodos, setPeriodos] = React.useState([]);
  const [cargas, setCargas] = React.useState([]);
  const [idPeriodo, setIdPeriodo] = React.useState('');
  const [loadingP, setLoadingP] = React.useState(true);
  const [loadingC, setLoadingC] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRCoord.panel(token).then(r => {
      const p = r?.data?.periodos_disponibles || [];
      setPeriodos(p);
      if (p.length) setIdPeriodo(String(p[0].id_periodo));
    }).catch(() => {}).finally(() => setLoadingP(false));
  }, [token]);

  React.useEffect(() => {
    if (!token || !idPeriodo) return;
    setLoadingC(true);
    api.actasOCRCoord.actasPeriodo(token, idPeriodo).then(r => setCargas(safeArray(r))).catch(() => {}).finally(() => setLoadingC(false));
  }, [token, idPeriodo]);

  return (
    <div className="stack">
      <SectionCard title="Actas por periodo" subtitle="Consulta las actas OCR filtradas por periodo académico">
        {loadingP ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando periodos...</div> : (
          <FormField label="Seleccionar periodo">
            <select value={idPeriodo} onChange={e => setIdPeriodo(e.target.value)}>
              {periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
            </select>
          </FormField>
        )}
      </SectionCard>

      {loadingC ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando actas...</div> : cargas.length === 0 ? <div className="empty">No hay actas OCR para este periodo.</div> : cargas.map(c => (
        <SectionCard key={c.id_carga_ocr} title={c.nombre_archivo} subtitle={`${c.nombre_grupo || '—'} • ${c.nombre_materia || '—'}`}>
          <div className="list">
            <div className="list-item">
              <span className={statusClass(c.estado)}>{c.estado}</span>
              <span>Confianza: {Number(c.confianza_global || 0).toFixed(1)}%</span>
              <small>Grupo: {c.nombre_grupo || '—'} • Docente: {c.nombre_usuario || '—'}</small>
              <small>Alumnos: {(c.detalles || []).length} • {formatDate(c.created_at)}</small>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function ActasPorSemestre({ token }) {
  const [semestres] = React.useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [cargas, setCargas] = React.useState([]);
  const [semestre, setSemestre] = React.useState('1');
  const [loadingC, setLoadingC] = React.useState(false);

  React.useEffect(() => {
    if (!token || !semestre) return;
    setLoadingC(true);
    api.actasOCRCoord.actasSemestre(token, semestre).then(r => setCargas(safeArray(r))).catch(() => {}).finally(() => setLoadingC(false));
  }, [token, semestre]);

  return (
    <div className="stack">
      <SectionCard title="Actas por semestre" subtitle="Consulta las actas OCR filtradas por semestre del plan de estudios">
        <FormField label="Seleccionar semestre">
          <select value={semestre} onChange={e => setSemestre(e.target.value)}>
            {semestres.map(s => <option key={s} value={s}>Semestre {s}</option>)}
          </select>
        </FormField>
      </SectionCard>

      {loadingC ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando actas...</div> : cargas.length === 0 ? <div className="empty">No hay actas OCR para el semestre {semestre}.</div> : (
        <>
          <SectionCard title="Resumen" subtitle={`Semestre ${semestre}`}>
            <div className="row gap wrap">
              <span className="badge light">Actas: {cargas.length}</span>
              <span className="badge light">Validadas: {cargas.filter(c => normalize(c.estado) === 'VALIDADA').length}</span>
              <span className="badge light">Pendientes: {cargas.filter(c => normalize(c.estado).includes('PEND')).length}</span>
              <span className="badge light">Rechazadas: {cargas.filter(c => normalize(c.estado) === 'RECHAZADA').length}</span>
              <span className="badge light">Grupos: {[...new Set(cargas.map(c => c.nombre_grupo))].length}</span>
            </div>
          </SectionCard>

          {cargas.map(c => (
            <SectionCard key={c.id_carga_ocr} title={c.nombre_archivo} subtitle={`${c.nombre_grupo || '—'} • ${c.nombre_periodo || '—'}`}>
              <div className="list">
                <div className="list-item">
                  <span className={statusClass(c.estado)}>{c.estado}</span>
                  <span>Confianza: {Number(c.confianza_global || 0).toFixed(1)}%</span>
                  <small>Grupo: {c.nombre_grupo} (Sem. {c.semestre}) • Materia: {c.nombre_materia || '—'}</small>
                  <small>Alumnos: {(c.detalles || []).length} • {formatDate(c.created_at)}</small>
                </div>
              </div>
            </SectionCard>
          ))}
        </>
      )}
    </div>
  );
}

function ValidacionOCR({ token }) {
  const [cargas, setCargas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [validandoId, setValidandoId] = React.useState(null);
  const [filtro, setFiltro] = React.useState('');
  const [mensaje, setMensaje] = React.useState('');

  const loadCargas = React.useCallback(async (estado) => {
    if (!token) return;
    try { setLoading(true); const r = await api.actasOCR.cargas(token, { estado: estado || undefined, limit: 50 }); setCargas(safeArray(r)); }
    catch (e) { setMensaje('Error: ' + e.message); }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { loadCargas(filtro); }, [loadCargas, filtro]);

  const handleValidate = async (id) => {
    setValidandoId(id); setMensaje('');
    try { await api.actasOCRCoord.validar(token, id); setMensaje('Acta validada correctamente.'); await loadCargas(filtro); }
    catch (e) { setMensaje('Error: ' + (e?.message || '')); }
    finally { setValidandoId(null); }
  };

  const filtros = ['', 'VALIDACION_PENDIENTE', 'VALIDADA', 'RECHAZADA'];

  return (
    <div className="stack">
      <SectionCard title="Validación OCR" subtitle="Revisar y validar actas OCR dentro de tu ámbito académico">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          {filtros.map(f => (
            <button key={f} type="button" className={`btn ${filtro === f ? 'primary' : 'secondary'}`} onClick={() => { setFiltro(f); }}>
              {f || 'Todas'}
            </button>
          ))}
        </div>
        {mensaje && <div className="alert success">{mensaje}</div>}
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div> : cargas.length === 0 ? <div className="empty">No hay actas disponibles.</div> : cargas.map(c => (
        <SectionCard key={c.id_carga_ocr} title={c.nombre_archivo} subtitle={`${c.nombre_plantilla} • ${c.nombre_periodo || '—'} • ${c.nombre_grupo || '—'}`}>
          <div className="list">
            <div className="list-item">
              <span className={statusClass(c.estado)}>{c.estado}</span>
              <span>Confianza: {Number(c.confianza_global || 0).toFixed(1)}%</span>
              <small>Materia: {c.nombre_materia || '—'} • Docente: {c.nombre_usuario || '—'}</small>
              <small>Alumnos: {(c.detalles || []).length} • Validados: {c.detalles?.filter(d => d.validado).length || 0}</small>
              {c.observaciones_revision && <small className="auth-note">{c.observaciones_revision}</small>}
            </div>
            <div className="row gap wrap">
              <button type="button" className="btn accent" onClick={() => handleValidate(c.id_carga_ocr)} disabled={validandoId === c.id_carga_ocr}>
                {validandoId === c.id_carga_ocr ? <><Loader2 className="animate-spin" size={16} /> Validando...</> : <><Save size={16} /> Validar</>}
              </button>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function ReportesOCR({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRCoord.reportes(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando reportes...</div>;

  return (
    <div className="stack">
      <SectionCard title="Reportes OCR" subtitle="Estadísticas de actas por periodo, grupo y semestre">
        <div className="list">
          <div className="list-item"><BarChart3 size={16} /> Reportes de actividad OCR, resultados por periodo, grupo y semestre para seguimiento académico.</div>
        </div>
      </SectionCard>

      {data?.porPeriodo?.length > 0 && (
        <SectionCard title="Por periodo académico" subtitle="Cargas y validaciones por periodo">
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Periodo</th><th style={{ padding: '0.4rem' }}>Cargas</th>
                <th style={{ padding: '0.4rem' }}>Validadas</th><th style={{ padding: '0.4rem' }}>Pendientes</th>
                <th style={{ padding: '0.4rem' }}>Rechazadas</th><th style={{ padding: '0.4rem' }}>Confianza</th>
              </tr></thead>
              <tbody>{data.porPeriodo.map(r => (
                <tr key={r.id_periodo} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_periodo}</td>
                  <td style={{ padding: '0.4rem' }}>{r.total_cargas}</td>
                  <td style={{ padding: '0.4rem' }} className="status ok">{r.validadas}</td>
                  <td style={{ padding: '0.4rem' }} className="status warn">{r.pendientes}</td>
                  <td style={{ padding: '0.4rem' }} className="status error">{r.rechazadas}</td>
                  <td style={{ padding: '0.4rem' }}>{Number(r.confianza_promedio || 0).toFixed(1)}%</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </SectionCard>
      )}

      {data?.porGrupo?.length > 0 && (
        <SectionCard title="Por grupo" subtitle="Actas agrupadas por grupo académico">
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Grupo</th><th style={{ padding: '0.4rem' }}>Sem.</th>
                <th style={{ padding: '0.4rem' }}>Carrera</th><th style={{ padding: '0.4rem' }}>Cargas</th>
                <th style={{ padding: '0.4rem' }}>Validadas</th><th style={{ padding: '0.4rem' }}>Confianza</th>
              </tr></thead>
              <tbody>{data.porGrupo.map(r => (
                <tr key={r.id_grupo} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_grupo}</td>
                  <td style={{ padding: '0.4rem' }}>{r.semestre}</td>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_carrera}</td>
                  <td style={{ padding: '0.4rem' }}>{r.total_cargas}</td>
                  <td style={{ padding: '0.4rem' }} className="status ok">{r.validadas}</td>
                  <td style={{ padding: '0.4rem' }}>{Number(r.confianza_promedio || 0).toFixed(1)}%</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </SectionCard>
      )}

      {data?.porSemestre?.length > 0 && (
        <SectionCard title="Por semestre" subtitle="Resumen por semestre del plan de estudios">
          <div className="row gap wrap">
            {data.porSemestre.map(r => (
              <div className="stat-card" key={r.semestre} style={{ minWidth: '130px' }}>
                <div className="stat-label">Semestre {r.semestre}</div>
                <div className="stat-value">{r.total_cargas}</div>
                <div className="stat-hint">{r.validadas} validadas • {r.grupos_con_actas} grupos</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data?.recientes?.length > 0 && (
        <SectionCard title="Actas recientes" subtitle="Últimas 20 actas cargadas">
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.3rem' }}>Archivo</th><th style={{ padding: '0.3rem' }}>Periodo</th>
                <th style={{ padding: '0.3rem' }}>Grupo</th><th style={{ padding: '0.3rem' }}>Estado</th>
                <th style={{ padding: '0.3rem' }}>Conf.</th><th style={{ padding: '0.3rem' }}>Fecha</th>
              </tr></thead>
              <tbody>{data.recientes.map(r => (
                <tr key={r.id_carga_ocr} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.3rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre_archivo}</td>
                  <td style={{ padding: '0.3rem' }}>{r.nombre_periodo || '—'}</td>
                  <td style={{ padding: '0.3rem' }}>{r.nombre_grupo || '—'}</td>
                  <td style={{ padding: '0.3rem' }}><span className={statusClass(r.estado)}>{r.estado}</span></td>
                  <td style={{ padding: '0.3rem' }}>{Number(r.confianza_global || 0).toFixed(0)}%</td>
                  <td style={{ padding: '0.3rem', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </SectionCard>
      )}

      {!data && <div className="empty">No hay datos de reportes disponibles.</div>}
    </div>
  );
}

export default function ActasOCRCoordinadorPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = React.useState('panel-academico');

  const tabs = [
    { id: 'panel-academico', label: 'Panel académico', icon: Activity },
    { id: 'actas-grupo', label: 'Actas por grupo', icon: Users },
    { id: 'actas-periodo', label: 'Actas por periodo', icon: CalendarRange },
    { id: 'actas-semestre', label: 'Actas por semestre', icon: GraduationCap },
    { id: 'validacion', label: 'Validación OCR', icon: Shield },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 }
  ];
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map(t => <TabButton key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
      </div>

      {activeTab === 'panel-academico' && <PanelAcademico token={token} />}
      {activeTab === 'actas-grupo' && <ActasPorGrupo token={token} />}
      {activeTab === 'actas-periodo' && <ActasPorPeriodo token={token} />}
      {activeTab === 'actas-semestre' && <ActasPorSemestre token={token} />}
      {activeTab === 'validacion' && <ValidacionOCR token={token} />}
      {activeTab === 'reportes' && <ReportesOCR token={token} />}
    </div>
  );
}
