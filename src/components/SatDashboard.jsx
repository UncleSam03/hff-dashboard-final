import React, { useState } from 'react';
import { Award, Download, Users, CheckCircle, FileText, LayoutPanelTop, ShieldCheck, UserCheck, ChevronLeft, ClipboardCheck } from 'lucide-react';
import StatsCard from './StatsCard';
import { cn } from '../lib/utils';

const SatDashboard = ({ onBack }) => {
    const [view, setView] = useState('main'); // 'main', 'certificates', or 'attendance'

    const handleCertificatesClick = () => {
        setView('certificates');
    };

    const handleAttendanceClick = () => {
        setView('attendance');
    };

    const handleBackToMain = () => {
        setView('main');
    };

    const getTitle = () => {
        if (view === 'certificates') return 'Certificates';
        if (view === 'attendance') return 'Attendance';
        return 'SAT Dashboard';
    };

    const getDescription = () => {
        if (view === 'certificates') return 'Select certificate category to manage records';
        if (view === 'attendance') return 'View attendance records by category';
        return 'Strategic Action Team Performance & Certification';
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        {view !== 'main' && (
                            <button 
                                onClick={handleBackToMain}
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
                        <div onClick={handleCertificatesClick} className="cursor-pointer">
                            <StatsCard
                                title="Certificates"
                                value={0}
                                icon={Award}
                                description="Total certificates issued"
                                color="purple"
                                className="hover:ring-2 hover:ring-[#71167F]/20 transition-all"
                            />
                        </div>
                        <div onClick={handleAttendanceClick} className="cursor-pointer">
                            <StatsCard
                                title="Attendance"
                                value={0}
                                icon={ClipboardCheck}
                                description="Daily attendance records"
                                color="amber"
                                className="hover:ring-2 hover:ring-amber-500/20 transition-all"
                            />
                        </div>
                    </div>
                ) : view === 'certificates' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatsCard
                            title="Facilitators"
                            value={0}
                            icon={UserCheck}
                            description="Qualifying facilitator certificates"
                            color="blue"
                        />
                        <StatsCard
                            title="Participants"
                            value={0}
                            icon={Users}
                            description="Qualifying participant certificates"
                            color="green"
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatsCard
                            title="Facilitators"
                            value={0}
                            icon={UserCheck}
                            description="Facilitator attendance logs"
                            color="blue"
                        />
                        <StatsCard
                            title="Participants"
                            value={0}
                            icon={Users}
                            description="Participant attendance logs"
                            color="green"
                        />
                    </div>
                )}
            </div>


        </div>
    );
};

export default SatDashboard;
