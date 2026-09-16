import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing Police data in registrations...");

  // 1. How many Police people are there?
  // Checking affiliation, place, or occupation for 'Police'
  const { count: policeTotalCount, error: pErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .or('affiliation.ilike.%Police%,place.ilike.%Police%,occupation.ilike.%Police%');
  
  if (pErr) console.error("Error fetching police count:", pErr.message);
  else console.log(`Total Police people (by any field): ${policeTotalCount}`);

  // 2. How many are not under Police groups but are police (occupation)?
  const { count: policeOccNotPoliceGroup, error: poErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .ilike('occupation', '%Police%')
    .not('affiliation', 'ilike', '%Police%')
    .not('place', 'ilike', '%Police%');
  
  if (poErr) console.error("Error fetching police occ not police group count:", poErr.message);
  else console.log(`Total police (by occupation) NOT under Police groups: ${policeOccNotPoliceGroup}`);
}

run();
