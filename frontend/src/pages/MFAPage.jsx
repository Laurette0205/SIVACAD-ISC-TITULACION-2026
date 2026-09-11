/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, QrCode, KeyRound, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function MFAPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [mfaStatus, setMfaStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [qrData, setQrData] = React.useState(null);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [feedback, setFeedback] = React.useState(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const clearFeedback = React.useCallback(() => {
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.request('/mfa/status', { token });
      setMfaStatus(data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al cargar estado MFA' });
      clearFeedback();
    } finally {
      setLoading(false);
    }
  }, [token, clearFeedback]);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleEnable = async () => {
    try {
      setActionLoading(true);
      const data = await api.request('/mfa/setup', { token, method: 'POST' });
      setQrData(data);
      setFeedback({ type: 'success', message: 'Escanea el código QR con tu aplicación de autenticación.' });
      clearFeedback();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al configurar MFA' });
      clearFeedback();
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setFeedback({ type: 'error', message: 'Ingresa un código de 6 dígitos.' });
      clearFeedback();
      return;
    }

    try {
      setActionLoading(true);
      await api.request('/mfa/verify', {
        token,
        method: 'POST',
        body: { codigo: verificationCode }
      });
      setQrData(null);
      setVerificationCode('');
      setFeedback({ type: 'success', message: 'MFA activado correctamente.' });
      clearFeedback();
      loadStatus();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Código inválido' });
      clearFeedback();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('¿Estás seguro de desactivar la autenticación de dos factores?')) return;

    try {
      setActionLoading(true);
      await api.request('/mfa/disable', { token, method: 'POST' });
      setFeedback({ type: 'success', message: 'MFA desactivado correctamente.' });
      clearFeedback();
      loadStatus();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al desactivar MFA' });
      clearFeedback();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('¿Regenerar códigos de respaldo? Los anteriores dejarán de funcionar.')) return;

    try {
      setActionLoading(true);
      const data = await api.request('/mfa/regenerate-backup', { token, method: 'POST' });
      setFeedback({ type: 'success', message: 'Códigos de respaldo regenerados.' });
      clearFeedback();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al regenerar códigos' });
      clearFeedback();
    } finally {
      setActionLoading(false);
    }
  };

  const isEnabled = mfaStatus?.habilitado || mfaStatus?.enabled;

  return (
    <div className="page narrow">
      <section className="section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">SIVACAD | ISC</div>
            <h2>Autenticación de Dos Factores (MFA)</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Protege tu cuenta con una segunda capa de seguridad.
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
            <p style={{ margin: '0.4rem 0 0', lineHeight: 1.65 }}>
              {feedback.message}
            </p>
          </div>
        )}

        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando estado MFA...</p>
        ) : (
          <div style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>
            <div className="auth-note" style={{ marginBottom: '1rem' }}>
              <div className="eyebrow">
                <ShieldCheck size={14} /> Estado actual
              </div>
              <p style={{ margin: '0.4rem 0 0', lineHeight: 1.65 }}>
                {isEnabled
                  ? 'La autenticación de dos factores está activa en tu cuenta.'
                  : 'La autenticación de dos factores no está activa. Se recomienda activarla para mayor seguridad.'}
              </p>
            </div>

            <h3>Opciones de seguridad</h3>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {!isEnabled ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={handleEnable}
                  disabled={actionLoading}
                >
                  <KeyRound size={16} />
                  {actionLoading ? 'Configurando...' : 'Activar MFA'}
                </button>
              ) : (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={handleDisable}
                  disabled={actionLoading}
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={16} />
                  {actionLoading ? 'Procesando...' : 'Desactivar MFA'}
                </button>
              )}

              {isEnabled && (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={handleRegenerate}
                  disabled={actionLoading}
                >
                  <RefreshCw size={16} />
                  Regenerar códigos de respaldo
                </button>
              )}
            </div>

            {qrData && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3>Configurar aplicación de autenticación</h3>
                <p style={{ marginTop: '0.5rem' }}>
                  Escanea el siguiente código QR con Google Authenticator, Microsoft Authenticator o similar:
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.5rem',
                    marginTop: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div
                    style={{
                      width: '180px',
                      height: '180px',
                      background: '#f1f5f9',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed var(--border)'
                    }}
                  >
                    <QrCode size={48} color="#94a3b8" />
                  </div>

                  {qrData?.secret && (
                    <div style={{ textAlign: 'center' }}>
                      <div className="eyebrow">Código manual</div>
                      <code
                        style={{
                          display: 'block',
                          marginTop: '0.4rem',
                          padding: '0.5rem 1rem',
                          background: 'var(--bg-primary)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          letterSpacing: '0.15em',
                          wordBreak: 'break-all'
                        }}
                      >
                        {qrData.secret}
                      </code>
                    </div>
                  )}

                  <div style={{ width: '100%', maxWidth: '320px' }}>
                    <div className="field">
                      <span>Código de verificación</span>
                      <input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  <button
                    className="btn primary"
                    type="button"
                    onClick={handleVerify}
                    disabled={actionLoading || verificationCode.length < 6}
                  >
                    {actionLoading ? 'Verificando...' : 'Verificar y activar'}
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ marginTop: '1.5rem' }}>¿Qué es MFA?</h3>
            <p>
              La autenticación de dos factores (MFA) agrega una capa adicional de seguridad a tu cuenta.
              Además de tu contraseña, necesitarás un código generado por una aplicación de autenticación
              en tu teléfono móvil para iniciar sesión.
            </p>
            <ul>
              <li>Usa aplicaciones como Google Authenticator o Microsoft Authenticator</li>
              <li>Genera códigos que cambian cada 30 segundos</li>
              <li>Protege tu cuenta aunque tu contraseña sea comprometida</li>
              <li>Guarda los códigos de respaldo en un lugar seguro</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
