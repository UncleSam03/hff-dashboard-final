import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexieDb';
import StatsCard from './StatsCard';
import AttendanceChart from './AttendanceChart';
import AgeChart from './AgeChart';
import { GenderChart, EducationChart, MaritalStatusChart } from './DemographicsCharts';
import CampaignLaunchpad from './CampaignLaunchpad';
import ActionPanel from './ActionPanel';
import NoticeBoard from './NoticeBoard';
import { Users, UserCheck, CalendarDays, Briefcase, Database, LayoutGrid, BarChart3, TrendingUp, Users2 } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Analytics processing from Dexie data ──
function processAnalytics(registrations) {
    if (!registrations || registrations.length === 0) {
        return {
            totalRegistrations: 0,
            totalFacilitators: 0,
            totalRegistered: 0,
            uniqueAttendees: 0,
            avgAttendance: 0,
            dailyStats: [],
            ageDistribution: [],
            demographics: { gender: {}, education: {}, maritalStatus: {} },
        };
    }

    const participants = registrations.filter(r => r.type === 'participant' && !r.is_deleted);
    const facilitators = registrations.filter(r => r.type === 'facilitator' && !r.is_deleted);

    // Attendance
    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    const dailyStats = days.map(day => {
        const count = participants.filter(p => p.attendance && p.attendance[day]).length;
        // Retention rate simulation for the line graph
        const retention = participants.length > 0 ? (count / participants.length) * 100 : 0;
        return { date: day, count, retention: parseFloat(retention.toFixed(1)) };
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
        totalRegistrations: participants.length,
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
    const [selectedDay, setSelectedDay] = useState('Day 1');
    const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'M', 'F'

    // Live query from Dexie
    const registrations = useLiveQuery(() => db.registrations.toArray(), []);

    const analytics = useMemo(() => {
        return processAnalytics(registrations);
    }, [registrations]);

    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    const filteredParticipants = useMemo(() => {
        if (!registrations) return [];
        let data = registrations.filter(r => r.type === 'participant' && !r.is_deleted);
        if (genderFilter !== 'all') {
            data = data.filter(p => p.gender === genderFilter);
        }
        return data;
    }, [registrations, genderFilter]);

    if (registrations === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="h-16 w-16 hff-gradient-bg rounded-2xl flex items-center justify-center text-white animate-bounce shadow-2xl shadow-hff-primary/40">
                    <Database className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mt-8">Initializing Hyper-Data...</h2>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            
            {/* 1. Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Registered Participants"
                    value={analytics.totalRegistrations}
                    icon={Users}
                    description="Total people recorded"
                    trend="+12% Since yesterday"
                    color="purple"
                />
                <StatsCard
                    title="Facilitators"
                    value={analytics.totalFacilitators}
                    icon={Briefcase}
                    description="Verified field agents"
                    color="green"
                />
                <StatsCard
                    title="Unique Individuals"
                    value={analytics.uniqueAttendees}
                    icon={Users2}
                    description="Attendees with profiles"
                    color="blue"
                />
                <StatsCard
                    title="Avg Daily Attendance"
                    value={analytics.avgAttendance}
                    icon={TrendingUp}
                    description="Current campaign avg"
                    color="amber"
                />
            </div>

            {/* 2. Campaign Launchpad */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-8 hff-gradient-bg rounded-full" />
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight text-[#71167F]">Campaign Launchpad</h2>
                </div>
                <CampaignLaunchpad />
            </div>

            {/* 3. Analytics Section: Day-by-Day Drill-down */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    <div className="glass-card p-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Day-by-Day Analysis</h2>
                                <p className="text-gray-400 font-bold mt-1 uppercase text-xs tracking-[0.2em]">Campaign Lifecycle Insights (Day 1-12)</p>
                            </div>
                            <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                                <button 
                                    onClick={() => setGenderFilter('all')}
                                    className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", genderFilter === 'all' ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600")}
                                >All</button>
                                <button 
                                    onClick={() => setGenderFilter('M')}
                                    className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", genderFilter === 'M' ? "bg-white text-blue-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600")}
                                >Male</button>
                                <button 
                                    onClick={() => setGenderFilter('F')}
                                    className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", genderFilter === 'F' ? "bg-white text-pink-500 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600")}
                                >Female</button>
                            </div>
                        </div>

                        {/* Line graph for Day-by-Day Comparison */}
                        <div className="h-[400px] w-full">
                            <AttendanceChart data={analytics.dailyStats} compareWithRetention={true} />
                        </div>

                        <div className="flex flex-wrap gap-2 mt-10 p-2 bg-gray-50/50 rounded-2xl border border-gray-100 justify-center">
                            {days.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        selectedDay === day
                                            ? "hff-gradient-bg text-white shadow-lg shadow-hff-primary/20 scale-105"
                                            : "bg-white text-gray-400 border border-gray-100 hover:border-hff-primary/30"
                                    )}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Age Distribution Panel */}
                    <div className="glass-card p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-8 w-1 hff-gradient-bg rounded-full" />
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Age Distribution</h2>
                        </div>
                        <div className="h-[300px]">
                            <AgeChart data={analytics.ageDistribution} />
                        </div>
                    </div>
                </div>

                {/* Side Panel: AI Insights & notices */}
                <div className="space-y-8">
                    <ActionPanel />
                    <NoticeBoard />
                </div>
            </div>

            {/* 4. Demographic Row */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-8 hff-gradient-bg rounded-full" />
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Participant Demographics</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="glass-card p-8">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Gender Breakdown</h3>
                        <GenderChart data={analytics.demographics.gender} />
                    </div>
                    <div className="glass-card p-8">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Education Levels</h3>
                        <EducationChart data={analytics.demographics.education} />
                    </div>
                    <div className="glass-card p-8">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Marital Status</h3>
                        <MaritalStatusChart data={analytics.demographics.maritalStatus} />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
