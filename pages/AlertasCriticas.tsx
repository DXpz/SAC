import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus } from '../types';
import { STATE_COLORS } from '../constants';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ShieldAlert, 
  Clock, 
  AlertTriangle, 
  Eye,
  CheckCircle2,
  Timer,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Grid3x3,
  List,
  User,
  X
} from 'lucide-react';
import AnimatedNumber from '../components/AnimatedNumber';
import LoadingScreen from '../components/LoadingScreen';

type Priority = 'Critica' | 'Alta' | 'Media';

interface CaseWithPriority extends Caso {
  priority: Priority;
  horasParaVencimiento?: number;
}

// Función para normalizar el estado del caso
const normalizeStatus = (status: string | CaseStatus | undefined): CaseStatus => {
  if (!status) return CaseStatus.NUEVO;
  const statusStr = String(status).trim();
  // Buscar coincidencia exacta o por valor del enum
  const statusValues = Object.values(CaseStatus);
  const matchedStatus = statusValues.find(s => {
    const sNormalized = s.toLowerCase().replace(/\s+/g, '');
    const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
    return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
  });
  return (matchedStatus as CaseStatus) || CaseStatus.NUEVO;
};

const AlertasCriticas: React.FC = () => {
  const [criticos, setCriticos] = useState<CaseWithPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'Critica' | 'Alta' | 'Media'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const location = useLocation();

  const loadClientes = async () => {
    try {
      const clientesList = await api.getClientes();
      setClientes(clientesList);
      return clientesList;
    } catch (error) {
      return [];
    }
  };

  const enrichCasesWithClients = (cases: Caso[], clientesList: any[]): Caso[] => {
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
      const clientesList = await loadClientes();
      const list = await api.getCases();
      const enriched = enrichCasesWithClients(list, clientesList);
      const filtered = enriched.filter(c => {
        // Excluir casos resueltos o cerrados (a menos que estén escalados)
        const normalizedStatus = normalizeStatus(c.status);
        if (normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO) {
          // Solo incluir si está escalado
          return normalizedStatus === CaseStatus.ESCALADO;
        }
        
        const slaDias = c.categoria?.slaDias || 5;
        const diasAbierto = c.diasAbierto || 0;
        
        // Caso crítico si:
        // 1. Los días abiertos son >= al SLA (vencido)
        // 2. Está escalado
        // 3. Le queda 1 día o menos para vencer (en riesgo)
        const isVencido = diasAbierto >= slaDias;
        const isEscalado = normalizedStatus === CaseStatus.ESCALADO;
        const isEnRiesgo = (slaDias - diasAbierto <= 1) && diasAbierto > 0 && diasAbierto < slaDias;
        
        console.log('[AlertasCriticas] Evaluando caso:', {
          id: c.id,
          ticketNumber: c.ticketNumber,
          diasAbierto: diasAbierto,
          slaDias: slaDias,
          status: c.status,
          normalizedStatus: normalizedStatus,
          isVencido: isVencido,
          isEscalado: isEscalado,
          isEnRiesgo: isEnRiesgo,
          esCritico: isVencido || isEscalado || isEnRiesgo
        });
        
        return isVencido || isEscalado || isEnRiesgo;
      });
      
      const prioritized = prioritizeCases(filtered);
      setCriticos(prioritized);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Ya no usamos setInterval, solo actualizamos cuando cambia la vista
  }, [location.pathname]);

  const prioritizeCases = (cases: Caso[]): CaseWithPriority[] => {
    return cases.map(caso => {
      let priority: Priority = 'Media';
      
      const slaDias = caso.categoria?.slaDias || 5;
      if (caso.status === CaseStatus.ESCALADO) {
        priority = 'Critica';
      } else if (caso.diasAbierto >= slaDias) {
        priority = 'Alta';
      } else if (caso.status === CaseStatus.EN_PROCESO) {
        priority = 'Alta';
      }

      const diasRestantes = slaDias - caso.diasAbierto;
      const horasParaVencimiento = diasRestantes > 0 ? diasRestantes * 24 : 0;

      return {
        ...caso,
        priority,
        horasParaVencimiento
      };
    }).sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { Critica: 3, Alta: 2, Media: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.diasAbierto - a.diasAbierto;
    });
  };

  const getPriorityConfig = (priority: Priority) => {
    const configs = {
      Critica: {
        border: '#c8151b',
        text: '#c8151b',
        bg: 'rgba(200, 21, 27, 0.05)',
        icon: AlertTriangle
      },
      Alta: {
        border: '#64748b',
        text: '#475569',
        bg: 'rgba(100, 116, 139, 0.05)',
        icon: Clock
      },
      Media: {
        border: '#94a3b8',
        text: '#64748b',
        bg: 'rgba(148, 163, 184, 0.05)',
        icon: Clock
      }
    };
    return configs[priority];
  };

  const getStatusColors = (status: CaseStatus) => {
    const statusColors: Record<CaseStatus, { backgroundColor: string; color: string; borderColor: string }> = {
      [CaseStatus.NUEVO]: { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#3b82f6' },
      [CaseStatus.EN_PROCESO]: { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' },
      [CaseStatus.PENDIENTE_CLIENTE]: { backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#a855f7' },
      [CaseStatus.ESCALADO]: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#ef4444' },
      [CaseStatus.RESUELTO]: { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981' },
      [CaseStatus.CERRADO]: { backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#64748b' }
    };
    return statusColors[status] || { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
  };

  const getTimeStatus = (dias: number, slaDias: number) => {
    const diasRestantes = slaDias - dias;
    if (dias >= slaDias) {
      return { 
        color: '#c8151b', 
        bg: 'rgba(200, 21, 27, 0.08)', 
        border: 'rgba(200, 21, 27, 0.2)', 
        label: 'Vencido',
        icon: Timer
      };
    }
    if (diasRestantes <= 1) {
      return { 
        color: '#c8151b', 
        bg: 'rgba(200, 21, 27, 0.08)', 
        border: 'rgba(200, 21, 27, 0.2)', 
        label: 'Crítico',
        icon: AlertTriangle
      };
    }
    if (diasRestantes <= 3) {
      return { 
        color: '#64748b', 
        bg: 'rgba(100, 116, 139, 0.08)', 
        border: 'rgba(100, 116, 139, 0.2)', 
        label: 'Alto',
        icon: Clock
      };
    }
    return { 
      color: '#64748b', 
      bg: 'rgba(148, 163, 184, 0.05)', 
      border: 'rgba(148, 163, 184, 0.15)', 
      label: 'Normal',
      icon: CheckCircle2
    };
  };

  const casosFueraSLA = criticos.filter(c => {
    const slaDias = c.categoria?.slaDias || 5;
    return c.diasAbierto >= slaDias;
  }).length;
  
  const casosVencen24h = criticos.filter(c => {
    const slaDias = c.categoria?.slaDias || 5;
    return slaDias - c.diasAbierto <= 1 && c.diasAbierto < slaDias;
  }).length;

  const casosEscalados = criticos.filter(c => c.status === CaseStatus.ESCALADO).length;

  // Filtrar casos según búsqueda y filtros
  const casosFiltrados = criticos.filter(caso => {
    // Filtro de búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        caso.ticketNumber?.toLowerCase().includes(searchLower) ||
        caso.subject?.toLowerCase().includes(searchLower) ||
        caso.clientName?.toLowerCase().includes(searchLower) ||
        caso.agentName?.toLowerCase().includes(searchLower) ||
        caso.id?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Filtro de prioridad
    if (filterPriority !== 'all' && caso.priority !== filterPriority) {
      return false;
    }
    
    // Filtro de estado
    if (filterStatus !== 'all') {
      const normalizedStatus = normalizeStatus(caso.status);
      if (filterStatus === 'vencido') {
        const slaDias = caso.categoria?.slaDias || 5;
        if (caso.diasAbierto < slaDias) return false;
      } else if (filterStatus === 'en-riesgo') {
        const slaDias = caso.categoria?.slaDias || 5;
        if (caso.diasAbierto >= slaDias || (slaDias - caso.diasAbierto) > 1) return false;
      } else if (filterStatus === 'escalado') {
        if (normalizedStatus !== CaseStatus.ESCALADO) return false;
      } else if (normalizedStatus !== filterStatus) {
        return false;
      }
    }
    
    return true;
  });

  // Obtener estados únicos para el filtro
  const estadosUnicos = Array.from(new Set(criticos.map(c => normalizeStatus(c.status))));

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

  if (loading) {
    return <LoadingScreen message="Cargando Alertas Críticas..." />;
  }

  return (
    <div 
      className="space-y-6"
      style={{
        ...styles.container,
        animation: 'fadeInSlide 0.4s ease-out'
      }}
    >
      {/* Header con Métricas Destacadas - Alertas Críticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Críticos */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: criticos.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: criticos.length > 0 ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.02)') : styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.1s both'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = criticos.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = criticos.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          {/* Icono con glow en esquina superior derecha */}
          {criticos.length > 0 && (
            <div className="absolute top-3 right-3">
              <div className="icon-glow-critical">
                <ShieldAlert className="w-6 h-6" style={{
                  color: '#ef4444'
                }} />
              </div>
            </div>
          )}
          {criticos.length === 0 && (
            <div className="absolute top-3 right-3">
              <ShieldAlert className="w-6 h-6" style={{
                color: styles.text.secondary
              }} />
            </div>
          )}
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: criticos.length > 0 ? '#ef4444' : styles.text.primary
              }}>
                <AnimatedNumber value={criticos.length} />
              </p>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{
                  color: criticos.length > 0 ? '#ef4444' : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Total Críticos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fuera de SLA */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: casosFueraSLA > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: casosFueraSLA > 0 ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)') : styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.15s both'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          {/* Icono con glow en esquina superior derecha */}
          {casosFueraSLA > 0 && (
            <div className="absolute top-3 right-3">
              <div className="icon-glow-sla">
                <Timer className="w-6 h-6" style={{
                  color: '#f59e0b'
                }} />
              </div>
            </div>
          )}
          {casosFueraSLA === 0 && (
            <div className="absolute top-3 right-3">
              <Timer className="w-6 h-6" style={{
                color: styles.text.secondary
              }} />
            </div>
          )}
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: casosFueraSLA > 0 ? '#f59e0b' : styles.text.primary
              }}>
                <AnimatedNumber value={casosFueraSLA} />
              </p>
              <div className="flex items-center gap-1.5">
                <Timer className="w-4 h-4 flex-shrink-0" style={{
                  color: casosFueraSLA > 0 ? '#f59e0b' : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Fuera de SLA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vencen en 24h */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: casosVencen24h > 0 ? 'rgba(249, 115, 22, 0.3)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: casosVencen24h > 0 ? (theme === 'dark' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(249, 115, 22, 0.02)') : styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.2s both'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosVencen24h > 0 ? 'rgba(249, 115, 22, 0.45)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosVencen24h > 0 ? 'rgba(249, 115, 22, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          {/* Icono con glow en esquina superior derecha */}
          <div className="absolute top-3 right-3">
            <div 
              className="icon-glow-24h"
              style={{
                filter: casosVencen24h > 0 ? 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.6)) drop-shadow(0 0 12px rgba(249, 115, 22, 0.4))' : 'none',
                animation: casosVencen24h > 0 ? 'glow-pulse 2s ease-in-out infinite' : 'none'
              }}
            >
              <Clock className="w-6 h-6" style={{
                color: casosVencen24h > 0 ? '#f97316' : styles.text.secondary
              }} />
            </div>
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: casosVencen24h > 0 ? '#f97316' : styles.text.primary
              }}>
                <AnimatedNumber value={casosVencen24h} />
              </p>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 flex-shrink-0" style={{
                  color: casosVencen24h > 0 ? '#f97316' : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Vencen &lt;24h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Escalados */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: casosEscalados > 0 ? 'rgba(220, 38, 38, 0.35)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: casosEscalados > 0 ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(220, 38, 38, 0.03)') : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosEscalados > 0 ? 'rgba(220, 38, 38, 0.5)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosEscalados > 0 ? 'rgba(220, 38, 38, 0.35)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          {/* Icono con glow en esquina superior derecha */}
          {casosEscalados > 0 && (
            <div className="absolute top-3 right-3">
              <div className="icon-glow-escalados">
                <AlertTriangle className="w-6 h-6" style={{
                  color: '#dc2626'
                }} />
              </div>
            </div>
          )}
          {casosEscalados === 0 && (
            <div className="absolute top-3 right-3">
              <AlertTriangle className="w-6 h-6" style={{
                color: styles.text.secondary
              }} />
            </div>
          )}
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: casosEscalados > 0 ? '#dc2626' : styles.text.primary
              }}>
                <AnimatedNumber value={casosEscalados} />
              </p>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{
                  color: casosEscalados > 0 ? '#dc2626' : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Escalados</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div 
        className="rounded-3xl shadow-xl border overflow-hidden"
        style={{
          ...styles.card,
          animation: 'fadeInSlide 0.3s ease-out 0.25s both'
        }}
      >
        <div className="p-4 space-y-4">
          {/* Primera fila: Búsqueda y controles de vista */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{color: styles.text.tertiary}} />
              <input
                type="text"
                placeholder="Buscar por ID, asunto, cliente o agente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  color: styles.text.primary
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-opacity-20"
                  style={{color: styles.text.tertiary}}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Controles de vista y refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="p-2 rounded-lg border transition-all hover:scale-105"
                style={{
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  color: styles.text.secondary
                }}
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 p-1 rounded-lg border" style={{borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded transition-all ${viewMode === 'table' ? 'bg-blue-500 text-white' : ''}`}
                  style={viewMode !== 'table' ? {color: styles.text.secondary} : {}}
                  title="Vista tabla"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded transition-all ${viewMode === 'cards' ? 'bg-blue-500 text-white' : ''}`}
                  style={viewMode !== 'cards' ? {color: styles.text.secondary} : {}}
                  title="Vista tarjetas"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Segunda fila: Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" style={{color: styles.text.secondary}} />
              <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Filtros:</span>
            </div>
            
            {/* Filtro de Prioridad */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                borderColor: 'rgba(148, 163, 184, 0.2)',
                color: styles.text.primary
              }}
            >
              <option value="all">Todas las prioridades</option>
              <option value="Critica">Crítica</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
            </select>
            
            {/* Filtro de Estado/Tipo */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                borderColor: 'rgba(148, 163, 184, 0.2)',
                color: styles.text.primary
              }}
            >
              <option value="all">Todos los tipos</option>
              <option value="vencido">Vencidos</option>
              <option value="en-riesgo">En riesgo (&lt;24h)</option>
              <option value="escalado">Escalados</option>
              {estadosUnicos.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
            
            {/* Contador de resultados */}
            <div className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
              color: '#3b82f6'
            }}>
              {casosFiltrados.length} de {criticos.length} casos
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Casos */}
      {criticos.length > 0 ? (
        casosFiltrados.length > 0 ? (
          viewMode === 'table' ? (
            <div 
              className="rounded-3xl shadow-xl border overflow-hidden" 
              style={{
                ...styles.card,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                animation: 'fadeInSlide 0.4s ease-out 0.3s both'
              }}
            >
              <div className="overflow-x-auto">
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
                    {casosFiltrados.map((caso, idx) => {
                      const priorityConfig = getPriorityConfig(caso.priority);
                      const slaDias = caso.categoria?.slaDias || 5;
                      const timeStatus = getTimeStatus(caso.diasAbierto, slaDias);
                      const TimeIcon = timeStatus.icon;
                      const isVencido = caso.diasAbierto >= slaDias;
                      const diasRestantes = slaDias - caso.diasAbierto;
                      const horasRestantes = Math.max(0, diasRestantes * 24);

                  return (
                    <tr 
                      key={caso.id} 
                      className="transition-all duration-200 cursor-pointer group relative"
                      style={{
                        backgroundColor: 'transparent',
                        borderLeft: caso.priority === 'Critica' ? '4px solid #c8151b' : 'none'
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
                            color: caso.priority === 'Critica' ? '#c8151b' : caso.priority === 'Alta' ? '#f59e0b' : styles.text.tertiary,
                            backgroundColor: caso.priority === 'Critica' 
                              ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.1)' : 'rgba(200, 21, 27, 0.05)')
                              : caso.priority === 'Alta'
                              ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)')
                              : 'transparent'
                          }}
                        >
                          {caso.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const rawStatus = caso.status || (caso as any).estado;
                          const normalizedStatus = normalizeStatus(rawStatus);
                          return (
                            <span 
                              className="text-[10px] font-semibold uppercase tracking-wide transition-all"
                              style={{
                                color: (() => {
                                  if (normalizedStatus === CaseStatus.NUEVO) return '#2563eb';
                                  if (normalizedStatus === CaseStatus.EN_PROCESO) return '#d97706';
                                  if (normalizedStatus === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
                                  if (normalizedStatus === CaseStatus.ESCALADO) return '#dc2626';
                                  if (normalizedStatus === CaseStatus.RESUELTO) return '#16a34a';
                                  if (normalizedStatus === CaseStatus.CERRADO) return '#64748b';
                                  return '#475569';
                                })(),
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              {rawStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TimeIcon className="w-3.5 h-3.5" style={{color: isVencido ? '#c8151b' : (slaDias - caso.diasAbierto) <= 1 ? '#f97316' : styles.text.tertiary}} />
                          {(() => {
                            const diasRestantes = slaDias - caso.diasAbierto;
                            const horasRestantes = Math.max(0, diasRestantes * 24);
                            if (isVencido) {
                              const diasVencido = caso.diasAbierto - slaDias;
                              return (
                                <span 
                                  className="text-[10px] font-semibold"
                                  style={{color: '#c8151b'}}
                                >
                                  +{diasVencido}d vencido
                                </span>
                              );
                            } else if (diasRestantes <= 1) {
                              return (
                                <span 
                                  className="text-[10px] font-semibold"
                                  style={{color: '#f97316'}}
                                >
                                  {horasRestantes}h restantes
                                </span>
                              );
                            } else {
                              return (
                                <span 
                                  className="text-[10px] font-semibold"
                                  style={{color: styles.text.tertiary}}
                                >
                                  {diasRestantes}d restantes
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/casos/${caso.id}`);
                            }}
                            className="p-2 rounded-lg transition-all"
                            style={{
                              backgroundColor: 'transparent',
                              color: styles.text.tertiary
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                              e.currentTarget.style.color = styles.text.secondary;
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = styles.text.tertiary;
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 transition-all" style={{color: styles.text.tertiary}} onMouseEnter={(e) => { e.currentTarget.style.color = styles.text.secondary; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = styles.text.tertiary; e.currentTarget.style.transform = ''; }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          ) : (
            /* Vista de Tarjetas */
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              style={{
                animation: 'fadeInSlide 0.4s ease-out 0.3s both'
              }}
            >
              {casosFiltrados.map((caso, idx) => {
                const priorityConfig = getPriorityConfig(caso.priority);
                const slaDias = caso.categoria?.slaDias || 5;
                const timeStatus = getTimeStatus(caso.diasAbierto, slaDias);
                const TimeIcon = timeStatus.icon;
                const isVencido = caso.diasAbierto >= slaDias;
                const diasRestantes = slaDias - caso.diasAbierto;
                const horasRestantes = Math.max(0, diasRestantes * 24);
                
                return (
                  <div
                    key={caso.id}
                    className="rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                    style={{
                      ...styles.card,
                      borderColor: caso.priority === 'Critica' 
                        ? 'rgba(200, 21, 27, 0.4)' 
                        : caso.priority === 'Alta'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(148, 163, 184, 0.2)',
                      borderLeftWidth: caso.priority === 'Critica' ? '6px' : '2px',
                      borderLeftColor: caso.priority === 'Critica' ? '#c8151b' : 'transparent',
                      animation: `fadeInSlide 0.3s ease-out ${0.35 + idx * 0.05}s both`
                    }}
                    onClick={() => navigate(`/app/casos/${caso.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Header con ID y Prioridad */}
                    <div className="p-4 border-b" style={{
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.2)'
                    }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black" style={{color: styles.text.primary}}>
                          #{(caso as any).ticketNumber || caso.id}
                        </span>
                        <span 
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded"
                          style={{
                            color: caso.priority === 'Critica' ? '#c8151b' : caso.priority === 'Alta' ? '#f59e0b' : styles.text.tertiary,
                            backgroundColor: caso.priority === 'Critica' 
                              ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.1)' : 'rgba(200, 21, 27, 0.05)')
                              : caso.priority === 'Alta'
                              ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)')
                              : 'transparent'
                          }}
                        >
                          {caso.priority}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold line-clamp-2" style={{color: styles.text.primary}}>
                        {caso.subject}
                      </h3>
                    </div>
                    
                    {/* Contenido */}
                    <div className="p-4 space-y-3">
                      {/* Cliente y Agente */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Cliente:</span>
                          <span className="text-xs font-bold" style={{color: styles.text.primary}}>
                            {caso.clientName || 'Sin cliente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
                          <span className="text-xs" style={{color: caso.agentName ? styles.text.primary : styles.text.tertiary}}>
                            {caso.agentName || 'Sin asignar'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Estado y Tiempo */}
                      <div className="flex items-center justify-between pt-2 border-t" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                        {(() => {
                          const rawStatus = caso.status || (caso as any).estado;
                          const normalizedStatus = normalizeStatus(rawStatus);
                          return (
                            <span 
                              className="text-[10px] font-semibold uppercase tracking-wide transition-all"
                              style={{
                                color: (() => {
                                  if (normalizedStatus === CaseStatus.NUEVO) return '#2563eb';
                                  if (normalizedStatus === CaseStatus.EN_PROCESO) return '#d97706';
                                  if (normalizedStatus === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
                                  if (normalizedStatus === CaseStatus.ESCALADO) return '#dc2626';
                                  if (normalizedStatus === CaseStatus.RESUELTO) return '#16a34a';
                                  if (normalizedStatus === CaseStatus.CERRADO) return '#64748b';
                                  return '#475569';
                                })(),
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              {rawStatus}
                            </span>
                          );
                        })()}
                        <div className="flex items-center gap-1.5">
                          <TimeIcon className="w-3.5 h-3.5" style={{color: isVencido ? '#c8151b' : (diasRestantes <= 1) ? '#f97316' : styles.text.tertiary}} />
                          {isVencido ? (
                            <span className="text-[10px] font-semibold" style={{color: '#c8151b'}}>
                              +{caso.diasAbierto - slaDias}d
                            </span>
                          ) : diasRestantes <= 1 ? (
                            <span className="text-[10px] font-semibold" style={{color: '#f97316'}}>
                              {horasRestantes}h
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold" style={{color: styles.text.tertiary}}>
                              {diasRestantes}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Sin resultados de búsqueda */
          <div className="p-20 text-center rounded-xl border-2 border-dashed" style={{
            ...styles.card,
            borderColor: 'rgba(148, 163, 184, 0.25)'
          }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border-2" style={{
              backgroundColor: theme === 'dark' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(100, 116, 139, 0.05)',
              borderColor: 'rgba(100, 116, 139, 0.3)'
            }}>
              <Search className="w-10 h-10" style={{color: styles.text.tertiary}} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{color: styles.text.primary}}>No se encontraron resultados</h3>
            <p className="text-sm font-medium" style={{color: styles.text.tertiary}}>
              Intenta ajustar los filtros o términos de búsqueda.
            </p>
          </div>
        )
      ) : (
          <div className="p-20 text-center rounded-xl border-2 border-dashed" style={{
            ...styles.card,
            borderColor: 'rgba(148, 163, 184, 0.25)'
          }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border-2" style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderColor: 'rgba(34, 197, 94, 0.3)'
            }}>
              <CheckCircle2 className="w-10 h-10" style={{color: '#22c55e'}} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{color: styles.text.primary}}>Todo bajo control</h3>
            <p className="text-sm font-medium" style={{color: styles.text.tertiary}}>
              No hay alertas críticas. Todos los casos están dentro del SLA.
            </p>
          </div>
        )}
      
      {/* Estilos para animación de glow */}
      <style>{`
        @keyframes glow-pulse-critical {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 10px rgba(239, 68, 68, 0.4));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 14px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 18px rgba(239, 68, 68, 0.4));
            opacity: 0.95;
          }
        }
        
        @keyframes glow-pulse-sla {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.6)) drop-shadow(0 0 10px rgba(245, 158, 11, 0.4));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 14px rgba(245, 158, 11, 0.6)) drop-shadow(0 0 18px rgba(245, 158, 11, 0.4));
            opacity: 0.95;
          }
        }
        
        @keyframes glow-pulse-24h {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(249, 115, 22, 0.6)) drop-shadow(0 0 10px rgba(249, 115, 22, 0.4));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.8)) drop-shadow(0 0 14px rgba(249, 115, 22, 0.6)) drop-shadow(0 0 18px rgba(249, 115, 22, 0.4));
            opacity: 0.95;
          }
        }
        
        @keyframes glow-pulse-escalados {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.7)) drop-shadow(0 0 10px rgba(220, 38, 38, 0.5));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.9)) drop-shadow(0 0 14px rgba(220, 38, 38, 0.7)) drop-shadow(0 0 18px rgba(220, 38, 38, 0.5));
            opacity: 0.95;
          }
        }
        
        .icon-glow-critical {
          animation: glow-pulse-critical 2s ease-in-out infinite;
        }
        
        .icon-glow-sla {
          animation: glow-pulse-sla 2s ease-in-out infinite;
        }
        
        .icon-glow-24h {
          animation: glow-pulse-24h 2s ease-in-out infinite;
        }
        
        .icon-glow-escalados {
          animation: glow-pulse-escalados 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default AlertasCriticas;
