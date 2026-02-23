import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { AlertCircle, CheckCircle2, Users, FileText } from 'lucide-react';

const NoticeBoard = () => {
    // We need facilitators and their linked participant counts
    const data = useLiveQuery(async () => {
        const facilitators = await db.registrations.where('type').equals('facilitator').toArray();
        const participants = await db.registrations.where('type').equals('participant').toArray();

        // Calculate stats
        const grouped = facilitators.map(fac => {
            const myParticipants = participants.filter(p => p.facilitator_uuid === fac.uuid);
            return {
                ...fac,
                linkedCount: myParticipants.length,
                pendingSyncs: myParticipants.filter(p => p.sync_status === 'pending').length
            };
        });

        // Sort: Urgent ones first (0 participants or unsynced)
        grouped.sort((a, b) => {
            if (a.linkedCount === 0 && b.linkedCount > 0) return -1;
            if (b.linkedCount === 0 && a.linkedCount > 0) return 1;
            return 0;
        });

        return grouped;
    }, []);

    if (!data) return <div className="p-8 text-center text-gray-500">Loading notices...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map(fac => {
                    const isUrgent = fac.linkedCount === 0;
                    const isSynced = fac.sync_status === 'synced';

                    return (
                        <div
                            key={fac.uuid}
                            className={`notice-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${isUrgent ? 'alert' : isSynced ? 'success' : ''
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900">{fac.first_name} {fac.last_name}</h3>
                                    <p className="text-sm text-gray-500">{fac.place || 'Unknown Location'}</p>
                                </div>
                                {isUrgent && <AlertCircle className="h-6 w-6 text-red-500" />}
                                {!isUrgent && isSynced && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Users className="h-4 w-4" />
                                        <span className="text-sm font-medium">Participants</span>
                                    </div>
                                    <span className={`font-bold ${fac.linkedCount === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                        {fac.linkedCount} / {fac.participants_count || '?'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <FileText className="h-4 w-4" />
                                        <span className="text-sm font-medium">Sync Status</span>
                                    </div>
                                    <span className={`text-sm font-semibold ${isSynced ? 'text-green-600' : 'text-amber-500'
                                        }`}>
                                        {isSynced ? 'Synced' : 'Pending'}
                                    </span>
                                </div>
                            </div>

                            {isUrgent && (
                                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>No participants linked to this facilitator yet.</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {data.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    No facilitators found. Register facilitators to see them here.
                </div>
            )}
        </div>
    );
};

export default NoticeBoard;
