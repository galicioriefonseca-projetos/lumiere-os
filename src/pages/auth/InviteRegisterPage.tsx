import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Chrome } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

interface Invite {
  id: string;
  salonId: string;
  salonName: string;
  invitedByUserId: string;
  invitedByName: string;
  inviteType: 'manager' | 'receptionist' | 'attendant' | 'professional' | 'function_link';
  role: string;
  category: string;
  specialty?: string;
  professionalFunction?: string;
  maxUses?: number;
  usesCount?: number;
  email?: string;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  expiresAt: any;
  createdAt: number;
}

const roleTranslations: Record<string, string> = {
  manager: 'Gerente',
  receptionist: 'Recepcionista',
  attendant: 'Atendente',
  professional: 'Profissional',
  'Gerente': 'Gerente',
  'Recepcionista': 'Recepcionista',
  'Atendente': 'Atendente',
  'Profissional': 'Profissional',
};

export default function InviteRegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteId = searchParams.get('invite');
  const { signInWithGoogleForInvite } = useAuth();

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteData, setInviteData] = useState<Invite | null>(null);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  // Load and validate invitation
  useEffect(() => {
    if (!inviteId) {
      setInvalidReason('Nenhum código de convite fornecido na URL.');
      setLoadingInvite(false);
      return;
    }

    async function loadInvite() {
      try {
        const docRef = doc(db, 'invites', inviteId as string);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setInvalidReason('Convite não encontrado.');
          setLoadingInvite(false);
          return;
        }

        const data = docSnap.data() as Invite;

        if (data.status !== 'pending') {
          setInvalidReason('Este convite já foi utilizado ou cancelado.');
          setLoadingInvite(false);
          return;
        }

        if (data.inviteType === 'function_link') {
          const uses = data.usesCount || 0;
          const max = data.maxUses || 1;
          if (uses >= max) {
            setInvalidReason('Este link de convite atingiu o limite máximo de cadastros de profissionais.');
            setLoadingInvite(false);
            return;
          }
        }

        // Parse expiresAt cleanly - whether it is a Firestore Timestamp or milliseconds number
        let expiresAtMillis = 0;
        if (data.expiresAt) {
          if (typeof data.expiresAt === 'object') {
            if (typeof data.expiresAt.toMillis === 'function') {
              expiresAtMillis = data.expiresAt.toMillis();
            } else if (typeof data.expiresAt.seconds === 'number') {
              expiresAtMillis = data.expiresAt.seconds * 1000;
            }
          } else {
            expiresAtMillis = Number(data.expiresAt);
          }
        }

        if (expiresAtMillis < Date.now()) {
          setInvalidReason('Este convite expirou. Solicite um novo link.');
          setLoadingInvite(false);
          return;
        }

        setInviteData(data);
        // Pre-fill email if configured in the invite
        if (data.email) {
          setFormData(prev => ({ ...prev, email: data.email || '' }));
        }
      } catch (err: any) {
        console.error("Erro ao carregar convite:", err);
        if (err?.code === 'permission-denied') {
          setInvalidReason('Este convite expirou, já foi usado ou não está mais disponível.');
        } else {
          setInvalidReason('Erro ao conectar com o servidor e carregar o convite.');
        }
      } finally {
        setLoadingInvite(false);
      }
    }

    loadInvite();
  }, [inviteId]);

  const handleGoogleInviteRegister = async () => {
    if (!inviteData) return;

    if (!formData.phone) {
      toast.error('Por favor, preencha o WhatsApp Celular antes de continuar.');
      return;
    }

    setFormLoading(true);
    try {
      await signInWithGoogleForInvite(inviteData, formData.phone, formData.fullName || undefined);

      toast.success(`Cadastro corporativo concluído com sucesso via Google! Bem-vindo à equipe.`);
      
      const navigateRole = inviteData.inviteType === 'function_link' ? inviteData.role : inviteData.inviteType;
      if (navigateRole === 'professional') {
        navigate('/dashboard/meu-painel', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      if (err.code === 'auth/invite-email-mismatch') {
        toast.error(`Este convite é restrito ao e-mail: ${err.invitedEmail}`);
      } else if (err.code === 'auth/social-email-already-linked') {
        toast.error('Este e-mail do Google já está cadastrado ou vinculado a outro salão no LumièreOS.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        toast.error('A conexão do Google foi fechada antes de ser concluída.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        toast.error('Já existe uma conta cadastrada com esse mesmo e-mail associada a outra senha.');
      } else if (err.code === 'auth/unauthorized-domain') {
        toast.error(`Domínio não autorizado nas configurações do Firebase. Adicione o domínio "${window.location.hostname}" em Firebase Console -> Authentication -> Configurações -> Domínios autorizados.`, { duration: 10000 });
      } else {
        console.error('Invite register Google error:', err);
        toast.error('Erro ao aceitar convite com Google: ' + (err.message || 'Erro inesperado'));
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    // Email matching validation
    if (inviteData.email && inviteData.email.trim().toLowerCase() !== formData.email.trim().toLowerCase()) {
      toast.error(`Este convite é restrito ao e-mail: ${inviteData.email}`);
      return;
    }

    setFormLoading(true);

    try {
      // 1. Create Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: formData.fullName });

      const now = Date.now();
      const finalRole = inviteData.inviteType === 'function_link' ? (inviteData.role || 'professional') : inviteData.inviteType;
      console.log("Role final aplicado ao usuário:", finalRole);
      const isProfRole = finalRole === 'professional' || inviteData.inviteType === 'professional';
      const professionUID = isProfRole ? user.uid : '';

      // 2. Create the general user profile under Root `/users`
      const userProfile: any = {
        id: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        role: finalRole,
        salonId: inviteData.salonId,
        professionalId: professionUID,
        createdAt: now,
        updatedAt: now,
      };

      if (inviteData.inviteType === 'function_link') {
        userProfile.specialty = inviteData.specialty || '';
        userProfile.professionalFunction = inviteData.professionalFunction || '';
        userProfile.professionalCategory = inviteData.category || '';
        userProfile.category = inviteData.category || '';
      }

      try {
        await setDoc(doc(db, 'users', user.uid), userProfile);
      } catch (error) {
        console.error("Erro ao criar usuário:", error);
        throw error;
      }

      // 3. Create or Update Professional under Salon collection if invited as Professional or via function_link
      if (inviteData.inviteType === 'function_link' || inviteData.inviteType === 'professional') {
        const profRecord = {
          userId: user.uid,
          professionalId: user.uid,
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          role: finalRole,
          category: inviteData.category || 'Profissional',
          specialty: inviteData.specialty || inviteData.category || '',
          professionalFunction: inviteData.professionalFunction || inviteData.category || '',
          status: 'active',
          isActive: true,
          joinedByInvite: true,
          inviteId: inviteData.id,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await setDoc(doc(db, `salons/${inviteData.salonId}/professionals`, user.uid), profRecord);
        } catch (error) {
          console.error("Erro ao criar profissional:", error);
          throw error;
        }
      }

      // 4. Update Invite Document Status and accepted tracking
      try {
        if (inviteData.inviteType === 'function_link') {
          const newUses = (inviteData.usesCount || 0) + 1;
          const maxUses = inviteData.maxUses || 1;
          const finalStatus = newUses >= maxUses ? 'used_limit_reached' : 'pending';

          await updateDoc(doc(db, 'invites', inviteData.id), {
            usesCount: newUses,
            status: finalStatus,
            updatedAt: now,
          });
        } else {
          await updateDoc(doc(db, 'invites', inviteData.id), {
            status: 'accepted',
            acceptedByUserId: user.uid,
            usedAt: now,
            updatedAt: now,
          });
        }
      } catch (error) {
        console.error("Erro ao atualizar convite:", error);
        throw error;
      }

      // Clear layout-simulated demo role
      sessionStorage.removeItem('demo_role');

      toast.success(`Cadastro corporativo concluído! Bem-vindo à equipe do ${inviteData.salonName}.`);
      
      // Navigate to correct dashboard layout redirect
      const navigateRole = inviteData.inviteType === 'function_link' ? inviteData.role : inviteData.inviteType;
      if (navigateRole === 'professional') {
        navigate('/dashboard/meu-painel', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado. Por favor, tente recuperar sua senha ou use outro e-mail.');
      } else {
        toast.error('Ocorreu um erro no cadastro: ' + (err.message || 'Erro inesperado'));
      }
    } finally {
      setFormLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-light">Validando link de convite oficial...</p>
      </div>
    );
  }

  if (invalidReason) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center mb-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
              <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
            </Link>
          </div>
          
          <div className="bg-card/40 backdrop-blur-xl py-10 px-8 rounded-3xl border border-destructive/20 shadow-2xl flex flex-col items-center gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-heading text-destructive font-medium">Link de Convite Inválido</h2>
            <p className="text-sm text-foreground/85 leading-relaxed">{invalidReason}</p>
            <p className="text-xs text-muted-foreground">Por favor, solicite um novo link de convite ao proprietário ou gerente do salão.</p>
            
            <Link 
              to="/login" 
              className="mt-4 bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl px-4 py-2 text-sm inline-flex items-center justify-center transition-colors"
            >
              Ir para o Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
          </Link>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] uppercase tracking-wider font-bold text-primary mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" /> Convite Corporativo Válido
        </div>
        
        <h2 className="text-center text-3xl font-light font-heading tracking-tight text-foreground">
          Ative seu cadastro na equipe
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground font-light">
          Você foi convidado para fazer parte do <span className="text-primary font-bold">{inviteData?.salonName}</span> como{' '}
          <span className="text-primary font-bold lowercase">
            {inviteData ? (roleTranslations[inviteData.role] || inviteData.role) : ''}
            {inviteData?.category ? ` (${inviteData.category})` : ''}
          </span>.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-card/40 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <h3 className="text-base font-heading font-normal border-b border-white/5 pb-2 text-foreground/90">Dados de Acesso</h3>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input 
                  id="fullName" 
                  name="fullName" 
                  required 
                  value={formData.fullName} 
                  onChange={handleChange} 
                  className="bg-black/50 h-11 rounded-xl" 
                  placeholder="Nome que será exibido aos clientes e equipe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail Corporativo</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    disabled={!!inviteData?.email}
                    value={formData.email} 
                    onChange={handleChange} 
                    className="bg-black/50 h-11 rounded-xl disabled:opacity-60" 
                    placeholder="voce@exemplo.com"
                  />
                  {inviteData?.email && (
                    <p className="text-[10px] text-primary">E-mail fixado pelo administrador do salão.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp Celular</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    required 
                    value={formData.phone} 
                    onChange={handleChange} 
                    className="bg-black/50 h-11 rounded-xl" 
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha de Login</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    value={formData.password} 
                    onChange={handleChange} 
                    className="bg-black/50 h-11 rounded-xl" 
                    placeholder="Mínimo de 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    type="password" 
                    required 
                    value={formData.confirmPassword} 
                    onChange={handleChange} 
                    className="bg-black/50 h-11 rounded-xl" 
                    placeholder="Confirme sua senha"
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={formLoading} 
              className="w-full bg-primary hover:bg-gold-500 text-black font-semibold h-11 rounded-xl shadow-lg shadow-primary/15 transition-transform active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              {formLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Criando conta corporativa...
                </>
              ) : (
                <>
                  Concluir Cadastro e Acessar LumièreOS
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#141414] px-3 text-muted-foreground text-[10px] tracking-wider">ou aceite usando</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                disabled={formLoading}
                onClick={handleGoogleInviteRegister}
                className="w-full rounded-xl h-11 bg-black/40 hover:bg-black/80 text-foreground border border-white/10 hover:border-primary/20 transition-all flex items-center justify-center gap-2 font-semibold"
              >
                <Chrome className="w-4 h-4 text-primary" />
                <span>Entrar com Google e aceitar convite</span>
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Já tem conta cadastrada no Lumière?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
