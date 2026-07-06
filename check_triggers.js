require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT tgname, proname, prosrc FROM pg_trigger JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid WHERE relname = 'orders';"
  });
  console.log('DATA:', data);
  console.log('ERROR:', error);
}

run();
