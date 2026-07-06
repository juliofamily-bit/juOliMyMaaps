const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const targetLines = [];
const lines = content.split('\n');
let capturing = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// Si da error de columna no encontrada')) {
        capturing = true;
    }
    if (capturing) {
        targetLines.push(lines[i]);
    }
    if (capturing && lines[i].includes('if (error) {')) {
        targetLines.pop(); // remove 'if (error) {'
        break;
    }
}

const targetContent = targetLines.join('\n');

const replacementContent = `
                // Si da error de columna no encontrada (código 42703 o mensaje de schema cache / column)
                if (error && (error.message?.includes('column') || error.message?.includes('schema cache') || error.code === '42703')) {
                    console.warn("⚠️ Columnas extendidas no encontradas en 'tenants'. Ejecutando fallback defensivo básico...", error);
                    
                    const fallbackUpdates = {
                        name: cfgName,
                        slug: newSlug,
                        theme_colors: updatedColors,
                        enabled_roles: updatedRoles,
                        staff_password: cfgStaffPassword,
                        kitchen_password: cfgKitchenPassword,
                        delivery_password: cfgDeliveryPassword,
                        bartender_password: cfgBartenderPassword,
                        waiter_password: cfgWaiterPassword,
                        description: cfgDescription,
                        delivery_days: cfgDeliveryDays
                    };

                    const fallbackRes = await fetch('/api/update-tenant', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: tenant.id, updates: fallbackUpdates })
                    });
                    
                    const fallbackResult = await fallbackRes.json();
                    
                    data = fallbackResult.data;
                    error = fallbackResult.error ? new Error(fallbackResult.error) : null;

                    if (!error && data) {
                        alert("⚠️ AJUSTES GUARDADOS EN MODO COMPATIBILIDAD BÁSICA:\\n\\nSe guardaron los roles, contraseñas y descripción con éxito. Sin embargo, no se pudieron guardar los ajustes premium porque las columnas no existen o no están cacheadas.\\n\\nPara habilitar las funciones premium, asegúrate de ejecutar el script de migración SQL en Supabase.");
                    }
                }
            } catch (err: any) {
                console.error("Excepción en guardado premium, reintentando básico...", err);
                
                const fallbackUpdates = {
                    name: cfgName,
                    slug: newSlug,
                    theme_colors: updatedColors,
                    enabled_roles: updatedRoles,
                    staff_password: cfgStaffPassword,
                    kitchen_password: cfgKitchenPassword,
                    delivery_password: cfgDeliveryPassword,
                    bartender_password: cfgBartenderPassword,
                    waiter_password: cfgWaiterPassword,
                    delivery_days: cfgDeliveryDays
                };

                const fallbackRes = await fetch('/api/update-tenant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: tenant.id, updates: fallbackUpdates })
                }).catch(() => null);
                
                if (fallbackRes) {
                    const fallbackResult = await fallbackRes.json();
                    data = fallbackResult.data;
                    error = fallbackResult.error ? new Error(fallbackResult.error) : null;
                } else {
                    error = err;
                }
            }
`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('Fixed fallback block');
