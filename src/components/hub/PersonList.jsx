import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Search, User, Briefcase, Filter, Download, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import FacilitatorDetail from './FacilitatorDetail';
import ParticipantDetail from './ParticipantDetail';

const PersonList = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [selectedParticipant, setSelectedParticipant] = useState(null);

    const people = useLiveQuery(async () => {
        let collection = db.registrations.orderBy('created_at').reverse();
        if (filterType !== 'all') {
            collection = db.registrations.where('type').equals(filterType);
        }
        let results = await collection.toArray();
        results = results.filter(p => !p.is_deleted);

        if (searchTerm) {
            const lowerFilter = searchTerm.toLowerCase();
            results = results.filter(p =>
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter) ||
                (p.place && p.place.toLowerCase().includes(lowerFilter))
            );
        }

        if (filterType === 'participant' || filterType === 'all') {
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

    const handleDelete = async (person) => {
        if (!window.confirm(`Permanently remove ${person.first_name}?`)) return;
        try {
            await db.registrations.update(person.id, {
                is_deleted: true,
                sync_status: 'pending',
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    if (!people) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
        </div>
    );

    const exportToCSV = () => {
        const headers = ['ID', 'First Name', 'Last Name', 'Type', 'Gender', 'Age', 'Place', 'Facilitator', 'Status'];
        const csvContent = [
            headers.join(','),
            ...people.map(p => [p.id, p.first_name, p.last_name, p.type, p.gender, p.age, p.place || '', p.facilitatorName || '', p.sync_status].map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `hff_export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    if (selectedFacilitator) {
        return (
            <FacilitatorDetail
                facilitator={selectedFacilitator}
                onBack={() => setSelectedFacilitator(null)}
            />
        );
    }

    if (selectedParticipant) {
        return (
            <ParticipantDetail
                participant={selectedParticipant}
                onBack={() => setSelectedParticipant(null)}
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Advanced Control Bar */}
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="relative w-full lg:w-1/3">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or district..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100">
                        {['all', 'facilitator', 'participant'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    filterType === t ? "bg-white text-[#71167F] shadow-sm shadow-gray-200" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="p-3.5 rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-[#71167F] hover:shadow-lg transition-all active:scale-95"
                        title="Download CSV Dataset"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* List Engine */}
            {people.length === 0 ? (
                <div className="text-center py-24 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-inner">
                    <div className="bg-gray-100/50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <User className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Null Set</h3>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">No matching human records found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {people.map(person => (
                        <div
                            key={person.uuid}
                            onClick={() => {
                                if (person.type === 'facilitator') setSelectedFacilitator(person);
                                else if (person.type === 'participant') setSelectedParticipant(person);
                            }}
                            className="group glass-card p-6 bg-white hover:bg-gray-50/50 border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-gray-200/50 flex flex-col justify-between cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-14 w-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-3 shadow-lg",
                                        person.type === 'facilitator' ? "bg-[#71167F] text-white shadow-[#71167F]/20" : "bg-[#3EB049] text-white shadow-[#3EB049]/20"
                                    )}>
                                        {person.type === 'facilitator' ? <Briefcase size={24} /> : <User size={24} />}
                                    </div>
                                    <div>
                                        <div className="font-black text-gray-900 text-lg flex items-center gap-2">
                                            {person.first_name} {person.last_name}
                                            {person.sync_status === 'pending' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                        </div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                            {person.type} • {person.gender === 'M' ? 'Male' : 'Female'} • {person.age} Yrs
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(person);
                                    }}
                                    className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-lg w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full hff-gradient-bg" />
                                    {person.place || 'Unspecified Cluster'}
                                </div>

                                {person.facilitatorName && (
                                    <div className="text-[10px] font-black text-[#71167F] uppercase tracking-widest flex items-center gap-2">
                                        <Briefcase size={12} />
                                        Managed by {person.facilitatorName}
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                                <div className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                    person.sync_status === 'synced' ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                )}>
                                    {person.sync_status === 'synced' ? 'Synchronized' : 'Sync Pending'}
                                </div>
                                {person.processed && (
                                    <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                                        Active
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PersonList;
