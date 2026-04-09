import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

const AttendanceSheet = ({ initialContext, onContextConsumed }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [highlightedParticipantUuid, setHighlightedParticipantUuid] = useState(null);
    const days = Array.from({ length: 12 }, (_, i) => `D${i + 1}`);

    React.useEffect(() => {
        if (initialContext) {
            const applyContext = async () => {
                let targetFacilitator = null;
                if (initialContext.type === 'facilitator') {
                    targetFacilitator = initialContext;
                } else if (initialContext.type === 'participant' && initialContext.facilitator_uuid) {
                    targetFacilitator = await db.registrations.where('uuid').equals(initialContext.facilitator_uuid).first();
                    setHighlightedParticipantUuid(initialContext.uuid);
                    
                    // Clear highlight after 5 seconds
                    setTimeout(() => setHighlightedParticipantUuid(null), 5000);
                }

                if (targetFacilitator) {
                    setSelectedFacilitator(targetFacilitator);
                }
                onContextConsumed();
            };
            applyContext();
        }
    }, [initialContext, onContextConsumed]);

    const data = useLiveQuery(async () => {
        if (!selectedFacilitator) {
            // Fetch All Facilitators
            let facilitators = await db.registrations.where('type').equals('facilitator').toArray();

            // Count participants for each facilitator
            const participants = await db.registrations.where('type').equals('participant').toArray();
            const counts = participants.reduce((acc, p) => {
                if (p.facilitator_uuid) {
                    acc[p.facilitator_uuid] = (acc[p.facilitator_uuid] || 0) + 1;
                }
                return acc;
            }, {});

            let results = facilitators.map(f => ({
                ...f,
                participantCount: counts[f.uuid] || 0
            }));

            if (searchTerm) {
                const lowerFilter = searchTerm.toLowerCase();
                results = results.filter(f =>
                    (f.first_name + ' ' + f.last_name).toLowerCase().includes(lowerFilter) ||
                    (f.place && f.place.toLowerCase().includes(lowerFilter))
                );
            }
            return { type: 'facilitators', list: results };
        } else {
            // Fetch Participants for selected Facilitator
            let results = await db.registrations
                .where('type').equals('participant')
                .filter(p => p.facilitator_uuid === selectedFacilitator.uuid)
                .toArray();

            results.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

            if (searchTerm) {
                const lowerFilter = searchTerm.toLowerCase();
                results = results.filter(p =>
                    (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter)
                );
            }
            return { type: 'participants', list: results };
        }
    }, [searchTerm, selectedFacilitator]);

    const handleToggleAttendance = async (participant, dayIndex) => {
        try {
            // Ensure we have a 12-day array. If it's the legacy object or null/empty, create a new array.
            let currentAttendance = participant.attendance;
            if (!Array.isArray(currentAttendance)) {
                currentAttendance = Array(12).fill(false);
                // Migrating old object format to array if it existed
                if (participant.attendance && typeof participant.attendance === 'object') {
                    for (let i = 0; i < 12; i++) {
                        if (participant.attendance[`D${i + 1}`]) currentAttendance[i] = true;
                    }
                }
            }

            const updatedAttendance = [...currentAttendance];
            updatedAttendance[dayIndex] = !updatedAttendance[dayIndex];

            await db.registrations.update(participant.id, {
                attendance: updatedAttendance,
                sync_status: 'pending',
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error("Attendance update failed:", err);
        }
    };

    if (!data) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
        </div>
    );

    const { type, list } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header / Breadcrumb */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        {selectedFacilitator ? `Attendance: ${selectedFacilitator.first_name} ${selectedFacilitator.last_name}` : 'Mark Attendance'}
                    </h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                        {selectedFacilitator ? `Logging attendance for ${list.length} participants` : 'Selection Protocol: Step 1 • Pick Facilitator'}
                    </p>
                </div>
                {selectedFacilitator && (
                    <button
                        onClick={() => {
                            setSelectedFacilitator(null);
                            setSearchTerm('');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#71167F] shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <Search size={14} /> Change Facilitator
                    </button>
                )}
            </div>

            {/* Control Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={type === 'facilitators' ? "Search for a facilitator..." : "Search by participant name..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
                    />
                </div>
                <div className="px-6 py-2 rounded-xl bg-[#71167F]/5 border border-[#71167F]/10 text-[10px] font-black text-[#71167F] uppercase tracking-widest">
                    {type === 'facilitators' ? `${list.length} Facilitators` : `${list.length} Participants Active`}
                </div>
            </div>

            {type === 'facilitators' ? (
                /* Facilitator Selection Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 italic text-gray-400 uppercase font-black text-xs tracking-widest">
                            No human assets detected in this query
                        </div>
                    ) : (
                        list.map(f => (
                            <div
                                key={f.uuid}
                                onClick={() => {
                                    setSelectedFacilitator(f);
                                    setSearchTerm('');
                                }}
                                className="group relative bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                    <Check className="h-24 w-24 -rotate-12" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-14 w-14 rounded-2xl bg-[#71167F] text-white flex items-center justify-center shadow-lg shadow-[#71167F]/20 text-lg font-black shrink-0 transition-transform group-hover:rotate-3">
                                        {(f.first_name?.[0] || 'F') + (f.last_name?.[0] || '')}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 leading-tight">{f.first_name} {f.last_name}</h4>
                                        <p className="text-[10px] font-bold text-[#71167F] uppercase tracking-widest mt-0.5">{f.place || 'Unknown Cluster'}</p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Assigned Participants</span>
                                        <span className="text-base font-black text-gray-900">{f.participantCount || 0}</span>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center group-hover:bg-[#71167F] group-hover:text-white transition-all shadow-inner">
                                        <Search size={18} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* Premium Attendance Grid */
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 hff-gradient-bg opacity-30" />
                    <div className="overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                            <div className="grid overflow-hidden" style={{ gridTemplateColumns: `280px repeat(${days.length}, minmax(50px, 1fr))` }}>
                                {/* Header Row */}
                                <div className="p-6 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] sticky left-0 z-10">Entity Identity</div>
                                {days.map(day => (
                                    <div key={day} className="p-6 bg-gray-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 text-center uppercase tracking-widest">
                                        {day}
                                    </div>
                                ))}

                                {/* Data Rows */}
                                {list.length === 0 ? (
                                    <div className="col-span-full p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                                        This facilitator has no participants assigned
                                    </div>
                                ) : (
                                    list.map(p => (
                                        <React.Fragment key={p.uuid}>
                                            <div className={cn(
                                                "px-8 py-5 border-b border-gray-50 flex flex-col justify-center bg-white group/name sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]",
                                                highlightedParticipantUuid === p.uuid && "bg-[#71167F]/5"
                                            )}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-gray-900 group-hover/name:text-[#71167F] transition-colors">{p.first_name} {p.last_name}</span>
                                                    {highlightedParticipantUuid === p.uuid && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-[#71167F] animate-ping" />
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5 opacity-60">REF: {p.uuid.slice(0, 8)}</span>
                                            </div>
                                            {days.map((day, idx) => {
                                                const isPresent = Array.isArray(p.attendance) ? p.attendance[idx] : (p.attendance && p.attendance[day]);
                                                return (
                                                    <div
                                                        key={`${p.uuid}-${day}`}
                                                        onClick={() => handleToggleAttendance(p, idx)}
                                                        className={cn(
                                                            "p-5 border-b border-r border-gray-50 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-50/50 group",
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
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceSheet;
