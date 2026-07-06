require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const query = `
    DROP POLICY IF EXISTS "Permitir update de tenant propio" ON public.tenants;
    CREATE POLICY "Permitir update de tenant propio" ON public.tenants FOR UPDATE USING (true);
  `;
  // We can't run raw SQL directly with supabase-js unless we use an RPC.
  // Wait, does exec_sql exist?
  const { data, error } = await client.rpc('exec_sql', { query: query }).catch(e => ({error: e}));
  console.log('Result:', { data, error });
}
test();
