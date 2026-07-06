const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

// The line we want to replace is around 234: "setSupabaseTenant(tenant.id);"
// We want to add "loadTenant(true);" right after it.

const regex = /setSupabaseTenant\(tenant\.id\);\s+const role = savedProfile\.role;/;
const replacement = `setSupabaseTenant(tenant.id);
          loadTenant(true); // <--- CRITICAL FIX: Re-fetch saas_subscriptions now that we have the tenant header for RLS!
          
          const role = savedProfile.role;`;

if(regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully fixed RLS race condition');
} else {
    console.log('Could not find regex match');
}
