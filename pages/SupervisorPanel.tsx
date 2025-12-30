import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente } from '../types';
import { STATE_COLORS } from '../constants';
import { AlertCircle, Clock, Users, ArrowUpRight, ChevronRight, Activity, Info, RefreshCw, Filter, UserPlus, Bell, ArrowRightLeft, TrendingUp, TrendingDown, X } from 'lucide-react';

type FilterPeriod = 'hoy' | 'semana' | 'mes';
type FilterType = 'todos' | 'criticos' | 'vencidos' | string;

const SupervisorPanel: React.FC = () => {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('hoy');
  const [typeFilter, setTypeFilter] = useState<FilterType>('todos');
  const [agentFilter, setAgentFilter] = useState<string>('todos');
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 30000);
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
      setLastUpdate(new Date());
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
    return casos.filter(c => c.diasAbierto >= c.categoria.slaDias || c.status === CaseStatus.ESCALADO);
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
      filtered = filtered.filter(c => c.diasAbierto >= c.categoria.slaDias || c.status === CaseStatus.ESCALADO);
    } else if (typeFilter === 'vencidos') {
      filtered = filtered.filter(c => c.diasAbierto > c.categoria.slaDias);
    }

    if (agentFilter !== 'todos') {
      filtered = filtered.filter(c => c.agenteAsignado.idAgente === agentFilter);
    }

    return filtered;
  }, [casos, periodFilter, typeFilter, agentFilter]);
  
  const casosVencidos = casosAbiertos.filter(c => c.diasAbierto > c.categoria.slaDias);
  const casosEnRiesgo = casosAbiertos.filter(c => {
    const diasRestantes = c.categoria.slaDias - c.diasAbierto;
    return diasRestantes > 0 && diasRestantes <= 1;
  });
  const casosDentroSLA = casosAbiertos.filter(c => {
    const diasRestantes = c.categoria.slaDias - c.diasAbierto;
    return diasRestantes > 1;
  });

  const slaPromedio = casosAbiertos.length > 0 
    ? Math.round((casosDentroSLA.length / casosAbiertos.length) * 100)
    : 100;

  const agentesActivos = agentes.filter(a => a.estado === 'Activo').length;
  const totalAgentes = agentes.length;

  const casosCriticosOrdenados = useMemo(() => {
    return [...casosCriticos].sort((a, b) => {
      if (a.status === CaseStatus.ESCALADO && b.status !== CaseStatus.ESCALADO) return -1;
      if (a.status !== CaseStatus.ESCALADO && b.status === CaseStatus.ESCALADO) return 1;
      return b.diasAbierto - a.diasAbierto;
    });
  }, [casosCriticos]);

  const casosCriticosHoy = useMemo(() => {
    return casosCriticosOrdenados.filter(c => {
      const hoy = new Date().toDateString();
      return new Date(c.createdAt).toDateString() === hoy || c.diasAbierto >= c.categoria.slaDias;
    });
  }, [casosCriticosOrdenados]);

  const slaAyer = 94;
  const slaCambio = slaPromedio - slaAyer;

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
    if (caso.diasAbierto > caso.categoria.slaDias) return 'bg-red-500';
    if (caso.diasAbierto >= caso.categoria.slaDias - 1) return 'bg-amber-500';
    return 'bg-orange-400';
  };

  const getAgenteStats = (agenteId: string) => {
    const casosAgente = casosAbiertos.filter(c => c.agenteAsignado.idAgente === agenteId);
    const criticosAgente = casosAgente.filter(c => c.diasAbierto >= c.categoria.slaDias || c.status === CaseStatus.ESCALADO);
    const dentroSLA = casosAgente.filter(c => {
      const diasRestantes = c.categoria.slaDias - c.diasAbierto;
      return diasRestantes > 0;
    });
    const cumplimientoSLA = casosAgente.length > 0 
      ? Math.round((dentroSLA.length / casosAgente.length) * 100)
      : 100;
    
    return {
      casos: casosAgente.length,
      criticos: criticosAgente.length,
      cumplimientoSLA,
      tiempoPromedio: '2.5h'
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

  const SkeletonCard = () => (
    <div className="p-6 rounded-2xl border shadow-sm animate-pulse" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
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
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium" style={{color: '#94a3b8'}}>
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{color: '#94a3b8'}}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.color = '#cbd5e1';
                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {casosCriticosHoy.length > 0 && (
            <div className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2" style={{backgroundColor: 'rgba(200, 21, 27, 0.1)', border: '1px solid rgba(200, 21, 27, 0.2)', color: 'var(--color-brand-red)'}}>
              <AlertCircle className="w-4 h-4" />
              {casosCriticosHoy.length} caso{casosCriticosHoy.length !== 1 ? 's' : ''} crítico{casosCriticosHoy.length !== 1 ? 's' : ''} requiere acción
            </div>
          )}
          {slaCambio !== 0 && (
            <div className="px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 text-xs border" style={slaCambio > 0 ? {
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              borderColor: 'rgba(34, 197, 94, 0.3)',
              color: '#22c55e'
            } : {
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: '#fbbf24'
            }}>
              {slaCambio > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              SLA {slaCambio > 0 ? 'mejoró' : 'en riesgo'} {Math.abs(slaCambio)}% vs ayer
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{color: '#94a3b8'}} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{color: '#cbd5e1'}}>Tiempo</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPeriodFilter('hoy')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                periodFilter === 'hoy' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={periodFilter === 'hoy' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgb(15, 23, 42)'
              } : {
                backgroundColor: 'transparent',
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'hoy') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                periodFilter === 'semana' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={periodFilter === 'semana' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgb(15, 23, 42)'
              } : {
                backgroundColor: 'transparent',
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'semana') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                periodFilter === 'mes' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={periodFilter === 'mes' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgb(15, 23, 42)'
              } : {
                backgroundColor: 'transparent',
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (periodFilter !== 'mes') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
        <div className="h-4 w-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{color: '#cbd5e1'}}>Estado</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTypeFilter('todos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                typeFilter === 'todos' 
                  ? 'text-white' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={typeFilter === 'todos' ? {
                backgroundColor: 'rgb(15, 23, 42)',
                borderColor: 'rgb(15, 23, 42)'
              } : {
                backgroundColor: 'transparent',
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'todos') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
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
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'criticos') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
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
                color: '#cbd5e1'
              }}
              onMouseEnter={(e) => {
                if (typeFilter !== 'vencidos') {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
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
        <div className="h-4 w-px" style={{backgroundColor: 'rgba(148, 163, 184, 0.2)'}}></div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border focus:outline-none focus:ring-2 transition-all"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            color: '#cbd5e1'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <option value="todos">Todos los agentes</option>
          {agentes.map(agente => (
            <option key={agente.idAgente} value={agente.idAgente}>{agente.nombre}</option>
          ))}
        </select>
        {(periodFilter !== 'hoy' || typeFilter !== 'todos' || agentFilter !== 'todos') && (
          <button
            onClick={() => {
              setPeriodFilter('hoy');
              setTypeFilter('todos');
              setAgentFilter('todos');
            }}
            className="ml-auto px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            style={{color: '#94a3b8'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <Tooltip id="casos-abiertos" content="Total de casos activos en el sistema">
          <div 
            className="p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}
            onMouseEnter={() => setShowTooltip('casos-abiertos')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#94a3b8'}}>Casos Abiertos</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: '#64748b'}} />
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgb(15, 23, 42)'}}>
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-black mb-1" style={{color: '#ffffff'}}>{casosAbiertos.length}</h3>
            <p className="text-xs font-medium" style={{color: '#94a3b8'}}>Normal</p>
          </div>
        </Tooltip>

        <Tooltip id="casos-criticos" content="Casos que requieren atención inmediata">
          <div 
            className="p-5 rounded-2xl border-2 shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            onMouseEnter={() => setShowTooltip('casos-criticos')}
            onMouseLeave={() => setShowTooltip(null)}
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              borderColor: casosCriticos.length > 0 ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.15)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#94a3b8'}}>Casos Críticos</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: '#64748b'}} />
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                backgroundColor: casosCriticos.length > 0 ? 'rgba(200, 21, 27, 0.2)' : 'rgba(30, 41, 59, 0.6)'
              }}>
                <AlertCircle className="w-5 h-5" style={{color: casosCriticos.length > 0 ? '#f87171' : '#94a3b8'}} />
              </div>
            </div>
            <h3 className="text-2xl font-black mb-1" style={{color: casosCriticos.length > 0 ? '#f87171' : '#cbd5e1'}}>{casosCriticos.length}</h3>
            <p className="text-xs font-medium" style={{color: casosCriticos.length > 0 ? '#f87171' : '#94a3b8'}}>
              {casosCriticos.length > 0 ? 'Requiere acción' : 'Bajo control'}
            </p>
          </div>
        </Tooltip>

        <Tooltip id="sla-promedio" content="Porcentaje de casos cumpliendo SLA">
          <div 
            className="p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}
            onMouseEnter={() => setShowTooltip('sla-promedio')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#94a3b8'}}>SLA Promedio</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: '#64748b'}} />
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                backgroundColor: slaPromedio >= 90 ? 'rgba(34, 197, 94, 0.2)' : slaPromedio >= 70 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(200, 21, 27, 0.2)'
              }}>
                <Clock className="w-5 h-5" style={{
                  color: slaPromedio >= 90 ? '#22c55e' : slaPromedio >= 70 ? '#fbbf24' : '#f87171'
                }} />
              </div>
            </div>
            <h3 className="text-2xl font-black mb-1" style={{
              color: slaPromedio >= 90 ? '#22c55e' : slaPromedio >= 70 ? '#fbbf24' : '#f87171'
            }}>{slaPromedio}%</h3>
            <p className="text-xs font-medium" style={{color: '#94a3b8'}}>
              {slaPromedio >= 90 ? 'Normal' : slaPromedio >= 70 ? 'En riesgo' : 'Bajo el objetivo'}
            </p>
          </div>
        </Tooltip>

        <Tooltip id="agentes-online" content="Agentes disponibles del total">
          <div 
            className="p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
            style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}
            onMouseEnter={() => setShowTooltip('agentes-online')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#94a3b8'}}>Agentes Online</p>
                <Info className="w-3 h-3 flex-shrink-0" style={{color: '#64748b'}} />
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor: 'rgba(34, 197, 94, 0.2)'}}>
                <Users className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <h3 className="text-2xl font-black mb-1" style={{color: '#22c55e'}}>{agentesActivos}/{totalAgentes}</h3>
            <p className="text-xs font-medium" style={{color: '#94a3b8'}}>Disponibles</p>
          </div>
        </Tooltip>
      </div>

      <div className="space-y-8">
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{color: '#ffffff'}}>
              <AlertCircle className="w-5 h-5" style={{color: '#f87171'}} /> 
              Casos Críticos / Escalamientos
            </h3>
            <button 
              onClick={() => navigate('/app/casos')}
              className="text-sm font-semibold flex items-center gap-1.5 transition-colors"
              style={{color: '#94a3b8'}}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              Ver todos <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
            <div className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.1)'}}>
              {casosCriticosOrdenados.length > 0 ? (
                casosCriticosOrdenados.map(caso => {
                  const isEscalado = caso.status === CaseStatus.ESCALADO;
                  const isVencido = caso.diasAbierto > caso.categoria.slaDias;
                  
                  return (
                    <div 
                      key={caso.id} 
                      onClick={() => navigate(`/app/casos/${caso.id}`)}
                      className={`p-5 transition-all cursor-pointer group border-l-4`}
                      style={{
                        backgroundColor: isEscalado ? 'rgba(200, 21, 27, 0.1)' : isVencido ? 'rgba(200, 21, 27, 0.05)' : 'transparent',
                        borderLeftColor: isEscalado ? '#f87171' : isVencido ? '#f87171' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isEscalado && !isVencido) {
                          e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isEscalado && !isVencido) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm font-black" style={{color: '#ffffff'}}>{caso.id}</span>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${STATE_COLORS[caso.status]}`}>
                              {caso.status}
                            </span>
                            {isEscalado && (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase" style={{
                                backgroundColor: 'rgba(200, 21, 27, 0.2)',
                                borderColor: 'rgba(200, 21, 27, 0.4)',
                                color: '#f87171'
                              }}>
                                Escalado
                              </span>
                            )}
                          </div>
                          <p className="text-base font-semibold truncate mb-2" style={{color: '#ffffff'}}>{caso.subject}</p>
                          <div className="flex items-center gap-4 text-xs flex-wrap" style={{color: '#94a3b8'}}>
                            <span>Asignado a: <span className="font-semibold" style={{color: '#cbd5e1'}}>{caso.agenteAsignado.nombre}</span></span>
                            {isVencido && (
                              <span className="flex items-center gap-1 font-medium" style={{color: '#f87171'}}>
                                <Clock className="w-3 h-3" />
                                SLA vencido · {caso.diasAbierto} días
                              </span>
                            )}
                            {!isVencido && (
                              <span style={{color: '#64748b'}}>{caso.diasAbierto} días abierto</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 rounded-lg p-1" style={{backgroundColor: 'rgba(30, 41, 59, 0.6)'}}>
                          <button
                            onClick={(e) => handleReasignar(e, caso.id)}
                            className="p-2 rounded-md transition-all"
                            style={{color: '#94a3b8'}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#cbd5e1';
                              e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#94a3b8';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Reasignar caso"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleEscalar(e, caso.id)}
                            className="p-2 rounded-md transition-all"
                            style={{color: '#94a3b8'}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#94a3b8';
                            }}
                            title="Escalar caso"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleNotificar(e, caso.id)}
                            className="p-2 rounded-md transition-all"
                            style={{color: '#94a3b8'}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#cbd5e1';
                              e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#94a3b8';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Notificar agente"
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 transition-colors ml-1" style={{color: '#64748b'}} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center">
                  <p className="font-medium italic" style={{color: '#94a3b8'}}>No hay casos críticos actualmente. ¡Buen trabajo!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{color: '#ffffff'}}>
              <Users className="w-5 h-5" style={{color: '#94a3b8'}} /> 
              Rendimiento de Agentes
            </h3>
            {agentes.length > 4 && (
              <button 
                onClick={() => navigate('/app/agentes')}
                className="text-sm font-semibold flex items-center gap-1.5 transition-colors"
                style={{color: '#94a3b8'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                Ver todos <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
            {agentes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agentes.slice(0, 4).map((agente) => {
                  const estadoColors = {
                    'Activo': { color: 'bg-green-500', status: 'Activo' },
                    'Vacaciones': { color: 'bg-amber-400', status: 'Vacaciones' },
                    'Inactivo': { color: 'bg-slate-400', status: 'Inactivo' }
                  };
                  const estado = estadoColors[agente.estado as keyof typeof estadoColors] || estadoColors.Inactivo;
                  const stats = getAgenteStats(agente.idAgente);
                  
                  return (
                    <div key={agente.idAgente} className="p-4 rounded-xl transition-colors border" style={{backgroundColor: 'rgba(30, 41, 59, 0.3)', borderColor: 'rgba(148, 163, 184, 0.15)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)'; }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${estado.color} flex-shrink-0`}></div>
                          <p className="text-sm font-bold truncate" style={{color: '#ffffff'}}>{agente.nombre}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 border ${
                          estado.status === 'Activo' ? 'bg-green-900/30 text-green-400 border-green-600/40' :
                          estado.status === 'Vacaciones' ? 'bg-amber-900/30 text-amber-400 border-amber-600/40' :
                          'bg-slate-700/30 text-slate-400 border-slate-600/40'
                        }`}>
                          {estado.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div className="min-w-0">
                          <p className="font-medium mb-1 truncate" style={{color: '#94a3b8'}}>Casos</p>
                          <p className="text-base font-black" style={{color: '#ffffff'}}>{stats.casos}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium mb-1 truncate" style={{color: '#94a3b8'}}>Críticos</p>
                          <p className="text-base font-black" style={stats.criticos > 0 ? {color: '#f87171'} : {color: '#cbd5e1'}}>
                            {stats.criticos}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium mb-1 truncate" style={{color: '#94a3b8'}}>SLA</p>
                          <p 
                            className="text-base font-black"
                            style={{
                              color: stats.cumplimientoSLA >= 90 ? '#22c55e' :
                                     stats.cumplimientoSLA >= 70 ? '#fbbf24' :
                                     '#f87171'
                            }}
                          >
                            {stats.cumplimientoSLA}%
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate" style={{color: '#94a3b8'}}>Tiempo promedio</span>
                          <span className="font-bold flex-shrink-0 ml-2" style={{color: '#cbd5e1'}}>{stats.tiempoPromedio}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="font-medium text-sm" style={{color: '#94a3b8'}}>No hay agentes registrados</p>
              </div>
            )}
            {agentes.length > 4 && (
              <button 
                onClick={() => navigate('/app/agentes')}
                className="w-full mt-5 py-2.5 text-sm font-semibold border rounded-xl transition-all"
                style={{color: '#94a3b8', borderColor: 'rgba(148, 163, 184, 0.3)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
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
