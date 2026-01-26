# 🚀 CRM Spark Template (Refactorizado)

Este proyecto es un CRM moderno construido con React, TypeScript, Vite y Supabase. Ha sido sometido a una refactorización masiva para asegurar escalabilidad y mantenibilidad.

## ✅ Estado de Refactorización (Enero 2026)
> Se ha completado una revisión técnica del 100% del código base ver `REFACTORIZACION.md`.

- **TypeScript 100%**: Sin archivos JS, sin tipos `any` inseguros.
- **Arquitectura Modular**: Componentes divididos por responsabilidad (Feature-based).
- **Hooks Reutilizables**: Lógica de negocio separada de la UI.
- **Servicios Tipados**: Capa de datos robusta conectada a Supabase.

## 🛠️ Tecnologías
- **Frontend**: React + Vite + TypeScript
- **Estilos**: TailwindCSS + Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **State**: React Query + Hooks personalizados

## 📂 Estructura del Proyecto
```
src/
├── components/
│   ├── crm/           # Vistas principales (Pipeline, Chats, etc.)
│   │   ├── leads/     # Componentes de gestión de leads
│   │   ├── chats/     # Componentes de chat
│   │   └── pipeline/  # Componentes del tablero Kanban
│   └── ui/            # Componentes base (Botones, Inputs)
├── hooks/             # Custom hooks (Logica de negocio)
├── lib/               # Utilidades y tipos globales
└── supabase/          # Servicios y helpers de BD
```

## 🚀 Cómo Iniciar

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```

2.  **Iniciar servidor de desarrollo**:
    ```bash
    npm run dev
    ```

3.  **Construir para producción**:
    ```bash
    npm run build
    ```

## 🧪 Validaciones
El proyecto pasa todas las verificaciones de tipo (`tsc`) y el build de producción (`vite build`) sin errores.

---
*Refactorizado con ❤️ por Antigravity*