import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectSchema() {
  console.log("--- Schema Inspection ---");

  // Check columns of registrations
  const { data: regSample } = await supabase.from('registrations').select('*').limit(1);
  if (regSample && regSample.length > 0) {
    console.log("Registrations columns:", Object.keys(regSample[0]));
    console.log("Sample type value:", regSample[0].type);
  }

  // Check information about constraints via query
  // Since we can't easily query PG views via Supabase JS without RPC, 
  // we try to insert a valid type to see if we still get the unique constraint error
  console.log("\n--- Testing with valid type ---");
  const testUuid = '22222222-2222-2222-2222-222222222222';
  // Try 'participant' as type since it's likely valid
  const { error: insertErr } = await supabase
    .from('registrations')
    .insert({ uuid: testUuid, first_name: 'Diag', last_name: 'Test', type: 'participant' });
  
  if (insertErr) {
    console.log("Insert failed:", insertErr.message);
  } else {
    console.log("Insert successful with type 'participant'.");
    
    // Now try to UPSERT to see if onConflict works
    console.log("Testing UPSERT (onConflict: uuid)...");
    const { error: upsertErr } = await supabase
      .from('registrations')
      .upsert({ uuid: testUuid, first_name: 'Diag', last_name: 'Test Updated', type: 'participant' }, { onConflict: 'uuid' });
    
    if (upsertErr) {
      console.log("UPSERT failed:", upsertErr.message);
    } else {
      console.log("UPSERT successful. uuid is unique.");
    }
    
    // Cleanup
    await supabase.from('registrations').delete().eq('uuid', testUuid);
  }
}

inspectSchema();
