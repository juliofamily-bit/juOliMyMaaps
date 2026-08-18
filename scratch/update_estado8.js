const fs = require('fs');

const entry = `

### Regla Operativa - Exclusividad de Pedidos Fuera de Horario para Caja (POS)
- **Bloqueo a Clientes (Web y Mesas):** Fuera del horario de atención configurado en el local, la página web pública y los menús de mesas con código QR quedan 100% bloqueados para pedir (el carrito muestra aviso informativo y el botón de confirmar pedido permanece deshabilitado).
- **Acceso Exclusivo de Caja:** El panel de Caja (\`OrderTab\` -> "Registrar Pedido") mantiene habilitada la toma directa de pedidos en todo momento para atender a clientes que ya se encuentren dentro del local o pedidos de última hora.
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado');
