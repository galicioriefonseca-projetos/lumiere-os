import React, { Component, ErrorInfo, ReactNode } from 'react';
import { executeManualCachePurge } from '../lib/cacheControl';
import { APP_INFO } from '../config/appInfo';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const route = typeof window !== 'undefined' ? window.location.pathname + window.location.search : 'N/A';
    const appVersion = APP_INFO.version;
    
    let role = 'unknown';
    let salonId = 'unknown';
    let userData = undefined;
    
    try {
      const loggedUserStr = sessionStorage.getItem('lumiere_logged_user');
      if (loggedUserStr) {
        const parsed = JSON.parse(loggedUserStr);
        userData = parsed;
        salonId = parsed.salonId || 'unknown';
        role = parsed.role || 'unknown';
      }
    } catch (e) {
      console.warn('Could not read user from sessionStorage inside ErrorBoundary', e);
    }

    console.error(`[ErrorBoundary] ${error.message}\n${error.stack}\nroute: ${route}\nrole: ${role}\nappVersion: ${appVersion}`);
    console.error('Uncaught error details:', error, errorInfo);
    
    // Auto-logging production crash to Firestore
    if (salonId && salonId !== 'unknown') {
      import('../lib/logger').then(({ persistLog }) => {
        persistLog(salonId, 'error', `[ErrorBoundary Crítico] ${error.message}`, {
          stack: (error.stack || '') + '\n\nComponent Stack:\n' + (errorInfo.componentStack || ''),
          userData,
          pagePath: route
        });
      }).catch(err => {
        console.error('Falha ao importar dinamicamente o logger:', err);
      });
    }

    try {
      sessionStorage.setItem('lumiere_last_error', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        route,
        appVersion,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to save error to session storage', e);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private clearCacheAndReload = async () => {
    await executeManualCachePurge();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h1 className="text-2xl font-bold mb-4 text-[#D4AF37]">Ops! Algo deu errado</h1>
            <p className="text-neutral-400 mb-8">
              Não foi possível carregar o LumiereOS neste dispositivo. Tente recarregar a página ou limpar o cache se o problema persistir.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#D4AF37] hover:bg-[#C5A028] text-neutral-950 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Recarregar Página
              </button>
              
              <button
                onClick={this.clearCacheAndReload}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Limpar Cache e Recarregar
              </button>

              <button
                onClick={() => window.location.href = '/login'}
                className="w-full text-neutral-400 hover:text-white font-medium py-3 px-4 transition-colors"
              >
                Ir para Login
              </button>
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.search.includes('debug=true')) ? (
              <div className="mt-8 text-left bg-neutral-950 p-4 rounded-lg overflow-auto text-xs text-neutral-500 max-h-48 border border-neutral-800">
                <p className="font-semibold text-red-400 mb-2">Detalhes Técnicos (Para Suporte):</p>
                <p><strong>Erro:</strong> {this.state.error?.message}</p>
                <p><strong>Caminho:</strong> {typeof window !== 'undefined' ? window.location.pathname + window.location.search : 'N/A'}</p>
                <p><strong>Device:</strong> {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}</p>
                <p className="truncate"><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-neutral-600 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            ) : (
              <div className="mt-4 text-xs text-neutral-600">
                 <p>Um relatório de erros foi gerado. Para exibir detalhes técnicos, adicione <code className="text-neutral-500">?debug=true</code> na URL.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
