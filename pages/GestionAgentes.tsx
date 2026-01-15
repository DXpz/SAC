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
  Search
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const GestionAgentes: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agenteToDelete, setAgenteToDelete] = useState<Agente | null>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Estados para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    // Solo cargar agentes al montar el componente
    // No limpiar caché automáticamente para evitar recargas innecesarias
    loadAgentes();
    
    const handleAgenteCreado = () => {
      // Solo recargar cuando se dispara el evento explícitamente
      localStorage.removeItem('intelfon_agents');
      loadAgentes();
    };
    
    window.addEventListener('agente-creado', handleAgenteCreado);
    
    return () => {
      window.removeEventListener('agente-creado', handleAgenteCreado);
    };
  }, []);


  const loadAgentes = async () => {
    setLoading(true);
    const data = await api.getAgentes();
    
    
    // Ordenar agentes por ordenRoundRobin (1, 2, 3...) para mostrar el orden del round robin
    // Los agentes activos con orden 1, 2, 3... primero, luego los inactivos/vacaciones
    const sortedAgentes = [...data].sort((a, b) => {
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

  // Calcular resumen de agentes
  const resumenAgentes = {
    total: agentes.length,
    activos: agentes.filter(a => a.estado === 'Activo').length,
    vacaciones: agentes.filter(a => a.estado === 'Vacaciones').length,
    inactivos: agentes.filter(a => a.estado === 'Inactivo').length
  };

  // Filtrar agentes por término de búsqueda
  const filteredAgentes = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return agentes;
    }
    const term = searchTerm.toLowerCase().trim();
    return agentes.filter(agente => 
      agente.nombre.toLowerCase().includes(term)
    );
  }, [agentes, searchTerm]);

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
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', gap: '1rem', ...styles.container }}>
      <div className="p-4 rounded-xl border flex-shrink-0 flex justify-between items-center" style={{...styles.card}}>
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
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#ef4444'}}></div>
               <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                 {resumenAgentes.inactivos} <span style={{color: styles.text.tertiary}}>Inactivos</span>
               </span>
             </div>
           )}
         </div>
         <div className="flex items-center gap-3">
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
                   backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
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
                   backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
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
           
           <button 
             onClick={() => navigate('/app/crear-cuenta')}
             className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 hover:-translate-y-0.5"
             style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))', boxShadow: '0 4px 12px rgba(200, 21, 27, 0.2)'}}
           >
             <UserPlus className="w-4 h-4" />
             Nueva Cuenta
           </button>
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
                            ? (theme === 'dark' ? '#1e293b' : '#ffffff')
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
