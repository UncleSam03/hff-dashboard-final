import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('./MOLEPOLOLE HALL REGISTRATION COMPLETE.xlsx');
console.log("Reading file:", filePath);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log("First 15 rows:");
    data.slice(0, 15).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
} catch (error) {
    console.error("Error reading file:", error);
}
