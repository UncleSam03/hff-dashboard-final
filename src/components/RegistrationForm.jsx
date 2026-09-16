import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexieDb';

import { Save, Search, User, Check, AlertCircle, FileText, Hash, Clock, Users, MapPin, Phone, X } from 'lucide-react';
import { matchesPerson } from '../lib/searchUtils';

const RegistrationForm = ({ type, onBack, onSaveSuccess, inGroup, predefinedFacilitator, initialData }) => {
    // Form State
    const [formData, setFormData] = useState({
        firstName: initialData?.first_name || '',
        lastName: initialData?.last_name || '',
        age: initialData?.age || '',
        gender: initialData?.gender || '',
        contact: initialData?.contact || '',
        place: initialData?.place || '',
        education: initialData?.education || '',
        maritalStatus: initialData?.marital_status || '',
        affiliation: initialData?.affiliation || '',
        occupation: initialData?.occupation || '',
        participantsCount: initialData?.participants_count || 1,
        booksDistributed: initialData?.books_distributed || 0,
        booksReceived: initialData?.books_received || false,
        formNumber: initialData?.form_number || '',
        teachingGroup: initialData?.teaching_group !== undefined ? initialData.teaching_group : (type === 'facilitator'),
        groupFormNumber: initialData?.group_form_number || '',
        meetingTime: initialData?.meeting_time || '',
    });

    const [selectedFacilitator, setSelectedFacilitator] = useState(predefinedFacilitator || null);
    const [searchTerm, setSearchTerm] = useState('');
    const [facilitatorResults, setFacilitatorResults] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState(null);
    const [duplicateFound, setDuplicateFound] = useState(null);

    // Search for Facilitators (local Dexie search)
    useEffect(() => {
        const searchFacilitators = async () => {
            if (searchTerm.length < 2) {
                setFacilitatorResults([]);
                return;
            }

            try {
                const allFacs = await db.registrations.where('type').equals('facilitator').toArray();
                const results = allFacs.filter(rec => !rec.is_deleted && matchesPerson(rec, searchTerm, 'all'));
                setFacilitatorResults(results);
            } catch (err) {
                console.error("Search error:", err);
            }
        };

        const debounce = setTimeout(searchFacilitators, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm]);

    // Check for duplicates (Admin Side Protection)
    useEffect(() => {
        if (initialData) return; // Don't check if we are already editing

        const checkDuplicates = async () => {
            const fn = formData.firstName.trim().toLowerCase();
            const ln = formData.lastName.trim().toLowerCase();
            const ct = formData.contact.trim();

            if (fn.length < 2 || ln.length < 2) {
                setDuplicateFound(null);
                return;
            }

            try {
                // Search by phone if available
                if (ct.length >= 7) {
                    const match = await db.registrations.where('contact').equals(ct).first();
                    if (match) {
                        setDuplicateFound(match);
                        return;
                    }
                }

                // Search by Name
                const nameMatch = await db.registrations
                    .filter(r => r.type === type && 
                            r.first_name?.toLowerCase() === fn && 
                            r.last_name?.toLowerCase() === ln)
                    .first();
                
                setDuplicateFound(nameMatch || null);
            } catch (err) {
                console.warn("Duplicate check error:", err);
            }
        };

        const debounce = setTimeout(checkDuplicates, 600);
        return () => clearTimeout(debounce);
    }, [formData.firstName, formData.lastName, formData.contact, type, initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleGroupFormNumberChange = async (val) => {
        setFormData(prev => ({ ...prev, groupFormNumber: val }));
        const trimmed = val.trim();
        if (trimmed.length > 0) {
            try {
                const matched = await db.registrations
                    .where('form_number').equals(trimmed)
                    .first();
                if (matched) {
                    setSelectedFacilitator(matched);
                }
            } catch (err) {
                console.error("Error finding facilitator by form number:", err);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            // Validation
            if (!formData.firstName || !formData.lastName) {
                throw new Error("Please fill in all required fields.");
            }

            if (type === 'participant' && inGroup && !selectedFacilitator && !formData.affiliation?.trim()) {
                throw new Error("Please provide an Affiliation / Group name, or link directly to a Facilitator.");
            }

            // Construct Payload
            const now = new Date().toISOString();
            const recordData = {
                first_name: formData.firstName,
                last_name: formData.lastName,
                age: formData.age ? parseInt(formData.age) : null,
                gender: formData.gender || null,
                contact: formData.contact,
                place: formData.place,
                education: formData.education,
                marital_status: formData.maritalStatus,
                affiliation: formData.affiliation,
                occupation: formData.occupation,
                type: type, // 'facilitator' or 'participant'
                // Facilitator specific
                participants_count: type === 'facilitator' ? parseInt(formData.participantsCount) : null,
                books_distributed: type === 'facilitator' ? parseInt(formData.booksDistributed) : null,
                // Participant specific
                facilitator_uuid: (type === 'participant' && inGroup && selectedFacilitator) ? selectedFacilitator.uuid : (initialData?.facilitator_uuid || null),
                books_received: type === 'participant' ? formData.booksReceived : null,

                // Form Tracking & Group Teaching
                form_number: formData.formNumber?.trim() || null,
                teaching_group: Boolean(formData.teachingGroup),
                group_form_number: (type === 'participant' || !formData.teachingGroup) ? (formData.groupFormNumber?.trim() || null) : null,
                meeting_time: (type === 'facilitator' || formData.teachingGroup) ? (formData.meetingTime?.trim() || null) : null,

                // Metadata
                sync_status: 'pending',
                updated_at: now,
            };

            if (initialData) {
                // Update existing record
                await db.registrations.update(initialData.id, recordData);
                setMessage({ type: 'success', text: 'Update Saved to Device.' });
            } else {
                // Save new record
                const newRecord = {
                    ...recordData,
                    id: self.crypto.randomUUID(),
                    uuid: self.crypto.randomUUID(),
                    source: 'pwa_offline',
                    created_at: now,
                };
                await db.registrations.add(newRecord);
                setMessage({ type: 'success', text: 'Saved to Device (Will sync when online).' });
            }

            // Reset Form (only if not editing)
            if (!initialData) {
                setFormData({
                    firstName: '',
                    lastName: '',
                    age: '',
                    gender: '',
                    contact: '',
                    place: '',
                    education: '',
                    maritalStatus: '',
                    affiliation: '',
                    occupation: '',
                    participantsCount: 1,
                    booksDistributed: 0,
                    booksReceived: false,
                    formNumber: '',
                    teachingGroup: type === 'facilitator',
                    groupFormNumber: '',
                    meetingTime: '',
                });
                setSelectedFacilitator(null);
                setSearchTerm('');
            }

            // Notify Parent
            if (onSaveSuccess) setTimeout(onSaveSuccess, 1500);

        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to save record.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">
                        {type === 'facilitator' ? 'Facilitator Registration' : 'Participant Registration'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {type === 'participant' && inGroup ? 'Registering as part of a group' : 'Standard offline entry'}
                    </p>
                </div>
                <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    Cancel
                </button>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <span className="font-medium text-sm">{message.text}</span>
                </div>
            )}

            {duplicateFound && !initialData && (
                <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-300">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                            <AlertCircle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest mb-1 leading-none">Potential Duplicate Detected</h4>
                            <p className="text-sm text-amber-800 font-medium">
                                A {duplicateFound.type} record for <strong>{duplicateFound.first_name} {duplicateFound.last_name}</strong> already exists in local storage ({duplicateFound.place || 'Location Unknown'}).
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-2">
                        <button 
                            type="button"
                            onClick={() => {
                                // Simulate editing the found record
                                window.location.reload(); // Hard reset for now, or we could pass it up
                            }}
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md active:scale-95"
                        >
                            View Existing
                        </button>
                        <button 
                            type="button"
                            onClick={() => setDuplicateFound(null)}
                            className="bg-white text-amber-600 border border-amber-200 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                        >
                            Ignore & Create New
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* --- Facilitator Search (For Participants) --- */}
                {type === 'participant' && (
                    <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-100 space-y-3">
                        <label className="block text-xs font-bold uppercase tracking-wider text-purple-900">
                            Link to Group Teacher / Facilitator {!predefinedFacilitator && <span className="text-purple-600 font-normal normal-case text-xs ml-1">(Optional if Affiliation is provided)</span>}
                        </label>

                        {/* Direct Teacher Form # Lookup */}
                        <div>
                            <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                                Teacher's Form Number (Auto-Links Facilitator)
                            </label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-purple-400" />
                                <input
                                    type="text"
                                    value={formData.groupFormNumber}
                                    onChange={(e) => handleGroupFormNumberChange(e.target.value)}
                                    placeholder="e.g. HFF-2026-012"
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono"
                                />
                            </div>
                        </div>

                        {predefinedFacilitator ? (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 p-2 rounded-full">
                                        <User className="h-4 w-4 text-purple-700" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">{predefinedFacilitator.first_name} {predefinedFacilitator.last_name}</div>
                                        <div className="text-xs text-gray-500">Linked Facilitator</div>
                                    </div>
                                </div>
                            </div>
                        ) : !selectedFacilitator ? (
                            <div className="relative">
                                <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                                    Search Facilitator by Name, Form #, Phone, Meeting Place, or Time
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search facilitator by name, form #, phone, meeting place/time..."
                                        className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2.5 top-2.5 p-0.5 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
                                            title="Clear search"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {facilitatorResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
                                        {facilitatorResults.map(fac => (
                                            <button
                                                key={fac.uuid}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFacilitator(fac);
                                                    setSearchTerm('');
                                                    if (fac.form_number) {
                                                        setFormData(prev => ({ ...prev, groupFormNumber: fac.form_number }));
                                                    }
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-b-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-purple-100 p-2 rounded-full shrink-0">
                                                        <User className="h-4 w-4 text-purple-700" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm">{fac.first_name} {fac.last_name}</div>
                                                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                                                            {(fac.affiliation || fac.place) && (
                                                                <span className="flex items-center gap-1 text-purple-800 font-medium">
                                                                    <MapPin size={10} />
                                                                    {fac.affiliation || fac.place}
                                                                </span>
                                                            )}
                                                            {fac.contact && (
                                                                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                                                    <Phone size={10} />
                                                                    {fac.contact}
                                                                </span>
                                                            )}
                                                            {fac.meeting_time && (
                                                                <span className="flex items-center gap-1 text-gray-600 font-medium">
                                                                    <Clock size={10} />
                                                                    {fac.meeting_time}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {fac.form_number && (
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold border border-purple-200 shrink-0 ml-2">
                                                        Form #{fac.form_number}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-full">
                                        <Check className="h-4 w-4 text-green-700" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                            {selectedFacilitator.first_name} {selectedFacilitator.last_name}
                                            {selectedFacilitator.form_number && (
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-bold">
                                                    Form #{selectedFacilitator.form_number}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">Selected Facilitator {selectedFacilitator.place ? `• ${selectedFacilitator.place}` : ''}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFacilitator(null)}
                                    className="text-xs text-red-600 hover:text-red-700 font-bold uppercase tracking-wider"
                                >
                                    Change
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Form Tracking & Group Teaching Role --- */}
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-100/80 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
                        <FileText className="w-4 h-4 text-purple-700" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-purple-900">Form Tracking & Group Role</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-purple-900 mb-1">
                                Form Number (Physical ID)
                            </label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-purple-400" />
                                <input
                                    type="text"
                                    name="formNumber"
                                    value={formData.formNumber}
                                    onChange={handleChange}
                                    placeholder="e.g. HFF-2026-042"
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono"
                                />
                            </div>
                            <p className="text-[11px] text-purple-600 mt-1">Unique tracking number from the printed questionnaire</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-purple-900 mb-1">
                                Will this person teach a group?
                            </label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, teachingGroup: true }))}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${formData.teachingGroup ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-purple-200 hover:bg-purple-100/50'}`}
                                >
                                    <Check className={`w-3.5 h-3.5 ${formData.teachingGroup ? 'opacity-100' : 'opacity-0'}`} />
                                    Yes (Teaching)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, teachingGroup: false }))}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${!formData.teachingGroup ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-purple-200 hover:bg-purple-100/50'}`}
                                >
                                    <Check className={`w-3.5 h-3.5 ${!formData.teachingGroup ? 'opacity-100' : 'opacity-0'}`} />
                                    No (Participant)
                                </button>
                            </div>
                            <p className="text-[11px] text-purple-600 mt-1">Designates if this person leads their own study group</p>
                        </div>
                    </div>
                </div>

                {/* --- Common Fields --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                        <input
                            required
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="e.g. John"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                        <input
                            required
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="e.g. Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                        <input
                            type="number"
                            name="age"
                            min="1"
                            max="120"
                            value={formData.age}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Age"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
                        >
                            <option value="">Select Gender</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                        <select
                            name="education"
                            value={formData.education}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                        <select
                            name="maritalStatus"
                            value={formData.maritalStatus}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
                        >
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Cohabiting">Cohabiting</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {type === 'participant' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Affiliation / Group (e.g. Church, School)
                                {inGroup && !selectedFacilitator && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                                type="text"
                                name="affiliation"
                                value={formData.affiliation}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                placeholder="Group name"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Place</label>
                            <input
                                type="text"
                                name="affiliation"
                                value={formData.affiliation}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                placeholder="e.g. St Jude Hall, Community Center"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                        <input
                            type="text"
                            name="occupation"
                            value={formData.occupation}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="e.g. Teacher, Farmer"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone / Contact</label>
                        <input
                            type="tel"
                            name="contact"
                            value={formData.contact}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Mobile Number"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Village / Site Name</label>
                        <input
                            type="text"
                            name="place"
                            value={formData.place}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Location"
                        />
                    </div>
                </div>

                {/* --- Facilitator Leadership & Outreach --- */}
                {(type === 'facilitator' || formData.teachingGroup) && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Facilitator Leadership & Outreach</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No. of Participants</label>
                                <input
                                    type="number"
                                    name="participantsCount"
                                    min="1"
                                    value={formData.participantsCount}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Books Given</label>
                                <input
                                    type="number"
                                    name="booksDistributed"
                                    min="0"
                                    value={formData.booksDistributed}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Time / Schedule</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    name="meetingTime"
                                    value={formData.meetingTime}
                                    onChange={handleChange}
                                    placeholder="e.g. Tuesdays at 6:00 PM, Sundays after service"
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all text-sm"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">Designated weekly meeting time for the group they teach</p>
                        </div>
                    </div>
                )}

                {/* --- Participant Specific Books (New) --- */}
                {type === 'participant' && (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <input
                            type="checkbox"
                            id="booksReceived"
                            name="booksReceived"
                            checked={formData.booksReceived}
                            onChange={(e) => setFormData(prev => ({ ...prev, booksReceived: e.target.checked }))}
                            className="h-5 w-5 rounded border-gray-300 text-hff-primary focus:ring-hff-primary/20"
                        />
                        <label htmlFor="booksReceived" className="text-sm font-semibold text-gray-700 cursor-pointer">
                            Campaign Book Distributed
                        </label>
                    </div>
                )}

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-hff-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-hff-primary/90 transition-all shadow-lg shadow-hff-primary/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <Save className="h-5 w-5" />
                        {isSubmitting ? 'Saving...' : 'Save Registration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
