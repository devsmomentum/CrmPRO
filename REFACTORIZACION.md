# 🔧 Guía de Refactorización del CRM

> **Fecha de inicio**: Enero 2026  
> **Estado**: En progreso  
> **Versión del documento**: 1.0

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Problemas Identificados](#problemas-identificados)
3. [Principios SOLID a Aplicar](#principios-solid-a-aplicar)
4. [Plan de Refactorización](#plan-de-refactorización)
5. [Estructura de Carpetas Propuesta](#estructura-de-carpetas-propuesta)
6. [Guía de Implementación](#guía-de-implementación)
7. [Patrones y Convenciones](#patrones-y-convenciones)
8. [Prompt para Continuidad](#prompt-para-continuidad)

---

## Visión General

Este documento describe el proceso de refactorización del CRM para mejorar:

- **Mantenibilidad**: Código más fácil de entender y modificar
- **Escalabilidad**: Facilitar la adición de nuevas funcionalidades
- **Testeabilidad**: Permitir pruebas unitarias y de integración
- **Rendimiento**: Reducir re-renders y optimizar carga de datos

### Estado Actual

| Métrica | Valor Actual | Objetivo |
|---------|--------------|----------|
| Componente más grande | 1,657 líneas | < 300 líneas |
| Servicios en JS | 10 archivos | 0 archivos |
| Hooks reutilizables | 4 | 15+ |
| Cobertura de tipos | ~60% | 100% |

---

## Problemas Identificados

### 🔴 Crítico: Componentes Gigantes

Los siguientes componentes violan el principio de responsabilidad única:

```
ChatsView.tsx       → 1,484 líneas  (25+ funciones internas)
PipelineView.tsx    → 1,657 líneas  (21+ funciones internas)
LeadDetailSheet.tsx → 1,628 líneas  (29+ funciones internas)
AddLeadDialog.tsx   → 58KB          (formulario monolítico)
webhook-chat/       → 877 líneas    (todo en un archivo)
```

**Impacto**:
- Difícil de debuggear
- Re-renders innecesarios
- Imposible hacer tests unitarios
- Conflictos de merge frecuentes

### 🔴 Crítico: Inconsistencia JS/TS

```
src/supabase/services/
├── empresa.js          ❌ Sin tipos
├── leads.js            ❌ Sin tipos
├── mensajes.ts         ✅ Con tipos
├── invitations.js      ❌ DUPLICADO
├── invitations.ts      ✅ DUPLICADO
```

**Impacto**:
- Errores en runtime que TypeScript podría prevenir
- Confusión sobre qué archivo usar
- Autocompletado limitado

### 🟡 Importante: Duplicación de Código

**Grabación de Audio** (implementada 3 veces):
- `ChatsView.tsx` líneas 520-611
- `LeadDetailSheet.tsx` líneas 129-249
- `VoiceRecorder.tsx` (componente sin usar)

**Formateo de Fechas** (implementado 2 veces):
- `ChatsView.tsx` → `safeFormat()`
- `LeadDetailSheet.tsx` → `formatSafeDate()`

**Queries de Leads** (en múltiples lugares):
- `services/leads.js`
- `PipelineView.tsx` (llamadas directas)
- `ChatsView.tsx` (llamadas directas)

### 🟡 Importante: Acoplamiento

Los componentes llaman directamente a Supabase:

```typescript
// ❌ MAL: En PipelineView.tsx
const { data } = await supabase.from('pipeline').select('*')

// ✅ BIEN: Debería ser
const data = await pipelineService.getAll()
```

---

## Principios SOLID a Aplicar

### S - Single Responsibility Principle

> Cada módulo debe tener una sola razón para cambiar.

**Antes**:
```tsx
// ChatsView.tsx hace TODO:
// - Renderiza lista de chats
// - Maneja grabación de audio
// - Maneja caché de leads
// - Maneja virtualización
// - Maneja envío de mensajes
// - Maneja archivado
```

**Después**:
```
features/chat/
├── ChatsView.tsx        # Solo composición
├── components/
│   ├── ChatList.tsx     # Solo lista
│   ├── MessageInput.tsx # Solo input
│   └── AudioRecorder.tsx# Solo grabación
└── hooks/
    ├── useChats.ts      # Solo datos de chats
    └── useMessages.ts   # Solo mensajes
```

### O - Open/Closed Principle

> Abierto para extensión, cerrado para modificación.

**Implementación con composición**:
```tsx
// Componente base extensible
<LeadDetailSheet lead={lead}>
  {/* Tabs predeterminados */}
  <MessagesTab />
  <NotesTab />
  
  {/* Extensión sin modificar el componente base */}
  <CustomTab label="Inventario">
    <InventorySection />
  </CustomTab>
</LeadDetailSheet>
```

### L - Liskov Substitution Principle

> Los subtipos deben ser sustituibles por sus tipos base.

**Implementación con interfaces**:
```typescript
// Interfaz base
interface IMessageService {
  send(message: CreateMessageDTO): Promise<Message>
  getByLead(leadId: string): Promise<Message[]>
}

// Implementaciones intercambiables
class SupabaseMessageService implements IMessageService { }
class MockMessageService implements IMessageService { } // Para tests
```

### I - Interface Segregation Principle

> Interfaces específicas son mejores que una interfaz general.

**Antes**:
```typescript
interface LeadDetailProps {
  lead: Lead
  onUpdate: () => void
  onDelete: () => void
  onMessage: () => void
  onNote: () => void
  onBudget: () => void
  onMeeting: () => void
  // ... 20 props más
}
```

**Después**:
```typescript
interface MessagesTabProps {
  leadId: string
  onSend: (content: string) => void
}

interface NotesTabProps {
  leadId: string
  onAdd: (note: string) => void
}
```

### D - Dependency Inversion Principle

> Depender de abstracciones, no de implementaciones.

**Antes**:
```typescript
// Componente acoplado a Supabase
function ChatsView() {
  useEffect(() => {
    supabase.from('lead').select('*')...
  }, [])
}
```

**Después**:
```typescript
// Hook que abstrae la fuente de datos
function useLeads(service: ILeadsService = leadsService) {
  return useQuery(['leads'], () => service.getAll())
}

// Componente desacoplado
function ChatsView() {
  const { data: leads } = useLeads()
}
```

---

## Plan de Refactorización

### Fase 1: Preparación (1-2 días)

**Objetivo**: Preparar el terreno sin romper funcionalidad.

#### 1.1 Migrar Services a TypeScript

```bash
# Archivos a migrar
src/supabase/services/empresa.js      → empresa.ts
src/supabase/services/leads.js        → leads.ts
src/supabase/services/equipos.js      → equipos.ts
src/supabase/services/etapas.js       → etapas.ts
src/supabase/services/panel.js        → panel.ts
src/supabase/services/persona.js      → persona.ts
src/supabase/services/pipeline.js     → pipeline.ts
src/supabase/services/usuarios.js     → usuarios.ts
```

#### 1.2 Eliminar Duplicados

```bash
# Eliminar archivo JS duplicado
rm src/supabase/services/invitations.js
# Mantener solo invitations.ts
```

#### 1.3 Crear Tipos Faltantes

Agregar a `src/lib/types.ts`:

```typescript
// DTOs para creación
export interface CreateLeadDTO {
  nombre_completo: string
  telefono?: string
  correo_electronico?: string
  empresa_id: string
  pipeline_id?: string
  etapa_id?: string
}

// DTOs para actualización
export interface UpdateLeadDTO {
  nombre_completo?: string
  telefono?: string
  correo_electronico?: string
  presupuesto?: number
  prioridad?: Priority
  asignado_a?: string
  etapa_id?: string
}

// Tipos para respuestas de API
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  hasMore: boolean
}
```

---

### Fase 2: Extracción de Hooks (3-5 días)

**Objetivo**: Extraer lógica de negocio a hooks reutilizables.

#### 2.1 Hook useAudioRecorder (Prioridad Alta)

Este hook unifica la lógica duplicada de grabación de audio:

```typescript
// src/hooks/common/useAudioRecorder.ts

interface AudioRecorderOptions {
  maxDuration?: number // en segundos
  mimeType?: string
  onError?: (error: Error) => void
}

interface AudioRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
}

interface AudioRecorderActions {
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecording: () => void
}

export function useAudioRecorder(
  options: AudioRecorderOptions = {}
): AudioRecorderState & AudioRecorderActions {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: options.mimeType || 'audio/webm;codecs=opus'
      })
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        chunksRef.current = []
      }
      
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      options.onError?.(error as Error)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
    setIsRecording(false)
  }

  // ... resto de implementación

  return {
    isRecording,
    isPaused: false,
    duration: 0,
    audioBlob,
    audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : null,
    startRecording,
    stopRecording,
    pauseRecording: () => {},
    resumeRecording: () => {},
    resetRecording: () => setAudioBlob(null)
  }
}
```

#### 2.2 Hook useLeadsList

```typescript
// src/hooks/features/useLeadsList.ts

interface UseLeadsListOptions {
  companyId: string
  scope?: 'active' | 'archived'
  limit?: number
}

export function useLeadsList(options: UseLeadsListOptions) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)

  const loadLeads = useCallback(async (reset = false) => {
    if (reset) offsetRef.current = 0
    
    const { data, count } = await leadsService.getPaged({
      empresaId: options.companyId,
      archived: options.scope === 'archived',
      limit: options.limit || 50,
      offset: offsetRef.current
    })
    
    setLeads(prev => reset ? data : [...prev, ...data])
    setHasMore(offsetRef.current + data.length < count)
    offsetRef.current += data.length
  }, [options])

  const loadMore = () => loadLeads(false)
  const refresh = () => loadLeads(true)

  return { leads, isLoading, hasMore, loadMore, refresh }
}
```

#### 2.3 Hook usePipelineData

```typescript
// src/hooks/features/usePipelineData.ts

export function usePipelineData(companyId: string) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Record<string, Lead[]>>({})

  // Cargar pipelines
  useEffect(() => {
    pipelineService.getByCompany(companyId).then(setPipelines)
  }, [companyId])

  // Cargar stages cuando cambia el pipeline
  useEffect(() => {
    if (selectedPipelineId) {
      stageService.getByPipeline(selectedPipelineId).then(setStages)
    }
  }, [selectedPipelineId])

  // Cargar leads por stage
  const loadLeadsByStage = async (stageId: string) => {
    const data = await leadsService.getByStage(stageId)
    setLeads(prev => ({ ...prev, [stageId]: data }))
  }

  return {
    pipelines,
    selectedPipelineId,
    setSelectedPipelineId,
    stages,
    leads,
    loadLeadsByStage
  }
}
```

---

### Fase 3: Descomposición de Componentes (5-7 días)

#### 3.1 ChatsView Refactorizado

**Estructura de archivos**:
```
src/components/features/chat/
├── index.ts                    # Re-exports
├── ChatsView.tsx               # Componente contenedor (< 200 líneas)
├── components/
│   ├── ChatList/
│   │   ├── ChatList.tsx        # Lista virtualizada
│   │   ├── ChatListItem.tsx    # Item individual
│   │   └── ChatListSkeleton.tsx
│   ├── ChatWindow/
│   │   ├── ChatWindow.tsx      # Ventana de chat
│   │   ├── MessageList.tsx     # Lista de mensajes
│   │   └── MessageBubble.tsx   # Burbuja individual
│   ├── MessageInput/
│   │   ├── MessageInput.tsx    # Input principal
│   │   ├── AttachmentButton.tsx
│   │   └── SendButton.tsx
│   └── AudioRecorder/
│       └── AudioRecorder.tsx   # Usa useAudioRecorder
└── hooks/
    ├── useChats.ts
    ├── useMessages.ts
    └── useUnreadCounts.ts
```

**ChatsView.tsx refactorizado**:
```tsx
// src/components/features/chat/ChatsView.tsx
import { ChatList } from './components/ChatList'
import { ChatWindow } from './components/ChatWindow'
import { useChats } from './hooks/useChats'
import { useMessages } from './hooks/useMessages'

interface ChatsViewProps {
  companyId: string
  canDeleteLead?: boolean
}

export function ChatsView({ companyId, canDeleteLead = false }: ChatsViewProps) {
  const { leads, isLoading, selectedLead, setSelectedLead } = useChats(companyId)
  const { messages, sendMessage } = useMessages(selectedLead?.id)

  return (
    <div className="flex h-full">
      {/* Panel izquierdo: Lista de chats */}
      <div className="w-1/3 border-r">
        <ChatList
          leads={leads}
          isLoading={isLoading}
          selectedId={selectedLead?.id}
          onSelect={setSelectedLead}
        />
      </div>

      {/* Panel derecho: Conversación */}
      <div className="flex-1">
        {selectedLead ? (
          <ChatWindow
            lead={selectedLead}
            messages={messages}
            onSendMessage={sendMessage}
            canDelete={canDeleteLead}
          />
        ) : (
          <EmptyState message="Selecciona un chat" />
        )}
      </div>
    </div>
  )
}
```

#### 3.2 PipelineView Refactorizado

**Estructura de archivos**:
```
src/components/features/pipeline/
├── index.ts
├── PipelineView.tsx            # Contenedor principal (< 300 líneas)
├── components/
│   ├── PipelineSelector.tsx    # Dropdown de pipelines
│   ├── PipelineBoard/
│   │   ├── PipelineBoard.tsx   # Tablero Kanban
│   │   ├── StageColumn.tsx     # Columna de etapa
│   │   ├── StageHeader.tsx     # Header de columna
│   │   └── LeadCard.tsx        # Tarjeta de lead
│   ├── Dialogs/
│   │   ├── AddPipelineDialog.tsx
│   │   ├── AddStageDialog.tsx
│   │   └── AddLeadDialog.tsx
│   └── Toolbar/
│       ├── PipelineToolbar.tsx
│       └── SearchButton.tsx
└── hooks/
    ├── usePipeline.ts
    ├── useStages.ts
    ├── useDragDrop.ts
    └── useLeadActions.ts
```

#### 3.3 LeadDetailSheet Refactorizado

**Estructura de archivos**:
```
src/components/features/leads/
├── index.ts
├── LeadDetailSheet.tsx         # Sheet principal (< 300 líneas)
├── components/
│   ├── LeadHeader.tsx          # Avatar, nombre, acciones
│   ├── LeadInfo.tsx            # Información básica editable
│   ├── LeadTabs/
│   │   ├── LeadTabs.tsx        # Contenedor de tabs
│   │   ├── MessagesTab.tsx     # Tab de mensajes
│   │   ├── NotesTab.tsx        # Tab de notas
│   │   ├── BudgetsTab.tsx      # Tab de presupuestos
│   │   ├── MeetingsTab.tsx     # Tab de reuniones
│   │   └── FilesTab.tsx        # Tab de archivos
│   └── Dialogs/
│       ├── AddNoteDialog.tsx
│       ├── AddBudgetDialog.tsx
│       └── AddMeetingDialog.tsx
└── hooks/
    ├── useLeadDetail.ts
    ├── useLeadMessages.ts
    ├── useLeadNotes.ts
    ├── useLeadBudgets.ts
    └── useLeadMeetings.ts
```

---

### Fase 4: Servicios y API Layer (2-3 días)

#### Estructura de Servicios

```
src/services/
├── api/
│   ├── supabaseClient.ts       # Cliente configurado
│   ├── apiError.ts             # Clase de error
│   └── index.ts
├── leads/
│   ├── leadsService.ts         # Clase del servicio
│   ├── leadsQueries.ts         # Queries SQL/Supabase
│   ├── leadsMapper.ts          # Mapeo DB → Dominio
│   └── types.ts                # Tipos específicos
├── pipelines/
│   ├── pipelineService.ts
│   └── types.ts
├── messages/
│   ├── messagesService.ts
│   └── types.ts
├── companies/
│   ├── companiesService.ts
│   └── types.ts
└── index.ts                    # Re-exports
```

#### Patrón de Servicio

```typescript
// src/services/leads/leadsService.ts

import { supabase } from '../api/supabaseClient'
import { Lead, CreateLeadDTO, UpdateLeadDTO } from './types'
import { mapDbLeadToLead, mapLeadToDb } from './leadsMapper'

class LeadsService {
  private readonly tableName = 'lead'

  async getByCompany(companyId: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('empresa_id', companyId)
      .eq('archived', false)
      .order('created_at', { ascending: false })

    if (error) throw new ApiError('Error fetching leads', error)
    return data.map(mapDbLeadToLead)
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw new ApiError('Error fetching lead', error)
    return data ? mapDbLeadToLead(data) : null
  }

  async create(dto: CreateLeadDTO): Promise<Lead> {
    const dbData = mapLeadToDb(dto)
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single()

    if (error) throw new ApiError('Error creating lead', error)
    return mapDbLeadToLead(data)
  }

  async update(id: string, dto: UpdateLeadDTO): Promise<Lead> {
    const dbData = mapLeadToDb(dto)
    const { data, error } = await supabase
      .from(this.tableName)
      .update(dbData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new ApiError('Error updating lead', error)
    return mapDbLeadToLead(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) throw new ApiError('Error deleting lead', error)
  }

  async search(companyId: string, term: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('empresa_id', companyId)
      .or(`nombre_completo.ilike.%${term}%,telefono.ilike.%${term}%,correo_electronico.ilike.%${term}%`)
      .limit(50)

    if (error) throw new ApiError('Error searching leads', error)
    return data.map(mapDbLeadToLead)
  }
}

export const leadsService = new LeadsService()
```

---

### Fase 5: Refactorización del Webhook (2-3 días)

#### Estructura Propuesta

```
supabase/functions/webhook-chat/
├── index.ts                    # Entry point (< 100 líneas)
├── handlers/
│   ├── messageHandler.ts       # Procesar mensajes
│   ├── mediaHandler.ts         # Procesar multimedia
│   └── leadHandler.ts          # Lógica de leads
├── services/
│   ├── profileService.ts       # fetchChatDetails
│   ├── mediaService.ts         # downloadAndStoreMedia
│   ├── leadService.ts          # Crear/actualizar leads
│   └── notificationService.ts  # Enviar notificaciones
├── utils/
│   ├── signature.ts            # Verificación HMAC
│   ├── phone.ts                # Limpieza de teléfonos
│   └── deduplication.ts        # Evitar duplicados
└── types.ts                    # Tipos del webhook
```

#### Entry Point Refactorizado

```typescript
// supabase/functions/webhook-chat/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { verifySignature } from "./utils/signature.ts"
import { handleMessage } from "./handlers/messageHandler.ts"
import { handleMedia } from "./handlers/mediaHandler.ts"
import { corsHeaders } from "./utils/cors.ts"

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Verificar firma
    const isValid = await verifySignature(req)
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 })
    }

    // 2. Parsear payload
    const payload = await req.json()
    console.log(`📩 Evento recibido: ${payload.event}`)

    // 3. Routing por tipo de evento
    switch (payload.event) {
      case "message":
      case "ai_response":
        await handleMessage(payload)
        break
      case "media":
        await handleMedia(payload)
        break
      default:
        console.log(`⚠️ Evento no manejado: ${payload.event}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    console.error("❌ Error en webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
```

---

## Estructura de Carpetas Propuesta

```
src/
├── components/
│   ├── ui/                     # shadcn/ui (sin cambios)
│   ├── common/                 # Componentes reutilizables
│   │   ├── LoadingSpinner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ConfirmDialog.tsx
│   ├── layout/                 # Layouts
│   │   ├── CRMLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   └── features/               # Componentes por feature
│       ├── auth/
│       │   ├── LoginView.tsx
│       │   ├── RegisterView.tsx
│       │   └── ProtectedRoute.tsx
│       ├── chat/
│       │   ├── ChatsView.tsx
│       │   ├── components/
│       │   └── hooks/
│       ├── pipeline/
│       │   ├── PipelineView.tsx
│       │   ├── components/
│       │   └── hooks/
│       ├── leads/
│       │   ├── LeadDetailSheet.tsx
│       │   ├── components/
│       │   └── hooks/
│       └── settings/
│           └── SettingsView.tsx
├── hooks/
│   ├── common/                 # Hooks genéricos
│   │   ├── useAudioRecorder.ts
│   │   ├── useDebounce.ts
│   │   └── useLocalStorage.ts
│   └── features/               # Hooks específicos (alternativa)
├── services/                   # Capa de servicios
│   ├── api/
│   ├── leads/
│   ├── messages/
│   └── index.ts
├── lib/
│   ├── types.ts                # Tipos globales
│   ├── constants.ts            # Constantes
│   └── utils/
│       ├── date.ts             # Formateo de fechas
│       ├── phone.ts            # Formateo de teléfonos
│       └── validation.ts       # Validaciones
├── store/                      # Estado global (si se necesita)
│   └── authStore.ts
└── App.tsx
```

---

## Patrones y Convenciones

### Nombrado de Archivos

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Componentes | PascalCase | `ChatList.tsx` |
| Hooks | camelCase con `use` | `useChats.ts` |
| Servicios | camelCase con `Service` | `leadsService.ts` |
| Utilidades | camelCase | `formatDate.ts` |
| Tipos | PascalCase | `LeadTypes.ts` |

### Estructura de Componente

```tsx
// 1. Imports (ordenados)
import { useState, useEffect } from 'react'           // React
import { useNavigate } from 'react-router-dom'        // Libraries
import { Button } from '@/components/ui/button'       // UI
import { useChats } from './hooks/useChats'           // Local
import type { ChatListProps } from './types'          // Types

// 2. Types/Interfaces
interface Props {
  companyId: string
  onSelect?: (id: string) => void
}

// 3. Component
export function ChatList({ companyId, onSelect }: Props) {
  // 3a. Hooks
  const { leads, isLoading } = useChats(companyId)
  const [selected, setSelected] = useState<string | null>(null)

  // 3b. Handlers
  const handleSelect = (id: string) => {
    setSelected(id)
    onSelect?.(id)
  }

  // 3c. Effects
  useEffect(() => {
    // ...
  }, [])

  // 3d. Early returns
  if (isLoading) return <Skeleton />

  // 3e. Render
  return (
    <div>
      {leads.map(lead => (
        <ChatListItem
          key={lead.id}
          lead={lead}
          isSelected={lead.id === selected}
          onClick={() => handleSelect(lead.id)}
        />
      ))}
    </div>
  )
}
```

### Estructura de Hook

```typescript
// 1. Imports
import { useState, useEffect, useCallback } from 'react'
import { leadsService } from '@/services'
import type { Lead } from '@/lib/types'

// 2. Types
interface UseChatsOptions {
  companyId: string
  autoLoad?: boolean
}

interface UseChatsReturn {
  leads: Lead[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

// 3. Hook
export function useChats(options: UseChatsOptions): UseChatsReturn {
  const { companyId, autoLoad = true } = options
  
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(autoLoad)
  const [error, setError] = useState<Error | null>(null)

  const loadLeads = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await leadsService.getByCompany(companyId)
      setLeads(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (autoLoad) loadLeads()
  }, [autoLoad, loadLeads])

  return { leads, isLoading, error, refresh: loadLeads }
}
```

---

## Prompt para Continuidad

Copia y pega este prompt al inicio de cada sesión:

```
Estoy en proceso de refactorización del CRM ubicado en:
c:\Users\monte\OneDrive\Escritorio\ff8dfb845861ff4ad36a

DOCUMENTOS DE REFERENCIA:
- README de refactorización: REFACTORIZACION.md (en raíz del proyecto)
- Análisis detallado: C:\Users\monte\.gemini\antigravity\brain\04f995f9-0fec-4262-837d-7a0e2d9ef314\refactoring_analysis.md

FASE ACTUAL: [Actualizar según progreso]
☐ Fase 1: Preparación (migrar JS→TS, eliminar duplicados)
☐ Fase 2: Extracción de Hooks
☐ Fase 3: Descomposición de Componentes
☐ Fase 4: Servicios y API Layer
☐ Fase 5: Refactorización del Webhook

ÚLTIMO PROGRESO:
[Describir qué se hizo en la última sesión]

PRÓXIMO OBJETIVO:
[Describir qué se quiere lograr en esta sesión]

REGLAS:
1. No romper funcionalidad existente
2. Cambios incrementales y testeables
3. Mantener compatibilidad hacia atrás
4. Documentar decisiones importantes

Por favor, revisa el README de refactorización y continúa donde
quedamos en la última sesión.
```

---

## ✅ Checklist de Progreso

> Marca los items completados con `[x]` a medida que avanzas.

---

### 🧹 Fase 0: Limpieza de Archivos (Pre-refactorización)

**Objetivo**: Eliminar código muerto y archivos innecesarios.

#### Carpeta `database/`
- [x] Eliminar `add_archived_flag_to_lead.sql`
- [x] Eliminar `add_chat_fields_to_lead.sql`
- [x] Eliminar `add_last_message_content_to_lead.sql`
- [x] Eliminar `add_lead_reuniones_table.sql`
- [x] Eliminar `add_location_to_leads.sql`
- [x] Eliminar `chat_settings.sql`
- [x] Eliminar `enable_admin_delete.sql`
- [x] Eliminar `enable_message_delete.sql`
- [x] Eliminar `fix_admin_delete_robust.sql`
- [x] Eliminar `indexes_lead.sql`
- [x] Eliminar `notificaciones_policies.sql`
- [x] Eliminar `restore_guest_access_full.sql`
- [x] Eliminar `restore_rls_policies.sql`
- [x] Eliminar `rpc_delete_member.sql`
- [x] Eliminar `storage_company_logos_policies.sql`
- [x] Eliminar `super_api_chat_schema.sql`
- [x] **Conservar** `schema.sql` (documentación de BD)

#### Archivos duplicados y temporales
- [x] Eliminar `src/supabase/services/invitations.js` (duplicado de `.ts`)
- [x] Eliminar `tsc_output.txt` (archivo temporal)
- [x] Eliminar carpeta vacía `src/types/`

#### Archivos para revisar (opcional)
- [x] Revisar `src/views/crm/` (carpeta casi vacía) - **Conservada**
- [x] Decidir si mantener `src/supabase/diagnostics/empresaDebug.js` - **Conservado para debugging**

---

### 📦 Fase 1: Preparación

**Objetivo**: Migrar archivos JS a TypeScript y establecer estructura base.

#### 1.1 Migrar Services a TypeScript
- [x] `empresa.js` → `empresa.ts` ✅
- [x] `leads.js` → `leads.ts` ✅
- [x] `equipos.js` → `equipos.ts` ✅
- [x] `etapas.js` → `etapas.ts` ✅
- [x] `panel.js` → `panel.ts` ✅
- [x] `persona.js` → `persona.ts` ✅
- [x] `pipeline.js` → `pipeline.ts` ✅
- [x] `usuarios.js` → `usuarios.ts` ✅

#### 1.2 ~~Migrar Queries a TypeScript~~ → **ELIMINADOS** ✅
> ⚠️ La carpeta `queries/` contenía código duplicado de `services/` que nadie importaba.
> Fue eliminada completamente. Las funciones útiles (`updatePipeline`, `getPipelineById`) 
> se agregaron a `services/pipeline.ts`.

#### 1.3 ~~Migrar Hooks a TypeScript~~ → **ELIMINADOS** ✅
> ⚠️ La carpeta `hooks/` contenía wrappers de React Query que nadie importaba.
> Las vistas llaman directamente a `services/`. Eliminados para evitar redundancia.

#### 1.4 Migrar Helpers a TypeScript
- [ ] `src/supabase/helpers/auth.js` → `.ts`
- [ ] `src/supabase/helpers/empresa.js` → `.ts`
- [ ] `src/supabase/helpers/equipos.js` → `.ts`
- [ ] `src/supabase/helpers/etapas.js` → `.ts`
- [ ] `src/supabase/helpers/persona.js` → `.ts`
- [ ] `src/supabase/helpers/personaPipeline.js` → `.ts`
- [ ] `src/supabase/helpers/pipeline.js` → `.ts`
- [ ] `src/supabase/helpers/user.js` → `.ts`

#### 1.5 Otros archivos JS
- [x] `src/supabase/auth.js` → `.ts` ✅
- [x] `src/supabase/client.js` → `.ts` ✅
- [ ] `src/supabase/diagnostics/empresaDebug.js` → `.ts` (opcional, es de debug)

#### 1.6 Crear tipos faltantes
- [x] Agregar DTOs a `src/lib/types.ts` (CreateLeadDTO, UpdateLeadDTO, etc.) ✅
- [x] Crear tipos para respuestas de API (PaginatedResponse, etc.) ✅

#### 1.7 Verificar compilación
- [ ] Ejecutar `npm run build` sin errores de TypeScript

---

### 🪝 Fase 2: Extracción de Hooks

**Objetivo**: Extraer lógica de negocio de componentes a hooks reutilizables.

#### 2.1 Hooks Comunes
- [ ] Crear `src/hooks/common/useAudioRecorder.ts`
- [ ] Crear `src/hooks/common/useDebounce.ts`
- [ ] Crear `src/hooks/common/useDateFormat.ts` (unificar formateo de fechas)

#### 2.2 Hooks de Chat
- [ ] Crear `useLeadsList.ts`
- [ ] Crear `useUnreadCounts.ts`
- [ ] Crear `useChatMessages.ts`

#### 2.3 Hooks de Pipeline
- [ ] Crear `usePipelineData.ts`
- [ ] Crear `useLeadDragDrop.ts`
- [ ] Crear `usePipelineCRUD.ts`
- [ ] Crear `useStageCRUD.ts`

#### 2.4 Hooks de Lead Detail
- [ ] Crear `useLeadDetail.ts`
- [ ] Crear `useLeadMessages.ts`
- [ ] Crear `useLeadNotes.ts`
- [ ] Crear `useLeadBudgets.ts`
- [ ] Crear `useLeadMeetings.ts`

---

### 🧩 Fase 3: Descomposición de Componentes

**Objetivo**: Dividir componentes gigantes en piezas pequeñas y manejables.

#### 3.1 ChatsView (1,484 líneas → ~200)
- [ ] Crear estructura de carpetas `src/components/features/chat/`
- [ ] Extraer `ChatList.tsx`
- [ ] Extraer `ChatListItem.tsx`
- [ ] Extraer `ChatWindow.tsx`
- [ ] Extraer `MessageList.tsx`
- [ ] Extraer `MessageBubble.tsx`
- [ ] Extraer `MessageInput.tsx`
- [ ] Refactorizar `ChatsView.tsx` como contenedor

#### 3.2 PipelineView (1,657 líneas → ~300)
- [ ] Crear estructura de carpetas `src/components/features/pipeline/`
- [ ] Extraer `PipelineBoard.tsx`
- [ ] Extraer `StageColumn.tsx`
- [ ] Extraer `LeadCard.tsx`
- [ ] Extraer `PipelineSelector.tsx`
- [ ] Extraer `PipelineToolbar.tsx`
- [ ] Refactorizar `PipelineView.tsx` como contenedor

#### 3.3 LeadDetailSheet (1,628 líneas → ~300)
- [ ] Crear estructura de carpetas `src/components/features/leads/`
- [ ] Extraer `LeadHeader.tsx`
- [ ] Extraer `LeadInfo.tsx`
- [ ] Extraer `MessagesTab.tsx`
- [ ] Extraer `NotesTab.tsx`
- [ ] Extraer `BudgetsTab.tsx`
- [ ] Extraer `MeetingsTab.tsx`
- [ ] Refactorizar `LeadDetailSheet.tsx` como contenedor

#### 3.4 AddLeadDialog (58KB)
- [ ] Dividir en secciones lógicas
- [ ] Extraer subformularios

---

### 🔌 Fase 4: Servicios y API Layer

**Objetivo**: Centralizar todas las llamadas a Supabase en servicios.

#### 4.1 Crear estructura
- [ ] Crear carpeta `src/services/`
- [ ] Crear `src/services/api/supabaseClient.ts`
- [ ] Crear `src/services/api/apiError.ts`

#### 4.2 Implementar servicios
- [ ] Crear `leadsService.ts`
- [ ] Crear `messagesService.ts`
- [ ] Crear `pipelineService.ts`
- [ ] Crear `stagesService.ts`
- [ ] Crear `companiesService.ts`

#### 4.3 Migrar componentes
- [ ] Reemplazar llamadas directas en `ChatsView`
- [ ] Reemplazar llamadas directas en `PipelineView`
- [ ] Reemplazar llamadas directas en `LeadDetailSheet`

---

### ⚡ Fase 5: Refactorización del Webhook

**Objetivo**: Modularizar el webhook de 877 líneas.

#### 5.1 Crear estructura
- [ ] Crear carpeta `supabase/functions/webhook-chat/handlers/`
- [ ] Crear carpeta `supabase/functions/webhook-chat/services/`
- [ ] Crear carpeta `supabase/functions/webhook-chat/utils/`

#### 5.2 Separar handlers
- [ ] Crear `messageHandler.ts`
- [ ] Crear `mediaHandler.ts`
- [ ] Crear `leadHandler.ts`

#### 5.3 Separar servicios
- [ ] Crear `profileService.ts`
- [ ] Crear `mediaService.ts`
- [ ] Crear `notificationService.ts`

#### 5.4 Separar utilidades
- [ ] Crear `signature.ts`
- [ ] Crear `phone.ts`
- [ ] Crear `deduplication.ts`

#### 5.5 Refactorizar entry point
- [ ] Reducir `index.ts` a < 100 líneas
- [ ] Probar localmente con `supabase functions serve`
- [ ] Desplegar con `supabase functions deploy webhook-chat`

---

## 📊 Resumen de Progreso

| Fase | Estado | Items Completados |
|------|--------|-------------------|
| Fase 0: Limpieza | ✅ Completada | 22/22 |
| Fase 1: Preparación | ⚪ Pendiente | 0/25 |
| Fase 2: Hooks | ⚪ Pendiente | 0/14 |
| Fase 3: Componentes | ⚪ Pendiente | 0/22 |
| Fase 4: Servicios | ⚪ Pendiente | 0/10 |
| Fase 5: Webhook | ⚪ Pendiente | 0/12 |

**Total**: ~105 items

---

> **Última actualización**: 22 de Enero 2026
