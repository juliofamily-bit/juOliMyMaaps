const fs = require('fs');
let content = fs.readFileSync('estado.md', 'utf-8');
content += '\n\n### Correcciones Checkpoint 37 (UX y Lógica)\n- **Banner de Suscripción:** Se corrigió la prioridad visual del banner de suscripción. Si hay una promoción activa (Promo Pro), esta tiene prioridad sobre el mensaje de Todavía no iniciaste tu prueba.\n- **Acciones Masivas (% vs $):** Se implementó desde cero un selector para alternar entre aumento por porcentaje (%) y aumento por monto fijo ($) en las acciones masivas de productos, una funcionalidad que el usuario recordaba pero que en realidad no existía, adaptando toda la lógica de actualización en lote para soportar ambos formatos.\n- **Feedback de Mapas Visuales:** Se registró la idea del usuario de mapas de mesas escalados en el bloc de notas.\n';
fs.writeFileSync('estado.md', content);
console.log('updated estado');
