import React from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Save,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  CheckCheck,
  ListChecks,
  History,
  BarChart3,
  Eye,
  X,
  ChevronRight
} from 'lucide-react';

const STUDENT_TABS = [
  { key: 'asignadas', label: 'Evaluaciones asignadas', icon: ClipboardList },
  { key: 'respondidas', label: 'Historial de respuestas', icon: History },
  { key: 'estado', label: 'Estado de envío', icon: BarChart3 }
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeArray(payload, keys = ['data', 'items', 'evaluaciones', 'respondidas']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function statusColor(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return '#059669';
  if (s.includes('CERR') || s.includes('FIN')) return '#2563eb';
  if (s.includes('CANC')) return '#e11d48';
  if (s.includes('BORR')) return '#d97706';
  return '#64748b';
}

function statusBg(status) {
  const s = normalize(status);
  if (s.includes('ACTIV')) return 'rgba(16,185,129,0.10)';
  if (s.includes('CERR') || s.includes('FIN')) return 'rgba(37,99,235,0.10)';
  if (s.includes('CANC')) return 'rgba(225,29,72,0.10)';
  if (s.includes('BORR')) return 'rgba(217,119,6,0.10)';
  return 'rgba(100,116,139,0.10)';
}

function renderStatusBadge(status) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, background: statusBg(status), color: statusColor(status) }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(status), display: 'inline-block' }} />
      {status}
    </span>
  );
}

const INSTRUMENT_LABELS = {
  'DOCENTE_POR_ALUMNOS': 'Docente por alumnos',
  'ALUMNO_POR_DOCENTES': 'Alumno por docentes',
  'POR_GRUPO': 'Por grupo',
  'POR_PERIODO': 'Por periodo',
  'POR_MATERIA': 'Por materia'
};

export default function EstudianteEvaluacionesPage() {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = React.useState('asignadas');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [asignadas, setAsignadas] = React.useState([]);
  const [respondidas, setRespondidas] = React.useState([]);
  const [estadoEnvio, setEstadoEnvio] = React.useState(null);
  const [preguntasActuales, setPreguntasActuales] = React.useState(null);
  const [respuestas, setRespuestas] = React.useState({});

  const [evaluacionActiva, setEvaluacionActiva] = React.useState(null);
  const [mostrarInstrucciones, setMostrarInstrucciones] = React.useState(false);
  const [respondiendo, setRespondiendo] = React.useState(false);
  const [confirmacionEnvio, setConfirmacionEnvio] = React.useState(null);
  const [guardando, setGuardando] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);

  const cargarAsignadas = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.misEvaluaciones(token);
      setAsignadas(safeArray(res, ['data', 'evaluaciones']));
    } catch (err) {
      console.error(err);
      setAsignadas([]);
    }
  }, [token]);

  const cargarRespondidas = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.evaluacionesRespondidas(token);
      setRespondidas(safeArray(res, ['data', 'respondidas']));
    } catch (err) {
      console.error(err);
      setRespondidas([]);
    }
  }, [token]);

  const cargarEstadoEnvio = React.useCallback(async (idEvaluacion) => {
    if (!token) return;
    try {
      const res = await api.estadoEnvioEvaluacion(token, idEvaluacion);
      setEstadoEnvio(res?.data || null);
    } catch (err) {
      console.error(err);
      setEstadoEnvio(null);
    }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([cargarAsignadas(), cargarRespondidas()]);
    setLoading(false);
  }, [cargarAsignadas, cargarRespondidas]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const iniciarEvaluacion = async (ev) => {
    try {
      setError('');
      const res = await api.preguntasEvaluacionAlumno(token, ev.id_evaluacion);
      const data = res?.data || res || {};
      if (!data.preguntas || !data.preguntas.length) {
        setError('Esta evaluación no tiene preguntas registradas.');
        return;
      }
      setEvaluacionActiva(data.evaluacion || ev);
      setPreguntasActuales(data.preguntas);
      const respIniciales = {};
      data.preguntas.forEach(p => {
        respIniciales[p.id_pregunta] = p.valor_numero !== null ? String(p.valor_numero) : (p.valor_texto || '');
      });
      setRespuestas(respIniciales);
      setMostrarInstrucciones(true);
    } catch (err) {
      setError(err?.message || 'Error al cargar la evaluación');
    }
  };

  const cerrarEvaluacion = () => {
    setEvaluacionActiva(null);
    setPreguntasActuales(null);
    setRespuestas({});
    setMostrarInstrucciones(false);
    setRespondiendo(false);
    setConfirmacionEnvio(null);
  };

  const handleRespuestaChange = (idPregunta, value) => {
    setRespuestas(prev => ({ ...prev, [idPregunta]: value }));
  };

  const guardarAvance = async () => {
    if (!evaluacionActiva) return;
    setGuardando(true);
    setError('');
    try {
      const respuestasArray = Object.entries(respuestas).map(([idPregunta, value]) => {
        const pregunta = preguntasActuales.find(p => p.id_pregunta === Number(idPregunta));
        const isText = normalize(pregunta?.tipo_respuesta) === 'TEXTO';
        return {
          id_pregunta: Number(idPregunta),
          valor_numero: isText ? null : (value === '' ? null : Number(value)),
          valor_texto: isText ? value : null
        };
      }).filter(r => r.valor_numero !== null || r.valor_texto);
      await api.guardarAvanceEvaluacion(token, evaluacionActiva.id_evaluacion, respuestasArray);
      setMessage('Avance guardado correctamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err?.message || 'Error al guardar avance');
    } finally {
      setGuardando(false);
    }
  };

  const enviarRespuestas = async () => {
    if (!evaluacionActiva) return;
    setEnviando(true);
    setError('');
    try {
      await guardarAvance();
      const res = await api.enviarEvaluacion(token, evaluacionActiva.id_evaluacion);
      setConfirmacionEnvio(res?.message || 'Tus respuestas han sido enviadas correctamente.');
      setRespondiendo(false);
      await Promise.all([cargarAsignadas(), cargarRespondidas()]);
    } catch (err) {
      setError(err?.message || 'Error al enviar respuestas');
    } finally {
      setEnviando(false);
    }
  };

  const completadasCount = asignadas.filter(a => Number(a.mis_respuestas) > 0).length;
  const pendientesCount = asignadas.length - completadasCount;

  const preguntasRespondidas = preguntasActuales?.filter(p => {
    const v = respuestas[p.id_pregunta];
    return v !== undefined && v !== '' && v !== null;
  }).length || 0;

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <BookOpen size={14} /> Evaluaciones | Alumno
          </div>
          <h1>Mis evaluaciones</h1>
          <p>Participa en las evaluaciones institucionales, consulta tu historial y verifica el estado de tus envíos.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Pendientes</small>
            <strong>{pendientesCount}</strong>
          </div>
          <div className="meta-card">
            <small>Completadas</small>
            <strong>{completadasCount}</strong>
          </div>
        </div>
      </section>

      {!evaluacionActiva && (
        <>
          <div className="eval-tabs" style={{ display: 'flex', gap: 4, overflow: 'auto', padding: '0 0 1rem' }}>
            {STUDENT_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setError(''); setMessage(''); }}
                  className={`eval-tab ${activeTab === tab.key ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} /> Cargando evaluaciones...
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {activeTab === 'asignadas' && !loading && (
            <SectionCard title="Evaluaciones asignadas" subtitle="Instrumentos disponibles para tu participación"
              right={
                <button type="button" className="btn secondary" onClick={loadAll} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <RefreshCw size={14} /> Actualizar
                </button>
              }>
              {asignadas.length === 0 ? (
                <div className="empty">
                  <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                  No tienes evaluaciones pendientes por responder.
                </div>
              ) : (
                <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
                  {asignadas.map(ev => (
                    <div key={ev.id_evaluacion} className="list-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{ev.titulo}</strong>
                          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {ev.nombre_periodo && <small className="muted">{ev.nombre_periodo}</small>}
                            {renderStatusBadge(ev.estado)}
                            <small className="muted">{ev.tipo_instrumento ? (INSTRUMENT_LABELS[normalize(ev.tipo_instrumento)] || ev.tipo_instrumento) : ''}</small>
                          </span>
                          {ev.descripcion && <small className="muted">{ev.descripcion}</small>}
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                            <small className="muted">Preguntas: <strong>{ev.total_preguntas || 0}</strong></small>
                            {ev.fecha_fin && <small className="muted">Cierre: {new Date(ev.fecha_fin).toLocaleDateString()}</small>}
                          </div>
                          {Number(ev.mis_respuestas) > 0 && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <small style={{ color: '#059669' }}>
                                <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                                {ev.mis_respuestas}/{ev.total_preguntas} respondidas
                              </small>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexDirection: 'column' }}>
                          <button className="btn-sm btn-edit" onClick={() => iniciarEvaluacion(ev)} style={{ width: '100%' }}>
                            {Number(ev.mis_respuestas) > 0 ? 'Continuar' : 'Responder'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'respondidas' && !loading && (
            <SectionCard title="Historial de respuestas" subtitle="Evaluaciones que has respondido"
              right={
                <button type="button" className="btn secondary" onClick={cargarRespondidas} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <RefreshCw size={14} /> Actualizar
                </button>
              }>
              {respondidas.length === 0 ? (
                <div className="empty">
                  <History size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                  Aún no has respondido ninguna evaluación.
                </div>
              ) : (
                <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
                  {respondidas.map(ev => (
                    <div key={ev.id_evaluacion} className="list-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{ev.titulo}</strong>
                          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {ev.nombre_periodo && <small className="muted">{ev.nombre_periodo}</small>}
                            {renderStatusBadge(ev.estado)}
                          </span>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                            <small className="muted">Respondidas: <strong>{ev.mis_respuestas || 0}/{ev.total_preguntas || 0}</strong></small>
                            {ev.completada ? (
                              <small style={{ color: '#059669' }}><CheckCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Completa</small>
                            ) : (
                              <small style={{ color: '#d97706' }}><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Parcial</small>
                            )}
                          </div>
                          {ev.ultima_respuesta && (
                            <small className="muted">Última respuesta: {new Date(ev.ultima_respuesta).toLocaleString()}</small>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          {normalize(ev.estado) === 'ACTIVA' && !ev.completada && (
                            <button className="btn-sm btn-edit" onClick={() => iniciarEvaluacion(ev)}>Continuar</button>
                          )}
                          <button className="btn-sm" style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.22)' }}
                            onClick={async () => {
                              try {
                                const res = await api.estadoEnvioEvaluacion(token, ev.id_evaluacion);
                                setEstadoEnvio(res?.data || null);
                                setActiveTab('estado');
                              } catch (err) { console.error(err); }
                            }}>
                            <Eye size={14} /> Ver
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'estado' && !loading && (
            <SectionCard title="Estado de envío" subtitle="Detalle del avance por evaluación"
              right={
                !estadoEnvio ? null : (
                  <button type="button" className="btn secondary" onClick={() => setEstadoEnvio(null)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                    <ArrowLeft size={14} /> Volver
                  </button>
                )
              }>
              {!estadoEnvio ? (
                <div className="list" style={{ maxHeight: 600, overflow: 'auto' }}>
                  {respondidas.length === 0 ? (
                    <div className="empty">No hay evaluaciones respondidas. Selecciona una desde el historial.</div>
                  ) : (
                    respondidas.map(ev => (
                      <div key={ev.id_evaluacion} className="list-item" style={{ cursor: 'pointer' }}
                        onClick={async () => {
                          try {
                            const res = await api.estadoEnvioEvaluacion(token, ev.id_evaluacion);
                            setEstadoEnvio(res?.data || null);
                          } catch (err) { console.error(err); }
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{ev.titulo}</strong>
                            <small className="muted">{ev.nombre_periodo}</small>
                          </div>
                          <ChevronRight size={16} className="muted" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  <div className="stats-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <StatCard icon={ListChecks} label="Preguntas" value={estadoEnvio.total_preguntas || 0} hint="Totales" />
                    <StatCard icon={CheckCircle2} label="Respondidas" value={estadoEnvio.respondidas || 0} hint="Completadas" />
                    <StatCard icon={estadoEnvio.completada ? CheckCheck : Clock} label="Estado" value={estadoEnvio.completada ? 'Completo' : 'Parcial'} hint={estadoEnvio.completada ? 'Enviado' : 'Pendiente'} />
                  </div>
                  {estadoEnvio.preguntas && estadoEnvio.preguntas.length > 0 && (
                    <div className="list" style={{ maxHeight: 400, overflow: 'auto' }}>
                      <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Detalle por pregunta</div>
                      {estadoEnvio.preguntas.map(p => (
                        <div key={p.id_pregunta} className="list-item" style={{ padding: '0.75rem', borderLeft: `4px solid ${p.id_respuesta ? '#059669' : '#e11d48'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: '0.85rem' }}>{p.orden_pregunta}. {p.criterio}</strong>
                              {p.descripcion && <small className="muted">{p.descripcion}</small>}
                              <small className="muted" style={{ display: 'block' }}>
                                Tipo: {p.tipo_respuesta} | Peso: {p.peso ?? 0}
                              </small>
                              {p.id_respuesta && (
                                <small style={{ color: '#059669', display: 'block' }}>
                                  Respuesta: {p.valor_numero !== null ? p.valor_numero : p.valor_texto || '—'}
                                  {p.respondido_en ? ` (${new Date(p.respondido_en).toLocaleString()})` : ''}
                                </small>
                              )}
                            </div>
                            {p.id_respuesta ? (
                              <CheckCircle2 size={16} color="#059669" />
                            ) : (
                              <AlertCircle size={16} color="#e11d48" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}

      {mostrarInstrucciones && evaluacionActiva && !respondiendo && (
        <div className="modal-backdrop" onClick={() => {}}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <div>
                <div className="badge light" style={{ marginBottom: '0.75rem' }}>
                  <HelpCircle size={14} /> Instrucciones
                </div>
                <h3>{evaluacionActiva.titulo}</h3>
                <p style={{ marginTop: '0.5rem' }}>
                  Lee atentamente las siguientes instrucciones antes de comenzar.
                </p>
              </div>
            </div>
            <div style={{ margin: '1rem 0', padding: '1rem', borderRadius: 18, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <p style={{ lineHeight: 1.7, margin: 0, fontSize: '0.95rem' }}>
                {evaluacionActiva.instrucciones || 'Responde cada una de las preguntas según la escala indicada. Puedes guardar tu avance y continuar después. Una vez que hayas respondido todas las preguntas, podrás enviar tus respuestas. El envío es definitivo.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[
                { icon: FileText, text: `${preguntasActuales?.length || 0} preguntas` },
                { icon: Clock, text: evaluacionActiva.fecha_fin ? `Cierre: ${new Date(evaluacionActiva.fecha_fin).toLocaleDateString()}` : 'Sin fecha límite' },
                { icon: Save, text: 'Puedes guardar avance' }
              ].map((item, i) => (
                <div key={i} className="badge light" style={{ fontSize: '0.82rem' }}>
                  <item.icon size={14} /> {item.text}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={cerrarEvaluacion}>
                <X size={16} /> Cancelar
              </button>
              <button type="button" className="btn primary" onClick={() => { setMostrarInstrucciones(false); setRespondiendo(true); }}>
                <CheckCircle2 size={16} /> Comenzar evaluación
              </button>
            </div>
          </div>
        </div>
      )}

      {respondiendo && preguntasActuales && evaluacionActiva && (
        <div>
          <SectionCard title={evaluacionActiva.titulo}
            subtitle={`Pregunta ${preguntasRespondidas} de ${preguntasActuales.length}`}
            right={
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn secondary" onClick={cerrarEvaluacion} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <X size={14} /> Salir
                </button>
              </div>
            }>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.2)', marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ width: `${preguntasActuales.length ? (preguntasRespondidas / preguntasActuales.length) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)', borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>

            {error && <div className="alert error" style={{ marginBottom: '1rem' }}>{error}</div>}
            {message && <div className="alert success" style={{ marginBottom: '1rem' }}>{message}</div>}

            <div className="list" style={{ maxHeight: 500, overflow: 'auto' }}>
              {preguntasActuales.map((p, idx) => {
                const isText = normalize(p.tipo_respuesta) === 'TEXTO';
                const valorActual = respuestas[p.id_pregunta] || '';
                return (
                  <div key={p.id_pregunta} className="list-item" style={{ borderLeft: `4px solid ${valorActual !== '' && valorActual !== null ? '#059669' : 'rgba(148,163,184,0.3)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.9rem' }}>{p.orden_pregunta || idx + 1}. {p.criterio}</strong>
                        {p.descripcion && <small className="muted" style={{ display: 'block', marginBottom: '0.5rem' }}>{p.descripcion}</small>}
                        {isText ? (
                          <textarea
                            rows={3}
                            placeholder="Escribe tu respuesta..."
                            value={valorActual || ''}
                            onChange={e => handleRespuestaChange(p.id_pregunta, e.target.value)}
                            style={{ marginTop: '0.35rem', width: '100%', padding: '0.75rem', borderRadius: 12, border: '1px solid var(--line)' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                            {[...Array(6)].map((_, i) => {
                              const val = i === 0 ? 0 : i;
                              const scale = [0, 1, 2, 3, 4, 5];
                              const label = i === 0 ? 'N/A' : String(i);
                              return (
                                <button key={i} type="button"
                                  onClick={() => handleRespuestaChange(p.id_pregunta, String(val))}
                                  style={{
                                    minWidth: 44, height: 44, borderRadius: 12, border: '1px solid var(--line)',
                                    background: Number(valorActual) === val ? 'linear-gradient(90deg, #2563eb, #4f46e5)' : 'rgba(255,255,255,0.6)',
                                    color: Number(valorActual) === val ? '#fff' : 'var(--text)',
                                    fontWeight: Number(valorActual) === val ? 800 : 600,
                                    transition: '0.2s ease'
                                  }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {valorActual !== '' && valorActual !== null && (
                        <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn secondary" onClick={guardarAvance} disabled={guardando}>
                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar avance'}
              </button>
              <button type="button" className="btn primary" onClick={enviarRespuestas} disabled={enviando || preguntasRespondidas < preguntasActuales.length}
                style={{ opacity: preguntasRespondidas < preguntasActuales.length ? 0.5 : 1 }}>
                <Send size={16} /> {enviando ? 'Enviando...' : `Enviar respuestas (${preguntasRespondidas}/${preguntasActuales.length})`}
              </button>
            </div>
            {preguntasRespondidas < preguntasActuales.length && (
              <small className="muted" style={{ display: 'block', textAlign: 'right', marginTop: '0.5rem' }}>
                <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                Debes responder todas las preguntas antes de enviar.
              </small>
            )}
          </SectionCard>
        </div>
      )}

      {confirmacionEnvio && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 500, textAlign: 'center' }}>
            <div style={{ margin: '1rem auto', width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'grid', placeItems: 'center' }}>
              <CheckCheck size={32} color="#059669" />
            </div>
            <h3 style={{ margin: '1rem 0 0.5rem' }}>Participación confirmada</h3>
            <p style={{ lineHeight: 1.7, color: 'var(--muted)' }}>{confirmacionEnvio}</p>
            <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: 18, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <small className="muted">
                Tus respuestas han sido registradas en el sistema. Puedes consultar tu historial en cualquier momento.
              </small>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn primary" onClick={cerrarEvaluacion}>
                <ListChecks size={16} /> Ir a mis evaluaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
