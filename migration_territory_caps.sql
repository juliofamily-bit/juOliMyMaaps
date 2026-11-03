-- ==============================================================================
-- MIGRACIÓN: SISTEMA DE EXCLUSIVIDAD TERRITORIAL Y CUPO DE 5 LOCALES POR CIUDAD
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

-- 2. Asegurar que los locales preexistentes mantengan estado 'approved' para no interrumpir su servicio
UPDATE public.tenants
SET access_status = 'approved'
WHERE access_status IS NULL OR access_status = '';

-- 3. Crear índices B-Tree de alta concurrencia para búsqueda ultra-rápida por ciudad y país
CREATE INDEX IF NOT EXISTS idx_tenants_country_city ON public.tenants (LOWER(TRIM(country)), LOWER(TRIM(city)));
CREATE INDEX IF NOT EXISTS idx_tenants_access_status ON public.tenants (access_status);
CREATE INDEX IF NOT EXISTS idx_tenants_acceptance_code ON public.tenants (acceptance_code);

-- 4. Comentario informativo
COMMENT ON COLUMN public.tenants.access_status IS 'Estado de admisión exclusiva: approved (activo en los 5 cupos), pending_activation (cupo reservado esperando ingreso de código), waitlist (cupo agotado en la ciudad), rejected';
