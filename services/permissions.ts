import { Role } from '../types';
import { CaseStatus } from '../types';

export type Permission =
  | 'case:read'
  | 'case:create'
  | 'case:update:own'
  | 'case:update:any'
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
    'case:reassign',
    'case:close',
    'agent:read',
    'agent:manage',
  ],
  GERENTE: [
    'case:read',
    'case:update:any',
    'case:reassign',
    'case:close',
    'agent:read',
    'report:view',
  ],
  ADMIN: [
    'case:read',
    'case:update:any',
    'case:delete',
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

export interface Transition {
  estado_origen: string;
  estado_destino: string;
  descripcion_transicion?: string;
  [key: string]: any;
}

const STATE_TO_STATUS: Record<string, CaseStatus> = {
  'Nuevo': CaseStatus.NUEVO,
  'En Proceso': CaseStatus.EN_PROCESO,
  'Pendiente Cliente': CaseStatus.PENDIENTE_CLIENTE,
  'Escalado': CaseStatus.ESCALADO,
  'Resuelto': CaseStatus.RESUELTO,
  'Cerrado': CaseStatus.CERRADO,
};

export function filterTransitionsByPermission(
  role: Role,
  transitions: Transition[],
  userId: string,
  caseAgentId: string,
  userCountry: string,
  caseCountry: string
): Transition[] {
  const canUpdateAny = hasPermission(role, 'case:update:any');
  const canUpdateOwn = hasPermission(role, 'case:update:own');
  const canClose = hasPermission(role, 'case:close');

  return transitions.filter(t => {
    const destino = t.estado_destino as string;
    const isCloseAction = destino === 'Cerrado' || destino === 'Resuelto';

    if (isCloseAction && !canClose) {
      return false;
    }

    if (canUpdateAny) {
      return canAccessCountry(role, userCountry, caseCountry);
    }

    if (canUpdateOwn && userId === caseAgentId) {
      return userCountry === caseCountry;
    }

    return false;
  });
}

export function getAvailableStatusChanges(
  role: Role,
  currentStatus: string,
  transitions: Transition[],
  userId: string,
  caseAgentId: string,
  userCountry: string,
  caseCountry: string
): CaseStatus[] {
  const filtered = filterTransitionsByPermission(
    role,
    transitions,
    userId,
    caseAgentId,
    userCountry,
    caseCountry
  );

  return filtered
    .filter(t => {
      const origenNormalizado = (t.estado_origen || '').toLowerCase().replace(/\s+/g, '');
      const estadoNormalizado = (currentStatus || '').toLowerCase().replace(/\s+/g, '');
      return origenNormalizado === estadoNormalizado;
    })
    .map(t => STATE_TO_STATUS[t.estado_destino])
    .filter(Boolean) as CaseStatus[];
}