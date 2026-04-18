import React, { useState } from 'react';
import DataIntegrity from './DataIntegrity';
import DeepAnalysis from './DeepAnalysis';
import MaintenanceTool from './MaintenanceTool';
import { ShieldCheck, BarChart3, Layers, LayoutPanelTop } from 'lucide-react';
import { cn } from '../lib/utils';

const AnalysisHub = ({ analytics, onBack }) => {
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
                        Advanced diagnostics and campaign intelligence
                    </p>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-gray-50/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-inner">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                activeTab === tab.id
                                    ? "bg-white text-[#71167F] shadow-md shadow-gray-200 border border-gray-100 scale-105"
                                    : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
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
                {activeTab === 'integrity' && <DataIntegrity />}
                {activeTab === 'performance' && <DeepAnalysis analytics={analytics} />}
                {activeTab === 'maintenance' && <MaintenanceTool />}
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
