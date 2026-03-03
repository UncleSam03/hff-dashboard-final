import React from 'react';
import { Sparkles, FileDown, CloudLightning, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";

const ActionPanel = ({ syncStatus = 'synced', onDownload, onSync }) => {
    return (
        <div className="space-y-8">
            {/* AI Insights Card */}
            <div className="glass-card p-8 relative overflow-hidden group border border-white/40">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#71167F]/5 rounded-full blur-3xl group-hover:bg-[#71167F]/10 transition-colors" />
                
                <div className="flex items-center gap-3 mb-8 relative z-10">
                    <div className="p-2.5 rounded-xl bg-[#71167F] text-white shadow-lg shadow-[#71167F]/20">
                        <Sparkles size={18} />
                    </div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Impact Insights</h2>
                </div>

                <div className="space-y-6 relative z-10">
                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 hff-gradient-bg rounded-full opacity-30" />
                        <p className="text-xs font-bold text-gray-500 leading-relaxed italic pl-5 py-1">
                            "Current trends indicate a <span className="text-[#71167F] font-black">12% surge</span> in engagement within the Molepolole district. Facilitator activity is optimized across all sectors."
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Top Segment</span>
                            <span className="text-xs font-black text-gray-900 uppercase">Young Adults</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Projection</span>
                            <span className="text-xs font-black text-[#3EB049] uppercase">+8.4% growth</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
                <button 
                    onClick={onDownload}
                    className="w-full hff-gradient-bg text-white p-6 rounded-[2rem] flex items-center justify-between shadow-2xl shadow-[#71167F]/20 group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 active:scale-95"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                            <FileDown size={22} />
                        </div>
                        <div className="text-left">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70 block mb-0.5">Generate Asset</span>
                            <span className="text-base font-black uppercase tracking-tight">Download Summary</span>
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <CheckCircle2 size={20} />
                    </div>
                </button>

                <button 
                    onClick={onSync}
                    className="w-full bg-white border border-gray-100 p-6 rounded-[2rem] flex items-center justify-between hover:bg-gray-50 transition-all group shadow-sm hover:shadow-md active:scale-95 border-b-4 border-b-[#3EB049]/20"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-[#3EB049]/10 text-[#3EB049]">
                            <CloudLightning size={22} />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-black text-gray-900 uppercase tracking-tight">Cloud Sync</span>
                                {syncStatus === 'synced' && (
                                    <div className="w-2 h-2 rounded-full bg-[#3EB049] animate-pulse" />
                                )}
                            </div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mt-0.5">Last active 2m ago</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-[#3EB049] uppercase tracking-[0.2em]">
                        Live
                    </div>
                </button>
            </div>
        </div>
    );
};

export default ActionPanel;
