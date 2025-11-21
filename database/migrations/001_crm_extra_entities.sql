-- =========================================================
-- Migración 001 (idempotente): Entidades adicionales CRM multi-tenant
-- Ajustado para soportar ejecuciones repetidas sin fallar por objetos existentes.
-- Estrategia:
--   * CREATE TABLE IF NOT EXISTS
--   * DROP POLICY IF EXISTS antes de CREATE POLICY
--   * CREATE INDEX IF NOT EXISTS
--   * ALTER TABLE ADD COLUMN IF NOT EXISTS
-- IMPORTANTE: Si cambias el diseño de una tabla existente, usa migraciones incrementales separadas.
-- =========================================================

-- =========================
-- ROLES Y PERMISOS
-- =========================
CREATE TABLE IF NOT EXISTS public.Roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(32),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(empresa_id, name)
);

-- Si quisieras granularidad, podrías crear Role_Permissions. Se omite por usar JSONB.

ALTER TABLE public.Roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Roles" ON public.Roles;
CREATE POLICY "Aislamiento Roles" ON public.Roles FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

-- Añadir columna opcional role_id a Usuarios (nullable)
ALTER TABLE public.Usuarios ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.Roles(role_id) ON DELETE SET NULL;

-- =========================
-- MIEMBROS DE EQUIPO (Asignaciones explícitas)
-- =========================
CREATE TABLE IF NOT EXISTS public.Equipo_Miembros (
    equipo_id INT NOT NULL REFERENCES public.Equipos(equipo_id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.Usuarios(usuario_id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (equipo_id, usuario_id)
);

ALTER TABLE public.Equipo_Miembros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Equipo_Miembros" ON public.Equipo_Miembros;
CREATE POLICY "Aislamiento Equipo_Miembros" ON public.Equipo_Miembros FOR ALL USING (
    equipo_id IN (
        SELECT e.equipo_id FROM public.Equipos e WHERE e.empresa_id = get_my_empresa_id()
    )
) WITH CHECK (
    equipo_id IN (
        SELECT e.equipo_id FROM public.Equipos e WHERE e.empresa_id = get_my_empresa_id()
    )
);

-- =========================
-- LEADS Y RELACIONADOS
-- =========================
CREATE TABLE IF NOT EXISTS public.Tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    color VARCHAR(32) NOT NULL,
    UNIQUE(empresa_id, name)
);

ALTER TABLE public.Tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Tags" ON public.Tags;
CREATE POLICY "Aislamiento Tags" ON public.Tags FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.Leads (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    pipeline_id INT NOT NULL REFERENCES public.Pipelines(pipeline_id) ON DELETE RESTRICT,
    stage_id INT REFERENCES public.EtapasPipeline(etapa_id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    priority VARCHAR(16),
    budget_estimate NUMERIC(12,2),
    assigned_user_id UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    avatar TEXT,
    pipeline_type VARCHAR(64),
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_contact_at TIMESTAMPTZ
);

ALTER TABLE public.Leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Leads" ON public.Leads;
CREATE POLICY "Aislamiento Leads" ON public.Leads FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.Lead_Tags (
    lead_id UUID NOT NULL REFERENCES public.Leads(lead_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.Tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (lead_id, tag_id)
);

ALTER TABLE public.Lead_Tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Lead_Tags" ON public.Lead_Tags;
CREATE POLICY "Aislamiento Lead_Tags" ON public.Lead_Tags FOR ALL USING (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
);

CREATE INDEX IF NOT EXISTS idx_leads_empresa_stage ON public.Leads (empresa_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.Leads (assigned_user_id);

-- =========================
-- NOTAS Y HISTORIAL DE ETAPAS
-- =========================
CREATE TABLE IF NOT EXISTS public.Lead_Notes (
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.Leads(lead_id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.Lead_Notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Lead_Notes" ON public.Lead_Notes;
CREATE POLICY "Aislamiento Lead_Notes" ON public.Lead_Notes FOR ALL USING (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
);

CREATE TABLE IF NOT EXISTS public.Lead_Stage_History (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.Leads(lead_id) ON DELETE CASCADE,
    from_stage_id INT REFERENCES public.EtapasPipeline(etapa_id) ON DELETE SET NULL,
    to_stage_id INT NOT NULL REFERENCES public.EtapasPipeline(etapa_id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    changed_by UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    reason TEXT
);

ALTER TABLE public.Lead_Stage_History ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Lead_Stage_History" ON public.Lead_Stage_History;
CREATE POLICY "Aislamiento Lead_Stage_History" ON public.Lead_Stage_History FOR ALL USING (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.Lead_Stage_History (lead_id, changed_at DESC);

-- =========================
-- TAREAS
-- =========================
CREATE TABLE IF NOT EXISTS public.Tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_user_id UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    completed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(16),
    lead_id UUID REFERENCES public.Leads(lead_id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.Tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Tasks" ON public.Tasks;
CREATE POLICY "Aislamiento Tasks" ON public.Tasks FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());
CREATE INDEX IF NOT EXISTS idx_tasks_empresa_due ON public.Tasks (empresa_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.Tasks (assigned_user_id);

-- =========================
-- APPOINTMENTS (Citas/Reuniones)
-- =========================
CREATE TABLE IF NOT EXISTS public.Appointments (
    appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.Leads(lead_id) ON DELETE SET NULL,
    team_member_id UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.Appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Appointments" ON public.Appointments;
CREATE POLICY "Aislamiento Appointments" ON public.Appointments FOR ALL USING (
    (lead_id IS NULL) OR lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    (lead_id IS NULL) OR lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON public.Appointments (start_time);

-- =========================
-- CATÁLOGO Y PRESUPUESTOS
-- =========================
CREATE TABLE IF NOT EXISTS public.Catalog_Categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES public.Catalog_Categories(category_id) ON DELETE SET NULL
);

ALTER TABLE public.Catalog_Categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Catalog_Categories" ON public.Catalog_Categories;
CREATE POLICY "Aislamiento Catalog_Categories" ON public.Catalog_Categories FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.Catalog_Items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.Catalog_Categories(category_id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    sku VARCHAR(64),
    tax_rate NUMERIC(5,2)
);

ALTER TABLE public.Catalog_Items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Catalog_Items" ON public.Catalog_Items;
CREATE POLICY "Aislamiento Catalog_Items" ON public.Catalog_Items FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());
CREATE INDEX IF NOT EXISTS idx_catalog_items_empresa ON public.Catalog_Items (empresa_id);

CREATE TABLE IF NOT EXISTS public.Budgets (
    budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.Leads(lead_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_by UUID REFERENCES public.Usuarios(usuario_id) ON DELETE SET NULL
);

ALTER TABLE public.Budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Budgets" ON public.Budgets;
CREATE POLICY "Aislamiento Budgets" ON public.Budgets FOR ALL USING (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    lead_id IN (SELECT lead_id FROM public.Leads WHERE empresa_id = get_my_empresa_id())
);
CREATE INDEX IF NOT EXISTS idx_budgets_lead ON public.Budgets (lead_id);

CREATE TABLE IF NOT EXISTS public.Budget_Line_Items (
    line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES public.Budgets(budget_id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES public.Catalog_Items(item_id) ON DELETE SET NULL,
    description TEXT,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_order INT
);

ALTER TABLE public.Budget_Line_Items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Budget_Line_Items" ON public.Budget_Line_Items;
CREATE POLICY "Aislamiento Budget_Line_Items" ON public.Budget_Line_Items FOR ALL USING (
    budget_id IN (
        SELECT b.budget_id FROM public.Budgets b
        JOIN public.Leads l ON b.lead_id = l.lead_id
        WHERE l.empresa_id = get_my_empresa_id()
    )
) WITH CHECK (
    budget_id IN (
        SELECT b.budget_id FROM public.Budgets b
        JOIN public.Leads l ON b.lead_id = l.lead_id
        WHERE l.empresa_id = get_my_empresa_id()
    )
);

-- =========================
-- NOTIFICACIONES
-- =========================
CREATE TABLE IF NOT EXISTS public.Notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.Usuarios(usuario_id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    read BOOLEAN DEFAULT FALSE,
    lead_id UUID REFERENCES public.Leads(lead_id) ON DELETE SET NULL,
    action_url TEXT
);

ALTER TABLE public.Notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Notifications" ON public.Notifications;
CREATE POLICY "Aislamiento Notifications" ON public.Notifications FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.Notifications (user_id, read);

-- =========================
-- AUTOMATIZACIÓN
-- =========================
CREATE TABLE IF NOT EXISTS public.Automation_Rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    trigger VARCHAR(32) NOT NULL,
    condition JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.Automation_Rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Automation_Rules" ON public.Automation_Rules;
CREATE POLICY "Aislamiento Automation_Rules" ON public.Automation_Rules FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.Automation_Actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.Automation_Rules(rule_id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_order INT NOT NULL DEFAULT 1
);

ALTER TABLE public.Automation_Actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Automation_Actions" ON public.Automation_Actions;
CREATE POLICY "Aislamiento Automation_Actions" ON public.Automation_Actions FOR ALL USING (
    rule_id IN (SELECT rule_id FROM public.Automation_Rules WHERE empresa_id = get_my_empresa_id())
) WITH CHECK (
    rule_id IN (SELECT rule_id FROM public.Automation_Rules WHERE empresa_id = get_my_empresa_id())
);

-- =========================
-- CAMPOS PERSONALIZADOS
-- =========================
CREATE TABLE IF NOT EXISTS public.Custom_Field_Definitions (
    field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    data_type VARCHAR(16) NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(empresa_id, entity_type, name)
);

ALTER TABLE public.Custom_Field_Definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Custom_Field_Definitions" ON public.Custom_Field_Definitions;
CREATE POLICY "Aislamiento Custom_Field_Definitions" ON public.Custom_Field_Definitions FOR ALL USING (empresa_id = get_my_empresa_id()) WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.Custom_Field_Values (
    value_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES public.Custom_Field_Definitions(field_id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    value_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.Custom_Field_Values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento Custom_Field_Values" ON public.Custom_Field_Values;
CREATE POLICY "Aislamiento Custom_Field_Values" ON public.Custom_Field_Values FOR ALL USING (
    field_id IN (
        SELECT field_id FROM public.Custom_Field_Definitions WHERE empresa_id = get_my_empresa_id()
    )
) WITH CHECK (
    field_id IN (
        SELECT field_id FROM public.Custom_Field_Definitions WHERE empresa_id = get_my_empresa_id()
    )
);

-- =========================
-- INDICES ADICIONALES
-- =========================
CREATE INDEX IF NOT EXISTS idx_notifications_empresa_time ON public.Notifications (empresa_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_empresa_completed ON public.Tasks (empresa_id, completed);
CREATE INDEX IF NOT EXISTS idx_custom_fields_empresa ON public.Custom_Field_Definitions (empresa_id);

-- FIN MIGRACION 001
