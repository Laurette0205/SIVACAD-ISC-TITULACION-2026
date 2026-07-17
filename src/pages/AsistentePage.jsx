import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2,
  SendHorizonal,
  Sparkles,
  ShieldCheck,
  Brain,
  MessageCircle,
  BookOpen,
  GraduationCap,
  BadgeCheck
} from 'lucide-react';

export default function AsistentePage() {
  const { token, user } = useAuth();

  const [messages, setMessages] = React.useState([
    {
      role: 'bot',
      text: 'Hola, soy tu asistente académico institucional. Pregúntame por becas, kardex, acompañamiento o soporte.'
    }
  ]);
  const [texto, setTexto] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [contexto, setContexto] = React.useState(null);

  const endRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    let mounted = true;

    const loadContext = async () => {
      if (!token) return;

      try {
        const response = await api.asistente.contexto(token);
        if (mounted) {
          setContexto(response?.data || null);
        }
      } catch (error) {
        console.error('No fue posible cargar el contexto del asistente:', error);
      }
    };

    loadContext();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSend = async (e) => {
    e.preventDefault();

    const value = texto.trim();
    if (!value || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setTexto('');
    setLoading(true);

    try {
      const response = await api.asistente.mensaje(token, { mensaje: value });

      const respuesta = response?.respuesta || response?.message || 'Respuesta generada.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: respuesta,
          data: response?.data || null,
          intent: response?.intent || null
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: error?.message || 'No fue posible contactar al asistente.',
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (text) => setTexto(text);

  return (
    <SectionCard
      title="Asistente académico institucional"
      subtitle={`Atención personalizada para ${user?.rol_nombre || user?.rol || 'tu perfil'}`}
    >
      <div className="auth-note" style={{ marginBottom: '1rem' }}>
        <div className="eyebrow">
          <ShieldCheck size={14} />
          Respuesta contextual por rol
        </div>
        <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
          El asistente adapta las respuestas según tu acceso institucional y consulta la base de datos para darte información precisa.
        </p>

        {contexto?.rol && (
          <p style={{ margin: '0.6rem 0 0', lineHeight: 1.6 }} className="muted">
            Rol detectado: <strong>{contexto.rol}</strong>
            {contexto?.promedio ? (
              <> · Promedio: <strong>{Number(contexto.promedio).toFixed(2)}</strong></>
            ) : null}
            {contexto?.semestre ? (
              <> · Semestre: <strong>{contexto.semestre}°</strong></>
            ) : null}
          </p>
        )}
      </div>

      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className={`bubble ${msg.role}`}>
            <span>{msg.text}</span>
            {msg.data?.perfil && msg.intent === 'ACADEMICO' && (
              <div className="list" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <div className="list-item">
                  <GraduationCap size={14} />
                  <span>Promedio: <strong>{Number(msg.data.perfil.promedio_general || 0).toFixed(2)}</strong></span>
                  <small>Créditos: {msg.data.perfil.creditos_acumulados || 0}</small>
                </div>
                <div className="list-item">
                  <BookOpen size={14} />
                  <span>Semestre: <strong>{msg.data.perfil.semestre_actual || '—'}°</strong></span>
                  <small>{msg.data.perfil.nombre_carrera || ''}</small>
                </div>
                {msg.data.elegibilidad && (
                  <div className="list-item">
                    <BadgeCheck size={14} style={{ color: msg.data.elegibilidad.elegible ? 'var(--success)' : 'var(--warning)' }} />
                    <span>Elegibilidad becas: <strong>{msg.data.elegibilidad.elegible ? 'Cumple base' : 'No cumple base'}</strong></span>
                    <small>{msg.data.elegibilidad.motivo || ''}</small>
                  </div>
                )}
              </div>
            )}
            {msg.data?.convocatorias && msg.data.convocatorias.length > 0 && (
              <div className="list" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>Convocatorias encontradas:</div>
                {msg.data.convocatorias.slice(0, 3).map((c, i) => (
                  <div key={c.codigo_fuente || c.id_fuente || i} className="list-item">
                    <Sparkles size={14} />
                    <span>{c.titulo || c.codigo_fuente || `Opción ${i + 1}`}</span>
                    <small>{c.vigencia_texto || c.estado || ''}</small>
                    {c.url_origen && <small>{c.url_origen}</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bubble bot" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} />
            Analizando tu consulta...
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form className="chat-form" onSubmit={handleSend}>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu consulta..."
          disabled={loading}
        />

        <button className="btn accent" type="submit" disabled={loading || !texto.trim()}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />}
          Enviar
        </button>
      </form>

      <div className="row gap wrap" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => quickFill('¿Qué becas hay disponibles?')}
        >
          <Sparkles size={16} />
          Becas
        </button>

        <button
          type="button"
          className="btn secondary"
          onClick={() => quickFill('¿Cómo voy en mi kardex?')}
        >
          <MessageCircle size={16} />
          Kardex
        </button>

        <button
          type="button"
          className="btn secondary"
          onClick={() => quickFill('Necesito ayuda con acompañamiento emocional')}
        >
          <Brain size={16} />
          Acompañamiento Estudiantil
        </button>
      </div>
    </SectionCard>
  );
}