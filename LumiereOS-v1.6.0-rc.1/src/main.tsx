import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkAppVersionAndRefresh, forceFreshReload, clearLumiereCaches } from './lib/cacheControl';

// Run version check immediately at the very beginning of the bootstrap phase
checkAppVersionAndRefresh();

// Robust check to identify if an error is a Chunk Loader or dynamic import failure
const isChunkError = (error: any): boolean => {
  if (!error) return false;
  const errorStr = (error.message || error.stack || String(error)).toLowerCase();
  const chunkPatterns = [
    'chunkloaderror',
    'failed to fetch dynamically imported module',
    'loading chunk',
    'importing a module script failed'
  ];
  return chunkPatterns.some(pattern => errorStr.includes(pattern));
};

// Safe chunk failure recovery with loop prevention (reloads only once in a short interval)
const handleChunkErrorRecovery = () => {
  try {
    const lastReload = sessionStorage.getItem('lumiere_chunk_reload_lock');
    const now = Date.now();
    if (lastReload && now - parseInt(lastReload, 10) < 15000) {
      console.warn('[LumiereOS] Chunk error reload already completed once recently. Halting to prevent loop.');
      return;
    }
    // Set a safety lock timestamp
    sessionStorage.setItem('lumiere_chunk_reload_lock', String(now));
    console.error('[LumiereOS] Chunk load failure detected. Performing automated safe cache cleanup and reload...');
    clearLumiereCaches().then(() => {
      forceFreshReload();
    });
  } catch (e) {
    console.error('[LumiereOS] Failed to store chunk reload lock safely:', e);
  }
};

// Global error handlers to catch issues before React mounts or outside React lifecycle
window.addEventListener('error', (event) => {
  try {
    const errorMsg = event.message || '';
    const errorObj = event.error;
    
    if (isChunkError(errorMsg) || isChunkError(errorObj)) {
      handleChunkErrorRecovery();
      return;
    }

    let salonId = 'unknown';
    let userData = undefined;
    try {
      const loggedUserStr = sessionStorage.getItem('lumiere_logged_user');
      if (loggedUserStr) {
        const parsed = JSON.parse(loggedUserStr);
        userData = parsed;
        salonId = parsed.salonId || 'unknown';
      }
    } catch (e) {}

    if (salonId && salonId !== 'unknown') {
      import('./lib/logger').then(({ persistLog }) => {
        persistLog(salonId, 'error', `[Crash Global] ${event.message}`, {
          stack: event.error?.stack || `At ${event.filename}:${event.lineno}:${event.colno}`,
          userData,
          pagePath: window.location.pathname
        });
      }).catch(() => {});
    }

    sessionStorage.setItem('lumiere_last_error', JSON.stringify({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    // Ignore storage errors safely
  }
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    if (isChunkError(reason)) {
      handleChunkErrorRecovery();
      return;
    }

    let salonId = 'unknown';
    let userData = undefined;
    try {
      const loggedUserStr = sessionStorage.getItem('lumiere_logged_user');
      if (loggedUserStr) {
        const parsed = JSON.parse(loggedUserStr);
        userData = parsed;
        salonId = parsed.salonId || 'unknown';
      }
    } catch (e) {}

    if (salonId && salonId !== 'unknown') {
      import('./lib/logger').then(({ persistLog }) => {
        persistLog(salonId, 'error', `[Rejeição Promessa] ${event.reason?.message || 'Unhandled Promise Rejection'}`, {
          stack: event.reason?.stack || String(event.reason),
          userData,
          pagePath: window.location.pathname
        });
      }).catch(() => {});
    }

    sessionStorage.setItem('lumiere_last_error', JSON.stringify({
      message: event.reason?.message || 'Unhandled Promise Rejection',
      reason: String(event.reason),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    // Ignore storage errors
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
