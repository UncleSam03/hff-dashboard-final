import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing Security Forces data (BDF & Police) - Excluding Deleted Records...");

  // --- BDF ANALYSIS ---
  console.log("\n--- BDF ---");
  const { count: bdfTotalCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('affiliation.ilike.%BDF%,place.ilike.%BDF%,occupation.ilike.%BDF%');
  console.log(`Total BDF people (not deleted): ${bdfTotalCount}`);

  const { count: soldierNotBdfCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .ilike('occupation', '%soldier%')
    .not('affiliation', 'ilike', '%BDF%')
    .not('place', 'ilike', '%BDF%');
  console.log(`Total soldiers NOT under BDF (not deleted): ${soldierNotBdfCount}`);

  // --- POLICE ANALYSIS ---
  console.log("\n--- POLICE ---");
  const { count: policeTotalCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('affiliation.ilike.%Police%,place.ilike.%Police%,occupation.ilike.%Police%');
  console.log(`Total Police people (not deleted): ${policeTotalCount}`);

  const { count: policeOccNotPoliceGroup } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .ilike('occupation', '%Police%')
    .not('affiliation', 'ilike', '%Police%')
    .not('place', 'ilike', '%Police%');
  console.log(`Total police NOT under Police groups (not deleted): ${policeOccNotPoliceGroup}`);
}

run();
