import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Group,
  Info,
  List,
  RefreshCw,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  XCircle
} from 'lucide-react';

const TIPO_LABELS = {
  cambio_inscripcion: 'Cambio de inscripción',
  alta: 'Alta',
  baja: 'Baja',
  inconsistencia: 'Inconsistencia',
  actualizacion_lista: 'Actualización de lista'
};

const TIPO_BADGES = {
  cambio_inscripcion: 'warning',
  alta: 'success',
  baja: 'danger',
  inconsistencia: 'danger',
  actualizacion_lista: 'info'
};

const TABS = [
  { key: 'grupos', label: 'Consulta de grupo inscrito', icon: BookOpen },
  { key: 'lista', label: 'Lista oficial de alumnos', icon: List },
  { key: 'cambios', label: 'Cambios de inscripción', icon: ArrowUpDown },
  { key: 'notificaciones', label: 'Notificaciones', icon: AlertCircle },
  { key: 'inconsistencias', label: 'Inconsistencias', icon: AlertTriangle }
];

function Badge({ type, children }) {
  const cls = type === 'success' ? 'badge badge-success' :
    type === 'danger' ? 'badge badge-danger' :
    type === 'warning' ? 'badge badge-warning' :
    'badge badge-info';
  return <span className={cls}>{children}</span>;
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
          <Badge type={grupo.estado_carga === 'ACTIVA' ? 'success' : 'warning'}>
            {grupo.estado_carga}
          </Badge>
          <span className="badge badge-info">{grupo.total_alumnos} alumnos</span>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: '0.5rem' }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Clave materia: {grupo.clave_materia}
          {grupo.observaciones ? <span> • Obs: {grupo.observaciones}</span> : ''}
        </p>
      </div>
    </div>
  );
}

function PanelGrupos({ grupos, cargando, error, onSeleccionarGrupo, grupoSeleccionado }) {
  if (cargando) {
    return <div className="text-center py-4"><p className="muted">Cargando grupos asignados...</p></div>;
  }
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }
  if (!grupos.length) {
    return (
      <div className="text-center py-4">
        <BookOpen size={48} className="muted" />
        <p className="muted" style={{ marginTop: '0.5rem' }}>No tienes grupos asignados en este periodo.</p>
      </div>
    );
  }

  const agrupados = grupos.reduce((acc, g) => {
    const key = `${g.id_grupo}-${g.id_periodo}`;
    if (!acc[key]) {
      acc[key] = { ...g, materias: [] };
    }
    if (!acc[key].materias.find(m => m.id_materia === g.id_materia)) {
      acc[key].materias.push({ id_materia: g.id_materia, clave_materia: g.clave_materia, nombre_materia: g.nombre_materia });
    }
    return acc;
  }, {});

  const gruposUnicos = Object.values(agrupados);

  return (
    <div className="grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: '0 0 0.5rem', color: 'var(--muted)' }}>
        {gruposUnicos.length} grupo(s) asignado(s) — {grupos.length} carga(s) académica(s)
      </p>
      {gruposUnicos.map((g, idx) => {
        const grupoParaSelect = grupos.find(gr => gr.id_grupo === g.id_grupo && gr.id_periodo === g.id_periodo);
        return (
          <div key={`${g.id_grupo}-${g.id_periodo}-${idx}`} className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{g.nombre_grupo}</h3>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  {g.nombre_periodo} • Semestre {g.semestre} • Turno: {g.turno}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Badge type={g.estado_carga === 'ACTIVA' ? 'success' : 'warning'}>
                  {g.estado_carga}
                </Badge>
                <span className="badge badge-info">{g.total_alumnos} alumnos</span>
              </div>
            </div>
            <div className="card-body">
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Materias impartidas:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {g.materias.map(m => (
                  <span key={m.id_materia} className="badge badge-info" style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>
                    {m.clave_materia} — {m.nombre_materia}
                  </span>
                ))}
              </div>
              <button
                className="btn primary mt-1"
                onClick={() => onSeleccionarGrupo(grupoParaSelect || g)}
                style={{ marginTop: '0.75rem' }}
              >
                <Eye size={16} /> Ver lista de alumnos
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PanelListaAlumnos({ grupoSeleccionado, onRegresar }) {
  const { user, token } = useAuth();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');

  const cargarLista = useCallback(async () => {
    if (!grupoSeleccionado) return;
    setCargando(true);
    setError('');
    try {
      const res = await api.docenteListaAlumnos(token, grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo);
      if (res.ok) setDatos(res.data);
      else setError(res.message || 'Error al cargar lista');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, grupoSeleccionado]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  if (!grupoSeleccionado) {
    return <div className="text-center py-4"><p className="muted">Selecciona un grupo en la pestaña anterior.</p></div>;
  }

  if (cargando) return <div className="text-center py-4"><p className="muted">Cargando lista oficial...</p></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const grupo = datos?.grupo;
  const alumnos = (datos?.alumnos || []).filter(a => {
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return (a.nombre_completo || '').toLowerCase().includes(q) ||
      (a.matricula || '').toLowerCase().includes(q) ||
      (a.curp || '').toLowerCase().includes(q);
  });

  const activos = alumnos.filter(a => a.estado_en_grupo === 'ACTIVO');
  const bajas = alumnos.filter(a => a.estado_en_grupo !== 'ACTIVO');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button className="btn secondary" onClick={onRegresar}>
          ← Volver a grupos
        </button>
        <h3 style={{ margin: 0 }}>
          Lista oficial — {grupo?.nombre_grupo || ''}
        </h3>
        <button className="btn secondary" onClick={cargarLista} title="Recargar">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {grupo && (
        <div className="card mb-1">
          <div className="card-body" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div><strong>Periodo:</strong> {grupo.nombre_periodo}</div>
            <div><strong>Carrera:</strong> {grupo.nombre_carrera}</div>
            <div><strong>Semestre:</strong> {grupo.semestre}</div>
            <div><strong>Turno:</strong> {grupo.turno}</div>
            <div><strong>Cupo:</strong> {grupo.cupo_maximo || 'N/A'}</div>
            <div><strong>Inscritos activos:</strong> {grupo.inscritos_activos}</div>
            <div><strong>Bajas:</strong> {grupo.bajas}</div>
            <div><strong>Total asignados:</strong> {grupo.total_asignados}</div>
          </div>
        </div>
      )}

      {datos?.materias?.length > 0 && (
        <div className="card mb-1">
          <div className="card-body" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>Materias:</strong>
            {datos.materias.map(m => (
              <span key={m.id_materia} className="badge badge-info">{m.clave_materia} — {m.nombre_materia}</span>
            ))}
          </div>
        </div>
      )}

      <div className="input-group mb-1" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Search size={16} className="muted" />
        <input
          type="text"
          placeholder="Buscar por nombre, matrícula o CURP..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
        />
        <span className="badge badge-info">{alumnos.length} alumnos</span>
        {bajas.length > 0 && <span className="badge badge-danger">{bajas.length} bajas</span>}
      </div>

      {!alumnos.length ? (
        <div className="text-center py-4"><p className="muted">No se encontraron alumnos.</p></div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Matrícula</th>
                <th>Nombre completo</th>
                <th>CURP</th>
                <th>Estado en grupo</th>
                <th>Inscripción</th>
                <th>Tipo</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a, idx) => (
                <tr key={a.id_grupo_alumno || a.id_alumno}>
                  <td>{idx + 1}</td>
                  <td><strong>{a.matricula}</strong></td>
                  <td>{a.nombre_completo}</td>
                  <td style={{ fontSize: '0.85rem' }}>{a.curp || '-'}</td>
                  <td>
                    <Badge type={a.estado_en_grupo === 'ACTIVO' ? 'success' : 'danger'}>
                      {a.estado_en_grupo}
                    </Badge>
                  </td>
                  <td>
                    <Badge type={
                      a.estado_inscripcion === 'Activo' || a.estado_inscripcion === 'Validada' || a.estado_inscripcion === 'Completada' ? 'success' :
                      a.estado_inscripcion === 'Pendiente' ? 'warning' : 'danger'
                    }>
                      {a.estado_inscripcion || 'Sin inscripción'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{a.tipo_inscripcion || '-'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{a.comprobante_pago ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PanelCambios({ grupoSeleccionado }) {
  const { user, token } = useAuth();
  const [cambios, setCambios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modoGeneral, setModoGeneral] = useState(!grupoSeleccionado);

  const cargarCambios = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      let res;
      if (grupoSeleccionado) {
        res = await api.docenteCambiosInscripcion(token, grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo);
      } else {
        res = await api.docenteCambiosInscripcionGeneral(token);
      }
      if (res.ok) setCambios(res.data);
      else setError(res.message || 'Error al cargar cambios');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, grupoSeleccionado]);

  useEffect(() => { cargarCambios(); }, [cargarCambios]);

  if (cargando) return <div className="text-center py-4"><p className="muted">Cargando cambios...</p></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Cambios de inscripción</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {grupoSeleccionado && (
            <span className="badge badge-info">
              Grupo: {grupoSeleccionado.nombre_grupo}
            </span>
          )}
          <button className="btn secondary" onClick={cargarCambios}>
            <RefreshCw size={16} /> Recargar
          </button>
        </div>
      </div>

      {!cambios.length ? (
        <div className="text-center py-4">
          <ArrowUpDown size={48} className="muted" />
          <p className="muted" style={{ marginTop: '0.5rem' }}>No se encontraron cambios de inscripción recientes.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Alumno</th>
                <th>Matrícula</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>Estado anterior</th>
                <th>Estado nuevo</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map(c => (
                <tr key={c.id_auditoria}>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(c.creado_en).toLocaleString()}</td>
                  <td>{c.alumno_nombre}</td>
                  <td>{c.matricula}</td>
                  <td><Badge type="info">{c.accion}</Badge></td>
                  <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.detalle}>
                    {c.detalle || '-'}
                  </td>
                  <td><Badge type="warning">{c.estado_anterior || '-'}</Badge></td>
                  <td><Badge type="success">{c.estado_nuevo || '-'}</Badge></td>
                  <td>{c.nombre_grupo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PanelNotificaciones() {
  const { user, token } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const cargarNotis = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await api.docenteNotificaciones(token);
      if (res.ok) {
        setNotificaciones(res.data);
        setNoLeidas(res.noLeidas || 0);
      } else setError(res.message || 'Error al cargar notificaciones');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargarNotis(); }, [cargarNotis]);

  const marcarLeida = async (id) => {
    try {
      await api.docenteMarcarNotificacionLeida(token, id);
      setNotificaciones(prev => prev.map(n => n.id_notificacion === id ? { ...n, leida: 1 } : n));
      setNoLeidas(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Error al marcar como leída:', e);
    }
  };

  const marcarTodasLeidas = async () => {
    try {
      await api.docenteMarcarTodasLeidas(token);
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: 1 })));
      setNoLeidas(0);
    } catch (e) {
      console.error('Error al marcar todas como leídas:', e);
    }
  };

  if (cargando) return <div className="text-center py-4"><p className="muted">Cargando notificaciones...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>
          Notificaciones de actualización
          {noLeidas > 0 && (
            <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>
              {noLeidas} sin leer
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {noLeidas > 0 && (
            <button className="btn secondary" onClick={marcarTodasLeidas}>
              <CheckCircle2 size={16} /> Marcar todas leídas
            </button>
          )}
          <button className="btn secondary" onClick={cargarNotis}>
            <RefreshCw size={16} /> Recargar
          </button>
        </div>
      </div>

      {!notificaciones.length ? (
        <div className="text-center py-4">
          <AlertCircle size={48} className="muted" />
          <p className="muted" style={{ marginTop: '0.5rem' }}>No hay notificaciones.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notificaciones.map(n => (
            <div
              key={n.id_notificacion}
              className={`card ${!n.leida ? 'ring-2 ring-primary' : ''}`}
              style={{ opacity: n.leida ? 0.8 : 1 }}
            >
              <div
                className="card-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === n.id_notificacion ? null : n.id_notificacion)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  {!n.leida && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
                  <Badge type={TIPO_BADGES[n.tipo] || 'info'}>
                    {TIPO_LABELS[n.tipo] || n.tipo}
                  </Badge>
                  <span style={{ fontWeight: n.leida ? 400 : 600 }}>
                    {n.nombre_grupo ? `[${n.nombre_grupo}] ` : ''}{n.mensaje?.length > 60 ? n.mensaje.substring(0, 60) + '...' : n.mensaje}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                  {n.leida ? <EyeOff size={14} className="muted" /> : <Eye size={14} />}
                  {expandedId === n.id_notificacion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {!n.leida && (
                    <button
                      className="btn secondary btn-sm"
                      onClick={e => { e.stopPropagation(); marcarLeida(n.id_notificacion); }}
                      title="Marcar como leída"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {expandedId === n.id_notificacion && (
                <div className="card-body" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                  <p style={{ margin: 0 }}>{n.mensaje}</p>
                  {n.nombre_periodo && (
                    <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                      Periodo: {n.nombre_periodo}
                      {n.nombre_grupo ? ` | Grupo: ${n.nombre_grupo}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelInconsistencias({ grupoSeleccionado }) {
  const { user, token } = useAuth();
  const [inconsistencias, setInconsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(false);

  const cargarInc = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      let res;
      if (grupoSeleccionado) {
        res = await api.docenteInconsistencias(token, grupoSeleccionado.id_grupo, grupoSeleccionado.id_periodo);
      } else {
        res = await api.docenteInconsistenciasGeneral(token);
        setResumen(true);
      }
      if (res.ok) setInconsistencias(res.data);
      else setError(res.message || 'Error al cargar inconsistencias');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, grupoSeleccionado]);

  useEffect(() => { cargarInc(); }, [cargarInc]);

  const tipoIcono = (tipo) => {
    switch (tipo) {
      case 'alumno_sin_inscripcion_formal': return <UserMinus size={16} />;
      case 'inscripcion_sin_grupo_alumno': return <AlertTriangle size={16} />;
      case 'baja_reciente': return <UserPlus size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  if (cargando) return <div className="text-center py-4"><p className="muted">Detectando inconsistencias...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>
          Inconsistencias detectadas
          {inconsistencias.length > 0 && (
            <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>
              {inconsistencias.length} encontrada(s)
            </span>
          )}
        </h3>
        <button className="btn secondary" onClick={cargarInc}>
          <RefreshCw size={16} /> Re-detectar
        </button>
      </div>

      {resumen && inconsistencias.length > 0 && (
        <div className="card mb-1">
          <div className="card-body">
            <p style={{ margin: 0, fontWeight: 600 }}>Resumen por grupo:</p>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {inconsistencias.map((inc, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span><strong>{inc.nombre_grupo}</strong> — {inc.nombre_materia}</span>
                  <span>
                    {inc.alumnos_asignados} asignados vs {inc.inscripciones_formales} inscripciones
                    {Number(inc.bajas_transferencias) > 0 && (
                      <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>
                        {inc.bajas_transferencias} baja(s)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!inconsistencias.length ? (
        <div className="text-center py-4">
          <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
          <p style={{ marginTop: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
            No se detectaron inconsistencias. La lista oficial está correcta.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Matrícula</th>
                <th>Alumno</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {inconsistencias.map((inc, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {tipoIcono(inc.tipo_inconsistencia)}
                      <Badge type="danger">{inc.tipo_inconsistencia?.replace(/_/g, ' ')}</Badge>
                    </div>
                  </td>
                  <td>{inc.matricula || '-'}</td>
                  <td>{inc.nombre_completo || '-'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{inc.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DocenteInscripcionesPage() {
  const { user, token } = useAuth();
  const [tabActivo, setTabActivo] = useState('grupos');
  const [grupos, setGrupos] = useState([]);
  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  const [errorGrupos, setErrorGrupos] = useState('');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);

  const cargarGrupos = useCallback(async () => {
    setCargandoGrupos(true);
    setErrorGrupos('');
    try {
      const res = await api.docenteMisGrupos(token);
      if (res.ok) setGrupos(res.data);
      else setErrorGrupos(res.message || 'Error al cargar grupos');
    } catch (e) {
      setErrorGrupos(e.message);
    } finally {
      setCargandoGrupos(false);
    }
  }, [token]);

  useEffect(() => { cargarGrupos(); }, [cargarGrupos]);

  const seleccionarGrupo = (grupo) => {
    setGrupoSeleccionado(grupo);
    setTabActivo('lista');
  };

  const regresarAGrupos = () => {
    setGrupoSeleccionado(null);
    setTabActivo('grupos');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Inscripciones — Panel Docente</h2>
          <p className="muted">
            Consulta de grupos, lista oficial de alumnos, cambios de inscripción y notificaciones de actualización.
            Alcance por grupo, materia y periodo correspondiente.
          </p>
        </div>
        <button className="btn secondary" onClick={cargarGrupos} title="Recargar datos">
          <RefreshCw size={16} /> Recargar
        </button>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab ${tabActivo === tab.key ? 'active' : ''}`}
            onClick={() => { setTabActivo(tab.key); if (tab.key !== 'lista') setGrupoSeleccionado(null); }}
            style={{
              padding: '0.6rem 1rem',
              border: 'none',
              borderBottom: tabActivo === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: tabActivo === tab.key ? 'var(--primary)' : 'var(--muted)',
              cursor: 'pointer',
              fontWeight: tabActivo === tab.key ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {tabActivo === 'grupos' && (
        <PanelGrupos
          grupos={grupos}
          cargando={cargandoGrupos}
          error={errorGrupos}
          onSeleccionarGrupo={seleccionarGrupo}
          grupoSeleccionado={grupoSeleccionado}
        />
      )}

      {tabActivo === 'lista' && (
        <PanelListaAlumnos
          grupoSeleccionado={grupoSeleccionado}
          onRegresar={regresarAGrupos}
        />
      )}

      {tabActivo === 'cambios' && (
        <PanelCambios grupoSeleccionado={grupoSeleccionado} />
      )}

      {tabActivo === 'notificaciones' && (
        <PanelNotificaciones />
      )}

      {tabActivo === 'inconsistencias' && (
        <PanelInconsistencias grupoSeleccionado={grupoSeleccionado} />
      )}
    </div>
  );
}
