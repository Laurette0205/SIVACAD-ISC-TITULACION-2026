import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import KardexPreview from '../components/KardexPreview';
import KardexButton from '../components/KardexButton';
import { api } from '../services/api';
import { reportes } from '../services/reportes';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, Search, RefreshCw, ArrowLeft, Loader2,
  Download, FileText, FileSpreadsheet, Camera, QrCode,
  History, Shield, CheckCircle2, XCircle, AlertTriangle,
  User, GraduationCap, Eye, Upload, Plus, Trash2, X, Terminal
} from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function Badge({ type, children }) {
  const cls = type === 'success' ? 'badge badge-success' :
    type === 'danger' ? 'badge badge-danger' :
    type === 'warning' ? 'badge badge-warning' :
    type === 'info' ? 'badge badge-info' : 'badge badge-light';
  return <span className={cls}>{children}</span>;
}

const TABS = [
  { key: 'general', label: 'Kardex general', icon: BookOpen },
  { key: 'individual', label: 'Kardex individual', icon: User },
  { key: 'foto', label: 'Foto institucional', icon: Camera },
  { key: 'qr', label: 'Validación QR', icon: QrCode },
  { key: 'historial', label: 'Historial académico', icon: History },
  { key: 'auditoria', label: 'Auditoría de expedientes', icon: Shield }
];

export default function AdminKardexPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('general');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  // Kardex general
  const [kardexList, setKardexList] = React.useState([]);
  const [pagination, setPagination] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [estatusFilter, setEstatusFilter] = React.useState('');

  // Individual
  const [selectedId, setSelectedId] = React.useState('');
  const [kardexData, setKardexData] = React.useState(null);

  // Foto
  const [fotoAlumnoId, setFotoAlumnoId] = React.useState('');

  // QR
  const [qrAlumnoId, setQrAlumnoId] = React.useState('');
  const [qrData, setQrData] = React.useState(null);

  // Historial
  const [historialAlumnoId, setHistorialAlumnoId] = React.useState('');
  const [historialData, setHistorialData] = React.useState(null);
  const [nuevoHistorial, setNuevoHistorial] = React.useState({ id_periodo: '', id_materia: '', calificacion: '', creditos: '', estado: 'Cursando', tipo_materia: 'Ordinaria' });

  // Preview
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewData, setPreviewData] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState('');

  // Auditoría
  const [auditoriaData, setAuditoriaData] = React.useState([]);
  const [auditoriaPagination, setAuditoriaPagination] = React.useState(null);
  const [auditoriaFiltro, setAuditoriaFiltro] = React.useState('');
  const [cleaningAudit, setCleaningAudit] = React.useState(false);

  // ========== LOADERS ==========

  const loadKardexGeneral = React.useCallback(async (page = 1) => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (estatusFilter) params.estatus = estatusFilter;
      const res = await api.adminKardexGeneral(token, params);
      setKardexList(res?.data || []);
      setPagination(res?.pagination || null);
    } catch (err) {
      setError(err?.message || 'Error al cargar kardex general');
    } finally { setLoading(false); }
  }, [token, searchQuery, estatusFilter]);

  const loadKardexIndividual = React.useCallback(async (id) => {
    if (!token || !id) return;
    setLoading(true); setError(''); setKardexData(null);
    try {
      const res = await api.adminKardexIndividual(token, Number(id));
      setKardexData(res?.data || null);
    } catch (err) {
      setError(err?.message || 'Error al cargar kardex individual');
    } finally { setLoading(false); }
  }, [token]);

  const loadHistorial = React.useCallback(async (id) => {
    if (!token || !id) return;
    setLoading(true); setError('');
    try {
      const res = await api.adminKardexHistorial(token, Number(id));
      setHistorialData(res?.data || null);
    } catch (err) {
      setError(err?.message || 'Error al cargar historial');
    } finally { setLoading(false); }
  }, [token]);

  const loadAuditoria = React.useCallback(async (page = 1) => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = { page, limit: 30 };
      if (auditoriaFiltro) params.accion = auditoriaFiltro;
      const res = await api.adminKardexAuditoria(token, params);
      setAuditoriaData(res?.data || []);
      setAuditoriaPagination(res?.pagination || null);
    } catch (err) {
      setError(err?.message || 'Error al cargar auditoría');
    } finally { setLoading(false); }
  }, [token, auditoriaFiltro]);

  React.useEffect(() => {
    loadKardexGeneral();
    loadAuditoria();
  }, [loadKardexGeneral, loadAuditoria]);

  // ========== HANDLERS ==========

  const handleExportPDF = async (id) => {
    try {
      const blob = await api.adminKardexExportPDF(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kardex_${id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setMessage('PDF exportado correctamente');
    } catch (err) { setError(err?.message || 'Error al exportar PDF'); }
  };

  const handleExportExcel = async (id) => {
    try {
      const blob = await api.adminKardexExportExcel(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kardex_${id}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setMessage('Excel exportado correctamente');
    } catch (err) { setError(err?.message || 'Error al exportar Excel'); }
  };

  const handleExportKardexPDF = async (id) => {
    try {
      const blob = await api.kardexExportPDF(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kardex-export_${id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setMessage('Kardex PDF exportado correctamente (plantilla institucional)');
    } catch (err) { setError(err?.message || 'Error al exportar kardex PDF'); }
  };

  const handleExportKardexExcel = async (id) => {
    try {
      const blob = await api.kardexExportExcel(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kardex-export_${id}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setMessage('Kardex Excel exportado correctamente (2 hojas)');
    } catch (err) { setError(err?.message || 'Error al exportar kardex Excel'); }
  };

  const handleSubirFoto = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!fotoAlumnoId) { setError('Ingresa el ID del alumno'); return; }
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.jpg,.jpeg,.png,.webp';
    fileInput.onchange = async (ev) => {
      const file = ev.target.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append('foto', file);
      try {
        await api.adminKardexSubirFoto(token, Number(fotoAlumnoId), fd);
        setMessage('Fotografía institucional cargada (autorizada por Control Escolar)');
      } catch (err) { setError(err?.message || 'Error al subir foto'); }
    };
    fileInput.click();
  };

  const handleGenerarQR = async () => {
    if (!qrAlumnoId) { setError('Ingresa el ID del alumno'); return; }
    try {
      const res = await api.adminKardexGenerarQR(token, Number(qrAlumnoId));
      setQrData(res?.data || null);
      setMessage('QR generado correctamente');
    } catch (err) { setError(err?.message || 'Error al generar QR'); }
  };

  const handleAgregarHistorial = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!historialAlumnoId) { setError('Selecciona un alumno primero'); return; }
    try {
      await api.adminKardexAgregarHistorial(token, {
        id_alumno: Number(historialAlumnoId),
        id_periodo: Number(nuevoHistorial.id_periodo) || undefined,
        id_materia: Number(nuevoHistorial.id_materia) || undefined,
        calificacion: Number(nuevoHistorial.calificacion) || undefined,
        creditos: Number(nuevoHistorial.creditos) || 0,
        estado: nuevoHistorial.estado,
        tipo_materia: nuevoHistorial.tipo_materia
      });
      setMessage('Registro académico agregado');
      setNuevoHistorial({ id_periodo: '', id_materia: '', calificacion: '', creditos: '', estado: 'Cursando', tipo_materia: 'Ordinaria' });
      await loadHistorial(historialAlumnoId);
    } catch (err) { setError(err?.message || 'Error al agregar historial'); }
  };

  const handleVerDetalle = (id) => {
    setSelectedId(String(id));
    setActiveTab('individual');
    loadKardexIndividual(id);
  };

  const handleOpenPreview = React.useCallback(async (id) => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await reportes.getPreview(token, id);
      setPreviewData(res?.data ?? res);
      setShowPreview(true);
    } catch (err) {
      setPreviewError(err?.message || 'Error al cargar vista previa');
      setPreviewData(null);
      setShowPreview(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [token]);

  const closePreview = React.useCallback(() => {
    setShowPreview(false);
    setPreviewData(null);
    setPreviewError('');
  }, []);

  const handleLimpiarAuditoria = React.useCallback(async () => {
    const confirmar = window.confirm(
      '¿Estás seguro de limpiar TODOS los registros de auditoría?\n\n' +
      'Esta acción eliminará permanentemente toda la trazabilidad de cambios en kardex.\n' +
      'Se recomienda hacer una exportación de respaldo antes de continuar.\n\n' +
      '¿Deseas continuar?'
    );
    if (!confirmar) return;

    setCleaningAudit(true);
    try {
      const res = await api.adminKardexLimpiarAuditoria(token, { confirmacion: 'SI_LIMPIAR' });
      setMessage(res?.message || 'Auditoría limpiada correctamente');
      await loadAuditoria();
    } catch (err) {
      setError(err?.message || 'Error al limpiar auditoría');
    } finally {
      setCleaningAudit(false);
    }
  }, [token, loadAuditoria]);

  // ========== RENDER TABS ==========

  const renderGeneral = () => (
    <div className="stack">
      <SectionCard title="Kardex general" subtitle="Listado global de expedientes académicos">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <small>Buscar</small>
            <div className="row gap">
              <Search size={16} className="muted" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nombre, matrícula o folio..." />
            </div>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <small>Estatus</small>
            <select value={estatusFilter} onChange={e => setEstatusFilter(e.target.value)}>
              <option value="">Todos</option>
              <option value="Vigente">Vigente</option>
              <option value="Egresado">Egresado</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => loadKardexGeneral()}><Search size={16} /> Filtrar</button>
          </div>
        </div>

        {loading ? (
          <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando...</div>
        ) : kardexList.length === 0 ? (
          <div className="empty"><GraduationCap size={48} style={{ opacity: 0.3 }} /><p>No hay expedientes registrados.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Matrícula</th>
                    <th>Nombre</th>
                    <th>Carrera</th>
                    <th>Promedio</th>
                    <th>Créditos</th>
                    <th>Estatus</th>
                    <th>Actualización</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {kardexList.map(k => (
                    <tr key={k.id_kardex}>
                      <td><code>{k.folio_kardex || '—'}</code></td>
                      <td><code>{k.matricula}</code></td>
                      <td>{k.nombres} {k.apellido_paterno} {k.apellido_materno}</td>
                      <td>{k.nombre_carrera}</td>
                      <td>{Number(k.promedio_general).toFixed(2)}</td>
                      <td>{k.creditos_acumulados}</td>
                      <td><Badge type={k.estatus === 'Vigente' ? 'success' : k.estatus === 'Egresado' ? 'info' : 'danger'}>{k.estatus}</Badge></td>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(k.ultima_actualizacion)}</td>
                      <td>
                        <div className="row gap" style={{ gap: '0.25rem' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => handleVerDetalle(k.id_alumno)}>
                            <Eye size={14} /> Ver
                          </button>
                          <button className="btn btn-sm btn-primary" onClick={() => handleOpenPreview(k.id_alumno)} title="Vista previa institucional">
                            <Eye size={14} /> Prev.
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleExportKardexPDF(k.id_alumno)} title="Exportar PDF institucional (Puppeteer)">
                            <FileText size={14} /> PDF
                          </button>
                          <KardexButton
                            idAlumno={k.id_alumno}
                            label="PDF+"
                            variant="primary"
                            size="sm"
                            mode="node"
                            className="btn-sm"
                          />
                          <button className="btn btn-sm btn-outline" onClick={() => handleExportKardexExcel(k.id_alumno)} title="Exportar Excel institucional (2 hojas)">
                            <FileSpreadsheet size={14} /> XLSX
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && (
              <div className="row gap" style={{ marginTop: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-sm btn-outline" disabled={pagination.page <= 1} onClick={() => loadKardexGeneral(pagination.page - 1)}>Anterior</button>
                <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>Pág. {pagination.page} de {pagination.pages} ({pagination.total} registros)</span>
                <button className="btn btn-sm btn-outline" disabled={pagination.page >= pagination.pages} onClick={() => loadKardexGeneral(pagination.page + 1)}>Siguiente</button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );

  const renderIndividual = () => (
    <div className="stack">
      <SectionCard title="Kardex individual" subtitle="Selecciona un alumno para ver su expediente completo">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <small>ID Alumno, ID Usuario o matrícula</small>
            <input value={selectedId} onChange={e => setSelectedId(e.target.value)} placeholder="Ej: 1 o buscar desde Kardex general" />
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => loadKardexIndividual(selectedId)}>
              <Search size={16} /> Consultar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando kardex...</div>
        ) : !kardexData ? (
          <div className="empty"><User size={48} style={{ opacity: 0.3 }} /><p>Selecciona un alumno para visualizar su kardex.</p></div>
        ) : (
          <>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{kardexData.nombre_completo}</h3>
                <div className="row gap" style={{ gap: '0.25rem' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => handleExportPDF(kardexData.id_alumno)} title="Exportar PDF (legacy)">
                    <FileText size={14} /> PDF
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => handleExportExcel(kardexData.id_alumno)} title="Exportar Excel (legacy)">
                    <FileSpreadsheet size={14} /> XLSX
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => handleExportKardexPDF(kardexData.id_alumno)} title="Exportar PDF institucional (Puppeteer)">
                    <FileText size={14} /> PDF+
                  </button>
                  <KardexButton
                    idAlumno={kardexData.id_alumno}
                    label="PDF Dompdf"
                    variant="accent"
                    size="sm"
                    mode="node"
                    className="btn-sm"
                  />
                  <button className="btn btn-sm btn-primary" onClick={() => handleExportKardexExcel(kardexData.id_alumno)} title="Exportar Excel institucional (2 hojas)">
                    <FileSpreadsheet size={14} /> XLSX+
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="grid-two" style={{ fontSize: '0.9rem' }}>
                  <div><strong>Folio:</strong> <code>{kardexData.folio_kardex || '—'}</code></div>
                  <div><strong>Matrícula:</strong> {kardexData.matricula}</div>
                  <div><strong>CURP:</strong> {kardexData.curp || '—'}</div>
                  <div><strong>Carrera:</strong> {kardexData.carrera || '—'}</div>
                  <div><strong>Semestre:</strong> {kardexData.semestre_actual || '—'}</div>
                  <div><strong>Promedio:</strong> {Number(kardexData.promedio_general).toFixed(2)}</div>
                  <div><strong>Créditos:</strong> {kardexData.creditos_acumulados || 0}</div>
                  <div><strong>Estatus:</strong> <Badge type={kardexData.estatus === 'Vigente' ? 'success' : kardexData.estatus === 'Egresado' ? 'info' : 'danger'}>{kardexData.estatus}</Badge></div>
                </div>
                {kardexData.fotografia_url && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong>Fotografía institucional:</strong><br />
                    <img src={kardexData.fotografia_url} alt="Foto" style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                )}
                {kardexData.url_qr && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong>QR de verificación:</strong><br />
                    <img src={kardexData.url_qr} alt="QR" style={{ width: 100, borderRadius: 4 }} />
                  </div>
                )}
                {kardexData.firma_electronica && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    <strong>Firma electrónica:</strong> <code>{kardexData.firma_electronica}</code>
                  </div>
                )}
              </div>
            </div>

            {kardexData.historial?.length > 0 && (
              <SectionCard title="Historial académico" subtitle={`${kardexData.historial.length} registro(s)`}>
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Materia</th>
                        <th>Clave</th>
                        <th>Calif.</th>
                        <th>Créditos</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexData.historial.map(h => (
                        <tr key={h.id_historial}>
                          <td>{h.nombre_periodo || '—'}</td>
                          <td>{h.nombre_materia || '—'}</td>
                          <td><code>{h.clave_materia || '—'}</code></td>
                          <td>{h.calificacion?.toFixed(1) || '—'}</td>
                          <td>{h.creditos || 0}</td>
                          <td><Badge type={h.estado === 'Acreditada' ? 'success' : h.estado === 'No Acreditada' ? 'danger' : 'info'}>{h.estado}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );

  const renderFoto = () => (
    <div className="stack">
      <SectionCard title="Carga de fotografía institucional" subtitle="Solo imágenes autorizadas por Control Escolar">
        <div className="alert info" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <Camera size={18} />
          <span>No se permiten selfies, filtros, Photoshop ni fotos para redes sociales. Solo fotografía institucional.</span>
        </div>
        <div className="row gap wrap">
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <small>ID del alumno</small>
            <input type="number" value={fotoAlumnoId} onChange={e => setFotoAlumnoId(e.target.value)} placeholder="Ej: 1" />
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSubirFoto}>
              <Upload size={16} /> Seleccionar y subir foto
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );

  const renderQR = () => (
    <div className="stack">
      <SectionCard title="Validación y generación de QR" subtitle="Código QR institucional para verificación de expedientes">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <small>ID del alumno</small>
            <input type="number" value={qrAlumnoId} onChange={e => setQrAlumnoId(e.target.value)} placeholder="Ej: 1" />
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleGenerarQR}>
              <QrCode size={16} /> Generar QR
            </button>
          </div>
        </div>
        {qrData && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            {qrData.url_qr && <img src={qrData.url_qr} alt="QR" style={{ width: 150, borderRadius: 8 }} />}
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>Token: {qrData.qr_token}</p>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderHistorial = () => (
    <div className="stack">
      <SectionCard title="Historial académico" subtitle="Consulta y registro de materias cursadas">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <small>ID del alumno</small>
            <input type="number" value={historialAlumnoId} onChange={e => {
              setHistorialAlumnoId(e.target.value);
              if (e.target.value) loadHistorial(e.target.value);
            }} placeholder="Ej: 1" />
          </div>
        </div>

        {!historialAlumnoId ? (
          <div className="empty"><History size={48} style={{ opacity: 0.3 }} /><p>Selecciona un alumno para ver su historial académico.</p></div>
        ) : (
          <>
            {loading ? (
              <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando historial...</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span className="badge badge-info">Total: {historialData?.length || 0}</span>
                  <span className="badge badge-success">Acreditadas: {historialData?.filter(h => h.estado === 'Acreditada').length || 0}</span>
                  <span className="badge badge-danger">No acreditadas: {historialData?.filter(h => h.estado === 'No Acreditada').length || 0}</span>
                  <span className="badge badge-warning">Cursando: {historialData?.filter(h => h.estado === 'Cursando').length || 0}</span>
                </div>

                {historialData?.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Período</th>
                          <th>Materia</th>
                          <th>Clave</th>
                          <th>Calif.</th>
                          <th>Créditos</th>
                          <th>Estado</th>
                          <th>Tipo</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialData.map(h => (
                          <tr key={h.id_historial}>
                            <td>{h.nombre_periodo || '—'}</td>
                            <td>{h.nombre_materia || '—'}</td>
                            <td><code>{h.clave_materia || '—'}</code></td>
                            <td>{h.calificacion?.toFixed(1) || '—'}</td>
                            <td>{h.creditos || 0}</td>
                            <td><Badge type={h.estado === 'Acreditada' ? 'success' : h.estado === 'No Acreditada' ? 'danger' : 'info'}>{h.estado}</Badge></td>
                            <td><Badge type="info">{h.tipo_materia}</Badge></td>
                            <td style={{ fontSize: '0.8rem', maxWidth: 150 }}>{h.observaciones || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="empty"><p>Sin registro académico.</p></div>}
              </>
            )}

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Agregar registro académico</h4>
              <form onSubmit={handleAgregarHistorial}>
                <div className="grid-two">
                  <div className="field"><small>ID Período</small><input type="number" value={nuevoHistorial.id_periodo || ''} onChange={e => setNuevoHistorial({ ...nuevoHistorial, id_periodo: e.target.value })} required /></div>
                  <div className="field"><small>ID Materia</small><input type="number" value={nuevoHistorial.id_materia || ''} onChange={e => setNuevoHistorial({ ...nuevoHistorial, id_materia: e.target.value })} /></div>
                  <div className="field"><small>Calificación</small><input type="number" step="0.1" value={nuevoHistorial.calificacion || ''} onChange={e => setNuevoHistorial({ ...nuevoHistorial, calificacion: e.target.value })} /></div>
                  <div className="field"><small>Créditos</small><input type="number" step="0.1" value={nuevoHistorial.creditos || ''} onChange={e => setNuevoHistorial({ ...nuevoHistorial, creditos: e.target.value })} /></div>
                  <div className="field">
                    <small>Estado</small>
                    <select value={nuevoHistorial.estado} onChange={e => setNuevoHistorial({ ...nuevoHistorial, estado: e.target.value })}>
                      <option value="Cursando">Cursando</option>
                      <option value="Acreditada">Acreditada</option>
                      <option value="No Acreditada">No Acreditada</option>
                      <option value="Exento">Exento</option>
                    </select>
                  </div>
                  <div className="field">
                    <small>Tipo</small>
                    <select value={nuevoHistorial.tipo_materia} onChange={e => setNuevoHistorial({ ...nuevoHistorial, tipo_materia: e.target.value })}>
                      <option value="Ordinaria">Ordinaria</option>
                      <option value="Repeticion">Repetición</option>
                      <option value="Extraordinario">Extraordinario</option>
                      <option value="Especial">Especial</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: '0.5rem' }}>
                  <Plus size={16} /> Agregar registro
                </button>
              </form>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );

  const renderAuditoria = () => (
    <div className="stack">
      <SectionCard title="Auditoría de expedientes" subtitle="Trazabilidad completa de cambios en kardex">
        <div className="row gap wrap" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <small>Filtrar por acción</small>
            <select value={auditoriaFiltro} onChange={e => { setAuditoriaFiltro(e.target.value); }}>
              <option value="">Todas</option>
              <option value="CARGAR_FOTO_INSTITUCIONAL">Carga de foto</option>
              <option value="GENERAR_QR">Generar QR</option>
              <option value="EXPORTAR_PDF">Exportar PDF</option>
              <option value="AGREGAR_HISTORIAL">Agregar historial</option>
            </select>
          </div>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => loadAuditoria()}><RefreshCw size={16} /> Actualizar</button>
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn-danger"
              onClick={handleLimpiarAuditoria}
              disabled={cleaningAudit}
            >
              <Trash2 size={16} /> {cleaningAudit ? 'Limpiando...' : 'Limpiar auditoría'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="alert info"><Loader2 className="animate-spin" size={18} /> Cargando auditoría...</div>
        ) : auditoriaData.length === 0 ? (
          <div className="empty"><Shield size={48} style={{ opacity: 0.3 }} /><p>Sin registros de auditoría.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Alumno</th>
                    <th>Matrícula</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>Campo</th>
                    <th>Usuario</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriaData.map(a => (
                    <tr key={a.id_auditoria}>
                      <td style={{ fontSize: '0.8rem' }}>{formatDate(a.creado_en)}</td>
                      <td>{a.alumno_nombre || '—'}</td>
                      <td><code>{a.matricula || '—'}</code></td>
                      <td><Badge type={a.accion === 'EXPORTAR_PDF' ? 'success' : a.accion === 'GENERAR_QR' ? 'info' : a.accion === 'CARGAR_FOTO_INSTITUCIONAL' ? 'warning' : 'info'}>{a.accion.replace(/_/g, ' ')}</Badge></td>
                      <td style={{ maxWidth: 200, fontSize: '0.85rem' }}>{a.detalle || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{a.campo_modificado || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{a.usuario_nombre || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}><code>{a.ip_origen || '—'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditoriaPagination && (
              <div className="row gap" style={{ marginTop: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-sm btn-outline" disabled={auditoriaPagination.page <= 1} onClick={() => loadAuditoria(auditoriaPagination.page - 1)}>Anterior</button>
                <span style={{ fontSize: '0.85rem' }}>Pág. {auditoriaPagination.page} de {auditoriaPagination.pages}</span>
                <button className="btn btn-sm btn-outline" disabled={auditoriaPagination.page >= auditoriaPagination.pages} onClick={() => loadAuditoria(auditoriaPagination.page + 1)}>Siguiente</button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light"><Shield size={14} /> Administración • Kardex</div>
          <h1>Kardex académico</h1>
          <p>Administra, valida y supervisa la integridad del expediente académico institucional.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-card"><small>Total expedientes</small><strong>{pagination?.total || '—'}</strong></div>
          <div className="meta-card"><small>Registros auditoría</small><strong>{auditoriaPagination?.total || '—'}</strong></div>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="tabs" style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} type="button"
            className={`btn ${activeTab === tab.key ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 0, borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px' }}
            onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && renderGeneral()}
      {activeTab === 'individual' && renderIndividual()}
      {activeTab === 'foto' && renderFoto()}
      {activeTab === 'qr' && renderQR()}
      {activeTab === 'historial' && renderHistorial()}
      {activeTab === 'auditoria' && renderAuditoria()}

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
            aria-labelledby="admin-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="admin-preview-title">Vista previa del kardex</h3>
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
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
