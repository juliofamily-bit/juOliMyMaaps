const fs = require('fs');
let content = fs.readFileSync('estado.md', 'utf-8');
content += '\n\n### Nueva API Route para actualizar Configuración de Tenant (`/api/update-tenant`)\n- Se implementó una API route dedicada que utiliza el `SUPABASE_SERVICE_ROLE_KEY` para guardar los ajustes del administrador. Esto evita el error de "0 registros actualizados" causado por el parche de seguridad de Auth RLS (`supabase_auth_rls_patch.sql`), el cual exige un JWT de Supabase Auth para validar el `tenant_id`. Dado que el panel de administración valida por PIN local y usa sesión anónima, la única forma robusta de actualizar la tabla `tenants` (sin desprotegerla) es a través de una API route del lado del servidor.\n';
fs.writeFileSync('estado.md', content);
console.log('updated estado');
