import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runDiagnostics() {
  console.log("--- Supabase Diagnostics ---");
  
  // 1. Check Tables Existence
  const tables = ['registrations', 'profiles', 'registration_queue', 'participants'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`Table '${table}': ${error ? 'MISSING (' + error.message + ')' : 'OK'}`);
  }

  // 2. Check Registrations unique constraint (uuid)
  // We try an upsert with a dummy UUID to see if it triggers the "no unique constraint" error
  console.log("\n--- Testing Constraints ---");
  const testUuid = '00000000-0000-0000-0000-000000000000';
  const { error: upsertErr } = await supabase
    .from('registrations')
    .upsert({ uuid: testUuid, first_name: 'Diag', last_name: 'Test', type: 'test' }, { onConflict: 'uuid' });
  
  if (upsertErr) {
    console.log(`Upsert on 'uuid' failed: ${upsertErr.message}`);
    if (upsertErr.message.includes('unique or exclusion constraint')) {
      console.log("DIAGNOSIS: The 'uuid' column is missing a UNIQUE constraint.");
    }
  } else {
    console.log("Upsert on 'uuid' successful. Unique constraint is present.");
    // Cleanup
    await supabase.from('registrations').delete().eq('uuid', testUuid);
  }

  // 3. Check Registration Queue Trigger
  console.log("\n--- Testing Trigger ---");
  const triggerTestUuid = '11111111-1111-1111-1111-111111111111';
  await supabase.from('registrations').insert({ 
    uuid: triggerTestUuid, 
    first_name: 'Trigger', 
    last_name: 'Test', 
    type: 'participant' 
  });
  
  const { data: queueData, error: queueErr } = await supabase
    .from('registration_queue')
    .select('*')
    .eq('registration_id', triggerTestUuid);
  
  if (queueData && queueData.length > 0) {
    console.log("Trigger OK: New participant added to registration_queue.");
  } else {
    console.log("Trigger FAILED: No queue entry found for new participant.");
  }
  
  // Cleanup test data
  await supabase.from('registrations').delete().eq('uuid', triggerTestUuid);
  // queue table should cascade delete if FK is set, but let's be safe
  await supabase.from('registration_queue').delete().eq('registration_id', triggerTestUuid);

  console.log("\n--- Diagnostics Complete ---");
}

runDiagnostics();
