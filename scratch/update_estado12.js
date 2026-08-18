const fs = require('fs');

const entry = `

### Integración de Destacados y Ranking de Más Vendidos en Landing & Menú
- **Persistencia de Destacados (\`featured_product_ids\`):**
  - Se corrigió la inicialización en \`AdminTab.tsx\` para que no descarte \`featured_product_ids\` al cargar la configuración de landing del tenant.
  - El botón con estrella (⭐) del menú de administración ahora sincroniza y persiste de inmediato los productos elegidos.
- **Ranking de Ventas en Tiempo Real:**
  - El sistema calcula dinámicamente las cantidades vendidas por cada producto a partir de \`order_items\`.
  - El orden de aparición prioriza:
    1. **⭐ Destacados:** Platos elegidos manualmente por el administrador (insignia dorada).
    2. **🔥 Top Ventas / Más Vendidos:** Platos con mayor volumen de ventas registradas en caja y pedidos.
    3. **Resto del catálogo:** Platos activos complementarios.
- **Carrusel de Destacados & Más Vendidos en Vista Menú:**
  - Se agregó una sección destacada interactiva al inicio del Menú público (cuando está en la pestaña "Todo").
  - Permite a los clientes pedir o agregar directamente al carrito en 1 clic los platos favoritos del negocio.
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado');
