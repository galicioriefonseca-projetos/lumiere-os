import { Role } from '../types';

export const ROLES: Role[] = ['owner', 'manager', 'receptionist', 'attendant', 'professional', 'platform_admin'];

export function isPlatformAdmin(role: Role | string | undefined): boolean {
  return role === 'platform_admin';
}

export function isOwner(role: Role | string | undefined): boolean {
  return role === 'owner';
}

export function isManager(role: Role | string | undefined): boolean {
  return role === 'manager';
}

export function isReceptionist(role: Role | string | undefined): boolean {
  return role === 'receptionist';
}

export function isAttendant(role: Role | string | undefined): boolean {
  return role === 'attendant';
}

export function isFrontDesk(role: Role | string | undefined): boolean {
  return role === 'receptionist' || role === 'attendant';
}

export function isProfessional(role: Role | string | undefined): boolean {
  return role === 'professional';
}

export function canManageTeam(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canManageSalonOperations(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canManageChecklist(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canEvaluateTeam(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canManageGoals(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canCreateInvites(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canAccessMaster(role: Role | string | undefined): boolean {
  return role === 'platform_admin';
}

export function canAccessChecklist(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'receptionist' || role === 'attendant';
}

export function canAccessGoals(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canAccessProduction(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'attendant';
}

export function canManageProduction(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'attendant';
}

export function canAccessClients(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageClients(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'receptionist' || role === 'attendant';
}

export function canAccessAgenda(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageAgenda(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageServices(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canAccessServices(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canManageBilling(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'platform_admin';
}

export function canTransferOwnership(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'platform_admin';
}

export function canCreateProductionEntry(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'attendant';
}

export function canViewCommissions(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canManageCommissions(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canEditCommissionRules(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canAccessStrategicReports(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin';
}

export function canAccessOperationalChecklist(role: Role | string | undefined): boolean {
  return canAccessChecklist(role);
}

export function canAccessProfessionalDashboard(role: Role | string | undefined): boolean {
  return role === 'professional';
}

export function canAccessRoute(role: Role | undefined, route: string): boolean {
  if (!role || !ROLES.includes(role)) return false;
  if (isPlatformAdmin(role)) return true;

  const cleanRoute = route.split('?')[0].replace(/\/$/, '');

  if (cleanRoute === '/master') return false;

  if (cleanRoute === '/' || cleanRoute === '/login' || cleanRoute === '/cadastro' || cleanRoute === '/cadastro-profissional') {
    return true;
  }

  if (cleanRoute.startsWith('/onboarding')) {
    return isOwner(role) || isManager(role);
  }

  if (isProfessional(role)) {
    return cleanRoute === '/dashboard' || cleanRoute === '/dashboard/meu-painel' || cleanRoute === '/dashboard/profissional' || cleanRoute === '/dashboard/gamificacao';
  }

  if (cleanRoute === '/dashboard' || cleanRoute === '/dashboard/') {
    return true;
  }

  // Reception and attendants have an intentionally limited operational scope.
  if (isReceptionist(role)) {
    const allowedReceptionistRoutes = [
      '/dashboard',
      '/dashboard/agendamentos',
      '/dashboard/clientes',
      '/dashboard/crm',
      '/dashboard/checklist',
      '/dashboard/gamificacao',
      '/dashboard/minha-conta'
    ];
    return allowedReceptionistRoutes.includes(cleanRoute);
  }

  if (isAttendant(role)) {
    const allowedAttendantRoutes = [
      '/dashboard',
      '/dashboard/agendamentos',
      '/dashboard/clientes',
      '/dashboard/crm',
      '/dashboard/checklist',
      '/dashboard/gamificacao',
      '/dashboard/minha-conta'
    ];
    return allowedAttendantRoutes.includes(cleanRoute);
  }

  // Owner/manager route-specific checks.
  switch (cleanRoute) {
    case '/dashboard/comissoes':
      return canViewCommissions(role);
    case '/dashboard/minha-conta':
      return true;
    case '/dashboard/equipe':
      return canManageTeam(role);
    case '/dashboard/metas':
      return canAccessGoals(role);
    case '/dashboard/checklist':
      return canAccessOperationalChecklist(role);
    case '/dashboard/servicos':
      return canAccessServices(role);
    case '/dashboard/categorias':
      return isOwner(role) || isManager(role);
    case '/dashboard/clientes':
    case '/dashboard/crm':
      return canAccessClients(role);
    case '/dashboard/agendamentos':
      return canAccessAgenda(role);
    case '/dashboard/financeiro':
    case '/dashboard/estoque':
    case '/dashboard/precificacao':
    case '/dashboard/relatorios':
      return isOwner(role) || isManager(role);
    case '/dashboard/assinatura':
    case '/dashboard/dados-faturamento':
      return isOwner(role);
    default:
      return isOwner(role) || isManager(role);
  }
}
