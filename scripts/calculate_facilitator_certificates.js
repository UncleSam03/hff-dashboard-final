import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase configuration in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching registrations from Supabase...");
    const { data: registrations, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('is_deleted', false);

    if (error) {
        console.error("Error fetching registrations:", error);
        return;
    }

    const facilitators = registrations.filter(r => (r.type || '').toLowerCase() === 'facilitator');
    
    console.log(`Total Facilitators found: ${facilitators.length}`);

    const qualifyingFacilitators = facilitators.filter(f => {
        if (!f.attendance) return false;
        
        let daysAttended = 0;
        if (Array.isArray(f.attendance)) {
            daysAttended = f.attendance.filter(v => v === true).length;
        } else {
            daysAttended = Object.values(f.attendance).filter(v => v === true).length;
        }
        
        return daysAttended >= 8;
    });

    console.log("\n--- FACILITATORS QUALIFYING FOR CERTIFICATE (Min 8 days attendance) ---");
    console.log(`Total Qualifying: ${qualifyingFacilitators.length}`);
    console.log("--------------------------------------------------------------------\n");

    if (qualifyingFacilitators.length > 0) {
        qualifyingFacilitators.forEach((f, i) => {
            let daysAttended = 0;
            if (Array.isArray(f.attendance)) {
                daysAttended = f.attendance.filter(v => v === true).length;
            } else {
                daysAttended = Object.values(f.attendance).filter(v => v === true).length;
            }
            console.log(`${i + 1}. ${f.first_name} ${f.last_name} (${daysAttended} days)`);
        });
    } else {
        console.log("No facilitators found with 8 or more days of attendance.");
    }
}

run();
