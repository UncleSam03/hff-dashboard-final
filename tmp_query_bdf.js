import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Analyzing BDF and Soldier data in registrations...");

  // Let's get a summary of what BDF could mean
  const { data: affiliations, error: aErr } = await supabase
    .from('registrations')
    .select('affiliation')
    .ilike('affiliation', '%BDF%');
    
  if (aErr) console.error(aErr);
  else console.log(`Found ${affiliations.length} records with 'BDF' in affiliation.`);

  const { data: places, error: pErr } = await supabase
    .from('registrations')
    .select('place')
    .ilike('place', '%BDF%');
  if (pErr) console.error(pErr);
  else console.log(`Found ${places.length} records with 'BDF' in place.`);

  const { data: occupations, error: oErr } = await supabase
    .from('registrations')
    .select('occupation')
    .ilike('occupation', '%soldier%');
  if (oErr) console.error(oErr);
  else console.log(`Found ${occupations.length} records with 'soldier' in occupation.`);
  
  const { data: bdfOccupations, error: boErr } = await supabase
    .from('registrations')
    .select('occupation')
    .ilike('occupation', '%BDF%');
  if (boErr) console.error(boErr);
  else console.log(`Found ${bdfOccupations.length} records with 'BDF' in occupation.`);

  // Find exact question answers:
  // 1. How many BDF people are there? 
  // Let's check records where affiliation, place, or occupation has 'BDF'
  const { count: bdfCount, error: bdfErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .or('affiliation.ilike.%BDF%,place.ilike.%BDF%,occupation.ilike.%BDF%');
  
  console.log(`Total BDF people (by any field): ${bdfCount}`);

  // 2. How many are not under BDF groups but are soldiers?
  const { count: soldierNotBdfCount, error: sErr } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .ilike('occupation', '%soldier%')
    .not('affiliation', 'ilike', '%BDF%')
    .not('place', 'ilike', '%BDF%');

  console.log(`Total soldiers NOT under BDF: ${soldierNotBdfCount}`);
}

run();
