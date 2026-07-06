const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

const searchRegex = /const baseRoles: UserRole\[\] = \['admin', 'staff'\];[\s\S]*?if \(employees\.some\(e => e\.role === 'animador'\) \|\| tenant\?\.enabled_roles\?\.includes\('animador'\)\) baseRoles\.push\('animador'\);/;

const replacement = `const baseRoles: UserRole[] = ['admin', 'staff', 'kitchen', 'bartender', 'delivery', 'waiter', 'animador'];`;

if (searchRegex.test(content)) {
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully updated baseRoles logic!');
} else {
    console.log('Could not find baseRoles regex in page.tsx');
}
