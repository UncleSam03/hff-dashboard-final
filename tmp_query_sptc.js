import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing SPTC (Selebi Phikwe Town Council) data - Excluding Deleted Records...");

  // 1. Total SPTC people
  // Checking affiliation, place, or occupation for 'SPTC'
  const { count: totalCount, error: tErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('affiliation.ilike.%SPTC%,place.ilike.%SPTC%,occupation.ilike.%SPTC%');
  
  if (tErr) console.error("Error fetching total count:", tErr.message);
  else console.log(`Total SPTC people: ${totalCount}`);

  // 2. SPTC by occupation but NOT in SPTC groups
  const { count: occNotGroupCount, error: oErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .ilike('occupation', '%SPTC%')
    .not('affiliation', 'ilike', '%SPTC%')
    .not('place', 'ilike', '%SPTC%');

  if (oErr) console.error("Error fetching occ not group count:", oErr.message);
  else console.log(`Total SPTC (by occupation) NOT under SPTC groups: ${occNotGroupCount}`);
  
  // Also checking full name just in case
  const { count: fullCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .or('affiliation.ilike.%Selebi Phikwe Town Council%,place.ilike.%Selebi Phikwe Town Council%,occupation.ilike.%Selebi Phikwe Town Council%');
  
  console.log(`Total 'Selebi Phikwe Town Council' (Full name search): ${fullCount}`);
}

run();
