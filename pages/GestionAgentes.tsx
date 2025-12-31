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
  ChevronLeft,
  ChevronRight,
  Briefcase,
  RotateCcw,
  Activity,
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react';

const GestionAgentes: React.FC = () => {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agenteToDelete, setAgenteToDelete] = useState<Agente | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoveredAgenteId, setHoveredAgenteId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const [itemsPerView, setItemsPerView] = useState(3);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const updateItemsPerView = () => {
      if (window.innerWidth < 640) {
        setItemsPerView(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerView(2);
      } else {
        setItemsPerView(3);
      }
    };
    
    updateItemsPerView();
    window.addEventListener('resize', updateItemsPerView);
    return () => window.removeEventListener('resize', updateItemsPerView);
  }, []);

  useEffect(() => {
    loadAgentes();
    
    const handleAgenteCreado = () => {
      loadAgentes();
    };
    
    window.addEventListener('agente-creado', handleAgenteCreado);
    
    return () => {
      window.removeEventListener('agente-creado', handleAgenteCreado);
    };
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && agentes.length > 0) {
      const container = scrollContainerRef.current;
      container.scrollLeft = 0;
      
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const containerWidth = scrollContainerRef.current.offsetWidth;
          const scrollWidth = scrollContainerRef.current.scrollWidth;
          const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
          setTotalPages(calculatedTotalPages);
        }
      }, 100);
    }
  }, [agentes.length, itemsPerView]);

  useEffect(() => {
    const updatePages = () => {
      if (scrollContainerRef.current && agentes.length > 0) {
        const container = scrollContainerRef.current;
        const containerWidth = container.offsetWidth;
        const scrollWidth = container.scrollWidth;
        const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
        setTotalPages(calculatedTotalPages);
      }
    };

    window.addEventListener('resize', updatePages);
    const timeoutId = setTimeout(updatePages, 100);
    
    return () => {
      window.removeEventListener('resize', updatePages);
      clearTimeout(timeoutId);
    };
  }, [agentes.length, itemsPerView]);

  const loadAgentes = async () => {
    setLoading(true);
    const data = await api.getAgentes();
    setAgentes([...data]);
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
      console.error('Error al cambiar estado del agente:', error);
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
      console.error('Error al marcar agente en vacaciones:', error);
      alert(error.message || 'Error al marcar el agente en vacaciones');
    }
  };

  const handleDeleteClick = (agente: Agente) => {
    setAgenteToDelete(agente);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agenteToDelete) return;
    
    const success = await api.deleteAgente(agenteToDelete.idAgente);
    if (success) {
      setShowDeleteModal(false);
      setAgenteToDelete(null);
    loadAgentes();
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setAgenteToDelete(null);
  };

  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerWidth = container.offsetWidth;
    const scrollWidth = container.scrollWidth;
    
    const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
    if (calculatedTotalPages !== totalPages) {
      setTotalPages(calculatedTotalPages);
    }
    
    const maxIndex = Math.max(0, calculatedTotalPages - 1);
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    const scrollPosition = clampedIndex * containerWidth;
    
    container.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
    setCurrentIndex(clampedIndex);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollPosition = container.scrollLeft;
    const containerWidth = container.offsetWidth;
    const scrollWidth = container.scrollWidth;
    
    const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
    if (calculatedTotalPages !== totalPages) {
      setTotalPages(calculatedTotalPages);
    }
    
    const newIndex = Math.round(scrollPosition / containerWidth);
    const clampedIndex = Math.max(0, Math.min(newIndex, calculatedTotalPages - 1));
    
    setCurrentIndex(clampedIndex);
  };

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  const nextPage = () => {
    if (currentIndex < totalPages - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const prevPage = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
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

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', gap: '1rem' }}>
      <div className="p-4 rounded-xl border flex-shrink-0 flex justify-between items-center" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
         <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#22c55e'}}></div>
             <span className="text-xs font-semibold" style={{color: '#475569'}}>
               {resumenAgentes.activos} <span style={{color: '#94a3b8'}}>Activos</span>
             </span>
           </div>
           {resumenAgentes.vacaciones > 0 && (
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#f59e0b'}}></div>
               <span className="text-xs font-semibold" style={{color: '#475569'}}>
                 {resumenAgentes.vacaciones} <span style={{color: '#94a3b8'}}>Vacaciones</span>
               </span>
             </div>
           )}
           {resumenAgentes.inactivos > 0 && (
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#ef4444'}}></div>
               <span className="text-xs font-semibold" style={{color: '#475569'}}>
                 {resumenAgentes.inactivos} <span style={{color: '#94a3b8'}}>Inactivos</span>
               </span>
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

      {loading && agentes.length === 0 ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 rounded-2xl border-2 p-4 w-80 animate-pulse" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
                <div className="flex-1">
                  <div className="h-4 rounded w-24 mb-2" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
                  <div className="h-3 rounded w-16" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
                </div>
              </div>
              <div className="h-16 rounded-xl mb-3" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
              <div className="h-10 rounded-xl" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
            </div>
          ))}
        </div>
      ) : agentes.length === 0 ? (
        <div className="rounded-2xl border-2 p-16 text-center" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor: '#f8fafc'}}>
            <Users className="w-10 h-10" style={{color: '#94a3b8'}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: '#1e293b'}}>No hay agentes disponibles</h3>
          <p className="text-sm mb-6" style={{color: '#94a3b8'}}>Los agentes aparecerán aquí cuando estén registrados</p>
          <button
            onClick={() => navigate('/app/crear-cuenta')}
            className="px-6 py-3 text-white font-semibold rounded-xl hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
            style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
          >
            <UserPlus className="w-4 h-4" />
            Crear primer agente
          </button>
        </div>
      ) : (
        <div className="relative w-full flex-1" style={{ overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
          {/* Microcopy */}
          {agentes.length > itemsPerView && (
            <p className="text-xs text-center mb-2 flex-shrink-0" style={{color: '#94a3b8'}}>
              Desliza para ver más agentes
            </p>
          )}

          <div className="relative w-full flex-1" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>
            {/* Flechas de Navegación Mejoradas */}
            {agentes.length > itemsPerView && (
              <>
                <button
                  onClick={prevPage}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 rounded-full p-3 shadow-xl hover:shadow-2xl transition-all duration-200 border-2"
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderColor: currentIndex === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    opacity: currentIndex === 0 ? 0.4 : 1,
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (currentIndex !== 0) {
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                      e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    e.currentTarget.style.borderColor = currentIndex === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-6 h-6" style={{color: currentIndex === 0 ? '#64748b' : '#475569'}} />
                </button>
                <button
                  onClick={nextPage}
                  disabled={currentIndex >= totalPages - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 rounded-full p-3 shadow-xl hover:shadow-2xl transition-all duration-200 border-2"
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderColor: currentIndex >= totalPages - 1 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    opacity: currentIndex >= totalPages - 1 ? 0.4 : 1,
                    cursor: currentIndex >= totalPages - 1 ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (currentIndex < totalPages - 1) {
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                      e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    e.currentTarget.style.borderColor = currentIndex >= totalPages - 1 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  aria-label="Siguiente"
                >
                  <ChevronRight className="w-6 h-6" style={{color: currentIndex >= totalPages - 1 ? '#64748b' : '#475569'}} />
                </button>
              </>
            )}

            {/* Scroll Container */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="scrollbar-hide snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitScrollbar: { display: 'none' },
                overflowX: 'auto',
                overflowY: 'hidden',
                paddingTop: '20px',
                paddingBottom: '20px',
                paddingLeft: '0',
                paddingRight: '0',
                scrollBehavior: 'smooth',
                width: '100%',
                marginLeft: '0',
                marginRight: '0',
                flex: '1 1 auto',
                minHeight: 0,
                maxHeight: '100%'
              } as React.CSSProperties}
            >
              <div className="flex gap-4 items-center justify-center" style={{ minHeight: '100%', alignItems: 'center', boxSizing: 'border-box' }}>
                <div style={{ minWidth: 'calc(50% - 140px)', flexShrink: 0 }}></div>
          {agentes.map((agente, idx) => {
                  const isHovered = hoveredAgenteId === agente.idAgente;
                  const isAnyHovered = hoveredAgenteId !== null;
                  const estadoOperativo = getEstadoOperativo(agente);
                  const cargaPercent = getCargaWorkloadPercent(agente.casosActivos);
                  const cargaColor = getCargaWorkloadColor(agente.casosActivos);
                  const casosHoy = getCasosHoy(agente);
                  const estadoBadge = getEstadoBadge(agente.estado);
            
            return (
              <div 
                key={agente.idAgente} 
                    className="snap-center flex-shrink-0 rounded-2xl border-2 shadow-sm overflow-hidden group"
                    style={{
          backgroundColor: '#ffffff',
          borderColor: 'rgba(148, 163, 184, 0.2)',
                      width: `calc((100% - ${(itemsPerView - 1) * 16}px) / ${itemsPerView})`,
                      minWidth: '280px',
                      maxWidth: '280px',
                      opacity: isAnyHovered && !isHovered ? 0.5 : 1,
                      transform: isHovered ? 'scale(1.03) translateY(-4px)' : isAnyHovered ? 'scale(0.95)' : 'scale(1)',
                      transformOrigin: 'center center',
                      zIndex: isHovered ? 50 : 1,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      pointerEvents: 'auto',
                      visibility: 'visible',
                      flexShrink: 0,
                      boxShadow: isHovered ? '0 20px 40px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.2)'
                    }}
                    onMouseEnter={() => setHoveredAgenteId(agente.idAgente)}
                    onMouseLeave={() => setHoveredAgenteId(null)}
              >
                    <div className="p-3 w-full">
                      {/* Header: Avatar con Ring de Estado */}
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
                        {agente.nombre.charAt(0)}
                      </div>
                          <div className="absolute -inset-1 rounded-xl border-2" style={{borderColor: getEstadoRingColor(agente.estado)}}></div>
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h4 className="font-bold text-sm mb-0.5 truncate" style={{color: '#1e293b'}}>{agente.nombre}</h4>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{
                              color: estadoBadge.text
                            }}>
                              {agente.estado}
                            </span>
                            {estadoOperativo && (
                              <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{color: estadoOperativo.color}}>
                                <estadoOperativo.icon className="w-2.5 h-2.5" />
                                {estadoOperativo.texto}
                              </span>
                            )}
                      </div>
                    </div>
                      </div>

                      {/* Métricas con barra de carga */}
                      {(() => {
                        // Usar el orden_round_robin que viene directamente del webhook
                        // El backend ya calcula este valor, no lo calculamos en el frontend
                        const ordenRoundRobin = agente.ordenRoundRobin || 999;
                        const esSiguiente = ordenRoundRobin === 1 && agente.estado === 'Activo';
                        
                        return (
                          <div className="space-y-2 mb-2">
                            {/* Casos Activos con Barra de Carga */}
                            <div className="p-2.5 rounded-xl border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0" style={{color: '#94a3b8'}} />
                                  <span className="text-xs font-medium" style={{color: '#94a3b8'}}>Activos</span>
                                </div>
                                <span className="text-sm font-bold" style={{color: '#1e293b'}}>{agente.casosActivos}</span>
                              </div>
                              {/* Barra de carga visual */}
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

                            {/* R-Robin con destacado - Usa el orden_round_robin del webhook */}
                            <div className="p-2.5 rounded-xl border-2 transition-all" style={{
                              backgroundColor: esSiguiente ? 'rgba(34, 197, 94, 0.15)' : '#f8fafc',
                              borderColor: esSiguiente ? 'rgba(34, 197, 94, 0.3)' : 'rgba(148, 163, 184, 0.2)'
                            }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" style={{color: esSiguiente ? '#22c55e' : '#94a3b8'}} />
                                <span className="text-xs font-medium" style={{color: esSiguiente ? '#22c55e' : '#94a3b8'}}>
                                  R-Robin
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold" style={{color: esSiguiente ? '#22c55e' : '#1e293b'}}>
                                  #{ordenRoundRobin}
                                </span>
                                {esSiguiente && (
                                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{
                                    color: '#22c55e'
                                  }}>
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    Siguiente
                                  </span>
                                )}
                              </div>
                            </div>
                    </div>
                        );
                      })()}

                      {/* Contexto adicional */}
                      {(casosHoy > 0 || agente.ultimoCasoAsignado) && (
                        <div className="mb-3 px-2 py-1.5 rounded-lg border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                          <div className="flex items-center gap-2 text-xs" style={{color: '#94a3b8'}}>
                            <Clock className="w-3 h-3" />
                            <span className="font-medium">
                              {casosHoy > 0 
                                ? `Casos hoy: ${casosHoy}`
                                : `Último caso: ${formatTimeAgo(agente.ultimoCasoAsignado || '')}`
                              }
                            </span>
                    </div>
                  </div>
                      )}

                      {/* Acciones */}
                      <div className="space-y-1.5">
                        {/* Acción Primaria: Activar/Desactivar */}
                    <button 
                      onClick={() => toggleEstado(agente.idAgente, agente.estado)}
                          className="w-full py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md border"
                          style={agente.estado === 'Activo' ? {
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            borderColor: 'rgba(148, 163, 184, 0.2)'
                          } : {
                            background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))',
                            boxShadow: '0 8px 20px rgba(200, 21, 27, 0.2)',
                            color: '#1e293b',
                            borderColor: 'transparent'
                          }}
                      onMouseEnter={(e) => {
                            if (agente.estado === 'Activo') {
                              e.currentTarget.style.backgroundColor = '#f1f5f9';
                            } else {
                              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-accent-red), var(--color-brand-red))';
                              e.currentTarget.style.boxShadow = '0 10px 24px rgba(245, 41, 56, 0.25)';
                        }
                      }}
                      onMouseLeave={(e) => {
                            if (agente.estado === 'Activo') {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                            } else {
                              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))';
                              e.currentTarget.style.boxShadow = '0 8px 20px rgba(200, 21, 27, 0.2)';
                        }
                      }}
                          title={agente.estado === 'Activo' ? 'Desactivar agente' : 'Activar agente'}
                    >
                          {agente.estado === 'Activo' ? <UserX className="w-3 h-3 flex-shrink-0" /> : <UserCheck className="w-3 h-3 flex-shrink-0" />}
                          <span className="truncate text-xs">{agente.estado === 'Activo' ? 'Desactivar' : 'Activar'}</span>
                    </button>

                        {/* Acciones Secundarias */}
                        <div className="flex gap-1.5">
                    <button 
                      onClick={() => setVacaciones(agente.idAgente)}
                            disabled={agente.estado === 'Vacaciones'}
                            className="flex-1 py-1.5 rounded-lg transition-all border shadow-sm hover:shadow-md flex items-center justify-center gap-1 min-w-0"
                            style={agente.estado === 'Vacaciones' ? {
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              color: '#f59e0b',
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                              cursor: 'not-allowed'
                            } : {
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              borderColor: 'rgba(245, 158, 11, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              if (agente.estado !== 'Vacaciones') {
                                e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.25)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (agente.estado !== 'Vacaciones') {
                                e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                              }
                            }}
                            title={agente.estado === 'Vacaciones' ? 'Ya está en vacaciones' : 'Marcar en vacaciones'}
                          >
                            <Sun className="w-3 h-3 flex-shrink-0" />
                            <span className="text-xs font-semibold truncate">Vacaciones</span>
                          </button>
                        </div>

                        {/* Acción Destructiva Separada */}
                        <button 
                          onClick={() => handleDeleteClick(agente)}
                          className="w-full py-1.5 px-2 rounded-lg transition-all border shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 group"
                          style={{
                            backgroundColor: 'rgba(220, 38, 38, 0.15)',
                            color: '#f87171',
                            borderColor: 'rgba(220, 38, 38, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.25)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.15)';
                          }}
                          title="Eliminar agente permanentemente"
                        >
                          <Trash2 className="w-3 h-3 group-hover:scale-110 transition-transform flex-shrink-0" />
                          <span className="text-xs font-semibold">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
                <div style={{ minWidth: 'calc(50% - 140px)', flexShrink: 0 }}></div>
              </div>
            </div>
          </div>

          {/* Indicadores de Posición Mejorados - Siempre visible */}
          {agentes.length > 0 && (
            <div className="flex justify-center items-center gap-3 mt-4 flex-shrink-0">
              {totalPages > 1 && Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index)}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: index === currentIndex ? '40px' : '10px',
                    backgroundColor: index === currentIndex ? 'var(--color-accent-blue)' : 'rgba(148, 163, 184, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (index !== currentIndex) {
                      e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (index !== currentIndex) {
                      e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.3)';
                    }
                  }}
                  aria-label={`Ir a página ${index + 1}`}
                />
              ))}
              <span className="ml-2 text-xs font-semibold" style={{
                color: '#475569'
              }}>
                {currentIndex + 1} / {totalPages}
              </span>
            </div>
          )}
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
  );
};

export default GestionAgentes;
