import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import {
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Sparkles,
  ShieldCheck,
  Target
} from 'lucide-react';
import '../styles/global.css';

const PORTAL_OFICIAL_URL = 'https://secti.edomex.gob.mx/becas';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function safeArray(payload, keys = ['data', 'items', 'results', 'fuentes']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function safeObject(payload, keys = ['data', 'catalogos', 'resumen']) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of keys) {
      if (payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
        return payload[key];
      }
    }
    return payload;
  }
  return {};
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function statusLabel(value) {
  const key = normalize(value);
  if (key === '1' || key === 'ACTIVO' || key === 'ACTIVA') return 'Activa';
  return String(value || 'Sin estatus');
}

function getSourceUrl(item) {
  return item?.url_origen || item?.url || item?.link || item?.fuente_url || '';
}

function getSourceTitle(item) {
  return item?.titulo || item?.codigo_fuente || item?.nombre || 'Fuente oficial';
}

function getAnswerText(respuesta) {
  return (
    respuesta?.respuesta ||
    respuesta?.data?.respuesta ||
    respuesta?.message ||
    'Sin respuesta.'
  );
}

export default function IABecasPage() {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();

  const [catalogos, setCatalogos] = React.useState({
    plantillas: [],
    preguntas: [],
    recursos: []
  });
  const [resumen, setResumen] = React.useState({
    total_fuentes: 0,
    fuentes_activas: 0,
    total_chunks: 0
  });
  const [mensaje, setMensaje] = React.useState('');
  const [respuesta, setRespuesta] = React.useState(null);
  const [notification, setNotification] = React.useState(null);
  const [elegibilidad, setElegibilidad] = React.useState(null);
  const [promedio, setPromedio] = React.useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = React.useState(false);
  const [loadingResumen, setLoadingResumen] = React.useState(false);
  const [loadingAsk, setLoadingAsk] = React.useState(false);
  const [loadingEligibility, setLoadingEligibility] = React.useState(false);

  const fullName = React.useMemo(() => {
    return (
      `${user?.nombres || ''} ${user?.apellido_paterno || ''} ${user?.apellido_materno || ''}`
        .replace(/\s+/g, ' ')
        .trim() || user?.nombre_completo || 'Usuario'
    );
  }, [user]);

  const loadCatalogos = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoadingCatalogos(true);
      const response = await api.iaBecasCatalogos(token);
      const data = safeObject(response, ['catalogos', 'data']);
      setCatalogos({
        plantillas: safeArray(data?.plantillas, ['plantillas', 'items', 'results']),
        preguntas: safeArray(data?.preguntas, ['preguntas', 'items', 'results']),
        recursos: safeArray(data?.recursos, ['recursos', 'items', 'results', 'fuentes'])
      });

      if (response?.notification || response?.notificacion) {
        setNotification(response.notification || response.notificacion);
      }
    } catch (error) {
      console.error('Error al cargar catálogos de becas:', error);
      setCatalogos({ plantillas: [], preguntas: [], recursos: [] });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [token]);

  const loadResumen = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoadingResumen(true);
      const response = await api.iaBecasResumen(token);
      setResumen(safeObject(response, ['data', 'resumen']));

      if (response?.notification || response?.notificacion) {
        setNotification(response.notification || response.notificacion);
      }
    } catch (error) {
      console.error('Error al cargar resumen de becas:', error);
      setResumen({ total_fuentes: 0, fuentes_activas: 0, total_chunks: 0 });
    } finally {
      setLoadingResumen(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (!authLoading && token) {
      loadCatalogos();
      loadResumen();
    }
  }, [authLoading, token, loadCatalogos, loadResumen]);

  const handleAsk = async (e) => {
    e.preventDefault();
    const pregunta = mensaje.trim();
    if (!pregunta) return;

    try {
      setLoadingAsk(true);
      setRespuesta(null);

      const response = await api.iaBecasPreguntar(token, { mensaje: pregunta });
      setRespuesta(response || null);
      setNotification(response?.notification || response?.notificacion || null);
    } catch (error) {
      console.error('Error en consulta de becas:', error);
      setRespuesta({
        ok: false,
        respuesta: error?.message || 'No fue posible procesar la consulta.',
        fuentes: [],
        data: { fuentes: [] }
      });
      setNotification({
        title: 'Consulta oficial de becas',
        message: 'No fue posible consultar la IA en este momento. Puedes revisar el portal oficial de becas mientras se restablece el servicio.',
        actionLabel: 'Abrir portal oficial',
        actionUrl: PORTAL_OFICIAL_URL,
        variant: 'info'
      });
    } finally {
      setLoadingAsk(false);
    }
  };

  const handleEligibility = async () => {
  try {
    setLoadingEligibility(true);

    const payload = {
      mensaje,
      id_usuario: user?.id_usuario,
      id_alumno: user?.id_alumno,
      matricula: user?.matricula,
      correo: user?.correo || user?.correo_institucional
    };

    const [eligResp, avgResp] = await Promise.all([
      api.iaBecasElegibilidad(token, payload),
      api.iaBecasPromedio(token, payload)
    ]);

    setElegibilidad(eligResp?.data || eligResp || null);
    setPromedio(avgResp?.data || avgResp || null);
  } catch (error) {
    console.error('Error al calcular elegibilidad:', error);
    setElegibilidad({
      mensaje: error?.message || 'No fue posible calcular elegibilidad.'
    });
  } finally {
    setLoadingEligibility(false);
  }
};

  const fuentesRespuesta = React.useMemo(() => {
    const direct = safeArray(respuesta, ['fuentes']);
    const nested = safeArray(respuesta?.data, ['fuentes']);
    return direct.length > 0 ? direct : nested;
  }, [respuesta]);

  const recursos = catalogos.recursos || [];
  const totalPlantillas = catalogos.plantillas?.length || 0;
  const totalPreguntas = catalogos.preguntas?.length || 0;

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            IA de becas • {fullName}
          </div>
          <h1>Asistente institucional de becas</h1>
          <p>
            Consulta convocatorias oficiales, requisitos de la Gaceta y tu elegibilidad académica con apoyo de RAG y function calling.
          </p>

          <div style={{ marginTop: '1rem' }}>
            <a
              className="btn secondary"
              href={PORTAL_OFICIAL_URL}
              target="_blank"
              rel="noreferrer"
              style={{ width: 'fit-content' }}
            >
              Abrir portal oficial de becas
            </a>
          </div>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Fuentes activas</small>
            <strong>{loadingResumen ? '...' : resumen.fuentes_activas ?? 0}</strong>
          </div>
          <div className="meta-card">
            <small>Chunks indexados</small>
            <strong>{loadingResumen ? '...' : resumen.total_chunks ?? 0}</strong>
          </div>
        </div>
      </section>

      {notification && (
        <div className="note" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="row gap wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="eyebrow">{notification.title || 'Becas detectadas'}</div>
              <div style={{ marginTop: '0.55rem', lineHeight: 1.7 }}>
                {notification.message || 'Consulta la convocatoria vigente en el portal oficial.'}
              </div>
            </div>

            {notification.actionUrl && (
              <a
                className="btn primary"
                href={notification.actionUrl}
                target="_blank"
                rel="noreferrer"
                style={{ width: 'fit-content' }}
              >
                {notification.actionLabel || 'Abrir portal oficial'}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Convocatorias</div>
            <div className="stat-value">{loadingResumen ? '...' : resumen.total_fuentes ?? 0}</div>
            <div className="stat-hint">Gacetas y fuentes oficiales</div>
          </div>
          <div className="stat-icon">
            <FileText size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Elegibilidad</div>
            <div className="stat-value">
              {elegibilidad === null ? '—' : elegibilidad?.eligible ? 'Sí' : 'No'}
            </div>
            <div className="stat-hint">
              {elegibilidad === null
                ? 'Revisión académica'
                : `${elegibilidad.total_elegibles ?? 0} de ${elegibilidad.total_evaluadas ?? 0} becas`}
            </div>
          </div>
          <div className="stat-icon">
            <Target size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Promedio</div>
            <div className="stat-value">{promedio?.promedio_general ?? '—'}</div>
            <div className="stat-hint">Dato académico actual</div>
          </div>
          <div className="stat-icon">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Catálogos</div>
            <div className="stat-value">{loadingCatalogos ? '...' : recursos.length}</div>
            <div className="stat-hint">Fuentes indexadas</div>
          </div>
          <div className="stat-icon">
            <BookMarked size={22} />
          </div>
        </div>
      </div>

      <div className="two-col">
        <SectionCard
          title="Preguntar a la IA de becas"
          subtitle="RAG + function calling según el tipo de consulta"
        >
          <form className="form-stack" onSubmit={handleAsk}>
            <FormField label="Escribe tu pregunta">
              <textarea
                rows="4"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Ej. ¿Qué becas Edomex están vigentes y qué requisitos piden?"
              />
            </FormField>

            <div className="row gap wrap">
              <button
                className="btn primary"
                type="submit"
                disabled={loadingAsk || !mensaje.trim()}
              >
                {loadingAsk ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
                Consultar beca
              </button>

              <button
                className="btn secondary"
                type="button"
                onClick={handleEligibility}
                disabled={loadingEligibility}
              >
                {loadingEligibility ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                Revisar elegibilidad
              </button>
            </div>
          </form>

          {respuesta && (
            <div className="note" style={{ marginTop: '1rem' }}>
              <strong>Respuesta:</strong>
              <div style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
                {getAnswerText(respuesta)}
              </div>

              {fuentesRespuesta.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Fuente oficial:</strong>
                  <div className="list" style={{ marginTop: '0.5rem' }}>
                    {fuentesRespuesta.slice(0, 3).map((item, index) => {
                      const url = getSourceUrl(item);
                      const title = getSourceTitle(item);
                      return url ? (
                        <a
                          key={item.id_fuente || item.codigo_fuente || index}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="list-item"
                          style={{
                            textDecoration: 'none',
                            display: 'block',
                            color: 'inherit'
                          }}
                        >
                          <strong>{title}</strong>
                          <span>{item.codigo_fuente || item.tipo_fuente || 'Fuente oficial'}</span>
                          <small>{item.vigencia_texto || item.vigencia || 'Consulta la convocatoria vigente'}</small>
                          <small>{url}</small>
                        </a>
                      ) : (
                        <div key={item.id_fuente || item.codigo_fuente || index} className="list-item">
                          <strong>{title}</strong>
                          <span>{item.codigo_fuente || item.tipo_fuente || 'Fuente oficial'}</span>
                          <small>{item.vigencia_texto || 'Sin enlace oficial disponible'}</small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Array.isArray(respuesta?.acciones_sugeridas) && respuesta.acciones_sugeridas.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Acciones sugeridas:</strong>
                  <div className="list" style={{ marginTop: '0.5rem' }}>
                    {respuesta.acciones_sugeridas.map((accion, index) => (
                      <div key={`${accion}-${index}`} className="list-item">
                        <span>{accion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {elegibilidad && (
            <div style={{ marginTop: '1rem' }}>
              <div className={`alert ${elegibilidad.eligible ? 'success' : 'warning'}`}>
                <strong>
                  {elegibilidad.eligible ? ' Elegible' : ' No elegible'}
                </strong>
                : {elegibilidad.mensaje || 'Sin detalle.'}
              </div>

              {elegibilidad.alumno && (
                <div className="note" style={{ marginTop: '0.75rem' }}>
                  <strong>Datos del alumno</strong>
                  <div className="list" style={{ marginTop: '0.5rem' }}>
                    <div className="list-item">
                      <strong>Nombre</strong>
                      <span>{elegibilidad.alumno.nombre_completo || fullName}</span>
                    </div>
                    <div className="list-item">
                      <strong>Promedio general</strong>
                      <span>{elegibilidad.alumno.promedio_general?.toFixed(2) ?? '—'}</span>
                    </div>
                    <div className="list-item">
                      <strong>Semestre actual</strong>
                      <span>{elegibilidad.alumno.semestre_actual ?? '—'}°</span>
                    </div>
                    <div className="list-item">
                      <strong>Créditos acumulados</strong>
                      <span>{elegibilidad.alumno.creditos_acumulados ?? '—'}</span>
                    </div>
                    <div className="list-item">
                      <strong>Carrera</strong>
                      <span>{elegibilidad.alumno.nombre_carrera || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {Array.isArray(elegibilidad.becas_evaluadas) && elegibilidad.becas_evaluadas.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Becas evaluadas ({elegibilidad.total_elegibles ?? 0} de {elegibilidad.total_evaluadas ?? 0} elegibles)</strong>
                  {elegibilidad.becas_evaluadas.map((beca, index) => (
                    <div
                      key={beca.codigo_beca || index}
                      className="note"
                      style={{
                        marginTop: '0.75rem',
                        borderLeft: `4px solid ${beca.elegible ? 'var(--success, #22c55e)' : 'var(--warning, #f59e0b)'}`
                      }}
                    >
                      <div className="row gap wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <strong>{beca.titulo}</strong>
                          <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.25rem' }}>
                            {beca.institucion} · {beca.codigo_beca}
                          </div>
                        </div>
                        <span
                          className={`badge ${beca.elegible ? 'success' : 'warning'}`}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {beca.elegible ? ' Elegible' : ' No elegible'}
                        </span>
                      </div>

                      {beca.url && (
                        <a
                          href={beca.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn secondary"
                          style={{ marginTop: '0.5rem', width: 'fit-content', fontSize: '0.85rem' }}
                        >
                          Ver convocatoria
                        </a>
                      )}

                      <div className="list" style={{ marginTop: '0.75rem' }}>
                        {beca.checks.map((check, ci) => (
                          <div
                            key={ci}
                            className="list-item"
                            style={{
                              borderLeft: `3px solid ${check.cumple ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)'}`,
                              paddingLeft: '0.75rem'
                            }}
                          >
                            <strong>{check.criterio}</strong>
                            <span>
                              {check.cumple ? ' Cumple' : ' No cumple'}
                            </span>
                            <small>{check.detalle}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Estado académico resumido"
          subtitle="Función interna sobre MySQL"
        >
          <div className="list">
            <div className="list-item">
              <strong>Alumno</strong>
              <span>{fullName}</span>
              <small>{user?.correo || user?.correo_institucional || 'Sin correo'}</small>
            </div>

            <div className="list-item">
              <strong>Promedio actual</strong>
              <span>{promedio?.promedio_general ?? 'No consultado'}</span>
              <small>Créditos acumulados: {promedio?.creditos_acumulados ?? '—'}</small>
            </div>

            <div className="list-item">
              <strong>Estatus académico</strong>
              <span>
                {promedio?.estatus_academico || elegibilidad?.alumno?.estatus_academico || 'No disponible'}
              </span>
              <small>
                Semestre actual: {promedio?.semestre_actual ?? elegibilidad?.alumno?.semestre_actual ?? '—'}
              </small>
            </div>
          </div>

          <div className="note" style={{ marginTop: '1rem' }}>
            El orquestador de becas decide automáticamente entre búsqueda semántica y consulta privada, para evitar exponer datos sensibles sin autenticación.
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Catálogos y fuentes indexadas"
        subtitle="Base de conocimiento recuperada por el ingestor"
      >
        <div className="list">
          {recursos.length === 0 ? (
            <div className="empty">No hay fuentes cargadas todavía. Ejecuta el ingestor de becas.</div>
          ) : (
            recursos.map((item, index) => {
              const url = getSourceUrl(item);
              return (
                <a
                  key={item.id_fuente || item.codigo_fuente || index}
                  href={url || '#'}
                  target={url ? '_blank' : undefined}
                  rel={url ? 'noreferrer' : undefined}
                  className="list-item"
                  style={{
                    textDecoration: 'none',
                    display: 'block',
                    color: 'inherit',
                    pointerEvents: url ? 'auto' : 'none',
                    opacity: url ? 1 : 0.8
                  }}
                >
                  <strong>{item.titulo || item.codigo_fuente}</strong>
                  <span>
                    {item.codigo_fuente} • {statusLabel(item.estado)}
                  </span>
                  <small>{item.vigencia_texto || 'Consultar convocatoria vigente'}</small>
                  {url && <small>{url}</small>}
                </a>
              );
            })
          )}
        </div>

        <div className="note" style={{ marginTop: '1rem' }}>
          Plantillas cargadas: {totalPlantillas} • Preguntas cargadas: {totalPreguntas}
        </div>
      </SectionCard>

      <SectionCard
        title="Aviso de uso"
        subtitle="Consulta becas públicas y tu elegibilidad con precisión"
      >
        <div className="note">
          Esta IA combina recuperación de documentos oficiales con funciones internas seguras de MySQL. Para datos privados, siempre exige sesión autenticada.
        </div>
      </SectionCard>

      <button
        type="button"
        className="btn secondary"
        onClick={() => navigate('/app/chatbot')}
        style={{ width: 'fit-content' }}
      >
        <ArrowLeft size={16} />
        Volver al ChatBot
      </button>
    </div>
  );
}