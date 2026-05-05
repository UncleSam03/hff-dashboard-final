import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing from .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportFacilitators() {
    // Fetch all facilitators first to see their status
    const { data, error } = await supabase
        .from('registrations')
        .select('first_name, last_name, contact, affiliation, is_deleted')
        .eq('type', 'facilitator');

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No facilitators found.');
        return;
    }

    const activeData = data.filter(f => f.is_deleted !== true);
    const deletedCount = data.length - activeData.length;

    if (activeData.length === 0) {
        console.log('No active facilitators found.');
        return;
    }

    console.log(`Found ${data.length} total facilitators.`);
    console.log(`Excluded ${deletedCount} deleted facilitators.`);
    console.log(`Exporting ${activeData.length} active facilitators.`);

    const csvHeaders = 'Name,Phone Number,Affiliation\n';
    const csvRows = activeData.map(f => {
        const fullName = `${f.first_name || ''} ${f.last_name || ''}`.trim();
        const contact = f.contact || '';
        const affiliation = f.affiliation || '';
        
        // Escape quotes and commas in fields
        const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;
        return `${escape(fullName)},${escape(contact)},${escape(affiliation)}`;
    }).join('\n');

    const csvContent = csvHeaders + csvRows;
    const outputPath = path.join(process.cwd(), 'facilitators_list.csv');
    
    fs.writeFileSync(outputPath, csvContent);
    console.log(`Successfully exported facilitators to: ${outputPath}`);
}

exportFacilitators();
