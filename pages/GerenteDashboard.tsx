import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, KPI } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Clock, ThumbsUp, ArrowUp, ArrowDown, Info, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type PeriodFilter = 'hoy' | 'semana' | 'mes';

const GerenteDashboard: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [kpis, setKpis] = useState<KPI>({ totalCases: 0, slaCompliance: 0, csatScore: 0 });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoy');
  const [loading, setLoading] = useState(true);
  const [hoveredKPI, setHoveredKPI] = useState<string | null>(null);
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

  useEffect(() => {
    loadData();
    // Ya no usamos setInterval, solo actualizamos cuando cambia la vista
  }, [location.pathname]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔄 [GerenteDashboard] Iniciando carga de datos...');
      const [casosData, kpisData] = await Promise.all([
        api.getCases(),
        api.getKPIs()
      ]);
      
      console.log('📊 [GerenteDashboard] Casos recibidos del webhook:', casosData.length);
      console.log('📊 [GerenteDashboard] Detalle completo de casos:', casosData);
      console.log('📊 [GerenteDashboard] Detalle de casos (resumen):', casosData.map(c => ({
        id: c.id,
        ticketNumber: c.ticketNumber,
        status: c.status,
        statusNormalized: normalizeStatus(c.status),
        subject: c.subject,
        diasAbierto: c.diasAbierto,
        createdAt: c.createdAt
      })));
      
      // Verificar que los casos tengan datos válidos
      const casosValidos = casosData.filter(c => c && c.id);
      console.log('📊 [GerenteDashboard] Casos válidos:', casosValidos.length);
      
      if (casosValidos.length !== casosData.length) {
        console.warn('⚠️ [GerenteDashboard] Algunos casos no tienen ID válido');
      }
      
      setCasos(casosValidos);
      setKpis(kpisData);
      
      // Guardar en localStorage para que Layout pueda mostrarlo en el header
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
    } catch (error) {
      console.error('❌ [GerenteDashboard] Error loading data:', error);
      // En caso de error, mantener los casos anteriores o establecer array vacío
      if (casos.length === 0) {
        setCasos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtrar casos críticos usando la misma lógica que Alertas Críticas
  const casosCriticos = useMemo(() => {
    return casos.filter(c => {
      // Validar que categoria existe antes de acceder a slaDias
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5; // Default 5 días
      const normalizedStatus = normalizeStatus(c.status);
      return c.diasAbierto >= slaDias || 
      normalizedStatus === CaseStatus.ESCALADO ||
        (slaDias - c.diasAbierto <= 1 && c.diasAbierto > 0);
    });
  }, [casos]);

  const filteredCasos = useMemo(() => {
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

    return casos.filter(c => new Date(c.createdAt) >= startDate);
  }, [casos, periodFilter]);

  // Usar datos reales de casos críticos
  const abiertos = casos.filter(c => {
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
    console.log('📊 [GerenteDashboard] Calculando distribución de casos. Total casos:', casos.length);
    console.log('📊 [GerenteDashboard] Estados de casos:', casos.map(c => ({
      id: c.id,
      status: c.status,
      normalized: normalizeStatus(c.status)
    })));
    
    const data = [
      { name: 'Nuevos', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.NUEVO).length },
      { name: 'En Proceso', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.EN_PROCESO).length },
      { name: 'Pendiente Cliente', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.PENDIENTE_CLIENTE).length },
      { name: 'Escalados', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.ESCALADO).length },
      { name: 'Resueltos', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.RESUELTO).length },
      { name: 'Cerrados', value: casos.filter(c => normalizeStatus(c.status) === CaseStatus.CERRADO).length },
    ];
    
    console.log('📊 [GerenteDashboard] Distribución calculada:', data);
    return data;
  }, [casos]);

  // El total debe ser TODOS los casos, no solo los del gráfico
  const totalCasos = casos.length;

  const chartDataWithPercent = useMemo(() => chartData.map(item => ({
    ...item,
    percent: totalCasos > 0 ? ((item.value / totalCasos) * 100).toFixed(1) : '0.0'
  })), [chartData, totalCasos]);

  // Colores para cada estado: Nuevos, En Proceso, Pendiente Cliente, Escalados, Resueltos, Cerrados
  // Usando los mismos colores oficiales del sistema para consistencia
  const COLORS = ['#3b82f6', '#eab308', '#f97316', '#ef4444', '#22c55e', '#6b7280'];

  const slaObjective = 90;
  const slaStatus = kpis.slaCompliance === null ? 'sin_datos' :
                     kpis.slaCompliance >= slaObjective ? 'en_cumplimiento' : 
                     kpis.slaCompliance >= slaObjective - 10 ? 'riesgo' : 'debajo_objetivo';
  
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

  const slaProgressColor = getSLAProgressiveColor(kpis.slaCompliance);

  // Generar insights automáticos usando datos reales de casos críticos
  const insights = useMemo(() => {
    const insightsList: string[] = [];
    const casosFueraSLA = casosCriticos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto >= slaDias;
    });
    const casosVencen24h = casosCriticos.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      const diasRestantes = slaDias - c.diasAbierto;
      return diasRestantes > 0 && diasRestantes <= 1;
    });
    
    if (casosFueraSLA.length > 0) {
      insightsList.push(`${casosFueraSLA.length} caso${casosFueraSLA.length !== 1 ? 's' : ''} fuera de SLA`);
    }
    if (escalados > 0) {
      insightsList.push(`${escalados} caso${escalados !== 1 ? 's' : ''} escalado${escalados !== 1 ? 's' : ''} activo${escalados !== 1 ? 's' : ''}`);
    }
    if (casosVencen24h.length > 0) {
      insightsList.push(`${casosVencen24h.length} caso${casosVencen24h.length !== 1 ? 's' : ''} vence${casosVencen24h.length !== 1 ? 'n' : ''} en <24h`);
    }
    if (kpis.csatScore !== null) {
      if (kpis.csatScore >= 4.0) {
        insightsList.push('CSAT estable');
      } else {
        insightsList.push('CSAT requiere atención');
      }
    } else {
      insightsList.push('CSAT: Sin datos disponibles');
    }
    if (kpis.slaCompliance !== null) {
      if (kpis.slaCompliance >= slaObjective) {
        insightsList.push('SLA en objetivo');
      } else {
        insightsList.push(`SLA ${kpis.slaCompliance}% - Por debajo del objetivo`);
      }
    } else {
      insightsList.push('SLA: Sin datos disponibles');
    }
    return insightsList;
  }, [casosCriticos, escalados, kpis.csatScore, kpis.slaCompliance]);

  const KPICard: React.FC<{
    label: string;
    value: number | string;
    color: string;
    bg: string;
    icon: React.ElementType;
    variation: { value: string; percent: string | null; isPositive: boolean; isNegative: boolean };
    isHighlighted?: boolean;
    tooltip?: string;
  }> = ({ label, value, color, bg, icon: Icon, variation, isHighlighted = false, tooltip }) => (
    <div
      className="p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-help relative h-full"
      style={{
        ...styles.card,
        borderWidth: isHighlighted ? '2px' : '1px',
        borderStyle: 'solid',
        borderColor: isHighlighted 
          ? 'rgba(200, 21, 27, 0.4)' 
          : styles.card.borderColor
      }}
      onMouseEnter={() => setHoveredKPI(label)}
      onMouseLeave={() => setHoveredKPI(null)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>{label}</p>
          {tooltip && (
            <div className="relative">
              <Info className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
              {hoveredKPI === label && (
                <div 
                  className="absolute bottom-full left-0 mb-2 px-3 py-2 text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                    color: '#ffffff',
                    border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                  }}
                >
                  {tooltip}
                  <div 
                    className="absolute top-full left-4 -mt-1 border-4 border-transparent"
                    style={{borderTopColor: theme === 'dark' ? '#1e293b' : '#0f172a'}}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" 
          style={{
            backgroundColor: bg === 'bg-slate-900' 
              ? 'rgb(15, 23, 42)'
              : bg === 'bg-red-50' 
              ? (isHighlighted ? 'rgba(200, 21, 27, 0.2)' : (theme === 'dark' ? '#0f172a' : '#f8fafc'))
              : bg === 'bg-green-50'
              ? 'rgba(34, 197, 94, 0.2)'
              : (theme === 'dark' ? '#0f172a' : '#f8fafc')
          }}
        >
          <Icon 
            className="w-4 h-4" 
            style={{
              color: bg === 'bg-slate-900' 
                ? '#ffffff' 
                : color.includes('red')
                ? (isHighlighted ? '#64748b' : styles.text.tertiary)
                : color.includes('green') 
                ? '#22c55e' 
                : styles.text.primary
            }} 
          />
        </div>
      </div>
      <h3 className="text-lg font-black mb-0.5" style={{
        color: color.includes('red') ? (isHighlighted ? '#475569' : styles.text.secondary) : 
               color.includes('green') ? '#22c55e' : 
               styles.text.primary
      }}>{value}</h3>
      <p className="text-[10px] font-medium" style={{
        color: isHighlighted && vencidos > 0 ? '#475569' : styles.text.tertiary
      }}>
        {isHighlighted && vencidos > 0 ? 'Requiere acción' : variation.value}
      </p>
    </div>
  );

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
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f8fafc';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
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
          value={kpis.csatScore !== null ? kpis.csatScore.toFixed(1) : 'N/A'}
          color={kpis.csatScore !== null ? "#22c55e" : "#94a3b8"}
          bg="bg-green-50"
          icon={ThumbsUp}
          variation={csatVar}
          tooltip="Puntuación promedio de satisfacción del cliente (1-5)"
        />
        <KPICard
          label="Total Histórico"
          value={kpis.totalCases}
          color="#ffffff"
          bg="bg-slate-50"
          icon={Users}
          variation={historicoVar}
          tooltip="Total acumulado de casos desde el inicio del sistema"
        />
      </div>

      {/* Resumen Ejecutivo */}
      {insights.length > 0 && (
        <div className="p-3 rounded-xl border shadow-sm" style={{...styles.card}}>
          <h3 className="text-xs font-black mb-2 flex items-center gap-2 uppercase tracking-wider" style={{color: styles.text.primary}}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{color: '#64748b'}} />
            Resumen Ejecutivo
          </h3>
          <ul className="space-y-1.5">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs p-1.5 rounded-lg transition-all hover:bg-opacity-50" style={{
                color: styles.text.secondary,
                backgroundColor: theme === 'dark' ? 'rgba(200, 21, 27, 0.08)' : 'rgba(200, 21, 27, 0.05)'
              }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: '#64748b'}}></div>
                <span className="font-medium">{insight}</span>
              </li>
            ))}
          </ul>
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
                {kpis.slaCompliance !== null && (
                  <div
                    className="absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(kpis.slaCompliance, 100)}%`,
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
                  {kpis.slaCompliance !== null ? `${kpis.slaCompliance}%` : 'N/A'}
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
              {slaStatus !== 'en_cumplimiento' && slaStatus !== 'sin_datos' && kpis.slaCompliance !== null && (
                <p className="text-[10px] mt-1.5" style={{color: styles.text.tertiary}}>
                  {kpis.slaCompliance < slaObjective
                    ? `${(slaObjective - kpis.slaCompliance).toFixed(1)}% por debajo del objetivo`
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
