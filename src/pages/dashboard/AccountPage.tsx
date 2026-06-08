import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
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
  ListTodo
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';

export default function AccountPage() {
  const { salonData, userData, currentUser } = useAuth();
  
  // Loading counters to show real usage statistics
  const [stats, setStats] = useState({
    professionalsCount: 0,
    servicesCount: 0,
    clientsCount: 0,
    appointmentsCount: 0,
    checklistsRunCount: 0
  });
  const [loading, setLoading] = useState(true);

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
        const qck = query(collection(db, `salons/${salonId}/checklist_runs`));

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
              <CardDescription className="text-xs text-zinc-500">Status atual do seu plano Essenza e limites operacionais.</CardDescription>
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
    </div>
  );
}
