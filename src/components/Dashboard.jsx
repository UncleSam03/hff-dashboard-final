import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexieDb';
import StatsCard from './StatsCard';
import AttendanceChart from './AttendanceChart';
import AgeChart from './AgeChart';
import { GenderChart, EducationChart, MaritalStatusChart } from './DemographicsCharts';
import { Users, UserCheck, CalendarDays, Briefcase, AlertCircle, Database } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Analytics processing from Dexie data ──
function processAnalytics(registrations) {
    if (!registrations || registrations.length === 0) {
        return {
            totalParticipants: 0,
            totalFacilitators: 0,
            totalRegistered: 0,
            uniqueAttendees: 0,
            avgAttendance: 0,
            dailyStats: [],
            ageDistribution: [],
            demographics: { gender: {}, education: {}, maritalStatus: {} },
        };
    }

    const participants = registrations.filter(r => r.type === 'participant');
    const facilitators = registrations.filter(r => r.type === 'facilitator');

    // Attendance
    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    const dailyStats = days.map(day => {
        const count = participants.filter(p => p.attendance && p.attendance[day]).length;
        return { date: day, count };
    });

    const uniqueAttendees = participants.filter(p => {
        if (!p.attendance) return false;
        return Object.values(p.attendance).some(v => v === true);
    }).length;

    const activeDays = dailyStats.filter(d => d.count > 0);
    const totalAttendanceCount = dailyStats.reduce((sum, d) => sum + d.count, 0);
    const avgAttendance = activeDays.length > 0
        ? (totalAttendanceCount / activeDays.length).toFixed(1)
        : 0;

    // Gender
    const gender = {};
    participants.forEach(p => {
        const g = (p.gender || 'Unknown').toUpperCase();
        gender[g] = (gender[g] || 0) + 1;
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
        { range: '<18', min: 0, max: 17, count: 0 },
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

    return {
        totalParticipants: participants.length,
        totalFacilitators: facilitators.length,
        totalRegistered: registrations.length,
        uniqueAttendees,
        avgAttendance,
        dailyStats,
        ageDistribution: ageBuckets.map(b => ({ range: b.range, count: b.count })),
        demographics: { gender, education, maritalStatus },
    };
}

const Dashboard = ({ mode = 'general', onBack }) => {
    const [selectedDay, setSelectedDay] = useState(null);

    // Live query from Dexie — updates automatically when Dexie data changes
    const registrations = useLiveQuery(() => db.registrations.toArray(), []);

    const analytics = useMemo(() => {
        return processAnalytics(registrations);
    }, [registrations]);

    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    // Participants subset for day-by-day drill-down
    const participants = useMemo(() => {
        if (!registrations) return [];
        return registrations.filter(r => r.type === 'participant');
    }, [registrations]);

    // Loading state
    if (registrations === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
                <div className="text-center max-w-lg">
                    <div className="h-16 w-16 bg-hff-primary/10 rounded-2xl flex items-center justify-center text-hff-primary mx-auto mb-6 animate-pulse">
                        <Database className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-3">Loading Dashboard...</h2>
                    <p className="text-gray-500">Reading local data from your device.</p>
                </div>
            </div>
        );
    }

    // Empty state
    if (!registrations || registrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
                <div className="text-center max-w-lg">
                    <div className="h-16 w-16 bg-hff-primary/10 rounded-2xl flex items-center justify-center text-hff-primary mx-auto mb-6">
                        <Users className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-3">No Data Yet</h2>
                    <p className="text-gray-500 mb-6">
                        Start by registering participants and facilitators in the <strong>Offline Collect</strong> section.
                        Data will appear here automatically once records are saved.
                    </p>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="px-6 py-3 bg-hff-primary text-white rounded-lg font-semibold hover:bg-hff-primary/90 transition-colors"
                        >
                            Go to Home
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Campaign Dashboard</h1>
                    <p className="text-gray-500 mt-1">Real-time overview from local & synced data</p>
                </div>
                <div className="flex items-center gap-2 bg-hff-primary/10 text-hff-primary px-3 py-1.5 rounded-full text-sm font-semibold">
                    <Database className="h-4 w-4" />
                    {analytics.totalRegistered} Records
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Registered"
                    value={analytics.totalRegistered}
                    icon={Users}
                    description="All records in database"
                />
                <StatsCard
                    title="Participants"
                    value={analytics.totalParticipants}
                    icon={UserCheck}
                    description="Registered participants"
                    className="border-l-4 border-l-hff-primary"
                />
                <StatsCard
                    title="Facilitators"
                    value={analytics.totalFacilitators}
                    icon={Briefcase}
                    description="Registered facilitators"
                    className="border-l-4 border-l-green-500"
                />
                <StatsCard
                    title="Avg Daily Attendance"
                    value={analytics.avgAttendance}
                    icon={CalendarDays}
                    description="Per active session"
                />
            </div>

            {/* Day-by-Day Analysis Section */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Day-by-Day Analysis</h2>
                        <p className="text-gray-500">Analyze campaign attendance for specific days across the 12-day cycle.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 max-w-md">
                        {days.map((day, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                    selectedDay === day
                                        ? "bg-hff-primary text-white border-hff-primary shadow-md shadow-hff-primary/20"
                                        : "bg-gray-50 text-gray-600 border-gray-100 hover:border-hff-primary/30"
                                )}
                            >
                                Day {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedDay ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Attendance on {selectedDay}</span>
                            <span className="text-4xl font-black text-hff-primary">
                                {participants.filter(p => p.attendance && p.attendance[selectedDay]).length}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Males</span>
                            <span className="text-3xl font-bold text-blue-600">
                                {participants.filter(p => p.attendance && p.attendance[selectedDay] && p.gender === 'M').length}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Females</span>
                            <span className="text-3xl font-bold text-pink-500">
                                {participants.filter(p => p.attendance && p.attendance[selectedDay] && p.gender === 'F').length}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center justify-center">
                            <div className="text-center">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Retention</span>
                                <span className="text-xl font-bold text-gray-700">
                                    {analytics.totalParticipants > 0
                                        ? Math.round((participants.filter(p => p.attendance && p.attendance[selectedDay]).length / analytics.totalParticipants) * 100)
                                        : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">Select a day from the list above to view specific analysis</p>
                    </div>
                )}
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AttendanceChart data={analytics.dailyStats} />

                <div className="lg:col-span-1 space-y-6">
                    <GenderChart data={analytics.demographics.gender} />
                </div>
            </div>

            {/* Age & Demographics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AgeChart data={analytics.ageDistribution} />
                <EducationChart data={analytics.demographics.education} />
                <MaritalStatusChart data={analytics.demographics.maritalStatus} />
            </div>

        </div>
    );
};

export default Dashboard;
