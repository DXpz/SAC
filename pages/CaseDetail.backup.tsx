
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente } from '../types';
import { STATE_TRANSITIONS, STATE_COLORS } from '../constants';
import { ArrowLeft, MessageSquare, User, Building2, Phone, Mail, CheckCircle2, Clock, X, AlertTriangle, Lock, History } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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
  // Nota: El SLA vencido (slaExpired) NO bloquea el cambio de estado, solo los casos cerrados están bloqueados
  // Esto aplica para todos los usuarios: agentes, supervisores y gerentes
  const canPerformAction = !isCaseClosed && !transitionLoading;

  const handleStateChange = async (newState: string, extraData?: any) => {
    if (!caso) return;
    
    // Validación: solo bloquear acciones en casos cerrados
    // Nota: Los casos vencidos (slaExpired) SÍ pueden cambiar de estado
    // Esto aplica para todos los usuarios, incluyendo agentes
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
    // Validación: no permitir acciones en casos cerrados
    if (isCaseClosed) {
      return;
    }

    // Estados que requieren modal especial
    if (newState === CaseStatus.RESUELTO) {
      setShowResueltoModal(true);
      return;
    }
    
    if (newState === CaseStatus.PENDIENTE_CLIENTE) {
      setShowPendienteModal(true);
      return;
    }

    // Para otros estados, mostrar modal de confirmación genérico
    setPendingAction({ state: newState, label: newState });
    setShowConfirmModal(true);
  };

  const confirmAction = () => {
    if (pendingAction) {
      // Si es CERRADO, el mensaje es obligatorio
      if (pendingAction.state === CaseStatus.CERRADO && !formDetail.trim()) {
        return;
      }
      handleStateChange(pendingAction.state, pendingAction.state === CaseStatus.CERRADO ? { detalle: formDetail } : undefined);
    }
  };

  if (!caso) return (
    <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor: '#c8151b'}}></div>
            <p className="font-medium tracking-normal text-xs" style={{color: '#94a3b8'}}>Cargando Detalle...</p>
        </div>
    </div>
  );

  // Normalizar el estado para que coincida con el enum CaseStatus
  const normalizeStatus = (status: string | CaseStatus): CaseStatus => {
    const statusStr = String(status).trim();
    // Buscar coincidencia exacta o por valor del enum
    const statusValues = Object.values(CaseStatus);
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '');
      const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
      return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
    });
    return (matchedStatus as CaseStatus) || (status as CaseStatus);
  };

  const normalizedStatus = normalizeStatus(caso.status);
  const validTransitions = STATE_TRANSITIONS[normalizedStatus] || [];
  
  // Debug: si no hay transiciones, verificar el estado
  if (validTransitions.length === 0 && !isCaseClosed) {
  }

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
    cardHeader: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.15)'
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
    },
    modal: {
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
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
          e.currentTarget.style.color = '#475569';
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#64748b';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna Principal - Información del Caso */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header del Caso */}
          <section className="rounded-xl border overflow-hidden shadow-sm" style={{...styles.card}}>
            <div className="p-6 border-b" style={{...styles.cardHeader}}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-xl font-bold tracking-tight" style={{color: styles.text.primary}}>{caso.ticketNumber}</span>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
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

            {/* Descripción */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg" style={{backgroundColor: '#eff6ff'}}>
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
                    <div className="p-2 rounded-lg" style={{backgroundColor: '#f1f5f9'}}>
                      <Lock className="w-4 h-4" style={{color: '#64748b'}} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: '#64748b'}}>Acciones Bloqueadas</h3>
                   </>
                 ) : (
                   <>
                    <div className="p-2 rounded-lg" style={{backgroundColor: '#eff6ff'}}>
                      <CheckCircle2 className="w-4 h-4" style={{color: '#107ab4'}} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Acciones Disponibles</h3>
                   </>
                 )}
              </div>
               
               {isCaseClosed ? (
                <div className="p-5 rounded-lg border-2" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.3)'}}>
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 mt-0.5" style={{color: '#64748b'}} />
                    <div>
                      <p className="text-sm font-bold mb-1" style={{color: '#475569'}}>Caso Cerrado</p>
                      <p className="text-xs font-medium" style={{color: '#94a3b8'}}>
                     Este caso ha sido cerrado y no se pueden realizar más acciones sobre él.
                   </p>
                    </div>
                  </div>
                 </div>
               ) : validTransitions.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                   {validTransitions.map(st => (
                        <button
                          key={st}
                       disabled={transitionLoading || !canPerformAction}
                       onClick={() => handleActionClick(st)}
                      className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0"
                      style={{backgroundColor: '#c8151b'}}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#c8151b';
                        e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {st}
                        </button>
                   ))}
                 </div>
                 ) : (
                <div className="p-4 rounded-lg border text-center" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                  <p className="text-xs font-medium" style={{color: '#94a3b8'}}>No hay acciones disponibles para este estado ({caso.status}).</p>
                   </div>
                 )}
            </div>
          </section>

          {/* Línea de Tiempo */}
          {caso.history && caso.history.length > 0 && (
            <section className="rounded-xl border overflow-hidden shadow-sm" style={{...styles.card}}>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg" style={{backgroundColor: '#eff6ff'}}>
                    <History className="w-4 h-4" style={{color: '#107ab4'}} />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Línea de Tiempo</h3>
                </div>
                <div className="space-y-4 relative before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:rounded-full" style={{
                  '--before-bg': 'linear-gradient(to bottom, rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.2))'
                } as React.CSSProperties}>
                  {caso.history.map((entry, idx) => (
                    <div key={idx} className="relative pl-10">
                      <div 
                        className="absolute left-0 top-1 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                        style={{backgroundColor: '#c8151b'}}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div 
                        className="p-4 rounded-lg border transition-all"
                        style={{
                          backgroundColor: '#f8fafc',
                          borderColor: 'rgba(148, 163, 184, 0.2)'
                        }}
                      >
                        <p className="text-xs font-medium mb-2" style={{color: '#94a3b8'}}>
                          {new Date(entry.fechaHora).toLocaleString('es-ES', { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                          })}
                        </p>
                        <p className="text-sm font-semibold leading-relaxed mb-1" style={{color: '#0f172a'}}>
                          {entry.detalle}
                        </p>
                        <p className="text-xs font-medium" style={{color: '#64748b'}}>
                          Por: {entry.usuario}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Columna Lateral - Información Adicional */}
        <div className="space-y-5">
          {/* Información del Cliente */}
          <section className="rounded-xl border p-5 shadow-sm" style={{...styles.card}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{backgroundColor: '#eff6ff'}}>
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
              <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <Mail className="w-4 h-4" style={{color: '#64748b'}}/>
                <p className="text-xs font-medium" style={{color: '#475569'}}>{caso.clientEmail || 'No disponible'}</p>
                </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <Phone className="w-4 h-4" style={{color: '#64748b'}}/>
                <p className="text-xs font-medium" style={{color: '#475569'}}>{caso.clientPhone || caso.cliente?.telefono || 'No disponible'}</p>
                </div>
            </div>
          </section>

          {/* Agente Asignado */}
          <section className="rounded-xl border p-5 shadow-sm" style={{...styles.card}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{backgroundColor: '#f1f5f9'}}>
                <User className="w-4 h-4" style={{color: '#64748b'}} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Agente Asignado</h3>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: '#c8151b'}}>
                {caso.agentName.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-bold" style={{color: styles.text.primary}}>{caso.agentName}</p>
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Confirmación Genérico */}
      {showConfirmModal && pendingAction && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform animate-in fade-in zoom-in" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
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

      {/* Modal de Resolución */}
      {showResueltoModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
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

      {/* Modal de Pendiente Cliente */}
      {showPendienteModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
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
