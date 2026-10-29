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
let sec2Start = -1;
let sec3Start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## 2. Part A')) sec2Start = i;
    if (lines[i].startsWith('## 3. Part B')) sec3Start = i;
}

const partARegisters = {};
let currentReg = null;

for (let i = sec2Start; i < sec3Start; i++) {
    const line = lines[i];
    if (line.includes('REGISTER ')) {
        const m = line.match(/REGISTER\s+(\d+[A-Za-z]?)/i);
        if (m && line.startsWith('####')) {
            currentReg = m[1].toUpperCase();
            if (!partARegisters[currentReg]) {
                partARegisters[currentReg] = {
                    formNumber: currentReg,
                    leader: '',
                    cell: '',
                    secondLeader: '',
                    secondCell: '',
                    place: '',
                    time: '',
                    participants: []
                };
            }
        }
    }

    if (currentReg && partARegisters[currentReg]) {
        if (line.includes('**Group Leader:**')) {
            const mLeader = line.match(/\*\*Group Leader:\*\*\s*`?([^`|\(]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)]+)`?\))?/i);
            if (mLeader) {
                partARegisters[currentReg].leader = mLeader[1].trim();
                if (mLeader[2]) partARegisters[currentReg].cell = mLeader[2].trim();
            }
        }
        if (line.includes('**Second Leader:**')) {
            const mSec = line.match(/\*\*Second Leader:\*\*\s*`?([^`|\(]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)]+)`?\))?/i);
            if (mSec && !mSec[1].toLowerCase().includes('none') && !mSec[1].includes('—')) {
                partARegisters[currentReg].secondLeader = mSec[1].trim();
                if (mSec[2]) partARegisters[currentReg].secondCell = mSec[2].trim();
            }
        }
        if (line.includes('**Meeting Place:**')) {
            const mPlace = line.match(/\*\*Meeting Place:\*\*\s*`?([^`|\(]+)`?(?:\s*\(`?([^`\)]+)`?\))?/i);
            if (mPlace) {
                partARegisters[currentReg].place = mPlace[1].trim();
                if (mPlace[2]) partARegisters[currentReg].time = mPlace[2].trim();
            }
        }
        if (line.includes('**Meeting Time:**')) {
            const mTime = line.match(/\*\*Meeting Time:\*\*\s*`?([^`\n]+)`?/i);
            if (mTime) {
                partARegisters[currentReg].time = mTime[1].trim();
            }
        }

        // Table rows
        if (line.trim().startsWith('|') && !line.includes('First Name') && !line.includes(':---') && !line.includes('Register / Form No.')) {
            const cells = line.split('|').map(c => c.trim());
            if (cells.length >= 12 && /^\d+/.test(cells[1])) {
                if (cells[2].includes('~~') || line.includes('crossed out') || line.includes('STRUCK THROUGH')) {
                    // skip
                } else {
                    partARegisters[currentReg].participants.push({
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

console.log("Parsed Part A Registers:");
let totalPartAParticipants = 0;
for (const [reg, data] of Object.entries(partARegisters)) {
    console.log(`  Reg ${reg}: ${data.leader} (${data.cell}) | ${data.place} | ${data.time} | Participants: ${data.participants.length}`);
    totalPartAParticipants += data.participants.length;
}
console.log(`Total Part A Participants Parsed: ${totalPartAParticipants}`);
