
import { CaseStatus, Role, UserRole } from './types';

// ==================================================
// DEFINICIÓN OFICIAL DE ESTADOS DEL CASO
// ==================================================
export const CASE_STATES = {
  "Nuevo": { label: "Nuevo", color: "blue" },
  "En Proceso": { label: "En Proceso", color: "yellow" },
  "Pendiente Cliente": { label: "Pendiente Cliente", color: "orange" },
  "Escalado": { label: "Escalado", color: "red" },
  "Resuelto": { label: "Resuelto", color: "green" },
  "Cerrado": { label: "Cerrado", color: "gray" }
} as const;

// ==================================================
// TRANSICIONES PERMITIDAS (REGLA CRÍTICA)
// ==================================================
export const CASE_TRANSITIONS: Record<string, string[]> = {
  "Nuevo": ["En Proceso"],
  "En Proceso": ["Pendiente Cliente", "Escalado", "Resuelto"],
  "Pendiente Cliente": ["En Proceso", "Escalado"],
  "Escalado": ["En Proceso", "Resuelto"],
  "Resuelto": ["Cerrado"],
  "Cerrado": []
};

// Mantener compatibilidad con código existente
export const STATE_TRANSITIONS: Record<string, CaseStatus[]> = {
  [CaseStatus.NUEVO]: [CaseStatus.EN_PROCESO],
  [CaseStatus.EN_PROCESO]: [CaseStatus.PENDIENTE_CLIENTE, CaseStatus.ESCALADO, CaseStatus.RESUELTO],
  [CaseStatus.PENDIENTE_CLIENTE]: [CaseStatus.EN_PROCESO],
  [CaseStatus.ESCALADO]: [CaseStatus.EN_PROCESO, CaseStatus.PENDIENTE_CLIENTE],
  [CaseStatus.RESUELTO]: [CaseStatus.CERRADO],
  [CaseStatus.CERRADO]: []
};

export const ROLE_HOMEPAGE: Record<Role, string> = {
  'AGENTE': '/app/agente',
  'SUPERVISOR': '/app/supervisor',
  'GERENTE': '/app/gerencia'
};

// Mapa de colores para badges y botones (usando colores exactos especificados)
export const STATE_COLORS: Record<string, string> = {
  [CaseStatus.NUEVO]: 'bg-blue-100 text-blue-700 border-blue-200',
  [CaseStatus.EN_PROCESO]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [CaseStatus.PENDIENTE_CLIENTE]: 'bg-orange-100 text-orange-700 border-orange-200',
  [CaseStatus.ESCALADO]: 'bg-red-100 text-red-700 border-red-200',
  [CaseStatus.RESUELTO]: 'bg-green-100 text-green-700 border-green-200',
  [CaseStatus.CERRADO]: 'bg-gray-100 text-gray-700 border-gray-200'
};

// Helper para obtener color por nombre de estado
export const getStateColor = (estado: string): string => {
  const stateConfig = CASE_STATES[estado as keyof typeof CASE_STATES];
  if (!stateConfig) return 'gray';
  
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
    red: 'bg-red-500 hover:bg-red-600',
    green: 'bg-green-500 hover:bg-green-600',
    gray: 'bg-gray-500 hover:bg-gray-600'
  };
  
  return colorMap[stateConfig.color] || colorMap.gray;
};

// Helper para obtener color de badge
export const getStateBadgeColor = (estado: string): string => {
  const stateConfig = CASE_STATES[estado as keyof typeof CASE_STATES];
  if (!stateConfig) return 'bg-gray-100 text-gray-700 border-gray-200';
  
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  
  return colorMap[stateConfig.color] || colorMap.gray;
};
