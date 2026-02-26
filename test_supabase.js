import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  const { data, error } = await supabase.from('registrations').select('*').limit(1)
  if (error) {
    if (error.code === 'PGRST116') {
      console.log('Supabase connection successful (Table empty or no access to rows)')
    } else {
      console.error('Supabase connection error:', error.message)
    }
  } else {
    console.log('Supabase connection successful, found rows:', data.length)
  }
}

testConnection()
