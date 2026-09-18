/**
 * SIVACAD-ISC — Acceso de Emergencia (Personal Autorizado)
 * Personal abre sesión de emergencia, busca alumno, obtiene datos mínimos
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Shield, AlertTriangle, CheckCircle2, Phone,
  Heart, MapPin, Clock, Loader2, XCircle, FileText, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function EmergencyAccessPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [sesionesActivas, setSesionesActivas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMatricula, setSearchMatricula] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [sesionSeleccionada, setSesionSeleccionada] = useState(null);
  const [datosAlumno, setDatosAlumno] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cerrando, setCerrando] = useState(null);

  const clearFeedback = useCallback(() => { setTimeout(() => setFeedback(null), 5000); }, []);

  const loadSesiones = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) { navigate('/login', { replace: true }); return; }
      const data = await api.request('/sesiones-emergencia/activas', { token });
      setSesionesActivas(data?.sesiones || []);
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { loadSesiones(); }, [loadSesiones]);

  const handleSearch = async () => {
    if (!searchMatricula.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const data = await api.request(`/alumnos?matricula=${encodeURIComponent(searchMatricula.trim())}`, { token });
      const alumnos = data?.alumnos || data?.data || [];
      setSearchResult(alumnos.length > 0 ? alumnos[0] : null);
      if (!alumnos.length) setFeedback({ type: 'error', message: 'Alumno no encontrado' });
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error buscando alumno' });
    } finally {
      setSearching(false);
      clearFeedback();
    }
  };

  const handleAbrirSesion = async () => {
    if (!searchResult || !justificacion.trim()) return;
    setAbriendo(true);
    try {
      const data = await api.request('/sesiones-emergencia/abrir', {
        token, method: 'POST',
        body: { idAlumno: searchResult.id_alumno, justificacion: justificacion.trim() }
      });
      setFeedback({ type: 'success', message: 'Sesión de emergencia abierta' });
      clearFeedback();
      setShowAbrirModal(false);
      setJustificacion('');
      setSearchResult(null);
      setSearchMatricula('');
      await loadSesiones();
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error abriendo sesión' });
      clearFeedback();
    } finally {
      setAbriendo(false);
    }
  };

  const handleVerDatos = async (sesion) => {
    setSesionSeleccionada(sesion);
    setDatosAlumno(null);
    setCargandoDatos(true);
    try {
      const data = await api.request(`/sesiones-emergencia/datos/${sesion.id}`, { token });
      setDatosAlumno(data?.datos || {});
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error cargando datos' });
      clearFeedback();
    } finally {
      setCargandoDatos(false);
    }
  };

  const handleCerrarSesion = async (idSesion) => {
    setCerrando(idSesion);
    try {
      await api.request(`/sesiones-emergencia/cerrar/${idSesion}`, { token, method: 'POST' });
      setFeedback({ type: 'success', message: 'Sesión cerrada' });
      clearFeedback();
      setSesionSeleccionada(null);
      setDatosAlumno(null);
      await loadSesiones();
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error cerrando sesión' });
      clearFeedback();
    } finally {
      setCerrando(null);
    }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Shield size={20} /> Acceso de Emergencia</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Acceso limitado a datos mínimos del alumno en situación de emergencia
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
          {feedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {feedback.message}
        </div>
      )}

      {/* Buscar alumno */}
      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Buscar Alumno</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchMatricula}
            onChange={(e) => setSearchMatricula(e.target.value)}
            placeholder="Matrícula del alumno"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !searchMatricula.trim()}>
            {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Buscar
          </button>
        </div>

        {searchResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{searchResult.nombres} {searchResult.apellido_paterno} {searchResult.apellido_materno || ''}</strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Matrícula: {searchResult.matricula}</div>
              </div>
              <button className="btn btn-danger" onClick={() => setShowAbrirModal(true)}>
                <AlertTriangle size={16} /> Abrir Sesión de Emergencia
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sesiones activas */}
      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Sesiones de Emergencia Activas</h3>
        {sesionesActivas.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
            No hay sesiones de emergencia activas
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {sesionesActivas.map((s) => (
              <div key={s.id} style={{
                padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px',
                border: sesionSeleccionada?.id === s.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer'
              }} onClick={() => handleVerDatos(s)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} /> <strong>{s.nombres} {s.apellido_paterno}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({s.matricula})</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Solicitante: {s.nombre_solicitante} — {new Date(s.fecha_apertura).toLocaleString('es-MX')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {s.justificacion?.substring(0, 120)}{s.justificacion?.length > 120 ? '...' : ''}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => { e.stopPropagation(); handleCerrarSesion(s.id); }}
                    disabled={cerrando === s.id}
                  >
                    {cerrando === s.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />} Cerrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Datos del alumno */}
      {datosAlumno && sesionSeleccionada && (
        <div className="section-card">
          <h3 style={{ marginBottom: '1rem' }}>Datos Mínimos de Emergencia</h3>

          {datosAlumno.identidad && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} /> Identidad
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div><strong>Nombre:</strong> {datosAlumno.identidad.nombres} {datosAlumno.identidad.apellido_paterno} {datosAlumno.identidad.apellido_materno || ''}</div>
                <div><strong>Matrícula:</strong> {datosAlumno.identidad.matricula}</div>
                <div><strong>Carrera:</strong> {datosAlumno.identidad.nombre_carrera || '—'}</div>
                <div><strong>Semestre:</strong> {datosAlumno.identidad.semestre_actual || '—'}</div>
                <div><strong>Estatus:</strong> {datosAlumno.identidad.estatus_academico || '—'}</div>
                {datosAlumno.identidad.curp && <div><strong>CURP:</strong> {datosAlumno.identidad.curp}</div>}
              </div>
            </div>
          )}

          {datosAlumno.contactos_emergencia?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={16} /> Contactos de Emergencia
              </h4>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {datosAlumno.contactos_emergencia.map((c, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <strong>{c.nombre}</strong> — {c.parentesco}
                    {c.prioridad && c.prioridad !== 'MEDIA' && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: '#ef444420', color: '#ef4444', borderRadius: '9999px' }}>
                        {c.prioridad}
                      </span>
                    )}
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Tel: {c.telefono}{c.telefono_alt ? ` / ${c.telefono_alt}` : ''}
                      {c.correo && <> — {c.correo}</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {datosAlumno.salud_basica && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={16} /> Salud Básica
              </h4>
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem' }}>
                {datosAlumno.salud_basica.tipo_sangre && <div><strong>Tipo de sangre:</strong> {datosAlumno.salud_basica.tipo_sangre}</div>}
                {datosAlumno.salud_basica.alergias && <div><strong>Alergias:</strong> {datosAlumno.salud_basica.alergias}</div>}
                {datosAlumno.salud_basica.medicamentos && <div><strong>Medicamentos:</strong> {datosAlumno.salud_basica.medicamentos}</div>}
                {datosAlumno.salud_basica.condiciones_cronicas && <div><strong>Condiciones:</strong> {datosAlumno.salud_basica.condiciones_cronicas}</div>}
              </div>
            </div>
          )}

          {datosAlumno.ubicacion && (
            <div>
              <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> Ubicación Compartida
              </h4>
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.9rem' }}>
                <div><strong>Latitud:</strong> {datosAlumno.ubicacion.latitud} — <strong>Longitud:</strong> {datosAlumno.ubicacion.longitud}</div>
                <div><strong>Precisión:</strong> {datosAlumno.ubicacion.precision_metros}m</div>
                <div><strong>Activa desde:</strong> {new Date(datosAlumno.ubicacion.fecha_activacion).toLocaleString('es-MX')}</div>
                <div><strong>Expira:</strong> {new Date(datosAlumno.ubicacion.fecha_expiracion).toLocaleString('es-MX')}</div>
              </div>
            </div>
          )}

          {!datosAlumno.identidad && !datosAlumno.contactos_emergencia?.length && !datosAlumno.salud_basica && !datosAlumno.ubicacion && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No hay datos disponibles para esta sesión</p>
          )}
        </div>
      )}

      {/* Modal abrir sesión */}
      {showAbrirModal && searchResult && (
        <div className="modal-backdrop" onClick={() => setShowAbrirModal(false)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-head">
              <div>
                <h3>Abrir Sesión de Emergencia</h3>
                <p>Alumno: {searchResult.nombres} {searchResult.apellido_paterno} ({searchResult.matricula})</p>
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <div className="field">
                <span>Justificación *</span>
                <textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder="Describe la situación de emergencia (mínimo 10 caracteres)..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowAbrirModal(false)} disabled={abriendo}>Cancelar</button>
              <button className="btn danger" onClick={handleAbrirSesion} disabled={abriendo || justificacion.trim().length < 10}>
                {abriendo ? <Loader2 size={16} className="spin" /> : <AlertTriangle size={16} />} Abrir Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
