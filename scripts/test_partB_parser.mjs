import fs from 'fs';

const mdPath = 'c:/Users/samuk/Documents/Registers/HFF_Registers_51_to_200s_Handover_29-10-2026.md';
const text = fs.readFileSync(mdPath, 'utf8');

function clean(str) {
    if (!str) return '';
    return str.replace(/~~/g, '').trim();
}

function parseAge(val) {
    if (!val) return null;
    const s = clean(val);
    if (!s || s === '-' || s === '—' || s.toLowerCase() === 'nil' || s.toLowerCase() === 'none') return null;
    const m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function parseGender(val) {
    if (!val) return 'F';
    const s = clean(val).toUpperCase();
    return s.startsWith('M') ? 'M' : 'F';
}

function parseAttendance(val) {
    const att = Array(12).fill(false);
    if (!val) return att;
    const s = clean(val).toLowerCase();
    if (s.includes('27 oct') || s.includes('27')) att[0] = true;
    if (s.includes('28 oct') || s.includes('28')) att[1] = true;
    if (s.includes('29 oct') || s.includes('29')) att[2] = true;
    if (s.includes('30 oct') || s.includes('30')) att[3] = true;
    return att;
}

const lines = text.split('\n');
let sec3Start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## 3. Part B')) sec3Start = i;
}

const partBTables = {};
let currentSub = null;

for (let i = sec3Start; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#### ')) {
        const m = line.match(/####\s+([A-Z])\.\s+`?REGISTER\s+(\d+[A-Za-z]?)/i);
        if (m) {
            currentSub = m[2].toUpperCase();
            if (!partBTables[currentSub]) {
                partBTables[currentSub] = [];
            }
        }
    }

    if (currentSub && partBTables[currentSub]) {
        if (line.trim().startsWith('|') && !line.includes('First Name') && !line.includes(':---') && !line.includes('Sheet & Row')) {
            const cells = line.split('|').map(c => c.trim());
            // Check if it's Table N (Sheet & Row) or normal table
            if (currentSub === '201') {
                // Table N format: | Sheet & Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Org | Occupation | Attendance | Book Given |
                if (cells.length >= 12 && cells[1].includes('Row')) {
                    const isStruck = line.includes('STRUCK THROUGH') || line.includes('~~');
                    partBTables[currentSub].push({
                        sheetRow: cells[1],
                        isStruck,
                        first_name: clean(cells[2]),
                        last_name: clean(cells[3]) === '—' || clean(cells[3]) === '-' ? '' : clean(cells[3]),
                        gender: parseGender(cells[4]),
                        age: parseAge(cells[5]),
                        contact: clean(cells[6]) === '—' || clean(cells[6]) === '-' ? '' : clean(cells[6]),
                        education: clean(cells[7]) === '—' || clean(cells[7]) === '-' ? '' : clean(cells[7]),
                        marital_status: clean(cells[8]) === '—' || clean(cells[8]) === '-' ? '' : clean(cells[8]),
                        affiliation: clean(cells[9]) === '—' || clean(cells[9]) === '-' ? '' : clean(cells[9]),
                        occupation: clean(cells[10]) === '—' || clean(cells[10]) === '-' ? '' : clean(cells[10]),
                        attendance: parseAttendance(cells[11])
                    });
                }
            } else {
                // Normal format: | Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Org | Occupation | Attendance | Book Given |
                if (cells.length >= 12 && /^\d+/.test(cells[1])) {
                    partBTables[currentSub].push({
                        row: cells[1],
                        first_name: clean(cells[2]),
                        last_name: clean(cells[3]) === '—' || clean(cells[3]) === '-' ? '' : clean(cells[3]),
                        gender: parseGender(cells[4]),
                        age: parseAge(cells[5]),
                        contact: clean(cells[6]) === '—' || clean(cells[6]) === '-' ? '' : clean(cells[6]),
                        education: clean(cells[7]) === '—' || clean(cells[7]) === '-' ? '' : clean(cells[7]),
                        marital_status: clean(cells[8]) === '—' || clean(cells[8]) === '-' ? '' : clean(cells[8]),
                        affiliation: clean(cells[9]) === '—' || clean(cells[9]) === '-' ? '' : clean(cells[9]),
                        occupation: clean(cells[10]) === '—' || clean(cells[10]) === '-' ? '' : clean(cells[10]),
                        attendance: parseAttendance(cells[11])
                    });
                }
            }
        }
    }
}

console.log("Parsed Part B Detailed Tables:");
for (const [reg, rows] of Object.entries(partBTables)) {
    console.log(`  Reg ${reg}: ${rows.length} rows`);
}
