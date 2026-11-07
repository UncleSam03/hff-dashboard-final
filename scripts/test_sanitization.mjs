function sanitizeMarital(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.toLowerCase().includes('wrote') || s === '—' || s === '-' || s === 'N/A') return '';
    s = s.replace(/[^\x20-\x7E]/g, '').trim();
    const clean = s.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (clean === 'S' || clean === 'SINGLE' || clean === 'SINGLES') return 'Single';
    if (clean === 'M' || clean === 'MARRIED' || clean === 'MARRIEDM') return 'Married';
    if (clean === 'D' || clean === 'DIVORCED') return 'Divorced';
    if (clean === 'W' || clean === 'WIDOW' || clean === 'WIDOWED') return 'Widowed';
    if (clean === 'C' || clean === 'COHABITING') return 'Cohabiting';
    return '';
}

function sanitizeEdu(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.toUpperCase() === 'NIL' || s.toUpperCase() === 'NONE' || s === '—' || s === '-' || s === 'N/A') return '';
    s = s.replace(/[^\x20-\x7E]/g, '').trim();
    const clean = s.toUpperCase();
    if (clean === 'J') return 'Junior Secondary';
    if (clean === 'S') return 'Senior Secondary';
    if (clean === 'U' || clean === 'T') return 'Tertiary';
    if (clean === 'P') return 'Primary';
    return s;
}

console.log("Marital ' *(wrote F)*':", sanitizeMarital(' *(wrote F)*'));
console.log("Marital 'S':", sanitizeMarital('S'));
console.log("Marital 'C':", sanitizeMarital('C'));
console.log("Marital 'Married (M)':", sanitizeMarital('Married (M)'));
console.log("Edu 'J':", sanitizeEdu('J'));
console.log("Edu 'NIL':", sanitizeEdu('NIL'));
console.log("Edu 'BGCSE':", sanitizeEdu('BGCSE'));
console.log("Edu 'Diploma Primary':", sanitizeEdu('Diploma Primary'));
