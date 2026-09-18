import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Loader2, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react';
import offlineDB from '../services/offlineDB';

export default function OfflineBanner({ isOnline, wasOffline, onDismiss }) {
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    loadStats();
  }, [isOnline]);

  const loadStats = async () => {
    try {
      const s = await offlineDB.getStats();
      setStats(s);
    } catch (_) {
      setStats(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      window.dispatchEvent(new CustomEvent('sivacad:sync-pending'));
      setSyncResult({ ok: true, message: 'Sincronización iniciada...' });
      setTimeout(() => {
        setSyncResult(null);
        loadStats();
      }, 3000);
    } catch (err) {
      setSyncResult({ ok: false, message: 'Error al sincronizar' });
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && !wasOffline && (!stats || stats.totalPending === 0)) {
    return null;
  }

  if (isOnline && wasOffline) {
    return (
      <div className="offline-banner offline-banner--synced" role="status" aria-live="polite">
        <div className="offline-banner__content">
          <CheckCircle2 size={16} className="offline-banner__icon offline-banner__icon--ok" />
          <span className="offline-banner__text">
            Conexión restaurada
            {stats && stats.totalPending > 0 && (
              <span className="offline-banner__pending">
                {' '}— {stats.totalPending} operación(es) pendiente(s)
              </span>
            )}
          </span>
          {stats && stats.totalPending > 0 && (
            <button
              className="offline-banner__btn"
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sincronizar pendientes"
            >
              {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              Sincronizar
            </button>
          )}
          <button className="offline-banner__dismiss" onClick={onDismiss} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {syncResult && (
          <div className={`offline-banner__result ${syncResult.ok ? 'offline-banner__result--ok' : 'offline-banner__result--error'}`}>
            {syncResult.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="offline-banner offline-banner--offline" role="alert" aria-live="assertive">
      <div className="offline-banner__content">
        <WifiOff size={16} className="offline-banner__icon offline-banner__icon--warn" />
        <span className="offline-banner__text">
          Sin conexión a internet
          {stats && stats.totalPending > 0 && (
            <span className="offline-banner__pending">
              {' '}— {stats.totalPending} operación(es) pendiente(s) de sincronización
            </span>
          )}
        </span>
        <div className="offline-banner__actions">
          {stats && stats.totalPending > 0 && (
            <span className="offline-banner__badge">
              <CloudOff size={12} /> {stats.totalPending}
            </span>
          )}
        </div>
      </div>
      {stats && stats.totalPending > 0 && (
        <div className="offline-banner__detail">
          Tus datos están guardados localmente y se sincronizarán cuando se restablezca la conexión.
        </div>
      )}
    </div>
  );
}
