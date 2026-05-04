import { useCallback } from 'react';
import { api } from '../services/api';
import { Role } from '../types';
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isRoleOrHigher,
  canModifyCase,
  canAccessCountry,
  ROLE_HIERARCHY
} from '../services/permissions';

export function usePermissions() {
  const currentUser = api.getUser();

  const checkPermission = useCallback((permission: Permission): boolean => {
    if (!currentUser) return false;
    return hasPermission(currentUser.role, permission);
  }, [currentUser]);

  const checkAnyPermission = useCallback((permissions: Permission[]): boolean => {
    if (!currentUser) return false;
    return hasAnyPermission(currentUser.role, permissions);
  }, [currentUser]);

  const checkAllPermissions = useCallback((permissions: Permission[]): boolean => {
    if (!currentUser) return false;
    return hasAllPermissions(currentUser.role, permissions);
  }, [currentUser]);

  const checkRoleOrHigher = useCallback((minRole: Role): boolean => {
    if (!currentUser) return false;
    return isRoleOrHigher(currentUser.role, minRole);
  }, [currentUser]);

  const checkCanModifyCase = useCallback((caseAgentId: string, caseCountry: string): boolean => {
    if (!currentUser) return false;
    return canModifyCase(
      currentUser.role,
      currentUser.id,
      caseAgentId,
      currentUser.pais || '',
      caseCountry
    );
  }, [currentUser]);

  const checkCanAccessCountry = useCallback((targetCountry: string): boolean => {
    if (!currentUser) return false;
    return canAccessCountry(currentUser.role, currentUser.pais || '', targetCountry);
  }, [currentUser]);

  const checkIsAdmin = useCallback((): boolean => {
    return checkAnyPermission(['user:manage', 'agent:manage', 'case:reassign']);
  }, [checkAnyPermission]);

  const checkIsSupervisorOrHigher = useCallback((): boolean => {
    return checkRoleOrHigher('SUPERVISOR');
  }, [checkRoleOrHigher]);

  const checkCanCloseCase = useCallback((): boolean => {
    return checkPermission('case:close');
  }, [checkPermission]);

  const checkCanReassignCase = useCallback((): boolean => {
    return checkPermission('case:reassign');
  }, [checkPermission]);

  const checkCanDeleteCase = useCallback((): boolean => {
    return checkPermission('case:delete');
  }, [checkPermission]);

  const checkCanManageUsers = useCallback((): boolean => {
    return checkPermission('user:manage');
  }, [checkPermission]);

  const checkCanManageAgents = useCallback((): boolean => {
    return checkPermission('agent:manage');
  }, [checkPermission]);

  const checkCanViewReports = useCallback((): boolean => {
    return checkPermission('report:view');
  }, [checkPermission]);

  return {
    currentUser,
    currentRole: currentUser?.role,
    currentCountry: currentUser?.pais,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    checkRoleOrHigher,
    checkCanModifyCase,
    checkCanAccessCountry,
    checkIsAdmin,
    checkIsSupervisorOrHigher,
    checkCanCloseCase,
    checkCanReassignCase,
    checkCanDeleteCase,
    checkCanManageUsers,
    checkCanManageAgents,
    checkCanViewReports,
    hierarchy: ROLE_HIERARCHY,
  };
}