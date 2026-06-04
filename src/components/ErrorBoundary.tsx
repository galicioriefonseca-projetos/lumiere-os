import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    console.error('Uncaught error:', error, errorInfo);
    
    try {
      sessionStorage.setItem('lumiere_last_error', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
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
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      window.location.href = `/?fresh=${Date.now()}`;
    } catch (err) {
      console.error('Failed to clear cache', err);
      window.location.replace('/');
    }
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
            {process.env.NODE_ENV === 'development' || true ? (
              <div className="mt-8 text-left bg-neutral-950 p-4 rounded-lg overflow-auto text-xs text-neutral-500 max-h-48 border border-neutral-800">
                <p className="font-semibold text-red-400 mb-2">Detalhes Técnicos (Para Suporte):</p>
                <p><strong>Erro:</strong> {this.state.error?.message}</p>
                <p><strong>Device:</strong> {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}</p>
                <p className="truncate"><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-neutral-600 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
