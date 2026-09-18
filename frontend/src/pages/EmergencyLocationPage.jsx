/**
 * SIVACAD-ISC — Compartir Ubicación de Emergencia
 * El alumno activa/desactiva la ubicación de forma voluntaria
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Shield, Clock, AlertTriangle, CheckCircle2, WifiOff, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DURACION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 480, label: '8 horas (máximo)' }
];

export default function EmergencyLocationPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [ubicacion, setUbicacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [duracion, setDuracion] = useState(60);
  const [showForm, setShowForm] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const clearFeedback = useCallback(() => {
    setTimeout(() => setFeedback(null), 5000);
  }, []);

  const loadUbicacion = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) { navigate('/login', { replace: true }); return; }
      const data = await api.request('/ubicacion-emergencia', { token });
      setUbicacion(data?.ubicacion || null);
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { loadUbicacion(); }, [loadUbicacion]);

  useEffect(() => {
    if (!ubicacion?.activa || !ubicacion?.fecha_expiracion) { setTimeLeft(null); return; }
    const interval = setInterval(() => {
      const expira = new Date(ubicacion.fecha_expiracion).getTime();
      const ahora = Date.now();
      const diff = expira - ahora;
      if (diff <= 0) {
        setTimeLeft(null);
        loadUbicacion();
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [ubicacion?.activa, ubicacion?.fecha_expiracion, loadUbicacion]);

  const handleActivar = async () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización');
      return;
    }
    setActivating(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
      const { latitude, longitude, accuracy } = position.coords;
      const data = await api.request('/ubicacion-emergencia/activar', {
        token, method: 'POST',
        body: { latitud: latitude, longitud: longitude, precision_metros: Math.round(accuracy), motivo, duracion_minutos: duracion }
      });
      setFeedback({ type: 'success', message: data?.message || 'Ubicación activada correctamente' });
      clearFeedback();
      setShowForm(false);
      setMotivo('');
      await loadUbicacion();
    } catch (err) {
      if (err?.code === 1) setGpsError('Permiso de ubicación denegado. Habilita la ubicación en tu navegador.');
      else if (err?.code === 2) setGpsError('No se pudo obtener tu ubicación. Intenta de nuevo.');
      else if (err?.code === 3) setGpsError('Tiempo de espera agotado. Intenta de nuevo.');
      else setFeedback({ type: 'error', message: err?.message || 'Error al activar ubicación' });
      clearFeedback();
    } finally {
      setActivating(false);
    }
  };

  const handleDesactivar = async () => {
    setDeactivating(true);
    try {
      await api.request('/ubicacion-emergencia/desactivar', { token, method: 'POST' });
      setFeedback({ type: 'success', message: 'Ubicación desactivada' });
      clearFeedback();
      await loadUbicacion();
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error al desactivar' });
      clearFeedback();
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><MapPin size={20} /> Compartir Ubicación de Emergencia</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Comparte tu ubicación solo durante una situación de emergencia
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
          {feedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {feedback.message}
        </div>
      )}

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Shield size={20} />
          <h3 style={{ margin: 0 }}>Política de Ubicación</h3>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <li>Tu ubicación <strong>solo</strong> se comparte durante una emergencia activa</li>
          <li>Puedes <strong>desactivarla en cualquier momento</strong></li>
          <li>La ubicación <strong>expira automáticamente</strong> después del tiempo seleccionado</li>
          <li>Cada consulta de tu ubicación queda <strong>registrada en auditoría</strong></li>
          <li>Solo el <strong>personal autorizado</strong> puede consultar tu ubicación</li>
        </ul>
      </div>

      {ubicacion?.activa ? (
        <div className="section-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                <strong style={{ color: '#22c55e' }}>Ubicación Activa</strong>
              </div>
              {ubicacion.motivo && <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>{ubicacion.motivo}</p>}
            </div>
            {timeLeft && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.85rem' }}>
                <Clock size={14} /> Expira en: {timeLeft}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            <div><strong>Latitud:</strong> {ubicacion.latitud}</div>
            <div><strong>Longitud:</strong> {ubicacion.longitud}</div>
            <div><strong>Precisión:</strong> {ubicacion.precision_metros}m</div>
            <div><strong>Duración:</strong> {ubicacion.duracion_minutos} min</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger" onClick={handleDesactivar} disabled={deactivating}>
              {deactivating ? <Loader2 size={16} className="spin" /> : <EyeOff size={16} />} Desactivar Ubicación
            </button>
          </div>
        </div>
      ) : showForm ? (
        <div className="section-card">
          <h3 style={{ marginBottom: '1rem' }}>Activar Compartir Ubicación</h3>

          {gpsError && (
            <div className="alert error" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} /> {gpsError}
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div className="field">
              <span>Motivo de la emergencia *</span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe brevemente la situación..."
                rows={3}
              />
            </div>
            <div className="field">
              <span>Duración</span>
              <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                {DURACION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setGpsError(null); }} disabled={activating}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleActivar} disabled={activating || !motivo.trim()}>
              {activating ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />} Compartir Mi Ubicación
            </button>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <MapPin size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            No estás compartiendo tu ubicación actualmente.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Eye size={16} /> Activar Compartir Ubicación
          </button>
        </div>
      )}
    </div>
  );
}
