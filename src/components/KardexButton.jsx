import React from 'react';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchViaNode(token, id) {
  const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
  const url = `${BASE}/reportes/kardex/${encodeURIComponent(id)}/pdf/dompdf`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { const j = JSON.parse(text); msg = j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

const PHP_BASE = import.meta.env.VITE_PHP_BASE_URL || '/SIVACAD-ISC/backend/php-kardex';

async function fetchViaPhpDirect(id) {
  const url = `${PHP_BASE}/generar_kardex.php?id_alumno=${encodeURIComponent(id)}&download=1`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { const j = JSON.parse(text); msg = j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

export default function KardexButton({
  idAlumno,
  label = 'PDF Dompdf',
  variant = 'primary',
  size = 'sm',
  mode = 'node',
  showIcon = true,
  filename,
  token: propToken,
  onSuccess,
  onError,
  className = '',
  ...props
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  let contextToken = null;
  try {
    const auth = useAuth();
    contextToken = auth.token;
  } catch {
    contextToken = null;
  }
  const effectiveToken = propToken || contextToken;

  const handleClick = React.useCallback(async () => {
    if (!idAlumno) {
      setError('ID de alumno requerido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let blob;

      if (mode === 'php') {
        blob = await fetchViaPhpDirect(idAlumno);
      } else {
        if (!effectiveToken) throw new Error('Token requerido para modo node');
        blob = await fetchViaNode(effectiveToken, idAlumno);
      }

      const folio = filename || `kardex_${idAlumno}.pdf`;
      await downloadBlob(blob, folio);
      onSuccess?.();
    } catch (err) {
      const msg = err?.message || 'Error al generar PDF';
      setError(msg);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [idAlumno, effectiveToken, mode, filename, onSuccess, onError]);

  const btnClass = `btn btn-${variant} btn-${size} ${className}`.trim();

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button
        className={btnClass}
        onClick={handleClick}
        disabled={loading || !idAlumno}
        title={label}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
        ) : showIcon ? (
          <FileText size={size === 'sm' ? 14 : 16} />
        ) : null}
        {loading ? ' Generando...' : ` ${label}`}
      </button>
      {error && (
        <small style={{ color: '#dc2626', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 2 }}>
          <AlertTriangle size={10} /> {error}
        </small>
      )}
    </div>
  );
}
