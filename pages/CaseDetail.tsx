import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, AutorRol, HistorialEntry } from '../types';
import { getStateBadgeColor } from '../constants';
import { updateCaseStatus, updateCaseData } from '../services/caseService';
import { ArrowLeft, MessageSquare, User, Building2, Phone, Mail, CheckCircle2, Clock, X, AlertTriangle, Lock, History, Users, TrendingUp, AlertCircle, Edit, Save, Search, Folder } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Case | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agentes, setAgentes] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const { theme } = useTheme();
  
  // Modal unificado de justificación
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingNewState, setPendingNewState] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const [showInvalidCommentAnimation, setShowInvalidCommentAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Estados para modo de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<Partial<Case>>({});
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  
  // Estados para reasignación de agente
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [reassignJustification, setReassignJustification] = useState('');
  
  // Estados para selección rápida de cliente (antes de cambiar a En Proceso)
  const [showClienteQuickSelectModal, setShowClienteQuickSelectModal] = useState(false);
  const [clienteQuickSearchTerm, setClienteQuickSearchTerm] = useState('');
  const [pendingStateAfterClientSelect, setPendingStateAfterClientSelect] = useState<string | null>(null);
  const [pendingClienteForStateChange, setPendingClienteForStateChange] = useState<Cliente | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([loadClientes(), loadAgentes(), loadCategorias()]);
        if (id) await loadCaso(id);
      } catch (error) {
      }
    };
    initializeData().catch((error) => {
      // Capturar errores no manejados de extensiones del navegador
      if (error?.message?.includes('message channel') || error?.message?.includes('listener')) {
        return;
      }
    });
  }, [id]);
  
  // Cargar categorías del webhook (las creadas en Settings)
  const loadCategorias = async () => {
    try {
      const categoriasFromWebhook = await api.readCategories();
      if (categoriasFromWebhook && Array.isArray(categoriasFromWebhook)) {
        setCategorias(categoriasFromWebhook);
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };
  
  // Obtener la categoría del webhook basándose en el caso
  const getCategoriaFromWebhook = useMemo(() => {
    if (!caso || !categorias || categorias.length === 0) {
      return null;
    }
    
    // Buscar la categoría en el webhook por ID o nombre
    const casoCategoriaNombre = caso.category || caso.categoria?.nombre || '';
    const casoCategoriaId = caso.categoria?.id || caso.categoria?.idCategoria || (caso as any).categoriaId || '';
    
    // Buscar por ID primero
    if (casoCategoriaId) {
      const categoriaPorId = categorias.find((cat: any) => {
        const catId = String(cat.id || cat.idCategoria || cat.category_id || '').trim();
        return catId === String(casoCategoriaId).trim();
      });
      
      if (categoriaPorId) {
        return categoriaPorId;
      }
    }
    
    // Si no se encontró por ID, buscar por nombre
    if (casoCategoriaNombre) {
      const categoriaPorNombre = categorias.find((cat: any) => {
        const catNombre = String(cat.name || cat.nombre || cat.category_name || cat.caegoria || '').trim();
        const casoNombreNormalized = casoCategoriaNombre.toLowerCase().trim();
        const catNombreNormalized = catNombre.toLowerCase().trim();
        return catNombreNormalized === casoNombreNormalized || catNombre === casoCategoriaNombre;
      });
      
      if (categoriaPorNombre) {
        return categoriaPorNombre;
      }
    }
    
    return null;
  }, [caso, categorias]);
  
  // Obtener el nombre de la categoría del webhook
  const getCategoriaNombre = useMemo(() => {
    const categoriaWebhook = getCategoriaFromWebhook;
    if (categoriaWebhook) {
      return categoriaWebhook.name || categoriaWebhook.nombre || categoriaWebhook.category_name || categoriaWebhook.caegoria || caso?.category || caso?.categoria?.nombre || '';
    }
    // Si no hay categorías del webhook, usar la categoría del caso
    return caso?.category || caso?.categoria?.nombre || '';
  }, [caso, getCategoriaFromWebhook]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showClienteDropdown && !target.closest('.cliente-selector-container-edit')) {
        setShowClienteDropdown(false);
      }
    };

    if (showClienteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showClienteDropdown]);

  // Filtrar clientes según el término de búsqueda
  const filteredClientes = useMemo(() => {
    if (!clienteSearchTerm.trim()) {
      return clientes.slice(0, 50);
    }
    const term = clienteSearchTerm.toLowerCase();
    return clientes.filter(cliente => 
      cliente.idCliente.toLowerCase().includes(term) ||
      cliente.nombreEmpresa.toLowerCase().includes(term) ||
      cliente.contactoPrincipal.toLowerCase().includes(term) ||
      cliente.email.toLowerCase().includes(term) ||
      cliente.telefono.includes(term)
    );
  }, [clientes, clienteSearchTerm]);
  
  // Filtrar clientes para el modal de selección rápida
  const filteredClientesQuick = useMemo(() => {
    if (!clienteQuickSearchTerm.trim()) {
      return clientes.slice(0, 50);
    }
    const term = clienteQuickSearchTerm.toLowerCase();
    return clientes.filter(cliente => 
      cliente.idCliente.toLowerCase().includes(term) ||
      cliente.nombreEmpresa.toLowerCase().includes(term) ||
      cliente.contactoPrincipal.toLowerCase().includes(term) ||
      cliente.email.toLowerCase().includes(term) ||
      cliente.telefono.includes(term)
    );
  }, [clientes, clienteQuickSearchTerm]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes();
      setClientes(data);
    } catch (err) {
    }
  };

  const loadAgentes = async () => {
    try {
      const data = await api.getAgentes();
      setAgentes(data);
    } catch (err) {
    }
  };

  // Enriquecer nombres desde webhooks de clientes y agentes
  // IMPORTANTE: Solo enriquecer si faltan datos, NO sobrescribir datos existentes
  useEffect(() => {
    
    if (caso && (clientes.length > 0 || agentes.length > 0)) {
      let updated = false;
      const casoActualizado = { ...caso };

      // Enriquecer con cliente completo - usar búsqueda más robusta
      if (clientes.length > 0 && (casoActualizado.clientId || casoActualizado.clienteId)) {
        const clientIdBuscar = casoActualizado.clientId || casoActualizado.clienteId || '';
        
        
        // Función para normalizar IDs
        const normalizeId = (id: string) => {
          if (!id) return '';
          const normalized = id.toString().trim().toLowerCase();
          return normalized;
        };
        
        const clientIdNormalized = normalizeId(clientIdBuscar);
        
        // Buscar cliente con múltiples estrategias
        const cliente = clientes.find(c => {
          const cliIdNormalized = normalizeId(c.idCliente);
          
          // Comparación normalizada
          if (clientIdNormalized === cliIdNormalized) return true;
          
          // Comparación directa
          if (c.idCliente === clientIdBuscar) return true;
          
          // Comparación numérica (solo números)
          const casoNum = clientIdBuscar.replace(/\D/g, '');
          const cliNum = c.idCliente.replace(/\D/g, '');
          if (casoNum && cliNum && casoNum === cliNum) return true;
          
          return false;
        });
        
        if (cliente) {
          
          // Enriquecer con datos del cliente
          if (!casoActualizado.clientName || casoActualizado.clientName === 'Sin cliente' || casoActualizado.clientName.trim() === '') {
            casoActualizado.clientName = cliente.nombreEmpresa;
            updated = true;
          }
          if (!casoActualizado.cliente) {
            casoActualizado.cliente = cliente;
            updated = true;
          }
          if (!casoActualizado.clientEmail && cliente.email) {
            casoActualizado.clientEmail = cliente.email;
            updated = true;
          }
          if (!casoActualizado.clientPhone && cliente.telefono) {
            casoActualizado.clientPhone = cliente.telefono;
            updated = true;
          }
        }
      }

      // Enriquecer con agente completo - buscar por múltiples campos
      if (agentes.length > 0) {
        // Buscar agente por múltiples campos posibles
        const agentIdToSearch = casoActualizado.agentId || 
                                casoActualizado.agenteAsignado?.idAgente || 
                                (casoActualizado as any).agente_id ||
                                (casoActualizado as any).agente_user_id ||
                                '';
        
        if (agentIdToSearch) {
          // Buscar agente por idAgente (comparación flexible)
          let agente = agentes.find(a => {
            const aId = String(a.idAgente || '').trim();
            const searchId = String(agentIdToSearch).trim();
            
            // Comparación exacta
            if (aId === searchId) return true;
            
            // Comparación sin prefijos (AG-0001 vs 0001)
            const aIdNum = aId.replace(/^AG-?/i, '').replace(/^0+/, '');
            const searchIdNum = searchId.replace(/^AG-?/i, '').replace(/^0+/, '');
            if (aIdNum && searchIdNum && aIdNum === searchIdNum) return true;
            
            // Comparación numérica pura
            const aIdPure = aId.replace(/\D/g, '');
            const searchIdPure = searchId.replace(/\D/g, '');
            if (aIdPure && searchIdPure && aIdPure === searchIdPure) return true;
            
            return false;
          });
          
          if (agente) {
            // Actualizar siempre el agente después de reasignación
            casoActualizado.agentId = agente.idAgente;
            casoActualizado.agentName = agente.nombre;
            casoActualizado.agenteAsignado = agente;
            updated = true;
          } else if (!casoActualizado.agentName || casoActualizado.agentName === 'Sin asignar') {
            // Si no se encontró el agente pero hay un agentId, marcar como sin asignar
            casoActualizado.agentName = 'Sin asignar';
            casoActualizado.agenteAsignado = null;
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
    return CaseStatus.NUEVO;
  };

  const loadCaso = async (caseId: string) => {
    try {
      const data = await api.getCasoById(caseId);
      
      if (!data) {
        return;
      }
      
      
      // ENRIQUECER CON DATOS DEL CLIENTE SI FALTA EL NOMBRE
      const clientIdDelCaso = data.clientId || data.clienteId || data.cliente?.idCliente;
      const clientNameDelCaso = data.clientName || data.cliente?.nombreEmpresa || '';
      
      // Verificar si necesita enriquecimiento: si hay clientId pero no hay nombre válido
      const necesitaEnriquecimiento = clientIdDelCaso && 
        (!clientNameDelCaso || 
         clientNameDelCaso === 'Sin cliente' || 
         clientNameDelCaso.trim() === '' ||
         clientNameDelCaso === 'Por definir');
      
      if (necesitaEnriquecimiento) {
        
        // Si ya tenemos clientes cargados, buscar ahí primero
        if (clientes.length > 0) {
          const clienteEncontrado = clientes.find(c => 
            c.idCliente === clientIdDelCaso || 
            c.idCliente.toLowerCase() === clientIdDelCaso.toLowerCase() ||
            c.idCliente.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
          );
          
          if (clienteEncontrado) {
            data.clientName = clienteEncontrado.nombreEmpresa;
            data.cliente = clienteEncontrado;
            if (!data.clientEmail || (typeof data.clientEmail === 'string' && data.clientEmail.trim() === '') || data.clientEmail === null || data.clientEmail === undefined) {
              data.clientEmail = clienteEncontrado.email || '';
            }
            // Asegurar que clientPhone sea string antes de verificar
            const clientPhoneStr = data.clientPhone ? String(data.clientPhone) : '';
            if (!data.clientPhone || clientPhoneStr.trim() === '' || data.clientPhone === null || data.clientPhone === undefined) {
              data.clientPhone = clienteEncontrado.telefono || '';
            }
          }
        } else {
          // Si no hay clientes en memoria, cargarlos ahora
          try {
            const clientesDesdeAPI = await api.getClientes();
            setClientes(clientesDesdeAPI);
            
            const clienteEncontrado = clientesDesdeAPI.find(c => 
              c.idCliente === clientIdDelCaso || 
              c.idCliente.toLowerCase() === clientIdDelCaso.toLowerCase() ||
              c.idCliente.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
            );
            
            if (clienteEncontrado) {
              data.clientName = clienteEncontrado.nombreEmpresa;
              data.cliente = clienteEncontrado;
              if (!data.clientEmail || (typeof data.clientEmail === 'string' && data.clientEmail.trim() === '') || data.clientEmail === null || data.clientEmail === undefined) {
                data.clientEmail = clienteEncontrado.email || '';
              }
              // Asegurar que clientPhone sea string antes de verificar
              const clientPhoneStr = data.clientPhone ? String(data.clientPhone) : '';
              if (!data.clientPhone || clientPhoneStr.trim() === '' || data.clientPhone === null || data.clientPhone === undefined) {
                data.clientPhone = clienteEncontrado.telefono || '';
              }
            }
          } catch (error) {
            // Error al cargar clientes, continuar sin enriquecer
          }
        }
      } else if (clientIdDelCaso && clientNameDelCaso && clientNameDelCaso.trim() !== '') {
        // Si ya tiene nombre pero no tiene el objeto cliente completo, intentar enriquecerlo
        if (!data.cliente && clientes.length > 0) {
          const clienteEncontrado = clientes.find(c => 
            c.idCliente === clientIdDelCaso || 
            c.idCliente.toLowerCase() === clientIdDelCaso.toLowerCase() ||
            c.idCliente.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
          );
          
          if (clienteEncontrado) {
            data.cliente = clienteEncontrado;
          }
        }
      }
      
      // ENRIQUECER CON DATOS DEL AGENTE SI FALTA EL NOMBRE
      const agentIdDelCaso = data.agentId || data.agenteAsignado?.idAgente || (data as any).agente_id || (data as any).agente_user_id || '';
      const agentNameDelCaso = data.agentName || data.agenteAsignado?.nombre || '';
      
      if (agentIdDelCaso && (!agentNameDelCaso || agentNameDelCaso === 'Sin asignar' || agentNameDelCaso.trim() === '')) {
        // Si ya tenemos agentes cargados, buscar ahí primero
        if (agentes.length > 0) {
          const agenteEncontrado = agentes.find(a => {
            const aId = String(a.idAgente || '').trim();
            const searchId = String(agentIdDelCaso).trim();
            
            // Comparación exacta
            if (aId === searchId) return true;
            
            // Comparación sin prefijos (AG-0001 vs 0001)
            const aIdNum = aId.replace(/^AG-?/i, '').replace(/^0+/, '');
            const searchIdNum = searchId.replace(/^AG-?/i, '').replace(/^0+/, '');
            if (aIdNum && searchIdNum && aIdNum === searchIdNum) return true;
            
            // Comparación numérica pura
            const aIdPure = aId.replace(/\D/g, '');
            const searchIdPure = searchId.replace(/\D/g, '');
            if (aIdPure && searchIdPure && aIdPure === searchIdPure) return true;
            
            return false;
          });
          
          if (agenteEncontrado) {
            data.agentId = agenteEncontrado.idAgente;
            data.agentName = agenteEncontrado.nombre;
            data.agenteAsignado = agenteEncontrado;
          }
        } else {
          // Si no hay agentes en memoria, cargarlos ahora
          try {
            const agentesDesdeAPI = await api.getAgentes();
            setAgentes(agentesDesdeAPI);
            
            const agenteEncontrado = agentesDesdeAPI.find(a => {
              const aId = String(a.idAgente || '').trim();
              const searchId = String(agentIdDelCaso).trim();
              
              // Comparación exacta
              if (aId === searchId) return true;
              
              // Comparación sin prefijos
              const aIdNum = aId.replace(/^AG-?/i, '').replace(/^0+/, '');
              const searchIdNum = searchId.replace(/^AG-?/i, '').replace(/^0+/, '');
              if (aIdNum && searchIdNum && aIdNum === searchIdNum) return true;
              
              // Comparación numérica pura
              const aIdPure = aId.replace(/\D/g, '');
              const searchIdPure = searchId.replace(/\D/g, '');
              if (aIdPure && searchIdPure && aIdPure === searchIdPure) return true;
              
              return false;
            });
            
            if (agenteEncontrado) {
              data.agentId = agenteEncontrado.idAgente;
              data.agentName = agenteEncontrado.nombre;
              data.agenteAsignado = agenteEncontrado;
            }
          } catch (error) {
            // Si falla cargar agentes, continuar sin enriquecer
          }
        }
      }
      
      // Normalizar el estado para asegurar que sea válido
      if (data.status) {
        data.status = normalizeStatus(data.status);
        data.estado = data.status; // También asignar a 'estado' para compatibilidad
      }
      
      // Asegurar que ambos arrays de historial existan y estén sincronizados
      if (data.historial && !data.history) {
        data.history = data.historial;
      }
      if (data.history && !data.historial) {
        data.historial = data.history;
      }
      
      // Si no hay historial, inicializar con evento de creación
      const tieneHistorial = (data.historial && Array.isArray(data.historial) && data.historial.length > 0) ||
                              (data.history && Array.isArray(data.history) && data.history.length > 0);
      
      if (!tieneHistorial) {
        const historialInicial: HistorialEntry[] = [{
          tipo_evento: "CREADO",
          justificacion: "Caso creado",
          autor_nombre: "Sistema",
          autor_rol: "sistema",
          fecha: data.createdAt || new Date().toISOString()
        }];
        data.historial = historialInicial;
        data.history = historialInicial;
      }
      
      setCaso(data);
    } catch (error) {
      throw error; // Lanzar el error en lugar de usar fallback local
    }
  };

  // Validar si el caso está cerrado
  const isCaseClosed = caso?.status === CaseStatus.CERRADO;

  // Validar si se puede realizar una acción
  const canPerformAction = !isCaseClosed && !transitionLoading;

  // Obtener usuario actual para validar permisos
  const currentUser = api.getUser();
  const canReassign = currentUser && (currentUser.role === 'SUPERVISOR' || currentUser.role === 'GERENTE');

  // ==================================================
  // FUNCIÓN CENTRAL DE CAMBIO DE ESTADO
  // ==================================================
  const handleStateChange = async (newState: string, justificacion: string) => {
    if (!caso || !id) return;
    
    if (isCaseClosed) {
      alert('No se pueden realizar acciones en un caso cerrado.');
      return;
    }

    // Asegurar que las animaciones estén desactivadas al inicio
    setShowSuccessAnimation(false);
    setShowInvalidCommentAnimation(false);
    setShowErrorAnimation(false);
    setErrorMessage('');

    setTransitionLoading(true);
    try {
      // Obtener cliente_id: primero del cliente pendiente (si hay uno seleccionado), sino del caso actual
      let clienteId = '';
      let clienteToUpdate: Cliente | null = null;
      
      if (pendingClienteForStateChange) {
        // Si hay un cliente pendiente de la selección rápida, usarlo
        clienteId = pendingClienteForStateChange.idCliente;
        clienteToUpdate = pendingClienteForStateChange;
        // Limpiar el cliente pendiente después de usarlo
        setPendingClienteForStateChange(null);
      } else {
        // Si no hay cliente pendiente, usar el del caso actual
        clienteId = caso?.clientId || caso?.clienteId || caso?.cliente?.idCliente || '';
      }
      
      // Si hay un cliente pendiente, actualizar el caso primero con el cliente
      if (clienteToUpdate && id) {
        await updateCaseData(id, {
          cliente_id: clienteToUpdate.idCliente,
          client_name: clienteToUpdate.nombreEmpresa,
          client_email: caso?.clientEmail || clienteToUpdate.email,
          client_phone: caso?.clientPhone || clienteToUpdate.telefono
        });
      }
      
      // Enviar actualización directamente al webhook
      // NO usar lógica local, todo debe ir al webhook
      // IMPORTANTE: Asegurar que la animación de éxito esté desactivada ANTES de llamar al webhook
      setShowSuccessAnimation(false);
      
      const resultado = await updateCaseStatus(
        caso.id || caso.ticketNumber || caso.idCaso || id,
        newState,
        justificacion,
        clienteId
      );
      
      // Si llegamos aquí, el webhook ACEPTÓ el cambio (NO hubo error)
      // IMPORTANTE: Asegurar que las animaciones de error estén desactivadas
      setShowInvalidCommentAnimation(false);
      setShowErrorAnimation(false);
      setErrorMessage('');
      
      // Recargar el caso desde el servidor para asegurar que tenemos los datos más actualizados
      await loadCaso(id);
      
      // Cerrar modal
      setShowJustificationModal(false);
      setPendingNewState(null);
      setJustification('');
      
      // Mostrar animación de éxito SOLO si llegamos aquí (webhook aceptó y NO hubo error)
      // IMPORTANTE: Solo mostrar si NO hubo error (esto se verifica porque estamos en el try)
      // Asegurar que las animaciones de error estén desactivadas antes de mostrar éxito
      setShowInvalidCommentAnimation(false);
      setShowErrorAnimation(false);
      
      // Pequeño delay para asegurar que los estados anteriores se hayan actualizado
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Mostrar animación de éxito (si llegamos aquí es porque no hubo error)
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      
    } catch (err: any) {
      // CRÍTICO: Asegurar que la animación de éxito NO se muestre cuando hay cualquier error
      // Esto debe ser LO PRIMERO en el catch
      setShowSuccessAnimation(false);
      
      // DEBUG: Log temporal para verificar que el error se captura (remover después)
      console.log('[DEBUG] Error capturado en handleStateChange:', err?.message || err?.toString());
      
      // Pequeño delay para asegurar que el estado se actualice antes de mostrar otras animaciones
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const errorMsg = err?.message || err?.toString() || 'Error al actualizar el estado del caso';
      
      // Verificar si es un error de validación de comentario
      // Buscar de múltiples formas para asegurar que se detecte
      const esComentarioInvalido = errorMsg.includes('Comentario no válido:') || 
                                    errorMsg.includes('Comentario no válido') ||
                                    errorMsg.toLowerCase().includes('comentario no válido') ||
                                    errorMsg.toLowerCase().includes('comentario invalido') ||
                                    errorMsg.toLowerCase().includes('comentario no valido') ||
                                    (err?.message && err.message.toLowerCase().includes('comentario')) ||
                                    (err?.message && err.message.toLowerCase().includes('valid') && err.message.toLowerCase().includes('false'));
      
      if (esComentarioInvalido) {
        
        // Extraer el mensaje de retroalimentación
        let feedback = errorMsg
          .replace(/Comentario no válido:\s*/i, '')
          .replace(/Comentario no válido\s*/i, '')
          .replace(/Comentario invalido:\s*/i, '')
          .replace(/Comentario invalido\s*/i, '')
          .replace(/Comentario no valido:\s*/i, '')
          .replace(/Comentario no valido\s*/i, '')
          .trim();
        
        if (!feedback || feedback === '') {
          feedback = 'El comentario no cumple con los requisitos necesarios.';
        }
        
        setErrorMessage(feedback);
        
        // IMPORTANTE: NO cerrar el modal, mantenerlo abierto para que el usuario vea el error
        // NO limpiar la justificación para que el usuario pueda corregirla
        // setShowJustificationModal(false); // COMENTADO - mantener modal abierto
        // setPendingNewState(null); // COMENTADO - mantener estado pendiente
        // setJustification(''); // COMENTADO - mantener justificación para corrección
        
        // Asegurar que la animación de éxito esté desactivada
        setShowSuccessAnimation(false);
        
        // Mostrar animación de comentario no válido
        setShowInvalidCommentAnimation(true);
        setTimeout(() => {
          setShowInvalidCommentAnimation(false);
          // NO limpiar errorMessage aquí para que permanezca visible
        }, 5000);
        
        // IMPORTANTE: Salir temprano para evitar ejecutar el código de otros errores
        setTransitionLoading(false);
        return;
      } else {
        // Para otros errores, cerrar el modal y mostrar el error
        setShowJustificationModal(false);
        setPendingNewState(null);
        setJustification('');
        
        // Evitar mostrar alert si el error es de extensiones del navegador
        if (!errorMsg.includes('message channel') && !errorMsg.includes('listener')) {
          alert(errorMsg);
        }
        
        // Mostrar animación de error
        setShowErrorAnimation(true);
        setTimeout(() => {
          setShowErrorAnimation(false);
        }, 3000);
      }
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
    
    // VALIDACIÓN: No permitir cambiar al mismo estado
    if (estadoActual === newState) {
      const estadoFormateado = formatEstadoName(estadoActual);
      alert(`El caso ya está en el estado "${estadoFormateado}". No puedes cambiarlo al mismo estado.`);
      return;
    }
    
    // Función para normalizar nombres de estados (maneja diferentes formatos de n8n)
    const normalizeEstadoName = (estado: string): string => {
      if (!estado) return '';
      return estado.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_')
        .trim();
    };
    
    // Obtener transiciones permitidas ÚNICAMENTE desde n8n (sin fallback a estados demo)
    let transicionesPermitidas: string[] = [];
    
    if (caso?.transiciones && caso.transiciones.length > 0) {
      // Normalizar el estado actual para comparación
      const estadoActualNormalizado = normalizeEstadoName(estadoActual);
      
      // Filtrar transiciones que parten del estado actual
      const transicionesDelEstadoActual = caso.transiciones.filter((t) => {
        const origenNormalizado = normalizeEstadoName(t.estado_origen || '');
        return origenNormalizado === estadoActualNormalizado;
      });
      
      // Extraer los estados destino
      transicionesPermitidas = transicionesDelEstadoActual.map(t => t.estado_destino).filter(Boolean);
    }
    // Si no hay transiciones del webhook, no permitir cambios (no usar fallback)

    // Normalizar nombres de estados para comparación
    const estadoActualNormalizado = normalizeEstadoName(estadoActual);
    const newStateNormalizado = normalizeEstadoName(newState);
    
    const transicionesPermitidasNormalizadas = transicionesPermitidas.map(normalizeEstadoName);
    
    if (!transicionesPermitidasNormalizadas.includes(newStateNormalizado)) {
      const estadoActualFormateado = formatEstadoName(estadoActual);
      const newStateFormateado = formatEstadoName(newState);
      const transicionesFormateadas = transicionesPermitidas.map(formatEstadoName).join(', ');
      alert(`No se puede cambiar de "${estadoActualFormateado}" a "${newStateFormateado}". Transiciones permitidas: ${transicionesFormateadas}`);
      return;
    }

    // VALIDACIÓN: Si se intenta cambiar a "En Proceso" y no hay cliente asignado
    if (newState === CaseStatus.EN_PROCESO || newState === 'En Proceso') {
      const clienteId = caso?.clientId || caso?.clienteId;
      const clienteName = caso?.clientName || caso?.cliente?.nombreEmpresa;
      
      // Si no hay cliente o el cliente es "N/A" o "Por definir"
      if (!clienteId || clienteId === 'N/A' || clienteId === '' || 
          !clienteName || clienteName === 'Por definir' || clienteName === 'Sin cliente' || clienteName.trim() === '') {
        // Abrir modal de selección rápida de cliente
        setPendingStateAfterClientSelect(newState);
        setClienteQuickSearchTerm('');
        setShowClienteQuickSelectModal(true);
        return;
      }
    }

    // Abrir modal de justificación
    setPendingNewState(newState);
    setJustification('');
    setErrorMessage('');
    setShowJustificationModal(true);
  };

  // Confirmar cambio de estado desde el modal
  const confirmStateChange = () => {
    if (!pendingNewState || !justification.trim()) {
      return;
    }
    handleStateChange(pendingNewState, justification);
  };

  // ==================================================
  // FUNCIONES DE EDICIÓN DEL CASO
  // ==================================================
  const handleEditClick = () => {
    setIsEditing(true);
    // Obtener el nombre del cliente desde diferentes fuentes posibles
    const clientName = caso?.clientName || caso?.cliente?.nombreEmpresa || '';
    const clientEmail = caso?.clientEmail || caso?.cliente?.email || '';
    const clientPhone = caso?.clientPhone || caso?.cliente?.telefono || '';
    
    // Inicializar con los valores actuales del caso
    setEditedCase({
      subject: caso?.subject,
      description: caso?.description,
      clienteId: caso?.clienteId || caso?.clientId,
      clientName: clientName,
      clientEmail: clientEmail,
      clientPhone: clientPhone
    });
    // Inicializar el término de búsqueda con el ID y nombre del cliente actual
    const clienteActual = clientes.find(c => c.idCliente === (caso?.clienteId || caso?.clientId));
    if (clienteActual) {
      setClienteSearchTerm(`${clienteActual.idCliente} - ${clienteActual.nombreEmpresa}`);
    } else if (clientName) {
      setClienteSearchTerm(clientName);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedCase({});
    setClienteSearchTerm('');
    setShowClienteDropdown(false);
  };

  const handleClienteSelect = (cliente: Cliente) => {
    setEditedCase({
      ...editedCase,
      clienteId: cliente.idCliente,
      clientName: cliente.nombreEmpresa,
      // NO sobrescribir email y teléfono, mantener los del caso
    });
    setClienteSearchTerm(`${cliente.idCliente} - ${cliente.nombreEmpresa}`);
    setShowClienteDropdown(false);
  };
  
  // Selección rápida de cliente desde el modal (sin entrar en modo edición)
  const handleQuickClienteSelect = (cliente: Cliente) => {
    if (!caso || !id) return;
    
    // Guardar el cliente seleccionado en el estado (NO enviarlo aún)
    setPendingClienteForStateChange(cliente);
    
    // Cerrar modal de selección de cliente
    setShowClienteQuickSelectModal(false);
    setClienteQuickSearchTerm('');
    
    // Continuar con el cambio de estado a "En Proceso"
    const stateToChange = pendingStateAfterClientSelect;
    setPendingStateAfterClientSelect(null);
    
    if (stateToChange) {
      // Abrir modal de justificación para el cambio de estado
      setPendingNewState(stateToChange);
      setJustification('');
      setErrorMessage('');
      setShowJustificationModal(true);
    }
  };

  const handleClienteClear = () => {
    setEditedCase({
      ...editedCase,
      clienteId: '',
      clientName: '',
      clientEmail: '',
      clientPhone: ''
    });
    setClienteSearchTerm('');
    setShowClienteDropdown(false);
  };

  // ==================================================
  // FUNCIONES DE REASIGNACIÓN DE AGENTE
  // ==================================================
  const handleReassignClick = () => {
    setSelectedAgentId(caso?.agentId || caso?.agenteAsignado?.idAgente || '');
    setReassignJustification('');
    setShowReassignModal(true);
  };

  const handleCancelReassign = () => {
    setShowReassignModal(false);
    setSelectedAgentId('');
    setReassignJustification('');
  };

  const handleConfirmReassign = async () => {
    if (!caso || !id || !selectedAgentId) {
      return;
    }

    const currentAgentId = caso.agentId || caso.agenteAsignado?.idAgente || '';
    if (selectedAgentId === currentAgentId) {
      alert('El agente seleccionado es el mismo que el actual');
      return;
    }

    try {
      setTransitionLoading(true);

      // Llamar a la API para reasignar (sin justificación)
      await api.reassignCase(id, selectedAgentId, '');

      // Esperar un momento para que el webhook procese la reasignación
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recargar el caso para obtener los datos actualizados con el nuevo agente
      await loadCaso(id);
      
      // Forzar actualización del agente después de recargar
      // Buscar el agente seleccionado en la lista de agentes
      if (agentes.length > 0) {
        const agenteReasignado = agentes.find(a => a.idAgente === selectedAgentId);
        if (agenteReasignado && caso) {
          // Actualizar el caso con el nuevo agente
          setCaso({
            ...caso,
            agentId: agenteReasignado.idAgente,
            agentName: agenteReasignado.nombre,
            agenteAsignado: agenteReasignado
          });
        }
      }

      // Cerrar modal
      setShowReassignModal(false);
      setSelectedAgentId('');
      setReassignJustification('');

      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);

    } catch (error: any) {
      alert(`Error al reasignar el caso: ${error.message || 'Error desconocido'}`);
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!caso || !id) return;
    
    try {
      setTransitionLoading(true);
      
      // Actualizar el caso en el webhook
      // Si editedCase tiene una propiedad, usarla (incluso si es una cadena vacía)
      // Si no, usar el valor del caso original
      const clienteIdToSend = editedCase.hasOwnProperty('clienteId') 
        ? (editedCase.clienteId || '')
        : (caso.clienteId || caso.clientId || '');
      
      // Obtener el nombre del cliente original desde diferentes fuentes
      const originalClientName = caso?.clientName || caso?.cliente?.nombreEmpresa || '';
      const originalClientEmail = caso?.clientEmail || caso?.cliente?.email || '';
      const originalClientPhone = caso?.clientPhone || caso?.cliente?.telefono || '';
      
      // Construir el objeto de actualización
      // Solo incluir campos que fueron realmente editados
      const updates: any = {
        cliente_id: clienteIdToSend
      };
      
      // Solo enviar asunto si fue editado
      if (editedCase.hasOwnProperty('subject')) {
        updates.asunto = editedCase.subject || '';
      }
      
      // Solo enviar descripción si fue editada
      if (editedCase.hasOwnProperty('description')) {
        updates.descripcion = editedCase.description || '';
      }
      
      // Para client_name: solo enviar si fue editado explícitamente
      // Si el usuario no tocó el campo, no enviarlo (dejar que use el valor del caso actual)
      // Si el usuario lo editó, enviar el valor (incluso si es cadena vacía, para permitir borrarlo)
      if (editedCase.hasOwnProperty('clientName')) {
        // Si el valor editado es diferente al original, enviarlo
        if (editedCase.clientName !== originalClientName) {
          updates.client_name = editedCase.clientName || '';
        }
        // Si es igual, no enviarlo (dejar que use el valor del caso actual)
      }
      
      // Solo enviar client_email si fue editado y es diferente al original
      if (editedCase.hasOwnProperty('clientEmail') && editedCase.clientEmail !== originalClientEmail) {
        updates.client_email = editedCase.clientEmail || '';
      }
      
      // Solo enviar client_phone si fue editado y es diferente al original
      if (editedCase.hasOwnProperty('clientPhone') && editedCase.clientPhone !== originalClientPhone) {
        updates.client_phone = editedCase.clientPhone || '';
      }
      
      // Llamar a updateCaseData - puede retornar null si no se puede obtener el caso inmediatamente
      // pero eso está bien, el webhook ya procesó el cambio
      await updateCaseData(id, updates);
      
      // Recargar el caso completo para asegurar que todos los datos estén enriquecidos
      // Esto es importante porque el webhook puede no retornar todos los datos del cliente
      // Esperar un momento para que el webhook procese completamente el cambio
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadCaso(id);
      
      setIsEditing(false);
      setEditedCase({});
      setClienteSearchTerm('');
      setShowClienteDropdown(false);
      
      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      
    } catch (error: any) {
      // Solo mostrar error si realmente hubo un problema con el webhook
      // Si el error es que no se pudo obtener el caso actualizado, no es crítico
      const errorMsg = error?.message || 'Error desconocido';
      
      // Si el error indica que el webhook procesó el cambio pero no se pudo obtener el caso,
      // intentar recargar de todos modos
      if (errorMsg.includes('No se pudo obtener') || errorMsg.includes('No se recibió respuesta')) {
        // Intentar recargar el caso de todos modos
        try {
          await loadCaso(id);
          // Si se pudo recargar, no mostrar error
          setIsEditing(false);
          setEditedCase({});
          setClienteSearchTerm('');
          setShowClienteDropdown(false);
          setShowSuccessAnimation(true);
          setTimeout(() => {
            setShowSuccessAnimation(false);
          }, 2000);
          return;
        } catch (reloadError) {
          // Si falla la recarga, mostrar el error
          alert('Error al guardar los cambios. Por favor, intenta nuevamente.');
        }
      } else {
        // Para otros errores, mostrar el mensaje
        alert(`Error al guardar los cambios: ${errorMsg}`);
      }
    } finally {
      setTransitionLoading(false);
    }
  };

  if (!caso) return <LoadingScreen message="Cargando Detalle del Caso..." />;

  // Obtener transiciones permitidas desde n8n (si están disponibles) o usar fallback
  const estadoActual = caso.estado || caso.status || 'Nuevo';
  
  // Función para normalizar nombres de estados (maneja diferentes formatos de n8n)
  const normalizeEstadoName = (estado: string): string => {
    if (!estado) return '';
    // Convertir a minúsculas y normalizar espacios/guiones bajos
    return estado.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .trim();
  };
  
  // Función para formatear nombres de estados para mostrar (de "pendiente_cliente" a "Pendiente Cliente")
  // Basado únicamente en lo que viene del webhook
  const formatEstadoName = (estado: string): string => {
    if (!estado) return '';
    
    // Formatear desde snake_case o lowercase (sin usar CASE_STATES)
    return estado
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };
  
  // Obtener transiciones permitidas ÚNICAMENTE desde n8n (sin fallback a estados demo)
  let validTransitions: string[] = [];
  
  if (caso.transiciones && caso.transiciones.length > 0) {
    // Normalizar el estado actual para comparación
    const estadoActualNormalizado = normalizeEstadoName(estadoActual);
    
    // Filtrar transiciones que parten del estado actual
    const transicionesDelEstadoActual = caso.transiciones.filter((t) => {
      const origenNormalizado = normalizeEstadoName(t.estado_origen || '');
      return origenNormalizado === estadoActualNormalizado;
    });
    
    // Extraer los estados destino únicos y mantener su formato original
    validTransitions = [...new Set(transicionesDelEstadoActual.map(t => t.estado_destino))].filter(Boolean);
    
    console.log('[CaseDetail] Transiciones de n8n:', {
      estadoActual,
      estadoActualNormalizado,
      transicionesEncontradas: transicionesDelEstadoActual.length,
      validTransitions
    });
  }
  // Si no hay transiciones del webhook, no mostrar botones (no usar fallback)

  // Calcular información SLA
  const createdDate = new Date(caso.createdAt);
  // Usar los días SLA de la categoría del webhook si está disponible
  const categoriaWebhook = getCategoriaFromWebhook;
  const slaDays = categoriaWebhook 
    ? (categoriaWebhook.slaDays || categoriaWebhook.slaDias || categoriaWebhook.sla || categoriaWebhook['valor SLA'] || 2)
    : (caso.categoria?.slaDias || 2);
  
  // Usar la fecha final del SLA del webhook si está disponible, sino calcularla
  let slaDeadline: Date;
  if (caso.slaDeadline) {
    // Parsear la fecha del webhook
    try {
      slaDeadline = new Date(caso.slaDeadline);
      // Si la fecha es inválida, calcularla
      if (isNaN(slaDeadline.getTime())) {
        slaDeadline = new Date(createdDate);
        slaDeadline.setDate(slaDeadline.getDate() + slaDays);
      }
    } catch (error) {
      slaDeadline = new Date(createdDate);
      slaDeadline.setDate(slaDeadline.getDate() + slaDays);
    }
  } else {
    // Calcular la fecha si no viene del webhook
    slaDeadline = new Date(createdDate);
    slaDeadline.setDate(slaDeadline.getDate() + slaDays);
  }
  
  const now = new Date();
  const totalMs = slaDeadline.getTime() - createdDate.getTime();
  const elapsedMs = now.getTime() - createdDate.getTime();
  
  // Calcular días restantes (puede ser negativo si ya pasó el SLA)
  const daysRemainingRaw = Math.floor((slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const hoursRemainingRaw = Math.floor(((slaDeadline.getTime() - now.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  // Determinar si el SLA está vencido
  const isSLAExpired = daysRemainingRaw < 0 || (daysRemainingRaw === 0 && hoursRemainingRaw < 0);
  
  // Calcular días y horas de atraso si está vencido
  const daysOverdue = isSLAExpired ? Math.abs(daysRemainingRaw) : 0;
  const hoursOverdue = isSLAExpired ? Math.abs(hoursRemainingRaw) : 0;
  
  // Calcular días y horas restantes si no está vencido
  const daysRemaining = !isSLAExpired ? daysRemainingRaw : 0;
  const hoursRemaining = !isSLAExpired ? hoursRemainingRaw : 0;

  // Calcular progreso basado en el estado del caso
  // 0% = Nuevo, 25% = En Proceso, 50% = Pendiente Cliente, 75% = Escalado, 100% = Resuelto/Cerrado
  const getProgressByStatus = (status: string | CaseStatus): number => {
    const statusStr = String(status).trim();
    
    if (statusStr === CaseStatus.CERRADO || statusStr === 'Cerrado') {
      return 100;
    }
    if (statusStr === CaseStatus.RESUELTO || statusStr === 'Resuelto') {
      return 100;
    }
    if (statusStr === CaseStatus.ESCALADO || statusStr === 'Escalado') {
      return 75;
    }
    if (statusStr === CaseStatus.PENDIENTE_CLIENTE || statusStr === 'Pendiente Cliente') {
      return 50;
    }
    if (statusStr === CaseStatus.EN_PROCESO || statusStr === 'En Proceso') {
      return 25;
    }
    // Nuevo o cualquier otro estado
    return 0;
  };

  const caseProgress = getProgressByStatus(estadoActual);

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
      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
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
    <div 
      className="max-w-7xl mx-auto space-y-5 pb-20" 
      style={{
        ...styles.container,
        animation: 'fadeInSlide 0.4s ease-out'
      }}
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold transition-all mb-1 group px-3 py-2 rounded-lg"
        style={{
          color: styles.text.tertiary,
          animation: 'fadeInSlide 0.3s ease-out 0.1s both'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = styles.text.secondary;
          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9';
          e.currentTarget.style.transform = 'translateX(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = styles.text.tertiary;
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Alerta de Caso Crítico */}
          {showAlert && (
            <div 
              className="rounded-xl border-2 border-red-500 p-4 flex items-center gap-3" 
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.05)',
                animation: 'fadeInSlide 0.4s ease-out'
              }}
            >
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-sm font-bold text-red-600">Caso escalado y SLA vencido</p>
                <p className="text-xs" style={{color: styles.text.tertiary}}>Este caso requiere atención inmediata</p>
              </div>
            </div>
          )}

          {/* Header del Caso */}
          <section 
            className="rounded-xl border overflow-hidden shadow-sm" 
            style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: styles.card.borderColor,
              color: styles.card.color,
              animation: 'fadeInSlide 0.4s ease-out 0.15s both'
            }}
          >
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
                      <Folder className="w-3.5 h-3.5" style={{color: '#64748b'}} />
                      <span 
                        className="text-xs font-semibold"
                        style={{color: styles.text.secondary}}
                      >
                        {getCategoriaNombre || caso?.category || caso?.categoria?.nombre || 'Sin categoría'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" style={{color: isSLAExpired ? '#dc2626' : '#16a34a'}} />
                      <span 
                        className="text-xs font-semibold"
                        style={{color: isSLAExpired ? '#dc2626' : '#16a34a'}}
                      >
                        {isSLAExpired ? 'Vencido' : 'En tiempo'}
                      </span>
                    </div>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCase.subject || ''}
                      onChange={(e) => setEditedCase({ ...editedCase, subject: e.target.value })}
                      className="w-full text-lg font-bold leading-snug px-3 py-2 border rounded-lg outline-none focus:ring-2 transition-all"
                      style={{
                        ...styles.input,
                        borderColor: styles.input.borderColor
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#107ab4';
                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = styles.input.borderColor;
                        e.target.style.boxShadow = 'none';
                      }}
                      placeholder="Asunto del caso"
                    />
                  ) : (
                    <h1 className="text-lg font-bold leading-snug" style={{color: styles.text.primary}}>{caso.subject}</h1>
                  )}
                </div>
                {!isCaseClosed && (
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          disabled={transitionLoading}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                          style={{
                            backgroundColor: '#16a34a',
                            animation: 'fadeInSlide 0.3s ease-out'
                          }}
                          onMouseEnter={(e) => {
                            if (!transitionLoading) {
                              e.currentTarget.style.backgroundColor = '#15803d';
                              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#16a34a';
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                          }}
                        >
                          <Save className="w-4 h-4" />
                          Guardar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={transitionLoading}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all border disabled:opacity-50"
                          style={{
                            color: styles.text.secondary,
                            borderColor: 'rgba(148, 163, 184, 0.3)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            if (!transitionLoading) {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleEditClick}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all border"
                        style={{
                          color: '#107ab4',
                          borderColor: 'rgba(16, 122, 180, 0.3)',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 122, 180, 0.1)';
                          e.currentTarget.style.borderColor = '#107ab4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(16, 122, 180, 0.3)';
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Editar Caso
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Información SLA Detallada */}
            <div 
              className="p-6 border-b" 
              style={{
                borderColor: styles.cardHeader.borderColor,
                animation: 'fadeInSlide 0.3s ease-out 0.2s both'
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4" style={{color: '#3b82f6'}} />
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: '#3b82f6'}}>Información SLA</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div 
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                  style={{
                    ...styles.input,
                    animation: 'fadeInSlide 0.3s ease-out 0.25s both'
                  }}
                >
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>Fecha de Creación</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {createdDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div 
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                  style={{
                    ...styles.input,
                    animation: 'fadeInSlide 0.3s ease-out 0.3s both'
                  }}
                >
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>Fecha Límite SLA</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {slaDeadline.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div 
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                  style={{
                    ...styles.input,
                    animation: 'fadeInSlide 0.3s ease-out 0.35s both'
                  }}
                >
                  <p className="text-xs mb-1" style={{color: styles.text.tertiary}}>SLA Comprometido</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {slaDays} días hábiles
                  </p>
                  <p className="text-xs" style={{color: styles.text.tertiary}}>{slaDays * 24} horas hábiles</p>
                </div>
                {isSLAExpired ? (
                  <div 
                    className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: 'rgba(220, 38, 38, 0.1)', 
                      borderColor: 'rgba(220, 38, 38, 0.3)', 
                      border: '1px solid',
                      animation: 'fadeInSlide 0.3s ease-out 0.4s both'
                    }}
                  >
                    <p className="text-xs mb-1 text-red-600 font-semibold">SLA Vencido</p>
                    <p className="text-sm font-bold text-red-600">
                      {daysOverdue === 1 ? '1 día de atraso' : `${daysOverdue} días de atraso`}
                    </p>
                    <p className="text-xs text-red-500">
                      {hoursOverdue > 0 
                        ? `${daysOverdue * 24 + hoursOverdue} horas hábiles de retraso`
                        : `${daysOverdue * 24} horas hábiles de retraso`
                      }
                    </p>
                  </div>
                ) : (
                  <div 
                    className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                      borderColor: 'rgba(34, 197, 94, 0.3)', 
                      border: '1px solid',
                      animation: 'fadeInSlide 0.3s ease-out 0.4s both'
                    }}
                  >
                    <p className="text-xs mb-1 text-green-600 font-semibold">Tiempo Restante</p>
                    <p className="text-sm font-bold text-green-600">
                      {daysRemaining} días hábiles
                    </p>
                    <p className="text-xs text-green-600">{daysRemaining * 24 + hoursRemaining} horas hábiles restantes</p>
                  </div>
                )}
              </div>

              {/* Barra de progreso basada en estado del caso */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                    Progreso del caso: {estadoActual}
                  </p>
                  <p className="text-xs font-bold" style={{
                    color: caseProgress === 100 ? '#16a34a' : caseProgress >= 75 ? '#f59e0b' : caseProgress >= 50 ? '#3b82f6' : '#64748b'
                  }}>
                    {caseProgress}%
                  </p>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden" style={{backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)'}}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${caseProgress}%`,
                      backgroundColor: caseProgress === 100 ? '#16a34a' : caseProgress >= 75 ? '#f59e0b' : caseProgress >= 50 ? '#3b82f6' : '#64748b'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div 
              className="p-6"
              style={{
                animation: 'fadeInSlide 0.3s ease-out 0.45s both'
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                  <MessageSquare className="w-4 h-4" style={{color: '#107ab4'}} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Descripción del Caso</h3>
              </div>
              {isEditing ? (
                <textarea
                  value={editedCase.description || ''}
                  onChange={(e) => setEditedCase({ ...editedCase, description: e.target.value })}
                  rows={6}
                  className="w-full p-5 rounded-lg border leading-relaxed text-sm font-medium outline-none focus:ring-2 transition-all resize-none"
                  style={{
                    ...styles.input,
                    borderColor: styles.input.borderColor
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#107ab4';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = styles.input.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Descripción del caso"
                />
              ) : (
                <div className="p-5 rounded-lg border leading-relaxed" style={{...styles.input}}>
                  <p className="text-sm font-medium">{caso.description}</p>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div 
              className="p-6 border-t" 
              style={{
                borderColor: styles.cardHeader.borderColor, 
                backgroundColor: styles.card.backgroundColor,
                animation: 'fadeInSlide 0.3s ease-out 0.5s both'
              }}
            >
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
                   {validTransitions.map((estadoDestino: string) => {
                     const estadoFormateado = formatEstadoName(estadoDestino);
                     
                     return (
                        <button
                          key={estadoDestino}
                          disabled={transitionLoading || !canPerformAction}
                          onClick={() => handleActionClick(estadoDestino)}
                          className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0"
                          style={{
                            backgroundColor: '#c8151b',
                            boxShadow: '0 2px 8px rgba(200, 21, 27, 0.3)',
                            animation: `fadeInSlide 0.3s ease-out ${0.5 + validTransitions.indexOf(estadoDestino) * 0.05}s both`
                          }}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                              e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                              e.currentTarget.style.backgroundColor = '#dc2626';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(200, 21, 27, 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.backgroundColor = '#c8151b';
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

            {/* Historial del Caso - Siempre visible */}
            <div 
              className="p-6 border-t" 
              style={{
                borderColor: styles.cardHeader.borderColor,
                animation: 'fadeInSlide 0.3s ease-out 0.55s both'
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
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
                // Ordenar historial: primero las entradas de creación, luego por fecha ascendente
                // Filtrar entradas de tipo CREADO para no mostrarlas
                const historialFiltrado = historialSinDuplicados.filter(entry => entry.tipo_evento !== 'CREADO');
                
                const historialOrdenado = [...historialFiltrado].sort((a, b) => {
                  // Ordenar por fecha ascendente
                  const fechaA = new Date(a.fecha || a.fechaHora || 0).getTime();
                  const fechaB = new Date(b.fecha || b.fechaHora || 0).getTime();
                  return fechaA - fechaB; // Orden ascendente
                });

                return historialOrdenado.length > 0 ? (
                  <div className="space-y-4">
                    {historialOrdenado.map((entry: HistorialEntry | any, idx: number) => {
                      // Formatear texto del evento según tipo
                      let textoEvento = '';
                      // Detectar si es realmente un cambio de estado o una edición/reasignación
                      const esCambioEstadoReal = entry.tipo_evento === 'CAMBIO_ESTADO' && 
                                                 entry.estado_anterior && 
                                                 entry.estado_nuevo &&
                                                 entry.estado_anterior !== 'N/A' && 
                                                 entry.estado_nuevo !== 'N/A' &&
                                                 entry.estado_anterior !== entry.estado_nuevo;
                      
                      // Detectar si es una edición (contiene "Se ha editado" o similar en el detalle)
                      const justificacion = entry.justificacion || entry.detalle || '';
                      const esEdicion = justificacion.toUpperCase().includes('SE HA EDITADO') || 
                                       justificacion.toUpperCase().includes('EDITADO') ||
                                       justificacion.toUpperCase().includes('ACTUALIZADO') ||
                                       (entry.estado_anterior === 'N/A' && entry.estado_nuevo === 'N/A' && entry.tipo_evento === 'CAMBIO_ESTADO');
                      
                      // Detectar si es reasignación
                      const esReasignacion = justificacion.toUpperCase().includes('REASIGN') || 
                                            justificacion.toUpperCase().includes('ASIGNAR');
                      
                      if (esCambioEstadoReal && !esEdicion && !esReasignacion) {
                        // Es un cambio de estado real: mostrar "Estado cambiado de X a Y"
                        textoEvento = `Estado cambiado de ${entry.estado_anterior} a ${entry.estado_nuevo}`;
                      } else if (entry.tipo_evento === 'CAMBIO_ESTADO') {
                        // Si es el primer cambio de estado (de N/A a NUEVO), es la creación del caso
                        const esCreacion = (entry.estado_anterior === 'N/A' || !entry.estado_anterior) && 
                                          (entry.estado_nuevo === 'NUEVO' || entry.estado_nuevo === 'Nuevo');
                        
                        if (esCreacion) {
                          textoEvento = 'Caso registrado en el sistema';
                        } else if (esEdicion || esReasignacion) {
                          // Es una edición o reasignación marcada como CAMBIO_ESTADO
                          textoEvento = 'Actualización del caso';
                        } else {
                          // Cambio de estado pero con valores N/A o iguales
                          textoEvento = 'Actualización del caso';
                        }
                      } else {
                        // Para otros tipos de eventos (edición, reasignación, etc.), mostrar texto genérico
                        let textoOriginal = entry.detalle || entry.descripcion || entry.accion || 'Evento del caso';
                        
                        // Reemplazar "INGRESO DE NUEVO CASO" por texto más profesional
                        if (textoOriginal.toUpperCase().includes('INGRESO DE NUEVO CASO') || 
                            textoOriginal.toUpperCase().includes('INGRESO NUEVO CASO')) {
                          textoEvento = 'Caso registrado en el sistema';
                        } else if (!textoOriginal || textoOriginal.trim() === '') {
                          // Si no hay texto específico, mostrar genérico
                          textoEvento = 'Actualización del caso';
                        } else {
                          textoEvento = textoOriginal;
                        }
                      }

                      const fecha = entry.fecha || entry.fechaHora || entry.createdAt || new Date().toISOString();
                      const autorNombre = entry.autor_nombre || entry.usuario || entry.user || 'Sistema';
                      const autorRol = entry.autor_rol || 'sistema';
                      // justificacion ya está declarada arriba

                      return (
                        <div 
                          key={idx} 
                          className="relative pl-12 border-l-2 transition-all hover:translate-x-1" 
                          style={{
                            borderColor: 'rgba(59, 130, 246, 0.2)',
                            animation: `fadeInSlide 0.3s ease-out ${0.6 + idx * 0.05}s both`
                          }}
                        >
                          <div 
                            className="absolute left-[-24px] top-2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg border-4 transition-all hover:scale-110"
                            style={{
                              backgroundColor: theme === 'dark' ? '#3b82f6' : '#107ab4',
                              borderColor: styles.card.backgroundColor
                            }}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div 
                            className="p-4 rounded-lg border transition-all ml-4 hover:shadow-md"
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
        <div 
          className="space-y-5"
          style={{
            animation: 'fadeInSlide 0.4s ease-out 0.2s both'
          }}
        >
          {/* Información del Cliente */}
          <section 
            className="rounded-xl border p-5 shadow-sm transition-all hover:shadow-md" 
            style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: styles.card.borderColor,
              color: styles.card.color,
              animation: 'fadeInSlide 0.3s ease-out 0.25s both'
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#eff6ff'}}>
                <Building2 className="w-4 h-4" style={{color: '#107ab4'}} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Cliente</h3>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                {/* Selector de Cliente con Búsqueda */}
                <div className="relative cliente-selector-container-edit">
                  <label className="block text-xs font-semibold mb-1.5" style={{color: styles.text.secondary}}>
                    Buscar Cliente
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{color: styles.text.tertiary}} />
                    <input
                      type="text"
                      value={clienteSearchTerm}
                      onChange={(e) => {
                        setClienteSearchTerm(e.target.value);
                        setShowClienteDropdown(true);
                        if (!e.target.value) {
                          handleClienteClear();
                        }
                      }}
                      onFocus={() => setShowClienteDropdown(true)}
                      placeholder="Buscar por ID, nombre, email o teléfono..."
                      className="w-full pl-9 pr-9 py-2.5 border rounded-lg outline-none focus:ring-2 transition-all text-xs font-medium"
                      style={{
                        ...styles.input,
                        borderColor: styles.input.borderColor
                      }}
                    />
                    {editedCase.clienteId && (
                      <button
                        type="button"
                        onClick={handleClienteClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors rounded"
                        style={{color: styles.text.tertiary}}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de resultados */}
                  {showClienteDropdown && filteredClientes.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 rounded-lg shadow-2xl max-h-60 overflow-y-auto border" style={{...styles.card}}>
                      <div className="p-2 border-b sticky top-0" style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}>
                        <p className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                          {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                        </p>
                      </div>
                      {filteredClientes.map((cliente) => (
                        <div
                          key={cliente.idCliente}
                          onClick={() => handleClienteSelect(cliente)}
                          className="p-3 cursor-pointer border-b last:border-b-0 transition-all"
                          style={{
                            borderColor: 'rgba(148, 163, 184, 0.1)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{color: '#107ab4'}} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold" style={{color: styles.text.primary}}>
                                  {cliente.nombreEmpresa}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                                  backgroundColor: theme === 'dark' ? '#0f172a' : '#e2e8f0',
                                  color: styles.text.secondary
                                }}>
                                  {cliente.idCliente}
                                </span>
                              </div>
                              <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>
                                {cliente.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showClienteDropdown && clienteSearchTerm && filteredClientes.length === 0 && (
                    <div className="absolute z-50 w-full mt-2 rounded-lg shadow-2xl p-6 text-center border" style={{...styles.card}}>
                      <Search className="w-8 h-8 mx-auto mb-2" style={{color: styles.text.tertiary}} />
                      <p className="text-xs font-bold mb-1" style={{color: styles.text.primary}}>No se encontraron clientes</p>
                      <p className="text-xs" style={{color: styles.text.tertiary}}>Intenta buscar por ID, nombre, email o teléfono</p>
                    </div>
                  )}
                </div>

                {/* Información del cliente seleccionado */}
                {editedCase.clienteId && (
                  <div className="p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                    <p className="text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Cliente Seleccionado</p>
                    <p className="text-sm font-bold" style={{color: styles.text.primary}}>{editedCase.clientName}</p>
                    <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>ID: {editedCase.clienteId}</p>
                  </div>
                )}

                {/* Campos editables de contacto */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{color: styles.text.secondary}}>
                      Email de Contacto
                    </label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                      <Mail className="w-4 h-4 flex-shrink-0" style={{color: '#64748b'}}/>
                      <input
                        type="email"
                        value={editedCase.clientEmail || ''}
                        onChange={(e) => setEditedCase({ ...editedCase, clientEmail: e.target.value })}
                        className="flex-1 text-xs font-medium px-2 py-1 border rounded outline-none focus:ring-2 transition-all"
                        style={{
                          backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                          borderColor: 'rgba(148, 163, 184, 0.2)',
                          color: styles.text.secondary
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#107ab4';
                          e.target.style.boxShadow = '0 0 0 2px rgba(16, 122, 180, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                          e.target.style.boxShadow = 'none';
                        }}
                        placeholder="correo@empresa.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{color: styles.text.secondary}}>
                      Teléfono de Contacto
                    </label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                      <Phone className="w-4 h-4 flex-shrink-0" style={{color: '#64748b'}}/>
                      <input
                        type="tel"
                        value={editedCase.clientPhone || ''}
                        onChange={(e) => setEditedCase({ ...editedCase, clientPhone: e.target.value })}
                        className="flex-1 text-xs font-medium px-2 py-1 border rounded outline-none focus:ring-2 transition-all"
                        style={{
                          backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                          borderColor: 'rgba(148, 163, 184, 0.2)',
                          color: styles.text.secondary
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#107ab4';
                          e.target.style.boxShadow = '0 0 0 2px rgba(16, 122, 180, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                          e.target.style.boxShadow = 'none';
                        }}
                        placeholder="+503 0000-0000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div 
                  className="p-3 rounded-lg border transition-all hover:scale-[1.02]" 
                  style={{
                    backgroundColor: styles.input.backgroundColor, 
                    borderColor: styles.input.borderColor,
                    animation: 'fadeInSlide 0.3s ease-out 0.35s both'
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Cliente</p>
                  <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                    {caso.clientName || caso.cliente?.nombreEmpresa || 'Sin cliente'}
                  </p>
                  {(caso.clienteId || caso.clientId) && (
                    <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>
                      ID: {caso.clienteId || caso.clientId}
                    </p>
                  )}
                </div>
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]" 
                  style={{
                    backgroundColor: styles.input.backgroundColor, 
                    borderColor: styles.input.borderColor,
                    animation: 'fadeInSlide 0.3s ease-out 0.4s both'
                  }}
                >
                  <Mail className="w-4 h-4" style={{color: '#64748b'}}/>
                  <p className="text-xs font-medium" style={{color: styles.text.secondary}}>{caso.clientEmail || 'No disponible'}</p>
                </div>
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]" 
                  style={{
                    backgroundColor: styles.input.backgroundColor, 
                    borderColor: styles.input.borderColor,
                    animation: 'fadeInSlide 0.3s ease-out 0.45s both'
                  }}
                >
                  <Phone className="w-4 h-4" style={{color: '#64748b'}}/>
                  <p className="text-xs font-medium" style={{color: styles.text.secondary}}>{caso.clientPhone || caso.cliente?.telefono || 'No disponible'}</p>
                </div>
              </div>
            )}
          </section>

          {/* Agente Asignado */}
          <section 
            className="rounded-xl border p-5 shadow-sm transition-all hover:shadow-md" 
            style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: styles.card.borderColor,
              color: styles.card.color,
              animation: 'fadeInSlide 0.3s ease-out 0.3s both'
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{backgroundColor: theme === 'dark' ? '#020617' : '#f1f5f9'}}>
                  <User className="w-4 h-4" style={{color: '#64748b'}} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.primary}}>Agente Asignado</h3>
              </div>
              {!isCaseClosed && canReassign && (
                <button
                  onClick={handleReassignClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border"
                  style={{
                    color: '#107ab4',
                    borderColor: 'rgba(16, 122, 180, 0.3)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(16, 122, 180, 0.1)';
                    e.currentTarget.style.borderColor = '#107ab4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(16, 122, 180, 0.3)';
                  }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Reasignar
                </button>
              )}
            </div>
            <div 
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${!isCaseClosed && canReassign ? 'cursor-pointer' : ''}`}
              style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}
              onClick={!isCaseClosed && canReassign ? handleReassignClick : undefined}
              onMouseEnter={(e) => {
                if (!isCaseClosed && canReassign) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff';
                  e.currentTarget.style.borderColor = '#107ab4';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
                e.currentTarget.style.borderColor = styles.input.borderColor;
              }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: '#c8151b'}}>
                {(caso.agenteAsignado?.nombre || caso.agentName || 'N/A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                  {caso.agenteAsignado?.nombre || caso.agentName || 'Sin asignar'}
                </p>
                {!isCaseClosed && canReassign && (
                  <p className="text-xs mt-0.5" style={{color: styles.text.tertiary}}>
                    Click para reasignar
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Unificado de Justificación */}
      {showJustificationModal && pendingNewState && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" 
          style={{
            backgroundColor: styles.modal.overlay,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            className="rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border" 
            style={{
              ...styles.modal, 
              borderColor: styles.card.borderColor,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                Cambiar estado a {pendingNewState}
              </h3>
              <button 
                onClick={() => {
                  setShowJustificationModal(false);
                  setPendingNewState(null);
                  setJustification('');
                  setErrorMessage('');
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
                {errorMessage && (
                  <div className="mt-3 p-3 rounded-lg border-2 border-red-500" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)'}}>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-red-600 mb-1">Comentario no válido</p>
                        <p className="text-xs text-red-600">{errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* Modal de Reasignación de Agente */}
      {/* Modal de Selección Rápida de Cliente */}
      {showClienteQuickSelectModal && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" 
          style={{
            backgroundColor: styles.modal.overlay,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            className="rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl border" 
            style={{
              ...styles.modal, 
              borderColor: styles.card.borderColor,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <div>
                <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                  Asignar Cliente al Caso
                </h3>
                <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>
                  Debes seleccionar un cliente antes de cambiar a "En Proceso"
                </p>
              </div>
              <button
                onClick={() => {
                  setShowClienteQuickSelectModal(false);
                  setPendingStateAfterClientSelect(null);
                  setClienteQuickSearchTerm('');
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
              {/* Buscador de clientes */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Buscar Cliente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color: styles.text.tertiary}} />
                  <input
                    type="text"
                    value={clienteQuickSearchTerm}
                    onChange={(e) => setClienteQuickSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, nombre, email o teléfono..."
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 transition-all text-xs font-medium"
                    style={{
                      ...styles.input,
                      borderColor: styles.input.borderColor
                    }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Lista de clientes */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Selecciona un Cliente <span className="text-red-500">*</span>
                </label>
                <div 
                  className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2" 
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
                    borderColor: styles.input.borderColor
                  }}
                >
                  {filteredClientesQuick.length === 0 ? (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" style={{color: styles.text.tertiary}} />
                      <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                        {clienteQuickSearchTerm ? 'No se encontraron clientes' : 'Escribe para buscar clientes'}
                      </p>
                    </div>
                  ) : (
                    filteredClientesQuick.map((cliente) => (
                      <div
                        key={cliente.idCliente}
                        onClick={() => handleQuickClienteSelect(cliente)}
                        className="p-3 rounded-lg border cursor-pointer transition-all"
                        style={{
                          backgroundColor: styles.input.backgroundColor,
                          borderColor: 'rgba(148, 163, 184, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff';
                          e.currentTarget.style.borderColor = '#107ab4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
                          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{color: '#107ab4'}} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-bold" style={{color: styles.text.primary}}>
                                {cliente.nombreEmpresa}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                                backgroundColor: 'rgba(16, 122, 180, 0.1)',
                                color: '#107ab4'
                              }}>
                                {cliente.idCliente}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                <User className="w-3 h-3" />
                                {cliente.contactoPrincipal}
                              </div>
                              {cliente.email && (
                                <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                  <Mail className="w-3 h-3" />
                                  {cliente.email}
                                </div>
                              )}
                              {cliente.telefono && (
                                <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                  <Phone className="w-3 h-3" />
                                  {cliente.telefono}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReassignModal && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" 
          style={{
            backgroundColor: styles.modal.overlay,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            className="rounded-xl w-full max-w-md overflow-hidden shadow-2xl border" 
            style={{
              ...styles.modal, 
              borderColor: styles.card.borderColor,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: styles.cardHeader.borderColor}}>
              <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                Reasignar Caso
              </h3>
              <button 
                onClick={handleCancelReassign}
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
                Selecciona el nuevo agente asignado para este caso.
              </p>
              
              {/* Selector de Agente */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Nuevo Agente <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {agentes.filter(a => a.estado === 'Activo').map((agente) => {
                    const isSelected = selectedAgentId === agente.idAgente;
                    const isCurrent = (caso?.agentId || caso?.agenteAsignado?.idAgente) === agente.idAgente;
                    
                    return (
                      <div
                        key={agente.idAgente}
                        onClick={() => setSelectedAgentId(agente.idAgente)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'shadow-md' : ''}`}
                        style={{
                          backgroundColor: isSelected ? 'rgba(16, 122, 180, 0.1)' : styles.input.backgroundColor,
                          borderColor: isSelected ? '#107ab4' : (isCurrent ? 'rgba(200, 21, 27, 0.3)' : styles.input.borderColor)
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : '#f8fafc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: '#c8151b'}}>
                            {agente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                                {agente.nombre}
                              </p>
                              {isCurrent && (
                                <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{
                                  backgroundColor: 'rgba(200, 21, 27, 0.1)',
                                  color: '#c8151b'
                                }}>
                                  Actual
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-0.5" style={{color: styles.text.tertiary}}>
                              {agente.casosActivos || 0} casos activos
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5" style={{color: '#107ab4'}} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={handleCancelReassign}
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
                  onClick={handleConfirmReassign}
                  disabled={transitionLoading || !selectedAgentId}
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
                  {transitionLoading ? 'Reasignando...' : 'Reasignar Caso'}
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

      {/* Animación de comentario no válido */}
      {showInvalidCommentAnimation && errorMessage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.3s ease-out'
          }}
          onClick={() => {
            setShowInvalidCommentAnimation(false);
            setErrorMessage('');
          }}
        >
          <div 
            className="max-w-md w-full"
            style={{
              animation: 'scaleInBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icono de advertencia animado */}
            <div className="flex justify-center mb-6">
              <div
                className="relative"
                style={{
                  animation: 'shakePop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both'
                }}
              >
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                    boxShadow: '0 20px 60px rgba(245, 158, 11, 0.5)'
                  }}
                >
                  <AlertTriangle 
                    className="w-16 h-16 text-white" 
                    style={{
                      strokeWidth: 2.5
                    }}
                  />
                </div>
                {/* Anillos de expansión */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '3px solid #f59e0b',
                    animation: 'ringExpand 1s ease-out 0.3s',
                    opacity: 0
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '3px solid #f97316',
                    animation: 'ringExpand 1s ease-out 0.5s',
                    opacity: 0
                  }}
                />
              </div>
            </div>
            
            {/* Contenido del mensaje - SIMPLIFICADO */}
            <div 
              className="rounded-2xl overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
                borderColor: '#f59e0b',
                animation: 'fadeInUp 0.5s ease-out 0.4s both'
              }}
            >
              <div className="p-6">
                <h2 className="text-lg font-bold text-center mb-4" style={{color: '#f59e0b'}}>
                  Comentario No Válido
                </h2>
                
                <p className="text-sm leading-relaxed text-center mb-6" style={{
                  color: theme === 'dark' ? '#cbd5e1' : '#475569'
                }}>
                  {errorMessage}
                </p>
                
                <button
                  onClick={() => {
                    setShowInvalidCommentAnimation(false);
                    setErrorMessage('');
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #f97316)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Entendido
                </button>
              </div>
            </div>
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
        
        @keyframes shakePop {
          0% {
            transform: scale(0) rotate(-10deg);
            opacity: 0;
          }
          25% {
            transform: scale(1.2) rotate(5deg);
          }
          50% {
            transform: scale(0.95) rotate(-3deg);
          }
          75% {
            transform: scale(1.05) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
      `}</style>
    </div>
  );
};

export default CaseDetail;

