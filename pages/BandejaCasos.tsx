
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
          console.log('[BandejaCasos] ✅ País del agente desde api.getUser(): SV');
          return 'SV';
        }
        if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
          console.log('[BandejaCasos] ✅ País del agente desde api.getUser(): GT');
          return 'GT';
        }
      }
      
      // Fallback: leer desde localStorage directamente
      const userStr = localStorage.getItem('intelfon_user');
      if (!userStr) {
        console.error('[BandejaCasos] No se encontró usuario en localStorage');
        return null;
      }
      
      const user = JSON.parse(userStr);
      pais = user.pais || user.country || '';
      
      // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
      if (!pais || String(pais).trim() === '') {
        console.log('[BandejaCasos] 🔍 País no encontrado en localStorage, buscando en lista de usuarios...');
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
            console.log('[BandejaCasos] ✅ País encontrado en lista de usuarios:', {
              usuarioId: usuarioCompleto.id || usuarioCompleto.idAgente,
              usuarioNombre: usuarioCompleto.nombre || usuarioCompleto.name,
              pais: pais
            });
            
            // Si encontramos el país, actualizar el usuario en localStorage
            if (pais && String(pais).trim() !== '') {
              const updatedUser = { ...user, pais: pais };
              localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
              console.log('[BandejaCasos] ✅ País actualizado en localStorage');
            }
          } else {
            console.warn('[BandejaCasos] ⚠️ Usuario no encontrado en lista de usuarios');
          }
        } catch (error) {
          console.error('[BandejaCasos] Error obteniendo lista de usuarios:', error);
        }
      }
      
      // Validar que el país no sea string vacío
      if (!pais || String(pais).trim() === '') {
        console.error('[BandejaCasos] ⚠️ Agente NO tiene país definido!', user);
        return null;
      }
      
      // Normalizar a códigos de 2 letras
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      // El Salvador: SV, El_Salvador, El Salvador, etc.
      if (paisNormalizado === 'SV' || 
          paisNormalizado === 'EL_SALVADOR' || 
          paisNormalizado === 'EL SALVADOR' ||
          paisNormalizado.includes('SALVADOR')) {
        console.log('[BandejaCasos] ✅ País normalizado: SV');
        return 'SV';
      }
      
      // Guatemala: GT, Guatemala, etc.
      if (paisNormalizado === 'GT' || 
          paisNormalizado === 'GUATEMALA' ||
          paisNormalizado.includes('GUATEMALA')) {
        console.log('[BandejaCasos] ✅ País normalizado: GT');
        return 'GT';
      }
      
      console.error('[BandejaCasos] ⚠️ País no reconocido:', paisNormalizado);
      return null;
    } catch (error) {
      console.error('[BandejaCasos] ❌ Error obteniendo país del agente:', error);
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

  // Función para obtener los colores del estado
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
      
      console.log('[BandejaCasos] Casos recibidos de getCases():', {
        total: data.length,
        casos: data.slice(0, 3).map(c => ({
          id: c.id,
          ticketNumber: c.ticketNumber,
          agente_user_id: (c as any).agente_user_id,
          agentId: c.agentId,
          agenteAsignado: c.agenteAsignado?.idAgente
        }))
      });
      
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
      
      console.log('[BandejaCasos] Procesando casos:', {
        isAgente: isAgente,
        totalCasos: casos.length,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        primerosCasos: casos.slice(0, 3).map(c => ({
          id: c.id,
          ticketNumber: c.ticketNumber,
          agente_user_id: (c as any).agente_user_id,
          agentId: c.agentId
        }))
      });
      
      // Si es AGENTE, filtrar casos por país del agente (OBLIGATORIO)
      if (isAgente) {
        const agentCountry = await getAgentCountry();
        
        console.log('[BandejaCasos] Agente detectado, país del agente:', agentCountry);
        
        if (agentCountry) {
          console.log('[BandejaCasos] Filtrando casos por país del agente:', agentCountry);
          
          casosParaFiltrar = casos.filter(caso => {
            // Obtener el país del caso desde diferentes fuentes posibles
            const casoPais = (caso as any).pais || 
                            caso.cliente?.pais || 
                            (caso as any).country ||
                            '';
            
            console.log('[BandejaCasos] 🔍 Verificando caso:', {
              casoId: caso.id,
              casoTicket: caso.ticketNumber,
              casoPaisRaw: casoPais,
              casoCompleto: caso
            });
            
            const casoPaisNormalizado = normalizeCaseCountry(casoPais);
            
            console.log('[BandejaCasos] 🔍 País normalizado del caso:', {
              casoId: caso.id,
              casoTicket: caso.ticketNumber,
              casoPaisRaw: casoPais,
              casoPaisNormalizado: casoPaisNormalizado,
              agentCountry: agentCountry
            });
            
            // Si el caso no tiene país definido, NO mostrarlo al agente
            if (!casoPaisNormalizado) {
              console.log('[BandejaCasos] ❌ Caso SIN país definido, FILTRANDO:', {
                casoId: caso.id,
                casoTicket: caso.ticketNumber,
                casoPais: casoPais
              });
              return false;
            }
            
            // Solo mostrar casos del mismo país que el agente
            const matches = casoPaisNormalizado === agentCountry;
            
            if (!matches) {
              console.log('[BandejaCasos] ❌ Caso filtrado por país (NO coincide):', {
                casoId: caso.id,
                casoTicket: caso.ticketNumber,
                casoPais: casoPais,
                casoPaisNormalizado: casoPaisNormalizado,
                agentCountry: agentCountry,
                matches: false
              });
              return false;
            }
            
            console.log('[BandejaCasos] ✅ Caso ACEPTADO (país coincide):', {
              casoId: caso.id,
              casoTicket: caso.ticketNumber,
              casoPais: casoPais,
              casoPaisNormalizado: casoPaisNormalizado,
              agentCountry: agentCountry,
              matches: true
            });
            
            return true;
          });
          
          console.log('[BandejaCasos] 📊 RESUMEN - Casos después de filtrar por país:', {
            totalAntes: casos.length,
            totalDespues: casosParaFiltrar.length,
            agentCountry: agentCountry,
            casosFiltrados: casosParaFiltrar.map(c => ({ 
              id: c.id, 
              ticket: c.ticketNumber, 
              pais: (c as any).pais || c.cliente?.pais || 'SIN PAÍS' 
            }))
          });
        } else {
          console.error('[BandejaCasos] ⚠️ ERROR: Agente sin país definido!', {
            user: currentUser,
            userPais: currentUser?.pais
          });
          // Si el agente no tiene país, NO mostrar ningún caso (más seguro)
          casosParaFiltrar = [];
        }
      }
      
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
    };
    
    processCases();
  }, [searchTerm, statusFilter, categoriaFilter, casos]);

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
    },
    input: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  return (
    <div className="space-y-6" style={styles.container}>
      <div 
        className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 rounded-3xl shadow-xl border backdrop-blur-sm"
        style={{
          ...styles.card,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
              e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
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
                  ? (theme === 'dark' ? '#1e293b' : '#ffffff')
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
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
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
                  ? (theme === 'dark' ? '#1e293b' : '#ffffff')
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
                  ? (theme === 'dark' ? '#1e293b' : '#ffffff')
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
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
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
                  ? (theme === 'dark' ? '#1e293b' : '#ffffff')
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
        <div className="rounded-3xl shadow-xl border p-12 text-center" style={{
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
        <div className="rounded-3xl shadow-xl border p-12 text-center" style={{...styles.card, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
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
          className="rounded-3xl shadow-xl border overflow-hidden" 
          style={{
            ...styles.card, 
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInSlide 0.3s ease-out 0.1s both'
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
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Empresa</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Categoría</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Estado</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: styles.text.secondary}}>Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                {filtered.map((caso, idx) => (
                  <tr 
                    key={caso.id} 
                    className="transition-all duration-200 cursor-pointer group relative"
                    style={{
                      backgroundColor: 'transparent',
                      animation: `fadeInSlide 0.3s ease-out ${idx * 0.03}s both`,
                      transform: 'translateY(0)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
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
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm transition-all"
                          style={{
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                            color: styles.text.secondary,
                            borderColor: 'rgba(148, 163, 184, 0.2)',
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
                        
                        return (
                          <span 
                            className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-lg border transition-all"
                            style={{
                              backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                              color: styles.text.secondary,
                              borderColor: 'rgba(148, 163, 184, 0.2)',
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
                      <span 
                        className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm transition-all"
                        style={{
                          backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                          color: styles.text.secondary,
                          borderColor: 'rgba(148, 163, 184, 0.2)',
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
          {filtered.map((caso, idx) => {
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
                className="rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                style={{
                  ...styles.card,
                  borderColor: 'rgba(148, 163, 184, 0.2)',
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
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
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
    </div>
  );
};

export default BandejaCasos;
