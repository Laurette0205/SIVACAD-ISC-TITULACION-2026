import React from 'react';
import { useAuth } from '../context/AuthContext';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import {
  Activity, BookOpen, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, FileScan, FileText, GraduationCap, Loader2, RefreshCw, Search,
  Shield, Sparkles, TrendingUp, Users, XCircle, BarChart3, PieChart,
  Award, Star
} from 'lucide-react';
import '../styles/global.css';

function normalize(v) { return String(v || '').trim().toUpperCase(); }
function safeArray(payload) { if (Array.isArray(payload)) return payload; if (payload && Array.isArray(payload.data)) return payload.data; return []; }
function safeObj(payload) { return (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {}; }
function formatDate(v) { if (!v) return '—'; try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)); } catch { return String(v); } }
function statusClass(v) { const s = normalize(v); if (s.includes('VALIDAD') || s.includes('IMPORT')) return 'status ok'; if (s.includes('RECHAZ')) return 'status error'; if (s.includes('PEND') || s.includes('BORR')) return 'status warn'; return 'status'; }

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--line)', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: '0.88rem' }}>
      <Icon size={16} /> {label}
    </button>
  );
}

function PanelConsulta({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRAlumno.panel(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const stats = data?.stats || {};
  const alumno = data?.alumno || {};

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><FileScan size={16} /> Actas OCR • Alumno</div>
          <h1>Actas OCR inteligentes</h1>
          <p>Proporcionar acceso seguro a informacion academica derivada de actas OCR. Presentar consultas simples, seguras y visuales para incrementar la transparencia academica y mejorar la experiencia de consulta.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Matricula</small><strong>{alumno.matricula || '—'}</strong></div>
          <div className="meta-card"><small>Semestre</small><strong>{alumno.semestre_actual || '—'}</strong></div>
        </div>
      </section>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div> : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[
              { icon: FileScan, label: 'Actas registradas', value: stats.total_actas || 0, hint: 'Con tu informacion' },
              { icon: BookOpen, label: 'Calificaciones', value: stats.total_calificaciones || 0, hint: 'Materias cursadas' },
              { icon: Award, label: 'Promedio general', value: stats.promedio_general || '0.00', hint: 'Global' },
              { icon: CalendarRange, label: 'Ultima actualizacion', value: stats.ultima_actualizacion ? formatDate(stats.ultima_actualizacion) : '—', hint: 'Fecha' }
            ].map(item => { const Icon = item.icon; return (
              <div className="stat-card" key={item.label}>
                <div><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-hint">{item.hint}</div></div>
                <div className="stat-icon"><Icon size={22} /></div>
              </div>
            ); })}
          </div>

          <SectionCard title="Objetivo funcional" subtitle="Acceso seguro a informacion academica derivada">
            <div className="list">
              <div className="list-item"><Eye size={16} /> Consultar informacion derivada de actas OCR</div>
              <div className="list-item"><Search size={16} /> Revisar estados y calificaciones autorizadas</div>
              <div className="list-item"><TrendingUp size={16} /> Verificar avances academicos</div>
              <div className="list-item"><Shield size={16} /> Consulta restringida sin edicion documental</div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function HistorialAcademico({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRAlumno.historial(token).then(r => setRows(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Historial academico" subtitle="Registro de calificaciones derivadas de actas OCR">
        <div className="status-list">
          <div className="status ok"><FileText size={18} /> Historial completo de materias cursadas, calificaciones y periodos academicos.</div>
        </div>
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando historial...</div> : rows.length === 0 ? (
        <div className="empty">No hay registros en el historial academico. Los datos apareceran cuando se procesen actas OCR.</div>
      ) : (
        <SectionCard title="Detalle del historial" subtitle={`${rows.length} registros`}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Periodo</th><th style={{ padding: '0.4rem' }}>Grupo</th>
                <th style={{ padding: '0.4rem' }}>Materia</th><th style={{ padding: '0.4rem' }}>Clave</th>
                <th style={{ padding: '0.4rem' }}>Calificacion</th><th style={{ padding: '0.4rem' }}>Acta</th>
                <th style={{ padding: '0.4rem' }}>Fecha</th>
              </tr></thead>
              <tbody>{rows.map(r => {
                const calif = Number(r.calificacion || 0);
                return (
                <tr key={r.id_detalle_acta} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_periodo || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_grupo || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{r.nombre_materia || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{r.clave_materia || '—'}</td>
                  <td style={{ padding: '0.4rem', fontWeight: 600, color: calif >= 60 ? '#22c55e' : '#ef4444' }}>{calif}</td>
                  <td style={{ padding: '0.4rem' }}><span className={statusClass(r.estado_acta)}>{r.estado_acta}</span></td>
                  <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{formatDate(r.fecha_acta)}</td>
                </tr>
              );
              })}</tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Resultados({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRAlumno.resultados(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const resumen = data?.resumen || {};
  const porPeriodo = data?.porPeriodo || [];
  const mejorMateria = data?.mejor_materia || null;

  return (
    <div className="stack">
      <SectionCard title="Resultados academicos" subtitle="Resumen de calificaciones derivadas de actas OCR">
        <div className="status-list">
          <div className="status ok"><BarChart3 size={18} /> Resultados globales y por periodo academico.</div>
        </div>
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando resultados...</div> : !data ? (
        <div className="empty">No hay datos disponibles. Los resultados apareceran cuando se procesen actas OCR.</div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {[
              { icon: CalendarRange, label: 'Periodos cursados', value: resumen.periodos_cursados || 0 },
              { icon: BookOpen, label: 'Materias cursadas', value: resumen.total_materias || 0 },
              { icon: Award, label: 'Promedio global', value: Number(resumen.promedio_global || 0).toFixed(2) },
              { icon: CheckCircle2, label: 'Aprobadas', value: resumen.total_aprobadas || 0, extra: 'color: #22c55e' },
              { icon: XCircle, label: 'Reprobadas', value: resumen.total_reprobadas || 0, extra: 'color: #ef4444' }
            ].map(item => { const Icon = item.icon; return (
              <div className="stat-card" key={item.label}>
                <div><div className="stat-label">{item.label}</div><div className="stat-value" style={item.extra ? { color: item.extra.split(':')[1]?.trim() } : {}}>{item.value}</div></div>
                <div className="stat-icon"><Icon size={22} /></div>
              </div>
            ); })}
          </div>

          {mejorMateria && (
            <SectionCard title="Mejor calificacion" subtitle="Materia con mayor promedio">
              <div className="list">
                <div className="list-item">
                  <Star size={18} style={{ color: '#eab308' }} />
                  <strong>{mejorMateria.nombre_materia}</strong>
                  <span style={{ fontWeight: 700, color: '#22c55e' }}>{Number(mejorMateria.calificacion || 0).toFixed(1)}</span>
                  <small>{mejorMateria.nombre_periodo}</small>
                </div>
              </div>
            </SectionCard>
          )}

          {porPeriodo.length > 0 && (
            <SectionCard title="Resultados por periodo" subtitle="Desglose por periodo academico">
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>Periodo</th><th style={{ padding: '0.4rem' }}>Materias</th>
                    <th style={{ padding: '0.4rem' }}>Promedio</th><th style={{ padding: '0.4rem' }}>Aprobadas</th>
                    <th style={{ padding: '0.4rem' }}>Reprobadas</th>
                  </tr></thead>
                  <tbody>{porPeriodo.map(r => (
                    <tr key={r.id_periodo} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '0.4rem' }}>{r.nombre_periodo}</td>
                      <td style={{ padding: '0.4rem' }}>{r.materias}</td>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{Number(r.promedio || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.4rem', color: '#22c55e' }}>{r.aprobadas}</td>
                      <td style={{ padding: '0.4rem', color: r.reprobadas > 0 ? '#ef4444' : undefined }}>{r.reprobadas}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function ActasValidadas({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRAlumno.actasValidadas(token).then(r => setRows(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Actas validadas" subtitle="Actas OCR autorizadas que contienen tu informacion academica">
        <div className="status-list">
          <div className="status ok"><Shield size={18} /> Vista de actas validadas e importadas. Consulta restringida sin edicion documental.</div>
        </div>
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando actas...</div> : rows.length === 0 ? (
        <div className="empty">No hay actas validadas con tu informacion. Los datos apareceran cuando se procesen actas OCR.</div>
      ) : (
        rows.map(r => (
          <SectionCard key={r.id_acta_calificacion} title={`${r.nombre_materia || '—'}`} subtitle={`${r.nombre_periodo || '—'} | ${r.nombre_grupo || '—'}`}>
            <div className="list">
              <div className="list-item">
                <span className={statusClass(r.estado)}>{r.estado}</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: Number(r.calificacion || 0) >= 60 ? '#22c55e' : '#ef4444' }}>{Number(r.calificacion || 0).toFixed(1)}</span>
                <small>Clave: {r.clave_materia || '—'} | Semestre {r.semestre || '—'}</small>
                <small>Total alumnos en acta: {r.total_alumnos || '—'} | Promedio grupal: {Number(r.promedio_grupal || 0).toFixed(2)}</small>
                <small>{formatDate(r.created_at)}</small>
              </div>
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}

export default function ActasOCRAlumnoPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = React.useState('panel-consulta');

  const tabs = [
    { id: 'panel-consulta', label: 'Panel de consulta', icon: Activity },
    { id: 'historial', label: 'Historial academico', icon: FileText },
    { id: 'resultados', label: 'Resultados', icon: BarChart3 },
    { id: 'actas-validadas', label: 'Actas validadas', icon: Shield }
  ];
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map(t => <TabButton key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
      </div>

      {activeTab === 'panel-consulta' && <PanelConsulta token={token} />}
      {activeTab === 'historial' && <HistorialAcademico token={token} />}
      {activeTab === 'resultados' && <Resultados token={token} />}
      {activeTab === 'actas-validadas' && <ActasValidadas token={token} />}
    </div>
  );
}
