import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  AlertCircle, AlertTriangle, ArrowUpDown, BookOpen,
  CheckCircle2, ChevronDown, ChevronUp, ClipboardList,
  Download, Eye, EyeOff, FileText, Filter, Info,
  List, RefreshCw, Search, UserCheck, UserMinus,
  UserPlus, Users, X, XCircle
} from 'lucide-react';

const TIPO_LABELS = {
  reinscrito: 'Reinscrito',
  baja: 'Baja',
  cambio_grupo: 'Cambio de grupo',
  cambio_carrera: 'Cambio de carrera',
  incidencia: 'Incidencia',
  cancelacion: 'Cancelación',
  otro: 'Otro'
};

const TIPO_BADGES = {
  reinscrito: 'success',
  baja: 'danger',
  cambio_grupo: 'warning',
  cambio_carrera: 'warning',
  incidencia: 'danger',
  cancelacion: 'danger',
  otro: 'info'
};

const TABS = [
  { key: 'grupos', label: 'Grupos actualizados', icon: BookOpen },
  { key: 'lista', label: 'Alumnos reinscritos', icon: List },
  { key: 'cambios', label: 'Cambios e incidencias', icon: ArrowUpDown },
  { key: 'notificaciones', label: 'Notificaciones de continuidad', icon: AlertCircle },
  { key: 'resumen', label: 'Resumen por grupo', icon: ClipboardList }
];

function Badge({ type, children }) {
  const cls = type === 'success' ? 'badge badge-success' :
    type === 'danger' ? 'badge badge-danger' :
    type === 'warning' ? 'badge badge-warning' :
    'badge badge-info';
  return <span className={cls}>{children}</span>;
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function ResumenGrupo({ grupo, onSeleccionar, seleccionado }) {
  const estaSeleccionado = seleccionado?.id_grupo === grupo.id_grupo && seleccionado?.id_periodo === grupo.id_periodo;
  return (
    <div
      className={`card cursor-pointer ${estaSeleccionado ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSeleccionar(grupo)}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>{grupo.nombre_grupo} — {grupo.nombre_materia}</h3>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {grupo.nombre_periodo} • Semestre {grupo.semestre} • Turno: {grupo.turno}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Badge type={Number(grupo.total_alumnos) > 0 ? 'success' : 'warning'}>
            {grupo.total_alumnos} alumnos
          </Badge>
          {Number(grupo.reinscritos) > 0 && (
            <span className="badge badge-info">{grupo.reinscritos} reinscritos</span>
          )}
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: '0.5rem' }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Clave: {grupo.clave_materia} • Bajas: {grupo.bajas || 0}
          {grupo.observaciones ? <span> • Obs: {grupo.observaciones}</span> : ''}
        </p>
      </div>
    </div>
  );
}

function PanelGrupos({ grupos, cargando, error, onSeleccionarGrupo, grupoSeleccionado, onRefresh }) {
  if (cargando) {
    return <div className="text-center py-4"><p className="muted">Cargando grupos asignados...</p></div>;
  }
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  if (!grupos?.length) {
    return (
      <div className="text-center py-4">
        <BookOpen size={48} className="muted mb-2" />
        <p className="muted">No se encontraron grupos asignados para el período activo.</p>
        {onRefresh && (
          <button className="btn btn-outline mt-2" onClick={onRefresh}>
            <RefreshCw size={16} /> Actualizar
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {grupos.map(g => (
        <ResumenGrupo key={`${g.id_grupo}-${g.id_periodo}`} grupo={g} onSeleccionar={onSeleccionarGrupo} seleccionado={grupoSeleccionado} />
      ))}
    </div>
  );
}

function FormFiltroCambios({ filtro, onChange }) {
  return (
    <div className="row gap wrap" style={{ marginBottom: '0.75rem' }}>
      <div className="field" style={{ flex: 1, minWidth: 150 }}>
        <small>Tipo de incidencia</small>
        <select value={filtro.tipo} onChange={e => onChange({ ...filtro, tipo: e.target.value })}>
          <option value="">Todas</option>
          <option value="reinscrito">Reinscritos</option>
          <option value="baja">Bajas</option>
          <option value="cambio_grupo">Cambios de grupo</option>
          <option value="cambio_carrera">Cambios de carrera</option>
          <option value="incidencia">Incidencias</option>
        </select>
      </div>
      <div className="field" style={{ flex: 1, minWidth: 150 }}>
        <small>Buscar alumno</small>
        <div className="row gap">
          <Search size={16} className="muted" />
          <input value={filtro.query} onChange={e => onChange({ ...filtro, query: e.target.value })} placeholder="Nombre o matrícula..." />
        </div>
      </div>
    </div>
  );
}

export default function DocenteReinscripcionesPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('grupos');

  const [grupos, setGrupos] = useState([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  const [errorGrupos, setErrorGrupos] = useState('');

  const [listaReinscritos, setListaReinscritos] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [errorLista, setErrorLista] = useState('');

  const [cambios, setCambios] = useState([]);
  const [resumenCambios, setResumenCambios] = useState(null);
  const [cargandoCambios, setCargandoCambios] = useState(false);
  const [errorCambios, setErrorCambios] = useState('');

  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargandoNotif, setCargandoNotif] = useState(false);
  const [errorNotif, setErrorNotif] = useState('');

  const [resumenGrupos, setResumenGrupos] = useState([]);
  const [resumenGlobal, setResumenGlobal] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState('');

  const [filtroCambios, setFiltroCambios] = useState({ tipo: '', query: '' });
  const [filtroNotif, setFiltroNotif] = useState({ tipo: '', query: '' });

  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [docenteInfo, setDocenteInfo] = useState(null);

  const loadGrupos = useCallback(async () => {
    if (!token) return;
    setCargandoGrupos(true);
    setErrorGrupos('');
    try {
      const res = await api.docenteReinscripcionesGrupos(token);
      setGrupos(res?.data || []);
      setPeriodoActivo(res?.periodoActivo || null);
      setDocenteInfo(res?.docente || null);
    } catch (err) {
      console.error('Error cargando grupos:', err);
      setErrorGrupos(err?.message || 'Error al cargar grupos');
    } finally {
      setCargandoGrupos(false);
    }
  }, [token]);

  const loadLista = useCallback(async (idGrupo, idPeriodo) => {
    if (!token || !idGrupo || !idPeriodo) return;
    setCargandoLista(true);
    setErrorLista('');
    try {
      const res = await api.docenteReinscripcionesListaReinscritos(token, idGrupo, idPeriodo);
      setListaReinscritos(res?.data || []);
    } catch (err) {
      console.error('Error cargando lista:', err);
      setErrorLista(err?.message || 'Error al cargar lista de reinscritos');
    } finally {
      setCargandoLista(false);
    }
  }, [token]);

  const loadCambios = useCallback(async (idGrupo, idPeriodo) => {
    if (!token) return;
    setCargandoCambios(true);
    setErrorCambios('');
    try {
      let res;
      if (idGrupo && idPeriodo) {
        res = await api.docenteReinscripcionesCambios(token, idGrupo, idPeriodo);
      } else {
        res = await api.docenteReinscripcionesCambiosGeneral(token);
      }
      setCambios(res?.data || []);
      setResumenCambios(res?.resumen || null);
    } catch (err) {
      console.error('Error cargando cambios:', err);
      setErrorCambios(err?.message || 'Error al cargar cambios');
    } finally {
      setCargandoCambios(false);
    }
  }, [token]);

  const loadNotificaciones = useCallback(async (tipo) => {
    if (!token) return;
    setCargandoNotif(true);
    setErrorNotif('');
    try {
      const res = await api.docenteReinscripcionesNotificaciones(token, tipo || undefined);
      setNotificaciones(res?.data || []);
      setNoLeidas(res?.noLeidas || 0);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
      setErrorNotif(err?.message || 'Error al cargar notificaciones');
    } finally {
      setCargandoNotif(false);
    }
  }, [token]);

  const loadResumen = useCallback(async () => {
    if (!token) return;
    setCargandoResumen(true);
    setErrorResumen('');
    try {
      const res = await api.docenteReinscripcionesResumen(token);
      setResumenGrupos(res?.data || []);
      setResumenGlobal(res?.global || null);
    } catch (err) {
      console.error('Error cargando resumen:', err);
      setErrorResumen(err?.message || 'Error al cargar resumen');
    } finally {
      setCargandoResumen(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    loadGrupos();
    loadResumen();
    loadNotificaciones();
  }, [authLoading, loadGrupos, loadResumen, loadNotificaciones]);

  useEffect(() => {
    if (grupoSeleccionado) {
      loadLista(grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo);
      loadCambios(grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo);
    }
  }, [grupoSeleccionado, loadLista, loadCambios]);

  const handleSeleccionarGrupo = (grupo) => {
    if (grupoSeleccionado?.id_grupo === grupo.id_grupo && grupoSeleccionado?.id_periodo === grupo.id_periodo) {
      setGrupoSeleccionado(null);
    } else {
      setGrupoSeleccionado(grupo);
    }
  };

  const getTipoLabel = (tipo) => TIPO_LABELS[tipo] || tipo;
  const getTipoBadge = (tipo) => TIPO_BADGES[tipo] || 'info';

  // ========== RENDER ==========

  const renderGrupos = () => (
    <div className="stack">
      {periodoActivo && (
        <div className="alert alert-info mb-2">
          <Info size={16} /> Período activo: <strong>{periodoActivo.nombre_periodo}</strong>
        </div>
      )}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Grupos asignados</h2>
          <button className="btn btn-outline" onClick={loadGrupos}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
        <div className="card-body">
          <PanelGrupos
            grupos={grupos}
            cargando={cargandoGrupos}
            error={errorGrupos}
            onSeleccionarGrupo={handleSeleccionarGrupo}
            grupoSeleccionado={grupoSeleccionado}
            onRefresh={loadGrupos}
          />
        </div>
      </div>
    </div>
  );

  const renderListaReinscritos = () => (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>Alumnos reinscritos</h2>
        </div>
        <div className="card-body">
          {!grupoSeleccionado ? (
            <div className="alert alert-info">
              <Info size={16} /> Selecciona un grupo en la pestaña "Grupos actualizados" para ver su lista de reinscritos.
            </div>
          ) : (
            <>
              <div className="alert alert-info mb-2">
                <BookOpen size={16} /> Grupo: <strong>{grupoSeleccionado.nombre_grupo}</strong> — {grupoSeleccionado.nombre_materia} — {grupoSeleccionado.nombre_periodo}
              </div>
              {cargandoLista ? (
                <p className="muted">Cargando lista de alumnos...</p>
              ) : errorLista ? (
                <div className="alert alert-danger">{errorLista}</div>
              ) : listaReinscritos.length === 0 ? (
                <div className="text-center py-4">
                  <Users size={48} className="muted mb-2" />
                  <p className="muted">No hay alumnos registrados en este grupo.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Nombre</th>
                        <th>Carrera</th>
                        <th>Reinscrito</th>
                        <th>Estado</th>
                        <th>Fecha asignación</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaReinscritos.map(al => (
                        <tr key={al.id_alumno}>
                          <td><code>{al.matricula}</code></td>
                          <td>{al.nombre_completo}</td>
                          <td>{al.nombre_carrera}</td>
                          <td>
                            <Badge type={al.es_reinscrito === 'Sí' ? 'success' : 'warning'}>
                              {al.es_reinscrito}
                            </Badge>
                          </td>
                          <td>
                            <Badge type={al.estado_grupo === 'ACTIVO' ? 'success' : 'danger'}>
                              {al.estado_grupo}
                            </Badge>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{formatDate(al.fecha_asignacion)}</td>
                          <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{al.observaciones || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2">
                <button className="btn btn-outline" onClick={() => loadLista(grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo)}>
                  <RefreshCw size={16} /> Actualizar lista
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderCambios = () => {
    const cambiosFiltrados = cambios.filter(c => {
      if (filtroCambios.tipo && c.tipo_incidencia !== filtroCambios.tipo) return false;
      if (filtroCambios.query) {
        const q = filtroCambios.query.toLowerCase();
        const nombre = (c.alumno_nombre || '').toLowerCase();
        const mat = (c.matricula || '').toLowerCase();
        if (!nombre.includes(q) && !mat.includes(q)) return false;
      }
      return true;
    });

    return (
      <div className="stack">
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Cambios e incidencias de reinscripción</h2>
          </div>
          <div className="card-body">
            {resumenCambios && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span className="badge badge-info">Total: {resumenCambios.total}</span>
                <span className="badge badge-success">Reinscritos: {resumenCambios.reinscritos}</span>
                <span className="badge badge-danger">Bajas: {resumenCambios.bajas}</span>
                <span className="badge badge-warning">Cambios grupo: {resumenCambios.cambios_grupo}</span>
                <span className="badge badge-warning">Cambios carrera: {resumenCambios.cambios_carrera}</span>
                <span className="badge badge-danger">Otros: {resumenCambios.otros}</span>
              </div>
            )}

            <FormFiltroCambios filtro={filtroCambios} onChange={setFiltroCambios} />

            {!grupoSeleccionado && (
              <div className="alert alert-info mb-2">
                <Info size={16} /> Mostrando cambios de todos los grupos. Selecciona un grupo en la pestaña "Grupos actualizados" para filtrar.
              </div>
            )}

            {cargandoCambios ? (
              <p className="muted">Cargando cambios...</p>
            ) : errorCambios ? (
              <div className="alert alert-danger">{errorCambios}</div>
            ) : cambiosFiltrados.length === 0 ? (
              <div className="text-center py-4">
                <ArrowUpDown size={48} className="muted mb-2" />
                <p className="muted">No se encontraron cambios o incidencias.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Matrícula</th>
                      <th>Grupo</th>
                      <th>Período</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      <th>Estado grupo</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambiosFiltrados.map(c => (
                      <tr key={c.id_grupo_alumno || `${c.id_alumno}-${c.id_grupo}`}>
                        <td>{c.alumno_nombre}</td>
                        <td><code>{c.matricula}</code></td>
                        <td>{c.nombre_grupo}</td>
                        <td>{c.nombre_periodo}</td>
                        <td>
                          <Badge type={getTipoBadge(c.tipo_incidencia)}>
                            {getTipoLabel(c.tipo_incidencia)}
                          </Badge>
                        </td>
                        <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{c.motivo_cambio || '—'}</td>
                        <td>
                          <Badge type={c.estado_grupo === 'ACTIVO' ? 'success' : 'danger'}>
                            {c.estado_grupo}
                          </Badge>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{formatDate(c.fecha_asignacion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderNotificaciones = () => {
    const notifFiltradas = notificaciones.filter(n => {
      if (filtroNotif.tipo && n.tipo !== filtroNotif.tipo) return false;
      if (filtroNotif.query) {
        const q = filtroNotif.query.toLowerCase();
        const nombre = (n.alumno_nombre || '').toLowerCase();
        const mat = (n.matricula || '').toLowerCase();
        if (!nombre.includes(q) && !mat.includes(q)) return false;
      }
      return true;
    });

    return (
      <div className="stack">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>
              Notificaciones de continuidad
              {noLeidas > 0 && <span className="badge badge-danger ml-2">{noLeidas} no leídas</span>}
            </h2>
            <div className="row gap">
              {noLeidas > 0 && (
                <button className="btn btn-outline" onClick={async () => {
                  try {
                    await api.docenteReinscripcionesMarcarTodasLeidas(token);
                    await loadNotificaciones();
                  } catch (err) { console.error(err); }
                }}>
                  <CheckCircle2 size={16} /> Marcar todas leídas
                </button>
              )}
              <button className="btn btn-outline" onClick={() => loadNotificaciones()}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          </div>
          <div className="card-body">
            <FormFiltroCambios filtro={filtroNotif} onChange={setFiltroNotif} />

            {cargandoNotif ? (
              <p className="muted">Cargando notificaciones...</p>
            ) : errorNotif ? (
              <div className="alert alert-danger">{errorNotif}</div>
            ) : notifFiltradas.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle size={48} className="muted mb-2" />
                <p className="muted">No hay notificaciones de continuidad.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifFiltradas.map(n => (
                  <div key={n.id_notificacion}
                    className={`card ${!n.leida ? 'border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={async () => {
                      if (!n.leida) {
                        try {
                          await api.docenteReinscripcionesMarcarNotificacionLeida(token, n.id_notificacion);
                          await loadNotificaciones();
                        } catch (err) { console.error(err); }
                      }
                    }}
                  >
                    <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div className="row gap" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
                          <Badge type={getTipoBadge(n.tipo)}>{getTipoLabel(n.tipo)}</Badge>
                          {!n.leida && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>NUEVA</span>}
                        </div>
                        <p style={{ margin: '0.25rem 0' }}>{n.mensaje}</p>
                        <small className="muted">
                          {n.alumno_nombre && <span>{n.alumno_nombre} • </span>}
                          {n.matricula && <span>{n.matricula} • </span>}
                          {n.nombre_grupo && <span>{n.nombre_grupo} • </span>}
                          {formatDate(n.creado_en)}
                        </small>
                      </div>
                      {!n.leida && (
                        <button className="btn btn-sm btn-outline" onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.docenteReinscripcionesMarcarNotificacionLeida(token, n.id_notificacion);
                            await loadNotificaciones();
                          } catch (err) { console.error(err); }
                        }}>
                          <Eye size={14} /> Leída
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResumen = () => {
    if (cargandoResumen) return <p className="muted">Cargando resumen...</p>;
    if (errorResumen) return <div className="alert alert-danger">{errorResumen}</div>;
    if (!resumenGrupos?.length) {
      return (
        <div className="card">
          <div className="card-body text-center py-4">
            <ClipboardList size={48} className="muted mb-2" />
            <p className="muted">No hay datos de resumen disponibles.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="stack">
        {resumenGlobal && (
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0 }}>Resumen global</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
                  <div className="stat-value">{resumenGlobal.total_grupos}</div>
                  <div className="stat-label">Grupos</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
                  <div className="stat-value">{resumenGlobal.total_alumnos}</div>
                  <div className="stat-label">Total alumnos</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
                  <div className="stat-value">{resumenGlobal.total_reinscritos}</div>
                  <div className="stat-label">Reinscritos</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
                  <div className="stat-value">{resumenGlobal.total_bajas}</div>
                  <div className="stat-label">Bajas</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                  <div className="stat-value">{resumenGlobal.total_cambios_grupo}</div>
                  <div className="stat-label">Cambios grupo</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
                  <div className="stat-value">{resumenGlobal.total_nuevos}</div>
                  <div className="stat-label">Nuevos</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Detalle por grupo</h3>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Materia</th>
                    <th>Período</th>
                    <th>Total</th>
                    <th>Reinscritos</th>
                    <th>Bajas</th>
                    <th>Cambios grupo</th>
                    <th>Nuevos</th>
                    <th>Incidencias</th>
                    <th>Mov. auditados</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenGrupos.map(r => (
                    <tr key={`${r.id_grupo}-${r.id_periodo}`}>
                      <td><strong>{r.nombre_grupo}</strong></td>
                      <td>{r.nombre_materia}</td>
                      <td>{r.nombre_periodo}</td>
                      <td>{r.total_alumnos}</td>
                      <td><Badge type="success">{r.reinscritos}</Badge></td>
                      <td><Badge type="danger">{r.bajas}</Badge></td>
                      <td><Badge type="warning">{r.cambios_grupo}</Badge></td>
                      <td><Badge type="info">{r.nuevos}</Badge></td>
                      <td>{r.incidencias > 0 ? <Badge type="danger">{r.incidencias}</Badge> : r.incidencias}</td>
                      <td>{r.movimientos_auditados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <BookOpen size={14} /> Panel docente • Reinscripciones
          </div>
          <h1>Reinscripciones — Docente</h1>
          <p>
            Consulta la actualización de tus grupos, alumnos reinscritos, cambios, bajas,
            incidencias y notificaciones de continuidad para mejorar tu planeación académica.
          </p>
        </div>
        <div className="hero-meta">
          {periodoActivo && (
            <div className="meta-card">
              <small>Período activo</small>
              <strong>{periodoActivo.nombre_periodo}</strong>
            </div>
          )}
          <div className="meta-card">
            <small>Grupos asignados</small>
            <strong>{grupos.length}</strong>
          </div>
        </div>
      </section>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} type="button"
            className={`btn ${activeTab === tab.key ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'grupos' && renderGrupos()}
      {activeTab === 'lista' && renderListaReinscritos()}
      {activeTab === 'cambios' && renderCambios()}
      {activeTab === 'notificaciones' && renderNotificaciones()}
      {activeTab === 'resumen' && renderResumen()}
    </div>
  );
}
