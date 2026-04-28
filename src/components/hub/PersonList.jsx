import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { Search, User, Briefcase, Download, Trash2, Plus, Pencil, X, BookOpen, ArrowLeft, CalendarCheck, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import FacilitatorDetail from './FacilitatorDetail';
import ParticipantDetail from './ParticipantDetail';

const PersonList = ({ 
    onRecordEdited, 
    selectedFacilitator, 
    setSelectedFacilitator, 
    selectedParticipant, 
    setSelectedParticipant 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedAffiliation, setSelectedAffiliation] = useState('Self');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState('create');
    const [editingPerson, setEditingPerson] = useState(null);
    const [editorError, setEditorError] = useState('');
    const [editorSubmitting, setEditorSubmitting] = useState(false);
    const [facSearchTerm, setFacSearchTerm] = useState('');
    const [facDropdownOpen, setFacDropdownOpen] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ open: false, person: null, loading: false });
    const [formData, setFormData] = useState({
        type: 'participant',
        first_name: '',
        last_name: '',
        age: '',
        gender: '',
        contact: '',
        place: '',
        education: '',
        marital_status: '',
        affiliation: '',
        occupation: '',
        facilitator_uuid: '',
        books_received: false,
        participants_count: 1,
        books_distributed: 0
    });

    const facilitators = useLiveQuery(async () => {
        const results = await db.registrations.where('type').equals('facilitator').toArray();
        return results.filter((person) => !person.is_deleted);
    }, []);

    const facilitatorOptions = useMemo(
        () => (facilitators || []).map((fac) => ({
            uuid: fac.uuid,
            label: `${fac.first_name || ''} ${fac.last_name || ''}`.trim()
        })),
        [facilitators]
    );

    const people = useLiveQuery(async () => {
        let collection = db.registrations.orderBy('created_at').reverse();
        
        // Base filter by type
        if (filterType !== 'all' && filterType !== 'affiliation') {
            collection = db.registrations.where('type').equals(filterType);
        }
        
        let results = await collection.toArray();
        results = results.filter(p => !p.is_deleted);

        // Map facilitators for name lookup & display
        const facilitators = await db.registrations.where('type').equals('facilitator').toArray();
        const facMap = facilitators.reduce((acc, f) => {
            acc[f.uuid] = `${f.first_name} ${f.last_name}`;
            return acc;
        }, {});

        // Calculate qualifying participants (>= 6 days) for each facilitator
        const allParticipants = await db.registrations.where('type').equals('participant').toArray();
        
        // Group participants by facilitator_uuid and count qualifying ones
        const qualifyingCountsByUuid = {};
        allParticipants.forEach(p => {
            if (p.is_deleted || !p.facilitator_uuid) return;
            
            const attendance = p.attendance;
            let days = 0;
            if (Array.isArray(attendance)) {
                days = attendance.filter(Boolean).length;
            } else if (attendance && typeof attendance === 'object') {
                days = Object.values(attendance).filter(Boolean).length;
            }
            
            if (days >= 6) {
                qualifyingCountsByUuid[p.facilitator_uuid] = (qualifyingCountsByUuid[p.facilitator_uuid] || 0) + 1;
            }
        });

        // Compute aliases for facilitators to correctly sum qualifying counts across aliases
        const facQualifyingCount = {};
        for (const f of facilitators) {
            let totalQualifying = 0;
            // Find all aliases for this facilitator (same contact phone)
            const aliases = facilitators.filter(alt => alt.contact && f.contact && alt.contact === f.contact);
            const aliasUuids = Array.from(new Set([f.uuid, ...aliases.map(a => a.uuid)]));
            
            aliasUuids.forEach(uuid => {
                totalQualifying += (qualifyingCountsByUuid[uuid] || 0);
            });
            facQualifyingCount[f.uuid] = totalQualifying;
        }

        results = results.map(p => ({
            ...p,
            facilitatorName: p.facilitator_uuid ? facMap[p.facilitator_uuid] : null,
            qualifyingCount: p.type === 'facilitator' ? (facQualifyingCount[p.uuid] || 0) : null
        }));

        // Secondary filter by Affiliation if active
        if (filterType === 'affiliation') {
            const target = selectedAffiliation.toLowerCase().trim();
            results = results.filter(p => {
                const aff = (p.affiliation || '').toLowerCase().trim();
                if (target === 'self') {
                    return !aff || aff === 'self';
                }
                return aff === target;
            });
        }

        if (searchTerm) {
            const lowerFilter = searchTerm.toLowerCase();
            results = results.filter(p =>
                (p.first_name + ' ' + p.last_name).toLowerCase().includes(lowerFilter) ||
                (p.place && p.place.toLowerCase().includes(lowerFilter)) ||
                (p.affiliation && p.affiliation.toLowerCase().includes(lowerFilter)) ||
                (p.facilitatorName && p.facilitatorName.toLowerCase().includes(lowerFilter))
            );
        }
        return results;
    }, [searchTerm, filterType, selectedAffiliation]);

    // Unique Affiliations for the Affiliation Tab
    const affiliationsList = useLiveQuery(async () => {
        const all = await db.registrations.toArray();
        const set = new Set(['Self']);
        all.forEach(p => {
            if (p.is_deleted) return;
            if (p.affiliation && p.affiliation.trim()) {
                const parts = p.affiliation.split(',').map(s => s.trim().toLowerCase()).filter(s => s && s !== 'self');
                parts.forEach(s => {
                    // Find original casing if possible by looking at the input string
                    // But for consistency let's just title-case or keep as is
                    // Let's find the original string part to keep casing pretty
                    const originalPart = p.affiliation.split(',').find(part => part.trim().toLowerCase() === s);
                    set.add(originalPart ? originalPart.trim() : s);
                });
            }
        });
        return Array.from(set).sort((a, b) => a.toLowerCase() === 'self' ? -1 : b.toLowerCase() === 'self' ? 1 : a.localeCompare(b));
    }, []);

    const handleDeleteClick = (person) => {
        if (person.type === 'facilitator') {
            setDeleteModal({ open: true, person, loading: false });
        } else {
            if (window.confirm(`Permanently remove ${person.first_name}?`)) {
                performDelete(person);
            }
        }
    };

    const handleNavigateToAttendance = async (record) => {
        if (record.type === 'participant' && record.facilitator_uuid) {
            const fac = await db.registrations.where('uuid').equals(record.facilitator_uuid).first();
            if (fac) {
                setSelectedFacilitator(fac);
                setSelectedParticipant(null);
            }
        }
        if (onRecordEdited) onRecordEdited(record);
    };

    const performDelete = async (person, deleteParticipants = false) => {
        setDeleteModal(prev => ({ ...prev, loading: true }));
        try {
            const now = new Date().toISOString();
            const updates = {
                is_deleted: true,
                sync_status: 'pending',
                updated_at: now
            };

            await db.transaction('rw', db.registrations, async () => {
                // Delete the target person
                await db.registrations.update(person.id, updates);

                if (deleteParticipants && person.type === 'facilitator') {
                    // Find and delete all associated participants
                    const participants = await db.registrations
                        .where('facilitator_uuid')
                        .equals(person.uuid)
                        .toArray();
                    
                    for (const p of participants) {
                        await db.registrations.update(p.id, updates);
                    }
                }
            });

            setDeleteModal({ open: false, person: null, loading: false });
            if (selectedFacilitator?.id === person.id) {
                setSelectedFacilitator(null);
            }
            if (selectedParticipant?.id === person.id) {
                setSelectedParticipant(null);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete records.');
            setDeleteModal(prev => ({ ...prev, loading: false }));
        }
    };

    const resetForm = (defaults = {}) => {
        setFormData({
            type: (defaults.type || 'participant').toLowerCase(),
            first_name: defaults.first_name || '',
            last_name: defaults.last_name || '',
            age: defaults.age ?? '',
            gender: defaults.gender || '',
            contact: defaults.contact || '',
            place: defaults.place || '',
            education: defaults.education || '',
            marital_status: defaults.marital_status || '',
            affiliation: defaults.affiliation || '',
            occupation: defaults.occupation || '',
            facilitator_uuid: defaults.facilitator_uuid || '',
            books_received: defaults.books_received || false,
            participants_count: defaults.participants_count || 1,
            books_distributed: defaults.books_distributed || 0
        });
    };

    const openCreateModal = (type) => {
        setEditorMode('create');
        setEditingPerson(null);
        resetForm({ type });
        setFacSearchTerm('');
        setFacDropdownOpen(false);
        setEditorError('');
        setEditorOpen(true);
    };

    const openEditModal = (person) => {
        setEditorMode('edit');
        setEditingPerson(person);
        resetForm(person);
        // Find existing facilitator to set initial search term
        const fac = facilitators?.find(f => f.uuid === person.facilitator_uuid);
        setFacSearchTerm(fac ? `${fac.first_name || ''} ${fac.last_name || ''}`.trim() : '');
        setFacDropdownOpen(false);
        setEditorError('');
        setEditorOpen(true);
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const closeEditor = () => {
        if (editorSubmitting) return;
        setEditorOpen(false);
        setEditingPerson(null);
        setEditorError('');
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (editorSubmitting) return;
        setEditorError('');

        if (!formData.first_name || !formData.last_name || !formData.age || !formData.gender) {
            setEditorError('First name, last name, age, and gender are required.');
            return;
        }

        if (Number.isNaN(Number(formData.age)) || Number(formData.age) < 1) {
            setEditorError('Age must be a valid number greater than 0.');
            return;
        }

        setEditorSubmitting(true);
        try {
            const now = new Date().toISOString();
            const normalized = {
                type: formData.type,
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                age: Number(formData.age),
                gender: formData.gender,
                contact: formData.contact?.trim() || '',
                place: formData.place?.trim() || '',
                education: formData.education || '',
                marital_status: formData.marital_status || '',
                affiliation: formData.affiliation?.trim() || '',
                occupation: formData.occupation?.trim() || '',
                facilitator_uuid: formData.type === 'participant' ? (formData.facilitator_uuid || null) : null,
                books_received: formData.type === 'participant' ? (formData.books_received || false) : false,
                participants_count: formData.type === 'facilitator' ? Number(formData.participants_count) : null,
                books_distributed: formData.type === 'facilitator' ? Number(formData.books_distributed) : null,
                sync_status: 'pending',
                is_deleted: false,
                updated_at: now
            };

            if (editorMode === 'edit' && editingPerson?.id) {
                await db.registrations.update(editingPerson.id, normalized);
                if (onRecordEdited) {
                    onRecordEdited({
                        ...normalized,
                        id: editingPerson.id,
                        uuid: editingPerson.uuid
                    });
                }
            } else {
                await db.registrations.add({
                    ...normalized,
                    uuid: globalThis.crypto.randomUUID(),
                    created_at: now
                });
            }

            closeEditor();
        } catch (err) {
            console.error('Save failed:', err);
            setEditorError('Failed to save record. Please try again.');
        } finally {
            setEditorSubmitting(false);
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
                onNavigateToAttendance={handleNavigateToAttendance}
                onDelete={() => handleDeleteClick(selectedFacilitator)}
            />
        );
    }

    if (selectedParticipant) {
        return (
            <ParticipantDetail
                participant={selectedParticipant}
                onBack={() => setSelectedParticipant(null)}
                onNavigateToAttendance={handleNavigateToAttendance}
                onNavigateToFacilitator={(fac) => {
                    setSelectedFacilitator(fac);
                    setSelectedParticipant(null);
                }}
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
                        placeholder="Search by name, district, affiliation or facilitator..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100">
                        {['all', 'facilitator', 'participant', 'affiliation'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    filterType === t ? "bg-white text-[#71167F] shadow-sm shadow-gray-200" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {t === 'affiliation' ? 'By Affiliation' : t}
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
                    <button
                        onClick={() => openCreateModal('facilitator')}
                        className="px-4 py-3 rounded-2xl bg-white border border-gray-100 text-[#71167F] hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        title="Add facilitator"
                    >
                        <Plus size={16} />
                        Add Facilitator
                    </button>
                    <button
                        onClick={() => openCreateModal('participant')}
                        className="px-4 py-3 rounded-2xl bg-[#71167F] text-white hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        title="Add participant"
                    >
                        <Plus size={16} />
                        Add Participant
                    </button>
                </div>
            </div>
            
            {/* Affiliation Secondary Selector */}
            {filterType === 'affiliation' && affiliationsList && (
                <div className="flex flex-wrap gap-2 px-6 py-4 bg-white/30 backdrop-blur-md rounded-3xl border border-white shadow-sm overflow-x-auto">
                    {affiliationsList.map(aff => (
                        <button
                            key={aff}
                            onClick={() => setSelectedAffiliation(aff)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                selectedAffiliation === aff 
                                    ? "bg-[#71167F] text-white border-[#71167F] shadow-lg shadow-[#71167F]/20" 
                                    : "bg-white text-gray-400 border-gray-100 hover:border-[#71167F]/20 hover:text-gray-600"
                            )}
                        >
                            {aff}
                        </button>
                    ))}
                </div>
            )}

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
                    {people.map(person => {
                        const isFacilitator = person.type === 'facilitator';
                        const isProfileIncomplete = isFacilitator && (
                            !person.first_name || !person.last_name || !person.age || !person.gender || 
                            !person.contact || !person.place || !person.education || !person.marital_status ||
                            person.participants_count === null || person.participants_count === undefined ||
                            person.books_distributed === null || person.books_distributed === undefined
                        );

                        const isDataQualityWarning = isFacilitator && (
                            isProfileIncomplete || 
                            (person.first_name && person.first_name.trim().length === 1) || 
                            (person.last_name && person.last_name.trim().length === 1)
                        );

                        return (
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
                                            {person.type} • {
                                                person.gender === 'M' ? 'Male' : 
                                                person.gender === 'F' ? 'Female' : 
                                                (person.Gender === 'M' || person.Gender === 'Male') ? 'Male' :
                                                (person.Gender === 'F' || person.Gender === 'Female') ? 'Female' : 'Unknown'
                                            } • {person.age || person.Age || '??'} Yrs
                                        </div>
                                        {person.type === 'facilitator' && (
                                            <div className="flex flex-col gap-1.5 mt-2">
                                                <div className="text-[9px] font-black text-[#71167F] uppercase tracking-widest flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-all">
                                                    View Participants <ArrowLeft size={10} className="rotate-180" />
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md w-fit">
                                                    <CalendarCheck size={10} />
                                                    {person.qualifyingCount || 0} Qualifying for Certificates
                                                </div>
                                            </div>
                                        )}
                                        {person.type === 'participant' && (
                                            <div className={cn(
                                                "mt-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                                                person.books_received ? "text-[#3EB049]" : "text-gray-300"
                                            )}>
                                                <BookOpen size={10} />
                                                {person.books_received ? "Book Received" : "Book Pending"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(person);
                                    }}
                                    className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(person);
                                    }}
                                    className="p-2.5 text-gray-300 hover:text-[#71167F] hover:bg-[#71167F]/10 rounded-xl transition-all"
                                    title="Edit record"
                                >
                                    <Pencil size={18} />
                                </button>
                                {person.type === 'participant' && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await db.registrations.update(person.id, {
                                                    books_received: !person.books_received,
                                                    sync_status: 'pending',
                                                    updated_at: new Date().toISOString()
                                                });
                                            } catch (err) {
                                                console.error("Book toggle failed:", err);
                                            }
                                        }}
                                        className={cn(
                                            "p-2.5 rounded-xl transition-all",
                                            person.books_received ? "text-[#3EB049] bg-[#3EB049]/10" : "text-gray-300 hover:text-[#3EB049] hover:bg-[#3EB049]/10"
                                        )}
                                        title={person.books_received ? "Mark as not received" : "Mark book as received"}
                                    >
                                        <BookOpen size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (handleNavigateToAttendance) handleNavigateToAttendance(person);
                                    }}
                                    className="p-2.5 text-gray-300 hover:text-[#71167F] hover:bg-[#71167F]/10 rounded-xl transition-all"
                                    title="Quick Mark Attendance"
                                >
                                    <CalendarCheck size={18} />
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
                                <div className="flex items-center gap-3">
                                    {person.processed && (
                                        <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                                            Active
                                        </div>
                                    )}
                                    {isProfileIncomplete && (
                                        <div 
                                            className="text-red-500 animate-pulse flex items-center justify-center"
                                            title="Incomplete Profile Information"
                                        >
                                            <AlertTriangle size={18} fill="currentColor" fillOpacity={0.1} />
                                        </div>
                                    )}
                                    {isDataQualityWarning && (
                                        <div 
                                            className="text-orange-500 animate-pulse flex items-center justify-center"
                                            title="Data Quality Warning: Missing fields or name too short"
                                        >
                                            <AlertTriangle size={18} fill="currentColor" fillOpacity={0.1} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {editorOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-white rounded-3xl border border-gray-100 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                    {editorMode === 'edit' ? 'Edit Campaign Record' : 'Add Campaign Record'}
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                    Update original form data from Campaign Hub
                                </p>
                            </div>
                            <button
                                onClick={closeEditor}
                                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all shrink-0"
                                aria-label="Close editor"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto min-h-0 flex-1">
                            {editorError && (
                                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-semibold">
                                    {editorError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Type</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                >
                                    <option value="facilitator">Facilitator</option>
                                    <option value="participant">Participant</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">First Name *</label>
                                    <input
                                        required
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Last Name *</label>
                                    <input
                                        required
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Age *</label>
                                    <input
                                        name="age"
                                        type="number"
                                        min="1"
                                        value={formData.age}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Gender *</label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    >
                                        <option value="">Select</option>
                                        <option value="M">Male</option>
                                        <option value="F">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Phone</label>
                                    <input
                                        name="contact"
                                        value={formData.contact}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Village / Site Name</label>
                                    <input
                                        name="place"
                                        value={formData.place}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Education Level</label>
                                    <select
                                        name="education"
                                        value={formData.education}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    >
                                        <option value="">Select Education</option>
                                        <option value="Primary">Primary</option>
                                        <option value="Junior Secondary">Junior Secondary</option>
                                        <option value="Senior Secondary">Senior Secondary</option>
                                        <option value="Vocational">Vocational</option>
                                        <option value="Tertiary">Tertiary</option>
                                        <option value="None">None</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Marital Status</label>
                                    <select
                                        name="marital_status"
                                        value={formData.marital_status}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    >
                                        <option value="">Select Status</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Cohabiting">Cohabiting</option>
                                    </select>
                                </div>
                                <div>
                                    {formData.type === 'participant' ? (
                                        <>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Affiliation / Group</label>
                                            <input
                                                name="affiliation"
                                                value={formData.affiliation}
                                                onChange={handleFormChange}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Managed Groups (Comma Separated)</label>
                                            <input
                                                name="affiliation"
                                                value={formData.affiliation}
                                                onChange={handleFormChange}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                placeholder="e.g. St Jude, Westside"
                                            />
                                        </>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Occupation</label>
                                    <input
                                        name="occupation"
                                        value={formData.occupation}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>
                            </div>

                            {formData.type === 'participant' && (
                                <div className="relative">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Facilitator (optional)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={facSearchTerm}
                                            onChange={(e) => {
                                                setFacSearchTerm(e.target.value);
                                                setFacDropdownOpen(true);
                                                setFormData(prev => ({ ...prev, facilitator_uuid: '' }));
                                            }}
                                            onFocus={() => setFacDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setFacDropdownOpen(false), 200)}
                                            placeholder="Search and select facilitator..."
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                        {facDropdownOpen && (
                                            <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                <div 
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-500 border-b border-gray-50"
                                                    onClick={() => {
                                                        setFacSearchTerm('');
                                                        setFormData(prev => ({ ...prev, facilitator_uuid: '' }));
                                                        setFacDropdownOpen(false);
                                                    }}
                                                >
                                                    Not assigned
                                                </div>
                                                {facilitatorOptions
                                                    .filter(opt => opt.label.toLowerCase().includes(facSearchTerm.toLowerCase()))
                                                    .map(option => (
                                                        <div
                                                            key={option.uuid}
                                                            className="px-4 py-3 hover:bg-[#71167F]/5 cursor-pointer text-sm font-bold text-gray-900 transition-colors"
                                                            onClick={() => {
                                                                setFacSearchTerm(option.label);
                                                                setFormData(prev => ({ ...prev, facilitator_uuid: option.uuid }));
                                                                setFacDropdownOpen(false);
                                                            }}
                                                        >
                                                            {option.label}
                                                        </div>
                                                    ))}
                                                {facSearchTerm && facilitatorOptions.filter(opt => opt.label.toLowerCase().includes(facSearchTerm.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-3 text-sm text-gray-400 italic font-medium">No exact match found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {formData.type === 'facilitator' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">No. of Participants</label>
                                        <input
                                            type="number"
                                            name="participants_count"
                                            min="1"
                                            value={formData.participants_count}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Books Given</label>
                                        <input
                                            type="number"
                                            name="books_distributed"
                                            min="0"
                                            value={formData.books_distributed}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.type === 'participant' && (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <input
                                        type="checkbox"
                                        id="books_received"
                                        name="books_received"
                                        checked={formData.books_received}
                                        onChange={(e) => setFormData(prev => ({ ...prev, books_received: e.target.checked }))}
                                        className="h-5 w-5 rounded border-gray-300 text-[#71167F] focus:ring-[#71167F]/20"
                                    />
                                    <label htmlFor="books_received" className="text-sm font-black text-gray-700 uppercase tracking-widest cursor-pointer">
                                        Campaign Book Distributed
                                    </label>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeEditor}
                                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editorSubmitting}
                                    className="px-5 py-2.5 rounded-xl bg-[#71167F] text-white text-xs font-black uppercase tracking-widest hover:opacity-95 transition-all disabled:opacity-70"
                                >
                                    {editorSubmitting ? 'Saving...' : editorMode === 'edit' ? 'Save Changes' : 'Add Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal for Facilitators */}
            {deleteModal.open && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center">
                            <div className="h-20 w-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Delete Facilitator</h3>
                            <p className="text-sm text-gray-500 font-medium mb-8">
                                You are about to delete <span className="font-bold text-gray-900">{deleteModal.person?.first_name} {deleteModal.person?.last_name}</span>. How would you like to proceed?
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => performDelete(deleteModal.person, false)}
                                    disabled={deleteModal.loading}
                                    className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Delete Facilitator Only
                                </button>
                                <button
                                    onClick={() => performDelete(deleteModal.person, true)}
                                    disabled={deleteModal.loading}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Delete Facilitator & All Participants
                                </button>
                                <button
                                    onClick={() => setDeleteModal({ open: false, person: null, loading: false })}
                                    disabled={deleteModal.loading}
                                    className="w-full py-4 text-gray-400 hover:text-gray-600 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonList;
