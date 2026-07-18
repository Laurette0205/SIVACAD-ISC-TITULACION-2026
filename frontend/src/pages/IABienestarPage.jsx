import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import {
  AlertTriangle,
  Brain,
  Briefcase,
  CheckCircle2,
  HeartPulse,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  BookOpen
} from 'lucide-react';
import '../styles/global.css';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeLower(value) {
  return String(value || '').trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function getTemplateIcon(code) {
  switch (normalize(code)) {
    case 'ACOMPAÑAMIENTO_ACADEMICO':
      return BookOpen;
    case 'BIENESTAR_LABORAL':
      return Briefcase;
    default:
      return HeartPulse;
  }
}

function quickPrompts() {
  return [
    'Necesito organizarme mejor para hoy.',
    'Me siento saturado/a y quiero un plan breve.',
    'Quiero revisar mi acompañamiento académico y emocional.',
    'Necesito apoyo para manejar el estrés.'
  ];
}

function getDefaultResponses(questions = []) {
  const base = {};

  questions.forEach((q) => {
    base[q.id_pregunta] = q.tipo_respuesta === 'TEXTO' ? '' : 3;
  });

  return base;
}

export default function IABienestarPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { toggleTheme } = useTheme();

  const [catalogos, setCatalogos] = React.useState({
    plantillas: [],
    preguntas: [],
    recursos: [],
    preguntas_por_plantilla: {}
  });
  const [resumen, setResumen] = React.useState({
    total_checkins: 0,
    promedio_bienestar: 0,
    alertas_criticas: 0,
    alertas_altas: 0,
    alertas_medias: 0,
    sesiones_activas: 0,
    ultima_revision: null
  });
  const [historial, setHistorial] = React.useState({
    sesion: null,
    mensajes: [],
    checkins: [],
    alertas: []
  });

  const [selectedTemplate, setSelectedTemplate] = React.useState('');
  const [responses, setResponses] = React.useState({});
  const [observaciones, setObservaciones] = React.useState('');
  const [chatInput, setChatInput] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [latestInsight, setLatestInsight] = React.useState(null);

  const [loadingCatalogos, setLoadingCatalogos] = React.useState(true);
  const [loadingResumen, setLoadingResumen] = React.useState(true);
  const [loadingHistorial, setLoadingHistorial] = React.useState(true);
  const [savingCheckin, setSavingCheckin] = React.useState(false);
  const [sendingChat, setSendingChat] = React.useState(false);

  const canContinue = Boolean(user && token);

  const selectedTemplateData = React.useMemo(() => {
    return (
      catalogos.plantillas.find(
        (item) => normalize(item.codigo_plantilla) === normalize(selectedTemplate)
      ) || catalogos.plantillas[0] || null
    );
  }, [catalogos.plantillas, selectedTemplate]);

  const selectedQuestions = React.useMemo(() => {
    const code = normalize(selectedTemplateData?.codigo_plantilla || selectedTemplate);

    return catalogos.preguntas.filter(
      (item) => normalize(item.codigo_plantilla) === code
    );
  }, [catalogos.preguntas, selectedTemplate, selectedTemplateData]);

  React.useEffect(() => {
    if (!selectedTemplate && catalogos.plantillas.length > 0) {
      setSelectedTemplate(catalogos.plantillas[0].codigo_plantilla);
    }
  }, [catalogos.plantillas, selectedTemplate]);

  React.useEffect(() => {
    setResponses((prev) => ({
      ...getDefaultResponses(selectedQuestions),
      ...prev
    }));
  }, [selectedQuestions]);

  const loadCatalogos = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoadingCatalogos(true);
      const response = await api.iaBienestarCatalogos(token);

      const data = response?.catalogos || {};
      setCatalogos({
        plantillas: Array.isArray(data.plantillas) ? data.plantillas : [],
        preguntas: Array.isArray(data.preguntas) ? data.preguntas : [],
        recursos: Array.isArray(data.recursos) ? data.recursos : [],
        preguntas_por_plantilla: data.preguntas_por_plantilla || {}
      });
    } catch (error) {
      console.error('Error al cargar catálogos de bienestar:', error);
      setStatusMessage(error?.message || 'No fue posible cargar los catálogos.');
    } finally {
      setLoadingCatalogos(false);
    }
  }, [token]);

  const loadResumen = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoadingResumen(true);
      const response = await api.iaBienestarResumen(token);

      setResumen(
        response?.data || {
          total_checkins: 0,
          promedio_bienestar: 0,
          alertas_criticas: 0,
          alertas_altas: 0,
          alertas_medias: 0,
          sesiones_activas: 0,
          ultima_revision: null
        }
      );
    } catch (error) {
      console.error('Error al cargar resumen de bienestar:', error);
    } finally {
      setLoadingResumen(false);
    }
  }, [token]);

  const loadHistorial = React.useCallback(async () => {
    if (!token) return;

    try {
      setLoadingHistorial(true);
      const response = await api.iaBienestarHistorial(token, '?limite=20');

      setHistorial(
        response?.data || {
          sesion: null,
          mensajes: [],
          checkins: [],
          alertas: []
        }
      );
    } catch (error) {
      console.error('Error al cargar historial de bienestar:', error);
    } finally {
      setLoadingHistorial(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (!canContinue) return;
    loadCatalogos();
    loadResumen();
    loadHistorial();
  }, [canContinue, loadCatalogos, loadResumen, loadHistorial]);

  if (authLoading) {
    return <div className="page-center">Cargando sesión...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const heroCards = [
    {
      label: 'Sesiones activas',
      value: resumen.sesiones_activas || 0,
      icon: ShieldCheck
    },
    {
      label: 'Check-ins',
      value: resumen.total_checkins || 0,
      icon: CheckCircle2
    },
    {
      label: 'Alertas críticas',
      value: resumen.alertas_criticas || 0,
      icon: AlertTriangle
    },
    {
      label: 'Acompañamiento promedio',
      value: `${resumen.promedio_bienestar || 0}%`,
      icon: HeartPulse
    }
  ];

  const handleQuestionChange = (questionId, value) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSendCheckin = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    setLatestInsight(null);

    try {
      setSavingCheckin(true);

      const respuestas = selectedQuestions.map((question) => ({
        id_pregunta: question.id_pregunta,
        codigo_pregunta: question.codigo_pregunta,
        tipo_respuesta: question.tipo_respuesta,
        valor_numero:
          question.tipo_respuesta === 'NUMERICA'
            ? Number(responses[question.id_pregunta] ?? 3)
            : null,
        valor_texto:
          question.tipo_respuesta === 'TEXTO'
            ? String(responses[question.id_pregunta] || '').trim()
            : null
      }));

      const response = await api.iaBienestarCheckin(token, {
        codigo_plantilla: selectedTemplateData?.codigo_plantilla || selectedTemplate,
        respuestas,
        observaciones,
        titulo_sesion: selectedTemplateData?.nombre_plantilla || 'Acompañamiento',
        objetivo: 'Chequeo preventivo de acompañamiento'
      });

      const data = response?.data || null;
      setLatestInsight(data);
      setStatusMessage(response?.message || 'Chequeo guardado correctamente.');

      if (data?.requiere_atencion_inmediata) {
        setStatusMessage(
          'Se detectó una señal de riesgo alto. Revisa el recuadro de ayuda inmediata.'
        );
      }

      await Promise.all([loadResumen(), loadHistorial()]);
    } catch (error) {
      console.error('Error al guardar check-in:', error);
      setStatusMessage(error?.message || 'No fue posible guardar el chequeo.');
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    const content = String(chatInput || '').trim();

    if (!content) {
      setStatusMessage('Escribe un mensaje para continuar.');
      return;
    }

    try {
      setSendingChat(true);
      setStatusMessage('');

      const response = await api.iaBienestarChat(token, {
        mensaje: content,
        id_sesion: historial?.sesion?.id_sesion || latestInsight?.id_sesion || null,
        codigo_plantilla: selectedTemplateData?.codigo_plantilla || selectedTemplate
      });

      const data = response?.data || {};
      setChatInput('');
      setLatestInsight(data);

      await loadHistorial();

      if (data?.requiere_atencion_inmediata) {
        setStatusMessage(
          'El sistema detectó una señal de crisis y mostró los recursos de ayuda inmediata.'
        );
      } else {
        setStatusMessage(response?.message || 'Respuesta generada correctamente.');
      }
    } catch (error) {
      console.error('Error al enviar mensaje al asistente de bienestar:', error);
      setStatusMessage(error?.message || 'No fue posible enviar el mensaje.');
    } finally {
      setSendingChat(false);
    }
  };

  const templateName = selectedTemplateData?.nombre_plantilla || 'Bienestar';
  const templateDescription = selectedTemplateData?.descripcion || '';
  const ruleOfGold = selectedTemplateData?.regla_oro || '';

  const recentMessages = historial?.mensajes || [];
  const recentCheckins = historial?.checkins || [];
  const recentAlerts = historial?.alertas || [];
  const resources = catalogos.recursos || [];

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <Brain size={16} />
            IA de Acompañamiento Estudiantil • {user?.rol || user?.rol_nombre || 'Institucional'}
          </div>

          <h1>IA de Acompañamiento Estudiantil</h1>

          <p>
            Un espacio de apoyo emocional, académico y laboral para orientar,
            ordenar ideas y detectar señales de riesgo a tiempo.
          </p>
        </div>

        <div className="hero-meta">
          {loadingResumen ? (
            <div className="meta-card">
              <small>Cargando métricas</small>
              <strong>...</strong>
            </div>
          ) : (
            heroCards.map((card) => {
              const Icon = card.icon;
              return (
                <div className="meta-card" key={card.label}>
                  <small>{card.label}</small>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={18} />
                    {card.value}
                  </strong>
                </div>
              );
            })
          )}
        </div>
      </section>

      {statusMessage && (
        <div className="alert info">
          {statusMessage}
        </div>
      )}

      {latestInsight?.requiere_atencion_inmediata && (
        <div className="alert error">
          <strong>Ayuda inmediata:</strong> Si existe peligro inmediato, llama al 911.
          En México también puedes contactar Línea de la Vida al 800 911 2000.
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Plantillas activas</div>
            <div className="stat-value">{catalogos.plantillas.length}</div>
            <div className="stat-hint">Acompañamiento general, académico y laboral</div>
          </div>
          <div className="stat-icon">
            <Sparkles size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Último acompañamiento</div>
            <div className="stat-value">
              {resumen.ultima_revision?.bienestar_score ?? '—'}
            </div>
            <div className="stat-hint">
              {resumen.ultima_revision?.nivel_riesgo || 'Sin dato'}
            </div>
          </div>
          <div className="stat-icon">
            <HeartPulse size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Alertas altas</div>
            <div className="stat-value">{resumen.alertas_altas || 0}</div>
            <div className="stat-hint">Seguimiento prioritario</div>
          </div>
          <div className="stat-icon">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Última revisión</div>
            <div className="stat-value">
              {formatDate(resumen.ultima_revision?.creado_en) || 'Sin dato'}
            </div>
            <div className="stat-hint">Chequeo más reciente</div>
          </div>
          <div className="stat-icon">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      <div className="two-col">
        <SectionCard
          title="Chequeo guiado"
          subtitle="Revisa tu acompañamiento con una plantilla adaptada"
          right={
            <div className="row gap wrap">
              <button
                type="button"
                className="btn secondary"
                onClick={toggleTheme}
              >
                Cambiar tema
              </button>

              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  loadCatalogos();
                  loadResumen();
                  loadHistorial();
                }}
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>
          }
        >
          <form className="form-stack" onSubmit={handleSendCheckin}>
            <div className="grid-two">
              <FormField label="Plantilla">
                <select
                  value={selectedTemplateData?.codigo_plantilla || selectedTemplate}
                  onChange={(e) => {
                    setSelectedTemplate(e.target.value);
                    setResponses(getDefaultResponses(
                      catalogos.preguntas.filter(
                        (item) => normalize(item.codigo_plantilla) === normalize(e.target.value)
                      )
                    ));
                  }}
                >
                  {catalogos.plantillas.map((template) => {
                    const Icon = getTemplateIcon(template.codigo_plantilla);
                    return (
                      <option key={template.codigo_plantilla} value={template.codigo_plantilla}>
                        {template.nombre_plantilla}
                      </option>
                    );
                  })}
                </select>
              </FormField>

              <FormField label="Perfil">
                <input value={user?.rol || user?.rol_nombre || 'Institucional'} disabled />
              </FormField>
            </div>

            <div className="auth-note">
              <div className="eyebrow">Descripción de la plantilla</div>
              <p style={{ marginTop: '0.5rem', lineHeight: 1.7, marginBottom: 0 }}>
                {templateDescription || 'Selecciona una plantilla para ver su enfoque.'}
              </p>
            </div>

            {ruleOfGold && (
              <div className="alert info">
                <strong>Regla de acompañamiento:</strong> {ruleOfGold}
              </div>
            )}

            <div className="list">
              {selectedQuestions.length === 0 ? (
                <div className="empty">
                  Esta plantilla aún no tiene preguntas registradas.
                </div>
              ) : (
                selectedQuestions.map((question) => {
                  const isText = normalize(question.tipo_respuesta) === 'TEXTO';
                  return (
                    <div key={question.id_pregunta} className="list-item">
                      <strong>
                        {question.orden_pregunta}. {question.criterio}
                      </strong>
                      <span>
                        Peso: {question.peso} • Tipo: {question.tipo_respuesta}
                      </span>
                      {question.descripcion && <small>{question.descripcion}</small>}

                      {isText ? (
                        <textarea
                          rows="3"
                          style={{ marginTop: '0.75rem' }}
                          value={responses[question.id_pregunta] || ''}
                          onChange={(e) =>
                            handleQuestionChange(question.id_pregunta, e.target.value)
                          }
                          placeholder="Escribe aquí tu observación breve"
                        />
                      ) : (
                        <div style={{ marginTop: '0.75rem' }}>
                          <input
                            type="range"
                            min={question.min_valor || 1}
                            max={question.max_valor || 5}
                            step="1"
                            value={responses[question.id_pregunta] || 3}
                            onChange={(e) =>
                              handleQuestionChange(question.id_pregunta, Number(e.target.value))
                            }
                          />
                          <div className="row" style={{ justifyContent: 'space-between' }}>
                            <small>1 = muy bajo</small>
                            <strong>{responses[question.id_pregunta] || 3} / 5</strong>
                            <small>5 = excelente</small>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <FormField label="Observaciones generales">
              <textarea
                rows="4"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Escribe aquí un resumen breve de cómo te sientes hoy."
              />
            </FormField>

            {savingCheckin ? (
              <button className="btn primary" type="button" disabled>
                <Loader2 className="animate-spin" size={18} />
                Guardando...
              </button>
            ) : (
              <button className="btn primary" type="submit">
                Guardar y analizar acompañamiento
              </button>
            )}
          </form>

          {latestInsight && (
            <div className="note" style={{ marginTop: '1rem' }}>
              <strong>Resultado:</strong> {latestInsight.nivel_riesgo} · Acompañamiento: {latestInsight.bienestar_score}% · Riesgo: {latestInsight.indice_riesgo}
              <br />
              <strong>Mensaje:</strong> {latestInsight.mensaje}
              <br />
              {latestInsight.cierre && (
                <>
                  <strong>Cierre:</strong> {latestInsight.cierre}
                  <br />
                </>
              )}
              {Array.isArray(latestInsight.recomendaciones) && latestInsight.recomendaciones.length > 0 && (
                <>
                  <strong>Recomendaciones:</strong>
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.2rem' }}>
                    {latestInsight.recomendaciones.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Chat de apoyo"
          subtitle="Conversación breve para orientación emocional, académica o laboral"
        >
          <form className="form-stack" onSubmit={handleSendChat}>
            <div className="auth-note">
              <div className="eyebrow">Sugerencias rápidas</div>
              <div className="row gap wrap" style={{ marginTop: '0.65rem' }}>
                {quickPrompts().map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="btn secondary"
                    onClick={() => setChatInput(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <FormField label="Escribe tu mensaje">
              <textarea
                rows="4"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Cuéntame qué necesitas hoy."
              />
            </FormField>

            {sendingChat ? (
              <button className="btn primary" type="button" disabled>
                <Loader2 className="animate-spin" size={18} />
                Enviando...
              </button>
            ) : (
              <button className="btn primary" type="submit">
                <Send size={18} />
                Enviar mensaje
              </button>
            )}
          </form>

          <div style={{ marginTop: '1rem' }}>
            <div className="eyebrow">Conversación reciente</div>
            <div className="list" style={{ marginTop: '0.75rem' }}>
              {loadingHistorial ? (
                <div className="empty">Cargando historial...</div>
              ) : recentMessages.length === 0 ? (
                <div className="empty">Todavía no hay mensajes para esta sesión.</div>
              ) : (
                recentMessages.map((item) => (
                  <div key={item.id_mensaje || `${item.creado_en}-${item.rol_mensaje}`} className="list-item">
                    <strong>{normalize(item.rol_mensaje) === 'ASSISTANT' ? 'IA de Acompañamiento Estudiantil' : 'Tú'}</strong>
                    <span>{formatDate(item.creado_en)}</span>
                    <small style={{ whiteSpace: 'pre-wrap' }}>{item.mensaje}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="two-col">
        <SectionCard
          title="Tutoriales y recursos"
          subtitle="Acciones cortas para estabilizarte y seguir avanzando"
        >
          <div className="list">
            {resources.length === 0 ? (
              <div className="empty">No hay recursos disponibles todavía.</div>
            ) : (
              resources.map((resource) => (
                <div key={resource.id_recurso || resource.codigo_recurso} className="list-item">
                  <strong>{resource.titulo}</strong>
                  <span>
                    {resource.categoria} • {resource.tipo_recurso}
                  </span>
                  <small>{resource.descripcion}</small>

                  <div className="row gap wrap" style={{ marginTop: '0.75rem' }}>
                    {resource.telefono && (
                      <a className="btn secondary" href={`tel:${String(resource.telefono).replace(/\s+/g, '')}`}>
                        {resource.telefono}
                      </a>
                    )}
                    {resource.url && (
                      <a className="btn secondary" href={resource.url} target="_blank" rel="noreferrer">
                        Abrir recurso
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Historial y alertas"
          subtitle="Chequeos recientes y señales a vigilar"
        >
          <div className="list">
            {recentCheckins.length === 0 ? (
              <div className="empty">Sin check-ins recientes.</div>
            ) : (
              recentCheckins.map((item) => (
                <div key={item.id_checkin} className="list-item">
                  <strong>
                    {item.codigo_plantilla} · {item.nivel_riesgo}
                  </strong>
                  <span>
                    Acompañamiento: {item.bienestar_score}% · Riesgo: {item.indice_riesgo}
                  </span>
                  <small>{formatDate(item.creado_en)}</small>
                </div>
              ))
            )}
          </div>

          <div className="list" style={{ marginTop: '1rem' }}>
            {recentAlerts.length === 0 ? (
              <div className="empty">Sin alertas registradas.</div>
            ) : (
              recentAlerts.map((item) => (
                <div key={item.id_alerta} className="list-item">
                  <strong>
                    {item.tipo_alerta} · {item.nivel_riesgo}
                  </strong>
                  <span>{item.estado}</span>
                  <small>{item.descripcion}</small>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
