import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCategoryIcon, getFoodImageUrl, getBannerImageUrl } from '@/lib/foodImages';
import { DEFAULT_LANDING_CONFIG } from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identidad, menu } = body;

    if (!identidad || !menu || !Array.isArray(menu)) {
      return NextResponse.json({ error: 'Faltan datos del menú escaneado' }, { status: 400 });
    }

    // 1. Generar un slug único y limpio para el Local Fantasma
    const rawName = (identidad.nombre_sugerido || 'Local Demo').trim();
    const cleanSlug = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'local';

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const slug = `demo-${cleanSlug}-${randomSuffix}`;

    // Validar si el nombre ya existe en la base de datos para evitar choque con UNIQUE constraint "tenants_name_key"
    let finalName = rawName;
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('name', rawName)
      .maybeSingle();

    if (existingTenant) {
      // Si ya hay un local con ese nombre exacto, agregamos un sufijo elegante de demo
      finalName = `${rawName} (Demo ${randomSuffix})`;
    }

    const primaryColor = identidad.colores_sugeridos?.primario || '#f97316';
    const secondaryColor = identidad.colores_sugeridos?.secundario || '#1e293b';
    const themeMode = identidad.colores_sugeridos?.mode || 'dark';
    const bannerUrl = identidad.banner_url || getBannerImageUrl(identidad.estilo_gastronomico);

    const adminPassword = 'admin123';
    const email = `demo+${slug}@mymfullcontrol.com.ar`;

    // Intentar crear el usuario en Supabase Auth para garantizar login inmediato
    try {
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: adminPassword,
        email_confirm: true
      });
    } catch (authErr) {
      console.warn('Auth user creation warning:', authErr);
    }

    // 2. Insertar el Local Fantasma en la tabla tenants
    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert([{
        name: finalName,
        slug: slug,
        email: email,
        theme_colors: {
          primary: primaryColor,
          secondary: secondaryColor,
          mode: themeMode
        },
        enabled_roles: ['admin', 'kitchen', 'waiter', 'bartender', 'delivery', 'caja'],
        admin_password: adminPassword,
        staff_password: adminPassword,
        kitchen_password: adminPassword,
        bartender_password: adminPassword,
        waiter_password: adminPassword,
        delivery_password: adminPassword,
        description: identidad.descripcion_corta || 'Menú digital y pedidos online',
        banner_url: bannerUrl,
        landing_config: {
          ...DEFAULT_LANDING_CONFIG,
          enabled: true,
          hero_style: 'modern',
          interactive_wall_enabled: true,
          featured_products_enabled: true,
          about_text: identidad.descripcion_corta || 'Bienvenidos a nuestra propuesta gastronómica.',
          featured_product_ids: []
        },
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error('Error creating ghost tenant:', tenantError);
      return NextResponse.json({ error: 'No se pudo crear el local en la base de datos: ' + tenantError?.message }, { status: 500 });
    }

    // Insertar empleado Administrador con PIN admin123
    try {
      await supabaseAdmin.from('employees').insert([
        { tenant_id: newTenant.id, name: 'Administrador', role: 'admin', pin_code: 'admin123' },
        { tenant_id: newTenant.id, name: 'Cajero', role: 'staff', pin_code: 'admin123' },
        { tenant_id: newTenant.id, name: 'Cocina', role: 'kitchen', pin_code: 'admin123' },
        { tenant_id: newTenant.id, name: 'Barra', role: 'bartender', pin_code: 'admin123' },
        { tenant_id: newTenant.id, name: 'Mozo', role: 'waiter', pin_code: 'admin123' }
      ]);
    } catch (empErr) {
      console.warn('Employees insertion warning:', empErr);
    }

    const createdProductIds: string[] = [];
    const ingredientMap = new Map<string, string>(); // name -> ingredient_id

    // 3. Insertar Categorías y Productos
    for (const cat of menu) {
      const catName = cat.nombre_categoria || 'Varios';
      const catIcon = getCategoryIcon(catName);
      const targetSector = cat.tipo_sector === 'barra' ? 'bartender' : 'kitchen';

      const { data: newCat, error: catError } = await supabaseAdmin
        .from('categories')
        .insert([{
          name: catName,
          icon: catIcon,
          target_departments: [targetSector],
          is_offer: false,
          tenant_id: newTenant.id
        }])
        .select()
        .single();

      if (catError || !newCat) {
        console.error('Error creating category:', catError);
        continue;
      }

      if (Array.isArray(cat.productos)) {
        for (const prod of cat.productos) {
          const prodImage = prod.image_url || getFoodImageUrl(prod.nombre, catName);
          const prodPrice = typeof prod.precio === 'number' ? prod.precio : parseFloat(prod.precio) || 0;

          const { data: newProd, error: prodError } = await supabaseAdmin
            .from('products')
            .insert([{
              name: prod.nombre,
              description: prod.descripcion_atractiva || null,
              price: prodPrice,
              image_url: prodImage,
              category_id: newCat.id,
              tenant_id: newTenant.id,
              is_active: true
            }])
            .select()
            .single();

          if (prodError || !newProd) {
            console.error('Error creating product:', prodError);
            continue;
          }

          createdProductIds.push(newProd.id);

          // 4. Crear Ingredientes de Receta si existen
          if (Array.isArray(prod.ingredientes_base) && prod.ingredientes_base.length > 0) {
            for (const ing of prod.ingredientes_base) {
              const ingName = (ing.nombre || '').trim();
              if (!ingName) continue;

              let ingredientId = ingredientMap.get(ingName.toLowerCase());

              if (!ingredientId) {
                const { data: newIng, error: ingError } = await supabaseAdmin
                  .from('ingredients')
                  .insert([{
                    name: ingName,
                    unit: ing.unidad || 'gramo',
                    stock_level: 500, // Stock inicial demo
                    min_stock_alert: 50,
                    unit_price: 10,
                    tenant_id: newTenant.id,
                    target_departments: [targetSector]
                  }])
                  .select()
                  .single();

                if (!ingError && newIng && newIng.id) {
                  ingredientId = newIng.id;
                  ingredientMap.set(ingName.toLowerCase(), ingredientId as string);
                }
              }

              if (ingredientId) {
                await supabaseAdmin
                  .from('product_ingredients')
                  .insert([{
                    product_id: newProd.id,
                    ingredient_id: ingredientId,
                    quantity_used: ing.cantidad_estimada || 1,
                    tenant_id: newTenant.id
                  }]);
              }
            }
          }
        }
      }
    }

    // 5. Asignar los primeros 4 productos como destacados en la landing_config
    if (createdProductIds.length > 0) {
      const topFeatured = createdProductIds.slice(0, 4);
      const updatedLanding = {
        ...newTenant.landing_config,
        featured_product_ids: topFeatured
      };

      await supabaseAdmin
        .from('tenants')
        .update({ landing_config: updatedLanding })
        .eq('id', newTenant.id);
    }

    return NextResponse.json({
      success: true,
      tenant_id: newTenant.id,
      slug: newTenant.slug,
      url: `/${newTenant.slug}`,
      menu_url: `/${newTenant.slug}/menu`,
      name: newTenant.name
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in create-ghost-tenant:', error);
    return NextResponse.json({ error: error.message || 'Error al crear local fantasma' }, { status: 500 });
  }
}
