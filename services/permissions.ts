import { Role } from '../types';

export type Permission =
  | 'case:read'
  | 'case:create'
  | 'case:update:any'
  | 'case:update:own'
  | 'case:delete'
  | 'case:reassign'
  | 'case:close'
  | 'agent:read'
  | 'agent:manage'
  | 'user:manage'
  | 'report:view'
  | 'settings:manage'
  | 'estado:manage';

export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMINISTRADOR: 100,
  ADMIN: 90,
  GERENTE: 70,
  SUPERVISOR: 50,
  AGENTE: 30,
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  AGENTE: [
    'case:read',
    'case:create',
    'case:update:own',
  ],
  SUPERVISOR: [
    'case:read',
    'case:create',
    'case:update:any',
    'case:close',
    'agent:read',
  ],
  GERENTE: [
    'case:read',
    'case:create',
    'case:update:any',
    'case:close',
    'agent:read',
    'report:view',
  ],
  ADMIN: [
    'case:read',
    'case:create',
    'case:update:any',
    'case:delete',
    'case:reassign',
    'case:close',
    'agent:read',
    'agent:manage',
    'user:manage',
    'report:view',
    'estado:manage',
  ],
  ADMINISTRADOR: [
    'case:read',
    'case:create',
    'case:update:any',
    'case:delete',
    'case:reassign',
    'case:close',
    'agent:read',
    'agent:manage',
    'user:manage',
    'report:view',
    'settings:manage',
    'estado:manage',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function isRoleOrHigher(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function canAccessCountry(role: Role, userCountry: string, targetCountry: string): boolean {
  if (hasPermission(role, 'case:update:any')) return true;
  if (role === 'GERENTE' && userCountry === targetCountry) return true;
  if (role === 'SUPERVISOR' && userCountry === targetCountry) return true;
  return false;
}

export function canModifyCase(
  role: Role,
  userId: string,
  caseAgentId: string,
  userCountry: string,
  caseCountry: string
): boolean {
  if (hasPermission(role, 'case:update:any')) {
    return canAccessCountry(role, userCountry, caseCountry);
  }
  if (hasPermission(role, 'case:update:own') && userId === caseAgentId) {
    return userCountry === caseCountry;
  }
  return false;
}