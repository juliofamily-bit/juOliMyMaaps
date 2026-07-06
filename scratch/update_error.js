const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

const searchRegex = /setError\('Selecciona tu nombre de la lista'\);/;
const replacement = `setError(employees.filter(e => e.role === selectedRole).length === 0 ? 'Crea un empleado para este rol en el Panel de Administrador' : 'Selecciona tu nombre de la lista');`;

if (searchRegex.test(content)) {
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully updated error message!');
} else {
    console.log('Could not find searchRegex');
}
