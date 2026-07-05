# Estado del Proyecto: juOliMyMapps

## ¿Qué estamos haciendo?
Implementación del Embudo de Ventas (Funnel SaaS) con pruebas gratuitas y promociones temporales, junto con mejoras en la gestión de personal (límites de dispositivos).

## ¿Por qué lo hacemos?
Para reducir la fricción de entrada de nuevos restaurantes y maximizar la conversión a planes de pago, incentivando a los dueños de locales con un sistema de cuenta regresiva que les otorga 14 días gratis desde su *primera venta* y luego una promoción de 30 días de Pro al precio de Básico. Además, aseguramos una experiencia fluida (UX) para los usuarios al autogestionar y evitar bloqueos molestos.

## Estado Actual (Última actualización: 04 de Julio de 2026 - Noche)
- **Fase:** Corrección de Bugs Críticos en el Embudo y UX.
- **Hito Reciente:** 
  1. Se corrigió un error crítico donde cuentas nuevas (en estado `pending_trial` antes de su primer pedido) perdían acceso a roles "Pro" como Cocina y Delivery, debido a que el sistema los degradaba al plan básico por defecto. Ahora tienen 100% de acceso desde el minuto 0.
  2. Se resolvió un error de sintaxis en el componente de Límite de Empleados (`AdminEmployeeTab.tsx`) que congelaba el panel de administración (Caja). Esto causaba que, aunque el Menú Público aceptara pedidos, el dueño no pudiera verlos llegar a pendientes ni a cocina porque su panel estaba colapsado.
  3. Se mejoró la UX de creación de perfiles: ahora, si tu plan lo permite, crear un nuevo empleado cuando estás al límite auto-incrementa tu configuración de "Límite Permitido" sin bloquearte con alertas manuales, alineándose con la filosofía de cero fricción de Hormozi.
  4. Autocreación de Cuentas: Para eliminar el paso manual, cuando un local es nuevo y no tiene personal registrado, el sistema automáticamente le crea 7 cuentas por defecto (una para cada rol: Administrador, Caja, Cocina, Repartidor, etc.) con pines aleatorios, ahorrando tiempo de configuración.

## Impacto Arquitectónico
- **Frontend:** 
  - `page.tsx`: Modificado para inyectar features Pro Ilimitado a suscripciones en estado `pending_trial`.
  - `AdminEmployeeTab.tsx`: Refactorizado para usar estados locales en `max_devices` para evitar desfases de React y auto-incrementar en BD sin requerir pasos extra.
- **Backend:** `vercel.json` se ha configurado para lanzar `/api/cron/check-promos` diaramente.
