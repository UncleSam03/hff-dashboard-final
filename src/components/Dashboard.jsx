import React, { useState, useEffect } from 'react';
import { pullFromFirebase } from '../lib/firebaseSync';
import { reconcileWithCloud } from '../lib/syncManager';
import { exportExecutiveSummary } from '../lib/reportExporter';
import StatsCard from './StatsCard';
import AttendanceChart from './AttendanceChart';
import AgeChart from './AgeChart';
import { GenderChart, EducationChart, MaritalStatusChart } from './DemographicsCharts';
import ActionPanel from './ActionPanel';
import NoticeBoard from './NoticeBoard';
import { Users, UserCheck, Database, BarChart3, Users2, LineChart, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { TOTAL_CAMPAIGN_DAYS } from '../lib/constants';

const Dashboard = ({ analytics, onNavigate }) => {
    const [selectedDay, setSelectedDay] = useState('Day 1');
    const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'M', 'F'
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState('');

    const days = Array.from({ length: TOTAL_CAMPAIGN_DAYS }, (_, i) => `Day ${i + 1}`);

    // Automatically pull fresh data whenever dashboard is viewed
    useEffect(() => {
        pullFromFirebase().catch(e => console.warn('Silent auto-pull failed:', e));
    }, []);

    const handleManualSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await reconcileWithCloud();
            setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error('Manual sync failed:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDownloadSummary = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            await exportExecutiveSummary(analytics);
        } catch (e) {
            console.error('Download summary failed:', e);
        } finally {
            setIsDownloading(false);
        }
    };

    const activeDailyStats = analytics?.dailyStatsByGender?.[genderFilter] || analytics?.dailyStats || [];
    const selectedDayStats = activeDailyStats.find(d => d.date === selectedDay) || { participants: 0, facilitators: 0, count: 0 };


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
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">

            {/* Zero Records Empty State Banner - Liquid Glass */}
            {analytics.totalRegistered === 0 && (
                <div className="liquid-glass-elevated p-6 lg:p-7 rounded-[2.5rem] border border-white/80 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group backdrop-blur-2xl">
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#71167F]/10 rounded-full blur-3xl group-hover:bg-[#71167F]/15 transition-colors pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-[#71167F]/10 text-[#71167F] border border-[#71167F]/20 flex items-center justify-center shrink-0 shadow-sm">
                            <Database size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-gray-900 tracking-tight">Campaign Database Initialized</h3>
                            <p className="text-xs text-gray-500 font-medium max-w-2xl leading-relaxed mt-0.5">No registrations logged yet. Demographic charts, attendance tracking, and impact metrics will automatically populate as facilitators and participants are registered or synced.</p>
                        </div>
                    </div>
                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('hub')}
                            className="px-6 py-2.5 rounded-2xl liquid-glass-active text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-[#71167F]/25 hover:scale-[1.02] active:scale-[0.98] shrink-0 border border-white/40 relative z-10"
                        >
                            Open Campaign Hub
                        </button>
                    )}
                </div>
            )}

            {/* 1. Header & Stats Section */}
            <div className="grid grid-cols-1 2xl:grid-cols-4 gap-12">
                <div className="2xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatsCard
                        title="Total Impact"
                        value={analytics.totalRegistered}
                        icon={Users}
                        description="All registrations"
                        color="purple"
                        onClick={() => onNavigate?.('hub')}
                    />
                    <StatsCard
                        title="Participants"
                        value={analytics.uniqueParticipants}
                        icon={Users2}
                        description="Unique attendees"
                        color="blue"
                        onClick={() => onNavigate?.('hub')}
                    />
                    <StatsCard
                        title="Facilitators"
                        value={analytics.uniqueFacilitators}
                        icon={UserCheck}
                        description="Active support"
                        color="amber"
                        onClick={() => onNavigate?.('hub')}
                    />
                    <StatsCard
                        title="Books Given"
                        value={analytics.totalBooksGiven}
                        icon={Check}
                        description="Resources shared"
                        color="emerald"
                        onClick={() => onNavigate?.('hub')}
                    />
                </div>
                <div className="hidden 2xl:block">
                    <NoticeBoard variant="widget" onNavigate={onNavigate} />
                </div>
            </div>

            {/* 2. Main Analytics Body */}
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-12">
                <div className="2xl:col-span-2 space-y-12">
                    {/* Attendance Analysis Card - Liquid Glass */}
                    <div className="liquid-glass-elevated p-8 lg:p-10 rounded-[2.5rem] border border-white/80 shadow-2xl relative overflow-hidden group backdrop-blur-2xl">
                        {/* Specular top rim */}
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                        <div className="absolute -top-24 -right-24 w-60 h-60 bg-gradient-to-br from-[#71167F]/8 via-[#3EB049]/8 to-transparent blur-3xl opacity-50 group-hover:opacity-80 transition-opacity pointer-events-none" />
                        
                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity pointer-events-none">
                            <BarChart3 size={200} />
                        </div>
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 relative z-10">
                            <div>
                                <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                                    <span className="w-11 h-11 rounded-2xl bg-[#71167F]/10 text-[#71167F] border border-[#71167F]/20 flex items-center justify-center shadow-sm"><LineChart size={22} /></span>
                                    Campaign Performance
                                </h2>
                                <p className="text-gray-400 font-semibold mt-2 uppercase text-[10px] tracking-[0.2em]">
                                    {genderFilter === 'all' 
                                        ? 'Day-by-Day Participation & Retention Trends' 
                                        : genderFilter === 'M' 
                                            ? 'Day-by-Day Participation Trends (Male Cohort)' 
                                            : 'Day-by-Day Participation Trends (Female Cohort)'}
                                </p>
                            </div>
                            
                            {/* Selected Day Stats Highlight */}
                            <div className="flex liquid-glass-pill p-2 px-5 rounded-2xl items-center gap-6 shadow-sm border border-white/80 backdrop-blur-xl">
                                <div className="text-center py-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{selectedDay}</p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-extrabold text-[#71167F]">{selectedDayStats?.participants || 0}</span>
                                            <span className="text-[9px] font-semibold text-gray-400 uppercase">Participants</span>
                                        </div>
                                        <div className="w-[1px] h-6 bg-white/80" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-extrabold text-[#F59E0B]">{selectedDayStats?.facilitators || 0}</span>
                                            <span className="text-[9px] font-semibold text-gray-400 uppercase">Facilitators</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 p-1.5 liquid-glass-pill rounded-full border border-white/80 shadow-sm backdrop-blur-xl">
                                {['all', 'M', 'F'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setGenderFilter(filter)}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                                            genderFilter === filter
                                                ? "liquid-glass-active shadow-sm font-extrabold scale-105 text-white"
                                                : "text-gray-500 hover:text-gray-800 hover:bg-white/40"
                                        )}
                                    >
                                        {filter === 'all' ? 'Universal' : filter === 'M' ? 'Male' : 'Female'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chart Container */}
                        <div className="h-[450px] w-full relative z-10 transition-all">
                            <AttendanceChart 
                                data={activeDailyStats} 
                                compareWithRetention={true}
                                selectedDay={selectedDay}
                                onSelectDay={setSelectedDay}
                            />
                        </div>

                        {/* Day Selector */}
                        <div className="flex flex-wrap gap-2 mt-10 p-2.5 liquid-glass-pill rounded-full border border-white/80 justify-center relative z-10 backdrop-blur-xl">
                            {days.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                                        selectedDay === day
                                            ? "liquid-glass-active text-white shadow-lg shadow-[#71167F]/25 scale-105 -translate-y-0.5 border border-white/40 font-extrabold"
                                            : "text-gray-500 hover:text-[#71167F] hover:bg-white/40"
                                    )}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Demographics Split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="liquid-glass-elevated rounded-[2.5rem] p-8 lg:p-10 border border-white/80 shadow-xl relative overflow-hidden group backdrop-blur-2xl">
                            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-6 w-1.5 hff-gradient-bg rounded-full shadow-sm" />
                                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Gender Split</h3>
                            </div>
                            <div className="h-[280px]">
                                <GenderChart data={analytics.demographics.gender} />
                            </div>
                        </div>
                        <div className="liquid-glass-elevated rounded-[2.5rem] p-8 lg:p-10 border border-white/80 shadow-xl relative overflow-hidden group backdrop-blur-2xl">
                            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                            <div className="flex items-center gap-3 mb-8">
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
                    <ActionPanel 
                        onSync={handleManualSync} 
                        syncStatus={isSyncing ? 'syncing' : 'synced'} 
                        onDownload={handleDownloadSummary}
                        isDownloading={isDownloading}
                        lastSyncedAt={lastSyncedAt}
                    />
                    <div className="2xl:hidden">
                        <NoticeBoard variant="widget" onNavigate={onNavigate} />
                    </div>
                </div>
            </div>

            {/* 3. Deep Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="liquid-glass-elevated rounded-[2.5rem] p-8 lg:p-10 border border-white/80 shadow-xl relative overflow-hidden group backdrop-blur-2xl">
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase mb-8">Education Spectrum</h3>
                    <div className="h-[250px]">
                        <EducationChart data={analytics.demographics.education} />
                    </div>
                </div>
                <div className="liquid-glass-elevated rounded-[2.5rem] p-8 lg:p-10 border border-white/80 shadow-xl relative overflow-hidden group backdrop-blur-2xl">
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
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
