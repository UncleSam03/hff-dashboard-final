import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const serviceKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.hffdashboardfinal_SUPABASE_ANON_KEY;

const serviceSupabase = createClient(supabaseUrl, serviceKey);
const anonSupabase = createClient(supabaseUrl, anonKey);

async function check() {
  const userId = '1508145d-6771-4701-a604-d048d78f6959';
  
  console.log("--- SERVICE ROLE CHECK ---");
  const { data: srReg } = await serviceSupabase.from('registrations').select('*').eq('uuid', userId);
  console.log(`SR found registrations: ${srReg?.length || 0}`);
  
  const { data: srProf } = await serviceSupabase.from('profiles').select('*').eq('id', userId);
  console.log(`SR found profiles: ${srProf?.length || 0}`);

  console.log("\n--- ANON ROLE CHECK ---");
  // Registrations has "using (true)" for select
  const { data: anonReg, error: anonRegErr } = await anonSupabase.from('registrations').select('*').eq('uuid', userId);
  if (anonRegErr) {
    console.error("Anon Reg Select ERROR:", anonRegErr.status, anonRegErr.message);
  } else {
    console.log(`Anon found registrations: ${anonReg?.length || 0}`);
  }

  // Profiles has "using (auth.uid() = id)" - as anon it should find 0
  const { data: anonProf, error: anonProfErr } = await anonSupabase.from('profiles').select('*').eq('id', userId);
  if (anonProfErr) {
    console.error("Anon Prof Select ERROR:", anonProfErr.status, anonProfErr.message);
  } else {
    console.log(`Anon found profiles: ${anonProf?.length || 0}`);
  }
}

check();
