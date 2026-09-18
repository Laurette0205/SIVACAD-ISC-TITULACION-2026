/**
 * SIVACAD-ISC — Captura de Calificaciones (Docente/Coord/Admin)
 * Flujo: Borrador → Validación → Publicación → Cierre
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Save, Loader2, CheckCircle2, AlertTriangle,
  Send, Lock, Eye, Clock, FileText, Filter, Users, Edit3, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ESTADO_COLORS = {
  BORRADOR: '#f59e0b',
  VALIDADA: '#3b82f6',
  PUBLICADA: '#22c55e',
  CERRADA: '#6b7280'
};

const ESTADO_LABELS = {
  BORRADOR: 'Borrador',
  VALIDADA: 'Validada',
  PUBLICADA: 'Publicada',
  CERRADA: 'Cerrada'
};

export default function DocenteCalificacionesPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState(null);
  const [calificaciones, setCalificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [resumen, setResumen] = useState([]);
  const [showResumen, setShowResumen] = useState(true);
  const [config, setConfig] = useState({ max_cambios_por_calificacion: 3 });

  const clearFeedback = useCallback(() => { setTimeout(() => setFeedback(null), 5000); }, []);

  const loadGrupos = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) { navigate('/login', { replace: true }); return; }
      const data = await api.request('/kardex-docente/mis-grupos', { token });
      setGrupos(data?.data || []);
    } catch (err) {
      if (err?.status === 401) { navigate('/login', { replace: true }); return; }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const loadResumen = useCallback(async () => {
    try {
      const data = await api.request('/calificaciones/resumen', { token });
      setResumen(data?.resumen || []);
    } catch (_) {}
  }, [token]);

  useEffect(() => { loadGrupos(); loadResumen(); }, [loadGrupos, loadResumen]);

  const loadCalificaciones = async (idGrupo, idPeriodo) => {
    try {
      setSelectedGrupo(idGrupo);
      setSelectedPeriodo(idPeriodo);
      setShowResumen(false);
      const data = await api.request(`/calificaciones/grupo/${idGrupo}/periodo/${idPeriodo}`, { token });
      setCalificaciones(data?.calificaciones || []);
      setConfig(data?.config || { max_cambios_por_calificacion: 3 });
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error cargando calificaciones' });
      clearFeedback();
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row.id_historial);
    setEditValues({
      parcial_1: row.parcial_1 ?? '',
      parcial_2: row.parcial_2 ?? '',
      parcial_3: row.parcial_3 ?? ''
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = [{
        id_historial: editingRow,
        parcial_1: editValues.parcial_1 !== '' ? Number(editValues.parcial_1) : undefined,
        parcial_2: editValues.parcial_2 !== '' ? Number(editValues.parcial_2) : undefined,
        parcial_3: editValues.parcial_3 !== '' ? Number(editValues.parcial_3) : undefined,
        motivo: 'Captura de calificación'
      }];

      const data = await api.request('/calificaciones/capturar', {
        token, method: 'POST', body: { calificaciones: payload }
      });

      const result = data?.results?.[0];
      if (result?.success) {
        setFeedback({ type: 'success', message: `Guardado (v${result.version}). Promedio: ${result.promedio}` });
        setEditingRow(null);
      } else if (result?.cerrado) {
        setFeedback({ type: 'error', message: result.message });
        setEditingRow(null);
      } else {
        setFeedback({ type: 'error', message: result?.message || 'Error al guardar' });
        setEditingRow(null);
      }
      clearFeedback();
      if (selectedGrupo && selectedPeriodo) {
        await loadCalificaciones(selectedGrupo, selectedPeriodo);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error al guardar' });
      clearFeedback();
    } finally {
      setSaving(false);
    }
  };

  const handleValidar = async (ids) => {
    try {
      const data = await api.request('/calificaciones/validar', {
        token, method: 'POST', body: { ids_historial: ids }
      });
      const success = data?.results?.filter(r => r.success).length || 0;
      setFeedback({ type: 'success', message: `${success} calificación(es) validada(s)` });
      clearFeedback();
      if (selectedGrupo && selectedPeriodo) await loadCalificaciones(selectedGrupo, selectedPeriodo);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error validando' });
      clearFeedback();
    }
  };

  const handlePublicar = async (ids) => {
    try {
      const data = await api.request('/calificaciones/publicar', {
        token, method: 'POST', body: { ids_historial: ids }
      });
      const success = data?.results?.filter(r => r.success).length || 0;
      setFeedback({ type: 'success', message: `${success} calificación(es) publicada(s). Visible para alumnos.` });
      clearFeedback();
      if (selectedGrupo && selectedPeriodo) await loadCalificaciones(selectedGrupo, selectedPeriodo);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error publicando' });
      clearFeedback();
    }
  };

  const handleExportExcel = async () => {
    if (!selectedGrupo || !selectedPeriodo) return;
    try {
      const response = await api.calExportGrupo(token, selectedGrupo, selectedPeriodo);
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calificaciones_grupo_${selectedGrupo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setFeedback({ type: 'success', message: 'Excel exportado correctamente' });
      clearFeedback();
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error exportando Excel' });
      clearFeedback();
    }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando grupos...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><BookOpen size={20} /> Calificaciones</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Captura, validación y publicación de calificaciones por grupo
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
          {feedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {feedback.message}
        </div>
      )}

      {/* Resumen de estados */}
      {showResumen && resumen.length > 0 && (
        <div className="section-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Resumen de Calificaciones</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Periodo</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Grupo</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Borrador</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Validada</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Publicada</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Cerrada</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => loadCalificaciones(r.id_grupo, r.id_periodo)}>
                    <td style={{ padding: '0.5rem' }}>{r.nombre_periodo}</td>
                    <td style={{ padding: '0.5rem' }}>{r.nombre_grupo}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{ color: ESTADO_COLORS.BORRADOR, fontWeight: 600 }}>{r.estado_calificacion === 'BORRADOR' ? r.total : ''}</span>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{ color: ESTADO_COLORS.VALIDADA, fontWeight: 600 }}>{r.estado_calificacion === 'VALIDADA' ? r.total : ''}</span>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{ color: ESTADO_COLORS.PUBLICADA, fontWeight: 600 }}>{r.estado_calificacion === 'PUBLICADA' ? r.total : ''}</span>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{ color: ESTADO_COLORS.CERRADA, fontWeight: 600 }}>{r.estado_calificacion === 'CERRADA' ? r.total : ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selector de grupo */}
      {!selectedGrupo && (
        <div className="section-card">
          <h3 style={{ marginBottom: '0.75rem' }}>Seleccionar Grupo</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {grupos.map((g) => (
              <div key={g.id_carga_academica}
                   style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border)' }}
                   onClick={() => loadCalificaciones(g.id_grupo, g.id_periodo)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{g.nombre_materia}</strong>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      ({g.clave_materia})
                    </span>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Grupo: {g.nombre_grupo} — {g.nombre_periodo} — {g.total_alumnos} alumnos
                    </div>
                  </div>
                  <Users size={16} style={{ opacity: 0.5 }} />
                </div>
              </div>
            ))}
            {grupos.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
                No tienes grupos asignados
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabla de calificaciones */}
      {selectedGrupo && calificaciones.length > 0 && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Calificaciones — {calificaciones[0]?.nombre_grupo} / {calificaciones[0]?.nombre_periodo}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <Lock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                Límite: {config.max_cambios_por_calificacion} ediciones por calificación
              </span>
              <button className="btn btn-primary" onClick={handleExportExcel} style={{ fontSize: '0.82rem' }}>
                <Download size={14} /> Exportar Excel
              </button>
              <button className="btn btn-secondary" onClick={() => { setSelectedGrupo(null); setShowResumen(true); }}>
                <ArrowLeft size={14} /> Volver
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Alumno</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Parcial 1</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Parcial 2</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Parcial 3</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Promedio</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Versión</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {calificaciones.map((c) => {
                   const isEditing = editingRow === c.id_historial;
                   const canEdit = (c.estado_calificacion === 'BORRADOR' || c.estado_calificacion === 'VALIDADA') && c.version < config.max_cambios_por_calificacion;
                   const isLocked = c.estado_calificacion === 'PUBLICADA' || c.estado_calificacion === 'CERRADA';
                   const isMaxVersion = c.version >= config.max_cambios_por_calificacion;

                  return (
                    <tr key={c.id_historial} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <div>{c.nombre_alumno}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.matricula}</div>
                      </td>
                      {['parcial_1', 'parcial_2', 'parcial_3'].map((field) => (
                        <td key={field} style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={editValues[field] ?? ''}
                              onChange={(e) => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
                              style={{ width: 70, textAlign: 'center' }}
                            />
                          ) : (
                            c[field] != null ? Number(c[field]).toFixed(1) : '—'
                          )}
                        </td>
                      ))}
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                        {c.promedio_parciales != null ? Number(c.promedio_parciales).toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                          background: `${ESTADO_COLORS[c.estado_calificacion]}20`,
                          color: ESTADO_COLORS[c.estado_calificacion],
                          fontWeight: 600
                        }}>
                          {ESTADO_LABELS[c.estado_calificacion]}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span style={{
                          color: isMaxVersion ? 'var(--danger, #dc2626)' : 'var(--text-secondary)',
                          fontWeight: isMaxVersion ? 600 : 400
                        }}>
                          v{c.version}/{config.max_cambios_por_calificacion}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '0.75rem' }}>
                              {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />} Guardar
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingRow(null)} style={{ fontSize: '0.75rem' }}>
                              Cancelar
                            </button>
                          </div>
                        ) : canEdit ? (
                          <button className="btn btn-secondary" onClick={() => handleEdit(c)} style={{ fontSize: '0.75rem' }}>
                            <Edit3 size={12} /> Editar
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {isLocked ? <><Lock size={12} /> Cerrada</> : isMaxVersion ? <><Lock size={12} /> Límite</> : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Acciones masivas */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {calificaciones.some(c => c.estado_calificacion === 'BORRADOR') && (
              <button className="btn btn-secondary" onClick={() => {
                const ids = calificaciones.filter(c => c.estado_calificacion === 'BORRADOR').map(c => c.id_historial);
                handleValidar(ids);
              }}>
                <CheckCircle2 size={14} /> Validar Borradores
              </button>
            )}
            {calificaciones.some(c => c.estado_calificacion === 'VALIDADA') && (
              <button className="btn btn-primary" onClick={() => {
                const ids = calificaciones.filter(c => c.estado_calificacion === 'VALIDADA').map(c => c.id_historial);
                handlePublicar(ids);
              }}>
                <Send size={14} /> Publicar Validadas
              </button>
            )}
          </div>
        </div>
      )}

      {selectedGrupo && calificaciones.length === 0 && (
        <div className="section-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay calificaciones registradas para este grupo</p>
        </div>
      )}
    </div>
  );
}
