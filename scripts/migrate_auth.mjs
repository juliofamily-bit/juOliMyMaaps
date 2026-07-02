import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan las variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// Usamos la clave de servicio para poder acceder a la API de administración de Auth
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ROLES = ['admin', 'staff', 'kitchen', 'delivery', 'bartender', 'waiter', 'animador'];

async function migrateAuth() {
  console.log("🚀 Iniciando migración de credenciales a Supabase Auth...");

  // 1. Obtener todos los tenants
  const { data: tenants, error: tenantsError } = await supabaseAdmin.from('tenants').select('*');
  
  if (tenantsError) {
    console.error("❌ Error obteniendo tenants:", tenantsError);
    return;
  }

  console.log(`✅ Se encontraron ${tenants.length} tenants. Comenzando creación de usuarios...`);

  for (const tenant of tenants) {
    console.log(`\n🏢 Procesando local: ${tenant.name} (${tenant.slug})`);
    const enabledRoles = tenant.enabled_roles || [];
    
    // El rol admin siempre está habilitado implícitamente
    const rolesToProcess = ['admin', ...enabledRoles];

    for (const role of rolesToProcess) {
      if (!ROLES.includes(role)) continue;

      let password;
      let email;
      
      // Obtener la contraseña correspondiente al rol
      if (role === 'admin') {
        password = tenant.admin_password;
        email = tenant.email || `admin@${tenant.slug}.mymfullcontrol.com`; // Fallback si no tiene email configurado
      } else {
        password = tenant[`${role}_password`];
        email = `${role}@${tenant.slug}.mymfullcontrol.com`;
      }

      if (!password) {
        console.warn(`⚠️ Rol ${role} ignorado por no tener contraseña configurada.`);
        continue;
      }

      // Verificamos si el usuario ya existe
      // Supabase no provee un método de "obtener usuario por email", intentaremos crearlo y atrapar el error
      const { data: userResponse, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true, // Auto confirmar
        user_metadata: {
          tenant_id: tenant.id,
          role: role
        }
      });

      if (createUserError) {
        if (createUserError.message.includes('already registered')) {
          console.log(`  ℹ️ Usuario ${email} ya existe. Actualizando metadatos y contraseña...`);
          
          // Como ya existe, busquemos su ID iterando (no óptimo pero funciona para scripts)
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = users.find(u => u.email === email.toLowerCase());
          
          if (existingUser) {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: password,
              user_metadata: {
                tenant_id: tenant.id,
                role: role
              }
            });
            console.log(`  ✅ Usuario ${email} actualizado correctamente.`);
          }
        } else {
          console.error(`  ❌ Error creando usuario ${email}:`, createUserError.message);
        }
      } else {
        console.log(`  ✅ Usuario ${email} creado correctamente.`);
      }
    }
  }

  console.log("\n🎉 Migración completada exitosamente.");
}

migrateAuth().catch(console.error);
