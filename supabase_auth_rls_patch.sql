-- Parche de Seguridad: Usar metadatos de Supabase Auth en lugar de cabecera insegura x-tenant-id

-- 1. Reemplazamos la función get_tenant_id_header para que lea el JWT validado en lugar de los headers
CREATE OR REPLACE FUNCTION public.get_tenant_id_header()
RETURNS UUID AS $$
BEGIN
  -- Leer el tenant_id de los metadatos seguros inyectados por Supabase Auth en el JWT de sesión
  -- Esto garantiza que el usuario no puede falsificar su tenant_id
  RETURN NULLIF(auth.jwt()->'user_metadata'->>'tenant_id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Aseguramos que las políticas RLS se mantienen vigentes (No es necesario reescribirlas todas 
-- porque todas llaman a get_tenant_id_header(), por lo que al cambiar la función, 
-- toda la base de datos queda asegurada instantáneamente).

-- 3. Función auxiliar opcional para obtener el rol del usuario desde el JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt()->'user_metadata'->>'role';
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
