
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Role } from '../types';
import { LayoutDashboard, Ticket, Users, BarChart3, LogOut, ShieldAlert } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(api.getUser());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Actualizar usuario cuando cambie en localStorage o cuando cambie la ruta
  // Usar useRef para evitar loops infinitos
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const updateUser = () => {
      const currentUser = api.getUser();
      // Solo actualizar si realmente cambió
      const userChanged = !currentUser || !userRef.current || 
        currentUser.id !== userRef.current.id || 
        currentUser.name !== userRef.current.name;
      
      if (userChanged) {
        setUser(currentUser);
        userRef.current = currentUser;
      }
    };

    // Actualizar al montar
    updateUser();

    // Escuchar cambios en localStorage (cuando otro tab o el mismo tab actualiza el usuario)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'intelfon_user') {
        updateUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // También actualizar cuando cambie la ruta (por si el usuario se actualiza en el mismo tab)
    // Aumentar intervalo a 2 segundos para reducir llamadas
    const interval = setInterval(() => {
      const currentUser = api.getUser();
      if (currentUser && (!userRef.current || currentUser.id !== userRef.current.id || currentUser.name !== userRef.current.name)) {
        updateUser();
      }
    }, 2000); // 500ms -> 2000ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Remover 'user' de las dependencias para evitar loops

  // Validar que el usuario tenga token válido (debe estar registrado en n8n o ser cuenta demo)
  useEffect(() => {
    const token = api.getToken();
    
    // Si no hay token, el usuario no está autenticado correctamente
    if (!token) {
      console.warn('Token no encontrado. Redirigiendo al login.');
      api.logout();
      navigate('/login');
      return;
    }
    
    // Validar estructura del usuario
    if (!user || !user.id || !user.name || !user.role) {
      console.warn('Usuario con estructura inválida. Redirigiendo al login.');
      api.logout();
      navigate('/login');
      return;
    }
    
    // Validar rol (permite cuentas demo y cuentas de n8n)
    if (!['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(user.role)) {
      console.warn('Usuario con rol inválido. Redirigiendo al login.');
      api.logout();
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  // Función para obtener el nombre del rol en formato legible
  const getRoleName = (role: Role | undefined): string => {
    if (!role) return 'Usuario';
    const roleNames: Record<Role, string> = {
      'AGENTE': 'Agente',
      'SUPERVISOR': 'Supervisor',
      'GERENTE': 'Gerente'
    };
    return roleNames[role] || role;
  };

  const navItems = [
    { 
        name: 'Bandeja de Casos', 
        path: '/app/agente', 
        icon: Ticket,
        roles: ['AGENTE'] as Role[]
    },
    { 
        name: 'Panel Supervisor', 
        path: '/app/supervisor', 
        icon: LayoutDashboard,
        roles: ['SUPERVISOR'] as Role[]
    },
    { 
        name: 'Bandeja Global', 
        path: '/app/casos', 
        icon: Ticket,
        roles: ['SUPERVISOR'] as Role[]
    },
    { 
        name: 'Gestión de Agentes', 
        path: '/app/agentes', 
        icon: Users,
        roles: ['SUPERVISOR'] as Role[]
    },
    { 
        name: 'Panel Ejecutivo', 
        path: '/app/gerencia', 
        icon: BarChart3,
        roles: ['GERENTE'] as Role[]
    },
    { 
        name: 'Alertas Críticas', 
        path: '/app/alertas', 
        icon: ShieldAlert,
        roles: ['SUPERVISOR', 'GERENTE'] as Role[]
    },
  ];

  const getPageTitle = () => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    
    // Si es la bandeja de casos (/app/casos), mostrar "Bandeja de [nombre de usuario]" para cualquier usuario
    if (location.pathname === '/app/casos' && user?.name) {
      return `Bandeja de ${user.name}`;
    }
    
    if (currentItem) {
      // Si es la ruta /app/agente y el usuario es agente, mostrar nombre del agente
      if (location.pathname === '/app/agente' && user?.role === 'AGENTE' && user?.name) {
        return `Bandeja de ${user.name}`;
      }
      // Si es el panel supervisor y el usuario es supervisor, mostrar nombre del supervisor
      if (currentItem.path === '/app/supervisor' && user?.role === 'SUPERVISOR' && user?.name) {
        return `Panel Supervisor de ${user.name}`;
      }
      // Si es el panel ejecutivo y el usuario es gerente, mostrar nombre del gerente
      if (currentItem.path === '/app/gerencia' && user?.role === 'GERENTE' && user?.name) {
        return `Panel Ejecutivo de ${user.name}`;
      }
      return currentItem.name;
    }
    // Si es la ruta /app/agente y el usuario es agente, mostrar nombre del agente
    if (location.pathname === '/app/agente' && user?.role === 'AGENTE' && user?.name) {
      return `Bandeja de ${user.name}`;
    }
    // Si es la ruta /app/supervisor y el usuario es supervisor, mostrar nombre del supervisor
    if (location.pathname === '/app/supervisor' && user?.role === 'SUPERVISOR' && user?.name) {
      return `Panel Supervisor de ${user.name}`;
    }
    // Si es la ruta /app/gerencia y el usuario es gerente, mostrar nombre del gerente
    if (location.pathname === '/app/gerencia' && user?.role === 'GERENTE' && user?.name) {
      return `Panel Ejecutivo de ${user.name}`;
    }
    if (location.pathname.includes('/casos/nuevo')) return 'Nuevo Caso';
    if (location.pathname.includes('/casos/')) return 'Detalle de Caso';
    if (location.pathname === '/app/crear-cuenta') return 'Crear nueva cuenta';
    return 'Sistema SAC';
  };

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role as Role));
  const isActive = (path: string) => location.pathname === path;

  // Función para mostrar el sidebar
  const showSidebar = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setSidebarVisible(true);
  };

  // Función para ocultar el sidebar con delay
  const hideSidebar = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setSidebarVisible(false);
      hideTimeoutRef.current = null;
    }, 1500); // 1.5 segundos de delay
  };

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex relative" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Área de detección de hover en el borde izquierdo */}
      <div
        className="fixed left-0 top-0 h-full z-20"
        style={{
          width: '20px',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={showSidebar}
        onMouseLeave={hideSidebar}
      />

      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className="text-white flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out"
        style={{
          width: sidebarVisible ? '256px' : '0px',
          backgroundColor: 'rgb(15, 23, 42)',
          overflowY: sidebarVisible ? 'auto' : 'hidden',
          overflowX: 'hidden',
          borderRight: sidebarVisible ? '1px solid rgba(148, 163, 184, 0.2)' : 'none',
          opacity: sidebarVisible ? 1 : 0,
          pointerEvents: sidebarVisible ? 'auto' : 'none'
        }}
        onMouseEnter={showSidebar}
        onMouseLeave={hideSidebar}
      >
        <div 
          className="p-6 border-b flex-shrink-0 flex flex-col items-center" 
          style={{
            borderColor: 'rgba(255, 255, 255, 0.08)',
            minWidth: '256px',
            opacity: sidebarVisible ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        >
          <img 
            src="https://static.wixstatic.com/media/98a19d_504d5e7478054d2484448813ac235267~mv2.png/v1/fill/w_192,h_176,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/red256.png"
            alt="INTELFON Logo"
            className="w-16 h-16 object-contain"
            style={{
              filter: 'drop-shadow(0 4px 12px rgba(200, 21, 27, 0.3))',
            }}
          />
          <p className="text-xs text-slate-300 mt-2 uppercase tracking-widest font-semibold">Gestión de Casos</p>
        </div>
        
        <nav 
          className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto"
          style={{
            minWidth: '256px',
            opacity: sidebarVisible ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        >
          {filteredNavItems.map((item, index) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            const prevItem = index > 0 ? filteredNavItems[index - 1] : null;
            const showSeparator = prevItem && 
              (prevItem.roles.length !== item.roles.length || 
               !prevItem.roles.some(r => item.roles.includes(r)));
            
            return (
              <React.Fragment key={item.name}>
                {showSeparator && (
                  <div className="my-3 h-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.12)'}} />
                )}
                <button
                  onClick={() => navigate(item.path)}
                  className="flex items-center w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 relative"
                  style={active ? {
                    background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
                    color: '#ffffff',
                    borderLeft: '3px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 4px 12px rgba(200, 21, 27, 0.3)',
                  } : {
                    color: '#cbd5e1',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
                      e.currentTarget.style.color = '#94a3b8';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = '#94a3b8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#cbd5e1';
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) icon.style.color = '#64748b';
                    }
                  }}
                >
                  <Icon 
                    className="w-5 h-5 mr-3 transition-colors duration-200" 
                    style={{
                      color: active ? '#ffffff' : '#64748b'
                    }}
                  />
                  {item.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div 
          className="p-4 border-t flex-shrink-0 transition-colors duration-200" 
          style={{
            borderColor: 'rgba(148, 163, 184, 0.15)',
            backgroundColor: 'rgba(15, 23, 42, 0.3)',
            minWidth: '256px',
            opacity: sidebarVisible ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
          }}
        >
          <div 
            className="flex items-center mb-4 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-default"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
              const img = e.currentTarget.querySelector('img');
              if (img) {
                img.style.borderColor = 'rgba(148, 163, 184, 0.6)';
                img.style.boxShadow = '0 2px 12px rgba(148, 163, 184, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              const img = e.currentTarget.querySelector('img');
              if (img) {
                img.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                img.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
              }
            }}
          >
            <img 
              src={user?.avatar} 
              alt={user?.name} 
              className="w-10 h-10 rounded-full transition-all duration-200"
              style={{
                border: '2px solid rgba(148, 163, 184, 0.4)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
              }}
            />
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium truncate" style={{color: '#ffffff'}}>{user?.name}</p>
              <p className="text-[9px] truncate uppercase font-bold tracking-tighter" style={{color: '#cbd5e1'}}>
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200"
            style={{
              color: '#94a3b8',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(200, 21, 27, 0.15)';
              e.currentTarget.style.color = '#f87171';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#f87171';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#94a3b8';
            }}
          >
            <LogOut className="w-5 h-5 mr-3 transition-colors duration-200" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main 
        className="flex-1 transition-all duration-300 ease-in-out" 
        style={{ 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh', 
          padding: '1.5rem', 
          backgroundColor: '#ffffff',
          marginLeft: sidebarVisible ? '256px' : '0px'
        }}
      >
        <header className="flex-shrink-0 mb-6 p-4 -mx-6 -mt-6 relative" style={{backgroundColor: 'rgb(15, 23, 42)'}}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black" style={{color: '#ffffff'}}>
                {getPageTitle()}
              </h2>
              <p className="text-xs" style={{color: '#94a3b8'}}>{getRoleName(user?.role)}</p>
            </div>
            {(() => {
              // Buscar la última actualización de cualquier vista
              const bandejaUpdate = localStorage.getItem('bandeja_last_update');
              const gestionAgentesUpdate = localStorage.getItem('gestion_agentes_last_update');
              
              // Obtener la más reciente
              let lastUpdateStr = null;
              if (bandejaUpdate && gestionAgentesUpdate) {
                const bandejaDate = new Date(bandejaUpdate);
                const gestionDate = new Date(gestionAgentesUpdate);
                lastUpdateStr = bandejaDate > gestionDate ? bandejaUpdate : gestionAgentesUpdate;
              } else if (bandejaUpdate) {
                lastUpdateStr = bandejaUpdate;
              } else if (gestionAgentesUpdate) {
                lastUpdateStr = gestionAgentesUpdate;
              }
              
              if (lastUpdateStr) {
                const lastUpdate = new Date(lastUpdateStr);
                return (
                  <div className="text-xs absolute bottom-2 right-4" style={{color: '#64748b'}}>
                    Última actualización: {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </header>
        <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
