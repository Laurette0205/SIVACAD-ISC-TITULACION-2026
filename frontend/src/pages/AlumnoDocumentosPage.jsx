/**
 * SIVACAD-ISC — Documentos Sensibles del Alumno
 * FASE 8: Subida, visualización y eliminación de documentos personales
 * MÓDULO 1: Soporte offline para subida de documentos
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Trash2, Loader2, AlertTriangle, Download, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { queueFileUpload, syncPendingItems } from '../services/offlineQueue';
import offlineDB from '../services/offlineDB';
import api from '../services/api';

const TIPOS_DOCUMENTO = [
  'INE', 'CURP', 'Acta de nacimiento', 'Comprobante de domicilio',
  'Certificado médico', 'Foto perfil', 'Título', 'Otros'
];

export default function AlumnoDocumentosPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { isOnline, wasOffline, resetWasOffline } = useOnlineStatus();
  const fileInputRef = useRef(null);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    tipo_documento: '',
    fecha_documento: '',
    descripcion: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [syncMessage, setSyncMessage] = useState('');

  const loadPendingFiles = useCallback(async () => {
    try {
      const files = await offlineDB.getPendingFiles();
      setPendingFiles(files);
    } catch (_) {
      setPendingFiles([]);
    }
  }, []);

  useEffect(() => { loadDocuments(); loadPendingFiles(); }, []);

  useEffect(() => {
    const handleSync = async () => {
      setSyncMessage('Sincronizando documentos pendientes...');
      try {
        const result = await syncPendingItems();
        if (result.synced > 0) {
          setSyncMessage(`Sincronizados ${result.synced} documento(s)`);
          loadDocuments();
        } else if (result.failed > 0) {
          setSyncMessage(`${result.failed} documento(s) fallaron. Se reintentará.`);
        } else {
          setSyncMessage('');
        }
      } catch (_) {
        setSyncMessage('Error durante la sincronización');
      } finally {
        loadPendingFiles();
        setTimeout(() => setSyncMessage(''), 5000);
      }
    };

    window.addEventListener('sivacad:sync-pending', handleSync);
    return () => window.removeEventListener('sivacad:sync-pending', handleSync);
  }, [loadPendingFiles]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      if (isOnline) {
        const resp = await api.alumnoDocumentos(token);
        if (resp.ok) {
          setDocumentos(resp.data || []);
          await offlineDB.cacheData('documentos_personales', resp.data || [], 600000);
        } else if (resp.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
      } else {
        const cached = await offlineDB.getCachedData('documentos_personales');
        if (cached) {
          setDocumentos(cached);
        } else {
          setError('Sin conexión. Los documentos no están disponibles en caché.');
        }
      }
    } catch (e) {
      if (e?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      if (isOnline) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo no puede exceder 10MB');
        return;
      }
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.tipo_documento) {
      setError('Selecciona un tipo de documento');
      return;
    }
    try {
      setUploading(true);
      setError(null);

      if (!isOnline) {
        const formDataObj = {
          tipo_documento: uploadForm.tipo_documento,
          fecha_documento: uploadForm.fecha_documento || '',
          descripcion: uploadForm.descripcion || ''
        };
        await queueFileUpload(selectedFile, formDataObj, '/alumno-documentos', token);
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadForm({ tipo_documento: '', fecha_documento: '', descripcion: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSyncMessage('Documento guardado localmente. Se subirá al reconectar.');
        await loadPendingFiles();
        setTimeout(() => setSyncMessage(''), 5000);
        return;
      }

      const formData = new FormData();
      formData.append('archivo', selectedFile);
      formData.append('tipo_documento', uploadForm.tipo_documento);
      if (uploadForm.fecha_documento) formData.append('fecha_documento', uploadForm.fecha_documento);
      if (uploadForm.descripcion) formData.append('descripcion', uploadForm.descripcion);

      const resp = await api.alumnoDocumentoSubir(token, formData);
      if (resp.ok) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadForm({ tipo_documento: '', fecha_documento: '', descripcion: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadDocuments();
      } else {
        setError(resp.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar el documento "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      setError(null);
      const resp = await api.alumnoDocumentoEliminar(token, id);
      if (resp.ok) {
        await loadDocuments();
      } else {
        setError(resp.message);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 size={32} className="spin" /> Cargando documentos...
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><FileText size={20} /> Documentos Personales</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Gestiona tus documentos oficiales y comprobantes
          </p>
        </div>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          <Upload size={16} /> Subir documento
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {!isOnline && (
        <div className="offline-pending-badge" style={{ marginBottom: '1rem' }}>
          <WifiOff size={12} /> Modo offline — Los documentos se guardarán localmente
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="offline-pending-badge" style={{ marginBottom: '1rem' }}>
          {pendingFiles.length} documento(s) pendiente(s) de sincronización
        </div>
      )}

      {syncMessage && (
        <div className={`alert ${syncMessage.includes('Error') || syncMessage.includes('fallaron') ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
          {syncMessage}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {documentos.length === 0 ? (
        <div className="section-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay documentos registrados</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sube tu primer documento usando el botón superior</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {documentos.map((doc) => (
            <div key={doc.id_documento} className="section-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <FileText size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{doc.tipo_documento}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.nombre_original}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {formatSize(doc.peso_bytes)} · {doc.fecha_documento || 'Sin fecha'} · {doc.estado}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  className="btn btn-ghost"
                  style={{ color: '#ef4444', padding: '0.4rem' }}
                  onClick={() => handleDelete(doc.id_documento, doc.nombre_original)}
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)} role="dialog" aria-modal="true" aria-labelledby="upload-doc-modal-title">
          <div className="modal-card" id="upload-doc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <div>
                <h3 id="upload-doc-modal-title">Subir documento</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  Archivo: {selectedFile?.name} ({formatSize(selectedFile?.size)})
                </p>
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
              <div className="field">
                <span>Tipo de documento *</span>
                <select
                  value={uploadForm.tipo_documento}
                  onChange={(e) => setUploadForm((p) => ({ ...p, tipo_documento: e.target.value }))}
                >
                  <option value="">Seleccionar tipo...</option>
                  {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <span>Fecha del documento</span>
                <input
                  type="date"
                  value={uploadForm.fecha_documento}
                  onChange={(e) => setUploadForm((p) => ({ ...p, fecha_documento: e.target.value }))}
                />
              </div>
              <div className="field">
                <span>Descripción</span>
                <textarea
                  value={uploadForm.descripcion}
                  onChange={(e) => setUploadForm((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Notas adicionales sobre el documento..."
                  rows={3}
                />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => { setShowUploadModal(false); setSelectedFile(null); }} disabled={uploading}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !uploadForm.tipo_documento}>
                {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Subir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
