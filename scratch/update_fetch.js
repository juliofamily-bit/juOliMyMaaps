const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

content = content.replace(
    'const res = await fetch(`/api/get-tenant-plan?tenant_id=${data.id}`);',
    'const res = await fetch(`/api/get-tenant-plan?tenant_id=${data.id}`, { cache: "no-store" });'
);

fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
console.log('Successfully updated fetch to include cache: no-store!');
