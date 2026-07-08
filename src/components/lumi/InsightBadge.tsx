import React from 'react';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  Package, 
  Briefcase, 
  HelpCircle,
  TrendingUp,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type InsightCategory = 'agenda' | 'financeiro' | 'equipe' | 'clientes' | 'estoque' | 'operacao' | 'finance' | 'team' | 'clients' | 'occupancy' | 'stock' | 'inventory' | 'operations' | 'goals';

interface InsightBadgeProps {
  category: InsightCategory;
  className?: string;
}

export function InsightBadge({ category, className }: InsightBadgeProps) {
  const normalized = category.toLowerCase();
  
  let label = 'Operação';
  let icon = <Settings className="w-3.5 h-3.5 mr-1" />;
  let color = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

  if (normalized === 'financeiro' || normalized === 'finance') {
    label = 'Financeiro';
    icon = <DollarSign className="w-3.5 h-3.5 mr-1" />;
    color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  } else if (normalized === 'equipe' || normalized === 'team') {
    label = 'Equipe';
    icon = <Briefcase className="w-3.5 h-3.5 mr-1" />;
    color = 'text-violet-400 bg-violet-500/10 border-violet-500/20';
  } else if (normalized === 'clientes' || normalized === 'clients') {
    label = 'Clientes';
    icon = <Users className="w-3.5 h-3.5 mr-1" />;
    color = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
  } else if (normalized === 'agenda' || normalized === 'occupancy') {
    label = 'Agenda';
    icon = <Calendar className="w-3.5 h-3.5 mr-1" />;
    color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  } else if (normalized === 'estoque' || normalized === 'stock' || normalized === 'inventory') {
    label = 'Estoque';
    icon = <Package className="w-3.5 h-3.5 mr-1" />;
    color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  }

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border font-mono uppercase tracking-wider",
      color,
      className
    )}>
      {icon}
      {label}
    </span>
  );
}
