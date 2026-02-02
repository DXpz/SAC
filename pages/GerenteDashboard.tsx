import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, KPI } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Clock, ThumbsUp, ArrowUp, ArrowDown, Info, AlertTriangle, CheckCircle2, Filter, Zap, Target, TrendingDown, Shield, Activity } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

type PeriodFilter = 'hoy' | 'semana' | 'mes';

const GerenteDashboard: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [kpis, setKpis] = useState<KPI>({ totalCases: 0, slaCompliance: 0, csatScore: 0 });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoy');
  const [loading, setLoading] = useState(true);
  const [hoveredKPI, setHoveredKPI] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [gerenteCountry, setGerenteCountry] = useState<'SV' | 'GT' | null>(null);
  const { theme } = useTheme();
  const location = useLocation();

  // Función para normalizar el estado del caso (debe estar antes de loadData)
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

  // Función helper para obtener y normalizar el país del gerente
  const getGerenteCountry = async (): Promise<'SV' | 'GT' | null> => {
    try {
      // Primero intentar desde api.getUser() que puede tener datos más actualizados
      const currentUser = api.getUser();
      let pais = currentUser?.pais || '';
      
      // Si el país es string vacío, tratarlo como undefined
      if (pais && String(pais).trim() !== '') {
        const paisNormalizado = String(pais).trim().toUpperCase();
        
        if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
          console.log('[GerenteDashboard] ✅ País del gerente desde api.getUser(): SV');
          return 'SV';
        }
        if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
          console.log('[GerenteDashboard] ✅ País del gerente desde api.getUser(): GT');
          return 'GT';
        }
      }
      
      // Fallback: leer desde localStorage directamente
      const userStr = localStorage.getItem('intelfon_user');
      if (!userStr) {
        console.error('[GerenteDashboard] No se encontró usuario en localStorage');
        return null;
      }
      
      const user = JSON.parse(userStr);
      pais = user.pais || user.country || '';
      
      // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
      if (!pais || String(pais).trim() === '') {
        console.log('[GerenteDashboard] 🔍 País no encontrado en localStorage, buscando en lista de usuarios...');
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
            console.log('[GerenteDashboard] ✅ País encontrado en lista de usuarios:', {
              usuarioId: usuarioCompleto.id || usuarioCompleto.idAgente,
              usuarioNombre: usuarioCompleto.nombre || usuarioCompleto.name,
              pais: pais
            });
            
            // Si encontramos el país, actualizar el usuario en localStorage
            if (pais && String(pais).trim() !== '') {
              const updatedUser = { ...user, pais: pais };
              localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
              console.log('[GerenteDashboard] ✅ País actualizado en localStorage');
            }
          } else {
            console.warn('[GerenteDashboard] ⚠️ Usuario no encontrado en lista de usuarios');
          }
        } catch (error) {
          console.error('[GerenteDashboard] Error obteniendo lista de usuarios:', error);
        }
      }
      
      // Validar que el país no sea string vacío
      if (!pais || String(pais).trim() === '') {
        console.error('[GerenteDashboard] ⚠️ Gerente NO tiene país definido!', user);
        return null;
      }
      
      // Normalizar a códigos de 2 letras
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      // El Salvador: SV, El_Salvador, El Salvador, etc.
      if (paisNormalizado === 'SV' || 
          paisNormalizado === 'EL_SALVADOR' || 
          paisNormalizado === 'EL SALVADOR' ||
          paisNormalizado.includes('SALVADOR')) {
        console.log('[GerenteDashboard] ✅ País normalizado: SV');
        return 'SV';
      }
      
      // Guatemala: GT, Guatemala, etc.
      if (paisNormalizado === 'GT' || 
          paisNormalizado === 'GUATEMALA' ||
          paisNormalizado.includes('GUATEMALA')) {
        console.log('[GerenteDashboard] ✅ País normalizado: GT');
        return 'GT';
      }
      
      console.error('[GerenteDashboard] ⚠️ País no reconocido:', paisNormalizado);
      return null;
    } catch (error) {
      console.error('[GerenteDashboard] ❌ Error obteniendo país del gerente:', error);
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

  useEffect(() => {
    // Cargar el país del gerente al montar el componente
    const loadGerenteCountry = async () => {
      const currentUser = api.getUser();
      if (currentUser?.role === 'GERENTE') {
        const country = await getGerenteCountry();
        setGerenteCountry(country);
        console.log('[GerenteDashboard] País del gerente cargado:', country);
      }
    };
    
    loadGerenteCountry();
    loadData();
    // Ya no usamos setInterval, solo actualizamos cuando cambia la vista
  }, [location.pathname]);

  const loadClientes = async () => {
    try {
      const clientesList = await api.getClientes();
      return clientesList;
    } catch (error) {
      return [];
    }
  };

  const enrichCasesWithClients = (cases: Case[], clientesList: any[]): Case[] => {
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
      const [casosData, clientesList] = await Promise.all([
        api.getCases(),
        loadClientes()
      ]);
      
      // Verificar que los casos tengan datos válidos
      const casosValidos = casosData.filter(c => c && c.id);
      
      // Enriquecer casos con datos de clientes (igual que en otras pantallas)
      const enriched = enrichCasesWithClients(casosValidos, clientesList);
      
      setCasos(enriched);
      // Los KPIs se calcularán en useMemo basados en casos filtrados por país
      // No necesitamos setKpis aquí, se calculará automáticamente
      
      // Guardar en localStorage para que Layout pueda mostrarlo en el header
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
    } catch (error) {
      // En caso de error, mantener los casos anteriores o establecer array vacío
      if (casos.length === 0) {
        setCasos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtrar casos por país del gerente (sin filtro de fecha) para calcular métricas
  const casosFiltradosPorPais = useMemo(() => {
    const currentUser = api.getUser();
    const isGerente = currentUser?.role === 'GERENTE';
    
    let casosFiltrados = casos;
    
    // Si es GERENTE, filtrar casos por país del gerente (OBLIGATORIO)
    if (isGerente && gerenteCountry) {
      casosFiltrados = casos.filter(caso => {
        // Obtener el país del caso desde diferentes fuentes posibles
        const casoPais = (caso as any).pais || 
                        caso.cliente?.pais || 
                        (caso as any).country ||
                        '';
        
        const casoPaisNormalizado = normalizeCaseCountry(casoPais);
        
        // Si el caso no tiene país definido, NO incluirlo
        if (!casoPaisNormalizado) {
          return false;
        }
        
        // Solo incluir casos del mismo país que el gerente
        return casoPaisNormalizado === gerenteCountry;
      });
    } else if (isGerente && !gerenteCountry) {
      // Si el gerente no tiene país, NO mostrar ningún caso
      casosFiltrados = [];
    }
    
    return casosFiltrados;
  }, [casos, gerenteCountry]);

  // Filtrar casos críticos usando la misma lógica que Alertas Críticas (basado en casos filtrados por país)
  const casosCriticos = useMemo(() => {
    return casosFiltradosPorPais.filter(c => {
      // Excluir casos resueltos o cerrados
      const normalizedStatus = normalizeStatus(c.status);
      if (normalizedStatus === CaseStatus.RESUELTO || normalizedStatus === CaseStatus.CERRADO) {
        return false;
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
    });
  }, [casosFiltradosPorPais]);

  const filteredCasos = useMemo(() => {
    const currentUser = api.getUser();
    const isGerente = currentUser?.role === 'GERENTE';
    
    let casosFiltrados = casos;
    
    // Si es GERENTE, filtrar casos por país del gerente (OBLIGATORIO)
    if (isGerente && gerenteCountry) {
      console.log('[GerenteDashboard] Gerente detectado, filtrando casos por país:', gerenteCountry);
      
      casosFiltrados = casos.filter(caso => {
        // Obtener el país del caso desde diferentes fuentes posibles
        const casoPais = (caso as any).pais || 
                        caso.cliente?.pais || 
                        (caso as any).country ||
                        '';
        
        const casoPaisNormalizado = normalizeCaseCountry(casoPais);
        
        // Si el caso no tiene país definido, NO mostrarlo al gerente
        if (!casoPaisNormalizado) {
          console.log('[GerenteDashboard] ❌ Caso SIN país definido, FILTRANDO:', {
            casoId: caso.id,
            casoTicket: caso.ticketNumber,
            casoPais: casoPais
          });
          return false;
        }
        
        // Solo mostrar casos del mismo país que el gerente
        const matches = casoPaisNormalizado === gerenteCountry;
        
        if (!matches) {
          console.log('[GerenteDashboard] ❌ Caso filtrado por país (NO coincide):', {
            casoId: caso.id,
            casoTicket: caso.ticketNumber,
            casoPais: casoPais,
            casoPaisNormalizado: casoPaisNormalizado,
            gerenteCountry: gerenteCountry,
            matches: false
          });
          return false;
        }
        
        console.log('[GerenteDashboard] ✅ Caso ACEPTADO (país coincide):', {
          casoId: caso.id,
          casoTicket: caso.ticketNumber,
          casoPais: casoPais,
          casoPaisNormalizado: casoPaisNormalizado,
          gerenteCountry: gerenteCountry,
          matches: true
        });
        
        return true;
      });
      
      console.log('[GerenteDashboard] 📊 RESUMEN - Casos después de filtrar por país:', {
        totalAntes: casos.length,
        totalDespues: casosFiltrados.length,
        gerenteCountry: gerenteCountry,
        casosFiltrados: casosFiltrados.map(c => ({ 
          id: c.id, 
          ticket: c.ticketNumber, 
          pais: (c as any).pais || c.cliente?.pais || 'SIN PAÍS' 
        }))
      });
    } else if (isGerente && !gerenteCountry) {
      console.error('[GerenteDashboard] ⚠️ ERROR: Gerente sin país definido!', {
        user: currentUser,
        userPais: currentUser?.pais
      });
      // Si el gerente no tiene país, NO mostrar ningún caso (más seguro)
      casosFiltrados = [];
    }
    
    // Aplicar filtro de fecha
    const now = new Date();
    let startDate = new Date();

    if (periodFilter === 'hoy') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (periodFilter === 'semana') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
      startDate.setHours(0, 0, 0, 0);
    } else if (periodFilter === 'mes') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return casosFiltrados.filter(c => new Date(c.createdAt) >= startDate);
  }, [casos, periodFilter, gerenteCountry]);

  // Calcular KPIs basados en casos filtrados por país
  const kpisFiltrados = useMemo(() => {
    const casosParaKPIs = casosFiltradosPorPais;
    
    // Calcular SLA Compliance basado en casos filtrados por país
    const casosConSLA = casosParaKPIs.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto !== undefined && slaDias > 0;
    });
    
    const casosCumplenSLA = casosConSLA.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto < slaDias;
    });
    
    // Si no hay casos con SLA, no puede ser 100%, debe ser null o 0
    const slaCompliance = casosConSLA.length > 0 
      ? Math.round((casosCumplenSLA.length / casosConSLA.length) * 100)
      : null;
    
    // Calcular CSAT promedio si está disponible en los casos filtrados
    const casosConCSAT = casosParaKPIs.filter(c => {
      const csat = (c as any).csat_rating || (c as any).csatRating || (c as any).csat;
      return csat && !isNaN(parseFloat(csat)) && parseFloat(csat) > 0;
    });
    
    // Si no hay datos de CSAT, retornar null
    const csatScore = casosConCSAT.length > 0
      ? casosConCSAT.reduce((sum, c) => {
          const csat = parseFloat((c as any).csat_rating || (c as any).csatRating || (c as any).csat || '0');
          return sum + csat;
        }, 0) / casosConCSAT.length
      : null;
    
    return {
      totalCases: casosParaKPIs.length,
      slaCompliance,
      csatScore: csatScore !== null ? Math.round(csatScore * 10) / 10 : null // Redondear a 1 decimal
    };
  }, [casosFiltradosPorPais]);

  // Usar datos reales de casos críticos (basados en casos filtrados por país)
  const abiertos = casosFiltradosPorPais.filter(c => {
    const normalizedStatus = normalizeStatus(c.status);
    return normalizedStatus !== CaseStatus.CERRADO && normalizedStatus !== CaseStatus.RESUELTO;
  }).length;
  const vencidos = casosCriticos.filter(c => {
    const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
    return c.diasAbierto >= slaDias;
  }).length;
  const escalados = casosCriticos.filter(c => normalizeStatus(c.status) === CaseStatus.ESCALADO).length;
  
  // Calcular variaciones reales comparando con períodos anteriores
  const getVariation = (current: number, label: string) => {
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;
    let periodLabel: string;
    let prevPeriodLabel: string;

    if (periodFilter === 'hoy') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
      prevStartDate = new Date(now);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(prevStartDate);
      prevEndDate.setHours(23, 59, 59, 999);
      periodLabel = 'hoy';
      prevPeriodLabel = 'ayer';
    } else if (periodFilter === 'semana') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
      startDate.setHours(0, 0, 0, 0);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
      periodLabel = 'esta semana';
      prevPeriodLabel = 'semana anterior';
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
      prevEndDate.setHours(23, 59, 59, 999);
      periodLabel = 'este mes';
      prevPeriodLabel = 'mes anterior';
    }

    // Calcular casos del período anterior
    const casosPeriodoAnterior = casos.filter(c => {
      const fechaCreacion = new Date(c.createdAt);
      return fechaCreacion >= prevStartDate && fechaCreacion <= prevEndDate;
    });

    // Calcular valor del período anterior según el tipo de métrica
    let prevValue = 0;
    if (label === 'Casos Abiertos') {
      // Para casos abiertos, contar casos que estaban abiertos al final del período anterior
      prevValue = casosPeriodoAnterior.filter(c => {
        const normalizedStatus = normalizeStatus(c.status);
        return normalizedStatus !== CaseStatus.CERRADO && normalizedStatus !== CaseStatus.RESUELTO;
      }).length;
    } else if (label === 'Excedidos SLA') {
      // Para excedidos SLA, contar casos que excedieron SLA en el período anterior
      prevValue = casosPeriodoAnterior.filter(c => {
        const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
        const fechaCreacion = new Date(c.createdAt);
        const diasAbiertoAlFinalPeriodo = Math.floor((prevEndDate.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
        return diasAbiertoAlFinalPeriodo >= slaDias;
      }).length;
    }

    const diff = current - prevValue;
    const percent = prevValue > 0 ? ((diff / prevValue) * 100).toFixed(0) : null;

    return {
      value: diff > 0 ? `+${diff} ${periodLabel}` : diff < 0 ? `${diff} ${periodLabel}` : 'Sin cambios',
      percent: percent ? `${diff > 0 ? '+' : ''}${percent}% vs ${prevPeriodLabel}` : null,
      isPositive: diff >= 0,
      isNegative: diff < 0
    };
  };

  const abiertosVar = getVariation(abiertos, 'Casos Abiertos');
  const vencidosVar = getVariation(vencidos, 'Excedidos SLA');
  
  // Calcular variación de CSAT (si hay datos históricos disponibles)
  // Por ahora, si no hay datos históricos, mostrar sin variación
  const csatVar = {
    value: 'Sin datos históricos',
    percent: null,
    isPositive: true,
    isNegative: false
  };
  
  // Calcular variación del total histórico basado en casos filtrados
  const historicoVar = {
    value: `${filteredCasos.length} en ${periodFilter === 'hoy' ? 'hoy' : periodFilter === 'semana' ? 'esta semana' : 'este mes'}`,
    percent: null,
    isPositive: true,
    isNegative: false
  };

  // Usar todos los casos, no solo los filtrados por período, para la distribución
  // Normalizar estados antes de comparar para que coincidan con los valores del webhook
  // Incluir TODOS los estados posibles del webhook
  const chartData = useMemo(() => {
    const data = [
      { name: 'Nuevos', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.NUEVO).length },
      { name: 'En Proceso', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.EN_PROCESO).length },
      { name: 'Pendiente Cliente', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.PENDIENTE_CLIENTE).length },
      { name: 'Escalados', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.ESCALADO).length },
      { name: 'Resueltos', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.RESUELTO).length },
      { name: 'Cerrados', value: casosFiltradosPorPais.filter(c => normalizeStatus(c.status) === CaseStatus.CERRADO).length },
    ];
    
    return data;
  }, [casosFiltradosPorPais]);

  // El total debe ser TODOS los casos, no solo los del gráfico
  const totalCasos = casosFiltradosPorPais.length;

  const chartDataWithPercent = useMemo(() => chartData.map(item => ({
    ...item,
    percent: totalCasos > 0 ? ((item.value / totalCasos) * 100).toFixed(1) : '0.0'
  })), [chartData, totalCasos]);

  // Colores para cada estado: paleta más minimalista y consistente (azules/violetas suaves)
  const COLORS = ['#3b82f6', '#6366f1', '#0ea5e9', '#22c55e', '#a855f7', '#64748b'];

  const slaObjective = 90;
  const slaStatus = kpisFiltrados.slaCompliance === null ? 'sin_datos' :
                     kpisFiltrados.slaCompliance >= slaObjective ? 'en_cumplimiento' : 
                     kpisFiltrados.slaCompliance >= slaObjective - 10 ? 'riesgo' : 'debajo_objetivo';
  
  const slaColor = slaStatus === 'sin_datos' ? 'border-slate-500' :
                   slaStatus === 'en_cumplimiento' ? 'border-green-500' :
                   slaStatus === 'riesgo' ? 'border-amber-500' : 'border-red-500';

  const slaText = slaStatus === 'sin_datos' ? 'Sin datos disponibles' :
                  slaStatus === 'en_cumplimiento' ? 'En cumplimiento' :
                  slaStatus === 'riesgo' ? 'Por debajo del objetivo' : 'Requiere atención';

  // Función para obtener el color progresivo según el porcentaje
  const getSLAProgressiveColor = (compliance: number | null) => {
    if (compliance === null) return { from: '#94a3b8', to: '#cbd5e1' }; // Gris
    if (compliance >= 90) return { from: '#22c55e', to: '#4ade80' }; // Verde
    if (compliance >= 80) return { from: '#eab308', to: '#fbbf24' }; // Amarillo
    if (compliance >= 70) return { from: '#f97316', to: '#fb923c' }; // Naranja
    return { from: '#dc2626', to: '#ef4444' }; // Rojo
  };

  const slaProgressColor = getSLAProgressiveColor(kpisFiltrados.slaCompliance);

  // Generar insights mejorados con más contexto y estructura
  const insights = useMemo(() => {
    const insightsList: Array<{
      type: 'critical' | 'warning' | 'success' | 'info';
      title: string;
      description: string;
      value?: string | number;
      icon: React.ElementType;
      color: string;
    }> = [];
    
    const casosFueraSLA = casosCriticos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto >= slaDias;
    });
    const casosVencen24h = casosCriticos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasRestantes = slaDias - c.diasAbierto;
      return diasRestantes > 0 && diasRestantes <= 1;
    });
    
    // Casos fuera de SLA - Crítico
    if (casosFueraSLA.length > 0) {
      insightsList.push({
        type: 'critical',
        title: 'Casos Fuera de SLA',
        description: `${casosFueraSLA.length} caso${casosFueraSLA.length !== 1 ? 's' : ''} han excedido el tiempo de resolución comprometido`,
        value: casosFueraSLA.length,
        icon: AlertTriangle,
        color: '#ef4444'
      });
    }
    
    // Casos escalados - Crítico
    if (escalados > 0) {
      insightsList.push({
        type: 'critical',
        title: 'Casos Escalados',
        description: `${escalados} caso${escalados !== 1 ? 's' : ''} ${escalados !== 1 ? 'requieren' : 'requiere'} atención inmediata`,
        value: escalados,
        icon: Zap,
        color: '#f59e0b'
      });
    }
    
    // Casos que vencen en 24h - Advertencia
    if (casosVencen24h.length > 0) {
      insightsList.push({
        type: 'warning',
        title: 'Vencimiento Inminente',
        description: `${casosVencen24h.length} caso${casosVencen24h.length !== 1 ? 's' : ''} vence${casosVencen24h.length !== 1 ? 'n' : ''} en las próximas 24 horas`,
        value: casosVencen24h.length,
        icon: Clock,
        color: '#f59e0b'
      });
    }
    
    // SLA Compliance
    if (kpisFiltrados.slaCompliance !== null) {
      if (kpisFiltrados.slaCompliance >= slaObjective) {
        insightsList.push({
          type: 'success',
          title: 'Cumplimiento de SLA',
          description: `El ${kpisFiltrados.slaCompliance}% de los casos cumple con el SLA objetivo`,
          value: `${kpisFiltrados.slaCompliance}%`,
          icon: Target,
          color: '#10b981'
        });
      } else {
        insightsList.push({
          type: 'warning',
          title: 'Cumplimiento de SLA',
          description: `El cumplimiento está en ${kpisFiltrados.slaCompliance}%, ${(slaObjective - kpisFiltrados.slaCompliance).toFixed(1)}% por debajo del objetivo`,
          value: `${kpisFiltrados.slaCompliance}%`,
          icon: TrendingDown,
          color: '#f59e0b'
        });
      }
    } else {
      insightsList.push({
        type: 'info',
        title: 'Cumplimiento de SLA',
        description: 'No hay datos disponibles para calcular el cumplimiento',
        icon: Info,
        color: '#64748b'
      });
    }
    
    // CSAT Score
    if (kpisFiltrados.csatScore !== null) {
      if (kpisFiltrados.csatScore >= 4.0) {
        insightsList.push({
          type: 'success',
          title: 'Satisfacción del Cliente',
          description: `CSAT promedio de ${kpisFiltrados.csatScore.toFixed(1)}/5 indica alta satisfacción`,
          value: `${kpisFiltrados.csatScore.toFixed(1)}/5`,
          icon: ThumbsUp,
          color: '#10b981'
        });
      } else if (kpisFiltrados.csatScore >= 3.0) {
        insightsList.push({
          type: 'warning',
          title: 'Satisfacción del Cliente',
          description: `CSAT promedio de ${kpisFiltrados.csatScore.toFixed(1)}/5 requiere mejora`,
          value: `${kpisFiltrados.csatScore.toFixed(1)}/5`,
          icon: ThumbsUp,
          color: '#f59e0b'
        });
      } else {
        insightsList.push({
          type: 'critical',
          title: 'Satisfacción del Cliente',
          description: `CSAT promedio de ${kpisFiltrados.csatScore.toFixed(1)}/5 está por debajo de lo esperado`,
          value: `${kpisFiltrados.csatScore.toFixed(1)}/5`,
          icon: AlertTriangle,
          color: '#ef4444'
        });
      }
    } else {
      insightsList.push({
        type: 'info',
        title: 'Satisfacción del Cliente',
        description: 'No hay datos de CSAT disponibles',
        icon: Info,
        color: '#64748b'
      });
    }
    
    // Actividad general
    if (abiertos > 0) {
      const porcentajeResueltos = totalCasos > 0 ? ((totalCasos - abiertos) / totalCasos * 100).toFixed(1) : '0';
      insightsList.push({
        type: 'info',
        title: 'Actividad General',
        description: `${abiertos} caso${abiertos !== 1 ? 's' : ''} abierto${abiertos !== 1 ? 's' : ''} de ${totalCasos} totales (${porcentajeResueltos}% resueltos)`,
        value: `${porcentajeResueltos}%`,
        icon: Activity,
        color: '#3b82f6'
      });
    }
    
    return insightsList;
  }, [casosCriticos, escalados, kpisFiltrados.csatScore, kpisFiltrados.slaCompliance, abiertos, totalCasos, slaObjective]);

  const KPICard: React.FC<{
    label: string;
    value: number | string;
    color: string;
    bg: string;
    icon: React.ElementType;
    variation: { value: string; percent: string | null; isPositive: boolean; isNegative: boolean };
    isHighlighted?: boolean;
    tooltip?: string;
  }> = ({ label, value, color, bg, icon: Icon, variation, isHighlighted = false, tooltip }) => {
    // Fondo siempre neutro; solo el número (y opcionalmente el icono) llevan color
    let borderColor = 'rgba(71, 85, 105, 0.3)';
    let backgroundColor = styles.card.backgroundColor;
    let iconColor = styles.text.tertiary;
    let valueColor = color || styles.text.primary;

    if (isHighlighted) {
      borderColor = 'rgba(71, 85, 105, 0.3)';
      iconColor = '#ef4444';
      valueColor = '#ef4444';
    }

    return (
      <div
        className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden h-full"
        style={{
          ...styles.card,
          borderColor,
          backgroundColor
        }}
        onMouseEnter={(e) => {
          setHoveredKPI(label);
          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        }}
        onMouseLeave={(e) => {
          setHoveredKPI(null);
          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div className="absolute top-3 right-3">
          <Icon className="w-6 h-6" style={{color: iconColor}} />
        </div>
        <div className="flex items-start justify-between mb-2 pr-8">
          <div className="flex-1">
            <p className="text-4xl font-black leading-none mb-1.5" style={{color: valueColor}}>
              {typeof value === 'string' && value.includes('N/A') ? (
                value
              ) : typeof value === 'number' ? (
                value < 10 && value % 1 !== 0 ? value.toFixed(1) : value
              ) : (
                (() => {
                  const numValue = parseFloat(value as string) || 0;
                  return numValue < 10 && numValue % 1 !== 0 ? numValue.toFixed(1) : numValue;
                })()
              )}
            </p>
            <div className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 flex-shrink-0" style={{color: iconColor}} />
              <p className="text-xs font-bold uppercase tracking-wide" style={{color: styles.text.secondary}}>{label}</p>
            </div>
            <p className="text-[10px] mt-1" style={{color: styles.text.tertiary}}>
              {isHighlighted && vencidos > 0 ? 'Requiere acción' : variation.value}
            </p>
          </div>
        </div>
        {tooltip && hoveredKPI === label && (
          <div 
            className="absolute bottom-full left-0 mb-2 px-3 py-2 text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
            style={{
              backgroundColor: theme === 'dark' ? '#020617' : '#0f172a',
              color: '#ffffff',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}
          >
            {tooltip}
            <div 
              className="absolute top-full left-4 -mt-1 border-4 border-transparent"
              style={{borderTopColor: theme === 'dark' ? '#020617' : '#0f172a'}}
            ></div>
          </div>
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

  if (loading) {
    return <LoadingScreen message="Cargando Dashboard de Gerente..." />;
  }

  return (
    <div className="space-y-3" style={styles.container}>
      {/* Header con filtro de período - FIJO EN LA PARTE SUPERIOR */}
      <div className="sticky top-0 z-50 pb-2 mb-1" style={{
        backgroundColor: styles.container.backgroundColor,
        backdropFilter: 'blur(10px)'
      }}>
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border" style={{...styles.card}}>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{color: styles.text.secondary}}>Tiempo</span>
            <div className="flex gap-1">
              {(['hoy', 'semana', 'mes'] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className="px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all border"
                  style={periodFilter === period ? {
                    backgroundColor: 'rgb(15, 23, 42)',
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    color: '#ffffff'
                  } : {
                    backgroundColor: 'transparent',
                    color: styles.text.secondary,
                    borderColor: 'rgba(148, 163, 184, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (periodFilter !== period) {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#020617' : '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (periodFilter !== period) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {period === 'hoy' ? 'Hoy' : period === 'semana' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <KPICard
          label="Casos Abiertos"
          value={abiertos}
          color="#ffffff"
          bg="bg-slate-900"
          icon={TrendingUp}
          variation={abiertosVar}
          tooltip="Total de casos activos que no han sido cerrados o resueltos"
        />
        <KPICard
          label="Excedidos SLA"
          value={vencidos}
          color="#ef4444"
          bg="bg-red-50"
          icon={Clock}
          variation={vencidosVar}
          isHighlighted={true}
          tooltip="Casos que han superado el tiempo comprometido de resolución (SLA)"
        />
        <KPICard
          label="CSAT Promedio"
          value={kpisFiltrados.csatScore !== null ? kpisFiltrados.csatScore : ('N/A' as any)}
          color={kpisFiltrados.csatScore !== null ? "#22c55e" : "#94a3b8"}
          bg="bg-green-50"
          icon={ThumbsUp}
          variation={csatVar}
          tooltip="Puntuación promedio de satisfacción del cliente (1-5)"
        />
        <KPICard
          label="Total Histórico"
          value={kpisFiltrados.totalCases}
          color="#ffffff"
          bg="bg-slate-50"
          icon={Users}
          variation={historicoVar}
          tooltip="Total acumulado de casos desde el inicio del sistema"
        />
      </div>

      {/* Resumen Ejecutivo (desplegable, listado minimalista) */}
      {insights.length > 0 && (
        <div 
          className="p-4 rounded-xl border shadow-sm mt-2"
          style={{
            ...styles.card,
            animation: 'fadeInSlide 0.3s ease-out'
          }}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 text-left"
            onClick={() => setShowInsights(prev => !prev)}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg" style={{
                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)'
              }}>
                <Shield className="w-4 h-4" style={{color: '#3b82f6'}} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider" style={{color: styles.text.primary}}>
                  Resumen Ejecutivo
                </h3>
                <p className="text-[10px] font-medium mt-0.5" style={{color: styles.text.tertiary}}>
                  Visión general del estado operativo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{
                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
                color: '#3b82f6'
              }}>
                {insights.length} {insights.length === 1 ? 'indicador' : 'indicadores'}
              </span>
              <span
                className="text-xs font-semibold px-2 py-1 rounded-md"
                style={{color: styles.text.secondary}}
              >
                {showInsights ? 'Ocultar' : 'Mostrar'}
              </span>
            </div>
          </button>

          {showInsights && (
            <div className="mt-3 border-t pt-3 space-y-2" style={{borderColor: 'rgba(148, 163, 184, 0.25)'}}>
              {insights.map((insight, idx) => {
                const Icon = insight.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 px-1.5 py-1 rounded-md hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    style={{
                      animation: `fadeInSlide 0.25s ease-out ${idx * 0.03}s both`
                    }}
                  >
                    <div 
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{
                        backgroundColor: theme === 'dark' ? '#020617' : '#e5e7eb'
                      }}
                    >
                      <Icon className="w-4 h-4" style={{color: insight.color}} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-semibold" style={{color: styles.text.primary}}>
                          {insight.title}
                        </p>
                        {insight.value && (
                          <span 
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: styles.text.secondary,
                              backgroundColor: theme === 'dark' ? 'rgba(15,23,42,0.8)' : '#f1f5f9',
                              border: '1px solid rgba(148, 163, 184, 0.3)'
                            }}
                          >
                            {insight.value}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{color: styles.text.secondary}}>
                        {insight.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Distribución por Estado */}
        <div className="p-3 rounded-xl border shadow-sm" style={{...styles.card}}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider" style={{color: styles.text.primary}}>Distribución por Estado</h3>
            <div className="text-[10px] font-medium" style={{color: styles.text.tertiary}}>
              Total: {totalCasos} casos
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataWithPercent}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke={theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)'} 
                />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: styles.text.tertiary }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: styles.text.tertiary }}
                />
                <Tooltip 
                  cursor={{fill: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.1)'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-lg shadow-lg border" style={{...styles.card}}>
                          <p className="font-semibold" style={{color: styles.text.primary}}>{data.name}</p>
                          <p className="text-sm" style={{color: styles.text.secondary}}>
                            {data.value} caso{data.value !== 1 ? 's' : ''} ({data.percent}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartDataWithPercent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
            {chartDataWithPercent.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-1 rounded-lg" 
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(241, 245, 249, 0.05)' : '#f8fafc'
                }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[idx] }}></div>
                  <span className="font-medium" style={{color: styles.text.secondary}}>{item.name}</span>
                </div>
                <span className="font-bold" style={{color: styles.text.primary}}>{item.value} ({item.percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cumplimiento de SLA */}
        <div className="p-4 rounded-xl border shadow-sm flex flex-col h-full" style={{...styles.card}}>
          <h3 className="text-xs font-black mb-2 uppercase tracking-wider" style={{color: styles.text.primary}}>Cumplimiento de SLA</h3>
          
          <div className="flex-1 flex flex-col justify-between py-1">
            {/* Barra de progreso horizontal superior con colores progresivos */}
            <div className="w-full mb-3">
              <div className="relative h-3 rounded-full overflow-hidden" style={{
                backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'
              }}>
                {/* Progreso con color progresivo: Rojo → Naranja → Amarillo → Verde */}
                {kpisFiltrados.slaCompliance !== null && (
                  <div
                    className="absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(kpisFiltrados.slaCompliance, 100)}%`,
                      background: `linear-gradient(90deg, ${slaProgressColor.from} 0%, ${slaProgressColor.to} 100%)`
                    }}
                  />
                )}

                {/* Marca del objetivo */}
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{
                    left: `${slaObjective}%`,
                    backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.6)' : 'rgba(71, 85, 105, 0.6)'
                  }}
                >
                  <div 
                    className="absolute -top-5 -left-4 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: styles.text.tertiary,
                      backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.9)' : 'rgba(241, 245, 249, 0.9)'
                    }}
                  >
                    Meta {slaObjective}%
                  </div>
                </div>
              </div>
            </div>

            {/* Número central grande - COLOR NEUTRAL (SIN ROJO) */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-black mb-1" style={{
                  color: styles.text.primary // Siempre neutral
                }}>
                  {kpisFiltrados.slaCompliance !== null ? `${kpisFiltrados.slaCompliance}%` : 'N/A'}
                </div>
                <div className="text-xs font-medium" style={{color: styles.text.tertiary}}>
                  Cumplimiento actual
                </div>
              </div>
            </div>

            {/* Estado inferior - solo la barra lateral con color */}
            <div className="text-center mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.6)',
                borderLeft: `3px solid ${slaProgressColor.from}`
              }}>
                <span className="text-xs font-semibold" style={{
                  color: styles.text.primary // Texto neutral
                }}>
                  {slaText}
                </span>
              </div>
              {slaStatus !== 'en_cumplimiento' && slaStatus !== 'sin_datos' && kpisFiltrados.slaCompliance !== null && (
                <p className="text-[10px] mt-1.5" style={{color: styles.text.tertiary}}>
                  {kpisFiltrados.slaCompliance < slaObjective
                    ? `${(slaObjective - kpisFiltrados.slaCompliance).toFixed(1)}% por debajo del objetivo`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GerenteDashboard;
