const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

// Find this block:
/*
      // 1. Intentar recuperar sesión persistente
      const savedProfileStr = localStorage.getItem(`active_profile_${tenant.id}`);
      if (savedProfileStr && !profile) {
        try {
          const savedProfile = JSON.parse(savedProfileStr);
          setProfile(savedProfile);
          setSupabaseTenant(tenant.id);
          
          const role = savedProfile.role;
*/

const searchRegex = /setProfile\(savedProfile\);\s+setSupabaseTenant\(tenant\.id\);\s+const role = savedProfile\.role;/;

const replacement = `setProfile(savedProfile);
          setSupabaseTenant(tenant.id);
          
          // FIX: The initial loadTenant() ran without the tenant header and failed RLS for subscriptions.
          // We MUST re-fetch now that setSupabaseTenant is set!
          loadTenant(true);
          
          const role = savedProfile.role;`;

if (searchRegex.test(content)) {
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully injected loadTenant(true) in restore session block');
} else {
    console.log('Could not find searchRegex in restore session block');
}

// ALSO, we must inject it in handleLogin!
/*
          localStorage.setItem(`active_profile_${tenant.id}`, JSON.stringify(adminProfile));
          setProfile(adminProfile);
          setSupabaseTenant(tenant.id);
          setActiveTab('admin');
*/
const searchRegex2 = /setProfile\(adminProfile\);\s+setSupabaseTenant\(tenant\.id\);\s+setActiveTab\('admin'\);/g;

const replacement2 = `setProfile(adminProfile);
          setSupabaseTenant(tenant.id);
          loadTenant(true); // Re-fetch features with correct RLS
          setActiveTab('admin');`;

if (searchRegex2.test(content)) {
    content = content.replace(searchRegex2, replacement2);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully injected loadTenant(true) in handleLogin');
} else {
    console.log('Could not find searchRegex2 in handleLogin');
}
