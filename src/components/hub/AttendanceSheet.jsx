import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Check, Search } from 'lucide-react';

const AttendanceSheet = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const days = Array.from({ length: 12 }, (_, i) => `D${i + 1}`);

    const participants = useLiveQuery(async () => {
        let collection = db.registrations.where('type').equals('participant');
        let results = await collection.toArray();
        results.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

        if (searchTerm) {
            const lowerFilter = searchTerm.toLowerCase();
            results = results.filter(p =>
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter)
            );
        }
        return results;
    }, [searchTerm]);

    const handleToggleAttendance = async (participant, day) => {
        try {
            const currentAttendance = participant.attendance || {};
            const isPresent = !!currentAttendance[day];
            const updatedAttendance = { ...currentAttendance, [day]: !isPresent };

            await db.registrations.update(participant.id, {
                attendance: updatedAttendance,
                sync_status: 'pending',
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error("Attendance update failed:", err);
        }
    };

    if (!participants) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by participant name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
                    />
                </div>
                <div className="px-6 py-2 rounded-xl bg-[#71167F]/5 border border-[#71167F]/10 text-[10px] font-black text-[#71167F] uppercase tracking-widest">
                    Cohort Intensity: {participants.length} Active
                </div>
            </div>

            {/* Premium Grid */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 hff-gradient-bg opacity-30" />
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                        <div className="grid overflow-hidden" style={{ gridTemplateColumns: `280px repeat(${days.length}, minmax(50px, 1fr))` }}>
                            
                            {/* Header Row */}
                            <div className="p-6 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Identity Buffer</div>
                            {days.map(day => (
                                <div key={day} className="p-6 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 text-center uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}

                            {/* Data Rows */}
                            {participants.map(p => (
                                <React.Fragment key={p.uuid}>
                                    <div className="px-8 py-5 border-b border-gray-50 flex flex-col justify-center bg-white group/name">
                                        <span className="text-sm font-black text-gray-900 group-hover/name:text-[#71167F] transition-colors">{p.first_name} {p.last_name}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5 opacity-60">REF: {p.id}</span>
                                    </div>
                                    {days.map(day => {
                                        const isPresent = p.attendance && p.attendance[day];
                                        return (
                                            <div
                                                key={`${p.uuid}-${day}`}
                                                onClick={() => handleToggleAttendance(p, day)}
                                                className={cn(
                                                    "p-5 border-b border-gray-50 border-r border-gray-50 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-50/50 group",
                                                    isPresent ? "bg-[#3EB049]/5" : "bg-white"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 transform",
                                                    isPresent ? "bg-[#3EB049] text-white shadow-lg shadow-[#3EB049]/20 scale-110" : "bg-gray-100 text-transparent group-hover:bg-gray-200"
                                                )}>
                                                    <Check size={14} className="stroke-[4px]" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceSheet;
