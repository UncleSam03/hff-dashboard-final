import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexieDb';
import { Trophy, Award, Target, MessageSquare } from 'lucide-react';
import { cn } from "../lib/utils";

const FacilitatorLeaderboard = () => {
    const facilitators = useLiveQuery(async () => {
        const facs = await db.registrations.where('type').equals('facilitator').toArray();
        const parts = await db.registrations.where('type').equals('participant').toArray();

        const leaderboard = facs.map(f => {
            const count = parts.filter(p => p.facilitator_uuid === f.uuid).length;
            return {
                ...f,
                participantCount: count,
                score: Math.floor(Math.random() * 50) + count * 10 // Mock score logic
            };
        });

        return leaderboard.sort((a, b) => b.participantCount - a.participantCount).slice(0, 5);
    });

    if (!facilitators || facilitators.length === 0) return null;

    return (
        <div className="glass-card p-8 border border-white/40 shadow-2xl shadow-gray-200/50 group bg-white/40 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-[#facc15] text-white rounded-2xl shadow-lg shadow-yellow-500/20">
                    <Trophy size={24} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-0.5">High Performance</p>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Facilitator Rank</h3>
                </div>
            </div>

            <div className="space-y-4">
                {facilitators.map((fac, index) => (
                    <div 
                        key={fac.uuid} 
                        className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02]",
                            index === 0 ? "bg-gradient-to-r from-yellow-50 to-white border-yellow-100" : "bg-white border-gray-50 hover:border-gray-100"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                                index === 0 ? "bg-yellow-400 text-white" : 
                                index === 1 ? "bg-gray-300 text-white" : 
                                index === 2 ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-400"
                            )}>
                                {index + 1}
                            </div>
                            <div>
                                <div className="text-sm font-black text-gray-900 leading-none mb-1">
                                    {fac.first_name} {fac.last_name}
                                </div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                    <Target size={10} />
                                    {fac.participantCount} Interactions
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <div className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                {fac.score} <span className="text-[10px] text-gray-400">PTS</span>
                            </div>
                            {index === 0 && (
                                <div className="flex items-center gap-1 text-[9px] font-black text-yellow-600 uppercase tracking-widest mt-1">
                                    <Award size={10} />
                                    Top Lead
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-8 py-4 rounded-2xl border border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:bg-gray-50 hover:text-[#71167F] transition-all flex items-center justify-center gap-2 group">
                <MessageSquare size={14} className="group-hover:rotate-12 transition-transform" />
                Dispatch Recognition
            </button>
        </div>
    );
};

export default FacilitatorLeaderboard;
