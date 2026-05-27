import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert, Home, ArrowLeft, LogOut } from 'lucide-react';
import { canAccessRoute } from '../lib/permissions';
import { Button } from '@/components/ui/button';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { currentUser, userData, isPlatformAdmin, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [correcting, setCorrecting] = useState(false);

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

  const role = userData?.role;

  // Redirect platform_admin to /master if trying to access client dashboard or onboarding pages
  if (role === 'platform_admin' && !location.pathname.startsWith('/master')) {
    return <Navigate to="/master" replace />;
  }

  // Intercept legacy function_link data errors to offer self-healing
  if (role === 'function_link' || (role && !['platform_admin', 'owner', 'manager', 'receptionist', 'attendant', 'professional'].includes(role))) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d0d12]/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-yellow-600/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-heading font-light text-white mb-2 tracking-tight">Configuração Inválida</h2>
          <p className="text-[#a1a1aa] text-sm font-light mb-6 leading-relaxed">
            Seu perfil está com uma configuração de acesso inválida (<span className="text-yellow-500 font-medium font-mono">{role}</span>).
          </p>
          
          <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-left">
            <p className="text-[12px] text-[#a1a1aa] leading-relaxed">
              Entre em contato com o administrador global ou o dono do salão para redefinir o seu nível de acesso.
            </p>
            {(userData?.specialty || userData?.professionalFunction) && (
              <p className="text-[12px] text-[#a1a1aa] leading-relaxed mt-2 border-t border-white/5 pt-2">
                Identificamos que você tem a função <span className="text-white font-medium">{userData.specialty || userData.professionalFunction}</span> cadastrada. O dono do salão deve alterar seu acesso para <b>Profissional</b> nas configurações do painel ou no banco de dados.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 justify-center">
            <Button 
              onClick={logout}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 font-medium rounded-xl text-xs px-5 h-10 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    );
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

