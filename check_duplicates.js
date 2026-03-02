import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDuplicates() {
  console.log("Checking for duplicate UUIDs in 'registrations'...");
  
  const { data, error } = await supabase
    .from('registrations')
    .select('uuid, id')
    .order('uuid');

  if (error) {
    console.error("Error fetching registrations:", error.message);
    return;
  }

  const counts = {};
  const duplicates = [];
  
  data.forEach(row => {
    counts[row.uuid] = (counts[row.uuid] || 0) + 1;
    if (counts[row.uuid] > 1) {
      duplicates.push(row.uuid);
    }
  });

  const uniqueDuplicates = [...new Set(duplicates)];
  
  if (uniqueDuplicates.length > 0) {
    console.log(`Found ${uniqueDuplicates.length} UUIDs with duplicates.`);
    console.log("Example duplicate UUIDs:", uniqueDuplicates.slice(0, 5));
    
    // Count occurrences for the first duplicate
    const firstDup = uniqueDuplicates[0];
    const occurrences = data.filter(r => r.uuid === firstDup).length;
    console.log(`UUID '${firstDup}' appears ${occurrences} times.`);
  } else {
    console.log("No duplicate UUIDs found. The error must be something else.");
  }
}

checkDuplicates();
