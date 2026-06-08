import { Role } from '../types';

export const ROLES: Role[] = ['owner', 'admin', 'manager', 'receptionist', 'attendant', 'professional', 'platform_admin'];

export function isPlatformAdmin(role: Role | string | undefined): boolean {
  return role === 'platform_admin';
}

export function isOwner(role: Role | string | undefined): boolean {
  return role === 'owner';
}

export function isManager(role: Role | string | undefined): boolean {
  return role === 'manager';
}

export function isAttendant(role: Role | string | undefined): boolean {
  return role === 'attendant' || role === 'receptionist';
}

export function isProfessional(role: Role | string | undefined): boolean {
  return role === 'professional';
}

export function canManageTeam(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canManageSalonOperations(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canManageChecklist(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canEvaluateTeam(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canManageGoals(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canCreateInvites(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canAccessMaster(role: Role | string | undefined): boolean {
  return role === 'platform_admin';
}

export function canAccessChecklist(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canAccessGoals(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canAccessProduction(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageProduction(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canAccessClients(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageClients(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canAccessAgenda(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageAgenda(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canManageServices(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canManageBilling(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'platform_admin';
}

export function canTransferOwnership(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'platform_admin';
}

export function canCreateProductionEntry(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin' || role === 'receptionist' || role === 'attendant';
}

export function canViewCommissions(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canManageCommissions(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canEditCommissionRules(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
}

export function canAccessStrategicReports(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'platform_admin' || role === 'admin';
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

  // Normalise routes
  const cleanRoute = route.split('?')[0].replace(/\/$/, "");

  if (cleanRoute === '/master') {
    return isPlatformAdmin(role);
  }

  // Common public or onboarding routes
  if (cleanRoute === '/' || cleanRoute === '/login' || cleanRoute === '/cadastro' || cleanRoute === '/cadastro-profissional') {
    return true;
  }

  if (cleanRoute.startsWith('/onboarding')) {
    // Only owner, manager and platform_admin can do onboarding of the salon
    return isOwner(role) || isManager(role) || isPlatformAdmin(role);
  }

  // Professional sub-route restrictions
  if (isProfessional(role)) {
    return cleanRoute === '/dashboard' || cleanRoute === '/dashboard/meu-painel' || cleanRoute === '/dashboard/profissional';
  }

  // Dashboard root is accessible to anyone logged in
  if (cleanRoute === '/dashboard' || cleanRoute === '/dashboard/') {
    return true;
  }

  // Attendant/Receptionist restrictions
  if (isAttendant(role)) {
    // Only can access allowed sub-routes
    const allowedAttendantRoutes = [
      '/dashboard',
      '/dashboard/agendamentos',
      '/dashboard/clientes',
      '/dashboard/servicos'
    ];
    return allowedAttendantRoutes.includes(cleanRoute);
  }

  // Professional-specific panel
  if (cleanRoute === '/dashboard/profissional' || cleanRoute === '/dashboard/meu-painel') {
    return true; // We can let professionals and owners/managers enter as needed
  }

  // Route-specific checks
  switch (cleanRoute) {
    case '/dashboard/assinatura':
      return isOwner(role) || isPlatformAdmin(role) || role === 'admin';
    case '/dashboard/comissoes':
      return canViewCommissions(role);
    case '/dashboard/minha-conta':
      return true; // All signed-in roles can see their relevant My Account view
    case '/dashboard/equipe':
      return canManageTeam(role);
    case '/dashboard/metas':
      return canManageGoals(role);
    case '/dashboard/checklist':
      return canAccessOperationalChecklist(role);
    case '/dashboard/servicos':
      // Owner, Manager, Receptionist, Attendant have access (read-only or manage)
      return isOwner(role) || isManager(role) || isAttendant(role);
    case '/dashboard/categorias':
      return isOwner(role) || isManager(role);
    case '/dashboard/clientes':
      return isOwner(role) || isManager(role) || isAttendant(role);
    case '/dashboard/agendamentos':
      return true; // Others see full. All have access.
    default:
      return true;
  }
}
