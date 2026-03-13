
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read from .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}="(.*)"`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('hffdashboardfinal_SUPABASE_URL');
const serviceRoleKey = getEnvVar('hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const userId = '26e3d907-d368-4d92-96a0-0f440e34c219';

async function run() {
    console.log(`--- Checking Database for User: ${userId} ---`);

    // 1. Check Profiles
    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    console.log('\n[Profiles Table]');
    if (profErr) console.error('Error:', profErr);
    else console.log('Data:', profile || 'NOT FOUND');

    // 2. Check Registrations
    const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .select('*')
        .eq('uuid', userId)
        .maybeSingle();

    console.log('\n[Registrations Table]');
    if (regErr) console.error('Error:', regErr);
    else console.log('Data:', reg || 'NOT FOUND');

    process.exit(0);
}

run();
