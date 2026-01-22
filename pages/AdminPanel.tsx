import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Caso, CaseStatus, Agente, Cliente, Categoria, KPI } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Users,
  Building2,
  FolderOpen,
  Ticket,
  BarChart3,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import AnimatedNumber from '../components/AnimatedNumber';

const AdminPanel: React.FC = () => {
  const [allCasos, setAllCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [estados, setEstados] = useState<Array<{ id: string; name: string; order: number; isFinal: boolean }>>([]);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const location = useLocation();

  const loadClientes = async () => {
    try {
      const clientesList = await api.getClientes();
      setClientes(clientesList);
      return clientesList;
    } catch (error) {
      return [];
    }
  };

  // Función para normalizar el estado del caso (igual que en otras pantallas)
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

  const enrichCasesWithClients = (cases: Caso[], clientesList: Cliente[]): Caso[] => {
    return cases.map(caso => {
      const cliente = clientesList.find(c => c.idCliente === caso.clientId);
      return {
        ...caso,
        clientName: cliente?.nombreEmpresa || caso.clientName || 'Sin nombre',
        cliente: cliente || caso.cliente
      };
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientesList, casosList, agentesList, categoriasList, usuariosList, kpisData, estadosList] = await Promise.allSettled([
        loadClientes(),
        api.getCases(),
        api.getAgentes(),
        api.getCategorias(),
        api.getUsuarios(),
        api.getKPIs(),
        api.readEstados()
      ]);
      
      setClientes(clientesList.status === 'fulfilled' ? clientesList.value : []);
      setAgentes(agentesList.status === 'fulfilled' ? agentesList.value : []);
      setCategorias(categoriasList.status === 'fulfilled' ? categoriasList.value : []);
      setUsuarios(usuariosList.status === 'fulfilled' ? usuariosList.value : []);
      setKpis(kpisData.status === 'fulfilled' ? kpisData.value : null);
      
      // Cargar estados del webhook
      if (estadosList.status === 'fulfilled' && estadosList.value && Array.isArray(estadosList.value) && estadosList.value.length > 0) {
        const estadosFromWebhook = estadosList.value.map((s: any) => ({
          id: String(s.id || ''),
          name: String(s.name || s.nombre || ''),
          order: Number(s.order || s.orden || 0),
          isFinal: s.isFinal === true || s.is_final === true || s.estado_final === true || false
        }));
        setEstados(estadosFromWebhook);
      }
      
      const casosData = casosList.status === 'fulfilled' ? casosList.value : [];
      const clientesData = clientesList.status === 'fulfilled' ? clientesList.value : [];
      const enriched = enrichCasesWithClients(casosData, clientesData);
      setAllCasos(enriched);
    } catch (error) {
      console.error('Error cargando datos:', error);
      // Asegurar que al menos tenemos arrays vacíos
      setClientes([]);
      setAgentes([]);
      setCategorias([]);
      setUsuarios([]);
      setKpis(null);
      setEstados([]);
      setAllCasos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location.pathname]);

  // Métricas adicionales desde los endpoints (con validaciones y normalización)
  const casosSeguros = Array.isArray(allCasos) ? allCasos : [];
  const totalCasos = casosSeguros.length;
  
  // Función helper para obtener el estado del caso desde la lista de estados del webhook
  const getEstadoFromWebhook = (casoStatus: string) => {
    if (!estados || estados.length === 0) {
      return null;
    }
    
    const casoStatusStr = String(casoStatus || '').trim();
    const casoStatusLower = casoStatusStr.toLowerCase();
    
    for (const estado of estados) {
      const estadoId = String(estado.id || '').trim();
      const estadoName = String(estado.name || '').trim();
      const estadoNameLower = estadoName.toLowerCase();
      const estadoNameNormalized = estadoNameLower.replace(/\s+/g, '').replace(/[_-]/g, '');
      const casoStatusNormalized = casoStatusLower.replace(/\s+/g, '').replace(/[_-]/g, '');
      
      // Comparar por ID o nombre
      const matches = estadoId === casoStatusStr ||
                     estadoNameLower === casoStatusLower ||
                     estadoNameNormalized === casoStatusNormalized;
      
      if (matches) {
        return estado;
      }
    }
    
    return null;
  };

  // Función helper para determinar si un caso está en un estado final (isFinal: true)
  const isEstadoFinal = (casoStatus: string): boolean => {
    if (!estados || estados.length === 0) {
      // Fallback: usar estados hardcodeados si no hay estados del webhook
      const normalizedStatus = normalizeStatus(casoStatus);
      return normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO;
    }
    
    // Buscar el estado del caso en la lista de estados del webhook
    const estadoDelCaso = getEstadoFromWebhook(casoStatus);
    
    if (!estadoDelCaso) {
      // Si no se encuentra el estado, usar fallback
      const normalizedStatus = normalizeStatus(casoStatus);
      return normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO;
    }
    
    // Considerar cerrado si el estado tiene isFinal: true
    return estadoDelCaso.isFinal === true;
  };
  
  // Usar estados finales del webhook para determinar casos cerrados
  const casosCerrados = casosSeguros.filter(c => {
    if (!c) return false;
    const casoStatus = String(c.status || (c as any).estado || '').trim();
    return isEstadoFinal(casoStatus);
  }).length;
  
  const casosAbiertos = casosSeguros.filter(c => {
    if (!c) return false;
    const casoStatus = String(c.status || (c as any).estado || '').trim();
    return !isEstadoFinal(casoStatus);
  }).length;
  
  // Calcular casos críticos usando la misma lógica que AlertasCriticas
  const casosCriticos = casosSeguros.filter(c => {
    if (!c) return false;
    // Excluir casos resueltos o cerrados (a menos que estén escalados)
    const normalizedStatus = normalizeStatus(c.status);
    if (normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO) {
      // Solo incluir si está escalado
      return normalizedStatus === CaseStatus.ESCALADO;
    }
    
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    const diasAbierto = c.diasAbierto || 0;
    
    // Caso crítico si:
    // 1. Los días abiertos son >= al SLA (vencido)
    // 2. Está escalado
    // 3. Le queda 1 día o menos para vencer (en riesgo)
    const isVencido = diasAbierto >= slaDias;
    const isEscalado = normalizedStatus === CaseStatus.ESCALADO;
    const isEnRiesgo = (slaDias - diasAbierto <= 1) && diasAbierto > 0 && diasAbierto < slaDias;
    
    return isVencido || isEscalado || isEnRiesgo;
  }).length;
  
  const casosVencidos = casosSeguros.filter(c => {
    if (!c) return false;
    const normalizedStatus = normalizeStatus(c.status);
    if (normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO) {
      return false;
    }
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    return (c.diasAbierto || 0) > slaDias;
  }).length;
  
  // Calcular casos por estado usando los estados dinámicos del webhook
  const casosPorEstado = useMemo(() => {
    if (!estados || estados.length === 0) {
      // Fallback a estados hardcodeados si no hay estados del webhook
      return {
        nuevo: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.NUEVO;
        }).length,
        enProceso: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.EN_PROCESO;
        }).length,
        pendienteCliente: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.PENDIENTE_CLIENTE;
        }).length,
        escalado: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.ESCALADO;
        }).length,
        resuelto: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.RESUELTO;
        }).length,
        cerrado: casosSeguros.filter(c => {
          if (!c) return false;
          return normalizeStatus(c.status) === CaseStatus.CERRADO;
        }).length
      };
    }

    // Usar estados dinámicos del webhook
    const estadoCounts: Record<string, number> = {};
    estados.forEach(estado => {
      const estadoId = String(estado.id || '').trim();
      const estadoName = String(estado.name || '').trim();
      const estadoNameLower = estadoName.toLowerCase();
      const estadoNameNormalized = estadoNameLower.replace(/\s+/g, '').replace(/[_-]/g, '');
      
      estadoCounts[estadoId] = casosSeguros.filter(c => {
        if (!c) return false;
        
        // Obtener el status del caso (puede venir como status o estado)
        const casoStatus = String(c.status || (c as any).estado || '').trim();
        if (!casoStatus) return false;
        
        const casoStatusLower = casoStatus.toLowerCase();
        const casoStatusNormalized = casoStatusLower.replace(/\s+/g, '').replace(/[_-]/g, '');
        
        // Comparar por ID exacto
        if (estadoId === casoStatus) {
          return true;
        }
        
        // Comparar por nombre exacto (case insensitive)
        if (estadoNameLower === casoStatusLower) {
          return true;
        }
        
        // Comparar por nombre normalizado (sin espacios ni guiones)
        if (estadoNameNormalized === casoStatusNormalized) {
          return true;
        }
        
        // Comparar por ID normalizado (si el estado tiene un ID numérico)
        const estadoIdNum = estadoId.replace(/[^0-9]/g, '');
        const casoStatusNum = casoStatus.replace(/[^0-9]/g, '');
        if (estadoIdNum && casoStatusNum && estadoIdNum === casoStatusNum) {
          return true;
        }
        
        return false;
      }).length;
    });
    
    return estadoCounts;
  }, [casosSeguros, estados]);

  const usuariosSeguros = Array.isArray(usuarios) ? usuarios : [];
  const totalUsuarios = usuariosSeguros.length;
  const usuariosPorRol = {
    admin: usuariosSeguros.filter((u: any) => {
      if (!u) return false;
      const rol = u.rol || u.role || '';
      return String(rol).toUpperCase().includes('ADMIN');
    }).length,
    agente: usuariosSeguros.filter((u: any) => {
      if (!u) return false;
      const rol = u.rol || u.role || '';
      return String(rol).toUpperCase().includes('AGENTE');
    }).length,
    supervisor: usuariosSeguros.filter((u: any) => {
      if (!u) return false;
      const rol = u.rol || u.role || '';
      return String(rol).toUpperCase().includes('SUPERVISOR');
    }).length,
    gerente: usuariosSeguros.filter((u: any) => {
      if (!u) return false;
      const rol = u.rol || u.role || '';
      return String(rol).toUpperCase().includes('GERENTE');
    }).length
  };

  const agentesSeguros = Array.isArray(agentes) ? agentes : [];
  const totalAgentes = agentesSeguros.length;
  const agentesActivos = agentesSeguros.filter(a => a && a.estado === 'Activo').length;
  const agentesInactivos = agentesSeguros.filter(a => a && a.estado !== 'Activo').length;

  const clientesSeguros = Array.isArray(clientes) ? clientes : [];
  const totalClientes = clientesSeguros.length;
  const clientesActivos = clientesSeguros.filter(c => c && c.estado === 'Activo').length;

  const categoriasSeguras = Array.isArray(categorias) ? categorias : [];
  const totalCategorias = categoriasSeguras.length;

  // Datos para gráficas - usar estados dinámicos del webhook
  const casosPorEstadoChart = useMemo(() => {
    if (!estados || estados.length === 0) {
      // Fallback a estados hardcodeados si no hay estados del webhook
      return [
        { name: 'Nuevo', value: casosPorEstado.nuevo || 0, color: '#3b82f6' },
        { name: 'En Proceso', value: casosPorEstado.enProceso || 0, color: '#d97706' },
        { name: 'Pendiente Cliente', value: casosPorEstado.pendienteCliente || 0, color: '#9333ea' },
        { name: 'Escalado', value: casosPorEstado.escalado || 0, color: '#dc2626' },
        { name: 'Resuelto', value: casosPorEstado.resuelto || 0, color: '#16a34a' },
        { name: 'Cerrado', value: casosPorEstado.cerrado || 0, color: '#64748b' }
      ];
    }

    // Colores para los estados (asignar por orden)
    const colors = ['#3b82f6', '#d97706', '#9333ea', '#dc2626', '#16a34a', '#64748b', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1'];
    
    // Ordenar estados por order y crear la gráfica
    const estadosOrdenados = [...estados].sort((a, b) => a.order - b.order);
    
    return estadosOrdenados.map((estado, index) => ({
      name: estado.name,
      value: casosPorEstado[estado.id] || 0,
      color: colors[index % colors.length]
    })).filter(item => item.value > 0 || estados.length <= 10); // Solo mostrar estados con casos o si hay pocos estados
  }, [casosPorEstado, estados]);

  const casosAbiertosCerradosChart = useMemo(() => [
    { name: 'Abiertos', value: casosAbiertos, color: '#3b82f6' },
    { name: 'Cerrados', value: casosCerrados, color: '#16a34a' }
  ], [casosAbiertos, casosCerrados]);

  const usuariosPorRolChart = useMemo(() => [
    { name: 'Agentes', value: usuariosPorRol.agente, color: '#3b82f6' },
    { name: 'Supervisores', value: usuariosPorRol.supervisor, color: '#8b5cf6' },
    { name: 'Gerentes', value: usuariosPorRol.gerente, color: '#22c55e' },
    { name: 'Admin', value: usuariosPorRol.admin, color: '#ef4444' }
  ], [usuariosPorRol]);

  const casosPorCategoriaChart = useMemo(() => {
    try {
      const categoriaCounts: Record<string, number> = {};
      casosSeguros.forEach(caso => {
        if (!caso) return;
        const categoriaNombre = caso.categoria?.nombre || caso.category || 'Sin categoría';
        categoriaCounts[categoriaNombre] = (categoriaCounts[categoriaNombre] || 0) + 1;
      });
      
      const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
      return Object.entries(categoriaCounts).map(([name, value], index) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value,
        color: colors[index % colors.length]
      })).sort((a, b) => b.value - a.value).slice(0, 8);
    } catch (error) {
      console.error('Error calculando casos por categoría:', error);
      return [];
    }
  }, [casosSeguros]);

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
    }
  };

  // Componente Tooltip personalizado para mejor control de estilos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="recharts-custom-tooltip"
          style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            border: `1px solid ${styles.card.borderColor}`,
            borderRadius: '8px',
            padding: '12px',
            boxShadow: theme === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            filter: 'none',
            WebkitFilter: 'none',
            zIndex: 1000
          }}
        >
          <p style={{ 
            color: styles.text.primary, 
            fontWeight: 'bold', 
            marginBottom: '8px',
            fontSize: '12px',
            margin: '0 0 8px 0'
          }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ 
              color: styles.text.primary, 
              fontSize: '12px',
              margin: '4px 0',
              lineHeight: '1.5'
            }}>
              <span style={{ color: entry.color, marginRight: '8px', fontSize: '10px' }}>●</span>
              {entry.name}: <strong style={{ color: styles.text.primary, fontWeight: '600' }}>{entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{backgroundColor: 'rgba(148, 163, 184, 0.1)'}}></div>
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="h-96 rounded-xl animate-pulse" style={{backgroundColor: 'rgba(148, 163, 184, 0.1)'}}></div>
        ))}
      </div>
    );
  }

  // Validar que todos los datos necesarios estén disponibles
  const casosPorEstadoChartSafe = casosPorEstadoChart || [];
  const casosAbiertosCerradosChartSafe = casosAbiertosCerradosChart || [];
  const usuariosPorRolChartSafe = usuariosPorRolChart || [];

  return (
    <div className="space-y-6">
      {/* Métricas Generales del Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Casos */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: 'rgba(59, 130, 246, 0.25)',
            backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.02)'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <Ticket className="w-6 h-6" style={{color: '#3b82f6'}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#3b82f6'}}>
                <AnimatedNumber value={totalCasos} />
              </p>
              <div className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 flex-shrink-0" style={{color: '#3b82f6'}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Total Casos</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                {casosAbiertos} abiertos • {casosCerrados} cerrados • {casosCriticos} críticos
              </p>
            </div>
          </div>
        </div>

        {/* Total de Usuarios */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: 'rgba(139, 92, 246, 0.25)',
            backgroundColor: theme === 'dark' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.02)'
          }}
          onClick={() => navigate('/app/admin/usuarios')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.25)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <Users className="w-6 h-6" style={{color: '#8b5cf6'}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#8b5cf6'}}>
                <AnimatedNumber value={totalUsuarios} />
              </p>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 flex-shrink-0" style={{color: '#8b5cf6'}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Total Usuarios</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                {usuariosPorRol.agente} agentes • {usuariosPorRol.supervisor} supervisores
              </p>
            </div>
          </div>
        </div>

        {/* Total de Agentes */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: 'rgba(34, 197, 94, 0.25)',
            backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.02)'
          }}
          onClick={() => navigate('/app/agentes')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.25)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <UserCheck className="w-6 h-6" style={{color: '#22c55e'}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#22c55e'}}>
                <AnimatedNumber value={totalAgentes} />
              </p>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 flex-shrink-0" style={{color: '#22c55e'}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Total Agentes</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                {agentesActivos} activos • {agentesInactivos} inactivos
              </p>
            </div>
          </div>
        </div>

        {/* Total de Clientes */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: 'rgba(168, 85, 247, 0.25)',
            backgroundColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.02)'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <Building2 className="w-6 h-6" style={{color: '#a855f7'}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: '#a855f7'}}>
                <AnimatedNumber value={totalClientes} />
              </p>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 flex-shrink-0" style={{color: '#a855f7'}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Total Clientes</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                {clientesActivos} activos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas de Casos Críticos y Vencidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Casos Críticos */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: casosCriticos > 0 ? 'rgba(200, 21, 27, 0.25)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: casosCriticos > 0 
              ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.05)' : 'rgba(200, 21, 27, 0.02)')
              : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosCriticos > 0 ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.3)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosCriticos > 0 ? 'rgba(200, 21, 27, 0.25)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <BarChart3 className="w-6 h-6" style={{color: casosCriticos > 0 ? '#f87171' : styles.text.tertiary}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: casosCriticos > 0 ? '#f87171' : styles.text.secondary}}>
                <AnimatedNumber value={casosCriticos} />
              </p>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 flex-shrink-0" style={{color: casosCriticos > 0 ? '#f87171' : styles.text.secondary}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Críticos</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: casosCriticos > 0 ? '#f87171' : styles.text.tertiary}}>
                {casosCriticos > 0 ? 'Requiere acción' : 'Bajo control'}
              </p>
            </div>
          </div>
        </div>

        {/* Casos Vencidos */}
        <div 
          className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: casosVencidos > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: casosVencidos > 0 
              ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.05)' : 'rgba(220, 38, 38, 0.02)')
              : styles.card.backgroundColor
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = casosVencidos > 0 ? 'rgba(220, 38, 38, 0.4)' : 'rgba(148, 163, 184, 0.3)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = casosVencidos > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="absolute top-3 right-3">
            <Ticket className="w-6 h-6" style={{color: casosVencidos > 0 ? '#ef4444' : styles.text.tertiary}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: casosVencidos > 0 ? '#ef4444' : styles.text.secondary}}>
                <AnimatedNumber value={casosVencidos} />
              </p>
              <div className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 flex-shrink-0" style={{color: casosVencidos > 0 ? '#ef4444' : styles.text.secondary}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Casos Vencidos</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: casosVencidos > 0 ? '#ef4444' : styles.text.tertiary}}>
                {casosVencidos > 0 ? 'SLA excedido' : 'En tiempo'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs y Métricas de Rendimiento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SLA Compliance */}
        <div 
          className="p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 80 
              ? 'rgba(34, 197, 94, 0.25)' 
              : kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 60
              ? 'rgba(245, 158, 11, 0.25)'
              : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 80
              ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.02)')
              : kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 60
              ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)')
              : styles.card.backgroundColor
          }}
        >
          <div className="absolute top-3 right-3">
            <BarChart3 className="w-6 h-6" style={{
              color: kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 80 
                ? '#22c55e' 
                : kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 60
                ? '#f59e0b'
                : styles.text.tertiary
            }} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 80 
                  ? '#22c55e' 
                  : kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 60
                  ? '#f59e0b'
                  : styles.text.tertiary
              }}>
                {kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined ? (
                  <>
                    <AnimatedNumber value={kpis.slaCompliance} />%
                  </>
                ) : (
                  'N/A'
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 flex-shrink-0" style={{
                  color: kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 80 
                    ? '#22c55e' 
                    : kpis && kpis.slaCompliance !== null && kpis.slaCompliance !== undefined && kpis.slaCompliance >= 60
                    ? '#f59e0b'
                    : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>SLA Compliance</p>
              </div>
            </div>
          </div>
        </div>

        {/* CSAT Score */}
        <div 
          className="p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 4
              ? 'rgba(34, 197, 94, 0.25)'
              : kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 3
              ? 'rgba(245, 158, 11, 0.25)'
              : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 4
              ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.02)')
              : kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 3
              ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)')
              : styles.card.backgroundColor
          }}
        >
          <div className="absolute top-3 right-3">
            <TrendingUp className="w-6 h-6" style={{
              color: kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 4
                ? '#22c55e'
                : kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 3
                ? '#f59e0b'
                : styles.text.secondary
            }} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{
                color: kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 4
                  ? '#22c55e'
                  : kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 3
                  ? '#f59e0b'
                  : styles.text.primary
              }}>
                {kpis && kpis.csatScore !== null && kpis.csatScore !== undefined ? (
                  <>
                    <AnimatedNumber value={kpis.csatScore} />
                  </>
                ) : (
                  'N/A'
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 flex-shrink-0" style={{
                  color: kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 4
                    ? '#22c55e'
                    : kpis && kpis.csatScore !== null && kpis.csatScore !== undefined && kpis.csatScore >= 3
                    ? '#f59e0b'
                    : styles.text.secondary
                }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>CSAT Score</p>
              </div>
              <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
                Escala 1-5
              </p>
            </div>
          </div>
        </div>

        {/* Total Categorías */}
        <div 
          className="p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden"
          style={{
            ...styles.card,
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}
        >
          <div className="absolute top-3 right-3">
            <FolderOpen className="w-6 h-6" style={{color: styles.text.secondary}} />
          </div>
          <div className="flex items-start justify-between mb-2 pr-8">
            <div className="flex-1">
              <p className="text-4xl font-black leading-none mb-1.5" style={{color: styles.text.primary}}>
                <AnimatedNumber value={totalCategorias} />
              </p>
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 flex-shrink-0" style={{color: styles.text.secondary}} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>Categorías</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficas Visuales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica de Barras - Distribución de Casos por Estado */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden group relative transition-all duration-300"
          style={{
            ...styles.card,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>
                Distribución de Casos por Estado
              </h3>
              <span className="text-xs font-semibold" style={{color: styles.text.tertiary}}>
                Total: {totalCasos}
              </span>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={casosPorEstadoChartSafe}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)'} 
                />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: styles.text.secondary, fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <YAxis 
                  tick={{ fill: styles.text.secondary, fontSize: 11 }} 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} style={{ cursor: 'pointer' }}>
                  {casosPorEstadoChartSafe.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ 
                        filter: theme === 'dark' ? 'none' : 'none',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '1';
                        }
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica de Dona - Casos Abiertos vs Cerrados */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden group relative transition-all duration-300"
          style={{
            ...styles.card,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>
              Casos Abiertos vs Cerrados
            </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={casosAbiertosCerradosChartSafe}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {casosAbiertosCerradosChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              {casosAbiertosCerradosChartSafe.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                  <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                    {item.name}: <span style={{color: styles.text.primary}}>{item.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráfica de Barras Horizontales - Usuarios por Rol */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden group relative transition-all duration-300"
          style={{
            ...styles.card,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>
                Usuarios por Rol
              </h3>
              <span className="text-xs font-semibold" style={{color: styles.text.tertiary}}>
                Total: {totalUsuarios}
              </span>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart layout="vertical" data={usuariosPorRolChart}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)'} 
                />
                <XAxis 
                  type="number" 
                  tick={{ fill: styles.text.secondary, fontSize: 11 }} 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fill: styles.text.secondary, fontSize: 11 }} 
                  width={100}
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} style={{ cursor: 'pointer' }}>
                  {usuariosPorRolChartSafe.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ 
                        filter: theme === 'dark' ? 'none' : 'none',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '1';
                        }
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica de Barras - Casos por Categoría */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden group relative transition-all duration-300"
          style={{
            ...styles.card,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>
                Casos por Categoría
              </h3>
              <span className="text-xs font-semibold" style={{color: styles.text.tertiary}}>
                Top {casosPorCategoriaChart.length}
              </span>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={casosPorCategoriaChart}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)'} 
                />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: styles.text.secondary, fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <YAxis 
                  tick={{ fill: styles.text.secondary, fontSize: 11 }} 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} style={{ cursor: 'pointer' }}>
                  {casosPorCategoriaChart.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ 
                        filter: theme === 'dark' ? 'none' : 'none',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e: any) => {
                        if (e.target) {
                          e.target.style.opacity = '1';
                        }
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

