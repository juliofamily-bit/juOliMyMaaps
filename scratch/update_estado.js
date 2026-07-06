const fs = require('fs');
let content = fs.readFileSync('estado.md', 'utf-8');
content += '\n\n### Corrección - Supabase Client Configuración Headers\n- Se modificó `src/lib/supabase.ts` para que `getClient()` inyecte automáticamente el header `x-tenant-id` con el `activeTenantId`. Esto soluciona los problemas de RLS en operaciones de `UPDATE` sobre la tabla `tenants` desde el panel de administrador, que estaban arrojando 0 registros actualizados por falta de este header.\n';
fs.writeFileSync('estado.md', content);
console.log('updated estado');
