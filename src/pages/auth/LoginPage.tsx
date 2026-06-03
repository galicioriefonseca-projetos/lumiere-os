import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowLeft, Chrome } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import PWAInstallButton from '../../components/PWAInstallButton';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const { signInWithGoogle, currentUser, userData, isPlatformAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const queryParams = new URLSearchParams(location.search);
  const isPwaSource = queryParams.get('source') === 'pwa';

  useEffect(() => {
    if (currentUser && userData) {
      if (isPlatformAdmin || userData.role === 'platform_admin' || currentUser.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
        navigate('/master', { replace: true });
      } else if (userData.role === 'professional') {
        navigate('/dashboard/meu-painel', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [currentUser, userData, isPlatformAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Guard for double or premature submissions

    if (!email.trim() || !password) {
      toast.error('Favor informar o e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Clear any dev simulated role to prevent overriding logging user's role
      sessionStorage.removeItem('demo_role');

      // Resolve redirect target dynamically
      let targetPath = '/dashboard';
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const adminSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
        
        let isPlatform = false;
        let isOwner = false;
        
        if (adminSnap.exists() || (userSnap.exists() && userSnap.data()?.role === 'platform_admin')) {
          isPlatform = true;
        } else if (userSnap.exists() && userSnap.data()?.role === 'owner') {
          isOwner = true;
        }

        // TEMPORARY BOOTSTRAP FALLBACK: fallback por e-mail para configuração inicial caso o banco de dados esteja vazio
        if (!isPlatform && !isOwner) {
          if (user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
            isPlatform = true;
          } else if (user.email === import.meta.env.VITE_DEMO_USER_EMAIL) {
            isOwner = true;
          }
        }

        if (userSnap.exists()) {
          const uData = userSnap.data();
          // Check for inactive user account status (Task 2 status validations)
          if (uData?.isActive === false || uData?.status === 'inactive' || uData?.status === 'deleted') {
            toast.error("Sua conta está inativa. Fale com o administrador.");
            await auth.signOut();
            setLoading(false);
            return;
          }
          // Error check for missing salonId on non-platform_admin users
          if (!isPlatform && !uData?.salonId) {
            // Run fallback (Task 3)
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
              console.log("[AuthLoginFallback] Salvando salonId auto-resolvido por login: ", foundSalonId);
              await updateDoc(doc(db, 'users', user.uid), {
                salonId: foundSalonId,
                role: 'owner',
                updatedAt: Date.now()
              });
              uData.salonId = foundSalonId;
              uData.role = 'owner';
              isOwner = true;
            } else {
              toast.error("Sua conta foi autenticada, mas ainda não está associada a nenhum salão operacional.");
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
            if (from && from.startsWith('/dashboard') && from !== '/dashboard' && from !== '/dashboard/') {
              targetPath = from;
            } else {
              targetPath = '/dashboard';
            }
          }
        }
      } catch (err) {
        console.error("Error checking user role on login:", err);
      }

      toast.success('Login efetuado com sucesso.');
      navigate(targetPath, { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        toast.error('E-mail ou senha incorretos.');
      } else if (error.code === 'auth/user-not-found') {
        toast.error('Conta não encontrada.');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Senha incorreta.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Tente novamente em alguns minutos.');
      } else {
        console.error('Login error:', error);
        toast.error('Erro ao acessar: ' + (error.message || 'Verifique suas credenciais.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return; // Guard for double submissions
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      
      let targetPath = '/dashboard';
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const adminSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
        
        let isPlatform = false;
        let isOwner = false;
        
        if (adminSnap.exists() || (userSnap.exists() && userSnap.data()?.role === 'platform_admin')) {
          isPlatform = true;
        } else if (userSnap.exists() && userSnap.data()?.role === 'owner') {
          isOwner = true;
        }

        // TEMPORARY BOOTSTRAP FALLBACK: fallback por e-mail para configuração inicial caso o banco de dados esteja vazio
        if (!isPlatform && !isOwner) {
          if (user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
            isPlatform = true;
          } else if (user.email === import.meta.env.VITE_DEMO_USER_EMAIL) {
            isOwner = true;
          }
        }

        if (userSnap.exists()) {
          const uData = userSnap.data();
          // Check for inactive user account status (Task 2 status validations)
          if (uData?.isActive === false || uData?.status === 'inactive' || uData?.status === 'deleted') {
            toast.error("Sua conta está inativa. Fale com o administrador.");
            await auth.signOut();
            setLoading(false);
            return;
          }
          // Error check for missing salonId on non-platform_admin users
          if (!isPlatform && !uData?.salonId) {
            // Run fallback (Task 3)
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
              console.log("[AuthLoginFallback] Salvando salonId auto-resolvido por Google login: ", foundSalonId);
              await updateDoc(doc(db, 'users', user.uid), {
                salonId: foundSalonId,
                role: 'owner',
                updatedAt: Date.now()
              });
              uData.salonId = foundSalonId;
              uData.role = 'owner';
              isOwner = true;
            } else {
              toast.error("Sua conta foi autenticada, mas ainda não está associada a nenhum salão operacional.");
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
            if (from && from.startsWith('/dashboard') && from !== '/dashboard' && from !== '/dashboard/') {
              targetPath = from;
            } else {
              targetPath = '/dashboard';
            }
          }
        }
      } catch (err) {
        console.error("Error checking user role on Google login:", err);
      }

      toast.success('Login efetuado com sucesso via Google.');
      navigate(targetPath, { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/user-not-registered-google') {
        toast.error('Sua conta Google ainda não está vinculada a um salão. Escolha um plano ou acesse por convite.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('A conexão do Google foi fechada antes de ser concluída.');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error('Já existe uma conta associada a este e-mail do Google com outra senha.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error(`Domínio não autorizado nas configurações do Firebase. Adicione o domínio "${window.location.hostname}" em Firebase Console -> Authentication -> Configurações -> Domínios autorizados.`, { duration: 10000 });
      } else {
        console.error('Google login error:', error);
        toast.error('Ocorreu um erro no login do Google: ' + (error.message || 'Erro inesperado'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-light font-heading tracking-tight text-foreground">
          Acesse sua conta
        </h2>
        {isPwaSource && (
          <p className="mt-2 text-center text-xs text-primary font-mono tracking-wider animate-pulse">
            ★ Bem-vindo ao LumiereOS App ★
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card/50 backdrop-blur-xl py-8 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  placeholder="admin@seusalao.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <Button type="submit" disabled={loading} className="w-full rounded-full h-12 bg-primary hover:bg-gold-400 text-black font-medium text-base">
                {loading ? 'Entrando...' : 'Entrar na Conta'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#141414] px-3 text-muted-foreground text-[11px] tracking-wider">ou entre com</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full rounded-full h-12 bg-black/40 hover:bg-black/80 text-foreground border border-white/10 hover:border-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4 text-primary" />
                <span>Entrar com Google</span>
              </Button>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link to="/#planos" className="font-medium text-primary hover:text-gold-400">
                Escolha um plano
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center px-4 sm:px-0">
          <PWAInstallButton variant="banner" />
        </div>
      </div>
    </div>
  );
}
