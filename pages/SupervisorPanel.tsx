import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente } from '../types';
import { STATE_COLORS } from '../constants';
import { AlertCircle, Clock, Users, ArrowUpRight, ChevronRight, Activity, Info, Filter, UserPlus, Bell, ArrowRightLeft, TrendingUp, TrendingDown, X, User, CheckCircle2, Eye } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type FilterPeriod = 'hoy' | 'semana' | 'mes';
type FilterType = 'todos' | 'criticos' | 'vencidos' | string;

const SupervisorPanel: React.FC = () => {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('hoy');
  const [typeFilter, setTypeFilter] = useState<FilterType>('todos');
  const [agentFilter, setAgentFilter] = useState<string>('todos');
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    // Intervalo aumentado a 60 segundos para reducir llamadas
    const interval = setInterval(() => {
      loadData();
    }, 60000); // 30s -> 60s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [casosData, agentesData] = await Promise.all([
        api.getCases(),
        api.getAgentes()
      ]);
      setCasos(casosData);
      setAgentes(agentesData);
      // Guardar en localStorage para que Layout pueda mostrarlo en el header
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const casosAbiertos = useMemo(() => {
    return casos.filter(c => c.status !== CaseStatus.RESUELTO);
  }, [casos]);
  
  const casosCriticos = useMemo(() => {
    return casos.filter(c => {
      // Validar que categoria existe antes de acceder a slaDias
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5; // Default 5 días
      return c.diasAbierto >= slaDias || c.status === CaseStatus.ESCALADO;
    });
  }, [casos]);

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
  
  const casosVencidos = casosAbiertos.filter(c => {
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    return c.diasAbierto > slaDias;
  });
  const casosEnRiesgo = casosAbiertos.filter(c => {
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    const diasRestantes = slaDias - c.diasAbierto;
    return diasRestantes > 0 && diasRestantes <= 1;
  });
  const casosDentroSLA = casosAbiertos.filter(c => {
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    const diasRestantes = slaDias - c.diasAbierto;
    return diasRestantes > 1;
  });

  // Si no hay casos abiertos, el SLA no puede ser 100%, debe ser null
  const slaPromedio = casosAbiertos.length > 0 
    ? Math.round((casosDentroSLA.length / casosAbiertos.length) * 100)
    : null;

  const agentesActivos = agentes.filter(a => a.estado === 'Activo').length;
  const totalAgentes = agentes.length;

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

  // Función para normalizar estado
  const normalizeStatus = (status: string | CaseStatus | undefined): CaseStatus => {
    if (!status) return CaseStatus.NUEVO;
    const statusStr = String(status).trim();
    const statusValues = Object.values(CaseStatus);
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '');
      const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
      return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
    });
    return (matchedStatus as CaseStatus) || CaseStatus.NUEVO;
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
    console.log('Notificar agente:', casoId);
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

  const Tooltip: React.FC<{ id: string; content: string; children: React.ReactNode }> = ({ id, content, children }) => (
    <div className="relative group">
      {children}
      {showTooltip === id && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );

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
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
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
            ...(Array.isArray(agentes) ? agentes.map((agente, index) => ({
              key: agente?.idAgente || `agente-${index}`,
              value: agente?.idAgente || '',
              label: agente?.nombre || 'Sin nombre'
            })) : [])
          ].map(option => (
            <option key={option.key} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
        <Tooltip id="casos-abiertos" content="Total de casos activos en el sistema">
          <div 
            className="p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{...styles.card}}
            onMouseEnter={() => setShowTooltip('casos-abiertos')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>Casos Abiertos</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgb(15, 23, 42)'}}>
                <Activity className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-black mb-0.5" style={{color: styles.text.primary}}>{casosAbiertos.length}</h3>
            <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>Normal</p>
          </div>
        </Tooltip>

        <Tooltip id="casos-criticos" content="Casos que requieren atención inmediata">
          <div 
            className="p-4 rounded-xl border-2 shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            onMouseEnter={() => setShowTooltip('casos-criticos')}
            onMouseLeave={() => setShowTooltip(null)}
            style={{
              ...styles.card,
              borderColor: casosCriticos.length > 0 ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.2)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>Casos Críticos</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"               style={{
                backgroundColor: casosCriticos.length > 0 ? 'rgba(200, 21, 27, 0.2)' : (theme === 'dark' ? '#0f172a' : '#f8fafc')
              }}>
                <AlertCircle className="w-4 h-4" style={{color: casosCriticos.length > 0 ? '#f87171' : styles.text.tertiary}} />
              </div>
            </div>
            <h3 className="text-lg font-black mb-0.5" style={{color: casosCriticos.length > 0 ? '#f87171' : styles.text.secondary}}>{casosCriticos.length}</h3>
            <p className="text-[10px] font-medium" style={{color: casosCriticos.length > 0 ? '#f87171' : styles.text.tertiary}}>
              {casosCriticos.length > 0 ? 'Requiere acción' : 'Bajo control'}
            </p>
          </div>
        </Tooltip>

        <Tooltip id="sla-promedio" content="Porcentaje de casos cumpliendo SLA">
          <div 
            className="p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{...styles.card}}
            onMouseEnter={() => setShowTooltip('sla-promedio')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>SLA Promedio</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                backgroundColor: slaPromedio === null ? 'rgba(148, 163, 184, 0.2)' :
                                 slaPromedio >= 90 ? 'rgba(34, 197, 94, 0.2)' : 
                                 slaPromedio >= 70 ? 'rgba(245, 158, 11, 0.2)' : 
                                 'rgba(200, 21, 27, 0.2)'
              }}>
                <Clock className="w-4 h-4" style={{
                  color: slaPromedio === null ? styles.text.tertiary :
                         slaPromedio >= 90 ? '#22c55e' : 
                         slaPromedio >= 70 ? '#fbbf24' : 
                         '#f87171'
                }} />
              </div>
            </div>
            <h3 className="text-lg font-black mb-0.5" style={{
              color: slaPromedio === null ? styles.text.tertiary :
                     slaPromedio >= 90 ? '#22c55e' : 
                     slaPromedio >= 70 ? '#fbbf24' : 
                     '#f87171'
            }}>{slaPromedio === null ? 'N/A' : `${slaPromedio}%`}</h3>
            <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>
              {slaPromedio === null ? 'Sin datos' : 
               slaPromedio >= 90 ? 'Normal' : 
               slaPromedio >= 70 ? 'En riesgo' : 
               'Bajo el objetivo'}
            </p>
          </div>
        </Tooltip>

        <Tooltip id="agentes-online" content="Agentes disponibles del total">
          <div 
            className="p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{...styles.card}}
            onMouseEnter={() => setShowTooltip('agentes-online')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>Agentes Online</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(34, 197, 94, 0.2)'}}>
                <Users className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <h3 className="text-lg font-black mb-0.5" style={{color: '#22c55e'}}>{agentesActivos}/{totalAgentes}</h3>
            <p className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>Disponibles</p>
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
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Prioridad</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Estado</th>
                    <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>SLA</th>
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
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: priority === 'Critica' ? '#c8151b' : priority === 'Alta' ? '#f59e0b' : '#64748b'
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
                            <Clock className="w-3.5 h-3.5" style={{color: isVencido ? '#c8151b' : '#64748b'}} />
                            <span 
                              className="text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                color: isVencido ? '#c8151b' : '#64748b'
                              }}
                            >
                              {isVencido ? 'Vencido' : `${caso.diasAbierto} días`}
                            </span>
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
                  {agentes.length} agente{agentes.length !== 1 ? 's' : ''} en el equipo
                </p>
              </div>
            </div>
            {agentes.length > 4 && (
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
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{...styles.card}}>
            {agentes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agentes.slice(0, 4).map((agente) => {
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
                    <div key={agente.idAgente} className="p-4 rounded-xl transition-all border-2 shadow-sm" 
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
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2" 
                            style={{
                              backgroundColor: estado.dotColor,
                              borderColor: styles.card.backgroundColor,
                              boxShadow: `0 0 0 2px ${estado.dotColor}40`
                            }}
                          ></div>
                          <p className="text-sm font-bold truncate" style={{color: styles.text.primary}}>{agente.nombre}</p>
                        </div>
                        <span 
                          className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                          style={{
                            color: estado.textColor
                          }}
                        >
                          {estado.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold mb-1 truncate text-[10px]" style={{color: styles.text.tertiary}}>Casos</p>
                          <p className="text-base font-black" style={{color: styles.text.primary}}>{stats.casos}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold mb-1 truncate text-[10px]" style={{color: styles.text.tertiary}}>Críticos</p>
                          <p className="text-base font-black" style={stats.criticos > 0 ? {color: '#dc2626'} : {color: styles.text.secondary}}>
                            {stats.criticos}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold mb-1 truncate text-[10px]" style={{color: styles.text.tertiary}}>SLA</p>
                          <p 
                            className="text-base font-black"
                            style={{
                              color: stats.cumplimientoSLA === null ? styles.text.tertiary :
                                     stats.cumplimientoSLA >= 90 ? '#16a34a' :
                                     stats.cumplimientoSLA >= 70 ? '#d97706' :
                                     '#dc2626'
                            }}
                          >
                            {stats.cumplimientoSLA === null ? 'N/A' : `${stats.cumplimientoSLA}%`}
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate" style={{color: styles.text.tertiary}}>Tiempo promedio</span>
                          <span className="font-bold flex-shrink-0 ml-2" style={{color: styles.text.secondary}}>{stats.tiempoPromedio}</span>
                        </div>
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
