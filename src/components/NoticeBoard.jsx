import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../lib/dexieDb';
import { isConfigured } from '../lib/firebase';
import { pushPendingToFirebase } from '../lib/firebaseSync';
import { 
    Megaphone, ArrowRight, Plus, AlertCircle, Check, 
    Info, AlertTriangle, Trash2, X, Calendar, 
    Shield, RefreshCw, Search, Users, Clock, Send,
    Inbox, Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

// Optional starter templates that user can voluntarily load
const SAMPLE_TEMPLATES = [
    {
        uuid: 'sample-notice-1',
        title: 'Maun Site Visit & Field Coordination',
        content: 'Field supervision and stakeholder engagement visit scheduled for the Maun regional center. All facilitators must verify local register counts and finalize attendance rosters prior to the briefing session.',
        type: 'Event',
        priority: 'high',
        audience: 'Facilitators',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        sync_status: 'synced'
    },
    {
        uuid: 'sample-notice-2',
        title: 'Daily Attendance Verification Protocol',
        content: 'All campaign nodes must verify and lock attendance daily by 17:00. If operating in low-connectivity areas, records are cached in offline storage and will auto-reconcile once connection is restored.',
        type: 'Policy',
        priority: 'normal',
        audience: 'All',
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        sync_status: 'synced'
    },
    {
        uuid: 'sample-notice-3',
        title: 'Nightly Database Index Optimization',
        content: 'System-wide reconciliation and vacuum jobs run automatically at 02:00 CAT. No downtime is anticipated, and offline data collection remains fully operational during this window.',
        type: 'Update',
        priority: 'normal',
        audience: 'Admins',
        created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        sync_status: 'synced'
    }
];

const TYPE_CONFIG = {
    Event: {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        badge: 'bg-blue-100 text-blue-800',
        icon: Calendar,
        label: 'Event',
    },
    Policy: {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        badge: 'bg-amber-100 text-amber-800',
        icon: Shield,
        label: 'Policy',
    },
    Update: {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800',
        icon: RefreshCw,
        label: 'Update',
    },
    Alert: {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        badge: 'bg-rose-100 text-rose-800',
        icon: AlertTriangle,
        label: 'Alert',
    },
    General: {
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        badge: 'bg-purple-100 text-purple-800',
        icon: Info,
        label: 'General',
    }
};

const PRIORITY_CONFIG = {
    critical: { label: 'Critical', badge: 'bg-red-50 text-red-600 border border-red-200' },
    high: { label: 'High', badge: 'bg-orange-50 text-orange-600 border border-orange-200' },
    normal: { label: 'Normal', badge: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

function formatNoticeDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
        return 'Yesterday';
    }
    if (diffDays < 7) {
        return `${diffDays}d ago`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const NoticeBoard = ({
    variant = 'widget', // 'widget' | 'full'
    onNavigate,
    className
}) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState('Update');
    const [newPriority, setNewPriority] = useState('normal');
    const [newAudience, setNewAudience] = useState('All');

    // Query Dexie with Live Updates (no forced seeding — respects empty state)
    const queryData = useLiveQuery(async () => {
        const notices = await db.notices.orderBy('created_at').reverse().toArray() || [];

        const facilitators = await db.registrations.where('type').equals('facilitator').toArray();
        const participants = await db.registrations.where('type').equals('participant').toArray();

        // Calculate Smart Alerts
        const alerts = [];
        facilitators.forEach(fac => {
            const linked = participants.filter(p => p.facilitator_uuid === fac.uuid);
            if (linked.length === 0) {
                alerts.push({
                    id: `alert-zero-${fac.uuid}`,
                    title: 'Empty Cluster Detected',
                    message: `Facilitator ${fac.first_name || ''} ${fac.last_name || ''} has registered 0 participants.`,
                    priority: 'critical',
                    type: 'health'
                });
            }
        });

        const totalPending = participants.filter(p => p.sync_status === 'pending').length;
        if (totalPending > 15) {
            alerts.push({
                id: 'alert-high-pending',
                title: 'Sync Queue Latency',
                message: `${totalPending} participant records are waiting for cloud synchronization.`,
                priority: 'high',
                type: 'sync'
            });
        }

        return { notices, alerts };
    }, []);

    const rawNotices = queryData?.notices;
    const notices = useMemo(() => rawNotices || [], [rawNotices]);
    const rawAlerts = queryData?.alerts;
    const alerts = useMemo(() => rawAlerts || [], [rawAlerts]);

    const criticalAlert = alerts.find(a => a.priority === 'critical') || alerts[0];

    // Filtered notices for full view
    const filteredNotices = useMemo(() => {
        return notices.filter(n => {
            const matchesType = filterType === 'All' || n.type === filterType;
            const matchesSearch = !searchQuery.trim() || 
                n.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                n.content?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [notices, filterType, searchQuery]);

    const handleCreateNotice = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newContent.trim()) return;

        setIsSubmitting(true);
        try {
            const noticeRecord = {
                uuid: crypto.randomUUID(),
                title: newTitle.trim(),
                content: newContent.trim(),
                type: newType,
                priority: newPriority,
                audience: newAudience,
                created_at: new Date().toISOString(),
                sync_status: 'pending'
            };

            await db.notices.add(noticeRecord);

            // Best-effort background cloud sync
            if (isConfigured && navigator.onLine) {
                await pushPendingToFirebase().catch(() => {});
            }

            // Reset form
            setNewTitle('');
            setNewContent('');
            setNewType('Update');
            setNewPriority('normal');
            setNewAudience('All');
            setIsCreateOpen(false);
        } catch (err) {
            console.error('[NoticeBoard] Error creating notice:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteNotice = async (uuid) => {
        if (!uuid) return;
        if (!window.confirm("Are you sure you want to remove this announcement?")) return;

        try {
            await db.notices.where('uuid').equals(uuid).delete();
            setSelectedNotice(null);
        } catch (err) {
            console.error('[NoticeBoard] Error deleting notice:', err);
        }
    };

    const handleLoadSampleTemplates = async () => {
        try {
            await db.notices.bulkAdd(SAMPLE_TEMPLATES);
        } catch (err) {
            console.error('[NoticeBoard] Failed to load sample templates:', err);
        }
    };

    /* ─────────────────────────────────────────────────────────────
       MODALS: Create & Detail
    ───────────────────────────────────────────────────────────── */
    const renderCreateModal = () => {
        if (!isCreateOpen) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-in fade-in duration-200">
                <div 
                    className="liquid-glass rounded-3xl shadow-2xl border border-white/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="px-6 py-5 border-b border-white/60 flex items-center justify-between bg-white/40">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[#71167F]/10 text-[#71167F]">
                                <Megaphone size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">Post Announcement</h3>
                                <p className="text-xs text-gray-500">Broadcast updates to campaign teams and facilitators</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsCreateOpen(false)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Modal Form */}
                    <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Notice Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g., Regional Logistics Briefing"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#71167F] focus:ring-2 focus:ring-[#71167F]/20 text-sm font-semibold outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Category
                                </label>
                                <select
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#71167F] text-xs font-bold bg-white outline-none"
                                >
                                    <option value="Update">Update</option>
                                    <option value="Event">Event</option>
                                    <option value="Policy">Policy</option>
                                    <option value="Alert">Alert</option>
                                    <option value="General">General</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Priority
                                </label>
                                <select
                                    value={newPriority}
                                    onChange={(e) => setNewPriority(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#71167F] text-xs font-bold bg-white outline-none"
                                >
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Audience
                                </label>
                                <select
                                    value={newAudience}
                                    onChange={(e) => setNewAudience(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#71167F] text-xs font-bold bg-white outline-none"
                                >
                                    <option value="All">All Roles</option>
                                    <option value="Facilitators">Facilitators</option>
                                    <option value="Admins">Admins</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Notice Details *
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder="Provide full details, guidelines, or schedule requirements..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#71167F] focus:ring-2 focus:ring-[#71167F]/20 text-sm font-medium outline-none transition-all resize-none"
                            />
                        </div>

                        {/* Actions */}
                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !newTitle.trim() || !newContent.trim()}
                                className="px-5 py-2.5 rounded-xl hff-gradient-bg text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2"
                            >
                                <Send size={14} />
                                <span>{isSubmitting ? 'Publishing...' : 'Publish Announcement'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const renderDetailModal = () => {
        if (!selectedNotice) return null;
        const cfg = TYPE_CONFIG[selectedNotice.type] || TYPE_CONFIG.General;
        const pri = PRIORITY_CONFIG[selectedNotice.priority] || PRIORITY_CONFIG.normal;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-in fade-in duration-200">
                <div 
                    className="liquid-glass rounded-3xl shadow-2xl border border-white/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-white/60 flex items-center justify-between bg-white/40">
                        <div className="flex items-center gap-2.5">
                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border", cfg.bg)}>
                                {selectedNotice.type || 'Notice'}
                            </span>
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide", pri.badge)}>
                                {pri.label}
                            </span>
                            {selectedNotice.audience && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                                    Audience: {selectedNotice.audience}
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={() => setSelectedNotice(null)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 leading-snug">{selectedNotice.title}</h3>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 font-medium">
                                <span className="flex items-center gap-1">
                                    <Clock size={13} />
                                    {new Date(selectedNotice.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    {selectedNotice.sync_status === 'pending' ? (
                                        <span className="text-amber-600 font-bold">● Local (Pending Sync)</span>
                                    ) : (
                                        <span className="text-emerald-600 font-bold">✓ Synced to Cloud</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                            {selectedNotice.content}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <button
                            onClick={() => handleDeleteNotice(selectedNotice.uuid)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                        >
                            <Trash2 size={14} />
                            <span>Remove Notice</span>
                        </button>
                        <button
                            onClick={() => setSelectedNotice(null)}
                            className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    /* ─────────────────────────────────────────────────────────────
       VARIANT 1: WIDGET (Compact sidebar card for Dashboard)
    ───────────────────────────────────────────────────────────── */
    if (variant === 'widget') {
        const displayed = notices.slice(0, 3);

        return (
            <div className={cn("liquid-glass-elevated rounded-[2.5rem] p-7 h-full flex flex-col justify-between relative overflow-hidden border border-white/80 shadow-xl backdrop-blur-2xl", className)}>
                {/* Top specular rim */}
                <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/80 shadow-sm">
                                <Megaphone className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-black text-gray-900 tracking-tight">Notice Board</h2>
                                    {notices.length > 0 && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#71167F]/10 text-[#71167F]">
                                            {notices.length}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Broadcasts</p>
                            </div>
                        </div>

                        {onNavigate && (
                            <button
                                onClick={() => onNavigate('hub', 'notice')}
                                title="Open full Notice Board in Campaign Hub"
                                className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-hff-primary hover:bg-purple-50 transition-all group"
                            >
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        )}
                    </div>

                    {/* Critical Alert Chip (if any) */}
                    {criticalAlert && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-amber-900 text-xs shadow-xs">
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[11px] uppercase tracking-wide truncate">{criticalAlert.title}</p>
                                <p className="text-[11px] text-amber-800/90 line-clamp-1">{criticalAlert.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Notices List or Clean Empty State */}
                    {notices.length === 0 ? (
                        <div className="py-7 px-3 text-center rounded-2xl bg-gray-50/70 border-2 border-dashed border-gray-200/80 flex flex-col items-center justify-center my-1">
                            <div className="p-2.5 rounded-2xl bg-[#71167F]/10 text-[#71167F] mb-2.5">
                                <Inbox size={22} />
                            </div>
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">No Announcements Yet</h4>
                            <p className="text-[11px] text-gray-500 mt-1 max-w-[210px] leading-relaxed">
                                Field updates and policy advisories will be published here.
                            </p>
                            <button
                                onClick={() => setIsCreateOpen(true)}
                                className="mt-3 px-3 py-1.5 rounded-lg bg-[#71167F] text-white text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-1 shadow-sm"
                            >
                                <Plus size={12} />
                                <span>Post First Notice</span>
                            </button>
                            <button
                                onClick={handleLoadSampleTemplates}
                                className="mt-2 text-[10px] font-bold text-gray-400 hover:text-[#71167F] transition-colors flex items-center gap-1"
                            >
                                <Layers size={11} />
                                <span>or load sample templates</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {displayed.map((notice) => {
                                const cfg = TYPE_CONFIG[notice.type] || TYPE_CONFIG.General;
                                return (
                                    <div
                                        key={notice.uuid || notice.id}
                                        onClick={() => setSelectedNotice(notice)}
                                        className="flex items-center justify-between p-3 rounded-2xl liquid-glass-pill border border-white/70 hover:border-[#71167F]/30 hover:shadow-md transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight shrink-0 border", cfg.bg)}>
                                                {notice.type || 'General'}
                                            </span>
                                            <span className="text-xs font-bold text-gray-700 group-hover:text-hff-primary transition-colors truncate">
                                                {notice.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-gray-400 shrink-0 whitespace-nowrap">
                                            {formatNoticeDate(notice.created_at)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex-1 py-2.5 px-3 border border-dashed border-gray-300 hover:border-[#71167F] rounded-xl text-xs font-bold text-gray-600 hover:text-[#71167F] hover:bg-purple-50/50 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Post Announcement</span>
                    </button>
                    {onNavigate && notices.length > 0 && (
                        <button
                            onClick={() => onNavigate('hub', 'notice')}
                            className="py-2.5 px-3 text-xs font-bold text-gray-500 hover:text-hff-primary transition-colors whitespace-nowrap"
                        >
                            View All
                        </button>
                    )}
                </div>

                {renderCreateModal()}
                {renderDetailModal()}
            </div>
        );
    }

    /* ─────────────────────────────────────────────────────────────
       VARIANT 2: FULL (Comprehensive Feed & Alerts for Campaign Hub)
    ───────────────────────────────────────────────────────────── */
    return (
        <div className={cn("space-y-10 animate-in fade-in duration-700 pb-20", className)}>
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-white/70 shadow-sm relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Megaphone className="text-[#71167F]" size={22} />
                        Campaign Broadcast Feed
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Live operational notices, policy circulars, and system advisories</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search notices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-full liquid-glass-input text-xs font-medium focus:border-[#71167F] outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="px-4 py-2.5 rounded-full hff-gradient-bg text-white text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-95 transition-opacity flex items-center gap-2 shrink-0 border border-white/30"
                    >
                        <Plus size={16} />
                        <span>Post Notice</span>
                    </button>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {['All', 'Event', 'Policy', 'Update', 'Alert', 'General'].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setFilterType(cat)}
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 border",
                            filterType === cat 
                                ? "liquid-glass-active shadow-sm font-extrabold" 
                                : "liquid-glass-pill text-gray-600 border-white/60 hover:text-[#71167F]"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Smart Alerts (Campaign Intelligence) */}
            <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                    <Shield className="text-amber-500" size={20} />
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Campaign Intelligence</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {alerts.map(a => (
                        <div key={a.id} className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group">
                            <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <AlertCircle size={15} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{a.title}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-800 leading-relaxed">{a.message}</p>
                            <div className="mt-3">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                    a.priority === 'critical' ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                                )}>
                                    Priority: {a.priority}
                                </span>
                            </div>
                        </div>
                    ))}

                    {alerts.length === 0 && (
                        <div className="col-span-full p-6 bg-[#3EB049]/5 border border-[#3EB049]/20 rounded-2xl flex items-center justify-center gap-3 text-[#3EB049]">
                            <Check className="stroke-[3px]" size={18} />
                            <span className="text-xs font-black uppercase tracking-widest">All campaign nodes & synchronization systems nominal</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Broadcast Feed Grid or Empty States */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Users className="text-[#71167F]" size={20} />
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                            Broadcast Stream ({filteredNotices.length})
                        </h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Case 1: Completely empty notice board */}
                    {notices.length === 0 ? (
                        <div className="col-span-full py-16 px-6 bg-white/80 backdrop-blur-sm border-2 border-dashed border-gray-200 rounded-3xl text-center flex flex-col items-center justify-center max-w-xl mx-auto shadow-sm">
                            <div className="p-4 rounded-3xl bg-[#71167F]/10 text-[#71167F] mb-4">
                                <Megaphone size={32} />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Broadcast Feed Is Empty</h3>
                            <p className="text-xs text-gray-500 mt-2 max-w-md leading-relaxed">
                                No operational announcements, field guidelines, or system advisories have been published yet. Post your first notice to broadcast it across the dashboard.
                            </p>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="px-5 py-2.5 rounded-xl hff-gradient-bg text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 transition-opacity flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    <span>Create First Announcement</span>
                                </button>
                                <button
                                    onClick={handleLoadSampleTemplates}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                                >
                                    <Layers size={14} />
                                    <span>Load Sample Templates</span>
                                </button>
                            </div>
                        </div>
                    ) : filteredNotices.length === 0 ? (
                        /* Case 2: Filter/Search matched 0 results */
                        <div className="col-span-full p-12 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl text-center space-y-3">
                            <div className="inline-flex p-3 rounded-2xl bg-gray-100 text-gray-400 mb-1">
                                <Search size={22} />
                            </div>
                            <h4 className="text-sm font-bold text-gray-700">No matching broadcasts found</h4>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                No announcements matched &ldquo;{searchQuery}&rdquo; in category &ldquo;{filterType}&rdquo;.
                            </p>
                            <button
                                onClick={() => { setSearchQuery(''); setFilterType('All'); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-bold text-gray-700 transition-colors"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        /* Case 3: Notice cards */
                        filteredNotices.map((b) => {
                            const cfg = TYPE_CONFIG[b.type] || TYPE_CONFIG.General;
                            const pri = PRIORITY_CONFIG[b.priority] || PRIORITY_CONFIG.normal;

                            return (
                                <div 
                                    key={b.uuid || b.id} 
                                    onClick={() => setSelectedNotice(b)}
                                    className="liquid-glass-elevated p-6 rounded-3xl border border-white/75 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                                >
                                    {/* Top specular rim */}
                                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight border", cfg.bg)}>
                                                {b.type || 'Notice'}
                                            </span>
                                            <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight", pri.badge)}>
                                                {pri.label}
                                            </span>
                                        </div>

                                        <h4 className="font-black text-gray-900 text-base leading-snug group-hover:text-hff-primary transition-colors mb-2">
                                            {b.title}
                                        </h4>
                                        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                                            {b.content}
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {formatNoticeDate(b.created_at)}
                                        </span>
                                        <span className="text-[#71167F] font-bold group-hover:underline">
                                            Read Details →
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            {renderCreateModal()}
            {renderDetailModal()}
        </div>
    );
};

export default NoticeBoard;
