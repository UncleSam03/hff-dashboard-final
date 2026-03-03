import React from 'react';
import { Sparkles, FileDown, CloudLightning, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";

const ActionPanel = ({ syncStatus = 'synced', onDownload, onSync }) => {
    return (
        <div className="space-y-6">
            {/* AI Insights Card */}
            <div className="glass-card p-8 relative overflow-hidden group">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-100/30 rounded-full blur-3xl group-hover:bg-purple-200/40 transition-colors" />
                
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-hff-primary/10 text-hff-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">AI-Generated Insights</h2>
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-bold text-gray-500 leading-relaxed italic border-l-4 border-hff-primary/20 pl-4 py-1">
                        "The recent campaign in Molepolole shows a 12% increase in youth engagement compared to previous quarters. Gender parity is holding steady at 54% Female."
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Top Cohort</span>
                            <span className="text-sm font-bold text-gray-900">Young Adults</span>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Retention</span>
                            <span className="text-sm font-bold text-green-600">+8.4% WoW</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
                <button 
                    onClick={onDownload}
                    className="w-full card-hover-effect hff-gradient-bg text-white p-5 rounded-3xl flex items-center justify-between shadow-xl shadow-hff-primary/20 group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-white/20">
                            <FileDown className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Campaign Summary</span>
                            <span className="text-lg font-black">Download Report (PDF)</span>
                        </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                </button>

                <button 
                    onClick={onSync}
                    className="w-full card-hover-effect bg-white border-2 border-hff-secondary/20 p-5 rounded-3xl flex items-center justify-between hover:bg-hff-secondary/5 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-hff-secondary/10 text-hff-secondary">
                            <CloudLightning className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-gray-900">Cloud Sync</span>
                                {syncStatus === 'synced' && (
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                )}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Last sync'd 2m ago</span>
                        </div>
                    </div>
                    <div className="text-xs font-black text-hff-secondary uppercase tracking-[0.2em]">
                        Ready
                    </div>
                </button>
            </div>
        </div>
    );
};

export default ActionPanel;
