import React from 'react';
import { TrendingUp, FileDown, CloudLightning, Check, Loader2 } from 'lucide-react';
import { cn } from "../lib/utils";

const ActionPanel = ({ syncStatus = 'synced', onDownload, onSync, isDownloading = false, lastSyncedAt = '' }) => {
    return (
        <div className="space-y-8">
            {/* AI Insights Card */}
            <div className="liquid-glass-elevated rounded-[2.5rem] p-8 relative overflow-hidden group border border-white/80 shadow-xl backdrop-blur-2xl">
                {/* Specular top rim */}
                <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#71167F]/8 rounded-full blur-3xl group-hover:bg-[#71167F]/15 transition-colors pointer-events-none" />

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="w-10 h-10 rounded-2xl bg-[#71167F]/10 text-[#71167F] border border-[#71167F]/20 flex items-center justify-center shadow-sm">
                        <TrendingUp size={18} />
                    </div>
                    <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">Impact Insights</h2>
                </div>

                <div className="space-y-6 relative z-10">
                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 hff-gradient-bg rounded-full opacity-40" />
                        <p className="text-xs font-medium text-gray-600 leading-relaxed italic pl-4 py-1">
                            "Current trends indicate a <span className="text-[#71167F] font-bold">12% surge</span> in engagement within the Molepolole district. Facilitator activity is optimized across all sectors."
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                        <div className="p-4 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Top Segment</span>
                            <span className="text-xs font-bold text-gray-900 uppercase">Young Adults</span>
                        </div>
                        <div className="p-4 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Projection</span>
                            <span className="text-xs font-bold text-[#3EB049] uppercase">+8.4% growth</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="w-full liquid-glass-active text-white p-5 rounded-[2rem] flex items-center justify-between shadow-xl shadow-[#71167F]/25 group transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-95 disabled:opacity-80 border border-white/40 relative overflow-hidden"
                >
                    {/* Top specular highlight */}
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30">
                            {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <FileDown size={20} />}
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 block mb-0.5">Generate Asset</span>
                            <span className="text-sm font-bold tracking-wide">
                                {isDownloading ? 'Generating PDF...' : 'Download Summary'}
                            </span>
                        </div>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all relative z-10">
                        <Check size={18} />
                    </div>
                </button>

                <button
                    onClick={onSync}
                    disabled={syncStatus === 'syncing'}
                    className="w-full liquid-glass-elevated p-5 rounded-[2rem] flex items-center justify-between transition-all group border border-white/80 shadow-md active:scale-98 disabled:opacity-75 disabled:cursor-wait relative overflow-hidden backdrop-blur-2xl"
                >
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-2xl bg-[#3EB049]/10 text-[#3EB049] border border-[#3EB049]/20 shadow-sm">
                            <CloudLightning size={20} className={syncStatus === 'syncing' ? 'animate-pulse' : ''} />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 tracking-wide">
                                    {syncStatus === 'syncing' ? 'Syncing Now...' : 'Cloud Sync'}
                                </span>
                                {syncStatus === 'synced' && (
                                    <div className="w-2 h-2 rounded-full bg-[#3EB049] animate-pulse shadow-[0_0_6px_rgba(62,176,73,0.8)]" />
                                )}
                            </div>
                            <span className="text-[10px] font-medium text-gray-500 tracking-wider block mt-0.5">
                                {syncStatus === 'syncing' 
                                    ? 'Connecting to Firebase...' 
                                    : lastSyncedAt 
                                        ? `Last synced ${lastSyncedAt}` 
                                        : 'Real-time offline sync active'}
                            </span>
                        </div>
                    </div>
                    <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wider relative z-10 px-3 py-1 rounded-full liquid-glass-pill border",
                        syncStatus === 'syncing' ? "text-amber-600 border-amber-300" : "text-[#3EB049] border-emerald-300"
                    )}>
                        {syncStatus === 'syncing' ? 'Busy' : 'Live'}
                    </div>
                </button>
            </div>
        </div>
    );
};

export default ActionPanel;
