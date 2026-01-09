import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Case, CaseStatus, KPI } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Clock, ThumbsUp, ArrowUp, ArrowDown, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type PeriodFilter = 'hoy' | 'semana' | 'mes';

const GerenteDashboard: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [kpis, setKpis] = useState<KPI>({ totalCases: 0, slaCompliance: 0, csatScore: 0 });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoy');
  const [loading, setLoading] = useState(true);
  const [hoveredKPI, setHoveredKPI] = useState<string | null>(null);
  const { theme } = useTheme();

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
    // Solo refrescar si no está cargando (evita refresh durante operaciones)
    const interval = setInterval(() => {
      if (!loading) {
        loadData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loading]);

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
  const COLORS = ['#0f172a', '#f59e0b', '#a855f7', '#ef4444', '#10b981', '#64748b'];

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
      className="p-6 rounded-2xl border shadow-sm flex items-center justify-between relative group"
      style={{
        backgroundColor: isHighlighted 
          ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.1)')
          : styles.card.backgroundColor,
        borderColor: isHighlighted 
          ? 'rgba(220, 38, 38, 0.3)' 
          : styles.card.borderColor
      }}
      onMouseEnter={() => setHoveredKPI(label)}
      onMouseLeave={() => setHoveredKPI(null)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold uppercase tracking-widest" style={{color: styles.text.tertiary}}>{label}</p>
          {tooltip && (
            <div className="relative">
              <Info className="w-3.5 h-3.5" style={{color: styles.text.tertiary}} />
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
        <h3 className="text-2xl font-black mt-1" style={{
          color: color.includes('red') ? '#ef4444' : 
                 color.includes('green') ? '#22c55e' : 
                 color.includes('slate') || color.includes('white') ? styles.text.primary : 
                 styles.text.primary
        }}>{value}</h3>
        <div className="mt-2 flex items-center gap-2">
          {variation.isPositive && !variation.isNegative && (
            <ArrowUp className={`w-3 h-3 ${label === 'Excedidos SLA' ? 'text-red-600' : 'text-green-600'}`} />
          )}
          {variation.isNegative && (
            <ArrowDown className="w-3 h-3 text-green-600" />
          )}
          <span className="text-xs font-semibold" style={{
            color: label === 'Excedidos SLA' 
              ? variation.isPositive ? '#ef4444' : '#22c55e'
              : variation.isPositive ? '#22c55e' : '#ef4444'
          }}>
            {variation.value}
          </span>
        </div>
        {variation.percent && (
          <p className="text-xs mt-0.5" style={{color: styles.text.tertiary}}>{variation.percent}</p>
        )}
        {isHighlighted && vencidos > 0 && (
          <p className="text-xs font-semibold mt-2" style={{color: '#f87171'}}>
            {vencidos} caso{vencidos !== 1 ? 's' : ''} fuera de SLA requieren atención
          </p>
        )}
      </div>
      <div 
        className="p-3 rounded-xl" 
        style={{
          backgroundColor: bg === 'bg-slate-900' 
            ? (theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgb(15, 23, 42)')
            : bg === 'bg-red-50' 
            ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.15)')
            : bg === 'bg-green-50'
            ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)')
            : (theme === 'dark' ? 'rgba(241, 245, 249, 0.1)' : '#f1f5f9')
        }}
      >
        <Icon 
          className="w-6 h-6" 
          style={{
            color: bg === 'bg-slate-900' 
              ? '#ffffff' 
              : color.includes('red') 
              ? '#ef4444' 
              : color.includes('green') 
              ? '#22c55e' 
              : styles.text.primary
          }} 
        />
      </div>
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
    <div className="space-y-6" style={styles.container}>
      {/* Header con filtro de período y última actualización */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div></div>
          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border p-1" style={{...styles.card}}>
            {(['hoy', 'semana', 'mes'] as PeriodFilter[]).map((period) => (
              <button
                key={period}
                onClick={() => setPeriodFilter(period)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: periodFilter === period 
                    ? (theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgb(15, 23, 42)')
                    : 'transparent',
                  color: periodFilter === period 
                    ? '#ffffff' 
                    : styles.text.secondary
                }}
                onMouseEnter={(e) => {
                  if (periodFilter !== period) {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(241, 245, 249, 0.1)' : '#f1f5f9';
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="p-6 rounded-2xl border shadow-sm" style={{...styles.card}}>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{color: styles.text.primary}}>
            <CheckCircle2 className="w-5 h-5" style={{color: '#94a3b8'}} />
            Resumen Ejecutivo
          </h3>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm" style={{color: styles.text.secondary}}>
                <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: styles.text.tertiary}}></div>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Estado */}
        <div className="p-6 rounded-2xl border shadow-sm" style={{...styles.card}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold" style={{color: styles.text.primary}}>Distribución por Estado</h3>
            <div className="text-xs font-medium" style={{color: styles.text.tertiary}}>
              Total: {totalCasos} casos
            </div>
          </div>
          <div className="h-64">
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
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {chartDataWithPercent.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-2 rounded-lg" 
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(241, 245, 249, 0.05)' : '#f8fafc'
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx] }}></div>
                  <span className="font-medium" style={{color: styles.text.secondary}}>{item.name}</span>
                </div>
                <span className="font-bold" style={{color: styles.text.primary}}>{item.value} ({item.percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cumplimiento de SLA */}
        <div className="p-6 rounded-2xl border shadow-sm" style={{...styles.card}}>
          <h3 className="text-base font-bold mb-6" style={{color: styles.text.primary}}>Cumplimiento de SLA</h3>
          <div className="h-64 flex flex-col justify-center items-center">
            <div className={`relative w-48 h-48 rounded-full border-[12px] flex flex-col items-center justify-center`} style={{
              borderColor: slaStatus === 'sin_datos' ? '#94a3b8' :
                          slaStatus === 'en_cumplimiento' ? '#22c55e' : 
                          slaStatus === 'riesgo' ? '#f59e0b' : '#ef4444'
            }}>
              <span className="text-4xl font-black" style={{color: styles.text.primary}}>
                {kpis.slaCompliance !== null ? `${kpis.slaCompliance}%` : 'N/A'}
              </span>
              <span className="text-xs font-bold uppercase tracking-tighter mt-1" style={{color: styles.text.tertiary}}>
                {kpis.slaCompliance !== null ? 'On Target' : 'Sin datos'}
              </span>
            </div>
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm" style={{color: styles.text.tertiary}}>
                Objetivo: <span className="font-bold" style={{color: styles.text.primary}}>{slaObjective}%</span>
              </p>
              <p className="text-sm font-semibold" style={{
                color: slaStatus === 'sin_datos' ? '#94a3b8' :
                       slaStatus === 'en_cumplimiento' ? '#22c55e' :
                       slaStatus === 'riesgo' ? '#f59e0b' : '#ef4444'
              }}>
                {slaText}
              </p>
              {slaStatus !== 'en_cumplimiento' && slaStatus !== 'sin_datos' && kpis.slaCompliance !== null && (
                <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>
                  {kpis.slaCompliance < slaObjective 
                    ? `Faltan ${(slaObjective - kpis.slaCompliance).toFixed(1)}% para alcanzar el objetivo`
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
