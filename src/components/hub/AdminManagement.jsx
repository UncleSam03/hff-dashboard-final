import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { db as firestoreDb, isConfigured } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/dexieDb';
import { 
    Shield, ShieldCheck, ShieldAlert, Crown, UserCheck, UserX, 
    Clock, Mail, AlertCircle, Check, RefreshCw, UserPlus, Lock, Sparkles,
    FileText, Hash, Layers, ArrowUpRight, ChevronRight, Sliders
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
    compute200FormsAudit, 
    getAdminRangeProgress, 
    setAdminFormRange, 
    TOTAL_CAMPAIGN_FORMS 
} from '../../lib/formRangeManager';

export default function AdminManagement({ onOpenPaperForm }) {
    const { user, isMasterAdmin, admitAdmin, revokeAdmin, masterAdminEmail } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null); // uid currently being modified
    const [statusMessage, setStatusMessage] = useState(null);
    const [preAuthEmail, setPreAuthEmail] = useState('');
    const [preAuthName, setPreAuthName] = useState('');
    const [preAuthSubmitting, setPreAuthSubmitting] = useState(false);

    // 200 Forms Tracker UI states
    const [showMissingForms, setShowMissingForms] = useState(false);
    const [showMatrixView, setShowMatrixView] = useState(false);
    const [rangeEditing, setRangeEditing] = useState({}); // { [adminId]: { start, end } }

    // Live registrations from Dexie for real-time 200-form audit
    const registrations = useLiveQuery(async () => {
        return await db.registrations.toArray();
    }) || [];

    const audit = useMemo(() => {
        return compute200FormsAudit(registrations);
    }, [registrations]);

    const loadProfiles = async () => {
        setLoading(true);
        setStatusMessage(null);
        try {
            if (!isConfigured || !firestoreDb) {
                // Mock dev data if Firebase is offline
                setProfiles([
                    {
                        id: 'dev-master-admin-id',
                        email: masterAdminEmail,
                        full_name: 'Samukeliso Mayabane',
                        role: 'master_admin',
                        admin_status: 'approved',
                        approved_at: '2026-01-01T00:00:00.000Z'
                    },
                    {
                        id: 'dev-admin-id',
                        email: 'admin@thehealthyfamilies.net',
                        full_name: 'HFF Administrator',
                        role: 'admin',
                        admin_status: 'approved',
                        approved_at: '2026-02-15T10:00:00.000Z',
                        approved_by: masterAdminEmail
                    },
                    {
                        id: 'dev-pending-id',
                        email: 'coordinator@thehealthyfamilies.net',
                        full_name: 'New Field Coordinator',
                        role: 'facilitator',
                        admin_status: 'pending_approval',
                        requested_at: '2026-09-28T08:30:00.000Z'
                    }
                ]);
                return;
            }

            const snapshot = await getDocs(collection(firestoreDb, 'profiles'));
            const list = [];
            snapshot.forEach(d => {
                list.push({ id: d.id, ...d.data() });
            });
            setProfiles(list);
        } catch (err) {
            console.error('[AdminManagement] Error loading profiles:', err);
            setStatusMessage({ type: 'error', text: 'Could not load user profiles from cloud database.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    const handleAdmit = async (targetUser) => {
        setActionLoading(targetUser.id);
        setStatusMessage(null);
        try {
            await admitAdmin(targetUser.id);
            setStatusMessage({ 
                type: 'success', 
                text: `Admitted ${targetUser.full_name || targetUser.email} as an Administrator!` 
            });
            await loadProfiles();
        } catch (err) {
            console.error('[AdminManagement] Failed to admit:', err);
            setStatusMessage({ type: 'error', text: err.message || 'Failed to admit user.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (targetUser) => {
        if (!window.confirm(`Are you sure you want to revoke admin access for ${targetUser.full_name || targetUser.email}?`)) {
            return;
        }

        setActionLoading(targetUser.id);
        setStatusMessage(null);
        try {
            await revokeAdmin(targetUser.id);
            setStatusMessage({ 
                type: 'success', 
                text: `Admin privileges revoked for ${targetUser.full_name || targetUser.email}.` 
            });
            await loadProfiles();
        } catch (err) {
            console.error('[AdminManagement] Failed to revoke:', err);
            setStatusMessage({ type: 'error', text: err.message || 'Failed to revoke admin.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handlePreAuthorize = async (e) => {
        e.preventDefault();
        const trimmedEmail = preAuthEmail.trim().toLowerCase();
        if (!trimmedEmail) return;

        setPreAuthSubmitting(true);
        setStatusMessage(null);

        try {
            if (isConfigured && firestoreDb) {
                // Find existing profile with this email or create pre-approval
                const existing = profiles.find(p => p.email?.toLowerCase() === trimmedEmail);
                if (existing) {
                    await admitAdmin(existing.id);
                } else {
                    const pseudoUid = 'preauth-' + trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_');
                    const profileRef = doc(firestoreDb, 'profiles', pseudoUid);
                    await setDoc(profileRef, {
                        id: pseudoUid,
                        email: trimmedEmail,
                        full_name: preAuthName.trim() || 'Invited Admin',
                        role: 'admin',
                        admin_status: 'approved',
                        approved_at: new Date().toISOString(),
                        approved_by: user?.email || masterAdminEmail,
                        pre_authorized: true
                    }, { merge: true });
                }
            }
            setStatusMessage({ 
                type: 'success', 
                text: `Pre-authorized ${trimmedEmail}. When they sign in, they will have Admin access!` 
            });
            setPreAuthEmail('');
            setPreAuthName('');
            await loadProfiles();
        } catch (err) {
            console.error('[AdminManagement] Pre-auth error:', err);
            setStatusMessage({ type: 'error', text: err.message || 'Failed to pre-authorize user.' });
        } finally {
            setPreAuthSubmitting(false);
        }
    };

    const handleRangeChange = (adminId, field, value) => {
        const val = parseInt(value, 10) || 1;
        setRangeEditing(prev => ({
            ...prev,
            [adminId]: {
                ...(prev[adminId] || {
                    start: profiles.find(p => p.id === adminId)?.form_range_start || 1,
                    end: profiles.find(p => p.id === adminId)?.form_range_end || 50
                }),
                [field]: val
            }
        }));
    };

    const handleSaveRange = async (admin) => {
        const currentEdit = rangeEditing[admin.id] || {
            start: admin.form_range_start || 1,
            end: admin.form_range_end || 50
        };
        setActionLoading(admin.id);
        setStatusMessage(null);
        try {
            await setAdminFormRange(admin.id, currentEdit.start, currentEdit.end);
            setStatusMessage({
                type: 'success',
                text: `Updated Form Range for ${admin.full_name || admin.email}: Forms ${currentEdit.start}–${currentEdit.end}`
            });
            await loadProfiles();
        } catch (err) {
            console.error('[AdminManagement] Failed to set range:', err);
            setStatusMessage({ type: 'error', text: 'Failed to update range: ' + err.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleQuickAdjustRange = async (admin, delta) => {
        const currentEnd = rangeEditing[admin.id]?.end || admin.form_range_end || 50;
        const currentStart = rangeEditing[admin.id]?.start || admin.form_range_start || 1;
        const newEnd = Math.max(currentStart, Math.min(TOTAL_CAMPAIGN_FORMS, currentEnd + delta));
        
        setActionLoading(admin.id);
        setStatusMessage(null);
        try {
            await setAdminFormRange(admin.id, currentStart, newEnd);
            setRangeEditing(prev => ({
                ...prev,
                [admin.id]: { start: currentStart, end: newEnd }
            }));
            setStatusMessage({
                type: 'success',
                text: `Adjusted Form Range for ${admin.full_name || admin.email}: Forms ${currentStart}–${newEnd}`
            });
            await loadProfiles();
        } catch (err) {
            console.error('[AdminManagement] Failed to adjust range:', err);
            setStatusMessage({ type: 'error', text: 'Failed to adjust range: ' + err.message });
        } finally {
            setActionLoading(null);
        }
    };

    if (!isMasterAdmin) {
        return (
            <div className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm text-center max-w-lg mx-auto my-12">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <Lock size={28} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Restricted Access</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Only the Master Admin (<strong>{masterAdminEmail}</strong>) can view and admit new administrators.
                </p>
            </div>
        );
    }

    const pendingRequests = profiles.filter(p => 
        p.admin_status === 'pending_approval' && 
        p.role !== 'master_admin' && 
        p.email?.toLowerCase() !== masterAdminEmail.toLowerCase()
    );

    const activeAdmins = profiles.filter(p => 
        (p.role === 'admin' && p.admin_status === 'approved') || 
        (p.role === 'admin' && !p.admin_status)
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Master Admin Notice Hero */}
            <div className="liquid-glass-elevated rounded-[2.5rem] p-7 border border-white/80 shadow-xl relative overflow-hidden backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#71167F] text-white flex items-center justify-center shadow-lg shadow-[#71167F]/25 shrink-0">
                            <Crown size={28} className="text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300/60">
                                    Master Admin Control
                                </span>
                                <span className="text-xs text-gray-400 font-bold">•</span>
                                <span className="text-xs font-bold text-gray-600">{masterAdminEmail}</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
                                Administrator Admission & Access Governance
                            </h2>
                            <p className="text-xs text-gray-500 font-medium max-w-2xl mt-1.5 leading-relaxed">
                                As Master Admin, you alone hold permission to admit team members to the Admin Panel. Admitted admins are restricted strictly to the <strong>Current Active Campaign</strong>, while you retain exclusive access to past campaign records and archives.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={loadProfiles}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:text-[#71167F] hover:shadow-md transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 self-start md:self-center"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-[#71167F]" : ""} />
                        Refresh List
                    </button>
                </div>
            </div>

            {/* Status Feedback Toast */}
            {statusMessage && (
                <div className={cn(
                    "p-4 rounded-2xl text-xs font-bold flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-2 border shadow-sm",
                    statusMessage.type === 'success' 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-red-50 text-red-800 border-red-200"
                )}>
                    {statusMessage.type === 'success' ? (
                        <Check size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle size={18} className="text-red-600 shrink-0" />
                    )}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* SECTION 0: 200 Numbered Forms Live Field Audit */}
            <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#71167F]/10 text-[#71167F] flex items-center justify-center shrink-0">
                            <FileText size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-[#71167F]">
                                    Master Field Audit
                                </span>
                                <span className="text-xs font-bold text-gray-400">• Total Physical Forms: 200</span>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">
                                200 Numbered Forms Intake & Progress Tracker
                            </h3>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowMatrixView(!showMatrixView)}
                            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            <Layers size={14} />
                            <span>{showMatrixView ? "Hide Form Matrix" : "View 200 Form Matrix"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowMissingForms(!showMissingForms)}
                            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            <AlertCircle size={14} className="text-amber-600" />
                            <span>{audit.missingFormsCount} Missing Forms</span>
                        </button>
                    </div>
                </div>

                {/* Metric Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Completed Forms Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/30 border border-emerald-100/80 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1">
                            Completed Forms
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-emerald-900">{audit.completedFormsCount}</span>
                            <span className="text-xs font-bold text-emerald-700">/ 200 Forms</span>
                        </div>
                        <div className="w-full bg-emerald-200/50 rounded-full h-2 mt-3 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${audit.completionPercentage}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 mt-1.5 block">
                            {audit.completionPercentage}% of total field forms fully captured
                        </span>
                    </div>

                    {/* In-Progress Forms */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-100/80 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block mb-1">
                            In-Progress Forms
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-amber-900">{audit.inProgressFormsCount}</span>
                            <span className="text-xs font-bold text-amber-700">Forms</span>
                        </div>
                        <p className="text-[11px] font-medium text-amber-800/80 mt-3">
                            Facilitator registered on Day 1, awaiting participant transcription
                        </p>
                    </div>

                    {/* Missing Forms */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50/30 border border-rose-100/80 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block mb-1">
                            Missing / Unentered Forms
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-rose-900">{audit.missingFormsCount}</span>
                            <span className="text-xs font-bold text-rose-700">/ 200 Forms</span>
                        </div>
                        <p className="text-[11px] font-medium text-rose-800/80 mt-3">
                            Forms that have zero records logged in the database yet
                        </p>
                    </div>

                    {/* Total Captured Participants */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/30 border border-purple-100/80 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#71167F] block mb-1">
                            Mass Participants Logged
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-[#71167F]">{audit.totalParticipantsCaptured}</span>
                            <span className="text-xs font-bold text-purple-700">People</span>
                        </div>
                        <p className="text-[11px] font-medium text-purple-900/80 mt-3">
                            Transcribed across the active physical paper forms
                        </p>
                    </div>
                </div>

                {/* Missing Forms List Drawer */}
                {showMissingForms && (
                    <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <AlertCircle size={15} className="text-amber-600" />
                                <span>Exact Missing Form Numbers ({audit.missingFormNumbers.length} Forms)</span>
                            </h4>
                            <button
                                onClick={() => setShowMissingForms(false)}
                                className="text-xs font-bold text-amber-700 hover:text-amber-900"
                            >
                                Close
                            </button>
                        </div>
                        <p className="text-xs text-amber-800 mb-3 font-medium">
                            Click any missing form number below to open Paper Form Batch Entry and transcribe it:
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                            {audit.missingFormNumbers.map(num => (
                                <button
                                    key={num}
                                    onClick={() => onOpenPaperForm?.(num)}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-mono font-bold text-amber-900 hover:bg-[#71167F] hover:text-white hover:border-[#71167F] transition-all shadow-sm"
                                    title={`Transcribe Form #${num}`}
                                >
                                    #{num}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Interactive 200-Cell Matrix View */}
                {showMatrixView && (
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
                                    Visual Matrix: Forms 1 to 200 Status
                                </h4>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    Click any cell to jump to that form in Paper Batch Entry
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold">
                                <span className="flex items-center gap-1 text-emerald-700">
                                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Completed
                                </span>
                                <span className="flex items-center gap-1 text-amber-700">
                                    <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> In-Progress
                                </span>
                                <span className="flex items-center gap-1 text-gray-400">
                                    <span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block" /> Missing
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5">
                            {audit.formMatrix.map(f => (
                                <button
                                    key={f.formNumber}
                                    onClick={() => onOpenPaperForm?.(f.formNumber)}
                                    className={cn(
                                        "aspect-square rounded-md text-[10px] font-mono font-bold flex flex-col items-center justify-center transition-all hover:scale-110 shadow-sm",
                                        f.status === 'completed' && "bg-emerald-500 text-white hover:bg-emerald-600",
                                        f.status === 'in_progress' && "bg-amber-400 text-amber-950 hover:bg-amber-500",
                                        f.status === 'missing' && "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                    )}
                                    title={`Form #${f.formNumber} - ${f.status.toUpperCase()} (${f.participantsCount} participants)`}
                                >
                                    {f.formNumber}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 1: Pending Admin Requests */}
            <div className="bg-white/70 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">
                                Pending Admin Requests ({pendingRequests.length})
                            </h3>
                            <p className="text-xs text-gray-400 font-bold">
                                Users awaiting your admission before they can access the Admin Dashboard
                            </p>
                        </div>
                    </div>
                </div>

                {pendingRequests.length === 0 ? (
                    <div className="text-center py-10 rounded-2xl border-2 border-dashed border-gray-200/80 bg-gray-50/50">
                        <Check size={28} className="text-emerald-500 mx-auto mb-2" />
                        <p className="text-xs font-black text-gray-600 uppercase tracking-wider">No Pending Requests</p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">All team members have been reviewed or admitted.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingRequests.map(applicant => (
                            <div 
                                key={applicant.id}
                                className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/70 flex flex-col justify-between gap-4"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                            Awaiting Admission
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-bold">
                                            {applicant.requested_at ? new Date(applicant.requested_at).toLocaleDateString() : 'Recent'}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-black text-gray-900">
                                        {applicant.full_name || 'HFF Staff Member'}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium mt-1">
                                        <Mail size={13} className="text-amber-600" />
                                        <span>{applicant.email}</span>
                                    </div>
                                    {applicant.phone && (
                                        <p className="text-xs text-gray-400 mt-1">Phone: {applicant.phone}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-3 border-t border-amber-200/40">
                                    <button
                                        onClick={() => handleAdmit(applicant)}
                                        disabled={actionLoading === applicant.id}
                                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#71167F] hover:bg-[#5b1266] text-white text-xs font-black uppercase tracking-wider shadow-md shadow-[#71167F]/20 flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <UserCheck size={14} />
                                        <span>{actionLoading === applicant.id ? "Admitting..." : "Admit as Admin"}</span>
                                    </button>
                                    <button
                                        onClick={() => handleRevoke(applicant)}
                                        disabled={actionLoading === applicant.id}
                                        className="py-2.5 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-red-600 text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 2: Active Administrators */}
            <div className="bg-white/70 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">
                                Admitted Administrators ({activeAdmins.length})
                            </h3>
                            <p className="text-xs text-gray-400 font-bold">
                                Users approved to access the Admin Panel (Scoped to Current Campaign)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Master Admin Card (Self) */}
                    <div className="p-5 rounded-2xl bg-purple-50/50 border-2 border-[#71167F]/30 flex flex-col justify-between relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 px-3 py-1 bg-[#71167F] text-amber-300 text-[9px] font-black uppercase tracking-wider rounded-bl-xl flex items-center gap-1">
                            <Crown size={11} /> Master Admin
                        </div>
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-[#71167F] text-white flex items-center justify-center font-black mb-3">
                                SM
                            </div>
                            <h4 className="text-base font-black text-gray-900">Samukeliso Mayabane</h4>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">{masterAdminEmail}</p>
                            <div className="mt-4 pt-3 border-t border-purple-200/50 space-y-1">
                                <span className="text-[10px] font-black uppercase text-[#71167F] block">Privileges:</span>
                                <span className="text-[11px] font-bold text-gray-600 block">✓ All Campaigns (Past & Current)</span>
                                <span className="text-[11px] font-bold text-gray-600 block">✓ User Admission & Governance</span>
                                <span className="text-[11px] font-bold text-gray-600 block">✓ Form Submitter Attribution</span>
                            </div>
                        </div>
                    </div>

                    {/* Standard Admins */}
                    {activeAdmins.map(admin => {
                        const isSelf = admin.email?.toLowerCase() === masterAdminEmail.toLowerCase();
                        if (isSelf) return null;

                        return (
                            <div 
                                key={admin.id}
                                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between hover:border-gray-200 transition-all"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            Admitted Admin
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-bold">
                                            {admin.approved_at ? new Date(admin.approved_at).toLocaleDateString() : 'Active'}
                                        </span>
                                    </div>

                                    <h4 className="text-base font-black text-gray-900">
                                        {admin.full_name || 'Administrator'}
                                    </h4>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">{admin.email}</p>

                                    {/* Form Range Allocation & Dynamic Adjustments */}
                                    <div className="mt-3.5 p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100/80 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-[#71167F] flex items-center gap-1">
                                                <Sliders size={12} /> Assigned Range
                                            </span>
                                            <span className="text-[10px] font-bold text-purple-900">
                                                Forms {admin.form_range_start || 1}–{admin.form_range_end || 50}
                                            </span>
                                        </div>

                                        {/* Admin Progress in their Range */}
                                        {(() => {
                                            const prog = getAdminRangeProgress(
                                                audit.formMatrix, 
                                                admin.form_range_start || 1, 
                                                admin.form_range_end || 50
                                            );
                                            return (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold text-gray-700">
                                                        <span>Progress: {prog.completedInRange} / {prog.totalInRange} forms</span>
                                                        <span className="text-[#71167F]">{prog.percentage}%</span>
                                                    </div>
                                                    <div className="w-full bg-purple-200/50 rounded-full h-1.5 overflow-hidden">
                                                        <div 
                                                            className="bg-[#71167F] h-1.5 rounded-full transition-all duration-300"
                                                            style={{ width: `${prog.percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-gray-500 font-medium block">
                                                        {prog.participantsInRange} participants captured
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {/* Form Range Inputs & Quick Adjust Buttons */}
                                        <div className="pt-2 border-t border-purple-100/70 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={TOTAL_CAMPAIGN_FORMS}
                                                    value={rangeEditing[admin.id]?.start ?? (admin.form_range_start || 1)}
                                                    onChange={e => handleRangeChange(admin.id, 'start', e.target.value)}
                                                    className="w-12 bg-white border border-gray-200 rounded-lg px-1 py-0.5 text-center font-bold text-xs"
                                                    title="Start Form #"
                                                />
                                                <span className="text-xs text-gray-400 font-bold">–</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={TOTAL_CAMPAIGN_FORMS}
                                                    value={rangeEditing[admin.id]?.end ?? (admin.form_range_end || 50)}
                                                    onChange={e => handleRangeChange(admin.id, 'end', e.target.value)}
                                                    className="w-12 bg-white border border-gray-200 rounded-lg px-1 py-0.5 text-center font-bold text-xs"
                                                    title="End Form #"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveRange(admin)}
                                                    disabled={actionLoading === admin.id}
                                                    className="px-2 py-1 rounded-lg bg-[#71167F] text-white text-[10px] font-black uppercase hover:bg-[#5a1166] transition-all shadow-sm"
                                                >
                                                    Set
                                                </button>
                                            </div>

                                            {/* Dynamic Quick Adjust Buttons (+10, +25, -10) */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickAdjustRange(admin, -10)}
                                                    disabled={actionLoading === admin.id}
                                                    className="px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-[10px] font-bold hover:bg-gray-100"
                                                    title="Reduce range by 10 forms"
                                                >
                                                    -10
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickAdjustRange(admin, 10)}
                                                    disabled={actionLoading === admin.id}
                                                    className="px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-[#71167F] text-[10px] font-bold hover:bg-purple-100"
                                                    title="Extend range by 10 forms"
                                                >
                                                    +10
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickAdjustRange(admin, 25)}
                                                    disabled={actionLoading === admin.id}
                                                    className="px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-[#71167F] text-[10px] font-bold hover:bg-purple-100"
                                                    title="Extend range by 25 forms"
                                                >
                                                    +25
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-600 space-y-0.5">
                                        <span className="block text-gray-400 uppercase tracking-wider text-[9px]">Permissions:</span>
                                        <span className="block text-gray-700">✓ Current Campaign Dashboard</span>
                                        <span className="block text-gray-700">✓ Paper Form Batch Entry</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                                    <button
                                        onClick={() => onOpenPaperForm?.(admin.form_range_start || 1)}
                                        className="text-[10px] font-black uppercase tracking-wider text-[#71167F] hover:underline flex items-center gap-1"
                                    >
                                        <span>Open Form #{admin.form_range_start || 1}</span>
                                        <ArrowUpRight size={12} />
                                    </button>

                                    <button
                                        onClick={() => handleRevoke(admin)}
                                        disabled={actionLoading === admin.id}
                                        className="text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                                    >
                                        <UserX size={13} />
                                        Revoke Admin
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTION 3: Pre-Authorize Admin by Email */}
            <div className="bg-white/70 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white shadow-xl shadow-gray-200/40">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#71167F] flex items-center justify-center font-black">
                        <UserPlus size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">
                            Pre-Authorize an Administrator
                        </h3>
                        <p className="text-xs text-gray-400 font-bold">
                            Authorize a colleague before they register so they get instant Admin access upon sign-in
                        </p>
                    </div>
                </div>

                <form onSubmit={handlePreAuthorize} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                            Colleague Full Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Neo Modise"
                            value={preAuthName}
                            onChange={(e) => setPreAuthName(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                            Email Address (@thehealthyfamilies.net)
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="colleague@thehealthyfamilies.net"
                            value={preAuthEmail}
                            onChange={(e) => setPreAuthEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] outline-none"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={preAuthSubmitting}
                            className="w-full py-3.5 px-4 rounded-2xl bg-[#71167F] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#71167F]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <ShieldCheck size={16} />
                            <span>{preAuthSubmitting ? "Pre-authorizing..." : "Grant Admin Access"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
