import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectTableDetails() {
  console.log("Inspecting 'participants' table...");
  
  // Get columns
  const { data: cols, error: colErr } = await supabase.rpc('inspect_table_columns', { table_name: 'participants' });
  if (colErr) {
    // If RPC doesn't exist, try a direct query to information_schema
    const { data: infoCols, error: infoErr } = await supabase
      .from('pg_attribute')
      .select('attname')
      .eq('attrelid', 'public.participants'::regclass)
      .gt('attnum', 0)
      .eq('attisdropped', false);
    
    // Wait, let's use a simpler approach: select one row and look at keys
    const { data: sample, error: sampleErr } = await supabase.from('participants').select('*').limit(1);
    if (sampleErr) {
        console.error("Error fetching sample row:", sampleErr.message);
    } else {
        console.log("Sample row (keys define columns):", sample && sample.length > 0 ? Object.keys(sample[0]) : "No rows found");
    }
  }

  // Check RLS
  const { data: rls, error: rlsErr } = await supabase
    .rpc('get_table_rls_status', { table_name: 'participants' });
  
  // Alternative: query pg_class
  const { data: pgClass, error: pgErr } = await supabase
    .from('pg_class')
    .select('relrowsecurity')
    .eq('oid', 'public.participants'::regclass)
    .single();
  
  if (pgErr) {
      console.error("Error checking RLS status:", pgErr.message);
  } else {
      console.log(`RLS status for 'participants': ${pgClass.relrowsecurity ? "ENABLED" : "DISABLED"}`);
  }
}

inspectTableDetails();
