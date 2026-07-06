const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

// Replace globally: setSupabaseTenant(anything); -> setSupabaseTenant(anything); loadTenant(true);
// BUT we must be careful not to duplicate it if we already did.

let newContent = content.replace(/setSupabaseTenant\(([^)]+)\);/g, (match, p1) => {
    // If the next line is already loadTenant(true), don't do it again.
    // We'll just replace all of them blindly and then fix duplicates.
    return `setSupabaseTenant(${p1});\n          loadTenant(true); // RE-FETCH AFTER AUTH`;
});

// Fix any potential duplicates if the script was run multiple times
newContent = newContent.replace(/loadTenant\(true\);\s*\/\/\s*RE-FETCH AFTER AUTH\s*loadTenant\(true\);\s*\/\/\s*RE-FETCH AFTER AUTH/g, 'loadTenant(true); // RE-FETCH AFTER AUTH');

// Oh wait, setSupabaseTenant(data.id) is also called inside loadTenant itself at line 147!
// If we add loadTenant(true) inside loadTenant, it will infinite loop!!!
// Let's NOT replace globally.
