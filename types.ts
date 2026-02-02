
export type Role = 'AGENTE' | 'SUPERVISOR' | 'GERENTE' | 'ADMIN' | 'ADMINISTRADOR';

export enum CaseStatus {
  NUEVO = 'Nuevo',
  EN_PROCESO = 'En Proceso',
  PENDIENTE_CLIENTE = 'Pendiente Cliente',
  ESCALADO = 'Escalado',
  RESUELTO = 'Resuelto',
  CERRADO = 'Cerrado'
}

export enum Channel {
  EMAIL = 'Email',
  WHATSAPP = 'WhatsApp',
  TELEFONO = 'Teléfono',
  WEB = 'Web',
  REDES_SOCIALES = 'Redes Sociales'
}

export enum NotificationChannel {
  EMAIL = 'Email',
  WHATSAPP = 'WhatsApp',
  AMBOS = 'Ambos'
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
  pais?: string;
}

export interface KPI {
  totalCases: number;
  slaCompliance: number | null;
  csatScore: number | null;
}

export interface Cliente {
  idCliente: string;
  nombreEmpresa: string;
  contactoPrincipal: string;
  email: string;
  telefono: string;
  pais: string;
  estado: string;
}

export interface Categoria {
  idCategoria: string;
  nombre: string;
  slaDias: number;
  diasAlertaSupervisor: number;
  diasAlertaGerente: number;
  activa: boolean;
  descripcion?: string;
}

export interface Agente {
  idAgente: string;
  nombre: string;
  email: string;
  estado: 'Activo' | 'Inactivo' | 'Vacaciones';
  ordenRoundRobin: number;
  ultimoCasoAsignado: string;
  casosActivos: number;
  pais?: string;
}

// ==================================================
// MODELO DE HISTORIAL DEL CASO
// ==================================================
export type TipoEventoHistorial = "CREADO" | "CAMBIO_ESTADO";
export type AutorRol = "sistema" | "agente" | "supervisor";

export interface HistorialEntry {
  tipo_evento: TipoEventoHistorial;
  estado_anterior?: string;
  estado_nuevo?: string;
  justificacion: string;
  autor_nombre: string;
  autor_rol: AutorRol;
  fecha: string;
}

export interface CaseTransition {
  row_number?: number;
  estado_origen: string;
  estado_destino: string;
  permitido?: boolean;
  [key: string]: any; // Para campos adicionales que pueda retornar el webhook
}

export interface EstadoFinal {
  row_number?: number;
  id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  estado_final: boolean;
  [key: string]: any; // Para campos adicionales que pueda retornar el webhook
}

export interface Case {
  id: string;
  ticketNumber: string;
  clientId: string;
  clientName: string;
  category: string;
  origin: string;
  subject: string;
  description: string;
  status: CaseStatus | string;
  priority: 'Baja' | 'Media' | 'Alta';
  agentId: string;
  agentName: string;
  createdAt: string;
  pais?: string;
  slaExpired: boolean;
  slaDeadline?: string; // Fecha final del SLA que viene del webhook
  history?: HistorialEntry[] | any[]; // Compatibilidad con formato anterior
  historial?: HistorialEntry[]; // Formato nuevo oficial
  clientEmail?: string;
  clientPhone?: string;
  // Extended metadata for supervisor/alert views
  diasAbierto: number;
  agenteAsignado: Agente;
  categoria: Categoria;
  cliente: Cliente;
  // Transiciones permitidas para este caso (viene de case.query)
  transiciones?: CaseTransition[];
  // Estados finales disponibles (viene de case.query)
  estadosFinales?: EstadoFinal[];
}

// Mantener Caso para compatibilidad con componentes existentes
export type Caso = Case;
export const UserRole = {
  AGENTE_SAC: 'AGENTE' as Role,
  SUPERVISOR: 'SUPERVISOR' as Role,
  GERENTE: 'GERENTE' as Role,
  ADMIN: 'ADMIN' as Role,
  ADMINISTRADOR: 'ADMINISTRADOR' as Role
};
