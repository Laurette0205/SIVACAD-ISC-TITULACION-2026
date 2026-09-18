import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      window.dispatchEvent(new CustomEvent('sivacad:online'));
    };

    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('sivacad:offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { isOnline, wasOffline, resetWasOffline };
}
