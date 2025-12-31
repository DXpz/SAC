/**
 * Utilidades para cálculos de SLA basados en días hábiles
 */

/**
 * Verifica si una fecha es un día hábil (no es sábado ni domingo)
 */
export const isBusinessDay = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  // 0 = domingo, 6 = sábado
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};

/**
 * Calcula la fecha límite del SLA sumando días hábiles a la fecha de inicio
 * @param startDate Fecha de inicio
 * @param businessDays Días hábiles a sumar
 * @returns Fecha límite del SLA (último día del período)
 */
export const calculateSLADeadline = (startDate: Date, businessDays: number): Date => {
  const deadline = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    deadline.setDate(deadline.getDate() + 1);
    if (isBusinessDay(deadline)) {
      daysAdded++;
    }
  }
  
  return deadline;
};

/**
 * Calcula el número de días hábiles entre dos fechas
 * @param startDate Fecha de inicio
 * @param endDate Fecha de fin
 * @returns Número de días hábiles
 */
export const calculateBusinessDaysBetween = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Normalizar las fechas para comparar solo días
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  let businessDays = 0;
  const current = new Date(start);
  
  while (current <= end) {
    if (isBusinessDay(current)) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return businessDays;
};

/**
 * Calcula los días hábiles transcurridos desde una fecha de inicio hasta hoy
 * @param startDate Fecha de inicio
 * @returns Número de días hábiles transcurridos
 */
export const calculateBusinessDaysElapsed = (startDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  return calculateBusinessDaysBetween(start, today);
};

/**
 * Calcula los días hábiles de retraso desde el fin del período SLA hasta hoy
 * Si el caso no ha vencido, retorna 0
 * @param startDate Fecha de creación del caso
 * @param slaBusinessDays Días hábiles del SLA
 * @returns Días hábiles de retraso (0 si no ha vencido)
 */
export const calculateSLADelayDays = (startDate: Date, slaBusinessDays: number): number => {
  const deadline = calculateSLADeadline(startDate, slaBusinessDays);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Fin del día de hoy
  
  // Si aún no ha vencido, retornar 0
  if (today <= deadline) {
    return 0;
  }
  
  // Calcular días hábiles desde el día después del deadline hasta hoy
  const dayAfterDeadline = new Date(deadline);
  dayAfterDeadline.setDate(dayAfterDeadline.getDate() + 1);
  dayAfterDeadline.setHours(0, 0, 0, 0);
  
  return calculateBusinessDaysBetween(dayAfterDeadline, today);
};

/**
 * Calcula información completa del SLA
 */
export interface SLAData {
  slaDays: number; // Días hábiles del SLA
  deadline: Date; // Fecha límite del SLA
  businessDaysElapsed: number; // Días hábiles transcurridos
  delayDays: number; // Días hábiles de retraso (0 si no ha vencido)
  isExpired: boolean; // Si el SLA ha vencido
  remainingDays: number; // Días hábiles restantes (0 si ha vencido)
  progressPercent: number; // Porcentaje de progreso (0-100)
  createdAt: Date; // Fecha de creación del caso
  businessHoursTotal: number; // Horas hábiles totales que debería tomar (slaDays * 8)
  businessHoursElapsed: number; // Horas hábiles transcurridas (businessDaysElapsed * 8)
  businessHoursDelay: number; // Horas hábiles de retraso (delayDays * 8)
}

/**
 * Calcula toda la información del SLA basado en la fecha de creación y días hábiles del SLA
 * @param createdAt Fecha de creación del caso
 * @param slaBusinessDays Días hábiles del SLA (obtenido de la categoría)
 * @returns Objeto con toda la información del SLA
 */
export const calculateSLAData = (createdAt: string | Date, slaBusinessDays: number): SLAData => {
  const startDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const deadline = calculateSLADeadline(startDate, slaBusinessDays);
  const businessDaysElapsed = calculateBusinessDaysElapsed(startDate);
  const delayDays = calculateSLADelayDays(startDate, slaBusinessDays);
  const isExpired = delayDays > 0;
  const remainingDays = Math.max(0, slaBusinessDays - businessDaysElapsed);
  const progressPercent = Math.min(100, (businessDaysElapsed / slaBusinessDays) * 100);
  
  // Calcular horas hábiles (asumiendo 8 horas por día hábil)
  const HOURS_PER_BUSINESS_DAY = 8;
  const businessHoursTotal = slaBusinessDays * HOURS_PER_BUSINESS_DAY;
  const businessHoursElapsed = businessDaysElapsed * HOURS_PER_BUSINESS_DAY;
  const businessHoursDelay = delayDays * HOURS_PER_BUSINESS_DAY;
  
  return {
    slaDays: slaBusinessDays,
    deadline,
    businessDaysElapsed,
    delayDays,
    isExpired,
    remainingDays,
    progressPercent,
    createdAt: startDate,
    businessHoursTotal,
    businessHoursElapsed,
    businessHoursDelay
  };
};

