const fs = require('fs');
let content = fs.readFileSync('estado.md', 'utf-8');
content += '\n- **UI Móvil Acciones Masivas:** Se rediseñó la estructura flex de la barra flotante. Ahora en celular los controles bajan a líneas independientes y ocupan todo el ancho (w-full) para garantizar que los botones de [%] y [$] sean grandes, fáciles de tocar y no queden ocultos por falta de espacio.\n';
fs.writeFileSync('estado.md', content);
console.log('updated estado');
