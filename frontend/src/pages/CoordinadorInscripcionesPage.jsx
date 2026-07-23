import React from 'react';
import {
  Inbox, ClipboardList, Users, History, FileText,
  CheckCircle2, XCircle, RefreshCw, Search, Loader2,
  BadgeInfo, GraduationCap,
  Calendar, Save, UserCheck, UserX,
  Layers, Activity
} from 'lucide-react';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return d; }
}

function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

const STATUS_COLORS = {
  Pendiente: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  Validada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Rechazada: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  Cancelada: { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280' }
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Pendiente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.15rem 0.55rem', borderRadius: 9999, fontSize: '0.8rem',
      fontWeight: 600, background: s.bg, color: s.text
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  const isPrimera = normalize(type).includes('PRIMERA');
  return (
    <span className={`badge ${isPrimera ? 'light' : 'info'}`} style={{ fontSize: '0.75rem' }}>
      {isPrimera ? 'Primera vez' : 'Reinscripción'}
    </span>
  );
}

const TABS = [
  { id: 'bandeja', label: 'Bandeja de Solicitudes', icon: Inbox },
  { id: 'validacion', label: 'Validación por Grupo', icon: Users },
  { id: 'cupos', label: 'Cupos Disponibles', icon: Layers },
  { id: 'historial', label: 'Historial de Estados', icon: History },
  { id: 'observaciones', label: 'Observaciones Académicas', icon: FileText }
];

export default function CoordinadorInscripcionesPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = React.useState('bandeja');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [catalogos, setCatalogos] = React.useState(null);
  const [bandeja, setBandeja] = React.useState([]);
  const [bandejaResumen, setBandejaResumen] = React.useState(null);
  const [validacion, setValidacion] = React.useState([]);
  const [validacionGrupos, setValidacionGrupos] = React.useState([]);
  const [cupos, setCupos] = React.useState([]);
  const [cuposResumen, setCuposResumen] = React.useState(null);
  const [historialData, setHistorialData] = React.useState(null);
  const [observaciones, setObservaciones] = React.useState([]);

  const [bandejaFiltros, setBandejaFiltros] = React.useState({ periodo: '', carrera: '', tipo: '', busqueda: '' });
  const [validacionFiltros, setValidacionFiltros] = React.useState({ id_grupo: '', periodo: '', carrera: '' });
  const [cuposFiltros, setCuposFiltros] = React.useState({ id_periodo: '', id_carrera: '' });
  const [historialFiltro, setHistorialFiltro] = React.useState({ id_inscripcion: '' });
  const [obsFiltros, setObsFiltros] = React.useState({ periodo: '', carrera: '', grupo: '', busqueda: '' });

  const [modal, setModal] = React.useState({ show: false, type: '', id: null, data: {} });

  const loadCatalogos = React.useCallback(async () => {
    try {
      const res = await api.coordinadorCatalogos(token);
      setCatalogos(res?.data || null);
    } catch (err) {
      console.error('Error catalogos:', err);
    }
  }, [token]);

  const loadBandeja = React.useCallback(async (f = bandejaFiltros) => {
    try {
      setError('');
      const res = await api.coordinadorBandeja(token, f);
      setBandeja(safeArray(res));
      setBandejaResumen(res?.resumen || null);
    } catch (err) {
      console.error('Error bandeja:', err);
      setError('Error al cargar la bandeja de solicitudes');
    }
  }, [token]);

  const loadValidacion = React.useCallback(async (f = validacionFiltros) => {
    try {
      setError('');
      const res = await api.coordinadorValidacionGrupo(token, f);
      setValidacion(safeArray(res));
      setValidacionGrupos(res?.grupos || []);
    } catch (err) {
      console.error('Error validacion:', err);
      setError('Error al cargar validacion por grupo');
    }
  }, [token]);

  const loadCupos = React.useCallback(async (f = cuposFiltros) => {
    try {
      setError('');
      const res = await api.coordinadorCupos(token, f);
      setCupos(safeArray(res));
      setCuposResumen(res?.resumen || null);
    } catch (err) {
      console.error('Error cupos:', err);
      setError('Error al cargar cupos disponibles');
    }
  }, [token]);

  const loadHistorial = React.useCallback(async (id) => {
    if (!id) return;
    try {
      setError('');
      const res = await api.coordinadorHistorial(token, id);
      setHistorialData(res || null);
    } catch (err) {
      console.error('Error historial:', err);
      setError('Error al cargar el historial');
    }
  }, [token]);

  const loadObservaciones = React.useCallback(async (f = obsFiltros) => {
    try {
      setError('');
      const res = await api.coordinadorObservaciones(token, f);
      setObservaciones(safeArray(res));
    } catch (err) {
      console.error('Error observaciones:', err);
      setError('Error al cargar observaciones');
    }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadCatalogos();
      await Promise.all([
        loadBandeja(), loadValidacion(), loadCupos(), loadObservaciones()
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadCatalogos, loadBandeja, loadValidacion, loadCupos, loadObservaciones]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const handleUpdateEstado = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.coordinadorUpdateEstado(token, modal.id, modal.data);
      setMessage(`Inscripcion #${modal.id} actualizada a "${modal.data.estado}"`);
      setModal({ show: false, type: '', id: null, data: {} });
      await Promise.all([loadBandeja(), loadValidacion(), loadCupos()]);
    } catch (err) {
      setError(err?.message || 'Error al actualizar estado');
    }
  };

  const handleAsignarGrupo = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.coordinadorAsignarGrupo(token, modal.id, { id_grupo: modal.data.id_grupo });
      setMessage(`Grupo asignado a inscripcion #${modal.id}`);
      setModal({ show: false, type: '', id: null, data: {} });
      await Promise.all([loadBandeja(), loadValidacion(), loadCupos()]);
    } catch (err) {
      setError(err?.message || 'Error al asignar grupo');
    }
  };

  const handleRegistrarObservacion = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.coordinadorRegistrarObservacion(token, modal.id, { observaciones: modal.data.observaciones });
      setMessage(`Observacion registrada en inscripcion #${modal.id}`);
      setModal({ show: false, type: '', id: null, data: {} });
      await Promise.all([loadBandeja(), loadValidacion(), loadObservaciones()]);
    } catch (err) {
      setError(err?.message || 'Error al registrar observacion');
    }
  };

  const handleActualizarCupo = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.coordinadorActualizarCupo(token, modal.id, { cupo_maximo: modal.data.cupo_maximo });
      setMessage(`Cupo actualizado correctamente`);
      setModal({ show: false, type: '', id: null, data: {} });
      await loadCupos();
    } catch (err) {
      setError(err?.message || 'Error al actualizar cupo');
    }
  };

  const openModal = (type, id, data = {}) => {
    setModal({ show: true, type, id, data });
  };

  const renderBandeja = () => (
    <div className="stack">
      <SectionCard
        title="Filtros"
        subtitle="Periodo, carrera, tipo y busqueda"
        right={
          <button type="button" className="btn secondary" onClick={() => loadBandeja(bandejaFiltros)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="Periodo">
            <select value={bandejaFiltros.periodo} onChange={e => setBandejaFiltros({ ...bandejaFiltros, periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={bandejaFiltros.carrera} onChange={e => setBandejaFiltros({ ...bandejaFiltros, carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Tipo">
            <select value={bandejaFiltros.tipo} onChange={e => setBandejaFiltros({ ...bandejaFiltros, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="Primera_Vez">Primera vez</option>
              <option value="Reinscripcion">Reinscripcion</option>
            </select>
          </FormField>
          <FormField label="Busqueda">
            <input value={bandejaFiltros.busqueda} onChange={e => setBandejaFiltros({ ...bandejaFiltros, busqueda: e.target.value })}
              placeholder="Matricula o nombre" onKeyDown={e => e.key === 'Enter' && loadBandeja(bandejaFiltros)} />
          </FormField>
        </div>
      </SectionCard>

      {bandejaResumen && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className="stat-card-header">
              <div className="stat-icon" style={{ color: '#f59e0b' }}><Inbox size={20} /></div>
              <div className="stat-value">{bandejaResumen.total_pendientes ?? 0}</div>
            </div>
            <div className="stat-label">Solicitudes pendientes</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
            <div className="stat-card-header">
              <div className="stat-icon" style={{ color: '#6366f1' }}><Calendar size={20} /></div>
              <div className="stat-value">{bandejaResumen.periodos_involucrados ?? 0}</div>
            </div>
            <div className="stat-label">Periodos involucrados</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <div className="stat-card-header">
              <div className="stat-icon" style={{ color: '#8b5cf6' }}><GraduationCap size={20} /></div>
              <div className="stat-value">{bandejaResumen.carreras_involucradas ?? 0}</div>
            </div>
            <div className="stat-label">Carreras involucradas</div>
          </div>
        </div>
      )}

      <SectionCard
        title="Solicitudes Pendientes"
        subtitle={`${bandeja.length} solicitud(es) por revisar`}
        right={
          <button type="button" className="btn secondary" onClick={() => loadBandeja(bandejaFiltros)}>
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      >
        {bandeja.length === 0 ? (
          <div className="empty">No hay solicitudes pendientes.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>ID</th>
                  <th style={{ padding: '0.4rem' }}>Matricula</th>
                  <th style={{ padding: '0.4rem' }}>Alumno</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                  <th style={{ padding: '0.4rem' }}>Tipo</th>
                  <th style={{ padding: '0.4rem' }}>Carrera</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bandeja.map(row => (
                  <tr key={row.id_inscripcion} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{row.id_inscripcion}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{row.matricula || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_completo || row.alumno || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_periodo}</td>
                    <td style={{ padding: '0.4rem' }}><TypeBadge type={row.tipo_inscripcion} /></td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_carrera || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(row.fecha_inscripcion)}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <div className="row gap" style={{ gap: '0.25rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          onClick={() => openModal('validar', row.id_inscripcion, { estado: 'Validada' })}>
                          <CheckCircle2 size={12} /> Validar
                        </button>
                        <button type="button" className="btn secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#dc2626' }}
                          onClick={() => openModal('rechazar', row.id_inscripcion, { estado: 'Rechazada', observaciones: '', motivo_rechazo: '' })}>
                          <XCircle size={12} /> Rechazar
                        </button>
                        <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          onClick={() => openModal('asignarGrupo', row.id_inscripcion, { id_grupo: row.id_grupo || '' })}>
                          <Users size={12} /> Grupo
                        </button>
                        <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          onClick={() => openModal('observacion', row.id_inscripcion, { observaciones: '' })}>
                          <FileText size={12} /> Obs
                        </button>
                        <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          onClick={() => { setHistorialFiltro({ id_inscripcion: row.id_inscripcion }); loadHistorial(row.id_inscripcion); setActiveTab('historial'); }}>
                          <History size={12} /> Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderValidacion = () => (
    <div className="stack">
      <SectionCard
        title="Filtros"
        subtitle="Seleccione grupo, periodo o carrera"
        right={
          <button type="button" className="btn secondary" onClick={() => loadValidacion(validacionFiltros)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="Grupo">
            <select value={validacionFiltros.id_grupo} onChange={e => setValidacionFiltros({ ...validacionFiltros, id_grupo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.grupos || []).map(g => (
                <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo} - {g.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Periodo">
            <select value={validacionFiltros.periodo} onChange={e => setValidacionFiltros({ ...validacionFiltros, periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={validacionFiltros.carrera} onChange={e => setValidacionFiltros({ ...validacionFiltros, carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
        </div>
      </SectionCard>

      {validacionGrupos.length > 0 && (
        <SectionCard title="Resumen por Grupo" subtitle="Total de inscripciones agrupadas">
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Semestre</th>
                  <th style={{ padding: '0.4rem' }}>Turno</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                  <th style={{ padding: '0.4rem' }}>Total</th>
                  <th style={{ padding: '0.4rem' }}>Pendientes</th>
                  <th style={{ padding: '0.4rem' }}>Validadas</th>
                </tr>
              </thead>
              <tbody>
                {validacionGrupos.map(g => (
                  <tr key={g.id_grupo} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{g.nombre_grupo}</td>
                    <td style={{ padding: '0.4rem' }}>{g.semestre}</td>
                    <td style={{ padding: '0.4rem' }}>{g.turno}</td>
                    <td style={{ padding: '0.4rem' }}>{g.nombre_periodo}</td>
                    <td style={{ padding: '0.4rem' }}>{g.total_inscripciones}</td>
                    <td style={{ padding: '0.4rem', color: '#f59e0b' }}>{g.pendientes}</td>
                    <td style={{ padding: '0.4rem', color: '#10b981' }}>{g.validadas}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Inscripciones por Grupo"
        subtitle={`${validacion.length} registro(s)`}
      >
        {validacion.length === 0 ? (
          <div className="empty">Seleccione filtros para ver inscripciones.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Matricula</th>
                  <th style={{ padding: '0.4rem' }}>Alumno</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Tipo</th>
                  <th style={{ padding: '0.4rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {validacion.map(row => (
                  <tr key={row.id_inscripcion} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{row.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{row.matricula || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_completo || row.alumno || '—'}</td>
                    <td style={{ padding: '0.4rem' }}><StatusBadge status={row.estado} /></td>
                    <td style={{ padding: '0.4rem' }}><TypeBadge type={row.tipo_inscripcion} /></td>
                    <td style={{ padding: '0.4rem' }}>
                      <div className="row gap" style={{ gap: '0.25rem' }}>
                        {row.estado === 'Pendiente' && (
                          <>
                            <button type="button" className="btn primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                              onClick={() => openModal('validar', row.id_inscripcion, { estado: 'Validada' })}>
                              <UserCheck size={12} />
                            </button>
                            <button type="button" className="btn secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#dc2626' }}
                              onClick={() => openModal('rechazar', row.id_inscripcion, { estado: 'Rechazada', observaciones: '', motivo_rechazo: '' })}>
                              <UserX size={12} />
                            </button>
                          </>
                        )}
                        <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          onClick={() => { setHistorialFiltro({ id_inscripcion: row.id_inscripcion }); loadHistorial(row.id_inscripcion); setActiveTab('historial'); }}>
                          <History size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderCupos = () => (
    <div className="stack">
      <SectionCard
        title="Filtros"
        subtitle="Periodo y carrera"
        right={
          <button type="button" className="btn secondary" onClick={() => loadCupos(cuposFiltros)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="Periodo">
            <select value={cuposFiltros.id_periodo} onChange={e => setCuposFiltros({ ...cuposFiltros, id_periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={cuposFiltros.id_carrera} onChange={e => setCuposFiltros({ ...cuposFiltros, id_carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
        </div>
      </SectionCard>

      {cuposResumen && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
            <div className="stat-card-header">
              <div className="stat-value">{cuposResumen.cupo_total ?? 0}</div>
            </div>
            <div className="stat-label">Cupo total</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div className="stat-card-header">
              <div className="stat-value">{cuposResumen.inscritos_totales ?? 0}</div>
            </div>
            <div className="stat-label">Inscritos</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className="stat-card-header">
              <div className="stat-value">{cuposResumen.disponibles_totales ?? 0}</div>
            </div>
            <div className="stat-label">Disponibles</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <div className="stat-card-header">
              <div className="stat-value">{cuposResumen.total_grupos ?? 0}</div>
            </div>
            <div className="stat-label">Total grupos</div>
          </div>
        </div>
      )}

      <SectionCard
        title="Cupos por Grupo"
        subtitle={`${cupos.length} grupo(s)`}
      >
        {cupos.length === 0 ? (
          <div className="empty">No hay datos de cupos disponibles.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Carrera</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Semestre</th>
                  <th style={{ padding: '0.4rem' }}>Turno</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                  <th style={{ padding: '0.4rem' }}>Cupo Max</th>
                  <th style={{ padding: '0.4rem' }}>Inscritos</th>
                  <th style={{ padding: '0.4rem' }}>Disponible</th>
                  <th style={{ padding: '0.4rem' }}>Ocupacion</th>
                  <th style={{ padding: '0.4rem' }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cupos.map(row => {
                  const pct = row.porcentaje_ocupacion || 0;
                  const barColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#10b981';
                  return (
                    <tr key={row.id_cupo} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem' }}>{row.nombre_carrera}</td>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{row.nombre_grupo}</td>
                      <td style={{ padding: '0.4rem' }}>{row.semestre}</td>
                      <td style={{ padding: '0.4rem' }}>{row.turno}</td>
                      <td style={{ padding: '0.4rem' }}>{row.nombre_periodo}</td>
                      <td style={{ padding: '0.4rem' }}>{row.cupo_maximo}</td>
                      <td style={{ padding: '0.4rem' }}>{row.cupo_actual}</td>
                      <td style={{ padding: '0.4rem', fontWeight: 600, color: row.cupo_disponible > 0 ? '#10b981' : '#ef4444' }}>
                        {row.cupo_disponible}
                      </td>
                      <td style={{ padding: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: '0.75rem' }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem' }}>
                        <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => openModal('cupo', row.id_cupo, { cupo_maximo: row.cupo_maximo })}>
                          Editar cupo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderHistorial = () => (
    <div className="stack">
      <SectionCard
        title="Consultar Historial"
        subtitle="Ingrese el ID de la inscripcion para ver su historial de cambios"
        right={
          <button type="button" className="btn secondary" onClick={() => loadHistorial(historialFiltro.id_inscripcion)}>
            <Search size={16} /> Consultar
          </button>
        }
      >
        <FormField label="ID de Inscripcion">
          <input value={historialFiltro.id_inscripcion}
            onChange={e => setHistorialFiltro({ ...historialFiltro, id_inscripcion: e.target.value })}
            placeholder="Ej. 1, 5, 12" inputMode="numeric"
            onKeyDown={e => e.key === 'Enter' && loadHistorial(historialFiltro.id_inscripcion)} />
        </FormField>
      </SectionCard>

      {historialData && (
        <>
          <SectionCard title="Datos de la Inscripcion" subtitle="Informacion actual">
            <div className="grid-two">
              <div><strong>ID:</strong> {historialData.inscripcion?.id_inscripcion}</div>
              <div><strong>Matricula:</strong> {historialData.inscripcion?.matricula}</div>
              <div><strong>Alumno:</strong> {historialData.inscripcion?.nombre_completo}</div>
              <div><strong>Periodo:</strong> {historialData.inscripcion?.nombre_periodo}</div>
              <div><strong>Tipo:</strong> {historialData.inscripcion?.tipo_inscripcion}</div>
              <div><strong>Estado:</strong> <StatusBadge status={historialData.inscripcion?.estado} /></div>
              <div><strong>Observaciones:</strong> {historialData.inscripcion?.observaciones || '—'}</div>
              {historialData.inscripcion?.motivo_rechazo && (
                <div><strong>Motivo de rechazo:</strong> <span style={{ color: '#dc2626' }}>{historialData.inscripcion.motivo_rechazo}</span></div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Historial de Cambios"
            subtitle={`${historialData.historial?.length || 0} evento(s)`}
          >
            {!historialData.historial?.length ? (
              <div className="empty">Sin registro de cambios.</div>
            ) : (
              <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Fecha</th>
                      <th style={{ padding: '0.4rem' }}>Usuario</th>
                      <th style={{ padding: '0.4rem' }}>Rol</th>
                      <th style={{ padding: '0.4rem' }}>Accion</th>
                      <th style={{ padding: '0.4rem' }}>Anterior</th>
                      <th style={{ padding: '0.4rem' }}>Nuevo</th>
                      <th style={{ padding: '0.4rem' }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialData.historial.map(a => (
                      <tr key={a.id_auditoria} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(a.creado_en)}</td>
                        <td style={{ padding: '0.4rem' }}>{a.usuario_nombre || `#${a.id_usuario}`}</td>
                        <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{a.usuario_rol || '—'}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className={`badge ${a.accion === 'VALIDAR' ? 'success' : a.accion === 'RECHAZAR' || a.accion === 'CANCELAR' ? 'error' : 'info'}`}
                            style={{ fontSize: '0.7rem' }}>{a.accion}</span>
                        </td>
                        <td style={{ padding: '0.4rem' }}><StatusBadge status={a.estado_anterior} /></td>
                        <td style={{ padding: '0.4rem' }}><StatusBadge status={a.estado_nuevo} /></td>
                        <td style={{ padding: '0.4rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.detalle || ''}>
                          {a.detalle || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );

  const renderObservaciones = () => (
    <div className="stack">
      <SectionCard
        title="Filtros"
        subtitle="Periodo, carrera, grupo y busqueda"
        right={
          <button type="button" className="btn secondary" onClick={() => loadObservaciones(obsFiltros)}>
            <Search size={16} /> Buscar
          </button>
        }
      >
        <div className="grid-two">
          <FormField label="Periodo">
            <select value={obsFiltros.periodo} onChange={e => setObsFiltros({ ...obsFiltros, periodo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera">
            <select value={obsFiltros.carrera} onChange={e => setObsFiltros({ ...obsFiltros, carrera: e.target.value })}>
              <option value="">Todas</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Grupo">
            <select value={obsFiltros.grupo} onChange={e => setObsFiltros({ ...obsFiltros, grupo: e.target.value })}>
              <option value="">Todos</option>
              {(catalogos?.grupos || []).map(g => (
                <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Busqueda">
            <input value={obsFiltros.busqueda} onChange={e => setObsFiltros({ ...obsFiltros, busqueda: e.target.value })}
              placeholder="Buscar en observaciones..."
              onKeyDown={e => e.key === 'Enter' && loadObservaciones(obsFiltros)} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Observaciones Academicas"
        subtitle={`${observaciones.length} registro(s)`}
        right={
          <button type="button" className="btn secondary" onClick={() => loadObservaciones(obsFiltros)}>
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      >
        {observaciones.length === 0 ? (
          <div className="empty">No hay observaciones registradas.</div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>ID</th>
                  <th style={{ padding: '0.4rem' }}>Matricula</th>
                  <th style={{ padding: '0.4rem' }}>Alumno</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Observaciones</th>
                  <th style={{ padding: '0.4rem' }}>Actualizado por</th>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {observaciones.map(row => (
                  <tr key={row.id_inscripcion} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{row.id_inscripcion}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{row.matricula || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_completo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_periodo}</td>
                    <td style={{ padding: '0.4rem' }}><StatusBadge status={row.estado} /></td>
                    <td style={{ padding: '0.4rem' }}>{row.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.observaciones || ''}>
                      {row.observaciones || '—'}
                    </td>
                    <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{row.actualizado_por_nombre || '—'}</td>
                    <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(row.actualizado_en || row.fecha_inscripcion)}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <button type="button" className="btn ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        onClick={() => openModal('observacion', row.id_inscripcion, { observaciones: '' })}>
                        <FileText size={12} /> Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderModal = () => {
    if (!modal.show) return null;

    const modalContent = () => {
      if (modal.type === 'validar') {
        return (
          <form onSubmit={handleUpdateEstado}>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Inscripcion #{modal.id}
            </p>
            <FormField label="Opcion">
              <select value={modal.data.estado}
                onChange={e => setModal({ ...modal, data: { ...modal.data, estado: e.target.value } })}>
                <option value="Validada">Validar inscripcion</option>
                <option value="Rechazada">Rechazar inscripcion</option>
              </select>
            </FormField>
            <FormField label="Observaciones (opcional)">
              <textarea value={modal.data.observaciones || ''}
                onChange={e => setModal({ ...modal, data: { ...modal.data, observaciones: e.target.value } })}
                placeholder="Comentario adicional..." rows={2} />
            </FormField>
            <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setModal({ show: false, type: '', id: null, data: {} })}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">Confirmar</button>
            </div>
          </form>
        );
      }

      if (modal.type === 'rechazar') {
        return (
          <form onSubmit={handleUpdateEstado}>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Rechazar inscripcion #{modal.id}
            </p>
            <FormField label="Motivo de rechazo (obligatorio)">
              <textarea value={modal.data.motivo_rechazo || ''}
                onChange={e => setModal({ ...modal, data: { ...modal.data, motivo_rechazo: e.target.value } })}
                placeholder="Explique el motivo del rechazo..." rows={3} required />
            </FormField>
            <FormField label="Observaciones adicionales (opcional)">
              <textarea value={modal.data.observaciones || ''}
                onChange={e => setModal({ ...modal, data: { ...modal.data, observaciones: e.target.value } })}
                placeholder="Comentario adicional..." rows={2} />
            </FormField>
            <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setModal({ show: false, type: '', id: null, data: {} })}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" style={{ background: '#dc2626' }}>
                Rechazar inscripcion
              </button>
            </div>
          </form>
        );
      }

      if (modal.type === 'asignarGrupo') {
        return (
          <form onSubmit={handleAsignarGrupo}>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Asignar grupo a inscripcion #{modal.id}
            </p>
            <FormField label="Grupo">
              <select value={modal.data.id_grupo}
                onChange={e => setModal({ ...modal, data: { ...modal.data, id_grupo: e.target.value } })}>
                <option value="">Seleccione un grupo</option>
                {(catalogos?.grupos || []).map(g => (
                  <option key={g.id_grupo} value={g.id_grupo}>
                    {g.nombre_grupo} - {g.nombre_periodo} (Sem {g.semestre} - {g.turno})
                  </option>
                ))}
              </select>
            </FormField>
            <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setModal({ show: false, type: '', id: null, data: {} })}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">Asignar grupo</button>
            </div>
          </form>
        );
      }

      if (modal.type === 'observacion') {
        return (
          <form onSubmit={handleRegistrarObservacion}>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Registrar observacion en inscripcion #{modal.id}
            </p>
            <FormField label="Observacion">
              <textarea value={modal.data.observaciones || ''}
                onChange={e => setModal({ ...modal, data: { ...modal.data, observaciones: e.target.value } })}
                placeholder="Escriba la observacion..." rows={3} required />
            </FormField>
            <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setModal({ show: false, type: '', id: null, data: {} })}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                <Save size={16} /> Guardar observacion
              </button>
            </div>
          </form>
        );
      }

      if (modal.type === 'cupo') {
        return (
          <form onSubmit={handleActualizarCupo}>
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Actualizar cupo maximo
            </p>
            <FormField label="Cupo maximo">
              <input type="number" value={modal.data.cupo_maximo || 30}
                onChange={e => setModal({ ...modal, data: { ...modal.data, cupo_maximo: e.target.value } })}
                min={1} max={100} required />
            </FormField>
            <div className="row gap wrap" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn secondary" onClick={() => setModal({ show: false, type: '', id: null, data: {} })}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">Actualizar cupo</button>
            </div>
          </form>
        );
      }

      return null;
    };

    return (
      <div className="modal-overlay" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div className="modal" style={{
          background: 'var(--card-bg)', borderRadius: 'var(--radius)',
          padding: '1.5rem', maxWidth: 480, width: '90%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
        }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>
            {modal.type === 'validar' ? 'Validar inscripcion' :
             modal.type === 'rechazar' ? 'Rechazar inscripcion' :
             modal.type === 'asignarGrupo' ? 'Asignar grupo' :
             modal.type === 'observacion' ? 'Registrar observacion' :
             modal.type === 'cupo' ? 'Editar cupo' : 'Accion'}
          </h3>
          {modalContent()}
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <Users size={14} /> Coordinacion de inscripciones
          </div>
          <h1>Panel del Coordinador</h1>
          <p>
            Administracion del flujo academico de inscripcion: bandeja de solicitudes,
            validacion por grupo, cupos disponibles, historial de cambios y observaciones academicas.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Modulo</small>
            <strong>Inscripciones</strong>
          </div>
          <div className="meta-card">
            <small>Acceso</small>
            <strong>Coordinador</strong>
          </div>
        </div>
      </section>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${activeTab === tab.id ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando panel de coordinacion de inscripciones...</span>
        </div>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {activeTab === 'bandeja' && renderBandeja()}
          {activeTab === 'validacion' && renderValidacion()}
          {activeTab === 'cupos' && renderCupos()}
          {activeTab === 'historial' && renderHistorial()}
          {activeTab === 'observaciones' && renderObservaciones()}
        </>
      )}

      {renderModal()}
    </div>
  );
}
