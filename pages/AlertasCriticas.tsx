import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente, Cliente } from '../types';
import { STATE_COLORS } from '../constants';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ShieldAlert, 
  Clock, 
  AlertTriangle, 
  Eye,
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
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const location = useLocation();

  const loadClientes = async () => {
    try {
      const clientesList = await api.getClientes();
      setClientes(clientesList);
      return clientesList;
    } catch (error) {
      console.error('Error loading clientes:', error);
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
      const clientesList = await loadClientes();
      const list = await api.getCases();
      const enriched = enrichCasesWithClients(list, clientesList);
      const filtered = enriched.filter(c => {
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
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: criticos.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: criticos.length > 0 ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.02)') : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = criticos.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = criticos.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
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
            backgroundColor: casosFueraSLA > 0 ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)') : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosFueraSLA > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
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
            backgroundColor: casosVencen24h > 0 ? (theme === 'dark' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(249, 115, 22, 0.02)') : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosVencen24h > 0 ? 'rgba(249, 115, 22, 0.45)' : 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosVencen24h > 0 ? 'rgba(249, 115, 22, 0.3)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
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

      {/* Lista de Casos en Formato Tabla */}
      {criticos.length > 0 ? (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{
          ...styles.card,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
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
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Prioridad</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Estado</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>SLA</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: styles.text.secondary}}>Acción</th>
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
                            color: caso.priority === 'Critica' ? '#c8151b' : caso.priority === 'Alta' ? '#f59e0b' : styles.text.tertiary
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
                          <TimeIcon className="w-3.5 h-3.5" style={{color: isVencido ? '#c8151b' : styles.text.tertiary}} />
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: isVencido ? '#c8151b' : styles.text.tertiary
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
                              color: styles.text.tertiary
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                              e.currentTarget.style.color = styles.text.secondary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = styles.text.tertiary;
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
