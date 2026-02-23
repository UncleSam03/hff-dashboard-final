import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.').filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
    console.log(`\nFile: ${file}`);
    try {
        const workbook = XLSX.readFile(file);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        console.log("Headers (Row 0):", JSON.stringify(data[0]));
        console.log("Headers (Row 1):", JSON.stringify(data[1]));
        console.log("Data (Row 2):", JSON.stringify(data[2]?.slice(0, 10)));
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
});
