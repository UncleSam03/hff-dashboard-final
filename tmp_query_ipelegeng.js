import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing Ipelegeng / Ikakeng data - Excluding Deleted Records...");

  // 1. Total Ipelegeng/Ikakeng people
  // Checking affiliation, place, or occupation for 'Ipelegeng' or 'Ikakeng'
  const { count: totalCount, error: tErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('affiliation.ilike.%Ipelegeng%,place.ilike.%Ipelegeng%,occupation.ilike.%Ipelegeng%,affiliation.ilike.%Ikakeng%,place.ilike.%Ikakeng%,occupation.ilike.%Ikakeng%');
  
  if (tErr) console.error("Error fetching total count:", tErr.message);
  else console.log(`Total Ipelegeng/Ikakeng people: ${totalCount}`);

  // 2. Ipelegeng by occupation but NOT in Ipelegeng/Ikakeng groups
  const { count: occNotGroupCount, error: oErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('occupation.ilike.%Ipelegeng%,occupation.ilike.%Ikakeng%')
    .not('affiliation', 'ilike', '%Ipelegeng%')
    .not('place', 'ilike', '%Ipelegeng%')
    .not('affiliation', 'ilike', '%Ikakeng%')
    .not('place', 'ilike', '%Ikakeng%');

  if (oErr) console.error("Error fetching occ not group count:", oErr.message);
  else console.log(`Total Ipelegeng/Ikakeng (by occupation) NOT under their groups: ${occNotGroupCount}`);
  
  // Let's also check for specific counts of each term to be helpful
  const { count: ipelegengCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('is_deleted', false).or('affiliation.ilike.%Ipelegeng%,place.ilike.%Ipelegeng%,occupation.ilike.%Ipelegeng%');
  const { count: ikakengCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('is_deleted', false).or('affiliation.ilike.%Ikakeng%,place.ilike.%Ikakeng%,occupation.ilike.%Ikakeng%');
  
  console.log(`- Specifically 'Ipelegeng': ${ipelegengCount}`);
  console.log(`- Specifically 'Ikakeng': ${ikakengCount}`);
}

run();
