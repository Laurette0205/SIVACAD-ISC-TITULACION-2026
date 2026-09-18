/**
 * SIVACAD-ISC — Preboleta del Alumno
 * Documento preliminar con todas las calificaciones (cualquier estado)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Loader2, AlertTriangle, Download, Printer,
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
  BORRADOR: { bg: '#fef3c7', text: '#92400e', label: 'Borrador' },
  VALIDADA: { bg: '#dbeafe', text: '#1e40af', label: 'Validada' },
  PUBLICADA: { bg: '#d1fae5', text: '#065f46', label: 'Publicada' },
  CERRADA: { bg: '#f3f4f6', text: '#374151', label: 'Cerrada' },
  SIN_CALIFICACION: { bg: '#fee2e2', text: '#991b1b', label: 'Sin calificación' }
};

export default function AlumnoPreboletaPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [preboleta, setPreboleta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadPreboleta = useCallback(async () => {
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

      if (!idPeriodo) {
        setError('No hay periodo activo disponible');
        return;
      }

      const data = await api.request(`/preboletas/alumno/${idAlumno}/periodo/${idPeriodo}`, { token });
      setPreboleta(data);
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
      setError(err?.message || 'Error cargando preboleta');
    } finally {
      setLoading(false);
    }
  }, [token, user, navigate]);

  useEffect(() => { loadPreboleta(); }, [loadPreboleta]);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const idAlumno = user?.id_alumno;
      const idPeriodo = preboleta?.periodo_id;
      if (!idAlumno || !idPeriodo) return;

      const response = await api.request(`/preboletas/export/excel/alumno/${idAlumno}?idPeriodo=${idPeriodo}`, {
        token, responseType: 'blob'
      });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `preboleta_${preboleta?.alumno?.matricula || idAlumno}.xlsx`);
    } catch (err) {
      console.error('Error exporting:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      const idAlumno = user?.id_alumno;
      const idPeriodo = preboleta?.periodo_id || preboleta?.materias?.[0]?.id_periodo;
      if (!idAlumno || !idPeriodo) return;

      const response = await api.request(`/preboletas/export/pdf/alumno/${idAlumno}?idPeriodo=${idPeriodo}`, {
        token, responseType: 'blob'
      });
      const blob = new Blob([response], { type: 'application/pdf' });
      downloadBlob(blob, `preboleta_${preboleta?.alumno?.matricula || idAlumno}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleGenerar = async () => {
    try {
      setGenerating(true);
      const idAlumno = user?.id_alumno;
      const data = preboleta;
      if (!data?.grupo || !data?.periodo) return;

      await api.request('/preboletas/generar', {
        token, method: 'POST',
        body: {
          idAlumno,
          idGrupo: data.grupo.id_grupo,
          idPeriodo: data.periodo_id
        }
      });
    } catch (err) {
      console.error('Error generating:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando preboleta...</div>;
  }

  if (error) {
    return (
      <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><FileText size={20} /> Mi Preboleta</h1>
        </div>
        <div className="alert alert-error"><AlertTriangle size={16} /> {error}</div>
      </div>
    );
  }

  const alumno = preboleta?.alumno || {};
  const grupo = preboleta?.grupo || {};
  const materias = preboleta?.materias || [];
  const resumen = preboleta?.resumen || {};

  return (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><FileText size={20} /> Mi Preboleta</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Documento preliminar — Calificaciones por período académico
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleGenerar} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
            {generating ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
            Generar
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exportingPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
            {exportingPDF ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            PDF
          </button>
          <button className="btn btn-primary" onClick={handleExportExcel} disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
            {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            Excel
          </button>
        </div>
      </div>

      {/* Datos del alumno */}
      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
          <div><strong>Alumno:</strong> {alumno.nombre_completo}</div>
          <div><strong>Matrícula:</strong> {alumno.matricula}</div>
          <div><strong>Carrera:</strong> {alumno.nombre_carrera}</div>
          <div><strong>Grupo:</strong> {grupo.nombre_grupo}</div>
          <div><strong>Semestre:</strong> {alumno.semestre_actual}</div>
          <div><strong>Turno:</strong> {grupo.turno}</div>
          <div><strong>Periodo:</strong> {preboleta?.periodo}</div>
          <div><strong>Plan:</strong> {alumno.nombre_plan} {alumno.version_plan}</div>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Promedio General', value: resumen.promedio_general != null ? Number(resumen.promedio_general).toFixed(1) : '—', color: '#1e40af' },
          { label: 'Materias', value: resumen.total_materias, color: '#374151' },
          { label: 'Aprobadas', value: resumen.materias_aprobadas, color: '#059669' },
          { label: 'No Acreditadas', value: resumen.materias_no_acreditadas, color: '#dc2626' },
          { label: 'Pendientes', value: resumen.materias_pendientes, color: '#d97706' },
          { label: 'Faltas', value: resumen.faltas_totales, color: '#6b7280' }
        ].map((item, i) => (
          <div key={i} className="section-card" style={{ textAlign: 'center', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla de materias */}
      <div className="section-card">
        <h3 style={{ marginBottom: '0.75rem' }}>Calificaciones por Asignatura</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>#</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Asignatura</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Clave</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Créditos</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>P1</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>P2</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>P3</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Promedio</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Faltas</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Docente</th>
              </tr>
            </thead>
            <tbody>
              {materias.map((m, i) => {
                const estadoInfo = ESTADO_COLORS[m.estado_calificacion] || ESTADO_COLORS.SIN_CALIFICACION;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                    <td style={{ padding: '0.5rem' }}>{m.nombre_materia}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>{m.clave_materia}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.creditos}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_1 != null ? Number(m.parcial_1).toFixed(1) : '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_2 != null ? Number(m.parcial_2).toFixed(1) : '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.parcial_3 != null ? Number(m.parcial_3).toFixed(1) : '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                      {m.promedio_calculado != null ? Number(m.promedio_calculado).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '9999px',
                        background: estadoInfo.bg, color: estadoInfo.text, fontWeight: 600
                      }}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{m.faltas || 0}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {m.nombre_docente || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota */}
      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e' }}>
        <strong>Nota:</strong> Este documento es una preboleta (preliminar) y no sustituye la boleta oficial de calificaciones.
      </div>
    </div>
  );
}
