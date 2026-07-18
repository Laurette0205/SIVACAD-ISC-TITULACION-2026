import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowLeft,
  BadgeInfo,
  BookOpen,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UserRound,
  Users,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  playSuccessSound,
  playErrorSound
} from '../utils/soundManager';

import SoundToggleButton from '../components/SoundToggleButton';
import '../styles/global.css';

const LOWER_NAME_EXCEPTIONS = new Set(['de', 'del', 'de la', 'de las', 'de los', 'y', 'e', 'van', 'von', 'da', 'dos']);

function capitalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (LOWER_NAME_EXCEPTIONS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

const ROLE_OPTIONS = [
  {
    value: 'alumno',
    title: 'Alumno',
    icon: GraduationCap,
    hint: 'Registro con matrícula, CURP y semestre actual.'
  },
  {
    value: 'docente',
    title: 'Docente',
    icon: BookOpen,
    hint: 'Registro con número de empleado, CURP y especialidad.'
  },
  {
    value: 'coordinador',
    title: 'Coordinador',
    icon: Users,
    hint: 'Registro institucional con número de empleado y especialidad.'
  },
  {
    value: 'administrador',
    title: 'Administrador',
    icon: ShieldCheck,
    hint: 'Acceso total al sistema con datos institucionales.'
  },
  {
    value: 'soporte',
    title: 'Soporte',
    icon: Sparkles,
    hint: 'Acceso técnico con número de empleado y especialidad.'
  }
];

const ALLOWED_EMAIL_DOMAINS = [
  'tesi.edu.mx',
  'ixtapaluca.tecnm.mx',
  'ixtapaluca.tecnm.edu.mx',
  'outlook.com',
  'outlook.es'
];

function isAllowedInstitutionalEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const atIndex = value.lastIndexOf('@');

  if (atIndex === -1) return false;

  const domain = value.slice(atIndex + 1).trim();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { toggleTheme } = useTheme();

  const [role, setRole] = React.useState('alumno');

  const [form, setForm] = React.useState({
    apellido_paterno: '',
    apellido_materno: '',
    nombres: '',
    correo: '',
    contrasena: '',
    confirmar_contrasena: '',

    matricula: '',
    curp: '',
    semestre_actual: 1,

    numero_empleado: '',
    especialidad: '',

    id_carrera: 1,
    id_plan: 1
  });

  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const selectedRole = ROLE_OPTIONS.find((item) => item.value === role);

  const switchRole = (nextRole) => {
    setRole(nextRole);
    setForm((prev) => ({
      ...prev,
      rol: nextRole,
      matricula: nextRole === 'alumno' ? prev.matricula : '',
      semestre_actual: nextRole === 'alumno' ? prev.semestre_actual : 1,
      numero_empleado: nextRole === 'alumno' ? '' : prev.numero_empleado,
      especialidad: nextRole === 'alumno' ? '' : prev.especialidad
    }));
    setError('');
    setMessage('');
  };

  const handleChange = (field) => (e) => {
    const rawValue =
      e.target.type === 'number' ? Number(e.target.value) : e.target.value;

    let normalizedValue = rawValue;

    if (typeof rawValue === 'string') {
      if (
        field === 'curp' ||
        field === 'matricula' ||
        field === 'numero_empleado'
      ) {
        normalizedValue = rawValue.toUpperCase();
      }
      if (
        field === 'nombres' ||
        field === 'apellido_paterno' ||
        field === 'apellido_materno'
      ) {
        normalizedValue = capitalizeName(rawValue);
      }
    }

    setForm((prev) => ({
      ...prev,
      [field]: normalizedValue
    }));
  };

  const validateByRole = () => {
    if (form.contrasena !== form.confirmar_contrasena) {
      return 'Las contraseñas no coinciden.';
    }

    if (!form.apellido_paterno.trim()) return 'El apellido paterno es obligatorio.';
    if (!form.apellido_materno.trim()) return 'El apellido materno es obligatorio.';
    if (!form.nombres.trim()) return 'Los nombres son obligatorios.';
    if (!form.correo.trim()) return 'El correo es obligatorio.';

    if (!isAllowedInstitutionalEmail(form.correo)) {
      return 'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.';
    }

    if (!form.contrasena.trim()) return 'La contraseña es obligatoria.';
    if (form.contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';

    if (role === 'alumno') {
      if (!form.matricula.trim()) return 'La matrícula es obligatoria para alumnos.';
      if (!form.curp.trim()) return 'La CURP es obligatoria para alumnos.';
      if (!Number(form.semestre_actual) || Number(form.semestre_actual) < 1) {
        return 'El semestre debe ser un número válido.';
      }
    }

    if (
      role === 'docente' ||
      role === 'coordinador' ||
      role === 'administrador' ||
      role === 'soporte'
    ) {
      if (!form.numero_empleado.trim()) {
        return 'El número de empleado es obligatorio para este perfil.';
      }
      if (!form.curp.trim()) {
        return 'La CURP es obligatoria para este perfil.';
      }
      if (!form.especialidad.trim()) {
        return 'La especialidad es obligatoria para este perfil.';
      }
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const validationError = validateByRole();
    if (validationError) {
      setError(validationError);
      await playErrorSound();
      return;
    }

    setLoading(true);

    try {
      const payload = {
        apellido_paterno: capitalizeName(form.apellido_paterno),
        apellido_materno: capitalizeName(form.apellido_materno),
        nombres: capitalizeName(form.nombres),
        nombre_completo:
          `${capitalizeName(form.nombres)} ${capitalizeName(form.apellido_paterno)} ${capitalizeName(form.apellido_materno)}`
            .replace(/\s+/g, ' ')
            .trim(),
        correo: form.correo.trim().toLowerCase(),
        contrasena: form.contrasena,
        password: form.contrasena,
        confirmar_contrasena: form.confirmar_contrasena,
        rol: role,
        matricula: form.matricula.trim(),
        curp: form.curp.trim().toUpperCase(),
        numero_empleado: form.numero_empleado.trim().toUpperCase(),
        especialidad: form.especialidad.trim(),
        semestre_actual: Number(form.semestre_actual || 1),
        id_carrera: Number(form.id_carrera || 1),
        id_plan: Number(form.id_plan || 1)
      };

      const response = await register(payload);

      await playSuccessSound();

      setMessage(response?.message || 'Usuario registrado correctamente');

      setTimeout(() => {
        const redirectTo =
          response?.redirectTo ||
          (response?.token ? '/app' : '/login');
        navigate(redirectTo, { replace: true });
      }, 1300);
    } catch (err) {
      await playErrorSound();

      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Error al registrar usuario'
      );
    } finally {
      setLoading(false);
    }
  };

  const roleDescription =
    role === 'alumno'
      ? 'Orden de captura: Apellido Paterno, Apellido Materno, Nombre(s), Correo, Contraseña, Confirmar Contraseña, Matrícula, CURP y Semestre actual.'
      : 'Orden de captura: Apellido Paterno, Apellido Materno, Nombre(s), Correo, Contraseña, Confirmar Contraseña, Número de Empleado, CURP y Especialidad.';

  return (
    <div className="page narrow">
      <section className="section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">SIVACAD | ISC</div>
            <h2>Registro institucional</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Selecciona el tipo de cuenta y completa únicamente los campos correspondientes a tu perfil.
              El sistema mantendrá el acceso y los permisos de acuerdo con el rol elegido.
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

            <button
              className="btn secondary"
              type="button"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={16} />
              Volver
            </button>
          </div>
        </div>

        <div className="full auth-note" style={{ marginBottom: '1rem' }}>
          <div className="eyebrow">
            <BadgeInfo size={14} />
            Selección de perfil
          </div>
          <p style={{ marginTop: '0.6rem', marginBottom: 0, lineHeight: 1.75 }}>
            En SIVACAD, cada usuario se registra según su función institucional. El formulario se adapta
            automáticamente para alumno, docente, coordinador, administrador o soporte.
          </p>
        </div>

        <div
          className="auth-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginBottom: '1rem'
          }}
        >
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = role === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => switchRole(option.value)}
                className={`role-card ${active ? 'active' : ''}`}
              >
                <div className="row gap">
                  <Icon size={18} />
                  <strong className="role-card-title">{option.title}</strong>
                </div>
                <span className="role-card-hint">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <form className="grid-form" onSubmit={handleSubmit}>
          <div className="full auth-note">
            <div className="eyebrow">{selectedRole?.title}</div>
            <h3 style={{ margin: '0.25rem 0 0.35rem' }}>Orden recomendado de captura</h3>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              {roleDescription}
            </p>
          </div>

          <label className="field">
            <span>Apellido Paterno</span>
            <input
              value={form.apellido_paterno}
              onChange={handleChange('apellido_paterno')}
              placeholder="Apellido paterno"
              autoComplete="family-name"
              required
            />
          </label>

          <label className="field">
            <span>Apellido Materno</span>
            <input
              value={form.apellido_materno}
              onChange={handleChange('apellido_materno')}
              placeholder="Apellido materno"
              autoComplete="family-name"
              required
            />
          </label>

          <label className="field">
            <span>Nombre(s)</span>
            <input
              value={form.nombres}
              onChange={handleChange('nombres')}
              placeholder="Nombre(s)"
              autoComplete="given-name"
              required
            />
          </label>

          <label className="field">
            <span>Correo Institucional</span>
            <input
              type="email"
              value={form.correo}
              onChange={handleChange('correo')}
              placeholder="usuario@institucion.edu.mx"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.contrasena}
                onChange={handleChange('contrasena')}
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
          </label>

          <label className="field">
            <span>Confirmar Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmar_contrasena}
                onChange={handleChange('confirmar_contrasena')}
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
          </label>

          {role === 'alumno' ? (
            <>
              <label className="field">
                <span>Matrícula</span>
                <input
                  value={form.matricula}
                  onChange={handleChange('matricula')}
                  placeholder="Matrícula del alumno"
                  required
                />
              </label>

              <label className="field">
                <span>CURP</span>
                <input
                  value={form.curp}
                  onChange={handleChange('curp')}
                  placeholder="CURP"
                  required
                />
              </label>

              <label className="field">
                <span>Semestre actual</span>
                <input
                  type="number"
                  min="1"
                  value={form.semestre_actual}
                  onChange={handleChange('semestre_actual')}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Número de Empleado</span>
                <input
                  value={form.numero_empleado}
                  onChange={handleChange('numero_empleado')}
                  placeholder="Número de empleado"
                  required
                />
              </label>

              <label className="field">
                <span>CURP</span>
                <input
                  value={form.curp}
                  onChange={handleChange('curp')}
                  placeholder="CURP"
                  required
                />
              </label>

              <label className="field">
                <span>Especialidad</span>
                <input
                  value={form.especialidad}
                  onChange={handleChange('especialidad')}
                  placeholder="Especialidad o área"
                  required
                />
              </label>
            </>
          )}

          {error && <div className="alert error full">{error}</div>}
          {message && <div className="alert success full">{message}</div>}

          <button className="btn primary full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Registrando...
              </>
            ) : (
              <>
                <UserRound size={18} />
                Crear cuenta
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}