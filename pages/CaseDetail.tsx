import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import DocumentosPorEtapa from '../components/DocumentosPorEtapa';
import { sapService } from '../services/sapService';
import { getUserCountry } from '../services/caseService';
import { Case, CaseStatus, Cliente, AutorRol, HistorialEntry } from '../types';
import { getStateBadgeColor } from '../constants';
import { updateCaseStatus, updateCaseData, sendCaseCloseWebhook } from '../services/caseService';
import { ArrowLeft, MessageSquare, User, Building2, Phone, Mail, CheckCircle2, Clock, X, AlertTriangle, Lock, History, Users, TrendingUp, AlertCircle, Edit, Save, Search, Folder, Tag, Bell, UserCheck, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Case | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [agentes, setAgentes] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [userCountry, setUserCountry] = useState<'SV' | 'GT' | null>(null);
  const { theme } = useTheme();
  
  // Modal unificado de justificación
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingNewState, setPendingNewState] = useState<string | null>(null);
  const [justification, setJustification] = useState('');

  // Modal de gestion/tipificacion (sin cambio de estado)
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [gestionDetalle, setGestionDetalle] = useState('');

  // Modal de reasignación de caso
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [reassignUsuarioId, setReassignUsuarioId] = useState('');
  const [reassignMotivo, setReassignMotivo] = useState('');
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Array<{id: string; nombre: string; email: string; role: string}>>([]);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const [showInvalidCommentAnimation, setShowInvalidCommentAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isEstadoFinal, setIsEstadoFinal] = useState(false); // Nuevo estado para detectar si es un estado final
  const [estadoFinalParams, setEstadoFinalParams] = useState<any>(null); // Parámetros del estado final
  const [parametrosEstadoFinal, setParametrosEstadoFinal] = useState<any[]>([]); // Parámetros dinámicos del formulario
  const [requiereEquipo, setRequiereEquipo] = useState(false); // Para Diagnostico
  const [equipoCorrecto, setEquipoCorrecto] = useState(false); // Para Ejecucion
  const [formValues, setFormValues] = useState<Record<string, any>>({}); // Valores del formulario dinámico
  const [anexosEstadoFinal, setAnexosEstadoFinal] = useState(''); // Campo de anexos para estado final

  const isAnexoParam = (param: any) => {
    const nombre = String(param?.nombre_parametro || param?.name || '').toLowerCase();
    const tipo = String(param?.tipo || param?.type || '').toLowerCase();
    return nombre.includes('anexo') || tipo === 'adjuntar_archivo' || tipo === 'file';
  };
  
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
    const init = async () => {
      const country = await getUserCountry();
      setUserCountry(country);
    };
    init();
  }, []);

  useEffect(() => {
    if (userCountry === undefined) return;
    const initializeData = async () => {
      try {
        // Primero cargar clientes, luego agentes y categorías en paralelo
        await loadClientes();
        await Promise.all([loadAgentes(), loadCategorias()]);
        if (id) await loadCaso(id);
      } catch (error) {
      }
    };
    initializeData().catch((error) => {
      if (error?.message?.includes('message channel') || error?.message?.includes('listener')) {
        return;
      }
    });
  }, [id, userCountry]);
  
  // Cargar categorías del webhook (las creadas en Settings)
  const loadCategorias = async () => {
    try {
      const categoriasFromWebhook = await api.readCategories();
      if (categoriasFromWebhook && Array.isArray(categoriasFromWebhook)) {
        setCategorias(categoriasFromWebhook);
      }
    } catch (error) {
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

  // Cargar parámetros cuando se abre el modal y hay parámetros para el estado destino
  useEffect(() => {
    const loadParametrosEstadoFinal = async () => {
      // Limpiar estado anterior si se cierra el modal
      if (!showJustificationModal) {
        setParametrosEstadoFinal([]);
        setFormValues({});
        setAnexosEstadoFinal('');
        return;
      }

      // Limpiar siempre al abrir el modal
      setParametrosEstadoFinal([]);
      setFormValues({});
      setAnexosEstadoFinal('');
    };
    
    loadParametrosEstadoFinal();
  }, [showJustificationModal, isEstadoFinal, estadoFinalParams]);

  // Filtrar clientes según el término de búsqueda
  const filteredClientes = useMemo(() => {
    if (!clienteSearchTerm.trim()) {
      const result = clientes.slice(0, 50);
      console.log('[filteredClientes] No search term, returning', result.length, 'clientes');
      return result;
    }
    const term = clienteSearchTerm.toLowerCase();
    const result = clientes.filter(cliente =>
      cliente?.CardCode?.toLowerCase().includes(term) ||
      cliente?.CardName?.toLowerCase().includes(term)
    );
    console.log('[filteredClientes] Search term:', term, 'Results:', result.length);
    return result;
  }, [clientes, clienteSearchTerm]);
  
  // Filtrar clientes para el modal de selección rápida
  const filteredClientesQuick = useMemo(() => {
    if (!clienteQuickSearchTerm.trim()) {
      return clientes.slice(0, 50);
    }
    const term = clienteQuickSearchTerm.toLowerCase();
    return clientes.filter(cliente =>
      cliente?.CardCode?.toLowerCase().includes(term) ||
      cliente?.CardName?.toLowerCase().includes(term)
    );
  }, [clientes, clienteQuickSearchTerm]);

  const loadClientes = async () => {
    try {
      // ADMIN_GLOBAL: userCountry es null, no filtrar por país
      const pais = userCountry || undefined;
      console.log('[loadClientes] Loading clientes for pais:', pais || 'TODOS', 'userCountry:', userCountry);
      const data = await sapService.getClientesListado(pais as any);
      console.log('[loadClientes] Loaded:', data.length, 'clientes');
      setClientes(data);
    } catch (err) {
      console.error('[loadClientes] Error:', err);
    }
  };

  const loadAgentes = async () => {
    try {
      const data = await api.getAgentes(userCountry || undefined);
      setAgentes(data);
    } catch (err) {
    }
  };

  // Enriquecer nombres desde webhooks de clientes y agentes
  // IMPORTANTE: Solo enriquecer si faltan datos, NO sobrescribir datos existentes
  useEffect(() => {
    console.log('[enriquecer useEffect] caso:', caso?.id, 'clientes:', clientes.length, 'agentes:', agentes.length);

    if (!caso) {
      console.log('[enriquecer useEffect] No caso, returning');
      return;
    }

    if (clientes.length > 0 || agentes.length > 0) {
      let updated = false;
      const casoActualizado = { ...caso };

      // Enriquecer con cliente completo - usar búsqueda más robusta
      if (clientes.length > 0 && (casoActualizado.clientId || casoActualizado.clienteId)) {
        const clientIdBuscar = casoActualizado.clientId || casoActualizado.clienteId || '';

        console.log('[enriquecer useEffect] Buscando cliente para:', clientIdBuscar, 'en', clientes.length, 'clientes');

        // Función para normalizar IDs (misma lógica que BandejaCasos)
        const normalizeId = (id: string) => {
          if (!id) return '';
          let normalized = id.toString().trim().toUpperCase();
          if (!normalized.startsWith('CL')) {
            normalized = 'CL' + normalized.replace(/^CL/i, '');
          }
          const match = normalized.match(/^CL0*(\d+)$/);
          if (match) {
            normalized = 'CL' + match[1].padStart(6, '0');
          }
          return normalized;
        };

        const clientIdNormalized = normalizeId(clientIdBuscar);

        // Buscar cliente con múltiples estrategias
        const cliente = clientes.find(c => {
          if (!c?.CardCode) return false;
          const cliIdNormalized = normalizeId(c.CardCode);

          // Comparación normalizada
          if (clientIdNormalized === cliIdNormalized) return true;

          // Comparación directa
          if (c.CardCode === clientIdBuscar) return true;

          // Comparación numérica (solo números)
          const casoNum = clientIdBuscar.replace(/\D/g, '');
          const cliNum = c.CardCode.replace(/\D/g, '');
          if (casoNum && cliNum && casoNum === cliNum) return true;

          return false;
        });

        console.log('[enriquecer useEffect] Cliente encontrado:', cliente?.CardName);

        if (cliente) {

          // Enriquecer con datos del cliente
          if (!casoActualizado.clientName || casoActualizado.clientName === 'Sin cliente' || casoActualizado.clientName.trim() === '') {
            casoActualizado.clientName = cliente.CardName;
            updated = true;
          }
          if (!casoActualizado.cliente) {
            casoActualizado.cliente = cliente;
            updated = true;
          }
          if (!casoActualizado.clientEmail && cliente.Email) {
            casoActualizado.clientEmail = cliente.Email;
            updated = true;
          }
          if (!casoActualizado.clientPhone && cliente.Telefono) {
            casoActualizado.clientPhone = cliente.Telefono;
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
      'sin respuesta': CaseStatus.NUEVO, // Mantener como Nuevo para compatibilidad con enum
      'primer contacto': CaseStatus.PRIMER_CONTACTO,
      'primercontacto': CaseStatus.PRIMER_CONTACTO,
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
      const clientIdDelCaso = data.clientId || data.clienteId || data.cliente?.CardCode;
      const clientNameDelCaso = data.clientName || data.cliente?.CardName || '';
      
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
            c?.CardCode && (
              c.CardCode === clientIdDelCaso ||
              c.CardCode.toLowerCase() === clientIdDelCaso.toLowerCase() ||
              c.CardCode.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
            )
          );

          if (clienteEncontrado) {
            data.clientName = clienteEncontrado.CardName;
            data.cliente = clienteEncontrado;
            if (!data.clientEmail || (typeof data.clientEmail === 'string' && data.clientEmail.trim() === '') || data.clientEmail === null || data.clientEmail === undefined) {
              data.clientEmail = clienteEncontrado.Email || '';
            }
            const clientPhoneStr = data.clientPhone ? String(data.clientPhone) : '';
            if (!data.clientPhone || clientPhoneStr.trim() === '' || data.clientPhone === null || data.clientPhone === undefined) {
              data.clientPhone = clienteEncontrado.Telefono || '';
            }
          }
        } else {
          // Si no hay clientes en memoria, cargarlos ahora
          try {
            const paisCliente = data.pais === 'Guatemala' ? 'GT' : 'SV';
            const clientesDesdeAPI = await sapService.getClientesListado(paisCliente);
            setClientes(clientesDesdeAPI);

            const clienteEncontrado = clientesDesdeAPI.find(c =>
              c?.CardCode && (
                c.CardCode === clientIdDelCaso ||
                c.CardCode.toLowerCase() === clientIdDelCaso.toLowerCase() ||
                c.CardCode.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
              )
            );

            if (clienteEncontrado) {
              data.clientName = clienteEncontrado.CardName;
              data.cliente = clienteEncontrado;
              if (!data.clientEmail || (typeof data.clientEmail === 'string' && data.clientEmail.trim() === '') || data.clientEmail === null || data.clientEmail === undefined) {
                data.clientEmail = clienteEncontrado.Email || '';
              }
              const clientPhoneStr = data.clientPhone ? String(data.clientPhone) : '';
              if (!data.clientPhone || clientPhoneStr.trim() === '' || data.clientPhone === null || data.clientPhone === undefined) {
                data.clientPhone = clienteEncontrado.Telefono || '';
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
            c.CardCode === clientIdDelCaso ||
            c.CardCode.toLowerCase() === clientIdDelCaso.toLowerCase() ||
            c.CardCode.replace(/\D/g, '') === clientIdDelCaso.replace(/\D/g, '')
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
            const agentesDesdeAPI = await api.getAgentes(userCountry || undefined);
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
      
      // Normalizar el estado SOLO si es un estado conocido del enum (no convertir valores未知 como "Sin respuesta")
      // Mantener el valor original de n8n para que las transiciones coincidan correctamente
      
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
      // Cargar documentos del caso para mostrarlos en el historial
      try {
        const user = api.getUser();
        const docsRes = await fetch(`/api/casos/${data.case_id || caseId}/documentos`, {
          headers: {
            'X-User-Id': user?.id || '',
            'X-User-Role': user?.role || '',
            'X-User-Email': user?.email || '',
            'X-User-Pais': user?.pais || ''
          }
        });
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocumentos(docsData.documentos || []);
        }
      } catch (e) {
        // Silenciar error de documentos
      }
    } catch (error) {
      throw error; // Lanzar el error en lugar de usar fallback local
    }
  };

  // Validar si el caso está cerrado
  const isCaseClosed = caso?.status === CaseStatus.CERRADO;

  // Validar si el caso tiene cliente y categoría obligatorios
  const hasValidCliente = !!caso?.clientId && caso.clientId !== 'CL-UNKNOWN';
  const categoriaIdActual = caso?.categoria?.idCategoria || caso?.categoria?.id;
  const hasValidCategoria = !!categoriaIdActual && String(categoriaIdActual) !== '1';
  const hasRequiredData = hasValidCliente && hasValidCategoria;

  // Validar si se puede realizar una acción
  const canPerformAction = !isCaseClosed && !transitionLoading && hasRequiredData;

  // Obtener usuario actual para validar permisos
  const currentUser = api.getUser();
  const canReassign = currentUser && (currentUser.role === 'SUPERVISOR' || currentUser.role === 'GERENTE');

  // ==================================================
  // FUNCIÓN CENTRAL DE CAMBIO DE ESTADO
  // ==================================================
  const handleStateChange = async (newState: string, justificacion: string, equipoCorrectoVal?: boolean) => {
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
        clienteId = pendingClienteForStateChange.CardCode;
        clienteToUpdate = pendingClienteForStateChange;
        setPendingClienteForStateChange(null);
      } else {
        clienteId = caso?.clientId || caso?.clienteId || caso?.cliente?.CardCode || '';
      }

      if (clienteToUpdate && id) {
        await updateCaseData(id, {
          cliente_id: clienteToUpdate.CardCode,
          client_name: clienteToUpdate.CardName,
          client_email: caso?.clientEmail || clienteToUpdate.Email,
          client_phone: caso?.clientPhone || clienteToUpdate.Telefono
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
        clienteId,
        newState === 'Ejecucion' || newState === 'Ejecución' ? equipoCorrectoVal : undefined
      );
      
      setShowInvalidCommentAnimation(false);
      setShowErrorAnimation(false);
      setErrorMessage('');
      
      if (resultado && id) {
        // Siempre recargar para obtener historial y transiciones completas
        await loadCaso(id);
      } else if (id) {
        await loadCaso(id);
      }

      // Disparar evento global para que la bandeja se actualice
      window.dispatchEvent(new CustomEvent('sac-case-updated', { detail: { id, action: 'state-change' } }));

      // Cerrar modal
      setShowJustificationModal(false);
      setPendingNewState(null);
      setJustification('');
      setIsEstadoFinal(false);
      setEstadoFinalParams(null);
      setParametrosEstadoFinal([]);
      setFormValues({});
      setAnexosEstadoFinal('');
      setRequiereEquipo(false);
      
      // Mostrar animación de éxito SOLO si llegamos aquí (webhook aceptó y NO hubo error)
      // IMPORTANTE: Solo mostrar si NO hubo error (esto se verifica porque estamos en el try)
      // Asegurar que las animaciones de error estén desactivadas antes de mostrar éxito
      setShowInvalidCommentAnimation(false);
      setShowErrorAnimation(false);
      
      // Pequeño delay para asegurar que los estados anteriores se hayan actualizado
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Mostrar animación de éxito (si llegamos aquí es porque no hubo error)
      setShowSuccessAnimation(true);
      // Disparar evento global para que la bandeja se actualice
      window.dispatchEvent(new CustomEvent('sac-case-updated', { detail: { id, action: 'state-change' } }));
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      
    } catch (err: any) {
      setShowSuccessAnimation(false);
      
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
        
        // Mostrar animación de comentario no válido (el usuario debe cerrarla manualmente)
        setShowInvalidCommentAnimation(true);
        
        // IMPORTANTE: Salir temprano para evitar ejecutar el código de otros errores
        setTransitionLoading(false);
        return;
      } else {
        // Para otros errores, cerrar el modal y mostrar el error
        setShowJustificationModal(false);
        setPendingNewState(null);
        setJustification('');
        setIsEstadoFinal(false);
        setEstadoFinalParams(null);
        setParametrosEstadoFinal([]);
        setFormValues({});
        setAnexosEstadoFinal('');
        
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
  const handleActionClick = async (newState: string) => {
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
    
    // Obtener transiciones permitidas desde el backend (formato objeto)
    let transicionesPermitidas: string[] = [];
    
    if (caso?.transiciones && typeof caso.transiciones === 'object' && !Array.isArray(caso.transiciones)) {
      // El backend retorna: { "En proceso": { transiciones: ["Resuelto"] } }
      const estadoActual = caso.estado || caso.status || 'Nuevo';
      const transicionesDelEstado = caso.transiciones[estadoActual];
      if (transicionesDelEstado && Array.isArray(transicionesDelEstado.transiciones)) {
        transicionesPermitidas = transicionesDelEstado.transiciones.filter(Boolean);
      }
    }

    // Verificar si la transición está permitida usando comparación directa
    if (!transicionesPermitidas.includes(newState)) {
      const estadoActualFormateado = formatEstadoName(estadoActual);
      const newStateFormateado = formatEstadoName(newState);
      const transicionesFormateadas = transicionesPermitidas.map(formatEstadoName).join(', ');
      alert(`No se puede cambiar de "${estadoActualFormateado}" a "${newStateFormateado}". Transiciones permitidas: ${transicionesFormateadas}`);
      return;
    }

    // Obtener configuración de workflow desde el backend para saber si es estado final y sus parámetros
    let esEstadoFinal = false;
    let estadoFinalParams: any = null;
    let parametrosDestino: any[] = [];

    try {
      const workflowConfig = await api.getWorkflowConfig(estadoActual);
      const transicionDestino = workflowConfig?.transiciones?.find(
        (t: any) => t.nombre === newState
      );

      if (transicionDestino) {
        esEstadoFinal = transicionDestino.estado_final === true;
        parametrosDestino = transicionDestino.parametros || [];
        if (esEstadoFinal || parametrosDestino.length > 0) {
          estadoFinalParams = {
            id: transicionDestino.id,
            nombre: transicionDestino.nombre,
            parametros: parametrosDestino
          };
        }
      }
    } catch (error) {
      console.error('Error al obtener configuración de workflow:', error);
    }

    // Abrir modal de justificación (o formulario de cierre si es estado final)
    setPendingNewState(newState);
    setJustification('');
    setErrorMessage('');
    setIsEstadoFinal(esEstadoFinal); // Guardar si es estado final
    setEstadoFinalParams(estadoFinalParams); // Guardar los parámetros del estado final
    setParametrosEstadoFinal(parametrosDestino);
    setShowJustificationModal(true);
  };

  // Confirmar cambio de estado desde el modal
  const confirmStateChange = async () => {
    if (!pendingNewState) {
      return;
    }
    
    // Si es estado final, pedir anexos/parámetros dinámicos y enviar al webhook de cierre
    if (isEstadoFinal) {
      const justificacionTrim = justification.trim();
      if (!justificacionTrim) {
        setErrorMessage('La justificación es obligatoria');
        return;
      }

      setErrorMessage('');
      
      const clienteId = caso?.clientId || caso?.clienteId || caso?.cliente?.CardCode || '';
      const caseId = caso?.id || caso?.ticketNumber || id || '';
      
      setTransitionLoading(true);
      setErrorMessage('');
      
      let webhookResponse;
      try {
        webhookResponse = await sendCaseCloseWebhook(caseId, clienteId, '', {});
      } catch (error) {
        setErrorMessage('Error de conexión. Intente nuevamente.');
        setTransitionLoading(false);
        return;
      }
      
      if (!webhookResponse.success) {
        setErrorMessage(webhookResponse.message || 'Los datos ingresados no son válidos');
        setTransitionLoading(false);
        return;
      }
      
      const justificacionCierre = justificacionTrim;
      try {
        await handleStateChange(pendingNewState, justificacionCierre);
      } catch (err) {
        setTransitionLoading(false);
      }
      return;
    } else {
      // Anexos/Resolución SOLO aplican para SV. Para GT, cambio de estado normal sin anexos.
      const esDiagnostico = pendingNewState === 'Diagnostico' || pendingNewState === 'Diagnóstico';
      const esSV = caso?.pais === 'ElSalvador';

      // Validar justificación PRIMERO (siempre, antes de cualquier caso especial)
      const justificacionTrim = justification.trim();
      if (!justificacionTrim) {
        setErrorMessage('La justificación es obligatoria');
        return;
      }
      if (justificacionTrim.length < 10) {
        setErrorMessage('La justificación debe tener al menos 10 caracteres');
        return;
      }
      const soloNumeros = /^\d+$/;
      if (soloNumeros.test(justificacionTrim)) {
        setErrorMessage('La justificación no puede ser solo números');
        return;
      }
      const soloSignos = /^[^\w\s]+$/;
      if (soloSignos.test(justificacionTrim)) {
        setErrorMessage('La justificación no puede ser solo signos o símbolos');
        return;
      }
      const simbolosPeligrosos = /[<>{}[\]\\|]/;
      if (simbolosPeligrosos.test(justificacionTrim)) {
        setErrorMessage('La justificación no puede contener símbolos como < > { } [ ] \\ |');
        return;
      }
      if (justificacionTrim.length > 500) {
        setErrorMessage('La justificación no puede exceder 500 caracteres');
        return;
      }

      // Caso especial: Diagnostico con requiereEquipo (solo SV)
      // CONCATENAR al comentario del usuario, NO sobrescribirlo
      if (esDiagnostico && requiereEquipo && esSV) {
        const anexosValor = anexosEstadoFinal.trim();
        if (!anexosValor) {
          setErrorMessage('Por favor, ingrese los anexos');
          return;
        }
        const comentarioFinal = `${justificacionTrim} | Requiere equipo. Anexos: ${anexosValor}.`;
        handleStateChange(pendingNewState, comentarioFinal);
        return;
      }

      // Caso: Diagnostico con parámetros dinámicos (anexos + resolución) - solo SV
      if (esDiagnostico && parametrosEstadoFinal.length > 0 && esSV) {
        const anexosValor = anexosEstadoFinal.trim();
        const resolucionValor = (formValues['resolucion'] || '').toString().trim();
        if (!anexosValor) {
          setErrorMessage('Por favor, ingrese los anexos');
          return;
        }
        if (!resolucionValor) {
          setErrorMessage('Por favor, ingrese la resolución del diagnóstico');
          return;
        }
        const comentarioFinal = `${justificacionTrim} | Anexos: ${anexosValor}. Resolución: ${resolucionValor}.`;
        handleStateChange(pendingNewState, comentarioFinal);
        return;
      }

      // Caso especial: Ejecucion/Ejecución con equipoCorrecto
      // CONCATENAR al comentario del usuario, NO sobrescribirlo
      if (pendingNewState === 'Ejecucion' || pendingNewState === 'Ejecución') {
        const decisionEquipo = equipoCorrecto
          ? 'Equipo verificado y funciona correctamente'
          : 'Equipo requiere revisión/falla';
        const comentarioFinal = `${justificacionTrim} | ${decisionEquipo}`;
        handleStateChange(pendingNewState, comentarioFinal, equipoCorrecto);
        return;
      }

      // Flujo normal: enviar el comentario tal cual
      handleStateChange(pendingNewState, justificacionTrim);
    }
  };

  // ==================================================
  // REGISTRAR GESTION / TIPIFICACION
  // Estado del caso NO cambia. Solo agrega entrada en historial_casos.
  // ==================================================
  const handleRegistrarGestion = () => {
    setGestionDetalle('');
    setErrorMessage('');
    setShowGestionModal(true);
  };

  const confirmarGestion = async () => {
    const detalle = gestionDetalle.trim();
    if (detalle.length < 5) {
      setErrorMessage('El detalle debe tener al menos 5 caracteres');
      return;
    }

    setTransitionLoading(true);
    setErrorMessage('');
    try {
      const caseId = caso?.id || caso?.ticketNumber || id;
      if (!caseId) {
        setErrorMessage('No se encontro el ID del caso');
        setTransitionLoading(false);
        return;
      }
      await api.registrarGestion(caseId, detalle);
      setShowGestionModal(false);
      setGestionDetalle('');
      setToast({ message: 'Gestion registrada correctamente', type: 'success' });
      // Recargar el caso
      if (id) {
        await loadCaso(id);
      }
      // Disparar evento global para que la bandeja se actualice
      window.dispatchEvent(new CustomEvent('sac-case-updated', { detail: { caseId, action: 'gestion' } }));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al registrar la gestion');
    } finally {
      setTransitionLoading(false);
    }
  };

  // ==================================================
  // REASIGNAR CASO
  // ==================================================
  const handleReasignar = async () => {
    setReassignUsuarioId('');
    setReassignMotivo('');
    setErrorMessage('');
    setShowReasignarModal(true);

    // Cargar usuarios disponibles del mismo país.
    // - Dropdown normal: solo AGENTE y SUPERVISOR
    // - Excepción: si el usuario actual es ADMINISTRADOR, se incluye a sí mismo
    //   en el dropdown para que pueda reasignarse el caso a sí mismo.
    // - GERENTE y ADMIN_GLOBAL NO aparecen.
    const casoPais = (caso?.pais === 'Guatemala' || caso?.pais === 'ElSalvador') ? caso.pais : null;
    const currentUserPais = api.getUser()?.pais;
    const pais = casoPais || currentUserPais;
    if (!pais) {
      setErrorMessage('No se pudo determinar el pais del caso');
      return;
    }

    const ROLES_REASIGNABLES = ['AGENTE', 'SUPERVISOR'];
    const currentUser = api.getUser();
    const isCurrentUserAdmin = currentUser?.role === 'ADMINISTRADOR';

    try {
      const resp = await api.getUsuarios({ pais });
      const usuarios = Array.isArray(resp) ? resp : [];
      // Excluir al agente actual. Si el usuario actual es ADMINISTRADOR, sí puede
      // reasignarse a sí mismo (caso especial: aparece en el dropdown aunque su rol
      // no esté en ROLES_REASIGNABLES). Para otros roles, no aparece.
      const currentUserId = currentUser?.id;
      setUsuariosDisponibles(usuarios.filter((u: any) => {
        if (u.id === caso?.agente_user_id) return false;
        if (u.estado !== 'ACTIVO') return false;
        // El usuario actual ADMINISTRADOR puede auto-reasignarse
        if (isCurrentUserAdmin && u.id === currentUserId) return true;
        // Para todos los demás casos, filtrar por roles reasignables
        return ROLES_REASIGNABLES.includes(String(u.role || '').toUpperCase());
      }));
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setErrorMessage('Error cargando lista de usuarios');
    }
  };

  const confirmarReasignacion = async () => {
    if (!reassignUsuarioId) {
      setErrorMessage('Selecciona un usuario para reasignar');
      return;
    }
    setTransitionLoading(true);
    setErrorMessage('');
    try {
      const caseId = caso?.id || caso?.ticketNumber || id;
      if (!caseId) {
        setErrorMessage('No se encontro el ID del caso');
        setTransitionLoading(false);
        return;
      }
      await api.reassignCase(caseId, reassignUsuarioId, reassignMotivo.trim());
      setShowReasignarModal(false);
      setReassignUsuarioId('');
      setReassignMotivo('');
      setToast({ message: 'Caso reasignado correctamente', type: 'success' });
      if (id) {
        await loadCaso(id);
      }
      window.dispatchEvent(new CustomEvent('sac-case-updated', { detail: { caseId, action: 'reasign' } }));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al reasignar el caso');
    } finally {
      setTransitionLoading(false);
    }
  };

  // ==================================================
  // FUNCIONES DE EDICIÓN DEL CASO
  // ==================================================
  const handleEditClick = () => {
    setIsEditing(true);
    // Obtener el nombre del cliente desde diferentes fuentes posibles
    const clientName = caso?.clientName || caso?.cliente?.CardName || '';
    const clientEmail = caso?.clientEmail || caso?.cliente?.email || '';
    const clientPhone = caso?.clientPhone || caso?.cliente?.telefono || '';
    const contactoPrincipal = caso?.contacto_principal || caso?.contactoPrincipal || '';
    
    // Inicializar con los valores actuales del caso
    setEditedCase({
      subject: caso?.subject,
      description: caso?.description,
      clienteId: caso?.clientId || caso?.clienteId,
      clientName: clientName,
      clientEmail: clientEmail,
      clientPhone: clientPhone,
      contactoPrincipal: contactoPrincipal,
      categoriaId: Number(caso?.categoria?.idCategoria || caso?.categoria?.id || 1)
    });
    // Inicializar el término de búsqueda con el ID y nombre del cliente actual
    const clienteActual = clientes.find(c => c.CardCode === (caso?.clienteId || caso?.clientId));
    if (clienteActual) {
      setClienteSearchTerm(`${clienteActual.CardCode} - ${clienteActual.CardName}`);
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

  const handleClienteSelect = (cliente: any) => {
    if (!cliente?.CardCode) return;
    setEditedCase({
      ...editedCase,
      clienteId: cliente.CardCode,
      clientName: cliente.CardName || '-',
    });
    setClienteSearchTerm(`${cliente.CardCode} - ${cliente.CardName || '-'}`);
    setShowClienteDropdown(false);
  };
  
  // Selección rápida de cliente desde el modal (sin entrar en modo edición)
  const handleQuickClienteSelect = (cliente: any) => {
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
    setSelectedAgentId(caso?.agentId || caso?.agenteAsignado?.id_agente || '');
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

    const currentAgentId = caso.agentId || caso.agenteAsignado?.id_agente || '';
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
        const agenteReasignado = agentes.find(a => a.id_agente === selectedAgentId);
        if (agenteReasignado && caso) {
          // Actualizar el caso con el nuevo agente
          setCaso({
            ...caso,
            agentId: agenteReasignado.id_agente,
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
      const originalClientName = caso?.clientName || caso?.cliente?.CardName || '';
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
      
      // Solo enviar contacto_principal si fue editado
      if (editedCase.hasOwnProperty('contactoPrincipal')) {
        updates.contacto_principal = editedCase.contactoPrincipal || '';
      }

      // Enviar categoria_id si fue editada
      if (editedCase.hasOwnProperty('categoriaId') && editedCase.categoriaId) {
        updates.categoria_id = Number(editedCase.categoriaId);
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
  
  // Obtener transiciones permitidas desde el backend
  let validTransitions: string[] = [];
  
  if (caso.transiciones && typeof caso.transiciones === 'object') {
    // El backend ahora envía { "Nuevo": { transiciones: ["En proceso"] }, ... }
    // Buscar directamente usando el nombre del estado actual
    const transicionesDelEstadoActual = caso.transiciones[estadoActual];
    
    if (transicionesDelEstadoActual && Array.isArray(transicionesDelEstadoActual.transiciones)) {
      validTransitions = transicionesDelEstadoActual.transiciones.filter(Boolean);
    }
  }

  // Usar información SLA del backend en días hábiles
  const isSLAExpired = caso.slaExpired === true || caso.slaExpired === 'true';
  const diasAbierto = caso.diasAbierto ?? 0;
  const diasRestantes = caso.diasRestantes ?? caso.slaDias ?? 1;
  const slaDeadline = caso.fechaFinSla ? new Date(caso.fechaFinSla) : null;
  const createdDateDisplay = caso.fechaCreacionFormateada 
    ? caso.fechaCreacionFormateada
    : (caso.fecha_creacion ? new Date(caso.fecha_creacion).toLocaleString('es-ES', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
  const createdDate = caso.fecha_creacion ? new Date(caso.fecha_creacion) : new Date();
  
  // Calcular días de atraso (si el SLA ya venció)
  const now = new Date();
  let daysOverdue = 0;
  if (slaDeadline && now > slaDeadline) {
    const diffMs = now.getTime() - slaDeadline.getTime();
    daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  const slaDias = caso.slaDias ?? 1;

  // Usar progreso dinámico del backend, NO usar el progreso de la DB (que puede estar desactualizado)
  const caseProgress = caso?.dynamicProgress ?? 0;

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
                    {createdDateDisplay}
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
                    {slaDeadline ? slaDeadline.toLocaleDateString('es-ES', { timeZone: 'America/Guatemala', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
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
                    {slaDias} días hábiles
                  </p>
                  <p className="text-xs" style={{color: styles.text.tertiary}}>{slaDias * 24} horas hábiles</p>
                </div>
                {isSLAExpired ? (
                  <div 
                    className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: 'rgba(153, 27, 27, 0.25)', 
                      border: '1px solid rgba(153, 27, 27, 0.4)',
                      animation: 'fadeInSlide 0.3s ease-out 0.4s both'
                    }}
                  >
                    <p className="text-xs mb-1 font-semibold" style={{color: '#f87171'}}>SLA Vencido</p>
                    <p className="text-sm font-bold" style={{color: '#fca5a5'}}>
                      {daysOverdue} días de atraso
                    </p>
                  </div>
                ) : diasRestantes <= 1 && diasRestantes > 0 ? (
                  <div 
                    className="p-3 rounded-lg transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      animation: 'fadeInSlide 0.3s ease-out 0.4s both'
                    }}
                  >
                    <p className="text-xs mb-1 font-semibold" style={{color: '#f59e0b'}}>En Riesgo</p>
                    <p className="text-sm font-bold" style={{color: '#f59e0b'}}>
                      {diasRestantes} días hábiles restantes
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
                      {diasRestantes} días hábiles
                    </p>
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

            {/* Documentos por etapa */}
            <div className="mt-4">
              <DocumentosPorEtapa
                casoId={caso.case_id || caso.id || id || ''}
                etapaActual={estadoActual}
                theme={theme}
              />
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
                ) : !hasRequiredData ? (
                 <div className="p-5 rounded-lg border-2" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                   <div className="flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 mt-0.5" style={{color: '#f59e0b'}} />
                     <div>
                       <p className="text-sm font-bold mb-1" style={{color: styles.text.secondary}}>Datos Obligatorios Faltantes</p>
                       <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                         {!hasValidCliente && !hasValidCategoria && 'Debes asignar un cliente y una categoría antes de continuar.'}
                         {!hasValidCliente && hasValidCategoria && 'Debes asignar un cliente antes de continuar.'}
                         {hasValidCliente && !hasValidCategoria && 'Debes asignar una categoría antes de continuar.'}
                       </p>
                     </div>
                   </div>
                 </div>
                ) : validTransitions.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                   {/* Botón deshabilitado que muestra el estado actual */}
                   {(() => {
                     const estadoActualFormateado = formatEstadoName(caso?.estado || caso?.status || '');
                     return estadoActualFormateado ? (
                       <div className="relative group">
                         <button
                           disabled
                           className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all opacity-50 cursor-not-allowed border-2"
                           style={{
                             backgroundColor: 'transparent',
                             borderColor: theme === 'dark' ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.3)',
                             color: theme === 'dark' ? '#94a3b8' : '#64748b',
                           }}
                         >
                           {estadoActualFormateado} (actual)
                         </button>
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none"
                           style={{
                             backgroundColor: theme === 'dark' ? '#0f172a' : '#1e293b',
                             color: '#f1f5f9',
                             border: '1px solid rgba(148,163,184,0.3)'
                           }}>
                            El caso ya se encuentra en este estado
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Boton de Registrar Gestion - tipificacion sin cambio de estado */}
                    <button
                      type="button"
                      onClick={handleRegistrarGestion}
                      disabled={transitionLoading || !canPerformAction}
                      className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0 flex items-center gap-1.5"
                      style={{
                        backgroundColor: '#6366f1',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.disabled) {
                          e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                          e.currentTarget.style.backgroundColor = '#4f46e5';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.backgroundColor = '#6366f1';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
                      }}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Registrar gestion
                    </button>

                    <button
                      type="button"
                      onClick={handleReasignar}
                      disabled={transitionLoading || !canPerformAction}
                      className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:hover:translate-y-0 flex items-center gap-1.5"
                      style={{
                        backgroundColor: '#0891b2',
                        boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.disabled) {
                          e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                          e.currentTarget.style.backgroundColor = '#0e7490';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(8, 145, 178, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.backgroundColor = '#0891b2';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(8, 145, 178, 0.3)';
                      }}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Reasignar
                    </button>

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
                  <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>No hay acciones disponibles para este estado ({caso.estado || caso.status}).</p>
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
                
                const parseFecha = (entry: any): number => {
                  const raw = entry.fecha || entry.fechaHora || entry.createdAt || entry.date || '';
                  if (!raw) return 0;
                  // Intentar parsear ISO y formatos comunes
                  const d = new Date(raw);
                  if (!isNaN(d.getTime())) return d.getTime();
                  // Intentar DD/MM/YYYY o DD-MM-YYYY
                  const parts = String(raw).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                  if (parts) {
                    const d2 = new Date(`${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`);
                    if (!isNaN(d2.getTime())) return d2.getTime();
                  }
                  return 0;
                };
                const historialOrdenado = [...historialFiltrado].sort((a, b) => {
                  const tA = parseFecha(a);
                  const tB = parseFecha(b);
                  // Entradas sin fecha van al final
                  if (tA === 0 && tB === 0) return 0;
                  if (tA === 0) return 1;
                  if (tB === 0) return -1;
                  return tB - tA; // Descendente (más nuevo primero)
                });

                return historialOrdenado.length > 0 ? (
                  <div className="space-y-4">
                    {historialOrdenado.map((entry: HistorialEntry | any, idx: number) => {
                       // Formatear texto del evento según tipo
                       let textoEvento = '';
                       const justificacionCruda = entry.justificacion || entry.detalle || '';
                       // Detectar gestion/tipificacion (prefijo [Gestion] en el detalle)
                       const esGestion = justificacionCruda.trim().startsWith('[Gestion]');
                       if (esGestion) {
                         textoEvento = 'Gestion registrada';
                       }
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
                                  <p
                                    className="mt-1.5 mb-1.5 text-xs"
                                    style={{color: styles.text.secondary}}
                                  >
                                    {justificacion}
                                  </p>
                                )}
                                {/* Documentos subidos en esta etapa (estado_anterior) */}
                                {(() => {
                                  const estadoParaDocs = entry.estado_anterior && entry.estado_anterior !== 'N/A' ? entry.estado_anterior : null;
                                  if (!estadoParaDocs) return null;
                                  const docsEnEtapa = documentos.filter((d: any) => d.estado === estadoParaDocs);
                                  if (docsEnEtapa.length === 0) return null;
                                  return (
                                    <div
                                      className="mt-2 mb-2 p-2 rounded-md"
                                      style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
                                        borderLeft: '3px solid #3b82f6'
                                      }}
                                    >
                                      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{color: '#3b82f6'}}>
                                        Documentos en {estadoParaDocs} ({docsEnEtapa.length})
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {docsEnEtapa.map((d: any) => (
                                          <span
                                            key={d.id}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                            style={{
                                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                              color: '#3b82f6'
                                            }}
                                            title={`${d.filename} · ${(d.size_bytes / 1024).toFixed(1)} KB`}
                                          >
                                            <FileText className="w-3 h-3" />
                                            {d.filename}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                                  Por: {autorNombre} ({autorRol})
                                </p>
                              </div>
                              <p className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{
                                color: styles.text.tertiary,
                                backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                              }}>
                                {new Date(fecha).toLocaleString('es-ES', { 
                                  timeZone: 'America/Guatemala',
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
                      {filteredClientes.map((cliente, index) => (
                        <div
                          key={cliente?.CardCode || `cliente-${index}`}
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
                                  {cliente?.CardName}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                                  backgroundColor: theme === 'dark' ? '#0f172a' : '#e2e8f0',
                                  color: styles.text.secondary
                                }}>
                                  {cliente?.CardCode}
                                </span>
                              </div>
                              <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>
                                {cliente?.Email}
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
                    <p className="text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Cliente</p>
                    <p className="text-sm font-bold" style={{color: styles.text.primary}}>{editedCase.clientName}</p>
                    <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>ID: {editedCase.clienteId}</p>
                    {editedCase.contactoPrincipal && (
                      <p className="text-xs mt-1" style={{color: styles.text.secondary}}>{editedCase.contactoPrincipal}</p>
                    )}
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
                      Nombre de Contacto
                    </label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                      <User className="w-4 h-4 flex-shrink-0" style={{color: '#64748b'}}/>
                      <input
                        type="text"
                        value={editedCase.contactoPrincipal || ''}
                        onChange={(e) => setEditedCase({ ...editedCase, contactoPrincipal: e.target.value })}
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
                        placeholder="Nombre del contacto"
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

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{color: styles.text.secondary}}>
                      Categoría
                    </label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                      <Tag className="w-4 h-4 flex-shrink-0" style={{color: '#64748b'}}/>
                      <select
                        value={editedCase.categoriaId || 1}
                        onChange={(e) => setEditedCase({ ...editedCase, categoriaId: Number(e.target.value) })}
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
                      >
                        {categorias.map((cat: any) => (
                          <option key={cat.id || cat.idCategoria} value={cat.id || cat.idCategoria}>
                            {cat.categoria || cat.nombre || cat.name}
                          </option>
                        ))}
                      </select>
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
                    {caso.clientName || caso.cliente?.CardName || 'Sin cliente'}
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
                {(caso as any).emailNotificacion && (
                  <div 
                    className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: 'rgba(16, 122, 180, 0.08)', 
                      borderColor: 'rgba(16, 122, 180, 0.4)',
                      animation: 'fadeInSlide 0.3s ease-out 0.41s both'
                    }}
                  >
                    <Bell className="w-4 h-4 flex-shrink-0" style={{color: '#107ab4'}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{color: '#107ab4'}}>Email de notificaciones</p>
                      <p className="text-xs font-medium truncate" style={{color: styles.text.secondary}}>{(caso as any).emailNotificacion}</p>
                    </div>
                  </div>
                )}
                {(caso.contacto_principal || caso.contactoPrincipal) && (
                  <div 
                    className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]" 
                    style={{
                      backgroundColor: styles.input.backgroundColor, 
                      borderColor: styles.input.borderColor,
                      animation: 'fadeInSlide 0.3s ease-out 0.42s both'
                    }}
                  >
                    <User className="w-4 h-4" style={{color: '#64748b'}}/>
                    <p className="text-xs font-medium" style={{color: styles.text.secondary}}>{caso.contacto_principal || caso.contactoPrincipal}</p>
                  </div>
                )}
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
                  onClick={handleReasignar}
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
              onClick={!isCaseClosed && canReassign ? handleReasignar : undefined}
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
                  setIsEstadoFinal(false);
                  setEstadoFinalParams(null);
                  setParametrosEstadoFinal([]);
                  setFormValues({});
                  setAnexosEstadoFinal('');
                  setRequiereEquipo(false);
                  setEquipoCorrecto(false);
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

              {/* Si es Diagnostico Y el caso es de SV, mostrar checkbox para requerir equipo.
                  Anexos/Resolución SOLO aplican para SV (no GT). */}
              {(pendingNewState === 'Diagnostico' || pendingNewState === 'Diagnóstico') &&
               caso?.pais === 'ElSalvador' && (
                <div className="border rounded-lg p-4" style={{borderColor: 'rgba(148, 163, 184, 0.3)'}}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiereEquipo}
                      onChange={(e) => setRequiereEquipo(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium" style={{color: styles.text.primary}}>
                        ¿Requiere equipo?
                      </span>
                      <p className="text-xs mt-0.5" style={{color: styles.text.tertiary}}>
                        Marcar si se necesita solicitar equipo para este caso
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Si es Ejecucion/Ejecución, mostrar checkbox para validar equipo */}
              {(pendingNewState === 'Ejecucion' || pendingNewState === 'Ejecución') && (
                <div className="border rounded-lg p-4" style={{borderColor: 'rgba(148, 163, 184, 0.3)'}}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={equipoCorrecto}
                      onChange={(e) => setEquipoCorrecto(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium" style={{color: styles.text.primary}}>
                        ¿Equipo funciona correctamente?
                      </span>
                      <p className="text-xs mt-0.5" style={{color: styles.text.tertiary}}>
                        Marcar si el equipo fue verificado y funciona antes del envío/entrega
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Si requiere equipo en Diagnostico Y es SV, mostrar formulario de parámetros.
                  Anexos y Resolución SOLO aplican para SV. */}
              {(pendingNewState === 'Diagnostico' || pendingNewState === 'Diagnóstico') && requiereEquipo &&
               caso?.pais === 'ElSalvador' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b" style={{
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(226, 232, 240, 1)'
                  }}>
                    <CheckCircle2 className="w-4 h-4" style={{color: '#107ab4'}} />
                    <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                      Formulario de Equipo
                    </p>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{color: styles.text.secondary}}>
                        Anexos <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={anexosEstadoFinal}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9,]/g, '');
                          setAnexosEstadoFinal(value);
                        }}
                        placeholder="111111, 222222, 333333"
                        className="w-full h-20 p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs resize-none"
                        style={{
                          backgroundColor: styles.input.backgroundColor,
                          borderColor: styles.input.borderColor,
                          color: styles.text.primary
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Formulario dinámico de parámetros cuando el destino tiene parámetros asignados
                  (ej: Diagnostico con anexos y resolución) */}
              {parametrosEstadoFinal && parametrosEstadoFinal.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4" style={{borderColor: 'rgba(148, 163, 184, 0.3)'}}>
                  <div className="flex items-center gap-2 pb-2 border-b" style={{borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                    <CheckCircle2 className="w-4 h-4" style={{color: '#107ab4'}} />
                    <p className="text-xs font-bold" style={{color: styles.text.primary}}>
                      Datos de {pendingNewState}
                    </p>
                  </div>
                  {parametrosEstadoFinal.map((p: any) => {
                    const nombreParam = String(p.nombre_parametro || p.nombre || '').toLowerCase();
                    const esAnexo = nombreParam.includes('anexo');
                    const etiqueta = p.etiqueta || p.nombre_parametro || p.nombre || '';
                    const placeholder = p.placeholder || '';
                    return (
                      <div key={p.id || nombreParam}>
                        <label className="block text-xs font-bold mb-1.5" style={{color: styles.text.secondary}}>
                          {etiqueta} <span className="text-red-500">*</span>
                        </label>
                        {esAnexo ? (
                          <textarea
                            value={anexosEstadoFinal}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9,\s]/g, '');
                              setAnexosEstadoFinal(value);
                            }}
                            placeholder={placeholder || "111111, 222222, 333333"}
                            className="w-full h-20 p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs resize-none"
                            style={{
                              backgroundColor: styles.input.backgroundColor,
                              borderColor: styles.input.borderColor,
                              color: styles.text.primary
                            }}
                          />
                        ) : (
                          <textarea
                            value={formValues[nombreParam] || ''}
                            onChange={(e) => setFormValues({...formValues, [nombreParam]: e.target.value})}
                            placeholder={placeholder}
                            className="w-full h-20 p-3 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs resize-none"
                            style={{
                              backgroundColor: styles.input.backgroundColor,
                              borderColor: styles.input.borderColor,
                              color: styles.text.primary
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Si es estado final, mostrar formulario especial */}
              {false ? (
                <div className="space-y-4">
                  {/* Header compacto */}
                  <div className="flex items-center gap-2 pb-3 border-b" style={{
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(226, 232, 240, 1)'
                  }}>
                    <CheckCircle2 className="w-4 h-4" style={{color: '#107ab4'}} />
                    <div>
                      <p className="text-sm font-bold" style={{color: styles.text.primary}}>
                        Finalización de caso
                      </p>
                      <p className="text-xs" style={{color: styles.text.tertiary}}>
                        No requiere anexos ni parámetros adicionales
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-xs" style={{color: styles.text.tertiary}}>
                    Finalización sin datos adicionales.
                  </div>
                  
                  {/* Mensaje de error */}
                  {errorMessage && (
                    <div className="p-3 rounded-lg border-2 border-red-500" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)'}}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-600 mb-1">Error de validación</p>
                          <p className="text-xs text-red-600">{errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowJustificationModal(false);
                    setPendingNewState(null);
                    setJustification('');
                    setIsEstadoFinal(false);
                    setEstadoFinalParams(null);
                    setParametrosEstadoFinal([]);
                    setFormValues({});
                    setAnexosEstadoFinal('');
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
                  {transitionLoading ? 'Procesando...' : isEstadoFinal ? 'Finalizar' : 'Confirmar'}
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
                    filteredClientesQuick.map((cliente, index) => (
                      <div
                        key={cliente?.CardCode || `cliente-quick-${index}`}
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
                                {cliente?.CardName}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                                backgroundColor: 'rgba(16, 122, 180, 0.1)',
                                color: '#107ab4'
                              }}>
                                {cliente?.CardCode}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                <User className="w-3 h-3" />
                                {cliente?.ContactoServicioCliente}
                              </div>
                              {cliente?.Email && (
                                <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                  <Mail className="w-3 h-3" />
                                  {cliente.Email}
                                </div>
                              )}
                              {cliente?.Telefono && (
                                <div className="flex items-center gap-2 text-xs" style={{color: styles.text.tertiary}}>
                                  <Phone className="w-3 h-3" />
                                  {cliente.Telefono}
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
                  {agentes.filter(a => a.estado?.toUpperCase() === 'ACTIVO').map((agente) => {
                    const isSelected = selectedAgentId === agente.id_agente;
                    const isCurrent = (caso?.agentId || caso?.agenteAsignado?.id_agente) === agente.id_agente;
                    
                    return (
                      <div
                        key={agente.id_agente}
                        onClick={() => setSelectedAgentId(agente.id_agente)}
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
                              {agente.casos_activos || 0} casos activos
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
                  background: 'linear-gradient(135deg, #7a1a1a, #991b1b)',
                  boxShadow: '0 20px 60px rgba(122, 26, 26, 0.5)'
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

      {/* Modal de Gestion / Tipificacion - registra interaccion sin cambio de estado */}
      {showGestionModal && (
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
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b" style={{borderColor: styles.cardHeader.borderColor}}>
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4" style={{color: '#6366f1'}} />
                <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                  Registrar gestion en {caso?.estado || caso?.status}
                </h3>
              </div>
              <p className="text-xs" style={{color: styles.text.tertiary}}>
                El estado del caso no cambiara. Solo se registra la interaccion en el historial.
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Detalle de la gestion <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full h-24 p-3 rounded-lg border outline-none focus:ring-2 transition-all text-xs resize-none"
                  style={{
                    backgroundColor: styles.input.backgroundColor,
                    borderColor: gestionDetalle.trim() ? styles.input.borderColor : 'rgba(220, 38, 38, 0.4)',
                    color: styles.text.primary
                  }}
                  value={gestionDetalle}
                  onChange={(e) => setGestionDetalle(e.target.value)}
                  placeholder="Ej: Llame al cliente, no contesto. Vuelvo a intentar en 1 hora."
                  maxLength={2000}
                />
                <p className="text-[10px] mt-1" style={{color: gestionDetalle.trim().length < 5 ? '#ef4444' : styles.text.tertiary}}>
                  {gestionDetalle.trim().length} / 2000 caracteres (minimo 5)
                </p>
              </div>

              {/* Mensaje de error */}
              {errorMessage && (
                <div className="p-3 rounded-lg border-2 border-red-500" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)'}}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-600 mb-1">Error de validacion</p>
                      <p className="text-xs text-red-600">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 p-5 pt-3 border-t" style={{borderColor: styles.cardHeader.borderColor}}>
              <button
                type="button"
                onClick={() => {
                  setShowGestionModal(false);
                  setGestionDetalle('');
                  setErrorMessage('');
                }}
                className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-lg border transition-all hover:bg-white/5"
                style={{
                  backgroundColor: 'transparent',
                  color: styles.text.secondary,
                  borderColor: styles.input.borderColor
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarGestion}
                disabled={transitionLoading || gestionDetalle.trim().length < 5}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#6366f1',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                }}
              >
                {transitionLoading ? 'Registrando...' : 'Registrar gestion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reasignar Caso */}
      {showReasignarModal && (
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
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b" style={{borderColor: styles.cardHeader.borderColor}}>
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4" style={{color: '#0891b2'}} />
                <h3 className="font-bold text-sm" style={{color: styles.text.primary}}>
                  Reasignar caso
                </h3>
              </div>
              <p className="text-xs" style={{color: styles.text.tertiary}}>
                El caso cambiara de agente asignado. El estado no se modifica.
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Nuevo usuario asignado <span className="text-red-500">*</span>
                </label>
                <select
                  value={reassignUsuarioId}
                  onChange={(e) => setReassignUsuarioId(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-2 transition-all text-xs"
                  style={{
                    backgroundColor: styles.input.backgroundColor,
                    borderColor: styles.input.borderColor,
                    color: styles.text.primary
                  }}
                >
                  <option value="">Selecciona un usuario...</option>
                  {usuariosDisponibles.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
                {usuariosDisponibles.length === 0 && (
                  <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                    (Cargando usuarios del pais...)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold mb-2" style={{color: styles.text.secondary}}>
                  Motivo de reasignacion (opcional)
                </label>
                <textarea
                  className="w-full h-20 p-3 rounded-lg border outline-none focus:ring-2 transition-all text-xs resize-none"
                  style={{
                    backgroundColor: styles.input.backgroundColor,
                    borderColor: styles.input.borderColor,
                    color: styles.text.primary
                  }}
                  value={reassignMotivo}
                  onChange={(e) => setReassignMotivo(e.target.value)}
                  placeholder="Ej: Carga del agente, vacaciones, expertise, etc."
                  maxLength={500}
                />
                <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                  {reassignMotivo.length} / 500 caracteres
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg border-2 border-red-500" style={{backgroundColor: 'rgba(220, 38, 38, 0.1)'}}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 p-5 pt-3 border-t" style={{borderColor: styles.cardHeader.borderColor}}>
              <button
                type="button"
                onClick={() => {
                  setShowReasignarModal(false);
                  setReassignUsuarioId('');
                  setReassignMotivo('');
                  setErrorMessage('');
                }}
                className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-lg border transition-all hover:bg-white/5"
                style={{
                  backgroundColor: 'transparent',
                  color: styles.text.secondary,
                  borderColor: styles.input.borderColor
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReasignacion}
                disabled={transitionLoading || !reassignUsuarioId}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#0891b2',
                  boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
                }}
              >
                {transitionLoading ? 'Reasignando...' : 'Reasignar caso'}
              </button>
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
