import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Search, User, Briefcase, Filter, Download } from 'lucide-react';

const PersonList = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'facilitator', 'participant'

    const people = useLiveQuery(async () => {
        let collection = db.registrations.orderBy('created_at').reverse();

        if (filterType !== 'all') {
            collection = db.registrations.where('type').equals(filterType);
        }

        let results = await collection.toArray();

        if (searchTerm) {
            const lowerFilter = searchTerm.toLowerCase();
            results = results.filter(p =>
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter) ||
                (p.place && p.place.toLowerCase().includes(lowerFilter))
            );
        }

        // Enhance with facilitator name if participant
        if (filterType === 'participant' || filterType === 'all') {
            // We can optimize this if needed, but for hundreds of records it's fine
            const facilitators = await db.registrations.where('type').equals('facilitator').toArray();
            const facMap = facilitators.reduce((acc, f) => {
                acc[f.uuid] = `${f.first_name} ${f.last_name}`;
                return acc;
            }, {});

            results = results.map(p => ({
                ...p,
                facilitatorName: p.facilitator_uuid ? facMap[p.facilitator_uuid] : null
            }));
        }

        return results;
    }, [searchTerm, filterType]);

    if (!people) return <div className="p-8 text-center text-gray-500">Loading people...</div>;

    const exportToCSV = () => {
        const headers = ['ID', 'First Name', 'Last Name', 'Type', 'Gender', 'Age', 'Contact', 'Place', 'Facilitator', 'Sync Status'];
        const csvContent = [
            headers.join(','),
            ...people.map(p => [
                p.id,
                p.first_name,
                p.last_name,
                p.type,
                p.gender,
                p.age,
                p.contact || '',
                p.place || '',
                p.facilitatorName || '',
                p.sync_status
            ].map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hff_people_export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or place..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-hff-primary/50"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {['all', 'facilitator', 'participant'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${filterType === t ? 'bg-white text-hff-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="p-2 text-gray-500 hover:text-hff-primary hover:bg-hff-primary/5 rounded-lg border border-transparent hover:border-hff-primary/20 transition-all"
                        title="Export filtered list to CSV"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* List */}
            {people.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="bg-gray-100 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-gray-900 font-semibold">No people found</h3>
                    <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {people.map(person => (
                        <div key={person.uuid} className="person-card bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${person.type === 'facilitator' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                    {person.type === 'facilitator' ? <Briefcase className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                                        {person.first_name} {person.last_name}
                                        {person.sync_status === 'pending' && (
                                            <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" title="Sync Pending" />
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className="capitalize">{person.gender === 'M' ? 'Male' : person.gender === 'F' ? 'Female' : person.gender}</span>
                                        <span>•</span>
                                        <span>{person.age} yrs</span>
                                        {person.place && (
                                            <>
                                                <span>•</span>
                                                <span>{person.place}</span>
                                            </>
                                        )}
                                        {person.facilitatorName && (
                                            <>
                                                <span>•</span>
                                                <span className="text-purple-600">Fac: {person.facilitatorName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${person.sync_status === 'synced' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                    {person.sync_status === 'synced' ? 'Synced' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="text-center text-xs text-gray-400 mt-4">
                Showing {people.length} records logic
            </div>
        </div>
    );
};

export default PersonList;
