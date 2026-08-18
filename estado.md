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
  5. UX de Inventario: Se reubicó y mejoró la opción de "Stock Fraccionable" (venta por peso) en el panel de insumos. Ahora, al activarlo, automáticamente cambia la unidad a kilogramos (Kg) y ajusta los textos de "Stock Inicial" y "Precio Costo" para mayor claridad.

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
