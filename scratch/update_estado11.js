const fs = require('fs');

const entry = `

### Corrección Visual en Landing & Sistema de Productos Destacados
- **Corrección de Artefacto Visual (Instagram / Muro):**
  - Se eliminó el resplandor de fondo desbordado (\`blur-xl\`) que provocaba distorsión en forma de rayas o efecto de pantalla rota en tablets y móviles encima del bloque de contacto.
  - Se optimizó el renderizado de la tarjeta de Instagram con bordes limpios y fondos sólidos.
- **Sistema de Productos Destacados en Portada:**
  - **En Menú de Administración:**
    - Se agregó un botón rápido de Estrella (⭐) en cada tarjeta de producto para marcarlo/desmarcarlo como destacado en 1 solo clic.
    - Se agregó un switch interactivo dentro del formulario/modal de creación y edición de productos: *"Destacar en Portada / Landing"*.
  - **En Landing Page ("Lo Más Destacado"):**
    - Se priorizan automáticamente primero los platos elegidos como destacados por el administrador (mostrando su badge dorado de Destacado).
    - Se mejoró el renderizado visual para que las fotos subidas por el comercio se vean 100% nítidas, brillantes y sin filtros oscuros que tapen la imagen real.
`;

fs.appendFileSync('estado.md', entry, 'utf8');
console.log('estado.md actualizado');
