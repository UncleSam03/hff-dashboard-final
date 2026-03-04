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
import { Users, UserCheck, CalendarDays, Briefcase, Database, LayoutGrid, BarChart3, TrendingUp, Users2, LineChart } from 'lucide-react';
import { cn } from '../lib/utils';

const Dashboard = ({ analytics }) => {
    const [selectedDay, setSelectedDay] = useState('Day 1');
    const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'M', 'F'

    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    if (!analytics || analytics.totalRegistered === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="h-20 w-20 hff-gradient-bg rounded-3xl flex items-center justify-center text-white animate-bounce shadow-2xl shadow-[#71167F]/40 border-4 border-white">
                    <Database className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mt-8 uppercase tracking-widest">Waking up the data engine...</h2>
            </div>
        );
    }

    return (
        <div className="space-y-14 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">

            {/* 1. Header & Stats Section */}
            <div className="grid grid-cols-1 2xl:grid-cols-4 gap-12">
                <div className="2xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                    <StatsCard
                        title="Registered"
                        value={analytics.totalRegistrations}
                        icon={Users}
                        description="Campaign total"
                        color="purple"
                    />
                    <StatsCard
                        title="Facilitators"
                        value={analytics.totalFacilitators}
                        icon={Briefcase}
                        description="Field agents"
                        color="green"
                    />
                    <StatsCard
                        title="Attendees"
                        value={analytics.uniqueAttendees}
                        icon={Users2}
                        description="With profiles"
                        color="blue"
                    />
                    <StatsCard
                        title="Daily Avg"
                        value={analytics.avgAttendance}
                        icon={TrendingUp}
                        description="Current cycle"
                        color="amber"
                    />
                </div>
                <div className="hidden 2xl:block">
                    <NoticeBoard />
                </div>
            </div>

            {/* 2. Main Analytics Body */}
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-12">
                <div className="2xl:col-span-2 space-y-12">
                    {/* Attendance Analysis Card */}
                    <div className="glass-card p-10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                            <BarChart3 size={200} />
                        </div>
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 relative z-10">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                    <span className="p-2 hff-gradient-bg rounded-xl text-white shadow-lg shadow-[#71167F]/20"><LineChart size={24} /></span>
                                    Campaign Performance
                                </h2>
                                <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-[0.25em]">Day-by-Day Participation & Retention Trends</p>
                            </div>
                            <div className="flex items-center gap-2 p-1.5 bg-gray-50/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-inner">
                                {['all', 'M', 'F'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setGenderFilter(filter)}
                                        className={cn(
                                            "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                            genderFilter === filter
                                                ? "bg-white text-[#71167F] shadow-md shadow-gray-200 border border-gray-100 scale-105"
                                                : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                                        )}
                                    >
                                        {filter === 'all' ? 'Universal' : filter === 'M' ? 'Male' : 'Female'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chart Container */}
                        <div className="h-[450px] w-full relative z-10 transition-all">
                            <AttendanceChart data={analytics.dailyStats} compareWithRetention={true} />
                        </div>

                        {/* Day Selector */}
                        <div className="flex flex-wrap gap-2 mt-12 p-3 bg-gray-50/50 rounded-3xl border border-gray-100/50 justify-center relative z-10">
                            {days.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={cn(
                                        "px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500",
                                        selectedDay === day
                                            ? "hff-gradient-bg text-white shadow-xl shadow-[#71167F]/30 scale-110 -translate-y-1"
                                            : "bg-white text-gray-400 border border-transparent hover:border-[#71167F]/20 hover:text-[#71167F]"
                                    )}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Demographics Split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="glass-card p-10">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="h-6 w-1.5 hff-gradient-bg rounded-full shadow-sm" />
                                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Gender Split</h3>
                            </div>
                            <div className="h-[280px]">
                                <GenderChart data={analytics.demographics.gender} />
                            </div>
                        </div>
                        <div className="glass-card p-10">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="h-6 w-1.5 hff-gradient-bg rounded-full shadow-sm" />
                                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Age Groups</h3>
                            </div>
                            <div className="h-[280px]">
                                <AgeChart data={analytics.ageDistribution} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Side Insights Column */}
                <div className="space-y-12">
                    <ActionPanel />
                    <div className="2xl:hidden">
                        <NoticeBoard />
                    </div>
                </div>
            </div>

            {/* 3. Deep Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="glass-card p-12">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase mb-8">Education Spectrum</h3>
                    <div className="h-[250px]">
                        <EducationChart data={analytics.demographics.education} />
                    </div>
                </div>
                <div className="glass-card p-10">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase mb-8">Marital Status</h3>
                    <div className="h-[250px]">
                        <MaritalStatusChart data={analytics.demographics.maritalStatus} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
