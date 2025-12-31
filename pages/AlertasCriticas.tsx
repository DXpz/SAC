import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente } from '../types';
import { STATE_COLORS } from '../constants';
import { 
  ShieldAlert, 
  Clock, 
  AlertTriangle, 
  Eye,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Timer,
  ChevronRight
} from 'lucide-react';
import AnimatedNumber from '../components/AnimatedNumber';

type Priority = 'Critica' | 'Alta' | 'Media';

interface CaseWithPriority extends Caso {
  priority: Priority;
  horasParaVencimiento?: number;
}

const AlertasCriticas: React.FC = () => {
  const [criticos, setCriticos] = useState<CaseWithPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getCases();
      const filtered = list.filter(c => {
        const slaDias = c.categoria?.slaDias || 5;
        return c.diasAbierto >= slaDias || 
          c.status === CaseStatus.ESCALADO ||
          (slaDias - c.diasAbierto <= 1 && c.diasAbierto > 0);
      });
      
      const prioritized = prioritizeCases(filtered);
      setCriticos(prioritized);
    } catch (error) {
      console.error('Error loading critical cases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{backgroundColor: 'rgba(148, 163, 184, 0.1)'}}></div>
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl animate-pulse" style={{backgroundColor: 'rgba(148, 163, 184, 0.1)'}}></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con Métricas Destacadas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Críticos */}
        <div 
          className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#64748b'}}>Total Críticos</p>
              <p className="text-3xl font-black" style={{color: '#1e293b'}}>
                <AnimatedNumber value={criticos.length} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#f8fafc', border: '2px solid rgba(148, 163, 184, 0.2)'}}>
              <ShieldAlert className="w-6 h-6" style={{color: '#64748b'}} />
            </div>
          </div>
        </div>

        {/* Fuera de SLA */}
        <div 
          className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: '#ffffff',
            borderColor: casosFueraSLA > 0 ? 'rgba(200, 21, 27, 0.3)' : 'rgba(148, 163, 184, 0.2)'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(200, 21, 27, 0.5)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(200, 21, 27, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#64748b'}}>Fuera de SLA</p>
              <p className="text-3xl font-black" style={{color: casosFueraSLA > 0 ? '#c8151b' : '#1e293b'}}>
                <AnimatedNumber value={casosFueraSLA} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: casosFueraSLA > 0 ? 'rgba(200, 21, 27, 0.1)' : '#f8fafc', border: `2px solid ${casosFueraSLA > 0 ? 'rgba(200, 21, 27, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`}}>
              <Timer className="w-6 h-6" style={{color: casosFueraSLA > 0 ? '#c8151b' : '#64748b'}} />
            </div>
          </div>
        </div>

        {/* Vencen en 24h */}
        <div 
          className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#64748b'}}>Vencen &lt;24h</p>
              <p className="text-3xl font-black" style={{color: '#1e293b'}}>
                <AnimatedNumber value={casosVencen24h} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#f8fafc', border: '2px solid rgba(148, 163, 184, 0.2)'}}>
              <Clock className="w-6 h-6" style={{color: '#64748b'}} />
            </div>
          </div>
        </div>

        {/* Escalados */}
        <div 
          className="p-5 rounded-xl border-2 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: '#ffffff',
            borderColor: casosEscalados > 0 ? 'rgba(200, 21, 27, 0.3)' : 'rgba(148, 163, 184, 0.2)'
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosEscalados > 0 ? 'rgba(200, 21, 27, 0.5)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosEscalados > 0 ? 'rgba(200, 21, 27, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#64748b'}}>Escalados</p>
              <p className="text-3xl font-black" style={{color: casosEscalados > 0 ? '#c8151b' : '#1e293b'}}>
                <AnimatedNumber value={casosEscalados} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: casosEscalados > 0 ? 'rgba(200, 21, 27, 0.1)' : '#f8fafc', border: `2px solid ${casosEscalados > 0 ? 'rgba(200, 21, 27, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`}}>
              <TrendingUp className="w-6 h-6" style={{color: casosEscalados > 0 ? '#c8151b' : '#64748b'}} />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Casos en Formato Tabla */}
      {criticos.length > 0 ? (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>ID Caso</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Asunto</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Prioridad</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Estado</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>SLA</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: '#475569'}}>Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                {criticos.map((caso, idx) => {
                  const priorityConfig = getPriorityConfig(caso.priority);
                  const slaDias = caso.categoria?.slaDias || 5;
                  const timeStatus = getTimeStatus(caso.diasAbierto, slaDias);
                  const TimeIcon = timeStatus.icon;
                  const isVencido = caso.diasAbierto >= slaDias;

                  return (
                    <tr 
                      key={caso.id} 
                      className="transition-all duration-200 cursor-pointer group relative"
                      style={{
                        backgroundColor: 'transparent',
                        borderLeft: caso.priority === 'Critica' ? '4px solid #c8151b' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }} 
                      onClick={() => navigate(`/app/casos/${caso.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold transition-colors" style={{color: '#1e293b'}}>
                          #{(caso as any).ticketNumber || caso.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          <span className="text-xs font-semibold line-clamp-1" style={{color: '#1e293b'}}>
                            {caso.subject}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{color: '#1e293b'}}>
                            {caso.clientName || 'Sin cliente'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            color: caso.priority === 'Critica' ? '#c8151b' : caso.priority === 'Alta' ? '#f59e0b' : '#64748b'
                          }}
                        >
                          {caso.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const rawStatus = caso.status || (caso as any).estado;
                          const statusColors = getStatusColors(rawStatus as CaseStatus);
                          return (
                            <span 
                              className="text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                color: statusColors.color
                              }}
                            >
                              {caso.status}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TimeIcon className="w-3.5 h-3.5" style={{color: isVencido ? '#c8151b' : '#64748b'}} />
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/casos/${caso.id}`);
                            }}
                            className="p-2 rounded-lg transition-all"
                            style={{
                              backgroundColor: 'transparent',
                              color: '#64748b'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.color = '#475569';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 transition-all" style={{color: '#64748b'}} onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.transform = ''; }} />
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
          <div className="p-20 text-center rounded-xl border-2 border-dashed" style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(148, 163, 184, 0.25)'
          }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border-2" style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderColor: 'rgba(34, 197, 94, 0.3)'
            }}>
              <CheckCircle2 className="w-10 h-10" style={{color: '#22c55e'}} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{color: '#1e293b'}}>Todo bajo control</h3>
            <p className="text-sm font-medium mb-6" style={{color: '#64748b'}}>
              No hay alertas críticas. Todos los casos están dentro del SLA.
            </p>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg border-2 transition-all"
              style={{
                backgroundColor: '#ffffff',
                borderColor: 'rgba(148, 163, 184, 0.2)',
                color: '#475569'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        )}
    </div>
  );
};

export default AlertasCriticas;
