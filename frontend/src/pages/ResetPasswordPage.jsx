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
  LockKeyhole,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  playSuccessSound,
  playErrorSound
} from '../utils/soundManager';
import {
  getPasswordChecks,
  validatePassword,
  getPasswordStrength
} from '../security/passwordPolicy';

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
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const passwordChecks = React.useMemo(
    () => getPasswordChecks(form.contrasena),
    [form.contrasena]
  );
  const passwordStrength = React.useMemo(
    () => getPasswordStrength(form.contrasena),
    [form.contrasena]
  );

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

    const pwValidation = validatePassword(form.contrasena);
    if (!pwValidation.valid) {
      setError(pwValidation.errors[0]);
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.contrasena}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contrasena: e.target.value }))
                }
                placeholder="••••••••"
                autoComplete="new-password"
                required
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  boxShadow: 'none',
                  color: 'var(--muted)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.contrasena && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.35rem'
                }}>
                  <div style={{
                    flex: 1,
                    height: '4px',
                    background: 'var(--border)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${passwordStrength.score}%`,
                      height: '100%',
                      background: passwordStrength.level === 'high'
                        ? '#16a34a'
                        : passwordStrength.level === 'medium'
                          ? '#f59e0b'
                          : '#ef4444',
                      borderRadius: '2px',
                      transition: 'width 0.3s, background 0.3s'
                    }} />
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: passwordStrength.level === 'high'
                      ? '#16a34a'
                      : passwordStrength.level === 'medium'
                        ? '#f59e0b'
                        : '#ef4444'
                  }}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.15rem 0.75rem' }}>
                  {[
                    { ok: passwordChecks.length, label: '12–20 caracteres' },
                    { ok: passwordChecks.uppercase, label: 'Mayúscula' },
                    { ok: passwordChecks.lowercase, label: 'Minúscula' },
                    { ok: passwordChecks.number, label: 'Número' },
                    { ok: passwordChecks.symbol, label: 'Símbolo' }
                  ].map((r) => (
                    <span key={r.label} style={{
                      color: r.ok ? '#16a34a' : 'var(--muted)',
                      fontWeight: r.ok ? 600 : 400
                    }}>
                      {r.ok ? '✓' : '○'} {r.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </label>

          <label className="field">
            <span>Confirmar contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
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
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  boxShadow: 'none',
                  color: 'var(--muted)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.confirmar_contrasena && form.contrasena !== form.confirmar_contrasena && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', display: 'block' }}>
                Las contraseñas no coinciden.
              </span>
            )}
            {form.confirmar_contrasena && form.contrasena === form.confirmar_contrasena && form.contrasena && (
              <span style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem', display: 'block' }}>
                ✓ Las contraseñas coinciden.
              </span>
            )}
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