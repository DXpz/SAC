
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, Categoria } from '../types';
import { STATE_COLORS } from '../constants';
import { Search, Plus, Filter, ChevronRight, RefreshCw, X, Grid3x3, List, User, Eye, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

const BandejaCasos: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [filtered, setFiltered] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Estados de workflow cargados desde el webhook (incluye flag isFinal)
  const [estados, setEstados] = useState<Array<{ id: string; name: string; order?: number; isFinal?: boolean }>>([]);
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const { theme } = useTheme();

  const navigate = useNavigate();

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

  // Determina si un caso está en un estado final.
  // 1) Usa primero los estados finales específicos del caso (estadosFinales del webhook).
  // 2) Si no hay estadosFinales, usa los estados dinámicos globales del webhook (estados con isFinal).
  // 3) Como último fallback, considera finales RESUELTO y CERRADO del enum CaseStatus.
  const isEstadoFinal = React.useCallback(
    (caso: Case | any): boolean => {
      if (!caso) return false;
      const raw = String(((caso as any).status || (caso as any).estado) ?? '').trim();
      if (!raw) return false;

      // 1) Revisar estadosFinales que vienen en el propio caso desde el webhook
      const estadosFinales = ((caso as any).estadosFinales || []) as any[];
      if (Array.isArray(estadosFinales) && estadosFinales.length > 0) {
        const normalizedRaw = raw.toLowerCase().replace(/\s+/g, '_');

        const estadoFinalEncontrado = estadosFinales.find((ef: any) => {
          if (!ef || ef.estado_final !== true) return false;

          const id = String(ef.id ?? '').trim();
          const nombre = String(ef.nombre ?? ef.name ?? '').trim();

          const idNorm = id.toLowerCase().replace(/\s+/g, '_');
          const nombreNorm = nombre.toLowerCase().replace(/\s+/g, '_');

          return (
            id === raw ||
            nombre === raw ||
            idNorm === normalizedRaw ||
            nombreNorm === normalizedRaw
          );
        });

        if (estadoFinalEncontrado) {
          return true;
        }
      }

      // 2) Si tenemos estados globales del webhook, utilizar su flag isFinal
      if (estados && estados.length > 0) {
        const normalizedRaw = raw.toLowerCase().replace(/\s+/g, '_');

        const estadoDelCaso = estados.find((e) => {
          const idNorm = String(e.id ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
          const nameNorm = String(e.name ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
          return idNorm === normalizedRaw || nameNorm === normalizedRaw;
        });

        if (estadoDelCaso) {
          return estadoDelCaso.isFinal === true;
        }
      }

      // Fallback: usar los estados finales del enum
      const normalizedStatus = normalizeStatus(raw);
      return (
        normalizedStatus === CaseStatus.RESUELTO ||
        normalizedStatus === CaseStatus.CERRADO
      );
    },
    [estados]
  );

  const formatCountry = (value?: string) => {
    if (!value) return 'N/A';
    const normalized = value.toString().trim().toUpperCase();
    if (!normalized) return 'N/A';
    if (normalized === 'SV' || normalized === 'GT') return normalized;
    if (normalized === 'EL SALVADOR' || normalized === 'EL_SALVADOR' || normalized === 'ELSALVADOR') return 'SV';
    if (normalized === 'GUATEMALA') return 'GT';
    return value;
  };

  const getCaseCountry = (caso: Case) => {
    const rawCountry = (caso as any).pais || (caso as any).country || caso.cliente?.pais;
    return formatCountry(rawCountry);
  };

  // Función helper para obtener y normalizar el país del agente
  const getAgentCountry = async (): Promise<'SV' | 'GT' | null> => {
    try {
      // Primero intentar desde api.getUser() que puede tener datos más actualizados
      const currentUser = api.getUser();
      let pais = currentUser?.pais || '';
      
      // Si el país es string vacío, tratarlo como undefined
      if (pais && String(pais).trim() !== '') {
        const paisNormalizado = String(pais).trim().toUpperCase();
        
        if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
          return 'SV';
        }
        if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
          return 'GT';
        }
      }
      
      // Fallback: leer desde localStorage directamente
      const userStr = localStorage.getItem('intelfon_user');
      if (!userStr) {
        return null;
      }
      
      const user = JSON.parse(userStr);
      pais = user.pais || user.country || '';
      
      // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
      if (!pais || String(pais).trim() === '') {
        try {
          const usuarios = await api.getUsuarios();
          const usuarioCompleto = usuarios.find((u: any) => 
            u.id === user.id || 
            u.idAgente === user.id || 
            u.id_agente === user.id ||
            u.id_usuario === user.id ||
            u.email === user.email ||
            (u.nombre && u.nombre.toUpperCase() === user.name.toUpperCase())
          );
          
          if (usuarioCompleto) {
            pais = usuarioCompleto.pais || usuarioCompleto.country || usuarioCompleto.país || '';
            if (pais && String(pais).trim() !== '') {
              const updatedUser = { ...user, pais: pais };
              localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
            }
          }
        } catch (error) {
        }
      }
      
      // Validar que el país no sea string vacío
      if (!pais || String(pais).trim() === '') {
        return null;
      }
      
      // Normalizar a códigos de 2 letras
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      // El Salvador: SV, El_Salvador, El Salvador, etc.
      if (paisNormalizado === 'SV' || 
          paisNormalizado === 'EL_SALVADOR' || 
          paisNormalizado === 'EL SALVADOR' ||
          paisNormalizado.includes('SALVADOR')) {
        return 'SV';
      }
      if (paisNormalizado === 'GT' || 
          paisNormalizado === 'GUATEMALA' ||
          paisNormalizado.includes('GUATEMALA')) {
        return 'GT';
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Función helper para normalizar el país de un caso
  const normalizeCaseCountry = (pais: string | undefined): 'SV' | 'GT' | null => {
    // Si no hay país o es string vacío, retornar null
    if (!pais || String(pais).trim() === '') {
      return null;
    }
    
    const paisNormalizado = String(pais).trim().toUpperCase();
    
    // El Salvador
    if (paisNormalizado === 'SV' || 
        paisNormalizado === 'EL_SALVADOR' || 
        paisNormalizado === 'EL SALVADOR' ||
        paisNormalizado.includes('SALVADOR')) {
      return 'SV';
    }
    
    // Guatemala
    if (paisNormalizado === 'GT' || 
        paisNormalizado === 'GUATEMALA' ||
        paisNormalizado.includes('GUATEMALA')) {
      return 'GT';
    }
    
    return null;
  };

  // Función para obtener colores del badge de estado (como en Admin de usuarios)
  const getStatusBadgeStyle = (status: CaseStatus): { bg: string; text: string; border: string } => {
    const dark: Record<CaseStatus, { bg: string; text: string; border: string }> = {
      [CaseStatus.NUEVO]: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
      [CaseStatus.EN_PROCESO]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
      [CaseStatus.PENDIENTE_CLIENTE]: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
      [CaseStatus.ESCALADO]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
      [CaseStatus.RESUELTO]: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
      [CaseStatus.CERRADO]: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' }
    };
    const light: Record<CaseStatus, { bg: string; text: string; border: string }> = {
      [CaseStatus.NUEVO]: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
      [CaseStatus.EN_PROCESO]: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      [CaseStatus.PENDIENTE_CLIENTE]: { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
      [CaseStatus.ESCALADO]: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
      [CaseStatus.RESUELTO]: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      [CaseStatus.CERRADO]: { bg: '#f1f5f9', text: '#334155', border: '#64748b' }
    };
    const style = theme === 'dark' ? dark[status] : light[status];
    return style || (theme === 'dark' ? { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' } : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' });
  };

  // Badge estilo para empresa (SV / GT)
  const getEmpresaBadgeStyle = (paisCode: string): { bg: string; text: string; border: string } => {
    if (paisCode === 'SV') return theme === 'dark' ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' } : { bg: '#dbeafe', text: '#1d4ed8', border: '#3b82f6' };
    if (paisCode === 'GT') return theme === 'dark' ? { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' } : { bg: '#dcfce7', text: '#166534', border: '#22c55e' };
    return theme === 'dark' ? { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' } : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  // Badge estilo para categoría
  const getCategoriaBadgeStyle = (): { bg: string; text: string; border: string } => {
    return theme === 'dark' ? { bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' } : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  // Cargar estados de workflow (incluidos los estados finales) desde el webhook
  useEffect(() => {
    let isMounted = true;

    const loadEstados = async () => {
      if (typeof (api as any).readEstados !== 'function') {
        return;
      }
      try {
        const estadosResponse = await (api as any).readEstados();
        if (isMounted && Array.isArray(estadosResponse)) {
          setEstados(estadosResponse as Array<{ id: string; name: string; order?: number; isFinal?: boolean }>);
        }
      } catch (e) {
        // Si falla, simplemente usaremos el fallback basado en CaseStatus
      }
    };

    loadEstados();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cargar datos iniciales en secuencia
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Primero cargar clientes y categorías
        await Promise.all([loadClientes(), loadCategorias()]);
        // Luego cargar casos
        await loadCasos();
      } catch (err) {
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Enriquecer casos cuando se cargan clientes, categorías o casos
  useEffect(() => {
    if (casos.length === 0) {
      return; // No hay casos que enriquecer
    }
    
    // Solo enriquecer si tenemos clientes o categorías disponibles
    if (clientes.length === 0 && categorias.length === 0) {
      return;
    }
    
    // Verificar si hay casos que necesitan enriquecimiento
    const casosNecesitanEnriquecimiento = casos.some(caso => {
      const needsClient = caso.clientId && (!caso.clientName || (typeof caso.clientName === 'string' && caso.clientName.trim() === '') || !caso.cliente);
      const needsCategory = caso.categoria?.idCategoria && (!caso.category || caso.category === 'General');
      return needsClient || needsCategory;
    });
    
    if (!casosNecesitanEnriquecimiento) {
      return; // Todos los casos ya están enriquecidos
    }
    
    const casosEnriquecidos = casos.map(caso => {
      let casoActualizado = { ...caso };
      
      // Preservar datos críticos que no deben perderse
      const preservedTicketNumber = caso.ticketNumber || (caso as any).idCaso || caso.id;
      const preservedClientId = caso.clientId || caso.cliente?.idCliente;
      const preservedClientName = caso.clientName || caso.cliente?.nombreEmpresa;
      
      // Enriquecer con cliente completo solo si no lo tiene o está vacío
      if (clientes.length > 0 && preservedClientId) {
        const needsClientEnrichment = !caso.cliente || !caso.clientName || (typeof caso.clientName === 'string' && caso.clientName.trim() === '') || caso.clientName === 'Por definir';
        
        if (needsClientEnrichment) {
          // Normalizar el ID del caso para comparación
          const normalizeId = (id: string) => {
            if (!id) return '';
            // Remover espacios y convertir a mayúsculas
            let normalized = id.trim().toUpperCase();
            // Si no empieza con CL, agregarlo
            if (!normalized.startsWith('CL')) {
              normalized = 'CL' + normalized.replace(/^CL/i, '');
            }
            // Normalizar ceros a la izquierda: CL1 -> CL000001, CL001 -> CL000001
            const match = normalized.match(/^CL0*(\d+)$/);
            if (match) {
              const num = match[1];
              normalized = 'CL' + num.padStart(6, '0');
            }
            return normalized;
          };
          
          const casoClientIdNormalized = normalizeId(caso.clientId);
          
          // Buscar cliente con múltiples estrategias
          const clienteCompleto = clientes.find(cli => {
            const cliIdNormalized = normalizeId(cli.idCliente);
            
            // Comparación exacta normalizada
            if (casoClientIdNormalized === cliIdNormalized) return true;
            
            // Comparación directa
            if (cli.idCliente === caso.clientId) return true;
            
            // Comparación numérica (solo números)
            const casoNum = caso.clientId.replace(/\D/g, '');
            const cliNum = cli.idCliente.replace(/\D/g, '');
            if (casoNum && cliNum && casoNum === cliNum) return true;
            
            return false;
          });
          
          if (clienteCompleto) {
            // Preservar clientName si ya existe y es válido, sino usar el del cliente completo
            casoActualizado = {
              ...casoActualizado,
              clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Por definir') ? caso.clientName : clienteCompleto.nombreEmpresa,
              clientId: clienteCompleto.idCliente || caso.clientId || preservedClientId,
              cliente: clienteCompleto,
              clientEmail: caso.clientEmail || clienteCompleto.email,
              clientPhone: caso.clientPhone || clienteCompleto.telefono,
              // Preservar ticketNumber
              ticketNumber: caso.ticketNumber || preservedTicketNumber,
              id: caso.id || preservedTicketNumber,
            };
          } else {
            // Si no se encuentra el cliente, preservar al menos los datos existentes
            casoActualizado = {
              ...casoActualizado,
              clientId: caso.clientId || preservedClientId || 'N/A',
              clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Por definir') ? caso.clientName : preservedClientName || 'Por definir',
              ticketNumber: caso.ticketNumber || preservedTicketNumber,
              id: caso.id || preservedTicketNumber,
            };
          }
        } else {
          // Si no necesita enriquecimiento, asegurar que los datos críticos estén presentes
          casoActualizado = {
            ...casoActualizado,
            ticketNumber: caso.ticketNumber || preservedTicketNumber,
            id: caso.id || preservedTicketNumber,
            clientId: caso.clientId || preservedClientId || 'N/A',
            clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Por definir') ? caso.clientName : preservedClientName || 'Por definir',
          };
        }
      } else {
        // Si no hay clientId, preservar al menos ticketNumber
        casoActualizado = {
          ...casoActualizado,
          ticketNumber: caso.ticketNumber || preservedTicketNumber,
          id: caso.id || preservedTicketNumber,
        };
      }
      
      // Enriquecer con categoría completa
      if (categorias.length > 0) {
        const categoriaId = caso.categoria?.idCategoria || (caso as any).categoria_id || (caso as any).categoriaId;
        
        if (categoriaId) {
          const categoriaCompleta = categorias.find(cat => 
            String(cat.idCategoria) === String(categoriaId)
          );
          
          if (categoriaCompleta) {
            // Actualizar si el nombre es diferente o está vacío
            if (!caso.category || caso.category === 'General' || caso.category !== categoriaCompleta.nombre) {
              casoActualizado = {
                ...casoActualizado,
                category: categoriaCompleta.nombre,
                categoria: categoriaCompleta,
              };
            }
          }
        }
      }
      
      return casoActualizado;
    });
    
    // Solo actualizar si hubo cambios reales
    const hasChanges = casosEnriquecidos.some((caso, idx) => {
      const original = casos[idx];
      return (
        caso.clientName !== original.clientName ||
        caso.clientId !== original.clientId ||
        caso.cliente?.idCliente !== original.cliente?.idCliente ||
        caso.category !== original.category ||
        caso.categoria?.idCategoria !== original.categoria?.idCategoria
      );
    });
    
    if (hasChanges) {
      setCasos(casosEnriquecidos);
    }
  }, [casos, clientes, categorias]); // Incluir casos para que se ejecute cuando se cargan nuevos casos

  const loadClientes = async () => {
    try {
    const data = await api.getClientes();
    setClientes(data);
      return data;
    } catch (err) {
      return [];
    }
  };

  const loadCategorias = async () => {
    try {
      const data = await api.getCategorias();
      setCategorias(data);
      return data;
    } catch (err) {
      return [];
    }
  };

  const loadCasos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      // Guardar casos directamente, el useEffect de enriquecimiento se ejecutará automáticamente
      setCasos(data);
      
      const updateTime = new Date();
      setLastUpdate(updateTime);
      // Guardar en localStorage para que Layout pueda mostrarlo
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
      
      return data;
    } catch (err: any) {
      setError(err.message || 'Error al cargar los casos desde el servidor. Por favor, intenta nuevamente.');
      setCasos([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const processCases = async () => {
      // Obtener usuario autenticado
      const currentUser = api.getUser();
      const isAgente = currentUser?.role === 'AGENTE';
      
      // IMPORTANTE: Si es agente, getCases() usa case.agent que YA retorna solo los casos del agente
      // El webhook case.agent filtra automáticamente por agente_user_id
      // PERO ahora también necesitamos filtrar por país del agente
      let casosParaFiltrar = casos;
      if (isAgente) {
        const agentCountry = await getAgentCountry();
        if (agentCountry) {
          casosParaFiltrar = casos.filter(caso => {
            const casoPais = (caso as any).pais || 
                            caso.cliente?.pais || 
                            (caso as any).country ||
                            '';
            const casoPaisNormalizado = normalizeCaseCountry(casoPais);
            if (!casoPaisNormalizado) {
              return false;
            }
            return casoPaisNormalizado === agentCountry;
          });
        } else {
          casosParaFiltrar = [];
        }
      }
      // Filtrar fuera los casos que están en un estado final (dinámico)
      casosParaFiltrar = casosParaFiltrar.filter((caso) => !isEstadoFinal(caso as any));

      // Aplicar filtros de búsqueda, estado y categoría
      const term = searchTerm.toLowerCase();
      let result = casosParaFiltrar.filter(c => {
        const id = (c.id || c.ticketNumber || '').toLowerCase();
        const client = (c.clientName || '').toLowerCase();
        const subject = (c.subject || '').toLowerCase();
        
        return id.includes(term) || client.includes(term) || subject.includes(term);
      });

      if (statusFilter !== 'all') {
        result = result.filter(c => {
          const rawStatus = c.status || (c as any).estado;
          const normalizedStatus = normalizeStatus(rawStatus);
          return normalizedStatus === statusFilter;
        });
      }

      if (categoriaFilter !== 'all') {
        result = result.filter(c => {
          const categoriaId = c.categoria?.idCategoria || (c as any).categoria_id || (c as any).categoriaId;
          return String(categoriaId) === String(categoriaFilter) || c.category === categoriaFilter;
        });
      }

      setFiltered(result);
      setCurrentPage(1); // Resetear a primera página cuando cambien los filtros
    };
    
    processCases();
  }, [searchTerm, statusFilter, categoriaFilter, casos, isEstadoFinal]);

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
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    },
    input: {
      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedCasos = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6" style={styles.container}>
      <div 
        className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 rounded-xl border flex-shrink-0 flex flex-col gap-3"
        style={{
          ...styles.card,
          animation: 'fadeInSlide 0.3s ease-out'
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{color: styles.text.tertiary}} />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente o Asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-5 py-3 border rounded-2xl focus:outline-none focus:ring-4 transition-all text-xs font-medium shadow-sm hover:shadow-md"
            style={{
              ...styles.input,
              '--tw-ring-color': 'var(--color-accent-blue)',
              '--tw-ring-opacity': '0.2'
            } as React.CSSProperties & { '--tw-ring-color': string, '--tw-ring-opacity': string }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-accent-blue)';
              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
              e.target.style.backgroundColor = theme === 'dark' ? '#020617' : '#ffffff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = styles.input.borderColor;
              e.target.style.boxShadow = '';
              e.target.style.backgroundColor = styles.input.backgroundColor;
            }}
          />
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <div className="relative group" style={{ animation: 'fadeInSlide 0.3s ease-out 0.1s both' }}>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors z-10" style={{color: statusFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: statusFilter === 'all' 
                  ? (theme === 'dark' ? '#020617' : '#ffffff')
                  : '#e0f2fe',
                borderColor: statusFilter === 'all' 
                  ? (theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1')
                  : '#107ab4',
                color: statusFilter === 'all' 
                  ? styles.text.secondary
                  : '#0c4a6e',
                minWidth: '190px',
                boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)',
                transform: 'scale(1)',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                if (statusFilter === 'all') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : '#94a3b8';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                } else {
                  e.currentTarget.style.backgroundColor = '#bae6fd';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 122, 180, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                if (statusFilter === 'all') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#020617' : '#ffffff';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                } else {
                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 122, 180, 0.15)';
                }
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#107ab4';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.15), 0 2px 4px rgba(16, 122, 180, 0.2)';
                e.target.style.backgroundColor = statusFilter === 'all' 
                  ? (theme === 'dark' ? '#0f172a' : '#f8fafc')
                  : '#bae6fd';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = statusFilter === 'all' 
                  ? (theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1')
                  : '#107ab4';
                e.target.style.boxShadow = statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)';
                e.target.style.backgroundColor = statusFilter === 'all' 
                  ? (theme === 'dark' ? '#020617' : '#ffffff')
                  : '#e0f2fe';
              }}
            >
              <option value="all">Todos los Estados</option>
              {Object.values(CaseStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-200" style={{
              color: statusFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>
          
          <div className="relative group" style={{ animation: 'fadeInSlide 0.3s ease-out 0.15s both' }}>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors z-10" style={{color: categoriaFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: categoriaFilter === 'all' 
                  ? (theme === 'dark' ? '#020617' : '#ffffff')
                  : '#e0f2fe',
                borderColor: categoriaFilter === 'all' 
                  ? (theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1')
                  : '#107ab4',
                color: categoriaFilter === 'all' 
                  ? styles.text.secondary
                  : '#0c4a6e',
                minWidth: '190px',
                boxShadow: categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)',
                transform: 'scale(1)',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                if (categoriaFilter === 'all') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : '#94a3b8';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                } else {
                  e.currentTarget.style.backgroundColor = '#bae6fd';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 122, 180, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                if (categoriaFilter === 'all') {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#020617' : '#ffffff';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                } else {
                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 122, 180, 0.15)';
                }
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#107ab4';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.15), 0 2px 4px rgba(16, 122, 180, 0.2)';
                e.target.style.backgroundColor = categoriaFilter === 'all' 
                  ? (theme === 'dark' ? '#0f172a' : '#f8fafc')
                  : '#bae6fd';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = categoriaFilter === 'all' 
                  ? (theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1')
                  : '#107ab4';
                e.target.style.boxShadow = categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)';
                e.target.style.backgroundColor = categoriaFilter === 'all' 
                  ? (theme === 'dark' ? '#020617' : '#ffffff')
                  : '#e0f2fe';
              }}
            >
              <option value="all">Todas las Categorías</option>
              {categorias.map(cat => (
                <option key={cat.idCategoria} value={cat.idCategoria}>
                  {cat.nombre}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-200" style={{color: categoriaFilter === 'all' ? styles.text.tertiary : '#107ab4', transform: 'rotate(90deg)'}} />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Controles de vista */}
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
            
            <button 
              onClick={() => navigate('/app/casos/nuevo')}
              className="text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
                transform: 'scale(1)',
                transition: 'all 0.2s ease-in-out',
                animation: 'fadeInSlide 0.3s ease-out 0.2s both'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(200, 21, 27, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 21, 27, 0.2)';
              }}
            >
              <Plus className="w-5 h-5" /> Nuevo Caso
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingScreen message="Cargando Bandeja de Casos..." />
      ) : error ? (
        <div className="rounded-xl border p-12 text-center" style={{
          ...styles.card,
          borderColor: 'rgba(200, 21, 27, 0.3)'
        }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor: 'rgba(200, 21, 27, 0.2)'}}>
            <X className="w-10 h-10" style={{color: '#f87171'}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>Error al cargar casos</h3>
          <p className="text-sm mb-4" style={{color: '#ef4444'}}>{error}</p>
          <button
            onClick={loadCasos}
            className="px-6 py-2 rounded-lg font-semibold transition-colors"
            style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))', color: '#ffffff'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-accent-red), var(--color-brand-red))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))';
            }}
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{...styles.card}}>
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
          }}>
            <Search className="w-12 h-12" style={{color: styles.text.tertiary}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>No se encontraron casos</h3>
          <p className="text-sm font-medium" style={{color: styles.text.secondary}}>
            {casos.length === 0 
              ? 'No hay casos registrados en el sistema'
              : 'Intenta ajustar los filtros de búsqueda'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div 
          className="rounded-xl border overflow-hidden" 
          style={{
            ...styles.card,
            animation: 'fadeInSlide 0.3s ease-out 0.1s both'
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{borderCollapse: 'separate', borderSpacing: 0}}>
              <thead>
                <tr style={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  animation: 'fadeInSlide 0.3s ease-out'
                }}>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>ID Caso</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCasos.map((caso, idx) => (
                  <tr 
                    key={caso.id} 
                    className="hover:opacity-90 transition-opacity cursor-pointer"
                    style={{
                      backgroundColor: idx % 2 === 0 
                        ? (theme === 'dark' ? '#020617' : '#ffffff')
                        : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                      borderBottom: idx < paginatedCasos.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                      animation: `fadeInSlide 0.3s ease-out ${idx * 0.03}s both`,
                      transform: 'translateY(0)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(2px)';
                      e.currentTarget.style.transition = 'transform 0.2s ease-in-out';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }} 
                    onClick={() => navigate(`/app/casos/${caso.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold transition-colors" style={{color: styles.text.primary}}>{caso.ticketNumber || (caso as any).idCaso}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span 
                          className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                          style={{
                            backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.12)' : '#dbeafe',
                            color: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
                            borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd',
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
                          {caso.clientId || caso.cliente?.idCliente || 'N/A'}
                        </span>
                        <span className="text-xs font-semibold" style={{color: styles.text.primary}}>
                          {caso.clientName || caso.cliente?.nombreEmpresa || 'Por definir'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const pais = (caso as any).pais || caso.cliente?.pais || '';
                        const paisNormalizado = pais ? String(pais).trim().toUpperCase() : '';
                        let paisCode = '';
                        
                        if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
                          paisCode = 'SV';
                        } else if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
                          paisCode = 'GT';
                        } else if (pais) {
                          paisCode = paisNormalizado.substring(0, 2);
                        }
                        
                        if (!paisCode) {
                          return (
                            <span className="text-xs" style={{color: styles.text.tertiary}}>
                              N/A
                            </span>
                          );
                        }
                        const empresaStyle = getEmpresaBadgeStyle(paisCode);
                        return (
                          <span 
                            className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                            style={{
                              backgroundColor: empresaStyle.bg,
                              color: empresaStyle.text,
                              borderColor: empresaStyle.border,
                              transform: 'scale(1)',
                              transition: 'all 0.2s ease-in-out',
                              minWidth: '32px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title={paisNormalizado === 'SV' ? 'El Salvador' : paisNormalizado === 'GT' ? 'Guatemala' : pais}
                          >
                            {paisCode}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const catStyle = getCategoriaBadgeStyle();
                        return (
                          <span 
                            className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                            style={{
                              backgroundColor: catStyle.bg,
                              color: catStyle.text,
                              borderColor: catStyle.border,
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
                            {caso.category || caso.categoria?.nombre}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const rawStatus = caso.status || (caso as any).estado;
                        const normalizedStatus = normalizeStatus(rawStatus);
                        const badgeStyle = getStatusBadgeStyle(normalizedStatus);
                        return (
                          <span 
                            className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all uppercase tracking-wide"
                            style={{
                              backgroundColor: badgeStyle.bg,
                              color: badgeStyle.text,
                              borderColor: badgeStyle.border,
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <div 
                          className="p-2 rounded-lg transition-all"
                          style={{
                            backgroundColor: 'transparent',
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <ChevronRight 
                            className="w-5 h-5 transition-all" 
                            style={{
                              color: styles.text.tertiary,
                              transform: 'translateX(0)',
                              transition: 'all 0.2s ease-in-out'
                            }} 
                            onMouseEnter={(e) => { 
                              e.currentTarget.style.color = styles.text.secondary; 
                              e.currentTarget.style.transform = 'translateX(4px)'; 
                            }} 
                            onMouseLeave={(e) => { 
                              e.currentTarget.style.color = styles.text.tertiary; 
                              e.currentTarget.style.transform = 'translateX(0)'; 
                            }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vista de Tarjetas */
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          style={{
            animation: 'fadeInSlide 0.4s ease-out 0.1s both'
          }}
        >
          {paginatedCasos.map((caso, idx) => {
            const rawStatus = caso.status || (caso as any).estado;
            const normalizedStatus = normalizeStatus(rawStatus);
            const statusColor = (() => {
              if (normalizedStatus === CaseStatus.NUEVO) return '#2563eb';
              if (normalizedStatus === CaseStatus.EN_PROCESO) return '#d97706';
              if (normalizedStatus === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
              if (normalizedStatus === CaseStatus.ESCALADO) return '#dc2626';
              if (normalizedStatus === CaseStatus.RESUELTO) return '#16a34a';
              if (normalizedStatus === CaseStatus.CERRADO) return '#64748b';
              return '#475569';
            })();
            
            // Calcular días abiertos
            const createdAt = caso.createdAt ? new Date(caso.createdAt) : null;
            const diasAbierto = createdAt 
              ? Math.floor((new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            
            return (
              <div
                key={caso.id}
                className="rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                style={{
                  ...styles.card,
                  borderLeftWidth: '4px',
                  borderLeftColor: statusColor,
                  animation: `fadeInSlide 0.3s ease-out ${0.15 + idx * 0.05}s both`
                }}
                onClick={() => navigate(`/app/casos/${caso.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                }}
              >
                {/* Header con ID y Estado */}
                <div className="p-4 border-b" style={{
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
                  borderColor: 'rgba(148, 163, 184, 0.2)'
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black" style={{color: styles.text.primary}}>
                      #{caso.ticketNumber || (caso as any).idCaso || caso.id}
                    </span>
                    <span 
                      className="text-[10px] font-semibold uppercase tracking-wide transition-all"
                      style={{
                        color: statusColor,
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
                  </div>
                  <h3 className="text-sm font-bold line-clamp-2" style={{color: styles.text.primary}}>
                    {caso.subject || 'Sin asunto'}
                  </h3>
                </div>
                
                {/* Contenido */}
                <div className="p-4 space-y-3">
                  {/* Cliente */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Cliente:</span>
                    <span className="text-xs font-bold flex-1 truncate" style={{color: styles.text.primary}}>
                      {caso.clientName || caso.cliente?.nombreEmpresa || 'Por definir'}
                    </span>
                  </div>
                  
                  {/* Categoría */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Categoría:</span>
                    <span 
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: styles.text.secondary,
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}
                    >
                      {caso.category || caso.categoria?.nombre || 'General'}
                    </span>
                  </div>

                  {/* Empresa */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Empresa:</span>
                    <span 
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: styles.text.secondary,
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}
                    >
                      {getCaseCountry(caso)}
                    </span>
                  </div>
                  
                  {/* Agente y Tiempo */}
                  <div className="flex items-center justify-between pt-2 border-t" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                    <div className="flex items-center gap-1.5">
                      {caso.agentName ? (
                        <>
                          <User className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
                          <span className="text-xs truncate max-w-[100px]" style={{color: styles.text.primary}}>
                            {caso.agentName}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs italic" style={{color: styles.text.tertiary}}>
                          Sin asignar
                        </span>
                      )}
                    </div>
                    {diasAbierto > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
                        <span className="text-[10px] font-semibold" style={{color: styles.text.tertiary}}>
                          {diasAbierto}d
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer con acción */}
                <div className="p-3 border-t flex items-center justify-end" style={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  borderColor: 'rgba(148, 163, 184, 0.2)'
                }}>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" style={{color: styles.text.tertiary}} />
                    <span className="text-[10px] font-semibold" style={{color: styles.text.secondary}}>
                      Ver detalle
                    </span>
                    <ChevronRight className="w-4 h-4" style={{color: styles.text.tertiary}} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 rounded-xl border" style={{...styles.card}}>
          <p className="text-xs font-medium" style={{color: styles.text.tertiary}}>
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} casos
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed border"
              style={{
                borderColor: 'rgba(148,163,184,0.3)',
                color: styles.text.secondary,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = totalPages <= 7
                ? i + 1
                : currentPage <= 4
                  ? i + 1
                  : currentPage >= totalPages - 3
                    ? totalPages - 6 + i
                    : currentPage - 3 + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                  style={{
                    backgroundColor: currentPage === page ? '#c8151b' : 'transparent',
                    color: currentPage === page ? '#ffffff' : styles.text.secondary,
                    border: currentPage === page ? 'none' : '1px solid rgba(148,163,184,0.2)'
                  }}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed border"
              style={{
                borderColor: 'rgba(148,163,184,0.3)',
                color: styles.text.secondary,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BandejaCasos;
