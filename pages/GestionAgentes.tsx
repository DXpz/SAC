import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Agente } from '../types';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Sun, 
  RefreshCw, 
  UserPlus, 
  Trash2, 
  X, 
  AlertTriangle,
  Briefcase,
  RotateCcw,
  Activity,
  CheckCircle2,
  TrendingUp,
  Clock,
  Search,
  Download
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';
import Toast, { ToastType } from '../components/Toast';

type EstadoFilter = 'todos' | 'activos' | 'vacaciones' | 'inactivos';

const GestionAgentes: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agenteToDelete, setAgenteToDelete] = useState<Agente | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Estados para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos');


  useEffect(() => {
    // Solo cargar agentes al montar el componente
    // No limpiar caché automáticamente para evitar recargas innecesarias
    loadAgentes();
    
    const handleAgenteCreado = () => {
      // Limpiar caché de agentes y recargar
      console.log('[GestionAgentes] Evento agente-creado recibido, limpiando caché y recargando...');
      localStorage.removeItem('intelfon_agents');
      // Forzar recarga inmediata con un pequeño delay para asegurar que el webhook haya procesado el nuevo agente
      setTimeout(() => {
        console.log('[GestionAgentes] Recargando agentes después de crear nuevo agente...');
        loadAgentes();
      }, 1000); // Delay de 1 segundo para asegurar que el webhook haya procesado el nuevo agente
    };
    
    const handleCasoReasignado = () => {
      // Cuando se reasigna un caso, recargar agentes para actualizar casosActivos
      localStorage.removeItem('intelfon_agents');
      loadAgentes();
    };
    
    window.addEventListener('agente-creado', handleAgenteCreado);
    window.addEventListener('caso-reasignado', handleCasoReasignado);
    
    return () => {
      window.removeEventListener('agente-creado', handleAgenteCreado);
      window.removeEventListener('caso-reasignado', handleCasoReasignado);
    };
  }, []);


  // Función helper para obtener y normalizar el país del supervisor
  const getSupervisorCountry = async (): Promise<'SV' | 'GT' | null> => {
    try {
      // Primero intentar desde api.getUser() que puede tener datos más actualizados
      const currentUser = api.getUser();
      let pais = currentUser?.pais || '';
      
      // Si el país es string vacío, tratarlo como undefined
      if (pais && String(pais).trim() !== '') {
        const paisNormalizado = String(pais).trim().toUpperCase();
        
        if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
          console.log('[GestionAgentes] ✅ País del supervisor desde api.getUser(): SV');
          return 'SV';
        }
        if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
          console.log('[GestionAgentes] ✅ País del supervisor desde api.getUser(): GT');
          return 'GT';
        }
      }
      
      // Fallback: leer desde localStorage directamente
      const userStr = localStorage.getItem('intelfon_user');
      if (!userStr) {
        console.error('[GestionAgentes] No se encontró usuario en localStorage');
        return null;
      }
      
      const user = JSON.parse(userStr);
      pais = user.pais || user.country || '';
      
      console.log('[GestionAgentes] Usuario desde localStorage:', {
        id: user.id,
        name: user.name,
        role: user.role,
        pais: pais,
        country: user.country,
        userObject: user
      });
      
      // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
      if (!pais || String(pais).trim() === '') {
        console.log('[GestionAgentes] 🔍 País no encontrado en localStorage, buscando en lista de usuarios...');
        try {
          const usuarios = await api.getUsuarios();
          const usuarioCompleto = usuarios.find((u: any) => 
            u.id === user.id || 
            u.idAgente === user.id || 
            u.id_agente === user.id ||
            u.id_usuario === user.id ||
            u.email === user.email ||
            (u.nombre && u.nombre.toUpperCase() === user.name.toUpperCase())
          );
          
          if (usuarioCompleto) {
            pais = usuarioCompleto.pais || usuarioCompleto.country || usuarioCompleto.país || '';
            console.log('[GestionAgentes] ✅ País encontrado en lista de usuarios:', {
              usuarioId: usuarioCompleto.id || usuarioCompleto.idAgente,
              usuarioNombre: usuarioCompleto.nombre || usuarioCompleto.name,
              pais: pais,
              usuarioCompleto: usuarioCompleto
            });
            
            // Si encontramos el país, actualizar el usuario en localStorage
            if (pais && String(pais).trim() !== '') {
              const updatedUser = { ...user, pais: pais };
              localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
              console.log('[GestionAgentes] ✅ País actualizado en localStorage');
            }
          } else {
            console.warn('[GestionAgentes] ⚠️ Usuario no encontrado en lista de usuarios');
          }
        } catch (error) {
          console.error('[GestionAgentes] Error obteniendo lista de usuarios:', error);
        }
      }
      
      // Validar que el país no sea string vacío
      if (!pais || String(pais).trim() === '') {
        console.error('[GestionAgentes] ⚠️ Usuario NO tiene país definido!', user);
        return null;
      }
      
      // Normalizar a códigos de 2 letras
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      // El Salvador: SV, El_Salvador, El Salvador, etc.
      if (paisNormalizado === 'SV' || 
          paisNormalizado === 'EL_SALVADOR' || 
          paisNormalizado === 'EL SALVADOR' ||
          paisNormalizado.includes('SALVADOR')) {
        console.log('[GestionAgentes] ✅ País normalizado: SV');
        return 'SV';
      }
      
      // Guatemala: GT, Guatemala, etc.
      if (paisNormalizado === 'GT' || 
          paisNormalizado === 'GUATEMALA' ||
          paisNormalizado.includes('GUATEMALA')) {
        console.log('[GestionAgentes] ✅ País normalizado: GT');
        return 'GT';
      }
      
      console.error('[GestionAgentes] ⚠️ País no reconocido:', paisNormalizado);
      return null;
    } catch (error) {
      console.error('[GestionAgentes] ❌ Error obteniendo país del supervisor:', error);
      return null;
    }
  };

  // Función helper para normalizar el país de un agente
  const normalizeAgentCountry = (pais: string | undefined): 'SV' | 'GT' | null => {
    // Si no hay país o es string vacío, retornar null
    if (!pais || String(pais).trim() === '') {
      return null;
    }
    
    const paisNormalizado = String(pais).trim().toUpperCase();
    
    // El Salvador
    if (paisNormalizado === 'SV' || 
        paisNormalizado === 'EL_SALVADOR' || 
        paisNormalizado === 'EL SALVADOR' ||
        paisNormalizado.includes('SALVADOR')) {
      return 'SV';
    }
    
    // Guatemala
    if (paisNormalizado === 'GT' || 
        paisNormalizado === 'GUATEMALA' ||
        paisNormalizado.includes('GUATEMALA')) {
      return 'GT';
    }
    
    return null;
  };

  const loadAgentes = async () => {
    setLoading(true);
    const data = await api.getAgentes();
    
    console.log('[GestionAgentes] Agentes cargados del API:', data.length, data);
    
    // Obtener usuario actual para verificar si es supervisor
    const currentUser = api.getUser();
    const isSupervisor = currentUser?.role === 'SUPERVISOR';
    
    console.log('[GestionAgentes] Usuario actual:', {
      id: currentUser?.id,
      name: currentUser?.name,
      role: currentUser?.role,
      pais: currentUser?.pais,
      isSupervisor: isSupervisor,
      userObject: currentUser
    });
    
    let agentesFiltrados = [...data];
    
    // Si es supervisor, SIEMPRE filtrar por país (obligatorio)
    if (isSupervisor) {
      const supervisorCountry = await getSupervisorCountry();
      
      console.log('[GestionAgentes] Supervisor detectado, país del supervisor:', supervisorCountry);
      
      if (supervisorCountry) {
        console.log('[GestionAgentes] Filtrando agentes por país:', supervisorCountry);
        
        // Filtrar agentes ANTES de ordenar
        agentesFiltrados = data.filter(agente => {
          // Obtener el país del agente desde diferentes fuentes posibles
          const agentePais = agente.pais || (agente as any).country || '';
          
          console.log('[GestionAgentes] 🔍 Verificando agente:', {
            agenteId: agente.idAgente,
            agenteNombre: agente.nombre,
            agentePaisRaw: agentePais,
            agenteCompleto: agente
          });
          
          const agentePaisNormalizado = normalizeAgentCountry(agentePais);
          
          console.log('[GestionAgentes] 🔍 País normalizado del agente:', {
            agenteId: agente.idAgente,
            agenteNombre: agente.nombre,
            agentePaisRaw: agentePais,
            agentePaisNormalizado: agentePaisNormalizado,
            supervisorCountry: supervisorCountry
          });
          
          // Si el agente no tiene país definido, NO mostrarlo al supervisor
          if (!agentePaisNormalizado) {
            console.log('[GestionAgentes] ❌ Agente SIN país definido, FILTRANDO:', {
              agenteId: agente.idAgente,
              agenteNombre: agente.nombre,
              agentePais: agentePais,
              agentePaisNormalizado: agentePaisNormalizado
            });
            return false;
          }
          
          // Solo mostrar agentes del mismo país que el supervisor
          const matches = agentePaisNormalizado === supervisorCountry;
          
          if (!matches) {
            console.log('[GestionAgentes] ❌ Agente filtrado por país (NO coincide):', {
              agenteId: agente.idAgente,
              agenteNombre: agente.nombre,
              agentePais: agentePais,
              agentePaisNormalizado: agentePaisNormalizado,
              supervisorCountry: supervisorCountry,
              matches: false
            });
            return false; // EXPLÍCITAMENTE retornar false
          }
          
          console.log('[GestionAgentes] ✅ Agente ACEPTADO (país coincide):', {
            agenteId: agente.idAgente,
            agenteNombre: agente.nombre,
            agentePais: agentePais,
            agentePaisNormalizado: agentePaisNormalizado,
            supervisorCountry: supervisorCountry,
            matches: true
          });
          
          return true; // EXPLÍCITAMENTE retornar true
        });
        
        console.log('[GestionAgentes] 📊 RESUMEN - Agentes después de filtrar por país:', {
          totalAntes: data.length,
          totalDespues: agentesFiltrados.length,
          supervisorCountry: supervisorCountry,
          agentesFiltrados: agentesFiltrados.map(a => ({ 
            id: a.idAgente, 
            nombre: a.nombre, 
            pais: a.pais || (a as any).country || 'SIN PAÍS' 
          }))
        });
      } else {
        console.error('[GestionAgentes] ⚠️ ERROR: Supervisor sin país definido!', {
          user: currentUser,
          userPais: currentUser?.pais
        });
        // Si el supervisor no tiene país, NO mostrar ningún agente (más seguro)
        agentesFiltrados = [];
      }
    } else {
      console.log('[GestionAgentes] Usuario NO es supervisor, mostrando todos los agentes');
    }
    
    // Ordenar agentes por ordenRoundRobin (1, 2, 3...) para mostrar el orden del round robin
    // Los agentes activos con orden 1, 2, 3... primero, luego los inactivos/vacaciones
    const sortedAgentes = [...agentesFiltrados].sort((a, b) => {
      // Agentes activos primero
      if (a.estado === 'Activo' && b.estado !== 'Activo') return -1;
      if (a.estado !== 'Activo' && b.estado === 'Activo') return 1;
      
      // Si ambos son activos, ordenar por ordenRoundRobin
      if (a.estado === 'Activo' && b.estado === 'Activo') {
        return (a.ordenRoundRobin || 999) - (b.ordenRoundRobin || 999);
      }
      
      // Si ambos no son activos, mantener orden original
      return 0;
    });
    setAgentes(sortedAgentes);
    const updateTime = new Date();
    // Guardar en localStorage para que Layout pueda mostrarlo
    localStorage.setItem('gestion_agentes_last_update', updateTime.toISOString());
    setLoading(false);
  };

  const toggleEstado = async (id: string, actual: string) => {
    try {
      // Si está activo, desactivar. Si está inactivo o en vacaciones, activar
      const activo = actual !== 'Activo';
      await api.updateAgente(id, { 
        estado: activo ? 'Activo' : 'Inactivo',
        activo: activo,
        vacaciones: false
      });
      await loadAgentes();
    } catch (error: any) {
      alert(error.message || 'Error al cambiar el estado del agente');
    }
  };

  const setVacaciones = async (id: string) => {
    try {
      await api.updateAgente(id, { 
        estado: 'Vacaciones',
        activo: true,
        vacaciones: true
      });
      await loadAgentes();
    } catch (error: any) {
      alert(error.message || 'Error al marcar el agente en vacaciones');
    }
  };

  const handleDeleteClick = (agente: Agente) => {
    setAgenteToDelete(agente);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agenteToDelete) return;
    
    // TODO: Implementar deleteAgente en api.ts
    // const success = await api.deleteAgente(agenteToDelete.idAgente);
    // Por ahora, solo removemos del estado local
    setAgentes(agentes.filter(a => a.idAgente !== agenteToDelete.idAgente));
    setShowDeleteModal(false);
    setAgenteToDelete(null);
    // loadAgentes();
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setAgenteToDelete(null);
  };


  const getEstadoRingColor = (estado: string) => {
    switch (estado) {
      case 'Activo':
        return 'rgba(34, 197, 94, 0.5)';
      case 'Vacaciones':
        return 'rgba(245, 158, 11, 0.5)';
      case 'Inactivo':
        return 'rgba(239, 68, 68, 0.5)';
      default:
        return 'rgba(148, 163, 184, 0.5)';
    }
  };

  const getEstadoBadge = (estado: string) => {
    const styles = {
      'Activo': {
        bg: 'rgba(34, 197, 94, 0.15)',
        text: '#22c55e',
        border: 'rgba(34, 197, 94, 0.3)'
      },
      'Vacaciones': {
        bg: 'rgba(245, 158, 11, 0.15)',
        text: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.3)'
      },
      'Inactivo': {
        bg: 'rgba(239, 68, 68, 0.15)',
        text: '#ef4444',
        border: 'rgba(239, 68, 68, 0.3)'
      }
    };
    return styles[estado as keyof typeof styles] || styles.Inactivo;
  };

  const getEstadoOperativo = (agente: Agente) => {
    if (agente.estado !== 'Activo') return null;
    
    if (agente.casosActivos === 0) {
      return { texto: 'Sin casos', color: '#94a3b8', icon: CheckCircle2 };
    } else if (agente.casosActivos >= 5) {
      return { texto: 'Carga alta', color: '#f59e0b', icon: AlertTriangle };
    } else {
      return { texto: 'Disponible', color: '#22c55e', icon: Activity };
    }
  };

  const getCargaWorkloadColor = (casosActivos: number) => {
    if (casosActivos === 0) return '#22c55e';
    if (casosActivos >= 5) return '#ef4444';
    if (casosActivos >= 3) return '#f59e0b';
    return '#22c55e';
  };

  const getCargaWorkloadPercent = (casosActivos: number) => {
    const max = 8;
    return Math.min(100, (casosActivos / max) * 100);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'hace 1 día';
    return `hace ${diffDays} días`;
  };

  const getCasosHoy = (agente: Agente) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ultimoCaso = new Date(agente.ultimoCasoAsignado || new Date());
    return ultimoCaso >= hoy ? 1 : 0;
  };

  const handleExportCsv = () => {
    if (!filteredAgentes.length) {
      setToast({ message: 'No hay agentes para exportar con los filtros actuales', type: 'warning' });
      return;
    }

    const headers = ['Nombre', 'Email', 'Pais', 'Estado', 'CasosActivos', 'OrdenRoundRobin'];
    const rows = filteredAgentes.map(agente => {
      const pais = agente.pais || '';
      const estado = agente.estado || '';
      const casosActivos = typeof agente.casosActivos === 'number' ? agente.casosActivos : 0;
      const orden = typeof agente.ordenRoundRobin === 'number' ? agente.ordenRoundRobin : '';

      return [
        agente.nombre || '',
        agente.email || '',
        pais,
        estado,
        String(casosActivos),
        String(orden),
      ];
    });

    const escapeCsv = (value: string) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agentes_filtrados.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calcular resumen de agentes
  const resumenAgentes = {
    total: agentes.length,
    activos: agentes.filter(a => a.estado === 'Activo').length,
    vacaciones: agentes.filter(a => a.estado === 'Vacaciones').length,
    inactivos: agentes.filter(a => a.estado === 'Inactivo').length
  };

  // Filtrar agentes por término de búsqueda + estado
  const filteredAgentes = React.useMemo(() => {
    let resultado = agentes;

    if (estadoFilter !== 'todos') {
      resultado = resultado.filter(a => {
        if (estadoFilter === 'activos') return a.estado === 'Activo';
        if (estadoFilter === 'vacaciones') return a.estado === 'Vacaciones';
        if (estadoFilter === 'inactivos') return a.estado === 'Inactivo';
        return true;
      });
    }

    if (!searchTerm.trim()) {
      return resultado;
    }

    const term = searchTerm.toLowerCase().trim();
    return resultado.filter(agente => 
      agente.nombre.toLowerCase().includes(term)
    );
  }, [agentes, searchTerm, estadoFilter]);

  // Generar sugerencias de autocompletado
  const suggestions = React.useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 1) {
      return [];
    }
    const term = searchTerm.toLowerCase().trim();
    return agentes
      .filter(agente => 
        agente.nombre.toLowerCase().includes(term) &&
        agente.nombre.toLowerCase() !== term
      )
      .slice(0, 5) // Máximo 5 sugerencias
      .map(agente => agente.nombre);
  }, [agentes, searchTerm]);

  // Manejar selección de sugerencia
  const handleSelectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setFocusedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  // Manejar teclado en sugerencias
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[focusedSuggestionIndex]);
      } else if (suggestions.length === 1) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setFocusedSuggestionIndex(-1);
      searchInputRef.current?.blur();
    }
  };

  // Scroll a sugerencia enfocada
  useEffect(() => {
    if (focusedSuggestionIndex >= 0 && suggestionsRef.current) {
      const focusedElement = suggestionsRef.current.children[focusedSuggestionIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedSuggestionIndex]);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setFocusedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estilos dinámicos basados en el tema
  const styles = {
    container: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
      minHeight: '100vh'
    },
    card: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  if (loading && agentes.length === 0) {
    return <LoadingScreen message="Cargando Gestión de Agentes..." />;
  }

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', gap: '1rem', ...styles.container }}>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
      <div className="p-4 rounded-xl border flex-shrink-0 flex flex-col gap-3" style={{
        backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
        color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
      }}>
         <div className="flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#22c55e'}}></div>
             <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
               {resumenAgentes.activos} <span style={{color: styles.text.tertiary}}>Activos</span>
             </span>
           </div>
           {resumenAgentes.vacaciones > 0 && (
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#f59e0b'}}></div>
               <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                 {resumenAgentes.vacaciones} <span style={{color: styles.text.tertiary}}>Vacaciones</span>
               </span>
             </div>
           )}
           {resumenAgentes.inactivos > 0 && (
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#991b1b'}}></div>
               <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                 {resumenAgentes.inactivos} <span style={{color: styles.text.tertiary}}>Inactivos</span>
               </span>
             </div>
           )}
           </div>
         </div>
         <div className="flex items-center justify-between gap-3">
           {/* Campo de búsqueda */}
           <div className="relative" style={{ minWidth: '250px' }}>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color: styles.text.tertiary}} />
               <input
                 ref={searchInputRef}
                 type="text"
                 value={searchTerm}
                 onChange={(e) => {
                   setSearchTerm(e.target.value);
                   setShowSuggestions(true);
                   setFocusedSuggestionIndex(-1);
                 }}
                 onFocus={() => {
                   if (suggestions.length > 0) {
                     setShowSuggestions(true);
                   }
                 }}
                 onKeyDown={handleKeyDown}
                 placeholder="Buscar agente por nombre..."
                 className="w-full pl-10 pr-10 py-2 text-xs rounded-lg border transition-all focus:outline-none"
                 style={{
                   backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                   borderColor: showSuggestions ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.3)',
                   color: styles.text.primary
                 }}
               />
               {searchTerm && (
                 <button
                   onClick={() => {
                     setSearchTerm('');
                     setShowSuggestions(false);
                     setFocusedSuggestionIndex(-1);
                     searchInputRef.current?.focus();
                   }}
                   className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-opacity-20 transition-colors"
                   style={{color: styles.text.tertiary}}
                 >
                   <X className="w-3 h-3" />
                 </button>
               )}
             </div>
             
             {/* Lista de sugerencias */}
             {showSuggestions && suggestions.length > 0 && (
               <div
                 ref={suggestionsRef}
                 className="absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto"
                 style={{
                   backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
                   borderColor: 'rgba(148, 163, 184, 0.3)',
                   boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
                 }}
               >
                 {suggestions.map((suggestion, index) => (
                   <button
                     key={suggestion}
                     onClick={() => handleSelectSuggestion(suggestion)}
                     className="w-full px-4 py-2.5 text-left text-xs transition-colors flex items-center gap-2"
                     style={{
                       backgroundColor: focusedSuggestionIndex === index 
                         ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.1)')
                         : 'transparent',
                       color: styles.text.primary
                     }}
                     onMouseEnter={() => setFocusedSuggestionIndex(index)}
                     onMouseLeave={() => setFocusedSuggestionIndex(-1)}
                   >
                     <Search className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
                     <span className="truncate">{suggestion}</span>
                   </button>
                 ))}
               </div>
             )}
           </div>
           
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/app/crear-cuenta')}
              className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 hover:-translate-y-0.5"
              style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))', boxShadow: '0 4px 12px rgba(200, 21, 27, 0.2)'}}
            >
              <UserPlus className="w-4 h-4" />
              Nueva Cuenta
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2"
              style={{
                backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                borderColor: 'rgba(148, 163, 184, 0.3)',
                color: styles.text.secondary,
              }}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
         </div>
         
         {/* Filtros por estado */}
         <div className="flex flex-wrap items-center gap-3 pt-2 border-t" style={{ borderColor: 'rgba(148, 163, 184, 0.15)' }}>
           <div className="flex items-center gap-2">
             <AlertTriangle className="w-4 h-4" style={{color: styles.text.tertiary}} />
             <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Estado:</span>
             <div className="flex flex-wrap gap-2">
               {([
                 { id: 'todos', label: 'Todos' },
                 { id: 'activos', label: 'Activos' },
                 { id: 'vacaciones', label: 'Vacaciones' },
                 { id: 'inactivos', label: 'Inactivos' },
               ] as { id: EstadoFilter; label: string }[]).map((item, idx) => (
                 <button
                   key={item.id}
                   onClick={() => setEstadoFilter(item.id)}
                   className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                     estadoFilter === item.id 
                       ? '' 
                       : 'border-slate-600 hover:border-slate-500'
                   }`}
                   style={{
                     ...(estadoFilter === item.id ? {
                       backgroundColor: 'rgba(34, 197, 94, 0.12)',
                       borderColor: 'rgba(34, 197, 94, 0.4)',
                       color: '#22c55e'
                     } : {
                       backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                       borderColor: 'rgba(148, 163, 184, 0.3)',
                       color: styles.text.secondary
                     }),
                     animation: `fadeInSlide 0.3s ease-out ${idx * 0.04}s both`,
                     transform: 'scale(1)',
                     transition: 'all 0.2s ease-in-out'
                   }}
                   onMouseEnter={(e) => {
                     if (estadoFilter !== item.id) {
                       e.currentTarget.style.transform = 'scale(1.05)';
                     }
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.transform = 'scale(1)';
                   }}
                 >
                   {item.label}
                 </button>
               ))}
             </div>
             {estadoFilter !== 'todos' && (
               <button
                 onClick={() => setEstadoFilter('todos')}
                 className="px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                 style={{color: styles.text.tertiary}}
               >
                 <X className="w-3 h-3" />
                 Limpiar estado
               </button>
             )}
           </div>
         </div>
      </div>

      {/* Tabla de agentes */}
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ minHeight: 0 }}>
      {loading && agentes.length === 0 ? (
        <div className="rounded-2xl border-2 p-16 text-center" style={{...styles.card}}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
          }}>
            <RefreshCw className="w-10 h-10 animate-spin" style={{color: styles.text.tertiary}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>Cargando agentes...</h3>
        </div>
      ) : filteredAgentes.length === 0 ? (
        <div className="rounded-2xl border-2 p-16 text-center" style={{...styles.card}}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
          }}>
            <Users className="w-10 h-10" style={{color: styles.text.tertiary}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>
            {searchTerm ? 'No se encontraron agentes' : 'No hay agentes disponibles'}
          </h3>
          <p className="text-sm mb-6" style={{color: styles.text.tertiary}}>
            {searchTerm 
              ? `No hay agentes que coincidan con "${searchTerm}"`
              : 'Los agentes aparecerán aquí cuando estén registrados'}
          </p>
          {searchTerm ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setShowSuggestions(false);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg border transition-all"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'rgba(148, 163, 184, 0.3)',
                color: styles.text.secondary
              }}
            >
              Limpiar búsqueda
            </button>
          ) : (
            <button
              onClick={() => navigate('/app/crear-cuenta')}
              className="px-6 py-3 text-white font-semibold rounded-xl hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
              style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
            >
              <UserPlus className="w-4 h-4" />
              Crear primer agente
            </button>
          )}
        </div>
      ) : (
          <div className="rounded-xl border overflow-hidden" style={{...styles.card}}>
            {/* Mensaje de resultados de búsqueda */}
            {searchTerm && filteredAgentes.length > 0 && (
              <div className="p-3 border-b" style={{borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <p className="text-xs text-center" style={{color: styles.text.tertiary}}>
                  Mostrando {filteredAgentes.length} resultado(s) para "{searchTerm}"
                </p>
              </div>
            )}
            
            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                <thead>
                  <tr style={{backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'}}>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Agente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Empresa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Casos Activos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Round Robin
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgentes.map((agente, index) => {
                    const estadoOperativo = getEstadoOperativo(agente);
                    const cargaPercent = getCargaWorkloadPercent(agente.casosActivos);
                    const cargaColor = getCargaWorkloadColor(agente.casosActivos);
                    const estadoBadge = getEstadoBadge(agente.estado);
                    const ordenRoundRobin = agente.ordenRoundRobin || 999;
                    const esSiguiente = ordenRoundRobin === 1 && agente.estado === 'Activo';
                    const esActivo = agente.estado === 'Activo';
                    
                    // Formatear fecha del último caso
                    const formatFechaUltimoCaso = (fecha: string) => {
                      if (!fecha || fecha === 'N/A') return 'Sin casos';
                      try {
                        let date;
                        if (fecha.includes('T')) {
                          date = new Date(fecha);
                        } else if (fecha.includes('/')) {
                          const [day, month, year] = fecha.split('/');
                          date = new Date(`${year}-${month}-${day}`);
                        } else {
                          date = new Date(fecha);
                        }
                        if (isNaN(date.getTime())) return 'Sin casos';
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${day}/${month}/${year}`;
                      } catch {
                        return 'Sin casos';
                      }
                    };

                    return (
                      <tr 
                        key={agente.idAgente}
                        className="hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: index % 2 === 0 
                            ? (theme === 'dark' ? '#020617' : '#ffffff')
                            : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                          borderBottom: index < filteredAgentes.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none'
                        }}
                      >
                        {/* Agente */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
                                {agente.nombre.charAt(0)}
                              </div>
                              <div className="absolute -inset-0.5 rounded-lg border-2" style={{borderColor: getEstadoRingColor(agente.estado)}}></div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold" style={{color: styles.text.primary}}>
                                {agente.nombre}
                              </div>
                              <div className="text-xs" style={{color: styles.text.tertiary}}>
                                {agente.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Empresa */}
                        <td className="px-4 py-3">
                          {(() => {
                            const pais = agente.pais || '';
                            const paisNormalizado = pais ? String(pais).trim().toUpperCase() : '';
                            let paisDisplay = '';
                            let paisCode = '';
                            
                            if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
                              paisDisplay = 'El Salvador';
                              paisCode = 'SV';
                            } else if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
                              paisDisplay = 'Guatemala';
                              paisCode = 'GT';
                            } else if (pais) {
                              paisDisplay = pais;
                              paisCode = paisNormalizado.substring(0, 2);
                            }
                            
                            if (!paisDisplay) {
                              return (
                                <span className="text-xs" style={{color: styles.text.tertiary}}>
                                  N/A
                                </span>
                              );
                            }
                            
                            return (
                              <span 
                                className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-lg border transition-all"
                                style={{
                                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                                  color: styles.text.secondary,
                                  borderColor: 'rgba(148, 163, 184, 0.2)',
                                  transform: 'scale(1)',
                                  transition: 'all 0.2s ease-in-out',
                                  minWidth: '32px'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title={paisDisplay} // Mostrar nombre completo en tooltip
                              >
                                {paisCode || 'N/A'}
                              </span>
                            );
                          })()}
                        </td>
                        
                        {/* Estado */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border w-fit" style={{
                              backgroundColor: estadoBadge.bg,
                              color: estadoBadge.text,
                              borderColor: estadoBadge.border
                            }}>
                              {agente.estado}
                            </span>
                            {estadoOperativo && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{color: estadoOperativo.color}}>
                                <estadoOperativo.icon className="w-3 h-3" />
                                {estadoOperativo.texto}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Casos Activos */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" style={{color: styles.text.tertiary}} />
                                <span className="text-xs font-bold" style={{color: styles.text.primary}}>{agente.casosActivos}</span>
                              </div>
                            </div>
                            <div className="w-full rounded-full h-1.5 overflow-hidden" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}>
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${cargaPercent}%`,
                                  backgroundColor: cargaColor
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        
                        {/* Round Robin */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" style={{color: esSiguiente ? '#22c55e' : esActivo ? '#3b82f6' : '#94a3b8'}} />
                              <span className="text-xs font-bold" style={{color: esSiguiente ? '#22c55e' : esActivo ? '#3b82f6' : '#94a3b8'}}>
                                #{ordenRoundRobin === 999 ? '—' : ordenRoundRobin}
                              </span>
                              {esSiguiente && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{
                                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                  color: '#22c55e'
                                }}>
                                  <TrendingUp className="w-2.5 h-2.5" />
                                  Siguiente
                                </span>
                              )}
                            </div>
                            {esActivo && (
                              <div className="text-[10px]" style={{color: styles.text.tertiary}}>
                                Último: {formatFechaUltimoCaso(agente.ultimoCasoAsignado)}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleEstado(agente.idAgente, agente.estado)}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={agente.estado === 'Activo' ? {
                                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                                borderColor: 'rgba(148, 163, 184, 0.2)',
                                color: styles.text.secondary
                              } : {
                                background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))',
                                borderColor: 'transparent',
                                color: '#ffffff'
                              }}
                              title={agente.estado === 'Activo' ? 'Desactivar agente' : 'Activar agente'}
                            >
                              {agente.estado === 'Activo' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setVacaciones(agente.idAgente)}
                              disabled={agente.estado === 'Vacaciones'}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={agente.estado === 'Vacaciones' ? {
                                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                color: '#f59e0b',
                                borderColor: 'rgba(245, 158, 11, 0.3)',
                                cursor: 'not-allowed',
                                opacity: 0.5
                              } : {
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                borderColor: 'rgba(245, 158, 11, 0.3)'
                              }}
                              title={agente.estado === 'Vacaciones' ? 'Ya está en vacaciones' : 'Marcar en vacaciones'}
                            >
                              <Sun className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(agente)}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: 'rgba(220, 38, 38, 0.15)',
                                color: '#f87171',
                                borderColor: 'rgba(220, 38, 38, 0.3)'
                              }}
                              title="Eliminar agente permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Modal de confirmación para eliminar agente */}
      {showDeleteModal && agenteToDelete && (
        <div className="fixed inset-0 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" style={{backgroundColor: 'rgba(20, 84, 120, 0.7)'}}>
          <div className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 scale-in duration-300 border" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
            <div className="p-6 border-b flex justify-between items-center" style={{borderColor: 'rgba(200, 21, 27, 0.2)'}}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl shadow-lg" style={{backgroundColor: 'rgba(200, 21, 27, 0.2)'}}>
                  <AlertTriangle className="w-6 h-6" style={{color: '#f87171'}} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{color: '#1e293b', letterSpacing: '-0.02em'}}>Confirmar Eliminación</h3>
                  <p className="text-sm mt-1 font-medium" style={{color: '#94a3b8'}}>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button 
                onClick={handleDeleteCancel} 
                className="p-2.5 rounded-xl transition-all"
                style={{color: '#64748b'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="border-2 rounded-2xl p-4" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.3)'}}>
                <p className="text-sm font-semibold mb-2" style={{color: '#f87171'}}>
                  ¿Estás seguro de que deseas eliminar al agente?
                </p>
                <div className="rounded-xl p-3 border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(220, 38, 38, 0.3)'}}>
                  <p className="text-sm font-bold" style={{color: '#1e293b'}}>{agenteToDelete.nombre}</p>
                  <p className="text-sm" style={{color: '#94a3b8'}}>{agenteToDelete.email}</p>
                  <p className="text-xs mt-1" style={{color: '#64748b'}}>Estado: <span className="font-semibold" style={{color: '#94a3b8'}}>{agenteToDelete.estado}</span></p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={handleDeleteCancel} 
                  className="flex-1 py-4 text-sm font-bold rounded-2xl transition-all border shadow-sm hover:shadow-md"
                  style={{backgroundColor: '#f8fafc', color: '#475569', borderColor: 'rgba(148, 163, 184, 0.2)'}}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleDeleteConfirm} 
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))'}}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-accent-red), var(--color-brand-red))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))';
                  }}
                >
                  Eliminar Agente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

    </div>
  );
};

export default GestionAgentes;
