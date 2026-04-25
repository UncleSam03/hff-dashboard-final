import React, { useState } from 'react';
import { Award, Download, Users, CheckCircle, FileText, LayoutPanelTop, ShieldCheck, UserCheck, ChevronLeft } from 'lucide-react';
import StatsCard from './StatsCard';
import { cn } from '../lib/utils';

const SatDashboard = ({ onBack }) => {
    const [view, setView] = useState('main'); // 'main' or 'certificates'

    const handleCertificatesClick = () => {
        setView('certificates');
    };

    const handleBackToMain = () => {
        setView('main');
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1600px] mx-auto pb-24">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        {view === 'certificates' && (
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
                            {view === 'main' ? 'SAT Dashboard' : 'Certificates'}
                        </h1>
                    </div>
                    <p className="text-gray-400 font-bold mt-3 uppercase text-[10px] tracking-[0.3em]">
                        {view === 'main' 
                            ? 'Strategic Action Team Performance & Certification' 
                            : 'Select certificate category to manage records'}
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
                    </div>
                ) : (
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
                )}
            </div>

            {/* Certificate Management Section (Only visible when viewing certificates or as a global tool) */}
            <div className="glass-card p-10 relative overflow-hidden group">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                    <Award size={240} />
                </div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12 relative z-10">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <span className="p-2 bg-purple-100 text-purple-600 rounded-xl shadow-sm"><Award size={20} /></span>
                            {view === 'certificates' ? 'Category Management' : 'Certificate Management'}
                        </h2>
                        <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-[0.25em]">Issue and track participant certifications</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#71167F] hover:shadow-xl hover:shadow-[#71167F]/20 transition-all flex items-center gap-2">
                            <Download size={14} />
                            Export Records
                        </button>
                    </div>
                </div>
                
                {/* Placeholder Content */}
                <div className="bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 p-20 text-center relative z-10">
                    <div className="max-w-md mx-auto space-y-6">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-gray-200 mx-auto shadow-sm border border-gray-50">
                            <FileText size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">No Certificates Issued Yet</h3>
                            <p className="text-gray-400 font-medium text-sm mt-2">Start certifying your members and participants to see them listed here.</p>
                        </div>
                        <button className="px-8 py-3 hff-gradient-bg text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:shadow-[#71167F]/30 transition-all active:scale-95">
                            Issue New Certificate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SatDashboard;
