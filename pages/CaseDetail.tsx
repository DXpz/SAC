import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, AutorRol, HistorialEntry } from '../types';
import { CASE_TRANSITIONS, CASE_STATES, getStateColor, getStateBadgeColor } from '../constants';
import { changeCaseStatus, getAllowedTransitions, sendStatusChangeToWebhook } from '../services/caseStatusService';
import { ArrowLeft, MessageSquare, User, Building2, Phone, Mail, CheckCircle2, Clock, X, AlertTriangle, Lock, History, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Case | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agentes, setAgentes] = useState<any[]>([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const { theme } = useTheme();
  
  // Modal unificado de justificación
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingNewState, setPendingNewState] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([loadClientes(), loadAgentes()]);
      if (id) await loadCaso(id);
    };
    initializeData();
  }, [id]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes();
      setClientes(data);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    }
  };

  const loadAgentes = async () => {
    try {
      const data = await api.getAgentes();
      setAgentes(data);
    } catch (err) {
      console.error('Error al cargar agentes:', err);
    }
  };

  // Enriquecer nombres desde webhooks de clientes y agentes
  // IMPORTANTE: Solo enriquecer si faltan datos, NO sobrescribir datos existentes
  useEffect(() => {
    if (caso && (clientes.length > 0 || agentes.length > 0)) {
      let updated = false;
      const casoActualizado = { ...caso };

      // Enriquecer con cliente completo SOLO si falta el nombre
      if (clientes.length > 0 && casoActualizado.clientId) {
        const cliente = clientes.find(c => c.idCliente === casoActualizado.clientId);
        if (cliente) {
          // Solo actualizar si falta el nombre o el objeto cliente completo
          if (!casoActualizado.clientName || casoActualizado.clientName === 'Sin cliente') {
            casoActualizado.clientName = cliente.nombreEmpresa;
            updated = true;
          }
          if (!casoActualizado.cliente) {
            casoActualizado.cliente = cliente;
            updated = true;
          }
          // Preservar email y teléfono del caso si existen
          if (casoActualizado.clientEmail && !cliente.email) {
            // Mantener el email del caso
          } else if (!casoActualizado.clientEmail && cliente.email) {
            casoActualizado.clientEmail = cliente.email;
            updated = true;
          }
          if (casoActualizado.clientPhone && !cliente.telefono) {
            // Mantener el teléfono del caso
          } else if (!casoActualizado.clientPhone && cliente.telefono) {
            casoActualizado.clientPhone = cliente.telefono;
            updated = true;
          }
        }
      }

      // Enriquecer con agente completo SOLO si falta
      if (agentes.length > 0 && casoActualizado.agentId) {
        const agente = agentes.find(a => a.idAgente === casoActualizado.agentId);
        if (agente) {
          // Solo actualizar si falta el nombre o el objeto agente
          if (!casoActualizado.agentName || casoActualizado.agentName === 'Sin asignar') {
            casoActualizado.agentName = agente.nombre;
            updated = true;
          }
          if (!casoActualizado.agenteAsignado) {
            casoActualizado.agenteAsignado = agente;
            updated = true;
          }
        }
      }

      if (updated) {
        setCaso(casoActualizado);
      }
    }
  }, [caso?.id, clientes, agentes]);

  // Función para normalizar el estado del caso
  const normalizeStatus = (status: string | CaseStatus | undefined): CaseStatus => {
    if (!status) return CaseStatus.NUEVO;
    const statusStr = String(status).trim();
    
    // Mapa de posibles valores que puede devolver el webhook
    const statusMap: Record<string, CaseStatus> = {
      'nuevo': CaseStatus.NUEVO,
      'en proceso': CaseStatus.EN_PROCESO,
      'en_proceso': CaseStatus.EN_PROCESO,
      'pendiente cliente': CaseStatus.PENDIENTE_CLIENTE,
      'pendiente_cliente': CaseStatus.PENDIENTE_CLIENTE,
      'escalado': CaseStatus.ESCALADO,
      'resuelto': CaseStatus.RESUELTO,
      'cerrado': CaseStatus.CERRADO,
    };
    
    // Buscar coincidencia exacta primero
    const statusLower = statusStr.toLowerCase().trim();
    if (statusMap[statusLower]) {
      return statusMap[statusLower];
    }
    
    // Buscar coincidencia exacta con los valores del enum
    const statusValues = Object.values(CaseStatus);
    const exactMatch = statusValues.find(s => s === statusStr);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Buscar coincidencia por valor normalizado
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
      const statusNormalized = statusLower.replace(/\s+/g, '').replace(/_/g, '');
      return sNormalized === statusNormalized;
    });
    
    if (matchedStatus) {
      return matchedStatus;
    }
    
    // Si no se encuentra, intentar usar el valor directamente si es un CaseStatus válido
    if (statusValues.includes(statusStr as CaseStatus)) {
      return statusStr as CaseStatus;
    }
    
    // Fallback: retornar NUEVO si no se puede determinar
    console.warn('⚠️ No se pudo normalizar el estado:', statusStr, 'usando NUEVO como fallback');
    return CaseStatus.NUEVO;
  };

  const loadCaso = async (caseId: string) => {
    try {
      console.log('🔄 Iniciando carga del caso:', caseId);
      let data = await api.getCasoById(caseId);
      
      // Si no se encuentra, intentar desde localStorage
      if (!data) {
        console.warn('⚠️ Caso no encontrado en webhook, buscando en localStorage...');
        const cases = await api.getCases();
        data = cases.find((c: any) => 
          c.id === caseId || c.idCaso === caseId || c.ticketNumber === caseId
        );
        if (data) {
          console.log('✅ Caso encontrado en localStorage');
        } else {
          console.error('❌ Caso no encontrado en ningún lugar:', caseId);
          return;
        }
      }
      
      if (!data) {
        console.error('❌ No se pudo cargar el caso:', caseId);
        return;
      }
      console.log('📥 Caso recibido del webhook:', {
        id: data.id,
        clientId: data.clientId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        agentId: data.agentId,
        agentName: data.agentName,
        agenteAsignado: data.agenteAsignado,
        status: data.status
      });
      
      // Si ya tenemos un caso cargado, preservar TODA la información crítica
      // IMPORTANTE: El estado (status) debe venir del webhook para que los botones se actualicen correctamente
      if (caso) {
        // Preservar información del cliente (si el webhook no la trae completa)
        // Convertir a string y verificar antes de usar .trim()
        const dataClientNameStr = data.clientName ? String(data.clientName).trim() : '';
        const casoClientNameStr = caso.clientName ? String(caso.clientName).trim() : '';
        if (casoClientNameStr && (!dataClientNameStr || dataClientNameStr === '')) {
          data.clientName = caso.clientName;
        }
        
        const dataClientEmailStr = data.clientEmail ? String(data.clientEmail).trim() : '';
        const casoClientEmailStr = caso.clientEmail ? String(caso.clientEmail).trim() : '';
        if (casoClientEmailStr && (!dataClientEmailStr || dataClientEmailStr === '')) {
          data.clientEmail = caso.clientEmail;
        }
        // clientPhone puede venir como número del webhook, convertir a string si es necesario
        const dataClientPhoneStr = data.clientPhone ? String(data.clientPhone).trim() : '';
        const casoClientPhoneStr = caso.clientPhone ? String(caso.clientPhone).trim() : '';
        if (casoClientPhoneStr && (!dataClientPhoneStr || dataClientPhoneStr === '')) {
          data.clientPhone = caso.clientPhone;
        } else if (data.clientPhone && typeof data.clientPhone !== 'string') {
          // Convertir a string si viene como número
          data.clientPhone = String(data.clientPhone);
        }
        if (caso.cliente && !data.cliente) {
          data.cliente = caso.cliente;
        }
        // clientId también puede necesitar conversión
        const dataClientIdStr = data.clientId ? String(data.clientId).trim() : '';
        const casoClientIdStr = caso.clientId ? String(caso.clientId).trim() : '';
        if (casoClientIdStr && (!dataClientIdStr || dataClientIdStr === '')) {
          data.clientId = caso.clientId;
        }
        
        // Preservar información del agente
        if (caso.agenteAsignado && !data.agenteAsignado) {
          data.agenteAsignado = caso.agenteAsignado;
        }
        // agentName y agentId también pueden necesitar conversión
        const dataAgentNameStr = data.agentName ? String(data.agentName).trim() : '';
        const casoAgentNameStr = caso.agentName ? String(caso.agentName).trim() : '';
        if (casoAgentNameStr && (!dataAgentNameStr || dataAgentNameStr === '')) {
          data.agentName = caso.agentName;
        }
        
        const dataAgentIdStr = data.agentId ? String(data.agentId).trim() : '';
        const casoAgentIdStr = caso.agentId ? String(caso.agentId).trim() : '';
        if (casoAgentIdStr && (!dataAgentIdStr || dataAgentIdStr === '')) {
          data.agentId = caso.agentId;
        }
        
        // Preservar categoría
        if (caso.categoria && !data.categoria) {
          data.categoria = caso.categoria;
        }
        // category también puede necesitar conversión
        const dataCategoryStr = data.category ? String(data.category).trim() : '';
        const casoCategoryStr = caso.category ? String(caso.category).trim() : '';
        if (casoCategoryStr && (!dataCategoryStr || dataCategoryStr === '')) {
          data.category = caso.category;
        }
        if (caso.categoriaId && !data.categoriaId) {
          data.categoriaId = caso.categoriaId;
        }
        
        // Preservar historial (combinar si hay nuevo historial del webhook)
        const historialExistente = Array.isArray(caso.historial) ? caso.historial : 
                                   Array.isArray(caso.history) ? caso.history : [];
        const historialNuevo = Array.isArray(data.historial) ? data.historial : 
                              Array.isArray(data.history) ? data.history : [];
        
        // Función para crear un ID único de una entrada de historial
        const crearIdUnico = (h: any): string => {
          const fecha = h.fecha || h.fechaHora || '';
          const tipo = h.tipo_evento || h.tipo || '';
          const estadoAnterior = h.estado_anterior || '';
          const estadoNuevo = h.estado_nuevo || '';
          const justificacion = (h.justificacion || h.detalle || '').trim();
          const autor = (h.autor_nombre || h.usuario || h.user || '').trim();
          // Crear ID único combinando todos los campos relevantes
          return `${fecha}|${tipo}|${estadoAnterior}|${estadoNuevo}|${justificacion}|${autor}`;
        };
        
        if (historialExistente.length > 0) {
          if (historialNuevo.length > 0) {
            // Crear Set con IDs únicos del historial existente
            const existingIds = new Set(historialExistente.map(crearIdUnico));
            
            // Filtrar solo las entradas nuevas que no existen
            const newHistory = historialNuevo.filter((h: any) => {
              const idUnico = crearIdUnico(h);
              return !existingIds.has(idUnico);
            });
            
            // Combinar: primero el existente, luego las nuevas
            const historialCombinado = [...historialExistente, ...newHistory];
            
            // Eliminar duplicados dentro del historial combinado (por si acaso)
            const idsVistos = new Set<string>();
            const historialSinDuplicados = historialCombinado.filter((h: any) => {
              const idUnico = crearIdUnico(h);
              if (idsVistos.has(idUnico)) {
                return false; // Duplicado, no incluir
              }
              idsVistos.add(idUnico);
              return true;
            });
            
            data.history = historialSinDuplicados;
            data.historial = historialSinDuplicados;
          } else {
            // Mantener el historial existente
            data.history = historialExistente;
            data.historial = historialExistente;
          }
        } else if (historialNuevo.length > 0) {
          // Si no hay historial existente pero hay nuevo, usar el nuevo
          // También eliminar duplicados dentro del nuevo historial
          const idsVistos = new Set<string>();
          const historialSinDuplicados = historialNuevo.filter((h: any) => {
            const idUnico = crearIdUnico(h);
            if (idsVistos.has(idUnico)) {
              return false; // Duplicado, no incluir
            }
            idsVistos.add(idUnico);
            return true;
          });
          data.history = historialSinDuplicados;
          data.historial = historialSinDuplicados;
        } else {
          // No hay historial en ningún lado, se inicializará más abajo
          data.history = [];
          data.historial = [];
        }
        
        // Preservar otros campos importantes
        // subject, description, ticketNumber, id también pueden necesitar conversión
        const dataSubjectStr = data.subject ? String(data.subject).trim() : '';
        const casoSubjectStr = caso.subject ? String(caso.subject).trim() : '';
        if (casoSubjectStr && (!dataSubjectStr || dataSubjectStr === '')) {
          data.subject = caso.subject;
        }
        
        const dataDescriptionStr = data.description ? String(data.description).trim() : '';
        const casoDescriptionStr = caso.description ? String(caso.description).trim() : '';
        if (casoDescriptionStr && (!dataDescriptionStr || dataDescriptionStr === '')) {
          data.description = caso.description;
        }
        
        const dataTicketNumberStr = data.ticketNumber ? String(data.ticketNumber).trim() : '';
        const casoTicketNumberStr = caso.ticketNumber ? String(caso.ticketNumber).trim() : '';
        if (casoTicketNumberStr && (!dataTicketNumberStr || dataTicketNumberStr === '')) {
          data.ticketNumber = caso.ticketNumber;
        }
        
        const dataIdStr = data.id ? String(data.id).trim() : '';
        const casoIdStr = caso.id ? String(caso.id).trim() : '';
        if (casoIdStr && (!dataIdStr || dataIdStr === '')) {
          data.id = caso.id;
        }
        if (caso.createdAt && !data.createdAt) {
          data.createdAt = caso.createdAt;
        }
      }
      
      // IMPORTANTE: El estado debe venir del webhook para actualizar los botones
      // Normalizar el estado para asegurar que sea válido
      let finalStatus: CaseStatus;
      if (data.status) {
        finalStatus = normalizeStatus(data.status);
      } else if (caso?.status) {
        // Si el webhook no trae estado, usar el del caso anterior
        finalStatus = normalizeStatus(caso.status);
      } else {
        finalStatus = CaseStatus.NUEVO;
      }
      
      // Asegurar que el estado normalizado se asigne al objeto
      data.status = finalStatus;
      data.estado = finalStatus; // También asignar a 'estado' para compatibilidad
      
      // Inicializar historial si no existe (solo si realmente no hay historial)
      const tieneHistorial = (data.historial && Array.isArray(data.historial) && data.historial.length > 0) ||
                              (data.history && Array.isArray(data.history) && data.history.length > 0);
      
      if (!tieneHistorial) {
        // Inicializar con evento de creación
        const historialInicial: HistorialEntry[] = [{
          tipo_evento: "CREADO",
          justificacion: "Caso creado",
          autor_nombre: "Sistema",
          autor_rol: "sistema",
          fecha: data.createdAt || new Date().toISOString()
        }];
        data.historial = historialInicial;
        data.history = historialInicial;
      } else {
        // Asegurar que ambos arrays de historial existan y estén sincronizados
        if (!data.historial && data.history) {
          data.historial = data.history;
        }
        if (!data.history && data.historial) {
          data.history = data.historial;
        }
      }
      
      console.log('✅ Mostrando caso con datos preservados del caso anterior');
      console.log('📋 Datos del caso antes de setCaso:', {
        id: data.id,
        ticketNumber: data.ticketNumber,
        status: data.status,
        estado: data.estado,
        tieneHistorial: !!(data.historial && data.historial.length > 0)
      });
      setCaso(data);
    } catch (error) {
      console.error('❌ Error al cargar el caso:', error);
      // Aún así intentar cargar desde localStorage como fallback
      try {
        const cases = await api.getCases();
        const fallbackCase = cases.find((c: any) => 
          c.id === caseId || c.idCaso === caseId || c.ticketNumber === caseId
        );
        if (fallbackCase) {
          console.log('✅ Caso cargado desde fallback (localStorage)');
          setCaso(fallbackCase);
        }
      } catch (fallbackError) {
        console.error('❌ Error en fallback también:', fallbackError);
      }
    }
  };

  // Validar si el caso está cerrado
  const isCaseClosed = caso?.status === CaseStatus.CERRADO;

  // Validar si se puede realizar una acción
  const canPerformAction = !isCaseClosed && !transitionLoading;

  // ==================================================
  // FUNCIÓN CENTRAL DE CAMBIO DE ESTADO
  // ==================================================
  const handleStateChange = async (newState: string, justificacion: string) => {
    if (!caso) return;
    
    if (isCaseClosed) {
      alert('No se pueden realizar acciones en un caso cerrado.');
      return;
    }

    setTransitionLoading(true);
    try {
      // Obtener información del usuario actual
      const user = api.getUser();
      const autor_nombre = user?.name || 'Usuario';
      const autor_rol: AutorRol = user?.role === 'SUPERVISOR' ? 'supervisor' : 
                                  user?.role === 'GERENTE' ? 'supervisor' : 'agente';

      // Usar la función centralizada de cambio de estado
      const { casoActualizado, payload } = changeCaseStatus(caso, {
        nuevoEstado: newState,
        justificacion: justificacion,
        autor_nombre: autor_nombre,
        autor_rol: autor_rol
      });

      // Actualizar el estado local
      setCaso(casoActualizado);

      // Guardar en localStorage (persistencia local)
      const cases = await api.getCases();
      const idx = cases.findIndex((c: any) => (c.id === caso.id || c.idCaso === caso.id || c.ticketNumber === caso.id));
      if (idx !== -1) {
        cases[idx] = { ...cases[idx], ...casoActualizado };
        localStorage.setItem('intelfon_cases', JSON.stringify(cases));
      }

      // Preparar payload para webhook futuro (no se envía aún)
      if (payload) {
        console.log('📤 Payload preparado para webhook:', payload);
        // TODO: Descomentar cuando exista el webhook
        // await sendStatusChangeToWebhook(payload);
      }

      // Cerrar modal
      setShowJustificationModal(false);
      setPendingNewState(null);
      setJustification('');
      
      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ Error al actualizar el estado del caso:', err);
      alert(err.message || 'Error al actualizar el estado del caso');
      
      // Mostrar animación de error
      setShowErrorAnimation(true);
      setTimeout(() => {
        setShowErrorAnimation(false);
      }, 3000);
    } finally {
      setTransitionLoading(false);
    }
  };

  // Manejar clic en botón de acción
  const handleActionClick = (newState: string) => {
    if (isCaseClosed) {
      return;
    }

    // Validar transición
    const estadoActual = caso?.estado || caso?.status || 'Nuevo';
    const transicionesPermitidas = getAllowedTransitions(estadoActual);
    
    if (!transicionesPermitidas.includes(newState)) {
      alert(`No se puede cambiar de "${estadoActual}" a "${newState}"`);
      return;
    }

    // Abrir modal de justificación
    setPendingNewState(newState);
    setJustification('');
    setShowJustificationModal(true);
  };

  // Confirmar cambio de estado desde el modal
  const confirmStateChange = () => {
    if (!pendingNewState || !justification.trim()) {
      return;
    }
    handleStateChange(pendingNewState, justification);
  };

  if (!caso) return (
    <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor: '#c8151b'}}></div>
            <p className="font-medium tracking-normal text-xs" style={{color: '#94a3b8'}}>Cargando Detalle...</p>
        </div>
    </div>
  );

  // Obtener transiciones permitidas usando el nuevo sistema
  const estadoActual = caso.estado || caso.status || 'Nuevo';
  const validTransitions = getAllowedTransitions(estadoActual);

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
                        className={`text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full border ${getStateBadgeColor(estadoActual)}`}
                      >
                    {estadoActual}
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
                   {validTransitions.map((estadoDestino: string) => {
                     const buttonColor = getStateColor(estadoDestino);
                     const stateConfig = CASE_STATES[estadoDestino as keyof typeof CASE_STATES];
                     
                     return (
                        <button
                          key={estadoDestino}
                          disabled={transitionLoading || !canPerformAction}
                          onClick={() => handleActionClick(estadoDestino)}
                          className={`px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0 ${buttonColor}`}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {stateConfig?.label || estadoDestino}
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

            {/* Historial del Caso - Siempre visible */}
            <div className="p-6 border-t" style={{borderColor: styles.cardHeader.borderColor}}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg" style={{backgroundColor: '#eff6ff'}}>
                  <History className="w-4 h-4" style={{color: '#107ab4'}} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Historial del Caso</h3>
              </div>
              
              {(() => {
                // Obtener historial (puede venir como 'history' o 'historial')
                const historial: HistorialEntry[] = caso.historial || caso.history || [];
                
                // Función para crear un ID único de una entrada de historial (misma que arriba)
                const crearIdUnico = (h: any): string => {
                  const fecha = h.fecha || h.fechaHora || '';
                  const tipo = h.tipo_evento || h.tipo || '';
                  const estadoAnterior = h.estado_anterior || '';
                  const estadoNuevo = h.estado_nuevo || '';
                  const justificacion = (h.justificacion || h.detalle || '').trim();
                  const autor = (h.autor_nombre || h.usuario || h.user || '').trim();
                  return `${fecha}|${tipo}|${estadoAnterior}|${estadoNuevo}|${justificacion}|${autor}`;
                };
                
                // Eliminar duplicados antes de ordenar
                const idsVistos = new Set<string>();
                const historialSinDuplicados = historial.filter((h: any) => {
                  const idUnico = crearIdUnico(h);
                  if (idsVistos.has(idUnico)) {
                    return false; // Duplicado, no incluir
                  }
                  idsVistos.add(idUnico);
                  return true;
                });
                
                // Ordenar por fecha ascendente (más antiguo primero)
                const historialOrdenado = [...historialSinDuplicados].sort((a, b) => {
                  const fechaA = new Date(a.fecha || a.fechaHora || 0).getTime();
                  const fechaB = new Date(b.fecha || b.fechaHora || 0).getTime();
                  return fechaA - fechaB; // Orden ascendente
                });

                return historialOrdenado.length > 0 ? (
                  <div className="space-y-4">
                    {historialOrdenado.map((entry: HistorialEntry | any, idx: number) => {
                      // Formatear texto del evento según tipo
                      let textoEvento = '';
                      if (entry.tipo_evento === 'CREADO') {
                        textoEvento = 'El caso fue creado';
                      } else if (entry.tipo_evento === 'CAMBIO_ESTADO') {
                        textoEvento = `Estado cambiado de ${entry.estado_anterior || 'N/A'} a ${entry.estado_nuevo || 'N/A'}`;
                      } else {
                        // Compatibilidad con formato anterior
                        textoEvento = entry.detalle || entry.descripcion || entry.accion || 'Evento del caso';
                      }

                      const fecha = entry.fecha || entry.fechaHora || entry.createdAt || new Date().toISOString();
                      const autorNombre = entry.autor_nombre || entry.usuario || entry.user || 'Sistema';
                      const autorRol = entry.autor_rol || 'sistema';
                      const justificacion = entry.justificacion || entry.detalle || '';

                      return (
                        <div key={idx} className="relative pl-12 border-l-2" style={{borderColor: 'rgba(59, 130, 246, 0.2)'}}>
                          <div 
                            className="absolute left-[-24px] top-2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg border-4"
                            style={{
                              backgroundColor: theme === 'dark' ? '#3b82f6' : '#107ab4',
                              borderColor: styles.card.backgroundColor
                            }}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div 
                            className="p-4 rounded-lg border transition-all ml-4"
                            style={{
                              backgroundColor: styles.input.backgroundColor,
                              borderColor: styles.input.borderColor
                            }}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{color: styles.text.primary}}>
                                  {textoEvento}
                                </p>
                                {justificacion && (
                                  <p className="text-xs font-medium mb-1" style={{color: styles.text.secondary}}>
                                    {justificacion}
                                  </p>
                                )}
                                <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                                  Por: {autorNombre} ({autorRol})
                                </p>
                              </div>
                              <p className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{
                                color: styles.text.tertiary,
                                backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                              }}>
                                {new Date(fecha).toLocaleString('es-ES', { 
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="p-4 rounded-full mb-3" style={{backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.1)'}}>
                    <History className="w-8 h-8" style={{color: styles.text.tertiary}} />
                  </div>
                  <p className="text-sm font-medium" style={{color: styles.text.tertiary}}>El caso creado</p>
                  <p className="text-xs" style={{color: styles.text.tertiary}}>
                    Caso CASO-0003 fue creado
                  </p>
                  <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>Por: Sistema</p>
                   </div>
                 );
                })()}
            </div>
          </section>

        </div>

        {/* Columna Lateral */}
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
              <div className="p-2 rounded-lg" style={{backgroundColor: '#f1f5f9'}}>
                <User className="w-4 h-4" style={{color: '#64748b'}} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Agente Asignado</h3>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: '#c8151b'}}>
                {(caso.agenteAsignado?.nombre || caso.agentName || 'N/A').charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                {caso.agenteAsignado?.nombre || caso.agentName || 'Sin asignar'}
              </p>
            </div>

          </section>
        </div>
      </div>

      {/* Modal Unificado de Justificación */}
      {showJustificationModal && pendingNewState && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{backgroundColor: styles.modal.overlay}}>
          <div className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border transform animate-in fade-in zoom-in" style={{...styles.modal, borderColor: styles.card.borderColor}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                Cambiar estado a {pendingNewState}
              </h3>
              <button 
                onClick={() => {
                  setShowJustificationModal(false);
                  setPendingNewState(null);
                  setJustification('');
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
              <p className="text-xs font-medium leading-relaxed" style={{color: styles.text.tertiary}}>
                Se cambiará el estado del caso de <strong>{caso?.estado || caso?.status || 'Nuevo'}</strong> a <strong>{pendingNewState}</strong>.
              </p>
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Justificación del cambio <span className="text-red-500">*</span>
                </label>
                <textarea 
                  className="w-full h-24 p-3 rounded-lg border outline-none focus:ring-2 transition-all text-xs resize-none"
                  style={{
                    backgroundColor: styles.input.backgroundColor,
                    borderColor: justification.trim() ? styles.input.borderColor : 'rgba(220, 38, 38, 0.4)',
                    color: styles.input.color
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#107ab4';
                    e.target.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#ffffff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.1)';
                  }}
                  onBlur={(e) => {
                    if (!justification.trim()) {
                      e.target.style.borderColor = 'rgba(220, 38, 38, 0.5)';
                    } else {
                      e.target.style.borderColor = styles.input.borderColor;
                    }
                    e.target.style.backgroundColor = styles.input.backgroundColor;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Describe el motivo del cambio de estado..."
                  value={justification}
                  onChange={e => {
                    setJustification(e.target.value);
                    const textarea = e.target;
                    if (e.target.value.trim()) {
                      textarea.style.borderColor = styles.input.borderColor;
                    } else {
                      textarea.style.borderColor = 'rgba(220, 38, 38, 0.4)';
                    }
                  }}
                  required
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowJustificationModal(false);
                    setPendingNewState(null);
                    setJustification('');
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
                  onClick={confirmStateChange}
                  disabled={transitionLoading || !justification.trim()}
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



      {/* Animación de éxito a pantalla completa */}
      {showSuccessAnimation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            className="flex flex-col items-center justify-center"
            style={{
              animation: 'scaleInBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }}
          >
            {/* Icono de check animado */}
            <div
              className="relative mb-6"
              style={{
                animation: 'checkMark 0.5s ease-out 0.3s both'
              }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #c8151b, #dc2626)',
                  boxShadow: '0 20px 60px rgba(200, 21, 27, 0.4)'
                }}
              >
                <CheckCircle2 
                  className="w-14 h-14 text-white" 
                  style={{
                    strokeWidth: 2.5
                  }}
                />
              </div>
              {/* Anillo de expansión */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '3px solid #c8151b',
                  animation: 'ringExpand 0.8s ease-out 0.2s',
                  opacity: 0
                }}
              />
            </div>
            
            {/* Mensaje */}
            <h2
              className="text-2xl font-bold mb-2"
              style={{
                color: '#ffffff',
                animation: 'fadeInUp 0.5s ease-out 0.4s both'
              }}
            >
              ¡Estado actualizado exitosamente!
            </h2>
          </div>
        </div>
      )}

      {/* Animación de error a pantalla completa */}
      {showErrorAnimation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            className="flex flex-col items-center justify-center"
            style={{
              animation: 'scaleInBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }}
          >
            {/* Icono de error animado */}
            <div
              className="relative"
              style={{
                animation: 'errorPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.3s both'
              }}
            >
              <div
                className="w-40 h-40 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  boxShadow: '0 20px 60px rgba(220, 38, 38, 0.5)'
                }}
              >
                <AlertCircle 
                  className="w-20 h-20 text-white" 
                  style={{
                    strokeWidth: 2.5
                  }}
                />
              </div>
            </div>
            
            {/* Mensaje */}
            <h2
              className="text-xl font-bold mt-6"
              style={{
                color: '#ffffff',
                animation: 'fadeInUp 0.5s ease-out 0.4s both'
              }}
            >
              Error al actualizar el estado
            </h2>
          </div>
        </div>
      )}

      {/* Estilos de animación inline */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes checkMark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes errorPop {
          0% {
            transform: scale(0) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.3) rotate(5deg);
          }
          70% {
            transform: scale(0.9) rotate(-2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes ringExpand {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CaseDetail;

