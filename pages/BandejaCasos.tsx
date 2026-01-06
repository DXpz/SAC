
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, Categoria } from '../types';
import { STATE_COLORS } from '../constants';
import { Search, Plus, Filter, ChevronRight, RefreshCw, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const BandejaCasos: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [filtered, setFiltered] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
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
        console.error('Error inicializando datos:', err);
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
    
    console.log('🔄 Enriqueciendo casos...', {
      totalCasos: casos.length,
      totalClientes: clientes.length,
      totalCategorias: categorias.length
    });
    
    const casosEnriquecidos = casos.map(caso => {
      let casoActualizado = { ...caso };
      
      // Preservar datos críticos que no deben perderse
      const preservedTicketNumber = caso.ticketNumber || (caso as any).idCaso || caso.id;
      const preservedClientId = caso.clientId || caso.cliente?.idCliente;
      const preservedClientName = caso.clientName || caso.cliente?.nombreEmpresa;
      
      // Enriquecer con cliente completo solo si no lo tiene o está vacío
      if (clientes.length > 0 && preservedClientId) {
        const needsClientEnrichment = !caso.cliente || !caso.clientName || (typeof caso.clientName === 'string' && caso.clientName.trim() === '') || caso.clientName === 'Sin nombre';
        
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
              clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Sin nombre') ? caso.clientName : clienteCompleto.nombreEmpresa,
              clientId: clienteCompleto.idCliente || caso.clientId || preservedClientId,
              cliente: clienteCompleto,
              clientEmail: caso.clientEmail || clienteCompleto.email,
              clientPhone: caso.clientPhone || clienteCompleto.telefono,
              // Preservar ticketNumber
              ticketNumber: caso.ticketNumber || preservedTicketNumber,
              id: caso.id || preservedTicketNumber,
            };
            console.log(`✅ Cliente enriquecido para caso ${caso.ticketNumber || preservedTicketNumber}:`, {
              casoClientId: caso.clientId || preservedClientId,
              clienteId: clienteCompleto.idCliente,
              clientName: clienteCompleto.nombreEmpresa
            });
          } else {
            // Si no se encuentra el cliente, preservar al menos los datos existentes
            casoActualizado = {
              ...casoActualizado,
              clientId: caso.clientId || preservedClientId,
              clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Sin nombre') ? caso.clientName : preservedClientName || 'Sin nombre',
              ticketNumber: caso.ticketNumber || preservedTicketNumber,
              id: caso.id || preservedTicketNumber,
            };
            console.warn(`⚠️ No se encontró cliente para caso ${caso.ticketNumber || preservedTicketNumber}:`, {
              casoClientId: caso.clientId || preservedClientId,
              casoClientIdNormalized,
              clientesDisponibles: clientes.map(c => c.idCliente).slice(0, 10)
            });
          }
        } else {
          // Si no necesita enriquecimiento, asegurar que los datos críticos estén presentes
          casoActualizado = {
            ...casoActualizado,
            ticketNumber: caso.ticketNumber || preservedTicketNumber,
            id: caso.id || preservedTicketNumber,
            clientId: caso.clientId || preservedClientId,
            clientName: (caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Sin nombre') ? caso.clientName : preservedClientName || 'Sin nombre',
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
      console.log('✅ Casos enriquecidos, actualizando estado');
      setCasos(casosEnriquecidos);
    }
  }, [casos, clientes, categorias]); // Incluir casos para que se ejecute cuando se cargan nuevos casos

  const loadClientes = async () => {
    try {
      console.log('📥 Cargando clientes...');
    const data = await api.getClientes();
      console.log('✅ Clientes cargados:', data.length);
    setClientes(data);
      return data;
    } catch (err) {
      console.error('❌ Error al cargar clientes:', err);
      return [];
    }
  };

  const loadCategorias = async () => {
    try {
      console.log('📥 Cargando categorías...');
      const data = await api.getCategorias();
      console.log('✅ Categorías cargadas:', data.length);
      setCategorias(data);
      return data;
    } catch (err) {
      console.error('❌ Error al cargar categorías:', err);
      return [];
    }
  };

  const loadCasos = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📥 Cargando casos...');
      const data = await api.getCases();
      console.log('✅ Casos cargados:', data.length);
      
      // Obtener usuario actual para debugging
      const currentUser = api.getUser();
      console.log('👤 Usuario actual:', currentUser);
      
        // Log detallado de todos los casos y sus agentes asignados
        if (data.length > 0) {
          console.log('📋 [BandejaCasos] Análisis de casos y agentes asignados:');
          data.forEach((caso, index) => {
            const agentObject = (caso as any).agent || caso.agenteAsignado || null;
            const agenteIdFromAgent = agentObject?.idAgente || agentObject?.id || agentObject?.id_agente || agentObject?.agente_id || agentObject?.user_id || '';
            const agenteIdFromObject = caso.agenteAsignado?.idAgente || caso.agenteAsignado?.id || (caso.agenteAsignado as any)?.id_agente || (caso.agenteAsignado as any)?.agente_id;
            const agenteIdFromCase = caso.agentId || (caso as any).agente_id || (caso as any).agente_user_id;
            const agenteId = agenteIdFromAgent || agenteIdFromObject || agenteIdFromCase;
            
            console.log(`  Caso ${index + 1}:`, {
              ticketNumber: caso.ticketNumber || caso.id,
              tieneAgent: !!(caso as any).agent,
              agentObject: (caso as any).agent,
              agentId: caso.agentId,
              agenteId: agenteId,
              agenteIdFromAgent,
              agenteAsignado: caso.agenteAsignado ? {
                idAgente: caso.agenteAsignado.idAgente,
                nombre: caso.agenteAsignado.nombre,
                email: caso.agenteAsignado.email
              } : null,
              agenteIdFromObject,
              agenteIdFromCase,
              todosLosCamposAgente: Object.keys(caso).filter(k => 
                k.toLowerCase().includes('agent') || 
                k.toLowerCase().includes('agente') ||
                k.toLowerCase().includes('user')
              ).reduce((acc, key) => {
                acc[key] = (caso as any)[key];
                return acc;
              }, {} as any)
            });
          });
        } else {
          console.warn('⚠️ [BandejaCasos] No se cargaron casos desde el webhook');
        }
      
      // Guardar casos directamente, el useEffect de enriquecimiento se ejecutará automáticamente
      setCasos(data);
      
      const updateTime = new Date();
      setLastUpdate(updateTime);
      // Guardar en localStorage para que Layout pueda mostrarlo
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
      
      return data;
    } catch (err: any) {
      console.error('❌ Error al cargar casos:', err);
      setError(err.message || 'Error al cargar los casos desde el servidor. Por favor, intenta nuevamente.');
      setCasos([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Obtener usuario autenticado
    const currentUser = api.getUser();
    const isAgente = currentUser?.role === 'AGENTE';
    
    // Si es agente, filtrar solo sus casos asignados
    let casosParaFiltrar = casos;
    if (isAgente && currentUser?.id) {
      console.log('🔍 [BandejaCasos] Filtrando casos para agente:', {
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
        totalCasos: casos.length
      });
      
      casosParaFiltrar = casos.filter(c => {
        // Intentar obtener el ID del agente de múltiples fuentes
        // PRIORIDAD: case.agent (campo directo del webhook)
        const agentObject = (c as any).agent || c.agenteAsignado || null;
        const agenteIdFromAgent = agentObject?.idAgente || agentObject?.id || agentObject?.id_agente || agentObject?.agente_id || agentObject?.user_id || '';
        const agenteIdFromObject = c.agenteAsignado?.idAgente || c.agenteAsignado?.id || (c.agenteAsignado as any)?.id_agente || (c.agenteAsignado as any)?.agente_id;
        const agenteIdFromCase = c.agentId || (c as any).agente_id || (c as any).agente_user_id;
        const agenteId = agenteIdFromAgent || agenteIdFromObject || agenteIdFromCase;
        
        // Normalizar ambos IDs a string para comparación
        const agenteIdStr = agenteId ? String(agenteId).trim() : '';
        const userIdStr = String(currentUser.id).trim();
        
        // Función helper para extraer el número de un ID (ej: "AG-0006" -> "0006" o "6")
        const extractIdNumber = (id: string): string => {
          // Si tiene formato "AG-XXXX" o similar, extraer la parte numérica
          const match = id.match(/(\d+)$/);
          if (match) {
            return match[1];
          }
          return id;
        };
        
        // Función helper para normalizar ID (quitar ceros a la izquierda si es numérico)
        const normalizeId = (id: string): string => {
          const numStr = extractIdNumber(id);
          // Si es puramente numérico, quitar ceros a la izquierda
          if (/^\d+$/.test(numStr)) {
            return String(Number(numStr));
          }
          return numStr;
        };
        
        // Comparar IDs de múltiples formas
        let casoAsignado = false;
        if (agenteIdStr && userIdStr) {
          // 1. Comparación exacta
          casoAsignado = agenteIdStr === userIdStr;
          
          // 2. Comparación case-insensitive
          if (!casoAsignado) {
            casoAsignado = agenteIdStr.toLowerCase() === userIdStr.toLowerCase();
          }
          
          // 3. Comparación normalizada (sin prefijos, sin ceros a la izquierda)
          if (!casoAsignado) {
            const agenteIdNormalized = normalizeId(agenteIdStr);
            const userIdNormalized = normalizeId(userIdStr);
            casoAsignado = agenteIdNormalized === userIdNormalized;
          }
          
          // 4. Comparación numérica directa
          if (!casoAsignado) {
            const agenteIdNum = Number(agenteIdStr.replace(/[^\d]/g, ''));
            const userIdNum = Number(userIdStr.replace(/[^\d]/g, ''));
            if (!isNaN(agenteIdNum) && !isNaN(userIdNum) && agenteIdNum > 0 && userIdNum > 0) {
              casoAsignado = agenteIdNum === userIdNum;
            }
          }
          
          // 5. Comparación por parte numérica extraída
          if (!casoAsignado) {
            const agenteIdPart = extractIdNumber(agenteIdStr);
            const userIdPart = extractIdNumber(userIdStr);
            casoAsignado = agenteIdPart === userIdPart || normalizeId(agenteIdPart) === normalizeId(userIdPart);
          }
        }
        
        // Loggear información de debugging para los primeros casos
        if (casosParaFiltrar.length < 10) {
          console.log('🔍 [BandejaCasos] Verificando caso:', c.ticketNumber || c.id, {
            tieneAgent: !!(c as any).agent,
            agentObject: (c as any).agent,
            agenteIdFromAgent,
            agenteIdFromObject,
            agenteIdFromCase,
            agenteId: agenteIdStr,
            currentUserId: userIdStr,
            asignado: casoAsignado,
            tieneAgenteAsignado: !!c.agenteAsignado,
            agenteAsignadoCompleto: c.agenteAsignado
          });
        }
        
        return casoAsignado;
      });
      
      console.log('✅ [BandejaCasos] Casos del agente:', casosParaFiltrar.length, 'de', casos.length, 'total');
      
      // Si no hay casos asignados, mostrar un mensaje de advertencia con análisis detallado
      if (casosParaFiltrar.length === 0 && casos.length > 0) {
        console.warn('⚠️ [BandejaCasos] No se encontraron casos asignados al agente. Verificando estructura de datos...');
        console.warn('⚠️ [BandejaCasos] Usuario buscado:', {
          userId: currentUser.id,
          userName: currentUser.name,
          role: currentUser.role
        });
        
        // Analizar los primeros 5 casos para ver qué IDs tienen
        casos.slice(0, 5).forEach((caso, idx) => {
          const agentObject = (caso as any).agent || caso.agenteAsignado || null;
          const agenteIdFromAgent = agentObject?.idAgente || agentObject?.id || agentObject?.id_agente || agentObject?.agente_id || agentObject?.user_id || '';
          const agenteIdFromObject = caso.agenteAsignado?.idAgente || caso.agenteAsignado?.id || (caso.agenteAsignado as any)?.id_agente || (caso.agenteAsignado as any)?.agente_id;
          const agenteIdFromCase = caso.agentId || (caso as any).agente_id || (caso as any).agente_user_id;
          const agenteId = agenteIdFromAgent || agenteIdFromObject || agenteIdFromCase;
          
          // Intentar todas las comparaciones
          const agenteIdStr = agenteId ? String(agenteId).trim() : '';
          const userIdStr = String(currentUser.id).trim();
          
          const extractIdNumber = (id: string): string => {
            const match = id.match(/(\d+)$/);
            return match ? match[1] : id;
          };
          
          const normalizeId = (id: string): string => {
            const numStr = extractIdNumber(id);
            if (/^\d+$/.test(numStr)) {
              return String(Number(numStr));
            }
            return numStr;
          };
          
          const comparaciones = {
            exacta: agenteIdStr === userIdStr,
            caseInsensitive: agenteIdStr.toLowerCase() === userIdStr.toLowerCase(),
            normalizada: normalizeId(agenteIdStr) === normalizeId(userIdStr),
            numerica: (() => {
              const agenteIdNum = Number(agenteIdStr.replace(/[^\d]/g, ''));
              const userIdNum = Number(userIdStr.replace(/[^\d]/g, ''));
              return !isNaN(agenteIdNum) && !isNaN(userIdNum) && agenteIdNum > 0 && userIdNum > 0 && agenteIdNum === userIdNum;
            })(),
            parteNumerica: extractIdNumber(agenteIdStr) === extractIdNumber(userIdStr) || normalizeId(extractIdNumber(agenteIdStr)) === normalizeId(extractIdNumber(userIdStr))
          };
          
          console.warn(`⚠️ [BandejaCasos] Caso ${idx + 1} (${caso.ticketNumber || caso.id}):`, {
            tieneAgent: !!(caso as any).agent,
            agentObject: (caso as any).agent,
            agenteIdFromAgent,
            agenteIdEnCaso: agenteIdStr,
            userIdBuscado: userIdStr,
            agenteAsignadoCompleto: caso.agenteAsignado,
            agentId: caso.agentId,
            comparaciones,
            coincide: Object.values(comparaciones).some(v => v === true)
          });
        });
      }
    }
    
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
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
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
          <div className="relative group">
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
                boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
              onMouseEnter={(e) => {
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
          
          <div className="relative group">
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
                boxShadow: categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
              onMouseEnter={(e) => {
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
          
          <button 
            onClick={() => navigate('/app/casos/nuevo')}
            className="text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))'}}
          >
            <Plus className="w-5 h-5" /> Nuevo Caso
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{...styles.card}}>
          <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderColor: 'var(--color-brand-red)'}}></div>
            <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>Cargando casos...</h3>
            <p className="text-sm" style={{color: '#64748b'}}>Obteniendo datos desde el servidor</p>
          </div>
        </div>
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
      ) : (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{...styles.card, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b" style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                borderColor: 'rgba(148, 163, 184, 0.2)'
              }}>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>ID Caso</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Cliente</th>
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
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }} 
                    onClick={() => navigate(`/app/casos/${caso.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold transition-colors" style={{color: styles.text.primary}}>{caso.ticketNumber || (caso as any).idCaso}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm" style={{
                          backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                          color: styles.text.secondary,
                          borderColor: 'rgba(148, 163, 184, 0.2)'
                        }}>
                          {caso.clientId || caso.cliente?.idCliente || 'N/A'}
                        </span>
                        <span className="text-xs font-semibold" style={{color: styles.text.primary}}>
                          {caso.clientName || caso.cliente?.nombreEmpresa || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm" style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                        color: styles.text.secondary,
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}>
                        {caso.category || caso.categoria?.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const rawStatus = caso.status || (caso as any).estado;
                        const normalizedStatus = normalizeStatus(rawStatus);
                        return (
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: (() => {
                                if (normalizedStatus === CaseStatus.NUEVO) return '#2563eb';
                                if (normalizedStatus === CaseStatus.EN_PROCESO) return '#d97706';
                                if (normalizedStatus === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
                                if (normalizedStatus === CaseStatus.ESCALADO) return '#dc2626';
                                if (normalizedStatus === CaseStatus.RESUELTO) return '#16a34a';
                                if (normalizedStatus === CaseStatus.CERRADO) return '#64748b';
                                return '#475569';
                              })()
                            }}
                          >
                            {rawStatus}
                      </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <div className="p-2 rounded-lg transition-all" style={{
                          backgroundColor: 'transparent'
                        }}>
                          <ChevronRight className="w-5 h-5 transition-all" style={{color: styles.text.tertiary}} onMouseEnter={(e) => { e.currentTarget.style.color = styles.text.secondary; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = styles.text.tertiary; e.currentTarget.style.transform = ''; }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BandejaCasos;
