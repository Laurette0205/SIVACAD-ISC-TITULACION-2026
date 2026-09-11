/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CONSENT_TYPES = [
  {
    id: 'datos_personales',
    titulo: 'Tratamiento de datos personales',
    descripcion: 'Consiento el uso de mis datos personales para las finalidades descritas en el Aviso de Privacidad.'
  },
  {
    id: 'comunicaciones',
    titulo: 'Comunicaciones institucionales',
    descripcion: 'Acepto recibir comunicaciones relacionadas con el sistema SIVACAD-ISC.'
  },
  {
    id: 'analitica',
    titulo: 'Análisis predictivo',
    descripcion: 'Consiento el uso de mi información académica para análisis de deserción y bienestar.'
  },
  {
    id: 'becas',
    titulo: 'Participación en programa de becas',
    descripcion: 'Autorizo el uso de mi información para evaluación de elegibilidad a becas.'
  }
];

function StatusBadge({ activo }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: activo ? '#dcfce7' : '#fee2e2',
        color: activo ? '#166534' : '#991b1b'
      }}
    >
      {activo ? <><CheckCircle2 size={12} /> Activo</> : <><XCircle size={12} /> Inactivo</>}
    </span>
  );
}

export default function ConsentPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [consents, setConsents] = React.useState({});
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState(null);
  const [actionLoading, setActionLoading] = React.useState(null);

  const clearFeedback = React.useCallback(() => {
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [consentData, historyData] = await Promise.allSettled([
        api.request('/privacy/consent', { token }),
        api.request('/privacy/consent-history', { token })
      ]);

      if (consentData.status === 'fulfilled') {
        const d = consentData.value;
        const mapped = {};
        if (Array.isArray(d)) {
          d.forEach((c) => { mapped[c.tipo || c.id] = c; });
        } else if (d?.consents) {
          d.consents.forEach((c) => { mapped[c.tipo || c.id] = c; });
        } else if (typeof d === 'object') {
          Object.entries(d).forEach(([key, val]) => {
            if (key !== 'message') mapped[key] = val;
          });
        }
        setConsents(mapped);
      }

      if (historyData.status === 'fulfilled') {
        const h = historyData.value;
        setHistory(Array.isArray(h) ? h : h?.historial || h?.data || []);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al cargar consentimientos' });
      clearFeedback();
    } finally {
      setLoading(false);
    }
  }, [token, clearFeedback]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (tipo, aceptar) => {
    try {
      setActionLoading(tipo);
      await api.request('/privacy/consent', {
        token,
        method: 'POST',
        body: { tipo, aceptado: aceptar }
      });
      setFeedback({
        type: 'success',
        message: aceptar
          ? `Consentimiento "${tipo}" aceptado.`
          : `Consentimiento "${tipo}" revocado.`
      });
      clearFeedback();
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al actualizar consentimiento' });
      clearFeedback();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page narrow">
      <section className="section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">SIVACAD | ISC</div>
            <h2>Privacidad y Consentimientos</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Gestiona tus consentimientos de uso de datos.
            </p>
          </div>
          <button className="btn secondary" type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Volver
          </button>
        </div>

        {feedback && (
          <div
            className={`auth-note ${feedback.type === 'error' ? 'error' : ''}`}
            style={{ marginBottom: '1rem' }}
          >
            <div className="eyebrow">
              {feedback.type === 'error' ? 'Error' : <><CheckCircle2 size={14} /> Éxito</>}
            </div>
            <p style={{ margin: '0.4rem 0 0', lineHeight: 1.65 }}>{feedback.message}</p>
          </div>
        )}

        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando consentimientos...</p>
        ) : (
          <>
            <div className="auth-note" style={{ marginBottom: '1rem' }}>
              <div className="eyebrow"><Shield size={14} /> Control de datos</div>
              <p style={{ margin: '0.4rem 0 0', lineHeight: 1.65 }}>
                Puedes aceptar o revocar cada consentimiento en cualquier momento.
                Las revocaciones pueden limitar algunas funcionalidades del sistema.
              </p>
            </div>

            <h3>Consentimientos disponibles</h3>
            <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
              {CONSENT_TYPES.map((ct) => {
                const status = consents[ct.id];
                const isActive = status?.aceptado || status?.activo || false;

                return (
                  <div
                    key={ct.id}
                    style={{
                      padding: '1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      border: isActive ? '2px solid #16a34a' : '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{ct.titulo}</strong>
                          <StatusBadge activo={isActive} />
                        </div>
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {ct.descripcion}
                        </p>
                        {status?.fecha && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <Clock size={12} style={{ display: 'inline' }} /> Última actualización: {new Date(status.fecha).toLocaleDateString('es-MX')}
                          </div>
                        )}
                      </div>
                      <div>
                        {isActive ? (
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => handleToggle(ct.id, false)}
                            disabled={actionLoading === ct.id}
                            style={{ color: '#ef4444', whiteSpace: 'nowrap' }}
                          >
                            {actionLoading === ct.id ? 'Procesando...' : 'Revocar'}
                          </button>
                        ) : (
                          <button
                            className="btn primary"
                            type="button"
                            onClick={() => handleToggle(ct.id, true)}
                            disabled={actionLoading === ct.id}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {actionLoading === ct.id ? 'Procesando...' : 'Aceptar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {history.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3><Clock size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Historial de cambios</h3>
                <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.6rem', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '0.6rem', textAlign: 'left' }}>Tipo</th>
                        <th style={{ padding: '0.6rem', textAlign: 'left' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 20).map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.6rem' }}>
                            {new Date(h.fecha || h.created_at).toLocaleString('es-MX')}
                          </td>
                          <td style={{ padding: '0.6rem' }}>{h.tipo || h.consent_type}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <StatusBadge activo={h.aceptado || h.accion === 'aceptar'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <h3>Tus derechos</h3>
              <p>
                Conforme a la LFPDPPP, tienes derecho a Acceder, Rectificar, Cancelar y Oponerte
                (Derechos ARCO) al tratamiento de tus datos personales. Para ejercer estos derechos,
                contacta a través del sistema o los canales oficiales del TESI.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <a href="/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="btn secondary">
                  <FileText size={14} /> Ver Aviso de Privacidad
                </a>
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="btn secondary">
                  <FileText size={14} /> Ver Términos y Condiciones
                </a>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
