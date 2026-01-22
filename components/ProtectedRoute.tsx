
import React from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * Componente que protege rutas, permitiendo acceso solo a colaboradores autenticados.
 * 
 * - Si no hay usuario autenticado, redirige al login (público)
 * - Si hay roles específicos requeridos y el usuario no tiene uno de esos roles, redirige a /unauthorized
 * - Los assets estáticos en /public son accesibles públicamente sin pasar por este componente
 * - Valida que el usuario tenga token válido (debe estar registrado en n8n)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const user = api.getUser();
  const token = api.getToken();

  // Verificar autenticación: DEBE haber usuario Y token (ambos del webhook de n8n)
  if (!user || !token) {
    // Limpiar datos inválidos
    api.logout();
    return <Navigate to="/login" replace />;
  }

  // Validar que el usuario tenga estructura válida
  if (!user.id || !user.name || !user.role) {
    api.logout();
    return <Navigate to="/login" replace />;
  }

  // Validar que el rol sea válido
  if (!['AGENTE', 'SUPERVISOR', 'GERENTE', 'ADMIN'].includes(user.role)) {
    api.logout();
    return <Navigate to="/login" replace />;
  }

  // Verificar roles específicos si se requieren
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
