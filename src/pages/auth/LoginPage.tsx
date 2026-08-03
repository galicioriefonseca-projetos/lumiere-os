import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Mail, KeyRound, ArrowRight, Eye, EyeOff, 
  HelpCircle, ArrowLeft, Send, CheckCircle2, AlertTriangle, Play 
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithCustomToken, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import { translateAuthError, checkIfEmailExists, createActivationToken } from '../../lib/auth-helpers';
import { logAuthAuditEvent } from '../../lib/audit';

type LoginMode = 'login' | 'recovery' | 'activation-sim';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const { signInWithGoogle, currentUser, userData, isPlatformAdmin, refreshUserData } = useAuth();

  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const isPlatform = isPlatformAdmin || userData?.role === 'platform_admin';
  const showSimulator = isDevelopment || isPlatform;

  // Mode state
  const [mode, setMode] = useState<LoginMode>('login');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

  // Activation simulator input states
  const [simName, setSimName] = useState('');
  const [simEmail, setSimEmail] = useState('');
  const [simSalon, setSimSalon] = useState('Salão Lumière Classic');
  const [simCreatedSalonId, setSimCreatedSalonId] = useState('');
  const [simCreatedToken, setSimCreatedToken] = useState('');
  const [simEmailSent, setSimEmailSent] = useState(false);

  // Loading & Error feedback states
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Check URL params for pre-filling or deep-linking
  const queryParams = new URLSearchParams(location.search);
  const emailQuery = queryParams.get('email');
  const recoveryQuery = queryParams.get('recovery');
  const welcomeQuery = queryParams.get('welcome') === '1';

  useEffect(() => {
    if (emailQuery) {
      setEmail(emailQuery);
    }
    if (recoveryQuery === 'true') {
      setMode('recovery');
    }
  }, [emailQuery, recoveryQuery]);

  // Session persistence and intelligent redirection on load
  useEffect(() => {
    if (currentUser && userData) {
      if (isPlatformAdmin || userData.role === 'platform_admin') {
        navigate('/master', { replace: true });
      } else if (userData.role === 'professional') {
        navigate('/dashboard/meu-painel', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [currentUser, userData, isPlatformAdmin, navigate]);

  // Handle direct/proxy email login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !password) {
      setError('Por favor, informe seu e-mail corporativo e senha.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusText('Validando credenciais...');

    try {
      let user;
      try {
        console.log("[LumièreAuth] Tentando autenticação segura direta...");
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        user = userCredential.user;
      } catch (directErr: any) {
        console.warn("[LumièreAuth] Falha no canal direto, acionando fallback proxy:", directErr);
        
        // Trigger server proxy if network-level failures block client direct connection
        if (
          directErr.code === 'auth/network-request-failed' || 
          directErr.message?.includes('network-request-failed') ||
          directErr.code === 'auth/internal-error'
        ) {
          setStatusText('Sincronizando via proxy seguro Lumière...');
          const proxyResp = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email.trim(),
              password: password,
            }),
          });
          
          if (!proxyResp.ok) {
            const proxyErrData = await proxyResp.json();
            const thrownError = new Error(proxyErrData.error || "Erro de proxy no login.");
            (thrownError as any).code = proxyErrData.code || "auth/unknown";
            throw thrownError;
          }
          
          const { customToken } = await proxyResp.json();
          const userCredential = await signInWithCustomToken(auth, customToken);
          user = userCredential.user;
        } else {
          throw directErr;
        }
      }

      setStatusText('Sincronizando perfil corporativo...');
      sessionStorage.removeItem('demo_role');

      // Check account details in Firestore
      let targetPath = '/dashboard';
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const adminSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
      
      let isPlatform = adminSnap.exists() || (userSnap.exists() && userSnap.data()?.role === 'platform_admin');
      let isOwner = userSnap.exists() && userSnap.data()?.role === 'owner';

      // Fallback for demo users
      if (!isPlatform && !isOwner) {
        if (user.email === import.meta.env.VITE_DEMO_USER_EMAIL) isOwner = true;
      }

      if (userSnap.exists()) {
        const uData = userSnap.data();
        
        // Block inactive users elegantly
        if (uData?.isActive === false || uData?.status === 'inactive' || uData?.status === 'deleted') {
          setError("Sua conta está inativa. Entre em contato com o suporte Lumière.");
          await auth.signOut();
          setLoading(false);
          return;
        }

        // Auto-resolve missing salon associations
        if (!isPlatform && !uData?.salonId) {
          setStatusText('Sincronizando salão corporativo...');
          const salonsColl = collection(db, 'salons');
          const q1 = query(salonsColl, where('ownerId', '==', user.uid));
          const snap1 = await getDocs(q1);
          let foundSalonId = null;
          if (!snap1.empty) {
            foundSalonId = snap1.docs[0].id;
          } else if (user.email) {
            const q2 = query(salonsColl, where('ownerEmail', '==', user.email));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
              foundSalonId = snap2.docs[0].id;
            }
          }

          if (foundSalonId) {
            await updateDoc(doc(db, 'users', user.uid), {
              salonId: foundSalonId,
              role: 'owner',
              updatedAt: Date.now()
            });
            isOwner = true;
          } else {
            setError("Sua conta foi autenticada, mas não está vinculada a nenhum salão operacional.");
            await auth.signOut();
            setLoading(false);
            return;
          }
        }
      }

      if (isPlatform) {
        targetPath = '/master';
      } else if (isOwner) {
        targetPath = '/dashboard';
      } else if (userSnap.exists()) {
        const uRole = userSnap.data()?.role;
        if (uRole === 'professional') {
          targetPath = '/dashboard/meu-painel';
        } else {
          targetPath = from.startsWith('/dashboard') ? from : '/dashboard';
        }
      }

      setStatusText('Sessão estabelecida. Redirecionando...');
      await refreshUserData();
      try {
        await logAuthAuditEvent(user.email || user.uid, 'Primeiro Login');
      } catch (logErr) {
        console.warn('Failed to register audit log:', logErr);
      }
      setLoading(false);
      navigate(`/preparando-ambiente?to=${encodeURIComponent(targetPath)}`, { replace: true });

    } catch (err: any) {
      console.error('[LumièreAuth] Login error:', err);
      setLoading(false);
      setError(translateAuthError(err.code || 'error', err.message));
    }
  };

  // Handle Google OAuth login
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setStatusText('Conectando com o Google...');

    try {
      const user = await signInWithGoogle();
      
      let targetPath = '/dashboard';
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const adminSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
      
      let isPlatform = adminSnap.exists() || (userSnap.exists() && userSnap.data()?.role === 'platform_admin');
      let isOwner = userSnap.exists() && userSnap.data()?.role === 'owner';

      if (!isPlatform && !isOwner) {
        if (user.email === import.meta.env.VITE_DEMO_USER_EMAIL) isOwner = true;
      }

      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData?.isActive === false || uData?.status === 'inactive' || uData?.status === 'deleted') {
          setError("Sua conta está inativa. Entre em contato com o suporte Lumière.");
          await auth.signOut();
          setLoading(false);
          return;
        }

        if (!isPlatform && !uData?.salonId) {
          const salonsColl = collection(db, 'salons');
          const q1 = query(salonsColl, where('ownerId', '==', user.uid));
          const snap1 = await getDocs(q1);
          let foundSalonId = null;
          if (!snap1.empty) {
            foundSalonId = snap1.docs[0].id;
          } else if (user.email) {
            const q2 = query(salonsColl, where('ownerEmail', '==', user.email));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
              foundSalonId = snap2.docs[0].id;
            }
          }

          if (foundSalonId) {
            await updateDoc(doc(db, 'users', user.uid), {
              salonId: foundSalonId,
              role: 'owner',
              updatedAt: Date.now()
            });
            isOwner = true;
          } else {
            setError("Sua conta Google está autenticada, mas não está vinculada a nenhum salão operacional.");
            await auth.signOut();
            setLoading(false);
            return;
          }
        }
      }

      if (isPlatform) {
        targetPath = '/master';
      } else if (isOwner) {
        targetPath = '/dashboard';
      } else if (userSnap.exists()) {
        const uRole = userSnap.data()?.role;
        if (uRole === 'professional') {
          targetPath = '/dashboard/meu-painel';
        } else {
          targetPath = from.startsWith('/dashboard') ? from : '/dashboard';
        }
      }

      await refreshUserData();
      try {
        await logAuthAuditEvent(user.email || user.uid, 'Login Google');
      } catch (logErr) {
        console.warn('Failed to register audit log:', logErr);
      }
      setLoading(false);
      navigate(`/preparando-ambiente?to=${encodeURIComponent(targetPath)}`, { replace: true });

    } catch (err: any) {
      console.error('[LumièreAuth] Google login error:', err);
      setLoading(false);
      setError(translateAuthError(err.code || 'error', err.message));
    }
  };

  // Handle password recovery link sending
  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim()) {
      setError('Por favor, informe seu endereço de e-mail.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusText('Enviando link de redefinição...');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Auditoria pré-login (Reset solicitado) foi removida do client-side direto no Firestore.
      // Futuramente, esta auditoria pré-login deve ser implementada por endpoint backend protegido com App Check e rate limiting.
      setLoading(false);
      setRecoverySuccess(true);
    } catch (err: any) {
      console.error('[LumièreAuth] Password reset link error:', err);
      setLoading(false);
      setError(translateAuthError(err.code || 'error', err.message));
    }
  };

  // Helper to generate a mock salon record and show a welcome email inside the browser
  const handleGenerateActivationEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simEmail.trim()) {
      setError('Forneça um e-mail para simular a ativação.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusText('Criando salão de testes empresarial...');

    try {
      // 1. Create a simulated, pending salon in Firestore
      const mockSalonId = 'salon_sim_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const now = Date.now();
      
      const mockSalonRef = doc(db, 'salons', mockSalonId);
      await setDoc(mockSalonRef, {
        id: mockSalonId,
        name: simSalon || 'Salão Lumière Classic',
        ownerName: simName || 'Proprietário Simulado',
        ownerEmail: simEmail.trim().toLowerCase(),
        phone: '11999999999',
        businessType: 'Salão de Beleza',
        city: 'São Paulo',
        state: 'SP',
        plan: 'performance',
        subscriptionStatus: 'pending', // Waiting for activation
        activationStatus: 'pending',
        isActive: false,
        createdAt: now,
        updatedAt: now
      });

      // 2. Create the activation token
      setStatusText('Gerando token de ativação seguro...');
      const token = await createActivationToken(simEmail.trim().toLowerCase(), mockSalonId);

      setSimCreatedSalonId(mockSalonId);
      setSimCreatedToken(token);
      setLoading(false);
      setSimEmailSent(true);
    } catch (err: any) {
      console.error('[LumièreAuth] Simulated activation generation failed:', err);
      setLoading(false);
      setError('Erro ao preparar salão simulado no banco de dados. Tente novamente.');
    }
  };

  return (
    <AuthLayout 
      showBackButton={mode !== 'login'} 
      backTo="/login" 
      backText="Voltar para login"
      onBackClick={() => setMode('login')}
    >
      <AnimatePresence mode="wait">
        
        {/* VIEW 1: LOGIN FORM */}
        {mode === 'login' && (
          <motion.div
            key="login-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            <AuthCard
              title="Painel Executivo"
              subtitle="Entre com suas credenciais para gerenciar sua empresa da beleza."
              loading={loading}
              statusText={statusText}
              error={error}
              onDismissError={() => setError(null)}
            >
              <form onSubmit={handleLogin} className="space-y-4 font-sans">
                {welcomeQuery && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-200 leading-relaxed">
                      Pagamento confirmado! Faça login com sua senha cadastrada para acessar seu painel.
                    </p>
                  </div>
                )}
                {/* Email Input */}
                <div>
                  <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      placeholder="seuemail@lumiereos.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest">
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('recovery')}
                      className="text-xs text-primary hover:text-amber-300 font-sans tracking-wide transition-colors"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha corporativa"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Keep Connected & Activation Link */}
                <div className="flex items-center justify-between py-1.5 font-sans">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepConnected}
                      onChange={(e) => setKeepConnected(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-800 bg-neutral-950/80 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer accent-primary"
                    />
                    <span className="text-xs text-neutral-400">Manter-me conectado</span>
                  </label>
                  <Link
                    to="/ativar-conta"
                    className="text-xs text-primary hover:text-amber-300 font-sans transition-colors"
                  >
                    Ativar minha conta
                  </Link>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 mt-2 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_25px_rgba(212,175,55,0.4)]"
                >
                  <span>Entrar na Plataforma</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Social Login Separator */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800/80" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono">
                  <span className="bg-[#121212] px-3 text-neutral-500 tracking-wider">OU ACESSE COM</span>
                </div>
              </div>

              {/* Google SSO Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 rounded-xl bg-neutral-950/60 hover:bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-medium text-xs flex items-center justify-center gap-2.5 transition-all duration-300"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Conectar com Conta Google</span>
              </button>

              {/* Extra helper links: Activation Simulation or Back */}
              <div className="mt-8 pt-6 border-t border-neutral-800/60 flex flex-col items-center gap-3">
                {showSimulator && (
                  <button
                    type="button"
                    onClick={() => setMode('activation-sim')}
                    className="text-xs text-neutral-400 hover:text-primary transition-colors flex items-center gap-2 group font-mono tracking-wider"
                  >
                    <HelpCircle className="w-4 h-4 text-primary group-hover:animate-bounce shrink-0" />
                    <span>SIMULAR RECEBIMENTO DO E-MAIL DE ATIVAÇÃO</span>
                  </button>
                )}

                <Link
                  to="/"
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors uppercase font-mono tracking-widest pt-1"
                >
                  Voltar à Página Inicial
                </Link>
              </div>
            </AuthCard>
          </motion.div>
        )}

        {/* VIEW 2: ACCESS RECOVERY (Forgot Password) */}
        {mode === 'recovery' && (
          <motion.div
            key="recovery-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            <AuthCard
              title="Recuperar Acesso"
              subtitle={recoverySuccess ? "Instruções enviadas com sucesso." : "Inicie o procedimento de recuperação de sua senha corporativa."}
              loading={loading}
              statusText={statusText}
              error={error}
              onDismissError={() => setError(null)}
            >
              <AnimatePresence mode="wait">
                {!recoverySuccess ? (
                  <motion.form
                    key="recovery-form"
                    onSubmit={handleRecovery}
                    className="space-y-4 font-sans"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                      Insira o e-mail cadastrado em seu salão de beleza. Enviaremos um link seguro para você redefinir sua senha de acesso em instantes.
                    </p>

                    <div>
                      <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                        E-mail Cadastrado
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          type="email"
                          placeholder="seuemail@lumiereos.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300"
                    >
                      <span>Solicitar Link de Recuperação</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="w-full py-3 px-4 text-xs text-neutral-400 hover:text-neutral-200 transition-colors uppercase font-mono tracking-wider pt-2"
                    >
                      Cancelar e voltar ao login
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="recovery-success"
                    className="text-center p-2 font-sans"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    
                    <h3 className="text-sm font-semibold text-neutral-100 mb-1.5">
                      E-mail de Redefinição Enviado
                    </h3>
                    
                    <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                      Se o endereço <b className="text-neutral-200">{email}</b> estiver cadastrado na plataforma, você receberá um link seguro para escolher sua nova senha em instantes.
                    </p>

                    <button
                      onClick={() => {
                        setRecoverySuccess(false);
                        setMode('login');
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-100 font-semibold text-xs uppercase tracking-wider transition-colors"
                    >
                      Voltar ao Painel de Login
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </AuthCard>
          </motion.div>
        )}

        {/* VIEW 3: WELCOME EMAIL / ACTIVATION SIMULATOR */}
        {mode === 'activation-sim' && (
          <motion.div
            key="activation-sim-view"
            className="w-full max-w-lg mx-auto"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.5 }}
          >
            {/* If email not simulated yet, show setup. If simulated, show the browser email client! */}
            <AnimatePresence mode="wait">
              {!simEmailSent ? (
                <motion.div key="setup-sim">
                  <AuthCard
                    title="Simulador de E-mail"
                    subtitle="Simule o fluxo de onboarding e recebimento de e-mail corporativo de ativação."
                    loading={loading}
                    statusText={statusText}
                    error={error}
                    onDismissError={() => setError(null)}
                  >
                    <form onSubmit={handleGenerateActivationEmail} className="space-y-4 font-sans">
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Preencha os campos abaixo. O sistema criará um registro de salão pendente em nosso banco de dados Firestore e mostrará o e-mail oficial contendo o botão de ativação.
                      </p>

                      <div>
                        <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                          Nome do Gestor
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Leandro Fonseca"
                          value={simName}
                          onChange={(e) => setSimName(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                          E-mail de Cadastro
                        </label>
                        <input
                          type="email"
                          placeholder="Ex: gestao@lumiereos.com"
                          value={simEmail}
                          onChange={(e) => setSimEmail(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                          Nome do Estabelecimento
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Lumière Prime Studio"
                          value={simSalon}
                          onChange={(e) => setSimSalon(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Gerar Simulação e Ver E-mail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="w-full py-2.5 px-4 text-xs font-mono tracking-wide text-neutral-500 hover:text-neutral-300 transition-colors uppercase"
                      >
                        Voltar ao login
                      </button>
                    </form>
                  </AuthCard>
                </motion.div>
              ) : (
                <motion.div 
                  key="email-client-preview"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl font-sans text-left"
                >
                  {/* Mock Browser/Email Client Top Bar */}
                  <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                      <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                      Caixa de Entrada • Gmail / Outlook
                    </span>
                    <button 
                      onClick={() => setSimEmailSent(false)}
                      className="text-[10px] font-mono bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors px-2 py-1 rounded"
                    >
                      EDITAR
                    </button>
                  </div>

                  {/* Mail header */}
                  <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/40 space-y-1.5 text-xs">
                    <div>
                      <span className="text-neutral-500 font-mono">Assunto:</span>{' '}
                      <b className="text-neutral-100 text-sm">Bem-vindo ao LumièreOS! Complete sua ativação</b>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-mono">De:</span>{' '}
                      <span className="text-amber-400 font-medium">LumièreOS Atendimento &lt;onboarding@lumiereos.com&gt;</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 font-mono">Para:</span>{' '}
                      <span className="text-neutral-300 font-medium">{simEmail.toLowerCase()}</span>
                    </div>
                  </div>

                  {/* Mail Body - High Fidelity Luxury Email Layout */}
                  <div className="p-6 sm:p-8 bg-neutral-950 text-neutral-100 max-w-full overflow-hidden leading-relaxed">
                    <div className="max-w-md mx-auto space-y-6">
                      
                      {/* Email Brand Identity */}
                      <div className="text-center pb-4 border-b border-neutral-900">
                        <Sparkles className="w-10 h-10 text-primary mx-auto mb-2" />
                        <span className="text-xl font-heading tracking-widest uppercase font-semibold text-neutral-100">
                          LumièreOS
                        </span>
                        <p className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase mt-0.5">
                          The Operating System for Beauty Businesses
                        </p>
                      </div>

                      {/* Email Content Greeting */}
                      <div className="space-y-4 text-sm font-sans font-light text-neutral-300">
                        <p>Olá, <b className="text-neutral-50 font-normal">{simName || 'Parceiro Lumière'}</b>,</p>
                        
                        <p>
                          É com enorme prestígio que lhe damos as boas-vindas ao LumièreOS. 
                          Seu pagamento e adesão corporativa para o plano empresarial do estabelecimento 
                          <b className="text-primary font-normal"> {simSalon}</b> foram validados com êxito!
                        </p>
                        
                        <p>
                          Agora, você está a um passo de desbloquear o ecossistema operacional definitivo de gestão e marketing premium do setor da beleza.
                        </p>
                      </div>

                      {/* Activation Button Block */}
                      <div className="py-6 text-center bg-neutral-900/50 rounded-2xl border border-neutral-900 space-y-3">
                        <p className="text-xs text-neutral-400 font-sans">
                          Clique no botão oficial abaixo para ativar suas credenciais executivas:
                        </p>
                        
                        <div className="flex justify-center">
                          <Link
                            to={`/ativar-conta?token=${encodeURIComponent(simCreatedToken)}`}
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-sm transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.25)] scale-100 hover:scale-[1.03]"
                          >
                            <span>ATIVAR MINHA CONTA</span>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                        
                        <p className="text-[10px] text-neutral-500 font-mono tracking-wide uppercase">
                          Garantia de 7 dias pela Asaas • Link Seguro
                        </p>
                      </div>

                      {/* Extra info */}
                      <div className="space-y-2 text-xs font-sans text-neutral-400 font-light border-t border-neutral-900 pt-5">
                        <p>
                          Se você não solicitou este e-mail, por favor desconsidere este aviso de segurança. 
                          O LumièreOS opera sob rígidos protocolos corporativos de confidencialidade de dados.
                        </p>
                        
                        <div className="pt-2 text-neutral-500 text-[10px] font-mono uppercase tracking-wider text-center">
                          Lumière Technologies Inc. • Av. Paulista, 1000 • São Paulo, SP
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Simulation Helper Banner at the bottom */}
                  <div className="bg-neutral-900 p-4 border-t border-neutral-800 text-center space-y-2.5">
                    <p className="text-xs text-amber-300 font-sans font-medium flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>AMBENTE DE SIMULAÇÃO ATIVO</span>
                    </p>
                    <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                      O botão acima é um link de simulação real. Clique nele para abrir a tela de ativação de conta oficial e concluir as configurações.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </AuthLayout>
  );
}
