import React from 'react';
import { Construction, Sparkles, Hammer, Rocket, Database, LayoutPanelTop } from 'lucide-react';

const UnderConstruction = ({ title = "Advanced Analytics Engine", onBack }) => {
    return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-700">
            <div className="relative w-full max-w-2xl bg-white rounded-[3rem] border border-gray-100 shadow-2xl p-12 text-center overflow-hidden group">

                {/* Dynamic Background Elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-1000" />

                {/* Icon Stack */}
                <div className="relative mb-10 flex justify-center">
                    <div className="relative">
                        <div className="h-24 w-24 hff-gradient-bg rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-[#71167F]/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                            <Construction size={40} className="animate-pulse" />
                        </div>
                        <div className="absolute -top-3 -right-3 h-10 w-10 bg-white rounded-2xl shadow-lg border border-gray-50 flex items-center justify-center text-amber-500 animate-bounce delay-150">
                            <Sparkles size={20} />
                        </div>
                        <div className="absolute -bottom-2 -left-4 h-12 w-12 bg-white rounded-2xl shadow-lg border border-gray-50 flex items-center justify-center text-blue-500 animate-bounce">
                            <Database size={24} />
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="relative z-10 space-y-6">
                    <div>
                        <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-amber-100 mb-4 inline-block">
                            Coming Soon
                        </span>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">
                            {title} <br />
                            <span className="text-gray-300">is currently being forged</span>
                        </h2>
                    </div>

                    <p className="text-gray-500 font-medium leading-relaxed max-w-md mx-auto">
                        We are engineering a premium deep-dive analysis module with AI-driven insights and interactive reporting. This cluster will be online shortly.
                    </p>

                    {/* Progress Indicator Mockup */}
                    <div className="max-w-xs mx-auto pt-4">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Blueprint Phase</span>
                            <span className="text-[10px] font-black text-[#71167F] uppercase tracking-widest">75%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
                            <div className="h-full w-[75%] hff-gradient-bg rounded-full shadow-sm animate-pulse-slow" />
                        </div>
                    </div>

                    <div className="pt-8">
                        <button
                            onClick={onBack}
                            className="px-8 py-4 bg-gray-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-[#71167F] hover:shadow-2xl hover:shadow-[#71167F]/40 transition-all active:scale-95 flex items-center gap-3 mx-auto group/btn"
                        >
                            <LayoutPanelTop size={16} className="group-hover/btn:-translate-x-1 transition-transform" />
                            Return to Command Base
                        </button>
                    </div>
                </div>

                {/* Subtext Decals */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-12 opacity-[0.05] pointer-events-none">
                    <div className="flex items-center gap-2"><Hammer size={16} /><span className="text-[8px] font-bold uppercase tracking-tight">Refining UI</span></div>
                    <div className="flex items-center gap-2"><Rocket size={16} /><span className="text-[8px] font-bold uppercase tracking-tight">Syncing Engine</span></div>
                </div>
            </div>
        </div>
    );
};

export default UnderConstruction;
