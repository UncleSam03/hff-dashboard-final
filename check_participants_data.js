import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log("Checking 'participants' table data...");
  const { data, error } = await supabase.from('participants').select('*').limit(5);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Found rows:", data.length);
    if (data.length > 0) {
      console.log("Sample row:", data[0]);
    }
  }
}

checkData();
