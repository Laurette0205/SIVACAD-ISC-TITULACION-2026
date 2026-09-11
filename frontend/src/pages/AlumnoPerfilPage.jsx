import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User, Mail, BookOpen, Hash, CreditCard, Calendar, Award,
  GraduationCap, Edit3, Save, X, Loader2, AlertTriangle, Phone,
  MapPin, FileText, TrendingUp, CheckCircle2, Clock, FileUp
} from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch { return String(value); }
}

function validateField(name, value) {
  const val = String(value || '').trim();
  if (!val) return null;
  switch (name) {
    case 'nombres':
      if (val.length > 120) return 'Máximo 120 caracteres';
      if (!/^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s'-]+$/.test(val)) return 'Solo letras, espacios, guiones y apóstrofes';
      return null;
    case 'apellido_paterno':
    case 'apellido_materno':
      if (val.length > 160) return 'Máximo 160 caracteres';
      if (!/^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s'-]+$/.test(val)) return 'Solo letras, espacios, guiones y apóstrofes';
      return null;
    case 'curp':
      if (val.length !== 18) return 'Debe tener 18 caracteres';
      if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(val)) return 'Formato CURP inválido';
      return null;
    default:
      return null;
  }
}

export default function AlumnoPerfilPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = React.useState(null);
  const [estadisticas, setEstadisticas] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState({});
  const [editForm, setEditForm] = React.useState({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    curp: ''
  });

  const ROLES_PERMITIDOS = ['alumno'];
  if (!user || !ROLES_PERMITIDOS.includes(String(user.rol || '').toLowerCase())) {
    return <Navigate to="/app" replace />;
  }

  const loadPerfil = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
      const [perfilRes, statsRes] = await Promise.all([
        api.alumnoPerfil(token),
        api.alumnoPerfilEstadisticas(token).catch(() => null)
      ]);
      setPerfil(perfilRes?.data || null);
      setEstadisticas(statsRes?.data || null);
    } catch (err) {
      if (err?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.message || 'Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { loadPerfil(); }, [loadPerfil]);

  const handleEdit = () => {
    setEditForm({
      nombres: perfil?.nombres || '',
      apellido_paterno: perfil?.apellido_paterno || '',
      apellido_materno: perfil?.apellido_materno || '',
      curp: perfil?.curp || ''
    });
    setFieldErrors({});
    setEditing(true);
    setSuccess('');
    setError('');
  };

  const handleCancel = () => {
    setEditing(false);
    setEditForm({ nombres: '', apellido_paterno: '', apellido_materno: '', curp: '' });
    setFieldErrors({});
  };

  const handleChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    const err = validateField(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: err }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const errors = {};
      for (const [key, val] of Object.entries(editForm)) {
        const err = validateField(key, val);
        if (err) errors[key] = err;
      }
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        setError('Corrija los errores antes de guardar');
        setSaving(false);
        return;
      }

      await api.alumnoPerfilActualizar(token, editForm);
      setSuccess('Perfil actualizado correctamente');
      setEditing(false);
      setFieldErrors({});
      await loadPerfil();
    } catch (err) {
      setError(err?.message || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 size={32} className="spin" />
        <span>Cargando perfil...</span>
      </div>
    );
  }

  if (error && !perfil) {
    return (
      <div className="page-error">
        <AlertTriangle size={32} />
        <span>{error}</span>
        <button className="btn btn-primary" onClick={loadPerfil}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1><User size={24} /> Información Personal</h1>
          <p className="muted">Consulta y administra tus datos personales y académicos</p>
        </div>
        {!editing && (
          <button className="btn btn-primary" onClick={handleEdit}>
            <Edit3 size={16} /> Editar perfil
          </button>
        )}
      </header>

      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid-two">
        {/* DATOS PERSONALES */}
        <SectionCard title="Datos personales" subtitle="Información registrada en tu cuenta">
          {perfil ? (
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label"><User size={14} /> Nombre(s): </span>
                <span className="info-value">
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.nombres}
                        onChange={(e) => handleChange('nombres', e.target.value)}
                        maxLength={120}
                        placeholder="Nombre(s)"
                        style={{ maxWidth: 280 }}
                      />
                      {fieldErrors.nombres && <small style={{ color: '#ef4444' }}>{fieldErrors.nombres}</small>}
                    </div>
                  ) : (
                    perfil.nombres || '—'
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><User size={14} /> Apellido paterno: </span>
                <span className="info-value">
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.apellido_paterno}
                        onChange={(e) => handleChange('apellido_paterno', e.target.value)}
                        maxLength={160}
                        placeholder="Apellido paterno"
                        style={{ maxWidth: 280 }}
                      />
                      {fieldErrors.apellido_paterno && <small style={{ color: '#ef4444' }}>{fieldErrors.apellido_paterno}</small>}
                    </div>
                  ) : (
                    perfil.apellido_paterno || '—'
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><User size={14} /> Apellido materno: </span>
                <span className="info-value">
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.apellido_materno}
                        onChange={(e) => handleChange('apellido_materno', e.target.value)}
                        maxLength={160}
                        placeholder="Apellido materno"
                        style={{ maxWidth: 280 }}
                      />
                      {fieldErrors.apellido_materno && <small style={{ color: '#ef4444' }}>{fieldErrors.apellido_materno}</small>}
                    </div>
                  ) : (
                    perfil.apellido_materno || '—'
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><Mail size={14} /> Correo institucional: </span>
                <span className="info-value">{perfil.correo_institucional || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Hash size={14} /> Matrícula: </span>
                <span className="info-value">{perfil.matricula || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><CreditCard size={14} /> CURP: </span>
                <span className="info-value">
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.curp}
                        onChange={(e) => handleChange('curp', e.target.value.toUpperCase())}
                        maxLength={18}
                        placeholder="18 caracteres"
                        style={{ maxWidth: 250 }}
                      />
                      {fieldErrors.curp && <small style={{ color: '#ef4444' }}>{fieldErrors.curp}</small>}
                    </div>
                  ) : (
                    perfil.curp || '—'
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><CheckCircle2 size={14} /> Estado: </span>
                <span className="info-value">
                  <span className={`status ${perfil.estado === 'Activo' ? 'ok' : 'error'}`}>
                    {perfil.estado || '—'}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="empty">No hay datos disponibles</div>
          )}
        </SectionCard>

        {/* INFORMACIÓN ACADÉMICA */}
        <SectionCard title="Información académica" subtitle="Datos de tu trayectoria en el instituto">
          {perfil ? (
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label"><GraduationCap size={14} /> Carrera: </span>
                <span className="info-value">{perfil.nombre_carrera || '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><BookOpen size={14} /> Plan de estudios: </span>
                <span className="info-value">{perfil.nombre_plan || `Plan ${perfil.id_plan}`}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Calendar size={14} /> Semestre actual: </span>
                <span className="info-value">{perfil.semestre_actual ? `${perfil.semestre_actual}°` : '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Award size={14} /> Estatus académico: </span>
                <span className="info-value">
                  <span className={`status ${perfil.estatus_academico === 'Regular' ? 'ok' : 'warn'}`}>
                    {perfil.estatus_academico || '—'}
                  </span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label"><Clock size={14} /> Último acceso: </span>
                <span className="info-value">{formatDate(perfil.ultimo_acceso)}</span>
              </div>
            </div>
          ) : (
            <div className="empty">No hay datos disponibles</div>
          )}
        </SectionCard>
      </div>

      {/* ESTADÍSTICAS ACADÉMICAS */}
      {estadisticas && (
        <SectionCard title="Resumen académico" subtitle="Tu desempeño general en el instituto">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Materias cursadas: </div>
              <div className="stat-value">{estadisticas.total_materias || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Aprobadas: </div>
              <div className="stat-value" style={{ color: '#22c55e' }}>{estadisticas.materias_aprobadas || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Reprobadas: </div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{estadisticas.materias_reprobadas || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Promedio general: </div>
              <div className="stat-value"><TrendingUp size={16} /> {estadisticas.promedio_general || '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Créditos acumulados: </div>
              <div className="stat-value">{estadisticas.total_creditos || 0}</div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* CONTACTOS DE EMERGENCIA */}
      <SectionCard title="Contactos de emergencia" subtitle="Gestiona tus contactos para situaciones urgentes">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Administra las personas a contactar en caso de emergencia.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/app/contactos-emergencia')}
          >
            <Phone size={16} /> Gestionar contactos
          </button>
        </div>
      </SectionCard>

      {/* INFORMACIÓN MÉDICA */}
      <SectionCard title="Información médica y psicológica" subtitle="Datos de salud confidenciales">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Tipo de sangre, alergias, medicamentos, información psicológica.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/app/alumno-info-medica')}
          >
            📋 Ver información médica
          </button>
        </div>
      </SectionCard>

      {/* INFORMACIÓN LABORAL */}
      <SectionCard title="Información laboral" subtitle="Estado de empleo actual">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Empresa, puesto, horario y contacto laboral autorizado.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/app/alumno-info-laboral')}
          >
            💼 Ver información laboral
          </button>
        </div>
      </SectionCard>

      {/* DOCUMENTOS SENSIBLES */}
      <SectionCard title="Documentos personales" subtitle="Gestiona tus documentos oficiales">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Sube y administra tus documentos: INE, CURP, actas, certificados médicos.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate('/app/alumno-documentos')}
          >
            <FileUp size={16} /> Gestionar documentos
          </button>
        </div>
      </SectionCard>

      {editing && (
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
            <X size={16} /> Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}
