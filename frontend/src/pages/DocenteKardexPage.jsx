import React from 'react';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, Users, BarChart3, BookOpen, AlertTriangle
} from 'lucide-react';

const TABS = [
  { key: 'grupo', label: 'Vista del grupo', icon: Users },
  { key: 'consulta', label: 'Kardex de consulta', icon: Search },
  { key: 'desempeno', label: 'Resumen de desempeño', icon: BarChart3 },
  { key: 'historial', label: 'Historial de evaluación', icon: BookOpen }
];

function Badge({ children, variant }) {
  const colors = {
    aceptable: { bg: '#dcfce7', fg: '#166534' },
    riesgo: { bg: '#fef3c7', fg: '#92400e' },
    critico: { bg: '#fee2e2', fg: '#991b1b' },
    info: { bg: '#dbeafe', fg: '#1e40af' }
  };
  const c = colors[variant] || { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '10px', fontWeight: 600,
      background: c.bg, color: c.fg
    }}>{children}</span>
  );
}

function StatCard({ label, value, variant }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '8px', padding: '10px 14px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: '100px'
    }}>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: '18px', fontWeight: 700, marginTop: '3px',
        color: variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : '#0f172a'
      }}>{value}</div>
    </div>
  );
}

// ── TAB 1: VISTA DEL GRUPO ──
function VistaDelGrupo({ token, grupos }) {
  const [idGrupo, setIdGrupo] = React.useState('');
  const [grupoData, setGrupoData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const consultar = async () => {
    if (!idGrupo) { setError('Selecciona un grupo'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexDocenteGrupo(token, idGrupo);
      const d = r?.data ?? r;
      setGrupoData(d?.data || d);
    } catch (e) {
      setError('Error al consultar el grupo');
      setGrupoData(null);
    } finally { setLoading(false); }
  };

  const alumnos = grupoData?.alumnos || [];

  return (
    <div className="form-stack">
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="Grupo (carga académica)">
          <select value={idGrupo} onChange={e => setIdGrupo(e.target.value)}>
            <option value="">Selecciona un grupo</option>
            {grupos.map(g => (
              <option key={g.id_carga_academica} value={g.id_grupo}>
                {g.nombre_grupo} — {g.nombre_materia} ({g.clave_materia}) — {g.nombre_periodo}
              </option>
            ))}
          </select>
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading} type="button">
          <Users size={16} /> Ver grupo
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {grupoData && (
        <>
          <div className="row gap wrap">
            <StatCard label="Grupo" value={grupoData.grupo?.nombre_grupo || '—'} />
            <StatCard label="Periodo" value={grupoData.grupo?.nombre_periodo || '—'} />
            <StatCard label="Carrera" value={grupoData.grupo?.nombre_carrera || '—'} />
            <StatCard label="Total alumnos" value={grupoData.estadisticas?.total || 0} />
            <StatCard label="Promedio grupo" value={grupoData.estadisticas?.promedioGrupo || '0.00'} />
            <StatCard label="Con rezago" value={grupoData.estadisticas?.conRezago || 0}
              variant={grupoData.estadisticas?.conRezago > 0 ? 'warning' : ''} />
          </div>

          <div className="table-wrap" style={{ marginTop: '10px', overflowX: 'auto' }}>
            <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#1e40af', color: '#fff' }}>
                  <th style={{ padding: '5px 7px', textAlign: 'left' }}>Alumno</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Matrícula</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Semestre</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Promedio</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Créditos</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Reprobadas</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Estatus</th>
                  <th style={{ padding: '5px 7px', textAlign: 'center' }}>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a, i) => {
                  const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                  const prom = parseFloat(a.promedio_general) || 0;
                  const rezago = prom < 70 || a.materias_reprobadas > 2;
                  return (
                    <tr key={a.id_alumno} style={{ background: bg }}>
                      <td style={{ padding: '4px 7px', fontWeight: 600 }}>{a.nombre_completo}</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center', fontFamily: 'monospace' }}>{a.matricula}</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center' }}>{a.semestre_actual}°</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center', fontWeight: 600,
                        color: prom >= 80 ? '#16a34a' : prom >= 70 ? '#d97706' : '#dc2626' }}>{prom.toFixed(2)}</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center' }}>{a.creditos_acumulados}</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center',
                        color: a.materias_reprobadas > 2 ? '#dc2626' : '#64748b' }}>{a.materias_reprobadas}</td>
                      <td style={{ padding: '4px 7px', textAlign: 'center' }}>
                        <Badge variant={a.estatus_academico === 'Regular' ? 'aceptable' : 'critico'}>
                          {a.estatus_academico?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td style={{ padding: '4px 7px', textAlign: 'center' }}>
                        {rezago ? <Badge variant="critico">Rezago</Badge> : <Badge variant="aceptable">Regular</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {alumnos.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                    No hay alumnos activos en este grupo
                  </td></tr>
                )}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {!grupoData && !loading && (
        <div className="empty">Selecciona un grupo y haz clic en "Ver grupo".</div>
      )}
    </div>
  );
}

// ── TAB 2: KARDEX DE CONSULTA ──
function KardexConsulta({ token, grupos }) {
  const [selectedGrupo, setSelectedGrupo] = React.useState('');
  const [idAlumno, setIdAlumno] = React.useState('');
  const [alumnos, setAlumnos] = React.useState([]);
  const [alumnoData, setAlumnoData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!selectedGrupo) { setAlumnos([]); return; }
    api.kardexDocenteGrupo(token, selectedGrupo)
      .then(r => {
        const d = r?.data ?? r;
        setAlumnos(d?.data?.alumnos || d?.alumnos || []);
      })
      .catch(() => setAlumnos([]));
  }, [selectedGrupo, token]);

  const consultar = async (id) => {
    const alumnoId = id || idAlumno;
    if (!alumnoId) { setError('Selecciona o ingresa un alumno'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexDocenteAlumno(token, alumnoId);
      const d = r?.data ?? r;
      setAlumnoData(d?.data || d);
    } catch (e) {
      setError(e?.status === 403 ? 'No tienes acceso al kardex de este alumno' : 'Error al consultar kardex');
      setAlumnoData(null);
    } finally { setLoading(false); }
  };

  const a = alumnoData?.alumno;
  const h = alumnoData?.historial || [];

  return (
    <div className="form-stack">
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
        <FormField label="Grupo">
          <select value={selectedGrupo} onChange={e => { setSelectedGrupo(e.target.value); setIdAlumno(''); }}>
            <option value="">Selecciona un grupo</option>
            {grupos.map(g => (
              <option key={g.id_carga_academica} value={g.id_grupo}>
                {g.nombre_grupo} — {g.nombre_materia}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Alumno">
          <select value={idAlumno} onChange={e => setIdAlumno(e.target.value)}>
            <option value="">Selecciona un alumno</option>
            {(alumnos || []).map(a => (
              <option key={a.id_alumno} value={a.id_alumno}>{a.nombre_completo} ({a.matricula})</option>
            ))}
          </select>
        </FormField>
      </div>
      <button className="btn accent" onClick={() => consultar()} disabled={loading || !idAlumno} type="button">
        <Search size={16} /> Consultar kardex
      </button>

      {error && <div className="alert danger">{error}</div>}

      {a && (
        <div className="kardex-card" style={{ padding: '14px' }}>
          <div className="row gap" style={{ gap: '14px', flexWrap: 'wrap' }}>
            <div className="photo-box" style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden' }}>
              {a.foto_institucional ? (
                <img src={a.foto_institucional} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', fontSize: '24px', fontWeight: 700, color: '#94a3b8' }}>
                  {(a.nombres || 'A').charAt(0)}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 3px', fontSize: '15px' }}>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</h4>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
                {a.matricula} · {a.nombre_carrera} · {a.semestre_actual}° semestre
              </p>
              <div className="row gap wrap" style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
                  Promedio: <span style={{ color: parseFloat(a.promedio_general) >= 80 ? '#16a34a' : parseFloat(a.promedio_general) >= 70 ? '#d97706' : '#dc2626' }}>
                    {a.promedio_general || '0.00'}
                  </span>
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Créditos: {a.creditos_acumulados || 0}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Folio: {a.folio_kardex || '—'}</span>
              </div>
            </div>
          </div>

          {h.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '10px', overflowX: 'auto' }}>
              <h5 style={{ margin: '0 0 6px', fontSize: '12px' }}>Materias cursadas</h5>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '4px 6px' }}>Periodo</th>
                    <th style={{ padding: '4px 6px' }}>Clave</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Materia</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Calif.</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Créd.</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {h.map((r, i) => (
                    <tr key={r.id_historial || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '3px 6px' }}>{r.nombre_periodo}</td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{r.clave_materia}</td>
                      <td style={{ padding: '3px 6px' }}>{r.nombre_materia}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{r.calificacion ?? '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.creditos || '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                        <Badge variant={r.estado === 'Acreditada' ? 'aceptable' : r.estado === 'Cursando' ? 'info' : 'critico'}>
                          {r.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {h.length === 0 && <div className="empty" style={{ marginTop: '8px' }}>El alumno no registra historial académico.</div>}
        </div>
      )}

      {!a && !loading && (
        <div className="empty">Selecciona un alumno y haz clic en "Consultar kardex".</div>
      )}
    </div>
  );
}

// ── TAB 3: RESUMEN DE DESEMPEÑO ──
function ResumenDesempeno({ token, grupos }) {
  const [selectedGrupo, setSelectedGrupo] = React.useState('');
  const [alumnos, setAlumnos] = React.useState([]);
  const [idAlumno, setIdAlumno] = React.useState('');
  const [desempeno, setDesempeno] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!selectedGrupo) { setAlumnos([]); return; }
    api.kardexDocenteGrupo(token, selectedGrupo)
      .then(r => {
        const d = r?.data ?? r;
        setAlumnos(d?.data?.alumnos || d?.alumnos || []);
      })
      .catch(() => setAlumnos([]));
  }, [selectedGrupo, token]);

  const consultar = async () => {
    if (!idAlumno) { setError('Selecciona un alumno'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexDocenteDesempeno(token, idAlumno);
      const d = r?.data ?? r;
      setDesempeno(d?.data || d);
    } catch (e) {
      setError('Error al obtener resumen de desempeño');
      setDesempeno(null);
    } finally { setLoading(false); }
  };

  const a = desempeno?.alumno;
  const m = desempeno?.metricas || {};
  const porPeriodo = desempeno?.desempenoPorPeriodo || [];

  return (
    <div className="form-stack">
      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="Grupo">
          <select value={selectedGrupo} onChange={e => { setSelectedGrupo(e.target.value); setIdAlumno(''); }}>
            <option value="">Selecciona un grupo</option>
            {grupos.map(g => (
              <option key={g.id_carga_academica} value={g.id_grupo}>{g.nombre_grupo} — {g.nombre_materia}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Alumno">
          <select value={idAlumno} onChange={e => setIdAlumno(e.target.value)}>
            <option value="">Selecciona un alumno</option>
            {(alumnos || []).map(a => (
              <option key={a.id_alumno} value={a.id_alumno}>{a.nombre_completo} ({a.matricula})</option>
            ))}
          </select>
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading || !idAlumno} type="button" style={{ marginBottom: '2px' }}>
          <BarChart3 size={16} /> Ver desempeño
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {desempeno && a && (
        <>
          <div className="kardex-card" style={{ padding: '12px' }}>
            <h4 style={{ margin: '0 0 2px' }}>{a.nombre_completo}</h4>
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b' }}>
              {a.matricula} · {a.nombre_carrera} · Semestre {a.semestre_actual}
            </p>
            <div className="row gap wrap">
              <StatCard label="Promedio general" value={a.promedio_general || '0.00'}
                variant={parseFloat(a.promedio_general) < 70 ? 'danger' : parseFloat(a.promedio_general) < 80 ? 'warning' : ''} />
              <StatCard label="Materias cursadas" value={m.totalMaterias || 0} />
              <StatCard label="Acreditadas" value={m.acreditadas || 0} />
              <StatCard label="No acreditadas" value={m.noAcreditadas || 0}
                variant={m.noAcreditadas > 2 ? 'danger' : ''} />
              <StatCard label="Extraordinarios" value={m.extraordinarios || 0}
                variant={m.extraordinarios > 1 ? 'warning' : ''} />
              <StatCard label="Avance créditos" value={`${m.avanceCreditos || 0}%`}
                variant={m.avanceCreditos < 50 ? 'danger' : m.avanceCreditos < 70 ? 'warning' : ''} />
            </div>
            {m.rezagoDetectado && (
              <div className="alert danger" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px' }}>
                <AlertTriangle size={14} />
                Se ha detectado rezago académico. Este alumno requiere atención.
              </div>
            )}
          </div>

          {porPeriodo.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '10px', overflowX: 'auto' }}>
              <h5 style={{ margin: '0 0 6px', fontSize: '12px' }}>Desempeño por periodo</h5>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Periodo</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Materias</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Acreditadas</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {porPeriodo.map((p, i) => (
                    <tr key={p.periodo} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 600 }}>{p.periodo}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{p.materias}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{p.acreditadas}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{p.promedio}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}

      {!desempeno && !loading && !error && (
        <div className="empty">Selecciona un alumno y haz clic en "Ver desempeño".</div>
      )}
    </div>
  );
}

// ── TAB 4: HISTORIAL DE EVALUACIÓN ──
function HistorialEvaluacion({ token, grupos }) {
  const [selectedGrupo, setSelectedGrupo] = React.useState('');
  const [alumnos, setAlumnos] = React.useState([]);
  const [idAlumno, setIdAlumno] = React.useState('');
  const [historial, setHistorial] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!selectedGrupo) { setAlumnos([]); return; }
    api.kardexDocenteGrupo(token, selectedGrupo)
      .then(r => {
        const d = r?.data ?? r;
        setAlumnos(d?.data?.alumnos || d?.alumnos || []);
      })
      .catch(() => setAlumnos([]));
  }, [selectedGrupo, token]);

  const consultar = async () => {
    if (!idAlumno) { setError('Selecciona un alumno'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexDocenteHistorial(token, idAlumno);
      const d = r?.data ?? r;
      setHistorial(d?.data || d);
    } catch (e) {
      setError('Error al obtener historial de evaluación');
      setHistorial(null);
    } finally { setLoading(false); }
  };

  const h = historial?.historial || [];
  const resumen = historial?.resumen || {};

  return (
    <div className="form-stack">
      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="Grupo">
          <select value={selectedGrupo} onChange={e => { setSelectedGrupo(e.target.value); setIdAlumno(''); }}>
            <option value="">Selecciona un grupo</option>
            {grupos.map(g => (
              <option key={g.id_carga_academica} value={g.id_grupo}>{g.nombre_grupo} — {g.nombre_materia}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Alumno">
          <select value={idAlumno} onChange={e => setIdAlumno(e.target.value)}>
            <option value="">Selecciona un alumno</option>
            {(alumnos || []).map(a => (
              <option key={a.id_alumno} value={a.id_alumno}>{a.nombre_completo} ({a.matricula})</option>
            ))}
          </select>
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading || !idAlumno} type="button" style={{ marginBottom: '2px' }}>
          <BookOpen size={16} /> Ver historial
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {historial && (
        <>
          <div className="row gap wrap">
            <StatCard label="Total materias" value={resumen.totalMaterias || 0} />
            <StatCard label="Acreditadas" value={resumen.acreditadas || 0} variant="aceptable" />
            <StatCard label="No acreditadas" value={resumen.noAcreditadas || 0}
              variant={resumen.noAcreditadas > 0 ? 'danger' : ''} />
            <StatCard label="Promedio" value={resumen.promedioGeneral || '0.00'} />
          </div>

          {h.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '10px', overflowX: 'auto' }}>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '4px 6px' }}>Periodo</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Materia</th>
                    <th style={{ padding: '4px 6px' }}>Clave</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Calif.</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Tipo</th>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '4px 6px' }}>Docente</th>
                    <th style={{ padding: '4px 6px' }}>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {h.map((r, i) => (
                    <tr key={r.id_historial || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '3px 6px' }}>{r.nombre_periodo}</td>
                      <td style={{ padding: '3px 6px' }}>{r.nombre_materia}</td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontSize: '9px' }}>{r.clave_materia}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{r.calificacion ?? '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontSize: '9px' }}>{r.tipo_materia}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                        <Badge variant={r.estado === 'Acreditada' ? 'aceptable' : r.estado === 'Cursando' ? 'info' : 'critico'}>
                          {r.estado}
                        </Badge>
                      </td>
                      <td style={{ padding: '3px 6px', fontSize: '9px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.docente_materia || '—'}
                      </td>
                      <td style={{ padding: '3px 6px', fontSize: '9px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.observaciones || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {h.length === 0 && <div className="empty" style={{ marginTop: '8px' }}>No hay historial de evaluación para este alumno.</div>}
        </>
      )}

      {!historial && !loading && !error && (
        <div className="empty">Selecciona un alumno y haz clic en "Ver historial".</div>
      )}
    </div>
  );
}

// ── HOOK COMPARTIDO: CARGAR GRUPOS DEL DOCENTE ──
function useMisGrupos(token) {
  const [grupos, setGrupos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.kardexDocenteMisGrupos(token)
      .then(r => { const d = r?.data ?? r; setGrupos(d?.data || []); })
      .catch(() => setGrupos([]))
      .finally(() => setLoading(false));
  }, [token]);

  return { grupos, loading };
}

// ── MAIN PAGE ──
export default function DocenteKardexPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = React.useState('grupo');
  const { grupos } = useMisGrupos(token);

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 4px' }}>Gestión académica · Kardex</h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
          Consulta informativa de expedientes autorizados. Revisa promedios, estado académico y
          detecta estudiantes con rezago en tus grupos.
        </p>
      </div>

      <div className="tabs" style={{
        display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0',
        marginBottom: '16px', overflowX: 'auto', paddingBottom: '0'
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', border: 'none',
                borderBottom: isActive ? '2px solid #1e40af' : '2px solid transparent',
                background: 'transparent', cursor: 'pointer',
                color: isActive ? '#1e40af' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '12px', whiteSpace: 'nowrap',
                marginBottom: '-2px', transition: 'all 0.15s'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'grupo' && <VistaDelGrupo token={token} grupos={grupos} />}
      {activeTab === 'consulta' && <KardexConsulta token={token} grupos={grupos} />}
      {activeTab === 'desempeno' && <ResumenDesempeno token={token} grupos={grupos} />}
      {activeTab === 'historial' && <HistorialEvaluacion token={token} grupos={grupos} />}
    </div>
  );
}
