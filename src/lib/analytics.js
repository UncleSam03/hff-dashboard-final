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
        const count = activePeople.filter(p => p.attendance && isPresentOnDay(p.attendance, i)).length;
        const retention = activePeople.length > 0 ? (count / activePeople.length) * 100 : 0;
        return { date: day, count, retention: parseFloat(retention.toFixed(1)) };
    });

    const uniqueAttendees = activePeople.filter(p => {
        if (!p.attendance) return false;
        if (Array.isArray(p.attendance)) {
            return p.attendance.some(v => v === true);
        }
        return Object.values(p.attendance).some(v => v === true);
    }).length;

    const activeDays = dailyStats.filter(d => d.count > 0);
    const totalAttendanceCount = dailyStats.reduce((sum, d) => sum + d.count, 0);
    const avgAttendance = activeDays.length > 0
        ? (totalAttendanceCount / activeDays.length).toFixed(1)
        : 0;

    // Demographics based on ALL active people
    const gender = { 'M': 0, 'F': 0, 'OTHER': 0, 'UNKNOWN': 0 };
    activePeople.forEach(p => {
        const g = (p.gender || 'Unknown').toUpperCase();
        if (g.startsWith('M')) gender['M']++;
        else if (g.startsWith('F')) gender['F']++;
        else if (g === 'OTHER') gender['OTHER']++;
        else gender['UNKNOWN']++;
    });

    const education = {};
    activePeople.forEach(p => {
        const e = p.education || 'Unknown';
        education[e] = (education[e] || 0) + 1;
    });

    const maritalStatus = {};
    activePeople.forEach(p => {
        const m = p.marital_status || 'Unknown';
        maritalStatus[m] = (maritalStatus[m] || 0) + 1;
    });

    const ageBuckets = [
        { range: '18-25', min: 18, max: 25, count: 0 },
        { range: '26-35', min: 26, max: 35, count: 0 },
        { range: '36-50', min: 36, max: 50, count: 0 },
        { range: '50+', min: 51, max: 999, count: 0 },
    ];

    activePeople.forEach(p => {
        const age = parseInt(p.age);
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
        uniqueAttendees,
        avgAttendance,
        totalBooksGiven,
        dailyStats,
        ageDistribution: ageBuckets,
        demographics: { gender, education, maritalStatus },
    };
}
