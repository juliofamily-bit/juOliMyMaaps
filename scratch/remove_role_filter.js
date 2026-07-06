const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

const searchRegex = /const availableRoles = baseRoles\.filter\([\s\S]*?as UserRole\[\];/;
const replacement = `const availableRoles = baseRoles; // REMOVED FILTER TEMPORARILY SO USER CAN SEE ALL TABS`;

if (searchRegex.test(content)) {
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully removed role filter!');
} else {
    console.log('Could not find searchRegex');
}
