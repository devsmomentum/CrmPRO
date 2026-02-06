export type Priority = 'low' | 'medium' | 'high'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'email' | 'phone'
export type PipelineType = 'sales' | 'support' | 'administrative' | string

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Message {
  id: string
  leadId: string
  channel: Channel
  content: string
  timestamp: Date
  sender: 'team' | 'lead'
  read: boolean
  metadata?: any
}

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  dueDate: Date
  completed: boolean
  priority: Priority
  leadId?: string
  createdBy: string
}

export type MeetingParticipantType = 'internal' | 'external'

export interface MeetingParticipant {
  id: string
  meetingId: string
  name: string
  type?: MeetingParticipantType | null
  createdAt: Date
  updatedAt?: Date
}

export interface Meeting {
  id: string
  leadId: string
  title: string
  date: Date
  duration: number
  participants: MeetingParticipant[]
  notes: string
  createdAt: Date
  updatedAt?: Date
  empresaId?: string
  createdBy?: string | null
}

export interface BudgetLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Budget {
  id: string
  leadId: string
  name: string
  items: BudgetLineItem[]
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  createdAt: Date
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  avatar?: string
  pipeline: PipelineType
  stage: string
  tags: Tag[]
  priority: Priority
  budget: number
  assignedTo: string
  createdAt: Date
  lastContact: Date
  location?: string
  lastMessageAt?: Date
  lastMessageSender?: 'lead' | 'team'
  lastMessage?: string
  archived?: boolean
  archivedAt?: Date
  customFields?: Record<string, any>
}

export interface Stage {
  id: string
  name: string
  order: number
  color: string
  pipelineType: PipelineType
}

export interface Pipeline {
  id: string
  name: string
  type: PipelineType
  stages: Stage[]
}

export type RolePermission =
  | 'view_dashboard'
  | 'view_pipeline'
  | 'edit_leads'
  | 'delete_leads'
  | 'view_analytics'
  | 'view_calendar'
  | 'manage_team'
  | 'manage_settings'
  | 'view_budgets'
  | 'edit_budgets'

export interface Role {
  id: string
  name: string
  permissions: RolePermission[]
  color: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  avatar: string
  role: string
  roleId?: string
  pipelines?: PipelineType[]
  teamId?: string
  permissionRole?: 'admin' | 'viewer' | 'owner'
  userId?: string
}

export interface Appointment {
  id: string
  leadId: string
  teamMemberId: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  status: 'scheduled' | 'completed' | 'cancelled'
  attendees?: string[] // IDs of team members or external emails
}

export interface Notification {
  id: string
  type: 'task' | 'message' | 'appointment' | 'stage_change'
  title: string
  message: string
  timestamp: Date
  read: boolean
  leadId?: string
  actionUrl?: string
}

export interface AutomationRule {
  id: string
  name: string
  trigger: 'tag_added' | 'stage_change' | 'time_based'
  condition: any
  actions: Array<{
    type: 'send_email' | 'send_sms' | 'create_task' | 'move_stage'
    config: any
  }>
  enabled: boolean
}

export interface Note {
  id: string
  leadId: string
  content: string
  createdBy: string
  createdAt: Date
}

// ==========================================
// DTOs para operaciones CRUD (Fase 1 Refactorización)
// ==========================================

// ----- Lead DTOs -----
export interface CreateLeadDTO {
  nombre_completo: string
  telefono?: string
  correo_electronico?: string
  empresa_id: string
  pipeline_id?: string
  etapa_id?: string
  asignado_a?: string
  presupuesto?: number
  prioridad?: Priority
  ubicacion?: string
  empresa?: string
  preferred_instance_id?: string | null
}

export interface UpdateLeadDTO {
  nombre_completo?: string
  telefono?: string
  correo_electronico?: string
  presupuesto?: number
  prioridad?: Priority
  asignado_a?: string
  etapa_id?: string
  pipeline_id?: string
  ubicacion?: string
  empresa?: string
  archived?: boolean
  archived_at?: string | null
}

// Lead como viene de la BD (snake_case)
export interface LeadDB {
  id: string
  nombre_completo: string
  telefono?: string
  correo_electronico?: string
  empresa_id: string
  pipeline_id?: string
  etapa_id?: string
  asignado_a?: string
  presupuesto?: number
  prioridad?: string
  ubicacion?: string
  empresa?: string
  created_at: string
  updated_at?: string
  archived: boolean
  archived_at?: string | null
  last_message_at?: string
  last_message_sender?: string
  last_message_content?: string
  preferred_instance_id?: string | null
}

// ----- Empresa Instancias -----
export interface EmpresaInstanciaDB {
  id: string
  empresa_id: string
  plataforma: 'whatsapp' | 'instagram' | 'facebook' | string
  client_id: string
  api_url?: string | null
  label?: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

// ----- Empresa DTOs -----
export interface CreateEmpresaDTO {
  nombre_empresa: string
  usuario_id: string
  logo_url?: string
}

export interface UpdateEmpresaDTO {
  nombre_empresa?: string
  logo_url?: string
}

export interface EmpresaDB {
  id: string
  nombre_empresa: string
  logo_url?: string
  created_at: string
  created_by: string
}

// ----- Empresa Miembros -----
export type MemberRole = 'owner' | 'admin' | 'viewer'

export interface EmpresaMiembro {
  id: string
  empresa_id: string
  usuario_id: string | null
  email: string
  role: MemberRole
  created_at: string
}

export interface UpdateMemberRoleDTO {
  usuario_id?: string
  email: string
  role: MemberRole
}

// ----- Pipeline DTOs -----
export interface CreatePipelineDTO {
  nombre: string
  empresa_id: string
  tipo?: string
}

export interface PipelineDB {
  id: string
  nombre: string
  empresa_id: string
  tipo?: string
  created_at: string
}

// ----- Etapa/Stage DTOs -----
export interface CreateEtapaDTO {
  nombre: string
  pipeline_id: string
  orden: number
  color?: string
}

export interface EtapaDB {
  id: string
  nombre: string
  pipeline_id: string
  orden: number
  color?: string
  created_at: string
}

// ----- Equipo DTOs -----
export interface EquipoDB {
  id: string
  nombre_equipo: string
  empresa_id: string
  created_at: string
}

export interface CreateEquipoDTO {
  nombre_equipo: string
  empresa_id: string
}

// ----- Usuario/Persona DTOs -----
export interface UsuarioDB {
  id: string
  email: string
  nombre?: string
  avatar_url?: string
  created_at: string
}

export interface PersonaDB {
  id: string
  usuario_id: string
  empresa_id: string
  nombre?: string
  email: string
  titulo_trabajo?: string
  equipo_id?: string
  permisos?: string[]
  created_at: string
}

// ----- Respuestas paginadas -----
export interface PaginatedResponse<T> {
  data: T[]
  count: number | null
}

// ----- Opciones comunes para queries -----
export interface GetLeadsPagedOptions {
  empresaId: string
  currentUserId?: string
  isAdminOrOwner?: boolean
  limit?: number
  offset?: number
  pipelineId?: string
  stageId?: string
  order?: 'asc' | 'desc'
  archived?: boolean
}

export interface SearchLeadsOptions {
  pipelineId?: string
  stageId?: string
  archived?: boolean
  limit?: number
  order?: 'asc' | 'desc'
}
