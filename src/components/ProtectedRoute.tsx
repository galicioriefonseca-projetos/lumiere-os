import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { canAccessRoute } from '../lib/permissions';
import { Button } from '@/components/ui/button';

export function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { currentUser, userData, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d0d12]/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-heading font-light text-white mb-2 tracking-tight">Painel Master Restrito</h2>
          <p className="text-[#a1a1aa] text-sm font-light mb-6 leading-relaxed">
            Esta área é reservada para administradores globais do LumiereOS. O seu perfil não possui acesso administrativo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-10 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Painel Principal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Route level permission check
  const role = userData?.role;
  const isRouteAllowed = !userData ? true : canAccessRoute(role, location.pathname);

  if (!isRouteAllowed) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d0d12]/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-light text-white mb-2 tracking-tight">Acesso Restrito</h2>
          <p className="text-[#a1a1aa] text-sm font-light mb-6 leading-relaxed">
            Seu perfil como <span className="text-primary font-medium">{role}</span> não possui autorização para visualizar esta página ({location.pathname}).
          </p>
          <div className="flex flex-col gap-3 justify-center">
            <Button 
              onClick={() => navigate(-1)}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 font-medium rounded-xl text-xs px-5 h-10 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button 
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-10 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Ver Meu Painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

