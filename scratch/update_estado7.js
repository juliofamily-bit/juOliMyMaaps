const fs = require('fs');

const entry = `

### Corrección - Error al Activar Restricciones Horarias
- **Causa del Error:** En el componente ScheduleEditor, cuando un local no tenía la propiedad schedule inicializada en su registro de business_hours / delivery_hours / reservation_hours, el acceso directo a cfg.schedule[day.id] generaba un TypeError en React, provocando la caída de la página ("no se pudo cargar la página").
- **Solución Implementada:** Se definió DEFAULT_SCHEDULE de forma global y defensiva para todos los días de la semana. Tanto la carga inicial como la activación del toggle y la adición/eliminación de turnos cuentan con salvaguardas contra valores nulos o indefinidos.
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado con éxito');
