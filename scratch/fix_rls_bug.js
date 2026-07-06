const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

const searchString = `        if (!isSilent) {
          setTenant(data);
          if (typeof window !== 'undefined') {
            document.title = \`\${data.name} | Mmm TodoLoQueQuiero Comer\`;
          }
        }`;

const replaceString = `        if (!isSilent) {
          setTenant(data);
          if (typeof window !== 'undefined') {
            document.title = \`\${data.name} | Mmm TodoLoQueQuiero Comer\`;
          }
        }
        
        // FIJO: Establecer el tenant ID en el cliente AHORA para que las consultas RLS funcionen!
        setSupabaseTenant(data.id);`;

if(content.includes(searchString)) {
    content = content.replace(searchString, replaceString);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully fixed setSupabaseTenant');
} else {
    console.log('Could not find searchString');
}
