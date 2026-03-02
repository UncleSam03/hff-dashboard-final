import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAnonAccess() {
  console.log(`Testing access with Anon key to ${supabaseUrl}`);
  
  const { data, error } = await supabase.from('participants').select('*').limit(1);
  if (error) {
    console.error("Anon access error:", error.message);
    console.log("Error code:", error.code);
  } else {
    console.log("Anon access successful! Found:", data.length);
  }
  
  const { data: regData, error: regError } = await supabase.from('registrations').select('*').limit(1);
  if (regError) {
    console.error("Registrations access error:", regError.message);
  } else {
    console.log("Registrations access successful! Found:", regData.length);
  }
}

testAnonAccess();
