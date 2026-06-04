import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Global error handlers to catch issues before React mounts or outside React lifecycle
window.addEventListener('error', (event) => {
  try {
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
