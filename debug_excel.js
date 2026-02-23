import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('./MAUN LC HALL REGISTRATION (Complete).xlsx');
console.log("Reading file:", filePath);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    rows.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });

    const headerIndex = rows.findIndex(r => r && r[0] === 'No.');
    console.log("\nDetected 'No.' at row:", headerIndex);
    if (headerIndex !== -1) {
        console.log("Header row:", JSON.stringify(rows[headerIndex]));
        console.log("Next row (potential Date row):", JSON.stringify(rows[headerIndex + 1]));
        console.log("Next row (potential Data start):", JSON.stringify(rows[headerIndex + 2]));
    }
} catch (error) {
    console.error("Error:", error);
}
