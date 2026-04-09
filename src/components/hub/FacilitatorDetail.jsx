import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Search, User, Briefcase, Filter, Download, ArrowLeft, CalendarDays, MapPin, GraduationCap, Heart, Activity, Plus, Briefcase as OccupationIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import ParticipantDetail from './ParticipantDetail';
import RegistrationForm from '../RegistrationForm';

const FacilitatorDetail = ({ facilitator, onBack, onNavigateToAttendance }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [isAddingParticipant, setIsAddingParticipant] = useState(false);

    const participants = useLiveQuery(async () => {
        let collection = db.registrations.where('facilitator_uuid').equals(facilitator.uuid);
        let results = await collection.toArray();
        results = results.filter(p => !p.is_deleted && p.type === 'participant');

        if (searchTerm) {
            const lowerFilter = searchTerm.toLowerCase();
            results = results.filter(p =>
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter) ||
                (p.place && p.place.toLowerCase().includes(lowerFilter)) ||
                (p.affiliation && p.affiliation.toLowerCase().includes(lowerFilter))
            );
        }

        // Compute facilitator back-ref just in case
        results = results.map(p => ({
            ...p,
            facilitatorName: `${facilitator.first_name} ${facilitator.last_name}`
        }));

        return results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }, [facilitator.uuid, searchTerm]);

    const exportToCSV = () => {
        if (!participants) return;
        const headers = ['ID', 'First Name', 'Last Name', 'Gender', 'Age', 'Place', 'Education', 'Marital Status', 'Occupation'];
        const csvContent = [
            headers.join(','),
            ...participants.map(p => [
                p.id,
                p.first_name,
                p.last_name,
                p.gender,
                p.age,
                p.place || '',
                p.education || '',
                p.marital_status || '',
                p.occupation || ''
            ].map(v => `"${v}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `hff_facilitator_${facilitator.first_name}_${facilitator.last_name}_participants.csv`.replace(/\s+/g, '_');
        link.click();
    };

    if (isAddingParticipant) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                            Add New Participant
                        </h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            Registering for {facilitator.first_name} {facilitator.last_name}
                        </p>
                    </div>
                </div>
                <RegistrationForm
                    type="participant"
                    inGroup={true}
                    predefinedFacilitator={facilitator}
                    onBack={() => setIsAddingParticipant(false)}
                    onSaveSuccess={() => {
                        setIsAddingParticipant(false);
                    }}
                />
            </div>
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
            {/* Action Bar / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="flex flex-col gap-4">
                    <button
                        onClick={onBack}
                        className="flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#71167F] transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to All People
                    </button>

                    <div className="flex items-center gap-5 mt-2">
                        <div className="h-16 w-16 rounded-2xl bg-[#71167F] text-white flex items-center justify-center shadow-lg shadow-[#71167F]/20 transform -rotate-2">
                            <Briefcase size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                {facilitator.first_name} {facilitator.last_name}
                            </h2>
                            <p className="text-[11px] font-black text-[#71167F] uppercase tracking-widest mt-1">
                                Facilitator Overview
                            </p>
                        </div>
                    </div>
                </div>

                {/* Facilitator Stats Snippet */}
                <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-center px-4 border-r border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Participants</p>
                        <p className="text-xl font-black text-gray-900">{participants ? participants.length : 0}</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                        <div className={cn(
                            "px-3 py-1 mt-1 rounded-full text-[9px] font-black uppercase tracking-widest border inline-block",
                            facilitator.sync_status === 'synced' ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                            {facilitator.sync_status === 'synced' ? 'Synced' : 'Pending'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <h3 className="text-lg font-black text-gray-900 tracking-tight uppercase">Assigned Participants</h3>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, district or affiliation..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-xs font-bold shadow-sm"
                        />
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="p-2.5 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-[#71167F] hover:shadow-md transition-all shrink-0"
                        title="Export Participants CSV"
                    >
                        <Download size={18} />
                    </button>
                    {onNavigateToAttendance && (
                        <button
                            onClick={() => onNavigateToAttendance(facilitator)}
                            className="px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0"
                            title="Mark Attendance"
                        >
                            <CalendarDays size={16} />
                            Mark Attendance
                        </button>
                    )}
                    <button
                        onClick={() => setIsAddingParticipant(true)}
                        className="px-4 py-2.5 rounded-xl bg-[#71167F] text-white hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0 shadow-md shadow-[#71167F]/20"
                        title="Add participant"
                    >
                        <Plus size={16} />
                        Add Participant
                    </button>
                </div>
            </div>

            {/* Participant Grid */}
            {!participants ? (
                <div className="flex items-center justify-center p-20">
                    <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
                </div>
            ) : participants.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-[2rem] border-2 border-dashed border-gray-100 shadow-inner">
                    <div className="bg-gray-100/50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="h-8 w-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-1">No Participants</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">This facilitator hasn't registered anyone yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-20">
                    {participants.map(person => (
                        <div
                            key={person.uuid}
                            onClick={() => setSelectedParticipant(person)}
                            className="group glass-card p-5 bg-white hover:bg-gray-50/50 border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/50 flex flex-col justify-between cursor-pointer"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="h-12 w-12 rounded-xl bg-[#3EB049] text-white flex items-center justify-center transition-transform group-hover:scale-110 shadow-md shadow-[#3EB049]/20 shrink-0">
                                    <User size={20} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-gray-900 text-base truncate pr-2">
                                        {person.first_name} {person.last_name}
                                    </div>
                                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1 truncate">
                                        {person.gender === 'M' ? 'Male' : 'Female'} • {person.age} Yrs
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md w-fit max-w-full">
                                    <MapPin size={10} className="shrink-0" />
                                    <span className="truncate">{person.place || 'Unspecified Sector'}</span>
                                </div>
                                {person.affiliation && (
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#71167F] uppercase tracking-widest bg-[#71167F]/5 px-2 py-1 rounded-md w-fit max-w-full">
                                        <Briefcase size={10} className="shrink-0" />
                                        <span className="truncate">{person.affiliation}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest group-hover:text-[#71167F] transition-colors flex items-center gap-1">
                                    View Full Profile <ArrowLeft size={10} className="rotate-180" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FacilitatorDetail;
