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

export interface Meeting {
  id: string
  leadId: string
  title: string
  date: Date
  duration: number
  participants: string[]
  notes: string
  createdAt: Date
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
