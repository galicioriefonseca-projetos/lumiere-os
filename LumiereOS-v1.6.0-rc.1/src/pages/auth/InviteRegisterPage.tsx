import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Chrome, Info, Check } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { professionalSpecialties } from '../../data/professionalSpecialties';

interface Invite {
  id: string;
  salonId: string;
  salonName: string;
  invitedByUserId: string;
  invitedByName: string;
  inviteType: 'manager' | 'receptionist' | 'attendant' | 'professional' | 'function_link' | 'team_public_link';
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
  team_public_link: 'Link da Equipe',
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

  // States for specialties selectors (needed for team_public_link)
  const [primaryFunction, setPrimaryFunction] = useState('');
  const [customPrimary, setCustomPrimary] = useState('');
  const [selectedAdicionais, setSelectedAdicionais] = useState<string[]>([]);
  const [customAdicional, setCustomAdicional] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);

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

        if (data.inviteType === 'function_link' || data.inviteType === 'team_public_link') {
          const uses = data.usesCount || 0;
          const max = data.maxUses || 99999;
          if (uses >= max) {
            setInvalidReason('Este link de convite atingiu o limite máximo de cadastros de profissionais.');
            setLoadingInvite(false);
            return;
          }
        }

        // Parse expiresAt cleanly
        let expiresAtMillis = Infinity;
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
        // Pre-fill email if configured
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

  const toggleAdicional = (spec: string) => {
    setSelectedAdicionais(prev => 
      prev.includes(spec) ? prev.filter(p => p !== spec) : [...prev, spec]
    );
  };

  const handleGoogleInviteRegister = async () => {
    if (!inviteData) return;

    const isTeamPublic = inviteData.inviteType === 'team_public_link';
    let choices: any = undefined;

    if (isTeamPublic) {
      const finalPrimary = primaryFunction === 'Outro' ? customPrimary.trim() : primaryFunction;
      if (!finalPrimary) {
        toast.error('Por favor, escolha sua função principal primeiro.');
        return;
      }
      const cleanExtras = selectedAdicionais.map(item => item === 'Outro' ? customAdicional.trim() : item).filter(Boolean);
      choices = {
        primaryFunction: finalPrimary,
        additionalFunctions: cleanExtras
      };
    }

    setFormLoading(true);
    try {
      await signInWithGoogleForInvite(
        inviteData, 
        formData.phone || undefined, 
        formData.fullName || undefined, 
        choices
      );

      toast.success(`Cadastro de profissional concluído! Bem-vindo à equipe do ${inviteData.salonName}.`);
      navigate('/dashboard/meu-painel', { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/invite-email-mismatch') {
        toast.error(`Este convite é restrito ao e-mail: ${err.invitedEmail}`);
      } else if (err.code === 'auth/social-email-already-linked') {
        toast.error('Este e-mail do Google já está cadastrado ou vinculado a outro salão no LumièreOS.');
      } else if (err.code === 'auth/already-linked-to-other-salon') {
        toast.error('Esta conta já está vinculada a outro salão. Use outro e-mail ou fale com o suporte.');
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

    if (inviteData.email && inviteData.email.trim().toLowerCase() !== formData.email.trim().toLowerCase()) {
      toast.error(`Este convite é restrito ao e-mail: ${inviteData.email}`);
      return;
    }

    const isTeamPublic = inviteData.inviteType === 'team_public_link';
    const finalPrimary = primaryFunction === 'Outro' ? customPrimary.trim() : primaryFunction;

    if (isTeamPublic && !finalPrimary) {
      toast.error('Por favor, informe sua função principal no salão.');
      return;
    }

    const cleanExtras = isTeamPublic 
      ? selectedAdicionais.map(item => item === 'Outro' ? customAdicional.trim() : item).filter(Boolean) 
      : [];
    const allSpecialties = isTeamPublic 
      ? Array.from(new Set([finalPrimary, ...cleanExtras])).filter(Boolean) 
      : [inviteData.specialty || inviteData.category || 'Profissional'];

    setFormLoading(true);

    try {
      // 1. Create Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: formData.fullName });

      const now = Date.now();
      const finalRole = isTeamPublic ? 'professional' : (inviteData.inviteType === 'function_link' ? (inviteData.role || 'professional') : inviteData.inviteType);
      const isProfRole = finalRole === 'professional' || inviteData.inviteType === 'professional' || isTeamPublic;
      const professionUID = isProfRole ? user.uid : '';

      // 2. Create the general user profile under Root `/users`
      const userProfile: any = {
        id: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone || null,
        role: finalRole,
        salonId: inviteData.salonId,
        professionalId: professionUID,
        isActive: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      if (isTeamPublic) {
        userProfile.primaryFunction = finalPrimary;
        userProfile.professionalFunction = finalPrimary;
        userProfile.professionalCategory = finalPrimary;
        userProfile.category = finalPrimary;
        userProfile.specialty = finalPrimary;
        userProfile.specialties = allSpecialties;
        userProfile.additionalFunctions = cleanExtras;
      } else if (inviteData.inviteType === 'function_link') {
        userProfile.specialty = inviteData.specialty || '';
        userProfile.professionalFunction = inviteData.professionalFunction || '';
        userProfile.professionalCategory = inviteData.category || '';
        userProfile.category = inviteData.category || '';
      }

      await setDoc(doc(db, 'users', user.uid), userProfile);

      // 3. Create or Update Professional under Salon collection if Professional role
      if (isTeamPublic || inviteData.inviteType === 'function_link' || inviteData.inviteType === 'professional') {
        const profRecord: any = {
          userId: user.uid,
          professionalId: user.uid,
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone || null,
          role: finalRole,
          status: 'active',
          isActive: true,
          joinedByInvite: true,
          inviteId: inviteData.id,
          inviteType: inviteData.inviteType,
          createdAt: now,
          updatedAt: now,
        };

        if (isTeamPublic) {
          profRecord.primaryFunction = finalPrimary;
          profRecord.professionalFunction = finalPrimary;
          profRecord.professionalCategory = finalPrimary;
          profRecord.category = finalPrimary;
          profRecord.specialty = finalPrimary;
          profRecord.specialties = allSpecialties;
          profRecord.additionalFunctions = cleanExtras;
        } else {
          profRecord.category = inviteData.category || 'Profissional';
          profRecord.specialty = inviteData.specialty || inviteData.category || '';
          profRecord.professionalFunction = inviteData.professionalFunction || inviteData.category || '';
        }

        await setDoc(doc(db, `salons/${inviteData.salonId}/professionals`, user.uid), profRecord);
      }

      // 4. Update Invite Document Status and usesCount
      if (inviteData.inviteType === 'function_link' || isTeamPublic) {
        const newUses = (inviteData.usesCount || 0) + 1;
        const maxUses = inviteData.maxUses || 99999;
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

      sessionStorage.removeItem('demo_role');
      toast.success(`Cadastro corporativo concluído! Bem-vindo(a) à equipe do ${inviteData.salonName}.`);
      navigate('/dashboard/meu-painel', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.');
      } else {
        toast.error('Ocorreu um erro no cadastro: ' + (err.message || 'Erro inesperado'));
      }
    } finally {
      setFormLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-light">Validando link de convite oficial...</p>
      </div>
    );
  }

  if (invalidReason) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center mb-6 overflow-hidden">
            <Link to="/" className="flex items-center gap-2 group">
              <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
              <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
            </Link>
          </div>
          
          <div className="bg-card/40 backdrop-blur-xl py-10 px-6 sm:px-8 rounded-3xl border border-destructive/20 shadow-2xl flex flex-col items-center gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-heading text-destructive font-medium">Link de Convite Inválido</h2>
            <p className="text-sm text-foreground/85 leading-relaxed">{invalidReason}</p>
            <p className="text-xs text-muted-foreground">Por favor, solicite um novo link de convite ao proprietário ou gerente do salão.</p>
            
            <Link 
              to="/login" 
              className="mt-4 bg-primary hover:bg-[#cdaf26] text-black font-semibold rounded-xl px-5 py-2.5 text-sm inline-flex items-center justify-center transition-colors"
            >
              Ir para o Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPublicLink = inviteData?.inviteType === 'team_public_link';

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="flex justify-center mb-5">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
          </Link>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] uppercase tracking-wider font-bold text-primary mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" /> {isPublicLink ? 'Link Único de Equipe Autenticado' : 'Convite Corporativo Válido'}
        </div>
        
        <h2 className="text-center text-3xl font-light font-heading tracking-tight text-foreground select-none">
          {isPublicLink ? 'Cadastro da equipe' : 'Ative seu cadastro na equipe'}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground font-light px-2">
          {isPublicLink ? (
            <>
              Bem-vindo ao portal de profissionais do <span className="text-primary font-bold">{inviteData?.salonName}</span>. Entre com o Google e forneça suas funções logo abaixo.
            </>
          ) : (
            <>
              Você foi convidado para fazer parte do <span className="text-primary font-bold">{inviteData?.salonName}</span> como{' '}
              <span className="text-primary font-semibold lowercase">
                {inviteData ? (roleTranslations[inviteData.role] || inviteData.role) : ''}
                {inviteData?.category ? ` (${inviteData.category})` : ''}
              </span>.
            </>
          )}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-card/40 backdrop-blur-xl py-8 px-4 sm:px-10 shadow-2xl border border-white/10 sm:rounded-3xl">
          
          {/* STEP 1: For team_public_link, select roles first */}
          {isPublicLink && (
            <div className="space-y-6 mb-8 border-b border-white/5 pb-6">
              <h3 className="text-base font-heading font-medium tracking-wide text-foreground/90 flex items-center gap-2 text-primary">
                <Info className="w-4 h-4 text-primary" />
                <span>Escolha suas Funções</span>
              </h3>
              
              <div className="space-y-4">
                {/* Primary Function Selection */}
                <div className="space-y-2">
                  <Label htmlFor="primarySelect" className="text-xs font-semibold text-zinc-300">Função Principal <span className="text-[#D4AF37]">*</span></Label>
                  <p className="text-[11px] text-zinc-400 font-light">Essa será sua especialidade padrão exibida nas agendas e painéis.</p>
                  
                  <div className="relative">
                    <select
                      id="primarySelect"
                      value={primaryFunction}
                      onChange={(e) => setPrimaryFunction(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 text-white rounded-xl h-11 px-3 text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Selecione sua função principal --</option>
                      {professionalSpecialties.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      ▼
                    </div>
                  </div>

                  {primaryFunction === 'Outro' && (
                    <div className="pt-2 animate-fadeIn">
                      <Label htmlFor="customPrimaryInput" className="text-[11px] text-zinc-300">Escreva sua função principal:</Label>
                      <Input
                        id="customPrimaryInput"
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        placeholder="Ex: Designer de Cílios Sênior"
                        className="bg-black/50 h-11 rounded-xl mt-1 border-primary/30 focus:border-primary"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Additional Functions Selection */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold text-zinc-300">Gostaria de adicionar funções extras/adicionais? (Opcional)</Label>
                  <p className="text-[11px] text-zinc-400 font-light">Se você possui habilidades adicionais (ex: Manicure, Pedicure e Cabeleireira), marque-as abaixo. Você terá apenas um único cadastro para gerenciar tudo.</p>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3.5 bg-zinc-950/70 border border-white/5 rounded-xl scrollbar-thin">
                    {professionalSpecialties.filter(s => s !== primaryFunction).map((spec) => {
                      const isChecked = selectedAdicionais.includes(spec);
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleAdicional(spec)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                            isChecked 
                              ? 'bg-primary/10 border-primary/40 text-primary font-medium' 
                              : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${isChecked ? 'bg-primary border-primary text-black' : 'border-zinc-500'}`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{spec}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedAdicionais.includes('Outro') && (
                    <div className="pt-2 animate-fadeIn">
                      <Label htmlFor="customAdicionalInput" className="text-[11px] text-zinc-300">Escreva suas outras funções extras (separe por vírgulas):</Label>
                      <Input
                        id="customAdicionalInput"
                        value={customAdicional}
                        onChange={(e) => setCustomAdicional(e.target.value)}
                        placeholder="Ex: Micropigmentadora, Lash artist"
                        className="bg-black/50 h-11 rounded-xl mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SOCIAL LOGIN - CORE SIGNUP METHOD RECOMMENDED */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#D4AF37] tracking-wider uppercase mb-1">Passo Principal: Acesso Google</h4>
            <p className="text-xs text-zinc-400 font-light pb-2 leading-relaxed">
              O cadastro puxará seu nome, foto e e-mail verificados instantaneamente para segurança da sua conta.
            </p>
            
            <Button
              type="button"
              disabled={formLoading}
              onClick={handleGoogleInviteRegister}
              className="w-full rounded-2xl h-12 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black border-none transition-all flex items-center justify-center gap-2.5 font-bold shadow-[0_0_20px_rgba(212,175,55,0.25)] relative active:scale-[0.99] group cursor-pointer"
            >
              <Chrome className="w-5 h-5 text-black group-hover:scale-110 transition-transform" />
              <span>Concluir Cadastro com o Google</span>
            </Button>
          </div>

          <div className="my-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-[#141414] px-3.5 text-zinc-500 font-medium font-mono">ou use e-mail e senha</span>
              </div>
            </div>
          </div>

          {!showEmailFields ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowEmailFields(true)}
                className="text-xs text-[#D4AF37]/80 hover:text-[#D4AF37] hover:underline font-medium transition-all"
              >
                Cadastrar manualmente com e-mail e senha
              </button>
            </div>
          ) : (
            <form className="space-y-5 pt-2 animate-fadeIn" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Formulário Manual</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    required 
                    value={formData.fullName} 
                    onChange={handleChange} 
                    className="bg-black/50 h-11 rounded-xl focus:border-primary/40 focus:ring-0" 
                    placeholder="Nome que será exibido aos clientes e equipe"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail de Trabalho</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      required 
                      disabled={!!inviteData?.email}
                      value={formData.email} 
                      onChange={handleChange} 
                      className="bg-black/50 h-11 rounded-xl disabled:opacity-60" 
                      placeholder="seuemail@exemplo.com"
                    />
                    {inviteData?.email && (
                      <p className="text-[10px] text-[#D4AF37]">E-mail fixado pelo administrador do salão.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">WhatsApp Celular <span className="text-zinc-500 font-normal text-[11px]">(Opcional)</span></Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleChange} 
                      className="bg-black/50 h-11 rounded-xl" 
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Criar Senha</Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      required={showEmailFields}
                      value={formData.password} 
                      onChange={handleChange} 
                      className="bg-black/50 h-11 rounded-xl" 
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      type="password" 
                      required={showEmailFields}
                      value={formData.confirmPassword} 
                      onChange={handleChange} 
                      className="bg-black/50 h-11 rounded-xl" 
                      placeholder="Repita a nova senha"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={formLoading} 
                className="w-full bg-[#1b1b22] hover:bg-zinc-900 text-[#D4AF37] border border-[#D4AF37]/35 font-semibold h-11 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-5"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Efetuando cadastro...
                  </>
                ) : (
                  <>
                    Finalizar Cadastro Manual
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-8 border-t border-white/5 pt-5 text-center">
            <p className="text-xs text-muted-foreground">
              Já tem conta cadastrada no Lumière?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold text-[#D4AF37] font-sans">
                Faça login aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
