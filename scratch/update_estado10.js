const fs = require('fs');

const entry = `

### Sincronización de Envíos en Landing & Menú con Módulo de Administración
- **Control Maestro (\`has_delivery\`):** Si en Administración -> "Módulo y zonas de envío" la opción "Activar Envíos (Delivery)" está desactivada:
  - En la Landing Page, la tarjeta de envíos muestra claramente: **"Por el momento no hacemos envíos a domicilio. Te esperamos para disfrutar en el local o pedir para retirar (Takeaway)"** con el indicador \`No disponible\`.
  - En la barra superior (Header) no se muestra el botón de horarios de envío.
  - En el modal de horarios, la pestaña de Envíos informa cordialmente que el local no cuenta con delivery activo.
- **Envíos Activos:** Si está activado, refleja fielmente los días de reparto, turnos horarios de envío configurados y el estado del botón de pánico (\`Envíos Pausados\`).
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado');
