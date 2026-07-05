# Estado del Proyecto: juOliMyMapps

## ¿Qué estamos haciendo?
Implementación del Embudo de Ventas (Funnel SaaS) con pruebas gratuitas y promociones temporales.

## ¿Por qué lo hacemos?
Para reducir la fricción de entrada de nuevos restaurantes y maximizar la conversión a planes de pago, incentivando a los dueños de locales con un sistema de cuenta regresiva que les otorga 14 días gratis desde su *primera venta* y luego una promoción de 30 días de Pro al precio de Básico.

## Estado Actual (Última actualización: 04 de Julio de 2026)
- **Fase:** Implementación de Embudo de Suscripciones (COMPLETADA a nivel código).
- **Hito Reciente:** 
  1. Se implementó un flujo donde los 14 días gratis inician automáticamente cuando el restaurante cobra su primer pedido (vía Trigger en BD `orders`).
  2. Se añadieron contadores visuales de caducidad en el Panel de Administración (UI).
  3. Se creó un Muro de Pago (Lock Screen) que obliga al dueño a suscribirse cuando finaliza su prueba.
  4. Se integró una lógica en Webhook (`mercadopago-saas`) para otorgar 30 días Pro por el precio de Básico en su primera suscripción, degradando automáticamente las funciones al caducar el plazo.
- **Siguiente Paso (Bloqueante):** Ejecutar el script SQL de migración en Supabase (`funnel_migration.sql`) para crear las columnas necesarias y el trigger del primer pedido.

## Impacto Arquitectónico
- **Frontend:** `AdminTab.tsx` y `page.tsx` ahora dependen críticamente de las columnas `trial_started_at` y `promo_pro_ends_at` en `saas_subscriptions`.
- **Backend:** `vercel.json` se ha configurado para lanzar `/api/cron/check-promos` diaramente.
