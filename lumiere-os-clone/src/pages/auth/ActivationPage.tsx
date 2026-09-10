import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, KeyRound, Mail, ShieldCheck, Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import { translateAuthError, checkIfEmailExists, validateActivationToken, markActivationTokenUsed } from '../../lib/auth-helpers';
import { logAuthAuditEvent } from '../../lib/audit';

export default function ActivationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, refreshUserData } = useAuth();
  
  const tokenParam = searchParams.get('token') || '';
  const emailParamLegacy = searchParams.get('email') || '';
  const salonIdParamLegacy = searchParams.get('salonId') || '';

  // States
  const [email, setEmail] = useState('');
  const [salonId, setSalonId] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [checkingToken, setCheckingToken] = useState(true);
  const [salonName, setSalonName] = useState<string>('');
  const [salonLoaded, setSalonLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'options' | 'password'>('options');
  
  // Form values
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Async feedback states
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Email verification (Already registered page simulation)
  const [alreadyExistsState, setAlreadyExistsState] = useState(false);

  useEffect(() => {
    async function initActivation() {
      setCheckingToken(true);
      setError(null);

      if (tokenParam) {
        setStatusText('Validando token de ativação executiva...');
        const tokenData = await validateActivationToken(tokenParam);
        if (tokenData) {
          setEmail(tokenData.email);
          setSalonId(tokenData.salonId);
          setTokenValid(true);
          
          // Now fetch salon name
          try {
            const docRef = doc(db, 'salons', tokenData.salonId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              setSalonName(snap.data()?.name || 'Salão Lumière Classic');
            }
          } catch (err) {
            console.warn('[Activation] Error loading salon info:', err);
          }
        } else {
          setTokenValid(false);
          setError('O token de ativação fornecido é inválido, expirou ou já foi utilizado para configurar outra licença corporativa.');
        }
      } else if (emailParamLegacy && salonIdParamLegacy) {
        // Fallback for direct support
        setEmail(emailParamLegacy);
        setSalonId(salonIdParamLegacy);
        setTokenValid(true);
        try {
          const docRef = doc(db, 'salons', salonIdParamLegacy);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setSalonName(snap.data()?.name || 'Salão Lumière Classic');
          }
        } catch (err) {
          console.warn('[Activation] Error loading salon info:', err);
        }
      } else {
        setTokenValid(false);
        setError('Nenhum parâmetro de ativação de licença foi detectado. Por favor, use o link seguro recebido por e-mail.');
      }
      
      setCheckingToken(false);
      setSalonLoaded(true);
    }

    initActivation();
  }, [tokenParam, emailParamLegacy, salonIdParamLegacy]);

  // Handle Google activation
  const handleGoogleActivation = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatusText('Validando com o Google...');

      // Check if user is already logged in
      const authInstance = getAuth();
      const provider = new GoogleAuthProvider();
      
      setStatusText('Autenticando...');
      const result = await signInWithPopup(authInstance, provider);
      const user = result.user;

      setStatusText('Configurando seu salão de beleza...');
      
      // Update or create Firestore user record
      const now = Date.now();
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const finalFullName = user.displayName || 'Proprietário Lumière';
      
      if (userSnap.exists()) {
        // Update existing user with salon ID and owner role
        await updateDoc(userRef, {
          salonId: salonId || userSnap.data()?.salonId || '',
          role: 'owner',
          isActive: true,
          updatedAt: now
        });
      } else {
        // Create new user
        await setDoc(userRef, {
          id: user.uid,
          fullName: finalFullName,
          email: user.email || email || '',
          phone: user.phoneNumber || '',
          role: 'owner',
          salonId: salonId,
          isActive: true,
          createdAt: now,
          updatedAt: now
        });
      }

      // If salonId exists, associate the owner
      if (salonId) {
        setStatusText('Ativando credenciais corporativas...');
        const salonRef = doc(db, 'salons', salonId);
        const salonSnap = await getDoc(salonRef);
        
        if (salonSnap.exists()) {
          await updateDoc(salonRef, {
            ownerId: user.uid,
            ownerEmail: user.email || '',
            ownerName: finalFullName,
            subscriptionStatus: 'active', // Activate officially
            activationStatus: 'active',
            isActive: true,
            updatedAt: now
          });
        }
      }

      setStatusText('Sincronizando ambiente...');
      await refreshUserData();
      
      setSuccess(true);
      setLoading(false);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('[Activation] Google activation failed:', err);
      setLoading(false);
      
      if (err.code === 'auth/social-email-already-linked' || err.code === 'auth/email-already-in-use') {
        setAlreadyExistsState(true);
      } else {
        setError(translateAuthError(err.code || 'error', err.message));
      }
    }
  };

  // Handle password creation
  const handlePasswordActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('E-mail de ativação ausente. Utilize o link oficial enviado por e-mail.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStatusText('Verificando registro existente...');

      // Check if email already registered in Firestore
      const emailCheck = await checkIfEmailExists(email);
      if (emailCheck.exists) {
        setAlreadyExistsState(true);
        setLoading(false);
        return;
      }

      setStatusText('Criando sua credencial de acesso...');
      const authInstance = getAuth();
      const result = await createUserWithEmailAndPassword(authInstance, email, password);
      const user = result.user;

      setStatusText('Vinculando sua assinatura empresarial...');
      const now = Date.now();
      
      // Create user document
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        fullName: email.split('@')[0], // placeholder name from email
        email: email.toLowerCase(),
        phone: '',
        role: 'owner',
        salonId: salonId,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      // Update salon document
      if (salonId) {
        setStatusText('Consolidando banco de dados...');
        const salonRef = doc(db, 'salons', salonId);
        const salonSnap = await getDoc(salonRef);
        if (salonSnap.exists()) {
          await updateDoc(salonRef, {
            ownerId: user.uid,
            ownerEmail: email.toLowerCase(),
            ownerName: email.split('@')[0],
            subscriptionStatus: 'active',
            activationStatus: 'active',
            isActive: true,
            updatedAt: now
          });
        }
      }

      // Mark the token as used for security
      if (tokenParam) {
        setStatusText('Inutilizando token temporário...');
        await markActivationTokenUsed(tokenParam);
      }

      // Audit log
      try {
        await logAuthAuditEvent(email, 'Conta ativada');
      } catch (logErr) {
        console.warn('Failed to register activation audit log:', logErr);
      }

      setStatusText('Iniciando sessão segura...');
      await refreshUserData();
      
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('[Activation] Password activation failed:', err);
      setLoading(false);
      
      if (err.code === 'auth/email-already-in-use') {
        setAlreadyExistsState(true);
      } else {
        setError(translateAuthError(err.code || 'error', err.message));
      }
    }
  };

  // If already registered state (Requirement 5)
  if (alreadyExistsState) {
    return (
      <AuthLayout showBackButton backTo="/login" backText="Ir para login">
        <AuthCard 
          title="Conta já existente"
          subtitle="Identificamos que seu e-mail já está registrado na plataforma."
        >
          <div className="flex flex-col items-center text-center p-2">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
              <AlertTriangle className="w-8 h-8 text-primary animate-pulse" />
            </div>
            
            <p className="text-sm text-neutral-300 font-sans leading-relaxed mb-6">
              Encontramos uma conta associada ao e-mail <b className="text-neutral-100">{email}</b>. 
              Você não precisa criar uma nova senha, basta realizar o login para acessar seu salão.
            </p>

            <div className="w-full space-y-3">
              <Link
                to={`/login?email=${encodeURIComponent(email)}`}
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_25px_rgba(212,175,55,0.4)]"
              >
                <span>Entrar com E-mail e Senha</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                onClick={() => {
                  setAlreadyExistsState(false);
                  handleGoogleActivation();
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-medium text-sm flex items-center justify-center gap-2.5 transition-all duration-300"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Entrar com o Google</span>
              </button>

              <div className="pt-2">
                <Link
                  to={`/login?recovery=true&email=${encodeURIComponent(email)}`}
                  className="text-xs text-neutral-400 hover:text-primary transition-colors uppercase font-mono tracking-wider"
                >
                  Recuperar minha senha
                </Link>
              </div>
            </div>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  // Success Confirmation State (Requirement 7)
  if (success) {
    return (
      <AuthLayout>
        <AuthCard title="Conta Ativada!">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
              <Check className="w-8 h-8 text-emerald-400 animate-bounce" />
            </div>

            <h3 className="text-lg font-heading font-medium text-neutral-100 mb-2">
              Seja bem-vindo ao LumièreOS!
            </h3>
            
            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed mb-6">
              Sua conta empresarial foi configurada com sucesso e sua assinatura está ativa. 
              Você será redirecionado para o seu painel executivo em instantes...
            </p>

            <div className="w-full flex items-center justify-center gap-2 text-xs font-mono text-primary animate-pulse uppercase tracking-widest">
              <span>Sincronizando banco de dados</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (checkingToken) {
    return (
      <AuthLayout>
        <AuthCard title="Verificando Ativação" loading={true} statusText={statusText}>
          <div className="h-16" />
        </AuthCard>
      </AuthLayout>
    );
  }

  if (tokenValid === false) {
    return (
      <AuthLayout showBackButton={true} backTo="/login" backText="Voltar para login">
        <AuthCard 
          title="Ativação Inválida" 
          subtitle="Não foi possível validar esta licença."
        >
          <div className="flex flex-col items-center text-center p-2 font-sans">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
            </div>
            
            <p className="text-sm text-neutral-300 leading-relaxed mb-6">
              O link seguro de ativação corporativa que você tentou acessar está expirado, é inválido ou já foi consumido por outra conta executiva.
            </p>

            <div className="w-full space-y-3">
              <Link
                to="/login"
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.25)]"
              >
                <span>Retornar para o Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <a
                href="mailto:suporte@lumiereos.com"
                className="block text-center text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-2 font-sans"
              >
                Contatar Suporte LumièreOS
              </a>
            </div>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBackButton={true} backTo="/login" backText="Ir para login">
      <AuthCard
        title="Ative sua Conta"
        subtitle={salonName ? `Seu plano empresarial para o salão ${salonName} está pronto.` : "Defina como você deseja acessar seu painel executivo."}
        loading={loading}
        statusText={statusText}
        error={error}
        onDismissError={() => setError(null)}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'options' ? (
            <motion.div
              key="options"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Option 1: Continue with Google */}
              <button
                onClick={handleGoogleActivation}
                className="w-full py-4 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-100 font-medium text-sm flex items-center justify-center gap-3 transition-all duration-300 relative group overflow-hidden"
              >
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-500 via-red-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <div className="text-left">
                  <span className="block font-semibold">Continuar com o Google</span>
                  <span className="block text-[10px] text-neutral-400 font-normal">Acesso rápido e integrado sem senhas</span>
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center my-5">
                <div className="flex-grow h-px bg-neutral-800" />
                <span className="mx-4 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">OU</span>
                <div className="flex-grow h-px bg-neutral-800" />
              </div>

              {/* Option 2: Create Password */}
              <button
                onClick={() => setActiveTab('password')}
                className="w-full py-4 px-4 rounded-xl bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/30 text-neutral-200 font-medium text-sm flex items-center justify-center gap-3 transition-all duration-300 group"
              >
                <KeyRound className="w-5 h-5 text-neutral-400 group-hover:text-primary transition-colors" />
                <div className="text-left">
                  <span className="block font-semibold group-hover:text-neutral-100 transition-colors">Configurar E-mail e Senha</span>
                  <span className="block text-[10px] text-neutral-400 font-normal">Crie uma senha de acesso personalizada</span>
                </div>
              </button>

              {/* Context email warning */}
              {email && (
                <div className="mt-4 p-3 rounded-lg bg-neutral-900/30 border border-neutral-800/50 flex gap-2 items-start">
                  <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Este link de ativação é exclusivo para o endereço: <br />
                    <span className="text-neutral-200 font-medium">{email}</span>
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="password-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              onSubmit={handlePasswordActivation}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                  Endereço de E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/50 border border-neutral-800/80 rounded-xl text-sm text-neutral-400 font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                  Nova Senha
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    placeholder="Defina sua senha (mín. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-1.5">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    placeholder="Repita a senha para confirmar"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 focus:border-primary focus:outline-none rounded-xl text-sm text-neutral-100 transition-colors"
                  />
                </div>
              </div>

              {/* Password strength dynamic check */}
              <div className="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800/80 text-[11px] space-y-2">
                <div className="flex items-center gap-2 text-neutral-400 font-sans">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>Sua senha deve conter pelo menos 6 caracteres</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className="flex-1 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-semibold text-xs uppercase tracking-wider transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_25px_rgba(212,175,55,0.4)]"
                >
                  Confirmar e Ativar
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </AuthCard>
    </AuthLayout>
  );
}
