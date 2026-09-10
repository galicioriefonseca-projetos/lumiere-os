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
  Calculator
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
}

export interface NavigationCategory {
  category: string;
  items: NavigationItem[];
}

export const getNavigationByRole = (role: string | undefined): NavigationCategory[] => {
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
          { name: 'Minha Agenda', href: '/dashboard?tab=agenda', icon: CalendarDays },
          { name: 'Meu Desempenho', href: '/dashboard?tab=desempenho', icon: TrendingUp },
          { name: 'Arena & Conquistas', href: '/dashboard/gamificacao', icon: Trophy },
          { name: 'Minhas Avaliações', href: '/dashboard?tab=avaliacoes', icon: Star },
          { name: 'Minhas Metas', href: '/dashboard?tab=metas', icon: Target },
        ]
      }
    ];
  }
  
  if (role === 'attendant' || role === 'receptionist') {
    return [
      {
        category: 'Principal',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        ]
      },
      {
        category: 'Atendimentos & Vendas',
        items: [
          { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
          { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
          { name: 'Registro de Produção', href: '/dashboard/agendamentos', icon: FileText },
        ]
      },
      {
        category: 'Supervisão & Qualidade',
        items: [
          { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
          { name: 'Metas', href: '/dashboard/metas', icon: Target },
          { name: 'Arena de Equipe', href: '/dashboard/gamificacao', icon: Trophy },
        ]
      },
      {
        category: 'Serviços',
        items: [
          { name: 'Serviços do Salão', href: '/dashboard/servicos', icon: Scissors },
          { name: 'Precificação de Serviços', href: '/dashboard/precificacao', icon: Calculator },
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
          { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
          { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
          { name: 'Equipe', href: '/dashboard/equipe', icon: Users },
          { name: 'Serviços / Produtos', href: '/dashboard/servicos', icon: Scissors },
          { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
          { name: 'Metas', href: '/dashboard/metas', icon: Target },
        ]
      },
      {
        category: 'Gestão Financeira & Lojas',
        items: [
          { name: 'Financeiro', href: '/dashboard/financeiro', icon: DollarSign },
          { name: 'Estoque', href: '/dashboard/estoque', icon: Package },
          { name: 'Precificação de Serviços', href: '/dashboard/precificacao', icon: Calculator },
        ]
      }
    ];
  }

  if (role === 'manager') {
    return [
      {
        category: 'Principal',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
          { name: 'Meu Painel', href: '/dashboard/meu-painel', icon: TrendingUp },
        ]
      },
      {
        category: 'Operacional',
        items: [
          { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
          { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
          { name: 'Lançamentos / Produção', href: '/dashboard/agendamentos', icon: FileText },
        ]
      },
      {
        category: 'Gestão Financeira & Lojas',
        items: [
          { name: 'Financeiro', href: '/dashboard/financeiro', icon: DollarSign },
          { name: 'Estoque', href: '/dashboard/estoque', icon: Package },
          { name: 'Minha Assinatura', href: '/dashboard/assinatura', icon: CreditCard },
        ]
      },
      {
        category: 'Supervisão de Equipe',
        items: [
          { name: 'Equipe', href: '/dashboard/equipe', icon: Users },
          { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
          { name: 'Metas', href: '/dashboard/metas', icon: Target },
          { name: 'Arena de Equipe', href: '/dashboard/gamificacao', icon: Trophy },
        ]
      },
      {
        category: 'Serviços & Parcerias',
        items: [
          { name: 'Serviços / Produtos', href: '/dashboard/servicos', icon: Scissors },
          { name: 'Comissões', href: '/dashboard/comissoes', icon: CreditCard },
          { name: 'Precificação de Serviços', href: '/dashboard/precificacao', icon: Calculator },
        ]
      }
    ];
  }

  // Default for Owner
  return [
    {
      category: 'Principal',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      ]
    },
    {
      category: 'Atendimentos & Clientes',
      items: [
        { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
        { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
        { name: 'Lançamentos / Produção', href: '/dashboard/agendamentos', icon: FileText },
      ]
    },
    {
      category: 'Gestão Financeira & Lojas',
      items: [
        { name: 'Financeiro', href: '/dashboard/financeiro', icon: DollarSign },
        { name: 'Estoque', href: '/dashboard/estoque', icon: Package },
        { name: 'Minha Assinatura', href: '/dashboard/assinatura', icon: CreditCard },
      ]
    },
    {
      category: 'Gestão de Equipe',
      items: [
        { name: 'Profissionais', href: '/dashboard/equipe', icon: Users },
        { name: 'Checklist de Qualidade', href: '/dashboard/checklist', icon: CheckSquare },
        { name: 'Definição de Metas', href: '/dashboard/metas', icon: Target },
        { name: 'Arena de Equipe', href: '/dashboard/gamificacao', icon: Trophy },
      ]
    },
    {
      category: 'Serviços & Parcerias',
      items: [
        { name: 'Serviços / Produtos', href: '/dashboard/servicos', icon: Scissors },
        { name: 'Comissões', href: '/dashboard/comissoes', icon: CreditCard },
        { name: 'Precificação de Serviços', href: '/dashboard/precificacao', icon: Calculator },
      ]
    }
  ];
};
