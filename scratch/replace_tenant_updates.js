const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const helperCode = `
    const updateTenantApi = async (tenantId: string, updates: any) => {
        const res = await fetch('/api/update-tenant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, updates })
        });
        const result = await res.json();
        if (result.error || !result.data) {
            throw new Error(result.error || "No se actualizó ningún registro");
        }
        return { data: [result.data], error: null };
    };
`;

if (!content.includes('updateTenantApi')) {
    content = content.replace(
        `const AdminTab: React.FC<AdminTabProps> = ({`,
        helperCode + `\nconst AdminTab: React.FC<AdminTabProps> = ({`
    );
}

// 1. handleSaveAfipConfig
content = content.replace(
    `const { data, error } = await supabase
                    .from('tenants')
                    .update({
                        afip_enabled: cfgAfipEnabled,
                        afip_cuit: cfgAfipCuit,
                        afip_punto_venta: cfgAfipPuntoVenta,
                        afip_condicion_iva: cfgAfipCondicionIva,
                        afip_is_sandbox: cfgAfipIsSandbox,
                        afip_cert_path: cfgAfipCertPath,
                        afip_key_path: cfgAfipKeyPath
                    })
                    .eq('id', tenant.id)
                    .select();`,
    `const { data, error } = await updateTenantApi(tenant.id, {
                        afip_enabled: cfgAfipEnabled,
                        afip_cuit: cfgAfipCuit,
                        afip_punto_venta: cfgAfipPuntoVenta,
                        afip_condicion_iva: cfgAfipCondicionIva,
                        afip_is_sandbox: cfgAfipIsSandbox,
                        afip_cert_path: cfgAfipCertPath,
                        afip_key_path: cfgAfipKeyPath
                    });`
);

// 2. handleSaveTablesList
content = content.replace(
    `const { data, error } = await supabase
                .from('tenants')
                .update({
                    tables: newTables
                })
                .eq('id', tenant.id)
                .select();`,
    `const { data, error } = await updateTenantApi(tenant.id, {
                    tables: newTables
                });`
);

// 3. handleAssignTable
content = content.replace(
    `const { data, error } = await supabase
                .from('tenants')
                .update({
                    waiters: updatedWaiters,
                    tables: updatedTables
                })
                .eq('id', tenant.id)
                .select();`,
    `const { data, error } = await updateTenantApi(tenant.id, {
                    waiters: updatedWaiters,
                    tables: updatedTables
                });`
);


fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('Replaced all tenant updates with API helper');
