/**
 * SIVACAD-ISC — Información Médica del Alumno
 * FASE 6: Vista de información médica/psicológica (solo lectura + edición)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function AlumnoInfoMedicaPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
      const resp = await api.alumnoInfoMedica(token);
      if (resp.ok) {
        setData(resp.data);
        setForm(resp.data || {
          tipo_sangre: '', alergias: '', restricciones_fisicas: '',
          medicamentos: '', condiciones_cronicas: '',
          informacion_psicologica: '', notas_autorizadas: ''
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
    if (validationErrors[key]) {
      setValidationErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (form.tipo_sangre && form.tipo_sangre.length > 5) {
      errs.tipo_sangre = 'Máximo 5 caracteres';
    }
    if (form.alergias && form.alergias.length > 2000) {
      errs.alergias = 'Máximo 2000 caracteres';
    }
    if (form.medicamentos && form.medicamentos.length > 2000) {
      errs.medicamentos = 'Máximo 2000 caracteres';
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const resp = await api.alumnoInfoMedicaActualizar(token, form);
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
        <Loader2 size={32} className="spin" /> Cargando información médica...
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
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Heart size={20} /> Información Médica</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Datos de salud y psicología — solo visible para ti y personal autorizado
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="section-card">
        <h3 style={{ marginBottom: '1rem' }}>Información de salud</h3>
        <div className="form-grid" style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="field">
            <span>Tipo de sangre</span>
            {editing ? (
              <select value={form.tipo_sangre || ''} onChange={(e) => handleChange('tipo_sangre', e.target.value)}>
                <option value="">Seleccionar...</option>
                {TIPOS_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <div className="info-value">{data?.tipo_sangre || '—'}</div>
            )}
          </div>

          <div className="field">
            <span>Alergias conocidas</span>
            {editing ? (
              <textarea value={form.alergias || ''} onChange={(e) => handleChange('alergias', e.target.value)}
                placeholder="Describe alergias conocidas..." rows={3} />
            ) : (
              <div className="info-value">{data?.alergias || 'Ninguna registrada'}</div>
            )}
            {editing && validationErrors.alergias && (
              <span className="field-error">{validationErrors.alergias}</span>
            )}
          </div>

          <div className="field">
            <span>Medicamentos actuales</span>
            {editing ? (
              <textarea value={form.medicamentos || ''} onChange={(e) => handleChange('medicamentos', e.target.value)}
                placeholder="Medicamentos que tomas actualmente..." rows={3} />
            ) : (
              <div className="info-value">{data?.medicamentos || 'Ninguno registrado'}</div>
            )}
            {editing && validationErrors.medicamentos && (
              <span className="field-error">{validationErrors.medicamentos}</span>
            )}
          </div>

          <div className="field">
            <span>Condiciones crónicas</span>
            {editing ? (
              <textarea value={form.condiciones_cronicas || ''} onChange={(e) => handleChange('condiciones_cronicas', e.target.value)}
                placeholder="Condiciones de salud a largo plazo..." rows={3} />
            ) : (
              <div className="info-value">{data?.condiciones_cronicas || 'Ninguna registrada'}</div>
            )}
          </div>

          <div className="field">
            <span>Restricciones físicas</span>
            {editing ? (
              <textarea value={form.restricciones_fisicas || ''} onChange={(e) => handleChange('restricciones_fisicas', e.target.value)}
                placeholder="Limitaciones físicas que debamos considerar..." rows={3} />
            ) : (
              <div className="info-value">{data?.restricciones_fisicas || 'Ninguna registrada'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="section-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Información psicológica</h3>
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="field">
            <span>Información psicológica (confidencial)</span>
            {editing ? (
              <textarea value={form.informacion_psicologica || ''} onChange={(e) => handleChange('informacion_psicologica', e.target.value)}
                placeholder="Información relevante para tu atención psicológica..." rows={4} />
            ) : (
              <div className="info-value">{data?.informacion_psicologica || 'Sin información registrada'}</div>
            )}
          </div>

          <div className="field">
            <span>Notas autorizadas</span>
            {editing ? (
              <textarea value={form.notas_autorizadas || ''} onChange={(e) => handleChange('notas_autorizadas', e.target.value)}
                placeholder="Notas adicionales autorizadas..." rows={3} />
            ) : (
              <div className="info-value">{data?.notas_autorizadas || 'Sin notas'}</div>
            )}
          </div>
        </div>
      </div>

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
