const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

const searchRegex = /const \{ data: subData \} = await supabase\s*\.from\('saas_subscriptions'\)\s*\.select\('status, plan_id, trial_started_at, promo_pro_ends_at, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey\(\*\)'\)\s*\.eq\('tenant_id', data\.id\)\s*\.maybeSingle\(\);/;

const replacement = `        // FETCH USING API ROUTE TO BYPASS RLS (Fixes race conditions and cached auth states forever)
        let subData = null;
        try {
            const res = await fetch(\`/api/get-tenant-plan?tenant_id=\${data.id}\`);
            if (res.ok) {
                const json = await res.json();
                subData = json.data;
            } else {
                console.warn('Failed to fetch subscription via API', await res.text());
            }
        } catch (err) {
            console.error('API fetch error', err);
        }`;

if (searchRegex.test(content)) {
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
    console.log('Successfully replaced Supabase call with API route call!');
} else {
    console.log('Could not find Supabase saas_subscriptions fetch regex in page.tsx');
}
