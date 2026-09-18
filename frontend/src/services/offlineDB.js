'use strict';

const DB_NAME = 'sivacad_offline';
const DB_VERSION = 1;

const STORES = {
  DRAFTS: 'drafts',
  PENDING_FILES: 'pendingFiles',
  SYNC_QUEUE: 'syncQueue',
  CACHED_DATA: 'cachedData',
  SYNC_LOG: 'syncLog'
};

const STORE_SCHEMAS = {
  [STORES.DRAFTS]: 'keyPath:id',
  [STORES.PENDING_FILES]: 'keyPath:id',
  [STORES.SYNC_QUEUE]: 'keyPath:id',
  [STORES.CACHED_DATA]: 'keyPath:key',
  [STORES.SYNC_LOG]: 'keyPath:id'
};

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      Object.entries(STORE_SCHEMAS).forEach(([storeName, keyPath]) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: keyPath.replace('keyPath:', '') });
          if (storeName === STORES.SYNC_QUEUE) {
            store.createIndex('by_status', 'status', { unique: false });
            store.createIndex('by_createdAt', 'createdAt', { unique: false });
          }
          if (storeName === STORES.CACHED_DATA) {
            store.createIndex('by_expiry', 'expiresAt', { unique: false });
          }
        }
      });
    };
  });
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function hexHash(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return hexHash(hashBuffer);
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const offlineDB = {
  STORES,

  async saveDraft(draft) {
    const record = {
      id: draft.id || generateId(),
      type: draft.type,
      form: draft.form,
      createdAt: draft.createdAt || Date.now(),
      updatedAt: Date.now(),
      status: 'BORRADOR'
    };
    await put(STORES.DRAFTS, record);
    return record;
  },

  async getDraft(id) {
    return getById(STORES.DRAFTS, id);
  },

  async getDraftsByType(type) {
    const all = await getAll(STORES.DRAFTS);
    return all.filter(d => d.type === type);
  },

  async deleteDraft(id) {
    await remove(STORES.DRAFTS, id);
  },

  async savePendingFile(fileEntry) {
    const record = {
      id: fileEntry.id || generateId(),
      type: fileEntry.type,
      fileName: fileEntry.file?.name || fileEntry.fileName,
      fileType: fileEntry.file?.type || fileEntry.fileType,
      fileSize: fileEntry.file?.size || fileEntry.fileSize,
      fileData: fileEntry.fileData,
      hash: fileEntry.hash || null,
      formData: fileEntry.formData || {},
      status: 'PENDIENTE_SYNC',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      lastError: null,
      serverResponse: null
    };

    if (!record.hash && fileEntry.file) {
      record.hash = await computeFileHash(fileEntry.file);
    }

    await put(STORES.PENDING_FILES, record);
    return record;
  },

  async getPendingFiles() {
    return getAll(STORES.PENDING_FILES);
  },

  async getPendingFile(id) {
    return getById(STORES.PENDING_FILES, id);
  },

  async updatePendingFile(id, updates) {
    const existing = await getById(STORES.PENDING_FILES, id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put(STORES.PENDING_FILES, updated);
    return updated;
  },

  async deletePendingFile(id) {
    await remove(STORES.PENDING_FILES, id);
  },

  async addToSyncQueue(item) {
    const record = {
      id: item.id || generateId(),
      endpoint: item.endpoint,
      method: item.method || 'POST',
      body: item.body || null,
      files: item.files || [],
      headers: item.headers || {},
      status: 'PENDIENTE_SYNC',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: item.maxRetries || 5,
      lastError: null,
      serverResponse: null,
      idempotencyKey: item.idempotencyKey || generateId()
    };
    await put(STORES.SYNC_QUEUE, record);
    return record;
  },

  async getSyncQueue() {
    return getAll(STORES.SYNC_QUEUE);
  },

  async getSyncQueuePending() {
    return getAllByIndex(STORES.SYNC_QUEUE, 'by_status', 'PENDIENTE_SYNC');
  },

  async updateSyncQueueItem(id, updates) {
    const existing = await getById(STORES.SYNC_QUEUE, id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put(STORES.SYNC_QUEUE, updated);
    return updated;
  },

  async removeSyncQueueItem(id) {
    await remove(STORES.SYNC_QUEUE, id);
  },

  async cacheData(key, data, ttlMs = 300000) {
    const record = {
      key,
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    await put(STORES.CACHED_DATA, record);
    return record;
  },

  async getCachedData(key) {
    const record = await getById(STORES.CACHED_DATA, key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      await remove(STORES.CACHED_DATA, key);
      return null;
    }
    return record.data;
  },

  async logSync(action, details, status = 'OK') {
    const record = {
      id: generateId(),
      action,
      details,
      status,
      timestamp: Date.now()
    };
    await put(STORES.SYNC_LOG, record);
  },

  async getSyncLog(limit = 50) {
    const all = await getAll(STORES.SYNC_LOG);
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },

  async clearExpiredCache() {
    const all = await getAll(STORES.CACHED_DATA);
    const now = Date.now();
    const expired = all.filter(r => now > r.expiresAt);
    for (const r of expired) {
      await remove(STORES.CACHED_DATA, r.key);
    }
    return expired.length;
  },

  async getStats() {
    const drafts = await getAll(STORES.DRAFTS);
    const pendingFiles = await getAll(STORES.PENDING_FILES);
    const syncQueue = await getAll(STORES.SYNC_QUEUE);
    return {
      drafts: drafts.length,
      pendingFiles: pendingFiles.length,
      syncQueue: syncQueue.length,
      totalPending: drafts.length + pendingFiles.length + syncQueue.length
    };
  }
};

export default offlineDB;
