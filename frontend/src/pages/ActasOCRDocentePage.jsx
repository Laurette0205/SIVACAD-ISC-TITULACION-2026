import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import {
  Activity, AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Eye, FileScan, FileText, GraduationCap, Loader2, RefreshCw, Save,
  Search, Send, Shield, Sparkles, Upload, Users, XCircle, Edit3, Check,
  TrendingUp
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

function PanelDocenteOCR({ token }) {
  const navigate = useNavigate();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRDocente.panel(token).then(r => setData(r?.data || null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const stats = data?.stats || {};
  const grupos = data?.grupos_asignados || [];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><FileScan size={16} /> OCR de actas • Docente</div>
          <h1>Actas OCR inteligentes</h1>
          <p>Facilitar la captura y validacion de actas de calificaciones del docente. Implementar flujo "cargar-revisar-corregir-validar". Reduce el tiempo de captura, minimiza errores y mejora la entrega documental.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Docente</small><strong>{data?.docente?.clave_docente || '—'}</strong></div>
          <div className="meta-card"><small>Grupos</small><strong>{grupos.length}</strong></div>
        </div>
      </section>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando panel...</div> : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[
              { icon: FileScan, label: 'Mis actas', value: stats.total_mis_actas || 0, hint: 'Total cargadas' },
              { icon: CheckCircle2, label: 'Validadas', value: stats.validadas || 0, hint: 'Aprobadas' },
              { icon: AlertTriangle, label: 'Pendientes', value: stats.pendientes || 0, hint: 'Revision' },
              { icon: XCircle, label: 'Rechazadas', value: stats.rechazadas || 0, hint: 'Requieren correccion' },
              { icon: Sparkles, label: 'Confianza', value: `${Number(stats.confianza_promedio || 0).toFixed(1)}%`, hint: 'Promedio' },
              { icon: Users, label: 'Grupos', value: stats.total_grupos || 0, hint: 'Asignados' }
            ].map(item => { const Icon = item.icon; return (
              <div className="stat-card" key={item.label}>
                <div><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-hint">{item.hint}</div></div>
                <div className="stat-icon"><Icon size={22} /></div>
              </div>
            ); })}
          </div>

          <SectionCard title="Acciones del docente OCR" subtitle="Cargar, revisar, corregir y confirmar actas de calificaciones">
            <div className="quick-grid">
              <button type="button" className="quick-item" onClick={() => navigate('/app/docente')}>
                <div className="quick-left"><div className="quick-icon"><GraduationCap size={18} /></div><div><strong>Panel docente</strong><span>Volver al panel principal</span></div></div>
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Grupos y materias asignadas" subtitle="Bajo su responsabilidad docente">
            {grupos.length === 0 ? <div className="auth-note">No hay grupos asignados para el periodo actual.</div> : (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {grupos.map((g, i) => (
                  <div key={i} className="stat-card" style={{ minWidth: 180 }}>
                    <BookOpen size={20} />
                    <div className="stat-value">{g.nombre_grupo}</div>
                    <div className="stat-label">{g.nombre_materia}</div>
                    <div className="stat-label">{g.nombre_periodo} | Sem. {g.semestre} | {g.turno}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Beneficio institucional" subtitle="Mejora la entrega documental">
            <div className="status ok"><TrendingUp size={18} /> Reduce el tiempo de captura, minimiza errores y mejora la entrega documental.</div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function CargaActas({ token }) {
  const [grupos, setGrupos] = React.useState([]);
  const [loadingG, setLoadingG] = React.useState(true);
  const [loadingU, setLoadingU] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [form, setForm] = React.useState({ id_periodo: '', id_grupo: '', id_materia: '', regla_manual: '' });
  const [misActas, setMisActas] = React.useState([]);
  const [loadingA, setLoadingA] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!token) return;
    try { setLoadingG(true); const r = await api.actasOCRDocente.misGrupos(token); const gr = safeArray(r); setGrupos(gr); if (gr.length && !form.id_grupo) setForm(p => ({ ...p, id_grupo: String(gr[0].id_grupo), id_periodo: String(gr[0].id_periodo), id_materia: String(gr[0].id_materia) })); } catch (e) { setError(e.message); }
    finally { setLoadingG(false); }
    try { setLoadingA(true); const r = await api.actasOCRDocente.misActas(token); setMisActas(safeArray(r)); } catch (e) {}
    finally { setLoadingA(false); }
  }, [token]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!file) { setError('Selecciona una imagen o PDF del acta.'); return; }
    setLoadingU(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file); fd.append('id_periodo', form.id_periodo);
      fd.append('id_grupo', form.id_grupo); fd.append('id_materia', form.id_materia);
      if (form.regla_manual) fd.append('regla_manual', form.regla_manual);
      await api.actasOCRDocente.subir(token, fd);
      setMessage('Acta subida correctamente. Revisa la vista previa.'); setFile(null); await loadData();
    } catch (e) { setError(e?.message || 'Error al subir.'); }
    finally { setLoadingU(false); }
  };

  const grupoActual = grupos.find(g => String(g.id_grupo) === String(form.id_grupo));

  return (
    <div className="stack">
      <SectionCard title="Carga de actas" subtitle="Subir acta de calificaciones para OCR">
        <form onSubmit={handleSubmit} className="form-stack">
          {loadingG ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando grupos...</div> : (
            <>
              <div className="grid-two">
                <FormField label="Grupo">
                  <select value={form.id_grupo} onChange={e => { const g = grupos.find(x => String(x.id_grupo) === e.target.value); setForm(p => ({ ...p, id_grupo: e.target.value, id_periodo: String(g?.id_periodo || ''), id_materia: String(g?.id_materia || '') })); }}>
                    {grupos.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo} — {g.nombre_materia} ({g.nombre_periodo})</option>)}
                  </select>
                </FormField>
                <FormField label="Periodo">
                  <input type="text" value={grupoActual?.nombre_periodo || form.id_periodo} disabled />
                </FormField>
              </div>
              <div className="grid-two">
                <FormField label="Materia">
                  <input type="text" value={grupoActual?.nombre_materia || '—'} disabled />
                </FormField>
                <FormField label="Archivo del acta">
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                </FormField>
              </div>
              <FormField label="Observaciones">
                <textarea rows="2" value={form.regla_manual} onChange={e => setForm(p => ({ ...p, regla_manual: e.target.value }))} placeholder="Notas adicionales para la revision" />
              </FormField>
              <button className="btn primary" type="submit" disabled={loadingU}>
                {loadingU ? <><Loader2 className="animate-spin" size={18} /> Subiendo...</> : <><Upload size={18} /> Subir acta</>}
              </button>
            </>
          )}
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
        </form>
      </SectionCard>

      <SectionCard title="Mis actas recientes" subtitle="Ultimas actas cargadas">
        {loadingA ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando...</div> : misActas.length === 0 ? <div className="empty">No has cargado actas aun.</div> : (
          <div className="list">
            {misActas.map(a => (
              <div key={a.id_carga_ocr} className="list-item">
                <strong>{a.nombre_archivo}</strong>
                <span className={statusClass(a.estado)}>{a.estado}</span>
                <small>{a.nombre_periodo || '—'} | {a.nombre_grupo || '—'} | {a.nombre_materia || '—'}</small>
                <small>Confianza: {Number(a.confianza_global || 0).toFixed(1)}% | {formatDate(a.created_at)}</small>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function VistaPreviaOCR({ token }) {
  const [actas, setActas] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [detalle, setDetalle] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingDet, setLoadingDet] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRDocente.misActas(token).then(r => setActas(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => {
    if (!token || !selectedId) return;
    setLoadingDet(true);
    api.actasOCRDocente.actaById(token, selectedId).then(r => setDetalle(r?.data || null)).catch(() => {}).finally(() => setLoadingDet(false));
  }, [token, selectedId]);

  return (
    <div className="stack">
      <SectionCard title="Vista previa OCR" subtitle="Selecciona un acta para ver los datos extraidos">
        {loading ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando actas...</div> : actas.length === 0 ? <div className="empty">No hay actas cargadas.</div> : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {actas.map(a => (
              <button key={a.id_carga_ocr} type="button" className={`btn ${Number(selectedId) === Number(a.id_carga_ocr) ? 'primary' : 'secondary'}`} onClick={() => setSelectedId(a.id_carga_ocr)}>
                {a.nombre_archivo.substring(0, 20)}...
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {loadingDet ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando detalle...</div> : detalle ? (
        <>
          <SectionCard title="Informacion del acta" subtitle={detalle.nombre_archivo}>
            <div className="list">
              <div className="list-item"><strong>Estado:</strong> <span className={statusClass(detalle.estado)}>{detalle.estado}</span></div>
              <div className="list-item"><strong>Plantilla:</strong> {detalle.nombre_plantilla}</div>
              <div className="list-item"><strong>Periodo:</strong> {detalle.nombre_periodo || '—'}</div>
              <div className="list-item"><strong>Grupo:</strong> {detalle.nombre_grupo || '—'}</div>
              <div className="list-item"><strong>Materia:</strong> {detalle.nombre_materia || '—'}</div>
              <div className="list-item"><strong>Confianza:</strong> {Number(detalle.confianza_global || 0).toFixed(1)}%</div>
              <div className="list-item"><strong>Firma detectada:</strong> {detalle.firma_detectada ? 'Si' : 'No'}</div>
            </div>
          </SectionCard>

          {detalle.json_resultado && (
            <SectionCard title="JSON extraido" subtitle="Datos crudos del OCR">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', maxHeight: '300px', overflowY: 'auto' }}>{JSON.stringify(detalle.json_resultado, null, 2)}</pre>
            </SectionCard>
          )}

          <SectionCard title="Alumnos detectados" subtitle={`${(detalle.detalles || []).length} registros`}>
            {(detalle.detalles || []).length === 0 ? <div className="empty">Sin alumnos extraidos.</div> : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>#</th><th style={{ padding: '0.4rem' }}>Matricula</th>
                    <th style={{ padding: '0.4rem' }}>Nombre</th><th style={{ padding: '0.4rem' }}>Calif.</th>
                    <th style={{ padding: '0.4rem' }}>Estado</th>
                  </tr></thead>
                  <tbody>{detalle.detalles.map((d, i) => (
                    <tr key={d.id_detalle_ocr || i} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '0.4rem' }}>{i + 1}</td>
                      <td style={{ padding: '0.4rem' }}>{d.matricula}</td>
                      <td style={{ padding: '0.4rem' }}>{d.nombre_completo}</td>
                      <td style={{ padding: '0.4rem' }}>{d.calificacion}</td>
                      <td style={{ padding: '0.4rem' }}>{d.validado ? <span className="status ok">Validado</span> : <span className="status warn">Pendiente</span>}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>
            )}
          </SectionCard>
        </>
      ) : selectedId ? <div className="empty">Selecciona un acta para ver su detalle.</div> : null}
    </div>
  );
}

function CorreccionDatos({ token }) {
  const [actas, setActas] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [detalle, setDetalle] = React.useState(null);
  const [alumnosEdit, setAlumnosEdit] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!token) return;
    api.actasOCRDocente.misActas(token).then(r => setActas(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => {
    if (!token || !selectedId) return;
    api.actasOCRDocente.actaById(token, selectedId).then(r => {
      const d = r?.data || null; setDetalle(d);
      if (d?.detalles) setAlumnosEdit(d.detalles.map(a => ({ ...a, _edit: false })));
    }).catch(() => {});
  }, [token, selectedId]);

  const toggleEdit = (idx) => {
    setAlumnosEdit(prev => prev.map((a, i) => i === idx ? { ...a, _edit: !a._edit } : a));
  };

  const updateAlumno = (idx, field, value) => {
    setAlumnosEdit(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true); setMessage('');
    try {
      await api.actasOCRDocente.corregir(token, selectedId, alumnosEdit.map(a => ({
        id_detalle_ocr: a.id_detalle_ocr,
        matricula: a.matricula,
        nombre_completo: a.nombre_completo,
        calificacion: a.calificacion,
        observaciones: a.observaciones
      })));
      setMessage('Datos corregidos correctamente.');
    } catch (e) { setMessage('Error: ' + (e?.message || '')); }
    finally { setSaving(false); }
  };

  return (
    <div className="stack">
      <SectionCard title="Correccion de datos OCR" subtitle="Selecciona un acta y corrige los datos extraidos">
        {loading ? <div className="alert info"><Loader2 className="animate-spin" size={16} /> Cargando...</div> : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {actas.filter(a => normalize(a.estado) !== 'VALIDADA').map(a => (
              <button key={a.id_carga_ocr} type="button" className={`btn ${Number(selectedId) === Number(a.id_carga_ocr) ? 'primary' : 'secondary'}`} onClick={() => setSelectedId(a.id_carga_ocr)}>
                {a.nombre_grupo || '—'} | {a.nombre_materia?.substring(0, 15) || '—'}
              </button>
            ))}
            {actas.filter(a => normalize(a.estado) !== 'VALIDADA').length === 0 && <div className="empty">Todas las actas estan validadas.</div>}
          </div>
        )}
      </SectionCard>

      {message && <div className="alert success">{message}</div>}

      {detalle && (
        <SectionCard title={`Corregir — ${detalle.nombre_grupo || '—'} | ${detalle.nombre_materia || '—'}`} subtitle="Edita los campos necesarios y guarda">
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.3rem' }}>#</th><th style={{ padding: '0.3rem' }}>Matricula</th>
                <th style={{ padding: '0.3rem' }}>Nombre</th><th style={{ padding: '0.3rem' }}>Calif.</th>
                <th style={{ padding: '0.3rem' }}>Editar</th>
              </tr></thead>
              <tbody>{alumnosEdit.map((a, i) => (
                <tr key={a.id_detalle_ocr || i} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.3rem' }}>{i + 1}</td>
                  <td style={{ padding: '0.3rem' }}>{a._edit ? <input type="text" value={a.matricula} onChange={e => updateAlumno(i, 'matricula', e.target.value)} style={{ width: 90 }} /> : a.matricula}</td>
                  <td style={{ padding: '0.3rem' }}>{a._edit ? <input type="text" value={a.nombre_completo} onChange={e => updateAlumno(i, 'nombre_completo', e.target.value)} style={{ width: 160 }} /> : a.nombre_completo}</td>
                  <td style={{ padding: '0.3rem' }}>{a._edit ? <input type="number" value={a.calificacion} onChange={e => updateAlumno(i, 'calificacion', e.target.value)} style={{ width: 70 }} step="0.1" min="0" max="100" /> : a.calificacion}</td>
                  <td style={{ padding: '0.3rem' }}>
                    <button type="button" className="btn secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => toggleEdit(i)}>
                      {a._edit ? <Check size={14} /> : <Edit3 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="btn accent" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="animate-spin" size={16} /> Guardando...</> : <><Save size={16} /> Guardar correcciones</>}
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ConfirmacionFinal({ token }) {
  const [actas, setActas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [confirmandoId, setConfirmandoId] = React.useState(null);
  const [message, setMessage] = React.useState('');

  const loadActas = React.useCallback(async () => {
    if (!token) return;
    try { const r = await api.actasOCRDocente.misActas(token); setActas(safeArray(r)); } catch (e) {}
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { loadActas(); }, [loadActas]);

  const handleConfirmar = async (id) => {
    setConfirmandoId(id); setMessage('');
    try { await api.actasOCRDocente.confirmar(token, id); setMessage('Acta confirmada y enviada para validacion institucional.'); await loadActas(); }
    catch (e) { setMessage('Error: ' + (e?.message || '')); }
    finally { setConfirmandoId(null); }
  };

  const pendientes = actas.filter(a => normalize(a.estado) !== 'VALIDADA' && normalize(a.estado) !== 'RECHAZADA');

  return (
    <div className="stack">
      <SectionCard title="Confirmacion final" subtitle="Enviar actas para validacion institucional">
        <div className="list">
          <div className="list-item"><Send size={16} /> Revisa que los datos sean correctos y envia el acta para validacion.</div>
          <div className="list-item"><Shield size={16} /> Una vez confirmada, el acta pasara a revision por el area correspondiente.</div>
        </div>
        {message && <div className="alert success">{message}</div>}
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div> : pendientes.length === 0 ? <div className="empty">No hay actas pendientes de confirmacion.</div> : pendientes.map(a => (
        <SectionCard key={a.id_carga_ocr} title={`${a.nombre_grupo || '—'} | ${a.nombre_materia || '—'}`} subtitle={a.nombre_periodo || '—'}>
          <div className="list">
            <div className="list-item">
              <span className={statusClass(a.estado)}>{a.estado}</span>
              <span>Confianza: {Number(a.confianza_global || 0).toFixed(1)}%</span>
              <small>Archivo: {a.nombre_archivo}</small>
              <small>Alumnos: {(a.detalles || []).length} | {formatDate(a.created_at)}</small>
            </div>
            <div className="row gap wrap">
              <button type="button" className="btn accent" onClick={() => handleConfirmar(a.id_carga_ocr)} disabled={confirmandoId === a.id_carga_ocr}>
                {confirmandoId === a.id_carga_ocr ? <><Loader2 className="animate-spin" size={16} /> Confirmando...</> : <><CheckCircle2 size={16} /> Confirmar y enviar</>}
              </button>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

export default function ActasOCRDocentePage() {
  const { token, user } = useAuth();
  const [tab, setTab] = React.useState('panel-docente');

  const tabs = [
    { id: 'panel-docente', label: 'Panel docente', icon: Activity },
    { id: 'carga-actas', label: 'Carga de actas', icon: Upload },
    { id: 'vista-previa', label: 'Vista previa OCR', icon: Eye },
    { id: 'correccion', label: 'Correccion de datos', icon: Edit3 },
    { id: 'confirmacion', label: 'Confirmacion final', icon: CheckCircle2 }
  ];
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map(t => <TabButton key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
      </div>

      {activeTab === 'panel-docente' && <PanelDocenteOCR token={token} />}
      {activeTab === 'carga-actas' && <CargaActas token={token} />}
      {activeTab === 'vista-previa' && <VistaPreviaOCR token={token} />}
      {activeTab === 'correccion' && <CorreccionDatos token={token} />}
      {activeTab === 'confirmacion' && <ConfirmacionFinal token={token} />}
    </div>
  );
}
