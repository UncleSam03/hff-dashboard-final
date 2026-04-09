/**
 * parse_selebi_phikwe.js
 * Parses the Selebi Phikwe HFF Pre-Registration CSV.
 * Outputs:
 *   1. A clean JSON file ready for import (SELEBI_PHIKWE_facilitators.json)
 *   2. A summary to console
 *
 * Data rules:
 *   - Every named row is a FACILITATOR
 *   - "HALL GROUP" column = number of participants they bring
 *   - Rows with no name (just "WDC") = unregistered placeholders → skipped
 *   - type = 'facilitator', source = 'selebi_phikwe_prereg', place = 'Selebi Phikwe'
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CSV_PATH = path.join(__dirname, '..', 'SELEBI PHIKWE PRE REGISTRATION (1) - Sheet1.csv');

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = raw.split(/\r?\n/);

// Skip the 2 header rows (row 0 = col headers, row 1 = sub-headers)
const dataLines = lines.slice(2);

const facilitators = [];
const skipped = [];

for (let i = 0; i < dataLines.length; i++) {
  const line = dataLines[i];
  if (!line.trim()) continue;

  // Split by comma but be careful — some fields have commas? No, it's a simple CSV
  const cols = line.split(',');

  const rawName = (cols[0] || '').trim();
  const contact  = (cols[1] || '').trim();
  const affiliation = (cols[2] || '').trim();
  // col[3] = empty spacer
  const isParticipant = (cols[4] || '').trim(); // ✓ or empty
  const participantsCount = (cols[5] || '').trim(); // number or empty

  // Skip rows with no real name (WDC placeholders, blank rows, etc.)
  const isPlaceholder = !rawName || rawName.toUpperCase() === 'WDC' || rawName === '';
  if (isPlaceholder) {
    skipped.push({ line: i + 3, rawName, reason: 'no name / placeholder' });
    continue;
  }

  // Skip rows with no ✓ participation mark (e.g. line 68 LUCKY K MANYEPEDZA)
  if (!isParticipant.includes('✓')) {
    skipped.push({ line: i + 3, rawName, reason: 'no ✓ participation mark' });
    continue;
  }

  // Split name into first + last
  const nameParts = rawName.trim().split(/\s+/);
  const firstName = nameParts[0] || rawName;
  const lastName  = nameParts.slice(1).join(' ') || '';

  // Parse participants count
  const pcRaw = participantsCount.replace(/[^0-9]/g, '');
  const participantsCountNum = pcRaw !== '' ? parseInt(pcRaw, 10) : null;

  // Clean contact — keep as text to preserve dual numbers
  const cleanContact = contact.replace(/[^0-9/+\s]/g, '').trim() || null;

  facilitators.push({
    uuid: randomUUID(),
    first_name: firstName,
    last_name: lastName,
    full_name: rawName,
    contact: cleanContact,
    affiliation: affiliation || null,
    participants_count: participantsCountNum,
    type: 'facilitator',
    place: 'Selebi Phikwe',
    source: 'selebi_phikwe_prereg',
    books_received: false,
  });
}

// Sort: by affiliation (so grouped nicely), then by name
facilitators.sort((a, b) => {
  const affA = (a.affiliation || 'ZZZ').toUpperCase();
  const affB = (b.affiliation || 'ZZZ').toUpperCase();
  if (affA !== affB) return affA.localeCompare(affB);
  return a.full_name.localeCompare(b.full_name);
});

// Output JSON
const outPath = path.join(__dirname, '..', 'SELEBI_PHIKWE_facilitators.json');
fs.writeFileSync(outPath, JSON.stringify(facilitators, null, 2), 'utf-8');

// Console summary
console.log('\n========================================');
console.log('  SELEBI PHIKWE PRE-REGISTRATION PARSE');
console.log('========================================');
console.log(`✅ Facilitators parsed:  ${facilitators.length}`);
console.log(`⏭  Rows skipped:         ${skipped.length}`);
console.log(`\nSkipped rows:`);
skipped.forEach(s => console.log(`  Line ${s.line}: "${s.rawName}" — ${s.reason}`));

// Group summary by affiliation
const byAffiliation = {};
facilitators.forEach(f => {
  const key = f.affiliation || '(No affiliation)';
  if (!byAffiliation[key]) byAffiliation[key] = [];
  byAffiliation[key].push(f.full_name);
});

console.log(`\n📋 Facilitators by Affiliation:\n`);
Object.entries(byAffiliation)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([aff, names]) => {
    console.log(`  [${names.length}] ${aff}`);
    names.forEach(n => console.log(`       - ${n}`));
  });

console.log(`\n💾 Output saved to: SELEBI_PHIKWE_facilitators.json`);
console.log('========================================\n');
