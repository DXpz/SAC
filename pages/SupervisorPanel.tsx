import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente, Cliente } from '../types';
import { STATE_COLORS } from '../constants';
import { AlertCircle, Clock, Users, ArrowUpRight, ChevronRight, Activity, Info, Filter, UserPlus, Bell, ArrowRightLeft, TrendingUp, TrendingDown, X, User, CheckCircle2, Eye, RefreshCw, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

type FilterPeriod = 'hoy' | 'semana' | 'mes';
type FilterType = 'todos' | 'criticos' | 'vencidos' | string;

const SupervisorPanel: React.FC = () => {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('hoy');
  const [typeFilter, setTypeFilter] = useState<FilterType>('todos');
  const [agentFilter, setAgentFilter] = useState<string>('todos');
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadData();
    // Ya no usamos setInterval, solo actualizamos cuando cambia la vista
  }, [location.pathname]);

  const loadClientes = async () => {
    try {
      const clientesList = await api.getClientes();
      setClientes(clientesList);
      return clientesList;
    } catch (error) {
      return [];
    }
  };

  const enrichCasesWithClients = (cases: Caso[], clientesList: Cliente[]): Caso[] => {
    return cases.map(caso => {
      const cliente = clientesList.find(c => c.idCliente === caso.clientId);
      return {
        ...caso,
        clientName: cliente?.nombreEmpresa || caso.clientName || 'Sin nombre',
        cliente: cliente || caso.cliente
      };
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [casosData, agentesData, clientesList] = await Promise.all([
        api.getCases(),
        api.getAgentes(),
        loadClientes()
      ]);
      const enriched = enrichCasesWithClients(casosData, clientesList);
      setCasos(enriched);
      // Asegurar que se muestren TODOS los agentes, no solo los activos
      console.log('[SupervisorPanel] Agentes cargados:', agentesData.length, agentesData);
      // Filtrar agentes que tengan idAgente válido
      const agentesValidos = Array.isArray(agentesData) 
        ? agentesData.filter(a => a && (a.idAgente || a.id_agente || a.id))
        : [];
      console.log('[SupervisorPanel] Agentes válidos después de filtrar:', agentesValidos.length, agentesValidos);
      setAgentes(agentesValidos);
      // Guardar en localStorage para que Layout pueda mostrarlo en el header
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
    } catch (error) {
      console.error('[SupervisorPanel] Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para normalizar estado (debe estar antes de su uso)
  const normalizeStatus = React.useCallback((status: string | CaseStatus | undefined): CaseStatus => {
    if (!status) return CaseStatus.NUEVO;
    const statusStr = String(status).trim();
    const statusValues = Object.values(CaseStatus);
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '');
      const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
      return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
    });
    return (matchedStatus as CaseStatus) || CaseStatus.NUEVO;
  }, []);

  // Función helper para filtrar por agente (usando useCallback para optimización)
  const filterByAgent = React.useCallback((casosList: Caso[]) => {
    if (agentFilter === 'todos') {
      return casosList;
    }
    return casosList.filter(c => 
      c.agenteAsignado?.idAgente === agentFilter || 
      c.agentId === agentFilter
    );
  }, [agentFilter]);

  const casosAbiertos = useMemo(() => {
    const abiertos = casos.filter(c => c.status !== CaseStatus.RESUELTO && c.status !== CaseStatus.CERRADO);
    return filterByAgent(abiertos);
  }, [casos, filterByAgent]);
  
  const casosCriticos = useMemo(() => {
    const criticos = casos.filter(c => {
      // Excluir casos resueltos o cerrados (a menos que estén escalados)
      const normalizedStatus = normalizeStatus(c.status);
      if (normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO) {
        // Solo incluir si está escalado
        return normalizedStatus === CaseStatus.ESCALADO;
      }
      
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasAbierto = c.diasAbierto || 0;
      
      // Caso crítico si:
      // 1. Los días abiertos son >= al SLA (vencido)
      // 2. Está escalado
      // 3. Le queda 1 día o menos para vencer (en riesgo)
      const isVencido = diasAbierto >= slaDias;
      const isEscalado = normalizedStatus === CaseStatus.ESCALADO;
      const isEnRiesgo = (slaDias - diasAbierto <= 1) && diasAbierto > 0 && diasAbierto < slaDias;
      
      return isVencido || isEscalado || isEnRiesgo;
    });
    return filterByAgent(criticos);
  }, [casos, filterByAgent, normalizeStatus]);

  const filteredCasos = useMemo(() => {
    let filtered = [...casos];
    
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (periodFilter === 'hoy') {
      filtered = filtered.filter(c => new Date(c.createdAt) >= startOfDay);
    } else if (periodFilter === 'semana') {
      filtered = filtered.filter(c => new Date(c.createdAt) >= startOfWeek);
    } else if (periodFilter === 'mes') {
      filtered = filtered.filter(c => new Date(c.createdAt) >= startOfMonth);
    }

    if (typeFilter === 'criticos') {
      filtered = filtered.filter(c => {
        const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
        return c.diasAbierto >= slaDias || c.status === CaseStatus.ESCALADO;
      });
    } else if (typeFilter === 'vencidos') {
      filtered = filtered.filter(c => {
        const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
        return c.diasAbierto > slaDias;
      });
    }

    if (agentFilter !== 'todos') {
      filtered = filtered.filter(c => c.agenteAsignado?.idAgente === agentFilter || c.agentId === agentFilter);
    }

    return filtered;
  }, [casos, periodFilter, typeFilter, agentFilter]);
  
  const casosVencidos = useMemo(() => {
    const vencidos = casos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.status !== CaseStatus.RESUELTO && c.status !== CaseStatus.CERRADO && c.diasAbierto > slaDias;
    });
    return filterByAgent(vencidos);
  }, [casos, filterByAgent]);
  
  const casosEnRiesgo = useMemo(() => {
    return casosAbiertos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasRestantes = slaDias - c.diasAbierto;
      return diasRestantes > 0 && diasRestantes <= 1;
    });
  }, [casosAbiertos]);
  
  const casosDentroSLA = useMemo(() => {
    return casosAbiertos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasRestantes = slaDias - c.diasAbierto;
      return diasRestantes > 1;
    });
  }, [casosAbiertos]);

  // Si no hay casos abiertos, el SLA no puede ser 100%, debe ser null
  const slaPromedio = useMemo(() => {
    return casosAbiertos.length > 0 
      ? Math.round((casosDentroSLA.length / casosAbiertos.length) * 100)
      : null;
  }, [casosAbiertos.length, casosDentroSLA.length]);

  // Memorizar valores de longitud para evitar recálculos durante hover
  const casosAbiertosCount = useMemo(() => casosAbiertos.length, [casosAbiertos.length]);
  const casosVencidosCount = useMemo(() => casosVencidos.length, [casosVencidos.length]);
  const casosCriticosCount = useMemo(() => casosCriticos.length, [casosCriticos.length]);
  const casosTotalesCount = useMemo(() => casos.length, [casos.length]);

  const agentesActivos = useMemo(() => agentes.filter(a => a.estado === 'Activo').length, [agentes]);
  const totalAgentes = useMemo(() => agentes.length, [agentes.length]);

  const casosCriticosOrdenados = useMemo(() => {
    return [...casosCriticos].sort((a, b) => {
      if (a.status === CaseStatus.ESCALADO && b.status !== CaseStatus.ESCALADO) return -1;
      if (a.status !== CaseStatus.ESCALADO && b.status === CaseStatus.ESCALADO) return 1;
      return b.diasAbierto - a.diasAbierto;
    });
  }, [casosCriticos]);

  // Función para obtener colores de estado (similar a AlertasCriticas)
  const getStatusColors = (status: CaseStatus | string) => {
    const statusColors: Record<CaseStatus, { backgroundColor: string; color: string; borderColor: string }> = {
      [CaseStatus.NUEVO]: { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#3b82f6' },
      [CaseStatus.EN_PROCESO]: { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' },
      [CaseStatus.PENDIENTE_CLIENTE]: { backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#a855f7' },
      [CaseStatus.ESCALADO]: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#ef4444' },
      [CaseStatus.RESUELTO]: { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981' },
      [CaseStatus.CERRADO]: { backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#64748b' }
    };
    return statusColors[status as CaseStatus] || { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
  };

  const casosCriticosHoy = useMemo(() => {
    return casosCriticosOrdenados.filter(c => {
      const hoy = new Date().toDateString();
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return new Date(c.createdAt).toDateString() === hoy || c.diasAbierto >= slaDias;
    });
  }, [casosCriticosOrdenados]);

  // Calcular SLA de ayer basado en casos que existían ayer
  const slaAyer = useMemo(() => {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    const finAyer = new Date(ayer);
    finAyer.setHours(23, 59, 59, 999);

    // Obtener casos que existían ayer (creados antes del final de ayer)
    // Ya están filtrados por agente en casosAbiertos
    const casosAyer = casosAbiertos.filter(c => {
      const fechaCreacion = new Date(c.createdAt);
      return fechaCreacion <= finAyer;
    });

    if (casosAyer.length === 0) {
      // Si no hay casos de ayer, retornar null
      return null;
    }

    // Calcular casos dentro de SLA ayer
    const casosDentroSLAAyer = casosAyer.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      // Calcular días abiertos hasta ayer
      const diasAbiertoAyer = Math.floor((finAyer.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const diasRestantes = slaDias - diasAbiertoAyer;
      return diasRestantes > 0;
    });

    return casosAyer.length > 0 
      ? Math.round((casosDentroSLAAyer.length / casosAyer.length) * 100)
      : null;
  }, [casosAbiertos, slaPromedio]);

  // Calcular cambio de SLA solo si ambos valores existen
  const slaCambio = (slaPromedio !== null && slaAyer !== null) 
    ? slaPromedio - slaAyer 
    : null;

  const handleReasignar = (e: React.MouseEvent, casoId: string) => {
    e.stopPropagation();
    navigate(`/app/casos/${casoId}?action=reasignar`);
  };

  const handleEscalar = (e: React.MouseEvent, casoId: string) => {
    e.stopPropagation();
    navigate(`/app/casos/${casoId}?action=escalar`);
  };

  const handleNotificar = (e: React.MouseEvent, casoId: string) => {
    e.stopPropagation();
  };

  const getSeverityColor = (caso: Caso) => {
    if (caso.status === CaseStatus.ESCALADO) return 'bg-red-600';
    const slaDias = caso.categoria?.slaDias || (caso as any).categoria?.sla_dias || 5;
    if (caso.diasAbierto > slaDias) return 'bg-red-500';
    if (caso.diasAbierto >= slaDias - 1) return 'bg-amber-500';
    return 'bg-orange-400';
  };

  const getAgenteStats = (agenteId: string) => {
    // Filtrar casos abiertos del agente para estadísticas de casos activos
    const casosAgente = casosAbiertos.filter(c => c.agenteAsignado?.idAgente === agenteId || c.agentId === agenteId);
    const criticosAgente = casosAgente.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto >= slaDias || c.status === CaseStatus.ESCALADO;
    });
    const dentroSLA = casosAgente.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasRestantes = slaDias - c.diasAbierto;
      return diasRestantes > 0;
    });
    // Si no hay casos, el SLA no puede ser 100%, debe ser null para mostrar "N/A"
    const cumplimientoSLA = casosAgente.length > 0 
      ? Math.round((dentroSLA.length / casosAgente.length) * 100)
      : null;
    
    // Calcular tiempo promedio de resolución basado en casos resueltos del agente
    // Usar TODOS los casos, no solo los abiertos
    const casosResueltosAgente = casos.filter(c => 
      (c.agenteAsignado?.idAgente === agenteId || c.agentId === agenteId) &&
      (c.status === CaseStatus.RESUELTO || c.status === CaseStatus.CERRADO)
    );
    
    let tiempoPromedio = 'N/A';
    if (casosResueltosAgente.length > 0) {
      // Calcular tiempo promedio desde creación hasta resolución
      const tiemposResolucion = casosResueltosAgente.map(caso => {
        const fechaCreacion = new Date(caso.createdAt);
        // Buscar en el historial la fecha de resolución
        const historial = caso.historial || caso.history || [];
        const entradaResolucion = historial.find((h: any) => 
          (h.estado_nuevo === CaseStatus.RESUELTO || h.estado_nuevo === CaseStatus.CERRADO) &&
          h.tipo_evento === 'CAMBIO_ESTADO'
        );
        
        const fechaResolucion = entradaResolucion 
          ? new Date(entradaResolucion.fecha)
          : new Date(); // Si no hay historial, usar fecha actual como fallback
        
        return fechaResolucion.getTime() - fechaCreacion.getTime();
      });
      
      const tiempoPromedioMs = tiemposResolucion.reduce((sum, tiempo) => sum + tiempo, 0) / tiemposResolucion.length;
      const horas = Math.floor(tiempoPromedioMs / (1000 * 60 * 60));
      const minutos = Math.floor((tiempoPromedioMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (horas > 0) {
        tiempoPromedio = minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`;
      } else {
        tiempoPromedio = `${minutos}m`;
      }
    }
    
    return {
      casos: casosAgente.length,
      criticos: criticosAgente.length,
      cumplimientoSLA,
      tiempoPromedio
    };
  };

  // Memoizar el handler del tooltip para evitar re-renders innecesarios
  const handleTooltipEnter = useCallback((id: string) => {
    setShowTooltip(id);
  }, []);

  const handleTooltipLeave = useCallback(() => {
    setShowTooltip(null);
  }, []);

  const Tooltip: React.FC<{ id: string; content: string; children: React.ReactNode }> = React.memo(({ id, content, children }) => (
    <div className="relative group">
      {children}
      {showTooltip === id && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  ));

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
    },
    input: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  const SkeletonCard = () => (
    <div className="p-6 rounded-2xl border shadow-sm animate-pulse" style={{...styles.card}}>
      <div className="h-4 rounded w-24 mb-4" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
      <div className="h-8 rounded w-16" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
    </div>
  );

  if (loading && casos.length === 0) {
    return <LoadingScreen message="Cargando Panel de Supervisor..." />;
  }

  return (
    <div className="space-y-4 pb-4" style={styles.container}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          {casosCriticosHoy.length > 0 && (
            <div key="criticos-alert" className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" style={{color: '#c8151b'}} />
              <span className="text-[10px] font-semibold" style={{color: '#c8151b'}}>
              {casosCriticosHoy.length} caso{casosCriticosHoy.length !== 1 ? 's' : ''} crítico{casosCriticosHoy.length !== 1 ? 's' : ''} requiere acción
              </span>
            </div>
          )}
          {slaCambio !== null && slaCambio !== 0 && (
            <div key="sla-change" className="flex items-center gap-1.5">
              {slaCambio > 0 ? <TrendingUp className="w-3 h-3" style={{color: '#22c55e'}} /> : <TrendingDown className="w-3 h-3" style={{color: '#f59e0b'}} />}
              <span className="text-[10px] font-semibold" style={{color: slaCambio > 0 ? '#22c55e' : '#f59e0b'}}>
              SLA {slaCambio > 0 ? 'mejoró' : 'en riesgo'} {Math.abs(slaCambio)}% vs ayer
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border" style={{...styles.card}}>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{color: styles.text.secondary}}>Tiempo</span>
            <div className="flex gap-1">
            <button
              onClick={() => setPeriodFilter('hoy')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                periodFilter === 'hoy' 
                  ? 'text-white' 
                  : ''
              }`}
              style={periodFilter === 'hoy' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgba(148, 163, 184, 0.2)'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'hoy') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (periodFilter !== 'hoy') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriodFilter('semana')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                periodFilter === 'semana' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={periodFilter === 'semana' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgba(148, 163, 184, 0.2)'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'semana') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (periodFilter !== 'semana') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriodFilter('mes')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                periodFilter === 'mes' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={periodFilter === 'mes' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgba(148, 163, 184, 0.2)'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'mes') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (periodFilter !== 'mes') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Mes
            </button>
          </div>
        </div>
        <div className="h-3 w-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{color: styles.text.secondary}}>Estado</span>
          <div className="flex gap-1">
            <button
              onClick={() => setTypeFilter('todos')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                typeFilter === 'todos' 
                  ? 'text-white' 
                  : ''
              }`}
              style={typeFilter === 'todos' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgba(148, 163, 184, 0.2)'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'todos') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (typeFilter !== 'todos') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setTypeFilter('criticos')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                typeFilter === 'criticos' 
                  ? '' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={typeFilter === 'criticos' ? {
                backgroundColor: 'rgba(200, 21, 27, 0.15)',
                borderColor: 'rgba(200, 21, 27, 0.4)',
                color: '#f87171'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'criticos') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (typeFilter !== 'criticos') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Críticos
            </button>
            <button
              onClick={() => setTypeFilter('vencidos')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                typeFilter === 'vencidos' 
                  ? '' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={typeFilter === 'vencidos' ? {
                backgroundColor: 'rgba(200, 21, 27, 0.15)',
                borderColor: 'rgba(200, 21, 27, 0.4)',
                color: '#f87171'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'vencidos') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (typeFilter !== 'vencidos') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Vencidos
            </button>
          </div>
        </div>
        <div className="h-3 w-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="px-2.5 py-1 text-[10px] font-semibold rounded-lg border focus:outline-none focus:ring-2 transition-all"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            color: styles.text.secondary
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {[
            { key: 'todos', value: 'todos', label: 'Todos los agentes' },
            ...(Array.isArray(agentes) ? agentes
              .filter(agente => agente && (agente.idAgente || agente.id_agente || agente.id)) // Filtrar solo agentes válidos
              .map((agente, index) => ({
              key: agente?.idAgente || agente?.id_agente || agente?.id || `agente-${index}`,
              value: agente?.idAgente || agente?.id_agente || agente?.id || '',
              label: agente?.nombre || agente?.name || 'Sin nombre'
            })) : [])
          ].map(option => (
            <option key={option.key} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="h-3 w-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{color: styles.text.secondary}}>Acciones</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/app/alertas')}
              className="px-2 py-1 rounded-lg border transition-all hover:scale-105 flex items-center gap-1"
              style={{
                borderColor: casosCriticosCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(148, 163, 184, 0.2)',
                backgroundColor: casosCriticosCount > 0 
                  ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)')
                  : 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <AlertCircle className="w-3 h-3" style={{color: casosCriticosCount > 0 ? '#ef4444' : styles.text.secondary}} />
              {casosCriticosCount > 0 && (
                <span className="text-[9px] font-bold px-1 rounded-full" style={{
                  backgroundColor: '#ef4444',
                  color: 'white'
                }}>
                  {casosCriticosCount}
                </span>
              )}
            </button>
            
            <button
              onClick={() => navigate('/app/casos')}
              className="px-2 py-1 rounded-lg border transition-all hover:scale-105"
              style={{
                borderColor: 'rgba(148, 163, 184, 0.2)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Bandeja Global"
            >
              <Activity className="w-3 h-3" style={{color: styles.text.secondary}} />
            </button>
            
            <button
              onClick={() => navigate('/app/agentes')}
              className="px-2 py-1 rounded-lg border transition-all hover:scale-105"
              style={{
                borderColor: 'rgba(148, 163, 184, 0.2)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Gestión Agentes"
            >
              <Users className="w-3 h-3" style={{color: styles.text.secondary}} />
            </button>
            
            <button
              onClick={() => navigate('/app/casos/nuevo')}
              className="px-2 py-1 rounded-lg border transition-all hover:scale-105"
              style={{
                borderColor: 'rgba(200, 21, 27, 0.3)',
                backgroundColor: theme === 'dark' ? 'rgba(200, 21, 27, 0.1)' : 'rgba(200, 21, 27, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(200, 21, 27, 0.2)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="Nuevo Caso"
            >
              <Zap className="w-3 h-3" style={{color: '#c8151b'}} />
            </button>
          </div>
        </div>
        {(periodFilter !== 'hoy' || typeFilter !== 'todos' || agentFilter !== 'todos') && (
          <button
            onClick={() => {
              setPeriodFilter('hoy');
              setTypeFilter('todos');
              setAgentFilter('todos');
            }}
            className="ml-auto px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
            style={{color: styles.text.tertiary}}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = styles.text.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = styles.text.tertiary;
            }}
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        <Tooltip id="casos-abiertos" content="Total de casos activos en el sistema">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: 'rgba(59, 130, 246, 0.25)',
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.02)'
            }}
            onMouseEnter={(e) => {
              handleTooltipEnter('casos-abiertos');
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              handleTooltipLeave();
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <Activity className="w-6 h-6" style={{color: '#3b82f6'}} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#3b82f6'}}>
                  {casosAbiertosCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 flex-shrink-0" style={{color: '#3b82f6'}} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Abiertos</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                  Activos
                </p>
              </div>
            </div>
          </div>
        </Tooltip>

        <Tooltip id="casos-vencidos" content="Casos que han excedido el tiempo de SLA">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: casosVencidosCount > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(148, 163, 184, 0.2)',
              backgroundColor: casosVencidosCount > 0 
                ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.05)' : 'rgba(220, 38, 38, 0.02)')
                : styles.card.backgroundColor
            }}
            onMouseEnter={(e) => {
              handleTooltipEnter('casos-vencidos');
              e.currentTarget.style.borderColor = casosVencidosCount > 0 ? 'rgba(220, 38, 38, 0.4)' : 'rgba(148, 163, 184, 0.3)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              handleTooltipLeave();
              e.currentTarget.style.borderColor = casosVencidosCount > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(148, 163, 184, 0.2)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <AlertCircle className="w-6 h-6" style={{color: casosVencidosCount > 0 ? '#ef4444' : styles.text.tertiary}} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{color: casosVencidosCount > 0 ? '#ef4444' : styles.text.secondary}}>
                  {casosVencidosCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{color: casosVencidos.length > 0 ? '#ef4444' : styles.text.secondary}} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Vencidos</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: casosVencidos.length > 0 ? '#ef4444' : styles.text.tertiary}}>
                  {casosVencidos.length > 0 ? 'SLA excedido' : 'En tiempo'}
                </p>
              </div>
            </div>
          </div>
        </Tooltip>

        <Tooltip id="casos-totales" content="Total de casos en el sistema">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: 'rgba(59, 130, 246, 0.25)',
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.02)'
            }}
            onMouseEnter={(e) => {
              handleTooltipEnter('casos-totales');
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              handleTooltipLeave();
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <Activity className="w-6 h-6" style={{color: '#3b82f6'}} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#3b82f6'}}>
                  {casosTotalesCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 flex-shrink-0" style={{color: '#3b82f6'}} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Totales</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                  Todos los casos
                </p>
              </div>
            </div>
          </div>
        </Tooltip>

        <Tooltip id="casos-criticos" content="Casos que requieren atención inmediata">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: casosCriticos.length > 0 ? 'rgba(200, 21, 27, 0.25)' : 'rgba(148, 163, 184, 0.2)',
              backgroundColor: casosCriticos.length > 0 
                ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.05)' : 'rgba(200, 21, 27, 0.02)')
                : styles.card.backgroundColor
            }}
            onMouseEnter={(e) => {
              setShowTooltip('casos-criticos');
              e.currentTarget.style.borderColor = casosCriticosCount > 0 ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.3)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              setShowTooltip(null);
              e.currentTarget.style.borderColor = casosCriticosCount > 0 ? 'rgba(200, 21, 27, 0.25)' : 'rgba(148, 163, 184, 0.2)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <AlertCircle className="w-6 h-6" style={{color: casosCriticos.length > 0 ? '#f87171' : styles.text.tertiary}} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{color: casosCriticosCount > 0 ? '#f87171' : styles.text.secondary}}>
                  {casosCriticosCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{color: casosCriticosCount > 0 ? '#f87171' : styles.text.secondary}} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Críticos</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: casosCriticosCount > 0 ? '#f87171' : styles.text.tertiary}}>
                  {casosCriticosCount > 0 ? 'Requiere acción' : 'Bajo control'}
                </p>
              </div>
            </div>
          </div>
        </Tooltip>

        <Tooltip id="sla-promedio" content="Porcentaje de casos cumpliendo SLA">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: slaPromedio === null 
                ? 'rgba(148, 163, 184, 0.2)'
                : slaPromedio >= 90 
                  ? 'rgba(34, 197, 94, 0.25)' 
                  : slaPromedio >= 70 
                    ? 'rgba(245, 158, 11, 0.25)'
                    : 'rgba(200, 21, 27, 0.25)',
              backgroundColor: slaPromedio === null
                ? styles.card.backgroundColor
                : slaPromedio >= 90
                  ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.02)')
                  : slaPromedio >= 70
                    ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)')
                    : (theme === 'dark' ? 'rgba(200, 21, 27, 0.05)' : 'rgba(200, 21, 27, 0.02)')
            }}
            onMouseEnter={(e) => {
              handleTooltipEnter('sla-promedio');
              const currentBorder = e.currentTarget.style.borderColor;
              e.currentTarget.style.borderColor = currentBorder.replace('0.25', '0.4').replace('0.2', '0.3');
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              handleTooltipLeave();
              const currentBorder = e.currentTarget.style.borderColor;
              e.currentTarget.style.borderColor = currentBorder.replace('0.4', '0.25').replace('0.3', '0.2');
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <Clock className="w-6 h-6" style={{
                color: slaPromedio === null ? styles.text.tertiary :
                       slaPromedio >= 90 ? '#22c55e' : 
                       slaPromedio >= 70 ? '#fbbf24' : 
                       '#f87171'
              }} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{
                  color: slaPromedio === null ? styles.text.tertiary :
                         slaPromedio >= 90 ? '#22c55e' : 
                         slaPromedio >= 70 ? '#fbbf24' : 
                         '#f87171'
                }}>
                  {slaPromedio === null ? 'N/A' : `${slaPromedio}%`}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{
                    color: slaPromedio === null ? styles.text.secondary :
                           slaPromedio >= 90 ? '#22c55e' : 
                           slaPromedio >= 70 ? '#fbbf24' : 
                           styles.text.secondary
                  }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>SLA Promedio</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                  {slaPromedio === null ? 'Sin datos' : 
                   slaPromedio >= 90 ? 'Normal' : 
                   slaPromedio >= 70 ? 'En riesgo' : 
                   'Bajo el objetivo'}
                </p>
              </div>
            </div>
          </div>
        </Tooltip>

        <Tooltip id="agentes-online" content="Agentes disponibles del total">
          <div 
            className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
            style={{
              ...styles.card,
              borderColor: 'rgba(34, 197, 94, 0.25)',
              backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.02)'
            }}
            onMouseEnter={(e) => {
              handleTooltipEnter('agentes-online');
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              handleTooltipLeave();
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.25)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="absolute top-3 right-3">
              <Users className="w-6 h-6" style={{color: '#22c55e'}} />
            </div>
            <div className="flex items-start justify-between mb-2 pr-8">
              <div className="flex-1">
                <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#22c55e'}}>
                  {agentesActivos}/{totalAgentes}
                </p>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 flex-shrink-0" style={{color: '#22c55e'}} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Agentes Online</p>
                </div>
                <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                  Disponibles
                </p>
              </div>
            </div>
          </div>
        </Tooltip>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(200, 21, 27, 0.1)'}}>
                <AlertCircle className="w-4 h-4" style={{color: '#f87171'}} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{color: styles.text.primary}}>
              Casos Críticos / Escalamientos
            </h3>
                <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>
                  {casosCriticosOrdenados.length} caso{casosCriticosOrdenados.length !== 1 ? 's' : ''} requiere{casosCriticosOrdenados.length !== 1 ? 'n' : ''} atención
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="p-2 rounded-lg border transition-all hover:scale-105"
                style={{
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  color: styles.text.secondary
                }}
                title="Actualizar datos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate('/app/casos')}
                className="text-[10px] font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  color: styles.text.tertiary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = styles.text.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = styles.text.tertiary;
                }}
              >
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border shadow-sm overflow-hidden" style={{...styles.card}}>
              {casosCriticosOrdenados.length > 0 ? (
              <table className="w-full text-left">
                <thead className="border-b" style={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  borderColor: 'rgba(148, 163, 184, 0.2)'
                }}>
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>ID Caso</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Asunto</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Cliente</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Agente</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Prioridad</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Estado</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Tiempo</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: styles.text.secondary}}>Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                  {casosCriticosOrdenados.map((caso) => {
                  const isEscalado = caso.status === CaseStatus.ESCALADO;
                    const slaDias = caso.categoria?.slaDias || (caso as any).categoria?.sla_dias || 5;
                    const isVencido = caso.diasAbierto >= slaDias;
                    const priority = isEscalado ? 'Critica' : isVencido ? 'Alta' : 'Media';
                    const rawStatus = caso.status || (caso as any).estado;
                    const normalizedStatus = normalizeStatus(rawStatus);
                    const statusColors = getStatusColors(normalizedStatus);
                  
                  return (
                      <tr 
                      key={caso.id} 
                        className="transition-all duration-200 cursor-pointer group relative"
                      style={{
                          backgroundColor: 'transparent',
                          borderLeft: priority === 'Critica' ? '4px solid #c8151b' : 'none'
                      }}
                      onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }} 
                        onClick={() => navigate(`/app/casos/${caso.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold transition-colors" style={{color: styles.text.primary}}>
                            #{(caso as any).ticketNumber || caso.id}
                            </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <span className="text-xs font-semibold line-clamp-1" style={{color: styles.text.primary}}>
                              {caso.subject}
                              </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{color: styles.text.primary}}>
                              {caso.clientName || 'Sin cliente'}
                              </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {caso.agentName ? (
                              <>
                                <User className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
                                <span className="text-xs font-semibold" style={{color: styles.text.primary}}>
                                  {caso.agentName}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs italic" style={{color: styles.text.tertiary}}>
                                Sin asignar
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded"
                            style={{
                              color: priority === 'Critica' ? '#c8151b' : priority === 'Alta' ? '#f59e0b' : '#64748b',
                              backgroundColor: priority === 'Critica' 
                                ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.1)' : 'rgba(200, 21, 27, 0.05)')
                                : priority === 'Alta'
                                ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)')
                                : 'transparent'
                            }}
                          >
                            {priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: statusColors.color
                            }}
                          >
                            {rawStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isVencido ? (
                              <AlertCircle className="w-3.5 h-3.5" style={{color: '#c8151b'}} />
                            ) : (
                              <Clock className="w-3.5 h-3.5" style={{color: (slaDias - caso.diasAbierto) <= 1 ? '#f97316' : '#64748b'}} />
                            )}
                            {(() => {
                              const diasRestantes = slaDias - caso.diasAbierto;
                              const horasRestantes = Math.max(0, diasRestantes * 24);
                              if (isVencido) {
                                const diasVencido = caso.diasAbierto - slaDias;
                                return (
                                  <span className="text-[10px] font-semibold" style={{color: '#c8151b'}}>
                                    +{diasVencido}d vencido
                                  </span>
                                );
                              } else if (diasRestantes <= 1) {
                                return (
                                  <span className="text-[10px] font-semibold" style={{color: '#f97316'}}>
                                    {horasRestantes}h restantes
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-[10px] font-semibold" style={{color: '#64748b'}}>
                                    {diasRestantes}d restantes
                                  </span>
                                );
                              }
                            })()}
                        </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReasignar(e, caso.id);
                              }}
                              className="p-1.5 rounded-md transition-all"
                              style={{color: styles.text.tertiary}}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = styles.text.secondary;
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f1f5f9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = styles.text.tertiary;
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Reasignar caso"
                          >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEscalar(e, caso.id);
                              }}
                              className="p-1.5 rounded-md transition-all"
                              style={{color: styles.text.tertiary}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = styles.text.tertiary;
                            }}
                            title="Escalar caso"
                          >
                              <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                            <Eye className="w-3.5 h-3.5 transition-colors" style={{color: styles.text.tertiary}} />
                            <ChevronRight className="w-3.5 h-3.5 transition-colors group-hover:translate-x-0.5" style={{color: styles.text.tertiary}} />
                        </div>
                        </td>
                      </tr>
                  );
                  })}
                </tbody>
              </table>
              ) : (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)'}}>
                  <CheckCircle2 className="w-8 h-8" style={{color: '#22c55e'}} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{color: styles.text.primary}}>No hay casos críticos</p>
                <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>¡Buen trabajo! Todo está bajo control.</p>
                </div>
              )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(59, 130, 246, 0.1)'}}>
                <Users className="w-4 h-4" style={{color: '#3b82f6'}} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{color: styles.text.primary}}>
              Rendimiento de Agentes
            </h3>
                <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>
                  {agentFilter !== 'todos' 
                    ? `Agente seleccionado: ${agentes.find(a => a.idAgente === agentFilter)?.nombre || 'N/A'}`
                    : `${agentes.length} agente${agentes.length !== 1 ? 's' : ''} en el equipo`
                  }
                </p>
              </div>
            </div>
            {agentFilter === 'todos' && agentes.length > 4 && (
              <button 
                onClick={() => navigate('/app/agentes')}
                className="text-sm font-semibold flex items-center gap-1.5 transition-colors"
                style={{color: styles.text.tertiary}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = styles.text.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = styles.text.tertiary;
                }}
              >
                Ver todos <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
            {agentFilter !== 'todos' && (
              <button 
                onClick={() => setAgentFilter('todos')}
                className="text-sm font-semibold flex items-center gap-1.5 transition-colors"
                style={{color: styles.text.tertiary}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = styles.text.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = styles.text.tertiary;
                }}
              >
                Ver todos <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{...styles.card}}>
            {agentes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(agentFilter !== 'todos' 
                  ? agentes.filter(a => (a.idAgente || a.id_agente || a.id) === agentFilter)
                  : agentes // Mostrar TODOS los agentes, sin filtros
                ).map((agente, index) => {
                  // Log para debuggear
                  if (index === 0) {
                    console.log('[SupervisorPanel] Renderizando agentes:', agentes.length, 'agentes en total');
                  }
                  const estadoColors = {
                    'Activo': { 
                      dotColor: '#22c55e', 
                      bgColor: 'rgba(34, 197, 94, 0.15)', 
                      borderColor: 'rgba(34, 197, 94, 0.4)',
                      textColor: '#16a34a',
                      status: 'Activo' 
                    },
                    'Vacaciones': { 
                      dotColor: '#f59e0b', 
                      bgColor: 'rgba(245, 158, 11, 0.15)', 
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      textColor: '#d97706',
                      status: 'Vacaciones' 
                    },
                    'Inactivo': { 
                      dotColor: '#94a3b8', 
                      bgColor: 'rgba(148, 163, 184, 0.15)', 
                      borderColor: 'rgba(148, 163, 184, 0.4)',
                      textColor: '#64748b',
                      status: 'Inactivo' 
                    }
                  };
                  const estado = estadoColors[agente.estado as keyof typeof estadoColors] || estadoColors.Inactivo;
                  const stats = getAgenteStats(agente.idAgente);
                  
                  return (
                    <div key={agente.idAgente} className="p-3.5 rounded-xl transition-all border-2 shadow-sm" 
                      style={{
                        ...styles.card,
                        borderColor: estado.borderColor,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }} 
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                        e.currentTarget.style.borderColor = estado.borderColor;
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }} 
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.backgroundColor = styles.card.backgroundColor;
                        e.currentTarget.style.borderColor = estado.borderColor;
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                      {/* Header: Avatar, Nombre y Badge de Estado */}
                      <div className="flex items-center gap-2 mb-3">
                        {/* Avatar con inicial */}
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-sm"
                          style={{
                            backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                            color: styles.text.primary
                          }}
                        >
                          {agente.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate" style={{color: styles.text.primary}}>{agente.nombre}</p>
                            {/* Badge discreto de estado */}
                            <span 
                              className="text-[10px] font-medium flex-shrink-0 flex items-center gap-0.5"
                              style={{
                                color: estado.textColor
                              }}
                            >
                              <span style={{fontSize: '8px'}}>●</span>
                              {estado.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* SLA como KPI principal */}
                      <div className="mb-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <p 
                            className="text-2xl font-black leading-none"
                            style={{
                              color: stats.cumplimientoSLA === null ? '#94a3b8' :
                                     stats.cumplimientoSLA >= 90 ? '#22c55e' :
                                     stats.cumplimientoSLA >= 70 ? '#f59e0b' :
                                     '#ef4444'
                            }}
                          >
                            {stats.cumplimientoSLA === null ? 'N/A' : `${stats.cumplimientoSLA}%`}
                          </p>
                          <span className="text-[10px] font-semibold" style={{color: styles.text.tertiary}}>SLA</span>
                        </div>
                      </div>
                      
                      {/* Casos y Críticos en una línea */}
                      <div className="mb-2.5">
                        <p className="text-xs font-medium" style={{color: styles.text.secondary}}>
                          <span style={{color: styles.text.primary}}>Casos: {stats.casos}</span>
                          <span className="mx-1.5" style={{color: styles.text.tertiary}}>•</span>
                          <span style={{color: stats.criticos > 0 ? '#dc2626' : styles.text.primary}}>Críticos: {stats.criticos}</span>
                        </p>
                      </div>
                      
                      {/* Tiempo promedio con icono */}
                      <div className="pt-2.5 border-t" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs">⏱</span>
                          <span className="text-xs font-bold" style={{
                            color: stats.tiempoPromedio === 'N/A' ? '#94a3b8' : styles.text.primary
                          }}>
                            {stats.tiempoPromedio}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>Tiempo promedio</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="font-medium text-sm" style={{color: styles.text.tertiary}}>No hay agentes registrados</p>
              </div>
            )}
            {agentes.length > 4 && (
              <button 
                onClick={() => navigate('/app/agentes')}
                className="w-full mt-5 py-2.5 text-sm font-semibold border rounded-xl transition-all"
                style={{color: styles.text.tertiary, borderColor: 'rgba(148, 163, 184, 0.3)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                  e.currentTarget.style.color = styles.text.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = styles.text.tertiary;
                }}
              >
                Ver todos ({agentes.length} agentes)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorPanel;
