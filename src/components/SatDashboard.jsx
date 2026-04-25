import React, { useState } from 'react';
import { Award, Download, Users, CheckCircle, FileText, LayoutPanelTop, ShieldCheck, UserCheck, ChevronLeft, ClipboardCheck, CalendarDays } from 'lucide-react';
import StatsCard from './StatsCard';
import { cn } from '../lib/utils';

const SatDashboard = ({ analytics, onBack }) => {
    const [view, setView] = useState('main'); // 'main', 'certificates', 'attendance', 'attendance_facilitators', 'attendance_participants'

    const handleBack = () => {
        if (view.startsWith('attendance_')) {
            setView('attendance');
        } else {
            setView('main');
        }
    };

    const getTitle = () => {
        if (view === 'certificates') return 'Certificates';
        if (view === 'attendance') return 'Attendance Overview';
        if (view === 'attendance_facilitators') return 'Facilitator Attendance';
        if (view === 'attendance_participants') return 'Participant Attendance';
        return 'SAT Dashboard';
    };

    const getDescription = () => {
        if (view === 'certificates') return 'Select certificate category to manage records';
        if (view === 'attendance') return 'Select category to view daily attendance logs';
        if (view === 'attendance_facilitators') return 'Daily attendance breakdown for facilitators';
        if (view === 'attendance_participants') return 'Daily attendance breakdown for participants';
        return 'Strategic Action Team Performance & Certification';
    };

    // Safe fallback for dailyStats
    const dailyStats = analytics?.dailyStats || Array.from({ length: 12 }, (_, i) => ({
        date: `Day ${i + 1}`,
        participants: 0,
        facilitators: 0
    }));

    const renderVerticalCards = (type) => {
        return (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
                {dailyStats.map((stat, index) => (
                    <div key={index} className="glass-card p-6 flex items-center justify-between group hover:border-[#71167F]/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#71167F]/10 group-hover:text-[#71167F] transition-colors">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">{stat.date}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    {type === 'facilitators' ? 'Active Facilitators' : 'Active Participants'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-[#71167F]">
                                {type === 'facilitators' ? stat.facilitators : stat.participants}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        {view !== 'main' && (
                            <button 
                                onClick={handleBack}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-[#71167F]"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            <span className="p-3 hff-gradient-bg rounded-2xl text-white shadow-2xl shadow-[#71167F]/20 rotate-3">
                                <ShieldCheck size={32} />
                            </span>
                            {getTitle()}
                        </h1>
                    </div>
                    <p className="text-gray-400 font-bold mt-3 uppercase text-[10px] tracking-[0.3em]">
                        {getDescription()}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="px-6 py-3 bg-white border border-gray-100 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-[#71167F] hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <LayoutPanelTop size={14} />
                        Back to Home
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="animate-in fade-in zoom-in duration-500">
                {view === 'main' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div onClick={() => setView('certificates')} className="cursor-pointer">
                            <StatsCard
                                title="Certificates"
                                value={analytics?.uniqueAttendees || 0}
                                icon={Award}
                                description="Total certificates issued"
                                color="purple"
                                className="hover:ring-2 hover:ring-[#71167F]/20 transition-all"
                            />
                        </div>
                        <div onClick={() => setView('attendance')} className="cursor-pointer">
                            <StatsCard
                                title="Attendance"
                                value={analytics?.avgAttendance || 0}
                                icon={ClipboardCheck}
                                description="Avg daily attendance"
                                color="amber"
                                className="hover:ring-2 hover:ring-amber-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'certificates' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatsCard
                            title="Facilitators"
                            value={analytics?.uniqueFacilitators || 0}
                            icon={UserCheck}
                            description="Qualifying facilitator certificates"
                            color="blue"
                        />
                        <StatsCard
                            title="Participants"
                            value={analytics?.uniqueParticipants || 0}
                            icon={Users}
                            description="Qualifying participant certificates"
                            color="green"
                        />
                    </div>
                ) : view === 'attendance' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div onClick={() => setView('attendance_facilitators')} className="cursor-pointer">
                            <StatsCard
                                title="Facilitators"
                                value={analytics?.uniqueFacilitators || 0}
                                icon={UserCheck}
                                description="Facilitator attendance logs"
                                color="blue"
                                className="hover:ring-2 hover:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div onClick={() => setView('attendance_participants')} className="cursor-pointer">
                            <StatsCard
                                title="Participants"
                                value={analytics?.uniqueParticipants || 0}
                                icon={Users}
                                description="Participant attendance logs"
                                color="green"
                                className="hover:ring-2 hover:ring-green-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'attendance_facilitators' ? (
                    renderVerticalCards('facilitators')
                ) : view === 'attendance_participants' ? (
                    renderVerticalCards('participants')
                ) : null}
            </div>

        </div>
    );
};

export default SatDashboard;
