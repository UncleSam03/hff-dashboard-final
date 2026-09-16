import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_hffdashboardfinal_SUPABASE_URL;
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countWdcVdc() {
    console.log('Fetching data from Supabase (registrations)...');
    
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('registrations')
            .select('affiliation, occupation')
            .eq('is_deleted', false)
            .range(from, from + step - 1);

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        allData = allData.concat(data);
        if (data.length < step) {
            hasMore = false;
        } else {
            from += step;
        }
    }

    console.log(`Successfully fetched ${allData.length} non-deleted records from registrations.`);

    let wdcCount = 0;
    let vdcCount = 0;
    let pastorCount = 0;
    let socialWorkerCount = 0;

    allData.forEach(row => {
        const aff = (row.affiliation || '').toUpperCase();
        const occ = (row.occupation || '').toUpperCase();

        const isWdc = aff.includes('WDC') || occ.includes('WDC') || 
                      aff.includes('WARD DEVELOPMENT COMMITTEE') || occ.includes('WARD DEVELOPMENT COMMITTEE');
        const isVdc = aff.includes('VDC') || occ.includes('VDC') || 
                      aff.includes('VILLAGE DEVELOPMENT COMMITTEE') || occ.includes('VILLAGE DEVELOPMENT COMMITTEE');
        const isPastor = aff.includes('PASTOR') || occ.includes('PASTOR') || 
                         aff.includes('REVEREND') || occ.includes('REVEREND') ||
                         aff.includes('BISHOP') || occ.includes('BISHOP');
        const isSocialWorker = aff.includes('SOCIAL WORKER') || occ.includes('SOCIAL WORKER') ||
                               aff.includes('S&CD') || occ.includes('S&CD') ||
                               aff.includes('S & CD') || occ.includes('S & CD') ||
                               occ.includes('SOCIAL AND COMMUNITY DEVELOPMENT');

        if (isWdc) {
            wdcCount++;
        } else if (isVdc) {
            vdcCount++;
        }

        if (isPastor) {
            pastorCount++;
        }

        if (isSocialWorker) {
            socialWorkerCount++;
        }
    });

    console.log('--- Registrations Results ---');
    console.log(`WDC Count: ${wdcCount}`);
    console.log(`VDC Count: ${vdcCount}`);
    console.log(`Pastor Count: ${pastorCount}`);
    console.log(`Social Worker Count: ${socialWorkerCount}`);

    // Now check profiles
    console.log('\nFetching data from Supabase (profiles)...');
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('affiliation, occupation');

    if (profileError) {
        console.error('Error fetching profiles:', profileError);
    } else {
        let pWdcCount = 0;
        let pVdcCount = 0;
        let pPastorCount = 0;
        let pSocialWorkerCount = 0;

        profileData.forEach(row => {
            const aff = (row.affiliation || '').toUpperCase();
            const occ = (row.occupation || '').toUpperCase();

            const isWdc = aff.includes('WDC') || occ.includes('WDC') || 
                          aff.includes('WARD DEVELOPMENT COMMITTEE') || occ.includes('WARD DEVELOPMENT COMMITTEE');
            const isVdc = aff.includes('VDC') || occ.includes('VDC') || 
                          aff.includes('VILLAGE DEVELOPMENT COMMITTEE') || occ.includes('VILLAGE DEVELOPMENT COMMITTEE');
            const isPastor = aff.includes('PASTOR') || occ.includes('PASTOR') || 
                             aff.includes('REVEREND') || occ.includes('REVEREND') ||
                             aff.includes('BISHOP') || occ.includes('BISHOP');
            const isSocialWorker = aff.includes('SOCIAL WORKER') || occ.includes('SOCIAL WORKER') ||
                                   aff.includes('S&CD') || occ.includes('S&CD') ||
                                   aff.includes('S & CD') || occ.includes('S & CD') ||
                                   occ.includes('SOCIAL AND COMMUNITY DEVELOPMENT');

            if (isWdc) {
                pWdcCount++;
            } else if (isVdc) {
                pVdcCount++;
            }

            if (isPastor) {
                pPastorCount++;
            }

            if (isSocialWorker) {
                pSocialWorkerCount++;
            }
        });

        console.log('--- Profiles Results ---');
        console.log(`WDC Count: ${pWdcCount}`);
        console.log(`VDC Count: ${pVdcCount}`);
        console.log(`Pastor Count: ${pPastorCount}`);
        console.log(`Social Worker Count: ${pSocialWorkerCount}`);
    }
    console.log('------------------------');
}

countWdcVdc();
