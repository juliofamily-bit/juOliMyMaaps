const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');
const roles = ['staff', 'kitchen', 'bartender', 'delivery', 'waiter', 'animador'];
for (const r of roles) {
    content = content.replace(`{availableRoles.includes('${r}') && (`, `{true && (`);
}
fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
console.log('Fixed tabs');
