import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing Ipelegeng / Ikakeng data by OCCUPATION - Excluding Deleted Records...");

  // 1. Total people with Ipelegeng/Ikakeng in OCCUPATION
  const { count: occCount, error: oErr1 } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('occupation.ilike.%Ipelegeng%,occupation.ilike.%Ikakeng%');
  
  if (oErr1) console.error("Error fetching occupation count:", oErr1.message);
  else console.log(`Total people with Ipelegeng/Ikakeng in OCCUPATION: ${occCount}`);

  // 2. People with Ipelegeng/Ikakeng in OCCUPATION but NOT in Ipelegeng/Ikakeng groups (affiliation/place)
  const { count: occNotGroupCount, error: oErr2 } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('occupation.ilike.%Ipelegeng%,occupation.ilike.%Ikakeng%')
    .not('affiliation', 'ilike', '%Ipelegeng%')
    .not('place', 'ilike', '%Ipelegeng%')
    .not('affiliation', 'ilike', '%Ikakeng%')
    .not('place', 'ilike', '%Ikakeng%');

  if (oErr2) console.error("Error fetching occ not group count:", oErr2.message);
  else console.log(`Total Ipelegeng/Ikakeng (by occupation) NOT under their groups: ${occNotGroupCount}`);
}

run();
