import { StrictMode } from 'react';
import { createRoot, RootOptions } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { APP_INFO } from './config/appInfo';
import { checkAppVersionAndRefresh, forceFreshReload, clearLumiereCaches } from './lib/cacheControl';

interface LoggedUserContext {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  salonId?: string;
}

function getLoggedUserContext(): LoggedUserContext | undefined {
  try {
    const loggedUserStr = sessionStorage.getItem('lumiere_logged_user');
    if (!loggedUserStr) return undefined;
    const parsed: unknown = JSON.parse(loggedUserStr);
    if (parsed && typeof parsed === 'object') {
      return parsed as LoggedUserContext;
    }
  } catch {
    // Ignore storage parse failures safely
  }
  return undefined;
}

function parseSampleRate(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function normalizeUnknownError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }
  if (error && typeof error === 'object') {
    const maybeRecord = error as Record<string, unknown>;
    const msg = typeof maybeRecord.message === 'string' && maybeRecord.message
      ? maybeRecord.message
      : fallbackMessage;
    const normalized = new Error(msg);
    if (typeof maybeRecord.stack === 'string' && maybeRecord.stack) {
      normalized.stack = maybeRecord.stack;
    }
    return normalized;
  }
  return new Error(fallbackMessage);
}

function sanitizeBreadcrumbUrl(rawUrl: unknown): unknown {
  if (typeof rawUrl !== 'string' || !rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const sensitiveParams = ['token', 'access_token', 'id_token', 'code', 'key', 'apiKey', 'secret'];
    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });
    return parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}`
      : `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return rawUrl;
  }
}

// Run version check immediately at the very beginning of the bootstrap phase
checkAppVersionAndRefresh();

// Sentry Production Error Monitoring & Detailed Stack Trace Instrumentation
const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim() || '';
const isSentryExplicitlyDisabled = import.meta.env.VITE_SENTRY_ENABLED === 'false';
const isSentryActive = Boolean(sentryDsn) && !isSentryExplicitlyDisabled;

if (isSentryActive) {
  const isProduction = import.meta.env.PROD;

  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
      import.meta.env.MODE ||
      'production',
    release: `lumiere-os@${APP_INFO.version}`,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    normalizeDepth: 6,
    tracePropagationTargets: ['localhost', /^\//],
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      isProduction ? 0.2 : 1.0
    ),
    replaysSessionSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      0
    ),
    replaysOnErrorSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
      isProduction ? 1.0 : 0
    ),
    integrations: [
      Sentry.browserTracingIntegration({
        instrumentPageLoad: true,
        instrumentNavigation: true,
        instrumentBfcacheRestore: true,
        traceFetch: true,
        traceXHR: true,
        enableHTTPTimings: true,
        linkPreviousTrace: 'in-memory',
        consistentTraceSampling: true,
        shouldCreateSpanForRequest: (url) => !url.includes('sentry.io'),
      }),
      Sentry.breadcrumbsIntegration({
        history: true,
        fetch: true,
        xhr: true,
        dom: {
          serializeAttribute: ['aria-label', 'data-testid', 'name'],
          maxStringLength: 160,
        },
        sentry: true,
      }),
      Sentry.extraErrorDataIntegration({ depth: 5 }),
      Sentry.contextLinesIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      /WebSocket.*closed/i,
    ],
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        const sanitizedData = { ...breadcrumb.data };
        if ('url' in sanitizedData) {
          sanitizedData.url = sanitizeBreadcrumbUrl(sanitizedData.url);
        }
        if ('from' in sanitizedData) {
          sanitizedData.from = sanitizeBreadcrumbUrl(sanitizedData.from);
        }
        if ('to' in sanitizedData) {
          sanitizedData.to = sanitizeBreadcrumbUrl(sanitizedData.to);
        }
        return { ...breadcrumb, data: sanitizedData };
      }
      return breadcrumb;
    },
    beforeSend(event) {
      const userCtx = getLoggedUserContext();

      event.tags = {
        ...event.tags,
        appVersion: APP_INFO.version,
        pagePath: window.location.pathname,
        ...(userCtx?.salonId ? { salonId: userCtx.salonId } : {}),
        ...(userCtx?.role ? { userRole: userCtx.role } : {}),
      };

      if (userCtx?.id) {
        event.user = {
          id: userCtx.id,
          ...(userCtx.role ? { segment: userCtx.role } : {}),
        };
      }

      if (event.request?.headers) {
        const sanitizedHeaders = { ...event.request.headers };
        delete sanitizedHeaders.Authorization;
        delete sanitizedHeaders.authorization;
        delete sanitizedHeaders.Cookie;
        delete sanitizedHeaders.cookie;
        event.request.headers = sanitizedHeaders;
      }

      return event;
    },
  });
}

function captureSentryException(
  error: unknown,
  options: {
    source: 'window.error' | 'window.unhandledrejection';
    fallbackMessage: string;
    level?: Sentry.SeverityLevel;
    extra?: Record<string, unknown>;
  }
): void {
  if (!isSentryActive) return;

  try {
    const normalizedError = normalizeUnknownError(error, options.fallbackMessage);
    const userCtx = getLoggedUserContext();

    Sentry.withScope((scope) => {
      scope.setLevel(options.level || 'error');
      scope.setTag('errorSource', options.source);
      scope.setTag('appVersion', APP_INFO.version);

      if (userCtx?.salonId) {
        scope.setTag('salonId', userCtx.salonId);
      }
      if (userCtx?.role) {
        scope.setTag('userRole', userCtx.role);
      }
      if (userCtx?.id) {
        scope.setUser({ id: userCtx.id });
      }

      scope.setContext('navigation', {
        path: window.location.pathname,
        search: window.location.search,
        href: window.location.origin + window.location.pathname,
      });

      if (options.extra) {
        scope.setExtras(options.extra);
      }

      Sentry.captureException(normalizedError);
    });
  } catch {
    // Ensure telemetry never throws inside global handlers
  }
}

// Google Maps Platform Demo Key Quota Defense
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

// Robust check to identify if an error is a Chunk Loader or dynamic import failure
const isChunkError = (error: unknown): boolean => {
  if (!error) return false;
  let rawMessage = '';
  if (error instanceof Error) {
    rawMessage = `${error.message} ${error.stack || ''}`;
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    rawMessage = `${String(obj.message || '')} ${String(obj.stack || '')}`;
  } else {
    rawMessage = String(error);
  }
  const errorStr = rawMessage.toLowerCase();
  const chunkPatterns = [
    'chunkloaderror',
    'failed to fetch dynamically imported module',
    'loading chunk',
    'importing a module script failed',
  ];
  return chunkPatterns.some((pattern) => errorStr.includes(pattern));
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
    const errorObj: unknown = event.error;

    if (isChunkError(errorMsg) || isChunkError(errorObj)) {
      captureSentryException(errorObj || errorMsg, {
        source: 'window.error',
        fallbackMessage: errorMsg || 'Chunk load failure',
        level: 'warning',
        extra: {
          chunkRecoveryTriggered: true,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
      handleChunkErrorRecovery();
      return;
    }

    const userData = getLoggedUserContext();
    const salonId = userData?.salonId || 'unknown';
    const stackText =
      errorObj instanceof Error && errorObj.stack
        ? errorObj.stack
        : `At ${event.filename}:${event.lineno}:${event.colno}`;

    captureSentryException(errorObj || errorMsg, {
      source: 'window.error',
      fallbackMessage: errorMsg || 'Global window error',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: stackText,
        pagePath: window.location.pathname,
      },
    });

    if (salonId && salonId !== 'unknown') {
      import('./lib/logger')
        .then(({ persistLog }) => {
          persistLog(salonId, 'error', `[Crash Global] ${event.message}`, {
            stack: stackText,
            userData,
            pagePath: window.location.pathname,
          });
        })
        .catch(() => {});
    }

    sessionStorage.setItem(
      'lumiere_last_error',
      JSON.stringify({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage errors safely
  }
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason: unknown = event.reason;
    if (isChunkError(reason)) {
      captureSentryException(reason, {
        source: 'window.unhandledrejection',
        fallbackMessage: 'Chunk load rejection',
        level: 'warning',
        extra: {
          chunkRecoveryTriggered: true,
          pagePath: window.location.pathname,
        },
      });
      handleChunkErrorRecovery();
      return;
    }

    const userData = getLoggedUserContext();
    const salonId = userData?.salonId || 'unknown';
    const reasonMessage =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'object' && reason !== null && 'message' in reason
          ? String((reason as Record<string, unknown>).message)
          : 'Unhandled Promise Rejection';
    const reasonStack =
      reason instanceof Error && reason.stack ? reason.stack : String(reason);

    captureSentryException(reason, {
      source: 'window.unhandledrejection',
      fallbackMessage: reasonMessage,
      extra: {
        stack: reasonStack,
        pagePath: window.location.pathname,
      },
    });

    if (salonId && salonId !== 'unknown') {
      import('./lib/logger')
        .then(({ persistLog }) => {
          persistLog(salonId, 'error', `[Rejeição Promessa] ${reasonMessage}`, {
            stack: reasonStack,
            userData,
            pagePath: window.location.pathname,
          });
        })
        .catch(() => {});
    }

    sessionStorage.setItem(
      'lumiere_last_error',
      JSON.stringify({
        message: reasonMessage,
        reason: String(reason),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage errors
  }
});

const rootOptions: RootOptions | undefined = isSentryActive
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : undefined;

createRoot(document.getElementById('root')!, rootOptions).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
