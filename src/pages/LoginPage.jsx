import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowRight,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  playSuccessSound,
  playErrorSound
} from '../utils/soundManager';
import SoundToggleButton from '../components/SoundToggleButton';
import '../styles/global.css';

/**
 * Página de inicio de sesión para SIVACAD
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { toggleTheme } = useTheme();

  const [form, setForm] = React.useState({
    correo: '',
    contrasena: ''
  });

  const [error, setError] = React.useState('');
  const [sessionMessage, setSessionMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    const msg = sessionStorage.getItem('sivacad_auth_error');
    if (msg) {
      setSessionMessage(msg);
      sessionStorage.removeItem('sivacad_auth_error');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({
        correo: form.correo.trim().toLowerCase(),
        contrasena: form.contrasena
      });

      await playSuccessSound();

      const redirectTo =
        location.state?.from ||
        result?.redirectTo ||
        '/app';

      navigate(redirectTo, { replace: true });
    } catch (err) {
      await playErrorSound();

      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Error al iniciar sesión'
      );
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
            Sistema de Valoración y Calificación para el Desempeño de Docentes y Alumnos
          </h1>

          <p>
            Plataforma integral para la gestión académica de alumnos, docentes,
            coordinadores y administradores del área de Ingeniería en Sistemas
            Computacionales del TESI.
          </p>

          <div className="feature-grid">
            <div className="mini-card">
              <strong>
                <GraduationCap size={16} style={{ marginRight: 6 }} />
                Gestión Académica
              </strong>
              <span>
                Control de alumnos, grupos, evaluaciones, periodos y seguimiento escolar.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <Sparkles size={16} style={{ marginRight: 6 }} />
                Inteligencia Académica
              </strong>
              <span>
                Análisis inteligente para evaluación institucional y detección temprana.
              </span>
            </div>

            <div className="mini-card">
              <strong>
                <ShieldCheck size={16} style={{ marginRight: 6 }} />
                Acceso por Rol
              </strong>
              <span>
                Cada usuario accede con permisos específicos según su perfil institucional.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-head">
          <div>
            <div className="eyebrow">Acceso institucional</div>
            <h2>Iniciar sesión</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Ingresa tu correo institucional y tu contraseña para acceder al sistema.
              El rol de acceso será identificado automáticamente al autenticar tus credenciales.
            </p>
          </div>

          <div className="row gap wrap">
            <SoundToggleButton />
            <button
              className="btn secondary"
              type="button"
              onClick={toggleTheme}
            >
              Cambiar tema
            </button>
          </div>
        </div>

        <div className="auth-note">
          <div className="eyebrow">Indicaciones de acceso</div>
          <p style={{ marginTop: '0.4rem', marginBottom: 0, lineHeight: 1.7 }}>
            Si ya cuentas con registro institucional, solo necesitas ingresar tu correo
            y contraseña. Si aún no tienes acceso, selecciona la opción <strong>Crear cuenta</strong> para registrarte
            según tu perfil académico o administrativo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Correo institucional</span>
            <input
              type="email"
              placeholder="usuario@institucion.edu.mx"
              value={form.correo}
              onChange={(e) =>
                setForm({ ...form, correo: e.target.value })
              }
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.contrasena}
                onChange={(e) =>
                  setForm({ ...form, contrasena: e.target.value })
                }
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
          </label>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '-0.35rem' }}>
            <button
              type="button"
              className="btn link"
              style={{ padding: 0, boxShadow: 'none' }}
              onClick={() => navigate('/forgot-password')}
            >
              <KeyRound size={16} />
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {sessionMessage && (
            <div className="auth-note" style={{ marginBottom: '0.5rem', border: '1px solid #f59e0b', background: '#fef3c7', color: '#92400e' }}>
              <div className="eyebrow" style={{ color: '#92400e' }}>Sesión finalizada</div>
              <p style={{ margin: '0.35rem 0 0', lineHeight: 1.6 }}>{sessionMessage}</p>
            </div>
          )}

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          <button
            className="btn primary full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Validando credenciales...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Entrar al sistema
              </>
            )}
          </button>

          <button
            type="button"
            className="btn link full"
            onClick={() => navigate('/register')}
          >
            Crear cuenta
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}