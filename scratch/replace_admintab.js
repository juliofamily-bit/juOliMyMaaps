const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const targetContent = `
                const result = await supabase
                    .from('tenants')
                    .update({
                        name: cfgName,
                        slug: newSlug,
                        theme_colors: updatedColors,
                        enabled_roles: updatedRoles,
                        staff_password: cfgStaffPassword,
                        kitchen_password: cfgKitchenPassword,
                        delivery_password: cfgDeliveryPassword,
                        bartender_password: cfgBartenderPassword,
                        waiter_password: cfgWaiterPassword,
                        has_delivery: cfgHasDelivery,
                        delivery_days: cfgDeliveryDays,
                        mercadopago_public_key: cfgMercadopagoPublicKey,
                        mercadopago_access_token: cfgMercadopagoAccessToken,
                        delivery_zones: cfgDeliveryZones,
                        profile_picture_url: cfgProfilePictureUrl,
                        banner_url: cfgBannerUrl,
                        description: cfgDescription,
                        social_links: links,
                        reviews_enabled: cfgReviewsEnabled,
                        reservations_enabled: cfgReservationsEnabled,
                        reservation_deposit_amount: cfgReservationDepositAmount,
                        tips_enabled: cfgTipsEnabled,
                        table_charge_enabled: cfgTableChargeEnabled,
                        table_charge_amount: cfgTableChargeAmount,
                        delivery_apps_enabled: cfgDeliveryAppsEnabled,
                        rappi_store_id: cfgRappiStoreId,
                        pedidosya_store_id: cfgPedidosyaStoreId,
                        delivery_apps_token: cfgDeliveryAppsToken,
                        delivery_apps_markup: cfgDeliveryAppsMarkup,
                        is_delivery_apps_panic_active: cfgDeliveryAppsPanicActive,
                        delivery_apps_schedule: cfgDeliveryAppsSchedule,
                        business_hours: cfgBusinessHours,
                        delivery_hours: cfgDeliveryHours,
                        reservation_hours: cfgReservationHours,
                        delivery_panic_button: cfgDeliveryPanic,
                        landing_config: cfgLandingConfig
                    })
                    .eq('id', tenant.id)
                    .select();
                
                console.log('Update query result:', { data: result.data, error: result.error, tenantId: tenant.id });
                
                data = result.data?.[0];
                error = result.error;
`;

const replacementContent = `
                const updates = {
                    name: cfgName,
                    slug: newSlug,
                    theme_colors: updatedColors,
                    enabled_roles: updatedRoles,
                    staff_password: cfgStaffPassword,
                    kitchen_password: cfgKitchenPassword,
                    delivery_password: cfgDeliveryPassword,
                    bartender_password: cfgBartenderPassword,
                    waiter_password: cfgWaiterPassword,
                    has_delivery: cfgHasDelivery,
                    delivery_days: cfgDeliveryDays,
                    mercadopago_public_key: cfgMercadopagoPublicKey,
                    mercadopago_access_token: cfgMercadopagoAccessToken,
                    delivery_zones: cfgDeliveryZones,
                    profile_picture_url: cfgProfilePictureUrl,
                    banner_url: cfgBannerUrl,
                    description: cfgDescription,
                    social_links: links,
                    reviews_enabled: cfgReviewsEnabled,
                    reservations_enabled: cfgReservationsEnabled,
                    reservation_deposit_amount: cfgReservationDepositAmount,
                    tips_enabled: cfgTipsEnabled,
                    table_charge_enabled: cfgTableChargeEnabled,
                    table_charge_amount: cfgTableChargeAmount,
                    delivery_apps_enabled: cfgDeliveryAppsEnabled,
                    rappi_store_id: cfgRappiStoreId,
                    pedidosya_store_id: cfgPedidosyaStoreId,
                    delivery_apps_token: cfgDeliveryAppsToken,
                    delivery_apps_markup: cfgDeliveryAppsMarkup,
                    is_delivery_apps_panic_active: cfgDeliveryAppsPanicActive,
                    delivery_apps_schedule: cfgDeliveryAppsSchedule,
                    business_hours: cfgBusinessHours,
                    delivery_hours: cfgDeliveryHours,
                    reservation_hours: cfgReservationHours,
                    delivery_panic_button: cfgDeliveryPanic,
                    landing_config: cfgLandingConfig
                };

                const res = await fetch('/api/update-tenant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: tenant.id, updates })
                });
                
                const result = await res.json();
                
                data = result.data;
                error = result.error ? new Error(result.error) : null;
`;

if (content.includes(targetContent.trim())) {
    content = content.replace(targetContent.trim(), replacementContent.trim());
    fs.writeFileSync('src/components/AdminTab.tsx', content);
    console.log('Replaced successfully');
} else {
    console.log('Target content not found!');
}
