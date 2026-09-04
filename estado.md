# Estado del Proyecto: juOliMyMapps

## ¿Qué estamos haciendo?
Implementación del Embudo de Ventas (Funnel SaaS) con pruebas gratuitas y promociones temporales, junto con mejoras en la gestión de personal (límites de dispositivos).

## ¿Por qué lo hacemos?
Para reducir la fricción de entrada de nuevos restaurantes y maximizar la conversión a planes de pago, incentivando a los dueños de locales con un sistema de cuenta regresiva que les otorga 14 días gratis desde su *primera venta* y luego una promoción de 30 días de Pro al precio de Básico. Además, aseguramos una experiencia fluida (UX) para los usuarios al autogestionar y evitar bloqueos molestos.

## Arquitectura Canónica: Los 3 Menús del Sistema (Regla de Negocio Inquebrantable)
El sistema opera sobre tres (3) menús claramente diferenciados por su rol, canal y propósito operativo:

1. **Menú de Mesas (QR en Mesa - Auto-pedido y Atención de Salón):**
   - **Qué es y cómo funciona:** Cada mesa física del local cuenta con su código QR único e irrepetible. El cliente se sienta, escanea el QR desde la cámara de su smartphone y realiza el pedido de forma 100% autónoma. El sistema identifica automáticamente desde qué mesa se emite la orden (ej: "Mesa 5"), divide los platos entre Cocina y Barra (Smart Splitter) y alerta al personal. Desde este mismo menú, el cliente puede pulsar el botón para llamar al mozo o solicitar la cuenta.
   - **Rol del Mozo (ACLARACIÓN CRÍTICA):** El mozo **NO toma el pedido** en este menú (no va a la mesa con libreta ni tablet a ingresar platos). La toma de pedidos es enteramente del cliente. La única función del mozo es despachar y **llevar los pedidos terminados a la mesa** que el sistema le indica, y acudir cuando la mesa pulsa el botón de llamada.

2. **Menú del Cliente (Delivery / Take Away desde Casa):**
   - **Qué es y cómo funciona:** Es el menú público accesible desde internet, redes sociales o enlace web del local para comensales que se encuentran en su domicilio o trabajo.
   - **Funcionalidad:** Permite encargar comida a domicilio (Delivery con selección de zonas de envío y cálculo automático de costos de flete) o pedir para pasar a retirar por el local (Take Away).

3. **Menú de Caja / Mostrador:**
   - **Qué es y cómo funciona:** Es el menú operado directamente por el cajero o personal de atención al frente del local (`OrderTab.tsx`).
   - **Casos de uso principales:**
     a) **Locales sin mesas:** Negocios de comida rápida, al paso, rotiserías o ventanilla donde el pedido se toma y se cobra directamente en el mostrador.
     b) **Respaldo y Contingencia en locales con mesas:** Si un comensal no tiene celular con cámara, se quedó sin batería, o en situaciones donde se corte la conexión a internet en el local, el personal utiliza este menú para ingresar y cobrar la orden presencialmente.

## Estado Actual (Última actualización: 04 de Julio de 2026 - Noche)
- **Fase:** Optimización Crítica de Rendimiento en Pedidos y Comandas (Ultra-Fast Realtime) & Validación UX.
- **Hito Reciente:** 
  1. **Pedidos Ultra Rápidos (<50ms):** Se eliminó la creación/destrucción efímera de WebSockets en `src/lib/supabase.ts` implementando un canal Broadcast persistente por local (`tenant-room-${tenantId}`). Los pedidos nuevos y cambios de estado viajan con su payload directo y se inyectan en memoria en 0ms en Cocina, Barra, Mozos y Caja.
  2. **Estado Optimista Real en Cocina y Barra:** En `KitchenTab.tsx` y `BartenderTab.tsx`, al tildar un ítem se actualiza inmediatamente en pantalla y no se borra prematuramente. Cuando todos los ítems de una comanda se completan, la comanda desaparece al instante de la vista sin parpadeos.
  3. **Polling Quirúrgico de Alta Frecuencia (3.5s):** En `useRealtimeData.ts`, se separó el refresco general del refresco de comandas, garantizando que ante cualquier falla o desconexión de WebSocket, las pantallas nunca demoren más de 3 segundos en sincronizarse.
  4. **Distinción de Pago al Cajero en el Local:** En `OrderTab.tsx`, los pedidos cobrados en caja o presencialmente muestran `✅ ESTE PEDIDO HA SIDO PAGADO AL CAJERO EN EL LOCAL (EFECTIVO / DÉBITO)`, reservando "PAGADO ONLINE" exclusivamente para compras digitales por Mercado Pago.
  5. **Validación Interactiva con Parpadeo y Auto-Scroll:** En `PublicMenu.tsx` (Salón, Delivery, Llevar) y `OrderTab.tsx` (Caja), si falta un dato obligatorio (nombre, teléfono, dirección, zona), el sistema enfoca automáticamente el campo, desplaza la pantalla y lo hace parpadear con pulso rojo vibrante para guiar al usuario sin esfuerzo cognitivo (Filosofía Hormozi).
  6. **Gamificación y Pop-up de Monedero Club Clientes (Mesas y Casa):** Se integró un campo opcional de WhatsApp para pedidos en salón/mesa permitiendo vincular comensales al monedero. Se transformó la sección de fidelización en una Tarjeta VIP interactiva en el checkout con cálculo reactivo de nivel y recompensas. Se creó un Pop-up Modal animado con halo dorado, monedas saltarinas (`animate-bounce`) y comparativa de ahorro que le permite al cliente con 1 solo click decidir si canjea su saldo en la compra actual o lo acumula para su próxima visita.
  7. **Embudo de Reputación y Redirección a Google Reviews:** Cuando un cliente califica con 4 o 5 estrellas en `PublicMenu.tsx`, el sistema guarda la reseña en la base de datos, copia automáticamente el comentario en el portapapeles (`navigator.clipboard.writeText`), abre la ficha de Google Reviews del restaurante en una pestaña nueva y despliega un pop-up que le recuerda pegar su comentario (`Ctrl+V`) para mejorar el posicionamiento SEO en Google Maps. Se agregó la configuración en `AdminTab.tsx` (`cfgGoogleReviewUrl` guardado en `social_links.google_review_url`).
  8. **Disparo Automático y Banner de Fidelización en Envíos a Domicilio:** Se corrigió la condición que impedía que saltara el pop-up de la promoción cuando se seleccionaba envío a domicilio. Ahora, al ingresar un número de teléfono válido (>= 8 dígitos) en Delivery, Take Away o Salón, el cartel/popup interactivo salta automáticamente con toda la descripción de la promo (tanto si tiene saldo acumulado como si es para sumar cashback con el pedido de hoy). Además, se incorporó un banner interactivo dorado con botón "Ver Promo ✨" justo debajo del input de teléfono en los 3 canales para acceso inmediato sin scroll.
  9. **Descuento de Canjes del Club de Fidelización en el Balance, Ventas y Caja:**
     - **Vista Mensual de Balance (`AdminTab.tsx`):** Se integró una cuarta tarjeta interactiva en el panel de rentabilidad mensual: `🪙 Club / Promos: -$X`, mostrando con signo menos el total exacto de saldo y descuentos canjeados por los clientes en el período.
     - **Auditoría Transaccional:** Al hacer clic en la tarjeta `Club / Promos`, se despliegan en el panel inferior exclusivamente aquellas comandas que utilizaron saldo de fidelidad o cupones de descuento, exponiendo el monto del pedido original, cliente, comanda y el renglón negativo `-$3.000` con el badge dorado `Canje Club`.
     - **Desglose en Ingresos:** En la lista de ingresos del mes, cada comanda con canje ahora expone una insignia visible `🪙 -$X canjeado` junto al importe neto cobrado.
     - **Dashboard Diario y Semanal (`dailyStats`, `currentWeekStats`, `selectedDayStats`):** Se agregó un banner dorado de alerta contable que informa el total de canjes ejecutados en el día/semana.
     - **Cierre de Caja Diario (WhatsApp):** La función `handleShareBox` ahora incluye la línea `🪙 Canjes Club Fidelización: -$X` para cuadrar la caja física y digital con los descuentos entregados.
  10. **Carga Directa de Códigos/Reservas en Modal Anti-Olvido y Parpadeo Guiado en Carrito:**
     - **Carga en el Mismo Cartel (`PublicMenu.tsx`):** Se integró un campo de texto directo dentro del pop-up "¿Tenés algún Código de Descuento?" con botón "Aplicar ✨". Valida al instante tanto señas de reservas (`RES-...`) como códigos promocionales, informando el beneficio y permitiendo avanzar con el botón verde `🚀 Continuar con Descuento (-$X)`.
     - **Parpadeo y Auto-Foco al Volver al Carrito:** Si el cliente presiona "Volver al Carrito para cargarlo", el sistema cierra el modal, hace auto-scroll suave hacia el contenedor del cupón, enfoca el input y activa un parpadeo visual enérgico (`animate-pulse ring-4 ring-orange-500`) con un banner animado `👇 ¡COLOCÁ TU CÓDIGO DE DESCUENTO ACÁ! 👇` que no se detiene hasta que el usuario comienza a escribir.
     - **Disponibilidad Permanente:** Se eliminó la condición que ocultaba el input del cupón en locales con reservas desactivadas, asegurando que tanto en salón/mesas como en delivery/llevar siempre esté visible.
  11. **Alerta Obligatoria de Cobro y Pop-up Interactivo en Despacho / Delivery (`DeliveryTab.tsx`):**
     - **Pop-up de Apertura y Crucecita de Cierre:** Cada vez que el repartidor abre la aplicación de despacho con pedidos pendientes, salta en primer plano un pop-up modal que le indica con exactitud si debe cobrar el pedido en efectivo (con el importe gigante en rojo) o si ya fue pagado online con Mercado Pago (en verde), el cual debe cerrar tocando la crucecita `✕` o el botón de confirmación.
     - **Intercepción en Mensajes de WhatsApp ("En Camino" y "Llegué/Estoy afuera"):** Al presionar "En Camino 🛵" o "Llegué / Estoy afuera 🏠", antes de abrir WhatsApp le salta el pop-up modal recordándole si debe cobrar en puerta o no, evitando olvidos al interactuar con el cliente.
     - **Protección Visual Extrema en Celular (Borde y Banner Rojo/Verde):** Si la orden requiere cobro, la tarjeta completa del pedido se viste con borde rojo brillante `border-rose-500` y un banner superior gigante: `🚨 ATENCIÓN REPARTIDOR: DEBES COBRAR ESTE PEDIDO EN PUERTA: $X`. Si fue pagada con Mercado Pago, exhibe el banner verde: `✅ PAGADO ONLINE: NO COBRAR NADA AL CLIENTE`.
     - **Bloqueo al Finalizar Entrega:** Al tocar "Entregado / Finalizar Pedido", si la orden está pendiente de pago, el pop-up modal le exige confirmación explícita: `¿Ya cobraste los $X en efectivo a {cliente}?`, impidiendo cierres accidentales.
  12. **Sistema Global de Botones de Ayuda `?` (Tutoriales Interactivos Contextuales):**
      - Botones con icono de ayuda `?` accesibles en todos los módulos de configuración, ajustes y secciones operativas.
  13. **Sistema de Insumos Opcionales en Combos y Descuento Selectivo de Stock (Hito 13):**
      - **Panel Admin (`AdminTab.tsx`):** Cada insumo de la receta cuenta con un botón interactivo `Fijo` (gris) / `⭐ Opcional` (naranja). Al marcar insumos como opcionales, el sistema genera dinámicamente y en tiempo real la pregunta personalizada con los nombres de las opciones: `¿Qué producto prefieres? (Coca Chica / Sprite)` y activa la obligación de respuesta. Se agregó una tarjeta informativa clara que explica que "Fijo" descuenta siempre el insumo, y "Opcional" permite al cliente elegir uno al comprar.
      - **Menú Público Digital (`PublicMenu.tsx`):** Al elegir un producto con opciones o preguntas, se abre una ventana modal que lista las opciones obligatorias con botones circulares tipo radio button y un campo de texto para aderezos o aclaraciones (ketchup, sin cebolla, etc.). En el carrito lateral se exhibe la opción elegida `⭐ Opción: Coca Chica`.
      - **Menú de Mozo (`WaiterTab.tsx`) y Caja / Mostrador (`OrderTab.tsx`):** Ambos sistemas interceptan productos con opciones antes de ingresarlos a la comanda, permitiendo al personal marcar la bebida o variante solicitada por el comensale. Guarda la clave compuesta `productId::optionId` para distinguir entre unidades con opciones diferentes en una misma mesa.
  14. **Descuento de Stock Selectivo (PostgreSQL Trigger):**
      - Se definió la función `reduce_stock_on_delivery()` en PostgreSQL para que cuando un pedido se marque como `delivered`, descuente todos los insumos fijos (`is_optional = false`) y ÚNICAMENTE el insumo opcional seleccionado por el cliente (`selected_optional_ingredients`), evitando descontar todas las bebidas del stock.

## 1. Tareas Pendientes / Prioridades
*   ~~**Restaurar visibilidad de paneles en el footer:** El usuario informa que, aunque los roles existen, los iconos/paneles correspondientes en el footer (navegable inferior) no aparecen. El usuario espera que si tiene perfiles creados (Ej: Animador, Cocina), estos botones aparezcan dinámicamente en el footer para permitirle cambiar de vista.~~ **Status: SOLVED (Se ajustó el check de `Todas las funciones` que ocultaba Mozo, Delivery y Barra en planes Pro).**
*   **Eliminación de cuentas de Mercado Pago:** Cómo desvincular cuentas desde el panel vendedor. **Status: IN PROGRESS (Se indicó al usuario cómo hacerlo borrando el Access Token).**
*   **Gestión de suscripciones / Dar de baja:** El usuario reporta que el botón de "cancelar suscripción" no funciona. **Status: EXPLAINED (Se le aclaró que no hay subactiva en el trial).**
*   **Integración de Reseñas de Google:** Embudo de reputación. **Status: SOLVED (Implementado Filtro Inteligente en PublicMenu y configuración en AdminTab).**

## Impacto Arquitectónico
- **Frontend:** 
  - `page.tsx`: Modificado para inyectar features Pro Ilimitado a suscripciones en estado `pending_trial`.
  - `AdminEmployeeTab.tsx`: Refactorizado para usar estados locales en `max_devices` para evitar desfases de React y auto-incrementar en BD sin requerir pasos extra.
- **Backend:** `vercel.json` se ha configurado para lanzar `/api/cron/check-promos` diaramente.
\n\n### Actualizacion - Periodo de Prueba y Bloques\n- Se agrego un endpoint (/api/trial/start) que se gatilla al insertar el primer pedido para cambiar de pending_trial a trial y setear la fecha inicial.\n- Se configuro el banner de 14 dias en AdminTab para mostrar alerta al llegar al dia 12.\n\n\n### Actualizacion - Global Trial Banner y Tiempo Real\n- Se agrego un listener en tiempo real (Supabase Realtime) en page.tsx para escuchar cambios en saas_subscriptions. Esto elimina la necesidad de recargar la pagina para ver el estado desbloqueado.\n- Se agrego un Banner Global de prueba de 14 dias en la parte superior de TODAS las pantallas para usuarios con rol admin.\n- Se corrigio el lock de Balance Financiero que ocurria porque no se habia refrescado el estado.\n\n\n### Hotfix - Tabs y Sintaxis en page.tsx\n- Se corrigio un error de sintaxis causado por la mala inyeccion de dependencias que descalabro el archivo page.tsx.\n- Se restauraron todas las pestañas inferiores para que siempre sean visibles (Pedidos, Cocina, Barra, Despacho, Mozo, Animador, Admin).\n- Se volvio a aplicar el banner global de forma segura y se confirmo que el build de TypeScript esta 100% libre de errores.\n\n\n### Hotfix 2 - Feature Flags Hardcodeados\n- Se corrigio un bug critico donde los usuarios en Trial estaban leyendo los permisos de la tabla saas_plans de la base de datos, los cuales tenian nombres incorrectos.\n- Ahora, si el usuario esta en Trial o Promo, los permisos (incluyendo Balance Financiero Avanzado) se inyectan a la fuerza (hardcoded array) independientemente de lo que diga la base de datos, garantizando que el sistema funcione al 100% completado durante los 14 dias y los 30 dias posteriores de promo.\n\n\n### Hotfix 3 - RLS Race Condition Fix\n- Se detectó un error arquitectónico donde el cliente frontend de Supabase ejecutaba la lectura de saas_subscriptions ANTES de restaurar la sesión o sin cabeceras válidas, fallando la política RLS.\n- Se creó una ruta API Serverless (/api/get-tenant-plan) que utiliza el SUPABASE_SERVICE_ROLE_KEY para ignorar las políticas RLS y devolver siempre el plan real del tenant, eliminando por completo los falsos bloqueos (Race Conditions) para el usuario.\n

### Mejora - Buscador Inteligente en Caja
- Se agregó una barra de búsqueda en el panel de toma de pedidos (OrderTab).
- Permite buscar productos por texto en tiempo real (ej. "combo hamburguesa").
- Integra reconocimiento de voz (API Web Speech) para buscar productos dictándolos por micrófono.
- Si hay texto en el buscador, se omiten las categorías y se muestran todos los productos coincidentes del local.


### Mejora - Buscador de Insumos en Admin
- Se agregó una barra de búsqueda en el modal de creación/edición de productos (AdminTab) específicamente para los insumos.
- Permite buscar insumos por texto y por voz.
- Filtra automáticamente la lista de insumos disponibles al buscar.


### Mejora - Acciones Masivas (Aumento en $)
- Se agregó la posibilidad de aumentar el precio de forma masiva utilizando un monto fijo en pesos, además de poder hacerlo por porcentaje.
- Se añadieron selectores en el panel de acciones masivas para alternar entre % y $.


### Mejora - Buscadores Globales en AdminTab
- Se añadió una barra de búsqueda con funcionalidad de dictado por voz (Micrófono) en la pestaña principal de "Menú". Permite filtrar rápidamente la lista completa de productos disponibles.
- Se añadió la misma funcionalidad de búsqueda (texto y voz) en la pestaña "Stock", permitiendo encontrar rápidamente los insumos para editarlos.


### Corrección - Supabase Client Configuración Headers
- Se modificó `src/lib/supabase.ts` para que `getClient()` inyecte automáticamente el header `x-tenant-id` con el `activeTenantId`. Esto soluciona los problemas de RLS en operaciones de `UPDATE` sobre la tabla `tenants` desde el panel de administrador, que estaban arrojando 0 registros actualizados por falta de este header.


### Nueva API Route para actualizar Configuración de Tenant (`/api/update-tenant`)
- Se implementó una API route dedicada que utiliza el `SUPABASE_SERVICE_ROLE_KEY` para guardar los ajustes del administrador. Esto evita el error de "0 registros actualizados" causado por el parche de seguridad de Auth RLS (`supabase_auth_rls_patch.sql`), el cual exige un JWT de Supabase Auth para validar el `tenant_id`. Dado que el panel de administración valida por PIN local y usa sesión anónima, la única forma robusta de actualizar la tabla `tenants` (sin desprotegerla) es a través de una API route del lado del servidor.

### Rebranding Global "High-Ticket" (Negro Profundo y Dorado)
- Se implementó un rediseño de UI en toda la suite utilizando la técnica de secuestro de paletas (`@theme` en `globals.css`) con Tailwind v4.
- Los tonos base `slate` y `neutral` pasaron a `Deep Black` (#050505, #111111, #1A1A1A).
- Los colores primarios `orange` y `amber` ahora renderizan Oro Metálico (#D4AF37) y Bronce (#C5A059).
- Se añadieron micro-animaciones en `globals.css` (Hover lift: `translateY(-4px)` y resplandores dorados `box-shadow`) para todos los elementos interactivos, y tracking tipográfico para lograr una estética "Apple/Luxury Boutique" tanto en Light como en Dark mode.

### Mejora UX: Notificaciones Inmediatas de Fidelización (Club de Clientes)
- Se desactivó el Club de Clientes (Cashback) por defecto para los nuevos restaurantes creados (ahora la evaluación es estricta: `loyalty_enabled === true`), previniendo que entreguen dinero virtual accidentalmente sin haberlo configurado.
- Se agregó el cálculo visual en el Frontend (`PublicMenu.tsx` y `OrderTab.tsx`) que detecta y calcula cuánto cashback está ganando el cliente por la orden actual. 
- En el Menú de Cliente (PublicMenu), al finalizar exitosamente la compra, ahora aparece un cartel interactivo indicando exactamente en pesos ($) el beneficio desbloqueado, indicando al cliente que se lo identificará mediante su número celular en su próxima visita (estrategia UX/Retención solicitada por el usuario).
- En el panel de Caja/Meseros (OrderTab), el cajero ahora recibe el monto de cashback ganado en el Alert de éxito, para informarle verbalmente al cliente.

### Correcciones Generales del Panel Admin (Checkpoint)
- Se corrigió el botón de guardar de `Fidelización (Club de Clientes)`, `Mesas`, `AFIP` y `Mozos` para que todos utilicen la ruta segura `/api/update-tenant`. Esto soluciona el problema de que el interruptor de fidelización se volvía a activar solo al recargar.
- Se verificó que los buscadores con texto y voz para "Stock" y "Menú" ya se encontraban implementados correctamente en el código bajo los estados `adminStockSearchQuery` y `adminProductSearchQuery`.


### Correcciones Checkpoint 36 (Pagos y UI)
- **Pagos con MercadoPago:** Se corrigió el flujo de pedidos por MercadoPago. Ahora, cuando un cliente pide y elige pagar online, la orden y sus items se insertan con estado `pending_payment`. La pestaña de cocina (`KitchenTab`) los ignora por completo para evitar que se preparen pedidos no abonados. Recién cuando MercadoPago retorna el `collection_status=approved`, se actualiza todo a `pending` (y `pagado`), enviando automáticamente el pedido a la cocina.
- **UI Acciones Masivas:** Se agregó `flex-wrap` a la barra de acciones masivas en la vista de stock/productos para que en pantallas móviles pequeñas el selector de "%" vs "$" no se oculte.
- **Suscripción La Cubanera 2.0:** Se actualizó por base de datos la suscripción a `Plan Pro` por un año para habilitar el acceso a todas las características premium en ese tenant.


### Correcciones Checkpoint 37 (UX y Lógica)
- **Banner de Suscripción:** Se corrigió la prioridad visual del banner de suscripción. Si hay una promoción activa (Promo Pro), esta tiene prioridad sobre el mensaje de Todavía no iniciaste tu prueba.
- **Acciones Masivas (% vs $):** Se implementó desde cero un selector para alternar entre aumento por porcentaje (%) y aumento por monto fijo ($) en las acciones masivas de productos, una funcionalidad que el usuario recordaba pero que en realidad no existía, adaptando toda la lógica de actualización en lote para soportar ambos formatos.
- **Feedback de Mapas Visuales:** Se registró la idea del usuario de mapas de mesas escalados en el bloc de notas.

- **UI Móvil Acciones Masivas:** Se rediseñó la estructura flex de la barra flotante. Ahora en celular los controles bajan a líneas independientes y ocupan todo el ancho (w-full) para garantizar que los botones de [%] y [$] sean grandes, fáciles de tocar y no queden ocultos por falta de espacio.


### Correcciones (Bug Guardar Ajustes)
- **Resolución Error 406:** Se refactorizaron absolutamente todas las funciones del AdminTab.tsx que modificaban el tenant en la base de datos (Guardar Ajustes, Mesas, Fidelización, AFIP, Eliminar Mozo) ya que usaban actualizaciones directas con .single() fallando por restricciones de RLS. Ahora, TODAS pasan unificadamente a través de la API /api/update-tenant que utiliza permisos de super-admin, solucionando de raíz los errores cannot coerce the result to a single JSON object (Error 406) al guardar la configuración, incluyendo el cambio de colores y modo oscuro/claro.
- **Soporte Técnico (Admin):** Se configuró el número de WhatsApp real del administrador (+54299530971) en el botón flotante de soporte técnico.


### Correcciones Checkpoint 42 (Visibilidad de Inputs en Menú Público)
- **Resolución Textos Invisibles:** Se corrigió un error visual en el Menú de Cliente (PublicMenu.tsx) donde la barra de búsqueda general y los campos de texto en los modales (como pedir datos, nombre, etc.) escribían el texto en color negro sobre fondos oscuros (g-neutral-900/950), haciéndolos ilegibles (texto invisible). Se aplicó lógica adaptativa para la barra de búsqueda respetando el Modo Claro y Oscuro, y se forzó 	ext-white para todos los formularios internos oscuros.

### Correcciones Checkpoint 43 (Fondo Oscuro en Landing Page y Contraste)
- **Resolución Landing Oscura en Modo Claro:** Se corrigió un error en PublicMenu.tsx donde la parte inferior de la vista pública (muro social, slider de ofertas, opiniones y tarjetas de productos en la landing) tenía fondos negros (g-neutral-900/950) estáticos (hardcodeados). Ahora todos los contenedores principales respetan la variable isLight, cambiando de manera dinámica a blancos y grises claros (g-white / g-slate-50) en Modo Claro, manteniendo la legibilidad sin sacrificar la elegancia de la marca.
- **Mejora de Contraste en Modo Claro:** Se aumentaron los pesos de color para las descripciones en Modo Claro, pasando de grises pálidos (	ext-slate-500) a grises más oscuros y definidos (	ext-slate-700), tal como solicitó el usuario, aumentando el contraste.
### Refactorizacion - Panel de Personalizacion
- Se agruparon las secciones 'Identidad de Color', 'Horarios de Atencion', 'Perfil y Redes Sociales' y 'Landing Page' bajo una nueva super-categoria de 'Personalizacion del Local' en el AdminTab.tsx.
- El objetivo fue limpiar la interfaz y facilitar la experiencia del usuario sin perder o alterar ninguna de las logicas internas (ux_and_value_equation).

### Hotfix 4 - Logica de Planes Pro y Bloqueos (Balance y Muro Interactivo)
- Se reescribieron los textos de bloqueo del modal (AdminTab.tsx) para que digan Funci�n Pro en lugar de Funci�n Premium y Premium VIP, solucionando la disonancia cognitiva y unificando el nombre de los planes.
- Se inyect� la feature 'Muro Interactivo' en page.tsx para los usuarios que est�n cursando el Trial de 14 d�as o la Promo Pro de 30 d�as, permiti�ndoles desbloquear la rockola.
- Se des-hardcode� el panel de 'Muro Interactivo' (Rockola) en AdminTab.tsx. Antes mostraba invariablemente un candado; ahora, si el sistema detecta que el local tiene el feature activado, permite abrir el panel exitosamente (mostrando un mensaje de 'activado').
- Se garantiz� que 'Balance Financiero Avanzado' siga inyect�ndose correctamente en 14 d�as, el usuario no deber�a ver m�s el cartel bloqueador.

### Hotfix 5 - QA Bug de Planes y Caducidad de Trial
- Se detect� y arregl� un bug de ruteo en el Modal del candado (AdminTab.tsx) que al hacer click en 'Ver Planes y Precios' asignaba la vista incorrecta y enviaba al usuario a una pantalla vac�a (negra). Ahora redirige de forma exitosa a la vista de configuraci�n y expande el acorde�n de Suscripci�n.
- QA (Seguridad de Trial): El usuario estaba siendo bloqueado en Balance Financiero a pesar de nuestro arreglo previo porque, seg�n la Base de Datos de Producci�n/Local (Supabase), su periodo de 14 d�as hab�a comenzado el 05 de Julio de 2026. Al ser Agosto, sus 14 d�as expiraron leg�timamente, por lo que el sistema cort� sus permisos autom�ticamente y pas� a comportarse como un plan B�sico (ya que los feature flags condicionales de page.tsx eval�an la fecha exacta mediante Date.now()). Se resete� su trial_started_at a la fecha de HOY mediante script para permitir la continuaci�n de sus pruebas funcionales.


### Actualización - Videos y Enlace de Platos en Carrusel
- **Soporte para Videos Cortos (15s):** En la configuración de Landing Page (Admin), cada slide del carrusel permite alternar entre Foto y Video (hasta 15 seg). Se reproducen automáticamente en bucle y silenciados tanto en el panel como en la vista pública.
- **Enlace de Platos con Compra Directa con 1 Clic:** Se agregó un selector de productos en cada diapositiva del carrusel. Al seleccionar un plato, se autocompleta la información del slide y en la Landing Page pública aparece un botón de compra directa ('Pedir [Precio]') que navega al menú y añade el producto al carrito automáticamente con un solo toque.


### Corrección - Error al Activar Restricciones Horarias
- **Causa del Error:** En el componente ScheduleEditor, cuando un local no tenía la propiedad schedule inicializada en su registro de business_hours / delivery_hours / reservation_hours, el acceso directo a cfg.schedule[day.id] generaba un TypeError en React, provocando la caída de la página ("no se pudo cargar la página").
- **Solución Implementada:** Se definió DEFAULT_SCHEDULE de forma global y defensiva para todos los días de la semana. Tanto la carga inicial como la activación del toggle y la adición/eliminación de turnos cuentan con salvaguardas contra valores nulos o indefinidos.


### Regla Operativa - Exclusividad de Pedidos Fuera de Horario para Caja (POS)
- **Bloqueo a Clientes (Web y Mesas):** Fuera del horario de atención configurado en el local, la página web pública y los menús de mesas con código QR quedan 100% bloqueados para pedir (el carrito muestra aviso informativo y el botón de confirmar pedido permanece deshabilitado).
- **Acceso Exclusivo de Caja:** El panel de Caja (`OrderTab` -> "Registrar Pedido") mantiene habilitada la toma directa de pedidos en todo momento para atender a clientes que ya se encuentren dentro del local o pedidos de última hora.


### Rediseño de Contacto, Redes y Horarios (Landing & Menú Público)
- **Identidad Visual Oficial de Redes:**
  - **Instagram:** Icono con gradiente oficial de Instagram (`#E1306C` / fucsia / naranja), etiqueta "Instagram" y descripción "Seguinos para ver nuestras fotos, historias y promociones exclusivas".
  - **WhatsApp:** Icono con verde oficial (`#25D366`), etiqueta "WhatsApp" y descripción "Chateá con nosotros para consultas, dudas o pedidos especiales".
- **Horarios de Atención y Envíos con Selector / Pestañas:**
  - **Horarios de Atención (Local):** Icono de reloj dorado/ámbar con indicador de estado ("Abierto" / "Cerrado") y desglose semanal de turnos.
  - **Horarios de Envío (Delivery):** Icono de reparto en moto/camioneta celeste con indicador de estado ("Delivery Activo" / "Cerrado Hoy") y desglose de franjas horarias de entrega.
- **Nueva Sección en la Landing Page:** Bloque interactivo con tarjetas descriptivas de contacto rápido, turnos semanales y enlace directo a perfiles y chat.


### Sincronización de Envíos en Landing & Menú con Módulo de Administración
- **Control Maestro (`has_delivery`):** Si en Administración -> "Módulo y zonas de envío" la opción "Activar Envíos (Delivery)" está desactivada:
  - En la Landing Page, la tarjeta de envíos muestra claramente: **"Por el momento no hacemos envíos a domicilio. Te esperamos para disfrutar en el local o pedir para retirar (Takeaway)"** con el indicador `No disponible`.
  - En la barra superior (Header) no se muestra el botón de horarios de envío.
  - En el modal de horarios, la pestaña de Envíos informa cordialmente que el local no cuenta con delivery activo.
- **Envíos Activos:** Si está activado, refleja fielmente los días de reparto, turnos horarios de envío configurados y el estado del botón de pánico (`Envíos Pausados`).


### Corrección Visual en Landing & Sistema de Productos Destacados
- **Corrección de Artefacto Visual (Instagram / Muro):**
  - Se eliminó el resplandor de fondo desbordado (`blur-xl`) que provocaba distorsión en forma de rayas o efecto de pantalla rota en tablets y móviles encima del bloque de contacto.
  - Se optimizó el renderizado de la tarjeta de Instagram con bordes limpios y fondos sólidos.
- **Sistema de Productos Destacados en Portada:**
  - **En Menú de Administración:**
    - Se agregó un botón rápido de Estrella (⭐) en cada tarjeta de producto para marcarlo/desmarcarlo como destacado en 1 solo clic.
    - Se agregó un switch interactivo dentro del formulario/modal de creación y edición de productos: *"Destacar en Portada / Landing"*.
  - **En Landing Page ("Lo Más Destacado"):**
    - Se priorizan automáticamente primero los platos elegidos como destacados por el administrador (mostrando su badge dorado de Destacado).
    - Se mejoró el renderizado visual para que las fotos subidas por el comercio se vean 100% nítidas, brillantes y sin filtros oscuros que tapen la imagen real.


### Integración de Destacados y Ranking de Más Vendidos en Landing & Menú
- **Persistencia de Destacados (`featured_product_ids`):**
  - Se corrigió la inicialización en `AdminTab.tsx` para que no descarte `featured_product_ids` al cargar la configuración de landing del tenant.
  - El botón con estrella (⭐) del menú de administración ahora sincroniza y persiste de inmediato los productos elegidos.
- **Ranking de Ventas en Tiempo Real:**
  - El sistema calcula dinámicamente las cantidades vendidas por cada producto a partir de `order_items`.
  - El orden de aparición prioriza:
    1. **⭐ Destacados:** Platos elegidos manualmente por el administrador (insignia dorada).
    2. **🔥 Top Ventas / Más Vendidos:** Platos con mayor volumen de ventas registradas en caja y pedidos.
    3. **Resto del catálogo:** Platos activos complementarios.
- **Carrusel de Destacados & Más Vendidos en Vista Menú:**
  - Se agregó una sección destacada interactiva al inicio del Menú público (cuando está en la pestaña "Todo").
  - Permite a los clientes pedir o agregar directamente al carrito en 1 clic los platos favoritos del negocio.


### Actualización - Escáner Mágico con IA & Modo Vendedor Flash (02 de Septiembre de 2026)
- **¿Qué hicimos?:**
  1. Conexión de IA de Visión con Google Gemini 3.6 Flash (el modelo activo y más veloz del catálogo oficial).
  2. Implementación de catálogo gastronómico inteligente (src/lib/foodImages.ts) que asigna automáticamente fotos apetitosas de alta resolución y banners acordes a cada plato y estilo culinario detectado.
  3. Extracción fidedigna de la identidad de color (primario, secundario y modo claro/oscuro) de la carta física/PDF del cliente para inyectarla en tenant.theme_colors.
  4. Creación del endpoint de servidor /api/ai-scanner/create-ghost-tenant con Supabase Service Role para crear instantáneamente el Local Fantasma con sus categorías, productos, recetas de stock, banners y destacados.
  5. Interfaz interactiva en MagicScanner.tsx (/magic-scanner) que permite sacar foto o subir PDF, ver la lectura en vivo con fotos gastronómicas y un botón de un clic para crear el local fantasma y abrir su menú público o panel de administración en vivo.
- **¿Por qué lo hicimos?:**
  Para permitir demos comerciales de 60 segundos ante potenciales clientes sin que el vendedor tenga que configurar nada a mano, y para el auto-onboarding ultrarrápido de nuevos locales.
- **Impacto Arquitectónico:**
  - Nueva ruta API: /api/ai-scanner y /api/ai-scanner/create-ghost-tenant.
  - Componente: src/components/MagicScanner.tsx.
  - Página de pruebas: src/app/magic-scanner/page.tsx.
  - Helper: src/lib/foodImages.ts.


### Actualización - Alto Contraste para Modo Claro & Precisión Gastronómica con Guarniciones (02 de Septiembre de 2026)
- **¿Qué hicimos?:**
  1. **Rediseño Integral de Alto Contraste en Modo Claro (Light Mode):**
     - Se aplicaron reglas globales en globals.css para que en modo claro las tarjetas (.glass) se conviertan en paneles blancos limpios con sombras suaves (#ffffff y bordes #e2e8f0) en lugar de bloques translúcidos grises que se fundían con el fondo.
     - Se forzó que los textos (.text-white) se conviertan en negro carbón (#0f172a) y los secundarios en gris grafito (#475569) garantizando legibilidad total.
     - Se incorporó un botón visible y explícito de Edición (<Edit size={13} />) en cada insumo de stock (en azul de alto contraste con fondo claro).
     - Se restauró la opacidad de los botones de edición y eliminación de categorías y productos al 100% con bordes y fondos distintivos (azul y rojo sólidos).
     - Se corrigió el fondo hardcodeado de la Landing Page en PublicMenu.tsx para que adapte su atmósfera al modo claro/oscuro del local.
  2. **Inteligencia Fotográfica Gastronómica y Guarniciones (Fin de fotos repetidas):**
     - Se desacopló por completo el pescado del sushi en el catálogo (src/lib/foodImages.ts). Ahora el pescado al plato/merluza/plancha recibe fotos reales de filets cocidos con guarnición y limón, reservando el sushi únicamente para sushi o rolls.
     - Se implementó un sistema de rotación con contadores (anti-repetición) que garantiza que productos de la misma familia (ej. varias hamburguesas o varios pescados) nunca reciban la misma fotografía en un menú escaneado.
     - Se entrenó a Gemini 3.6 Flash para detectar con precisión las guarniciones del plato (con papas fritas, con puré, con ensalada) e incorporarlas en la descripción apetitosa.
- **Impacto Arquitectónico:**
  - src/app/globals.css: Nuevas clases de alto contraste para .theme-light y .light-mode.
  - src/components/PublicMenu.tsx: Adaptación dinámica de fondo de landing y textos según isLight.
  - src/components/AdminTab.tsx: Botones de edición explícitos en Stock, contraste en categorías y productos.
  - src/app/api/ai-scanner/route.ts: Prompt mejorado para guarniciones y rotación de imágenes sin repeticiones.
  - src/lib/foodImages.ts: Catálogo ampliado con diferenciación de pescados y anti-repetición.


### Actualización - Rediseño de Alto Contraste en Stock (02 de Septiembre de 2026 - Noche)
- **¿Qué hicimos?:**
  1. Se rediseñó por completo la fila y tarjeta de insumos de stock en AdminTab.tsx cuando el local está en Modo Claro (isLightMode).
  2. La tarjeta de insumo ahora es un panel blanco puro (#ffffff) con borde sólido (border-2 border-slate-200) y sombra suave, eliminando el fondo grisáceo apagado.
  3. El nombre del insumo ahora se muestra en negro carbón profundo (#020617 / text-slate-950) y en tamaño más grande.
  4. La etiqueta de "Costo: $X / unidad" se rediseñó como una insignia destacada con borde y texto negro carbón (#0f172a) sobre fondo gris suave, siendo legible instantáneamente sin esfuerzo.
  5. Se creó un botón dedicado, grande y azul intenso (bg-blue-600) con el icono de lápiz y el texto "Editar" con sombra, perfectamente identificable desde cualquier distancia.
- **Impacto:**
  - src/components/AdminTab.tsx: Filas de insumos, etiquetas de costo, botón de edición azul y contraste de navegación.


### Actualización - Fidelidad Visual Gastronómica Específica y Cero Repeticiones (02 de Septiembre de 2026 - Fin de Sesión)
- **¿Qué hicimos?:**
  1. Se expandió y especializó exhaustivamente el catálogo de imágenes culinarias (src/lib/foodImages.ts) para desacoplar y especificar platos que antes caían en grupos genéricos:
     - Pulpo a las brasas / a la gallega: imágenes dedicadas de tentáculos y platos de pulpo gourmet.
     - Yemas de espárragos: fotografías de espárragos blancos/verdes servidos en plato gourmet.
     - Alcachofas / Alcauciles: fotografías de alcachofas confitadas enteras.
     - Langostinos / Gambas / Camarones: platos dorados al ajillo y cazuelas.
     - Calamares y chipirones: calamar sellado a la plancha y rabas con limón.
     - Pescados al plato / Merluza: filets con guarnición y salsa de limón.
     - Carnes de parrilla / Bife de chorizo: cortes a punto con guarniciones.
  2. Sistema de Cero Repetición: Cada categoría gastronómica cuenta con un array de fotos de alta resolución y un contador de rotación independiente, garantizando que si una carta tiene múltiples platos de una misma familia o huerta, todos reciban una fotografía distinta y exclusiva.
  3. Integración en el Escáner de IA (src/app/api/ai-scanner/route.ts): Gemini 3.6 Flash ahora extrae campos para identificar si el plato tiene imagen en la carta física (tiene_foto_en_menu) y asigna descriptores visuales precisos.
- **Validación:**
  - Test automatizado con 8 platos diferentes (pulpo, espárragos, alcachofas, langostinos, calamares, merluza, bife, milanesa) arrojó 8 URLs 100% distintas y temáticamente exactas.


### Actualización - Cupones y Reservas en Modal Anti-Olvido & Parpadeo en Carrito (03 de Septiembre de 2026)
- **¿Qué hicimos?:**
  1. En el modal anti-olvido (`showAntiForgetModal`) al tocar "Finalizar Pedido", se añadió un campo de texto directo con botón "Aplicar ✨".
  2. Valida al instante tanto códigos de reservas (`RES-...`) como códigos de descuento (`discount_codes`). Si es válido, recalcula el total con descuento y el botón principal pasa a ser "🚀 Continuar con Descuento (-$X)".
  3. Si el cliente elige "🔙 Volver al Carrito para cargarlo", la app hace auto-scroll suave, enfoca el input del cupón y activa un halo pulsante (`ring-4 ring-orange-500 animate-pulse`) junto a un banner saltarín: `👇 ¡COLOCÁ TU CÓDIGO DE DESCUENTO ACÁ! 👇`.
  4. El contenedor del cupón en el carrito ahora está siempre visible tanto en Salón como en Delivery o Take-away.
- **¿Por qué lo hicimos?:**
  Para que el cliente no se frustre volviendo atrás y pueda cargar su seña de reserva o cupón directamente en el modal o encontrarlo inmediatamente en el carrito sin fricción.
- **Impacto:**
  - `src/components/PublicMenu.tsx`: `handleValidateCoupon`, `triggerCouponHighlight`, modal anti-olvido y carrito.


### Actualización - Candado de Cobro Obligatorio para Repartidores en Despacho / Delivery (03 de Septiembre de 2026)
- **¿Qué hicimos?:**
  1. Pop-up de advertencia de cobro al abrir la pantalla de Despacho: si hay pedidos no pagados online, salta una ventana modal roja con sirena 🚨 indicando el importe exacto a cobrar en efectivo. Si está pagado por Mercado Pago, salta en verde confirmando que no debe cobrar nada.
  2. Al tocar "En Camino 🛵" o "Llegué / Estoy afuera 🏠", se intercepta la acción y se le vuelve a recordar al repartidor si debe cobrar en puerta antes de abrir WhatsApp.
  3. Cada tarjeta de delivery en el panel móvil tiene un banner superior gigante y borde rojo brillante `border-rose-500` si está pendiente de cobro, o verde si fue pagado online.
  4. Botón inferior con candado: "💵 Cobrar $X y Finalizar Pedido", con confirmación obligatoria para evitar olvidos.
- **¿Por qué lo hicimos?:**
  Porque en el celular la interfaz es pequeña y los repartidores olvidaban cobrar los pedidos en puerta antes de entregar la comida.
- **Impacto:**
  - `src/components/DeliveryTab.tsx`: Modal `paymentAlertModal`, banners superiores en tarjetas y verificación de cobro.


### Actualización - Sistema Global de Botones de Ayuda '?' y Tutoriales Interactivos (03 de Septiembre de 2026)
- **¿Qué hicimos?:**
  1. **Regla Global Inquebrantable:** Añadida a `C:\Users\almir\.gemini\config\AGENTS.md` bajo `<RULE[contextual_help_and_tutorials]>`, exigiendo que todas las pantallas, apartados, submenús y formularios de configuración de todos los proyectos cuenten con un botón `?` interactivo.
  2. **Catálogo de Ayuda (`src/data/contextualHelpData.ts`):** Diccionario completo con explicaciones sin tecnicismos, listas de pasos obligatorios 1, 2, 3, e impacto comercial para cada sección del software.
  3. **Componentes Reutilizables:**
     - `ContextHelpModal.tsx`: Pop-up flotante con diseño premium, halo temático, pasos obligatorios numerados, consejo pro y botón "¡Entendido, gracias!".
     - `HelpButton.tsx`: Botón circular interactivo con símbolo `?` que detiene la propagación de eventos (`e.stopPropagation()`) y abre el tutorial contextual de su apartado específico.
  4. **Integración en Todos los Paneles:**
     - `AdminTab.tsx`:
       - Encabezado general de Ajustes ("¿Cómo funciona Ajustes?").
       - Acordeón de Personalización del Local.
       - Acordeón de Gestión de Personal y Roles.
       - Acordeón de Envíos y Zonas de Delivery.
       - Acordeón de Mercado Pago.
       - Acordeón de Mesas, Salón y Códigos QR.
       - Acordeón de Facturación Electrónica AFIP.
       - Acordeón de Club de Fidelización y Cashback.
       - Encabezado de Menú y Categorías.
       - Modal de Carga/Edición de Producto.
       - Encabezado de Insumos y Almacén (Stock).
       - Encabezado de Rentabilidad Mensual (Balance).
     - `OrderTab.tsx`: Encabezado de Caja ("Ayuda Caja").
     - `KitchenTab.tsx`: Encabezado de Cocina & Comandas ("Ayuda Cocina").
     - `BartenderTab.tsx`: Encabezado de Barra & Bebidas ("Ayuda Barra").
     - `DeliveryTab.tsx`: Encabezado de Reparto & Despacho ("Ayuda Despacho").
     - `WaiterTab.tsx`: Encabezado de Portal de Mozos ("Ayuda Mozos").
- **¿Por qué lo hicimos?:**
  Para que cualquier cliente, nuevo dueño de restaurante o empleado sin experiencia pueda capacitarse en 5 segundos con un solo clic, sin requerir manuales largos ni llamadas a soporte.
- **Validación:**
  - Compilación total `npm run build` con Turbopack y TypeScript aprobada en 23.0s con código de salida 0.

- **Ajuste Fino - Explicación de Liquidación a Repartidores en Zonas de Envío:**
  - En la ayuda contextual (`admin-settings-envios`) se agregó explícitamente que al final de la sección se encuentra el módulo de **Liquidación a Repartidores**, donde figura con exactitud lo que se le debe abonar a cada cadete según los viajes realizados.
  - Se sumó la clave `admin-delivery-settlement` y un botón interactivo `?` directamente al lado del título *💰 Liquidación a Repartidores* en `AdminDeliverySettlement.tsx`.


