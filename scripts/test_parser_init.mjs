import fs from 'fs';

const mdPath = 'c:/Users/samuk/Documents/Registers/HFF_Registers_51_to_200s_Handover_29-10-2026.md';
const text = fs.readFileSync(mdPath, 'utf8');

// Helper to clean string
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
    // Array of 12 booleans
    const att = Array(12).fill(false);
    if (!val) return att;
    const s = clean(val).toLowerCase();
    if (s.includes('27 oct') || s.includes('27')) att[0] = true;
    if (s.includes('28 oct') || s.includes('28')) att[1] = true;
    if (s.includes('29 oct') || s.includes('29')) att[2] = true;
    if (s.includes('30 oct') || s.includes('30')) att[3] = true;
    return att;
}

console.log("Reading handover file...");
console.log(`File length: ${text.length} characters.`);
