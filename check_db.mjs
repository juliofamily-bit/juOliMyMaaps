import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_column_types', { table_name: 'ingredients' });
  if (error) {
    console.log("RPC failed, trying generic select:");
    const { data: d } = await supabase.from('ingredients').select('stock_level').limit(1);
    console.log(d);
  } else {
    console.log(data);
  }
}
check();
