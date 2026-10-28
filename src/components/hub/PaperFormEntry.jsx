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
    RotateCcw,
    Pencil,
    Link2,
    Unlink,
    X,
    Hash
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TOTAL_CAMPAIGN_FORMS, normalizeFormNumber } from '../../lib/formRangeManager';
import { TOTAL_CAMPAIGN_DAYS } from '../../lib/constants';
import { getProfileBufferTabName, pushProfileBufferToSheets } from '../../lib/sheetsBufferSync';
import { matchesPerson } from '../../lib/searchUtils';

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

    // Quick facilitator selection / creation / edit modal
    const [showFacilitatorModal, setShowFacilitatorModal] = useState(false);
    const [facilitatorModalMode, setFacilitatorModalMode] = useState('select'); // 'select' | 'create' | 'edit'
    const [facSearchQuery, setFacSearchQuery] = useState('');
    const [includeParticipantsInFacSearch, setIncludeParticipantsInFacSearch] = useState(false);
    const [facForm, setFacForm] = useState({
        firstName: '',
        lastName: '',
        age: '',
        gender: 'F',
        contact: '',
        place: '',
        affiliation: '',
        meetingTime: '',
        education: '',
        maritalStatus: '',
        occupation: '',
        participantsCount: 10,
        booksDistributed: 0
    });

    const activeSprint = useMemo(() => 
        SPRINTS.find(s => s.id === selectedSprintId) || SPRINTS[0]
    , [selectedSprintId]);

    function createEmptyRow(defaultPlace = '', defaultAffiliation = '') {
        return {
            tempId: 'draft-' + Math.random().toString(36).substring(2, 9),
            firstName: '',
            lastName: '',
            gender: 'F',
            age: '',
            contact: '',
            place: defaultPlace || '',
            education: '',
            maritalStatus: '',
            occupation: '',
            affiliation: defaultAffiliation || '',
            booksReceived: false,
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

    // Known places for quick autocomplete datalist
    const knownPlaces = useMemo(() => {
        const set = new Set();
        campaignRegistrations.forEach(p => {
            if (p.place && p.place.trim()) set.add(p.place.trim());
        });
        return Array.from(set).sort();
    }, [campaignRegistrations]);

    // Identify facilitator for the current form
    const currentFacilitator = useMemo(() => {
        const num = normalizeFormNumber(formNumber);
        if (!num) return null;
        return campaignRegistrations.find(r => 
            r.type === 'facilitator' && normalizeFormNumber(r.form_number) === num
        ) || null;
    }, [campaignRegistrations, formNumber]);

    // Existing participants already in DB for this form (either by group_form_number or linked facilitator_uuid)
    const existingParticipants = useMemo(() => {
        const num = normalizeFormNumber(formNumber);
        if (!num) return [];
        return campaignRegistrations.filter(r => {
            if (r.type !== 'participant') return false;
            const directNum = normalizeFormNumber(r.group_form_number || r.form_number);
            if (directNum === num) return true;
            if (!directNum && currentFacilitator?.uuid && r.facilitator_uuid === currentFacilitator.uuid) {
                return true;
            }
            return false;
        });
    }, [campaignRegistrations, formNumber, currentFacilitator]);

    // Count linked participants per facilitator UUID for display in existing facilitator selector
    const linkedParticipantsByFacUuid = useMemo(() => {
        const counts = new Map();
        campaignRegistrations.forEach(r => {
            if (r.type === 'participant' && r.facilitator_uuid) {
                counts.set(r.facilitator_uuid, (counts.get(r.facilitator_uuid) || 0) + 1);
            }
        });
        return counts;
    }, [campaignRegistrations]);

    // Count how many facilitators in the campaign do not have a form number assigned yet
    const unassignedFacilitatorsCount = useMemo(() => {
        return campaignRegistrations.filter(r => 
            r.type === 'facilitator' && !normalizeFormNumber(r.form_number)
        ).length;
    }, [campaignRegistrations]);

    // Filtered & sorted existing facilitators (and optionally participants) for assigning Form #
    const facilitatorCandidates = useMemo(() => {
        const candidates = campaignRegistrations.filter(r => {
            if (currentFacilitator && r.id === currentFacilitator.id) return false;
            if (r.type === 'facilitator') return true;
            if (includeParticipantsInFacSearch && r.type === 'participant') return true;
            return false;
        });

        const filtered = facSearchQuery.trim()
            ? candidates.filter(r => matchesPerson(r, facSearchQuery, 'all'))
            : candidates;

        return [...filtered].sort((a, b) => {
            // 1. Facilitators before participants
            if (a.type !== b.type) return a.type === 'facilitator' ? -1 : 1;
            // 2. Unassigned form numbers first
            const aHasForm = Boolean(normalizeFormNumber(a.form_number));
            const bHasForm = Boolean(normalizeFormNumber(b.form_number));
            if (aHasForm !== bHasForm) return aHasForm ? 1 : -1;
            // 3. Alphabetical by name
            const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
            const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
            return aName.localeCompare(bName);
        });
    }, [campaignRegistrations, currentFacilitator, includeParticipantsInFacSearch, facSearchQuery]);

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
        place: p.place || '',
        education: p.education || '',
        maritalStatus: p.marital_status || '',
        occupation: p.occupation || '',
        affiliation: p.affiliation || '',
        booksReceived: Boolean(p.books_received),
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
                setDraftRows([createEmptyRow(currentFacilitator?.place, currentFacilitator?.affiliation)]);
            }
            setStatusMessage(null);
            setShowFacilitatorModal(false);
            setFacSearchQuery('');
            return;
        }

        // Same formNumber, background update of existingParticipants:
        setDraftRows(prev => {
            const unsavedDrafts = prev.filter(r => !r.isExisting && (
                r.firstName.trim() || r.lastName.trim() || r.contact.trim() || String(r.age).trim() ||
                r.place?.trim() || r.education || r.maritalStatus || r.occupation?.trim() || r.affiliation?.trim()
            ));
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
            return blankDrafts.length > 0 ? blankDrafts : [createEmptyRow(currentFacilitator?.place, currentFacilitator?.affiliation)];
        });
    }, [formNumber, existingParticipants, currentFacilitator]);

    // Add a new row to draft
    const handleAddRow = () => {
        setDraftRows(prev => [...prev, createEmptyRow(currentFacilitator?.place, currentFacilitator?.affiliation)]);
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
            return next.length > 0 ? next : [createEmptyRow(currentFacilitator?.place, currentFacilitator?.affiliation)];
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

    // Toggle all books received for all rows
    const handleToggleAllBooks = () => {
        setDraftRows(prev => {
            const allHaveBooks = prev.every(r => r.booksReceived);
            return prev.map(row => ({ ...row, booksReceived: !allHaveBooks, isDirty: true }));
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

    const populateFacFormFromCurrent = () => {
        if (currentFacilitator) {
            setFacForm({
                firstName: currentFacilitator.first_name || '',
                lastName: currentFacilitator.last_name || '',
                age: currentFacilitator.age ?? '',
                gender: currentFacilitator.gender || 'F',
                contact: currentFacilitator.contact || '',
                place: currentFacilitator.place || '',
                affiliation: currentFacilitator.affiliation || '',
                meetingTime: currentFacilitator.meeting_time || '',
                education: currentFacilitator.education || '',
                maritalStatus: currentFacilitator.marital_status || '',
                occupation: currentFacilitator.occupation || '',
                participantsCount: currentFacilitator.participants_count ?? 10,
                booksDistributed: currentFacilitator.books_distributed ?? 0
            });
        }
    };

    const resetBlankFacForm = () => {
        setFacForm({
            firstName: '',
            lastName: '',
            age: '',
            gender: 'F',
            contact: '',
            place: '',
            affiliation: '',
            meetingTime: '',
            education: '',
            maritalStatus: '',
            occupation: '',
            participantsCount: 10,
            booksDistributed: 0
        });
    };

    const openFacilitatorModal = (mode = 'select') => {
        if (mode === 'edit' && currentFacilitator) {
            populateFacFormFromCurrent();
            setFacilitatorModalMode('edit');
        } else if (mode === 'create') {
            resetBlankFacForm();
            setFacilitatorModalMode('create');
        } else {
            resetBlankFacForm();
            setFacilitatorModalMode('select');
        }
        setFacSearchQuery('');
        setShowFacilitatorModal(true);
    };

    const handleSwitchFacilitatorModalMode = (mode) => {
        if (mode === 'edit' && currentFacilitator) {
            populateFacFormFromCurrent();
        } else if (mode === 'create') {
            resetBlankFacForm();
        }
        setFacilitatorModalMode(mode);
    };

    // Assign Form # to an existing facilitator (or promote participant to facilitator)
    const handleAssignExistingFacilitator = async (selectedFac) => {
        const num = normalizeFormNumber(formNumber);
        if (!num || !selectedFac?.id) return;

        const existingFacNum = normalizeFormNumber(selectedFac.form_number);
        if (existingFacNum && existingFacNum !== num) {
            const ok = window.confirm(
                `${selectedFac.first_name} ${selectedFac.last_name} is currently assigned to Form #${selectedFac.form_number}.\n\nDo you want to reassign them to Form #${num}?`
            );
            if (!ok) return;
        }

        const now = new Date().toISOString();
        const adminName = profile?.full_name || user?.displayName || user?.email || 'Admin';
        const targetFacUuid = selectedFac.uuid || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : ('fac-' + Date.now().toString(36)));

        try {
            let linkedPartCount = 0;
            await db.transaction('rw', db.registrations, async () => {
                // 1. If a different facilitator was previously on this form, clear their form_number
                if (currentFacilitator && currentFacilitator.id !== selectedFac.id) {
                    await db.registrations.update(currentFacilitator.id, {
                        form_number: '',
                        sync_status: 'pending',
                        updated_at: now,
                        updated_by_uid: user?.uid || null,
                        updated_by_name: adminName,
                        updated_by_email: user?.email || null,
                    });
                }

                // 2. Assign Form #num to the selected existing facilitator
                await db.registrations.update(selectedFac.id, {
                    uuid: targetFacUuid,
                    form_number: String(num),
                    type: 'facilitator',
                    teaching_group: true,
                    is_daily_core: true,
                    sync_status: 'pending',
                    updated_at: now,
                    updated_by_uid: user?.uid || null,
                    updated_by_name: adminName,
                    updated_by_email: user?.email || null,
                });

                // 3. Sync participants in both directions:
                // - Participants already linked to selectedFac.uuid get group_form_number = String(num)
                // - Participants already entered on Form #num get facilitator_uuid = targetFacUuid
                for (const r of campaignRegistrations) {
                    if (r.type !== 'participant' || !r.id || r.id === selectedFac.id) continue;
                    const rFormNum = normalizeFormNumber(r.group_form_number || r.form_number);
                    const isLinkedToFac = Boolean(targetFacUuid && r.facilitator_uuid === targetFacUuid);
                    const isOnThisForm = rFormNum === num;

                    if (isLinkedToFac && rFormNum !== num) {
                        await db.registrations.update(r.id, {
                            group_form_number: String(num),
                            sync_status: 'pending',
                            updated_at: now,
                            updated_by_uid: user?.uid || null,
                            updated_by_name: adminName,
                            updated_by_email: user?.email || null,
                        });
                        linkedPartCount++;
                    } else if (isOnThisForm && r.facilitator_uuid !== targetFacUuid) {
                        await db.registrations.update(r.id, {
                            facilitator_uuid: targetFacUuid,
                            place: r.place || selectedFac.place || null,
                            affiliation: r.affiliation || selectedFac.affiliation || null,
                            sync_status: 'pending',
                            updated_at: now,
                            updated_by_uid: user?.uid || null,
                            updated_by_name: adminName,
                            updated_by_email: user?.email || null,
                        });
                        linkedPartCount++;
                    }
                }
            });

            // Update default place/affiliation on any blank draft rows
            setDraftRows(prev => prev.map(r => {
                if (!r.isExisting && !r.firstName.trim() && !r.lastName.trim()) {
                    return {
                        ...r,
                        place: r.place || selectedFac.place || '',
                        affiliation: r.affiliation || selectedFac.affiliation || ''
                    };
                }
                return r;
            }));

            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            pushProfileBufferToSheets({ profile, user }).catch(() => {});
            setShowFacilitatorModal(false);
            setFacSearchQuery('');
            setStatusMessage({
                type: 'success',
                text: `Assigned Form #${num} to ${selectedFac.first_name} ${selectedFac.last_name}${linkedPartCount > 0 ? ` (${linkedPartCount} participant record(s) linked to Form #${num})` : ''}!`
            });
        } catch (err) {
            console.error('[PaperFormEntry] Error assigning existing facilitator:', err);
            alert('Failed to assign facilitator: ' + err.message);
        }
    };

    // Unlink current facilitator from this form number without deleting their record
    const handleUnlinkFacilitator = async () => {
        const num = normalizeFormNumber(formNumber);
        if (!num || !currentFacilitator?.id) return;
        const ok = window.confirm(
            `Unlink ${currentFacilitator.first_name} ${currentFacilitator.last_name} from Form #${num}?\n\nTheir facilitator record will remain in the database without a form number.`
        );
        if (!ok) return;

        const now = new Date().toISOString();
        try {
            await db.registrations.update(currentFacilitator.id, {
                form_number: '',
                sync_status: 'pending',
                updated_at: now,
                updated_by_uid: user?.uid || null,
                updated_by_name: profile?.full_name || user?.displayName || user?.email || 'Admin',
                updated_by_email: user?.email || null,
            });
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            pushProfileBufferToSheets({ profile, user }).catch(() => {});
            setShowFacilitatorModal(false);
            setStatusMessage({
                type: 'warning',
                text: `Unlinked ${currentFacilitator.first_name} ${currentFacilitator.last_name} from Form #${num}.`
            });
        } catch (err) {
            console.error('[PaperFormEntry] Error unlinking facilitator:', err);
            alert('Failed to unlink facilitator: ' + err.message);
        }
    };

    // Handle Quick Facilitator Creation or Update
    const handleCreateFacilitator = async (e) => {
        e.preventDefault();
        const num = normalizeFormNumber(formNumber);
        if (!num) return;
        if (!facForm.firstName.trim() || !facForm.lastName.trim()) {
            alert('Please provide facilitator first and last name.');
            return;
        }

        const now = new Date().toISOString();
        const adminName = profile?.full_name || user?.displayName || user?.email || 'Admin';
        const payload = {
            first_name: facForm.firstName.trim(),
            last_name: facForm.lastName.trim(),
            age: facForm.age ? (parseInt(facForm.age, 10) || null) : null,
            gender: facForm.gender || 'F',
            contact: facForm.contact.trim() || '',
            place: facForm.place.trim() || '',
            affiliation: facForm.affiliation.trim() || '',
            meeting_time: facForm.meetingTime.trim() || '',
            education: facForm.education || '',
            marital_status: facForm.maritalStatus || '',
            occupation: facForm.occupation.trim() || '',
            participants_count: parseInt(facForm.participantsCount, 10) || 10,
            books_distributed: parseInt(facForm.booksDistributed, 10) || 0,
            teaching_group: true,
            type: 'facilitator',
            form_number: String(num),
            campaign_id: activeCampId,
            is_daily_core: true,
            sync_status: 'pending',
            updated_at: now,
        };

        try {
            await db.transaction('rw', db.registrations, async () => {
                let targetFacUuid = currentFacilitator?.uuid;

                if (facilitatorModalMode === 'edit' && currentFacilitator?.id) {
                    await db.registrations.update(currentFacilitator.id, {
                        ...payload,
                        updated_by_uid: user?.uid || null,
                        updated_by_name: adminName,
                        updated_by_email: user?.email || null,
                    });
                } else {
                    if (currentFacilitator?.id) {
                        await db.registrations.update(currentFacilitator.id, {
                            form_number: '',
                            sync_status: 'pending',
                            updated_at: now,
                            updated_by_uid: user?.uid || null,
                            updated_by_name: adminName,
                            updated_by_email: user?.email || null,
                        });
                    }
                    targetFacUuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : ('fac-' + Date.now().toString(36));
                    await db.registrations.add({
                        ...payload,
                        uuid: targetFacUuid,
                        created_at: now,
                        created_by_uid: user?.uid || null,
                        created_by_name: adminName,
                        created_by_email: user?.email || null,
                        submission_source: 'paper_batch_entry'
                    });
                }

                // Link any participants already on Form #num to this facilitator
                if (targetFacUuid) {
                    for (const r of campaignRegistrations) {
                        if (r.type === 'participant' && r.id && normalizeFormNumber(r.group_form_number || r.form_number) === num && r.facilitator_uuid !== targetFacUuid) {
                            await db.registrations.update(r.id, {
                                facilitator_uuid: targetFacUuid,
                                sync_status: 'pending',
                                updated_at: now,
                            });
                        }
                    }
                }
            });

            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            pushProfileBufferToSheets({ profile, user }).catch(() => {});
            setShowFacilitatorModal(false);
            setStatusMessage({ type: 'success', text: `Facilitator saved for Form #${num}!` });
        } catch (err) {
            console.error('[PaperFormEntry] Error saving facilitator:', err);
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
                        contact: row.contact?.trim() || null,
                        place: row.place?.trim() || currentFacilitator?.place || null,
                        education: row.education || null,
                        marital_status: row.maritalStatus || null,
                        occupation: row.occupation?.trim() || null,
                        affiliation: row.affiliation?.trim() || currentFacilitator?.affiliation || null,
                        books_received: Boolean(row.booksReceived),
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
        <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
            <datalist id="paper-known-places-list">
                {knownPlaces.map((pl) => (
                    <option key={pl} value={pl} />
                ))}
            </datalist>

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
                                        {currentFacilitator.affiliation && (
                                            <span className="flex items-center gap-1">
                                                <Sparkles size={13} className="text-gray-400" />
                                                Meeting: {currentFacilitator.affiliation}
                                            </span>
                                        )}
                                        {currentFacilitator.meeting_time && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={13} className="text-gray-400" />
                                                {currentFacilitator.meeting_time}
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
                                        Assign Form #{formNumber} to an existing facilitator from the database, or register a new facilitator.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
                        {currentFacilitator ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openFacilitatorModal('select')}
                                    className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 shadow-xs transition-all"
                                >
                                    <Link2 size={15} />
                                    <span>Change Facilitator</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openFacilitatorModal('edit')}
                                    className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs transition-all"
                                >
                                    <Pencil size={15} />
                                    <span>Edit Details</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openFacilitatorModal('select')}
                                    className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-[#71167F] text-white hover:bg-[#5a1166] shadow-md shadow-[#71167F]/20 transition-all"
                                >
                                    <Link2 size={16} />
                                    <span>Assign Existing Facilitator</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openFacilitatorModal('create')}
                                    className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/70 transition-all"
                                >
                                    <UserPlus size={16} />
                                    <span>New Facilitator</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Facilitator Selection / Registration / Edit Inline Panel */}
            {showFacilitatorModal && (
                <div className="bg-white rounded-3xl p-6 border-2 border-[#71167F]/30 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleSwitchFacilitatorModalMode('select')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                                    facilitatorModalMode === 'select'
                                        ? "bg-[#71167F] text-white shadow-sm"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                            >
                                <Search size={14} />
                                <span>Select Existing Facilitator</span>
                                {unassignedFacilitatorsCount > 0 && (
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                                        facilitatorModalMode === 'select'
                                            ? "bg-white/20 text-white"
                                            : "bg-[#71167F]/10 text-[#71167F]"
                                    )}>
                                        {unassignedFacilitatorsCount} Unassigned
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSwitchFacilitatorModalMode('create')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                                    facilitatorModalMode === 'create'
                                        ? "bg-[#71167F] text-white shadow-sm"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                            >
                                <UserPlus size={14} />
                                <span>Register New Facilitator</span>
                            </button>

                            {currentFacilitator && (
                                <button
                                    type="button"
                                    onClick={() => handleSwitchFacilitatorModalMode('edit')}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                                        facilitatorModalMode === 'edit'
                                            ? "bg-[#71167F] text-white shadow-sm"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    )}
                                >
                                    <Pencil size={14} />
                                    <span>Edit Linked ({currentFacilitator.first_name})</span>
                                </button>
                            )}
                        </div>

                        <button 
                            type="button"
                            onClick={() => setShowFacilitatorModal(false)}
                            className="text-gray-400 hover:text-gray-600 font-bold text-xs self-end sm:self-auto"
                        >
                            Cancel ✕
                        </button>
                    </div>

                    {facilitatorModalMode === 'select' ? (
                        <div className="space-y-4">
                            {currentFacilitator && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                                    <div className="text-xs text-emerald-900 font-semibold">
                                        Currently linked to <strong>Form #{formNumber}</strong>:{' '}
                                        <span className="font-black">{currentFacilitator.first_name} {currentFacilitator.last_name}</span>
                                        {currentFacilitator.place ? ` (${currentFacilitator.place})` : ''}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUnlinkFacilitator}
                                        className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto transition-all"
                                    >
                                        <Unlink size={13} />
                                        <span>Unlink from Form #{formNumber}</span>
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={facSearchQuery}
                                        onChange={e => setFacSearchQuery(e.target.value)}
                                        placeholder="Search existing facilitator by name, phone, village/ward, meeting place, or form #..."
                                        className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F] focus:bg-white transition-all"
                                    />
                                    {facSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setFacSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                                            title="Clear search"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={includeParticipantsInFacSearch}
                                        onChange={e => setIncludeParticipantsInFacSearch(e.target.checked)}
                                        className="rounded border-gray-300 text-[#71167F] focus:ring-[#71167F]"
                                    />
                                    <span>Include participant records (promote to facilitator)</span>
                                </label>
                            </div>

                            {facilitatorCandidates.length === 0 ? (
                                <div className="text-center py-8 px-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                                    <p className="text-sm font-bold text-gray-600">
                                        {facSearchQuery.trim()
                                            ? `No existing facilitators found matching "${facSearchQuery}".`
                                            : 'No other facilitators found in this campaign.'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        You can switch to "Register New Facilitator" if they are not in the database yet.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const parts = facSearchQuery.trim().split(/\s+/);
                                            setFacForm(prev => ({
                                                ...prev,
                                                firstName: parts[0] || '',
                                                lastName: parts.slice(1).join(' ') || ''
                                            }));
                                            setFacilitatorModalMode('create');
                                        }}
                                        className="mt-3 px-4 py-2 rounded-xl bg-[#71167F] text-white text-xs font-black uppercase tracking-wider hover:bg-[#5a1166] inline-flex items-center gap-1.5"
                                    >
                                        <UserPlus size={14} />
                                        <span>Register New Facilitator Instead</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-2xl bg-gray-50/40">
                                    {facilitatorCandidates.slice(0, 60).map(fac => {
                                        const existingNum = normalizeFormNumber(fac.form_number);
                                        const linkedCount = fac.uuid ? (linkedParticipantsByFacUuid.get(fac.uuid) || 0) : 0;

                                        return (
                                            <div
                                                key={fac.uuid || fac.id}
                                                className="p-3.5 hover:bg-purple-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs",
                                                        existingNum
                                                            ? "bg-gray-100 text-gray-600"
                                                            : "bg-[#71167F]/10 text-[#71167F]"
                                                    )}>
                                                        <User size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-black text-gray-900 text-sm">
                                                                {fac.first_name} {fac.last_name}
                                                            </span>
                                                            {existingNum ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-100 text-amber-900 border border-amber-200">
                                                                    Form #{existingNum}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                                                    No Form # Assigned
                                                                </span>
                                                            )}
                                                            {fac.type === 'participant' && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                    Participant Record
                                                                </span>
                                                            )}
                                                            {linkedCount > 0 && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#71167F] border border-purple-200">
                                                                    {linkedCount} linked participant{linkedCount === 1 ? '' : 's'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-semibold mt-1">
                                                            {fac.contact && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone size={11} className="text-gray-400" />
                                                                    {fac.contact}
                                                                </span>
                                                            )}
                                                            {fac.place && (
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin size={11} className="text-gray-400" />
                                                                    {fac.place}
                                                                </span>
                                                            )}
                                                            {fac.affiliation && (
                                                                <span className="flex items-center gap-1 text-[#71167F]">
                                                                    <Sparkles size={11} />
                                                                    {fac.affiliation}
                                                                </span>
                                                            )}
                                                            {fac.meeting_time && (
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={11} className="text-gray-400" />
                                                                    {fac.meeting_time}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleAssignExistingFacilitator(fac)}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all self-start sm:self-center",
                                                        existingNum
                                                            ? "bg-white border border-gray-200 text-gray-700 hover:bg-[#71167F] hover:text-white hover:border-[#71167F]"
                                                            : "bg-[#71167F] text-white hover:bg-[#5a1166] shadow-sm"
                                                    )}
                                                >
                                                    <Hash size={13} />
                                                    <span>
                                                        {existingNum ? `Reassign to Form #${formNumber}` : `Assign Form #${formNumber}`}
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleCreateFacilitator} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">First Name *</label>
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
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Last Name *</label>
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
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Age</label>
                                <input
                                    type="number"
                                    value={facForm.age}
                                    onChange={e => setFacForm(f => ({ ...f, age: e.target.value }))}
                                    placeholder="e.g. 34"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                />
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
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Village / Ward</label>
                                <input
                                    type="text"
                                    list="paper-known-places-list"
                                    value={facForm.place}
                                    onChange={e => setFacForm(f => ({ ...f, place: e.target.value }))}
                                    placeholder="e.g. Mochudi / Boseja"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Education Level</label>
                                <select
                                    value={facForm.education}
                                    onChange={e => setFacForm(f => ({ ...f, education: e.target.value }))}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
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
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Marital Status</label>
                                <select
                                    value={facForm.maritalStatus}
                                    onChange={e => setFacForm(f => ({ ...f, maritalStatus: e.target.value }))}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
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
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Occupation</label>
                                <input
                                    type="text"
                                    value={facForm.occupation}
                                    onChange={e => setFacForm(f => ({ ...f, occupation: e.target.value }))}
                                    placeholder="e.g. Teacher, Self-employed"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Meeting Place / Affiliation</label>
                                <input
                                    type="text"
                                    value={facForm.affiliation}
                                    onChange={e => setFacForm(f => ({ ...f, affiliation: e.target.value }))}
                                    placeholder="e.g. Community Hall / Church"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Meeting Time</label>
                                <input
                                    type="text"
                                    value={facForm.meetingTime}
                                    onChange={e => setFacForm(f => ({ ...f, meetingTime: e.target.value }))}
                                    placeholder="e.g. Tuesdays 14:00"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Group Size</label>
                                    <input
                                        type="number"
                                        value={facForm.participantsCount}
                                        onChange={e => setFacForm(f => ({ ...f, participantsCount: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Books Given</label>
                                    <input
                                        type="number"
                                        value={facForm.booksDistributed}
                                        onChange={e => setFacForm(f => ({ ...f, booksDistributed: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-2">
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 rounded-xl bg-[#71167F] text-white hover:bg-[#5a1166] text-xs font-black uppercase tracking-wider shadow-md"
                                >
                                    {facilitatorModalMode === 'edit' ? `Update Facilitator (Form #${formNumber})` : `Register & Link Facilitator to Form #${formNumber}`}
                                </button>
                            </div>
                        </form>
                    )}
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
                            Enter full participant details directly. Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Enter</kbd> to add rows.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleToggleAllBooks}
                            className="px-3 py-2 rounded-xl bg-purple-50 text-[#71167F] border border-purple-200 hover:bg-purple-100 text-xs font-bold flex items-center gap-1.5 transition-all"
                            title="Toggle book received for all participants on this form"
                        >
                            <Check size={14} />
                            <span>Toggle All Books</span>
                        </button>

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
                                <th className="py-3 px-2 w-10 text-center">#</th>
                                <th className="py-3 px-2 min-w-[130px]">First Name</th>
                                <th className="py-3 px-2 min-w-[130px]">Last Name</th>
                                <th className="py-3 px-1.5 w-16 text-center">Gender</th>
                                <th className="py-3 px-1.5 w-16 text-center">Age</th>
                                <th className="py-3 px-2 min-w-[110px]">Phone</th>
                                <th className="py-3 px-2 min-w-[125px]">Village / Site</th>
                                <th className="py-3 px-2 min-w-[135px]">Education</th>
                                <th className="py-3 px-2 min-w-[120px]">Marital Status</th>
                                <th className="py-3 px-2 min-w-[125px]">Occupation</th>
                                <th className="py-3 px-2 min-w-[125px]">Affiliation / Group</th>
                                <th className="py-3 px-1.5 w-16 text-center">Book</th>
                                
                                {/* Sprint Attendance Columns */}
                                <th className="py-3 px-2 text-center min-w-[175px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Attendance ({activeSprint.label})</span>
                                    </div>
                                </th>
                                <th className="py-3 px-2 w-10 text-center">Del</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {draftRows.map((row, index) => {
                                const rowAtt = Array.isArray(row.attendance) ? row.attendance : [];
                                const allSprintPresent = activeSprint.days.every(d => rowAtt[d]);

                                return (
                                    <tr key={row.tempId || index} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-2.5 px-2 text-center text-xs font-mono font-bold text-gray-400">
                                            {index + 1}
                                        </td>
                                        
                                        {/* First Name */}
                                        <td className="py-2 px-2">
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
                                        <td className="py-2 px-2">
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
                                        <td className="py-2 px-1.5 text-center">
                                            <select
                                                value={row.gender || 'F'}
                                                onChange={e => handleFieldChange(index, 'gender', e.target.value)}
                                                className="bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            >
                                                <option value="F">F</option>
                                                <option value="M">M</option>
                                            </select>
                                        </td>

                                        {/* Age */}
                                        <td className="py-2 px-1.5 text-center">
                                            <input
                                                type="number"
                                                value={row.age || ''}
                                                onChange={e => handleFieldChange(index, 'age', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="Age"
                                                className="w-14 bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Phone */}
                                        <td className="py-2 px-2">
                                            <input
                                                type="text"
                                                value={row.contact || ''}
                                                onChange={e => handleFieldChange(index, 'contact', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="71234567"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Village / Site */}
                                        <td className="py-2 px-2">
                                            <input
                                                type="text"
                                                list="paper-known-places-list"
                                                value={row.place || ''}
                                                onChange={e => handleFieldChange(index, 'place', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder={currentFacilitator?.place || "Village / Ward"}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Education */}
                                        <td className="py-2 px-2">
                                            <select
                                                value={row.education || ''}
                                                onChange={e => handleFieldChange(index, 'education', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            >
                                                <option value="">Education...</option>
                                                <option value="Primary">Primary</option>
                                                <option value="Junior Secondary">Junior Sec</option>
                                                <option value="Senior Secondary">Senior Sec</option>
                                                <option value="Vocational">Vocational</option>
                                                <option value="Tertiary">Tertiary</option>
                                                <option value="None">None</option>
                                            </select>
                                        </td>

                                        {/* Marital Status */}
                                        <td className="py-2 px-2">
                                            <select
                                                value={row.maritalStatus || ''}
                                                onChange={e => handleFieldChange(index, 'maritalStatus', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            >
                                                <option value="">Status...</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Divorced">Divorced</option>
                                                <option value="Widowed">Widowed</option>
                                                <option value="Cohabiting">Cohabiting</option>
                                            </select>
                                        </td>

                                        {/* Occupation */}
                                        <td className="py-2 px-2">
                                            <input
                                                type="text"
                                                value={row.occupation || ''}
                                                onChange={e => handleFieldChange(index, 'occupation', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="Occupation"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Affiliation / Group */}
                                        <td className="py-2 px-2">
                                            <input
                                                type="text"
                                                value={row.affiliation || ''}
                                                onChange={e => handleFieldChange(index, 'affiliation', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder={currentFacilitator?.affiliation || "Group / Church"}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#71167F]"
                                            />
                                        </td>

                                        {/* Book Received */}
                                        <td className="py-2 px-1.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleFieldChange(index, 'booksReceived', !row.booksReceived)}
                                                className={cn(
                                                    "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                                                    row.booksReceived
                                                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                                                        : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                                                )}
                                                title="Toggle whether participant received curriculum book"
                                            >
                                                {row.booksReceived ? 'Yes' : 'No'}
                                            </button>
                                        </td>

                                        {/* Sprint Attendance Checkboxes */}
                                        <td className="py-2 px-2">
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
