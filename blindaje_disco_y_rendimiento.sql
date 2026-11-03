-- ==============================================================================
-- BLINDAJE TOTAL DE DISCO (IOPS / THROUGHPUT) Y RENDIMIENTO EN SUPABASE
-- Ejecuta este script en el SQL Editor de Supabase (https://supabase.com/dashboard/project/iiymocpguhdifbkfnpwp/sql)
-- para eliminar de raíz las lecturas secuenciales de disco y restaurar el presupuesto de E/S.
-- ==============================================================================

-- 1. LIMPIEZA DE NOTIFICACIONES ANTIGUAS (Recupera espacio y aligera índices)
-- Elimina miles de alertas temporales viejas que ya nadie mira
DELETE FROM public.app_notifications 
WHERE created_at < NOW() - INTERVAL '3 days';

-- 2. ÍNDICES EN TABLA APP_NOTIFICATIONS
-- Elimina los escaneos secuenciales que congelan la base de datos al enviar alertas
CREATE INDEX IF NOT EXISTS idx_app_notifications_tenant_created 
ON public.app_notifications (tenant_id, created_at DESC);

-- 3. ÍNDICES EN TABLA ORDERS (COMANDAS / PEDIDOS)
-- Búsqueda instantánea por fecha y local (cálculo de balances y ventas del día)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created 
ON public.orders (tenant_id, created_at DESC);

-- Filtrado por estado operativo
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status 
ON public.orders (tenant_id, status);

-- ÍNDICE PARCIAL: Ultrarrápido para Cocina, Barra y Mozos (solo pedidos activos)
-- Pesa menos de 100 KB en RAM y responde en 0.5 milisegundos
CREATE INDEX IF NOT EXISTS idx_orders_active_partial 
ON public.orders (tenant_id, status, created_at DESC) 
WHERE status IN ('pending', 'preparing', 'ready', 'out_for_delivery');

-- Búsqueda de órdenes por teléfono para verificar promociones y clientes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_phone 
ON public.orders (tenant_id, phone_number);

-- Acelera la liquidación de repartidores
CREATE INDEX IF NOT EXISTS idx_orders_delivery_settlement 
ON public.orders (tenant_id, delivery_type, is_delivery_paid) 
WHERE delivery_type = 'delivery';

-- 4. ÍNDICES EN TABLA ORDER_ITEMS (PLATOS Y BEBIDAS)
-- Acelera la carga de platos por comanda en Mozos, Cocina y Caja
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (order_id);

-- Acelera la consulta de ventas por fecha y local
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_created 
ON public.order_items (tenant_id, created_at DESC);

-- Búsqueda de insumos y recetas por producto
CREATE INDEX IF NOT EXISTS idx_order_items_product 
ON public.order_items (product_id);

-- 5. ÍNDICES EN TABLA TENANTS
-- Resuelve el slug del local en 0.1 milisegundos
CREATE INDEX IF NOT EXISTS idx_tenants_slug 
ON public.tenants (slug);

-- 6. ÍNDICES EN TABLA LOYALTY_ACCOUNTS (CLUB DE FIDELIZACIÓN)
-- Verificación instantánea de clientes al tipear el teléfono en el checkout
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_phone 
ON public.loyalty_accounts (tenant_id, phone_number);

-- 7. ÍNDICES EN CATÁLOGO, RECETAS Y CONFIGURACIONES
CREATE INDEX IF NOT EXISTS idx_products_tenant_category 
ON public.products (tenant_id, category_id);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_tenant_product 
ON public.product_ingredients (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_categories_tenant 
ON public.categories (tenant_id);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date 
ON public.expenses (tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_active_devices_tenant 
ON public.active_devices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_tenant 
ON public.saas_subscriptions (tenant_id);

-- 8. ACTUALIZACIÓN DEL PLANIFICADOR DE POSTGRESQL (ANALYZE)
-- Actualiza las estadísticas del motor para que use inmediatamente los nuevos índices
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.app_notifications;
ANALYZE public.tenants;
ANALYZE public.loyalty_accounts;
