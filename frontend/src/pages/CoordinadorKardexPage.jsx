import React from 'react';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, Users, BookOpen, BarChart3, AlertTriangle,
  ShieldCheck, FileText, Download, Eye, GraduationCap,
  TrendingUp, PieChart, ClipboardList, CheckCircle, XCircle
} from 'lucide-react';

const TABS = [
  { key: 'grupo', label: 'Kardex por grupo', icon: Users },
  { key: 'alumno', label: 'Kardex por alumno', icon: Search },
  { key: 'resumen', label: 'Resumen por periodo', icon: PieChart },
  { key: 'historial', label: 'Historial por carrera', icon: TrendingUp },
  { key: 'validacion', label: 'Validación de trayectorias', icon: ShieldCheck }
];

function Badge({ children, variant }) {
  const colors = {
    aceptable: 'background:#dcfce7;color:#166534;',
    riesgo: 'background:#fef3c7;color:#92400e;',
    critico: 'background:#fee2e2;color:#991b1b;',
    info: 'background:#dbeafe;color:#1e40af;'
  };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '10px', fontWeight: 600, ...(colors[variant] ? { background: colors[variant].match(/background:([^;]+)/)[1], color: colors[variant].match(/color:([^;]+)/)[1] } : { background: '#f1f5f9', color: '#334155' })
    }}>{children}</span>
  );
}

function StatCard({ label, value, variant }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '8px', padding: '12px 16px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: '120px'
    }}>
      <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: '20px', fontWeight: 700, marginTop: '4px',
        color: variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : '#0f172a'
      }}>{value}</div>
    </div>
  );
}

// ── TAB 1: KARDEX POR GRUPO ──
function KardexPorGrupo({ token }) {
  const [catalogos, setCatalogos] = React.useState(null);
  const [idPeriodo, setIdPeriodo] = React.useState('');
  const [idCarrera, setIdCarrera] = React.useState('');
  const [idGrupo, setIdGrupo] = React.useState('');
  const [gruposFiltrados, setGruposFiltrados] = React.useState([]);
  const [grupoData, setGrupoData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    api.kardexCoordinadorCatalogos(token).then(r => {
      const d = r?.data ?? r;
      setCatalogos(d?.data ?? d);
    }).catch(() => {});
  }, [token]);

  React.useEffect(() => {
    if (!catalogos?.grupos) return;
    let filtrados = catalogos.grupos;
    if (idPeriodo) filtrados = filtrados.filter(g => g.id_periodo === Number(idPeriodo));
    if (idCarrera) filtrados = filtrados.filter(g => g.id_carrera === Number(idCarrera));
    setGruposFiltrados(filtrados);
    setIdGrupo('');
  }, [idPeriodo, idCarrera, catalogos]);

  const consultar = async () => {
    if (!idGrupo) { setError('Selecciona un grupo'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexCoordinadorGrupo(token, idGrupo);
      setGrupoData(r?.data ?? r);
    } catch (e) {
      setError('Error al consultar kardex del grupo');
      setGrupoData(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="form-stack">
      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <FormField label="Periodo">
          <select value={idPeriodo} onChange={e => setIdPeriodo(e.target.value)}>
            <option value="">Todos los periodos</option>
            {(catalogos?.periodos || []).map(p => (
              <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Carrera">
          <select value={idCarrera} onChange={e => setIdCarrera(e.target.value)}>
            <option value="">Todas las carreras</option>
            {(catalogos?.carreras || []).map(c => (
              <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Grupo">
          <select value={idGrupo} onChange={e => setIdGrupo(e.target.value)}>
            <option value="">Selecciona un grupo</option>
            {gruposFiltrados.map(g => (
              <option key={g.id_grupo} value={g.id_grupo}>
                {g.nombre_grupo} - {g.semestre}° {g.turno}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <button className="btn accent" onClick={consultar} disabled={loading} type="button">
        <Search size={16} /> Consultar kardex del grupo
      </button>

      {error && <div className="alert danger">{error}</div>}

      {grupoData && (
        <>
          <div className="row gap wrap" style={{ marginTop: '8px' }}>
            <StatCard label="Total alumnos" value={grupoData.estadisticas?.total || 0} />
            <StatCard label="Promedio grupo" value={grupoData.estadisticas?.promedioGrupo || '0.00'} />
            <StatCard label="Con rezago" value={grupoData.estadisticas?.conRezago || 0}
              variant={grupoData.estadisticas?.conRezago > 0 ? 'warning' : ''} />
          </div>

          <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
            <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#1e40af', color: '#fff' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Alumno</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Matrícula</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Semestre</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Promedio</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Créditos</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Reprobadas</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Extraord.</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estatus</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {(grupoData.alumnos || []).map((a, i) => {
                  const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                  const promedio = parseFloat(a.promedio_general) || 0;
                  const enRezago = promedio < 70 || a.materias_reprobadas > 2;
                  return (
                    <tr key={a.id_alumno} style={{ background: bg }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{a.nombre_completo}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{a.matricula}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>{a.semestre_actual}°</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600,
                        color: promedio >= 80 ? '#16a34a' : promedio >= 70 ? '#d97706' : '#dc2626' }}>
                        {promedio.toFixed(2)}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>{a.creditos_acumulados}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center',
                        color: a.materias_reprobadas > 2 ? '#dc2626' : '#64748b' }}>
                        {a.materias_reprobadas}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>{a.extraordinarios}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        <Badge variant={a.estatus_academico === 'Regular' ? 'aceptable' : 'critico'}>
                          {a.estatus_academico?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {enRezago
                          ? <Badge variant="critico">Rezago</Badge>
                          : <Badge variant="aceptable">Regular</Badge>
                        }
                      </td>
                    </tr>
                  );
                })}
                {(!grupoData.alumnos || grupoData.alumnos.length === 0) && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                    No hay alumnos activos en este grupo
                  </td></tr>
                )}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB 2: KARDEX POR ALUMNO ──
function KardexPorAlumno({ token }) {
  const [searchId, setSearchId] = React.useState('');
  const [alumnoData, setAlumnoData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const consultar = async () => {
    if (!searchId) { setError('Ingresa un ID de alumno'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexCoordinadorAlumno(token, searchId);
      setAlumnoData(r?.data ?? r);
    } catch (e) {
      setError('Error al consultar kardex del alumno');
      setAlumnoData(null);
    } finally { setLoading(false); }
  };

  const a = alumnoData?.alumno || alumnoData?.data?.alumno;
  const h = alumnoData?.historial || alumnoData?.data?.historial;
  const analisis = alumnoData?.analisis || alumnoData?.data?.analisis;

  return (
    <div className="form-stack">
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="ID del alumno">
          <input value={searchId} onChange={e => setSearchId(e.target.value)}
            placeholder="Ingresa el ID numérico del alumno" />
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading} type="button">
          <Search size={16} /> Consultar
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {alumnoData && a && (
        <>
          <div className="kardex-card" style={{ padding: '16px' }}>
            <div className="row gap" style={{ gap: '16px', flexWrap: 'wrap' }}>
              <div className="photo-box" style={{ width: '80px', height: '80px' }}>
                {a.foto_institucional ? (
                  <img src={a.foto_institucional} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                ) : (
                  <div className="avatar big" style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', borderRadius: '8px', fontSize: '28px' }}>
                    {(a.nombres || 'A').charAt(0)}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px' }}>{a.apellido_paterno} {a.apellido_materno} {a.nombres}</h3>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>
                  {a.matricula} · {a.nombre_carrera} · {a.semestre_actual}° semestre
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>
                  Folio: {a.folio_kardex || '—'} · Control: {a.numero_control || '—'}
                </p>
              </div>
            </div>
          </div>

          {analisis && (
            <>
              <div className="row gap wrap">
                <StatCard label="Promedio" value={a.promedio_general || '0.00'}
                  variant={parseFloat(a.promedio_general) < 70 ? 'danger' : parseFloat(a.promedio_general) < 80 ? 'warning' : ''} />
                <StatCard label="Créditos" value={`${analisis.creditosAcreditados || 0}/${analisis.creditosTotales || 0}`} />
                <StatCard label="Acreditadas" value={analisis.acreditadas || 0} />
                <StatCard label="No acreditadas" value={analisis.noAcreditadas || 0}
                  variant={analisis.noAcreditadas > 2 ? 'danger' : ''} />
                <StatCard label="Extraordinarios" value={analisis.extraordinarios || 0}
                  variant={analisis.extraordinarios > 1 ? 'warning' : ''} />
                <StatCard label="Avance" value={`${analisis.avanceCreditos || 0}%`}
                  variant={analisis.avanceCreditos < 50 ? 'danger' : analisis.avanceCreditos < 70 ? 'warning' : ''} />
              </div>

              {analisis.rezagoDetectado && (
                <div className="alert danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} />
                  Se ha detectado rezago académico. Revisa las validaciones para más detalles.
                </div>
              )}

              {analisis.irregularidades?.length > 0 && (
                <div className="alert warning" style={{ marginTop: '8px' }}>
                  <strong>Irregularidades detectadas:</strong>
                  <ul style={{ margin: '4px 0 0 16px', fontSize: '12px' }}>
                    {analisis.irregularidades.map((irr, i) => <li key={i}>{irr}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {h && h.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Historial académico</h4>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '4px 6px' }}>Periodo</th>
                    <th style={{ padding: '4px 6px' }}>Clave</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Materia</th>
                    <th style={{ padding: '4px 6px' }}>Calif.</th>
                    <th style={{ padding: '4px 6px' }}>Créd.</th>
                    <th style={{ padding: '4px 6px' }}>Tipo</th>
                    <th style={{ padding: '4px 6px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {h.map((r, i) => (
                    <tr key={r.id_historial || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.nombre_periodo}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontFamily: 'monospace' }}>{r.clave_materia}</td>
                      <td style={{ padding: '3px 6px' }}>{r.nombre_materia}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{r.calificacion ?? '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.creditos || r.creditos_materia || '—'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.tipo_materia}</td>
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

          {(!h || h.length === 0) && (
            <div className="empty" style={{ marginTop: '12px' }}>El alumno no registra historial académico.</div>
          )}
        </>
      )}

      {alumnoData && !a && (
        <div className="empty">No se encontraron datos del alumno.</div>
      )}
    </div>
  );
}

// ── TAB 3: RESUMEN POR PERIODO ──
function ResumenPorPeriodo({ token }) {
  const [periodos, setPeriodos] = React.useState([]);
  const [idPeriodo, setIdPeriodo] = React.useState('');
  const [resumen, setResumen] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    api.kardexCoordinadorCatalogos(token).then(r => {
      const d = r?.data ?? r;
      setPeriodos(d?.data?.periodos || []);
    }).catch(() => {});
  }, [token]);

  const consultar = async () => {
    if (!idPeriodo) { setError('Selecciona un periodo'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexCoordinadorResumenPeriodo(token, idPeriodo);
      setResumen(r?.data ?? r);
    } catch (e) {
      setError('Error al obtener resumen');
      setResumen(null);
    } finally { setLoading(false); }
  };

  const r = resumen?.data?.resumen || resumen?.resumen;
  const porCarrera = resumen?.data?.porCarrera || resumen?.porCarrera || [];

  return (
    <div className="form-stack">
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="Periodo académico">
          <select value={idPeriodo} onChange={e => setIdPeriodo(e.target.value)}>
            <option value="">Selecciona un periodo</option>
            {periodos.map(p => (
              <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
            ))}
          </select>
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading} type="button">
          <BarChart3 size={16} /> Generar resumen
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {resumen && r && (
        <>
          <div className="row gap wrap">
            <StatCard label="Total alumnos" value={r.total_alumnos || 0} />
            <StatCard label="Promedio general" value={r.promedio_general || '0.00'} />
            <StatCard label="Créditos totales" value={r.creditos_totales || 0} />
            <StatCard label="Prom. créditos" value={r.promedio_creditos || '0.0'} />
            <StatCard label="Regulares" value={r.regulares || 0} variant="aceptable" />
            <StatCard label="Irregulares" value={r.irregulares || 0}
              variant={r.irregulares > 0 ? 'warning' : ''} />
            <StatCard label="En rezago" value={r.rezago || 0}
              variant={r.rezago > 0 ? 'danger' : ''} />
            <StatCard label="Excelencia" value={r.excelencia || 0} variant="aceptable" />
          </div>

          {porCarrera.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Desglose por carrera</h4>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Carrera</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Alumnos</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Promedio</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Rezago</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>% Rezago</th>
                  </tr>
                </thead>
                <tbody>
                  {porCarrera.map((c, i) => (
                    <tr key={c.id_carrera} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{c.nombre_carrera}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>{c.total_alumnos}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600,
                        color: parseFloat(c.promedio) >= 80 ? '#16a34a' : parseFloat(c.promedio) >= 70 ? '#d97706' : '#dc2626' }}>
                        {c.promedio}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center',
                        color: c.rezago > 0 ? '#dc2626' : '#64748b' }}>
                        {c.rezago}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {c.total_alumnos > 0 ? Math.round((c.rezago / c.total_alumnos) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}

      {resumen && !r && (
        <div className="empty">No hay datos disponibles para este periodo.</div>
      )}
    </div>
  );
}

// ── TAB 4: HISTORIAL POR CARRERA ──
function HistorialPorCarrera({ token }) {
  const [carreras, setCarreras] = React.useState([]);
  const [idCarrera, setIdCarrera] = React.useState('');
  const [historial, setHistorial] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    api.kardexCoordinadorCatalogos(token).then(r => {
      const d = r?.data ?? r;
      setCarreras(d?.data?.carreras || []);
    }).catch(() => {});
  }, [token]);

  const consultar = async () => {
    if (!idCarrera) { setError('Selecciona una carrera'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexCoordinadorHistorialCarrera(token, idCarrera);
      setHistorial(r?.data ?? r);
    } catch (e) {
      setError('Error al obtener historial');
      setHistorial(null);
    } finally { setLoading(false); }
  };

  const porPeriodo = historial?.data?.porPeriodo || historial?.porPeriodo || [];
  const tendencia = historial?.data?.tendenciaSemestral || historial?.tendenciaSemestral || [];
  const alumnosRezago = historial?.data?.alumnosRezago || historial?.alumnosRezago || [];

  return (
    <div className="form-stack">
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
        <FormField label="Carrera">
          <select value={idCarrera} onChange={e => setIdCarrera(e.target.value)}>
            <option value="">Selecciona una carrera</option>
            {carreras.map(c => (
              <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
            ))}
          </select>
        </FormField>
        <button className="btn accent" onClick={consultar} disabled={loading} type="button">
          <TrendingUp size={16} /> Ver historial
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      {historial && (
        <>
          {porPeriodo.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Tendencia por periodo</h4>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '5px 6px', textAlign: 'left' }}>Periodo</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Alumnos</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Promedio</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Rezago</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Excelencia</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>% Rezago</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Prom. Créditos</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Total Créditos</th>
                  </tr>
                </thead>
                <tbody>
                  {porPeriodo.map((p, i) => {
                    const pctRezago = p.alumnos_activos > 0 ? ((p.rezago / p.alumnos_activos) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={p.id_periodo} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>{p.nombre_periodo}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{p.alumnos_activos}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600,
                          color: parseFloat(p.promedio_carrera) >= 80 ? '#16a34a' : parseFloat(p.promedio_carrera) >= 70 ? '#d97706' : '#dc2626' }}>
                          {p.promedio_carrera}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: p.rezago > 0 ? '#dc2626' : '#64748b' }}>{p.rezago}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: '#16a34a' }}>{p.excelencia}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: parseFloat(pctRezago) > 15 ? '#dc2626' : '#64748b' }}>{pctRezago}%</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{p.promedio_creditos}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{p.creditos_totales}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}

          {tendencia.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Distribución por semestre</h4>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '5px 6px' }}>Semestre</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Alumnos</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Promedio</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Rezago</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>% Rezago</th>
                  </tr>
                </thead>
                <tbody>
                  {tendencia.map((t, i) => {
                    const pctRezago = t.total_alumnos > 0 ? ((t.rezago / t.total_alumnos) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={t.semestre_actual} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>{t.semestre_actual}°</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.total_alumnos}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{t.promedio_semestre}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: t.rezago > 0 ? '#dc2626' : '#64748b' }}>{t.rezago}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', color: parseFloat(pctRezago) > 15 ? '#dc2626' : '#64748b' }}>{pctRezago}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}

          {alumnosRezago.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#dc2626' }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Alumnos en situación de rezago
              </h4>
              <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#991b1b', color: '#fff' }}>
                    <th style={{ padding: '5px 6px', textAlign: 'left' }}>Alumno</th>
                    <th style={{ padding: '5px 6px' }}>Matrícula</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Semestre</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Promedio</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Reprobadas</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnosRezago.map((a, i) => (
                    <tr key={a.id_alumno} style={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{a.nombre_completo}</td>
                      <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{a.matricula}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{a.semestre_actual}°</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>{a.promedio_general}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: '#dc2626' }}>{a.materias_reprobadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {porPeriodo.length === 0 && tendencia.length === 0 && (
            <div className="empty">No hay datos históricos disponibles para esta carrera.</div>
          )}
        </>
      )}

      {!historial && !loading && (
        <div className="empty">Selecciona una carrera y haz clic en "Ver historial".</div>
      )}
    </div>
  );
}

// ── TAB 5: VALIDACIÓN DE TRAYECTORIAS ──
function ValidacionTrayectorias({ token }) {
  const [searchId, setSearchId] = React.useState('');
  const [validacion, setValidacion] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [diagRezago, setDiagRezago] = React.useState(null);
  const [diagIrreg, setDiagIrreg] = React.useState(null);
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = React.useState('');
  const [filtroCarrera, setFiltroCarrera] = React.useState('');
  const [catalogos, setCatalogos] = React.useState(null);

  React.useEffect(() => {
    api.kardexCoordinadorCatalogos(token).then(r => {
      const d = r?.data ?? r;
      setCatalogos(d?.data ?? d);
    }).catch(() => {});
  }, [token]);

  const validarAlumno = async () => {
    if (!searchId) { setError('Ingresa un ID de alumno'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.kardexCoordinadorValidarTrayectoria(token, searchId);
      setValidacion(r?.data ?? r);
    } catch (e) {
      setError('Error al validar trayectoria');
      setValidacion(null);
    } finally { setLoading(false); }
  };

  const cargarDiagnosticos = async () => {
    setDiagLoading(true);
    try {
      const params = {};
      if (filtroPeriodo) params.idPeriodo = filtroPeriodo;
      if (filtroCarrera) params.idCarrera = filtroCarrera;
      const [rz, ir] = await Promise.all([
        api.kardexCoordinadorDiagnosticoRezago(token, params),
        api.kardexCoordinadorDiagnosticoIrregularidades(token, params)
      ]);
      setDiagRezago(rz?.data ?? rz);
      setDiagIrreg(ir?.data ?? ir);
    } catch (e) {
      setError('Error al cargar diagnósticos');
    } finally { setDiagLoading(false); }
  };

  const valData = validacion?.data || validacion;
  const v = valData?.validaciones || [];
  const nivel = valData?.nivelRiesgo || '';
  const diagR = diagRezago?.data || diagRezago;
  const diagI = diagIrreg?.data || diagIrreg;

  return (
    <div className="form-stack">

      {/* Validación individual */}
      <SectionCard title="Validación individual" subtitle="Ingresa el ID del alumno para validar su trayectoria académica">
        <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
          <FormField label="ID del alumno">
            <input value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="ID numérico del alumno" />
          </FormField>
          <button className="btn accent" onClick={validarAlumno} disabled={loading} type="button">
            <ShieldCheck size={16} /> Validar trayectoria
          </button>
        </div>

        {error && <div className="alert danger" style={{ marginTop: '8px' }}>{error}</div>}

        {valData && valData.alumno && (
          <>
            <div className="kardex-card" style={{ padding: '12px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ margin: 0 }}>
                    {valData.alumno.apellido_paterno} {valData.alumno.apellido_materno} {valData.alumno.nombres}
                  </h4>
                  <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
                    {valData.alumno.matricula} · {valData.alumno.nombre_carrera} · {valData.alumno.semestre_actual}° semestre
                  </p>
                </div>
                <div>
                  {nivel === 'Crítico' && <Badge variant="critico">Riesgo crítico</Badge>}
                  {nivel === 'Precaución' && <Badge variant="riesgo">Precaución</Badge>}
                  {nivel === 'Aceptable' && <Badge variant="aceptable">Aceptable</Badge>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              {v.map((val, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', marginBottom: '4px', borderRadius: '6px',
                  background: val.tipo === 'critico' ? '#fef2f2' : val.tipo === 'precaucion' ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${
                    val.tipo === 'critico' ? '#fecaca' : val.tipo === 'precaucion' ? '#fde68a' : '#bbf7d0'
                  }`
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{val.indicador}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{val.detalle}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{val.valor}</div>
                    <div style={{ fontSize: '10px' }}>
                      <Badge variant={val.tipo === 'critico' ? 'critico' : val.tipo === 'precaucion' ? 'riesgo' : 'aceptable'}>
                        {val.resultado}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {valData && !valData.alumno && (
          <div className="empty" style={{ marginTop: '8px' }}>No se encontraron datos del alumno.</div>
        )}
      </SectionCard>

      {/* Diagnósticos generales */}
      <SectionCard title="Diagnósticos generales" subtitle="Identifica rezago e irregularidades académicas" style={{ marginTop: '16px' }}>
        <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <FormField label="Periodo (opcional)">
            <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
              <option value="">Todos los periodos</option>
              {(catalogos?.periodos || []).map(p => (
                <option key={p.id_periodo} value={p.id_periodo}>{p.nombre_periodo}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Carrera (opcional)">
            <select value={filtroCarrera} onChange={e => setFiltroCarrera(e.target.value)}>
              <option value="">Todas las carreras</option>
              {(catalogos?.carreras || []).map(c => (
                <option key={c.id_carrera} value={c.id_carrera}>{c.nombre_carrera}</option>
              ))}
            </select>
          </FormField>
          <button className="btn accent" onClick={cargarDiagnosticos} disabled={diagLoading} type="button" style={{ marginBottom: '2px' }}>
            <AlertTriangle size={16} /> Generar diagnósticos
          </button>
        </div>

        {diagR && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', margin: '0 0 8px', color: '#dc2626' }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Diagnóstico de rezago académico
            </h4>
            <div className="row gap wrap" style={{ marginBottom: '8px' }}>
              <StatCard label="Total alumnos activos" value={diagR.totalAlumnos || 0} />
              <StatCard label="Con rezago" value={diagR.totalConRezago || 0} variant="danger" />
              <StatCard label="% Rezago" value={`${diagR.porcentajeRezago || 0}%`}
                variant={diagR.porcentajeRezago > 15 ? 'danger' : diagR.porcentajeRezago > 5 ? 'warning' : ''} />
              <StatCard label="Promedio rezago" value={diagR.promedioRezago || '0.00'} variant="danger" />
            </div>

            {diagR.alumnos?.length > 0 && (
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#991b1b', color: '#fff' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Alumno</th>
                      <th style={{ padding: '4px 6px' }}>Matrícula</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Semestre</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Carrera</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Promedio</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Créditos</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Reprobadas</th>
                      <th style={{ padding: '4px 6px', textAlign: 'center' }}>Extra. Reprobados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(diagR.alumnos || []).map((a, i) => (
                      <tr key={a.id_alumno} style={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                        <td style={{ padding: '3px 6px', fontWeight: 600 }}>{a.nombre_completo}</td>
                        <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{a.matricula}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center' }}>{a.semestre_actual}°</td>
                        <td style={{ padding: '3px 6px', fontSize: '9px' }}>{a.nombre_carrera}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>{a.promedio_general}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center' }}>{a.creditos_acumulados}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', color: '#dc2626' }}>{a.materias_reprobadas}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center' }}>{a.extraordinarios_reprobados || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>
        )}

        {diagI && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', margin: '0 0 8px', color: '#d97706' }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Irregularidades académicas detectadas
            </h4>

            <div className="row gap wrap" style={{ marginBottom: '8px' }}>
              <StatCard label="Total incidencias" value={diagI.total || 0}
                variant={diagI.total > 0 ? 'warning' : ''} />
            </div>

            {(diagI.agrupadas || []).map((g, gi) => (
              <div key={gi} style={{ marginBottom: '8px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: '4px', marginBottom: '4px',
                  background: '#f8fafc', border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{g.tipo}</span>
                  <Badge variant={g.tipo.includes('crítico') || g.tipo.includes('Exceso') || g.tipo.includes('Irregular') ? 'critico' : 'riesgo'}>
                    {g.count} alumno(s)
                  </Badge>
                </div>
              </div>
            ))}

            {diagI.total === 0 && (
              <div className="empty">No se detectaron irregularidades académicas.</div>
            )}
          </div>
        )}

        {!diagR && !diagI && !diagLoading && (
          <div className="empty" style={{ marginTop: '8px' }}>
            Selecciona los filtros y haz clic en "Generar diagnósticos".
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── MAIN PAGE ──
export default function CoordinadorKardexPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = React.useState('grupo');

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 4px' }}>Gestión académica · Kardex</h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
          Consulta, análisis y seguimiento de trayectorias académicas. 
          Permisos: consulta amplia por grupo, carrera y periodo.
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

      {activeTab === 'grupo' && <KardexPorGrupo token={token} />}
      {activeTab === 'alumno' && <KardexPorAlumno token={token} />}
      {activeTab === 'resumen' && <ResumenPorPeriodo token={token} />}
      {activeTab === 'historial' && <HistorialPorCarrera token={token} />}
      {activeTab === 'validacion' && <ValidacionTrayectorias token={token} />}
    </div>
  );
}
