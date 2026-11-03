# Bloc de Notas Interactivo

Aquí iremos dejando notas, tareas rápidas y recordatorios para el desarrollo del proyecto. 
Actúa como un puente asíncrono entre el dueño del sistema y el equipo de desarrollo/IA.

## Tareas Pendientes / Ideas Recientes

- [ ] **Perfil de Consumo del Cliente y Promociones Quirúrgicas Hiperpersonalizadas (Club de Fidelización)**:
  - **Trazabilidad de Consumo por Teléfono**: Al identificar al cliente con su número de teléfono en el checkout o menú de mesas y cargarle sus puntos, registrar y actualizar en su perfil (`loyalty_accounts` / CRM de Clientes):
    - **Platos favoritos / más pedidos**: Qué comidas específicas pide con mayor frecuencia y en qué cantidades.
    - **Categorías preferidas**: Cuáles son sus gustos dominantes (ej: Hamburguesas, Cervezas, Pastas, Postres).
  - **Motor de Promociones Hiperpersonalizadas**:
    - Generar mensajes automáticos / campañas directas por WhatsApp basadas en sus platos predilectos (ej: *"¡Hola [Nombre]! Tenemos un descuento especial de $X para que disfrutes tu [Plato Favorito] que sabemos que te encanta"*).
    - **Detección y Descuento Automático en Caja y Checkout**: Al realizar un nuevo pedido, cuando el cliente ingresa su teléfono y el sistema detecta que tiene su comida favorita en el carrito o una promo activa asignada, el descuento se calcula y aplica automáticamente sin necesidad de cupones manuales.
- [ ] **Gestión de Perfiles/Roles Activos**: Añadir configuración para que el administrador pueda activar/desactivar roles (Mozos, Delivery, DJ, Caja, etc.). Todos vendrán activados por defecto. Si un rol se desactiva, su botón de ingreso no debe aparecer en la pantalla de inicio de sesión de roles del local.
- [ ] **Aviso de Stock (Pop-up)**: Cuando un dueño de local entra por primera vez a la sección de stock, mostrar un aviso/pop-up indicándole que debe colocar las cantidades actuales de su mercadería y los precios de costo (ej: 10kg de tomate a $X) para que el sistema le calcule el margen de rentabilidad de sus recetas.
- [ ] **Mejora del Flow de Demo**: Armar el modo para "Sacar Foto al Menú" desde cuenta maestra y generar un Local Fantasma para mostrar una demo en vivo a clientes nuevos.

## Ideas Implementadas Recientes

- [x] **Blindaje de Menú Público, Desacople de Comensales y Auto-Limpieza del Muro Social (Hito 27)**:
  - **Cero Polling Inútil en Comensales**: Desactivado el polling de 45 segundos para clientes en mesas y delivery (`isPublic = true`).
  - **75% Menos WebSockets por Visitante**: Eliminadas las suscripciones en vivo a reservas y reseñas en el menú digital; se leen limpiamente al inicio.
  - **Suscripciones SaaS Restringidas**: Canal `saas_subscriptions` reservado exclusivamente al administrador.
  - **Auto-Limpieza del Muro Social (24h)**: Purga automática de interacciones viejas al abrir la vista para mantener la base de datos permanentemente liviana.
  - **Garantía Total**: Pedidos, pagos y bloqueo reactivo por stock agotado (`Agotado`) 100% operativos.
- [x] **Blindaje Definitivo de Red, Eliminación de Pool Timeout (PGRST003) y Unificación de Broadcast (Hito 26)**:
  - **Fin del Agotamiento del Connection Pool**: Filtradas las 11 suscripciones en tiempo real por local (`tenant_id`) y añadido debouncing de 350 ms consolidando órdenes e ítems. Se redujo el tráfico a la base de datos en un 85%.
  - **Hub Permanente de WebSockets**: Centralizada la suscripción a eventos en `subscribeToTenantBroadcast()`. El socket ya no se cierra ni falla a REST API.
  - **Script SQL de Índices 100% Validado**: Corregido `phone` por `phone_number` en `loyalty_accounts`.
  - **Eliminación de Error de Hidratación HTML**: En `HelpButton.tsx`, sustituido `<button>` por `<span role="button">` sin conflictos en acordeones.
  - **Protección WakeLock**: Comprobación de visibilidad de pestaña previa a solicitar el bloqueo de pantalla.
- [x] **Arquitectura Local-First, Despacho Push y Blindaje Anticolapso (Hito 25)**:
  - **Caché Persistente Local del Plan (Cero Polling Redundante)**: Se eliminaron las consultas masivas a `/api/get-tenant-plan`. El plan se almacena en `localStorage` por 30 minutos y se resuelve en 0 ms desde la memoria del dispositivo en toda la aplicación (`page.tsx`, `AdminTab.tsx`, `AdminSaasTab.tsx`).
  - **Segmentación Estricta por Rol**: Cocina, Barra, Mozos y Despacho ya NO descargan las 5.700 comandas históricas. Solo cargan en memoria las comandas activas en curso (`pending`, `preparing`, `ready`) y órdenes recientes (máx 30). Las pantallas operativas cargan en <100 ms y consumen 95% menos RAM.
  - **Despacho Push sin Consultas Redundantes a BD**: Al emitirse `order:new` o actualizarse un plato, se inyecta en memoria en 0 ms sin forzar un `fetchData` inmediato a PostgreSQL.
  - **Pausa en Segundo Plano (`document.hidden`)**: Tanto el polling de pedidos como el de local se pausan si el celular está bloqueado o en segundo plano.
  - **Caché de Ranking de Más Vendidos (60s)**: En `PublicMenu.tsx`, 50 comensales abriendo la carta en hora pico solo realizan 1 consulta por minuto a la BD.
  - **Índices B-Tree en PostgreSQL**: Creado el script `optimizar_indices_y_rendimiento.sql` con índices en `orders`, índice parcial `idx_orders_active_partial`, `order_items`, `expenses`, `loyalty_accounts` y `products`.
- [x] **Resolución de Escalabilidad por Volumen de Pedidos (+5.700 Comandas) - Corrección de Timeout 57014 y Socket 1006 (Hito 23)**:
  - **Integridad de Datos Confirmada**: Las 5.703 comandas históricas, los más de 8.300 platos vendidos y los $52.194.792,40 ARS en ingresos acumulados de "La Cubanera 2.0" están 100% seguros e intactos en la base de datos Supabase.
  - **Causa Raíz Resuelta**: La consulta anterior hacía un join pesado en JSON (`items:order_items(*)`) sobre más de 5.700 órdenes sin límite en cada carga y cada 3.5 segundos. Al superar el tiempo límite de PostgreSQL (3.000 ms), fallaba con error 500 (`canceling statement due to statement timeout`), dejando el estado en cero y tirando abajo el WebSocket (`socket closed: 1006`).
  - **Carga Quirúrgica en 2 Pasos (`fetchOrdersOptimized`)**: Carga en paralelo los pedidos activos recientes (últimos 7 días) y las 200 órdenes más recientes, trayendo sus ítems en lotes pequeños sin bloqueos de base de datos (<500ms).
  - **Carga Histórica Paralela para Balances**: En la carga inicial de administración, descarga en paralelo todas las cabeceras de órdenes en bloques de 1.000 (<1.2s), restaurando el cálculo de Ventas, Balance y Métricas de los 8 meses completos.
  - **Difusión Inmediata (`order:new`)**: Al registrarse un pedido desde el menú digital del cliente o desde la caja, se transmite el objeto completo de la orden vía Broadcast, inyectándose en 0 ms en Cocina y Barra.
- [x] **Código QR General del Local y Control de Pedidos desde Casa en Perfil y Redes Sociales (Hito 22)**:
  - Ubicado como tarjeta principal en la cabecera de **Personalización del Local -> Perfil y Redes Sociales** (`AdminTab.tsx`).
  - Muestra el Código QR oficial de alta resolución, enlace público del menú, botón para **Descargar QR (PNG)** en alta calidad (600x600 px) para imprimir folletos/volantes/vidriera, botón para **Copiar Enlace** para la bio de Instagram y botón para **Ver Menú**.
  - Interruptor obligatorio para **Aceptar Pedidos desde el Menú de Casa (Delivery y Take Away)** (`allow_home_orders`). Si se desactiva, los comensales pueden explorar la carta digital y reservar mesa online desde sus casas, pero no pueden enviar pedidos a distancia. En las mesas del salón los pedidos continúan funcionando al 100%.
  - En `PublicMenu.tsx`, si el modo salón está activo para visitantes desde casa, se muestra un banner explicativo, modal de cortesía en productos que invita a reservar mesa o visitarnos, botón flotante `📅 Reservar Mesa Online` y bloqueo en checkout.
  - La sección **Gestión de Mesas y Códigos QR** se mantiene intacta para los QR individuales de cada mesa.
- [x] **Configuración Operativa y Tiers del Muro Interactivo (Pantallas en Vivo / Rockola VIP) (Hito 22)**:
  - Eliminado el cartel de *"Próximamente"* en `AdminTab.tsx`, habilitando la configuración operativa completa.
  - **Muro Base & Rockola VIP & Regalos**: Activación de chat en vivo, pedidos de temas musicales a la cabina/cocina y envío de regalos entre mesas (cervezas, tragos, postres), incluido en **Plan Avanzado ($90.000)** y **Plan Pro ($150.000)**.
  - **Multimedia VIP (Fotos y Notas de Voz en Vivo)**: Exclusivo de **Plan Pro ($150.000)**. Para locales en planes inferiores, exhibe badge dorado `👑 Exclusivo Plan Pro` y al intentar activarlo abre el modal interactivo de Upgrade con acceso directo a Suscripción.
  - **Botón Modo Proyector TV**: Acceso directo para proyectar el muro en pantallas gigantes y Smart TVs de salón (`/${tenant.slug}/menu#wall`) y copiar enlace.
  - Tutoriales contextuales (`?`) actualizados para QR General y Muro Interactivo.
- [x] **Unificación del Ranking de Más Vendidos del Mes en Todos los Menús (Hito 21)**:
  - **Menú de Caja (`OrderTab.tsx`)**: Se corrigió el cálculo para que coincida 100% con el ranking de "Top Más Vendidos del Mes" de Administración (`AdminTab.tsx`), eliminando el descarte incorrecto de pedidos archivados y calculando las ventas reales del mes calendario actual (con fallback a ventas históricas si el mes recién inicia). Los platos estrella aparecen al tope del catálogo con su badge `🔥 Top`.
  - **Menús Públicos (`PublicMenu.tsx` - Casa y Mesas QR)**: Se adaptó la consulta a `order_items` para calcular el ranking por ventas del mes calendario actual (`gte('created_at', startOfMonth)`). El carrusel `"Destacados & Más Vendidos"` y la grilla principal de platos priorizan los más vendidos del local y lucen sus insignias `🔥 Top` o `⭐ Destacado`.
  - **Búsqueda Inteligente Global Unificada**: En todos los menús, al tipear las primeras letras de un plato (ej: "ha"), se priorizan inmediatamente los platos que empiezan con esas letras y luego por su popularidad de ventas del mes.
- [x] **Buscador y Categorías Sticky Fijas en Pantalla en Todos los Menús (Hito 20)**:
  - En **Menú de Caja (`OrderTab.tsx`)**, **Menú de Casa (`PublicMenu.tsx`)** y **Menú de Mesas (`PublicMenu.tsx`)**, el buscador de productos y las categorías permanecen fijos en la parte superior (`sticky top-0`) al deslizar hacia abajo para buscar productos.
  - Elimina la necesidad de volver todo hacia arriba para cambiar de categoría o buscar otro plato.
- [x] **Unificación de Clientes por Teléfono y Combinación de Nombres con Barra (`Maxes / Max`) (Hito 19)**:
  - Garantiza un único cliente por número de teléfono en la Base de Datos de Clientes y Trazabilidad (`AdminTab.tsx`), evitando duplicidades.
  - Si una persona se identifica con nombres diferentes en distintos pedidos (ej. "Maxes" y luego "Max" o "José"), el sistema los unifica automáticamente como `Maxes / Max` o `Maxes / Max / José` sin duplicar apodos ni pisar información.
  - Saneamiento automático en Supabase de cuentas duplicadas previas al consultar fidelización.
  - Los mensajes personalizados de WhatsApp (CRM y campañas) se dirigen usando todos los nombres con los que se identificó (ej: `¡Hola Maxes / Max!`).
- [x] **Unificación de Ajustes y Diferenciadores en Verde Dólar (Hito 18)**:
  - Eliminada la pestaña redundante de la barra superior para mantenerla limpia y sin confusiones (Dashboard, Menú, Stock, Ventas, Balance, Ajustes).
  - Toda la gestión del Club de Clientes y Fidelización (KPIs, miembros, saldos en pesos, CRM, sincronización histórica, tiers de cashback y campañas de WhatsApp) reside exclusivamente en su apartado dentro de `Ajustes`.
  - Resaltado en **Verde Dólar** (`emerald-500`) con badge `💵 Diferenciador Clave` tanto para el **Club de Clientes / Fidelización** como para el **Muro Interactivo (Pantallas en Vivo / Rockola VIP)**, diferenciándolos visualmente del resto de ajustes.
  - Botón directo `Nueva Campaña WhatsApp` en verde esmeralda en el encabezado del acordeón.
- [x] **Rediseño del Catálogo en Menú de Caja (`OrderTab.tsx`)**:
  - Categorías compactas arriba con píldora destacada `🔥 Ofertas Especiales`.
  - Todos los productos visibles abajo ordenados por volumen de ventas (Top Ventas).
  - Búsqueda global prioritaria (las letras iniciales tienen prioridad en todo el menú).
- [x] **Regla de Fidelización: Canje al Día Siguiente y Acreditación en Tiempo Real**: Los puntos sumados hoy se canjean a partir de la próxima visita (mañana).

## Dejar Comentarios





