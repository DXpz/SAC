import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, Categoria, Agente } from '../types';
import { Search, Plus, Filter, ChevronRight, X, Calendar, User, Clock, AlertTriangle, Timer, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';
import LoadingLogo from '../components/LoadingLogo';

const AdminBandejaCasos: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [filtered, setFiltered] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [clienteFilter, setClienteFilter] = useState<string>('all');
  const [agenteFilter, setAgenteFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all'); // all, vencido, en-riesgo, dentro-sla
  const [fechaFilter, setFechaFilter] = useState<string>('all'); // all, hoy, semana, mes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Función para normalizar el estado del caso
  const normalizeStatus = (status: string | CaseStatus | undefined): CaseStatus => {
    if (!status) return CaseStatus.NUEVO;
    const statusStr = String(status).trim();
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

  // Cargar datos iniciales y cuando cambia la vista
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([loadClientes(), loadCategorias(), loadAgentes()]);
        await loadCasos();
      } catch (err) {
        console.error('Error inicializando datos:', err);
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Actualizar casos cuando cambian los filtros (con debounce para evitar demasiadas llamadas)
  useEffect(() => {
    // Solo actualizar si no es la carga inicial
    if (!loading && casos.length > 0) {
      const timeoutId = setTimeout(() => {
        loadCasos();
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoriaFilter, clienteFilter, agenteFilter, slaFilter, fechaFilter]);

  // Enriquecer casos con clientes y categorías
  useEffect(() => {
    if (casos.length === 0 || (clientes.length === 0 && categorias.length === 0)) {
      return;
    }

    const casosEnriquecidos = casos.map(caso => {
      let casoActualizado = { ...caso };

      // Enriquecer con cliente
      if (clientes.length > 0 && caso.clientId) {
        const clienteCompleto = clientes.find(c => {
          const normalizeId = (id: string) => {
            if (!id) return '';
            let normalized = id.trim().toUpperCase();
            if (!normalized.startsWith('CL')) {
              normalized = 'CL' + normalized.replace(/^CL/i, '');
            }
            const match = normalized.match(/^CL0*(\d+)$/);
            if (match) {
              const num = match[1];
              normalized = 'CL' + num.padStart(6, '0');
            }
            return normalized;
          };
          
          const casoClientIdNormalized = normalizeId(caso.clientId);
          const cliIdNormalized = normalizeId(c.idCliente);
          if (casoClientIdNormalized === cliIdNormalized) return true;
          if (c.idCliente === caso.clientId) return true;
          const casoNum = caso.clientId.replace(/\D/g, '');
          const cliNum = c.idCliente.replace(/\D/g, '');
          if (casoNum && cliNum && casoNum === cliNum) return true;
          return false;
        });

        if (clienteCompleto) {
          casoActualizado = {
            ...casoActualizado,
            clientName: caso.clientName && caso.clientName.trim() !== '' && caso.clientName !== 'Por definir' 
              ? caso.clientName 
              : clienteCompleto.nombreEmpresa,
            clientId: clienteCompleto.idCliente || caso.clientId,
            cliente: clienteCompleto,
            clientEmail: caso.clientEmail || clienteCompleto.email,
            clientPhone: caso.clientPhone || clienteCompleto.telefono,
          };
        }
      }

      // Enriquecer con categoría
      if (categorias.length > 0) {
        const categoriaId = caso.categoria?.idCategoria || (caso as any).categoria_id || (caso as any).categoriaId;
        if (categoriaId) {
          const categoriaCompleta = categorias.find(cat => 
            String(cat.idCategoria) === String(categoriaId)
          );
          if (categoriaCompleta) {
            casoActualizado = {
              ...casoActualizado,
              category: categoriaCompleta.nombre,
              categoria: categoriaCompleta,
            };
          }
        }
      }

      // Enriquecer con agente
      if (agentes.length > 0) {
        const agentObject = (caso as any).agent || caso.agenteAsignado || null;
        const agenteIdFromAgent = agentObject?.idAgente || agentObject?.id || agentObject?.id_agente || agentObject?.agente_id || agentObject?.user_id || '';
        const agenteIdFromObject = caso.agenteAsignado?.idAgente || caso.agenteAsignado?.id || (caso.agenteAsignado as any)?.id_agente || (caso.agenteAsignado as any)?.agente_id;
        const agenteIdFromCase = caso.agentId || (caso as any).agente_id || (caso as any).agente_user_id;
        const agenteId = agenteIdFromAgent || agenteIdFromObject || agenteIdFromCase;

        if (agenteId) {
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

          const agenteEncontrado = agentes.find(a => {
            const aId = String(a.idAgente || '').trim();
            const searchId = String(agenteId).trim();
            if (aId === searchId) return true;
            if (aId.toLowerCase() === searchId.toLowerCase()) return true;
            const aIdNormalized = normalizeId(aId);
            const searchIdNormalized = normalizeId(searchId);
            if (aIdNormalized === searchIdNormalized) return true;
            const aIdNum = Number(aId.replace(/[^\d]/g, ''));
            const searchIdNum = Number(searchId.replace(/[^\d]/g, ''));
            if (!isNaN(aIdNum) && !isNaN(searchIdNum) && aIdNum > 0 && searchIdNum > 0 && aIdNum === searchIdNum) return true;
            return false;
          });

          if (agenteEncontrado && (!caso.agenteAsignado || !caso.agentName)) {
            casoActualizado = {
              ...casoActualizado,
              agentId: agenteEncontrado.idAgente,
              agentName: agenteEncontrado.nombre,
              agenteAsignado: agenteEncontrado,
            };
          }
        }
      }

      return casoActualizado;
    });

    const hasChanges = casosEnriquecidos.some((caso, idx) => {
      const original = casos[idx];
      return (
        caso.clientName !== original.clientName ||
        caso.clientId !== original.clientId ||
        caso.cliente?.idCliente !== original.cliente?.idCliente ||
        caso.category !== original.category ||
        caso.categoria?.idCategoria !== original.categoria?.idCategoria ||
        caso.agentName !== original.agentName ||
        caso.agenteAsignado?.idAgente !== original.agenteAsignado?.idAgente
      );
    });

    if (hasChanges) {
      setCasos(casosEnriquecidos);
    }
  }, [casos, clientes, categorias, agentes]);

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

  const loadAgentes = async () => {
    try {
      const data = await api.getAgentes();
      setAgentes(data);
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
      setCasos(data);
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
      return data;
    } catch (err: any) {
      setError(err.message || 'Error al cargar los casos desde el servidor.');
      setCasos([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Aplicar todos los filtros
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    let result = casos.filter(c => {
      const id = (c.id || c.ticketNumber || '').toLowerCase();
      const client = (c.clientName || '').toLowerCase();
      const subject = (c.subject || '').toLowerCase();
      const agent = (c.agentName || c.agenteAsignado?.nombre || '').toLowerCase();
      
      return id.includes(term) || client.includes(term) || subject.includes(term) || agent.includes(term);
    });

    // Filtro por estado
    if (statusFilter !== 'all') {
      result = result.filter(c => {
        const rawStatus = c.status || (c as any).estado;
        const normalizedStatus = normalizeStatus(rawStatus);
        return normalizedStatus === statusFilter;
      });
    }

    // Filtro por categoría
    if (categoriaFilter !== 'all') {
      result = result.filter(c => {
        const categoriaId = c.categoria?.idCategoria || (c as any).categoria_id || (c as any).categoriaId;
        return String(categoriaId) === String(categoriaFilter) || c.category === categoriaFilter;
      });
    }

    // Filtro por cliente
    if (clienteFilter !== 'all') {
      result = result.filter(c => {
        const clienteId = c.clientId || c.cliente?.idCliente;
        return String(clienteId) === String(clienteFilter);
      });
    }

    // Filtro por agente
    if (agenteFilter !== 'all') {
      result = result.filter(c => {
        const agentObject = (c as any).agent || c.agenteAsignado || null;
        const agenteIdFromAgent = agentObject?.idAgente || agentObject?.id || agentObject?.id_agente || agentObject?.agente_id || agentObject?.user_id || '';
        const agenteIdFromObject = c.agenteAsignado?.idAgente || c.agenteAsignado?.id || (c.agenteAsignado as any)?.id_agente || (c.agenteAsignado as any)?.agente_id;
        const agenteIdFromCase = c.agentId || (c as any).agente_id || (c as any).agente_user_id;
        const agenteId = agenteIdFromAgent || agenteIdFromObject || agenteIdFromCase;
        
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

        const agenteIdStr = agenteId ? String(agenteId).trim() : '';
        const filterIdStr = String(agenteFilter).trim();
        
        if (agenteIdStr === filterIdStr) return true;
        if (agenteIdStr.toLowerCase() === filterIdStr.toLowerCase()) return true;
        const agenteIdNormalized = normalizeId(agenteIdStr);
        const filterIdNormalized = normalizeId(filterIdStr);
        if (agenteIdNormalized === filterIdNormalized) return true;
        const agenteIdNum = Number(agenteIdStr.replace(/[^\d]/g, ''));
        const filterIdNum = Number(filterIdStr.replace(/[^\d]/g, ''));
        if (!isNaN(agenteIdNum) && !isNaN(filterIdNum) && agenteIdNum > 0 && filterIdNum > 0 && agenteIdNum === filterIdNum) return true;
        return false;
      });
    }

    // Filtro por SLA
    if (slaFilter !== 'all') {
      result = result.filter(c => {
        const slaDias = c.categoria?.slaDias || 5;
        const diasRestantes = slaDias - c.diasAbierto;
        
        if (slaFilter === 'vencido') {
          return c.diasAbierto >= slaDias;
        } else if (slaFilter === 'en-riesgo') {
          return diasRestantes > 0 && diasRestantes <= 1 && c.diasAbierto < slaDias;
        } else if (slaFilter === 'dentro-sla') {
          return c.diasAbierto < slaDias && diasRestantes > 1;
        }
        return true;
      });
    }

    // Filtro por fecha
    if (fechaFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      if (fechaFilter === 'hoy') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (fechaFilter === 'semana') {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
        startDate.setHours(0, 0, 0, 0);
      } else if (fechaFilter === 'mes') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      result = result.filter(c => new Date(c.createdAt) >= startDate);
    }

    setFiltered(result);
  }, [searchTerm, statusFilter, categoriaFilter, clienteFilter, agenteFilter, slaFilter, fechaFilter, casos]);

  // Estilos dinámicos basados en el tema (usando useMemo para recalcular cuando cambia el tema)
  const styles = useMemo(() => ({
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
  }), [theme]);

  const getSlaStatus = (caso: Case) => {
    const slaDias = caso.categoria?.slaDias || 5;
    const diasRestantes = slaDias - caso.diasAbierto;
    
    if (caso.diasAbierto >= slaDias) {
      return { label: 'Vencido', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: Timer };
    } else if (diasRestantes <= 1 && caso.diasAbierto > 0) {
      return { label: 'Crítico', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: AlertTriangle };
    } else if (diasRestantes <= 3) {
      return { label: 'Alto', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', icon: Clock };
    }
    return { label: 'Normal', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: Clock };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6" style={styles.container}>
      {/* Barra de búsqueda y filtros */}
      <div 
        className="flex flex-col gap-4 p-4 rounded-3xl shadow-xl border backdrop-blur-sm"
        style={{
          ...styles.card,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Búsqueda */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{color: styles.text.tertiary}} />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente, Asunto o Agente..."
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

        {/* Filtros en grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Estado */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: statusFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: statusFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: statusFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: statusFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todos los Estados</option>
              {Object.values(CaseStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: statusFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>

          {/* Categoría */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: categoriaFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: categoriaFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: categoriaFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: categoriaFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todas las Categorías</option>
              {categorias.map(cat => (
                <option key={cat.idCategoria} value={cat.idCategoria}>
                  {cat.nombre}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: categoriaFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
            {categoriaFilter !== 'all' && (() => {
              const categoriaSeleccionada = categorias.find(c => String(c.idCategoria) === String(categoriaFilter));
              return categoriaSeleccionada && (categoriaSeleccionada.descripcion || (categoriaSeleccionada as any).description) ? (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 group">
                  <HelpCircle 
                    className="w-3.5 h-3.5 cursor-help transition-colors flex-shrink-0" 
                    style={{ color: styles.text.tertiary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = styles.text.tertiary;
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
                    {categoriaSeleccionada.descripcion || (categoriaSeleccionada as any).description || 'Sin descripción disponible'}
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
              ) : null;
            })()}
          </div>

          {/* Cliente */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: clienteFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: clienteFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: clienteFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: clienteFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: clienteFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todos los Clientes</option>
              {clientes.map(cli => (
                <option key={cli.idCliente} value={cli.idCliente}>
                  {cli.nombreEmpresa}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: clienteFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>

          {/* Agente */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: agenteFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={agenteFilter}
              onChange={(e) => setAgenteFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: agenteFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: agenteFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: agenteFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: agenteFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todos los Agentes</option>
              {agentes.map(ag => (
                <option key={ag.idAgente} value={ag.idAgente}>
                  {ag.nombre}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: agenteFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>

          {/* SLA */}
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: slaFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: slaFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: slaFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: slaFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: slaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todos los SLA</option>
              <option value="vencido">Vencido</option>
              <option value="en-riesgo">En Riesgo</option>
              <option value="dentro-sla">Dentro de SLA</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: slaFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>

          {/* Fecha */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" style={{color: fechaFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={fechaFilter}
              onChange={(e) => setFechaFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: fechaFilter === 'all' 
                  ? styles.card.backgroundColor
                  : (theme === 'dark' ? 'rgba(16, 122, 180, 0.15)' : '#e0f2fe'),
                borderColor: fechaFilter === 'all' 
                  ? styles.card.borderColor
                  : '#107ab4',
                color: fechaFilter === 'all' 
                  ? styles.text.secondary
                  : (theme === 'dark' ? '#93c5fd' : '#0c4a6e'),
                boxShadow: fechaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
            >
              <option value="all">Todas las Fechas</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mes</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{
              color: fechaFilter === 'all' ? styles.text.tertiary : '#107ab4',
              transform: 'rotate(90deg)'
            }} />
          </div>

          {/* Botón Nuevo Caso */}
          <button 
            onClick={() => navigate('/app/casos/nuevo')}
            className="text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))'}}
          >
            <Plus className="w-5 h-5" /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabla de casos */}
      {loading ? (
        <LoadingScreen message="Cargando casos..." />
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
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>País</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Asunto</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Categoría</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Estado</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Agente</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>SLA</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Días</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: styles.text.secondary}}>Fecha</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: styles.text.secondary}}>Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                {filtered.map((caso, idx) => {
                  const rawStatus = caso.status || (caso as any).estado;
                  const normalizedStatus = normalizeStatus(rawStatus);
                  const slaStatus = getSlaStatus(caso);
                  const StatusIcon = slaStatus.icon;
                  
                  return (
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
                        <span className="text-xs font-bold transition-colors" style={{color: styles.text.primary}}>
                          {caso.ticketNumber || (caso as any).idCaso || caso.id}
                        </span>
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
                          <span className="text-xs font-semibold max-w-[150px] truncate" style={{color: styles.text.primary}}>
                            {caso.clientName || caso.cliente?.nombreEmpresa || 'Por definir'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{color: styles.text.primary}}>
                          {getCaseCountry(caso)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium max-w-[200px] truncate block" style={{color: styles.text.primary}}>
                          {caso.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm" style={{
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                            color: styles.text.secondary,
                            borderColor: 'rgba(148, 163, 184, 0.2)'
                          }}>
                            {caso.category || caso.categoria?.nombre || 'General'}
                          </span>
                          {caso.categoria && (caso.categoria.descripcion || (caso.categoria as any).description) && (
                            <div className="relative group">
                              <HelpCircle 
                                className="w-3.5 h-3.5 cursor-help transition-colors flex-shrink-0" 
                                style={{ color: styles.text.tertiary }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = styles.text.tertiary;
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
                                {caso.categoria.descripcion || (caso.categoria as any).description || 'Sin descripción disponible'}
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
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{color: styles.text.secondary}}>
                          {caso.agentName || caso.agenteAsignado?.nombre || 'Sin asignar'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className="w-3.5 h-3.5" style={{color: slaStatus.color}} />
                          <span 
                            className="text-[10px] font-semibold"
                            style={{
                              color: slaStatus.color
                            }}
                          >
                            {slaStatus.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                          {caso.diasAbierto || 0} días
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                          {formatDate(caso.createdAt)}
                        </span>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBandejaCasos;

