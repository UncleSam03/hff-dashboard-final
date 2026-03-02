import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectSchema() {
  console.log("Checking tables...");
  
  // Check registrations
  const { count: regCount, error: regErr } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
  console.log(`Registrations: ${regErr ? "Error: " + regErr.message : regCount + " rows"}`);

  // Check profiles
  const { count: profCount, error: profErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  console.log(`Profiles: ${profErr ? "Error: " + profErr.message : profCount + " rows"}`);

  // Check participants
  const { error: partErr } = await supabase.from('participants').select('*', { count: 'exact', head: true });
  console.log(`Participants: ${partErr ? "Error (expected): " + partErr.message : "Table exists!"}`);

  // Check testimonies
  const { error: testErr } = await supabase.from('testimonies').select('*', { count: 'exact', head: true });
  console.log(`Testimonies: ${testErr ? "Error: " + testErr.message : "Table exists"}`);
  
  // Check registration_queue
  const { error: queueErr } = await supabase.from('registration_queue').select('*', { count: 'exact', head: true });
  console.log(`Registration Queue: ${queueErr ? "Error: " + queueErr.message : "Table exists"}`);
}

inspectSchema();
