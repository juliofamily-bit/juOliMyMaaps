-- Modificación para soportar Facturación Electrónica de AFIP
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE "public"."orders" 
ADD COLUMN IF NOT EXISTS "afip_cae" text,
ADD COLUMN IF NOT EXISTS "afip_cae_vencimiento" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "afip_tipo_comprobante" integer,
ADD COLUMN IF NOT EXISTS "afip_punto_venta" integer,
ADD COLUMN IF NOT EXISTS "afip_numero_comprobante" integer,
ADD COLUMN IF NOT EXISTS "afip_facturado_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "afip_error" text;

-- Notificar a PostgREST que recargue el esquema para que el frontend vea las nuevas columnas inmediatamente
NOTIFY pgrst, 'reload schema';
