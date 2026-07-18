import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  ShieldCheck,
  MailCheck,
  Sparkles,
  LockKeyhole
} from 'lucide-react';
import {
  playSuccessSound,
  playErrorSound
} from '../utils/soundManager';

import SoundToggleButton from '../components/SoundToggleButton';
import '../styles/global.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { toggleTheme } = useTheme();

  const [form, setForm] = React.useState({
    contrasena: '',
    confirmar_contrasena: ''
  });

  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!token) {
      setError('El enlace de recuperación no es válido o ha expirado.');
      await playErrorSound();
      setLoading(false);
      return;
    }

    if (!form.contrasena || form.contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      await playErrorSound();
      setLoading(false);
      return;
    }

    if (form.contrasena !== form.confirmar_contrasena) {
      setError('Las contraseñas no coinciden.');
      await playErrorSound();
      setLoading(false);
      return;
    }

    try {
      const result = await api.resetPassword(token, {
        contrasena: form.contrasena
      });

      setMessage(result?.message || 'Contraseña actualizada correctamente.');
      await playSuccessSound();

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1400);
    } catch (err) {
      setError(err?.message || 'Error al restablecer contraseña');
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
          <h1>Restablecimiento seguro de contraseña institucional</h1>

          <p>
            Define una nueva contraseña para recuperar tu acceso al sistema.
            Este proceso protege tu cuenta y conserva tu perfil institucional.
          </p>

          <div className="feature-grid">
            <div className="mini-card">
              <strong>
                <KeyRound size={16} style={{ marginRight: 6 }} />
                Nueva credencial
              </strong>
              <span>
                Establece una contraseña segura para volver a ingresar al sistema.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <MailCheck size={16} style={{ marginRight: 6 }} />
                Enlace validado
              </strong>
              <span>
                El acceso se autoriza únicamente mediante un enlace de recuperación válido.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <Sparkles size={16} style={{ marginRight: 6 }} />
                Acceso institucional
              </strong>
              <span>
                Tu perfil, rol y permisos se mantienen intactos después del restablecimiento.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-head">
          <div>
            <div className="eyebrow">Restablecer acceso</div>
            <h2>Nueva contraseña</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Ingresa una nueva contraseña para recuperar tu cuenta institucional.
              Confirma los datos y guarda los cambios para continuar.
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
            Asegúrate de crear una contraseña segura y de escribirla correctamente en ambos campos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={form.contrasena}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contrasena: e.target.value }))
              }
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={form.confirmar_contrasena}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  confirmar_contrasena: e.target.value
                }))
              }
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <button className="btn primary full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Guardando...
              </>
            ) : (
              <>
                <LockKeyhole size={18} />
                Restablecer contraseña
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