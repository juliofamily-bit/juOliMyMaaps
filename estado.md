# Estado del Proyecto: juOliMyMapps

## ¿Qué estamos haciendo?
Auditoría completa de seguridad antes de salir a producción. 

## ¿Por qué lo hacemos?
El usuario solicitó revisar si la aplicación cumple con las mejores prácticas y es segura para ofrecerla a clientes (empresas).

## Estado Actual (Última actualización: 01 de Julio de 2026)
- **Fase:** Auditoría y Refactorización de Seguridad (COMPLETADA)
- **Hito Reciente:** Se blindó criptográficamente la aplicación. Los empleados ahora inician sesión con una API segura (`/api/auth/pin-login`) que genera un JWT real de Supabase Auth validando el RLS. Se eliminó el uso inseguro del Service Role Key en rutas sensibles (como cancelar órdenes o pago a repartidores). Se actualizaron Next.js y AFIP.js cerrando vulnerabilidades críticas.
- **Siguiente Paso:** Configurar credenciales de Mercado Pago en producción (SaaS) y preparación final para la venta al público.

## Hallazgos (01/07/2026):
- **Vulnerabilidad Crítica de Autorización:** Las API routes están utilizando el `SUPABASE_SERVICE_ROLE_KEY`, que puentea completamente el Row Level Security de la base de datos. Esto significa que cualquier usuario puede modificar los datos de cualquier negocio.
- **Manejo de variables de entorno:** Correcto. Las claves públicas están como `NEXT_PUBLIC_` y las privadas del lado del servidor. El archivo `.env.local` está correctamente en `.gitignore`.
- **Base de Datos (Supabase):** Las políticas de Row Level Security (RLS) están correctamente definidas en SQL para multi-tenancy, pero no sirven de nada si las API del backend usan el Service Key.
- **Dependencias:** Hay 20 vulnerabilidades (11 Altas/Críticas) en NPM, destacando dependencias como `next` y `@afipsdk/afip.js`.

## Siguientes Pasos (Bloqueantes para Producción):
1. Reescribir las API routes para que utilicen el token/sesión del usuario en lugar del Service Key, haciendo que se respeten las políticas RLS de Supabase.
2. Actualizar las dependencias vulnerables con `npm audit fix --force`.

## Impacto Arquitectónico
Refactorizar los endpoints en `src/app/api/` afectará la forma en que el frontend se comunica con ellos (es probable que haya que enviar los JWT del usuario autenticado si es que NextAuth o Supabase Auth se utiliza en cliente).
