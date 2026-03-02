import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

async function fetchSchema() {
  console.log(`Fetching schema from ${supabaseUrl}/rest/v1/`);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        return;
    }
    
    const data = await response.json();
    console.log("Tables found in OpenAPI spec:");
    const tables = Object.keys(data.definitions || {});
    tables.forEach(t => console.log(`- ${t}`));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

fetchSchema();
