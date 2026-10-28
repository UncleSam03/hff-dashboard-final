import { doc, updateDoc } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';

export const TOTAL_CAMPAIGN_FORMS = 400;
export const MAX_SAFE_FORM_NUMBER = 2000;

/**
 * Normalizes form numbers into clean positive integers (e.g. "001" -> 1, "Form 45" -> 45).
 */
export function normalizeFormNumber(val) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    const digitsOnly = str.replace(/[^0-9]/g, '');
    if (!digitsOnly) return null;
    const parsed = parseInt(digitsOnly, 10);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * Computes the campaign form status matrix, summary stats, and missing form numbers.
 * Supports 400+ forms out of the box and dynamically expands if higher form numbers are logged.
 * @param {Array} registrations All registrations for the active campaign from Dexie.
 * @param {number} [minTotalForms] Minimum total forms to audit (defaults to TOTAL_CAMPAIGN_FORMS = 400).
 * @returns {Object} Form audit report.
 */
export function compute200FormsAudit(registrations = [], minTotalForms = TOTAL_CAMPAIGN_FORMS) {
    const active = (registrations || []).filter(r => !r.is_deleted);

    // Group facilitators by form number
    const facilitatorMap = new Map();
    const facUuidToFormNum = new Map();
    // Group participants by group form number
    const participantMap = new Map();

    let maxObservedForm = minTotalForms;

    for (const r of active) {
        if (r.type === 'facilitator') {
            const num = normalizeFormNumber(r.form_number);
            if (num && num >= 1 && num <= MAX_SAFE_FORM_NUMBER) {
                if (num > maxObservedForm) maxObservedForm = num;
                if (r.uuid) {
                    facUuidToFormNum.set(r.uuid, num);
                }
                // If multiple facilitators share a form, keep first or list them
                if (!facilitatorMap.has(num)) {
                    facilitatorMap.set(num, r);
                }
            }
        }
    }

    for (const r of active) {
        if (r.type === 'participant') {
            const directNum = normalizeFormNumber(r.group_form_number || r.form_number);
            const inheritedNum = r.facilitator_uuid ? facUuidToFormNum.get(r.facilitator_uuid) : null;
            const num = directNum || inheritedNum;
            if (num && num >= 1 && num <= MAX_SAFE_FORM_NUMBER) {
                if (num > maxObservedForm) maxObservedForm = num;
                if (!participantMap.has(num)) {
                    participantMap.set(num, []);
                }
                participantMap.get(num).push(r);
            }
        }
    }

    const effectiveTotalForms = Math.max(minTotalForms, maxObservedForm);

    const formMatrix = [];
    const missingFormNumbers = [];
    let completedFormsCount = 0;
    let inProgressFormsCount = 0;
    let totalParticipantsCaptured = 0;

    for (let f = 1; f <= effectiveTotalForms; f++) {
        const fac = facilitatorMap.get(f) || null;
        const parts = participantMap.get(f) || [];
        const partCount = parts.length;
        totalParticipantsCaptured += partCount;

        let status = 'missing'; // 'completed' | 'in_progress' | 'missing'
        if (fac && partCount > 0) {
            status = 'completed';
            completedFormsCount++;
        } else if (fac && partCount === 0) {
            status = 'in_progress'; // Facilitator registered on Day 1, awaiting participants
            inProgressFormsCount++;
        } else if (!fac && partCount > 0) {
            status = 'in_progress'; // Participants entered, awaiting facilitator link
            inProgressFormsCount++;
        } else {
            status = 'missing';
            missingFormNumbers.push(f);
        }

        // Attendance stats for sprints
        let d1_d4_count = 0;
        let d5_d9_count = 0;
        let d10_d12_count = 0;

        for (const p of parts) {
            const att = Array.isArray(p.attendance) ? p.attendance : [];
            if (att.slice(0, 4).some(Boolean)) d1_d4_count++;
            if (att.slice(4, 9).some(Boolean)) d5_d9_count++;
            if (att.slice(9, 12).some(Boolean)) d10_d12_count++;
        }

        formMatrix.push({
            formNumber: f,
            facilitator: fac,
            participants: parts,
            participantsCount: partCount,
            status,
            d1_d4_count,
            d5_d9_count,
            d10_d12_count
        });
    }

    return {
        totalForms: effectiveTotalForms,
        completedFormsCount,
        inProgressFormsCount,
        missingFormsCount: missingFormNumbers.length,
        missingFormNumbers,
        completionPercentage: effectiveTotalForms > 0 ? Math.round((completedFormsCount / effectiveTotalForms) * 100) : 0,
        totalParticipantsCaptured,
        formMatrix
    };
}

/**
 * Calculates progress for an assigned form range (e.g. Forms 1 to 50).
 */
export function getAdminRangeProgress(formMatrix = [], rangeStart = 1, rangeEnd = 50) {
    const maxBound = Math.max(TOTAL_CAMPAIGN_FORMS, formMatrix.length || TOTAL_CAMPAIGN_FORMS);
    const start = Math.max(1, Math.min(rangeStart, maxBound));
    const end = Math.max(start, Math.min(rangeEnd, maxBound));
    const totalInRange = end - start + 1;

    let completedInRange = 0;
    let inProgressInRange = 0;
    let missingInRange = 0;
    let participantsInRange = 0;
    const forms = [];

    for (let f = start; f <= end; f++) {
        const item = formMatrix[f - 1] || {
            formNumber: f,
            status: 'missing',
            participantsCount: 0
        };
        forms.push(item);
        if (item.status === 'completed') completedInRange++;
        else if (item.status === 'in_progress') inProgressInRange++;
        else missingInRange++;

        participantsInRange += item.participantsCount || 0;
    }

    return {
        rangeStart: start,
        rangeEnd: end,
        totalInRange,
        completedInRange,
        inProgressInRange,
        missingInRange,
        participantsInRange,
        percentage: totalInRange > 0 ? Math.round((completedInRange / totalInRange) * 100) : 0,
        forms
    };
}

/**
 * Updates an admin's form number range in Firestore profiles.
 */
export async function setAdminFormRange(adminId, rangeStart, rangeEnd) {
    if (!adminId) throw new Error('adminId is required');
    const start = Math.max(1, parseInt(rangeStart, 10) || 1);
    const end = Math.max(start, parseInt(rangeEnd, 10) || start);

    if (isConfigured && firestoreDb) {
        const profileRef = doc(firestoreDb, 'profiles', adminId);
        await updateDoc(profileRef, {
            form_range_start: start,
            form_range_end: end,
            range_updated_at: new Date().toISOString()
        });
    }

    // Trigger local event so UI components can update immediately
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hff-admin-range-updated', {
            detail: { adminId, form_range_start: start, form_range_end: end }
        }));
    }

    return { form_range_start: start, form_range_end: end };
}
