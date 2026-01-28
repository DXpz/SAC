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
  AlertTriangle,
  Clock,
  Target,
  Activity,
  TrendingUp,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import AnimatedNumber from '../components/AnimatedNumber';
import LoadingScreen from '../components/LoadingScreen';

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
        api.readCategories(), // Usar readCategories para obtener las categorías creadas en Settings
        api.getUsuarios(),
        api.getKPIs(),
        api.readEstados()
      ]);
      
      setClientes(clientesList.status === 'fulfilled' ? clientesList.value : []);
      setAgentes(agentesList.status === 'fulfilled' ? agentesList.value : []);
      
      // Cargar categorías del webhook
      if (categoriasList.status === 'fulfilled' && categoriasList.value) {
        console.log('[AdminPanel.loadData] Categorías recibidas del webhook:', categoriasList.value);
        console.log('[AdminPanel.loadData] Tipo:', typeof categoriasList.value);
        console.log('[AdminPanel.loadData] Es array?', Array.isArray(categoriasList.value));
        console.log('[AdminPanel.loadData] Cantidad:', categoriasList.value?.length || 0);
        setCategorias(categoriasList.value);
      } else {
        console.log('[AdminPanel.loadData] No se pudieron cargar categorías:', categoriasList.status, categoriasList.reason);
        setCategorias([]);
      }
      
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
      // Fallback a estados hardcodeados si no hay estados del webhook - colores mejorados
      return [
        { name: 'Nuevo', value: casosPorEstado.nuevo || 0, color: '#2563eb' },
        { name: 'En Proceso', value: casosPorEstado.enProceso || 0, color: '#f59e0b' },
        { name: 'Pendiente Cliente', value: casosPorEstado.pendienteCliente || 0, color: '#a855f7' },
        { name: 'Escalado', value: casosPorEstado.escalado || 0, color: '#ef4444' },
        { name: 'Resuelto', value: casosPorEstado.resuelto || 0, color: '#10b981' },
        { name: 'Cerrado', value: casosPorEstado.cerrado || 0, color: '#6b7280' }
      ];
    }

    // Colores mejorados para los estados - paleta más vibrante y moderna
    const colors = [
      '#2563eb', // Azul vibrante para Nuevo
      '#f59e0b', // Ámbar dorado para En Proceso
      '#a855f7', // Púrpura vibrante para Pendiente Cliente
      '#ef4444', // Rojo intenso para Escalado
      '#10b981', // Verde esmeralda para Resuelto
      '#6b7280', // Gris para Cerrado
      '#f97316', // Naranja para estados adicionales
      '#ec4899', // Rosa para estados adicionales
      '#06b6d4', // Cyan para estados adicionales
      '#8b5cf6'  // Púrpura claro para estados adicionales
    ];
    
    // Ordenar estados por order y crear la gráfica
    const estadosOrdenados = [...estados].sort((a, b) => a.order - b.order);
    
    return estadosOrdenados.map((estado, index) => ({
      name: estado.name,
      value: casosPorEstado[estado.id] || 0,
      color: colors[index % colors.length]
    })).filter(item => item.value > 0 || estados.length <= 10); // Solo mostrar estados con casos o si hay pocos estados
  }, [casosPorEstado, estados]);

  const casosAbiertosCerradosChart = useMemo(() => [
    { name: 'Abiertos', value: casosAbiertos, color: '#3b82f6' }, // Azul vibrante
    { name: 'Cerrados', value: casosCerrados, color: '#10b981' } // Verde esmeralda
  ], [casosAbiertos, casosCerrados]);

  const usuariosPorRolChart = useMemo(() => [
    { name: 'Agentes', value: usuariosPorRol.agente, color: '#3b82f6' },
    { name: 'Supervisores', value: usuariosPorRol.supervisor, color: '#8b5cf6' },
    { name: 'Gerentes', value: usuariosPorRol.gerente, color: '#22c55e' },
    { name: 'Admin', value: usuariosPorRol.admin, color: '#ef4444' }
  ], [usuariosPorRol]);

  const casosPorCategoriaChart = useMemo(() => {
    try {
      console.log('[AdminPanel] casosPorCategoriaChart - categorias:', categorias);
      console.log('[AdminPanel] casosPorCategoriaChart - casosSeguros count:', casosSeguros.length);
      
      // Si no hay categorías del webhook, usar las categorías de los casos como fallback
      if (!categorias || categorias.length === 0) {
        console.log('[AdminPanel] No hay categorías del webhook, usando categorías de casos');
        const categoriaCounts: Record<string, number> = {};
        casosSeguros.forEach(caso => {
          if (!caso) return;
          const categoriaNombre = caso.categoria?.nombre || caso.category || 'Sin categoría';
          categoriaCounts[categoriaNombre] = (categoriaCounts[categoriaNombre] || 0) + 1;
        });
        
        // Paleta de colores mejorada y más vibrante
        const colors = [
          '#3b82f6', // Azul vibrante
          '#8b5cf6', // Púrpura
          '#10b981', // Verde esmeralda
          '#f59e0b', // Ámbar dorado
          '#ef4444', // Rojo intenso
          '#ec4899', // Rosa
          '#06b6d4', // Cyan
          '#6366f1', // Índigo
          '#f97316', // Naranja
          '#84cc16'  // Verde lima
        ];
        return Object.entries(categoriaCounts).map(([name, value], index) => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          value,
          color: colors[index % colors.length]
        })).sort((a, b) => b.value - a.value).slice(0, 8);
      }

      // Usar las categorías del webhook (las creadas en Settings)
      const categoriaCounts: Record<string, number> = {};
      
      // Inicializar contadores con las categorías del webhook
      categorias.forEach((cat: any) => {
        const categoriaNombre = cat.name || cat.nombre || cat.category_name || cat.caegoria || 'Sin nombre';
        categoriaCounts[categoriaNombre] = 0; // Inicializar en 0
        console.log('[AdminPanel] Inicializando categoría del webhook:', categoriaNombre);
      });
      
      // Contar casos por cada categoría del webhook
      const casosCategorias: string[] = [];
      const categoriasNoEncontradas: Record<string, number> = {}; // Guardar también el conteo
      
      // Función para normalizar nombres para comparación
      const normalizeString = (str: string) => {
        return str.toLowerCase()
          .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
          .replace(/[^\w\sáéíóúñü]/g, '') // Remover caracteres especiales (mantener acentos)
          .trim();
      };
      
      casosSeguros.forEach((caso, index) => {
        if (!caso) return;
        // Los casos tienen category como string (nombre de la categoría)
        const casoCategoriaNombre = String(caso.category || caso.categoria?.nombre || (caso as any).categoriaNombre || '').trim();
        
        // Log específico para casos con "consulta" o "comercial" en la categoría
        if (casoCategoriaNombre && (casoCategoriaNombre.toLowerCase().includes('consulta') || casoCategoriaNombre.toLowerCase().includes('comercial'))) {
          console.log(`[AdminPanel] 🔍 CASO CON CONSULTA/COMERCIAL encontrado:`, {
            casoId: caso.id || caso.ticketNumber,
            categoria: casoCategoriaNombre,
            category: caso.category,
            categoriaObj: caso.categoria,
            casoCompleto: caso
          });
        }
        
        if (casoCategoriaNombre && !casosCategorias.includes(casoCategoriaNombre)) {
          casosCategorias.push(casoCategoriaNombre);
        }
        
        if (!casoCategoriaNombre || casoCategoriaNombre === 'Sin categoría') {
          // Log si el caso no tiene categoría
          if (index < 5) { // Solo log los primeros 5 para no saturar
            console.log(`[AdminPanel] ⚠️ Caso sin categoría:`, {
              casoId: caso.id || caso.ticketNumber,
              category: caso.category,
              categoria: caso.categoria
            });
          }
          return;
        }
        
        // Buscar la categoría del caso en las categorías del webhook
        let encontrada = false;
        for (const cat of categorias) {
          const catNombre = String(cat.name || cat.nombre || cat.category_name || cat.caegoria || '').trim();
          const catId = String(cat.id || cat.idCategoria || cat.category_id || '').trim();
          
          const catNombreNormalized = normalizeString(catNombre);
          const casoCategoriaNormalized = normalizeString(casoCategoriaNombre);
          
          // Comparar por nombre exacto, normalizado, o si contiene el nombre
          if (catNombre === casoCategoriaNombre || 
              catNombreNormalized === casoCategoriaNormalized ||
              catNombre.toLowerCase() === casoCategoriaNombre.toLowerCase() ||
              catNombreNormalized.includes(casoCategoriaNormalized) ||
              casoCategoriaNormalized.includes(catNombreNormalized)) {
            categoriaCounts[catNombre] = (categoriaCounts[catNombre] || 0) + 1;
            console.log(`[AdminPanel] ✅ Caso asignado a categoría "${catNombre}":`, casoCategoriaNombre, '->', catNombre);
            encontrada = true;
            break;
          }
        }
        
        // Si no se encontró en el webhook, agregarla igual para que aparezca en el gráfico
        if (!encontrada) {
          categoriasNoEncontradas[casoCategoriaNombre] = (categoriasNoEncontradas[casoCategoriaNombre] || 0) + 1;
          console.log(`[AdminPanel] ⚠️ Categoría del caso no encontrada en webhook: "${casoCategoriaNombre}"`);
          console.log(`[AdminPanel] Categorías disponibles en webhook:`, categorias.map((c: any) => c.name || c.nombre || c.category_name || c.caegoria || 'Sin nombre'));
        }
      });
      
      // Agregar categorías de casos que no están en el webhook al gráfico
      Object.entries(categoriasNoEncontradas).forEach(([nombre, count]) => {
        categoriaCounts[nombre] = count;
        console.log(`[AdminPanel] ➕ Agregando categoría de caso al gráfico: "${nombre}" con ${count} casos`);
      });
      
      console.log('[AdminPanel] Categorías únicas en casos:', casosCategorias);
      console.log('[AdminPanel] Categorías de casos no encontradas en webhook:', Object.keys(categoriasNoEncontradas));
      console.log('[AdminPanel] categoriaCounts ANTES de crear result:', categoriaCounts);
      
      // Verificar específicamente "consulta comercial"
      if (categoriaCounts['Consulta Comercial'] || categoriaCounts['consulta comercial'] || categoriaCounts['Consulta comercial']) {
        console.log('[AdminPanel] ✅ CONSULTA COMERCIAL encontrada en categoriaCounts!');
      } else {
        console.log('[AdminPanel] ❌ CONSULTA COMERCIAL NO encontrada en categoriaCounts');
        console.log('[AdminPanel] Buscando variaciones...');
        Object.keys(categoriaCounts).forEach(key => {
          if (key.toLowerCase().includes('consulta') || key.toLowerCase().includes('comercial')) {
            console.log(`[AdminPanel] 🔍 Categoría relacionada encontrada: "${key}" con ${categoriaCounts[key]} casos`);
          }
        });
      }
      
      const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
      const result = Object.entries(categoriaCounts)
        .map(([name, value], index) => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          value,
          color: colors[index % colors.length]
        }))
        .sort((a, b) => {
          // Primero ordenar por cantidad (mayor a menor)
          if (b.value !== a.value) {
            return b.value - a.value;
          }
          // Si tienen la misma cantidad, ordenar alfabéticamente
          return a.name.localeCompare(b.name);
        }); // Ordenar por cantidad, pero mostrar todas
      
      console.log('[AdminPanel] casosPorCategoriaChart result:', result);
      console.log('[AdminPanel] Total categorías en gráfico:', result.length);
      console.log('[AdminPanel] Categorías con casos:', result.filter(r => r.value > 0).length);
      console.log('[AdminPanel] Categorías sin casos:', result.filter(r => r.value === 0).length);
      
      // Verificar si "consulta comercial" está en el result final
      const consultaComercialEnResult = result.find(r => 
        r.name.toLowerCase().includes('consulta') && r.name.toLowerCase().includes('comercial')
      );
      if (consultaComercialEnResult) {
        console.log('[AdminPanel] ✅ CONSULTA COMERCIAL EN RESULT FINAL:', consultaComercialEnResult);
      } else {
        console.log('[AdminPanel] ❌ CONSULTA COMERCIAL NO EN RESULT FINAL');
        console.log('[AdminPanel] Nombres en result:', result.map(r => r.name));
      }
      
      return result;
    } catch (error) {
      console.error('Error calculando casos por categoría:', error);
      return [];
    }
  }, [casosSeguros, categorias]);

  // Fechas para cálculos de períodos
  const { inicioHoy, inicioSemana, inicioMes, inicioHoyAnterior, finHoyAnterior, inicioSemanaAnterior, finSemanaAnterior, inicioMesAnterior, finMesAnterior } = useMemo(() => {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    const semana = new Date(ahora);
    semana.setDate(ahora.getDate() - ahora.getDay());
    semana.setHours(0, 0, 0, 0);
    
    const mes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    
    // Períodos anteriores
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    const finAyer = new Date(ayer);
    finAyer.setHours(23, 59, 59, 999);
    
    const semanaAnterior = new Date(ahora);
    const diaSemana = semanaAnterior.getDay();
    semanaAnterior.setDate(semanaAnterior.getDate() - diaSemana - 7);
    semanaAnterior.setHours(0, 0, 0, 0);
    const finSemanaAnterior = new Date(semanaAnterior);
    finSemanaAnterior.setDate(finSemanaAnterior.getDate() + 6);
    finSemanaAnterior.setHours(23, 59, 59, 999);
    
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);
    
    return { 
      inicioHoy: hoy, 
      inicioSemana: semana, 
      inicioMes: mes,
      inicioHoyAnterior: ayer,
      finHoyAnterior: finAyer,
      inicioSemanaAnterior: semanaAnterior,
      finSemanaAnterior: finSemanaAnterior,
      inicioMesAnterior: mesAnterior,
      finMesAnterior: finMesAnterior
    };
  }, []); // Solo calcular una vez al montar el componente
  
  // Métricas adicionales para administrador
  const casosSinAsignar = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      const casoStatus = String(c.status || (c as any).estado || '').trim();
      // Solo contar casos abiertos sin asignar
      if (isEstadoFinal(casoStatus)) return false;
      
      const agenteId = c.agentId || (c as any).agenteAsignado?.idAgente || (c as any).agente_user_id || '';
      const agenteNombre = c.agentName || (c as any).agenteAsignado?.nombre || '';
      return !agenteId && !agenteNombre;
    }).length;
  }, [casosSeguros, estados]);
  
  // Casos nuevos en diferentes períodos
  
  const casosNuevosHoy = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioHoy;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioHoy]);
  
  const casosNuevosSemana = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioSemana;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioSemana]);
  
  const casosNuevosMes = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioMes;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioMes]);

  // Casos nuevos en períodos anteriores para comparación
  const casosNuevosHoyAnterior = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioHoyAnterior && fechaCreacion <= finHoyAnterior;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioHoyAnterior, finHoyAnterior]);

  const casosNuevosSemanaAnterior = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioSemanaAnterior && fechaCreacion <= finSemanaAnterior;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioSemanaAnterior, finSemanaAnterior]);

  const casosNuevosMesAnterior = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioMesAnterior && fechaCreacion <= finMesAnterior;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, inicioMesAnterior, finMesAnterior]);
  
  // Tiempo promedio de resolución (solo casos cerrados)
  const casosResueltos = casosSeguros.filter(c => {
    const casoStatus = String(c.status || (c as any).estado || '').trim();
    return isEstadoFinal(casoStatus);
  });
  
  const tiempoPromedioResolucion = useMemo(() => {
    if (casosResueltos.length === 0) return 0;
    const tiempos = casosResueltos.map(c => {
      if (!c) return null;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return null;
        
        // Buscar fecha de cierre en el historial (última transición a estado final)
        let fechaCierre: Date | null = null;
        if (c.historial && Array.isArray(c.historial) && c.historial.length > 0) {
          // Buscar la última entrada que cambió a un estado final
          const historialOrdenado = [...c.historial].sort((a, b) => {
            const fechaA = new Date(a.fecha || a.date || '');
            const fechaB = new Date(b.fecha || b.date || '');
            return fechaB.getTime() - fechaA.getTime();
          });
          
          for (const entry of historialOrdenado) {
            const estadoEntry = String(entry.estado_nuevo || entry.newStatus || entry.estado || '').trim();
            if (estadoEntry && isEstadoFinal(estadoEntry)) {
              const fechaEntry = new Date(entry.fecha || entry.date || '');
              if (!isNaN(fechaEntry.getTime())) {
                fechaCierre = fechaEntry;
                break;
              }
            }
          }
        }
        
        // Si no hay fecha en historial, usar updatedAt o fechaActualizacion
        if (!fechaCierre) {
          fechaCierre = new Date(c.updatedAt || c.fechaActualizacion || (c as any).fecha_actualizacion || new Date());
        }
        
        if (isNaN(fechaCierre.getTime())) return null;
        
        const dias = Math.floor((fechaCierre.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 0 ? dias : null;
      } catch (error) {
        return null;
      }
    }).filter((t): t is number => t !== null && t > 0);
    
    return tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
  }, [casosResueltos, estados]);
  
  // Tasa de resolución (casos cerrados / total casos)
  const tasaResolucion = totalCasos > 0 ? Math.round((casosCerrados / totalCasos) * 100) : 0;

  // Tiempo promedio de resolución del mes anterior
  const tiempoPromedioResolucionAnterior = useMemo(() => {
    const casosResueltosAnterior = casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const casoStatus = String(c.status || (c as any).estado || '').trim();
        if (!isEstadoFinal(casoStatus)) return false;
        
        // Verificar que se resolvió en el mes anterior
        let fechaCierre: Date | null = null;
        if (c.historial && Array.isArray(c.historial) && c.historial.length > 0) {
          const historialOrdenado = [...c.historial].sort((a, b) => {
            const fechaA = new Date(a.fecha || a.date || '');
            const fechaB = new Date(b.fecha || b.date || '');
            return fechaB.getTime() - fechaA.getTime();
          });
          
          for (const entry of historialOrdenado) {
            const estadoEntry = String(entry.estado_nuevo || entry.newStatus || entry.estado || '').trim();
            if (estadoEntry && isEstadoFinal(estadoEntry)) {
              const fechaEntry = new Date(entry.fecha || entry.date || '');
              if (!isNaN(fechaEntry.getTime())) {
                fechaCierre = fechaEntry;
                break;
              }
            }
          }
        }
        
        if (!fechaCierre) {
          fechaCierre = new Date(c.updatedAt || c.fechaActualizacion || (c as any).fecha_actualizacion || '');
        }
        
        if (isNaN(fechaCierre.getTime())) return false;
        return fechaCierre >= inicioMesAnterior && fechaCierre <= finMesAnterior;
      } catch (error) {
        return false;
      }
    });
    
    if (casosResueltosAnterior.length === 0) return 0;
    
    const tiempos = casosResueltosAnterior.map(c => {
      if (!c) return null;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return null;
        
        let fechaCierre: Date | null = null;
        if (c.historial && Array.isArray(c.historial) && c.historial.length > 0) {
          const historialOrdenado = [...c.historial].sort((a, b) => {
            const fechaA = new Date(a.fecha || a.date || '');
            const fechaB = new Date(b.fecha || b.date || '');
            return fechaB.getTime() - fechaA.getTime();
          });
          
          for (const entry of historialOrdenado) {
            const estadoEntry = String(entry.estado_nuevo || entry.newStatus || entry.estado || '').trim();
            if (estadoEntry && isEstadoFinal(estadoEntry)) {
              const fechaEntry = new Date(entry.fecha || entry.date || '');
              if (!isNaN(fechaEntry.getTime())) {
                fechaCierre = fechaEntry;
                break;
              }
            }
          }
        }
        
        if (!fechaCierre) {
          fechaCierre = new Date(c.updatedAt || c.fechaActualizacion || (c as any).fecha_actualizacion || '');
        }
        
        if (isNaN(fechaCierre.getTime())) return null;
        
        const dias = Math.floor((fechaCierre.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 0 ? dias : null;
      } catch (error) {
        return null;
      }
    }).filter((t): t is number => t !== null && t > 0);
    
    return tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
  }, [casosSeguros, estados, inicioMesAnterior, finMesAnterior]);

  // Tasa de resolución del mes anterior
  const casosCerradosAnterior = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      const casoStatus = String(c.status || (c as any).estado || '').trim();
      if (!isEstadoFinal(casoStatus)) return false;
      
      // Verificar que se cerró en el mes anterior
      try {
        let fechaCierre: Date | null = null;
        if (c.historial && Array.isArray(c.historial) && c.historial.length > 0) {
          const historialOrdenado = [...c.historial].sort((a, b) => {
            const fechaA = new Date(a.fecha || a.date || '');
            const fechaB = new Date(b.fecha || b.date || '');
            return fechaB.getTime() - fechaA.getTime();
          });
          
          for (const entry of historialOrdenado) {
            const estadoEntry = String(entry.estado_nuevo || entry.newStatus || entry.estado || '').trim();
            if (estadoEntry && isEstadoFinal(estadoEntry)) {
              const fechaEntry = new Date(entry.fecha || entry.date || '');
              if (!isNaN(fechaEntry.getTime())) {
                fechaCierre = fechaEntry;
                break;
              }
            }
          }
        }
        
        if (!fechaCierre) {
          fechaCierre = new Date(c.updatedAt || c.fechaActualizacion || (c as any).fecha_actualizacion || '');
        }
        
        if (isNaN(fechaCierre.getTime())) return false;
        return fechaCierre >= inicioMesAnterior && fechaCierre <= finMesAnterior;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, estados, inicioMesAnterior, finMesAnterior]);

  const totalCasosAnterior = useMemo(() => {
    return casosSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date(c.createdAt || c.fechaCreacion || (c as any).fecha_creacion || '');
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion <= finMesAnterior;
      } catch (error) {
        return false;
      }
    }).length;
  }, [casosSeguros, finMesAnterior]);

  const tasaResolucionAnterior = totalCasosAnterior > 0 
    ? Math.round((casosCerradosAnterior / totalCasosAnterior) * 100) 
    : 0;
  
  // Top agentes por casos resueltos
  const topAgentes = useMemo(() => {
    const agenteStats: Record<string, { nombre: string; casosResueltos: number; casosAsignados: number; tiempoPromedio: number }> = {};
    
    // Función helper para encontrar el nombre del agente desde la lista de agentes
    const obtenerNombreAgente = (agenteId: string): string => {
      if (!agenteId || agenteId.trim() === '') return '';
      
      // Buscar en la lista de agentes cargada
      const agenteEncontrado = agentesSeguros.find(a => {
        if (!a) return false;
        const aId = String(a.idAgente || a.id || '').trim();
        const searchId = String(agenteId).trim();
        
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
        return agenteEncontrado.nombre || agenteEncontrado.name || '';
      }
      
      return '';
    };
    
    casosSeguros.forEach(caso => {
      if (!caso) return;
      
      // Buscar agente en múltiples campos posibles
      const agenteId = caso.agentId || 
                      (caso as any).agenteAsignado?.idAgente || 
                      (caso as any).agente_user_id ||
                      (caso as any).agente_id ||
                      '';
      
      if (!agenteId || agenteId.trim() === '') return; // Saltar casos sin agente
      
      // Intentar obtener el nombre desde la lista de agentes primero
      let agenteNombre = obtenerNombreAgente(agenteId);
      
      // Si no se encuentra en la lista, usar el nombre del caso como fallback
      if (!agenteNombre || agenteNombre.trim() === '') {
        agenteNombre = caso.agentName || 
                      (caso as any).agenteAsignado?.nombre || 
                      (caso as any).agente_nombre ||
                      (caso as any).nombre_agente ||
                      '';
      }
      
      // Si aún no hay nombre, usar el ID del agente en lugar de "Sin asignar"
      if (!agenteNombre || agenteNombre.trim() === '') {
        agenteNombre = `Agente ${agenteId}`;
      }
      
      if (!agenteStats[agenteId]) {
        agenteStats[agenteId] = {
          nombre: agenteNombre,
          casosResueltos: 0,
          casosAsignados: 0,
          tiempoPromedio: 0
        };
      }
      
      agenteStats[agenteId].casosAsignados++;
      
      const casoStatus = String(caso.status || (caso as any).estado || '').trim();
      if (isEstadoFinal(casoStatus)) {
        agenteStats[agenteId].casosResueltos++;
      }
    });
    
    return Object.values(agenteStats)
      .filter(a => a.casosResueltos > 0 || a.casosAsignados > 0) // Solo agentes con casos
      .sort((a, b) => {
        // Primero por casos resueltos, luego por casos asignados
        if (b.casosResueltos !== a.casosResueltos) {
          return b.casosResueltos - a.casosResueltos;
        }
        return b.casosAsignados - a.casosAsignados;
      })
      .slice(0, 5);
  }, [casosSeguros, estados, agentesSeguros]);
  
  // Agentes sobrecargados (más de 10 casos asignados)
  const agentesSobrecargados = useMemo(() => {
    const agenteCarga: Record<string, { nombre: string; casos: number }> = {};
    
    // Función helper para encontrar el nombre del agente desde la lista de agentes
    const obtenerNombreAgente = (agenteId: string): string => {
      if (!agenteId || agenteId.trim() === '') return '';
      
      // Buscar en la lista de agentes cargada
      const agenteEncontrado = agentesSeguros.find(a => {
        if (!a) return false;
        const aId = String(a.idAgente || a.id || '').trim();
        const searchId = String(agenteId).trim();
        
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
        return agenteEncontrado.nombre || agenteEncontrado.name || '';
      }
      
      return '';
    };
    
    casosSeguros.forEach(caso => {
      if (!caso) return;
      
      const casoStatus = String(caso.status || (caso as any).estado || '').trim();
      if (!isEstadoFinal(casoStatus)) {
        // Buscar agente en múltiples campos posibles
        const agenteId = caso.agentId || 
                        (caso as any).agenteAsignado?.idAgente || 
                        (caso as any).agente_user_id ||
                        (caso as any).agente_id ||
                        '';
        
        if (!agenteId || agenteId.trim() === '') return; // Saltar casos sin agente
        
        // Intentar obtener el nombre desde la lista de agentes primero
        let agenteNombre = obtenerNombreAgente(agenteId);
        
        // Si no se encuentra en la lista, usar el nombre del caso como fallback
        if (!agenteNombre || agenteNombre.trim() === '') {
          agenteNombre = caso.agentName || 
                        (caso as any).agenteAsignado?.nombre || 
                        (caso as any).agente_nombre ||
                        (caso as any).nombre_agente ||
                        '';
        }
        
        // Si aún no hay nombre, usar el ID del agente en lugar de "Sin asignar"
        if (!agenteNombre || agenteNombre.trim() === '') {
          agenteNombre = `Agente ${agenteId}`;
        }
        
        if (!agenteCarga[agenteId]) {
          agenteCarga[agenteId] = { nombre: agenteNombre, casos: 0 };
        }
        agenteCarga[agenteId].casos++;
      }
    });
    
    return Object.values(agenteCarga)
      .filter(a => a.casos > 10)
      .sort((a, b) => b.casos - a.casos);
  }, [casosSeguros, estados, agentesSeguros]);
  
  // Clientes más activos
  const clientesMasActivos = useMemo(() => {
    const clienteStats: Record<string, { nombre: string; casos: number; casosAbiertos: number }> = {};
    
    casosSeguros.forEach(caso => {
      if (!caso) return;
      
      // Buscar cliente en múltiples campos posibles
      const clienteId = caso.clientId || 
                       (caso as any).cliente?.idCliente || 
                       (caso as any).cliente_id ||
                       '';
      
      const clienteNombre = caso.clientName || 
                           (caso as any).cliente?.nombreEmpresa || 
                           (caso as any).cliente_nombre ||
                           (caso as any).nombre_cliente ||
                           (caso as any).nombreEmpresa ||
                           'Sin cliente';
      
      if (clienteId && clienteId.trim() !== '') {
        if (!clienteStats[clienteId]) {
          clienteStats[clienteId] = {
            nombre: clienteNombre || 'Sin nombre',
            casos: 0,
            casosAbiertos: 0
          };
        }
        
        clienteStats[clienteId].casos++;
        
        const casoStatus = String(caso.status || (caso as any).estado || '').trim();
        if (!isEstadoFinal(casoStatus)) {
          clienteStats[clienteId].casosAbiertos++;
        }
      }
    });
    
    return Object.values(clienteStats)
      .filter(c => c.casos > 0) // Solo clientes con casos
      .sort((a, b) => b.casos - a.casos)
      .slice(0, 5);
  }, [casosSeguros, estados]);
  
  // Nuevos clientes (creados en el último mes)
  const nuevosClientes = useMemo(() => {
    return clientesSeguros.filter(c => {
      if (!c) return false;
      try {
        const fechaCreacion = new Date((c as any).fechaCreacion || 
                                      (c as any).createdAt || 
                                      (c as any).fecha_creacion || 
                                      new Date());
        if (isNaN(fechaCreacion.getTime())) return false;
        return fechaCreacion >= inicioMes;
      } catch (error) {
        return false;
      }
    }).length;
  }, [clientesSeguros, inicioMes]);

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
    }
  };

  // Componente Tooltip personalizado para mejor control de estilos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="recharts-custom-tooltip"
          style={{
            backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
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
    return <LoadingScreen message="Cargando Panel de Administración..." />;
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.05s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.1s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/usuarios')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.15s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/usuarios')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.2s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.25s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.3s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={() => navigate('/app/admin/casos')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.35s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            backgroundColor: styles.card.backgroundColor,
            animation: 'fadeInSlide 0.3s ease-out 0.4s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '';
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
            borderColor: 'rgba(71, 85, 105, 0.3)',
            animation: 'fadeInSlide 0.3s ease-out 0.45s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
            e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '';
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
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInSlide 0.3s ease-out 0.5s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1.01)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
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
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInSlide 0.3s ease-out 0.55s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1.01)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
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
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInSlide 0.3s ease-out 0.6s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1.01)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
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
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInSlide 0.3s ease-out 0.65s both',
            transform: 'scale(1)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = theme === 'dark' 
              ? '0 8px 24px rgba(0, 0, 0, 0.4)' 
              : '0 8px 24px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1.01)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
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

      {/* Sección de Alertas Críticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas Críticas */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden"
          style={{
            ...styles.card,
            animation: 'fadeInSlide 0.3s ease-out 0.7s both'
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{color: styles.text.secondary}}>
                <AlertTriangle className="w-4 h-4" style={{color: casosCriticos > 0 ? '#ef4444' : styles.text.tertiary}} />
                Alertas Críticas
              </h3>
              <button
                onClick={() => navigate('/app/alertas')}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                  color: '#ef4444'
                }}
              >
                Ver todos
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div 
              className="p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]"
              onClick={() => navigate('/app/admin/casos?filter=criticos')}
              style={{
                backgroundColor: casosCriticos > 0 
                  ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)')
                  : 'transparent',
                borderColor: casosCriticos > 0 ? 'rgba(239, 68, 68, 0.3)' : styles.card.borderColor
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{color: casosCriticos > 0 ? '#ef4444' : styles.text.tertiary}} />
                  <span className="text-sm font-semibold" style={{color: styles.text.primary}}>Casos Críticos</span>
                </div>
                <span className="text-lg font-black" style={{color: casosCriticos > 0 ? '#ef4444' : styles.text.secondary}}>
                  {casosCriticos}
                </span>
              </div>
            </div>
            <div 
              className="p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]"
              onClick={() => navigate('/app/admin/casos?filter=vencidos')}
              style={{
                backgroundColor: casosVencidos > 0 
                  ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.05)')
                  : 'transparent',
                borderColor: casosVencidos > 0 ? 'rgba(220, 38, 38, 0.3)' : styles.card.borderColor
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{color: casosVencidos > 0 ? '#dc2626' : styles.text.tertiary}} />
                  <span className="text-sm font-semibold" style={{color: styles.text.primary}}>Casos Vencidos</span>
                </div>
                <span className="text-lg font-black" style={{color: casosVencidos > 0 ? '#dc2626' : styles.text.secondary}}>
                  {casosVencidos}
                </span>
              </div>
            </div>
            <div 
              className="p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]"
              onClick={() => navigate('/app/admin/casos?filter=sin-asignar')}
              style={{
                backgroundColor: casosSinAsignar > 0 
                  ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)')
                  : 'transparent',
                borderColor: casosSinAsignar > 0 ? 'rgba(245, 158, 11, 0.3)' : styles.card.borderColor
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" style={{color: casosSinAsignar > 0 ? '#f59e0b' : styles.text.tertiary}} />
                  <span className="text-sm font-semibold" style={{color: styles.text.primary}}>Sin Asignar</span>
                </div>
                <span className="text-lg font-black" style={{color: casosSinAsignar > 0 ? '#f59e0b' : styles.text.secondary}}>
                  {casosSinAsignar}
                </span>
              </div>
            </div>
            {agentesSobrecargados.length > 0 && (
              <div 
                className="p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]"
                onClick={() => navigate('/app/admin/usuarios')}
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)',
                  borderColor: 'rgba(168, 85, 247, 0.3)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{color: '#a855f7'}} />
                    <span className="text-sm font-semibold" style={{color: styles.text.primary}}>Agentes Sobrecargados</span>
                  </div>
                  <span className="text-lg font-black" style={{color: '#a855f7'}}>
                    {agentesSobrecargados.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Agentes */}
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden"
          style={{
            ...styles.card,
            animation: 'fadeInSlide 0.3s ease-out 0.8s both'
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{color: styles.text.secondary}}>
                <Target className="w-4 h-4" />
                Top Agentes
              </h3>
              <button
                onClick={() => navigate('/app/admin/usuarios')}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                  color: '#22c55e'
                }}
              >
                Ver todos
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {topAgentes.length > 0 ? (
              topAgentes.map((agente, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => navigate('/app/admin/usuarios')}
                  style={{
                    backgroundColor: index === 0 
                      ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                      : 'transparent',
                    borderColor: index === 0 ? 'rgba(34, 197, 94, 0.3)' : styles.card.borderColor
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{
                          backgroundColor: index === 0 ? '#22c55e' : index === 1 ? '#3b82f6' : index === 2 ? '#8b5cf6' : styles.card.borderColor,
                          color: '#ffffff'
                        }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold truncate" style={{color: styles.text.primary}}>
                        {agente.nombre}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black" style={{color: '#22c55e'}}>
                          {agente.casosResueltos}
                        </div>
                        <div className="text-[10px]" style={{color: styles.text.tertiary}}>
                          resueltos
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-sm" style={{color: styles.text.tertiary}}>
                No hay datos de agentes disponibles
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clientes Más Activos */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div 
          className="rounded-3xl shadow-xl border overflow-hidden"
          style={{
            ...styles.card,
            animation: 'fadeInSlide 0.3s ease-out 0.85s both'
          }}
        >
          <div className="p-4 border-b" style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)'
          }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{color: styles.text.secondary}}>
                <Building2 className="w-4 h-4" />
                Clientes Más Activos
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                  backgroundColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)',
                  color: '#a855f7'
                }}>
                  {nuevosClientes} nuevos
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {clientesMasActivos.length > 0 ? (
              clientesMasActivos.map((cliente, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => navigate(`/app/admin/casos?cliente=${cliente.nombre}`)}
                  style={{
                    borderColor: styles.card.borderColor
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{color: styles.text.primary}}>
                        {cliente.nombre}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs" style={{color: styles.text.secondary}}>
                          {cliente.casos} casos
                        </span>
                        {cliente.casosAbiertos > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{
                            backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                            color: '#ef4444'
                          }}>
                            {cliente.casosAbiertos} abiertos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-sm" style={{color: styles.text.tertiary}}>
                No hay datos de clientes disponibles
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

