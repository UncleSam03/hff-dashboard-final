import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Fetching participants sample:");
  const { data: pData, error: pErr } = await supabase.from('participants').select('*').limit(5);
  if (pErr) console.error("participants error:", pErr);
  else console.log(pData);

  console.log("Fetching facilitators sample (if exists):");
  const { data: fData, error: fErr } = await supabase.from('facilitators').select('*').limit(5);
  if (fErr) console.error("facilitators error:", fErr.message);
  else console.log(fData);
  
  console.log("Fetching registrations sample:");
  const { data: rData, error: rErr } = await supabase.from('registrations').select('*').limit(5);
  if (rErr) console.error("registrations error:", rErr.message);
  else console.log(rData);
  
  console.log("Fetching attendance sample:");
  const { data: aData, error: aErr } = await supabase.from('attendance').select('*').limit(5);
  if (aErr) console.error("attendance error:", aErr.message);
  else console.log(aData);
}

run();
