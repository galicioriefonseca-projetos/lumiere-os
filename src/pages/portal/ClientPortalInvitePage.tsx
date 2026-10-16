import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Building2, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Briefcase,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';

interface InviteDetails {
  token: string;
  salonId: string;
  agencyName: string;
  agencyEmail: string;
  agencyPhone: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  status: string;
}

export default function ClientPortalInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || searchParams.get('invite') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [mode, setMode] = useState<'register' | 'login'>('register');

  // Form states
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setInviteError('Link de convite inválido ou ausente. Verifique o link recebido da sua agência.');
      setLoading(false);
      return;
    }

    async function fetchInvite() {
      try {
        setLoading(true);
        const res = await fetch(`/api/client-portal/resolve-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setInviteError(data.error || 'Não foi possível carregar os dados deste convite.');
          return;
        }

        setInviteDetails(data);
        if (data.clientName) setFullName(data.clientName);
        if (data.companyName) setCompanyName(data.companyName);
        if (data.clientEmail) setEmail(data.clientEmail);
      } catch (err: any) {
        console.error('Erro ao resolver convite:', err);
        setInviteError('Erro de conexão ao carregar o convite.');
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  const handleRegisterOrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (mode === 'register') {
      if (!fullName.trim()) {
        toast.error('Informe seu nome completo.');
        return;
      }
      if (!companyName.trim()) {
        toast.error('Informe o nome da sua empresa/marca.');
        return;
      }
      if (password.length < 6) {
        toast.error('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('As senhas não coincidem.');
        return;
      }
    }

    try {
      setSubmitting(true);
      let userCredential;

      if (mode === 'register') {
        userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: fullName.trim()
          });
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      const idToken = await userCredential.user.getIdToken();

      // Envia ao backend para vincular o cliente e o tenant
      const res = await fetch('/api/client-portal/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token,
          fullName: fullName.trim() || userCredential.user.displayName,
          companyName: companyName.trim(),
          phone: phone.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao vincular convite.');
      }

      toast.success('Bem-vindo(a) à sua Área do Cliente!');
      navigate('/portal', { replace: true });
    } catch (err: any) {
      console.error('Erro no cadastro do cliente:', err);
      let msg = err.message || 'Erro ao processar acesso.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Este e-mail já possui cadastro. Alterne para a opção "Já possuo conta" para entrar.';
        setMode('login');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'E-mail ou senha incorretos.';
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!token) return;

    try {
      setSubmitting(true);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();

      const res = await fetch('/api/client-portal/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token,
          fullName: userCredential.user.displayName || fullName || 'Cliente',
          companyName: companyName.trim() || inviteDetails?.companyName || userCredential.user.displayName,
          phone: phone.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao vincular convite.');
      }

      toast.success('Acesso realizado com sucesso!');
      navigate('/portal', { replace: true });
    } catch (err: any) {
      console.error('Erro no Google Sign-In:', err);
      toast.error(err.message || 'Erro ao entrar com Google.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#061A14] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#DFC498] mb-3" />
        <p className="text-[#8FAEA2] text-sm">Carregando convite exclusivo...</p>
      </div>
    );
  }

  if (inviteError || !inviteDetails) {
    return (
      <div className="min-h-screen bg-[#061A14] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0A261E] border border-red-500/20 p-8 rounded-2xl shadow-2xl text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Convite Indisponível</h2>
          <p className="text-sm text-[#8FAEA2] mb-6 leading-relaxed">
            {inviteError || 'Este link de convite expirou ou é inválido.'}
          </p>
          <div className="p-4 bg-white/5 rounded-xl border border-white/5 mb-6 text-left text-xs text-[#8FAEA2] space-y-1">
            <p>• Entre em contato com a equipe da sua agência.</p>
            <p>• Solicite um novo link de acesso à sua Área do Cliente.</p>
          </div>
          <Button
            onClick={() => navigate('/login')}
            className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-semibold h-11 rounded-xl"
          >
            Ir para Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061A14] text-[#F5F9F7] flex flex-col justify-between">
      {/* Top Brand Header */}
      <header className="border-b border-[#17473A]/60 bg-[#061A14]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#DFC498] to-[#997C4D] flex items-center justify-center text-[#04140F] font-bold shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#DFC498]">Área do Cliente</span>
            <h1 className="text-sm font-medium text-white">{inviteDetails.agencyName}</h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#8FAEA2] bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <ShieldCheck className="w-4 h-4 text-[#DFC498]" />
          Acesso Seguro & Criptografado
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Context & Benefits */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DFC498]/10 border border-[#DFC498]/20 text-[#DFC498] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Convite Exclusivo para Clientes
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                Seu portal de relatórios e contratos em um só lugar
              </h2>
              <p className="text-sm text-[#8FAEA2] leading-relaxed">
                A agência <strong className="text-white">{inviteDetails.agencyName}</strong> preparou um espaço exclusivo para que sua empresa acompanhe o andamento dos projetos, campanhas e documentos contratuais.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0A261E]/80 border border-[#17473A]/80">
                <div className="p-2 rounded-lg bg-[#DFC498]/10 text-[#DFC498]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Relatórios de Performance</h4>
                  <p className="text-[11px] text-[#8FAEA2]">Métricas de tráfego, alcance, leads gerados e ROI atualizados periodicamente.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0A261E]/80 border border-[#17473A]/80">
                <div className="p-2 rounded-lg bg-[#DFC498]/10 text-[#DFC498]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Contratos & Escopos</h4>
                  <p className="text-[11px] text-[#8FAEA2]">Acesso facilitado aos termos contratuais, entregáveis e documentos assinados.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0A261E]/80 border border-[#17473A]/80">
                <div className="p-2 rounded-lg bg-[#DFC498]/10 text-[#DFC498]">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Canal Direto de Alinhamento</h4>
                  <p className="text-[11px] text-[#8FAEA2]">Contato facilitado com o gestor da sua conta via WhatsApp e e-mail.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Register/Login Card */}
          <div className="lg:col-span-7">
            <Card className="bg-[#0A261E]/95 border-[#17473A] shadow-2xl backdrop-blur-xl">
              <CardHeader className="space-y-1 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-white">
                    {mode === 'register' ? 'Ativar Meu Acesso' : 'Entrar no Meu Portal'}
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                    className="text-xs text-[#DFC498] hover:underline"
                  >
                    {mode === 'register' ? 'Já tem conta? Entrar' : 'Novo por aqui? Cadastrar'}
                  </button>
                </div>
                <CardDescription className="text-xs text-[#8FAEA2]">
                  {mode === 'register' 
                    ? `Preencha os dados abaixo para vincular sua conta à agência ${inviteDetails.agencyName}.` 
                    : 'Informe seu e-mail e senha cadastrados para acessar seus relatórios.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={submitting}
                  className="w-full h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Continuar com o Google
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-white/10 w-full" />
                  <span className="bg-[#0A261E] px-3 text-[11px] text-[#8FAEA2] uppercase tracking-wider relative">
                    ou com e-mail
                  </span>
                </div>

                <form onSubmit={handleRegisterOrLogin} className="space-y-3.5">
                  {mode === 'register' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#8FAEA2]">Nome do Responsável</Label>
                          <div className="relative">
                            <User className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                            <Input
                              required
                              value={fullName}
                              onChange={e => setFullName(e.target.value)}
                              placeholder="Ex: Dra. Mariana Costa"
                              className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#8FAEA2]">Nome da Empresa / Marca</Label>
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                            <Input
                              required
                              value={companyName}
                              onChange={e => setCompanyName(e.target.value)}
                              placeholder="Ex: Clínica Bella Vita"
                              className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#8FAEA2]">WhatsApp para Contato (Opcional)</Label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                          <Input
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="(11) 98765-4321"
                            className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#8FAEA2]">E-mail de Acesso</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                      <Input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@empresa.com.br"
                        className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#8FAEA2]">Senha de Acesso</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                      <Input
                        required
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                      />
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#8FAEA2]">Confirmar Senha</Label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#8FAEA2] absolute left-3 top-3.5" />
                        <Input
                          required
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repita sua senha"
                          className="pl-9 bg-black/20 border-white/10 text-white rounded-xl h-11 text-sm focus:border-[#DFC498]"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-[#DFC498] to-[#C5A880] hover:from-[#C5A880] hover:to-[#B0926A] text-[#04140F] font-bold h-11 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando acesso...
                      </>
                    ) : (
                      <>
                        {mode === 'register' ? 'Criar Acesso e Ver Meus Relatórios' : 'Acessar Minha Área'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#17473A]/40 bg-[#061A14]/80 py-4 px-6 text-center text-xs text-[#8FAEA2]">
        <p>
          Área do Cliente oficial fornecida por <strong className="text-white">{inviteDetails.agencyName}</strong> via LumièreOS.
        </p>
      </footer>
    </div>
  );
}
