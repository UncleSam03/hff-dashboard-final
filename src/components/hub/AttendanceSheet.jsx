import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from '../../lib/campaignManager';
import { 
    Check, 
    Search, 
    ArrowLeft, 
    Users, 
    UserX, 
    X, 
    CalendarCheck, 
    BookOpen, 
    Download, 
    RefreshCw, 
    CheckCheck, 
    Sparkles, 
    AlertCircle, 
    ChevronDown, 
    Phone, 
    CloudCheck,
    Cloud,
    SlidersHorizontal,
    FileSpreadsheet,
    HelpCircle,
    UserCheck,
    MapPin,
    Hash
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { matchesPerson } from '../../lib/searchUtils';
import { normalizeAttendance } from '../../lib/analytics';
import { TOTAL_CAMPAIGN_DAYS } from '../../lib/constants';
import { useAuth } from '../../auth/AuthContext';
import { 
    toggleSingleAttendance, 
    markDayColumnForGroup, 
    markAllDaysForParticipant, 
    toggleBookReceivedSync, 
    useAttendanceSyncStatus, 
    flushAttendanceSyncImmediately 
} from '../../lib/attendanceSync';

const AttendanceSheet = ({ initialContext, onContextConsumed, onBack }) => {
    const { user, profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [registerMode, setRegisterMode] = useState('team'); // 'team' | 'all' | 'unassigned'
    const [highlightedParticipantUuid, setHighlightedParticipantUuid] = useState(null);
    const [isContextual, setIsContextual] = useState(false);
    const [columnActionMenu, setColumnActionMenu] = useState(null); // { dayIndex }
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    const highlightedRowRef = useRef(null);
    const days = useMemo(() => Array.from({ length: TOTAL_CAMPAIGN_DAYS }, (_, i) => `D${i + 1}`), []);

    // Sync status integration
    const { status: syncStatus, pendingCount, lastSyncedAt, isOnline, flushSync } = useAttendanceSyncStatus();

    // Local in-memory state for instant 0ms optimistic UI updates during click & drag
    const [localAttendanceMap, setLocalAttendanceMap] = useState({});
    const [localBooksMap, setLocalBooksMap] = useState({});
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [paintMode, setPaintMode] = useState(null); // true = present, false = absent

    const activeCampId = getActiveCampaignId();

    // Handle initial navigation context (e.g. from PersonList or ParticipantDetail)
    useEffect(() => {
        if (!initialContext) return;
        setIsContextual(true);

        const applyContext = async () => {
            let targetFacilitator = null;
            if (initialContext.type === 'facilitator') {
                targetFacilitator = initialContext;
                setSelectedFacilitator(targetFacilitator);
                setRegisterMode('team');
            } else if (initialContext.type === 'participant') {
                setHighlightedParticipantUuid(initialContext.uuid);
                setTimeout(() => setHighlightedParticipantUuid(null), 6000);

                if (initialContext.facilitator_uuid) {
                    targetFacilitator = await db.registrations.where('uuid').equals(initialContext.facilitator_uuid).first();
                }
                
                // If not matched by uuid, try matching by group_form_number
                if (!targetFacilitator && initialContext.group_form_number) {
                    targetFacilitator = await db.registrations
                        .where('type').equals('facilitator')
                        .filter(f => f.form_number && String(f.form_number).trim() === String(initialContext.group_form_number).trim())
                        .first();
                }

                if (targetFacilitator) {
                    setSelectedFacilitator(targetFacilitator);
                    setRegisterMode('team');
                } else {
                    // Participant has no facilitator assigned — switch to unassigned mode
                    setSelectedFacilitator(null);
                    setRegisterMode('unassigned');
                }
            }
            onContextConsumed?.();
        };

        applyContext();
    }, [initialContext, onContextConsumed]);

    // Global mouseup listener for paint drag mode
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsMouseDown(false);
            setPaintMode(null);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Auto-scroll to highlighted participant
    useEffect(() => {
        if (highlightedParticipantUuid && highlightedRowRef.current) {
            highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedParticipantUuid]);

    // Live query to fetch roster / facilitator data based on active mode
    const queryData = useLiveQuery(async () => {
        // Fetch all active facilitators for active campaign
        const allFacilitators = await db.registrations.where('type').equals('facilitator').toArray();
        const facilitators = allFacilitators.filter(f => {
            if (f.is_deleted) return false;
            if (activeCampId) {
                if (f.campaign_id) return f.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            }
            return true;
        });

        // Compute aliases for each facilitator in-memory (grouped by contact phone number, O(F) instead of N+1 IndexedDB queries)
        const contactToUuids = new Map();
        for (const r of allFacilitators) {
            if (r.is_deleted || !r.contact || !r.uuid) continue;
            let list = contactToUuids.get(r.contact);
            if (!list) {
                list = [];
                contactToUuids.set(r.contact, list);
            }
            if (!list.includes(r.uuid)) list.push(r.uuid);
        }

        const aliasesMap = {};
        const aliasUuidToFacilitators = new Map();
        for (const f of facilitators) {
            const list = [f.uuid];
            if (f.contact && contactToUuids.has(f.contact)) {
                for (const aliasUuid of contactToUuids.get(f.contact)) {
                    if (!list.includes(aliasUuid)) list.push(aliasUuid);
                }
            }
            aliasesMap[f.uuid] = list;
            for (const aliasUuid of list) {
                let owners = aliasUuidToFacilitators.get(aliasUuid);
                if (!owners) {
                    owners = [];
                    aliasUuidToFacilitators.set(aliasUuid, owners);
                }
                owners.push(f.uuid);
            }
        }

        // Fetch all participants for active campaign
        const allParticipants = await db.registrations.where('type').equals('participant').toArray();
        const participants = allParticipants.filter(p => {
            if (p.is_deleted) return false;
            if (activeCampId) {
                if (p.campaign_id) return p.campaign_id === activeCampId;
                return activeCampId === DEFAULT_CAMPAIGN.uuid;
            }
            return true;
        });

        // Count assigned and qualifying participants for each facilitator in O(P) time
        const counts = {};
        const qualifyingCounts = {};
        const facilitatorFormMap = new Map();
        facilitators.forEach(f => {
            if (f.form_number) facilitatorFormMap.set(String(f.form_number).trim(), f);
        });

        participants.forEach(p => {
            const att = normalizeAttendance(p.attendance);
            const daysAttended = att.filter(Boolean).length;
            const isQualifying = daysAttended >= 6;

            let matchedFacUuid = null;
            if (p.facilitator_uuid) {
                matchedFacUuid = p.facilitator_uuid;
            } else if (p.group_form_number && facilitatorFormMap.has(String(p.group_form_number).trim())) {
                matchedFacUuid = facilitatorFormMap.get(String(p.group_form_number).trim()).uuid;
            }

            if (matchedFacUuid) {
                const ownerFacUuids = aliasUuidToFacilitators.get(matchedFacUuid);
                if (ownerFacUuids) {
                    for (const ownerUuid of ownerFacUuids) {
                        counts[ownerUuid] = (counts[ownerUuid] || 0) + 1;
                        if (isQualifying) {
                            qualifyingCounts[ownerUuid] = (qualifyingCounts[ownerUuid] || 0) + 1;
                        }
                    }
                }
            }
        });

        // Map facilitators with counts
        const mappedFacilitators = facilitators.map(f => ({
            ...f,
            participantCount: counts[f.uuid] || 0,
            qualifyingCount: qualifyingCounts[f.uuid] || 0
        }));

        if (registerMode === 'team' && !selectedFacilitator) {
            // View: Facilitator Grid Selection
            let results = mappedFacilitators;
            let matchingParticipants = [];

            if (searchTerm) {
                results = results.filter(f => matchesPerson(f, searchTerm, 'all'));
                // Also search participants across campaign to help quick-jump
                matchingParticipants = participants
                    .filter(p => matchesPerson(p, searchTerm, 'all'))
                    .slice(0, 8)
                    .map(p => {
                        const fac = facilitators.find(f => (aliasesMap[f.uuid] && aliasesMap[f.uuid].includes(p.facilitator_uuid)) || (p.group_form_number && f.form_number && String(f.form_number).trim() === String(p.group_form_number).trim()));
                        return {
                            ...p,
                            facilitatorName: fac ? `${fac.first_name} ${fac.last_name}` : 'Unassigned',
                            assignedFacilitator: fac
                        };
                    });
            }

            return {
                type: 'facilitators',
                list: results,
                matchingParticipants,
                allFacilitators: mappedFacilitators
            };
        }

        // View: Attendance Register Grid
        let roster = [];
        let contextFacilitator = selectedFacilitator;

        if (registerMode === 'team' && selectedFacilitator) {
            // Fetch updated latest facilitator object
            const freshFacilitator = await db.registrations.get(selectedFacilitator.id) || selectedFacilitator;
            contextFacilitator = freshFacilitator;

            const aliases = allFacilitators.filter(r =>
                !r.is_deleted && r.contact && freshFacilitator.contact && r.contact === freshFacilitator.contact
            );
            const aliasUuids = Array.from(new Set([freshFacilitator.uuid, ...aliases.map(a => a.uuid)]));

            if (freshFacilitator.linked_facilitators) {
                freshFacilitator.linked_facilitators.forEach(u => {
                    if (!aliasUuids.includes(u)) aliasUuids.push(u);
                });
            }

            // Participants linked to this facilitator by UUID or form number
            let teamParticipants = participants.filter(p => {
                if (aliasUuids.includes(p.facilitator_uuid)) return true;
                if (freshFacilitator.form_number && p.group_form_number && String(p.group_form_number).trim() === String(freshFacilitator.form_number).trim()) {
                    return true;
                }
                return false;
            });

            teamParticipants.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

            // Fetch linked co-facilitators
            let coFacilitators = [];
            if (freshFacilitator.linked_facilitators && freshFacilitator.linked_facilitators.length > 0) {
                coFacilitators = facilitators.filter(f => freshFacilitator.linked_facilitators.includes(f.uuid));
            }

            // Include facilitator and co-facilitators at top of roster
            roster = [freshFacilitator, ...coFacilitators, ...teamParticipants];

            roster = roster.map(p => ({
                ...p,
                assignedFacilitator: freshFacilitator,
                facilitatorName: `${freshFacilitator.first_name || ''} ${freshFacilitator.last_name || ''}`.trim()
            }));
        } else if (registerMode === 'all') {
            // Full Campaign Register: all participants
            roster = participants.map(p => {
                const fac = facilitators.find(f => (aliasesMap[f.uuid] && aliasesMap[f.uuid].includes(p.facilitator_uuid)) || (p.group_form_number && f.form_number && String(f.form_number).trim() === String(p.group_form_number).trim()));
                return {
                    ...p,
                    assignedFacilitator: fac,
                    facilitatorName: fac ? `${fac.first_name} ${fac.last_name}` : 'Unassigned'
                };
            });
            roster.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
        } else if (registerMode === 'unassigned') {
            // Unassigned participants only
            roster = participants
                .filter(p => !p.facilitator_uuid && (!p.group_form_number || !facilitatorFormMap.has(String(p.group_form_number).trim())))
                .map(p => ({
                    ...p,
                    assignedFacilitator: null,
                    facilitatorName: 'Unassigned'
                }));
            roster.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
        }

        if (searchTerm) {
            roster = roster.filter(p => matchesPerson(p, searchTerm, 'all'));
        }

        return {
            type: 'register',
            list: roster,
            allFacilitators: mappedFacilitators,
            contextFacilitator
        };
    }, [activeCampId, registerMode, selectedFacilitator, searchTerm]);

    const list = queryData?.list || [];
    const allFacilitators = queryData?.allFacilitators || [];
    const contextFacilitator = queryData?.contextFacilitator || selectedFacilitator;
    const matchingParticipants = queryData?.matchingParticipants || [];

    // Sync query results to local in-memory attendance state
    useEffect(() => {
        if (list && Array.isArray(list)) {
            setLocalAttendanceMap(prev => {
                const next = { ...prev };
                list.forEach(p => {
                    if (!next[p.uuid]) {
                        next[p.uuid] = normalizeAttendance(p.attendance);
                    }
                });
                return next;
            });

            setLocalBooksMap(prev => {
                const next = { ...prev };
                list.forEach(p => {
                    if (next[p.uuid] === undefined) {
                        next[p.uuid] = Boolean(p.books_received);
                    }
                });
                return next;
            });
        }
    }, [list]);

    // Handle instant toggle of an attendance cell
    const handleToggleAttendance = async (participant, dayIndex, forceValue = null) => {
        try {
            const currentAtt = localAttendanceMap[participant.uuid] || normalizeAttendance(participant.attendance);
            const newValue = forceValue !== null ? forceValue : !currentAtt[dayIndex];

            if (currentAtt[dayIndex] === newValue) return;

            const updatedAtt = [...currentAtt];
            updatedAtt[dayIndex] = newValue;

            // Instant optimistic UI update
            setLocalAttendanceMap(prev => ({
                ...prev,
                [participant.uuid]: updatedAtt
            }));

            // Debounced background sync
            await toggleSingleAttendance({
                participant,
                dayIndex,
                forceValue: newValue,
                user,
                profile
            });
        } catch (err) {
            console.error('[AttendanceSheet] Update failed:', err);
        }
    };

    // Handle click-and-drag paint attendance
    const handlePaintAttendance = (participant, dayIndex, initial = false) => {
        if (initial) {
            const currentAtt = localAttendanceMap[participant.uuid] || normalizeAttendance(participant.attendance);
            const mode = !currentAtt[dayIndex];
            setPaintMode(mode);
            setIsMouseDown(true);
            handleToggleAttendance(participant, dayIndex, mode);
        } else if (isMouseDown && paintMode !== null) {
            handleToggleAttendance(participant, dayIndex, paintMode);
        }
    };

    // Handle book toggle
    const handleToggleBook = async (participant) => {
        try {
            const curBook = localBooksMap[participant.uuid] !== undefined 
                ? localBooksMap[participant.uuid] 
                : Boolean(participant.books_received);
            const newStatus = !curBook;

            setLocalBooksMap(prev => ({
                ...prev,
                [participant.uuid]: newStatus
            }));

            await toggleBookReceivedSync({
                participant,
                newStatus,
                user,
                profile
            });
        } catch (err) {
            console.error('[AttendanceSheet] Book toggle failed:', err);
        }
    };

    // Column-wide batch action (Mark All / Clear Day)
    const handleMarkColumn = async (dayIndex, presentValue) => {
        if (!list || list.length === 0) return;
        setColumnActionMenu(null);

        // Instant UI update across all visible rows
        setLocalAttendanceMap(prev => {
            const next = { ...prev };
            list.forEach(p => {
                const cur = next[p.uuid] || normalizeAttendance(p.attendance);
                const updated = [...cur];
                updated[dayIndex] = presentValue;
                next[p.uuid] = updated;
            });
            return next;
        });

        await markDayColumnForGroup({
            participants: list,
            dayIndex,
            presentValue,
            user,
            profile
        });
    };

    // Row-wide batch action (Mark All 12 / Clear All)
    const handleMarkAllDaysForPerson = async (participant, presentValue) => {
        const updated = Array(TOTAL_CAMPAIGN_DAYS).fill(presentValue);
        setLocalAttendanceMap(prev => ({
            ...prev,
            [participant.uuid]: updated
        }));

        await markAllDaysForParticipant({
            participant,
            presentValue,
            user,
            profile
        });
    };

    // Export active sheet to CSV
    const handleExportCSV = () => {
        if (!list || list.length === 0) return;

        const headers = [
            'Full Name',
            'Type',
            'Phone',
            'Form Number',
            'Group Form Number',
            'Meeting Place',
            'Assigned Facilitator',
            'Books Received',
            'Total Attended (out of 12)',
            'Certificate Qualifying (>=6)',
            ...days.map(d => `Day ${d.replace('D', '')}`)
        ];

        const rows = list.map(p => {
            const att = localAttendanceMap[p.uuid] || normalizeAttendance(p.attendance);
            const attendedCount = att.filter(Boolean).length;
            const books = (localBooksMap[p.uuid] !== undefined ? localBooksMap[p.uuid] : Boolean(p.books_received)) ? 'YES' : 'NO';
            const qualifying = attendedCount >= 6 ? 'YES' : 'NO';
            const facName = p.facilitatorName || (contextFacilitator ? `${contextFacilitator.first_name} ${contextFacilitator.last_name}` : 'Unassigned');

            return [
                `"${p.first_name || ''} ${p.last_name || ''}"`.trim(),
                p.type || 'participant',
                p.contact || '',
                p.form_number || '',
                p.group_form_number || '',
                `"${p.place || ''}"`,
                `"${facName}"`,
                books,
                attendedCount,
                qualifying,
                ...att.map(val => val ? 'P' : 'A')
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = contextFacilitator 
            ? `hff_register_${contextFacilitator.first_name}_${contextFacilitator.last_name}_${new Date().toISOString().split('T')[0]}.csv`
            : `hff_campaign_register_${registerMode}_${new Date().toISOString().split('T')[0]}.csv`;
        link.download = filename.replace(/\s+/g, '_');
        link.click();
        URL.revokeObjectURL(url);
    };

    // Day column attendance count calculation
    const dayAttendanceCounts = useMemo(() => {
        const counts = Array(TOTAL_CAMPAIGN_DAYS).fill(0);
        list.forEach(p => {
            const att = localAttendanceMap[p.uuid] || normalizeAttendance(p.attendance);
            att.forEach((present, idx) => {
                if (present) counts[idx]++;
            });
        });
        return counts;
    }, [list, localAttendanceMap]);

    // Roster summary stats
    const rosterStats = useMemo(() => {
        let qualifyingTotal = 0;
        let booksTotal = 0;
        list.forEach(p => {
            const att = localAttendanceMap[p.uuid] || normalizeAttendance(p.attendance);
            if (att.filter(Boolean).length >= 6) qualifyingTotal++;
            const isBook = localBooksMap[p.uuid] !== undefined ? localBooksMap[p.uuid] : Boolean(p.books_received);
            if (isBook) booksTotal++;
        });
        return {
            total: list.length,
            qualifying: qualifyingTotal,
            books: booksTotal
        };
    }, [list, localAttendanceMap, localBooksMap]);

    if (!queryData) {
        return (
            <div className="flex flex-col items-center justify-center p-24 space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-[#71167F]/20 border-t-[#71167F] animate-spin" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Marking Register...</p>
            </div>
        );
    }

    const isGridActive = registerMode === 'all' || registerMode === 'unassigned' || (registerMode === 'team' && selectedFacilitator);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-16">
            {/* Header & Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {isGridActive && (
                        <button
                            onClick={() => {
                                if (isContextual && onBack) {
                                    onBack();
                                } else {
                                    setSelectedFacilitator(null);
                                    setRegisterMode('team');
                                    setSearchTerm('');
                                }
                            }}
                            className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#71167F] hover:shadow-lg transition-all active:scale-95 shadow-sm"
                            title={isContextual ? "Back to Previous View" : "Back to Team Selection"}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                {isGridActive 
                                    ? (contextFacilitator 
                                        ? `Register: ${contextFacilitator.first_name} ${contextFacilitator.last_name}` 
                                        : registerMode === 'unassigned' 
                                            ? 'Unassigned Participants Register' 
                                            : 'Full Campaign Attendance Register')
                                    : 'Marking Register Protocol'}
                            </h3>
                            {/* Live Cloud Sync Pill */}
                            <div className={cn(
                                "hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all",
                                syncStatus === 'synced' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                syncStatus === 'saving' && "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
                                syncStatus === 'offline-saved' && "bg-amber-50 text-amber-700 border-amber-200",
                                syncStatus === 'error' && "bg-rose-50 text-rose-700 border-rose-200"
                            )} title={lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Cloud sync status'}>
                                {syncStatus === 'saving' ? (
                                    <>
                                        <RefreshCw size={11} className="animate-spin" />
                                        <span>Saving ({pendingCount})...</span>
                                    </>
                                ) : syncStatus === 'offline-saved' ? (
                                    <>
                                        <Cloud size={11} />
                                        <span>Offline Saved</span>
                                    </>
                                ) : syncStatus === 'error' ? (
                                    <>
                                        <AlertCircle size={11} />
                                        <span>Sync Retry</span>
                                    </>
                                ) : (
                                    <>
                                        <CloudCheck size={11} className="text-emerald-600" />
                                        <span>Cloud Synced</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            {isGridActive 
                                ? `Active Roster: ${list.length} attendees • ${rosterStats.qualifying} qualifying certificates (>=6 days)`
                                : 'Select a facilitator team or toggle all participants to mark daily attendance'}
                        </p>
                    </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* View Switcher Pills */}
                    <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-100 shadow-sm text-[10px] font-black uppercase tracking-wider">
                        <button
                            onClick={() => {
                                setRegisterMode('team');
                                setSelectedFacilitator(null);
                                setSearchTerm('');
                            }}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl transition-all",
                                registerMode === 'team' && !selectedFacilitator 
                                    ? "bg-[#71167F] text-white shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Teams
                        </button>
                        <button
                            onClick={() => {
                                setRegisterMode('all');
                                setSelectedFacilitator(null);
                                setSearchTerm('');
                            }}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl transition-all",
                                registerMode === 'all' 
                                    ? "bg-[#71167F] text-white shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            All Register
                        </button>
                        <button
                            onClick={() => {
                                setRegisterMode('unassigned');
                                setSelectedFacilitator(null);
                                setSearchTerm('');
                            }}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl transition-all",
                                registerMode === 'unassigned' 
                                    ? "bg-[#71167F] text-white shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Unassigned
                        </button>
                    </div>

                    {/* Change Facilitator Dropdown if inside team grid */}
                    {isGridActive && allFacilitators.length > 0 && (
                        <div className="relative">
                            <select
                                value={contextFacilitator?.uuid || ''}
                                onChange={(e) => {
                                    const uuid = e.target.value;
                                    if (!uuid) {
                                        setRegisterMode('all');
                                        setSelectedFacilitator(null);
                                    } else {
                                        const found = allFacilitators.find(f => f.uuid === uuid);
                                        if (found) {
                                            setSelectedFacilitator(found);
                                            setRegisterMode('team');
                                        }
                                    }
                                }}
                                className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#71167F]/20 cursor-pointer"
                            >
                                <option value="">Switch Team...</option>
                                {allFacilitators.map(f => (
                                    <option key={f.uuid} value={f.uuid}>
                                        {f.first_name} {f.last_name} ({f.participantCount || 0})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Export CSV Button */}
                    {isGridActive && (
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-700 hover:text-[#71167F] hover:shadow-md transition-all shadow-sm active:scale-95"
                            title="Download attendance sheet as CSV"
                        >
                            <Download size={13} />
                            <span>Export</span>
                        </button>
                    )}

                    {/* Manual Sync Trigger */}
                    <button
                        onClick={flushSync}
                        disabled={syncStatus === 'saving'}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#71167F]/10 hover:bg-[#71167F]/20 border border-[#71167F]/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#71167F] transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Force push pending records to cloud"
                    >
                        <RefreshCw size={13} className={syncStatus === 'saving' ? "animate-spin" : ""} />
                        <span>Sync</span>
                    </button>
                </div>
            </div>

            {/* Global Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white shadow-xl shadow-gray-200/30">
                <div className="relative w-full max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={
                            isGridActive
                                ? "Search roster by name, form #, phone, meeting place..."
                                : "Search teams by facilitator name, meeting place, phone, form #..."
                        }
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-12 pr-10 py-3 rounded-2xl bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] transition-all text-sm font-bold text-gray-900 shadow-sm"
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

                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 rounded-xl bg-purple-50 border border-purple-100 text-[10px] font-black text-[#71167F] uppercase tracking-widest">
                        {isGridActive ? `${list.length} Records in View` : `${allFacilitators.length} Facilitator Teams`}
                    </div>
                    {isGridActive && (
                        <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                            {rosterStats.qualifying} Qualifying
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Participants Matching Banner (When searching from Teams View) */}
            {!isGridActive && matchingParticipants.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#71167F] flex items-center gap-1.5">
                            <Sparkles size={13} />
                            Matching Participants in Campaign Register ({matchingParticipants.length})
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Click any to open their register directly</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {matchingParticipants.map(mp => (
                            <button
                                key={mp.uuid}
                                onClick={() => {
                                    if (mp.assignedFacilitator) {
                                        setSelectedFacilitator(mp.assignedFacilitator);
                                        setRegisterMode('team');
                                    } else {
                                        setSelectedFacilitator(null);
                                        setRegisterMode('unassigned');
                                    }
                                    setHighlightedParticipantUuid(mp.uuid);
                                    setSearchTerm('');
                                }}
                                className="flex flex-col text-left p-2.5 bg-white rounded-xl border border-purple-100 hover:border-[#71167F] hover:shadow-md transition-all group"
                            >
                                <span className="text-xs font-black text-gray-900 group-hover:text-[#71167F] truncate">
                                    {mp.first_name} {mp.last_name}
                                </span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase truncate mt-0.5">
                                    Team: {mp.facilitatorName}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW 1: Facilitator Teams Card Grid */}
            {!isGridActive ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white/70 rounded-[2.5rem] border-2 border-dashed border-gray-200 p-8 shadow-sm">
                            <div className="bg-[#71167F]/5 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#71167F]">
                                <Users className="h-8 w-8 opacity-60" />
                            </div>
                            <h4 className="text-base font-black text-gray-900 uppercase tracking-tight mb-1">
                                {searchTerm ? "No Matching Facilitator Teams" : "No Facilitator Teams Found"}
                            </h4>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider max-w-sm mx-auto mb-4">
                                {searchTerm 
                                    ? `No teams matched "${searchTerm}". You can switch to All Register or Unassigned view above.`
                                    : "Add facilitators in the Directory to organize attendance registers by field team."}
                            </p>
                            <div className="flex justify-center gap-3">
                                {searchTerm ? (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Clear Search
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setRegisterMode('all')}
                                        className="px-5 py-2 rounded-xl bg-[#71167F] hover:bg-[#5b1266] text-white text-xs font-black uppercase tracking-widest transition-all shadow-md"
                                    >
                                        View Full Campaign Register
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        list.map(f => (
                            <div
                                key={f.uuid}
                                onClick={() => {
                                    setSelectedFacilitator(f);
                                    setRegisterMode('team');
                                    setSearchTerm('');
                                }}
                                className="group relative bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                    <Check className="h-24 w-24 -rotate-12" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-14 w-14 rounded-2xl bg-[#71167F] text-white flex items-center justify-center shadow-lg shadow-[#71167F]/20 text-lg font-black shrink-0 transition-transform group-hover:rotate-3">
                                        {(f.first_name?.[0] || 'F') + (f.last_name?.[0] || '')}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-lg font-black text-gray-900 leading-tight truncate">
                                            {f.first_name} {f.last_name}
                                        </h4>
                                        <p className="text-[10px] font-bold text-[#71167F] uppercase tracking-widest mt-0.5 truncate flex items-center gap-1">
                                            <MapPin size={10} />
                                            {f.place || 'General Group'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Assigned</span>
                                            <span className="text-base font-black text-gray-900">{f.participantCount || 0}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Qualifying</span>
                                            <span className="text-base font-black text-emerald-600">{f.qualifyingCount || 0}</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center group-hover:bg-[#71167F] group-hover:text-white transition-all shadow-inner">
                                        <CalendarCheck size={18} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* VIEW 2: The Core Marking Register Grid */
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/40 overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 hff-gradient-bg opacity-40" />

                    {/* Quick Roster Actions Bar */}
                    <div className="p-4 px-6 bg-gray-50/50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-gray-600">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                Drag across days to quick-mark (paint mode active)
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-700 font-black">
                                <span className="w-2.5 h-2.5 rounded bg-[#3EB049] inline-block shadow-sm" />
                                Present (P)
                            </span>
                            <span className="flex items-center gap-1 text-gray-400 font-black">
                                <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-gray-200 inline-block" />
                                Absent (A)
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                            <div 
                                className="grid overflow-hidden select-none" 
                                style={{ gridTemplateColumns: `310px 90px 110px repeat(${days.length}, minmax(52px, 1fr)) 100px` }}
                            >
                                {/* Header Row */}
                                <div className="p-4 px-6 bg-gray-50/90 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 z-20 backdrop-blur-md">
                                    Attendee Identity
                                </div>
                                <div className="p-4 bg-gray-50/90 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    Book
                                </div>
                                <div className="p-4 bg-gray-50/90 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    Attended
                                </div>

                                {days.map((day, idx) => {
                                    const attendedCount = dayAttendanceCounts[idx] || 0;
                                    const isActionOpen = columnActionMenu?.dayIndex === idx;

                                    return (
                                        <div 
                                            key={day} 
                                            className="p-3 bg-gray-50/90 border-b border-r border-gray-100 text-center relative group/col cursor-pointer"
                                            onClick={() => setColumnActionMenu(isActionOpen ? null : { dayIndex: idx })}
                                            title={`Click for Day ${idx + 1} batch actions`}
                                        >
                                            <div className="text-[11px] font-black text-gray-700 uppercase tracking-wider">
                                                {day}
                                            </div>
                                            <div className="text-[9px] font-black text-gray-400 mt-0.5">
                                                {attendedCount}
                                            </div>

                                            {/* Column Popover Action Menu */}
                                            {isActionOpen && (
                                                <div 
                                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 w-36 text-left animate-in fade-in zoom-in-95 duration-150"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                                        Day {idx + 1} Actions
                                                    </div>
                                                    <button
                                                        onClick={() => handleMarkColumn(idx, true)}
                                                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-50 transition-colors"
                                                    >
                                                        <Check size={12} className="text-emerald-600" />
                                                        Mark All (P)
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkColumn(idx, false)}
                                                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-rose-700 hover:bg-rose-50 transition-colors"
                                                    >
                                                        <X size={12} className="text-rose-600" />
                                                        Clear Day
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <div className="p-4 bg-gray-50/90 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    Quick Action
                                </div>

                                {/* Data Rows */}
                                {list.length === 0 ? (
                                    <div className="col-span-full py-20 text-center bg-white/70">
                                        <div className="bg-gray-100 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
                                            <Users className="h-7 w-7 opacity-60" />
                                        </div>
                                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">
                                            {searchTerm ? "No Matching Attendees Found" : "No Attendees on this Roster"}
                                        </p>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider max-w-sm mx-auto mb-3">
                                            {searchTerm 
                                                ? `No attendee matching "${searchTerm}" found on this register view.`
                                                : "There are currently no attendees assigned to this group."}
                                        </p>
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="px-4 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                Clear Filter
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    list.map(p => {
                                        const isHighlighted = highlightedParticipantUuid === p.uuid;
                                        const att = localAttendanceMap[p.uuid] || normalizeAttendance(p.attendance);
                                        const attendedCount = att.filter(Boolean).length;
                                        const isQualifying = attendedCount >= 6;
                                        const isBookReceived = localBooksMap[p.uuid] !== undefined ? localBooksMap[p.uuid] : Boolean(p.books_received);

                                        return (
                                            <React.Fragment key={p.uuid}>
                                                {/* Sticky Identity Column */}
                                                <div 
                                                    ref={isHighlighted ? highlightedRowRef : null}
                                                    className={cn(
                                                        "px-6 py-3.5 border-b border-gray-50 flex flex-col justify-center bg-white group/name sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] transition-colors",
                                                        isHighlighted && "bg-purple-50 ring-2 ring-[#71167F] z-15"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-xs font-black text-gray-900 group-hover/name:text-[#71167F] transition-colors truncate">
                                                            {p.first_name} {p.last_name}
                                                        </span>
                                                        {isHighlighted && (
                                                            <span className="h-2 w-2 rounded-full bg-[#71167F] animate-ping shrink-0" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-tighter truncate">
                                                        {p.type === 'facilitator' ? (
                                                            <span className="text-[#71167F] font-black">FACILITATOR</span>
                                                        ) : (
                                                            <span>REF: {p.uuid.slice(0, 8)}</span>
                                                        )}
                                                        {p.form_number && (
                                                            <span>• #{p.form_number}</span>
                                                        )}
                                                        {p.place && (
                                                            <span className="truncate">• {p.place}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Books Column */}
                                                <div className="p-2 border-b border-gray-50 flex items-center justify-center">
                                                    <button
                                                        onClick={() => handleToggleBook(p)}
                                                        className={cn(
                                                            "p-1.5 rounded-xl border transition-all text-[10px] font-black flex items-center justify-center",
                                                            isBookReceived
                                                                ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                                                                : "bg-gray-50 border-gray-100 text-gray-300 hover:border-gray-200 hover:text-gray-400"
                                                        )}
                                                        title={isBookReceived ? "Book Given (Click to Undo)" : "Mark Book Given"}
                                                    >
                                                        <BookOpen size={14} className={isBookReceived ? "stroke-[2.5px]" : ""} />
                                                    </button>
                                                </div>

                                                {/* Attended Count & Qualifying Status */}
                                                <div className="p-2 px-3 border-b border-gray-50 flex flex-col items-center justify-center">
                                                    <span className={cn(
                                                        "text-xs font-black",
                                                        isQualifying ? "text-emerald-600" : "text-gray-700"
                                                    )}>
                                                        {attendedCount} / {TOTAL_CAMPAIGN_DAYS}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md mt-0.5",
                                                        isQualifying ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"
                                                    )}>
                                                        {isQualifying ? "Qualifying" : "In Progress"}
                                                    </span>
                                                </div>

                                                {/* 12 Day Attendance Cells (Click & Drag Paint Support) */}
                                                {days.map((day, idx) => {
                                                    const isPresent = att[idx];

                                                    return (
                                                        <div
                                                            key={`${p.uuid}-${day}`}
                                                            onMouseDown={() => handlePaintAttendance(p, idx, true)}
                                                            onMouseEnter={() => handlePaintAttendance(p, idx)}
                                                            className={cn(
                                                                "p-3 border-b border-r border-gray-50 flex items-center justify-center cursor-pointer transition-all select-none",
                                                                isPresent ? "bg-[#3EB049]/5 hover:bg-[#3EB049]/10" : "bg-white hover:bg-gray-50/80"
                                                            )}
                                                            title={`Day ${idx + 1}: ${isPresent ? "Present (Click to toggle)" : "Absent (Click to toggle)"}`}
                                                        >
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 transform",
                                                                isPresent 
                                                                    ? "bg-[#3EB049] text-white shadow-md shadow-[#3EB049]/20 scale-105" 
                                                                    : "bg-gray-100 text-transparent hover:bg-gray-200"
                                                            )}>
                                                                <Check size={13} className="stroke-[3.5px]" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Quick Action Column (Mark All / Clear) */}
                                                <div className="p-2 border-b border-gray-50 flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleMarkAllDaysForPerson(p, true)}
                                                        className="p-1 px-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-700 border border-gray-100 text-[9px] font-black uppercase tracking-wider transition-colors"
                                                        title="Mark all 12 days present"
                                                    >
                                                        All
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkAllDaysForPerson(p, false)}
                                                        className="p-1 px-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-700 border border-gray-100 text-[9px] font-black uppercase tracking-wider transition-colors"
                                                        title="Clear all days"
                                                    >
                                                        None
                                                    </button>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceSheet;
