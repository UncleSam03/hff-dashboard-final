import React, { useState } from 'react';
import DataIntegrity from './DataIntegrity';
import DeepAnalysis from './DeepAnalysis';
import MaintenanceTool from './MaintenanceTool';
import { ShieldCheck, BarChart3, Layers, LayoutPanelTop } from 'lucide-react';
import { cn } from '../lib/utils';

const AnalysisHub = ({ analytics, activeCampaign, onBack }) => {
    const [activeTab, setActiveTab] = useState('integrity'); // 'integrity', 'performance', 'maintenance'

    const tabs = [
        { id: 'integrity', label: 'Data Integrity', icon: ShieldCheck, description: 'Fix missing or incomplete records' },
        { id: 'performance', label: 'Performance', icon: BarChart3, description: 'Campaign ROI and AI insights' },
        { id: 'maintenance', label: 'Maintenance', icon: Layers, description: 'Merge duplicates and optimize' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-24">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                        <div className="p-3 hff-gradient-bg rounded-2xl text-white shadow-xl shadow-[#71167F]/20">
                            <BarChart3 size={28} />
                        </div>
                        Strategic Analysis Hub
                    </h1>
                    <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-[0.25em]">
                        Advanced diagnostics and campaign intelligence {activeCampaign ? `• ${activeCampaign.name}` : ''}
                    </p>
                </div>

                <div className="flex items-center gap-1.5 p-1.5 liquid-glass-pill border border-white/70 shadow-sm">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                                activeTab === tab.id
                                     ? "liquid-glass-active shadow-sm font-extrabold scale-105"
                                    : "text-gray-500 hover:text-gray-800 hover:bg-white/40"
                            )}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[60vh]">
                {activeTab === 'integrity' && <DataIntegrity activeCampaign={activeCampaign} />}
                {activeTab === 'performance' && <DeepAnalysis analytics={analytics} activeCampaign={activeCampaign} />}
                {activeTab === 'maintenance' && <MaintenanceTool activeCampaign={activeCampaign} />}
            </div>
            
            {/* Back Button */}
            <div className="pt-8 border-t border-gray-100">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#71167F] transition-colors"
                >
                    <LayoutPanelTop size={14} />
                    Back to Overview
                </button>
            </div>
        </div>
    );
};

export default AnalysisHub;
