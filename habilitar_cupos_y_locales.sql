-- ==============================================================================
-- HABILITAR COLUMNAS DE ADMISIÓN Y ACCESO TERRITORIAL EN TENANTS
-- Ejecuta este script en el SQL Editor de Supabase (https://supabase.com/dashboard/project/iiymocpguhdifbkfnpwp/sql)
-- ==============================================================================

-- 1. Agregar columnas territoriales y de control de cupos a la tabla tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Argentina',
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS zone TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS acceptance_code TEXT,
ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS detected_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS detected_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_verified BOOLEAN DEFAULT FALSE;

-- 2. Asegurar que todos los locales existentes queden 100% aprobados y habilitados
UPDATE public.tenants
SET access_status = 'approved'
WHERE access_status IS NULL OR access_status = '';

-- 3. Índices de aceleración
CREATE INDEX IF NOT EXISTS idx_tenants_access_status ON public.tenants (access_status);
CREATE INDEX IF NOT EXISTS idx_tenants_acceptance_code ON public.tenants (acceptance_code);
