const fs = require('fs');

const entry = `

### Rediseño de Contacto, Redes y Horarios (Landing & Menú Público)
- **Identidad Visual Oficial de Redes:**
  - **Instagram:** Icono con gradiente oficial de Instagram (\`#E1306C\` / fucsia / naranja), etiqueta "Instagram" y descripción "Seguinos para ver nuestras fotos, historias y promociones exclusivas".
  - **WhatsApp:** Icono con verde oficial (\`#25D366\`), etiqueta "WhatsApp" y descripción "Chateá con nosotros para consultas, dudas o pedidos especiales".
- **Horarios de Atención y Envíos con Selector / Pestañas:**
  - **Horarios de Atención (Local):** Icono de reloj dorado/ámbar con indicador de estado ("Abierto" / "Cerrado") y desglose semanal de turnos.
  - **Horarios de Envío (Delivery):** Icono de reparto en moto/camioneta celeste con indicador de estado ("Delivery Activo" / "Cerrado Hoy") y desglose de franjas horarias de entrega.
- **Nueva Sección en la Landing Page:** Bloque interactivo con tarjetas descriptivas de contacto rápido, turnos semanales y enlace directo a perfiles y chat.
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado');
