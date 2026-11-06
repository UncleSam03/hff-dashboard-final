import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

/**
 * Compound occupation words that naturally contain a hyphen and should NOT be split
 * into Occupation + Affiliation when no organization follows.
 */
const COMPOUND_OCCUPATION_PATTERNS = [
    /^self[\s-]*employed$/i,
    /^pre[\s-]*school(\s+teacher)?$/i,
    /^co[\s-]*founder$/i,
    /^co[\s-]*ordinator$/i,
    /^sub[\s-]*inspector$/i,
    /^part[\s-]*time$/i,
    /^full[\s-]*time$/i,
    /^v[\s-]*secretary$/i,
    /^vice[\s-]*secretary$/i,
    /^vice[\s-]*chair(person|man)?$/i,
    /^add[\s-]*member$/i,
    /^non[\s-]*commissioned(\s+officer)?$/i,
];

/**
 * Patterns that strongly identify an organization/institution name rather than a job title
 * when written on the left side of a hyphen (e.g. "Kgatleng District Council-Operator").
 */
const INSTITUTION_PATTERNS = /\b(parliament|land\s*board|district\s*council|coucil|council|tribal(\s+admin(istration)?)?|police\s*service|ministry|department|church|school|clinic|hospital|brigade|prison|bdf|defence\s*force|university|college|association|foundation|society|centre|center|bank)\b/i;

/**
 * Patterns that strongly identify a job title / occupation role when written on the right side
 * of a hyphen (e.g. "Parliament-Clerk Assistant 1", "Kgatleng Tribal - Kgosi").
 */
const ROLE_PATTERNS = /^(clerk(\s+assistant(\s*\d*)?)?|groundsman|operator|driver|kgosi|police\s*officer|procurement(\s+assistant|\s+officer)?|administration\s*officer|admin\s*officer|environmental\s*officer|social\s*worker|pastor|teacher|cleaner|nurse|secretary|director|manager|officer|assistant|tutor|lecturer|soldier|inspector|warden|cook|chef|caretaker|messenger|typist|accountant|receptionist|supervisor|coordinator|counselor|counsellor|intern|volunteer|agent|security(\s+officer|\s+guard)?)$/i;

/**
 * Normalizes known spelling typos in organization names (e.g. "Coucil" -> "Council").
 */
function normalizeAffiliationName(name) {
    if (!name) return '';
    return String(name)
        .trim()
        .replace(/^Coucil$/i, 'Council')
        .replace(/\bCoucil\b/gi, 'Council');
}

/**
 * Splits a raw occupation string where a hyphen (`-`, `–`, or `—`) acts as a differentiator
 * between Occupation and Affiliation (e.g., "Social Worker - Mochudi Resource Centre For The Blind").
 *
 * Also detects and normalizes reversed "Affiliation - Occupation" entries (e.g.,
 * "Kgatleng District Council-Operator" -> occupation: "Operator", affiliation: "Kgatleng District Council")
 * and preserves compound words like "Self-Employed".
 *
 * If `existingAffiliation` held a different value (such as a facilitator's meeting place venue)
 * and a new `affiliation` is extracted from `rawOccupation`, the old value is preserved in `meeting_place`.
 *
 * @param {string} rawOccupation
 * @param {string} [existingAffiliation='']
 * @param {string} [existingMeetingPlace='']
 * @returns {{ occupation: string, affiliation: string, meeting_place: string, wasSplit: boolean, wasReversed: boolean }}
 */
export function splitOccupationAndAffiliation(
    rawOccupation,
    existingAffiliation = '',
    existingMeetingPlace = ''
) {
    const cleanOcc = String(rawOccupation || '').trim();
    const cleanAff = String(existingAffiliation || '').trim();
    const cleanMeet = String(existingMeetingPlace || '').trim();

    // Handle empty or dash-only placeholders ("—", "-", "--")
    if (!cleanOcc || /^[-–—]+$/.test(cleanOcc)) {
        return {
            occupation: '',
            affiliation: cleanAff === '—' ? '' : cleanAff,
            meeting_place: cleanMeet === '—' ? '' : cleanMeet,
            wasSplit: false,
            wasReversed: false,
        };
    }

    // Check if the entire string is a known hyphenated compound occupation (e.g. "Self-Employed")
    if (COMPOUND_OCCUPATION_PATTERNS.some((regex) => regex.test(cleanOcc))) {
        const normalizedCompound = /^self[\s-]*employed$/i.test(cleanOcc)
            ? 'Self-Employed'
            : cleanOcc;
        return {
            occupation: normalizedCompound,
            affiliation: cleanAff,
            meeting_place: cleanMeet,
            wasSplit: false,
            wasReversed: false,
        };
    }

    // Check if there is a hyphen/dash separator
    if (!/[-–—]/.test(cleanOcc)) {
        return {
            occupation: cleanOcc,
            affiliation: cleanAff,
            meeting_place: cleanMeet,
            wasSplit: false,
            wasReversed: false,
        };
    }

    // Prefer splitting on a spaced hyphen (" - ") first so compound words on either side stay intact;
    // otherwise split on the first hyphen.
    let left = '';
    let right = '';
    const spacedMatch = cleanOcc.match(/^(.+?)\s+[-–—]\s*(.+)$/) || cleanOcc.match(/^(.+?)\s*[-–—]\s+(.+)$/);
    if (spacedMatch) {
        left = spacedMatch[1].trim();
        right = spacedMatch[2].trim();
    } else {
        const firstHyphenIdx = cleanOcc.search(/[-–—]/);
        left = cleanOcc.slice(0, firstHyphenIdx).trim();
        right = cleanOcc.slice(firstHyphenIdx + 1).trim();
    }

    if (!left || !right) {
        return {
            occupation: cleanOcc.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim(),
            affiliation: cleanAff,
            meeting_place: cleanMeet,
            wasSplit: false,
            wasReversed: false,
        };
    }

    // Determine whether the entry was written in reversed order ("Affiliation - Occupation")
    const leftLooksLikeInstitution = INSTITUTION_PATTERNS.test(left) && !ROLE_PATTERNS.test(left);
    const rightLooksLikeRole = ROLE_PATTERNS.test(right) && !INSTITUTION_PATTERNS.test(right);
    const wasReversed = leftLooksLikeInstitution && rightLooksLikeRole;

    const extractedOccupation = wasReversed ? right : left;
    const extractedAffiliation = normalizeAffiliationName(wasReversed ? left : right);

    // Resolve affiliation & meeting_place without losing any existing venue data
    let finalAffiliation = cleanAff;
    let finalMeetingPlace = cleanMeet;

    if (extractedAffiliation) {
        if (!cleanAff || cleanAff.toLowerCase() === extractedAffiliation.toLowerCase()) {
            finalAffiliation = extractedAffiliation;
        } else {
            // The record had a different string in `affiliation` (e.g., a facilitator's meeting venue
            // such as "Rankoa Primary School Staff Room"). Preserve that in `meeting_place` if empty.
            if (!finalMeetingPlace) {
                finalMeetingPlace = cleanAff;
            }
            finalAffiliation = extractedAffiliation;
        }
    }

    return {
        occupation: extractedOccupation,
        affiliation: finalAffiliation,
        meeting_place: finalMeetingPlace,
        wasSplit: true,
        wasReversed,
    };
}
