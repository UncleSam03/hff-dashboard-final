import fs from 'fs';
import Papa from 'papaparse';

const csvFile = './registrations_rows (2).csv';

if (!fs.existsSync(csvFile)) {
    console.error(`File not found: ${csvFile}`);
    process.exit(1);
}

const csvData = fs.readFileSync(csvFile, 'utf8');

Papa.parse(csvData, {
    header: true,
    complete: (results) => {
        let wdcCount = 0;
        let vdcCount = 0;

        results.data.forEach((row) => {
            const occupation = (row.occupation || '').toUpperCase();
            const affiliation = (row.affiliation || '').toUpperCase();

            // Check if WDC or VDC is present in either occupation or affiliation
            // Using regex to ensure we don't match it as part of another word (though WDC/VDC are usually distinct)
            if (occupation.includes('WDC') || affiliation.includes('WDC')) {
                wdcCount++;
            } else if (occupation.includes('VDC') || affiliation.includes('VDC')) {
                vdcCount++;
            }
        });

        console.log('--- Results ---');
        console.log(`Total records: ${results.data.length}`);
        console.log(`WDC Count: ${wdcCount}`);
        console.log(`VDC Count: ${vdcCount}`);
        console.log('---------------');
    },
    error: (error) => {
        console.error('Error parsing CSV:', error);
    }
});
