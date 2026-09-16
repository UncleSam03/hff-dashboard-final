/**
 * searchUtils.js
 * Comprehensive search matching utility for HFF records.
 * 
 * Supports 6 core criteria:
 * 1. Meeting Place (venue, cluster, village, site)
 * 2. Form Number (physical form #, group form #)
 * 3. Phone Number (contact digits, formatted or raw)
 * 4. Facilitator Names (assigned facilitator for participants, or facilitator's own name)
 * 5. Date Entered (registration date formatted in ISO, DD/MM/YYYY, MM/DD/YYYY, month names)
 * 6. Meeting Times (designated meeting schedule / time)
 * 
 * Also supports person's own name and tokenized multi-word search across all criteria.
 */

const MONTH_NAMES = [
    { short: 'jan', full: 'january' },
    { short: 'feb', full: 'february' },
    { short: 'mar', full: 'march' },
    { short: 'apr', full: 'april' },
    { short: 'may', full: 'may' },
    { short: 'jun', full: 'june' },
    { short: 'jul', full: 'july' },
    { short: 'aug', full: 'august' },
    { short: 'sep', full: 'september' },
    { short: 'oct', full: 'october' },
    { short: 'nov', full: 'november' },
    { short: 'dec', full: 'december' }
];

/**
 * Normalizes phone numbers by stripping non-digit characters
 */
export function normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
}

/**
 * Normalizes form numbers by stripping '#', 'form', leading zeros
 */
export function normalizeFormNumber(val) {
    if (!val) return '';
    return String(val)
        .toLowerCase()
        .replace(/^#+/, '')
        .replace(/^form\s*#*/i, '')
        .trim();
}

/**
 * Checks if a given date string or timestamp matches the user's search query.
 * Generates various common date representations (ISO, DD/MM/YYYY, MM/DD/YYYY, Month Day, etc.)
 */
export function matchesDate(dateVal, query) {
    if (!dateVal || !query) return false;
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return false;

    // Check raw string first (e.g. 2026-09-14)
    const rawStr = String(dateVal).toLowerCase();
    if (rawStr.includes(cleanQuery)) return true;

    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return false;

        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-12
        const day = d.getDate(); // 1-31

        const monthShort = MONTH_NAMES[d.getMonth()]?.short || '';
        const monthFull = MONTH_NAMES[d.getMonth()]?.full || '';

        const pad = (n) => String(n).padStart(2, '0');
        const mPad = pad(month);
        const dPad = pad(day);

        // Common formats
        const formats = [
            `${year}-${mPad}-${dPad}`,       // 2026-09-14
            `${year}-${mPad}`,               // 2026-09
            `${year}`,                       // 2026
            `${dPad}/${mPad}/${year}`,       // 14/09/2026
            `${day}/${month}/${year}`,       // 14/9/2026
            `${dPad}/${mPad}`,               // 14/09
            `${mPad}/${dPad}/${year}`,       // 09/14/2026
            `${month}/${day}/${year}`,       // 9/14/2026
            `${mPad}/${dPad}`,               // 09/14
            `${dPad}-${mPad}-${year}`,       // 14-09-2026
            `${day}-${month}-${year}`,       // 14-9-2026
            `${dPad}-${mPad}`,               // 14-09
            `${mPad}-${dPad}-${year}`,       // 09-14-2026
            `${dPad}.${mPad}.${year}`,       // 14.09.2026
            `${monthShort} ${day}`,          // sep 14
            `${day} ${monthShort}`,          // 14 sep
            `${monthFull} ${day}`,           // september 14
            `${day} ${monthFull}`,           // 14 september
            `${monthShort} ${year}`,         // sep 2026
            `${monthFull} ${year}`,          // september 2026
            `${monthShort}`,                 // sep
            `${monthFull}`,                  // september
            d.toLocaleDateString('en-GB').toLowerCase(), // e.g. 14/09/2026
            d.toLocaleDateString('en-US').toLowerCase(), // e.g. 9/14/2026
            d.toDateString().toLowerCase()   // e.g. mon sep 14 2026
        ];

        return formats.some(f => f.includes(cleanQuery));
    } catch {
        return false;
    }
}

/**
 * Checks a specific criterion for a person.
 */
export function matchSingleCriterion(person, criterion, query) {
    if (!person || !query) return false;
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return false;

    const assignedFac = person.assignedFacilitator;

    switch (criterion) {
        case 'meeting_place': {
            // Check person's affiliation (which stores meeting place), meeting_place, and place
            const fields = [
                person.affiliation,
                person.meeting_place,
                person.place
            ];

            // If participant, also check assigned facilitator's meeting place
            if (assignedFac) {
                fields.push(assignedFac.affiliation, assignedFac.meeting_place, assignedFac.place);
            }

            return fields.some(f => f && String(f).toLowerCase().includes(cleanQuery));
        }

        case 'form_number': {
            const normalizedQuery = normalizeFormNumber(cleanQuery);
            const forms = [
                person.form_number,
                person.group_form_number
            ];
            if (assignedFac) {
                forms.push(assignedFac.form_number);
            }

            return forms.some(f => {
                if (!f) return false;
                const normF = normalizeFormNumber(f);
                return normF.includes(normalizedQuery) || String(f).toLowerCase().includes(cleanQuery);
            });
        }

        case 'phone_number':
        case 'phone': {
            const queryDigits = normalizePhone(cleanQuery);
            const contacts = [
                person.contact,
                person.phone
            ];
            if (assignedFac) {
                contacts.push(assignedFac.contact, assignedFac.phone);
            }

            return contacts.some(c => {
                if (!c) return false;
                // Text substring match
                if (String(c).toLowerCase().includes(cleanQuery)) return true;
                // Digits match if at least 2 digits queried
                if (queryDigits.length >= 2) {
                    const cDigits = normalizePhone(c);
                    return cDigits.includes(queryDigits);
                }
                return false;
            });
        }

        case 'facilitator_names':
        case 'facilitator': {
            const facNames = [];
            if (person.type === 'facilitator') {
                facNames.push(`${person.first_name || ''} ${person.last_name || ''}`.trim());
            }
            if (person.facilitatorName) {
                facNames.push(person.facilitatorName);
            }
            if (assignedFac) {
                facNames.push(`${assignedFac.first_name || ''} ${assignedFac.last_name || ''}`.trim());
            }

            return facNames.some(name => {
                if (!name) return false;
                const lower = name.toLowerCase();
                if (lower.includes(cleanQuery)) return true;
                // Also reverse name comparison (Doe John vs John Doe)
                const parts = lower.split(/\s+/).filter(Boolean);
                if (parts.length >= 2) {
                    const reversed = `${parts.slice(1).join(' ')} ${parts[0]}`;
                    if (reversed.includes(cleanQuery)) return true;
                }
                return false;
            });
        }

        case 'date_entered':
        case 'date': {
            return (
                matchesDate(person.created_at, cleanQuery) ||
                matchesDate(person.date_entered, cleanQuery) ||
                matchesDate(person.updated_at, cleanQuery)
            );
        }

        case 'meeting_times':
        case 'meeting_time': {
            const times = [
                person.meeting_time,
                person.meetingTime
            ];
            if (assignedFac) {
                times.push(assignedFac.meeting_time, assignedFac.meetingTime);
            }

            return times.some(t => t && String(t).toLowerCase().includes(cleanQuery));
        }

        case 'name': {
            const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim().toLowerCase();
            if (fullName.includes(cleanQuery)) return true;
            const reversed = `${person.last_name || ''} ${person.first_name || ''}`.trim().toLowerCase();
            return reversed.includes(cleanQuery);
        }

        default:
            return false;
    }
}

/**
 * Evaluates whether a person record matches the search query.
 * If criterion is 'all', tests across meeting place, form #, phone, facilitator, date, meeting time, and name.
 * Also supports multi-token search (e.g. "Tuesday St Jude" matches if all tokens match at least one criterion).
 *
 * @param {Object} person - The person or facilitator object
 * @param {string} query - The search query
 * @param {string} [criterion='all'] - 'all' | 'meeting_place' | 'form_number' | 'phone_number' | 'facilitator_names' | 'date_entered' | 'meeting_times' | 'name'
 * @returns {boolean}
 */
export function matchesPerson(person, query, criterion = 'all') {
    if (!person) return false;
    if (!query || !query.trim()) return true;

    const trimmed = query.trim();

    if (criterion !== 'all') {
        return matchSingleCriterion(person, criterion, trimmed);
    }

    // For 'all', check phrase match across all criteria first
    const ALL_CRITERIA = [
        'meeting_place',
        'form_number',
        'phone_number',
        'facilitator_names',
        'date_entered',
        'meeting_times',
        'name'
    ];

    if (ALL_CRITERIA.some(crit => matchSingleCriterion(person, crit, trimmed))) {
        return true;
    }

    // Tokenized multi-word search: split into words, ensure every token matches at least one criterion
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
        return tokens.every(token => 
            ALL_CRITERIA.some(crit => matchSingleCriterion(person, crit, token))
        );
    }

    return false;
}

/**
 * Filter an array of people using the search criteria
 */
export function filterPeople(list, query, criterion = 'all') {
    if (!list) return [];
    if (!query || !query.trim()) return list;
    return list.filter(person => matchesPerson(person, query, criterion));
}

/**
 * Formats a date string safely for user display
 */
export function formatEnteredDate(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return '';
    }
}
