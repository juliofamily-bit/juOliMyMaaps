# Bloc de Notas Interactivo

Aquí iremos dejando notas, tareas rápidas y recordatorios para el desarrollo del proyecto. 
Actúa como un puente asíncrono entre el dueño del sistema y el equipo de desarrollo/IA.

## Tareas Pendientes / Ideas Recientes

- [ ] **Gestión de Perfiles/Roles Activos**: Añadir configuración para que el administrador pueda activar/desactivar roles (Mozos, Delivery, DJ, Caja, etc.). Todos vendrán activados por defecto. Si un rol se desactiva, su botón de ingreso no debe aparecer en la pantalla de inicio de sesión de roles del local.
- [ ] **Aviso de Stock (Pop-up)**: Cuando un dueño de local entra por primera vez a la sección de stock, mostrar un aviso/pop-up indicándole que debe colocar las cantidades actuales de su mercadería y los precios de costo (ej: 10kg de tomate a $X) para que el sistema le calcule el margen de rentabilidad de sus recetas.
- [ ] **Mejora del Flow de Demo**: Armar el modo para "Sacar Foto al Menú" desde cuenta maestra y generar un Local Fantasma para mostrar una demo en vivo a clientes nuevos.
## Ideas Implementadas Recientes

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





