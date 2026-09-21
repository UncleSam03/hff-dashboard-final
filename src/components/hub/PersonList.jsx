import React, { useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN, importFileToCampaign } from '../../lib/campaignManager';
import { 
    Search, User, Briefcase, Download, Trash2, Plus, Pencil, X, 
    BookOpen, ArrowLeft, CalendarCheck, AlertTriangle, Shield, Users, 
    Check, Minus, MapPin, GraduationCap, Phone, Target, UserCheck, UserPlus, BookCheck, AlertCircle,
    Clock, FileText, Hash, Calendar, Upload, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { matchesPerson, formatEnteredDate } from '../../lib/searchUtils';
import { normalizeAttendance } from '../../lib/analytics';
import FacilitatorDetail from './FacilitatorDetail';
import ParticipantDetail from './ParticipantDetail';

const SEARCH_CRITERIA = [
    { id: 'all', label: 'All Criteria' },
    { id: 'meeting_place', label: 'Meeting Place' },
    { id: 'form_number', label: 'Form #' },
    { id: 'phone_number', label: 'Phone #' },
    { id: 'facilitator_names', label: 'Facilitator' },
    { id: 'date_entered', label: 'Date Entered' },
    { id: 'meeting_times', label: 'Meeting Time' },
];

const PersonList = ({ 
    onRecordEdited, 
    selectedFacilitator, 
    setSelectedFacilitator, 
    selectedParticipant, 
    setSelectedParticipant 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCriterion, setSearchCriterion] = useState('all');
    const [filterType, setFilterType] = useState('all');
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
        teaching_group: false,
        form_number: '',
        group_form_number: '',
        meeting_time: '',
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

    const activeCampId = getActiveCampaignId();
    const [isImporting, setIsImporting] = useState(false);
    const [importFeedback, setImportFeedback] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        setImportFeedback(null);
        try {
            const targetCampaignId = activeCampId || DEFAULT_CAMPAIGN.uuid;
            const res = await importFileToCampaign(file, targetCampaignId);
            setImportFeedback({ success: true, message: `Successfully imported ${res.count} records!` });
            setTimeout(() => setImportFeedback(null), 5000);
        } catch (err) {
            console.error('Import failed:', err);
            setImportFeedback({ success: false, message: err.message || 'Import failed.' });
            setTimeout(() => setImportFeedback(null), 6000);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const facilitators = useLiveQuery(async () => {
        const results = await db.registrations.where('type').equals('facilitator').toArray();
        return results.filter((person) => {
            if (person.is_deleted) return false;
            if (activeCampId) {
                if (person.campaign_id) return person.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            }
            return true;
        });
    }, [activeCampId]);

    const facilitatorOptions = useMemo(
        () => (facilitators || []).map((fac) => ({
            uuid: fac.uuid,
            form_number: fac.form_number || '',
            contact: fac.contact || '',
            affiliation: fac.affiliation || '',
            meeting_time: fac.meeting_time || '',
            place: fac.place || '',
            label: `${fac.first_name || ''} ${fac.last_name || ''}`.trim()
        })),
        [facilitators]
    );

    const people = useLiveQuery(async () => {
        let collection = db.registrations.orderBy('created_at').reverse();
        
        // Base filter by type
        if (filterType !== 'all') {
            collection = db.registrations.where('type').equals(filterType);
        }
        
        let results = await collection.toArray();
        results = results.filter(p => {
            if (p.is_deleted) return false;
            if (activeCampId) {
                if (p.campaign_id) return p.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            }
            return true;
        });

        // Map facilitators for lookup, display, and search inheritance
        let facilitators = await db.registrations.where('type').equals('facilitator').toArray();
        if (activeCampId) {
            facilitators = facilitators.filter(f => {
                if (f.is_deleted) return false;
                if (f.campaign_id) return f.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            });
        }
        const facMap = facilitators.reduce((acc, f) => {
            acc[f.uuid] = `${f.first_name} ${f.last_name}`;
            return acc;
        }, {});
        const facDetailMap = facilitators.reduce((acc, f) => {
            acc[f.uuid] = f;
            return acc;
        }, {});

        // Calculate qualifying participants (>= 6 days) for each facilitator
        let allParticipants = await db.registrations.where('type').equals('participant').toArray();
        if (activeCampId) {
            allParticipants = allParticipants.filter(p => {
                if (p.campaign_id) return p.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            });
        }
        
        // Group participants by facilitator_uuid and count qualifying ones
        const qualifyingCountsByUuid = {};
        allParticipants.forEach(p => {
            if (p.is_deleted || !p.facilitator_uuid) return;
            
            const attendance = normalizeAttendance(p.attendance);
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

        results = results.map(p => {
            const assignedFac = p.facilitator_uuid ? facDetailMap[p.facilitator_uuid] : null;
            return {
                ...p,
                facilitatorName: assignedFac ? `${assignedFac.first_name || ''} ${assignedFac.last_name || ''}`.trim() : (p.facilitator_uuid ? facMap[p.facilitator_uuid] : null),
                assignedFacilitator: assignedFac,
                qualifyingCount: p.type === 'facilitator' ? (facQualifyingCount[p.uuid] || 0) : null
            };
        });

        if (searchTerm) {
            results = results.filter(p => matchesPerson(p, searchTerm, searchCriterion));
        }
        return results;
    }, [searchTerm, searchCriterion, filterType]);

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

            // Trigger instant sync to delete records on Firestore backend
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));

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
        const isFac = (defaults.type || 'participant').toLowerCase() === 'facilitator';
        setFormData({
            type: (defaults.type || 'participant').toLowerCase(),
            teaching_group: defaults.teaching_group ?? isFac,
            form_number: defaults.form_number || '',
            group_form_number: defaults.group_form_number || '',
            meeting_time: defaults.meeting_time || '',
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
        resetForm({ 
            type,
            teaching_group: type === 'facilitator'
        });
        setFacSearchTerm('');
        setFacDropdownOpen(false);
        setEditorError('');
        setEditorOpen(true);
    };

    const openEditModal = (person) => {
        setEditorMode('edit');
        setEditingPerson(person);
        resetForm({
            ...person,
            teaching_group: person.teaching_group ?? (person.type === 'facilitator')
        });
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

    const handleGroupFormNumberChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, group_form_number: val }));
        if (val.trim()) {
            const matchedFac = (facilitators || []).find(f => 
                f.form_number && f.form_number.trim().toLowerCase() === val.trim().toLowerCase()
            );
            if (matchedFac) {
                setFormData(prev => ({ ...prev, group_form_number: val, facilitator_uuid: matchedFac.uuid }));
                setFacSearchTerm(`${matchedFac.first_name || ''} ${matchedFac.last_name || ''}`.trim());
            }
        }
    };

    // Known places for quick autocomplete datalist
    const knownPlaces = useMemo(() => {
        if (!people) return [];
        const set = new Set();
        people.forEach(p => {
            if (p.place && p.place.trim()) set.add(p.place.trim());
        });
        return Array.from(set).sort();
    }, [people]);

    // Live duplicate detection
    const duplicateWarning = useMemo(() => {
        if (!editorOpen || !formData.first_name || !formData.last_name || !people) return null;
        const fn = formData.first_name.trim().toLowerCase();
        const ln = formData.last_name.trim().toLowerCase();
        if (fn.length < 2 || ln.length < 2) return null;

        const match = people.find(p => {
            if (editingPerson && p.id === editingPerson.id) return false;
            return (
                (p.first_name || '').trim().toLowerCase() === fn &&
                (p.last_name || '').trim().toLowerCase() === ln
            );
        });
        return match ? `${match.first_name} ${match.last_name} (${match.type}, ${match.place || 'Unknown location'})` : null;
    }, [editorOpen, formData.first_name, formData.last_name, editingPerson, people]);

    // Number stepper helper for numeric inputs
    const adjustNumberField = (field, delta, min = 0) => {
        setFormData(prev => {
            const current = Number(prev[field]) || 0;
            const next = Math.max(min, current + delta);
            return { ...prev, [field]: next };
        });
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
                teaching_group: Boolean(formData.teaching_group),
                form_number: formData.form_number?.trim() || '',
                group_form_number: formData.group_form_number?.trim() || '',
                meeting_time: formData.meeting_time?.trim() || '',
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
                participants_count: (formData.type === 'facilitator' || formData.teaching_group) ? Number(formData.participants_count || 1) : null,
                books_distributed: (formData.type === 'facilitator' || formData.teaching_group) ? Number(formData.books_distributed || 0) : null,
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
                    campaign_id: activeCampId || DEFAULT_CAMPAIGN.uuid,
                    uuid: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2)),
                    created_at: now
                });
            }
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
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
        const headers = ['ID', 'Form Number', 'First Name', 'Last Name', 'Type', 'Teaching Group', 'Group Form Number', 'Meeting Place', 'Meeting Time', 'Gender', 'Age', 'Place', 'Facilitator', 'Status'];
        const csvContent = [
            headers.join(','),
            ...people.map(p => [
                p.id, 
                p.form_number || '', 
                p.first_name, 
                p.last_name, 
                p.type, 
                p.teaching_group ? 'Yes' : 'No', 
                p.group_form_number || '', 
                p.affiliation || '',
                p.meeting_time || '', 
                p.gender, 
                p.age, 
                p.place || '', 
                p.facilitatorName || '', 
                p.sync_status
            ].map(v => `"${v}"`).join(','))
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
            <div className="bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full lg:w-1/2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={
                                searchCriterion === 'all'
                                    ? "Search meeting place, form #, phone, facilitator, date, time..."
                                    : `Search by ${SEARCH_CRITERIA.find(c => c.id === searchCriterion)?.label}...`
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Clear search"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
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

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileImport} 
                            accept=".csv,.xlsx,.xls" 
                            className="hidden" 
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="p-3.5 rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-[#71167F] hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                            title="Import CSV or Excel Register"
                        >
                            {isImporting ? <Loader2 size={20} className="animate-spin text-[#71167F]" /> : <Upload size={20} />}
                        </button>
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

                {/* Import Feedback Banner */}
                {importFeedback && (
                    <div className={cn(
                        "p-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-2",
                        importFeedback.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                    )}>
                        {importFeedback.success ? <Check size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
                        <span>{importFeedback.message}</span>
                    </div>
                )}

                {/* Search Criteria Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-1.5 flex items-center gap-1">
                        <Search size={11} /> Criteria:
                    </span>
                    {SEARCH_CRITERIA.map(crit => (
                        <button
                            key={crit.id}
                            onClick={() => setSearchCriterion(crit.id)}
                            className={cn(
                                "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border",
                                searchCriterion === crit.id
                                    ? "bg-[#71167F] text-white border-[#71167F] shadow-sm shadow-[#71167F]/25"
                                    : "bg-white/80 text-gray-500 border-gray-200/60 hover:bg-gray-100 hover:text-gray-800"
                            )}
                        >
                            {crit.label}
                        </button>
                    ))}
                </div>

                {/* Active Search Summary */}
                {searchTerm && people && (
                    <div className="flex items-center justify-between px-2 pt-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-2">
                            <span>
                                Found <strong className="text-[#71167F] font-black">{people.length}</strong> {people.length === 1 ? 'record' : 'records'} matching &ldquo;<span className="font-bold text-gray-800">{searchTerm}</span>&rdquo;
                                {searchCriterion !== 'all' && (
                                    <span className="ml-1 text-[10px] uppercase font-bold text-[#71167F] bg-[#71167F]/10 px-2 py-0.5 rounded-md border border-[#71167F]/20">
                                        in {SEARCH_CRITERIA.find(c => c.id === searchCriterion)?.label}
                                    </span>
                                )}
                            </span>
                        </div>
                        <button
                            onClick={() => { setSearchTerm(''); setSearchCriterion('all'); }}
                            className="text-[10px] font-black uppercase tracking-widest text-[#71167F] hover:underline"
                        >
                            Clear Search
                        </button>
                    </div>
                )}
            </div>
            


            {/* List Engine */}
            {!people ? (
                <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin mx-auto mb-4" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Loading directory records...</p>
                </div>
            ) : people.length === 0 ? (
                <div className="text-center py-20 bg-white/60 backdrop-blur-sm rounded-[2.5rem] border-2 border-dashed border-gray-200/80 shadow-inner px-6">
                    <div className="bg-[#71167F]/5 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-[#71167F]">
                        <User className="h-10 w-10 opacity-60" />
                    </div>
                    {searchTerm || filterType !== 'all' ? (
                        <>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">No Matching Records</h3>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider max-w-md mx-auto mb-6">
                                We couldn't find any {filterType === 'all' ? 'records' : filterType + 's'} matching your search criteria.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterType('all');
                                }}
                                className="px-6 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Clear Filters & Search
                            </button>
                        </>
                    ) : (
                        <>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Personnel Directory Empty</h3>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider max-w-md mx-auto mb-6">
                                No facilitators or participants have been added yet. Add your first record to begin tracking members and attendance.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => openCreateModal('facilitator')}
                                    className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-[#71167F] hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add Facilitator
                                </button>
                                <button
                                    onClick={() => openCreateModal('participant')}
                                    className="px-5 py-3 rounded-2xl bg-[#71167F] text-white hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md shadow-[#71167F]/20"
                                >
                                    <Plus size={16} />
                                    Add Participant
                                </button>
                            </div>
                        </>
                    )}
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
                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                            {person.form_number && (
                                                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#71167F] border border-purple-200/60 text-[9px] font-black tracking-wide">
                                                    Form #{person.form_number}
                                                </span>
                                            )}
                                            {person.teaching_group && (
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[9px] font-black tracking-wide flex items-center gap-1">
                                                    <Check size={10} strokeWidth={3} /> Teaching Group
                                                </span>
                                            )}
                                            {person.group_form_number && (
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[9px] font-black tracking-wide">
                                                    Group #{person.group_form_number}
                                                </span>
                                            )}
                                        </div>

                                        {person.meeting_time && (
                                            <div className="text-[10px] text-gray-600 font-bold flex items-center gap-1 mt-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-fit">
                                                <Clock size={11} className="text-[#71167F]" />
                                                <span>Meeting: {person.meeting_time}</span>
                                            </div>
                                        )}

                                        {person.type === 'facilitator' && (
                                            <div className="flex flex-col gap-1.5 mt-2">
                                                <div className="text-[9px] font-black text-[#71167F] uppercase tracking-widest flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-all">
                                                    VIEW TEAM <ArrowLeft size={10} className="rotate-180" />
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600">
                                                    <CalendarCheck size={10} />
                                                    {person.qualifyingCount || 0} Certificates Qualifying
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

                            <div className="space-y-2 mt-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                                        <span className="w-1.5 h-1.5 rounded-full hff-gradient-bg" />
                                        {person.place || 'Unspecified Cluster'}
                                    </div>
                                    {(person.affiliation || person.assignedFacilitator?.affiliation) && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100/70" title="Meeting Place / Affiliation">
                                            <MapPin size={11} className="text-[#71167F] shrink-0" />
                                            <span className="truncate max-w-[180px]">
                                                {person.affiliation || person.assignedFacilitator?.affiliation}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {(person.contact || person.assignedFacilitator?.contact) && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 w-fit" title="Contact Phone Number">
                                        <Phone size={11} className="text-emerald-600 shrink-0" />
                                        <span>{person.contact || person.assignedFacilitator?.contact}</span>
                                    </div>
                                )}

                                {person.facilitatorName && (
                                    <div className="text-[10px] font-black text-[#71167F] uppercase tracking-widest flex items-center gap-1.5">
                                        <Briefcase size={12} className="shrink-0" />
                                        <span>Managed by {person.facilitatorName}</span>
                                    </div>
                                )}

                                {person.created_at && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider" title="Date Entered">
                                        <CalendarCheck size={11} className="shrink-0" />
                                        <span>Entered: {formatEnteredDate(person.created_at)}</span>
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
                <div 
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') closeEditor();
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave(e);
                    }}
                >
                    <div className="w-full max-w-3xl liquid-glass-elevated rounded-[2.5rem] border border-white/80 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden relative backdrop-blur-2xl">
                        {/* Specular Top Rim */}
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-white/60 shrink-0 bg-white/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#71167F]/10 text-[#71167F] flex items-center justify-center border border-[#71167F]/20">
                                    {formData.type === 'facilitator' ? <GraduationCap size={18} /> : <UserPlus size={18} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none">
                                            {editorMode === 'edit' ? 'Edit Campaign Record' : 'Add Campaign Record'}
                                        </h3>
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                            formData.type === 'facilitator' ? "bg-[#71167F]/10 text-[#71167F]" : "bg-emerald-500/10 text-emerald-700"
                                        )}>
                                            {formData.type === 'facilitator' ? '👑 Facilitator' : '👤 Participant'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-500 mt-1">
                                        Campaign Hub Direct Database Entry
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeEditor}
                                className="p-2.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-all shrink-0"
                                aria-label="Close editor"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6 overflow-y-auto min-h-0 flex-1">
                            {editorError && (
                                <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>{editorError}</span>
                                </div>
                            )}

                            {duplicateWarning && (
                                <div className="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-extrabold">Possible Duplicate Detected:</span> A record for <span className="underline">{duplicateWarning}</span> is already in the database.
                                    </div>
                                </div>
                            )}

                            {/* TYPE SELECTOR PILL */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Record Type</label>
                                <div className="flex p-1.5 liquid-glass-pill border border-white/80 bg-white/50">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'facilitator', teaching_group: true }))}
                                        className={cn(
                                            "flex-1 py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                                            formData.type === 'facilitator'
                                                ? "liquid-glass-active text-white shadow-md font-black"
                                                : "text-gray-500 hover:text-gray-900 font-bold"
                                        )}
                                    >
                                        <Shield size={14} />
                                        Facilitator (Team Leader)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'participant' }))}
                                        className={cn(
                                            "flex-1 py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                                            formData.type === 'participant'
                                                ? "liquid-glass-active text-white shadow-md font-black"
                                                : "text-gray-500 hover:text-gray-900 font-bold"
                                        )}
                                    >
                                        <Users size={14} />
                                        Participant (Attendee)
                                    </button>
                                </div>
                            </div>

                            {/* PHYSICAL FORM & GROUP ROLE TRACKING */}
                            <div className="liquid-glass rounded-3xl p-5 border border-white/60 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
                                    <FileText size={14} className="text-[#71167F]" />
                                    <span>Form Tracking & Group Role</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Form Number (Physical Paper #)
                                        </label>
                                        <div className="relative flex items-center">
                                            <Hash size={14} className="absolute left-3.5 text-gray-400" />
                                            <input
                                                name="form_number"
                                                value={formData.form_number}
                                                onChange={handleFormChange}
                                                placeholder="e.g. F-104 or 042"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-black text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium mt-1 block">
                                            Physical booklet / form number.
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Will person be teaching a group? *
                                        </label>
                                        <div className="flex p-1 rounded-2xl bg-white/70 border border-gray-200">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, teaching_group: true }))}
                                                className={cn(
                                                    "flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all",
                                                    formData.teaching_group
                                                        ? "bg-emerald-500 text-white shadow-sm font-black"
                                                        : "text-gray-500 hover:text-gray-800 font-bold"
                                                )}
                                            >
                                                <Check size={14} strokeWidth={3} />
                                                Yes (Teaching Group)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, teaching_group: false }))}
                                                className={cn(
                                                    "flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all",
                                                    !formData.teaching_group
                                                        ? "bg-gray-200 text-gray-800 font-black shadow-sm"
                                                        : "text-gray-500 hover:text-gray-800 font-bold"
                                                )}
                                            >
                                                <X size={14} />
                                                No (Attendee)
                                            </button>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium mt-1 block">
                                            {formData.teaching_group 
                                                ? "✓ Person will lead or facilitate a group." 
                                                : "Standard participant attendee."}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 1: IDENTITY & DEMOGRAPHICS */}
                            <div className="liquid-glass rounded-3xl p-5 border border-white/60 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
                                    <User size={14} className="text-[#71167F]" />
                                    <span>Personal Identity</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">First Name *</label>
                                        <input
                                            required
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleFormChange}
                                            placeholder="e.g. Neo"
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Last Name *</label>
                                        <input
                                            required
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleFormChange}
                                            placeholder="e.g. Mogapi"
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Age *</label>
                                        <input
                                            required
                                            name="age"
                                            type="number"
                                            min="1"
                                            max="120"
                                            value={formData.age}
                                            onChange={handleFormChange}
                                            placeholder="e.g. 28"
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Gender *</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, gender: 'M' }))}
                                                className={cn(
                                                    "flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1",
                                                    formData.gender === 'M'
                                                        ? "bg-blue-500/15 text-blue-800 border-blue-400/60 shadow-sm font-black"
                                                        : "bg-white/60 text-gray-500 border-gray-200 hover:bg-white"
                                                )}
                                            >
                                                ♂ Male
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, gender: 'F' }))}
                                                className={cn(
                                                    "flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1",
                                                    formData.gender === 'F'
                                                        ? "bg-pink-500/15 text-pink-800 border-pink-400/60 shadow-sm font-black"
                                                        : "bg-white/60 text-gray-500 border-gray-200 hover:bg-white"
                                                )}
                                            >
                                                ♀ Female
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                                        <div className="relative flex items-center">
                                            <span className="absolute left-3.5 text-xs font-black text-gray-400 select-none">+267</span>
                                            <input
                                                name="contact"
                                                value={formData.contact}
                                                onChange={handleFormChange}
                                                placeholder="71 234 567"
                                                className="w-full pl-14 pr-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: LOCATION & BACKGROUND */}
                            <div className="liquid-glass rounded-3xl p-5 border border-white/60 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
                                    <MapPin size={14} className="text-[#71167F]" />
                                    <span>Location & Background</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Village / Site Name</label>
                                        <input
                                            name="place"
                                            list="known-places-list"
                                            value={formData.place}
                                            onChange={handleFormChange}
                                            placeholder="Type or select site..."
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                        <datalist id="known-places-list">
                                            {knownPlaces.map((pl) => (
                                                <option key={pl} value={pl} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Education Level</label>
                                        <select
                                            name="education"
                                            value={formData.education}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white/90 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Marital Status</label>
                                        <select
                                            name="marital_status"
                                            value={formData.marital_status}
                                            onChange={handleFormChange}
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white/90 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
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
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Occupation</label>
                                        <input
                                            name="occupation"
                                            value={formData.occupation}
                                            onChange={handleFormChange}
                                            placeholder="e.g. Teacher, Self-employed"
                                            className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: CAMPAIGN IMPACT & ALLOCATION */}
                            <div className="liquid-glass rounded-3xl p-5 border border-white/60 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
                                    <Target size={14} className="text-[#71167F]" />
                                    <span>{(formData.type === 'facilitator' || formData.teaching_group) ? 'Facilitator Leadership & Outreach' : 'Participant Enrollment & Materials'}</span>
                                </div>

                                {formData.type === 'participant' && !formData.teaching_group && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                                    Teacher / Group Form Number
                                                </label>
                                                <div className="relative flex items-center">
                                                    <Hash size={14} className="absolute left-3.5 text-gray-400" />
                                                    <input
                                                        name="group_form_number"
                                                        value={formData.group_form_number}
                                                        onChange={handleGroupFormNumberChange}
                                                        placeholder="e.g. F-101"
                                                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                    />
                                                </div>
                                                <span className="text-[9px] text-gray-400 font-medium mt-1 block">
                                                    Auto-matches facilitator by form #.
                                                </span>
                                            </div>

                                            <div className="relative">
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Assigned Facilitator</label>
                                                <input
                                                    type="text"
                                                    value={facSearchTerm}
                                                    onChange={(e) => {
                                                        setFacSearchTerm(e.target.value);
                                                        setFacDropdownOpen(true);
                                                        setFormData(prev => ({ ...prev, facilitator_uuid: '' }));
                                                    }}
                                                    onFocus={() => setFacDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setFacDropdownOpen(false), 250)}
                                                    placeholder="Search facilitator name..."
                                                    className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white/90 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                />
                                                {facDropdownOpen && (
                                                    <div className="absolute z-[100] w-full mt-1.5 liquid-glass-elevated border border-white/80 rounded-2xl shadow-2xl max-h-56 overflow-y-auto backdrop-blur-xl">
                                                        <div 
                                                            className="px-4 py-2.5 hover:bg-black/5 cursor-pointer text-xs font-bold text-gray-500 border-b border-gray-100"
                                                            onMouseDown={() => {
                                                                setFacSearchTerm('');
                                                                setFormData(prev => ({ ...prev, facilitator_uuid: '' }));
                                                                setFacDropdownOpen(false);
                                                            }}
                                                        >
                                                            ✕ Not assigned
                                                        </div>
                                                        {facilitatorOptions
                                                            .filter(opt => {
                                                                const q = facSearchTerm.toLowerCase();
                                                                return (
                                                                    opt.label.toLowerCase().includes(q) ||
                                                                    (opt.form_number && opt.form_number.toLowerCase().includes(q)) ||
                                                                    (opt.contact && opt.contact.toLowerCase().includes(q)) ||
                                                                    (opt.affiliation && opt.affiliation.toLowerCase().includes(q)) ||
                                                                    (opt.meeting_time && opt.meeting_time.toLowerCase().includes(q)) ||
                                                                    (opt.place && opt.place.toLowerCase().includes(q))
                                                                );
                                                            })
                                                            .map(option => (
                                                                <div
                                                                    key={option.uuid}
                                                                    className="px-4 py-2.5 hover:bg-[#71167F]/10 cursor-pointer text-xs font-black text-gray-900 transition-colors flex items-center justify-between"
                                                                    onMouseDown={() => {
                                                                        setFacSearchTerm(option.label);
                                                                        setFormData(prev => ({ 
                                                                            ...prev, 
                                                                            facilitator_uuid: option.uuid,
                                                                            group_form_number: option.form_number || prev.group_form_number
                                                                        }));
                                                                        setFacDropdownOpen(false);
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-5 h-5 rounded-full bg-[#71167F]/10 text-[#71167F] flex items-center justify-center text-[10px] font-black">
                                                                            {option.label[0]}
                                                                        </div>
                                                                        <span>{option.label}</span>
                                                                    </div>
                                                                    {option.form_number && (
                                                                        <span className="text-[10px] text-[#71167F] bg-[#71167F]/10 px-2 py-0.5 rounded-md font-bold">
                                                                            Form #{option.form_number}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        {facSearchTerm && facilitatorOptions.filter(opt => opt.label.toLowerCase().includes(facSearchTerm.toLowerCase())).length === 0 && (
                                                            <div className="px-4 py-3 text-xs text-gray-400 italic font-medium">No matching facilitator found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Affiliation / Group</label>
                                                <input
                                                    name="affiliation"
                                                    value={formData.affiliation}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. Self, Youth Group, Church"
                                                    className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                />
                                            </div>
                                        </div>

                                        {/* Book Distributed Interactive Toggle */}
                                        <div
                                            onClick={() => setFormData(prev => ({ ...prev, books_received: !prev.books_received }))}
                                            className={cn(
                                                "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none",
                                                formData.books_received
                                                    ? "bg-emerald-500/10 border-emerald-400/60 shadow-sm"
                                                    : "bg-white/60 border-gray-200 hover:bg-white"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                    formData.books_received ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 text-gray-400"
                                                )}>
                                                    <BookCheck size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black uppercase tracking-wider text-gray-900">Campaign Book Distributed</div>
                                                    <div className="text-[11px] text-gray-500 font-medium">Mark whether the official curriculum book has been handed to this participant</div>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center border transition-all",
                                                formData.books_received ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white"
                                            )}>
                                                {formData.books_received && <Check size={14} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(formData.type === 'facilitator' || formData.teaching_group) && (
                                    <div className="space-y-4">
                                        {formData.form_number && (
                                            <div className="p-3.5 rounded-2xl bg-[#71167F]/5 border border-[#71167F]/20 text-[#71167F] text-xs font-bold flex items-center gap-2.5">
                                                <FileText size={16} className="shrink-0 text-[#71167F]" />
                                                <span>
                                                    Group Leader Form Reference: <strong className="font-black underline">#{formData.form_number}</strong> — Team participants will link to this form number when registered.
                                                </span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Meeting Place</label>
                                                <div className="relative flex items-center">
                                                    <MapPin size={14} className="absolute left-3.5 text-gray-400" />
                                                    <input
                                                        name="affiliation"
                                                        value={formData.affiliation}
                                                        onChange={handleFormChange}
                                                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                        placeholder="e.g. St Jude Hall, Community Center"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Meeting Time</label>
                                                <div className="relative flex items-center">
                                                    <Clock size={14} className="absolute left-3.5 text-gray-400" />
                                                    <input
                                                        name="meeting_time"
                                                        value={formData.meeting_time}
                                                        onChange={handleFormChange}
                                                        placeholder="e.g. Tuesdays 14:00, or Sundays 10:00 AM"
                                                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Participants Count with Steppers */}
                                            <div className="p-3.5 rounded-2xl bg-white/70 border border-gray-200 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No. of Participants</label>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustNumberField('participants_count', 5, 1)}
                                                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#71167F]/10 text-[#71167F] hover:bg-[#71167F]/20"
                                                        >
                                                            +5
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustNumberField('participants_count', 10, 1)}
                                                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#71167F]/10 text-[#71167F] hover:bg-[#71167F]/20"
                                                        >
                                                            +10
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustNumberField('participants_count', -1, 1)}
                                                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 active:scale-95 transition-all shadow-sm"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        name="participants_count"
                                                        min="1"
                                                        value={formData.participants_count}
                                                        onChange={handleFormChange}
                                                        className="flex-1 py-2 text-center rounded-xl border border-gray-200 bg-white text-base font-black text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustNumberField('participants_count', 1, 1)}
                                                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 active:scale-95 transition-all shadow-sm"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Books Given with Steppers */}
                                            <div className="p-3.5 rounded-2xl bg-white/70 border border-gray-200 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Books Distributed</label>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustNumberField('books_distributed', 5, 0)}
                                                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                                        >
                                                            +5
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustNumberField('books_distributed', 10, 0)}
                                                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                                        >
                                                            +10
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustNumberField('books_distributed', -1, 0)}
                                                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 active:scale-95 transition-all shadow-sm"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        name="books_distributed"
                                                        min="0"
                                                        value={formData.books_distributed}
                                                        onChange={handleFormChange}
                                                        className="flex-1 py-2 text-center rounded-xl border border-gray-200 bg-white text-base font-black text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustNumberField('books_distributed', 1, 0)}
                                                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 active:scale-95 transition-all shadow-sm"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Modal Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/60">
                                <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                                    Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-black/5 border border-black/10 font-mono text-[10px] text-gray-600">Ctrl+Enter</kbd> to save
                                </span>
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={closeEditor}
                                        className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 text-xs font-black uppercase tracking-widest hover:bg-white/80 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editorSubmitting}
                                        className="px-6 py-2.5 rounded-2xl liquid-glass-active text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-[#71167F]/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Check size={14} />
                                        <span>{editorSubmitting ? 'Saving...' : editorMode === 'edit' ? 'Save Changes' : 'Add Campaign Record'}</span>
                                    </button>
                                </div>
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
