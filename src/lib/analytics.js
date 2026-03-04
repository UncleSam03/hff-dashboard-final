/**
 * Centralized analytics processing for HFF Dashboard
 * Processes raw Dexie registrations into visualizable statistics
 */

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

    const participants = registrations.filter(r => r.type === 'participant' && !r.is_deleted);
    const facilitators = registrations.filter(r => r.type === 'facilitator' && !r.is_deleted);

    // Attendance
    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    const dailyStats = days.map((day, i) => {
        const count = participants.filter(p => p.attendance && p.attendance[i]).length;
        const retention = participants.length > 0 ? (count / participants.length) * 100 : 0;
        return { date: day, count, retention: parseFloat(retention.toFixed(1)) };
    });

    const uniqueAttendees = participants.filter(p => {
        if (!p.attendance) return false;
        // In the database version, attendance is often an array or object
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

    // Gender
    const gender = { 'M': 0, 'F': 0, 'OTHER': 0, 'UNKNOWN': 0 };
    participants.forEach(p => {
        const g = (p.gender || 'Unknown').toUpperCase();
        if (g.startsWith('M')) gender['M']++;
        else if (g.startsWith('F')) gender['F']++;
        else if (g === 'OTHER') gender['OTHER']++;
        else gender['UNKNOWN']++;
    });

    // Education
    const education = {};
    participants.forEach(p => {
        const e = p.education || 'Unknown';
        education[e] = (education[e] || 0) + 1;
    });

    // Marital Status
    const maritalStatus = {};
    participants.forEach(p => {
        const m = p.marital_status || 'Unknown';
        maritalStatus[m] = (maritalStatus[m] || 0) + 1;
    });

    // Age distribution buckets
    const ageBuckets = [
        { range: '18-25', min: 18, max: 25, count: 0 },
        { range: '26-35', min: 26, max: 35, count: 0 },
        { range: '36-50', min: 36, max: 50, count: 0 },
        { range: '50+', min: 51, max: 999, count: 0 },
    ];

    participants.forEach(p => {
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
    const totalBooksGiven = participants.filter(p => p.books_received === true).length;

    return {
        totalRegistrations: participants.length,
        totalFacilitators: facilitators.length,
        totalRegistered: registrations.length,
        uniqueAttendees,
        avgAttendance,
        totalBooksGiven, // New metric
        dailyStats,
        ageDistribution: ageBuckets,
        demographics: { gender, education, maritalStatus },
    };
}
