import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Fetching participants sample:");
  const { data: pData, error: pErr } = await supabase.from('participants').select('*').limit(5);
  if (pErr) console.error("participants error:", pErr.message);
  else {
    console.log("Participants columns:", pData.length > 0 ? Object.keys(pData[0]) : "Empty");
    console.log(pData);
  }

  console.log("Fetching facilitators sample (if exists):");
  const { data: fData, error: fErr } = await supabase.from('facilitators').select('*').limit(5);
  if (fErr) console.error("facilitators error:", fErr.message);
  else {
    console.log("Facilitators columns:", fData.length > 0 ? Object.keys(fData[0]) : "Empty");
    console.log(fData);
  }
  
  console.log("Fetching registrations sample:");
  const { data: rData, error: rErr } = await supabase.from('registrations').select('*').limit(5);
  if (rErr) console.error("registrations error:", rErr.message);
  else {
     console.log("Registrations columns:", rData.length > 0 ? Object.keys(rData[0]) : "Empty");
  }

  console.log("Fetching attendance sample:");
  const { data: aData, error: aErr } = await supabase.from('attendance').select('*').limit(5);
  if (aErr) console.error("attendance error:", aErr.message);
  else {
    console.log("Attendance columns:", aData.length > 0 ? Object.keys(aData[0]) : "Empty");
  }
}

run();
