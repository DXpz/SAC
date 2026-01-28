import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente } from '../types';
import { STATE_COLORS } from '../constants';
import { ArrowLeft, MessageSquare, User, Building2, Phone, Mail, CheckCircle2, Clock, X, AlertTriangle, Lock, History, Send, Users, TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Case | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const { theme } = useTheme();
  
  const [showResueltoModal, setShowResueltoModal] = useState(false);
  const [showPendienteModal, setShowPendienteModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ state: CaseStatus; label: string } | null>(null);
  const [formDetail, setFormDetail] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadClientes();
    if (id) loadCaso(id);
  }, [id]);

  // Enriquecer caso con datos del cliente cuando se carguen los clientes
  useEffect(() => {
    if (caso && clientes.length > 0) {
      const clienteCompleto = clientes.find(cli => 
        cli.idCliente === caso.clientId || 
        cli.idCliente === (caso as any).cliente?.idCliente ||
        cli.idCliente === caso.clientId?.replace('CL', 'CL0000') // Normalizar formato de ID
      );
      
      if (clienteCompleto) {
        setCaso({
          ...caso,
          clientName: clienteCompleto.nombreEmpresa,
          clientId: clienteCompleto.idCliente,
          clientEmail: clienteCompleto.email || caso.clientEmail,
          clientPhone: clienteCompleto.telefono || caso.clientPhone,
          cliente: clienteCompleto,
        });
      }
    }
  }, [clientes, caso?.clientId]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes();
      setClientes(data);
    } catch (err) {
    }
  };

  const loadCaso = async (caseId: string) => {
    const data = await api.getCasoById(caseId);
    if (data) setCaso(data);
  };

  // Validar si el caso está cerrado
  const isCaseClosed = caso?.status === CaseStatus.CERRADO;

  // Validar si se puede realizar una acción
  const canPerformAction = !isCaseClosed && !transitionLoading;

  const handleStateChange = async (newState: string, extraData?: any) => {
    if (!caso) return;
    
    if (isCaseClosed) {
      alert('No se pueden realizar acciones en un caso cerrado.');
      return;
    }

    setTransitionLoading(true);
    try {
      const detail = extraData?.detalle || extraData?.resolucion || `Transición a ${newState}`;
      await api.updateCaseStatus(caso.id, newState, detail, extraData);
      setShowResueltoModal(false);
      setShowPendienteModal(false);
      setShowConfirmModal(false);
      setPendingAction(null);
      setFormDetail('');
      await loadCaso(caso.id);
    } catch (err) {
      alert('Error al actualizar el estado del caso.');
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleActionClick = (newState: CaseStatus) => {
    if (isCaseClosed) {
      return;
    }

    if (newState === CaseStatus.RESUELTO) {
      setShowResueltoModal(true);
      return;
    }
    
    if (newState === CaseStatus.PENDIENTE_CLIENTE) {
      setShowPendienteModal(true);
      return;
    }

    setPendingAction({ state: newState, label: newState });
    setShowConfirmModal(true);
  };

  const confirmAction = () => {
    if (pendingAction) {
      if (pendingAction.state === CaseStatus.CERRADO && !formDetail.trim()) {
        return;
      }
      handleStateChange(pendingAction.state, pendingAction.state === CaseStatus.CERRADO ? { detalle: formDetail } : undefined);
    }
  };

  if (!caso) return <LoadingScreen message="Cargando Detalle del Caso..." />;

  const normalizeStatus = (status: string | CaseStatus): CaseStatus => {
    const statusStr = String(status).trim();
    const statusValues = Object.values(CaseStatus);
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '');
      const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
      return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
    });
    return (matchedStatus as CaseStatus) || (status as CaseStatus);
  };

  const normalizedStatus = normalizeStatus(caso.status);
  
  // Función para normalizar nombres de estados (maneja diferentes formatos de n8n)
  const normalizeEstadoName = (estado: string): string => {
    if (!estado) return '';
    return estado.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .trim();
  };
  
  // Función para formatear nombres de estados para mostrar (de "pendiente_cliente" a "Pendiente Cliente")
  // Basado únicamente en lo que viene del webhook
  const formatEstadoName = (estado: string): string => {
    if (!estado) return '';
    
    // Formatear desde snake_case o lowercase (sin usar estados hardcodeados)
    return estado
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };
  
  // Obtener transiciones permitidas ÚNICAMENTE desde n8n (sin fallback a estados demo)
  let validTransitions: CaseStatus[] = [];
  
  if (caso.transiciones && caso.transiciones.length > 0) {
    // Filtrar transiciones que parten del estado actual
    const estadoActual = caso.estado || caso.status || '';
    const estadoActualNormalizado = normalizeEstadoName(estadoActual);
    
    const transicionesDelEstadoActual = caso.transiciones.filter((t) => {
      const origenNormalizado = normalizeEstadoName(t.estado_origen || '');
      return origenNormalizado === estadoActualNormalizado;
    });
    
    // Extraer los estados destino y convertirlos a CaseStatus
    const estadosDestino = transicionesDelEstadoActual.map(t => t.estado_destino).filter(Boolean);
    validTransitions = estadosDestino.map(estado => normalizeStatus(estado)) as CaseStatus[];
  }
  // Si no hay transiciones del webhook, no mostrar botones (no usar fallback)

  // Calcular información SLA
  const createdDate = new Date(caso.createdAt);
  const slaDays = caso.categoria?.slaDias || 2;
  const slaDeadline = new Date(createdDate);
  slaDeadline.setDate(slaDeadline.getDate() + slaDays);
  
  const now = new Date();
  const totalMs = slaDeadline.getTime() - createdDate.getTime();
  const elapsedMs = now.getTime() - createdDate.getTime();
  const slaProgress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  
  const daysOverdue = caso.slaExpired ? Math.floor((now.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const hoursOverdue = caso.slaExpired ? Math.floor(((now.getTime() - slaDeadline.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;

  const daysRemaining = !caso.slaExpired ? Math.floor((slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const hoursRemaining = !caso.slaExpired ? Math.floor(((slaDeadline.getTime() - now.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;

  const isEscalated = caso.status === CaseStatus.ESCALADO;
  const showAlert = isEscalated && caso.slaExpired;

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
    cardHeader: {
      backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.15)'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    },
    input: {
      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    modal: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      overlay: theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.5)'
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20" style={styles.container}>
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold transition-all mb-1 group px-3 py-2 rounded-lg"
        style={{color: styles.text.tertiary}}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = styles.text.secondary;
          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = styles.text.tertiary;
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Alerta de Caso Crítico */}
          {showAlert && (
            <div className="rounded-xl border-2 border-red-500 p-4 flex items-center gap-3 animate-in fade-in" style={{
              backgroundColor: theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.05)'
            }}>
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-sm font-bold text-red-600">Caso escalado y SLA vencido</p>
                <p className="text-xs" style={{color: styles.text.tertiary}}>Este caso requiere atención inmediata</p>
              </div>
            </div>
          )}

          {/* Header del Caso */}
          <section className="rounded-xl border overflow-hidden shadow-sm" style={{...styles.card}}>
            <div className="p-6 border-b" style={{...styles.cardHeader}}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-xl font-bold tracking-tight" style={{color: styles.text.primary}}>{caso.ticketNumber}</span>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: (() => {
                            const status = caso.status as CaseStatus;
                            if (status === CaseStatus.ESCALADO) return 'rgba(220, 38, 38, 0.15)';
                            return 'rgba(148, 163, 184, 0.15)';
                          })(),
                          color: (() => {
                            const status = caso.status as CaseStatus;
                            if (status === CaseStatus.NUEVO) return '#2563eb';
                            if (status === CaseStatus.EN_PROCESO) return '#d97706';
                            if (status === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
                            if (status === CaseStatus.ESCALADO) return '#dc2626';
                            if (status === CaseStatus.RESUELTO) return '#16a34a';
                            if (status === CaseStatus.CERRADO) return '#64748b';
                            return '#475569';
                          })()
                        }}
                      >
                        {caso.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" style={{color: caso.slaExpired ? '#dc2626' : '#16a34a'}} />
                      <span 
                        className="text-xs font-semibold"
                        style={{color: caso.slaExpired ? '#dc2626' : '#16a34a'}}
                      >
                        {caso.slaExpired ? 'Vencido' : 'En tiempo'}
                      </span>
                    </div>
                  </div>
                  <h1 className="text-lg font-bold leading-snug" style={{color: styles.text.primary}}>{caso.subject}</h1>
                </div>
              </div>
            </div>

            {/* Información SLA Detallada */}
            <div className="p-6 border-b" style={{borderColor: styles.cardHeader.borderColor}}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4" style={{color: '#3b82f6'}} />
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: '#3b82f6'}}>Información SLA</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg" style={{...styles.input}}>
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>Fecha de Creación</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {createdDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{...styles.input}}>
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>Fecha Límite SLA</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {slaDeadline.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{...styles.input}}>
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>SLA Comprometido</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {slaDays} días hábiles
                  </p>
                  <p className="text-xs" style={{color: styles.text.tertiary}}>{slaDays * 24} horas hábiles</p>
                </div>
                {caso.slaExpired ? (
                  <div className="p-3 rounded-lg" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.3)', border: '1px solid'}}>
                    <p className="text-xs mb-1 text-red-600">Días de Retraso</p>
                    <p className="text-sm font-bold text-red-600">
                      {daysOverdue} días hábiles
                    </p>
                    <p className="text-xs text-red-600">{daysOverdue * 24 + hoursOverdue} horas hábiles de retraso</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', border: '1px solid'}}>
                    <p className="text-xs mb-1 text-green-600">Tiempo Restante</p>
                    <p className="text-sm font-bold text-green-600">
                      {daysRemaining} días hábiles
                    </p>
                    <p className="text-xs text-green-600">{daysRemaining * 24 + hoursRemaining} horas hábiles restantes</p>
                  </div>
                )}
              </div>

              {/* Barra de progreso SLA */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                    {caso.slaExpired ? 'Excedido' : 'Progreso'}: {caso.slaExpired ? daysOverdue : daysRemaining} días {caso.slaExpired ? 'hábiles' : 'restantes'}
                  </p>
                  <p className="text-xs font-bold" style={{color: caso.slaExpired ? '#dc2626' : '#16a34a'}}>
                    {Math.min(Math.round(slaProgress), 100)}%
                  </p>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden" style={{backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)'}}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(slaProgress, 100)}%`,
                      backgroundColor: caso.slaExpired ? '#dc2626' : '#16a34a'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                  <MessageSquare className="w-4 h-4" style={{color: '#107ab4'}} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Descripción del Caso</h3>
              </div>
              <div className="p-5 rounded-lg border leading-relaxed" style={{...styles.input}}>
                <p className="text-sm font-medium">{caso.description}</p>
              </div>
            </div>

            {/* Acciones */}
            <div className="p-6 border-t" style={{borderColor: styles.cardHeader.borderColor, backgroundColor: styles.card.backgroundColor}}>
              <div className="flex items-center gap-2 mb-4">
                 {isCaseClosed ? (
                   <>
                    <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#f1f5f9'}}>
                      <Lock className="w-4 h-4" style={{color: '#64748b'}} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: '#64748b'}}>Acciones Bloqueadas</h3>
                   </>
                 ) : (
                   <>
                    <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                      <CheckCircle2 className="w-4 h-4" style={{color: '#107ab4'}} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Acciones Disponibles</h3>
                   </>
                 )}
              </div>
               
               {isCaseClosed ? (
                <div className="p-5 rounded-lg border-2" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 mt-0.5" style={{color: '#64748b'}} />
                    <div>
                      <p className="text-sm font-bold mb-1" style={{color: styles.text.secondary}}>Caso Cerrado</p>
                      <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                        Este caso ha sido cerrado y no se pueden realizar más acciones sobre él.
                      </p>
                    </div>
                  </div>
                 </div>
               ) : validTransitions.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                   {validTransitions.map(st => {
                     const estadoFormateado = formatEstadoName(st);
                     return (
                        <button
                          key={st}
                       disabled={transitionLoading || !canPerformAction}
                       onClick={() => handleActionClick(st)}
                      className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0"
                      style={{
                        backgroundColor: '#c8151b',
                        boxShadow: '0 2px 8px rgba(200, 21, 27, 0.3)'
                      }}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 21, 27, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#c8151b';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(200, 21, 27, 0.3)';
                          }}
                        >
                          {estadoFormateado}
                        </button>
                     );
                   })}
                 </div>
                 ) : (
                <div className="p-4 rounded-lg border text-center" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                  <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>No hay acciones disponibles para este estado ({caso.status}).</p>
                   </div>
                 )}
            </div>
          </section>

          {/* Historial del Caso */}
          {caso.history && caso.history.length > 0 && (
            <section className="rounded-xl border overflow-hidden shadow-sm" style={{...styles.card}}>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                    <History className="w-4 h-4" style={{color: '#107ab4'}} />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Historial del Caso</h3>
                </div>
                <div className="space-y-4 relative before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:rounded-full" style={{
                  '--before-bg': theme === 'dark' ? 'linear-gradient(to bottom, rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.2))' : 'linear-gradient(to bottom, rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.2))'
                } as React.CSSProperties}>
                  {caso.history.map((entry, idx) => (
                    <div key={idx} className="relative pl-10">
                      <div 
                        className="absolute left-0 top-1 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                        style={{backgroundColor: '#3b82f6'}}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div 
                        className="p-4 rounded-lg border transition-all"
                        style={{
                          backgroundColor: styles.input.backgroundColor,
                          borderColor: styles.input.borderColor
                        }}
                      >
                        <p className="text-xs font-medium mb-2" style={{color: styles.text.tertiary}}>
                          {new Date(entry.fechaHora).toLocaleString('es-ES', { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                          })}
                        </p>
                        <p className="text-sm font-semibold leading-relaxed mb-1" style={{color: styles.text.primary}}>
                          {entry.detalle}
                        </p>
                        <p className="text-xs font-medium" style={{color: styles.text.secondary}}>
                          Por: {entry.usuario}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Comentarios y Notas */}
          <section className="rounded-xl border overflow-hidden shadow-sm" style={{...styles.card}}>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                  <MessageSquare className="w-4 h-4" style={{color: '#107ab4'}} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Comentarios y Notas</h3>
              </div>
              
              {/* Estado vacío */}
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-full mb-4" style={{backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.1)'}}>
                  <MessageSquare className="w-8 h-8" style={{color: styles.text.tertiary}} />
                </div>
                <p className="text-sm font-medium" style={{color: styles.text.tertiary}}>No hay comentarios aún</p>
              </div>

              {/* Formulario de comentarios (deshabilitado por ahora) */}
              {/* <div className="mt-4">
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Agregar un comentario..."
                  className="w-full p-3 rounded-lg border resize-none text-sm"
                  style={{...styles.input}}
                  rows={3}
                />
                <div className="mt-2 flex justify-end">
                  <button 
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-2"
                    style={{backgroundColor: '#c8151b'}}
                  >
                    <Send className="w-3 h-3" />
                    Enviar
                  </button>
                </div>
              </div> */}
            </div>
          </section>
        </div>

        {/* Columna Lateral */}
        <div className="space-y-5">
          {/* Información del Cliente */}
          <section className="rounded-xl border p-5 shadow-sm" style={{...styles.card}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                <Building2 className="w-4 h-4" style={{color: '#107ab4'}} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Cliente</h3>
                <span className="text-sm font-semibold" style={{color: styles.text.secondary}}>
                  {caso.clientName || caso.cliente?.nombreEmpresa || 'Sin cliente'}
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                <Mail className="w-4 h-4" style={{color: '#64748b'}}/>
                <p className="text-xs font-medium" style={{color: styles.text.secondary}}>{caso.clientEmail || 'No disponible'}</p>
                </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                <Phone className="w-4 h-4" style={{color: '#64748b'}}/>
                <p className="text-xs font-medium" style={{color: styles.text.secondary}}>{caso.clientPhone || caso.cliente?.telefono || 'No disponible'}</p>
                </div>
            </div>
          </section>

          {/* Agente Asignado */}
          <section className="rounded-xl border p-5 shadow-sm" style={{...styles.card}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#f1f5f9'}}>
                <User className="w-4 h-4" style={{color: '#64748b'}} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Agente Asignado</h3>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border mb-4" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: '#c8151b'}}>
                {caso.agentName.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-bold" style={{color: styles.text.primary}}>{caso.agentName}</p>
            </div>

            {/* Métricas del Agente */}
            {caso.agenteAsignado && (
              <div className="space-y-3 mt-4">
                <div className="p-3 rounded-lg" style={{backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)'}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-medium text-blue-600">Casos Activos</p>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{caso.agenteAsignado.casosActivos || 0}</p>
                  </div>
                </div>

                {/* Puedes agregar más métricas si están disponibles */}
                <div className="p-3 rounded-lg" style={{backgroundColor: theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.05)', border: '1px solid rgba(220, 38, 38, 0.2)'}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <p className="text-xs font-medium text-red-600">Casos Críticos</p>
                    </div>
                    <p className="text-xl font-bold text-red-600">0</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg" style={{backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)'}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <p className="text-xs font-medium text-green-600">% Cumplimiento SLA</p>
                    </div>
                    <p className="text-xl font-bold text-green-600">95%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Botón Reasignar */}
            <button 
              className="w-full mt-4 py-2.5 rounded-lg text-xs font-semibold transition-all border"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#ffffff',
                borderColor: 'rgba(59, 130, 246, 0.4)',
                color: '#3b82f6'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Reasignar
              </div>
            </button>
          </section>
        </div>
      </div>

      {/* Modales (conservados del código anterior) */}
      {showConfirmModal && pendingAction && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform animate-in fade-in zoom-in" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                {pendingAction.state === CaseStatus.CERRADO ? 'Cerrar Caso' : 'Cambiar Estado'}
              </h3>
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingAction(null);
                  setFormDetail('');
                }}
                className="p-1.5 rounded-lg transition-colors"
                style={{color: '#64748b'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-medium leading-relaxed" style={{color: '#64748b'}}>
                {pendingAction.state === CaseStatus.CERRADO 
                  ? 'El caso se cerrará permanentemente. Esta acción no se puede deshacer.'
                  : `¿Cambiar estado a "${pendingAction.label}"?`
                }
              </p>
              {pendingAction.state === CaseStatus.CERRADO && (
                <div>
                  <label className="block text-xs font-bold mb-2" style={{color: '#475569'}}>
                    Motivo del cierre <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 rounded-lg border outline-none focus:ring-2 transition-all text-xs resize-none"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: formDetail.trim() ? 'rgba(148, 163, 184, 0.3)' : 'rgba(220, 38, 38, 0.4)',
                      color: '#0f172a'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#107ab4';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.1)';
                    }}
                    onBlur={(e) => {
                      if (!formDetail.trim()) {
                        e.target.style.borderColor = 'rgba(220, 38, 38, 0.5)';
                      } else {
                        e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      }
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Describe el motivo del cierre..."
                    value={formDetail}
                    onChange={e => {
                      setFormDetail(e.target.value);
                      const textarea = e.target;
                      if (e.target.value.trim()) {
                        textarea.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      } else {
                        textarea.style.borderColor = 'rgba(220, 38, 38, 0.4)';
                      }
                    }}
                    required
                  />
              </div>
              )}
              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingAction(null);
                    setFormDetail('');
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all border"
                  style={{
                    color: '#475569',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmAction}
                  disabled={transitionLoading || (pendingAction.state === CaseStatus.CERRADO && !formDetail.trim())}
                  className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{backgroundColor: '#c8151b'}}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#c8151b';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {transitionLoading ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResueltoModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>Marcar como Resuelto</h3>
                    <button 
                      onClick={() => {
                        setShowResueltoModal(false);
                        setFormDetail('');
                      }}
                className="p-1.5 rounded-lg transition-colors"
                style={{color: '#64748b'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
                    >
                <X className="w-4 h-4"/>
                    </button>
                </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-medium leading-relaxed" style={{color: '#64748b'}}>
                El caso se marcará como resuelto y quedará disponible para cierre.
              </p>
              <div className="flex gap-2.5 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setShowResueltoModal(false);
                          setFormDetail('');
                        }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all border"
                  style={{
                    color: '#475569',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                  }}
                      >
                        Cancelar
                      </button>
                      <button 
                  onClick={() => handleStateChange(CaseStatus.RESUELTO, { resolucion: 'Caso marcado como resuelto' })}
                  disabled={transitionLoading}
                  className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{backgroundColor: '#c8151b'}}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#c8151b';
                    e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                  {transitionLoading ? 'Procesando...' : 'Confirmar'}
                      </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showPendienteModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>Pendiente Cliente</h3>
                    <button 
                      onClick={() => {
                        setShowPendienteModal(false);
                        setFormDetail('');
                      }}
                className="p-1.5 rounded-lg transition-colors"
                style={{color: '#64748b'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
                    >
                <X className="w-4 h-4"/>
                    </button>
                </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-medium leading-relaxed" style={{color: '#64748b'}}>
                El caso quedará en espera de respuesta del cliente.
              </p>
              <div className="flex gap-2.5 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setShowPendienteModal(false);
                          setFormDetail('');
                        }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all border"
                  style={{
                    color: '#475569',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                  }}
                      >
                        Cancelar
                      </button>
                      <button 
                  onClick={() => handleStateChange(CaseStatus.PENDIENTE_CLIENTE, { detalle: 'Caso marcado como pendiente de respuesta del cliente' })}
                        disabled={transitionLoading}
                  className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{backgroundColor: '#c8151b'}}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#c8151b';
                    e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {transitionLoading ? 'Procesando...' : 'Confirmar'}
                      </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;

