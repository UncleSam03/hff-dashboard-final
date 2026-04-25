/**
 * Centralized analytics processing for HFF Dashboard
 * Processes raw Dexie registrations into visualizable statistics
 */
import { TOTAL_CAMPAIGN_DAYS } from './constants.js';

export function processAnalytics(registrations) {
    if (!registrations || registrations.length === 0) {
        return {
            totalRegistrations: 0,
            totalFacilitators: 0,
            totalRegistered: 0,
            uniqueAttendees: 0,
            avgAttendance: 0,
            dailyStats: [],
            ageDistribution: [],
            demographics: {
                gender: { 'M': 0, 'F': 0, 'OTHER': 0, 'UNKNOWN': 0 },
                education: {},
                maritalStatus: {}
            },
        };
    }

    // Filtering: Default any record without a specific 'facilitator' type to 'participant' if it's not deleted
    const activePeople = registrations.filter(r => !r.is_deleted);
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
    const isPresentOnDay = (attendance, dayIndex) => {
        if (!attendance) return false;
        if (Array.isArray(attendance)) return !!attendance[dayIndex];
        return !!attendance[`D${dayIndex + 1}`];
    };

    const days = Array.from({ length: TOTAL_CAMPAIGN_DAYS }, (_, i) => `Day ${i + 1}`);

    // stats based on ALL active people (Facilitators + Participants)
    const dailyStats = days.map((day, i) => {
        const participantCount = participants.filter(p => p.attendance && isPresentOnDay(p.attendance, i)).length;
        const facilitatorCount = facilitators.filter(f => f.attendance && isPresentOnDay(f.attendance, i)).length;
        const totalCount = participantCount + facilitatorCount;
        const retention = activePeople.length > 0 ? (totalCount / activePeople.length) * 100 : 0;
        
        return { 
            date: day, 
            count: totalCount, 
            participants: participantCount, 
            facilitators: facilitatorCount,
            retention: parseFloat(retention.toFixed(1)) 
        };
    });

    const uniqueParticipants = participants.filter(p => {
        if (!p.attendance) return false;
        if (Array.isArray(p.attendance)) {
            return p.attendance.some(v => v === true);
        }
        return Object.values(p.attendance).some(v => v === true);
    }).length;

    const uniqueFacilitators = facilitators.filter(p => {
        if (!p.attendance) return false;
        if (Array.isArray(p.attendance)) {
            return p.attendance.some(v => v === true);
        }
        return Object.values(p.attendance).some(v => v === true);
    }).length;

    const getDaysAttended = (attendance) => {
        if (!attendance) return 0;
        if (Array.isArray(attendance)) {
            return attendance.filter(v => v === true).length;
        }
        return Object.values(attendance).filter(v => v === true).length;
    };

    const qualifyingParticipantsList = participants.filter(p => getDaysAttended(p.attendance) >= 8);
    const qualifyingFacilitatorsList = facilitators.filter(f => getDaysAttended(f.attendance) >= 8);
    
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
    const participantBooks = participants.filter(p => p.books_received === true).length;
    const facilitatorBooks = facilitators.reduce((sum, f) => sum + (Number(f.books_distributed) || 0), 0);
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
        ageDistribution: ageBuckets,
        demographics: { gender, education, maritalStatus },
    };
}
