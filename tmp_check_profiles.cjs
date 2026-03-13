
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.log('Keys available:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  console.log('Checking all profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log('Profiles found:', data.length);
  data.forEach(p => {
    console.log(`- ID: ${p.id}, Role: ${p.role}, Onboarding Completed: ${p.onboarding_completed}, Name: ${p.full_name}`);
  });
}

checkProfiles();
