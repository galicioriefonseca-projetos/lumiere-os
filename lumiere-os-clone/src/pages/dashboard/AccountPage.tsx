import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { 
  User, 
  MapPin, 
  Phone, 
  CreditCard, 
  Users, 
  CheckCircle,
  Gem,
  Database,
  Building,
  Mail,
  ShieldAlert,
  Crown,
  Sparkles,
  CalendarDays,
  ListTodo,
  History,
  Activity,
  Trash2,
  Calendar,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';
import { toast } from 'sonner';

export default function AccountPage() {
  const { salonData, userData, currentUser } = useAuth();

  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [workingHours, setWorkingHours] = useState<any>({
    mon: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    tue: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    wed: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    thu: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    fri: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    sat: { open: true, start: '09:00', end: '16:00', breakStart: '', breakEnd: '' },
    sun: { open: false, start: '09:00', end: '13:00', breakStart: '', breakEnd: '' },
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (salonData) {
      setBookingEnabled(salonData.bookingEnabled || false);
      setSlug(salonData.slug || '');
      setBookingMessage(salonData.bookingMessage || '');
      if (salonData.workingHours) {
        setWorkingHours(salonData.workingHours);
      }
    }
  }, [salonData]);

  const handleSaveBookingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;
    try {
      setSavingConfig(true);
      const cleanedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const ref = doc(db, 'salons', salonData.id);
      await updateDoc(ref, {
        bookingEnabled,
        slug: cleanedSlug,
        bookingMessage,
        workingHours,
        updatedAt: Date.now()
      });
      toast.success('Configurações de agendamento salvas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSavingConfig(false);
    }
  };
  
  // Loading counters to show real usage statistics
  const [stats, setStats] = useState({
    professionalsCount: 0,
    servicesCount: 0,
    clientsCount: 0,
    appointmentsCount: 0,
    checklistsRunCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  useEffect(() => {
    if (!salonData) return;

    const fetchStats = async () => {
      try {
        const salonId = salonData.id;
        
        // Fetch counters asynchronously
        const qp = query(collection(db, `salons/${salonId}/professionals`));
        const qs = query(collection(db, `salons/${salonId}/services`));
        const qc = query(collection(db, `salons/${salonId}/clients`));
        const qa = query(collection(db, `salons/${salonId}/appointments`));
        const qck = query(collection(db, `salons/${salonId}/checklistRuns`));

        const [pSnap, sSnap, cSnap, aSnap, ckSnap] = await Promise.all([
          getDocs(qp),
          getDocs(qs),
          getDocs(qc),
          getDocs(qa),
          getDocs(qck)
        ]);

        // Filter active only for professionals
        const activeProfs = pSnap.docs.map(d => d.data()).filter(p => p.isActive !== false).length;

        setStats({
          professionalsCount: activeProfs,
          servicesCount: sSnap.size,
          clientsCount: cSnap.size,
          appointmentsCount: aSnap.size,
          checklistsRunCount: ckSnap.size
        });
      } catch (err) {
        console.error("Erro ao carregar métricas da conta:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [salonData]);

  useEffect(() => {
    if (!salonData) return;

    setLoadingAudits(true);
    const salonId = salonData.id;
    const q = query(
      collection(db, `salons/${salonId}/auditLogs`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as AuditLog);
      });
      setAuditLogs(logs);
      setLoadingAudits(false);
    }, (error) => {
      console.error("Erro ao carregar logs de auditoria:", error);
      setLoadingAudits(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case 'owner':
        return <span className="text-xs bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/35 font-bold px-3 py-1 rounded-full flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-[#D4AF37]" /> Proprietário</span>;
      case 'platform_admin':
        return <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-3 py-1 rounded-full">Super Admin</span>;
      case 'manager':
        return <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold px-3 py-1 rounded-full">Gerente</span>;
      default:
        return <span className="text-xs bg-zinc-800 text-zinc-300 font-bold px-3 py-1 rounded-full">{role || 'Colaborador'}</span>;
    }
  };

  const currentPlanLabel = salonData?.plan === 'founder' ? 'Plano Founder' : 'Plano Premium Dev';
  const maxProfessionalsSeat = salonData?.plan === 'founder' ? 'Ilimitado' : '5 Colaboradores';

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
          <Building className="w-6 h-6 text-[#D4AF37]" />
          Configurações da Conta
        </h2>
        <p className="text-zinc-500 text-xs">
          Acompanhe todos os limites, detalhes do salão, licenças ativas e informações do seu perfil de proprietário.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Profile overview & salon information */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Owner Profile Card */}
          <Card className="bg-zinc-950 border-zinc-900 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 select-none">
              <User className="w-32 h-32 text-white" />
            </div>
            
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-[#D4AF37]" />
                    Perfil do Proprietário
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Credenciais básicas de acesso e nível de autoridade.</CardDescription>
                </div>
                {getRoleBadge(userData?.role)}
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold">Nome Completo</span>
                  <span className="text-xs font-semibold text-white block mt-0.5">{userData?.fullName || 'Proprietário Lumière'}</span>
                </div>
                <div className="space-y-1 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail de Registro</span>
                  <span className="text-xs font-semibold text-white block mt-0.5">{currentUser?.email || userData?.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salon Details Card */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-[#D4AF37]" />
                Cadastro do Estabelecimento
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Dados cadastrais fornecidos durante o processo de onboarding.</CardDescription>
            </CardHeader>
            
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Nome do Salão/Estúdio</span>
                  <span className="text-sm font-semibold text-white block mt-0.5 border-b border-zinc-900 pb-1.5">{salonData?.name || 'Não cadastrado'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone de Contato</span>
                  <span className="text-sm font-semibold text-white block mt-0.5 border-b border-zinc-900 pb-1.5">{salonData?.phone || 'Não cadastrado'}</span>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1"><MapPin className="w-3 h-3" /> Cidade / Estado</span>
                  <span className="text-sm font-semibold text-white block mt-0.5">{salonData?.city ? `${salonData.city} - ${salonData.state || 'MG'}` : 'Belo Horizonte - MG'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Agendamento Online e Link Comercial */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                Agendamento Online & Link Comercial
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Configure as regras do seu portal público para captação direta de clientes via link no Instagram ou WhatsApp.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSaveBookingConfig} className="space-y-6">
                <fieldset disabled={!['owner', 'manager', 'platform_admin'].includes(userData?.role || '')} className="space-y-6 border-none p-0 m-0">
                  
                  {/* Ativar/Desativar */}
                  <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl">
                    <div className="space-y-0.5">
                      <label className="text-sm font-bold text-white block">Ativar Agendamento Online</label>
                      <span className="text-xs text-zinc-500">Permitir que clientes agendem serviços sem precisar de login.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingEnabled(!bookingEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        bookingEnabled ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          bookingEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* slug */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 font-mono uppercase">URL do Portal de Agendamento</label>
                    <div className="flex rounded-xl shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-zinc-800 bg-zinc-900 text-zinc-500 font-mono text-xs">
                        lumiereos.com/agendar/
                      </span>
                      <input
                        required
                        type="text"
                        placeholder="slug-unico-do-salao"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 min-w-0 rounded-r-xl px-3 py-2 text-xs focus:outline-none placeholder-zinc-500 text-white font-mono font-bold"
                      />
                    </div>
                    {slug && bookingEnabled && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                        Seu link ativo: 
                        <a 
                          href={`/agendar/${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-emerald-400 hover:text-emerald-300 font-mono font-semibold underline ml-1"
                        >
                          abrir link em nova guia
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Boas-vindas bookingMessage */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 font-mono uppercase">Mensagem de Boas-Vindas</label>
                    <textarea
                      rows={3}
                      placeholder="Seja bem-vindo ao portal de agendamentos! Reserve seu horário..."
                      value={bookingMessage}
                      onChange={(e) => setBookingMessage(e.target.value)}
                      className="w-full bg-zinc-905 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none placeholder-zinc-500 text-white leading-relaxed resize-none"
                    />
                  </div>

                  {/* Working Hours */}
                  <div className="space-y-4">
                    <div className="border-b border-zinc-900 pb-2">
                      <label className="text-xs font-bold text-zinc-300 font-mono uppercase">Dias de Funcionamento & Almoço</label>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Configure os dias de trabalho, horários de expediente e o intervalo de almoço.</p>
                    </div>

                    <div className="grid gap-3.5">
                      {Object.keys(workingHours).map((dayKey) => {
                        const wh = workingHours[dayKey];
                        const dayLabels: { [key: string]: string } = {
                          mon: 'Segunda-feira',
                          tue: 'Terça-feira',
                          wed: 'Quarta-feira',
                          thu: 'Quinta-feira',
                          fri: 'Sexta-feira',
                          sat: 'Sábado',
                          sun: 'Domingo'
                        };

                        return (
                          <div 
                            key={dayKey} 
                            className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              wh.open 
                                ? 'bg-zinc-900/40 border-zinc-900' 
                                : 'bg-transparent border-zinc-900/50 opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={wh.open}
                                onChange={(e) => {
                                  setWorkingHours((p: any) => ({
                                    ...p,
                                    [dayKey]: { ...p[dayKey], open: e.target.checked }
                                  }));
                                }}
                                className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-white focus:ring-0 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-white">{dayLabels[dayKey]}</span>
                            </div>

                            {wh.open && (
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Expediente:</span>
                                  <input 
                                    type="time" 
                                    value={wh.start} 
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], start: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center"
                                  />
                                  <span className="text-zinc-500">as</span>
                                  <input 
                                    type="time" 
                                    value={wh.end} 
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], end: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Almoço:</span>
                                  <input 
                                    type="time" 
                                    value={wh.breakStart || ''} 
                                    placeholder="Sem"
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], breakStart: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center placeholder-zinc-500"
                                  />
                                  <span className="text-zinc-500">as</span>
                                  <input 
                                    type="time" 
                                    value={wh.breakEnd || ''} 
                                    placeholder="Sem"
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], breakEnd: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center placeholder-zinc-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apenas donos e gerentes veem e salvam */}
                  {['owner', 'manager', 'platform_admin'].includes(userData?.role || '') ? (
                    <Button 
                      type="submit" 
                      disabled={savingConfig}
                      className="w-full bg-white hover:bg-zinc-100 text-black h-11 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-xs"
                    >
                      {savingConfig ? 'Gravando Alterações...' : 'Salvar Configurações de Agendamento'}
                    </Button>
                  ) : (
                    <div className="p-3 bg-zinc-900/20 border border-zinc-900 text-zinc-500 rounded-xl text-center text-xs">
                      Apenas administradores (proprietários/gerentes) podem editar as configurações de agendamento online.
                    </div>
                  )}

                </fieldset>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Subscription Plan, seats, and database usage */}
        <div className="space-y-6">
          
          {/* Subscription and active seats limit */}
          <Card className="bg-zinc-950 border-zinc-900 overflow-hidden relative">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#D4AF37]/5 rounded-full blur-xl" />
            
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-md font-heading font-light text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                Inscrição & Licenciamento
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Status atual do seu plano Lumière e limites operacionais.</CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-4 rounded-xl">
                <Crown className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold text-[#D4AF37]">{currentPlanLabel}</h4>
                  <p className="text-[10px] text-zinc-400">Assinatura Digital Ativa e Segura</p>
                </div>
              </div>

              <div className="space-y-1 hover:bg-zinc-900/10 p-2.5 rounded-xl transition-all">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Assentos de Equipe Utilizados</span>
                  <span className="font-mono font-bold text-[#D4AF37]">{stats.professionalsCount} ativos</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-[#D4AF37] h-1.5 rounded-full" 
                    style={{ width: `${salonData?.plan === 'founder' ? 35 : (stats.professionalsCount / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5">
                  <span>Capacidade do Plano</span>
                  <span>{maxProfessionalsSeat}</span>
                </div>
              </div>

              <div className="border-t border-zinc-900/50 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Renovação Próxima</span>
                  <span className="text-white font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Benefício Vitalício</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Valor de Mensalidade</span>
                  <span className="text-white font-mono font-semibold">Sem cobrança (Founder)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Core Telemetry and Usage Audits */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-md font-heading font-light text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                Métricas de Armazenamento
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Métricas consolidadas de uso real do Firestore.</CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {loading ? (
                <p className="text-xs text-zinc-500">Carregando telemetria...</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <CalendarDays className="w-4 h-4 text-cyan-400" />
                      <span>Agendamentos Concluídos</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.appointmentsCount}</span>
                  </div>

                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <ListTodo className="w-4 h-4 text-green-400" />
                      <span>Checklists Executados</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.checklistsRunCount}</span>
                  </div>

                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Clientes Cadastrados</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.clientsCount}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* Histórico de Auditoria do Estabelecimento */}
      <Card className="bg-zinc-950 border-zinc-900 overflow-hidden">
        <CardHeader className="border-b border-zinc-900/50 pb-5">
          <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#D4AF37]" />
            Histórico de Alterações e Auditoria (Rastreabilidade)
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Registro cronológico e imutável de ações e alterações críticas realizadas pelos usuários nas coleções do Firestore do salão.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {loadingAudits ? (
            <div className="flex items-center gap-2 text-zinc-500 py-8 text-xs font-mono justify-center">
              <Activity className="w-4 h-4 animate-spin text-purple-400" /> Carregando trilha de auditoria...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-900 rounded-xl">
              <History className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-400">Nenhuma ação crítica registrada</p>
              <p className="text-xs text-zinc-500 mt-1">Os logs de novas alterações aparecerão aqui em tempo real.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-900">
                <span className="text-zinc-400 font-mono">Últimas {auditLogs.length} operações registradas</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">Rastreabilidade Ativa (Imutável)</span>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-full space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.map((log) => {
                    const getActionBadge = (action: string) => {
                      switch (action) {
                        case 'create':
                          return <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-mono font-bold uppercase">CRIAR</span>;
                        case 'update':
                          return <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold uppercase">EDITAR</span>;
                        case 'delete':
                          return <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono font-bold uppercase">APAGAR</span>;
                        case 'status_change':
                          return <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold uppercase">STATUS</span>;
                        case 'report':
                          return <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-mono font-bold uppercase">REPORTAR</span>;
                        default:
                          return <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded font-mono font-bold uppercase">{action}</span>;
                      }
                    };

                    const getRoleText = (role: string) => {
                      switch (role) {
                        case 'owner': return 'Proprietário';
                        case 'manager': return 'Gerente';
                        case 'receptionist': return 'Recepcionista';
                        case 'professional': return 'Colaborador';
                        case 'platform_admin': return 'Super Admin';
                        default: return 'Colaborador';
                      }
                    };

                    const dateStr = new Date(log.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <div 
                        key={log.id} 
                        className="p-3.5 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900/60 rounded-xl transition-all space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 shrink-0">
                            {getActionBadge(log.action)}
                            <span className="text-zinc-500 font-mono text-[10px]">{dateStr}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white font-medium">{log.userName}</span>
                            <span className="text-zinc-650 font-mono text-[10px]">({getRoleText(log.userRole)})</span>
                            <span className="text-zinc-600 font-mono text-[10px]">•</span>
                            <span className="text-zinc-400 font-mono text-[11px]">{log.userEmail}</span>
                          </div>
                        </div>

                        <div className="pl-0 sm:pl-1 mt-1">
                          <p className="text-zinc-300 leading-relaxed font-light">{log.description}</p>
                        </div>
                        
                        {log.details && (
                          <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900/40 text-[10px] font-mono text-zinc-500 max-h-[100px] overflow-y-auto mt-2">
                            <span className="text-zinc-600 block mb-1 font-bold">DETALHES DA OPERAÇÃO (ID: {log.targetId}):</span>
                            <pre className="whitespace-pre-wrap leading-tight text-zinc-405">{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
