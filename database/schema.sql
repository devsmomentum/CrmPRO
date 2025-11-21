-- =========================================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE (Multi-tenant)
-- =========================================================

-- 1. Tabla de Empresas (Company)
CREATE TABLE public.Empresas (
    empresa_id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    es_activa BOOLEAN DEFAULT TRUE,
    descripcion TEXT
);

-- 2. Tabla de Usuarios (Perfiles públicos vinculados a auth.users)
CREATE TABLE public.Usuarios (
    usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Vinculado a Supabase Auth
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    nombre_usuario VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    es_administrador BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Equipos (Team)
CREATE TABLE public.Equipos (
    equipo_id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(empresa_id, nombre)
);

-- 4. Tabla de Pipelines (Workflow/Funnel)
CREATE TABLE public.Pipelines (
    pipeline_id SERIAL PRIMARY KEY,
    equipo_id INT NOT NULL REFERENCES public.Equipos(equipo_id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla de Etapas del Pipeline (Pipeline Stages)
CREATE TABLE public.EtapasPipeline (
    etapa_id SERIAL PRIMARY KEY,
    pipeline_id INT NOT NULL REFERENCES public.Pipelines(pipeline_id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    orden INT NOT NULL,
    es_final BOOLEAN DEFAULT FALSE
);

-- 6. Tabla de Configuraciones
CREATE TABLE public.Configuraciones (
    config_id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES public.Usuarios(usuario_id) ON DELETE CASCADE,
    empresa_id INT REFERENCES public.Empresas(empresa_id) ON DELETE CASCADE,
    clave VARCHAR(100) NOT NULL,
    valor TEXT,
    CONSTRAINT chk_scope_not_null CHECK (usuario_id IS NOT NULL OR empresa_id IS NOT NULL)
);

-- =========================================================
-- FUNCIONES Y TRIGGERS (Automatización de Registro)
-- =========================================================

-- Función para manejar nuevos usuarios registrados en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_empresa_id INT;
    business_name TEXT;
BEGIN
    -- Obtenemos el nombre del negocio de los metadatos del usuario (enviados desde el frontend)
    business_name := new.raw_user_meta_data->>'business_name';

    -- Si no hay nombre de negocio, usamos un default (o podrías lanzar error)
    IF business_name IS NULL THEN
        business_name := 'Mi Empresa';
    END IF;

    -- 1. Crear la Empresa
    INSERT INTO public.Empresas (nombre)
    VALUES (business_name)
    RETURNING empresa_id INTO new_empresa_id;

    -- 2. Crear el perfil de Usuario vinculado
    INSERT INTO public.Usuarios (usuario_id, empresa_id, email, nombre_usuario, es_administrador)
    VALUES (
        new.id, 
        new_empresa_id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        TRUE -- El primer usuario es admin por defecto
    );

    -- 3. Crear un Equipo por defecto "General"
    INSERT INTO public.Equipos (empresa_id, nombre)
    VALUES (new_empresa_id, 'General');

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se dispara cada vez que alguien se registra
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.Empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.EtapasPipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Configuraciones ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para obtener el ID de empresa del usuario actual
CREATE OR REPLACE FUNCTION get_my_empresa_id()
RETURNS INT AS $$
    SELECT empresa_id FROM public.Usuarios WHERE usuario_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Políticas de Seguridad

-- EMPRESAS: Los usuarios solo ven su propia empresa
CREATE POLICY "Usuarios ven su propia empresa" ON public.Empresas
    FOR SELECT USING (empresa_id = get_my_empresa_id());

-- USUARIOS: Los usuarios ven a otros usuarios de su misma empresa
CREATE POLICY "Usuarios ven compañeros de empresa" ON public.Usuarios
    FOR SELECT USING (empresa_id = get_my_empresa_id());

-- EQUIPOS
CREATE POLICY "Aislamiento de Equipos" ON public.Equipos
    FOR ALL USING (empresa_id = get_my_empresa_id());

-- PIPELINES (A través de Equipos)
CREATE POLICY "Aislamiento de Pipelines" ON public.Pipelines
    FOR ALL USING (
        equipo_id IN (SELECT equipo_id FROM public.Equipos WHERE empresa_id = get_my_empresa_id())
    );

-- ETAPAS (A través de Pipelines)
CREATE POLICY "Aislamiento de Etapas" ON public.EtapasPipeline
    FOR ALL USING (
        pipeline_id IN (
            SELECT p.pipeline_id FROM public.Pipelines p
            JOIN public.Equipos e ON p.equipo_id = e.equipo_id
            WHERE e.empresa_id = get_my_empresa_id()
        )
    );

-- CONFIGURACIONES
CREATE POLICY "Aislamiento de Configuraciones" ON public.Configuraciones
    FOR ALL USING (
        empresa_id = get_my_empresa_id() OR usuario_id = auth.uid()
    );
