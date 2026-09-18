import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_INTERVAL = 30000;
const FAST_INTERVAL = 5000;

export function useHealthCheck(interval = DEFAULT_INTERVAL) {
  const [health, setHealth] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const timerRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      const base = `${window.location.protocol}//${window.location.hostname}:3000`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${base}/api/health/ping`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await resp.json();
      setHealth(data);
      setIsOnline(true);
      setError(null);
      setLastCheck(new Date());
    } catch (err) {
      setHealth(null);
      setIsOnline(false);
      setError(err.name === 'AbortError' ? 'Timeout' : err.message);
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    timerRef.current = setInterval(checkHealth, interval);
    return () => clearInterval(timerRef.current);
  }, [checkHealth, interval]);

  const checkNow = useCallback(() => {
    clearInterval(timerRef.current);
    checkHealth().then(() => {
      timerRef.current = setInterval(checkHealth, interval);
    });
  }, [checkHealth, interval]);

  return { health, isOnline, error, lastCheck, checkNow };
}
