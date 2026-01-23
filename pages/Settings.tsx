import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  List, 
  Zap, 
  Bell, 
  Users, 
  Calendar, 
  Plus,
  Trash2,
  Edit,
  GripVertical,
  UserPlus,
  Eye,
  Briefcase,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  X,
  AlertTriangle,
  Search,
  FileText,
  Clock
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const Settings: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('configuracion');
  const [hasChanges, setHasChanges] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  const [slaSettings, setSlaSettings] = useState({
    defaultSlaDays: 5,
    supervisorAlertDays: 1,
    managerAlertDays: 3
  });

  const initialCategories = [
    { id: '1', name: 'Soporte Técnico', slaDays: 5, description: 'Casos relacionados con problemas técnicos, configuración de equipos y soporte de sistemas.' },
    { id: '2', name: 'Facturación', slaDays: 5, description: 'Consultas y problemas relacionados con facturas, pagos y estados de cuenta.' },
    { id: '3', name: 'Reclamos', slaDays: 3, description: 'Reclamos de clientes sobre servicios, productos o atención recibida.' },
    { id: '4', name: 'Consultas Comerciales', slaDays: 2, description: 'Consultas sobre productos, servicios, precios y ofertas comerciales.' }
  ];

  const [categories, setCategories] = useState(initialCategories);

  const [newCategory, setNewCategory] = useState({
    name: '',
    slaDays: 3,
    description: ''
  });

  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<typeof categories>(initialCategories);

  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    slaDays: number | string;
    description: string;
  } | null>(null);

  const [deletingCategory, setDeletingCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Estados para parámetros de estados finales
  type TipoParametro = 'correo' | 'adjuntar_archivo' | 'telefono' | 'texto' | 'numero' | 'fecha' | 'checkbox';

  interface Parametro {
    id: string;
    name: string;
    description: string;
    tipo: TipoParametro;
    requerido?: boolean;
    placeholder?: string;
    etiqueta?: string;
    opciones?: string[]; // Para campos personalizados
  }

  const initialParametros: Parametro[] = [
    { 
      id: '1', 
      name: 'Correo Adjuntos', 
      description: 'Parámetro para adjuntar archivos al correo',
      tipo: 'adjuntar_archivo',
      requerido: false,
      etiqueta: 'Adjuntar archivos'
    },
    { 
      id: '2', 
      name: 'Notificación Cliente', 
      description: 'Parámetro para notificar al cliente',
      tipo: 'correo',
      requerido: true,
      etiqueta: 'Correo del cliente'
    }
  ];

  const [parametros, setParametros] = useState<Parametro[]>(initialParametros);

  const [showParametroModal, setShowParametroModal] = useState(false);
  const [isEditingParametro, setIsEditingParametro] = useState(false);

  const [newParametro, setNewParametro] = useState<Omit<Parametro, 'id'>>({
    name: '',
    description: '',
    tipo: 'texto',
    requerido: false,
    placeholder: '',
    etiqueta: '',
    opciones: []
  });

  const [parametroSearchTerm, setParametroSearchTerm] = useState('');
  const [filteredParametros, setFilteredParametros] = useState<Parametro[]>(initialParametros);

  const [deletingParametro, setDeletingParametro] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Estados iniciales solo como placeholder; los IDs REALES vienen del webhook (normalizados)
  const [states, setStates] = useState([
    { id: 'nuevo', name: 'Nuevo', order: 1, isFinal: false },
    { id: 'en_proceso', name: 'En Proceso', order: 2, isFinal: false },
    { id: 'pendiente_cliente', name: 'Pendiente Cliente', order: 3, isFinal: false },
    { id: 'escalado', name: 'Escalado', order: 4, isFinal: false },
    { id: 'resuelto', name: 'Resuelto', order: 5, isFinal: true },
    { id: 'cerrado', name: 'Cerrado', order: 6, isFinal: true }
  ]);

  const [newState, setNewState] = useState({
    name: '',
    order: 10,
    isFinal: false
  });

  // Matriz de transiciones: SIEMPRE usa IDs normalizados de texto (no números)
  // transitions[estado_origen_normalizado][estado_destino_normalizado] = true/false
  const [transitions, setTransitions] = useState<Record<string, Record<string, boolean>>>({});

  const [draggedStateId, setDraggedStateId] = useState<string | null>(null);
  const [dragOverStateId, setDragOverStateId] = useState<string | null>(null);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editingStateName, setEditingStateName] = useState<string>('');
  const [deletingState, setDeletingState] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [settingsUsers, setSettingsUsers] = useState<Array<{
    id: string;
    code: string;
    name: string;
    fullName: string;
    role: string;
    email: string;
    roundRobinOrder: number;
    status: string;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Función para generar código de usuario (iniciales)
  const generateUserCode = (nombre: string): string => {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length >= 2) {
      return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1 && palabras[0].length >= 2) {
      return palabras[0].substring(0, 2).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase() || 'U';
  };

  // Función para cargar usuarios desde el webhook
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usuariosWebhook = await api.getUsuarios();
      
      // Mapear usuarios del webhook a la estructura de Settings
      const usuariosMapeados = usuariosWebhook.map((usuario: any, index: number) => {
        // Determinar el rol
        let rol: string = 'Agente';
        const rolRaw = usuario.rol || 
                      usuario.role || 
                      usuario.rol_usuario || 
                      usuario.tipo_usuario ||
                      usuario.tipo ||
                      usuario.cargo ||
                      usuario.position ||
                      '';
        
        if (rolRaw) {
          const rolUpper = String(rolRaw).toUpperCase().trim();
          if (rolUpper === 'ADMIN' || rolUpper === 'ADMINISTRADOR' || rolUpper === 'ADMINISTRATOR') {
            rol = 'Admin';
          } else if (rolUpper === 'SUPERVISOR' || rolUpper === 'SUPERVISORA') {
            rol = 'Supervisor';
          } else if (rolUpper === 'GERENTE' || rolUpper === 'MANAGER' || rolUpper === 'GERENTA') {
            rol = 'Gerente';
          } else if (rolUpper === 'AGENTE' || rolUpper === 'AGENT' || rolUpper === 'AGENTA') {
            rol = 'Agente';
          }
        }
        
        // Mapear estado
        const estado = usuario.estado || usuario.state || usuario.status || 'Inactivo';
        const activo = estado === 'Activo' || estado === 'ACTIVO' || estado === 'active' || estado === 'ACTIVE';
        const status = activo ? 'Activo' : (estado === 'Vacaciones' || estado === 'VACACIONES' ? 'Vacaciones' : 'Inactivo');
        
        // Obtener nombre
        const nombre = usuario.nombre || usuario.name || 'Sin nombre';
        const code = generateUserCode(nombre);
        
        // Generar fullName (formato: CODE Nombre AGT-INT-XXXX)
        // Intentar obtener el ID del agente del webhook, si tiene formato AGT-INT-XXXX, usarlo directamente
        const idAgente = usuario.idAgente || usuario.id_agente || usuario.id || usuario.id_usuario || String(index + 1);
        // Si el ID ya tiene formato AGT-INT-XXXX, usarlo directamente, sino generar AGT-XXX
        let agenteCode = '';
        if (String(idAgente).includes('AGT-')) {
          agenteCode = String(idAgente);
        } else {
          // Intentar detectar si es un ID numérico que necesita formato AGT-INT-XXXX
          const numericId = String(idAgente).replace(/\D/g, '');
          if (numericId) {
            agenteCode = `AGT-INT-${numericId.padStart(4, '0')}`;
          } else {
            agenteCode = `AGT-${String(idAgente).padStart(3, '0')}`;
          }
        }
        const fullName = `${code} ${nombre} ${agenteCode}`;
        
        // Round Robin Order (por defecto 0 para no agentes, o el orden si existe)
        const roundRobinOrder = usuario.roundRobinOrder || usuario.orden_rr || usuario.orden || 
                                (rol === 'Agente' ? index + 1 : 0);
        
        return {
          id: usuario.idAgente || usuario.id_agente || usuario.id || usuario.id_usuario || `U-${usuario.email || Date.now()}`,
          code: code,
          name: nombre,
          fullName: fullName,
          role: rol,
          email: usuario.email || '',
          roundRobinOrder: roundRobinOrder,
          status: status
        };
      });
      
      setSettingsUsers(usuariosMapeados);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setSettingsUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Actualizar posición del indicador cuando cambia el tab activo
  useEffect(() => {
    const tabElement = tabRefs.current[activeTab];
    if (tabElement) {
      const parent = tabElement.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const tabRect = tabElement.getBoundingClientRect();
        setIndicatorStyle({
          left: tabRect.left - parentRect.left,
          width: tabRect.width
        });
      }
    }
  }, [activeTab]);

  // Cargar usuarios al montar el componente
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers();
    }
  }, [activeTab]);

  // Cargar categorías desde el webhook
  const loadCategories = async () => {
    try {
      const categoriesFromWebhook = await api.readCategories();
      console.log('Categorías recibidas del webhook:', categoriesFromWebhook);
      console.log('Tipo de respuesta:', typeof categoriesFromWebhook);
      console.log('Es array?', Array.isArray(categoriesFromWebhook));
      console.log('Longitud:', categoriesFromWebhook?.length);
      
      // Solo actualizar si el webhook retorna categorías válidas
      if (categoriesFromWebhook && Array.isArray(categoriesFromWebhook) && categoriesFromWebhook.length > 0) {
        console.log('Actualizando categorías desde webhook:', categoriesFromWebhook);
        setCategories(categoriesFromWebhook);
        setFilteredCategories(categoriesFromWebhook);
      } else {
        console.log('No se recibieron categorías del webhook o el array está vacío. Manteniendo categorías por defecto.');
        console.log('Categorías actuales:', categories);
        // Si no hay categorías del webhook, mantener las categorías por defecto
        // No actualizar el estado para mantener las categorías iniciales
      }
    } catch (error: any) {
      console.error('Error al cargar categorías:', error);
      console.error('Detalles del error:', error.message, error.stack);
      // Si falla, mantener las categorías por defecto
      // No actualizar el estado para mantener las categorías iniciales
    }
  };

  // Cargar categorías cuando se activa el tab de categorías
  useEffect(() => {
    if (activeTab === 'categorias') {
      loadCategories();
    }
  }, [activeTab]);

  // Cargar asuetos desde el webhook
  const loadHolidays = async () => {
    console.log('[Settings.loadHolidays] Iniciando carga de asuetos...');
    try {
      const fechasFromWebhook = await api.readHolidays();
      console.log('[Settings.loadHolidays] Fechas recibidas del webhook:', fechasFromWebhook);
      setHolidays(fechasFromWebhook);
    } catch (error: any) {
      console.error('[Settings.loadHolidays] Error al cargar asuetos:', error);
      // Si falla, mantener array vacío o las fechas actuales
    }
  };

  // Cargar asuetos al montar el componente y cuando se activa el tab de asuetos
  useEffect(() => {
    loadHolidays();
  }, []); // Cargar al montar el componente

  useEffect(() => {
    if (activeTab === 'asuetos') {
      loadHolidays();
    }
  }, [activeTab]);

  // Cargar estados desde el webhook
  const loadEstados = async () => {
    console.log('[Settings.loadEstados] Iniciando carga de estados...');
    console.log('[Settings.loadEstados] Estados actuales antes de cargar:', states.map(s => ({ id: s.id, name: s.name, order: s.order })));
    console.log('[Settings.loadEstados] Cantidad de estados actuales:', states.length);
    
    try {
      console.log('[Settings.loadEstados] Llamando a api.readEstados()...');
      const estadosFromWebhook = await api.readEstados();
      console.log('[Settings.loadEstados] Estados recibidos de api.readEstados():', estadosFromWebhook);
      console.log('[Settings.loadEstados] Tipo de datos recibidos:', typeof estadosFromWebhook);
      console.log('[Settings.loadEstados] Es array?', Array.isArray(estadosFromWebhook));
      console.log('[Settings.loadEstados] Cantidad de estados recibidos:', estadosFromWebhook?.length || 0);
      
      // Solo actualizar si el webhook retorna estados válidos
      if (estadosFromWebhook && Array.isArray(estadosFromWebhook) && estadosFromWebhook.length > 0) {
        console.log('[Settings.loadEstados] ✅ Estados válidos recibidos, actualizando...');
        console.log('[Settings.loadEstados] Detalle de cada estado:', estadosFromWebhook.map(s => ({
          id: s.id,
          name: s.name,
          order: s.order,
          isFinal: s.isFinal
        })));
        
        // Actualizar estados - usar EXACTAMENTE lo que viene del webhook sin modificar nada
        console.log('[Settings.loadEstados] Llamando a setStates() con estados del webhook (sin modificar)...');
        setStates(() => {
          console.log('[Settings.loadEstados] setStates callback ejecutado');
          // Usar EXACTAMENTE los IDs y nombres que vienen del webhook
          const estadosDelWebhook = estadosFromWebhook.map((s) => ({
            id: String(s.id || ''), // Usar el ID tal como viene del webhook
            name: String(s.name || s.nombre || ''),
            order: Number(s.order || s.orden || 0),
            isFinal: s.isFinal === true || s.is_final === true || s.estado_final === true || false
          }));
          console.log('[Settings.loadEstados] Estados del webhook (sin modificar):', estadosDelWebhook);
          return estadosDelWebhook;
        });
        console.log('[Settings.loadEstados] setStates() llamado exitosamente');
        
        // Inicializar transiciones para los nuevos estados si no existen
        console.log('[Settings.loadEstados] Inicializando transiciones usando IDs del webhook...');
        setTransitions(prevTransitions => {
          console.log('[Settings.loadEstados] Transiciones previas:', prevTransitions);
          const newTransitions: Record<string, Record<string, boolean>> = {};

          // Usar EXACTAMENTE los IDs que vienen del webhook (sin normalizar)
          estadosFromWebhook.forEach(state => {
            const origenKey = String(state.id || ''); // ID tal como viene del webhook
            if (!newTransitions[origenKey]) {
              newTransitions[origenKey] = {};
            }
            estadosFromWebhook.forEach(otherState => {
              const destinoKey = String(otherState.id || ''); // ID tal como viene del webhook
              if (origenKey !== destinoKey) {
                // Preservar transición existente si existe, sino false
                const prevRow = prevTransitions[origenKey] || {};
                newTransitions[origenKey][destinoKey] = prevRow[destinoKey] || false;
              }
            });
          });

          console.log('[Settings.loadEstados] Nuevas transiciones generadas (IDs del webhook):', newTransitions);
          return newTransitions;
        });
        console.log('[Settings.loadEstados] ✅ Estados y transiciones actualizados exitosamente (IDs normalizados)');
      } else {
        console.warn('[Settings.loadEstados] ⚠️ No se recibieron estados válidos del webhook');
        console.warn('[Settings.loadEstados] estadosFromWebhook:', estadosFromWebhook);
        console.warn('[Settings.loadEstados] Es array?', Array.isArray(estadosFromWebhook));
        console.warn('[Settings.loadEstados] Longitud:', estadosFromWebhook?.length);
        console.log('[Settings.loadEstados] Manteniendo estados actuales');
      }
    } catch (error: any) {
      console.error('[Settings.loadEstados] ❌ Error al cargar estados:', error);
      console.error('[Settings.loadEstados] Mensaje de error:', error.message);
      console.error('[Settings.loadEstados] Stack trace:', error.stack);
      console.log('[Settings.loadEstados] Manteniendo estados actuales debido al error');
      // Si falla, mantener los estados actuales
    }
  };

  // Cargar transiciones desde el webhook
  // IMPORTANTE: NO usar estados locales, obtener estados directamente del webhook
  const loadTransiciones = async () => {
    console.log('[Settings.loadTransiciones] ========================================');
    console.log('[Settings.loadTransiciones] Iniciando carga de transiciones...');
    console.log('[Settings.loadTransiciones] Obteniendo estados directamente del webhook (NO usar estados locales)...');
    
    try {
      // PRIMERO: Obtener estados directamente del webhook (NO usar states local)
      console.log('[Settings.loadTransiciones] Llamando a api.readEstados() para obtener estados actuales...');
      const estadosFromWebhook = await api.readEstados();
      console.log('[Settings.loadTransiciones] Estados recibidos del webhook:', estadosFromWebhook);
      console.log('[Settings.loadTransiciones] Cantidad de estados:', estadosFromWebhook?.length || 0);
      
      if (!estadosFromWebhook || !Array.isArray(estadosFromWebhook) || estadosFromWebhook.length === 0) {
        console.error('[Settings.loadTransiciones] ❌ No se recibieron estados del webhook');
        return;
      }
      
      // SEGUNDO: Obtener transiciones del webhook
      console.log('[Settings.loadTransiciones] Llamando a api.readTransiciones()...');
      const transicionesFromWebhook = await api.readTransiciones();
      console.log('[Settings.loadTransiciones] Transiciones recibidas de api.readTransiciones():', transicionesFromWebhook);
      console.log('[Settings.loadTransiciones] Tipo de datos recibidos:', typeof transicionesFromWebhook);
      console.log('[Settings.loadTransiciones] Es objeto?', transicionesFromWebhook && typeof transicionesFromWebhook === 'object');
      console.log('[Settings.loadTransiciones] Keys del objeto:', transicionesFromWebhook ? Object.keys(transicionesFromWebhook) : 'N/A');
      
      if (transicionesFromWebhook && typeof transicionesFromWebhook === 'object' && Object.keys(transicionesFromWebhook).length > 0) {
        console.log('[Settings.loadTransiciones] ✅ Transiciones válidas recibidas, actualizando...');
        
        // Convertir el formato del webhook al formato local
        // El webhook retorna: { estado_origen: { transiciones: [estado_destino1, estado_destino2, ...] } }
        // Necesitamos convertir a: transitions[estado_origen][estado_destino] = true
        // y que la UI refleje EXCLUSIVAMENTE lo que viene del read
        setTransitions(() => {
          const newTransitions: Record<string, Record<string, boolean>> = {};

          // Inicializar toda la matriz en false usando EXACTAMENTE los IDs del webhook (NO estados locales)
          estadosFromWebhook.forEach(estadoOrigen => {
            const origenKey = String(estadoOrigen.id || ''); // Usar ID tal como viene del webhook
            newTransitions[origenKey] = {};
            estadosFromWebhook.forEach(estadoDestino => {
              const destinoKey = String(estadoDestino.id || ''); // Usar ID tal como viene del webhook
              if (origenKey !== destinoKey) {
                newTransitions[origenKey][destinoKey] = false;
              }
            });
          });

          // Marcar como true las transiciones que vienen del webhook
          // ORIGEN (fila) -> DESTINO (columna)
          // Usar EXACTAMENTE los IDs que vienen del webhook (NO estados locales)
          Object.keys(transicionesFromWebhook).forEach(estadoOrigenIdFromWebhook => {
            const transicionesEstado = transicionesFromWebhook[estadoOrigenIdFromWebhook];
            if (transicionesEstado && Array.isArray(transicionesEstado.transiciones)) {
              // Buscar el estado origen en los estados del webhook (NO estados locales)
              const estadoOrigenDelWebhook = estadosFromWebhook.find(s => String(s.id || '') === String(estadoOrigenIdFromWebhook));
              
              if (!estadoOrigenDelWebhook) {
                console.warn(`[Settings.loadTransiciones] ⚠️ Estado ORIGEN "${estadoOrigenIdFromWebhook}" no encontrado en estados del webhook`);
                console.warn(`[Settings.loadTransiciones] Estados disponibles del webhook:`, estadosFromWebhook.map(s => ({ id: s.id, name: s.name })));
                return;
              }
              
              const origenKey = String(estadoOrigenDelWebhook.id || ''); // Usar ID tal como viene del webhook
              console.log(`[Settings.loadTransiciones] Estado ORIGEN "${estadoOrigenIdFromWebhook}" -> "${origenKey}" (${estadoOrigenDelWebhook.name}) puede transicionar a:`, transicionesEstado.transiciones);

              transicionesEstado.transiciones.forEach((estadoDestinoIdFromWebhook: string) => {
                // Buscar el estado destino en los estados del webhook (NO estados locales)
                const estadoDestinoDelWebhook = estadosFromWebhook.find(s => String(s.id || '') === String(estadoDestinoIdFromWebhook));
                
                if (!estadoDestinoDelWebhook) {
                  console.error(`[Settings.loadTransiciones] ❌ Estado DESTINO "${estadoDestinoIdFromWebhook}" NO encontrado en estados del webhook`);
                  console.error(`[Settings.loadTransiciones] Estados disponibles del webhook:`, estadosFromWebhook.map(s => ({ 
                    id: s.id, 
                    name: s.name
                  })));
                  console.error(`[Settings.loadTransiciones] ⚠️ Esta transición NO se marcará porque el estado destino no existe en el sistema`);
                  // NO hacer return aquí - continuar con las demás transiciones
                  return;
                }
                
                const destinoKey = String(estadoDestinoDelWebhook.id || ''); // Usar ID tal como viene del webhook
                
                // Asegurarnos de que la matriz tenga la fila y columna inicializadas
                if (!newTransitions[origenKey]) {
                  newTransitions[origenKey] = {};
                }
                if (newTransitions[origenKey][destinoKey] === undefined) {
                  // Si no estaba inicializada, inicializarla ahora
                  newTransitions[origenKey][destinoKey] = false;
                }
                
                newTransitions[origenKey][destinoKey] = true;
                console.log(`[Settings.loadTransiciones] ✅ Marcando transición: ${origenKey} (${estadoOrigenDelWebhook.name}) -> ${destinoKey} (${estadoDestinoDelWebhook.name}) = true`);
              });
            }
          });

          console.log('[Settings.loadTransiciones] Nuevas transiciones generadas (solo desde read, usando estados del webhook):', newTransitions);
          return newTransitions;
        });
        console.log('[Settings.loadTransiciones] ✅ Transiciones actualizadas exitosamente');
      } else {
        console.warn('[Settings.loadTransiciones] ⚠️ No se recibieron transiciones válidas del webhook');
        console.warn('[Settings.loadTransiciones] transicionesFromWebhook:', transicionesFromWebhook);
        console.log('[Settings.loadTransiciones] Manteniendo transiciones actuales');
        // Si no hay transiciones válidas, mantener las actuales
      }
    } catch (error: any) {
      console.error('[Settings.loadTransiciones] ❌ Error al cargar transiciones:', error);
      console.error('[Settings.loadTransiciones] Mensaje de error:', error.message);
      console.error('[Settings.loadTransiciones] Stack trace:', error.stack);
      console.log('[Settings.loadTransiciones] Manteniendo transiciones actuales debido al error');
      // Si falla, mantener las transiciones actuales
    }
  };

  // Cargar estados y transiciones cuando se activa el tab de estados y flujos
  useEffect(() => {
    if (activeTab === 'estados-flujo') {
      console.log('[Settings] Tab estados-flujo activado, cargando estados y transiciones...');
      loadEstados().then(() => {
        // Esperar un momento para que los estados se actualicen antes de cargar transiciones
        setTimeout(() => {
          // Después de cargar estados, cargar transiciones
          loadTransiciones();
        }, 500);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // También cargar transiciones cuando cambian los estados (por si se cargan después)
  useEffect(() => {
    if (activeTab === 'estados-flujo' && states.length > 0) {
      console.log('[Settings] Estados disponibles, cargando transiciones...');
      // Solo cargar si no hay transiciones ya cargadas o si hay cambios
      const hasAnyTransition = Object.keys(transitions).length > 0;
      if (!hasAnyTransition) {
        loadTransiciones();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.length, activeTab]);

  // Inicializar filteredCategories con las categorías cuando cambian
  useEffect(() => {
    console.log('useEffect categories cambió. categories.length:', categories.length);
    console.log('categories:', categories);
    console.log('filteredCategories actual:', filteredCategories);
    
    // Siempre sincronizar filteredCategories con categories
    if (categories.length > 0) {
      console.log('Actualizando filteredCategories con:', categories);
      setFilteredCategories([...categories]);
    } else {
      console.log('categories está vacío, restaurando initialCategories');
      // Si categories está vacío, restaurar las categorías iniciales
      setCategories([...initialCategories]);
      setFilteredCategories([...initialCategories]);
    }
  }, [categories]);

  const handleSlaChange = (key: string, value: number) => {
    setSlaSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implementar guardado de configuración
    console.log('Guardando configuración SLA:', slaSettings);
    setHasChanges(false);
    // Aquí se podría mostrar un toast de éxito
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }
    
    if (!newCategory.description.trim()) {
      alert('La descripción de la categoría es obligatoria');
      return;
    }
    
    try {
      // Enviar al webhook de categorías
      // TODO: La URL del webhook de categorías está definida en config.ts pero aún no está disponible
      await api.createCategory({
        category_name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        sla: newCategory.slaDays
      });

      // Si el webhook responde correctamente, agregar a la lista local
      const newId = String(Date.now());
      setCategories([...categories, {
        id: newId,
        name: newCategory.name.trim(),
        slaDays: newCategory.slaDays,
        description: newCategory.description.trim()
      }]);
      
      setNewCategory({ name: '', slaDays: 3, description: '' });
      setHasChanges(true);
    } catch (error: any) {
      console.error('Error al crear categoría:', error);
      alert(error.message || 'Error al crear la categoría. Por favor, intente nuevamente.');
    }
  };

  const handleEditCategory = (category: { id: string; name: string; slaDays: number; description: string }) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      slaDays: category.slaDays,
      description: category.description
    });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    if (!editingCategory.name.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }
    
    if (!editingCategory.description.trim()) {
      alert('La descripción de la categoría es obligatoria');
      return;
    }

    const slaValue = typeof editingCategory.slaDays === 'string' 
      ? (editingCategory.slaDays === '' ? 0 : parseInt(editingCategory.slaDays) || 0)
      : editingCategory.slaDays;

    if (!slaValue || slaValue < 1) {
      alert('El SLA debe ser un número mayor o igual a 1');
      return;
    }

    try {
      // Enviar al webhook de categorías
      await api.updateCategory({
        id: editingCategory.id,
        category_name: editingCategory.name.trim(),
        description: editingCategory.description.trim(),
        sla: slaValue
      });

      // Si el webhook responde correctamente, actualizar en la lista local
      setCategories(categories.map(cat => 
        cat.id === editingCategory.id 
          ? {
              id: cat.id,
              name: editingCategory.name.trim(),
              slaDays: slaValue,
              description: editingCategory.description.trim()
            }
          : cat
      ));
      
      setEditingCategory(null);
      setHasChanges(true);
    } catch (error: any) {
      console.error('Error al actualizar categoría:', error);
      alert(error.message || 'Error al actualizar la categoría. Por favor, intente nuevamente.');
    }
  };

  const handleDeleteCategory = (category: { id: string; name: string }) => {
    setDeletingCategory(category);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;

    try {
      // Enviar al webhook de categorías
      await api.deleteCategory(deletingCategory.id);

      // Si el webhook responde correctamente, eliminar de la lista local
      setCategories(categories.filter(cat => cat.id !== deletingCategory.id));
      setHasChanges(true);
      setDeletingCategory(null);
    } catch (error: any) {
      console.error('Error al eliminar categoría:', error);
      alert(error.message || 'Error al eliminar la categoría. Por favor, intente nuevamente.');
      setDeletingCategory(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletingCategory(null);
  };

  // Función para normalizar texto (remover tildes y convertir a minúsculas)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Inicializar categorías filtradas con todas las categorías
  useEffect(() => {
    setFilteredCategories(categories);
  }, []);

  // Filtrar categorías por término de búsqueda (búsqueda por frases que coincidan, sin tildes y sin mayúsculas)
  useEffect(() => {
    if (!categorySearchTerm.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const searchTerm = normalizeText(categorySearchTerm.trim());
    const filtered = categories.filter(cat => {
      const normalizedName = normalizeText(cat.name);
      const normalizedDescription = cat.description ? normalizeText(cat.description) : '';
      const normalizedId = normalizeText(cat.id);
      
      // Buscar si la frase completa está contenida en el nombre, descripción o ID
      // Esto funciona tanto para frases completas como para palabras individuales
      const nameMatch = normalizedName.includes(searchTerm);
      const descriptionMatch = normalizedDescription.includes(searchTerm);
      const idMatch = normalizedId.includes(searchTerm);
      
      // También buscar por palabras individuales si la búsqueda contiene múltiples palabras
      const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
      let allWordsMatch = false;
      
      if (searchWords.length > 1) {
        // Si hay múltiples palabras, verificar que todas estén presentes
        allWordsMatch = searchWords.every(word => 
          normalizedName.includes(word) || 
          normalizedDescription.includes(word) ||
          normalizedId.includes(word)
        );
      }
      
      return nameMatch || descriptionMatch || idMatch || allWordsMatch;
    });

    setFilteredCategories(filtered);
  }, [categorySearchTerm, categories]);

  const handleSearchCategory = async () => {
    if (!categorySearchTerm.trim()) {
      setFilteredCategories(categories);
      return;
    }

    // La búsqueda local ya se hace automáticamente con useEffect
    // Si el término de búsqueda parece ser un ID numérico, también buscar en el webhook
    const isNumericId = /^\d+$/.test(categorySearchTerm.trim());
    
    if (isNumericId && filteredCategories.length === 0) {
      // Solo buscar en webhook si no se encontró nada localmente
      try {
        const result = await api.queryCategory(categorySearchTerm.trim());
        if (result && result.id) {
          alert(`Categoría encontrada en el sistema: ${result.category_name || result.name || 'Sin nombre'}`);
        }
      } catch (error: any) {
        // Si falla el webhook, la búsqueda local ya mostró los resultados
        console.log('Búsqueda en webhook no disponible');
      }
    }
  };

  // Estados para editar parámetro
  const [editingParametroId, setEditingParametroId] = useState<string | null>(null);

  // Funciones para manejar parámetros de estados finales
  const handleOpenParametroModal = (parametro?: Parametro) => {
    if (parametro) {
      setIsEditingParametro(true);
      setEditingParametroId(parametro.id);
      setNewParametro({
        name: parametro.name,
        description: parametro.description,
        tipo: parametro.tipo,
        requerido: parametro.requerido || false,
        placeholder: parametro.placeholder || '',
        etiqueta: parametro.etiqueta || '',
        opciones: parametro.opciones ? [...parametro.opciones] : []
      });
    } else {
      setIsEditingParametro(false);
      setEditingParametroId(null);
      setNewParametro({
        name: '',
        description: '',
        tipo: 'texto',
        requerido: false,
        placeholder: '',
        etiqueta: '',
        opciones: []
      });
    }
    setShowParametroModal(true);
  };

  const handleCloseParametroModal = () => {
    setShowParametroModal(false);
    setIsEditingParametro(false);
    setEditingParametroId(null);
    setNewParametro({
      name: '',
      description: '',
      tipo: 'texto',
      requerido: false,
      placeholder: '',
      etiqueta: '',
      opciones: []
    });
  };

  const handleSaveParametro = async () => {
    if (!newParametro.name.trim()) {
      alert('El nombre del parámetro es obligatorio');
      return;
    }
    
    if (!newParametro.description.trim()) {
      alert('La descripción del parámetro es obligatoria');
      return;
    }

    if (!newParametro.etiqueta?.trim()) {
      alert('La etiqueta del parámetro es obligatoria');
      return;
    }

    try {
      // TODO: Crear función en api.ts para crear/actualizar parámetros
      // if (isEditingParametro) {
      //   await api.updateParametroFinal({...});
      // } else {
      //   await api.createParametroFinal({...});
      // }

      if (isEditingParametro && editingParametroId) {
        // Actualizar parámetro existente
        setParametros(parametros.map(param => 
          param.id === editingParametroId 
            ? {
                ...param,
                name: newParametro.name.trim(),
                description: newParametro.description.trim(),
                tipo: newParametro.tipo,
                requerido: newParametro.requerido,
                placeholder: newParametro.placeholder?.trim() || '',
                etiqueta: newParametro.etiqueta?.trim() || '',
                opciones: newParametro.opciones || []
              }
            : param
        ));
      } else {
        // Agregar nuevo parámetro
        const newId = String(Date.now());
        setParametros([...parametros, {
          id: newId,
          name: newParametro.name.trim(),
          description: newParametro.description.trim(),
          tipo: newParametro.tipo,
          requerido: newParametro.requerido || false,
          placeholder: newParametro.placeholder?.trim() || '',
          etiqueta: newParametro.etiqueta?.trim() || '',
          opciones: newParametro.opciones || []
        }]);
      }
      
      handleCloseParametroModal();
      setHasChanges(true);
    } catch (error: any) {
      console.error('Error al guardar parámetro:', error);
      alert(error.message || 'Error al guardar el parámetro. Por favor, intente nuevamente.');
    }
  };

  const handleAddOpcion = () => {
    setNewParametro({
      ...newParametro,
      opciones: [...(newParametro.opciones || []), '']
    });
  };

  const handleUpdateOpcion = (index: number, value: string) => {
    const nuevasOpciones = [...(newParametro.opciones || [])];
    nuevasOpciones[index] = value;
    setNewParametro({
      ...newParametro,
      opciones: nuevasOpciones
    });
  };

  const handleRemoveOpcion = (index: number) => {
    const nuevasOpciones = [...(newParametro.opciones || [])];
    nuevasOpciones.splice(index, 1);
    setNewParametro({
      ...newParametro,
      opciones: nuevasOpciones
    });
  };

  const handleDeleteParametro = (parametro: { id: string; name: string }) => {
    setDeletingParametro(parametro);
  };

  const handleConfirmDeleteParametro = async () => {
    if (!deletingParametro) return;

    try {
      // TODO: Crear función en api.ts para eliminar parámetros
      // await api.deleteParametroFinal(deletingParametro.id);

      // Eliminar de la lista local
      setParametros(parametros.filter(param => param.id !== deletingParametro.id));
      setHasChanges(true);
      setDeletingParametro(null);
    } catch (error: any) {
      console.error('Error al eliminar parámetro:', error);
      alert(error.message || 'Error al eliminar el parámetro. Por favor, intente nuevamente.');
      setDeletingParametro(null);
    }
  };

  const handleCancelDeleteParametro = () => {
    setDeletingParametro(null);
  };

  // Inicializar parámetros filtrados
  useEffect(() => {
    setFilteredParametros(parametros);
  }, []);

  // Filtrar parámetros por término de búsqueda
  useEffect(() => {
    if (!parametroSearchTerm.trim()) {
      setFilteredParametros(parametros);
      return;
    }

    const searchTerm = normalizeText(parametroSearchTerm.trim());
    const filtered = parametros.filter(param => {
      const normalizedName = normalizeText(param.name);
      const normalizedDescription = param.description ? normalizeText(param.description) : '';
      const normalizedId = normalizeText(param.id);
      const normalizedTipo = normalizeText(param.tipo);
      
      const nameMatch = normalizedName.includes(searchTerm);
      const descriptionMatch = normalizedDescription.includes(searchTerm);
      const idMatch = normalizedId.includes(searchTerm);
      const tipoMatch = normalizedTipo.includes(searchTerm);
      
      const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
      let allWordsMatch = false;
      
      if (searchWords.length > 1) {
        allWordsMatch = searchWords.every(word => 
          normalizedName.includes(word) || 
          normalizedDescription.includes(word) ||
          normalizedId.includes(word) ||
          normalizedTipo.includes(word)
        );
      }
      
      return nameMatch || descriptionMatch || idMatch || tipoMatch || allWordsMatch;
    });

    setFilteredParametros(filtered);
  }, [parametroSearchTerm, parametros]);

  const getTipoLabel = (tipo: TipoParametro): string => {
    const labels: Record<TipoParametro, string> = {
      'correo': 'Correo Electrónico',
      'adjuntar_archivo': 'Adjuntar Archivo',
      'telefono': 'Teléfono',
      'texto': 'Texto',
      'numero': 'Número',
      'fecha': 'Fecha',
      'checkbox': 'Casilla de Verificación'
    };
    return labels[tipo] || tipo;
  };

  // Función para convertir nombre de estado a ID (ej: "En Proceso" -> "en_proceso")
  const nombreToId = (nombre: string): string => {
    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover tildes
      .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
      .replace(/[^a-z0-9_]/g, ''); // Remover caracteres especiales
  };

  const handleAddState = async () => {
    if (!newState.name.trim()) {
      alert('El nombre del estado es obligatorio');
      return;
    }
    
    console.log('[Settings.handleAddState] Iniciando creación de estado...');
    console.log('[Settings.handleAddState] Datos del nuevo estado:', {
      name: newState.name.trim(),
      order: newState.order,
      isFinal: newState.isFinal
    });
    
    // Generar ID basado en el nombre normalizado (ej: "En Proceso" -> "en_proceso")
    const newId = nombreToId(newState.name.trim());
    const maxOrder = Math.max(...states.map(s => s.order), 0);
    const newOrder = newState.order || maxOrder + 1;
    
    console.log('[Settings.handleAddState] ID generado desde nombre:', newId);
    console.log('[Settings.handleAddState] Orden calculado:', newOrder);
    console.log('[Settings.handleAddState] Estados actuales antes de crear:', states.map(s => ({ id: s.id, name: s.name, order: s.order })));
    
    // Verificar si ya existe un estado con ese ID
    const estadoExistente = states.find(s => s.id === newId);
    if (estadoExistente) {
      alert(`Ya existe un estado con el nombre "${newState.name.trim()}". Por favor, elige un nombre diferente.`);
      return;
    }
    
    // Enviar webhook para crear el estado
    try {
      console.log('[Settings.handleAddState] Enviando estado.create al webhook...');
      await api.createState({
        id: newId,
        nombre: newState.name.trim(),
        descripcion: newState.name.trim(), // Usar el nombre como descripción por defecto
        orden: String(newOrder),
        orden_final: newState.isFinal ? 'true' : 'false'
      });
      console.log('[Settings.handleAddState] ✅ estado.create exitoso');
      
      // Limpiar el formulario antes de recargar
      const nombreEstadoCreado = newState.name.trim();
      setNewState({ name: '', order: 10, isFinal: false });
      
      // Esperar un momento para que el servidor procese el nuevo estado
      console.log('[Settings.handleAddState] Esperando 500ms antes de recargar estados...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Después de crear el estado, recargar todos los estados desde el webhook
      console.log('[Settings.handleAddState] Recargando estados con estado.read...');
      await loadEstados();
      console.log('[Settings.handleAddState] ✅ Estados recargados');
      
      // Esperar un momento más para que React actualice el estado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verificar que el nuevo estado esté en la lista usando un callback
      // Nota: No podemos verificar states directamente aquí porque setState es asíncrono
      // En su lugar, loadEstados() ya actualiza los estados, así que solo logueamos
      console.log('[Settings.handleAddState] Buscando estado con nombre:', nombreEstadoCreado);
      console.log('[Settings.handleAddState] Los estados se actualizarán en el próximo render');
      
      setHasChanges(true);
    } catch (error: any) {
      console.error('[Settings.handleAddState] ❌ Error al crear estado:', error);
      console.error('[Settings.handleAddState] Mensaje de error:', error.message);
      console.error('[Settings.handleAddState] Stack trace:', error.stack);
      alert(error.message || 'Error al crear el estado. Por favor, intenta nuevamente.');
    }
  };

  const handleDeleteState = (id: string) => {
    const state = states.find(s => s.id === id);
    if (state) {
      setDeletingState({ id: state.id, name: state.name });
    }
  };

  const handleCancelDeleteState = () => {
    setDeletingState(null);
  };

  const handleConfirmDeleteState = async () => {
    if (!deletingState) return;

    console.log('[Settings.handleConfirmDeleteState] Iniciando eliminación de estado...');
    console.log('[Settings.handleConfirmDeleteState] Estado a eliminar:', deletingState);

    try {
      // Enviar webhook para eliminar el estado
      console.log('[Settings.handleConfirmDeleteState] Enviando estado.delete al webhook...');
      await api.deleteState(deletingState.id);
      console.log('[Settings.handleConfirmDeleteState] ✅ estado.delete exitoso');

      // Esperar un momento para que el servidor procese la eliminación
      console.log('[Settings.handleConfirmDeleteState] Esperando 500ms antes de recargar estados...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Después de eliminar, recargar todos los estados y transiciones desde el webhook
      console.log('[Settings.handleConfirmDeleteState] Recargando estados con estado.read...');
      await loadEstados();
      console.log('[Settings.handleConfirmDeleteState] ✅ Estados recargados');
      
      // Recargar transiciones después de recargar estados
      console.log('[Settings.handleConfirmDeleteState] Recargando transiciones con transicion.read...');
      await loadTransiciones();
      console.log('[Settings.handleConfirmDeleteState] ✅ Transiciones recargadas');

      setDeletingState(null);
      setHasChanges(true);
    } catch (error: any) {
      console.error('[Settings.handleConfirmDeleteState] ❌ Error al eliminar estado:', error);
      alert(error.message || 'Error al eliminar el estado. Por favor, intenta nuevamente.');
      setDeletingState(null);
    }
  };

  const handleToggleFinalState = async (id: string) => {
    // Actualizar el estado local inmediatamente
    const updatedStates = states.map(s => s.id === id ? { ...s, isFinal: !s.isFinal } : s);
    setStates(updatedStates);
    setHasChanges(true);
    
    // Guardar inmediatamente en el webhook para que persista
    try {
      console.log('[Settings.handleToggleFinalState] Guardando cambio de isFinal para estado:', id);
      const estadosParaWebhook = updatedStates.map(state => ({
        id: state.id,
        nombre: state.name,
        descripcion: state.name,
        orden: state.order,
        es_final: state.isFinal
      }));
      
      await api.updateEstados(estadosParaWebhook);
      console.log('[Settings.handleToggleFinalState] ✅ Estado final actualizado en webhook');
      
      // Recargar estados para asegurar sincronización
      await loadEstados();
    } catch (error: any) {
      console.error('[Settings.handleToggleFinalState] ❌ Error al guardar estado final:', error);
      // Revertir el cambio local si falla
      setStates(states);
      alert('Error al guardar el cambio. Por favor, intenta nuevamente.');
    }
  };

  const handleEditState = (id: string) => {
    const state = states.find(s => s.id === id);
    if (state) {
      setEditingStateId(id);
      setEditingStateName(state.name);
    }
  };

  const handleSaveEditState = (id: string) => {
    if (!editingStateName.trim()) {
      alert('El nombre del estado no puede estar vacío');
      return;
    }
    
    setStates(states.map(s => 
      s.id === id ? { ...s, name: editingStateName.trim() } : s
    ));
    setEditingStateId(null);
    setEditingStateName('');
    setHasChanges(true);
  };

  const handleCancelEditState = () => {
    setEditingStateId(null);
    setEditingStateName('');
  };

  const handleDragStart = (e: React.DragEvent, stateId: string) => {
    setDraggedStateId(stateId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stateId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStateId(stateId);
  };

  const handleDragLeave = () => {
    setDragOverStateId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStateId: string) => {
    e.preventDefault();
    
    console.log('[Settings.handleDrop] Iniciando drop...', {
      draggedStateId,
      targetStateId,
      currentStates: states.map(s => ({ id: s.id, name: s.name, order: s.order }))
    });
    
    if (!draggedStateId || draggedStateId === targetStateId) {
      console.log('[Settings.handleDrop] No hay drag válido o es el mismo estado');
      setDraggedStateId(null);
      setDragOverStateId(null);
      return;
    }

    const draggedState = states.find(s => s.id === draggedStateId);
    const targetState = states.find(s => s.id === targetStateId);
    
    if (!draggedState || !targetState) {
      console.warn('[Settings.handleDrop] No se encontraron los estados');
      setDraggedStateId(null);
      setDragOverStateId(null);
      return;
    }

    // Limpiar estados de drag inmediatamente para evitar que se quede "pegado"
    setDraggedStateId(null);
    setDragOverStateId(null);

    const newStates = [...states];
    const draggedIndex = newStates.findIndex(s => s.id === draggedStateId);
    const targetIndex = newStates.findIndex(s => s.id === targetStateId);

    console.log('[Settings.handleDrop] Índices:', { draggedIndex, targetIndex });

    // Reordenar
    newStates.splice(draggedIndex, 1);
    newStates.splice(targetIndex, 0, draggedState);

    // Actualizar órdenes
    const reorderedStates = newStates.map((state, index) => ({
      ...state,
      order: index + 1
    }));

    console.log('[Settings.handleDrop] Estados reordenados localmente:', reorderedStates.map(s => ({ id: s.id, name: s.name, order: s.order })));

    // Actualizar el estado local inmediatamente para feedback visual
    setStates(reorderedStates);

    // Enviar webhook con todos los estados y su nuevo orden
    try {
      console.log('[Settings.handleDrop] Enviando estado.update con nuevo orden...');
      const estadosParaWebhook = reorderedStates.map(state => ({
        id: state.id,
        nombre: state.name,
        descripcion: state.name, // Usar el nombre como descripción
        orden: state.order,
        es_final: state.isFinal
      }));

      console.log('[Settings.handleDrop] Estados a enviar en update:', estadosParaWebhook);
      await api.updateEstados(estadosParaWebhook);
      console.log('[Settings.handleDrop] ✅ estado.update exitoso');
      
      // Después de actualizar, recargar los estados y transiciones desde el webhook para obtener el orden actualizado
      console.log('[Settings.handleDrop] Recargando estados con estado.read...');
      await loadEstados();
      console.log('[Settings.handleDrop] ✅ Estados recargados exitosamente');
      
      // Recargar transiciones después de recargar estados
      console.log('[Settings.handleDrop] Recargando transiciones con transicion.read...');
      await loadTransiciones();
      console.log('[Settings.handleDrop] ✅ Transiciones recargadas exitosamente');
      
      setHasChanges(true);
    } catch (error: any) {
      console.error('[Settings.handleDrop] ❌ Error al actualizar orden de estados:', error);
      alert(error.message || 'Error al actualizar el orden de los estados. Por favor, intenta nuevamente.');
      // Si falla, recargar los estados originales desde el servidor
      console.log('[Settings.handleDrop] Recargando estados originales debido al error...');
      await loadEstados();
    }
  };

  // ORIGEN = FILA (fromState), DESTINO = COLUMNA (toState)
  const handleTransitionChange = (fromId: string, toId: string, checked: boolean) => {
    console.log('[Settings.handleTransitionChange] Cambiando transición:', {
      fromId,
      toId,
      checked,
      fromStateName: states.find(s => s.id === fromId)?.name,
      toStateName: states.find(s => s.id === toId)?.name,
      currentTransitions: transitions
    });

    // IMPORTANTE: El mapeo en la tabla es:
    // - FILAS = fromState (estado ORIGEN/DESDE)
    // - COLUMNAS = toState (estado DESTINO/HACIA)
    // 
    // El checkbox llama: handleTransitionChange(fromState.id, toState.id, checked)
    // Usar EXACTAMENTE los IDs que vienen del webhook (sin modificar)
    const fromState = states.find(s => s.id === fromId);
    const toState = states.find(s => s.id === toId);

    if (!fromState || !toState) {
      console.warn('[Settings.handleTransitionChange] ⚠️ fromState o toState no encontrados', { fromId, toId });
      return;
    }

    const origenKey = fromState.id; // Usar ID tal como viene del webhook
    const destinoKey = toState.id; // Usar ID tal como viene del webhook

    // Guardamos transitions[origenKey][destinoKey] = true/false
    const newTransitions: Record<string, Record<string, boolean>> = {
      ...transitions,
      [origenKey]: {
        ...(transitions[origenKey] || {}),
        [destinoKey]: checked
      }
    };
    
    setTransitions(newTransitions);
    setHasChanges(true);
  };

  const handleSaveTransitions = async () => {
    console.log('[Settings.handleSaveTransitions] Guardando transiciones mediante transicion.update...');

    // Construir el payload para el webhook usando el estado actual de `transitions`
    // El formato debe ser: { estado_origen_id: { transiciones: [estado_destino_id1, estado_destino_id2, ...] } }
    const transicionesData: Record<string, { transiciones: string[] }> = {};

    // FILAS = estado ORIGEN, COLUMNAS = estado DESTINO
    // Usar EXACTAMENTE los IDs que vienen del webhook (sin modificar)
    states.forEach(estadoOrigen => {
      const transicionesPermitidas: string[] = [];
      const origenKey = estadoOrigen.id; // Usar ID tal como viene del webhook

      states.forEach(estadoDestino => {
        const destinoKey = estadoDestino.id; // Usar ID tal como viene del webhook
        if (
          origenKey !== destinoKey &&
          // La matriz guarda transitions[ORIGEN_ID][DESTINO_ID]
          // y la casilla en fila ORIGEN / columna DESTINO es:
          // checked = transitions[origenKey]?.[destinoKey]
          transitions[origenKey]?.[destinoKey] === true
        ) {
          transicionesPermitidas.push(destinoKey);
        }
      });

      transicionesData[origenKey] = {
        transiciones: transicionesPermitidas
      };
    });

    console.log('[Settings.handleSaveTransitions] Payload completo a enviar:', JSON.stringify(transicionesData, null, 2));

    try {
      await api.updateTransiciones(transicionesData);
      console.log('[Settings.handleSaveTransitions] ✅ transicion.update exitoso');

      // Después de actualizar, recargar transiciones desde el webhook
      try {
        console.log('[Settings.handleSaveTransitions] Recargando transiciones con transicion.read...');
        await loadTransiciones();
        console.log('[Settings.handleSaveTransitions] ✅ transicion.read exitoso');
      } catch (innerError: any) {
        console.error('[Settings.handleSaveTransitions] ❌ Error al recargar transiciones después del update:', innerError);
      }

      setHasChanges(false);
    } catch (error: any) {
      console.error('[Settings.handleSaveTransitions] ❌ Error al actualizar transiciones:', error);
      alert(error.message || 'Error al guardar las transiciones. Por favor, intenta nuevamente.');
    }
  };

  const handleSaveStates = async () => {
    try {
      console.log('[Settings.handleSaveStates] Guardando todos los estados...');
      
      // Enviar todos los estados con su isFinal al webhook
      const estadosParaWebhook = states.map(state => ({
        id: state.id,
        nombre: state.name,
        descripcion: state.name,
        orden: state.order,
        es_final: state.isFinal
      }));
      
      console.log('[Settings.handleSaveStates] Estados a guardar:', estadosParaWebhook);
      await api.updateEstados(estadosParaWebhook);
      console.log('[Settings.handleSaveStates] ✅ Estados guardados exitosamente');
      
      // Recargar estados desde el webhook para asegurar sincronización
      await loadEstados();
      
      setHasChanges(false);
    } catch (error: any) {
      console.error('[Settings.handleSaveStates] ❌ Error al guardar estados:', error);
      alert(error.message || 'Error al guardar los estados. Por favor, intenta nuevamente.');
    }
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
      setSettingsUsers(settingsUsers.filter(u => u.id !== id));
      // TODO: Eliminar en backend
    }
  };

  const [holidays, setHolidays] = useState<Array<{ fecha: string; motivo: string; pais: string; row_number: number; fechaDate?: Date }>>([]);

  const [bulkDates, setBulkDates] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  // Estados para el calendario visual
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear());
  const [searchMonth, setSearchMonth] = useState(new Date().getMonth());
  const [searchDay, setSearchDay] = useState<number | ''>('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  // Estado para el modal de confirmación de fecha
  const [pendingHolidayDate, setPendingHolidayDate] = useState<{ date: Date; holidayName: string | null } | null>(null);
  // Estado para animación de eliminación
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDateToSpanish = (date: Date): string => {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} de ${month} de ${year}`;
  };

  // Formatear fecha desde string DD/MM/YYYY directamente
  // Parsear la fecha del webhook para mostrar "10 de mayo del 2026"
  // Maneja tanto DD/MM/YYYY como YYYY-MM-DD
  const formatDateFromDDMMYYYY = (fechaStr: string): string => {
    if (!fechaStr) {
      return '';
    }

    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    let day: number;
    let month: number;
    let year: number;
    
    // Detectar formato: DD/MM/YYYY o YYYY-MM-DD
    if (fechaStr.includes('/')) {
      // Formato DD/MM/YYYY
      const parts = fechaStr.split('/');
      if (parts.length !== 3) {
        return fechaStr;
      }
      day = parseInt(parts[0].trim(), 10);
      month = parseInt(parts[1].trim(), 10);
      year = parseInt(parts[2].trim(), 10);
    } else if (fechaStr.includes('-')) {
      // Formato YYYY-MM-DD - convertir a DD/MM/YYYY para parsear
      const parts = fechaStr.split('-');
      if (parts.length !== 3) {
        return fechaStr;
      }
      year = parseInt(parts[0].trim(), 10);
      month = parseInt(parts[1].trim(), 10);
      day = parseInt(parts[2].trim(), 10);
    } else {
      return fechaStr;
    }
    
    // Validar que sean números válidos
    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      return fechaStr;
    }
    
    // Crear fecha SOLO para obtener el día de la semana (usar mediodía para evitar problemas de zona horaria)
    const dateForDayOfWeek = new Date(year, month - 1, day, 12, 0, 0);
    const dayName = days[dateForDayOfWeek.getDay()];
    const monthName = months[month - 1];
    
    // MOSTRAR EL DÍA EXACTO parseado del string del webhook
    // Formato: "sábado, 10 de mayo del 2026"
    return `${dayName}, ${day} de ${monthName} del ${year}`;
  };

  // Helper para convertir fecha DD/MM/YYYY a YYYY-MM-DD para comparación
  const convertDateStrToISO = (fechaStr: string): string => {
    if (fechaStr.includes('/')) {
      const [day, month, year] = fechaStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return fechaStr;
  };

  // Helper para parsear fecha DD/MM/YYYY a Date sin problemas de zona horaria
  const parseDateFromDDMMYYYY = (fechaStr: string): Date => {
    if (fechaStr.includes('/')) {
      const [day, month, year] = fechaStr.split('/').map(Number);
      // Crear fecha a mediodía en zona horaria local para evitar problemas de zona horaria
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return new Date(fechaStr);
  };

  // Helper para obtener solo la fecha (sin hora) de un Date para comparación
  const getDateOnly = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper para verificar si una fecha Date coincide con alguna fecha en holidays
  const isDateInHolidays = (date: Date): boolean => {
    const dateStr = getDateOnly(date);
    return holidays.some(h => {
      if (h.fechaDate) {
        return getDateOnly(h.fechaDate) === dateStr;
      }
      return convertDateStrToISO(h.fecha) === dateStr;
    });
  };

  // Función para calcular la fecha de Pascua (algoritmo de Meeus/Jones/Butcher)
  const calculateEaster = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  // Función para calcular Carnaval (47 días antes de Pascua)
  const calculateCarnival = (year: number): Date => {
    const easter = calculateEaster(year);
    const carnival = new Date(easter);
    carnival.setDate(easter.getDate() - 47);
    return carnival;
  };

  // Función para obtener el nombre de la festividad (El Salvador y Guatemala)
  const getHolidayName = (date: Date): string | null => {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    const year = date.getFullYear();
    const dateStr = date.toISOString().split('T')[0];
    
    // Calcular fechas variables del año
    const easter = calculateEaster(year);
    const easterStr = easter.toISOString().split('T')[0];
    
    // Jueves Santo (3 días antes de Pascua)
    const thursdayBeforeEaster = new Date(easter);
    thursdayBeforeEaster.setDate(easter.getDate() - 3);
    const thursdayStr = thursdayBeforeEaster.toISOString().split('T')[0];
    
    // Viernes Santo (2 días antes de Pascua)
    const fridayBeforeEaster = new Date(easter);
    fridayBeforeEaster.setDate(easter.getDate() - 2);
    const fridayStr = fridayBeforeEaster.toISOString().split('T')[0];
    
    // Sábado Santo (1 día antes de Pascua)
    const saturdayBeforeEaster = new Date(easter);
    saturdayBeforeEaster.setDate(easter.getDate() - 1);
    const saturdayStr = saturdayBeforeEaster.toISOString().split('T')[0];
    
    // Lunes de Pascua (1 día después de Pascua)
    const mondayAfterEaster = new Date(easter);
    mondayAfterEaster.setDate(easter.getDate() + 1);
    const mondayStr = mondayAfterEaster.toISOString().split('T')[0];
    
    // Carnaval (47 días antes de Pascua)
    const carnival = calculateCarnival(year);
    const carnivalStr = carnival.toISOString().split('T')[0];
    
    // Corpus Christi (60 días después de Pascua)
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    const corpusStr = corpusChristi.toISOString().split('T')[0];
    
    // Verificar fechas variables primero
    if (dateStr === thursdayStr) return 'Jueves Santo';
    if (dateStr === fridayStr) return 'Viernes Santo';
    if (dateStr === saturdayStr) return 'Sábado Santo';
    if (dateStr === easterStr) return 'Domingo de Pascua / Domingo de Resurrección';
    if (dateStr === mondayStr) return 'Lunes de Pascua';
    if (dateStr === carnivalStr) return 'Carnaval';
    if (dateStr === corpusStr) return 'Corpus Christi';
    
    // Festividades de El Salvador y Guatemala (fechas fijas)
    const holidays: Record<string, string> = {
      // Enero
      '1-1': 'Año Nuevo',
      '1-6': 'Día de los Reyes Magos',
      // Febrero
      '2-14': 'Día de la Amistad / San Valentín',
      // Marzo
      '3-19': 'Día de San José',
      // Abril
      '4-14': 'Día de las Américas',
      // Mayo
      '5-1': 'Día del Trabajador',
      '5-3': 'Día de la Cruz',
      '5-10': 'Día de la Madre',
      // Junio
      '6-1': 'Día del Niño',
      '6-17': 'Día del Padre',
      // Julio
      '7-1': 'Día del Ejército (Guatemala)',
      '7-25': 'Día de Santiago Apóstol',
      // Agosto
      '8-1': 'Fiestas Agostinas (El Salvador)',
      '8-5': 'Día de la Virgen de las Nieves',
      '8-6': 'Día de la Independencia (Bolivia)',
      '8-15': 'Día de la Asunción de María',
      // Septiembre
      '9-15': 'Día de la Independencia (El Salvador, Guatemala, Costa Rica, Honduras, Nicaragua)',
      // Octubre
      '10-1': 'Día del Niño (El Salvador)',
      '10-12': 'Día de la Raza / Día de Colón',
      '10-20': 'Día de la Revolución (Guatemala)',
      '10-31': 'Halloween',
      // Noviembre
      '11-1': 'Día de Todos los Santos',
      '11-2': 'Día de los Fieles Difuntos / Día de los Muertos',
      '11-5': 'Día del Primer Grito de Independencia (El Salvador)',
      // Diciembre
      '12-8': 'Día de la Inmaculada Concepción',
      '12-12': 'Día de la Virgen de Guadalupe',
      '12-24': 'Nochebuena',
      '12-25': 'Navidad',
      '12-31': 'Año Viejo / Fin de Año'
    };
    
    const key = `${month}-${day}`;
    return holidays[key] || null;
  };

  // Función para agregar fecha desde el calendario visual
  const handleDateClick = (day: number, month: number, year: number) => {
    // Crear fecha a mediodía para evitar problemas de zona horaria
    const date = new Date(year, month, day, 12, 0, 0);
    
    if (isNaN(date.getTime())) {
      console.error('[handleDateClick] Fecha inválida:', { day, month, year });
      return;
    }

    console.log('[handleDateClick] Fecha seleccionada:', date);

    // Verificar si la fecha ya existe
    const exists = isDateInHolidays(date);
    
    // Obtener el nombre de la festividad
    const holidayName = getHolidayName(date);
    console.log('[handleDateClick] Festividad:', holidayName);
    
    // Mostrar modal de confirmación animado
    setPendingHolidayDate({ date, holidayName });
    console.log('[handleDateClick] Modal abierto con fecha:', date, 'festividad:', holidayName);
    setShowCalendar(false); // Cerrar el calendario
  };

  // Función para generar los días del mes para el calendario
  const getDaysInMonth = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: Array<{ day: number; date: Date | null }> = [];
    
    // Días vacíos al inicio
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ day: 0, date: null });
    }
    
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day, date: new Date(year, month, day) });
    }
    
    return days;
  };

  // Navegación del calendario
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // Verificar si una fecha está en holidays
  const isHoliday = (date: Date | null): boolean => {
    if (!date) return false;
    return isDateInHolidays(date);
  };

  // Verificar si una fecha es hoy
  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleDeleteHoliday = async (date: Date, skipConfirm: boolean = false) => {
    // Esta función ahora solo se usa internamente después de la animación
    // No debe mostrar window.confirm nunca
    
    // Eliminar del webhook
    try {
      await api.deleteHoliday(date);
      console.log('[handleDeleteHoliday] ✅ Asueto eliminado del webhook exitosamente');
      
      // Después de eliminar, recargar las fechas desde el webhook
      await loadHolidays();
    } catch (error: any) {
      console.error('[handleDeleteHoliday] ❌ Error al eliminar asueto del webhook:', error);
      alert(`Error al eliminar la fecha: ${error.message || 'Error desconocido'}`);
    }
  };

  // Eliminar fecha duplicada desde la carga masiva
  const handleRemoveDuplicate = async (dateStr: string) => {
    try {
      // Convertir YYYY-MM-DD a Date
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) {
        alert('Error: Fecha inválida');
        return;
      }

      // Buscar el asueto en holidays para obtener su row_number si es necesario
      const holiday = holidays.find(h => {
        const hDate = h.fechaDate || parseDateFromDDMMYYYY(h.fecha);
        return getDateOnly(hDate) === dateStr;
      });

      if (!holiday) {
        alert('No se encontró la fecha en los asuetos registrados');
        return;
      }

      // Eliminar del webhook
      await api.deleteHoliday(date);
      console.log('[handleRemoveDuplicate] ✅ Fecha duplicada eliminada del webhook exitosamente');
      
      // Recargar las fechas desde el webhook
      await loadHolidays();
      
      // Mostrar mensaje de éxito
      console.log(`Fecha duplicada ${dateStr} eliminada exitosamente`);
    } catch (error: any) {
      console.error('[handleRemoveDuplicate] ❌ Error al eliminar fecha duplicada:', error);
      alert(`Error al eliminar la fecha duplicada: ${error.message || 'Error desconocido'}`);
    }
  };

  // Confirmar agregar fecha desde el modal
  const handleConfirmAddHoliday = () => {
    if (!pendingHolidayDate) return;
    
    const { date } = pendingHolidayDate;
    
    // Verificar si la fecha ya existe
    const exists = isDateInHolidays(date);
    console.log('[handleConfirmAddHoliday] Verificando fecha:', {
      date: date.toISOString(),
      dateOnly: getDateOnly(date),
      exists: exists,
      holidaysCount: holidays.length,
      holidaysDates: holidays.map(h => ({
        fecha: h.fecha,
        fechaDate: h.fechaDate ? getDateOnly(h.fechaDate) : convertDateStrToISO(h.fecha)
      }))
    });
    
    if (exists) {
      // Si ya existe, mostrar animación antes de eliminar
      console.log('[handleConfirmAddHoliday] ✅ Fecha existe, eliminando...');
      setIsDeleting(true);
      
      // Esperar a que termine la animación antes de eliminar
      setTimeout(async () => {
        await handleDeleteHoliday(date, true); // skipConfirm = true porque ya confirmamos en el modal
        setIsDeleting(false);
        setPendingHolidayDate(null);
      }, 500); // Duración de la animación (500ms para que se vea mejor)
    } else {
      // Agregar la fecha y enviar al webhook
      console.log('[handleConfirmAddHoliday] ❌ Fecha NO existe, agregando...');
      const addHolidayToWebhook = async () => {
        try {
          await api.addHoliday(date, pendingHolidayDate.holidayName);
          console.log('[handleConfirmAddHoliday] ✅ Asueto agregado al webhook exitosamente');
          
          // Después de agregar, recargar las fechas desde el webhook
          await loadHolidays();
        } catch (error: any) {
          console.error('[handleConfirmAddHoliday] ❌ Error al agregar asueto al webhook:', error);
          alert(`Error al guardar la fecha: ${error.message || 'Error desconocido'}`);
        }
      };
      
      setPendingHolidayDate(null);
      
      // Enviar al webhook (loadHolidays se llamará dentro de addHolidayToWebhook)
      addHolidayToWebhook();
    }
  };

  // Cancelar agregar fecha
  const handleCancelAddHoliday = () => {
    setIsDeleting(false);
    setPendingHolidayDate(null);
  };

  // Función para validar y analizar fechas en tiempo real
  const analyzeBulkDates = () => {
    if (!bulkDates.trim()) {
      return {
        valid: [],
        duplicates: [],
        errors: [],
        preview: []
      };
    }

    const dateStrings = bulkDates
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const valid: { date: Date; dateStr: string; holidayName: string | null }[] = [];
    const duplicates: string[] = [];
    const errors: { dateStr: string; reason: string }[] = [];
    const preview: { date: Date; dateStr: string; holidayName: string | null; isNew: boolean }[] = [];

    dateStrings.forEach(dateStr => {
      // Validar formato YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        errors.push({ dateStr, reason: 'Formato inválido (debe ser YYYY-MM-DD)' });
        return;
      }

      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) {
        errors.push({ dateStr, reason: 'Fecha inválida' });
        return;
      }

      const dateStrFormatted = date.toISOString().split('T')[0];
      const exists = isDateInHolidays(date);
      const holidayName = getHolidayName(date);
      
      preview.push({ date, dateStr: dateStrFormatted, holidayName, isNew: !exists });

      if (exists) {
        duplicates.push(dateStrFormatted);
      } else {
        valid.push({ date, dateStr: dateStrFormatted, holidayName });
      }
    });

    return { valid, duplicates, errors, preview };
  };

  const handleBulkImport = async () => {
    if (!bulkDates.trim()) {
      return;
    }

    const analysis = analyzeBulkDates();

    if (analysis.valid.length === 0) {
      if (analysis.errors.length > 0 || analysis.duplicates.length > 0) {
        return; // Ya se muestran los errores en la UI
      }
      return;
    }

    setIsImporting(true);

    try {
      const newDates = analysis.valid.map(v => v.date);
      const holidayNames = analysis.valid.map(v => v.holidayName);
      
      // Enviar todas las fechas al webhook
      await api.addBulkHolidays(newDates, holidayNames);
      console.log('[handleBulkImport] ✅ Asuetos agregados al webhook exitosamente');
      
      // Limpiar el textarea
      setBulkDates('');
      
      // Después de agregar, recargar las fechas desde el webhook
      await loadHolidays();
      
      // Pequeño delay para mostrar el éxito
      setTimeout(() => {
        setIsImporting(false);
      }, 500);
    } catch (error: any) {
      console.error('[handleBulkImport] ❌ Error al agregar asuetos al webhook:', error);
      setIsImporting(false);
      alert(`Error al guardar las fechas: ${error.message || 'Error desconocido'}`);
    }
  };



  const getRoleBadgeStyle = (role: string) => {
    const roleStyles: Record<string, { bg: string; text: string; border: string }> = {
      'Admin': { 
        bg: theme === 'dark' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)', 
        text: '#8b5cf6', 
        border: 'rgba(139, 92, 246, 0.3)' 
      },
      'Agente': { 
        bg: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.1)', 
        text: '#94a3b8', 
        border: 'rgba(148, 163, 184, 0.3)' 
      },
      'Supervisor': { 
        bg: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
        text: '#3b82f6', 
        border: 'rgba(59, 130, 246, 0.3)' 
      },
      'Gerente': { 
        bg: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
        text: '#ef4444', 
        border: 'rgba(239, 68, 68, 0.3)' 
      }
    };
    return roleStyles[role] || roleStyles['Agente'];
  };

  // Componente de input numérico personalizado
  const NumberInput: React.FC<{
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label: string;
    description?: string;
  }> = ({ value, onChange, min = 0, max, label, description }) => {
    const handleIncrement = () => {
      const newValue = value + 1;
      if (max === undefined || newValue <= max) {
        onChange(newValue);
      }
    };

    const handleDecrement = () => {
      const newValue = value - 1;
      if (newValue >= min) {
        onChange(newValue);
      }
    };

    return (
      <div>
        <label className="block text-sm font-semibold mb-2.5" style={{ color: styles.text.primary }}>
          {label}
        </label>
        <div className="relative inline-block" style={{ width: '120px' }}>
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const numValue = parseInt(e.target.value) || min;
              onChange(Math.max(min, max !== undefined ? Math.min(numValue, max) : numValue));
            }}
            className="w-full px-3.5 py-2.5 pr-11 rounded-xl border text-sm number-input-custom transition-all"
            style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)',
              color: styles.text.primary,
              appearance: 'none',
              MozAppearance: 'textfield',
              WebkitAppearance: 'none',
              boxShadow: theme === 'dark' 
                ? '0 1px 2px rgba(0, 0, 0, 0.15)' 
                : '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
            onWheel={(e) => e.currentTarget.blur()}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
              e.currentTarget.style.boxShadow = theme === 'dark' 
                ? '0 0 0 3px rgba(59, 130, 246, 0.15)' 
                : '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)';
              e.currentTarget.style.boxShadow = theme === 'dark' 
                ? '0 1px 2px rgba(0, 0, 0, 0.15)' 
                : '0 1px 2px rgba(0, 0, 0, 0.05)';
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)';
              }
            }}
          />
          <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l rounded-r-xl" style={{
            borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)',
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            width: '26px'
          }}>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={max !== undefined && value >= max}
              className="flex-1 flex items-center justify-center transition-all rounded-tr-xl"
              style={{
                cursor: (max !== undefined && value >= max) ? 'not-allowed' : 'pointer',
                backgroundColor: 'transparent',
                color: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (max === undefined || value < max) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronUp 
                className="w-3.5 h-3.5" 
                style={{
                  color: (max !== undefined && value >= max) 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#64748b' : '#475569'),
                  stroke: (max !== undefined && value >= max) 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#64748b' : '#475569'),
                  strokeWidth: 2.5,
                  fill: 'none'
                }}
              />
            </button>
            <div className="h-px" style={{ backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)' }} />
            <button
              type="button"
              onClick={handleDecrement}
              disabled={value <= min}
              className="flex-1 flex items-center justify-center transition-all rounded-br-xl"
              style={{
                cursor: value <= min ? 'not-allowed' : 'pointer',
                backgroundColor: 'transparent',
                color: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (value > min) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronDown 
                className="w-3.5 h-3.5" 
                style={{
                  color: value <= min 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#64748b' : '#475569'),
                  stroke: value <= min 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#64748b' : '#475569'),
                  strokeWidth: 2.5,
                  fill: 'none'
                }}
              />
            </button>
          </div>
        </div>
        {description && (
          <p className="text-xs mt-2.5 leading-relaxed" style={{ 
            color: styles.text.tertiary,
            opacity: 0.8
          }}>
            {description}
          </p>
        )}
      </div>
    );
  };

  // Estilos dinámicos basados en el tema
  const styles = {
    container: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
      minHeight: '100vh'
    },
    card: {
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      boxShadow: theme === 'dark' 
        ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
        : '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const tabs = [
    {
      id: 'configuracion',
      name: 'Configuración',
      icon: SettingsIcon
    },
    {
      id: 'categorias',
      name: 'Categorías',
      icon: List
    },
    {
      id: 'estados-flujo',
      name: 'Estados y Flujo',
      icon: Zap
    },
    {
      id: 'usuarios',
      name: 'Usuarios',
      icon: Users
    },
    {
      id: 'asuetos',
      name: 'Asuetos',
      icon: Calendar
    },
    {
      id: 'parametros-finales',
      name: 'Parámetros Estados Finales',
      icon: FileText
    }
  ];

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', ...styles.container }}>
      {/* Header con título */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon 
            className="w-6 h-6" 
            style={{ color: theme === 'dark' ? '#3b82f6' : '#2563eb' }}
          />
          <h1 className="text-xl font-bold" style={{ color: styles.text.primary }}>
            Administración del Sistema
          </h1>
        </div>

        {/* Menú de tabs horizontal */}
        <div className="relative flex items-center gap-1 border-b" style={{ 
          borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Actualizar posición del indicador
                  const tabElement = tabRefs.current[tab.id];
                  if (tabElement) {
                    const parent = tabElement.parentElement;
                    if (parent) {
                      const parentRect = parent.getBoundingClientRect();
                      const tabRect = tabElement.getBoundingClientRect();
                      setIndicatorStyle({
                        left: tabRect.left - parentRect.left,
                        width: tabRect.width
                      });
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative"
                style={{
                  color: isActive 
                    ? (theme === 'dark' ? '#3b82f6' : '#2563eb')
                    : styles.text.secondary
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
          {/* Barrita indicadora animada */}
          <div
            className="absolute bottom-0 h-0.5 transition-all duration-300 ease-in-out"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
              transform: 'translateY(2px)' // Alinear con el borde inferior
            }}
          />
        </div>
      </div>

      {/* Contenido según tab activo */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {activeTab === 'configuracion' && (
          <div 
            className="p-6 rounded-xl border animate-fade-in"
            style={{
              ...styles.card,
              boxShadow: theme === 'dark' 
                ? '0 2px 8px rgba(0, 0, 0, 0.25)' 
                : '0 2px 8px rgba(0, 0, 0, 0.08)',
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)',
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Sección: Parámetros Globales SLA */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-1.5" style={{ color: styles.text.primary }}>
                Parámetros Globales SLA
              </h2>
              <p className="text-xs mb-6 leading-relaxed" style={{ 
                color: styles.text.tertiary,
                opacity: 0.85
              }}>
                Defina los tiempos y alertas para el cumplimiento de acuerdos de nivel de servicio.
              </p>

              {/* Días SLA por Defecto */}
              <NumberInput
                value={slaSettings.defaultSlaDays}
                onChange={(value) => handleSlaChange('defaultSlaDays', value)}
                min={1}
                label="Días SLA por Defecto"
                description="Tiempo estándar para resolución de casos si la categoría no especifica uno propio."
              />
            </div>

            {/* Sección: Reglas de Escalamiento */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-6" style={{ color: styles.text.primary }}>
                Reglas de Escalamiento
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Alerta Supervisor */}
                <NumberInput
                  value={slaSettings.supervisorAlertDays}
                  onChange={(value) => handleSlaChange('supervisorAlertDays', value)}
                  min={0}
                  label="Alerta Supervisor (Días antes de vencer)"
                  description='Genera una advertencia de "Próximo a Vencer" (Nivel 1).'
                />

                {/* Alerta Gerente */}
                <NumberInput
                  value={slaSettings.managerAlertDays}
                  onChange={(value) => handleSlaChange('managerAlertDays', value)}
                  min={0}
                  label="Alerta Gerente (Días después de vencido)"
                  description="Escala el caso a Gerencia si persiste vencido por esta cantidad de días (Nivel 3)."
                />
              </div>
            </div>

            {/* Botón Guardar Parámetros */}
            <div className="flex justify-end pt-5 border-t" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
            }}>
              <button
                onClick={handleSave}
                className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                <Save className="w-4 h-4" />
                Guardar Parámetros
              </button>
            </div>
          </div>
        )}

        {activeTab === 'categorias' && (
          <div 
            className="p-6 rounded-lg border"
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Título y descripción */}
            <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
              Mantenimiento de Categorías
            </h2>
            <p className="text-sm mb-6" style={{ color: styles.text.tertiary }}>
              Gestione los tipos de casos y sus tiempos de respuesta (SLA).
            </p>

            {/* Formulario para agregar categoría */}
            <div className="mb-8 p-4 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}>
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label 
                      className="block text-sm font-semibold mb-2" 
                      style={{ color: styles.text.primary }}
                    >
                      Nombre Categoría
                    </label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="Ej. Soporte Redes"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                        color: styles.text.primary
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <label 
                      className="block text-sm font-semibold mb-2" 
                      style={{ color: styles.text.primary }}
                    >
                      SLA (Días)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newCategory.slaDays}
                      onChange={(e) => setNewCategory({ ...newCategory, slaDays: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                        color: styles.text.primary
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddCategory}
                    className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: theme === 'dark' ? '#166534' : '#14532d',
                      boxShadow: theme === 'dark' 
                        ? '0 4px 12px rgba(22, 101, 52, 0.3)' 
                        : '0 4px 12px rgba(20, 83, 45, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#14532d' : '#0f4c1f';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#166534' : '#14532d';
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>
                <div>
                  <label 
                    className="block text-sm font-semibold mb-2" 
                    style={{ color: styles.text.primary }}
                  >
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    placeholder="Breve descripción de la categoría..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Búsqueda de categoría */}
            <div className="mb-6 p-4 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}>
              <div className="text-xs font-semibold uppercase mb-3 tracking-wide" style={{ color: styles.text.secondary }}>
                Buscar Categoría
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
                    Buscar por nombre, descripción o ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: styles.text.tertiary }} />
                    <input
                      type="text"
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      placeholder="Buscar categoría..."
                      className="w-full pl-10 pr-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                        color: styles.text.primary
                      }}
                    />
                  </div>
                </div>
                {categorySearchTerm && (
                  <button
                    onClick={() => {
                      setCategorySearchTerm('');
                      setFilteredCategories(categories);
                    }}
                    className="px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: 'transparent',
                      color: styles.text.secondary,
                      border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de categorías */}
            <div className="rounded-lg border overflow-hidden" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                  }}>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      NOMBRE
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      SLA DÍAS
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                  <tbody>
                    {(() => {
                      console.log('Renderizando tabla. filteredCategories.length:', filteredCategories.length);
                      console.log('filteredCategories:', filteredCategories);
                      return filteredCategories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                            {categorySearchTerm ? `No se encontraron categorías que coincidan con "${categorySearchTerm}"` : 'No hay categorías registradas'}
                          </td>
                        </tr>
                      ) : (
                        filteredCategories.map((category, index) => (
                    <tr
                      key={category.id}
                      style={{
                        backgroundColor: index % 2 === 0
                          ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                          : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                        borderBottom: index < filteredCategories.length - 1
                          ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                          : 'none'
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center" style={{ position: 'relative' }}>
                          <span className="text-sm font-medium flex-1" style={{ color: styles.text.primary }}>
                            {category.name}
                          </span>
                          <div className="relative group flex-shrink-0" style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            width: '24px',
                            justifyContent: 'flex-end',
                            marginLeft: '8px'
                          }}>
                            <HelpCircle 
                              className="cursor-help transition-colors" 
                              style={{ 
                                color: theme === 'dark' ? '#cbd5e1' : '#475569',
                                width: '18px',
                                height: '18px',
                                display: 'block',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = theme === 'dark' ? '#f1f5f9' : '#0f172a';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = theme === 'dark' ? '#cbd5e1' : '#475569';
                              }}
                            />
                            <div 
                              className="absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-normal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                              style={{
                                backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                                color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                                boxShadow: theme === 'dark' 
                                  ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                                  : '0 4px 12px rgba(0, 0, 0, 0.3)',
                                width: 'max-content',
                                maxWidth: '300px',
                                top: '50%',
                                transform: 'translateY(-50%)'
                              }}
                            >
                              {category.description || category.name || 'Sin descripción disponible'}
                              <div 
                                className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0"
                                style={{
                                  borderTop: '4px solid transparent',
                                  borderBottom: '4px solid transparent',
                                  borderRight: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: styles.text.secondary }}>
                          {category.slaDays}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="p-2 rounded-lg transition-all hover:shadow-md"
                            style={{
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                            }}
                            title="Editar categoría"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="p-2 rounded-lg transition-all hover:shadow-md"
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }}
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                        ))
                      );
                    })()}
                </tbody>
              </table>
            </div>

            {/* Modal de Edición de Categoría */}
            {editingCategory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
              }}>
                <div className="rounded-xl border p-6 w-full max-w-md" style={{
                  ...styles.card,
                  boxShadow: theme === 'dark' 
                    ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                    : '0 8px 24px rgba(0, 0, 0, 0.2)'
                }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold" style={{ color: styles.text.primary }}>
                      Editar Categoría
                    </h3>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 rounded-lg transition-colors"
                      style={{
                        color: styles.text.tertiary
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.secondary }}>
                        Nombre Categoría <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        placeholder="Ej. Soporte Redes"
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                          borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                          color: styles.text.primary
                        }}
                      />
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="w-32">
                        <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.secondary }}>
                          SLA (Días) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editingCategory.slaDays === '' ? '' : editingCategory.slaDays}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingCategory({ ...editingCategory, slaDays: value === '' ? '' : parseInt(value) || '' });
                          }}
                          className="w-full px-3 py-2 rounded-lg border text-sm"
                          style={{
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                            borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                            color: styles.text.primary
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.secondary }}>
                        Descripción <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={editingCategory.description}
                        onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                        placeholder="Breve descripción de la categoría..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                        style={{
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                          borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                          color: styles.text.primary
                        }}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          color: styles.text.secondary,
                          border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleUpdateCategory}
                        className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                        style={{
                          backgroundColor: theme === 'dark' ? '#166534' : '#14532d',
                          boxShadow: theme === 'dark' 
                            ? '0 4px 12px rgba(22, 101, 52, 0.3)' 
                            : '0 4px 12px rgba(20, 83, 45, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? '#14532d' : '#0f4c1f';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? '#166534' : '#14532d';
                        }}
                      >
                        <Save className="w-4 h-4" />
                        Guardar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {deletingCategory && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}
                onClick={handleCancelDelete}
              >
                <div 
                  className="rounded-xl border p-6 w-full max-w-md animate-in zoom-in-95 duration-200"
                  style={{
                    ...styles.card,
                    boxShadow: theme === 'dark' 
                      ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                      : '0 8px 24px rgba(0, 0, 0, 0.2)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center mb-4">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
                      }}
                    >
                      <AlertTriangle 
                        className="w-8 h-8 animate-in zoom-in duration-300" 
                        style={{ color: '#ef4444' }}
                      />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                      ¿Eliminar categoría?
                    </h3>
                    <p className="text-sm text-center" style={{ color: styles.text.secondary }}>
                      Está a punto de eliminar la categoría <strong style={{ color: styles.text.primary }}>{deletingCategory.name}</strong>. Esta acción no se puede deshacer.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={handleCancelDelete}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: styles.text.secondary,
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                      style={{
                        backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                        boxShadow: theme === 'dark' 
                          ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                          : '0 4px 12px rgba(220, 38, 38, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'estados-flujo' && (
          <div 
            className="p-6 rounded-lg border"
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Header con botón guardar */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                  Flujo de Estados y Transiciones
                </h2>
                <p className="text-sm" style={{ color: styles.text.tertiary }}>
                  Defina qué cambios de estado están permitidos y el orden del flujo.
                </p>
              </div>
              {hasChanges && (
                  <button
                    onClick={handleSaveStates}
                    className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                      boxShadow: theme === 'dark' 
                        ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                        : '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                    }}
                  >
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                )}
            </div>

            {/* Formulario para agregar nuevo estado */}
            <div 
              className="mb-6 p-4 rounded-lg" 
              style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`,
                animation: 'fadeInSlide 0.3s ease-out'
              }}
            >
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Agregar Nuevo Estado
              </h3>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
                    Nombre Estado
                  </label>
                  <input
                    type="text"
                    value={newState.name}
                    onChange={(e) => setNewState({ ...newState, name: e.target.value })}
                    placeholder="Ej. Validación Técnica"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="relative group" style={{ display: 'inline-block' }}>
                    <HelpCircle 
                      className="w-5 h-5 cursor-help transition-colors" 
                      style={{ color: styles.text.tertiary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = styles.text.tertiary;
                      }}
                    />
                    <div 
                      className="absolute px-3 py-2 rounded-lg text-xs font-medium whitespace-normal max-w-xs text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                        color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                        boxShadow: theme === 'dark' 
                          ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                          : '0 4px 12px rgba(0, 0, 0, 0.3)',
                        left: '50%',
                        bottom: 'calc(100% + 8px)',
                        transform: 'translateX(-50%)',
                        width: 'max-content',
                        maxWidth: '280px'
                      }}
                    >
                      <div className="font-semibold mb-1">Estado Final</div>
                      <div className="text-xs leading-relaxed">
                        Si está marcado, este estado detiene el conteo del SLA. Los casos que lleguen a este estado no se considerarán vencidos, independientemente del tiempo transcurrido.
                      </div>
                      <div 
                        className="absolute w-0 h-0"
                        style={{
                          left: '50%',
                          top: '100%',
                          transform: 'translateX(-50%)',
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                        }}
                      />
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newState.isFinal}
                    onChange={(e) => setNewState({ ...newState, isFinal: e.target.checked })}
                    className="w-5 h-5 rounded cursor-pointer transition-all"
                    style={{
                      backgroundColor: newState.isFinal 
                        ? (theme === 'dark' ? '#166534' : '#14532d')
                        : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                      borderColor: newState.isFinal
                        ? (theme === 'dark' ? '#166534' : '#14532d')
                        : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                      borderWidth: '2px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddState}
                  className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#166534' : '#14532d',
                    boxShadow: theme === 'dark' 
                      ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                      : '0 4px 12px rgba(20, 83, 45, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#14532d' : '#0f4c1f';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#166534' : '#14532d';
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Crear
                </button>
              </div>
            </div>

            {/* Lista de estados con drag and drop */}
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Gestión de Estados
              </h3>
              <div className="space-y-2">
                {states
                  .sort((a, b) => a.order - b.order)
                  .map((state, index) => (
                    <div
                      key={state.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, state.id)}
                      onDragOver={(e) => handleDragOver(e, state.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, state.id)}
                      className="flex items-center gap-4 p-4 rounded-lg border cursor-move transition-all"
                      style={{
                        backgroundColor: draggedStateId === state.id
                          ? (theme === 'dark' ? '#1e3a8a' : '#dbeafe')
                          : dragOverStateId === state.id
                          ? (theme === 'dark' ? '#1e40af' : '#bfdbfe')
                          : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                        opacity: draggedStateId === state.id ? 0.5 : 1,
                        animation: `fadeInSlide 0.3s ease-out ${index * 0.05}s both`,
                        transform: draggedStateId === state.id ? 'scale(0.98)' : 'scale(1)',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <GripVertical 
                        className="w-5 h-5 flex-shrink-0 transition-all" 
                        style={{ 
                          color: styles.text.tertiary, 
                          cursor: 'grab',
                          transform: 'scale(1)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.color = styles.text.tertiary;
                        }}
                      />
                      <div className="w-16 text-sm font-semibold" style={{ color: styles.text.secondary }}>
                        Orden {state.order}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        {editingStateId === state.id ? (
                          <input
                            type="text"
                            value={editingStateName}
                            onChange={(e) => setEditingStateName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditState(state.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditState();
                              }
                            }}
                            onBlur={() => handleSaveEditState(state.id)}
                            className="flex-1 px-2 py-1 rounded border text-sm font-medium"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.5)',
                              color: styles.text.primary
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                            {state.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div className="relative group" style={{ display: 'inline-block' }}>
                            <HelpCircle 
                              className="w-4 h-4 cursor-help transition-colors" 
                              style={{ color: styles.text.tertiary }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = styles.text.tertiary;
                              }}
                            />
                            <div 
                              className="absolute px-3 py-2 rounded-lg text-xs font-medium whitespace-normal max-w-xs text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                              style={{
                                backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                                color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                                boxShadow: theme === 'dark' 
                                  ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                                  : '0 4px 12px rgba(0, 0, 0, 0.3)',
                                right: 'calc(100% + 8px)',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 'max-content',
                                maxWidth: '300px'
                              }}
                            >
                              <div className="font-semibold mb-1">Estado Final - Detiene SLA</div>
                              <div className="text-xs leading-relaxed">
                                Cuando un estado está marcado como "Final", el sistema detiene completamente el conteo del tiempo de SLA (Service Level Agreement) para los casos que se encuentren en este estado. Esto significa que:
                              </div>
                              <ul className="text-xs leading-relaxed mt-2 text-left list-disc list-inside space-y-1" style={{ paddingLeft: '8px' }}>
                                <li>El caso no se considerará vencido, sin importar cuánto tiempo haya transcurrido.</li>
                                <li>No se generarán alertas de SLA vencido para este caso.</li>
                                <li>El tiempo de respuesta se congela en el momento en que el caso llega a este estado.</li>
                                <li>Útil para estados como "Resuelto", "Cerrado" o "Cancelado".</li>
                              </ul>
                              <div 
                                className="absolute w-0 h-0"
                                style={{
                                  left: '100%',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  borderTop: '4px solid transparent',
                                  borderBottom: '4px solid transparent',
                                  borderLeft: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                                }}
                              />
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={state.isFinal}
                            onChange={() => handleToggleFinalState(state.id)}
                            className="w-5 h-5 rounded cursor-pointer transition-all"
                            style={{
                              backgroundColor: state.isFinal 
                                        ? (theme === 'dark' ? '#166534' : '#14532d')
                                        : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                      borderColor: state.isFinal
                                        ? (theme === 'dark' ? '#166534' : '#14532d')
                                : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                              borderWidth: '2px',
                              borderStyle: 'solid'
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => editingStateId === state.id ? handleCancelEditState() : handleEditState(state.id)}
                          className="p-2 rounded-lg transition-all hover:shadow-md"
                          style={{
                            backgroundColor: editingStateId === state.id 
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'transparent',
                            color: editingStateId === state.id 
                              ? '#ef4444'
                              : styles.text.secondary,
                            border: editingStateId === state.id 
                              ? 'none'
                              : `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            if (editingStateId === state.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            } else {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (editingStateId === state.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            } else {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title={editingStateId === state.id ? "Cancelar edición" : "Editar estado"}
                        >
                          {editingStateId === state.id ? (
                            <X className="w-4 h-4" style={{ animation: 'fadeIn 0.2s ease-out' }} />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteState(state.id)}
                          className="p-2 rounded-lg transition-all hover:shadow-md"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                          }}
                          title="Eliminar estado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal de Confirmación de Eliminación de Estado */}
            {deletingState && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}
                onClick={handleCancelDeleteState}
              >
                <div 
                  className="rounded-xl border p-6 w-full max-w-md animate-in zoom-in-95 duration-200"
                  style={{
                    ...styles.card,
                    boxShadow: theme === 'dark' 
                      ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                      : '0 8px 24px rgba(0, 0, 0, 0.2)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center mb-4">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
                      }}
                    >
                      <AlertTriangle 
                        className="w-8 h-8 animate-in zoom-in duration-300" 
                        style={{ color: '#ef4444' }}
                      />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                      ¿Eliminar estado?
                    </h3>
                    <p className="text-sm text-center" style={{ color: styles.text.secondary }}>
                      Está a punto de eliminar el estado <strong style={{ color: styles.text.primary }}>{deletingState.name}</strong>. Esta acción no se puede deshacer.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={handleCancelDeleteState}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: styles.text.secondary,
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmDeleteState}
                      className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                      style={{
                        backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                        boxShadow: theme === 'dark' 
                          ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                          : '0 4px 12px rgba(220, 38, 38, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Matriz de transiciones */}
            <div>
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Matriz de Transiciones Permitidas
              </h3>
              <p className="text-xs mb-4 italic" style={{ color: styles.text.tertiary }}>
                * Marque las casillas de la matriz para permitir que un usuario cambie un caso desde el estado de la fila hacia el estado de la columna.
              </p>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: styles.text.secondary }}>
                        ESTADO ACTUAL (DESDE)
                      </div>
                      <div className="text-xs italic" style={{ color: styles.text.tertiary }}>
                        CHECK = PUEDE CAMBIAR A...
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveTransitions}
                      disabled={!hasChanges}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        color: hasChanges ? '#ffffff' : styles.text.tertiary,
                        backgroundColor: hasChanges ? '#c8151b' : 'transparent',
                        borderColor: hasChanges ? '#c8151b' : (theme === 'dark' ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.4)')
                      }}
                    >
                      Guardar transiciones
                    </button>
                  </div>
                  <table className="w-full border-collapse" style={{
                    border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                      }}>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{
                          color: styles.text.secondary,
                          borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                        }}>
                          Desde
                        </th>
                        {states
                          .sort((a, b) => a.order - b.order)
                          .map((state) => (
                            <th
                              key={state.id}
                              className="px-3 py-2 text-center text-xs font-bold uppercase"
                              style={{
                                color: styles.text.secondary,
                                borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                              }}
                            >
                              {state.name.toUpperCase()}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {states
                        .sort((a, b) => a.order - b.order)
                        .map((fromState, rowIndex) => (
                          <tr
                            key={fromState.id}
                            style={{
                              backgroundColor: rowIndex % 2 === 0
                                ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                                : (theme === 'dark' ? '#0f172a' : '#f8fafc')
                            }}
                          >
                            <td
                              className="px-3 py-2 text-sm font-medium"
                              style={{
                                color: styles.text.primary,
                                borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                              }}
                            >
                              {fromState.name}
                            </td>
                            {states
                              .sort((a, b) => a.order - b.order)
                              .map((toState) => (
                                <td
                                  key={toState.id}
                                  className="px-3 py-2 text-center"
                                  style={{
                                    borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={transitions[fromState.id]?.[toState.id] || false}
                                    onChange={(e) => handleTransitionChange(fromState.id, toState.id, e.target.checked)}
                                    disabled={fromState.id === toState.id}
                                    className="w-5 h-5 rounded transition-all"
                                    style={{
                                      backgroundColor: (transitions[fromState.id]?.[toState.id] || false)
                                        ? (theme === 'dark' ? '#166534' : '#14532d')
                                        : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                      borderColor: (transitions[fromState.id]?.[toState.id] || false)
                                        ? (theme === 'dark' ? '#166534' : '#14532d')
                                        : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                                      borderWidth: '2px',
                                      borderStyle: 'solid',
                                      cursor: fromState.id === toState.id ? 'not-allowed' : 'pointer',
                                      opacity: fromState.id === toState.id ? 0.4 : 1
                                    }}
                                  />
                                </td>
                              ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div 
            className="p-6 rounded-lg border"
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Header con título, descripción y botón */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                  Directorio de Usuarios
                </h2>
                <p className="text-sm" style={{ color: styles.text.tertiary }}>
                  Usuarios con acceso al sistema en la empresa actual.
                </p>
              </div>
              <button
                className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                <UserPlus className="w-4 h-4" />
                Nuevo Usuario
              </button>
            </div>

            {/* Tabla de usuarios */}
            <div className="rounded-lg border overflow-hidden" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                  }}>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      AVATAR
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      NOMBRE
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ID
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ROL
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      EMAIL
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ORDEN R.R.
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ESTADO
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                        Cargando usuarios...
                      </td>
                    </tr>
                  ) : settingsUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                        No hay usuarios registrados
                      </td>
                    </tr>
                  ) : (
                    settingsUsers.map((user, index) => {
                      const roleStyle = getRoleBadgeStyle(user.role);
                      // Extraer el ID del fullName (formato: "CODE Nombre AGT-XXX" o "CODE Nombre AGT-INT-XXXX")
                      // Buscar patrones como AGT-INT-0001, AGT-0001, etc.
                      const idMatch = user.fullName.match(/AGT-[A-Z0-9-]+/);
                      const userId = idMatch ? idMatch[0] : user.id;
                      
                      return (
                        <tr
                          key={user.id}
                          style={{
                            backgroundColor: index % 2 === 0
                              ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                              : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                            borderBottom: index < settingsUsers.length - 1
                              ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                              : 'none'
                          }}
                        >
                        {/* AVATAR - Columna separada */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                              style={{
                                backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb'
                              }}
                            >
                              {user.code}
                            </div>
                          </div>
                        </td>
                        
                        {/* NOMBRE - Columna separada */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                            {user.name}
                          </span>
                        </td>
                        
                        {/* ID - Columna separada */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono" style={{ color: styles.text.secondary }}>
                            {userId}
                          </span>
                        </td>
                        
                        {/* ROL */}
                        <td className="px-4 py-3">
                          <span 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border"
                            style={{
                              backgroundColor: roleStyle.bg,
                              color: roleStyle.text,
                              borderColor: roleStyle.border
                            }}
                          >
                            {user.role === 'Supervisor' && <Eye className="w-3 h-3" />}
                            {user.role === 'Gerente' && <Briefcase className="w-3 h-3" />}
                            {user.role}
                          </span>
                        </td>
                        
                        {/* EMAIL */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: styles.text.secondary }}>
                            {user.email}
                          </span>
                        </td>
                        
                        {/* ORDEN R.R. */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: styles.text.secondary }}>
                            {user.roundRobinOrder}
                          </span>
                        </td>
                        
                        {/* ESTADO */}
                        <td className="px-4 py-3">
                          <span 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border"
                            style={{
                              backgroundColor: theme === 'dark' ? 'rgba(22, 101, 52, 0.15)' : 'rgba(20, 83, 45, 0.1)',
                              color: '#166534',
                              borderColor: 'rgba(22, 101, 52, 0.3)'
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {user.status}
                          </span>
                        </td>
                        
                        {/* ACCIONES */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 rounded-lg transition-all hover:shadow-md"
                              style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              }}
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'asuetos' && (
          <div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            style={{
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Panel Izquierdo: Calendario de Asuetos */}
            <div className="p-6 rounded-xl border" style={{
              ...styles.card,
              boxShadow: theme === 'dark' 
                ? '0 2px 8px rgba(0, 0, 0, 0.25)' 
                : '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg" style={{
                      backgroundColor: theme === 'dark' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(21, 128, 61, 0.1)'
                    }}>
                      <Calendar className="w-5 h-5" style={{ color: theme === 'dark' ? '#16a34a' : '#15803d' }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: styles.text.primary }}>
                        Calendario de Asuetos
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: styles.text.tertiary }}>
                        Fechas excluidas del conteo de días hábiles para SLA
                      </p>
                    </div>
                  </div>
                  {holidays.length > 0 && (
                    <div className="flex items-center gap-3 mt-3">
                      <div className="px-3 py-1.5 rounded-lg" style={{
                        backgroundColor: theme === 'dark' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(21, 128, 61, 0.08)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(21, 128, 61, 0.2)'}`
                      }}>
                        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: theme === 'dark' ? '#16a34a' : '#15803d' }}>
                          <Calendar className="w-3.5 h-3.5" />
                          {holidays.length} {holidays.length === 1 ? 'asueto registrado' : 'asuetos registrados'}
                        </span>
                      </div>
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const upcomingHolidays = holidays
                          .filter(h => {
                            const hDate = h.fechaDate || parseDateFromDDMMYYYY(h.fecha);
                            hDate.setHours(0, 0, 0, 0);
                            return hDate >= today;
                          })
                          .sort((a, b) => {
                            const aDate = a.fechaDate || parseDateFromDDMMYYYY(a.fecha);
                            const bDate = b.fechaDate || parseDateFromDDMMYYYY(b.fecha);
                            return aDate.getTime() - bDate.getTime();
                          })
                          .slice(0, 1);
                        
                        if (upcomingHolidays.length > 0) {
                          const nextHoliday = upcomingHolidays[0];
                          const nextHolidayDate = nextHoliday.fechaDate || parseDateFromDDMMYYYY(nextHoliday.fecha);
                          const daysUntil = Math.ceil((nextHolidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          // Formatear fecha usando el string del webhook directamente para mostrar exactamente lo que viene
                          let nextHolidayDateText = '';
                          if (nextHoliday.fecha) {
                            const nextHolidayFormatted = formatDateFromDDMMYYYY(nextHoliday.fecha);
                            // Obtener solo la parte de la fecha sin el día de la semana
                            const parts = nextHolidayFormatted.split(', ');
                            nextHolidayDateText = parts.length > 1 ? parts[1] : nextHolidayFormatted;
                          } else {
                            // Fallback: usar la fecha parseada si no hay string
                            nextHolidayDateText = formatDateToSpanish(nextHolidayDate).split(', ')[1] || '';
                          }
                          
                          return (
                            <div className="px-3 py-1.5 rounded-lg" style={{
                              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                              border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                            }}>
                              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb' }}>
                                <Clock className="w-3.5 h-3.5" />
                                Próximo: {nextHolidayDateText} {daysUntil === 0 ? '(hoy)' : daysUntil === 1 ? '(mañana)' : `(en ${daysUntil} días)`}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Botón para agregar fecha con calendario desplegable */}
              <div className="mb-6 relative" style={{ overflow: 'visible' }}>
                <button
                  onClick={() => {
                    setShowCalendar(!showCalendar);
                    // Resetear al mes actual cuando se abre
                    if (!showCalendar) {
                      const today = new Date();
                      setCalendarMonth(today.getMonth());
                      setCalendarYear(today.getFullYear());
                      setSearchMonth(today.getMonth());
                      setSearchYear(today.getFullYear());
                      setSearchDay(today.getDate());
                    }
                  }}
                  className="w-full px-4 py-3 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#16a34a' : '#15803d',
                    boxShadow: theme === 'dark' 
                      ? '0 2px 6px rgba(22, 163, 74, 0.25)' 
                      : '0 2px 6px rgba(21, 128, 61, 0.2)',
                    transform: 'scale(1)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#15803d' : '#166534';
                    e.currentTarget.style.boxShadow = theme === 'dark' 
                      ? '0 4px 10px rgba(22, 163, 74, 0.35)' 
                      : '0 4px 10px rgba(21, 128, 61, 0.3)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#16a34a' : '#15803d';
                    e.currentTarget.style.boxShadow = theme === 'dark' 
                      ? '0 2px 6px rgba(22, 163, 74, 0.25)' 
                      : '0 2px 6px rgba(21, 128, 61, 0.2)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Calendar className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                  Agregar Fecha
                </button>

                {/* Calendario desplegable */}
                {showCalendar && (
                  <>
                    {/* Overlay para cerrar al hacer click fuera */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowCalendar(false)}
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                    />
                    
                    {/* Calendario popup */}
                    <div 
                      className="absolute top-full left-0 mt-2 p-5 rounded-xl border z-20"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.35)',
                        boxShadow: theme === 'dark' 
                          ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
                          : '0 8px 24px rgba(0, 0, 0, 0.2)',
                        animation: 'fadeInSlide 0.2s ease-out',
                        width: '380px',
                        maxWidth: 'calc(100vw - 2rem)',
                        overflow: 'visible',
                        boxSizing: 'border-box'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Navegación del calendario */}
                      <div className="flex items-center justify-between mb-4 gap-2" style={{ width: '100%', overflow: 'visible', boxSizing: 'border-box' }}>
                        <button
                          onClick={handlePrevMonth}
                          className="p-2 rounded-lg transition-all flex-shrink-0"
                          style={{
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'}`,
                            color: styles.text.primary,
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out',
                            animation: 'fadeInSlide 0.3s ease-out',
                            flexShrink: 0,
                            overflow: 'visible',
                            transformOrigin: 'center'
                          }}
                          title="Mes anterior"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#e2e8f0';
                            e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                          }}
                        >
                          <ChevronUp className="w-4 h-4 rotate-[-90deg]" style={{ display: 'block' }} />
                        </button>
                        
                        <div className="flex items-center gap-2 flex-1 min-w-0" style={{ justifyContent: 'center', flexShrink: 1, overflow: 'visible' }}>
                          {/* Selector de Mes - Estilo Google */}
                          <div className="relative flex-shrink-0" style={{ zIndex: 30 }}>
                            <button
                              onClick={() => {
                                setShowMonthPicker(!showMonthPicker);
                                setShowYearPicker(false);
                              }}
                              className="text-sm font-bold capitalize px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                              key={`${calendarMonth}-${calendarYear}`}
                              style={{ 
                                color: styles.text.primary,
                                backgroundColor: theme === 'dark' ? 'rgba(21, 128, 61, 0.1)' : 'rgba(21, 128, 61, 0.08)',
                                animation: 'fadeIn 0.3s ease-out',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(21, 128, 61, 0.15)' : 'rgba(21, 128, 61, 0.12)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(21, 128, 61, 0.1)' : 'rgba(21, 128, 61, 0.08)';
                              }}
                            >
                              {new Date(calendarYear, calendarMonth).toLocaleDateString('es-ES', { month: 'long' })}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            
                            {/* Dropdown de Meses */}
                            {showMonthPicker && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setShowMonthPicker(false)}
                                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                                />
                                <div 
                                  className="absolute top-full left-0 mt-1 p-2 rounded-lg border"
                                  style={{
                                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                                    boxShadow: theme === 'dark' 
                                      ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
                                      : '0 8px 24px rgba(0, 0, 0, 0.2)',
                                    animation: 'fadeInSlide 0.2s ease-out',
                                    width: '180px',
                                    maxWidth: 'calc(100vw - 2rem)',
                                    boxSizing: 'border-box',
                                    zIndex: 50
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="grid grid-cols-3 gap-1">
                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((month, idx) => {
                                      const isCurrentMonth = idx === calendarMonth;
                                      return (
                                        <button
                                          key={idx}
                                          onClick={() => {
                                            setCalendarMonth(idx);
                                            setSearchMonth(idx);
                                            setShowMonthPicker(false);
                                          }}
                                          className="px-2 py-1.5 text-xs rounded transition-all capitalize"
                                          style={{
                                            backgroundColor: isCurrentMonth 
                                              ? (theme === 'dark' ? 'rgba(16, 122, 180, 0.2)' : 'rgba(16, 122, 180, 0.1)')
                                              : 'transparent',
                                            color: isCurrentMonth 
                                              ? '#107ab4' 
                                              : styles.text.primary,
                                            fontWeight: isCurrentMonth ? 'bold' : 'normal'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isCurrentMonth) {
                                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isCurrentMonth) {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                          }}
                                        >
                                          {month.substring(0, 3)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          
                          {/* Selector de Año - Estilo Google */}
                          <div className="relative flex-shrink-0" style={{ zIndex: 30 }}>
                            <button
                              onClick={() => {
                                setShowYearPicker(!showYearPicker);
                                setShowMonthPicker(false);
                              }}
                              className="text-sm font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                              style={{ 
                                color: styles.text.primary,
                                backgroundColor: theme === 'dark' ? 'rgba(21, 128, 61, 0.1)' : 'rgba(21, 128, 61, 0.08)',
                                animation: 'fadeIn 0.3s ease-out',
                                border: 'none',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(21, 128, 61, 0.15)' : 'rgba(21, 128, 61, 0.12)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(21, 128, 61, 0.1)' : 'rgba(21, 128, 61, 0.08)';
                              }}
                            >
                              {calendarYear}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            
                            {/* Dropdown de Años */}
                            {showYearPicker && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setShowYearPicker(false)}
                                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                                />
                                <div 
                                  className="absolute top-full mt-1 p-4 rounded-xl border max-h-80 overflow-y-auto"
                                  style={{
                                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                                    boxShadow: theme === 'dark' 
                                      ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
                                      : '0 8px 24px rgba(0, 0, 0, 0.2)',
                                    animation: 'fadeInSlide 0.2s ease-out',
                                    width: '240px',
                                    minHeight: '280px',
                                    maxWidth: 'calc(100vw - 2rem)',
                                    right: '0',
                                    boxSizing: 'border-box',
                                    zIndex: 50
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Header con rango de años */}
                                  <div className="mb-3 pb-3 border-b" style={{ 
                                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'
                                  }}>
                                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ 
                                      color: theme === 'dark' ? '#cbd5e1' : '#64748b',
                                      letterSpacing: '0.5px'
                                    }}>
                                      SELECCIONAR AÑO
                                    </div>
                                    <div className="text-xs font-medium" style={{ 
                                      color: theme === 'dark' ? '#94a3b8' : '#64748b'
                                    }}>
                                      {new Date().getFullYear() - 5} - {new Date().getFullYear() + 14}
                                    </div>
                                  </div>
                                  
                                  {/* Grid de años mejorado */}
                                  <div className="grid grid-cols-4 gap-2">
                                    {Array.from({ length: 20 }, (_, i) => {
                                      const year = new Date().getFullYear() - 5 + i;
                                      const isCurrentYear = year === calendarYear;
                                      const isThisYear = year === new Date().getFullYear();
                                      return (
                                        <button
                                          key={year}
                                          onClick={() => {
                                            setCalendarYear(year);
                                            setSearchYear(year);
                                            setShowYearPicker(false);
                                          }}
                                          className="px-3 py-2.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center"
                                          style={{
                                            backgroundColor: isCurrentYear 
                                              ? (theme === 'dark' ? '#16a34a' : '#15803d')
                                              : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                                            color: isCurrentYear 
                                              ? '#ffffff' 
                                              : styles.text.primary,
                                            fontWeight: isCurrentYear ? 'bold' : 'normal',
                                            border: isCurrentYear
                                              ? 'none'
                                              : `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`,
                                            transform: 'scale(1)',
                                            transition: 'all 0.15s ease-in-out',
                                            boxShadow: isCurrentYear 
                                              ? (theme === 'dark' ? '0 2px 4px rgba(22, 163, 74, 0.3)' : '0 2px 4px rgba(21, 128, 61, 0.2)')
                                              : 'none',
                                            textAlign: 'center',
                                            width: '100%',
                                            aspectRatio: '1'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isCurrentYear) {
                                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                                              e.currentTarget.style.borderColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
                                              e.currentTarget.style.borderWidth = '2px';
                                              e.currentTarget.style.color = theme === 'dark' ? '#ffffff' : '#0f172a';
                                              e.currentTarget.style.transform = 'scale(1.05)';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isCurrentYear) {
                                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                                              e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)';
                                              e.currentTarget.style.borderWidth = '1px';
                                              e.currentTarget.style.color = styles.text.primary;
                                              e.currentTarget.style.transform = 'scale(1)';
                                            }
                                          }}
                                        >
                                          {year}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          
                          {(calendarMonth !== new Date().getMonth() || calendarYear !== new Date().getFullYear()) && (
                            <button
                              onClick={() => {
                                const today = new Date();
                                setCalendarMonth(today.getMonth());
                                setCalendarYear(today.getFullYear());
                                setSearchMonth(today.getMonth());
                                setSearchYear(today.getFullYear());
                                setSearchDay(today.getDate());
                              }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all flex-shrink-0"
                              style={{
                                backgroundColor: theme === 'dark' ? '#0f172a' : '#e2e8f0',
                                color: styles.text.secondary,
                                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`,
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out',
                                animation: 'fadeInSlide 0.3s ease-out 0.1s both',
                                whiteSpace: 'nowrap'
                              }}
                              title="Ir a hoy"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#cbd5e1';
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#e2e8f0';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              Hoy
                            </button>
                          )}
                        </div>
                        
                        <button
                          onClick={handleNextMonth}
                          className="p-2 rounded-lg transition-all flex-shrink-0"
                          style={{
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'}`,
                            color: styles.text.primary,
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out',
                            animation: 'fadeInSlide 0.3s ease-out',
                            flexShrink: 0,
                            overflow: 'visible',
                            transformOrigin: 'center'
                          }}
                          title="Mes siguiente"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#e2e8f0';
                            e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                          }}
                        >
                          <ChevronUp className="w-4 h-4 rotate-90" style={{ display: 'block' }} />
                        </button>
                      </div>

                      {/* Calendario */}
                      <div className="w-full">
                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, idx) => (
                            <div
                              key={idx}
                              className="text-center text-[10px] font-semibold py-1"
                              style={{ 
                                color: styles.text.secondary,
                                animation: `fadeInSlide 0.3s ease-out ${idx * 0.03}s both`
                              }}
                            >
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Días del mes */}
                        <div className="grid grid-cols-7 gap-0.5">
                          {getDaysInMonth(calendarMonth, calendarYear).map((item, idx) => {
                            if (item.day === 0) {
                              return <div key={idx} className="aspect-square" />;
                            }
                            
                            const isHolidayDate = isHoliday(item.date);
                            const isTodayDate = isToday(item.date);
                            
                            // Calcular delay basado en la posición en la grilla (fila y columna)
                            const row = Math.floor(idx / 7);
                            const col = idx % 7;
                            const delay = (row * 0.02) + (col * 0.01);
                            
                            return (
                              <button
                                key={idx}
                                data-day={item.day}
                                onClick={() => {
                                  if (item.date) {
                                    handleDateClick(item.day, calendarMonth, calendarYear);
                                    // Cerrar el calendario después de seleccionar
                                    setShowCalendar(false);
                                  }
                                }}
                                className="aspect-square rounded text-xs font-medium transition-all"
                                style={{
                                  backgroundColor: isHolidayDate
                                    ? (theme === 'dark' ? '#16a34a' : '#15803d')
                                    : isTodayDate
                                    ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.1)')
                                    : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                                  color: isHolidayDate
                                    ? '#ffffff'
                                    : isTodayDate
                                    ? (theme === 'dark' ? '#f87171' : '#c8151b')
                                    : styles.text.primary,
                                  border: isTodayDate
                                    ? `1.5px solid ${theme === 'dark' ? '#c8151b' : '#c8151b'}`
                                    : `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'}`,
                                  cursor: 'pointer',
                                  transform: 'scale(1)',
                                  transition: 'all 0.15s ease-in-out',
                                  animation: `fadeInSlide 0.3s ease-out ${delay}s both`
                                }}
                                onMouseEnter={(e) => {
                                  if (!isHolidayDate) {
                                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#e2e8f0';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.boxShadow = theme === 'dark' 
                                      ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                                      : '0 2px 8px rgba(0, 0, 0, 0.15)';
                                  } else {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = theme === 'dark' 
                                      ? '0 2px 8px rgba(22, 163, 74, 0.4)' 
                                      : '0 2px 8px rgba(21, 128, 61, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isHolidayDate) {
                                    e.currentTarget.style.backgroundColor = isTodayDate
                                      ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.1)')
                                      : (theme === 'dark' ? '#0f172a' : '#f8fafc');
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  } else {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }
                                }}
                                title={isHolidayDate ? 'Fecha registrada - Click para eliminar' : 'Click para agregar'}
                              >
                                {item.day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Leyenda mejorada */}
                      <div 
                        className="flex items-center justify-center gap-4 mt-4 pt-3 border-t" 
                        style={{
                          borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)',
                          animation: 'fadeInSlide 0.3s ease-out 0.2s both'
                        }}
                      >
                        <div 
                          className="flex items-center gap-2"
                          style={{
                            animation: 'fadeIn 0.3s ease-out 0.3s both'
                          }}
                        >
                          <div 
                            className="w-3 h-3 rounded shadow-sm transition-all" 
                            style={{ 
                              backgroundColor: theme === 'dark' ? '#16a34a' : '#15803d',
                              boxShadow: `0 2px 4px ${theme === 'dark' ? 'rgba(22, 163, 74, 0.3)' : 'rgba(21, 128, 61, 0.3)'}`,
                              transform: 'scale(1)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          />
                          <span className="text-[11px] font-medium" style={{ color: styles.text.secondary }}>Registrada</span>
                        </div>
                        <div 
                          className="flex items-center gap-2"
                          style={{
                            animation: 'fadeIn 0.3s ease-out 0.4s both'
                          }}
                        >
                          <div 
                            className="w-3 h-3 rounded border-2 shadow-sm transition-all" 
                            style={{ 
                              borderColor: '#c8151b',
                              backgroundColor: theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.1)',
                              boxShadow: '0 2px 4px rgba(200, 21, 27, 0.2)',
                              transform: 'scale(1)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          />
                          <span className="text-[11px] font-medium" style={{ color: styles.text.secondary }}>Hoy</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Tabla de asuetos - Diseño mejorado */}
              <div className="rounded-xl border overflow-hidden" style={{
                borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)',
                boxShadow: theme === 'dark' 
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
              }}>
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{
                      background: theme === 'dark' 
                        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
                    }}>
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `2px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          FECHA
                        </div>
                      </th>
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `2px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`
                        }}
                      >
                        MOTIVO
                      </th>
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `2px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`
                        }}
                      >
                        PAÍS
                      </th>
                      <th 
                        className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `2px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`
                        }}
                      >
                        ACCIÓN
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Calendar className="w-10 h-10 opacity-30" style={{ color: styles.text.tertiary }} />
                            <div>
                              <p className="text-sm font-medium mb-1" style={{ color: styles.text.secondary }}>
                                No hay asuetos registrados
                              </p>
                              <p className="text-xs" style={{ color: styles.text.tertiary }}>
                                Haz clic en "Agregar Fecha" para comenzar
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        // Ordenar fechas cronológicamente
                        const sortedHolidays = [...holidays].sort((a, b) => {
                          if (a.fechaDate && b.fechaDate) {
                            return a.fechaDate.getTime() - b.fechaDate.getTime();
                          }
                          return a.fecha.localeCompare(b.fecha);
                        });
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        let currentMonthYear = '';
                        return sortedHolidays.map((holiday, index) => {
                          // Convertir fecha string DD/MM/YYYY a Date si no existe fechaDate (solo para cálculos)
                          let holidayDate: Date;
                          if (holiday.fechaDate) {
                            holidayDate = holiday.fechaDate;
                          } else {
                            holidayDate = parseDateFromDDMMYYYY(holiday.fecha);
                          }
                          
                          // Formatear fecha usando el mismo formato que "Próximo"
                          // Parsear la fecha del webhook para mostrar "10 de mayo del 2026"
                          let dateText = '';
                          let weekday = '';
                          
                          if (holiday.fecha) {
                            // Usar el mismo método que en "Próximo"
                            const dateStrFormatted = formatDateFromDDMMYYYY(holiday.fecha);
                            // Obtener solo la parte de la fecha sin el día de la semana (igual que en Próximo)
                            const parts = dateStrFormatted.split(', ');
                            weekday = parts[0] || '';
                            dateText = parts.length > 1 ? parts[1] : dateStrFormatted; // "10 de mayo del 2026"
                          } else if (holiday.fechaDate) {
                            // Fallback: si solo tenemos fechaDate, formatearla
                            const formatted = formatDateToSpanish(holiday.fechaDate);
                            const parts = formatted.split(', ');
                            weekday = parts[0] || '';
                            dateText = parts.length > 1 ? parts[1] : formatted;
                          } else {
                            // Último fallback: mostrar el string tal cual
                            dateText = holiday.fecha || '';
                          }
                          
                          // Detectar cambio de mes/año para agregar separador (usar holidayDate para consistencia)
                          // Usar siempre holidayDate que ya está parseado correctamente
                          const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                          const monthNum = holidayDate.getMonth(); // 0-11
                          const yearNum = holidayDate.getFullYear();
                          const monthYear = `${months[monthNum]} DE ${yearNum}`.toUpperCase();
                          
                          const showSeparator = monthYear !== currentMonthYear;
                          if (showSeparator) currentMonthYear = monthYear;
                          
                          // Verificar si es fecha próxima (dentro de 30 días)
                          holidayDate.setHours(0, 0, 0, 0);
                          const daysUntil = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          // Validar que daysUntil sea un número válido, si no es válido, asumir que es pasado
                          const isValidDaysUntil = !isNaN(daysUntil) && isFinite(daysUntil);
                          const isUpcoming = isValidDaysUntil && daysUntil >= 0 && daysUntil <= 30;
                          const isToday = isValidDaysUntil && daysUntil === 0;
                          const isPast = !isValidDaysUntil || daysUntil < 0;
                          
                          return (
                            <>
                              {showSeparator && index > 0 && (
                                <tr key={`separator-${monthYear}`}>
                                  <td colSpan={4} className="px-5 py-2">
                                    <div 
                                      className="flex items-center gap-2"
                                      style={{
                                        animation: 'fadeInSlide 0.3s ease-out'
                                      }}
                                    >
                                      <div className="flex-1 h-px" style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
                                      }} />
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{
                                        color: styles.text.tertiary,
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)'
                                      }}>
                                        {monthYear}
                                      </span>
                                      <div className="flex-1 h-px" style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
                                      }} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {index === 0 && (
                                <tr key={`separator-${monthYear}-first`}>
                                  <td colSpan={4} className="px-5 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-px" style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
                                      }} />
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{
                                        color: styles.text.tertiary,
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)'
                                      }}>
                                        {monthYear}
                                      </span>
                                      <div className="flex-1 h-px" style={{
                                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'
                                      }} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr
                                key={`${holiday.row_number}-${holiday.fecha}`}
                                className="group transition-all"
                                style={{
                                  backgroundColor: index % 2 === 0
                                    ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                                    : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                                  borderBottom: index < sortedHolidays.length - 1
                                    ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'}`
                                    : 'none',
                                  borderLeft: isUpcoming && !isPast ? `3px solid ${theme === 'dark' ? '#60a5fa' : '#2563eb'}` : 'none',
                                  animation: `fadeInSlide 0.3s ease-out ${index * 0.03}s both`,
                                  transition: 'all 0.2s ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                                  e.currentTarget.style.transform = 'translateX(2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = index % 2 === 0
                                    ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                                    : (theme === 'dark' ? '#0f172a' : '#f8fafc');
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg flex-shrink-0 relative" style={{
                                      backgroundColor: theme === 'dark' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(21, 128, 61, 0.1)'
                                    }}>
                                      <Calendar className="w-4 h-4" style={{ color: theme === 'dark' ? '#16a34a' : '#15803d' }} />
                                      {isToday && (
                                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse" style={{
                                          backgroundColor: '#c8151b',
                                          boxShadow: `0 0 6px ${theme === 'dark' ? 'rgba(200, 21, 27, 0.6)' : 'rgba(200, 21, 27, 0.5)'}`
                                        }} />
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold leading-tight" style={{ color: styles.text.primary }}>
                                          {dateText}
                                        </span>
                                        {isToday && (
                                          <span 
                                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" 
                                            style={{
                                              backgroundColor: theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.15)',
                                              color: '#c8151b',
                                              animation: 'pulse 2s ease-in-out infinite',
                                              transform: 'scale(1)',
                                              transition: 'all 0.2s ease-in-out'
                                            }}
                                          >
                                            Hoy
                                          </span>
                                        )}
                                        {isUpcoming && !isToday && !isPast && (
                                          <span 
                                            className="px-2 py-0.5 rounded text-[10px] font-semibold" 
                                            style={{
                                              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                                              color: theme === 'dark' ? '#60a5fa' : '#2563eb',
                                              animation: 'fadeIn 0.3s ease-out',
                                              transform: 'scale(1)',
                                              transition: 'all 0.2s ease-in-out'
                                            }}
                                          >
                                            En {daysUntil} {daysUntil === 1 ? 'día' : 'días'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-medium leading-tight" style={{ color: styles.text.secondary }}>
                                          {weekday || ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                                    {holiday.motivo || 'Indefinido'}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-sm font-medium" style={{ color: styles.text.secondary }}>
                                    {holiday.pais || 'Indefinido'}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex justify-center">
                                    <button
                                      onClick={async () => {
                                        // Confirmar antes de eliminar
                                        if (window.confirm(`¿Está seguro de que desea eliminar la fecha ${formatDateFromDDMMYYYY(holiday.fecha)}?`)) {
                                          await handleDeleteHoliday(holidayDate, true);
                                        }
                                      }}
                                      className="p-2.5 rounded-lg transition-all opacity-70 group-hover:opacity-100"
                                      style={{
                                        backgroundColor: 'transparent',
                                        color: theme === 'dark' ? 'rgba(148, 163, 184, 0.5)' : 'rgba(107, 114, 128, 0.5)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(153, 27, 27, 0.15)';
                                        e.currentTarget.style.color = '#991b1b';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = theme === 'dark' ? 'rgba(148, 163, 184, 0.5)' : 'rgba(107, 114, 128, 0.5)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }}
                                      title="Eliminar fecha"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Derecho: Carga Masiva */}
            <div className="p-6 rounded-xl border" style={{
              ...styles.card,
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.25)' 
                : '0 4px 12px rgba(0, 0, 0, 0.08)',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
            }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg" style={{
                  backgroundColor: theme === 'dark' ? 'rgba(153, 27, 27, 0.15)' : 'rgba(153, 27, 27, 0.1)'
                }}>
                  <Plus className="w-5 h-5" style={{ color: '#991b1b' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-0.5" style={{ color: styles.text.primary }}>
                    Carga Masiva
                  </h2>
                  <p className="text-xs" style={{ color: styles.text.tertiary }}>
                    Importe múltiples fechas a la vez
                  </p>
                </div>
              </div>
              <p className="text-xs mb-3 px-1" style={{ color: styles.text.secondary }}>
                Pegue fechas en formato <span className="font-mono font-semibold" style={{ color: styles.text.primary }}>YYYY-MM-DD</span> separadas por coma o salto de línea.
              </p>

              {/* Botón de limpiar */}
              {bulkDates.trim() && (
                <div className="mb-3">
                  <button
                    onClick={() => setBulkDates('')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                    style={{
                      backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)',
                      color: styles.text.secondary,
                      border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)'}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)';
                    }}
                  >
                    🗑️ Limpiar
                  </button>
                </div>
              )}

              {/* Textarea */}
              <div className="mb-4">
                <textarea
                  value={bulkDates}
                  onChange={(e) => setBulkDates(e.target.value)}
                  placeholder="2025-12-24&#10;2025-12-31&#10;2026-01-01"
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary,
                    resize: 'vertical',
                    boxShadow: theme === 'dark' 
                      ? '0 2px 6px rgba(0, 0, 0, 0.2)' 
                      : '0 2px 6px rgba(0, 0, 0, 0.05)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(153, 27, 27, 0.5)' : '#991b1b';
                    e.currentTarget.style.boxShadow = theme === 'dark' 
                      ? '0 0 0 3px rgba(153, 27, 27, 0.1)' 
                      : '0 0 0 3px rgba(153, 27, 27, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)';
                    e.currentTarget.style.boxShadow = theme === 'dark' 
                      ? '0 2px 6px rgba(0, 0, 0, 0.2)' 
                      : '0 2px 6px rgba(0, 0, 0, 0.05)';
                  }}
                />
              </div>

              {/* Estadísticas y validación en tiempo real */}
              {(() => {
                const analysis = analyzeBulkDates();
                const hasContent = bulkDates.trim().length > 0;
                
                if (!hasContent) return null;

                return (
                  <div className="mb-4 space-y-2">
                    {/* Estadísticas */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {analysis.valid.length > 0 && (
                        <div 
                          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5" 
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(21, 128, 61, 0.1)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(22, 163, 74, 0.3)' : 'rgba(21, 128, 61, 0.3)'}`,
                            animation: 'fadeInSlide 0.3s ease-out'
                          }}
                        >
                          <span className="text-xs font-bold" style={{ color: theme === 'dark' ? '#16a34a' : '#15803d' }}>
                            ✓ {analysis.valid.length} válida{analysis.valid.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {analysis.duplicates.length > 0 && (
                        <div 
                          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5" 
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`,
                            animation: 'fadeInSlide 0.3s ease-out 0.1s both'
                          }}
                        >
                          <span className="text-xs font-bold" style={{ color: styles.text.secondary }}>
                            ⚠️ {analysis.duplicates.length} duplicada{analysis.duplicates.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {analysis.errors.length > 0 && (
                        <div 
                          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5" 
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            animation: 'fadeInSlide 0.3s ease-out 0.2s both'
                          }}
                        >
                          <span className="text-xs font-bold" style={{ color: '#ef4444' }}>
                            ✗ {analysis.errors.length} error{analysis.errors.length !== 1 ? 'es' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Fechas duplicadas con botón para eliminar */}
                    {analysis.duplicates.length > 0 && (
                      <div className="p-3 rounded-lg" style={{
                        backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`
                      }}>
                        <div className="text-xs font-semibold mb-2 flex items-center gap-2" style={{ color: styles.text.secondary }}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Fechas duplicadas ({analysis.duplicates.length}):
                        </div>
                        <div className="space-y-2">
                          {analysis.duplicates.map((duplicateDateStr, idx) => {
                            // Buscar el asueto en holidays para mostrar motivo y país
                            const holiday = holidays.find(h => {
                              const hDate = h.fechaDate || parseDateFromDDMMYYYY(h.fecha);
                              return getDateOnly(hDate) === duplicateDateStr;
                            });

                            return (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between gap-2 p-2 rounded-lg" 
                                style={{
                                  backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.05)' : 'rgba(148, 163, 184, 0.03)',
                                  border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.15)'}`,
                                  animation: `fadeInSlide 0.3s ease-out ${idx * 0.05}s both`
                                }}
                              >
                                <div className="flex-1">
                                  <div className="text-xs font-mono font-semibold" style={{ color: styles.text.primary }}>
                                    {duplicateDateStr}
                                  </div>
                                  {holiday && (
                                    <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: styles.text.secondary }}>
                                      {holiday.motivo && holiday.motivo !== 'Indefinido' && (
                                        <span>🎉 {holiday.motivo}</span>
                                      )}
                                      {holiday.pais && holiday.pais !== 'Indefinido' && (
                                        <span>📍 {holiday.pais}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveDuplicate(duplicateDateStr)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                                  style={{
                                    backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                  title="Eliminar esta fecha duplicada"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Eliminar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Errores detallados */}
                    {analysis.errors.length > 0 && (
                      <div className="p-3 rounded-lg" style={{
                        backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}>
                        <div className="space-y-1">
                          {analysis.errors.slice(0, 3).map((error, idx) => (
                            <div key={idx} className="text-xs font-mono" style={{ color: '#ef4444' }}>
                              <span className="font-semibold">{error.dateStr}:</span> {error.reason}
                            </div>
                          ))}
                          {analysis.errors.length > 3 && (
                            <div className="text-xs" style={{ color: styles.text.secondary }}>
                              ... y {analysis.errors.length - 3} error{analysis.errors.length - 3 !== 1 ? 'es' : ''} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Vista previa de fechas válidas */}
                    {analysis.valid.length > 0 && analysis.valid.length <= 10 && (
                      <div className="p-3 rounded-lg max-h-32 overflow-y-auto" style={{
                        backgroundColor: theme === 'dark' ? 'rgba(22, 163, 74, 0.08)' : 'rgba(21, 128, 61, 0.06)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(21, 128, 61, 0.2)'}`
                      }}>
                        <div className="text-xs font-semibold mb-2" style={{ color: theme === 'dark' ? '#16a34a' : '#15803d' }}>
                          Vista previa ({analysis.valid.length} fecha{analysis.valid.length !== 1 ? 's' : ''}):
                        </div>
                        <div className="space-y-1">
                          {analysis.valid.map((item, idx) => (
                            <div key={idx} className="text-xs font-mono flex items-center gap-2">
                              <span style={{ color: styles.text.primary }}>{item.dateStr}</span>
                              {item.holidayName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                  backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                                  color: theme === 'dark' ? '#60a5fa' : '#2563eb'
                                }}>
                                  🎉 {item.holidayName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botón de importar */}
              <button
                onClick={handleBulkImport}
                disabled={isImporting || analyzeBulkDates().valid.length === 0}
                className="w-full px-6 py-3.5 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme === 'dark' ? '#991b1b' : '#7f1d1d',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(153, 27, 27, 0.35)' 
                    : '0 4px 12px rgba(127, 29, 29, 0.3)',
                  transform: 'scale(1)',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (!isImporting && analyzeBulkDates().valid.length > 0) {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#7f1d1d' : '#6b1a1a';
                    e.currentTarget.style.boxShadow = theme === 'dark' 
                      ? '0 6px 16px rgba(153, 27, 27, 0.4)' 
                      : '0 6px 16px rgba(127, 29, 29, 0.35)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#991b1b' : '#7f1d1d';
                  e.currentTarget.style.boxShadow = theme === 'dark' 
                    ? '0 4px 12px rgba(153, 27, 27, 0.35)' 
                    : '0 4px 12px rgba(127, 29, 29, 0.3)';
                }}
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Importar {analyzeBulkDates().valid.length > 0 ? `${analyzeBulkDates().valid.length} fecha${analyzeBulkDates().valid.length !== 1 ? 's' : ''}` : 'Fechas'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}


        {activeTab === 'parametros-finales' && (
          <div 
            className="p-6 rounded-lg border"
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }}
          >
            {/* Título y descripción */}
            <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
              Parámetros de Estados Finales
            </h2>
            <p className="text-sm mb-6" style={{ color: styles.text.tertiary }}>
              Gestione los parámetros que se mostrarán al transicionar a un estado marcado como final (ej: correo adjuntos, notificaciones, etc.).
            </p>

            {/* Botón para agregar parámetro */}
            <div className="mb-6">
              <button
                onClick={() => handleOpenParametroModal()}
                className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#166534' : '#14532d',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(22, 101, 52, 0.3)' 
                    : '0 4px 12px rgba(20, 83, 45, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#14532d' : '#0f4c1f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#166534' : '#14532d';
                }}
              >
                <Plus className="w-4 h-4" />
                Agregar Parámetro
              </button>
            </div>

            {/* Búsqueda de parámetro */}
            <div className="mb-6 p-4 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}>
              <div className="text-xs font-semibold uppercase mb-3 tracking-wide" style={{ color: styles.text.secondary }}>
                Buscar Parámetro
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
                    Buscar por nombre, descripción o ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: styles.text.tertiary }} />
                    <input
                      type="text"
                      value={parametroSearchTerm}
                      onChange={(e) => setParametroSearchTerm(e.target.value)}
                      placeholder="Buscar parámetro..."
                      className="w-full pl-10 pr-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                        color: styles.text.primary
                      }}
                    />
                  </div>
                </div>
                {parametroSearchTerm && (
                  <button
                    onClick={() => {
                      setParametroSearchTerm('');
                      setFilteredParametros(parametros);
                    }}
                    className="px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: 'transparent',
                      color: styles.text.secondary,
                      border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de parámetros */}
            <div className="rounded-lg border overflow-hidden" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                  }}>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      NOMBRE
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      TIPO
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      DESCRIPCIÓN
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      REQUERIDO
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParametros.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                        No se encontraron parámetros
                      </td>
                    </tr>
                  ) : (
                    filteredParametros.map((parametro, index) => (
                      <tr
                        key={parametro.id}
                        style={{
                          backgroundColor: index % 2 === 0 
                            ? (theme === 'dark' ? 'transparent' : 'transparent')
                            : (theme === 'dark' ? 'rgba(148, 163, 184, 0.05)' : 'rgba(148, 163, 184, 0.03)'),
                          borderBottom: index < filteredParametros.length - 1 
                            ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)'}`
                            : 'none'
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                            {parametro.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6'
                          }}>
                            {getTipoLabel(parametro.tipo)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: styles.text.secondary }}>
                            {parametro.description}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {parametro.requerido ? (
                            <span className="text-xs px-2 py-1 rounded" style={{
                              backgroundColor: theme === 'dark' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
                              color: '#dc2626'
                            }}>
                              Sí
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded" style={{
                              backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                              color: styles.text.tertiary
                            }}>
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenParametroModal(parametro)}
                              className="p-1.5 rounded transition-colors"
                              style={{
                                color: '#3b82f6'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteParametro(parametro)}
                              className="p-1.5 rounded transition-colors"
                              style={{
                                color: '#dc2626'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Confirmación de Eliminación */}
            {deletingParametro && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
              }}>
                <div className="rounded-xl border p-6 w-full max-w-md" style={{
                  ...styles.card,
                  boxShadow: theme === 'dark' 
                    ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                    : '0 8px 24px rgba(0, 0, 0, 0.2)'
                }}>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6" style={{ color: '#dc2626' }} />
                    <h3 className="text-lg font-bold" style={{ color: styles.text.primary }}>
                      Confirmar Eliminación
                    </h3>
                  </div>
                  <p className="text-sm mb-6" style={{ color: styles.text.secondary }}>
                    ¿Está seguro de que desea eliminar el parámetro <strong>"{deletingParametro.name}"</strong>? Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCancelDeleteParametro}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: styles.text.secondary,
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmDeleteParametro}
                      className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all"
                      style={{
                        backgroundColor: '#dc2626'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc2626';
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal para Crear/Editar Parámetro */}
            {showParametroModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
              }}>
                <div className="rounded-xl border w-full max-w-5xl max-h-[90vh] flex flex-col" style={{
                  ...styles.card,
                  boxShadow: theme === 'dark' 
                    ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                    : '0 8px 24px rgba(0, 0, 0, 0.2)'
                }}>
                  {/* Header fijo */}
                  <div className="flex justify-between items-center p-6 border-b flex-shrink-0" style={{
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
                  }}>
                    <h3 className="text-xl font-bold" style={{ color: styles.text.primary }}>
                      {isEditingParametro ? 'Editar Parámetro' : 'Nuevo Parámetro'}
                    </h3>
                    <button
                      onClick={handleCloseParametroModal}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{
                        color: styles.text.tertiary
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Contenido con scroll */}
                  <div className="overflow-y-auto flex-1 p-6">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Columna Izquierda */}
                      <div className="space-y-5">
                        <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                          Información Básica
                        </h2>

                        {/* Nombre del Parámetro */}
                        <div>
                          <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{ color: styles.text.secondary }}>
                            Nombre del Parámetro <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newParametro.name}
                            onChange={(e) => setNewParametro({ ...newParametro, name: e.target.value })}
                            placeholder="Ej. Correo Adjuntos"
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.primary
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#107ab4';
                              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
                              e.target.style.boxShadow = '';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                            }}
                          />
                        </div>

                        {/* Descripción */}
                        <div>
                          <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{ color: styles.text.secondary }}>
                            Descripción <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={newParametro.description}
                            onChange={(e) => setNewParametro({ ...newParametro, description: e.target.value })}
                            placeholder="Breve descripción del parámetro..."
                            rows={4}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md resize-none"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.primary
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#107ab4';
                              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
                              e.target.style.boxShadow = '';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                            }}
                          />
                        </div>

                        {/* Tipo de Parámetro */}
                        <div>
                          <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{ color: styles.text.secondary }}>
                            Tipo de Parámetro <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newParametro.tipo}
                            onChange={(e) => setNewParametro({ ...newParametro, tipo: e.target.value as TipoParametro })}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md appearance-none cursor-pointer"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.primary
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#107ab4';
                              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
                              e.target.style.boxShadow = '';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                            }}
                          >
                            <option value="texto">Texto</option>
                            <option value="correo">Correo Electrónico</option>
                            <option value="telefono">Teléfono</option>
                            <option value="adjuntar_archivo">Adjuntar Archivo</option>
                            <option value="numero">Número</option>
                            <option value="fecha">Fecha</option>
                            <option value="checkbox">Casilla de Verificación</option>
                          </select>
                        </div>

                        {/* Requerido */}
                        <div className="flex items-center gap-3 pt-2">
                          <input
                            type="checkbox"
                            id="requerido"
                            checked={newParametro.requerido || false}
                            onChange={(e) => setNewParametro({ ...newParametro, requerido: e.target.checked })}
                            className="w-4 h-4 rounded"
                            style={{
                              accentColor: '#107ab4'
                            }}
                          />
                          <label htmlFor="requerido" className="text-xs font-semibold" style={{ color: styles.text.primary }}>
                            Campo requerido
                          </label>
                        </div>
                      </div>

                      {/* Columna Derecha */}
                      <div className="space-y-5">
                        <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                          Configuración del Campo
                        </h2>

                        {/* Etiqueta */}
                        <div>
                          <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{ color: styles.text.secondary }}>
                            Etiqueta (Texto que se mostrará al usuario) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newParametro.etiqueta || ''}
                            onChange={(e) => setNewParametro({ ...newParametro, etiqueta: e.target.value })}
                            placeholder="Ej. Adjuntar archivos, Correo del cliente, etc."
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.primary
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#107ab4';
                              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
                              e.target.style.boxShadow = '';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                            }}
                          />
                        </div>

                        {/* Placeholder */}
                        <div>
                          <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{ color: styles.text.secondary }}>
                            Placeholder (Texto de ayuda)
                          </label>
                          <input
                            type="text"
                            value={newParametro.placeholder || ''}
                            onChange={(e) => setNewParametro({ ...newParametro, placeholder: e.target.value })}
                            placeholder="Ej. Ingrese su correo electrónico..."
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.primary
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#107ab4';
                              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
                              e.target.style.boxShadow = '';
                              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                            }}
                          />
                        </div>

                        {/* Opciones (para checkbox o select) */}
                        {(newParametro.tipo === 'checkbox' || newParametro.tipo === 'texto') && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-semibold tracking-normal" style={{ color: styles.text.secondary }}>
                                Opciones (Opcional)
                              </label>
                              <button
                                type="button"
                                onClick={handleAddOpcion}
                                className="px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                                style={{
                                  backgroundColor: theme === 'dark' ? 'rgba(16, 122, 180, 0.2)' : 'rgba(16, 122, 180, 0.1)',
                                  color: '#107ab4'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(16, 122, 180, 0.3)' : 'rgba(16, 122, 180, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(16, 122, 180, 0.2)' : 'rgba(16, 122, 180, 0.1)';
                                }}
                              >
                                <Plus className="w-3 h-3" />
                                Agregar
                              </button>
                            </div>
                            {newParametro.opciones && newParametro.opciones.length > 0 && (
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {newParametro.opciones.map((opcion, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={opcion}
                                      onChange={(e) => handleUpdateOpcion(index, e.target.value)}
                                      placeholder={`Opción ${index + 1}`}
                                      className="flex-1 px-3 py-2 border rounded-xl text-xs"
                                      style={{
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                                        color: styles.text.primary
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOpcion(index)}
                                      className="p-2 rounded-lg transition-colors"
                                      style={{
                                        color: '#dc2626'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                      {/* Vista Previa - Ancho completo */}
                      <div className="pt-6 border-t" style={{
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}>
                        <h2 className="text-sm font-semibold mb-4 pb-2 border-b" style={{color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                          Vista Previa del Campo
                        </h2>

                        <div className="space-y-2">
                        <label className="block text-sm font-medium" style={{ color: styles.text.secondary }}>
                          {newParametro.etiqueta || 'Etiqueta del campo'}
                          {newParametro.requerido && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {newParametro.tipo === 'adjuntar_archivo' ? (
                          <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{
                            borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
                          }}>
                            <div className="flex flex-col items-center gap-2">
                              <div className="p-3 rounded-full" style={{
                                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
                              }}>
                                <FileText className="w-6 h-6" style={{ color: '#3b82f6' }} />
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-1" style={{ color: styles.text.primary }}>
                                  Arrastra archivos aquí o haz clic para seleccionar
                                </p>
                                <p className="text-xs" style={{ color: styles.text.tertiary }}>
                                  {newParametro.placeholder || 'Formatos permitidos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all mt-2"
                                style={{
                                  backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
                                  color: '#ffffff'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2563eb' : '#1d4ed8';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
                                }}
                              >
                                Seleccionar Archivos
                              </button>
                            </div>
                          </div>
                        ) : newParametro.tipo === 'correo' ? (
                          <input
                            type="email"
                            placeholder={newParametro.placeholder || 'ejemplo@correo.com'}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.tertiary,
                              cursor: 'not-allowed'
                            }}
                          />
                        ) : newParametro.tipo === 'telefono' ? (
                          <input
                            type="tel"
                            placeholder={newParametro.placeholder || '+1234567890'}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.tertiary,
                              cursor: 'not-allowed'
                            }}
                          />
                        ) : newParametro.tipo === 'numero' ? (
                          <input
                            type="number"
                            placeholder={newParametro.placeholder || '0'}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.tertiary,
                              cursor: 'not-allowed'
                            }}
                          />
                        ) : newParametro.tipo === 'fecha' ? (
                          <input
                            type="date"
                            disabled
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.tertiary,
                              cursor: 'not-allowed'
                            }}
                          />
                        ) : newParametro.tipo === 'checkbox' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled
                              className="w-4 h-4 rounded"
                              style={{
                                accentColor: theme === 'dark' ? '#3b82f6' : '#3b82f6',
                                cursor: 'not-allowed'
                              }}
                            />
                            <span className="text-sm" style={{ color: styles.text.secondary }}>
                              {newParametro.etiqueta || 'Opción'}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder={newParametro.placeholder || 'Ingrese texto...'}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                              color: styles.text.tertiary,
                              cursor: 'not-allowed'
                            }}
                          />
                        )}
                          {newParametro.placeholder && newParametro.tipo !== 'adjuntar_archivo' && (
                            <p className="text-xs mt-1" style={{ color: styles.text.tertiary }}>
                              Placeholder: {newParametro.placeholder}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer fijo con botones */}
                  <div className="flex gap-3 justify-end p-6 border-t flex-shrink-0" style={{
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
                  }}>
                    <button
                      onClick={handleCloseParametroModal}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: styles.text.secondary,
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveParametro}
                      className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all"
                      style={{
                        backgroundColor: theme === 'dark' ? '#166534' : '#14532d'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#14532d' : '#0f4c1f';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#166534' : '#14532d';
                      }}
                    >
                      {isEditingParametro ? 'Actualizar' : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Placeholder para otras secciones - se completarán con las siguientes imágenes */}
        {activeTab !== 'configuracion' && activeTab !== 'categorias' && activeTab !== 'estados-flujo' && activeTab !== 'usuarios' && activeTab !== 'asuetos' && activeTab !== 'parametros-finales' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            <p className="text-sm" style={{ color: styles.text.tertiary }}>
              Sección "{tabs.find(t => t.id === activeTab)?.name}" - Pendiente de implementar
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Agregar Asueto - Fuera de los tabs para que siempre se muestre */}
      {pendingHolidayDate && (
        <div 
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${isDeleting ? 'animate-out fade-out duration-500' : 'animate-in fade-in duration-200'}`}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onClick={!isDeleting ? handleCancelAddHoliday : undefined}
        >
          <div 
            className={`rounded-xl border p-6 w-full max-w-md ${isDeleting ? 'animate-out zoom-out-95 duration-500' : 'animate-in zoom-in-95 duration-200'}`}
            style={{
              ...styles.card,
              boxShadow: theme === 'dark' 
                ? '0 8px 24px rgba(0, 0, 0, 0.5)' 
                : '0 8px 24px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              zIndex: 101
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center mb-4">
              <div 
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDeleting ? 'animate-out zoom-out duration-500' : 'animate-in zoom-in duration-300'}`}
                style={{
                  backgroundColor: isDeleting 
                    ? (theme === 'dark' ? 'rgba(153, 27, 27, 0.15)' : 'rgba(153, 27, 27, 0.1)')
                    : (theme === 'dark' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(21, 128, 61, 0.1)'),
                  transition: 'background-color 0.3s ease-out, transform 0.5s ease-out'
                }}
              >
                {isDeleting ? (
                  <Trash2 
                    className="w-8 h-8" 
                    style={{ 
                      color: '#991b1b',
                      animation: 'zoomIn 0.3s ease-out',
                      transform: 'scale(1.1)'
                    }}
                  />
                ) : (
                  <Calendar 
                    className="w-8 h-8" 
                    style={{ 
                      color: theme === 'dark' ? '#16a34a' : '#15803d',
                      transition: 'all 0.3s ease-out'
                    }}
                  />
                )}
              </div>
              <h3 className="text-lg font-bold mb-2 text-center" style={{ 
                color: styles.text.primary,
                transition: 'all 0.3s ease-out',
                transform: isDeleting ? 'scale(0.95)' : 'scale(1)',
                opacity: isDeleting ? 0.8 : 1
              }}>
                {(() => {
                  if (!pendingHolidayDate || !pendingHolidayDate.date) return 'Agregar fecha como asueto';
                  if (isDeleting) return 'Eliminando fecha...';
                  const exists = isDateInHolidays(pendingHolidayDate.date);
                  return exists ? 'Eliminar fecha de asueto' : 'Agregar fecha como asueto';
                })()}
              </h3>
              <div className="text-center mb-4" style={{
                transition: 'all 0.3s ease-out',
                transform: isDeleting ? 'scale(0.95)' : 'scale(1)',
                opacity: isDeleting ? 0.7 : 1
              }}>
                <p className="text-sm mb-2" style={{ color: styles.text.secondary }}>
                  {(() => {
                    if (!pendingHolidayDate || !pendingHolidayDate.date) return '¿Desea agregar la siguiente fecha al calendario de asuetos?';
                    if (isDeleting) return 'La fecha se está eliminando del calendario...';
                    const exists = isDateInHolidays(pendingHolidayDate.date);
                    return exists 
                      ? 'Esta fecha ya está registrada como asueto. ¿Desea eliminarla del calendario?'
                      : '¿Desea agregar la siguiente fecha al calendario de asuetos?';
                  })()}
                </p>
                {pendingHolidayDate && pendingHolidayDate.date && (
                  <p className="text-base font-semibold mb-3" style={{ color: styles.text.primary }}>
                    {formatDateToSpanish(pendingHolidayDate.date)}
                  </p>
                )}
                {pendingHolidayDate && pendingHolidayDate.holidayName && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                    backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.4)'}`
                  }}>
                    <span className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb' }}>
                      🎉 {pendingHolidayDate.holidayName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              {!isDeleting && (
                <button
                  onClick={handleCancelAddHoliday}
                  className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    color: styles.text.secondary,
                    border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleConfirmAddHoliday}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: (() => {
                    if (isDeleting) return '#991b1b';
                    const exists = isDateInHolidays(pendingHolidayDate.date);
                    return exists ? '#991b1b' : (theme === 'dark' ? '#166534' : '#14532d');
                  })(),
                  boxShadow: (() => {
                    if (isDeleting) return '0 4px 12px rgba(153, 27, 27, 0.5)';
                    const exists = isDateInHolidays(pendingHolidayDate.date);
                    return exists 
                      ? '0 2px 6px rgba(153, 27, 27, 0.3)'
                      : (theme === 'dark' 
                        ? '0 2px 6px rgba(22, 101, 52, 0.3)' 
                        : '0 2px 6px rgba(20, 83, 45, 0.3)');
                  })(),
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (isDeleting) return;
                  const exists = isDateInHolidays(pendingHolidayDate.date);
                  e.currentTarget.style.backgroundColor = exists ? '#7f1d1d' : (theme === 'dark' ? '#15803d' : '#166534');
                  e.currentTarget.style.boxShadow = exists
                    ? '0 4px 10px rgba(153, 27, 27, 0.4)'
                    : (theme === 'dark' 
                      ? '0 4px 10px rgba(22, 163, 74, 0.4)' 
                      : '0 4px 10px rgba(21, 128, 61, 0.4)');
                }}
                onMouseLeave={(e) => {
                  if (isDeleting) return;
                  const exists = isDateInHolidays(pendingHolidayDate.date);
                  e.currentTarget.style.backgroundColor = exists ? '#991b1b' : (theme === 'dark' ? '#16a34a' : '#15803d');
                  e.currentTarget.style.boxShadow = exists
                    ? '0 2px 6px rgba(153, 27, 27, 0.3)'
                    : (theme === 'dark' 
                      ? '0 2px 6px rgba(22, 163, 74, 0.3)' 
                      : '0 2px 6px rgba(21, 128, 61, 0.3)');
                }}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {(() => {
                      const dateStr = pendingHolidayDate.date.toISOString().split('T')[0];
                      const exists = isDateInHolidays(pendingHolidayDate.date);
                      return exists ? 'Eliminar' : 'Confirmar';
                    })()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
