/**
 * SIVACAD-ISC — Boleta y Preboleta de Calificaciones (Alumno)
 * Documentos institucionales con datos 100% desde SIVACAD
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Award, FileText, Loader2, AlertTriangle, Download, Printer,
  CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

const ESTADO_COLORS = {
  'Acreditada': { bg: '#d1fae5', text: '#065f46' },
  'No Acreditada': { bg: '#fee2e2', text: '#991b1b' },
  'SIN CALIFICACION': { bg: '#f3f4f6', text: '#6b7280' },
  'BORRADOR': { bg: '#fef3c7', text: '#92400e' },
  'VALIDADA': { bg: '#dbeafe', text: '#1e40af' },
  'PUBLICADA': { bg: '#d1fae5', text: '#065f46' },
  'CERRADA': { bg: '#f3f4f6', text: '#374151' }
};

function TabButton({ active, onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.6rem 1.2rem', border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        transition: 'all 0.2s ease',
        background: active ? 'var(--accent-primary, #1e40af)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary, #6b7280)',
        boxShadow: active ? '0 2px 8px rgba(30,64,175,0.25)' : 'none'
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function GradesTable({ materias, showDocente = true }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border, #e5e7eb)' }}>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>#</th>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Materia</th>
            {showDocente && <th style={{ padding: '0.5rem', textAlign: 'left' }}>Docente</th>}
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>P1</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>P2</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>P3</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Promedio</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Final</th>
            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {materias.map((m, i) => {
            const estado = m.estado || m.estado_calificacion || 'SIN CALIFICACION';
            const colors = ESTADO_COLORS[estado] || ESTADO_COLORS['SIN CALIFICACION'];
            const finalVal = m.calificacion_final ?? m.promedio;
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                <td style={{ padding: '0.5rem', fontWeight: 500 }}>{m.nombre_materia}</td>
                {showDocente && (
                  <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                    {m.nombre_docente || '—'}
                  </td>
                )}
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '—'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '—'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '—'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                  {m.promedio != null ? Number(m.promedio).toFixed(1) : '—'}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                  {finalVal != null ? (
                    <span style={{ color: Number(finalVal) >= 6 ? '#059669' : '#dc2626' }}>
                      {Number(finalVal).toFixed(1)}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                    background: colors.bg, color: colors.text, fontWeight: 600
                  }}>
                    {estado}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AlumnoBoletaPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('boleta');
  const [preboleta, setPreboleta] = useState(null);
  const [boleta, setBoleta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) { navigate('/login', { replace: true }); return; }
      const idAlumno = user?.id_alumno;
      if (!idAlumno) { setError('No se encontró tu registro de alumno'); return; }

      // Obtener periodo activo
      let idPeriodo = null;
      try {
        const periodos = await api.request('/periodos', { token });
        const activo = (periodos?.data || periodos || []).find(p => p.estado === 'Activo');
        if (activo) idPeriodo = activo.id_periodo;
      } catch (_) {}

      // Cargar ambos documentos en paralelo
      const [preData, bolData] = await Promise.all([
        idPeriodo ? api.request(`/preboletas/alumno/${idAlumno}/periodo/${idPeriodo}`, { token }).catch(() => null) : Promise.resolve(null),
        api.request(`/calificaciones/boleta/${idAlumno}`, { token }).catch(() => null)
      ]);

      setPreboleta(preData);
      setBoleta(bolData);

      if (!preData && !bolData) {
        setError('No se encontraron calificaciones');
      }
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
      setError(err?.message || 'Error cargando documentos');
    } finally {
      setLoading(false);
    }
  }, [token, user, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExportPreboletaExcel = async () => {
    try {
      setExporting(true);
      const idAlumno = user?.id_alumno;
      const idPeriodo = preboleta?.periodo_id || preboleta?.materias?.[0]?.id_periodo;
      if (!idAlumno || !idPeriodo) return;
      const response = await api.request(`/preboletas/export/excel/alumno/${idAlumno}?idPeriodo=${idPeriodo}`, { token, responseType: 'blob' });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `preboleta_${preboleta?.alumno?.matricula || idAlumno}.xlsx`);
    } catch (err) { console.error('Error:', err); }
    finally { setExporting(false); }
  };

  const handleExportPreboletaPDF = async () => {
    try {
      setExporting(true);
      const idAlumno = user?.id_alumno;
      const idPeriodo = preboleta?.periodo_id || preboleta?.materias?.[0]?.id_periodo;
      if (!idAlumno || !idPeriodo) return;
      const response = await api.request(`/preboletas/export/pdf/alumno/${idAlumno}?idPeriodo=${idPeriodo}`, { token, responseType: 'blob' });
      const blob = new Blob([response], { type: 'application/pdf' });
      downloadBlob(blob, `preboleta_${preboleta?.alumno?.matricula || idAlumno}.pdf`);
    } catch (err) { console.error('Error:', err); }
    finally { setExporting(false); }
  };

  const handleExportBoletaExcel = async () => {
    try {
      setExporting(true);
      const idAlumno = user?.id_alumno;
      if (!idAlumno) return;
      const qs = selectedPeriodo ? `?idPeriodo=${selectedPeriodo}` : '';
      const response = await api.request(`/preboletas/export/boleta/excel/${idAlumno}${qs}`, { token, responseType: 'blob' });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `boleta_${boleta?.alumno?.matricula || idAlumno}.xlsx`);
    } catch (err) { console.error('Error:', err); }
    finally { setExporting(false); }
  };

  const handleExportBoletaPDF = async () => {
    try {
      setExporting(true);
      const idAlumno = user?.id_alumno;
      if (!idAlumno) return;
      const qs = selectedPeriodo ? `?idPeriodo=${selectedPeriodo}` : '';
      const response = await api.request(`/preboletas/export/boleta/pdf/${idAlumno}${qs}`, { token, responseType: 'blob' });
      const blob = new Blob([response], { type: 'application/pdf' });
      downloadBlob(blob, `boleta_${boleta?.alumno?.matricula || idAlumno}.pdf`);
    } catch (err) { console.error('Error:', err); }
    finally { setExporting(false); }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando documentos...</div>;
  }

  if (error) {
    return (
      <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Award size={20} /> Boleta y Preboleta</h1>
        </div>
        <div className="alert alert-error"><AlertTriangle size={16} /> {error}</div>
      </div>
    );
  }

  const alumno = boleta?.alumno || preboleta?.alumno || {};
  const periodosBoleta = boleta?.periodos || [];
  const displayPeriodos = selectedPeriodo
    ? periodosBoleta.filter(p => p.nombre_periodo === selectedPeriodo)
    : periodosBoleta;

  return (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Award size={20} /> Boleta y Preboleta</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Documentos institucionales — Datos 100% desde SIVACAD
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-secondary, #f1f5f9)', padding: '0.3rem', borderRadius: '10px' }}>
        <TabButton active={activeTab === 'boleta'} onClick={() => setActiveTab('boleta')} icon={Award}>
          Boleta Oficial
        </TabButton>
        <TabButton active={activeTab === 'preboleta'} onClick={() => setActiveTab('preboleta')} icon={FileText}>
          Preboleta
        </TabButton>
      </div>

      {/* ===== TAB: BOLETA ===== */}
      {activeTab === 'boleta' && (
        <>
          {/* Datos del alumno */}
          <div className="section-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--accent-primary, #1e40af)' }}>Datos del Alumno</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Nombre:</strong> {alumno.nombre_completo || `${alumno.nombres || ''} ${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''}`}</div>
                  <div><strong>Matrícula:</strong> {alumno.matricula}</div>
                  <div><strong>Carrera:</strong> {alumno.nombre_carrera}</div>
                  <div><strong>Plan:</strong> {alumno.nombre_plan || '—'} {alumno.version_plan || ''}</div>
                  <div><strong>Semestre:</strong> {alumno.semestre_actual || '—'}</div>
                  <div><strong>Estatus:</strong> {alumno.estatus_academico || 'Regular'}</div>
                  <div><strong>Promedio:</strong> {alumno.promedio_general != null ? Number(alumno.promedio_general).toFixed(2) : '—'}</div>
                  <div><strong>Créditos:</strong> {alumno.creditos_acumulados || 0}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={handleExportBoletaPDF} disabled={exporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  PDF
                </button>
                <button className="btn btn-primary" onClick={handleExportBoletaExcel} disabled={exporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* Filtro de período */}
          {periodosBoleta.length > 1 && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Periodo:</span>
              <button
                className={`btn ${!selectedPeriodo ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedPeriodo(null)}
                style={{ fontSize: '0.8rem' }}
              >
                Todos
              </button>
              {periodosBoleta.map(p => (
                <button
                  key={p.nombre_periodo}
                  className={`btn ${selectedPeriodo === p.nombre_periodo ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedPeriodo(p.nombre_periodo)}
                  style={{ fontSize: '0.8rem' }}
                >
                  {p.nombre_periodo}
                </button>
              ))}
            </div>
          )}

          {/* Calificaciones por período */}
          {displayPeriodos.map(p => (
            <div key={p.nombre_periodo} className="section-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Periodo: {p.nombre_periodo}</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#059669', fontWeight: 600 }}>{p.aprobadas} aprobadas</span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>{p.no_acreditadas} no acreditadas</span>
                  <span style={{ fontWeight: 700 }}>Promedio: {p.promedio_periodo != null ? Number(p.promedio_periodo).toFixed(1) : '—'}</span>
                </div>
              </div>
              <GradesTable materias={p.materias} />
            </div>
          ))}

          {periodosBoleta.length === 0 && (
            <div className="section-card" style={{ textAlign: 'center', padding: '2rem' }}>
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No hay calificaciones publicadas aún</p>
            </div>
          )}
        </>
      )}

      {/* ===== TAB: PREBOLETA ===== */}
      {activeTab === 'preboleta' && preboleta && (
        <>
          <div className="section-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--accent-primary, #1e40af)' }}>Preboleta de Calificaciones</h3>
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                    PRELIMINAR
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Alumno:</strong> {preboleta.alumno?.nombre_completo}</div>
                  <div><strong>Matrícula:</strong> {preboleta.alumno?.matricula}</div>
                  <div><strong>Carrera:</strong> {preboleta.alumno?.nombre_carrera}</div>
                  <div><strong>Grupo:</strong> {preboleta.grupo?.nombre_grupo || '—'}</div>
                  <div><strong>Turno:</strong> {preboleta.grupo?.turno || '—'}</div>
                  <div><strong>Periodo:</strong> {preboleta.periodo || '—'}</div>
                  <div><strong>Promedio General:</strong> {preboleta.resumen?.promedio_general != null ? Number(preboleta.resumen.promedio_general).toFixed(1) : '—'}</div>
                  <div><strong>Faltas:</strong> {preboleta.resumen?.faltas_totales || 0}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={handleExportPreboletaPDF} disabled={exporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  PDF
                </button>
                <button className="btn btn-primary" onClick={handleExportPreboletaExcel} disabled={exporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de materias */}
          <div className="section-card">
            <GradesTable materias={preboleta.materias || []} showDocente={true} />
            <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e' }}>
              <strong>Nota:</strong> Este documento es una preboleta (preliminar) y no sustituye la boleta oficial de calificaciones.
            </div>
          </div>
        </>
      )}

      {activeTab === 'preboleta' && !preboleta && (
        <div className="section-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <Clock size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay preboleta disponible para el periodo actual</p>
        </div>
      )}
    </div>
  );
}
