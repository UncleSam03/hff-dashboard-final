import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

console.log('Testing Supabase Connection...')
console.log('URL:', supabaseUrl)
console.log('Key length:', supabaseKey?.length)

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
    try {
        const { data, error } = await supabase.from('registrations').select('*').limit(1)
        if (error) {
            console.error('Supabase error:', error.message)
            if (error.code === 'PGRST116' || error.message.includes('relation "public.registrations" does not exist')) {
                console.log('NOTE: The "registrations" table might be missing in the new DB.')
            }
        } else {
            console.log('Supabase connection SUCCESSFUL.')
            console.log('Data found:', data.length)
        }
    } catch (err) {
        console.error('Unexpected error:', err.message)
    }
}

testConnection()
