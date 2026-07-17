import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Filter,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserX,
  XCircle,
  Users
} from 'lucide-react';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function normalize(v) { return String(v || '').trim().toUpperCase(); }

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

const STATUS_COLORS = {
  Pendiente: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  Validada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Rechazada: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  Cancelada: { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280' },
  Activo: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Aprobada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  Completada: { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' }
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

const TABS = [
  { key: 'bandeja', label: 'Bandeja de solicitudes', icon: ClipboardList },
  { key: 'validacion', label: 'Validación por grupo', icon: Users },
  { key: 'detalle', label: 'Detalle del alumno', icon: Eye },
  { key: 'observaciones', label: 'Observaciones', icon: MessageSquare },
  { key: 'estado', label: 'Estado del trámite', icon: History }
];

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={16} /> {tab.label}
    </button>
  );
}

export default function CoordinadorReinscripcionesPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = React.useState('bandeja');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [bandeja, setBandeja] = React.useState(null);
  const [validacionGrupo, setValidacionGrupo] = React.useState([]);
  const [detalleAlumno, setDetalleAlumno] = React.useState(null);
  const [catalogos, setCatalogos] = React.useState(null);

  const [detalleId, setDetalleId] = React.useState('');
  const [detalleData, setDetalleData] = React.useState(null);

  const [filtros, setFiltros] = React.useState({ id_periodo: '', id_grupo: '', estado: 'Pendiente', busqueda: '' });
  const [periodoFiltro, setPeriodoFiltro] = React.useState('');

  const cargarBandeja = React.useCallback(async () => {
    try {
      const params = { ...filtros };
      const res = await api.coordinadorReinscripcionesBandeja(token, params);
      if (res.ok) setBandeja(res.data);
    } catch (e) { console.error(e); }
  }, [token, filtros]);

  const cargarValidacion = React.useCallback(async () => {
    try {
      const params = periodoFiltro ? { id_periodo: periodoFiltro } : {};
      const res = await api.coordinadorReinscripcionesValidacionGrupo(token, params);
      if (res.ok) setValidacionGrupo(res.data || []);
    } catch (e) { console.error(e); }
  }, [token, periodoFiltro]);

  const cargarCatalogos = React.useCallback(async () => {
    try {
      const res = await api.coordinadorReinscripcionesCatalogos(token);
      if (res.ok) setCatalogos(res.data);
    } catch (e) { console.error(e); }
  }, [token]);

  const cargarDetalle = React.useCallback(async () => {
    if (!detalleId) return;
    try {
      const res = await api.coordinadorReinscripcionesDetalle(token, detalleId);
      if (res.ok) setDetalleData(res.data);
      else setError(res.message || 'Error al cargar detalle');
    } catch (e) { setError(e.message); }
  }, [token, detalleId]);

  const fetchTab = React.useCallback(async (tabKey) => {
    setLoading(true); setError('');
    try {
      switch (tabKey) {
        case 'bandeja': await Promise.all([cargarBandeja(), cargarCatalogos()]); break;
        case 'validacion': await Promise.all([cargarValidacion(), cargarCatalogos()]); break;
        case 'detalle': await cargarCatalogos(); break;
        case 'observaciones': await cargarBandeja(); break;
        case 'estado': await cargarCatalogos(); break;
      }
    } catch (err) { setError(err?.message || 'Error al cargar'); } finally { setLoading(false); }
  }, [cargarBandeja, cargarValidacion, cargarCatalogos]);

  React.useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const tryAgain = () => fetchTab(tab);

  const handleUpdateEstado = async (id, estado, motivo_rechazo) => {
    try {
      const body = { estado };
      if (motivo_rechazo) body.motivo_rechazo = motivo_rechazo;
      await api.coordinadorReinscripcionesUpdateEstado(token, id, body);
      await cargarBandeja();
    } catch (e) { setError(e?.message || 'Error al actualizar estado'); }
  };

  const handleAsignarGrupo = async (id, id_grupo) => {
    try {
      await api.coordinadorReinscripcionesAsignarGrupo(token, id, { id_grupo });
      await cargarBandeja();
    } catch (e) { setError(e?.message || 'Error al asignar grupo'); }
  };

  const handleAgregarObservacion = async (id, observacion) => {
    try {
      await api.coordinadorReinscripcionesRegistrarObservacion(token, id, { observacion });
      await cargarBandeja();
    } catch (e) { setError(e?.message || 'Error al registrar observación'); }
  };

  const renderBandeja = () => {
    const solicitudes = bandeja?.solicitudes || [];
    const resumen = bandeja?.resumen || {};

    return (
      <div className="stack">
        <SectionCard
          title="Bandeja de solicitudes"
          subtitle="Revisa, valida o rechaza reinscripciones"
          right={
            <button className="btn secondary" onClick={cargarBandeja}><RefreshCw size={16} /> Actualizar</button>
          }
        >
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: '1rem' }}>
            <StatCard icon={ClipboardList} label="Total" value={resumen.total || 0} />
            <StatCard icon={AlertTriangle} label="Pendientes" value={resumen.pendientes || 0} />
            <StatCard icon={CheckCircle2} label="Validadas" value={resumen.validadas || 0} />
            <StatCard icon={XCircle} label="Rechazadas" value={resumen.rechazadas || 0} />
            <StatCard icon={Shield} label="Canceladas" value={resumen.canceladas || 0} />
            <StatCard icon={Activity} label="Activas" value={resumen.activas || 0} />
          </div>

          <div className="filters-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="Periodo">
              <select value={filtros.id_periodo} onChange={e => setFiltros(p => ({ ...p, id_periodo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </FormField>
            <FormField label="Grupo">
              <select value={filtros.id_grupo} onChange={e => setFiltros(p => ({ ...p, id_grupo: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.grupos || []).map(g => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={filtros.estado} onChange={e => setFiltros(p => ({ ...p, estado: e.target.value }))} style={selectStyle}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Validada">Validada</option>
                <option value="Rechazada">Rechazada</option>
                <option value="Cancelada">Cancelada</option>
                <option value="Activo">Activo</option>
              </select>
            </FormField>
            <FormField label="Buscar">
              <input type="text" placeholder="Matrícula o nombre..." value={filtros.busqueda} onChange={e => setFiltros(p => ({ ...p, busqueda: e.target.value }))} style={inputStyle} />
            </FormField>
            <button className="btn primary" onClick={cargarBandeja}><Filter size={16} /> Filtrar</button>
          </div>

          {solicitudes.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Grupo</th><th>Estado</th><th>Motivo</th><th>Cupo</th><th>Fecha</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {solicitudes.map(s => (
                    <tr key={s.id_inscripcion}>
                      <td>{s.id_inscripcion}</td>
                      <td><strong>{s.matricula}</strong></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nombre_completo}>{s.nombre_completo}</td>
                      <td>{s.nombre_periodo}</td>
                      <td>{s.nombre_grupo || '—'}</td>
                      <td><StatusBadge status={s.estado} /></td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.motivo || ''}>{s.motivo || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{s.cupo_actual}/{s.cupo_maximo}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(s.fecha_inscripcion)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn secondary btn-sm" title="Ver detalle" onClick={() => { setDetalleId(s.id_inscripcion); setTab('detalle'); }}>
                            <Eye size={14} />
                          </button>
                          {s.estado === 'Pendiente' && (
                            <>
                              <button className="btn primary btn-sm" title="Validar" onClick={() => handleUpdateEstado(s.id_inscripcion, 'Validada')}>
                                <CheckCircle2 size={14} />
                              </button>
                              <button className="btn danger btn-sm" title="Rechazar" onClick={() => {
                                const motivo = prompt('Motivo de rechazo:');
                                if (motivo) handleUpdateEstado(s.id_inscripcion, 'Rechazada', motivo);
                              }}>
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {!s.nombre_grupo && (
                            <button className="btn secondary btn-sm" title="Asignar grupo" onClick={() => {
                              const idGrupo = prompt('ID del grupo:');
                              if (idGrupo) handleAsignarGrupo(s.id_inscripcion, Number(idGrupo));
                            }}>
                              <Users size={14} />
                            </button>
                          )}
                          <button className="btn secondary btn-sm" title="Agregar observación" onClick={() => {
                            const obs = prompt('Observación:');
                            if (obs) handleAgregarObservacion(s.id_inscripcion, obs);
                          }}>
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <ClipboardList size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No se encontraron solicitudes de reinscripción.{filtros.estado === 'Pendiente' ? ' No hay solicitudes pendientes.' : ''}</p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderValidacion = () => {
    return (
      <div className="stack">
        <SectionCard
          title="Validación por grupo"
          subtitle="Resumen de reinscripciones agrupadas por grupo"
          right={
            <button className="btn secondary" onClick={cargarValidacion}><RefreshCw size={16} /> Actualizar</button>
          }
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="Periodo">
              <select value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} style={selectStyle}>
                <option value="">Todos</option>
                {(catalogos?.periodos || []).map(p => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>)}
              </select>
            </FormField>
            <button className="btn primary" onClick={cargarValidacion}><Filter size={16} /> Filtrar</button>
          </div>

          {validacionGrupo.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Grupo</th><th>Periodo</th><th>Semestre</th><th>Turno</th><th>Total</th><th>Pendientes</th><th>Validadas</th><th>Rechazadas</th><th>Activas</th><th>Cupo</th><th>Ocupación</th></tr>
                </thead>
                <tbody>
                  {validacionGrupo.map((g, i) => (
                    <tr key={i}>
                      <td><strong>{g.nombre_grupo}</strong></td>
                      <td>{g.nombre_periodo}</td>
                      <td>{g.semestre}</td>
                      <td>{g.turno}</td>
                      <td>{g.total_solicitudes}</td>
                      <td><span className="badge warn">{g.pendientes}</span></td>
                      <td><span className="badge success">{g.validadas}</span></td>
                      <td><span className="badge danger">{g.rechazadas}</span></td>
                      <td>{g.activas}</td>
                      <td>{g.cupo_actual}/{g.cupo_maximo}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 80, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(g.porcentaje_ocupacion || 0, 100)}%`, height: '100%', background: (g.porcentaje_ocupacion || 0) > 90 ? 'var(--danger)' : (g.porcentaje_ocupacion || 0) > 75 ? 'var(--warning)' : 'var(--success)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: '0.85rem' }}>{g.porcentaje_ocupacion || 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <Users size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No hay datos de validación por grupo.</p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderDetalle = () => {
    return (
      <div className="stack">
        <SectionCard
          title="Detalle del alumno"
          subtitle="Busca una reinscripción por ID para ver su información completa"
          right={
            detalleData && (
              <button className="btn secondary" onClick={() => { setDetalleData(null); setDetalleId(''); }}>
                Limpiar
              </button>
            )
          }
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'end' }}>
            <FormField label="ID de reinscripción">
              <input type="number" placeholder="Ej: 123" value={detalleId} onChange={e => setDetalleId(e.target.value)} style={inputStyle} />
            </FormField>
            <button className="btn primary" onClick={cargarDetalle} disabled={!detalleId}>
              <Search size={16} /> Consultar
            </button>
          </div>

          {detalleData && (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: '1rem' }}>
                <StatCard icon={UserCheck} label="Alumno" value={detalleData.detalle?.nombre_completo || '—'} />
                <StatCard icon={FileText} label="Matrícula" value={detalleData.detalle?.matricula || '—'} />
                <StatCard icon={Shield} label="Estado" value={detalleData.detalle?.estado || '—'} />
                <StatCard icon={ClipboardList} label="Periodo" value={detalleData.detalle?.nombre_periodo || '—'} />
              </div>

              <div className="two-col" style={{ marginBottom: '1rem' }}>
                <div className="section-card">
                  <h3>Información de la reinscripción</h3>
                  <div className="list">
                    <div className="list-item"><strong>ID Inscripción:</strong><span>{detalleData.detalle.id_inscripcion}</span></div>
                    <div className="list-item"><strong>Estado:</strong><span><StatusBadge status={detalleData.detalle.estado} /></span></div>
                    <div className="list-item"><strong>Tipo:</strong><span>{detalleData.detalle.tipo_inscripcion}</span></div>
                    <div className="list-item"><strong>Fecha solicitud:</strong><span>{formatDate(detalleData.detalle.fecha_inscripcion)}</span></div>
                    {detalleData.detalle.fecha_validacion && <div className="list-item"><strong>Fecha validación:</strong><span>{formatDate(detalleData.detalle.fecha_validacion)}</span></div>}
                    <div className="list-item"><strong>Periodo:</strong><span>{detalleData.detalle.nombre_periodo}</span></div>
                    <div className="list-item"><strong>Grupo:</strong><span>{detalleData.detalle.nombre_grupo || 'No asignado'}</span></div>
                    <div className="list-item"><strong>Carrera:</strong><span>{detalleData.detalle.nombre_carrera}</span></div>
                    <div className="list-item"><strong>Motivo:</strong><span>{detalleData.detalle.motivo || '—'}</span></div>
                    {detalleData.detalle.motivo_rechazo && <div className="list-item"><strong>Motivo rechazo:</strong><span style={{ color: 'var(--danger)' }}>{detalleData.detalle.motivo_rechazo}</span></div>}
                    <div className="list-item"><strong>Validado por:</strong><span>{detalleData.detalle.validado_por_nombre || '—'}</span></div>
                  </div>
                </div>
                <div className="section-card">
                  <h3>Datos del alumno</h3>
                  <div className="list">
                    <div className="list-item"><strong>Nombre:</strong><span>{detalleData.detalle.nombre_completo}</span></div>
                    <div className="list-item"><strong>Matrícula:</strong><span>{detalleData.detalle.matricula}</span></div>
                    <div className="list-item"><strong>CURP:</strong><span>{detalleData.detalle.curp || '—'}</span></div>
                    <div className="list-item"><strong>Correo institucional:</strong><span>{detalleData.detalle.correo_institucional || '—'}</span></div>
                    <div className="list-item"><strong>Correo personal:</strong><span>{detalleData.detalle.correo_personal || '—'}</span></div>
                    <div className="list-item"><strong>Teléfono:</strong><span>{detalleData.detalle.telefono || '—'}</span></div>
                    <div className="list-item"><strong>Comprobante pago:</strong><span>{detalleData.detalle.comprobante_pago ? 'Sí' : 'No'}</span></div>
                  </div>
                </div>
              </div>

              <SectionCard title="Observaciones" subtitle={detalleData.detalle.observaciones || 'Sin observaciones'}>
                {detalleData.detalle.observaciones && (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', margin: 0 }}>{detalleData.detalle.observaciones}</pre>
                )}
              </SectionCard>

              {detalleData.historial?.length > 0 && (
                <SectionCard title="Historial de cambios">
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>Acción</th><th>Detalle</th><th>Estado ant.</th><th>Estado nuevo</th><th>Usuario</th><th>IP</th><th>Fecha</th></tr>
                      </thead>
                      <tbody>
                        {detalleData.historial.map(h => (
                          <tr key={h.id_auditoria}>
                            <td><span className="badge light">{h.accion}</span></td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.detalle}>{h.detalle || '—'}</td>
                            <td><StatusBadge status={h.estado_anterior} /></td>
                            <td><StatusBadge status={h.estado_nuevo} /></td>
                            <td style={{ fontSize: '0.85rem' }}>{h.usuario_nombre || '—'}</td>
                            <td style={{ fontSize: '0.85rem' }}>{h.ip || '—'}</td>
                            <td style={{ fontSize: '0.85rem' }}>{formatDate(h.creado_en)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderObservaciones = () => {
    const solicitudes = bandeja?.solicitudes || [];
    const conObservaciones = solicitudes.filter(s => s.observaciones);

    return (
      <div className="stack">
        <SectionCard
          title="Observaciones académicas"
          subtitle="Registro de observaciones en reinscripciones"
          right={
            <button className="btn secondary" onClick={cargarBandeja}><RefreshCw size={16} /> Actualizar</button>
          }
        >
          {conObservaciones.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Estado</th><th>Observaciones</th></tr>
                </thead>
                <tbody>
                  {conObservaciones.map(s => (
                    <tr key={s.id_inscripcion}>
                      <td>{s.id_inscripcion}</td>
                      <td><strong>{s.matricula}</strong></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nombre_completo}>{s.nombre_completo}</td>
                      <td>{s.nombre_periodo}</td>
                      <td><StatusBadge status={s.estado} /></td>
                      <td style={{ maxWidth: 300 }}>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.85rem', margin: 0, maxHeight: 100, overflowY: 'auto' }}>
                          {s.observaciones}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No hay reinscripciones con observaciones registradas.</p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderEstadoTramite = () => {
    const solicitudes = bandeja?.solicitudes || [];
    const recientes = solicitudes.slice(0, 50);

    return (
      <div className="stack">
        <SectionCard
          title="Estado del trámite"
          subtitle="Historial de reinscripciones recientes con su estado actual"
          right={
            <button className="btn secondary" onClick={cargarBandeja}><RefreshCw size={16} /> Actualizar</button>
          }
        >
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: '1rem' }}>
            <StatCard icon={ClipboardList} label="Total" value={bandeja?.resumen?.total || 0} />
            <StatCard icon={CheckCircle2} label="Validadas" value={bandeja?.resumen?.validadas || 0} />
            <StatCard icon={XCircle} label="Rechazadas" value={bandeja?.resumen?.rechazadas || 0} />
            <StatCard icon={Activity} label="Activas" value={bandeja?.resumen?.activas || 0} />
          </div>

          {recientes.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Matrícula</th><th>Alumno</th><th>Periodo</th><th>Grupo</th><th>Estado</th><th>Motivo</th><th>Fecha</th><th>Validó</th></tr>
                </thead>
                <tbody>
                  {recientes.map(s => (
                    <tr key={s.id_inscripcion}>
                      <td>{s.id_inscripcion}</td>
                      <td><strong>{s.matricula}</strong></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nombre_completo}>{s.nombre_completo}</td>
                      <td>{s.nombre_periodo}</td>
                      <td>{s.nombre_grupo || '—'}</td>
                      <td><StatusBadge status={s.estado} /></td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.motivo || ''}>{s.motivo || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(s.fecha_inscripcion)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{s.validado_por_nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
              <History size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No hay reinscripciones registradas.</p>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="auth-note" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2rem' }}><Loader2 className="animate-spin" size={18} /> <span>Cargando datos...</span></div>;
    if (error) return <div className="stack"><div className="alert error">{error}</div><button className="btn secondary" onClick={tryAgain}>Reintentar</button></div>;
    switch (tab) {
      case 'bandeja': return renderBandeja();
      case 'validacion': return renderValidacion();
      case 'detalle': return renderDetalle();
      case 'observaciones': return renderObservaciones();
      case 'estado': return renderEstadoTramite();
      default: return null;
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Coordinación</div>
          <h1>Panel de coordinación — Reinscripciones</h1>
          <p>Gestiona las reinscripciones: revisa solicitudes, valida o rechaza, asigna grupos, agrega observaciones y consulta el estado del trámite por alumno, grupo y periodo.</p>
        </div>
      </section>

      <div className="tabs">
        {TABS.map(t => <TabButton key={t.key} tab={t} active={tab === t.key} onClick={() => setTab(t.key)} />)}
      </div>

      {renderContent()}
    </div>
  );
}

const selectStyle = {
  padding: '0.5rem', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', minWidth: 150
};
const inputStyle = {
  padding: '0.5rem', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', minWidth: 200
};
