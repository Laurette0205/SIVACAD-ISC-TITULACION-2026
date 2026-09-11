/**
 * SIVACAD-ISC — Información Laboral del Alumno
 * FASE 7: Vista de información laboral (solo lectura + edición)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function AlumnoInfoLaboralPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
      const resp = await api.alumnoInfoLaboral(token);
      if (resp.ok) {
        setData(resp.data);
        setForm(resp.data || {
          trabaja_actualmente: false, empresa: '', puesto: '',
          telefono_laboral: '', direccion_laboral: '', municipio: '',
          horario: '', contacto_laboral_autorizado: ''
        });
      } else if (resp.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
    } catch (e) {
      if (e?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) setValidationErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (form.empresa && form.empresa.length > 200) errs.empresa = 'Máximo 200 caracteres';
    if (form.puesto && form.puesto.length > 150) errs.puesto = 'Máximo 150 caracteres';
    if (form.telefono_laboral && !/^\d{10}$/.test(String(form.telefono_laboral).trim())) {
      errs.telefono_laboral = 'Debe ser exactamente 10 dígitos numéricos';
    }
    if (form.direccion_laboral && form.direccion_laboral.length > 500) {
      errs.direccion_laboral = 'Máximo 500 caracteres';
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const resp = await api.alumnoInfoLaboralActualizar(token, form);
      if (resp.ok) {
        setEditing(false);
        await loadData();
      } else {
        setError(resp.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 size={32} className="spin" /> Cargando información laboral...
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Briefcase size={20} /> Información Laboral</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Datos de tu empleo actual o búsqueda de trabajo
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="section-card">
        <h3 style={{ marginBottom: '1rem' }}>Estado laboral</h3>
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={!!form.trabaja_actualmente}
              onChange={(e) => handleChange('trabaja_actualmente', e.target.checked)}
              disabled={!editing}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.95rem' }}>Trabajo actualmente</span>
          </div>
        </div>
      </div>

      {form.trabaja_actualmente && (
        <div className="section-card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Datos del empleo</h3>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div className="field">
              <span>Empresa</span>
              {editing ? (
                <input type="text" value={form.empresa || ''} onChange={(e) => handleChange('empresa', e.target.value)}
                  placeholder="Nombre de la empresa" />
              ) : (
                <div className="info-value">{data?.empresa || '—'}</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="field">
                <span>Puesto</span>
                {editing ? (
                  <input type="text" value={form.puesto || ''} onChange={(e) => handleChange('puesto', e.target.value)}
                    placeholder="Tu puesto actual" />
                ) : (
                  <div className="info-value">{data?.puesto || '—'}</div>
                )}
              </div>
              <div className="field">
                <span>Teléfono laboral</span>
                {editing ? (
                  <input type="tel" value={form.telefono_laboral || ''} onChange={(e) => handleChange('telefono_laboral', e.target.value)}
                    placeholder="10 dígitos" maxLength={10} />
                ) : (
                  <div className="info-value">{data?.telefono_laboral || '—'}</div>
                )}
                {editing && validationErrors.telefono_laboral && (
                  <span className="field-error">{validationErrors.telefono_laboral}</span>
                )}
              </div>
            </div>

            <div className="field">
              <span>Dirección laboral</span>
              {editing ? (
                <input type="text" value={form.direccion_laboral || ''} onChange={(e) => handleChange('direccion_laboral', e.target.value)}
                  placeholder="Dirección completa" />
              ) : (
                <div className="info-value">{data?.direccion_laboral || '—'}</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="field">
                <span>Municipio/Alcaldía</span>
                {editing ? (
                  <input type="text" value={form.municipio || ''} onChange={(e) => handleChange('municipio', e.target.value)}
                    placeholder="Municipio" />
                ) : (
                  <div className="info-value">{data?.municipio || '—'}</div>
                )}
              </div>
              <div className="field">
                <span>Horario</span>
                {editing ? (
                  <input type="text" value={form.horario || ''} onChange={(e) => handleChange('horario', e.target.value)}
                    placeholder="Ej: 8:00 - 17:00" />
                ) : (
                  <div className="info-value">{data?.horario || '—'}</div>
                )}
              </div>
            </div>

            <div className="field">
              <span>Contacto laboral autorizado</span>
              {editing ? (
                <input type="text" value={form.contacto_laboral_autorizado || ''} onChange={(e) => handleChange('contacto_laboral_autorizado', e.target.value)}
                  placeholder="Nombre y teléfono del contacto autorizado" />
              ) : (
                <div className="info-value">{data?.contacto_laboral_autorizado || '—'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        {editing ? (
          <>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); setForm(data || {}); setValidationErrors({}); }} disabled={saving}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Guardar cambios
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            ✏️ Editar información
          </button>
        )}
      </div>
    </div>
  );
}
