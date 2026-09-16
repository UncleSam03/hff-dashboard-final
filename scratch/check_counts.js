import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    const { count: regCount, error: regError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true });

    const { count: profileCount, error: profileError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    console.log('Registrations count:', regCount);
    console.log('Profiles count:', profileCount);

    if (regError) console.error('Reg error:', regError);
    if (profileError) console.error('Profile error:', profileError);
}

checkCounts();
