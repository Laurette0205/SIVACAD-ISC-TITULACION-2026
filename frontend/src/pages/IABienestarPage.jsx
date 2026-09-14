import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import {
  AlertTriangle,
  Brain,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  HeartPulse,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
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

const MODULES = [
  { key: 'chequeo', label: 'Chequeo guiado', icon: FileCheck, color: '#22c55e', description: 'Evaluación progresiva de bienestar' },
  { key: 'recursos', label: 'Tutoriales y recursos', icon: BookOpen, color: '#4F46E5', description: 'Biblioteca de apoyo' },
  { key: 'chat', label: 'Chat de apoyo', icon: MessageSquare, color: '#8b5cf6', description: 'Asistente conversacional' },
  { key: 'historial', label: 'Historial y alertas', icon: ClipboardList, color: '#f97316', description: 'Seguimiento y registros' }
];

function ModuleNav({ active, onSelect, counts }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '0.75rem', marginBottom: '1.5rem'
    }}>
      {MODULES.map(m => {
        const Icon = m.icon;
        const isActive = active === m.key;
        const count = counts?.[m.key];
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem 1rem', borderRadius: '12px', border: isActive ? `2px solid ${m.color}` : '1px solid var(--line, #f1f5f9)',
              background: isActive ? `${m.color}08` : 'var(--surface-card, #fff)',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
              boxShadow: isActive ? `0 4px 12px ${m.color}15` : '0 1px 3px rgba(0,0,0,.04)'
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '10px', background: `${m.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0
            }}>
              <Icon size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-heading, #0F172A)' }}>{m.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted, #64748B)' }}>{m.description}</div>
              {count != null && (
                <div style={{ fontSize: '0.7rem', color: m.color, fontWeight: 600, marginTop: '0.15rem' }}>{count}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function IABienestarPage() {
  const { user, token, loading: authLoading } = useAuth();

  const [activeModule, setActiveModule] = React.useState('chequeo');

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

  const [recursoBusqueda, setRecursoBusqueda] = React.useState('');
  const [recursoFiltro, setRecursoFiltro] = React.useState('');

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

  const handleQuestionChange = (questionId, value) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
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
        valor_numero: question.tipo_respuesta === 'NUMERICA' ? Number(responses[question.id_pregunta] ?? 3) : null,
        valor_texto: question.tipo_respuesta === 'TEXTO' ? String(responses[question.id_pregunta] || '').trim() : null
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
        setStatusMessage('Se detectó una señal de riesgo alto. Revisa el recuadro de ayuda inmediata.');
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
        setStatusMessage('El sistema detectó una señal de crisis y mostró los recursos de ayuda inmediata.');
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

  const handleRefreshAll = () => {
    loadCatalogos();
    loadResumen();
    loadHistorial();
  };

  const templateName = selectedTemplateData?.nombre_plantilla || 'Bienestar';
  const templateDescription = selectedTemplateData?.descripcion || '';
  const ruleOfGold = selectedTemplateData?.regla_oro || '';
  const recentMessages = historial?.mensajes || [];
  const recentCheckins = historial?.checkins || [];
  const recentAlerts = historial?.alertas || [];
  const resources = catalogos.recursos || [];

  const recursosFiltrados = resources.filter(r => {
    if (recursoFiltro && r.tipo_recurso !== recursoFiltro) return false;
    if (recursoBusqueda) {
      const q = recursoBusqueda.toLowerCase();
      return (r.titulo || '').toLowerCase().includes(q) || (r.descripcion || '').toLowerCase().includes(q) || (r.categoria || '').toLowerCase().includes(q);
    }
    return true;
  });

  const tiposRecurso = [...new Set(resources.map(r => r.tipo_recurso).filter(Boolean))];

  const moduleCounts = {
    chequeo: `${catalogos.plantillas.length} plantillas`,
    recursos: `${resources.length} recursos`,
    chat: recentMessages.length > 0 ? `${recentMessages.length} mensajes` : 'Sin mensajes',
    historial: `${recentCheckins.length} chequeos · ${recentAlerts.length} alertas`
  };

  const renderChequeoGuiado = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard
        title="Chequeo guiado"
        subtitle="Revisa tu acompañamiento con una plantilla adaptada"
        right={
          <button type="button" className="btn secondary" onClick={handleRefreshAll}>
            <RefreshCw size={16} /> Actualizar
          </button>
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
                {catalogos.plantillas.map((template) => (
                  <option key={template.codigo_plantilla} value={template.codigo_plantilla}>
                    {template.nombre_plantilla}
                  </option>
                ))}
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
              <div className="empty">Esta plantilla aún no tiene preguntas registradas.</div>
            ) : (
              selectedQuestions.map((question) => {
                const isText = normalize(question.tipo_respuesta) === 'TEXTO';
                return (
                  <div key={question.id_pregunta} className="list-item">
                    <strong>{question.orden_pregunta}. {question.criterio}</strong>
                    <span>Peso: {question.peso} • Tipo: {question.tipo_respuesta}</span>
                    {question.descripcion && <small>{question.descripcion}</small>}
                    {isText ? (
                      <textarea rows="3" style={{ marginTop: '0.75rem' }}
                        value={responses[question.id_pregunta] || ''}
                        onChange={(e) => handleQuestionChange(question.id_pregunta, e.target.value)}
                        placeholder="Escribe aquí tu observación breve"
                      />
                    ) : (
                      <div style={{ marginTop: '0.75rem' }}>
                        <input type="range" min={question.min_valor || 1} max={question.max_valor || 5} step="1"
                          value={responses[question.id_pregunta] || 3}
                          onChange={(e) => handleQuestionChange(question.id_pregunta, Number(e.target.value))}
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
            <textarea rows="4" value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Escribe aquí un resumen breve de cómo te sientes hoy."
            />
          </FormField>

          {savingCheckin ? (
            <button className="btn primary" type="button" disabled>
              <Loader2 className="animate-spin" size={18} /> Guardando...
            </button>
          ) : (
            <button className="btn primary" type="submit">
              Guardar y analizar acompañamiento
            </button>
          )}
        </form>

        {latestInsight && (
          <div style={{ marginTop: '1rem', padding: '1rem 1.2rem', background: 'var(--accent-light)', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Resultado del chequeo</div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div><strong>Nivel:</strong> {latestInsight.nivel_riesgo}</div>
              <div><strong>Acompañamiento:</strong> {latestInsight.bienestar_score}%</div>
              <div><strong>Riesgo:</strong> {latestInsight.indice_riesgo}</div>
            </div>
            {latestInsight.mensaje && <p style={{ margin: '0.25rem 0', lineHeight: 1.6 }}>{latestInsight.mensaje}</p>}
            {latestInsight.cierre && <p style={{ margin: '0.25rem 0', lineHeight: 1.6, fontStyle: 'italic' }}>{latestInsight.cierre}</p>}
            {Array.isArray(latestInsight.recomendaciones) && latestInsight.recomendaciones.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <strong>Recomendaciones:</strong>
                <ul style={{ marginTop: '0.3rem', marginBottom: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
                  {latestInsight.recomendaciones.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderRecursos = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Tutoriales y recursos" subtitle="Acciones cortas para estabilizarte y seguir avanzando" icon={BookOpen}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
          <select value={recursoFiltro} onChange={e => setRecursoFiltro(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', background: 'var(--surface-input, #fff)' }}>
            <option value="">Todos los tipos</option>
            {tiposRecurso.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" value={recursoBusqueda} onChange={e => setRecursoBusqueda(e.target.value)}
            placeholder="Buscar recurso..." style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--line, #e2e8f0)', fontSize: '0.78rem', flex: 1, minWidth: 180, background: 'var(--surface-input, #fff)', color: 'var(--text, #0F172A)' }} />
        </div>

        <div className="list">
          {loadingCatalogos ? (
            <div className="empty">Cargando recursos...</div>
          ) : recursosFiltrados.length === 0 ? (
            <div className="empty">
              {resources.length === 0 ? 'No hay recursos disponibles todavía.' : 'No se encontraron recursos con los filtros actuales.'}
            </div>
          ) : (
            recursosFiltrados.map((resource) => (
              <div key={resource.id_recurso || resource.codigo_recurso} className="list-item">
                <strong>{resource.titulo}</strong>
                <span>{resource.categoria} • {resource.tipo_recurso}</span>
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
    </div>
  );

  const renderChat = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Chat de apoyo" subtitle="Conversación breve para orientación emocional, académica o laboral" icon={MessageSquare}>
        <form className="form-stack" onSubmit={handleSendChat}>
          <div className="auth-note">
            <div className="eyebrow">Sugerencias rápidas</div>
            <div className="row gap wrap" style={{ marginTop: '0.65rem' }}>
              {quickPrompts().map((prompt) => (
                <button key={prompt} type="button" className="btn secondary" onClick={() => setChatInput(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Escribe tu mensaje">
            <textarea rows="4" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Cuéntame qué necesitas hoy."
            />
          </FormField>

          {sendingChat ? (
            <button className="btn primary" type="button" disabled>
              <Loader2 className="animate-spin" size={18} /> Enviando...
            </button>
          ) : (
            <button className="btn primary" type="submit">
              <Send size={18} /> Enviar mensaje
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
  );

  const renderHistorial = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SectionCard title="Chequeos recientes" subtitle="Tus evaluaciones de bienestar más recientes" icon={FileCheck}>
        <div className="list">
          {loadingHistorial ? (
            <div className="empty">Cargando historial...</div>
          ) : recentCheckins.length === 0 ? (
            <div className="empty">Sin check-ins recientes.</div>
          ) : (
            recentCheckins.map((item) => (
              <div key={item.id_checkin} className="list-item">
                <strong>{item.codigo_plantilla} · {item.nivel_riesgo}</strong>
                <span>Acompañamiento: {item.bienestar_score}% · Riesgo: {item.indice_riesgo}</span>
                <small>{formatDate(item.creado_en)}</small>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Alertas registradas" subtitle="Señales de riesgo que requieren seguimiento" icon={AlertTriangle}>
        <div className="list">
          {recentAlerts.length === 0 ? (
            <div className="empty">Sin alertas registradas.</div>
          ) : (
            recentAlerts.map((item) => (
              <div key={item.id_alerta} className="list-item">
                <strong>{item.tipo_alerta} · {item.nivel_riesgo}</strong>
                <span>{item.estado}</span>
                <small>{item.descripcion}</small>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'chequeo': return renderChequeoGuiado();
      case 'recursos': return renderRecursos();
      case 'chat': return renderChat();
      case 'historial': return renderHistorial();
      default: return renderChequeoGuiado();
    }
  };

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
      </section>

      {statusMessage && (
        <div className="alert info">{statusMessage}</div>
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
          <div className="stat-icon"><Sparkles size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Último acompañamiento</div>
            <div className="stat-value">{resumen.ultima_revision?.bienestar_score ?? '—'}</div>
            <div className="stat-hint">{resumen.ultima_revision?.nivel_riesgo || 'Sin dato'}</div>
          </div>
          <div className="stat-icon"><HeartPulse size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Alertas altas</div>
            <div className="stat-value">{resumen.alertas_altas || 0}</div>
            <div className="stat-hint">Seguimiento prioritario</div>
          </div>
          <div className="stat-icon"><AlertTriangle size={22} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Última revisión</div>
            <div className="stat-value">{formatDate(resumen.ultima_revision?.creado_en) || 'Sin dato'}</div>
            <div className="stat-hint">Chequeo más reciente</div>
          </div>
          <div className="stat-icon"><CheckCircle2 size={22} /></div>
        </div>
      </div>

      <ModuleNav active={activeModule} onSelect={setActiveModule} counts={moduleCounts} />

      {renderModule()}
    </div>
  );
}
