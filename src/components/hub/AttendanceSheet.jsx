import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Check, Search } from 'lucide-react';

const AttendanceSheet = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const days = Array.from({ length: 12 }, (_, i) => `Day ${i + 1}`);

    const participants = useLiveQuery(async () => {
        let collection = db.registrations.where('type').equals('participant');
        let results = await collection.toArray();

        // Sort by name
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
            // Clone the attendance object or create new
            const currentAttendance = participant.attendance || {};
            const isPresent = !!currentAttendance[day];

            const updatedAttendance = {
                ...currentAttendance,
                [day]: !isPresent
            };

            // Update in Dexie
            await db.registrations.update(participant.id, {
                attendance: updatedAttendance,
                sync_status: 'pending', // Mark as pending sync when modified
                updated_at: new Date().toISOString()
            });

        } catch (err) {
            console.error("Failed to update attendance:", err);
            alert("Error updating attendance. See console.");
        }
    };

    if (!participants) return <div className="p-8 text-center text-gray-500">Loading participants...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search participant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-hff-primary/50"
                    />
                </div>
                <div className="text-sm text-gray-500">
                    Showing {participants.length} participants
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                        <div className="attendance-grid" style={{ gridTemplateColumns: `250px repeat(${days.length}, minmax(60px, 1fr))` }}>
                            {/* Header Row */}
                            <div className="attendance-name-cell bg-gray-50 border-b border-gray-200">Participant</div>
                            {days.map(day => (
                                <div key={day} className="attendance-header-cell border-b border-gray-200 whitespace-nowrap">
                                    {day}
                                </div>
                            ))}

                            {/* Data Rows */}
                            {participants.map(p => (
                                <React.Fragment key={p.uuid}>
                                    <div className="attendance-name-cell border-b border-gray-100 flex flex-col justify-center">
                                        <span className="font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</span>
                                        <span className="text-xs text-gray-400 truncate">{p.id}</span>
                                    </div>
                                    {days.map(day => {
                                        const isPresent = p.attendance && p.attendance[day];
                                        return (
                                            <div
                                                key={`${p.uuid}-${day}`}
                                                onClick={() => handleToggleAttendance(p, day)}
                                                className={`attendance-cell border-b border-gray-100 border-r border-gray-100 ${isPresent ? 'checked' : ''
                                                    }`}
                                                title={`Toggle ${day} for ${p.first_name}`}
                                            >
                                                {isPresent && <Check className="h-5 w-5 text-green-600" />}
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
