
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyCode from './pages/VerifyCode';
import ResetPassword from './pages/ResetPassword';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import BandejaCasos from './pages/BandejaCasos';
import CaseDetail from './pages/CaseDetail';
import NuevoCaso from './pages/NuevoCaso';
import Unauthorized from './pages/Unauthorized';
import GerenteDashboard from './pages/GerenteDashboard';
import SupervisorPanel from './pages/SupervisorPanel';
import AlertasCriticas from './pages/AlertasCriticas';
import GestionAgentes from './pages/GestionAgentes';
import AdminUsers from './pages/AdminUsers';
import { UserRole } from './types';
import { api } from './services/api';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  // Manejador global de errores no capturados (para evitar errores de extensiones del navegador)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Ignorar errores de extensiones del navegador
      const errorMessage = event.reason?.message || event.reason?.toString() || '';
      if (errorMessage.includes('message channel') || errorMessage.includes('listener')) {
        console.warn('⚠️ Error de extensión del navegador ignorado:', event.reason);
        event.preventDefault();
        return;
      }
      console.error('❌ Error no manejado en promesa:', event.reason);
    };

    const handleError = (event: ErrorEvent) => {
      // Ignorar errores de extensiones del navegador
      const errorMessage = event.message || event.error?.message || '';
      if (errorMessage.includes('message channel') || errorMessage.includes('listener')) {
        console.warn('⚠️ Error de extensión del navegador ignorado:', event.error);
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Validar al cargar la aplicación que el usuario tenga token válido
  // Si hay usuario sin token, limpiar datos (no está registrado en n8n o no es cuenta demo)
  useEffect(() => {
    const user = api.getUser();
    const token = api.getToken();
    
    // Si hay usuario pero NO hay token, limpiar (no está registrado en n8n ni es cuenta demo)
    if (user && !token) {
      console.warn('Usuario sin token detectado. Limpiando datos inválidos.');
      api.logout();
    }
    
    // Si hay token pero NO hay usuario, limpiar
    if (token && !user) {
      console.warn('Token sin usuario detectado. Limpiando datos inválidos.');
      api.logout();
    }
    
    // Si hay ambos, validar estructura (permite cuentas demo y cuentas de n8n)
    if (user && token) {
      if (!user.id || !user.name || !user.role) {
        console.warn('Usuario con estructura inválida. Limpiando datos.');
        api.logout();
      } else if (!['AGENTE', 'SUPERVISOR', 'GERENTE', 'ADMIN'].includes(user.role)) {
        console.warn('Usuario con rol inválido. Limpiando datos.');
        api.logout();
      }
    }
  }, []);

  return (
    <ThemeProvider>
    <HashRouter>
      <Routes>
        {/* 
          RUTAS PÚBLICAS
          - Login: Acceso público sin autenticación
          - Assets estáticos: Servidos desde /public (manejados por Vite automáticamente)
          - Rutas de recuperación de contraseña: Públicas
        */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* 
          RUTAS PROTEGIDAS - Solo acceso para colaboradores autenticados
          Todas las rutas bajo /app/* requieren autenticación válida
          Los assets en /public son accesibles públicamente sin autenticación
        */}
        <Route path="/app/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                {/* Vistas Principales por Rol */}
                <Route path="agente" element={<BandejaCasos />} />
                <Route path="supervisor" element={<SupervisorPanel />} />
                <Route path="gerencia" element={<GerenteDashboard />} />
                
                {/* Casos */}
                <Route path="casos" element={<BandejaCasos />} />
                <Route path="casos/nuevo" element={<NuevoCaso />} />
                <Route path="casos/:id" element={<CaseDetail />} />

                {/* Supervisor & Gerencia */}
                <Route path="alertas" element={
                  <ProtectedRoute allowedRoles={[UserRole.SUPERVISOR, UserRole.GERENTE]}>
                    <AlertasCriticas />
                  </ProtectedRoute>
                } />
                <Route path="agentes" element={
                  <ProtectedRoute allowedRoles={[UserRole.SUPERVISOR]}>
                    <GestionAgentes />
                  </ProtectedRoute>
                } />
                
                {/* Administración de Usuarios - Solo para ADMIN (Demo) */}
                <Route path="admin/usuarios" element={
                  <AdminUsers />
                } />
                
                {/* Crear nueva cuenta - Solo para supervisores */}
                <Route path="crear-cuenta" element={
                  <ProtectedRoute allowedRoles={[UserRole.SUPERVISOR]}>
                    <Register />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<Navigate to="casos" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
    </ThemeProvider>
  );
};

export default App;
