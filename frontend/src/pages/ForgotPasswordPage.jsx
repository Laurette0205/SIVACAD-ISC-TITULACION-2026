import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import {
  ArrowLeft,
  Loader2,
  MailCheck,
  ShieldCheck,
  KeyRound,
  Sparkles
} from 'lucide-react';
import {
  playSuccessSound,
  playErrorSound
} from '../utils/soundManager';

import SoundToggleButton from '../components/SoundToggleButton';
import '../styles/global.css';

const ALLOWED_DOMAINS = String(
  import.meta.env.VITE_INSTITUTION_EMAIL_DOMAINS ||
  'tesi.edu.mx,ixtapaluca.tecnm.mx,ixtapaluca.tecnm.edu.mx,outlook.com,outlook.es'
)
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isInstitutionalEmail(email) {
  const value = normalizeEmail(email);
  const atIndex = value.lastIndexOf('@');

  if (atIndex === -1) return false;

  const domain = value.slice(atIndex + 1);

  return ALLOWED_DOMAINS.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();

  const [correo, setCorreo] = React.useState('');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const email = normalizeEmail(correo);

    if (!email) {
      setError('Ingresa tu correo institucional.');
      await playErrorSound();
      return;
    }

    if (!isInstitutionalEmail(email)) {
      setError('Solo se permiten correos institucionales.');
      await playErrorSound();
      return;
    }

    setLoading(true);

    try {
      const result = await api.forgotPassword({ correo: email });

      const mainMsg = result?.message || 'Se envió un enlace de recuperación a tu correo institucional.';

      if (result?.devMode && result?.resetUrl) {
        setMessage(
          `${mainMsg}\n\n🔗 Enlace de prueba (solo visible en modo local):\n${result.resetUrl}`
        );
      } else {
        setMessage(mainMsg);
      }
      setCorreo('');
      await playSuccessSound();
    } catch (err) {
      setError(err?.message || 'No fue posible procesar la solicitud.');
      await playErrorSound();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="hero-panel">
        <div className="badge">
          <ShieldCheck size={16} />
          SIVACAD institucional
        </div>

        <div>
          <h1>
            Recuperación de contraseña institucional para acceso seguro al sistema
          </h1>

          <p>
            Restablece tu acceso con tu correo institucional. El sistema enviará
            instrucciones para recuperar tu contraseña de forma segura y ordenada.
          </p>

          <div className="feature-grid">
            <div className="mini-card">
              <strong>
                <KeyRound size={16} style={{ marginRight: 6 }} />
                Restablecimiento seguro
              </strong>
              <span>
                Proceso controlado para recuperar el acceso a tu cuenta institucional.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <MailCheck size={16} style={{ marginRight: 6 }} />
                Correo institucional
              </strong>
              <span>
                La solicitud se valida únicamente con el correo registrado en el sistema.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <Sparkles size={16} style={{ marginRight: 6 }} />
                Acceso por rol
              </strong>
              <span>
                El perfil institucional se conserva al recuperar el acceso a tu cuenta.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-head">
          <div>
            <div className="eyebrow">Recuperación institucional</div>
            <h2>¿Olvidaste tu contraseña?</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Ingresa tu correo institucional para recibir las instrucciones de
              restablecimiento. Si el correo existe en SIVACAD, se generará una
              solicitud de recuperación.
            </p>
          </div>

          <div className="row gap wrap">
            <SoundToggleButton />
            <button className="btn secondary" type="button" onClick={toggleTheme}>
              Cambiar tema
            </button>
          </div>
        </div>

        <div className="auth-note">
          <div className="eyebrow">Indicaciones</div>
          <p style={{ marginTop: '0.4rem', marginBottom: 0, lineHeight: 1.7 }}>
            Verifica que escribas correctamente tu correo institucional.
            Después, revisa tu bandeja de entrada y sigue el enlace de recuperación.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Correo institucional</span>
            <input
              type="email"
              placeholder="usuario@tesi.edu.mx"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <button className="btn primary full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Enviando enlace...
              </>
            ) : (
              <>
                <MailCheck size={18} />
                Enviar enlace de recuperación
              </>
            )}
          </button>

          <button
            type="button"
            className="btn link full"
            onClick={() => navigate('/login')}
          >
            <ArrowLeft size={16} />
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    </div>
  );
}