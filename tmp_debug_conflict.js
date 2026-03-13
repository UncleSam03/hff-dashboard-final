import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use the exact names from .env.local
const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing hffdashboardfinal_SUPABASE_URL or hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY");
  console.log("Keys available:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const userId = '1508145d-6771-4701-a604-d048d78f6959'; // From user's screenshot
  
  console.log(`Checking registrations for UUID: ${userId}`);
  
  const { data: reg, error: regErr } = await supabase
    .from('registrations')
    .select('*')
    .eq('uuid', userId);
    
  if (regErr) {
    console.error('Error fetching registration:', regErr.message);
  } else {
    console.log('Registrations found:', reg.length);
    if (reg.length > 0) {
      console.log('Record details:', JSON.stringify(reg[0], null, 2));
    }
  }

  console.log('\nChecking profile for UUID:', userId);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profErr) {
    console.error('Error fetching profile:', profErr.message);
  } else {
    console.log('Profile found:', !!profile);
    if (profile) {
      console.log('Profile details:', JSON.stringify(profile, null, 2));
    }
  }
}

inspect();
