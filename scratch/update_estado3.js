const fs = require('fs');
let content = fs.readFileSync('estado.md', 'utf-8');
content += '\n\n### Correcciones Generales del Panel Admin (Checkpoint)\n- Se corrigió el botón de guardar de `Fidelización (Club de Clientes)`, `Mesas`, `AFIP` y `Mozos` para que todos utilicen la ruta segura `/api/update-tenant`. Esto soluciona el problema de que el interruptor de fidelización se volvía a activar solo al recargar.\n- Se verificó que los buscadores con texto y voz para "Stock" y "Menú" ya se encontraban implementados correctamente en el código bajo los estados `adminStockSearchQuery` y `adminProductSearchQuery`.\n';
fs.writeFileSync('estado.md', content);
console.log('updated estado');
