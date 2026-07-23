import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList, CheckCircle2, Clock3, XCircle,
  RefreshCw, ArrowLeft, Loader2, Download, FileText,
  BadgeInfo, GraduationCap, Save, History,
  AlertTriangle, ShieldCheck, BookOpen, ExternalLink,
  FileSpreadsheet, Image
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
  { id: 'estatus', label: 'Estatus del trámite', icon: Clock3 },
  { id: 'requisitos', label: 'Requisitos', icon: BookOpen },
  { id: 'historial', label: 'Historial personal', icon: History },
  { id: 'exportar', label: 'Exportar comprobante', icon: Download }
];

export default function AlumnoReinscripcionesPage() {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState('solicitud');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [info, setInfo] = React.useState(null);
  const [estatusList, setEstatusList] = React.useState([]);
  const [historialData, setHistorialData] = React.useState(null);

  const [observaciones, setObservaciones] = React.useState('');

  const loadInfo = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoReinscripcionesInfo(token);
      setInfo(res?.data || null);
    } catch (err) {
      console.error('Error info reinscripcion:', err);
    }
  }, [token]);

  const loadEstatus = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoReinscripcionesEstatus(token);
      setEstatusList(safeArray(res));
    } catch (err) {
      console.error('Error estatus reinscripcion:', err);
    }
  }, [token]);

  const loadHistorial = React.useCallback(async () => {
    try {
      setError('');
      const res = await api.alumnoReinscripcionesHistorial(token);
      setHistorialData(res?.data || null);
    } catch (err) {
      console.error('Error historial reinscripcion:', err);
    }
  }, [token]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadInfo(), loadEstatus(), loadHistorial()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadInfo, loadEstatus, loadHistorial]);

  React.useEffect(() => {
    if (authLoading) return;
    loadAll();
  }, [authLoading, loadAll]);

  const handleSolicitar = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.alumnoSolicitarReinscripcion(token, {
        observaciones: observaciones.trim() || undefined
      });
      setMessage(res?.message || 'Solicitud de reinscripción registrada correctamente');
      setObservaciones('');
      await Promise.all([loadInfo(), loadEstatus(), loadHistorial()]);
      setActiveTab('estatus');
    } catch (err) {
      setError(err?.message || 'Error al registrar solicitud de reinscripción');
    }
  };

  const handleDescargar = async (id, formato) => {
    try {
      setError('');
      const blob = await api.alumnoReinscripcionesComprobante(token, id, formato);
      const ext = formato === 'jpg' ? 'jpg' : formato;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante_reinscripcion_${id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage(`Comprobante descargado en formato .${ext}`);
    } catch (err) {
      setError(err?.message || 'Error al descargar comprobante');
    }
  };

  // ======== TABS ========

  const renderSolicitud = () => {
    const periodoActivo = info?.periodoActivo;
    const tieneSolicitudActiva = estatusList?.some(s =>
      normalize(s.estado) === 'PENDIENTE' || normalize(s.estado) === 'VALIDADA'
    );

    return (
      <div className="stack">
        <SectionCard title="Tu información" subtitle="Datos personales registrados">
          {info?.alumno ? (
            <div className="grid-two">
              <div><strong>Nombre:</strong> {info.alumno.nombre_completo}</div>
              <div><strong>Matrícula:</strong> {info.alumno.matricula}</div>
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

        <SectionCard title="Nueva solicitud de reinscripción" subtitle="Complete el formulario para registrar su solicitud">
          {tieneSolicitudActiva ? (
            <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={18} />
              Ya tienes una solicitud de reinscripción activa. Revisa el estatus en la pestaña correspondiente.
            </div>
          ) : !periodoActivo ? (
            <div className="alert error" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} />
              No hay un periodo activo disponible para realizar la reinscripción.
            </div>
          ) : (
            <form onSubmit={handleSolicitar}>
              <div className="grid-two">
                <div className="field">
                  <span>Periodo</span>
                  <input value={periodoActivo.nombre_periodo} disabled />
                </div>
                <div className="field">
                  <span>Tipo</span>
                  <input value="Reinscripción" disabled />
                </div>
              </div>
              <div className="field" style={{ marginTop: '0.75rem' }}>
                <span>Observaciones (opcional)</span>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Motivo o comentarios sobre tu reinscripción"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div className="alert info" style={{ marginTop: '0.75rem', lineHeight: 1.75 }}>
                <BadgeInfo size={16} />
                Al enviar esta solicitud, se creará un registro en estado "Pendiente" que deberá ser validado
                por el coordinador académico. Recibirás actualizaciones sobre el estatus de tu trámite.
              </div>
              <div className="row gap wrap" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn primary">
                  <Save size={16} /> Enviar solicitud de reinscripción
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {estatusList.length > 0 && (
          <SectionCard title="Tus solicitudes recientes" subtitle="Últimos movimientos registrados">
            <div className="list">
              {estatusList.slice(0, 3).map(s => (
                <div key={s.id_reinscripcion || s.id_inscripcion} className="list-item">
                  <strong>Folio RE-{String(s.id_reinscripcion).padStart(6, '0')} — {s.nombre_periodo}</strong>
                  <span>
                    Estado: <StatusBadge status={s.estado} /> •
                    Fecha: {formatDate(s.fecha_solicitud)}
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
    const getStepStatus = (item) => {
      const estado = normalize(item?.estado);
      return {
        solicitado: true,
        revision: estado === 'PENDIENTE' || estado === 'VALIDADA' || estado === 'RECHAZADA',
        validado: estado === 'VALIDADA',
        completado: estado === 'VALIDADA' && item?.comprobante
      };
    };

    const steps = [
      { key: 'solicitado', label: 'Solicitud enviada', icon: ClipboardList },
      { key: 'revision', label: 'En revisión', icon: Clock3 },
      { key: 'validado', label: 'Validado', icon: CheckCircle2 },
      { key: 'completado', label: 'Completado', icon: ShieldCheck }
    ];

    return (
      <div className="stack">
        {estatusList.length === 0 ? (
          <SectionCard title="Sin solicitudes" subtitle="No tienes solicitudes de reinscripción registradas">
            <div className="empty">
              <GraduationCap size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>Aún no has registrado ninguna solicitud de reinscripción.</p>
              <button type="button" className="btn primary" onClick={() => setActiveTab('solicitud')}>
                Ir a solicitud
              </button>
            </div>
          </SectionCard>
        ) : (
          estatusList.map(item => {
            const stepStatus = getStepStatus(item);
            return (
              <SectionCard
                key={item.id_reinscripcion}
                title={`Folio RE-${String(item.id_reinscripcion).padStart(6, '0')}`}
                subtitle={`${item.nombre_periodo} — Reinscripción`}
                right={<StatusBadge status={item.estado} />}
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
                  <div><strong>Estado actual:</strong> <StatusBadge status={item.estado} /></div>
                  <div><strong>Fecha de solicitud:</strong> {formatDate(item.fecha_solicitud)}</div>
                  {item.nombre_grupo && <div><strong>Grupo asignado:</strong> {item.nombre_grupo}</div>}
                  {item.fecha_validacion && <div><strong>Fecha de validación:</strong> {formatDate(item.fecha_validacion)}</div>}
                  {item.motivo && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Motivo:</strong> {item.motivo}
                    </div>
                  )}
                  {item.estado === 'Rechazada' && item.observaciones && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Observaciones de revisión:</strong>
                      <div className="alert error" style={{ marginTop: '0.25rem' }}>{item.observaciones}</div>
                    </div>
                  )}
                  {item.observaciones_alumno && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Tus observaciones:</strong>
                      <div className="alert info" style={{ marginTop: '0.25rem' }}>{item.observaciones_alumno}</div>
                    </div>
                  )}
                </div>

                <div className="row gap wrap" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn secondary" onClick={() => handleDescargar(item.id_reinscripcion, 'pdf')}>
                    <Download size={16} /> Descargar comprobante PDF
                  </button>
                </div>
              </SectionCard>
            );
          })
        )}
      </div>
    );
  };

  const renderRequisitos = () => {
    const TESI_URL = 'https://tesixtapaluca.edomex.gob.mx';
    const SIGAA_URL = 'https://sigaa.tesi.org.mx/index.php';
    const PAGOS_URL = 'https://pagosytramites.edomex.gob.mx/recaudacion/';
    const REGLAMENTO_URL = 'https://legislacion.edomex.gob.mx/sites/legislacion.edomex.gob.mx/files/files/pdf/rgl/vig/rglvig226.pdf';

    const requisitosList = [
      {
        titulo: 'Solicitud de reinscripción',
        desc: 'Formato oficial de solicitud de reinscripción debidamente llenado.',
        link: SIGAA_URL,
        linkTexto: 'Ir a SIGAA para solicitar'
      },
      {
        titulo: 'Comprobante de pago',
        desc: 'Realizar el pago correspondiente en la plataforma oficial y descargar el comprobante.',
        link: PAGOS_URL,
        linkTexto: 'Ir a pagos Edomex'
      },
      {
        titulo: 'Historial académico',
        desc: 'Kárdex o historial académico actualizado del ciclo anterior.',
        link: SIGAA_URL,
        linkTexto: 'Consultar en SIGAA'
      },
      {
        titulo: 'Carga académica',
        desc: 'Selección de materias y grupo a través del sistema SIGAA.',
        link: SIGAA_URL,
        linkTexto: 'Ir a SIGAA (carga académica)'
      },
      {
        titulo: 'Documentación personal',
        desc: 'Identificación oficial vigente, CURP y comprobante de domicilio reciente.',
        link: SIGAA_URL,
        linkTexto: 'Instrucciones en SIGAA'
      },
      {
        titulo: 'Lineamientos institucionales',
        desc: 'Revisar el reglamento académico y lineamientos institucionales publicados.',
        link: REGLAMENTO_URL,
        linkTexto: 'Reglamento TESI (PDF)'
      }
    ];

    return (
      <div className="stack">
        <SectionCard
          title="Requisitos para reinscripción"
          subtitle="Documentación y pasos necesarios para tu reinscripción"
        >
          <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <BadgeInfo size={18} />
            <span>
              Consulta los requisitos oficiales a través de los portales del <strong>Tecnológico de Estudios Superiores de Ixtapaluca (TESI)</strong> y la plataforma <strong>SIGAA</strong>.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <a
              href={TESI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> Ir al portal TESI
            </a>
            <a
              href={SIGAA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> Ir a SIGAA
            </a>
          </div>

          <div className="list">
            {requisitosList.map((req, i) => (
              <div key={i} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{req.titulo}</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{req.desc}</p>
                </div>
                <a
                  href={req.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost"
                  style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> {req.linkTexto}
                </a>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Enlaces oficiales" subtitle="Acceso directo a plataformas institucionales">
          <div className="grid-two">
            <a
              href={TESI_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem', border: '1px solid var(--border)',
                borderRadius: 8, textDecoration: 'none', color: 'inherit'
              }}
            >
              <GraduationCap size={32} style={{ color: '#1e40af' }} />
              <div>
                <strong>Tecnológico de Estudios Superiores de Ixtapaluca</strong>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{TESI_URL}</p>
              </div>
            </a>
            <a
              href={SIGAA_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem', border: '1px solid var(--border)',
                borderRadius: 8, textDecoration: 'none', color: 'inherit'
              }}
            >
              <FileText size={32} style={{ color: '#059669' }} />
              <div>
                <strong>Sistema Integral de Gestión Académico Administrativo</strong>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{SIGAA_URL}</p>
              </div>
            </a>
          </div>
        </SectionCard>
      </div>
    );
  };

  const renderHistorial = () => {
    const reinscripciones = historialData?.reinscripciones || [];
    const auditoria = historialData?.auditoria || [];

    return (
      <div className="stack">
        {reinscripciones.length > 0 && (
          <SectionCard title="Tus reinscripciones" subtitle="Resumen de todas tus solicitudes de reinscripción">
            <div className="list">
              {reinscripciones.map(r => (
                <div key={r.id_reinscripcion} className="list-item">
                  <strong>Folio RE-{String(r.id_reinscripcion).padStart(6, '0')} — {r.nombre_periodo}</strong>
                  <span>
                    Estado: <StatusBadge status={r.estado} /> •
                    Fecha: {formatDate(r.fecha_solicitud)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Historial de cambios" subtitle={`${auditoria.length} evento(s) registrados`}>
          {auditoria.length === 0 ? (
            <div className="empty">Sin actividad registrada.</div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <div className="table-responsive"><table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>Fecha</th>
                    <th style={{ padding: '0.4rem' }}>Acción</th>
                    <th style={{ padding: '0.4rem' }}>Anterior</th>
                    <th style={{ padding: '0.4rem' }}>Nuevo</th>
                    <th style={{ padding: '0.4rem' }}>Realizado por</th>
                    <th style={{ padding: '0.4rem' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map(a => (
                    <tr key={a.id_auditoria} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{formatDate(a.creado_en)}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <span className={`badge ${a.accion === 'VALIDAR' ? 'success' : a.accion === 'RECHAZAR' || a.accion === 'CANCELAR' ? 'error' : 'info'}`}
                          style={{ fontSize: '0.65rem' }}>{a.accion}</span>
                      </td>
                      <td style={{ padding: '0.4rem' }}>{a.estado_anterior || '—'}</td>
                      <td style={{ padding: '0.4rem' }}>{a.estado_nuevo || '—'}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.75rem' }}>{a.nombre_usuario || 'Sistema'}</td>
                      <td style={{ padding: '0.4rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.detalle || ''}>
                        {a.detalle || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  const renderExportar = () => {
    const items = estatusList.length > 0 ? estatusList : [];

    return (
      <div className="stack">
        <SectionCard
          title="Exportar comprobante"
          subtitle="Descarga tu comprobante de reinscripción en el formato que prefieras"
        >
          {items.length === 0 ? (
            <div className="empty">
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>No tienes reinscripciones registradas para exportar.</p>
              <button type="button" className="btn primary" onClick={() => setActiveTab('solicitud')}>
                Ir a solicitud
              </button>
            </div>
          ) : (
            <>
              <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                <Download size={18} />
                <span>Selecciona la reinscripción y el formato para descargar tu comprobante.</span>
              </div>

              <div className="list">
                {items.map(item => (
                  <div key={item.id_reinscripcion} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <strong>Folio RE-{String(item.id_reinscripcion).padStart(6, '0')}</strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                          {item.nombre_periodo} — <StatusBadge status={item.estado} />
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn secondary" style={{ fontSize: '0.8rem' }}
                        onClick={() => handleDescargar(item.id_reinscripcion, 'pdf')}>
                        <FileText size={14} /> PDF
                      </button>
                      <button type="button" className="btn secondary" style={{ fontSize: '0.8rem' }}
                        onClick={() => handleDescargar(item.id_reinscripcion, 'png')}>
                        <Image size={14} /> PNG
                      </button>
                      <button type="button" className="btn secondary" style={{ fontSize: '0.8rem' }}
                        onClick={() => handleDescargar(item.id_reinscripcion, 'jpg')}>
                        <Image size={14} /> JPG
                      </button>
                      <button type="button" className="btn secondary" style={{ fontSize: '0.8rem' }}
                        onClick={() => handleDescargar(item.id_reinscripcion, 'xlsx')}>
                        <FileSpreadsheet size={14} /> XLSX
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    );
  };

  // ======== RENDER PRINCIPAL ========

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <GraduationCap size={14} /> Autoservicio de reinscripciones
          </div>
          <h1>Mis Reinscripciones</h1>
          <p>
            Gestiona tu proceso de reinscripción de forma clara, segura y trazable:
            solicita, consulta el estatus, revisa requisitos y descarga tus comprobantes.
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

      <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn ghost" onClick={() => navigate('/app/alumno')}>
          <ArrowLeft size={16} /> Volver al panel
        </button>
        <button type="button" className="btn secondary" onClick={loadAll}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Cargando panel de reinscripciones...</span>
        </div>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          {activeTab === 'solicitud' && renderSolicitud()}
          {activeTab === 'estatus' && renderEstatus()}
          {activeTab === 'requisitos' && renderRequisitos()}
          {activeTab === 'historial' && renderHistorial()}
          {activeTab === 'exportar' && renderExportar()}
        </>
      )}
    </div>
  );
}
