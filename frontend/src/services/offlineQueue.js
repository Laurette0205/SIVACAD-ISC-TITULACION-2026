import offlineDB from './offlineDB';

const BASE_URL = (() => {
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase && !envBase.includes('localhost')) {
    return envBase.replace(/\/+$/, '');
  }
  return `${window.location.protocol}//${window.location.hostname}:3000/api`;
})();

let syncInProgress = false;

function getAuthToken() {
  return localStorage.getItem('sivacad_token') || '';
}

function buildHeaders(extra = {}) {
  const token = getAuthToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function processSyncItem(item) {
  const headers = buildHeaders({
    'Content-Type': 'application/json',
    'X-Idempotency-Key': item.idempotencyKey || '',
    ...item.headers
  });

  if (item.files && item.files.length > 0) {
    const formData = new FormData();
    if (item.body) {
      Object.entries(item.body).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, String(v));
      });
    }
    item.files.forEach(f => {
      if (f.fileData) {
        const blob = base64ToBlob(f.fileData, f.fileType);
        formData.append('archivo', blob, f.fileName);
      } else if (f.file) {
        formData.append('archivo', f.file, f.fileName);
      }
    });
    delete headers['Content-Type'];

    const response = await fetch(`${BASE_URL}${item.endpoint}`, {
      method: item.method || 'POST',
      headers: { Authorization: headers.Authorization },
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  const response = await fetch(`${BASE_URL}${item.endpoint}`, {
    method: item.method || 'POST',
    headers,
    body: item.body ? JSON.stringify(item.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteArr], { type: mimeType || 'application/octet-stream' });
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function queueInscription(form, token) {
  const item = await offlineDB.addToSyncQueue({
    endpoint: '/inscripciones-alumno/solicitar',
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` }
  });

  await offlineDB.logSync('QUEUE_INSCRIPTION', {
    id: item.id,
    form
  });

  return item;
}

export async function queueReinscripcion(form, token) {
  const item = await offlineDB.addToSyncQueue({
    endpoint: '/alumno-reinscripciones/solicitar',
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` }
  });

  await offlineDB.logSync('QUEUE_REINSCRIPCION', {
    id: item.id,
    form
  });

  return item;
}

export async function queueFileUpload(file, formData, endpoint, token) {
  const fileData = await fileToBase64(file);
  const hash = await computeFileHash(file);

  const existing = await offlineDB.getPendingFiles();
  const duplicate = existing.find(
    f => f.hash === hash && f.status !== 'ERROR'
  );
  if (duplicate) {
    throw new Error('Este archivo ya está pendiente de sincronización');
  }

  const pendingFile = await offlineDB.savePendingFile({
    type: endpoint.includes('inscripciones') ? 'INSCRIPCION_DOC' : 'PERSONAL_DOC',
    file: { name: file.name, type: file.type, size: file.size },
    fileData,
    hash,
    formData: {
      ...formData,
      _endpoint: endpoint,
      _token: token
    }
  });

  const queueItem = await offlineDB.addToSyncQueue({
    endpoint,
    method: 'POST',
    body: formData,
    files: [{
      id: pendingFile.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData
    }],
    headers: { Authorization: `Bearer ${token}` }
  });

  await offlineDB.logSync('QUEUE_FILE_UPLOAD', {
    fileId: pendingFile.id,
    queueId: queueItem.id,
    fileName: file.name,
    fileSize: file.size,
    hash
  });

  return { pendingFile, queueItem };
}

export async function syncPendingItems() {
  if (syncInProgress) return { synced: 0, failed: 0 };
  syncInProgress = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await offlineDB.getSyncQueuePending();

    for (const item of pending) {
      try {
        await offlineDB.updateSyncQueueItem(item.id, { status: 'SINCRONIZANDO' });

        const result = await processSyncItem(item);

        if (result.ok) {
          await offlineDB.removeSyncQueueItem(item.id);
          synced++;
          await offlineDB.logSync('SYNC_OK', {
            id: item.id,
            endpoint: item.endpoint,
            serverResponse: result.data
          });
        } else {
          const newRetry = (item.retryCount || 0) + 1;
          if (newRetry >= (item.maxRetries || 5)) {
            await offlineDB.updateSyncQueueItem(item.id, {
              status: 'ERROR',
              retryCount: newRetry,
              lastError: `HTTP ${result.status}: ${JSON.stringify(result.data)}`
            });
            failed++;
            await offlineDB.logSync('SYNC_FAILED_PERMANENT', {
              id: item.id,
              endpoint: item.endpoint,
              error: result.data
            }, 'ERROR');
          } else {
            await offlineDB.updateSyncQueueItem(item.id, {
              status: 'PENDIENTE_SYNC',
              retryCount: newRetry,
              lastError: `HTTP ${result.status}`
            });
            await offlineDB.logSync('SYNC_RETRY', {
              id: item.id,
              retry: newRetry,
              maxRetries: item.maxRetries || 5
            });
          }
        }
      } catch (err) {
        const newRetry = (item.retryCount || 0) + 1;
        await offlineDB.updateSyncQueueItem(item.id, {
          status: newRetry >= (item.maxRetries || 5) ? 'ERROR' : 'PENDIENTE_SYNC',
          retryCount: newRetry,
          lastError: err.message
        });
        if (newRetry >= (item.maxRetries || 5)) failed++;
        await offlineDB.logSync('SYNC_ERROR', {
          id: item.id,
          error: err.message,
          retry: newRetry
        }, 'ERROR');
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

export function getBase64FromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function blobFromBase64(base64, mimeType) {
  return base64ToBlob(base64, mimeType);
}

export function isSyncInProgress() {
  return syncInProgress;
}
