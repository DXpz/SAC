
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
    // Obtener usuario autenticado
    const currentUser = api.getUser();
    const isAgente = currentUser?.role === 'AGENTE';
    
    // IMPORTANTE: Si es agente, getCases() usa case.agent que YA retorna solo los casos del agente
    // El webhook case.agent filtra automáticamente por agente_user_id
    // Por lo tanto, NO debemos filtrar de nuevo - confiamos completamente en la respuesta del webhook
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
    
    // Si es agente, el webhook case.agent ya filtró los casos correctamente
    // NO aplicamos ningún filtro adicional - mostramos todos los casos que retornó el webhook
    // Esto evita problemas de comparación de IDs que pueden eliminar casos válidos
    
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
      )}
    </div>
  );
};

export default BandejaCasos;
