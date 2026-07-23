import React from 'react';
import SectionCard from '../components/SectionCard';
import { FormField } from '../components/FormField';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import KardexPreview from '../components/KardexPreview';
import { reportes } from '../services/reportes';
import {
  AlertTriangle,
  Trash2,
  X,
  ShieldCheck,
  Eye,
  FileText,
  FileSpreadsheet,
  Search,
  Users,
  GraduationCap,
  BookOpen,
  Award,
  QrCode
} from 'lucide-react';

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function Badge({ children, variant }) {
  const colors = {
    aceptable: { bg: '#dcfce7', fg: '#166534' },
    riesgo: { bg: '#fef3c7', fg: '#92400e' },
    critico: { bg: '#fee2e2', fg: '#991b1b' },
    info: { bg: '#dbeafe', fg: '#1e40af' }
  };
  const c = colors[variant] || { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '10px', fontWeight: 600,
      background: c.bg, color: c.fg
    }}>{children}</span>
  );
}

function StatCard({ label, value, variant }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '8px', padding: '10px 14px',
      border: '1px solid #e2e8f0', flex: 1, minWidth: '100px'
    }}>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: '18px', fontWeight: 700, marginTop: '3px',
        color: variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : '#0f172a'
      }}>{value}</div>
    </div>
  );
}

function AlumnoKardexView({ token, alumno, alumnoData, handleOpenPreview, handleExportPDF, handleExportExcel }) {
  const a = alumno;
  const resumen = alumnoData?.resumen || {};
  const historial = alumnoData?.historial || [];
  const prom = parseFloat(a?.promedio_general) || 0;

  if (!a) {
    return <div className="empty">Cargando tu kardex...</div>;
  }

  return (
    <div className="form-stack">
      <div className="kardex-card" style={{ padding: '14px' }}>
        <div className="row gap" style={{ gap: '14px', flexWrap: 'wrap' }}>
          <div className="photo-box" style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
            {a.fotografia_url ? (
              <img src={a.fotografia_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', fontSize: '28px', fontWeight: 700, color: '#94a3b8' }}>
                {(a.nombres || 'A').charAt(0)}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 3px', fontSize: '16px' }}>{a.nombre_completo}</h4>
            <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
              {a.matricula} · {alumnoData?.nombre_carrera || '—'} · {a.semestre_actual}° semestre
            </p>
            {a.curp && <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>CURP: {a.curp}</p>}
            {alumnoData?.folio_kardex && (
              <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>Folio: {alumnoData.folio_kardex}</p>
            )}
          </div>
        </div>

        <div className="row gap wrap" style={{ marginTop: '10px' }}>
          <StatCard label="Promedio general" value={prom.toFixed(2)}
            variant={prom < 70 ? 'danger' : prom < 80 ? 'warning' : ''} />
          <StatCard label="Créditos" value={resumen.creditosAcumulados ?? a.creditos_acumulados ?? 0} />
          <StatCard label="Materias cursadas" value={resumen.totalMaterias || 0} />
          <StatCard label="Acreditadas" value={resumen.acreditadas || 0} variant="aceptable" />
          <StatCard label="No acreditadas" value={resumen.noAcreditadas || 0}
            variant={resumen.noAcreditadas > 0 ? 'danger' : ''} />
          <StatCard label="Estatus"
            value={(a.estatus_academico || a.estatus || 'Regular').replace(/_/g, ' ')}
            variant={a.estatus_academico === 'Regular' ? 'aceptable' : a.estatus_academico === 'Irregular' ? 'riesgo' : 'info'} />
        </div>
      </div>

      {alumnoData?.url_qr && (
        <div className="kardex-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <QrCode size={24} style={{ color: '#1e40af' }} />
          <div>
            <strong style={{ fontSize: '12px' }}>Código QR personal</strong>
            <p style={{ margin: '2px 0', fontSize: '10px', color: '#64748b' }}>
              Escanea para validar tu kardex
            </p>
          </div>
          <a className="btn secondary" href={alumnoData.url_qr} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
            Ver QR
          </a>
        </div>
      )}

      <div className="row gap wrap" style={{ marginTop: '6px' }}>
        <button className="btn primary" onClick={handleOpenPreview} type="button">
          <Eye size={16} /> Vista previa
        </button>
        <button className="btn danger" onClick={handleExportPDF} type="button">
          <FileText size={16} /> Descargar PDF
        </button>
        <button className="btn accent" onClick={handleExportExcel} type="button">
          <FileSpreadsheet size={16} /> Descargar Excel
        </button>
      </div>

      {historial.length > 0 && (
        <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: '12px' }}>Historial académico</h5>
          <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: '#1e40af', color: '#fff' }}>
                <th style={{ padding: '4px 6px' }}>Periodo</th>
                <th style={{ padding: '4px 6px' }}>Clave</th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>Materia</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>Calif.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>Créd.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r, i) => (
                <tr key={r.id_historial || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '3px 6px' }}>{r.nombre_periodo}</td>
                  <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{r.clave_materia}</td>
                  <td style={{ padding: '3px 6px' }}>{r.nombre_materia}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{r.calificacion ?? '—'}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.creditos || '—'}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontSize: '9px' }}>{r.tipo_materia || '—'}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                    <Badge variant={r.estado_materia === 'Acreditada' ? 'aceptable' : r.estado_materia === 'Cursando' ? 'info' : 'critico'}>
                      {r.estado_materia}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {historial.length === 0 && (
        <div className="empty" style={{ marginTop: '8px' }}>No hay materias registradas en tu historial académico.</div>
      )}
    </div>
  );
}

export default function KardexPage() {
  const { token, user } = useAuth();

  const role = normalizeRole(user?.rol || user?.rol_nombre || user?.role);
  const isAlumno = role === 'ALUMNO';
  const isAdmin = role === 'ADMINISTRADOR';

  const [alumnoId, setAlumnoId] = React.useState('');
  const [grupoId, setGrupoId] = React.useState('');
  const [alumno, setAlumno] = React.useState(null);
  const [alumnoData, setAlumnoData] = React.useState(null);
  const [grupo, setGrupo] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [showDeletePhotoModal, setShowDeletePhotoModal] = React.useState(false);
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [qrTarget, setQrTarget] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewData, setPreviewData] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState('');

  const loadAlumno = React.useCallback(
    async (id) => {
      try {
        const numericId = Number(id);
        if (!numericId) {
          setMessage('Ingresa un ID de alumno válido');
          return;
        }
        const res = await api.kardexAlumno(token, numericId);
        setAlumno(res?.data ?? res);
      } catch (error) {
        console.error(error);
        setAlumno(null);
        setMessage('No fue posible cargar el kardex del alumno');
      }
    },
    [token]
  );

  const loadMyAlumno = React.useCallback(async () => {
    try {
      const res = await api.kardexAlumnoMe(token);
      const d = res?.data ?? res;
      setAlumno(d);
      setAlumnoData(d);
    } catch (error) {
      console.error(error);
      setAlumno(null);
      setAlumnoData(null);
      setMessage('No fue posible cargar tu kardex');
    }
  }, [token]);

  const loadGrupo = React.useCallback(async () => {
    try {
      const numericId = Number(grupoId);
      if (!numericId) {
        setMessage('Ingresa un ID de grupo válido');
        return;
      }
      const res = await api.kardexGrupo(token, numericId);
      setGrupo(res?.data ?? res);
    } catch (error) {
      console.error(error);
      setGrupo(null);
      setMessage('No fue posible cargar el kardex del grupo');
    }
  }, [token, grupoId]);

  React.useEffect(() => {
    if (isAlumno && token) {
      loadMyAlumno();
    }
  }, [isAlumno, token, loadMyAlumno]);

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAdmin) {
      setMessage('Solo el administrador puede cargar fotografías institucionales.');
      return;
    }

    try {
      const alumnoKey = alumno?.id_alumno || alumnoId;
      const res = await api.subirFotoAlumno(token, alumnoKey, file);
      setMessage(res?.message || 'Fotografía institucional actualizada correctamente');
      if (isAlumno) {
        await loadMyAlumno();
      } else {
        await loadAlumno(alumnoId);
      }
    } catch (error) {
      console.error(error);
      setMessage('No fue posible subir la fotografía institucional');
    }
  };

  const openDeletePhotoModal = () => {
    if (!isAdmin) {
      setMessage('Solo el administrador puede eliminar fotografías institucionales.');
      return;
    }
    setShowDeletePhotoModal(true);
  };

  const closeDeletePhotoModal = () => setShowDeletePhotoModal(false);

  const confirmDeletePhoto = async () => {
    try {
      const alumnoKey = alumno?.id_alumno || alumnoId;
      const res = await api.deleteFotoAlumno(token, alumnoKey);
      setMessage(res?.message || 'Fotografía eliminada correctamente');
      closeDeletePhotoModal();
      if (isAlumno) {
        await loadMyAlumno();
      } else {
        await loadAlumno(alumnoId);
      }
    } catch (error) {
      console.error(error);
      setMessage('No fue posible eliminar la fotografía institucional');
    }
  };

  const openQrModal = (target) => {
    if (!isAdmin) {
      setMessage('Solo el administrador puede generar QR institucionales.');
      return;
    }
    setQrTarget(target);
    setShowQrModal(true);
  };

  const closeQrModal = () => {
    setShowQrModal(false);
    setQrTarget(null);
  };

  const confirmGenerateQr = async () => {
    try {
      if (qrTarget === 'alumno') {
        const alumnoKey = alumno?.id_alumno || alumnoId;
        const res = await api.generarQrAlumno(token, alumnoKey);
        setMessage(res?.message || 'QR del alumno generado correctamente');
        if (isAlumno) {
          await loadMyAlumno();
        } else {
          await loadAlumno(alumnoId);
        }
      }
      if (qrTarget === 'grupo') {
        const res = await api.generarQrGrupo(token, grupoId);
        setMessage(res?.message || 'QR del grupo generado correctamente');
        await loadGrupo();
      }
      closeQrModal();
    } catch (error) {
      console.error(error);
      setMessage('No fue posible generar el QR institucional');
    }
  };

  const handleOpenPreview = React.useCallback(async () => {
    if (!alumno) {
      setMessage('No hay alumno cargado para previsualizar.');
      return;
    }
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const id = alumno.id_alumno || alumnoId;
      const res = isAlumno
        ? await reportes.getMyPreview(token)
        : await reportes.getPreview(token, id);
      setPreviewData(res?.data ?? res);
      setShowPreview(true);
    } catch (error) {
      console.error(error);
      setPreviewError(error?.message || 'No fue posible cargar la vista previa del kardex');
      setPreviewData(null);
      setShowPreview(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [token, alumno, alumnoId, isAlumno]);

  const closePreview = React.useCallback(() => {
    setShowPreview(false);
    setPreviewData(null);
    setPreviewError('');
  }, []);

  const handleExportPDF = React.useCallback(async () => {
    try {
      if (isAlumno) {
        await reportes.downloadMyPDF(token);
      } else {
        const id = alumno?.id_alumno || alumnoId;
        await reportes.downloadPDF(token, id);
      }
      setMessage('PDF descargado correctamente');
    } catch (error) {
      console.error(error);
      setMessage(error?.message || 'No fue posible descargar el PDF');
    }
  }, [token, alumno, alumnoId, isAlumno]);

  const handleExportExcel = React.useCallback(async () => {
    try {
      if (isAlumno) {
        await reportes.downloadMyExcel(token);
      } else {
        const id = alumno?.id_alumno || alumnoId;
        await reportes.downloadExcel(token, id);
      }
      setMessage('Excel descargado correctamente');
    } catch (error) {
      console.error(error);
      setMessage(error?.message || 'No fue posible descargar el Excel');
    }
  }, [token, alumno, alumnoId, isAlumno]);

  if (isAlumno) {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 4px' }}>Mi kardex académico</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Consulta tu expediente académico, revisa tu promedio, créditos acumulados y
            el historial completo de materias cursadas.
          </p>
        </div>

        <SectionCard title="Kardex individual" subtitle="Información académica personal">
          <AlumnoKardexView
            token={token}
            alumno={alumno}
            alumnoData={alumnoData}
            handleOpenPreview={handleOpenPreview}
            handleExportPDF={handleExportPDF}
            handleExportExcel={handleExportExcel}
          />
        </SectionCard>

        {message && <div className="alert info">{message}</div>}

        {showPreview && (
          <div className="modal-backdrop" role="presentation" onClick={closePreview}>
            <div className="modal-card preview-modal" role="dialog" aria-modal="true"
              aria-labelledby="preview-title" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3 id="preview-title">Vista previa del kardex</h3>
                <button type="button" className="icon-btn modal-close" onClick={closePreview} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
              <div className="preview-modal-content">
                <KardexPreview
                  data={previewData}
                  loading={previewLoading}
                  error={previewError}
                  onExportPDF={handleExportPDF}
                  onExportExcel={handleExportExcel}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="two-col">
      <SectionCard
        title="Kardex individual"
        subtitle="Información académica con fotografía institucional del alumno"
      >
        <div className="form-stack">
          {!isAlumno && (
            <div className="grid-two">
              <FormField label="ID Alumno">
                <input
                  value={alumnoId}
                  onChange={(e) => setAlumnoId(e.target.value)}
                />
              </FormField>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  className="btn accent"
                  onClick={() => loadAlumno(alumnoId)}
                  type="button"
                >
                  Consultar
                </button>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="alert info" style={{ textAlign: 'center' }}>
              <strong>Fotografía institucional:</strong> únicamente se aceptan imágenes capturadas por
              Control Escolar. No se permiten selfies, filtros, ediciones tipo Photoshop ni fotografías
              con estilo de redes sociales. La imagen debe ser oficial, nítida y apta para identificación académica.
            </div>
          )}

          <div className="kardex-card">
            {alumno ? (
              <div className="kardex-grid">
                <div className="photo-box">
                  {alumno.fotografia_url ? (
                    <img src={alumno.fotografia_url} alt="Foto alumno" />
                  ) : (
                    <div className="avatar big">
                      {(alumno.nombre || 'A').charAt(0)}
                    </div>
                  )}
                </div>

                <div>
                  <h3>
                    {alumno.nombre_completo ||
                      `${alumno.nombre || ''} ${alumno.apellidos || ''}`.trim()}
                  </h3>

                  <p>Matrícula: {alumno.matricula}</p>
                  <p>Promedio general: {alumno.promedio_general || '0.00'}</p>
                  <p>Estatus: {alumno.estatus || 'Vigente'}</p>

                  <div className="row gap wrap">
                    {isAdmin && (
                      <label className="btn secondary">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          onChange={uploadPhoto}
                        />
                        Subir foto institucional
                      </label>
                    )}

                    {isAdmin && alumno?.fotografia_url && (
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={openDeletePhotoModal}
                      >
                        <Trash2 size={16} />
                        Eliminar foto
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        className="btn primary"
                        onClick={() => openQrModal('alumno')}
                        type="button"
                      >
                        Generar QR
                      </button>
                    )}

                    {alumno.url_qr && (
                      <a
                        className="btn secondary"
                        href={alumno.url_qr}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver QR
                      </a>
                    )}

                    <button
                      className="btn primary"
                      onClick={handleOpenPreview}
                      type="button"
                    >
                      <Eye size={16} />
                      Vista previa
                    </button>

                    <button
                      className="btn danger"
                      onClick={handleExportPDF}
                      type="button"
                    >
                      <FileText size={16} />
                      PDF
                    </button>

                    <button
                      className="btn accent"
                      onClick={handleExportExcel}
                      type="button"
                    >
                      <FileSpreadsheet size={16} />
                      Excel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty">
                Consulta un alumno para cargar su kardex.
              </div>
            )}
          </div>

          {message && <div className="alert info">{message}</div>}
        </div>
      </SectionCard>

      <SectionCard
        title="Kardex general por grupo"
        subtitle="Listado de alumnos y QR del grupo"
      >
        <div className="form-stack">
          <div className="grid-two">
            <FormField label="ID Grupo">
              <input
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
              />
            </FormField>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                className="btn accent"
                onClick={loadGrupo}
                type="button"
              >
                Consultar
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="alert info" style={{ textAlign: 'center' }}>
              La generación de QR institucionales para grupos está restringida exclusivamente al administrador.
            </div>
          )}

          <div className="kardex-card">
            {grupo ? (
              <div>
                <div className="row between" style={{ justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <h3>Grupo {grupo.nombre_grupo || '—'}</h3>
                    <p>Periodo: {grupo.nombre_periodo || '—'}</p>
                    <p>Alumnos: {(grupo.alumnos || []).length}</p>
                  </div>

                  {isAdmin && (
                    <button
                      className="btn primary"
                      onClick={() => openQrModal('grupo')}
                      type="button"
                    >
                      Generar QR
                    </button>
                  )}
                </div>

                {grupo.alumnos && grupo.alumnos.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: '10px', overflowX: 'auto' }}>
                    <div className="table-responsive"><table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: '#1e40af', color: '#fff' }}>
                          <th style={{ padding: '5px 7px', textAlign: 'left' }}>Alumno</th>
                          <th style={{ padding: '5px 7px', textAlign: 'center' }}>Matrícula</th>
                          <th style={{ padding: '5px 7px', textAlign: 'center' }}>Promedio</th>
                          <th style={{ padding: '5px 7px', textAlign: 'center' }}>Estatus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.alumnos.map((a, i) => (
                          <tr key={a.id_alumno} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={{ padding: '4px 7px', fontWeight: 600 }}>{a.nombre_completo || `${a.nombre || ''} ${a.apellidos || ''}`}</td>
                            <td style={{ padding: '4px 7px', textAlign: 'center', fontFamily: 'monospace' }}>{a.matricula}</td>
                            <td style={{ padding: '4px 7px', textAlign: 'center' }}>{parseFloat(a.promedio_general || 0).toFixed(2)}</td>
                            <td style={{ padding: '4px 7px', textAlign: 'center' }}>{a.estatus_kardex || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                )}

                {grupo.alumnos && grupo.alumnos.length === 0 && (
                  <div className="empty" style={{ marginTop: '8px' }}>No hay alumnos activos en este grupo.</div>
                )}

                {grupo.url_qr && (
                  <a
                    className="btn secondary mt"
                    href={grupo.url_qr}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginTop: '1rem', display: 'inline-flex' }}
                  >
                    Ver QR del grupo
                  </a>
                )}
              </div>
            ) : (
              <div className="empty">
                Consulta un grupo para cargar su kardex general.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {showDeletePhotoModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeDeletePhotoModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-title"
            aria-describedby="delete-photo-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="row gap">
                <div className="modal-icon danger">
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <h3 id="delete-photo-title">Confirmar eliminación</h3>
                  <p id="delete-photo-description">
                    Esta acción eliminará la fotografía institucional del alumno.
                    El kardex no se dañará, pero la imagen dejará de mostrarse hasta que se cargue una nueva.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="icon-btn modal-close"
                onClick={closeDeletePhotoModal}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-note">
              <ShieldCheck size={16} />
              Solo Control Escolar y el administrador deben usar esta acción para fotografías oficiales.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={closeDeletePhotoModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn danger"
                onClick={confirmDeletePhoto}
              >
                <Trash2 size={16} />
                Sí, eliminar foto
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeQrModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            aria-describedby="qr-modal-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="row gap">
                <div className="modal-icon warning">
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <h3 id="qr-modal-title">Confirmar regeneración de QR</h3>
                  <p id="qr-modal-description">
                    Esta acción generará un nuevo código QR institucional y reemplazará el anterior.
                    El QR viejo dejará de ser válido para evitar duplicidad o uso incorrecto.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="icon-btn modal-close"
                onClick={closeQrModal}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-note warning">
              <ShieldCheck size={16} />
              Solo el administrador puede regenerar QR institucionales. Esta acción debe usarse con cuidado.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={closeQrModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn danger"
                onClick={confirmGenerateQr}
              >
                <Trash2 size={16} />
                Sí, regenerar QR
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closePreview}
        >
          <div
            className="modal-card preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="preview-title">Vista previa del kardex</h3>
              <button
                type="button"
                className="icon-btn modal-close"
                onClick={closePreview}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="preview-modal-content">
              <KardexPreview
                data={previewData}
                loading={previewLoading}
                error={previewError}
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
