# 🚀 CRM Moderno (Refactorizado)

Sistema de gestión de relaciones con clientes (CRM) de alto rendimiento, diseñado para centralizar la comunicación, optimizar ventas y gestionar leads en tiempo real.

![Dashboard Preview](https://placehold.co/1200x600/png?text=CRM+Dashboard+Preview)

## 📖 Acerca del Proyecto

Este CRM soluciona el caos de la gestión de clientes en múltiples canales. Permite a los equipos de ventas y soporte:
- **Centralizar conversaciones**: WhatsApp, Instagram y Facebook en una sola bandeja de entrada.
- **Gestionar el Pipeline de Ventas**: Tablero Kanban visual para arrastrar y soltar leads entre etapas.
- **Automatizar tareas**: Asignación de leads, recordatorios y seguimiento.
- **Analizar rendimiento**: Métricas claras sobre conversión y actividad del equipo.

## ✨ Características Principales

### 📊 Gestión de Leads & Pipeline
- **Tablero Kanban**: Visualización clara del embudo de ventas. Drag & drop fluido.
- **Gestión de Etapas**: Personalización completa de etapas por pipeline.
- **Lead Detail**: Ficha 360° del cliente con historial de chats, notas, presupuestos y reuniones.
- **Importación Masiva**: Soporte para Excel/CSV y PDF.

### 💬 Módulo de Chat Omni-canal
- **Bandeja Unificada**: Mensajes de múltiples fuentes en un solo lugar.
- **Tiempo Real**: Sincronización instantánea de mensajes (sin recargar).
- **Notas de Voz**: Grabación y reproducción integrada.
- **Archivos Adjuntos**: Envío y recepción de documentos/imágenes.

### 👥 Gestión de Equipos
- **Roles y Permisos**: Admin, Editor, Visualizador.
- **Asignación de Leads**: Distribución manual o automática.
- **Colaboración**: Notas internas y menciones.

## 🛠️ Stack Tecnológico

El proyecto utiliza una arquitectura moderna y robusta:

### Frontend
- **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) (Rendimiento extremo)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) (Tipado estricto al 100%)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
- **Estado**: React Query (Server state) + Hooks personalizados + Context API
- **Iconos**: Phosphor Icons

### Backend & Servicios
- **BaaS**: [Supabase](https://supabase.com/)
- **Base de Datos**: PostgreSQL
- **Autenticación**: Supabase Auth (Email/Pass + Magic Links)
- **Tiempo Real**: Supabase Realtime (Websockets)
- **Almacenamiento**: Supabase Storage (Imágenes, audios, documentos)

## 📂 Arquitectura del Proyecto

La estructura sigue un patrón modular basado en **Dominios de Funcionalidad** (Domain-Driven Structure) para facilitar la escalabilidad y el mantenimiento.

### `src/components/crm/` (Core del Negocio)
Aquí vive la lógica visual de la aplicación.
- **`leads/`**: Gestión de leads. Contiene:
    - `AddLeadDialog.tsx`: Orquestador de creación de leads.
    - `SingleLeadForm.tsx`: Formulario de alta manual.
    - `BulkImportView.tsx`: Gestión de importaciones (Excel/PDF).
- **`chats/`**: Motor de mensajería en tiempo real.
    - `ChatList`: Lista virtualizada de conversaciones.
    - `ChatWindow`: Ventana de chat con soporte multimedia.
- **`pipeline/`**: Tablero Kanban interactivo.
    - `PipelineBoard`: Contenedor principal.
    - `PipelineColumn`: Columnas virtualizadas.
    - `LeadCard`: Tarjetas de leads optimizadas (memo).
- **`lead-detail/`**: Ficha técnica del lead (Tabs de Info, Chat, Notas).

### `src/hooks/` (Lógica de Negocio Pura)
Separamos la lógica de la UI para facilitar tests y reutilización.
- **`usePipelineData.ts`**: Gestor de estado del tablero (Redux-like pero con hooks).
- **`useDragDrop.ts`**: Lógica compleja de arrastrar y soltar con actualizaciones optimistas.
- **`useExcelImport.ts`** y **`usePdfImport.ts`**: Adaptadores para parsing de archivos.
- **`useLeadsRealtime.ts`**: Suscripciones a eventos de Supabase (INSERT/UPDATE/DELETE).

### `src/supabase/` (Capa de Datos)
- **`services/`**: Repositorio de funciones de acceso a BD. 
    - **Regla de Oro**: _"Si toca la base de datos, va aquí"_.
    - 100% tipado, sin dependencias de UI.
    - Manejo de errores estandarizado.
- **`types/`**: Tipos generados automáticamente desde el esquema SQL.

### `src/lib/` (Utilidades)
- **`types.ts`**: Definiciones de tipos del dominio (Lead, Message, Pipeline).
- **`utils.ts`**: Helpers genéricos (cn, formatters).
- **`i18n.ts`**: Configuración de internacionalización.

```bash
src/
├── components/
│   ├── crm/           # [Ver detalle arriba]
│   └── ui/            # Shadcn UI (Componentes atómicos)
├── hooks/             # Custom Hooks (Lógica sin UI)
├── lib/               # Tipos y Utils
├── supabase/          # Servicios e integración backend
└── types/             # Definitions globales
```

## 🚀 Guía de Inicio

### Requisitos Previos
- Node.js 18+
- Cuenta en Supabase

### Instalación

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/tu-crm.git
    cd tu-crm
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` basado en `.env.example`:
    ```env
    VITE_SUPABASE_URL=tu_url_supabase
    VITE_SUPABASE_ANON_KEY=tu_key_anonima
    ```

4.  **Iniciar en desarrollo**:
    ```bash
    npm run dev
    ```

## 🧪 Calidad de Código
Este proyecto ha pasado por un proceso estricto de refactorización (Enero 2026):
- **Zero JS**: Migración total a TypeScript.
- **Zero Any**: Eliminación de tipos inseguros.
- **Clean Architecture**: Separación clara de responsabilidades.

---
*Documentación generada automáticamente tras refactorización masiva.*