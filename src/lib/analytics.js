/**
 * Centralized analytics processing for HFF Dashboard
 * Processes raw Dexie registrations into visualizable statistics
 */
import { TOTAL_CAMPAIGN_DAYS } from './constants.js';

export function normalizeAttendance(attendance) {
    if (!attendance) return Array(TOTAL_CAMPAIGN_DAYS).fill(false);
    if (Array.isArray(attendance)) return attendance.map(Boolean);
    if (typeof attendance === 'string') {
        const trimmed = attendance.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(Boolean);
            } catch {
                // ignore parse failure
            }
        }
    }
    if (typeof attendance === 'object') return attendance;
    return Array(TOTAL_CAMPAIGN_DAYS).fill(false);
}

export function parseBool(val, defaultVal = false) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'boolean') return val;
    const s = String(val).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === '✓') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
    return defaultVal;
}

export function processAnalytics(registrations) {
    if (!registrations || registrations.length === 0) {
        return {
            totalRegistrations: 0,
            totalFacilitators: 0,
            totalRegistered: 0,
            uniqueParticipants: 0,
            uniqueFacilitators: 0,
            uniqueAttendees: 0,
            qualifyingParticipantsList: [],
            qualifyingFacilitatorsList: [],
            qualifyingParticipants: 0,
            qualifyingFacilitators: 0,
            totalQualifyingCertificates: 0,
            avgAttendance: 0,
            totalBooksGiven: 0,
            dailyStats: [],
            dailyStatsByGender: { all: [], M: [], F: [] },
            ageDistribution: [],
            demographics: {
                gender: { 'M': 0, 'F': 0, 'OTHER': 0, 'UNKNOWN': 0 },
                education: {},
                maritalStatus: {}
            },
        };
    }

    // Filtering: Default any record without a specific 'facilitator' type to 'participant' if it's not deleted
    const activePeople = registrations.filter(r => !parseBool(r.is_deleted));
    const facilitators = activePeople.filter(r => (r.type || '').toLowerCase() === 'facilitator');
    const participants = activePeople.filter(r => (r.type || '').toLowerCase() !== 'facilitator');

    console.log("[Analytics] Processing Summary:", {
        total: registrations.length,
        active: activePeople.length,
        participants: participants.length,
        facilitators: facilitators.length,
        rawTypes: [...new Set(registrations.map(r => r.type))]
    });

    // Attendance Helper: Normalize both array [true, false] and object {D1: true} formats
    const isPresentOnDay = (rawAttendance, dayIndex) => {
        const attendance = normalizeAttendance(rawAttendance);
        if (Array.isArray(attendance)) return !!attendance[dayIndex];
        return !!attendance[`D${dayIndex + 1}`];
    };

    const days = Array.from({ length: TOTAL_CAMPAIGN_DAYS }, (_, i) => `Day ${i + 1}`);

    const normalizeGender = (p) => {
        const raw = (p.gender || p.Gender || p.GENDER || '').toString().toUpperCase().trim();
        if (raw.startsWith('M') || raw === 'MALE') return 'M';
        if (raw.startsWith('F') || raw === 'FEMALE') return 'F';
        if (raw === 'OTHER') return 'OTHER';
        return 'UNKNOWN';
    };

    const computeCohortDailyStats = (cohortPeople) => {
        const cohortFacilitators = cohortPeople.filter(r => (r.type || '').toLowerCase() === 'facilitator');
        const cohortParticipants = cohortPeople.filter(r => (r.type || '').toLowerCase() !== 'facilitator');

        return days.map((day, i) => {
            const participantCount = cohortParticipants.filter(p => p.attendance && isPresentOnDay(p.attendance, i)).length;
            const facilitatorCount = cohortFacilitators.filter(f => f.attendance && isPresentOnDay(f.attendance, i)).length;
            const totalCount = participantCount + facilitatorCount;
            const retention = cohortPeople.length > 0 ? (totalCount / cohortPeople.length) * 100 : 0;
            
            return { 
                date: day, 
                count: totalCount, 
                participants: participantCount, 
                facilitators: facilitatorCount,
                retention: parseFloat(retention.toFixed(1)) 
            };
        });
    };

    // stats based on ALL active people (Facilitators + Participants)
    const dailyStats = computeCohortDailyStats(activePeople);
    const dailyStatsMale = computeCohortDailyStats(activePeople.filter(p => normalizeGender(p) === 'M'));
    const dailyStatsFemale = computeCohortDailyStats(activePeople.filter(p => normalizeGender(p) === 'F'));

    const dailyStatsByGender = {
        all: dailyStats,
        M: dailyStatsMale,
        F: dailyStatsFemale
    };

    const uniqueParticipants = participants.filter(p => {
        if (!p.attendance) return false;
        const att = normalizeAttendance(p.attendance);
        if (Array.isArray(att)) {
            return att.some(v => v === true);
        }
        return Object.values(att).some(v => v === true);
    }).length;

    const uniqueFacilitators = facilitators.filter(p => {
        if (!p.attendance) return false;
        const att = normalizeAttendance(p.attendance);
        if (Array.isArray(att)) {
            return att.some(v => v === true);
        }
        return Object.values(att).some(v => v === true);
    }).length;

    const getDaysAttended = (rawAttendance) => {
        if (!rawAttendance) return 0;
        const attendance = normalizeAttendance(rawAttendance);
        if (Array.isArray(attendance)) {
            return attendance.filter(v => v === true).length;
        }
        return Object.values(attendance).filter(v => v === true).length;
    };

    const sortByName = (list) => {
        return [...list].sort((a, b) => {
            const lastA = (a.last_name || '').toLowerCase().trim();
            const lastB = (b.last_name || '').toLowerCase().trim();
            if (lastA < lastB) return -1;
            if (lastA > lastB) return 1;
            
            const firstA = (a.first_name || '').toLowerCase().trim();
            const firstB = (b.first_name || '').toLowerCase().trim();
            if (firstA < firstB) return -1;
            if (firstA > firstB) return 1;
            
            return 0;
        });
    };

    const qualifyingParticipantsList = sortByName(participants.filter(p => getDaysAttended(p.attendance) >= 6));
    const qualifyingFacilitatorsList = sortByName(facilitators.filter(f => getDaysAttended(f.attendance) >= 8));
    
    const qualifyingParticipants = qualifyingParticipantsList.length;
    const qualifyingFacilitators = qualifyingFacilitatorsList.length;
    const totalQualifyingCertificates = qualifyingParticipants + qualifyingFacilitators;

    const activeDays = dailyStats.filter(d => d.count > 0);
    const totalAttendanceCount = dailyStats.reduce((sum, d) => sum + d.count, 0);
    const avgAttendance = activeDays.length > 0
        ? (totalAttendanceCount / activeDays.length).toFixed(1)
        : 0;

    // Demographics based on ALL active people
    const gender = { 'M': 0, 'F': 0, 'OTHER': 0, 'UNKNOWN': 0 };
    activePeople.forEach(p => {
        // Try all casing variants
        const rawGender = p.gender || p.Gender || p.GENDER;
        const g = (rawGender || 'Unknown').toString().toUpperCase().trim();
        
        if (g.startsWith('M') || g === 'MALE') gender['M']++;
        else if (g.startsWith('F') || g === 'FEMALE') gender['F']++;
        else if (g === 'OTHER') gender['OTHER']++;
        else gender['UNKNOWN']++;
    });

    const education = {};
    activePeople.forEach(p => {
        const e = p.education || p.Education || 'Unknown';
        education[e] = (education[e] || 0) + 1;
    });

    const maritalStatus = {};
    activePeople.forEach(p => {
        const m = p.marital_status || p.maritalStatus || p['Marital Status'] || 'Unknown';
        maritalStatus[m] = (maritalStatus[m] || 0) + 1;
    });

    const ageBuckets = [
        { range: '18-25', min: 18, max: 25, count: 0 },
        { range: '26-35', min: 26, max: 35, count: 0 },
        { range: '36-50', min: 36, max: 50, count: 0 },
        { range: '50+', min: 51, max: 999, count: 0 },
    ];

    activePeople.forEach(p => {
        const rawAge = p.age || p.Age || p.AGE;
        const age = parseInt(rawAge);
        if (isNaN(age)) return;
        for (const bucket of ageBuckets) {
            if (age >= bucket.min && age <= bucket.max) {
                bucket.count++;
                break;
            }
        }
    });

    // Book distribution
    const participantBooks = participants.filter(p => parseBool(p.books_received)).length;
    const facilitatorBooks = facilitators.reduce((sum, f) => sum + (parseInt(f.books_distributed, 10) || 0), 0);
    const totalBooksGiven = participantBooks + facilitatorBooks;

    return {
        totalRegistrations: participants.length,
        totalFacilitators: facilitators.length,
        totalRegistered: participants.length + facilitators.length,
        uniqueParticipants,
        uniqueFacilitators,
        uniqueAttendees: uniqueParticipants + uniqueFacilitators,
        qualifyingParticipantsList,
        qualifyingFacilitatorsList,
        qualifyingParticipants,
        qualifyingFacilitators,
        totalQualifyingCertificates,
        avgAttendance,
        totalBooksGiven,
        dailyStats,
        dailyStatsByGender,
        ageDistribution: ageBuckets,
        demographics: { gender, education, maritalStatus },
    };
}
