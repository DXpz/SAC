
export type Role = 'AGENTE' | 'SUPERVISOR' | 'GERENTE' | 'ADMIN';

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
}

export interface Agente {
  idAgente: string;
  nombre: string;
  email: string;
  estado: 'Activo' | 'Inactivo' | 'Vacaciones';
  ordenRoundRobin: number;
  ultimoCasoAsignado: string;
  casosActivos: number;
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
  slaExpired: boolean;
  history?: HistorialEntry[] | any[]; // Compatibilidad con formato anterior
  historial?: HistorialEntry[]; // Formato nuevo oficial
  clientEmail?: string;
  clientPhone?: string;
  // Extended metadata for supervisor/alert views
  diasAbierto: number;
  agenteAsignado: Agente;
  categoria: Categoria;
  cliente: Cliente;
}

// Mantener Caso para compatibilidad con componentes existentes
export type Caso = Case;
export const UserRole = {
  AGENTE_SAC: 'AGENTE' as Role,
  SUPERVISOR: 'SUPERVISOR' as Role,
  GERENTE: 'GERENTE' as Role
};
