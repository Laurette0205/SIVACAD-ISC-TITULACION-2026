import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList, CheckCircle2, Clock3, XCircle,
  RefreshCw, Search, ArrowLeft, Loader2,
  BadgeInfo, FileText, GraduationCap, Upload,
  Download, Save, AlertTriangle, ShieldCheck,
  Calendar, UserCheck, FileUp, History,
  Eye, Ban, Layers, BookOpen
} from 'lucide-react';

function normalize(v) {
  return String(v || '').trim().toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return d; }
}

function safeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const STATUS_COLORS = {
  Pendiente: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b', label: 'Pendiente' },
  Validada: { bg: '#d1fae5', text: '#065f46', dot: '#10b981', label: 'Validada' },
  Rechazada: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', label: 'Rechazada' },
  Cancelada: { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280', label: 'Cancelada' }
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Pendiente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.15rem 0.55rem', borderRadius: 9999, fontSize: '0.8rem',
      fontWeight: 600, background: s.bg, color: s.text
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

const TABS = [
  { id: 'solicitud', label: 'Solicitud', icon: ClipboardList },
  { id: 'estatus', label: 'Estatus de Tramite', icon: Clock3 },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'confirmacion', label: 'Confirmacion', icon: CheckCircle2 }
];

export default function AlumnoInscripcionesPage() {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState('solicitud');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [info, setInfo] = React.useState(null);
  const [estatusList, setEstatusList] = React.useState([]);
  const [documentosData, setDocumentosData] = React.useState(null);
  const [historialData, setHistorialData] = React.useState(null);

  const [solicitudForm, setSolicitudForm] = React.useState({ id_periodo: '', tipo_inscripcion: 'Primera_Vez' });
  const [uploadStatus, setUploadStatus] = React.useState({});

  const loadInfo = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoInscripcionesInfo(token);
      setInfo(res?.data || null);
    } catch (err) {
      console.error('Error info:', err);
      setError('Error al cargar informacion');
    }
  }, [token]);

  const loadEstatus = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoMiEstatus(token);
      setEstatusList(safeArray(res));
    } catch (err) {
      console.error('Error estatus:', err);
    }
  }, [token]);

  const loadDocumentos = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoDocumentos(token);
      setDocumentosData(res?.data || null);
    } catch (err) {
      console.error('Error docs:', err);
    }
  }, [token]);

  const loadHistorial = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoHistorial(token);
      setHistorialData(res?.data || null);
    } catch (err) {
      console.error('Error historial:', err);
    }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        loadInfo(), loadEstatus(), loadDocumentos(), loadHistorial()
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadInfo, loadEstatus, loadDocumentos, loadHistorial]);

  React.useEffect(() => {
    if (authLoading) return;
    loadAll();
  }, [authLoading, loadAll]);

  const handleSolicitar = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.alumnoSolicitarInscripcion(token, {
        id_periodo: solicitudForm.id_periodo || undefined,
        tipo_inscripcion: solicitudForm.tipo_inscripcion
      });
      setMessage(res?.message || 'Solicitud registrada correctamente');
      await Promise.all([loadInfo(), loadEstatus(), loadHistorial()]);
      setActiveTab('estatus');
    } catch (err) {
      setError(err?.message || 'Error al registrar solicitud');
    }
  };

  const handleSubirDocumento = async (tipoDocumento) => {
    setError('');
    setMessage('');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadStatus(prev => ({ ...prev, [tipoDocumento]: 'subiendo' }));
      try {
        const formData = new FormData();
        formData.append('archivo', file);
        formData.append('tipo_documento', tipoDocumento);
        const ins = estatusList?.[0];
        if (ins?.id_inscripcion) {
          formData.append('id_inscripcion', ins.id_inscripcion);
        }

        await api.alumnoSubirDocumento(token, formData);
        setMessage(`${tipoDocumento.replace(/_/g, ' ')} subido correctamente`);
        setUploadStatus(prev => ({ ...prev, [tipoDocumento]: 'ok' }));
        await loadDocumentos();
      } catch (err) {
        setError(err?.message || 'Error al subir documento');
        setUploadStatus(prev => ({ ...prev, [tipoDocumento]: 'error' }));
      }
    };
    fileInput.click();
  };

  const handleDescargarComprobante = async (id) => {
    try {
      setError('');
      const blob = await api.alumnoDescargarComprobante(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Comprobante descargado correctamente');
    } catch (err) {
      setError(err?.message || 'Error al descargar comprobante');
    }
  };

  const renderSolicitud = () => {
    const periodoActivo = info?.periodoActivo;
    const tieneSolicitud = estatusList?.length > 0;

    return (
      <div className="stack">
        <SectionCard title="Tu informacion" subtitle="Datos personales registrados">
          {info?.alumno ? (
            <div className="grid-two">
              <div><strong>Nombre:</strong> {info.alumno.nombre_completo}</div>
              <div><strong>Matricula:</strong> {info.alumno.matricula}</div>
              <div><strong>Periodo activo:</strong> {periodoActivo?.nombre_periodo || 'No hay periodo activo'}</div>
              {periodoActivo && (
                <div>
                  <strong>Vigencia:</strong> {formatDate(periodoActivo.fecha_inicio)} — {formatDate(periodoActivo.fecha_fin)}
                </div>
              )}
            </div>
          ) : (
            <div className="empty">Cargando datos...</div>
          )}
        </SectionCard>

        <SectionCard title="Nueva solicitud de inscripcion" subtitle="Complete el formulario para registrar su solicitud">
          {tieneSolicitud ? (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={18} />
              Ya tienes una solicitud registrada. Revisa el estatus en la pestaña "Estatus de Tramite".
            </div>
          ) : !periodoActivo ? (
            <div className="alert error" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} />
              No hay un periodo activo disponible para realizar la inscripcion.
            </div>
          ) : (
            <form onSubmit={handleSolicitar}>
              <div className="grid-two">
                <div className="field">
                  <span>Periodo</span>
                  <input value={periodoActivo.nombre_periodo} disabled />
                </div>
                <div className="field">
                  <span>Tipo de inscripcion</span>
                  <select value={solicitudForm.tipo_inscripcion}
                    onChange={e => setSolicitudForm({ ...solicitudForm, tipo_inscripcion: e.target.value })}>
                    <option value="Primera_Vez">Primera vez</option>
                    <option value="Reinscripcion">Reinscripcion</option>
                  </select>
                </div>
              </div>
              <div className="alert info" style={{ marginTop: '0.75rem', lineHeight: 1.75 }}>
                <BadgeInfo size={16} />
                Al enviar esta solicitud, se creara un registro en estado "Pendiente" que debera ser validado
                por el coordinador academico. Recibiras actualizaciones sobre el estatus de tu tramite.
              </div>
              <div className="row gap wrap" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn primary">
                  <Save size={16} /> Enviar solicitud
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {tieneSolicitud && (
          <SectionCard title="Tus solicitudes recientes" subtitle="Ultimos movimientos registrados">
            <div className="list">
              {estatusList.slice(0, 3).map(s => (
                <div key={s.id_inscripcion} className="list-item">
                  <strong>#{s.id_inscripcion} - {s.nombre_periodo}</strong>
                  <span>
                    Tipo: {s.tipo_inscripcion === 'Primera_Vez' ? 'Primera vez' : 'Reinscripcion'} •
                    Estado: <StatusBadge status={s.estado} /> •
                    Fecha: {formatDate(s.fecha_inscripcion)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  const renderEstatus = () => {
    const getStepStatus = (inscripcion) => {
      const estado = normalize(inscripcion?.estado);
      return {
        solicitado: true,
        documentos: inscripcion?.documentos_subidos > 0,
        revision: estado === 'VALIDADA' || estado === 'RECHAZADA',
        validado: estado === 'VALIDADA',
        completado: estado === 'VALIDADA' && inscripcion?.comprobante_pago
      };
    };

    const steps = [
      { key: 'solicitado', label: 'Solicitud enviada', icon: ClipboardList },
      { key: 'documentos', label: 'Documentacion', icon: FileText },
      { key: 'revision', label: 'En revision', icon: Clock3 },
      { key: 'validado', label: 'Validado', icon: CheckCircle2 },
      { key: 'completado', label: 'Completado', icon: ShieldCheck }
    ];

    return (
      <div className="stack">
        {estatusList.length === 0 ? (
          <SectionCard title="Sin solicitudes" subtitle="No tienes solicitudes registradas">
            <div className="empty">
              <GraduationCap size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>Aun no has registrado ninguna solicitud de inscripcion.</p>
              <button type="button" className="btn primary" onClick={() => setActiveTab('solicitud')}>
                Ir a solicitud
              </button>
            </div>
          </SectionCard>
        ) : (
          estatusList.map(ins => {
            const stepStatus = getStepStatus(ins);
            return (
              <SectionCard
                key={ins.id_inscripcion}
                title={`Solicitud #${ins.id_inscripcion}`}
                subtitle={`${ins.nombre_periodo} — ${ins.tipo_inscripcion === 'Primera_Vez' ? 'Primera vez' : 'Reinscripcion'}`}
                right={<StatusBadge status={ins.estado} />}
              >
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {steps.map(step => {
                    const active = stepStatus[step.key];
                    return (
                      <div key={step.key} style={{
                        flex: 1, minWidth: 100, textAlign: 'center', padding: '0.75rem 0.5rem',
                        borderRadius: 8,
                        background: active ? '#d1fae5' : '#f3f4f6',
                        border: active ? '1px solid #10b981' : '1px solid #e5e7eb'
                      }}>
                        <step.icon size={20} style={{ color: active ? '#10b981' : '#9ca3af', marginBottom: '0.25rem' }} />
                        <div style={{ fontSize: '0.7rem', fontWeight: active ? 600 : 400, color: active ? '#065f46' : '#6b7280' }}>
                          {step.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid-two" style={{ fontSize: '0.88rem' }}>
                  <div><strong>Estado actual:</strong> <StatusBadge status={ins.estado} /></div>
                  <div><strong>Fecha de solicitud:</strong> {formatDate(ins.fecha_inscripcion)}</div>
                  {ins.nombre_grupo && <div><strong>Grupo asignado:</strong> {ins.nombre_grupo}</div>}
                  {ins.fecha_validacion && <div><strong>Fecha de validacion:</strong> {formatDate(ins.fecha_validacion)}</div>}
                  {ins.motivo_rechazo && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Motivo de rechazo:</strong>
                      <div className="alert error" style={{ marginTop: '0.25rem' }}>{ins.motivo_rechazo}</div>
                    </div>
                  )}
                  {ins.observaciones && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Observaciones:</strong>
                      <div className="alert info" style={{ marginTop: '0.25rem' }}>{ins.observaciones}</div>
                    </div>
                  )}
                </div>

                <div className="row gap wrap" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn secondary" onClick={() => handleDescargarComprobante(ins.id_inscripcion)}>
                    <Download size={16} /> Descargar comprobante
                  </button>
                </div>
              </SectionCard>
            );
          })
        )}
      </div>
    );
  };

  const renderDocumentos = () => {
    const tipos = documentosData?.tiposDocumento || [];
    const pendientes = tipos.filter(t => t.estado === 'Pendiente').length;
    const completos = tipos.filter(t => t.estado === 'Completo').length;

    return (
      <div className="stack">
        <SectionCard title="Documentos requeridos" subtitle="Sube la documentacion necesaria para tu inscripcion">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: '1rem' }}>
            <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
              <div className="stat-card-header">
                <div className="stat-value">{tipos.length}</div>
              </div>
              <div className="stat-label">Total requeridos</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="stat-card-header">
                <div className="stat-value">{completos}</div>
              </div>
              <div className="stat-label">Completos</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="stat-card-header">
                <div className="stat-value">{pendientes}</div>
              </div>
              <div className="stat-label">Pendientes</div>
            </div>
          </div>

          {tipos.length === 0 ? (
            <div className="empty">No hay documentos registrados.</div>
          ) : (
            <div className="list">
              {tipos.map(td => {
                const isComplete = td.estado === 'Completo';
                const isUploaded = td.estado === 'Subido';
                const uploading = uploadStatus[td.tipo] === 'subiendo';
                return (
                  <div key={td.tipo} className="list-item">
                    <div className="row gap" style={{ alignItems: 'center' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: isComplete ? '#d1fae5' : isUploaded ? '#fef3c7' : '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isComplete ? '#10b981' : isUploaded ? '#f59e0b' : '#ef4444',
                        fontSize: '0.75rem', fontWeight: 700
                      }}>
                        {isComplete ? '✓' : isUploaded ? '~' : '!'}
                      </div>
                      <div>
                        <strong>{td.nombre}</strong>
                        {td.required && <span className="badge error" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>Requerido</span>}
                        {td.subido?.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                            {td.subido.length} archivo(s) - {td.estado}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="row gap" style={{ gap: '0.35rem' }}>
                      {uploading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <button type="button" className="btn secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleSubirDocumento(td.tipo)}>
                          <Upload size={14} /> Subir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {documentosData?.documentos?.length > 0 && (
          <SectionCard title="Archivos subidos" subtitle="Historial de documentos cargados">
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>Documento</th>
                    <th style={{ padding: '0.4rem' }}>Archivo</th>
                    <th style={{ padding: '0.4rem' }}>Estado</th>
                    <th style={{ padding: '0.4rem' }}>Fecha</th>
                    <th style={{ padding: '0.4rem' }}>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosData.documentos.map(d => (
                    <tr key={d.id_documento} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem' }}>{d.tipo_documento.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.nombre_archivo}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <span className={`badge ${d.estado === 'Aprobado' ? 'success' : d.estado === 'Rechazado' ? 'error' : 'light'}`}
                          style={{ fontSize: '0.7rem' }}>
                          {d.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(d.subido_en)}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{d.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  const renderHistorial = () => {
    const hist = historialData?.historial || [];
    const incs = historialData?.inscripciones || [];
    return (
      <div className="stack">
        {incs.length > 0 && (
          <SectionCard title="Tus inscripciones" subtitle="Resumen de todas tus solicitudes">
            <div className="list">
              {incs.map(i => (
                <div key={i.id_inscripcion} className="list-item">
                  <strong>#{i.id_inscripcion} - {i.nombre_periodo}</strong>
                  <span>
                    Tipo: {i.tipo_inscripcion === 'Primera_Vez' ? 'Primera vez' : 'Reinscripcion'} •
                    Estado: <StatusBadge status={i.estado} /> •
                    {formatDate(i.fecha_inscripcion)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Historial de cambios" subtitle={`${hist.length} evento(s) registrados`}>
          {hist.length === 0 ? (
            <div className="empty">Sin actividad registrada.</div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>Fecha</th>
                    <th style={{ padding: '0.4rem' }}>Inscripcion</th>
                    <th style={{ padding: '0.4rem' }}>Accion</th>
                    <th style={{ padding: '0.4rem' }}>Anterior</th>
                    <th style={{ padding: '0.4rem' }}>Nuevo</th>
                    <th style={{ padding: '0.4rem' }}>Realizado por</th>
                    <th style={{ padding: '0.4rem' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map(a => (
                    <tr key={a.id_auditoria} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(a.creado_en)}</td>
                      <td style={{ padding: '0.4rem' }}>#{a.id_inscripcion}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <span className={`badge ${a.accion === 'VALIDAR' ? 'success' : a.accion === 'RECHAZAR' || a.accion === 'CANCELAR' ? 'error' : 'info'}`}
                          style={{ fontSize: '0.65rem' }}>{a.accion}</span>
                      </td>
                      <td style={{ padding: '0.4rem' }}>{a.estado_anterior || '—'}</td>
                      <td style={{ padding: '0.4rem' }}>{a.estado_nuevo || '—'}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{a.usuario_nombre || 'Sistema'}</td>
                      <td style={{ padding: '0.4rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.detalle || ''}>
                        {a.detalle || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderConfirmacion = () => {
    const solicitudActiva = estatusList?.[0];
    const docsCompletos = documentosData?.tiposDocumento?.filter(t => t.estado === 'Completo').length || 0;
    const totalDocs = documentosData?.tiposDocumento?.length || 5;
    const todoCompleto = docsCompletos >= totalDocs && solicitudActiva?.estado === 'Validada';

    const checklist = [
      { label: 'Solicitud registrada', ok: !!solicitudActiva },
      { label: 'Documentacion completa', ok: docsCompletos >= totalDocs },
      { label: 'Solicitud validada', ok: solicitudActiva?.estado === 'Validada' },
      { label: 'Comprobante generado', ok: !!solicitudActiva?.comprobante_pago || solicitudActiva?.estado === 'Validada' }
    ];

    return (
      <div className="stack">
        <SectionCard title="Confirmacion final" subtitle="Verifica que todo este en orden para completar tu proceso">
          {!solicitudActiva ? (
            <div className="empty">
              <GraduationCap size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>No has iniciado ningun tramite de inscripcion.</p>
              <button type="button" className="btn primary" onClick={() => setActiveTab('solicitud')}>
                Iniciar solicitud
              </button>
            </div>
          ) : (
            <>
              <div className="list" style={{ marginBottom: '1rem' }}>
                {checklist.map(item => (
                  <div key={item.label} className="list-item">
                    <div className="row gap" style={{ alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: item.ok ? '#d1fae5' : '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.ok ? '#10b981' : '#ef4444', fontWeight: 700
                      }}>
                        {item.ok ? '✓' : '!'}
                      </div>
                      <strong>{item.label}</strong>
                    </div>
                    <span style={{ color: item.ok ? '#10b981' : '#ef4444', fontSize: '0.85rem' }}>
                      {item.ok ? 'Completado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>

              {todoCompleto ? (
                <div className="alert success" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>¡Proceso completado!</strong>
                    <p style={{ margin: '0.25rem 0 0' }}>Tu inscripcion ha sido procesada exitosamente. Puedes descargar tu comprobante.</p>
                  </div>
                </div>
              ) : (
                <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Proceso en curso</strong>
                    <p style={{ margin: '0.25rem 0 0' }}>Completa todos los pasos pendientes para finalizar tu inscripcion.</p>
                  </div>
                </div>
              )}

              <div className="row gap wrap" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn primary"
                  onClick={() => handleDescargarComprobante(solicitudActiva.id_inscripcion)}>
                  <Download size={16} /> Descargar comprobante
                </button>
                <button type="button" className="btn secondary" onClick={() => navigate('/app/alumno')}>
                  <ArrowLeft size={16} /> Volver al panel
                </button>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    );
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <GraduationCap size={14} /> Autoservicio de inscripciones
          </div>
          <h1>Mis Inscripciones</h1>
          <p>
            Gestiona tu proceso de inscripcion de forma clara, trazable y autonoma:
            solicita, consulta el estatus, sube documentos y descarga tus comprobantes.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Periodo activo</small>
            <strong>{info?.periodoActivo?.nombre_periodo || '—'}</strong>
          </div>
          <div className="meta-card">
            <small>Solicitudes</small>
            <strong>{estatusList.length}</strong>
          </div>
        </div>
      </section>

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} type="button"
            className={`btn ${activeTab === tab.id ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando panel de inscripciones...</span>
        </div>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {activeTab === 'solicitud' && renderSolicitud()}
          {activeTab === 'estatus' && renderEstatus()}
          {activeTab === 'documentos' && renderDocumentos()}
          {activeTab === 'historial' && renderHistorial()}
          {activeTab === 'confirmacion' && renderConfirmacion()}
        </>
      )}
    </div>
  );
}
