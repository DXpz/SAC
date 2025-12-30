
import React, { useEffect } from 'react';
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
  const user = api.getUser();

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
    if (currentItem) return currentItem.name;
    if (location.pathname.includes('/casos/')) return 'Detalle de Caso';
    return 'Sistema SAC';
  };

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role as Role));
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex" style={{ height: '100vh', overflow: 'hidden' }}>
      <aside 
        className="w-64 text-white flex flex-col fixed h-full z-10" 
        style={{
          backgroundColor: 'rgb(15, 23, 42)',
          overflowY: 'auto',
          borderRight: '1px solid rgba(148, 163, 184, 0.2)'
        }}
      >
        <div 
          className="p-6 border-b flex-shrink-0 flex flex-col items-center" 
          style={{
            borderColor: 'rgba(255, 255, 255, 0.08)',
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
        
        <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
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
                  className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 relative"
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
            backgroundColor: 'rgba(15, 23, 42, 0.3)'
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
              <p className="text-sm font-medium truncate" style={{color: '#ffffff'}}>{user?.name}</p>
              <p className="text-[10px] truncate uppercase font-bold tracking-tighter" style={{color: '#cbd5e1'}}>
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
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

      <main className="flex-1 ml-64" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100vh', padding: '2rem', backgroundColor: 'rgb(15, 23, 42)' }}>
        <header className="flex-shrink-0 mb-6">
          <h2 className="text-2xl font-black" style={{color: '#ffffff'}}>
            {getPageTitle()}
          </h2>
          <p className="text-sm" style={{color: '#94a3b8'}}>INTELFON SAC &bull; Centro de Soporte</p>
        </header>
        <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
