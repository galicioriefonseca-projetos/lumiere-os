import {
  LayoutDashboard,
  Users,
  Scissors,
  CalendarDays,
  Target,
  CheckSquare,
  Settings,
  CreditCard,
  FileText,
  TrendingUp,
  Star,
  Trophy,
  DollarSign,
  Package,
  Calculator,
  Briefcase,
  Layers,
  Video,
  Globe
} from 'lucide-react';
import { detectBusinessSegment, SEGMENTS } from '../../../config/segments';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  moduleId?: string;
}

export interface NavigationCategory {
  category: string;
  items: NavigationItem[];
}

export const getNavigationByRole = (role: string | undefined, salonData?: any, userEmail?: string): NavigationCategory[] => {
  const segment = detectBusinessSegment(salonData);
  const cfg = SEGMENTS[segment] || SEGMENTS.beauty;
  const lex = cfg.lexicon;

  const emailCandidate = String(salonData?.ownerEmail || userEmail || '').toLowerCase();
  const isAgencyAccount = 
    emailCandidate.includes('galicioriefonseca31@gmail.com') ||
    segment === 'agency' || 
    salonData?.segment === 'agency' || 
    salonData?.businessType === 'agency';

  const isModuleEnabled = (modKey: string): boolean => {
    if (modKey === 'clientPortal') {
      return isAgencyAccount;
    }
    if (!salonData) return true;
    if (salonData.enabledModules && typeof salonData.enabledModules[modKey] === 'boolean') {
      return salonData.enabledModules[modKey];
    }
    const def = (cfg.defaultModules as any)?.[modKey];
    return def !== false;
  };

  const serviceIcon = segment === 'beauty' ? Scissors : Briefcase;
  const appointmentsIcon = CalendarDays;

  if (role === 'client') {
    return [
      {
        category: 'Área do Cliente',
        items: [
          { name: 'Meu Portal', href: '/portal', icon: LayoutDashboard, exact: true },
          { name: 'Relatórios', href: '/portal?tab=reports', icon: FileText },
          { name: 'Contratos', href: '/portal?tab=contracts', icon: Briefcase },
        ]
      }
    ];
  }

  if (role === 'professional') {
    return [
      {
        category: 'Principal',
        items: [
          { name: 'Meu Painel', href: '/dashboard', icon: LayoutDashboard, exact: true },
        ]
      },
      {
        category: 'Meu Espaço',
        items: [
          { name: lex.appointments || 'Minha Agenda', href: '/dashboard?tab=agenda', icon: CalendarDays },
          { name: 'Meu Desempenho', href: '/dashboard?tab=desempenho', icon: TrendingUp },
          { name: 'Arena & Conquistas', href: '/dashboard/gamificacao', icon: Trophy },
          { name: 'Minhas Avaliações', href: '/dashboard?tab=avaliacoes', icon: Star },
          { name: 'Minhas Metas', href: '/dashboard?tab=metas', icon: Target },
        ]
      }
    ];
  }

  // Receptionist / Atendimento
  if (role === 'receptionist' || role === 'attendant') {
    return [
      {
        category: 'Principal',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        ]
      },
      {
        category: 'Atendimento & Operação',
        items: [
          { name: lex.appointments, href: '/dashboard/agendamentos', icon: appointmentsIcon },
          { name: lex.clients, href: '/dashboard/clientes', icon: Users },
          { name: 'CRM', href: '/dashboard/crm', icon: Users },
        ]
      },
      {
        category: 'Rotina',
        items: [
          { name: lex.checklists, href: '/dashboard/checklist', icon: CheckSquare },
          { name: 'Arena de Equipe', href: '/dashboard/gamificacao', icon: Trophy },
          { name: 'Minha Conta', href: '/dashboard/minha-conta', icon: Settings },
        ]
      }
    ];
  }

  if (role === 'platform_admin') {
    return [
      {
        category: 'Administração Global',
        items: [
          { name: 'Painel Master', href: '/master', icon: Settings, exact: true },
        ]
      },
      {
        category: 'Geral & Controles',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
          { name: lex.appointments, href: '/dashboard/agendamentos', icon: appointmentsIcon },
          { name: lex.clients, href: '/dashboard/clientes', icon: Users },
          { name: lex.professionals, href: '/dashboard/equipe', icon: Users },
          { name: lex.services, href: '/dashboard/servicos', icon: serviceIcon },
          { name: lex.checklists, href: '/dashboard/checklist', icon: CheckSquare },
          { name: lex.goals, href: '/dashboard/metas', icon: Target },
        ]
      },
      {
        category: 'Gestão Financeira & Operação',
        items: [
          { name: 'Financeiro', href: '/dashboard/financeiro', icon: DollarSign },
          { name: lex.inventory, href: '/dashboard/estoque', icon: Package },
          { name: lex.pricing, href: '/dashboard/precificacao', icon: Calculator },
        ]
      }
    ];
  }

  // Owner & Manager Categories with dynamic lexicon & module filtering
  const operationalItems: NavigationItem[] = [
    { name: lex.appointments, href: '/dashboard/agendamentos', icon: appointmentsIcon, moduleId: 'appointments' },
    { name: lex.clients, href: '/dashboard/clientes', icon: Users, moduleId: 'clients' },
    ...(isAgencyAccount ? [
      { name: 'Área do Cliente (Portal)', href: '/dashboard/area-do-cliente', icon: Globe, moduleId: 'clientPortal' }
    ] : []),
  ].filter(i => !i.moduleId || isModuleEnabled(i.moduleId!));

  const financialItems: NavigationItem[] = [
    { name: 'Financeiro', href: '/dashboard/financeiro', icon: DollarSign, moduleId: 'financial' },
    ...(isModuleEnabled('inventory') ? [{ name: lex.inventory, href: '/dashboard/estoque', icon: Package, moduleId: 'inventory' }] : []),
    { name: 'Minha Assinatura', href: '/dashboard/assinatura', icon: CreditCard },
  ].filter(i => !i.moduleId || isModuleEnabled(i.moduleId));

  const teamItems: NavigationItem[] = [
    { name: lex.professionals, href: '/dashboard/equipe', icon: Users, moduleId: 'team' },
    { name: lex.checklists, href: '/dashboard/checklist', icon: CheckSquare, moduleId: 'checklists' },
    { name: lex.goals, href: '/dashboard/metas', icon: Target, moduleId: 'goals' },
    ...(isModuleEnabled('gamification') ? [{ name: 'Arena de Equipe', href: '/dashboard/gamificacao', icon: Trophy, moduleId: 'gamification' }] : []),
  ].filter(i => !i.moduleId || isModuleEnabled(i.moduleId));

  const servicesItems: NavigationItem[] = [
    { name: lex.services, href: '/dashboard/servicos', icon: serviceIcon, moduleId: 'services' },
    ...(isModuleEnabled('commissions') ? [{ name: lex.commissions, href: '/dashboard/comissoes', icon: CreditCard, moduleId: 'commissions' }] : []),
    ...(isModuleEnabled('pricing') ? [{ name: lex.pricing, href: '/dashboard/precificacao', icon: Calculator, moduleId: 'pricing' }] : []),
  ].filter(i => !i.moduleId || isModuleEnabled(i.moduleId));

  return [
    {
      category: 'Principal',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        ...(role === 'manager' ? [{ name: 'Meu Painel', href: '/dashboard/meu-painel', icon: TrendingUp }] : [])
      ]
    },
    ...(operationalItems.length > 0 ? [{
      category: segment === 'agency' ? 'Projetos & Contas' : 'Atendimentos & Clientes',
      items: operationalItems
    }] : []),
    ...(financialItems.length > 0 ? [{
      category: 'Gestão Financeira & Faturamento',
      items: financialItems
    }] : []),
    ...(teamItems.length > 0 ? [{
      category: segment === 'agency' ? 'Equipe & Entregas' : 'Gestão de Equipe',
      items: teamItems
    }] : []),
    ...(servicesItems.length > 0 ? [{
      category: segment === 'agency' ? 'Serviços & Contratos' : 'Serviços & Parcerias',
      items: servicesItems
    }] : [])
  ];
};
