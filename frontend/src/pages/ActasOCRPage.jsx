import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, Eye, FileScan, FileText,
  History, Loader2, RefreshCw, Save, Search, Settings, Shield, ShieldCheck,
  Sparkles, Upload, Users, BookOpen, GraduationCap, Ban, XCircle, Activity,
  ClipboardList, Wrench, ScrollText, Sliders, ChevronLeft, ChevronRight
} from 'lucide-react';
import '../styles/global.css';

function normalize(value) { return String(value || '').trim().toUpperCase(); }
function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
function safeObj(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  return {};
}
function formatDate(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
  catch { return String(value); }
}
function statusClass(value) {
  const s = normalize(value);
  if (s.includes('VALIDAD') || s.includes('APROB')) return 'status ok';
  if (s.includes('RECHAZ')) return 'status error';
  if (s.includes('PEND')) return 'status warn';
  return 'status';
}
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--line)', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: '0.88rem' }}>
      <Icon size={16} /> {label}
    </button>
  );
}

function PanelGeneral({ token, catalogos, resumen, loading }) {
  const stats = [
    { icon: FileScan, label: 'Cargas totales', value: resumen.total_cargas || 0, hint: 'Actas recibidas' },
    { icon: CheckCircle2, label: 'Validadas', value: resumen.validadas || 0, hint: 'Importadas o aprobadas' },
    { icon: AlertTriangle, label: 'Pendientes', value: resumen.pendientes || 0, hint: 'Revisión manual' },
    { icon: XCircle, label: 'Rechazadas', value: resumen.rechazadas || 0, hint: 'Requieren corrección' },
    { icon: Sparkles, label: 'Confianza promedio', value: `${Number(resumen.confianza_promedio || 0).toFixed(1)}%`, hint: resumen.confianza_promedio >= 90 ? 'Muy alta' : resumen.confianza_promedio >= 75 ? 'Alta' : resumen.confianza_promedio >= 50 ? 'Media' : 'Baja' },
    { icon: Download, label: 'Detalles importados', value: resumen.total_detalles_importados || 0, hint: 'Calificaciones en BD' }
  ];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><FileScan size={16} /> OCR de actas institucionales • Administrador</div>
          <h1>Actas OCR inteligentes</h1>
          <p>Centralizar el control, validación y auditoría del proceso OCR. Aplicar control de confianza, revisión manual y bitácora de acciones. Fortalece el control institucional, reduce errores y mejora la trazabilidad documental.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Última revisión</small><strong>{formatDate(resumen.ultima_revision)}</strong></div>
          <div className="meta-card"><small>Detalles importados</small><strong>{resumen.total_detalles_importados || 0}</strong></div>
        </div>
      </section>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div className="stat-card" key={item.label}>
              <div>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value">{item.value}</div>
                <div className="stat-hint">{item.hint}</div>
              </div>
              <div className="stat-icon"><Icon size={22} /></div>
            </div>
          );
        })}
      </div>

      {loading && <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Loader2 className="animate-spin" size={18} /> Cargando panel...</div>}

      <div className="two-col">
        <SectionCard title="Objetivo funcional" subtitle="Centralizar el control, validación y auditoría del proceso OCR">
          <div className="list">
            <div className="list-item"><ShieldCheck size={16} /> Acceso completo al flujo documental</div>
            <div className="list-item"><Eye size={16} /> Revisar cargas, aprobar o rechazar documentos</div>
            <div className="list-item"><AlertTriangle size={16} /> Supervisar incidencias y validar trazabilidad</div>
            <div className="list-item"><History size={16} /> Consultar historial de procesos</div>
          </div>
        </SectionCard>

        <SectionCard title="Alcance" subtitle="Cobertura del módulo OCR">
          <div className="list">
            <div className="list-item"><FileScan size={16} /> Archivos, resultados OCR y validaciones</div>
            <div className="list-item"><ClipboardList size={16} /> Incidencias y registros de actividad</div>
            <div className="list-item"><Wrench size={16} /> Aplicar control de confianza y revisión manual</div>
            <div className="list-item"><ScrollText size={16} /> Bitácora de acciones y auditoría</div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Catálogos disponibles" subtitle="Recursos del sistema OCR">
        <div className="row gap wrap">
          <span className="badge light">Plantillas: {catalogos.plantillas || 0}</span>
          <span className="badge light">Períodos: {catalogos.periodos || 0}</span>
          <span className="badge light">Grupos: {catalogos.grupos || 0}</span>
          <span className="badge light">Materias: {catalogos.materias || 0}</span>
          <span className="badge light">Docentes: {catalogos.docentes || 0}</span>
          <span className="badge light">Firmas: {catalogos.firmas || 0}</span>
        </div>
      </SectionCard>
    </div>
  );
}

function ModuloOCR({ token, loadPage }) {
  const [catalogos, setCatalogos] = React.useState({ plantillas: [], periodos: [], grupos: [], materias: [], docentes: [] });
  const [cargas, setCargas] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingUpload, setLoadingUpload] = React.useState(false);
  const [loadingValidateId, setLoadingValidateId] = React.useState(null);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [form, setForm] = React.useState({ codigo_plantilla: 'ACTA_CALIFICACIONES', id_periodo: '', id_grupo: '', id_materia: '', id_docente: '', regla_manual: '' });

  const loadData = React.useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true); setError('');
      const [catRes, cargasRes] = await Promise.allSettled([api.actasOCR.catalogos(token), api.actasOCR.cargas(token)]);
      if (catRes.status === 'fulfilled') {
        const c = catRes.value?.catalogos || catRes.value?.data || {};
        setCatalogos({ plantillas: c.plantillas || [], periodos: c.periodos || [], grupos: c.grupos || [], materias: c.materias || [], docentes: c.docentes || [] });
      }
      if (cargasRes.status === 'fulfilled') setCargas(safeArray(cargasRes.value));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const selectedCarga = React.useMemo(() => cargas.find(c => Number(c.id_carga_ocr) === Number(selectedId)) || null, [cargas, selectedId]);

  const handleUpload = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!file) { setError('Selecciona una imagen o PDF del acta.'); return; }
    if (!form.id_periodo) { setError('Debes seleccionar un período.'); return; }
    setLoadingUpload(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file); fd.append('codigo_plantilla', form.codigo_plantilla); fd.append('id_periodo', form.id_periodo);
      if (form.id_grupo) fd.append('id_grupo', form.id_grupo);
      if (form.id_materia) fd.append('id_materia', form.id_materia);
      if (form.id_docente) fd.append('id_docente', form.id_docente);
      if (form.regla_manual) fd.append('regla_manual', form.regla_manual);
      await api.actasOCR.subir(token, fd);
      setMessage('Acta procesada correctamente.'); setFile(null); await loadData(); await loadPage();
    } catch (e) { setError(e?.message || 'Error al subir.'); }
    finally { setLoadingUpload(false); }
  };

  const handleValidate = async (id) => {
    setError(''); setMessage(''); setLoadingValidateId(id);
    try {
      await api.actasOCR.validar(token, id);
      setMessage('Validación completada.'); await loadData(); await loadPage();
    } catch (e) { setError(e?.message || 'Error al validar.'); }
    finally { setLoadingValidateId(null); }
  };

  const plantillaOptions = catalogos.plantillas || [];
  const grupoOptions = catalogos.grupos || [];
  const materiaOptions = catalogos.materias || [];
  const docenteOptions = catalogos.docentes || [];
  const periodoOptions = catalogos.periodos || [];

  return (
    <div className="stack">
      <SectionCard title="Subir acta para OCR" subtitle="Carga foto, escaneo o PDF para extraer calificaciones">
        <form onSubmit={handleUpload} className="form-stack">
          <div className="grid-two">
            <FormField label="Plantilla">
              <select value={form.codigo_plantilla} onChange={e => setForm(p => ({ ...p, codigo_plantilla: e.target.value }))}>
                {plantillaOptions.map(t => <option key={t.codigo_plantilla} value={t.codigo_plantilla}>{t.nombre_plantilla}</option>)}
              </select>
            </FormField>
            <FormField label="Período">
              <select value={form.id_periodo} onChange={e => setForm(p => ({ ...p, id_periodo: e.target.value }))}>
                <option value="">Selecciona un período</option>
                {periodoOptions.map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid-two">
            <FormField label="Grupo">
              <select value={form.id_grupo} onChange={e => setForm(p => ({ ...p, id_grupo: e.target.value }))}>
                <option value="">Sin grupo</option>
                {grupoOptions.map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_periodo} • {g.nombre_grupo} • {g.nombre_carrera}</option>)}
              </select>
            </FormField>
            <FormField label="Materia">
              <select value={form.id_materia} onChange={e => setForm(p => ({ ...p, id_materia: e.target.value }))}>
                <option value="">Sin materia</option>
                {materiaOptions.map(m => <option key={m.id_materia} value={m.id_materia}>{m.clave_materia} • {m.nombre_materia}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid-two">
            <FormField label="Docente">
              <select value={form.id_docente} onChange={e => setForm(p => ({ ...p, id_docente: e.target.value }))}>
                <option value="">Sin docente</option>
                {docenteOptions.map(d => <option key={d.id_docente} value={d.id_docente}>{d.nombres} {d.apellido_paterno} {d.apellido_materno} • {d.clave_docente}</option>)}
              </select>
            </FormField>
            <FormField label="Archivo del acta">
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
            </FormField>
          </div>
          <FormField label="Regla manual / observación">
            <textarea rows="2" value={form.regla_manual} onChange={e => setForm(p => ({ ...p, regla_manual: e.target.value }))} placeholder="Observaciones para la revisión institucional" />
          </FormField>
          <button className="btn primary" type="submit" disabled={loadingUpload}>
            {loadingUpload ? <><Loader2 className="animate-spin" size={18} /> Procesando...</> : <><Upload size={18} /> Subir y extraer acta</>}
          </button>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
        </form>
      </SectionCard>

      <SectionCard title="Detalle OCR" subtitle="Selecciona una carga de la lista">
        {!selectedCarga ? (
          <div className="empty">Selecciona una carga de la lista inferior para ver su detalle.</div>
        ) : (
          <div className="list">
            <div className="list-item">
              <strong>{selectedCarga.nombre_plantilla || selectedCarga.codigo_plantilla}</strong>
              <span className={statusClass(selectedCarga.estado)}>{selectedCarga.estado}</span>
              <small>{selectedCarga.nombre_archivo}</small>
              <small>Período: {selectedCarga.nombre_periodo || '—'} • Grupo: {selectedCarga.nombre_grupo || '—'} • Materia: {selectedCarga.nombre_materia || '—'}</small>
              <small>Docente: {selectedCarga.nombre_usuario || '—'} • Confianza: {Number(selectedCarga.confianza_global || 0).toFixed(1)}%</small>
            </div>
            {selectedCarga.json_resultado && (
              <div className="auth-note">
                <div className="eyebrow">JSON extraído</div>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem', fontSize: '0.82rem' }}>{JSON.stringify(selectedCarga.json_resultado, null, 2)}</pre>
              </div>
            )}
            <div className="list">
              {(selectedCarga.detalles || []).length === 0 ? <div className="empty">Sin alumnos extraídos.</div> : selectedCarga.detalles.map(item => (
                <div key={item.id_detalle_ocr} className="list-item">
                  <strong>{item.matricula} • {item.nombre_completo}</strong>
                  <span>Calificación: {item.calificacion} • {item.validado ? 'Validado' : 'Pendiente'}</span>
                  <small>{item.error_validacion || item.observaciones || '—'}</small>
                </div>
              ))}
            </div>
            <div className="row gap wrap">
              <button type="button" className="btn accent" onClick={() => handleValidate(selectedCarga.id_carga_ocr)} disabled={loadingValidateId === selectedCarga.id_carga_ocr}>
                {loadingValidateId === selectedCarga.id_carga_ocr ? <><Loader2 className="animate-spin" size={18} /> Validando...</> : <><Save size={18} /> Validar e importar</>}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Cargas recientes" subtitle="Selecciona una carga para ver su detalle">
        {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div> : cargas.length === 0 ? <div className="empty">No hay cargas registradas.</div> : (
          <div className="list">
            {cargas.map(item => (
              <button key={item.id_carga_ocr} type="button" className={`list-item ${Number(selectedId) === Number(item.id_carga_ocr) ? 'active' : ''}`} onClick={() => setSelectedId(item.id_carga_ocr)} style={{ textAlign: 'left', width: '100%', background: 'transparent' }}>
                <strong>{item.nombre_archivo}</strong>
                <span className={statusClass(item.estado)}>{item.estado}</span>
                <small>{item.nombre_plantilla} • {item.nombre_periodo || '—'} • {item.nombre_grupo || '—'}</small>
                <small>Confianza: {Number(item.confianza_global || 0).toFixed(1)}% • {formatDate(item.created_at)}</small>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ValidacionDocumental({ token, loadPage }) {
  const [cargas, setCargas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(null);
  const [filtro, setFiltro] = React.useState('');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [pagina, setPagina] = React.useState(0);
  const porPagina = 10;

  const loadCargas = React.useCallback(async (estado) => {
    if (!token) return;
    try { setLoading(true); setError(''); const r = await api.actasOCR.cargas(token, { estado: estado || undefined, limit: 50 }); setCargas(safeArray(r)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { loadCargas(filtro); }, [loadCargas, filtro]);

  const handleAction = async (id, action, comentario = '') => {
    setActionLoading(id);
    try {
      if (action === 'aprobar') await api.actasOCR.aprobar(token, id, comentario);
      else await api.actasOCR.rechazar(token, id, comentario);
      setMessage(`Carga ${action === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente.`);
      await loadCargas(filtro); await loadPage();
    } catch (e) { setError(e?.message || 'Error.'); }
    finally { setActionLoading(null); }
  };

  const filtros = ['', 'VALIDACION_PENDIENTE', 'VALIDADA', 'RECHAZADA', 'RECIBIDA', 'EXTRACCION_PENDIENTE'];
  const filtradas = cargas;
  const totalPaginas = Math.ceil(filtradas.length / porPagina);
  const paginadas = filtradas.slice(pagina * porPagina, (pagina + 1) * porPagina);

  return (
    <div className="stack">
      <SectionCard title="Validación documental" subtitle="Revisar, aprobar o rechazar documentos OCR">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          {filtros.map(f => (
            <button key={f} type="button" className={`btn ${filtro === f ? 'primary' : 'secondary'}`} onClick={() => { setFiltro(f); setPagina(0); }}>
              {f || 'Todas'}
            </button>
          ))}
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
      </SectionCard>

      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div> : paginadas.length === 0 ? <div className="empty">No hay cargas con ese estado.</div> : paginadas.map(carga => (
        <SectionCard key={carga.id_carga_ocr} title={carga.nombre_archivo} subtitle={`${carga.nombre_plantilla} • ${carga.nombre_periodo || '—'}`}>
          <div className="list">
            <div className="list-item">
              <span className={statusClass(carga.estado)}>{carga.estado}</span>
              <span>Confianza: {Number(carga.confianza_global || 0).toFixed(1)}%</span>
              <small>Grupo: {carga.nombre_grupo || '—'} • Materia: {carga.nombre_materia || '—'}</small>
              <small>Usuario: {carga.nombre_usuario || '—'} • {formatDate(carga.created_at)}</small>
              <small>Detalles: {(carga.detalles || []).length} alumnos • {carga.detalles?.filter(d => d.validado).length || 0} validados</small>
            </div>
            {carga.observaciones_revision && <div className="auth-note"><small>{carga.observaciones_revision}</small></div>}
            <div className="row gap wrap">
              <button type="button" className="btn accent" onClick={() => handleAction(carga.id_carga_ocr, 'aprobar', '')} disabled={actionLoading === carga.id_carga_ocr}>
                {actionLoading === carga.id_carga_ocr ? <><Loader2 className="animate-spin" size={16} />...</> : <><CheckCircle2 size={16} /> Aprobar</>}
              </button>
              <button type="button" className="btn secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleAction(carga.id_carga_ocr, 'rechazar', '')} disabled={actionLoading === carga.id_carga_ocr}>
                {actionLoading === carga.id_carga_ocr ? <><Loader2 className="animate-spin" size={16} />...</> : <><XCircle size={16} /> Rechazar</>}
              </button>
            </div>
          </div>
        </SectionCard>
      ))}

      {totalPaginas > 1 && (
        <div className="row gap wrap" style={{ justifyContent: 'center', marginTop: '1rem' }}>
          <button type="button" className="btn secondary" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}><ChevronLeft size={16} /> Anterior</button>
          <span style={{ padding: '0.5rem' }}>Página {pagina + 1} de {totalPaginas}</span>
          <button type="button" className="btn secondary" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente <ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

function BitacoraPanel({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCR.bitacora(token, 100).then(r => setRows(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Bitácora del sistema OCR" subtitle="Registro de actividad, eventos y operaciones del módulo OCR">
        <div className="list">
          <div className="list-item"><ScrollText size={16} /> Consulta de la bitácora de actividad, eventos, errores y auditoría del proceso de actas OCR.</div>
        </div>
      </SectionCard>
      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando bitácora...</div> : rows.length === 0 ? <div className="empty">No hay registros en la bitácora.</div> : (
        <SectionCard title="Registros recientes" subtitle={`Últimos ${rows.length} eventos`}>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Acción</th>
                  <th style={{ padding: '0.4rem' }}>Archivo</th>
                  <th style={{ padding: '0.4rem' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id_auditoria_ocr || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{formatDate(r.creado_en)}</td>
                    <td style={{ padding: '0.4rem' }}>{r.nombre_usuario || r.id_usuario}</td>
                    <td style={{ padding: '0.4rem' }}><span className={statusClass(r.accion)}>{r.accion}</span></td>
                    <td style={{ padding: '0.4rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre_archivo || '—'}</td>
                    <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detalle ? JSON.stringify(r.detalle).substring(0, 100) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function AuditoriaPanel({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    api.actasOCR.auditoria(token, 100).then(r => setRows(safeArray(r))).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Auditoría del proceso OCR" subtitle="Validación de trazabilidad, historial completo de procesos documentales">
        <div className="list">
          <div className="list-item"><Shield size={16} /> Validación de trazabilidad documental completa. Historial de cada acción, usuario responsable, archivo procesado y resultado.</div>
        </div>
      </SectionCard>
      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando auditoría...</div> : rows.length === 0 ? <div className="empty">No hay registros de auditoría.</div> : (
        <SectionCard title="Historial de auditoría" subtitle={`Últimos ${rows.length} registros`}>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Acción</th>
                  <th style={{ padding: '0.4rem' }}>Archivo</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Plantilla</th>
                  <th style={{ padding: '0.4rem' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id_auditoria_ocr || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{formatDate(r.creado_en)}</td>
                    <td style={{ padding: '0.4rem' }}>{r.nombre_usuario || r.id_usuario}</td>
                    <td style={{ padding: '0.4rem' }}><span className={statusClass(r.accion)}>{r.accion}</span></td>
                    <td style={{ padding: '0.4rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre_archivo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{r.nombre_periodo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{r.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{r.nombre_plantilla || '—'}</td>
                    <td style={{ padding: '0.4rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detalle ? JSON.stringify(r.detalle).substring(0, 80) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ConfiguracionPanel({ token }) {
  const [config, setConfig] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(null);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!token) return;
    api.actasOCR.configuracion(token).then(r => { const d = r?.data || r || {}; setConfig(d); }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const handleUpdate = async (clave, valor) => {
    setSaving(clave);
    try { await api.actasOCR.updateConfig(token, clave, valor); setConfig(p => ({ ...p, [clave]: valor })); setMessage(`"${clave}" actualizado.`); }
    catch (e) { setMessage(`Error: ${e.message}`); }
    finally { setSaving(null); }
  };

  const fields = [
    { key: 'confianza_minima', label: 'Confianza mínima (%)', type: 'number', desc: 'Porcentaje mínimo de confianza para validación automática' },
    { key: 'proveedor_ocr', label: 'Proveedor OCR', type: 'select', options: ['GEMINI', 'DOCUMENT_AI', 'HIBRIDO'], desc: 'Motor de OCR a utilizar' },
    { key: 'validacion_automatica', label: 'Validación automática', type: 'select', options: ['true', 'false'], desc: 'Validar e importar automáticamente si confianza >= mínimo' },
    { key: 'notificar_errores', label: 'Notificar errores', type: 'select', options: ['true', 'false'], desc: 'Enviar notificaciones sobre errores de OCR' },
    { key: 'max_alumnos_por_acta', label: 'Máx. alumnos por acta', type: 'number', desc: 'Límite máximo de alumnos por acta procesada' },
    { key: 'requerir_firma', label: 'Requerir firma', type: 'select', options: ['true', 'false'], desc: 'Exigir firma detectada para aprobación' }
  ];

  return (
    <div className="stack">
      <SectionCard title="Configuración del módulo OCR" subtitle="Ajustes del sistema de actas OCR inteligentes">
        <div className="list">
          <div className="list-item"><Sliders size={16} /> Configuración del proveedor OCR, niveles de confianza, límites de procesamiento y reglas de validación.</div>
        </div>
      </SectionCard>
      {loading ? <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando configuración...</div> : (
        <SectionCard title="Parámetros de configuración" subtitle="Ajusta los valores según las necesidades institucionales">
          {message && <div className="alert success">{message}</div>}
          <div className="form-stack">
            {fields.map(f => (
              <FormField key={f.key} label={f.label}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {f.type === 'select' ? (
                    <select value={config[f.key] || ''} onChange={e => handleUpdate(f.key, e.target.value)} disabled={saving === f.key} style={{ flex: 1 }}>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={config[f.key] || ''} onChange={e => handleUpdate(f.key, e.target.value)} disabled={saving === f.key} style={{ flex: 1 }} />
                  )}
                  {saving === f.key && <Loader2 className="animate-spin" size={16} />}
                </div>
                <small style={{ opacity: 0.6 }}>{f.desc}</small>
              </FormField>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function ActasOCRPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { toggleTheme } = useTheme();
  const [tab, setTab] = React.useState('panel-general');
  const [resumenData, setResumenData] = React.useState({ total_cargas: 0, validadas: 0, rechazadas: 0, pendientes: 0, confianza_promedio: 0, ultima_revision: null, total_detalles_importados: 0 });
  const [catalogosData, setCatalogosData] = React.useState({ plantillas: 0, periodos: 0, grupos: 0, materias: 0, docentes: 0, firmas: 0 });
  const [loading, setLoading] = React.useState(true);

  const loadPanel = React.useCallback(async () => {
    if (!token) return;
    try { setLoading(true); const r = await api.actasOCR.panel(token); const d = r?.data || {}; setResumenData(d.resumen || {}); setCatalogosData(d.catalogos || {}); }
    catch (e) { console.error('Error loading panel:', e); }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { loadPanel(); }, [loadPanel]);

  const tabs = [
    { id: 'panel-general', label: 'Panel general', icon: Activity },
    { id: 'modulo-ocr', label: 'Módulo OCR', icon: FileScan },
    { id: 'validacion', label: 'Validación documental', icon: ClipboardList },
    { id: 'bitacora', label: 'Bitácora', icon: ScrollText },
    { id: 'auditoria', label: 'Auditoría', icon: Shield },
    { id: 'configuracion', label: 'Configuración', icon: Settings }
  ];
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {tabs.map(t => <TabButton key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
        </div>
        <div className="row gap wrap">
          <button type="button" className="btn secondary" onClick={loadPanel}><RefreshCw size={16} /> Actualizar</button>
          <button type="button" className="btn secondary" onClick={toggleTheme}>Cambiar tema</button>
        </div>
      </div>

      {activeTab === 'panel-general' && <PanelGeneral token={token} catalogos={catalogosData} resumen={resumenData} loading={loading} />}
      {activeTab === 'modulo-ocr' && <ModuloOCR token={token} loadPage={loadPanel} />}
      {activeTab === 'validacion' && <ValidacionDocumental token={token} loadPage={loadPanel} />}
      {activeTab === 'bitacora' && <BitacoraPanel token={token} />}
      {activeTab === 'auditoria' && <AuditoriaPanel token={token} />}
      {activeTab === 'configuracion' && <ConfiguracionPanel token={token} />}
    </div>
  );
}
