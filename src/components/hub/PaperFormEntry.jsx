import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from '../../lib/campaignManager';
import { useAuth } from '../../auth/AuthContext';
import { 
    FileText, 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    Trash2, 
    Check, 
    CheckCheck, 
    Save, 
    User, 
    UserPlus, 
    Sparkles, 
    AlertCircle, 
    Clock, 
    Phone, 
    MapPin, 
    Users, 
    Search,
    Shield,
    Zap,
    RotateCcw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TOTAL_CAMPAIGN_FORMS, normalizeFormNumber } from '../../lib/formRangeManager';
import { TOTAL_CAMPAIGN_DAYS } from '../../lib/constants';
import { getProfileBufferTabName, pushProfileBufferToSheets } from '../../lib/sheetsBufferSync';

const SPRINTS = [
    { id: 'sprint1', label: 'Sprint 1 (Days 1–4)', days: [0, 1, 2, 3], dayLabels: ['D1', 'D2', 'D3', 'D4'] },
    { id: 'sprint2', label: 'Sprint 2 (Days 5–9)', days: [4, 5, 6, 7, 8], dayLabels: ['D5', 'D6', 'D7', 'D8', 'D9'] },
    { id: 'sprint3', label: 'Sprint 3 (Days 10–12)', days: [9, 10, 11], dayLabels: ['D10', 'D11', 'D12'] }
];

export default function PaperFormEntry({ initialFormNumber = 1, onNavigateToAdminAudit }) {
    const { user, profile, isMasterAdmin } = useAuth();
    const activeCampId = getActiveCampaignId() || DEFAULT_CAMPAIGN.uuid;

    // Admin's assigned range from profile or default
    const assignedStart = profile?.form_range_start || 1;
    const assignedEnd = profile?.form_range_end || 50;

    const [formNumber, setFormNumber] = useState(initialFormNumber || assignedStart);
    const [selectedSprintId, setSelectedSprintId] = useState('sprint1');
    const [statusMessage, setStatusMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // New participant row being typed
    const [draftRows, setDraftRows] = useState([createEmptyRow()]);
    const loadedFormRef = useRef(null);

    // Quick facilitator creation form
    const [showFacilitatorModal, setShowFacilitatorModal] = useState(false);
    const [facForm, setFacForm] = useState({
        firstName: '',
        lastName: '',
        gender: 'F',
        contact: '',
        place: '',
        participantsCount: 10
    });

    const activeSprint = useMemo(() => 
        SPRINTS.find(s => s.id === selectedSprintId) || SPRINTS[0]
    , [selectedSprintId]);

    function createEmptyRow() {
        return {
            tempId: 'draft-' + Math.random().toString(36).substring(2, 9),
            firstName: '',
            lastName: '',
            gender: 'F',
            age: '',
            contact: '',
            attendance: Array(TOTAL_CAMPAIGN_DAYS).fill(false),
            isExisting: false,
            isDirty: false
        };
    }

    // Query registrations for the active campaign from Dexie
    const campaignRegistrations = useLiveQuery(async () => {
        const all = await db.registrations.toArray();
        return all.filter(r => !r.is_deleted && (r.campaign_id === activeCampId || !r.campaign_id));
    }, [activeCampId]) || [];

    // Identify facilitator for the current form
    const currentFacilitator = useMemo(() => {
        const num = normalizeFormNumber(formNumber);
        if (!num) return null;
        return campaignRegistrations.find(r => 
            r.type === 'facilitator' && normalizeFormNumber(r.form_number) === num
        ) || null;
    }, [campaignRegistrations, formNumber]);

    // Existing participants already in DB for this form
    const existingParticipants = useMemo(() => {
        const num = normalizeFormNumber(formNumber);
        if (!num) return [];
        return campaignRegistrations.filter(r => 
            r.type === 'participant' && normalizeFormNumber(r.group_form_number || r.form_number) === num
        );
    }, [campaignRegistrations, formNumber]);

    // Map a DB participant record to a draft row object
    const mapParticipantToRow = (p) => ({
        id: p.id,
        uuid: p.uuid,
        tempId: p.uuid || ('existing-' + p.id),
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        gender: p.gender || 'F',
        age: p.age ?? '',
        contact: p.contact || '',
        facilitator_uuid: p.facilitator_uuid || null,
        attendance: Array.isArray(p.attendance) ? [...p.attendance] : Array(TOTAL_CAMPAIGN_DAYS).fill(false),
        isExisting: true,
        isDirty: false
    });

    // When formNumber changes, preload any existing participants or prepare a fresh draft row.
    // If existingParticipants updates in the background for the SAME formNumber, preserve unsaved drafts & dirty edits!
    useEffect(() => {
        const num = normalizeFormNumber(formNumber);
        const formChanged = loadedFormRef.current !== num;
        loadedFormRef.current = num;

        if (formChanged) {
            if (existingParticipants.length > 0) {
                setDraftRows(existingParticipants.map(mapParticipantToRow));
            } else {
                setDraftRows([createEmptyRow()]);
            }
            setStatusMessage(null);
            return;
        }

        // Same formNumber, background update of existingParticipants:
        setDraftRows(prev => {
            const unsavedDrafts = prev.filter(r => !r.isExisting && (r.firstName.trim() || r.lastName.trim() || r.contact.trim() || String(r.age).trim()));
            const dirtyByUuid = new Map();
            const dirtyById = new Map();
            prev.forEach(r => {
                if (r.isExisting && r.isDirty) {
                    if (r.uuid) dirtyByUuid.set(r.uuid, r);
                    if (r.id) dirtyById.set(r.id, r);
                }
            });

            const mergedExisting = existingParticipants.map(p => {
                const dirty = (p.uuid && dirtyByUuid.get(p.uuid)) || (p.id && dirtyById.get(p.id));
                return dirty ? dirty : mapParticipantToRow(p);
            });

            if (mergedExisting.length > 0 || unsavedDrafts.length > 0) {
                return [...mergedExisting, ...unsavedDrafts];
            }
            // Keep current empty draft rows if user added blank rows
            const blankDrafts = prev.filter(r => !r.isExisting);
            return blankDrafts.length > 0 ? blankDrafts : [createEmptyRow()];
        });
    }, [formNumber, existingParticipants]);

    // Add a new row to draft
    const handleAddRow = () => {
        setDraftRows(prev => [...prev, createEmptyRow()]);
    };

    // Remove row
    const handleRemoveRow = async (index, row) => {
        if (row.isExisting && row.id) {
            if (!window.confirm(`Delete ${row.firstName} ${row.lastName} from Form #${formNumber}?`)) return;
            try {
                await db.registrations.update(row.id, {
                    is_deleted: true,
                    sync_status: 'pending',
                    updated_at: new Date().toISOString()
                });
                window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            } catch (err) {
                console.error('[PaperFormEntry] Error deleting row:', err);
            }
        }
        setDraftRows(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.length > 0 ? next : [createEmptyRow()];
        });
    };

    // Update row field
    const handleFieldChange = (index, field, value) => {
        setDraftRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value, isDirty: true };
            return updated;
        });
    };

    // Toggle single attendance day for row
    const handleToggleAttendance = (rowIndex, dayIdx) => {
        setDraftRows(prev => {
            const updated = [...prev];
            const currentAtt = Array.isArray(updated[rowIndex].attendance) 
                ? [...updated[rowIndex].attendance] 
                : Array(TOTAL_CAMPAIGN_DAYS).fill(false);
            currentAtt[dayIdx] = !currentAtt[dayIdx];
            updated[rowIndex] = { ...updated[rowIndex], attendance: currentAtt, isDirty: true };
            return updated;
        });
    };

    // Toggle all sprint days for row
    const handleToggleAllSprintDays = (rowIndex) => {
        setDraftRows(prev => {
            const updated = [...prev];
            const currentAtt = Array.isArray(updated[rowIndex].attendance) 
                ? [...updated[rowIndex].attendance] 
                : Array(TOTAL_CAMPAIGN_DAYS).fill(false);
            
            // Check if all days in current sprint are true
            const allSprintTrue = activeSprint.days.every(d => currentAtt[d]);
            const targetVal = !allSprintTrue;

            for (const d of activeSprint.days) {
                currentAtt[d] = targetVal;
            }
            updated[rowIndex] = { ...updated[rowIndex], attendance: currentAtt, isDirty: true };
            return updated;
        });
    };

    // Mark all rows in the table as present for the active sprint
    const handleMarkAllRowsPresent = () => {
        setDraftRows(prev => prev.map(row => {
            const currentAtt = Array.isArray(row.attendance) 
                ? [...row.attendance] 
                : Array(TOTAL_CAMPAIGN_DAYS).fill(false);
            for (const d of activeSprint.days) {
                currentAtt[d] = true;
            }
            return { ...row, attendance: currentAtt, isDirty: true };
        }));
    };

    // Handle Quick Facilitator Creation
    const handleCreateFacilitator = async (e) => {
        e.preventDefault();
        const num = normalizeFormNumber(formNumber);
        if (!num) return;
        if (!facForm.firstName.trim() || !facForm.lastName.trim()) {
            alert('Please provide facilitator first and last name.');
            return;
        }

        const now = new Date().toISOString();
        const facUuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : ('fac-' + Date.now().toString(36));

        try {
            await db.registrations.add({
                uuid: facUuid,
                first_name: facForm.firstName.trim(),
                last_name: facForm.lastName.trim(),
                gender: facForm.gender || 'F',
                contact: facForm.contact.trim() || '',
                place: facForm.place.trim() || '',
                participants_count: parseInt(facForm.participantsCount, 10) || 10,
                type: 'facilitator',
                form_number: String(num),
                campaign_id: activeCampId,
                is_daily_core: true,
                sync_status: 'pending',
                created_at: now,
                updated_at: now,
                created_by_uid: user?.uid || null,
                created_by_name: profile?.full_name || user?.displayName || user?.email || 'Admin',
                created_by_email: user?.email || null,
                submission_source: 'paper_batch_entry'
            });

            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            setShowFacilitatorModal(false);
            setFacForm({ firstName: '', lastName: '', gender: 'F', contact: '', place: '', participantsCount: 10 });
            setStatusMessage({ type: 'success', text: `Facilitator assigned to Form #${num}!` });
        } catch (err) {
            console.error('[PaperFormEntry] Error creating facilitator:', err);
            alert('Failed to save facilitator: ' + err.message);
        }
    };

    // Save entire form and all its participants
    const handleSaveForm = async (andAdvance = false) => {
        const num = normalizeFormNumber(formNumber);
        if (!num) {
            setStatusMessage({ type: 'error', text: `Please enter a valid form number (1 to ${TOTAL_CAMPAIGN_FORMS}).` });
            return;
        }

        const validRows = draftRows.filter(r => r.firstName.trim() || r.lastName.trim());
        if (validRows.length === 0) {
            setStatusMessage({ type: 'warning', text: 'No participants entered yet on this form.' });
            return;
        }

        setIsSaving(true);
        setStatusMessage(null);
        const now = new Date().toISOString();
        let writtenCount = 0;

        try {
            await db.transaction('rw', db.registrations, async () => {
                for (const row of validRows) {
                    const targetFacUuid = currentFacilitator?.uuid || row.facilitator_uuid || null;
                    const recordData = {
                        first_name: row.firstName.trim(),
                        last_name: row.lastName.trim(),
                        gender: row.gender || 'F',
                        age: row.age ? parseInt(row.age, 10) || row.age : null,
                        contact: row.contact.trim() || null,
                        type: 'participant',
                        group_form_number: String(num),
                        facilitator_uuid: targetFacUuid,
                        attendance: Array.isArray(row.attendance) ? row.attendance : Array(TOTAL_CAMPAIGN_DAYS).fill(false),
                        campaign_id: activeCampId,
                        is_daily_core: false,
                        sync_status: 'pending',
                        updated_at: now,
                        updated_by_uid: user?.uid || null,
                        updated_by_name: profile?.full_name || user?.displayName || user?.email || 'Admin',
                        updated_by_email: user?.email || null,
                    };

                    if (row.isExisting && row.id) {
                        const facChanged = targetFacUuid && row.facilitator_uuid !== targetFacUuid;
                        if (row.isDirty || facChanged) {
                            await db.registrations.update(row.id, recordData);
                            writtenCount++;
                        }
                    } else {
                        const newUuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : ('part-' + Math.random().toString(36).substring(2));
                        await db.registrations.add({
                            ...recordData,
                            uuid: newUuid,
                            created_at: now,
                            created_by_uid: user?.uid || null,
                            created_by_name: profile?.full_name || user?.displayName || user?.email || 'Admin',
                            created_by_email: user?.email || null,
                            submission_source: 'paper_batch_entry'
                        });
                        writtenCount++;
                    }
                }
            });

            // Clear dirty flags locally so subsequent saves don't re-push
            setDraftRows(prev => prev.map(r => ({ ...r, isDirty: false })));

            if (writtenCount > 0) {
                // Trigger debounced sync to Firebase in background
                window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
                // Mirror this profile's records to their isolated Google Sheet tab in background
                pushProfileBufferToSheets({ profile, user }).catch(err => {
                    console.warn('[PaperFormEntry] Background Google Sheets buffer push skipped:', err.message);
                });
            }

            setStatusMessage({ 
                type: 'success', 
                text: `Form #${num} saved successfully (${validRows.length} participants) — synced to ${getProfileBufferTabName(profile, user)}!` 
            });

            if (andAdvance && num < TOTAL_CAMPAIGN_FORMS) {
                setTimeout(() => {
                    setFormNumber(num + 1);
                }, 400);
            }
        } catch (err) {
            console.error('[PaperFormEntry] Error saving form:', err);
            setStatusMessage({ type: 'error', text: 'Error saving form: ' + err.message });
        } finally {
            setIsSaving(false);
        }
    };

    // Keyboard navigation (Enter on row inputs)
    const handleKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Enter = Save & Next Form
                handleSaveForm(true);
                return;
            }
            if (index === draftRows.length - 1) {
                // Add new row if on last row
                handleAddRow();
            }
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
            {/* Top Control Bar */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#71167F]/10 text-[#71167F] flex items-center justify-center shrink-0">
                        <FileText size={26} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#71167F]">
                                Field Form Transcription
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs font-bold text-gray-500">
                                Assigned Range: Forms <strong className="text-gray-900">{assignedStart}–{assignedEnd}</strong>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
                                Sheet Tab: {getProfileBufferTabName(profile, user)}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Paper Form Batch Entry
                        </h2>
                    </div>
                </div>

                {/* Form Navigation Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setFormNumber(prev => Math.max(1, prev - 1))}
                        disabled={formNumber <= 1}
                        className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-all"
                        title="Previous Form"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-200">
                        <span className="text-xs font-black uppercase text-gray-400">Form #</span>
                        <input
                            type="number"
                            min="1"
                            max={TOTAL_CAMPAIGN_FORMS}
                            value={formNumber}
                            onChange={(e) => setFormNumber(parseInt(e.target.value, 10) || 1)}
                            className="w-16 bg-white border border-gray-200 rounded-xl px-2 py-1 text-center font-black text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                        />
                        <span className="text-xs font-bold text-gray-400">/ {TOTAL_CAMPAIGN_FORMS}</span>
                    </div>

                    <button
                        onClick={() => setFormNumber(prev => Math.min(TOTAL_CAMPAIGN_FORMS, prev + 1))}
                        disabled={formNumber >= TOTAL_CAMPAIGN_FORMS}
                        className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-all"
                        title="Next Form"
                    >
                        <ChevronRight size={20} />
                    </button>

                    {/* Sprint Selector */}
                    <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                        {SPRINTS.map(sprint => (
                            <button
                                key={sprint.id}
                                onClick={() => setSelectedSprintId(sprint.id)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                                    selectedSprintId === sprint.id
                                        ? "bg-white text-[#71167F] shadow-sm"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                {sprint.label}
                            </button>
                        ))}
                    </div>

                    {isMasterAdmin && onNavigateToAdminAudit && (
                        <button
                            onClick={onNavigateToAdminAudit}
                            className="px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200/60 font-black text-xs hover:bg-amber-100 transition-all flex items-center gap-1.5"
                        >
                            <Shield size={14} className="text-amber-600" />
                            <span>Master Form Audit</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Facilitator Card for This Form */}
            <div className={cn(
                "rounded-3xl p-6 border transition-all",
                currentFacilitator 
                    ? "bg-emerald-50/50 border-emerald-100 shadow-sm" 
                    : "bg-amber-50/60 border-amber-200/80"
            )}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                            currentFacilitator ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                        )}>
                            <User size={24} />
                        </div>
                        <div>
                            {currentFacilitator ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                            Facilitator Linked
                                        </span>
                                        <span className="text-xs font-bold text-gray-500">• Form #{formNumber}</span>
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 mt-0.5">
                                        {currentFacilitator.first_name} {currentFacilitator.last_name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-600 mt-1">
                                        {currentFacilitator.contact && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={13} className="text-gray-400" />
                                                {currentFacilitator.contact}
                                            </span>
                                        )}
                                        {currentFacilitator.place && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={13} className="text-gray-400" />
                                                {currentFacilitator.place}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Users size={13} className="text-gray-400" />
                                            Target: {currentFacilitator.participants_count || '10'} participants
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900">
                                            No Facilitator Linked
                                        </span>
                                        <span className="text-xs font-bold text-amber-700">• Form #{formNumber}</span>
                                    </div>
                                    <h3 className="text-base font-black text-gray-900 mt-0.5">
                                        Form #{formNumber} is not yet attached to a facilitator record.
                                    </h3>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                        You can still transcribe participants now, or register the facilitator right here.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {!currentFacilitator && (
                        <button
                            onClick={() => setShowFacilitatorModal(true)}
                            className="px-4 py-2.5 rounded-2xl bg-[#71167F] text-white hover:bg-[#5a1166] text-xs font-black uppercase tracking-wider shadow-md shadow-[#71167F]/20 flex items-center gap-2 shrink-0 self-start md:self-auto"
                        >
                            <UserPlus size={16} />
                            <span>Assign Facilitator to Form #{formNumber}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Facilitator Registration Inline Modal */}
            {showFacilitatorModal && (
                <div className="bg-white rounded-3xl p-6 border-2 border-[#71167F]/30 shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                        <div className="flex items-center gap-2">
                            <UserPlus className="text-[#71167F]" size={20} />
                            <h4 className="text-base font-black text-gray-900">
                                Register Facilitator for Form #{formNumber}
                            </h4>
                        </div>
                        <button 
                            onClick={() => setShowFacilitatorModal(false)}
                            className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                        >
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleCreateFacilitator} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">First Name</label>
                            <input
                                type="text"
                                required
                                value={facForm.firstName}
                                onChange={e => setFacForm(f => ({ ...f, firstName: e.target.value }))}
                                placeholder="e.g. Neo"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Last Name</label>
                            <input
                                type="text"
                                required
                                value={facForm.lastName}
                                onChange={e => setFacForm(f => ({ ...f, lastName: e.target.value }))}
                                placeholder="e.g. Kgosi"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Gender</label>
                            <select
                                value={facForm.gender}
                                onChange={e => setFacForm(f => ({ ...f, gender: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            >
                                <option value="F">Female (F)</option>
                                <option value="M">Male (M)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Phone / Contact</label>
                            <input
                                type="text"
                                value={facForm.contact}
                                onChange={e => setFacForm(f => ({ ...f, contact: e.target.value }))}
                                placeholder="e.g. 71234567"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">WDC / Ward / Village</label>
                            <input
                                type="text"
                                value={facForm.place}
                                onChange={e => setFacForm(f => ({ ...f, place: e.target.value }))}
                                placeholder="e.g. Phikwe Central / Ikageleng"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Expected Group Size</label>
                            <input
                                type="number"
                                value={facForm.participantsCount}
                                onChange={e => setFacForm(f => ({ ...f, participantsCount: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                className="w-full py-2.5 rounded-xl bg-[#71167F] text-white hover:bg-[#5a1166] text-xs font-black uppercase tracking-wider shadow-md"
                            >
                                Save Facilitator
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Notification / Toast Message */}
            {statusMessage && (
                <div className={cn(
                    "px-4 py-3 rounded-2xl border text-xs font-bold flex items-center justify-between",
                    statusMessage.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800",
                    statusMessage.type === 'error' && "bg-red-50 border-red-200 text-red-800",
                    statusMessage.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800"
                )}>
                    <span>{statusMessage.text}</span>
                    <button 
                        onClick={() => setStatusMessage(null)}
                        className="text-gray-400 hover:text-gray-700 font-bold ml-2"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Participants High-Speed Batch Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
                    <div>
                        <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                            <span>Form #{formNumber} Participants</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-[#71167F]/10 text-[#71167F] text-xs font-bold">
                                {draftRows.filter(r => r.firstName.trim()).length} Entered
                            </span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Type names directly. Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Enter</kbd> to add rows.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleMarkAllRowsPresent}
                            className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-all"
                            title="Check all attendance boxes for the active sprint"
                        >
                            <CheckCheck size={14} />
                            <span>Mark All Present ({activeSprint.dayLabels.join(', ')})</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={14} />
                            <span>Add Row</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100">
                            <tr>
                                <th className="py-3 px-3 w-12 text-center">#</th>
                                <th className="py-3 px-3 min-w-[140px]">First Name</th>
                                <th className="py-3 px-3 min-w-[140px]">Last Name</th>
                                <th className="py-3 px-2 w-20 text-center">Gender</th>
                                <th className="py-3 px-2 w-20 text-center">Age</th>
                                <th className="py-3 px-3 min-w-[120px]">Phone</th>
                                
                                {/* Sprint Attendance Columns */}
                                <th className="py-3 px-3 text-center min-w-[180px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Attendance ({activeSprint.label})</span>
                                    </div>
                                </th>
                                <th className="py-3 px-2 w-12 text-center">Del</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {draftRows.map((row, index) => {
                                const rowAtt = Array.isArray(row.attendance) ? row.attendance : [];
                                const allSprintPresent = activeSprint.days.every(d => rowAtt[d]);

                                return (
                                    <tr key={row.tempId || index} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-2.5 px-3 text-center text-xs font-mono font-bold text-gray-400">
                                            {index + 1}
                                        </td>
                                        
                                        {/* First Name */}
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={row.firstName}
                                                onChange={e => handleFieldChange(index, 'firstName', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="First name"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Last Name */}
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={row.lastName}
                                                onChange={e => handleFieldChange(index, 'lastName', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="Last name"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Gender */}
                                        <td className="py-2 px-2 text-center">
                                            <select
                                                value={row.gender || 'F'}
                                                onChange={e => handleFieldChange(index, 'gender', e.target.value)}
                                                className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            >
                                                <option value="F">F</option>
                                                <option value="M">M</option>
                                            </select>
                                        </td>

                                        {/* Age */}
                                        <td className="py-2 px-2 text-center">
                                            <input
                                                type="number"
                                                value={row.age || ''}
                                                onChange={e => handleFieldChange(index, 'age', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="Age"
                                                className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Phone */}
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={row.contact || ''}
                                                onChange={e => handleFieldChange(index, 'contact', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="71234567"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Sprint Attendance Checkboxes */}
                                        <td className="py-2 px-3">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* All Sprint Quick Toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleAllSprintDays(index)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-md text-[10px] font-black uppercase transition-all",
                                                        allSprintPresent 
                                                            ? "bg-emerald-600 text-white" 
                                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                    )}
                                                    title="Toggle All Days for this Sprint"
                                                >
                                                    All
                                                </button>

                                                {/* Individual day buttons */}
                                                {activeSprint.days.map((dayIdx, dOffset) => {
                                                    const isPresent = Boolean(rowAtt[dayIdx]);
                                                    return (
                                                        <button
                                                            key={dayIdx}
                                                            type="button"
                                                            onClick={() => handleToggleAttendance(index, dayIdx)}
                                                            className={cn(
                                                                "w-7 h-7 rounded-lg text-xs font-black transition-all flex items-center justify-center",
                                                                isPresent 
                                                                    ? "bg-emerald-500 text-white shadow-sm" 
                                                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                                            )}
                                                        >
                                                            {activeSprint.dayLabels[dOffset]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        {/* Delete Row */}
                                        <td className="py-2 px-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(index, row)}
                                                className="p-1.5 text-gray-300 hover:text-red-600 rounded-lg transition-colors"
                                                title="Delete Row"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer with Save Buttons */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-gray-500">
                        Shortcuts: <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">Enter</kbd> = Next row • <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">Ctrl+Enter</kbd> = Save & Advance
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => handleSaveForm(false)}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2"
                        >
                            <Save size={16} />
                            <span>Save Form #{formNumber}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSaveForm(true)}
                            disabled={isSaving}
                            className="px-6 py-2.5 rounded-2xl bg-[#71167F] text-white hover:bg-[#5a1166] text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#71167F]/20 flex items-center gap-2"
                        >
                            <Zap size={16} />
                            <span>Save & Next Form →</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
