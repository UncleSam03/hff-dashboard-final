import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConstraints() {
  console.log("Checking constraints for 'registrations'...");
  
  // Query information_schema for unique constraints on registrations
  const { data, error } = await supabase.rpc('inspect_table_constraints', { t_name: 'registrations' });
  
  // If RPC doesn't exist, try a raw query via a temporary function or just check if uuid is PK
  // Actually, I'll just try to add the constraint via SQL later if needed.
  // Let's just check the columns first to see if uuid exists and is what type.
  const { data: cols, error: colErr } = await supabase.from('registrations').select('*').limit(1);
  if (cols && cols.length > 0) {
      console.log("Columns in registrations:", Object.keys(cols[0]));
  }
}

checkConstraints();
