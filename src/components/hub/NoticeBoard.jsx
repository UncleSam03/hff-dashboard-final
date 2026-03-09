import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { AlertCircle, Check, Users, FileText, Megaphone, ExternalLink, Activity, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const NoticeBoard = () => {
    // Fetch facilitators, participants, and notices
    const data = useLiveQuery(async () => {
        const facilitators = await db.registrations.where('type').equals('facilitator').toArray();
        const participants = await db.registrations.where('type').equals('participant').toArray();
        const bulletins = await db.notices.orderBy('created_at').reverse().toArray();

        // 1. Calculate Facilitator Health
        const facilitatorStats = facilitators.map(fac => {
            const myParticipants = participants.filter(p => p.facilitator_uuid === fac.uuid);
            return {
                ...fac,
                linkedCount: myParticipants.length,
                pendingSyncs: myParticipants.filter(p => p.sync_status === 'pending').length
            };
        });

        // 2. Generate Smart Alerts (Data Health)
        const alerts = [];
        facilitatorStats.forEach(f => {
            if (f.linkedCount === 0) {
                alerts.push({
                    id: `alert-zero-${f.uuid}`,
                    title: 'Empty Cluster Detected',
                    message: `Facilitator ${f.first_name} ${f.last_name} has registered 0 participants.`,
                    priority: 3,
                    type: 'health'
                });
            }
        });

        const totalPending = participants.filter(p => p.sync_status === 'pending').length;
        if (totalPending > 20) {
            alerts.push({
                id: 'alert-high-pending',
                title: 'High Sync Latency',
                message: `There are ${totalPending} records awaiting cloud synchronization. Connect to stable internet soon.`,
                priority: 2,
                type: 'sync'
            });
        }

        return { facilitators: facilitatorStats, bulletins, alerts };
    }, []);

    if (!data) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
        </div>
    );

    const { bulletins, alerts } = data;

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">

            {/* 1. Broadcast Section (Latest Announcements) */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Megaphone className="text-[#71167F]" size={20} />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Broadcast Feed</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bulletins.length === 0 ? (
                        <div className="md:col-span-2 p-8 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-3xl text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">No active broadcasts from Mission Control</p>
                        </div>
                    ) : (
                        bulletins.map(b => (
                            <div key={b.uuid} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-start border-l-4 border-l-[#71167F]">
                                <div className="p-2 bg-[#71167F]/5 text-[#71167F] rounded-lg">
                                    <Info size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900 leading-tight mb-1">{b.title}</h4>
                                    <p className="text-sm text-gray-600 line-clamp-2">{b.content}</p>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-2 block">
                                        Posted {new Date(b.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* 2. Intelligence Section (Smart Alerts) */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <Activity className="text-amber-500" size={20} />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Campaign Intelligence</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {alerts.map(a => (
                        <div key={a.id} className="bg-white p-6 rounded-[2rem] border border-amber-100 shadow-lg shadow-amber-500/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                                <AlertCircle size={48} className="text-amber-500" />
                            </div>
                            <div className="flex items-center gap-2 text-amber-600 mb-3">
                                <AlertCircle size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{a.title}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 leading-relaxed pr-8">{a.message}</p>
                            <div className="mt-4 flex items-center gap-2">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                    a.priority === 3 ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                                )}>
                                    Priority: {a.priority === 3 ? 'Critical' : 'Moderate'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {alerts.length === 0 && (
                        <div className="lg:col-span-3 p-10 bg-[#3EB049]/5 border border-[#3EB049]/10 rounded-[2rem] flex items-center justify-center gap-4 text-[#3EB049]">
                            <Check className="stroke-[3px]" />
                            <span className="text-sm font-black uppercase tracking-widest">All campaign nodes systems nominal</span>
                        </div>
                    )}
                </div>
            </section>



        </div>
    );
};

export default NoticeBoard;
