const fs = require('fs');
let content = fs.readFileSync('src/app/api/auth/pin-login/route.ts', 'utf-8');

const targetString = `    if (!rolePassword) {
       return NextResponse.json({ error: 'El rol no tiene contraseña configurada' }, { status: 500 });
    }`;

const replacementString = `    if (!rolePassword) {
      console.log(\`Inicializando contraseña sintética para el rol \${role} del tenant \${tenantId}...\`);
      rolePassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const { error: updateError } = await supabaseAdmin
        .from('tenants')
        .update({ [\`\${role}_password\`]: rolePassword })
        .eq('id', tenantId);
        
      if (updateError) {
         console.error('Error actualizando contraseña sintética:', updateError);
         return NextResponse.json({ error: 'Error interno al inicializar el rol en la base de datos' }, { status: 500 });
      }

      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: rolePassword,
        email_confirm: true,
        user_metadata: { tenant_id: tenantId, role: role }
      }).catch(e => console.warn('Usuario sintético ya existía o falló la creación:', e));
    }`;

if (content.includes(targetString)) {
    content = content.replace(targetString, replacementString);
    
    // Also we need to make sure rolePassword is a 'let' not a 'const'
    content = content.replace('const rolePassword = tenant[`${role}_password`];', 'let rolePassword = tenant[`${role}_password`];');
    
    fs.writeFileSync('src/app/api/auth/pin-login/route.ts', content);
    console.log('Successfully updated pin-login API route!');
} else {
    console.log('Could not find targetString');
}
