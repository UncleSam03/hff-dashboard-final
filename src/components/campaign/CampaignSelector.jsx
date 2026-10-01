import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../lib/dexieDb';
import { 
    getAllCampaigns, 
    createCampaign, 
    deleteCampaign, 
    importFileToCampaign, 
    DEFAULT_CAMPAIGN,
    setCurrentCampaign
} from '../../lib/campaignManager';
import { useDropzone } from 'react-dropzone';
import { 
    Plus, Upload, FileSpreadsheet, Check, X, 
    ArrowRight, MapPin, Users, Calendar, 
    Trash2, AlertCircle, Loader2, Sparkles, Database,
    FileText, Shield, LogOut, Lock, Crown, Archive
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';

export default function CampaignSelector({ onSelectCampaign }) {
    const { user, profile, role, signOut, isMasterAdmin, masterAdminEmail } = useAuth();
    const rawCampaigns = useLiveQuery(() => getAllCampaigns());
    const rawRegistrations = useLiveQuery(() => db.registrations.toArray());

    const campaigns = rawCampaigns || [];
    const registrations = rawRegistrations || [];

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [initMode, setInitMode] = useState('blank'); // 'blank' | 'csv'
    const [formData, setFormData] = useState({
        name: '',
        village: '',
        targetAttendees: 500
    });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModal, setDeleteModal] = useState({ open: false, campaign: null });

    // Identify the Current Campaign and Past Campaigns
    const currentCampaign = React.useMemo(() => {
        return campaigns.find(c => c.is_current === true || c.is_current === 1) ||
               campaigns.find(c => c.status === 'active') ||
               campaigns.find(c => c.uuid === DEFAULT_CAMPAIGN.uuid) ||
               campaigns[0] || DEFAULT_CAMPAIGN;
    }, [campaigns]);

    const pastCampaigns = React.useMemo(() => {
        return campaigns.filter(c => c.uuid !== currentCampaign?.uuid);
    }, [campaigns, currentCampaign]);

    const handleSetCurrent = async (campaignUuid) => {
        if (!isMasterAdmin) return;
        try {
            await setCurrentCampaign(campaignUuid);
        } catch (err) {
            console.error('Failed to set current campaign:', err);
        }
    };

    // Calculate stats per campaign
    const campaignStats = React.useMemo(() => {
        const stats = {};
        for (const c of campaigns) {
            const cRegs = registrations.filter(r => r.campaign_id === c.uuid && !r.is_deleted);
            const participants = cRegs.filter(r => (r.type || '').toLowerCase() !== 'facilitator').length;
            const facilitators = cRegs.filter(r => (r.type || '').toLowerCase() === 'facilitator').length;
            stats[c.uuid] = {
                total: cRegs.length,
                participants,
                facilitators
            };
        }
        return stats;
    }, [campaigns, registrations]);

    // Dropzone setup
    const onDrop = (acceptedFiles) => {
        setError('');
        if (acceptedFiles && acceptedFiles[0]) {
            setUploadedFile(acceptedFiles[0]);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1
    });

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Please enter a campaign name.');
            return;
        }

        if (initMode === 'csv' && !uploadedFile) {
            setError('Please choose a CSV or Excel file to upload.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // 1. Create campaign in Dexie
            const newCampaign = await createCampaign({
                name: formData.name,
                village: formData.village || 'National',
                targetAttendees: formData.targetAttendees
            });

            // 2. If CSV mode, import the records into this campaign
            if (initMode === 'csv' && uploadedFile) {
                await importFileToCampaign(uploadedFile, newCampaign.uuid);
            }

            setIsSubmitting(false);
            setIsCreateOpen(false);
            setUploadedFile(null);
            setFormData({ name: '', village: '', targetAttendees: 500 });

            // 3. Launch dashboard for this campaign
            onSelectCampaign(newCampaign);
        } catch (err) {
            console.error('Failed to create campaign:', err);
            setError(err.message || 'Failed to initialize campaign.');
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (campaign) => {
        try {
            await deleteCampaign(campaign.uuid);
            setDeleteModal({ open: false, campaign: null });
        } catch (err) {
            alert(err.message || 'Failed to delete campaign.');
        }
    };

    const handleSelect = (campaign) => {
        if (!isMasterAdmin && campaign.uuid !== currentCampaign?.uuid) {
            alert(`Access Restricted: Only the Master Admin (${masterAdminEmail}) can access past campaigns.`);
            return;
        }
        onSelectCampaign(campaign);
    };

    return (
        <div className="min-h-screen font-sans selection:bg-[#71167F]/10 text-gray-900 flex flex-col relative overflow-x-hidden">
            {/* Ambient liquid fluid canvas */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-[#71167F]/15 to-transparent rounded-full blur-[130px] animate-float" />
                <div className="absolute top-1/3 -right-40 w-[550px] h-[550px] bg-gradient-to-bl from-[#3EB049]/15 to-transparent rounded-full blur-[120px] animate-float" style={{ animationDelay: '3s' }} />
                <div className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] bg-gradient-to-tr from-[#71167F]/10 via-[#3EB049]/8 to-transparent rounded-full blur-[140px] animate-float" style={{ animationDelay: '6s' }} />
            </div>

            {/* Floating Apple Liquid Glass Top Navigation Bar */}
            <header className="sticky top-0 z-30 px-6 sm:px-12 py-4">
                <div className="max-w-7xl mx-auto liquid-glass-header rounded-full px-6 sm:px-8 py-3.5 border border-white/80 shadow-lg flex items-center justify-between relative overflow-hidden backdrop-blur-2xl">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                    
                    <div className="flex items-center gap-3">
                        <img 
                            src="/hff-logo.png" 
                            alt="HFF Logo" 
                            className="w-9 h-9 object-contain drop-shadow-sm" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div>
                            <h1 className="text-base font-black text-gray-900 tracking-tight leading-none">
                                HFF <span className="text-[#71167F]">Impact</span>
                            </h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                                Campaign Workspaces
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isMasterAdmin ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-black">
                                <Crown className="w-3.5 h-3.5 text-amber-600" />
                                <span>Master Admin</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-pill text-xs font-bold text-gray-700">
                                <Shield className="w-3.5 h-3.5 text-[#71167F]" />
                                <span>Admin (Admitted)</span>
                            </div>
                        )}
                        {signOut && (
                            <button
                                onClick={signOut}
                                className="p-2 rounded-full liquid-glass-pill text-gray-500 hover:text-red-600 transition-colors"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Window Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-12 py-8 space-y-12">
                {/* Hero Header */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-pill text-xs font-black uppercase tracking-wider text-[#71167F] mb-4">
                        <Database className="w-3.5 h-3.5 text-[#71167F]" />
                        Campaign Governance
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-3">
                        Campaign Workspaces
                    </h2>
                </div>

                {/* 1. CURRENT ACTIVE CAMPAIGN SECTION */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-700">
                                Current Active Campaign
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 border border-emerald-400/40">
                                Open to All Admins
                            </span>
                        </div>
                        {isMasterAdmin && (
                            <span className="text-xs text-gray-500 font-semibold">
                                Master Admin can switch or archive this campaign
                            </span>
                        )}
                    </div>

                    {currentCampaign ? (
                        (() => {
                            const stats = campaignStats[currentCampaign.uuid] || { total: 0, participants: 0, facilitators: 0 };
                            return (
                                <div className="liquid-glass-elevated rounded-[2.5rem] p-8 sm:p-10 border-2 border-emerald-500/40 shadow-2xl shadow-emerald-500/10 relative overflow-hidden backdrop-blur-2xl">
                                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />
                                    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
                                    <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-[#71167F]/10 rounded-full blur-3xl pointer-events-none" />

                                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                        <div className="space-y-3 max-w-xl">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                                                    <Sparkles size={13} />
                                                    Current Campaign
                                                </span>
                                                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/80 border border-gray-200 text-gray-600">
                                                    Target: {currentCampaign.targetAttendees || 500} Attendees
                                                </span>
                                            </div>

                                            <h4 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                                {currentCampaign.name}
                                            </h4>

                                            <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed">
                                                {currentCampaign.description || 'Active community and family strengthening program workspace.'}
                                            </p>

                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-500 pt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin size={15} className="text-[#71167F]" />
                                                    <span>{currentCampaign.village || 'Botswana'}</span>
                                                </div>
                                                <span className="text-gray-300">•</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={15} className="text-[#3EB049]" />
                                                    <span>{currentCampaign.year || '2026'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-4 shrink-0 lg:w-72">
                                            {/* Quick Metrics */}
                                            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl liquid-glass border border-white/80 shadow-xs">
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total</span>
                                                    <span className="text-lg font-black text-gray-900 tabular-nums">{stats.total}</span>
                                                </div>
                                                <div className="text-center border-x border-white/60">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Attendees</span>
                                                    <span className="text-lg font-black text-[#71167F] tabular-nums">{stats.participants}</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facilitators</span>
                                                    <span className="text-lg font-black text-[#3EB049] tabular-nums">{stats.facilitators}</span>
                                                </div>
                                            </div>

                                            {/* Launch Button */}
                                            <button
                                                onClick={() => handleSelect(currentCampaign)}
                                                className="w-full py-4 px-6 rounded-2xl liquid-glass-active text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-[#71167F]/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-white/40"
                                            >
                                                <span>Launch Current Campaign</span>
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="p-8 text-center rounded-3xl bg-gray-50 border border-gray-200 text-gray-500 text-sm">
                            No active campaign found.
                        </div>
                    )}
                </section>

                {/* 2. PAST & HISTORICAL CAMPAIGNS SECTION */}
                <section className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
                        <div className="flex items-center gap-2">
                            <Archive className="w-4 h-4 text-gray-500" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-700">
                                Past & Archived Campaigns
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-200 text-gray-700">
                                {pastCampaigns.length}
                            </span>
                        </div>
                        <div className="text-xs font-bold text-gray-500">
                            {isMasterAdmin ? (
                                <span className="text-amber-700 flex items-center gap-1.5">
                                    <Crown size={14} className="text-amber-600" />
                                    Master Admin has full access to historical records
                                </span>
                            ) : (
                                <span className="text-gray-400 flex items-center gap-1.5">
                                    <Lock size={13} />
                                    Restricted to Master Admin ({masterAdminEmail})
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {/* ONLY MASTER ADMIN SEES THE "START NEW CAMPAIGN" CARD */}
                        {isMasterAdmin && (
                            <div
                                onClick={() => setIsCreateOpen(true)}
                                className="liquid-glass-elevated rounded-[2.5rem] p-8 border-2 border-dashed border-[#71167F]/30 hover:border-[#71167F] shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer flex flex-col items-center justify-center text-center group min-h-[300px] relative overflow-hidden backdrop-blur-2xl"
                            >
                                <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                                <div className="absolute -top-20 -right-20 w-44 h-44 bg-[#71167F]/10 rounded-full blur-3xl group-hover:bg-[#71167F]/20 transition-all pointer-events-none" />

                                <div className="w-16 h-16 rounded-3xl bg-[#71167F] text-white shadow-xl shadow-[#71167F]/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500 border border-white/40">
                                    <Plus size={32} className="stroke-[2.5]" />
                                </div>

                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2 group-hover:text-[#71167F] transition-colors">
                                    Start New Campaign
                                </h3>
                                <p className="text-xs text-gray-500 font-medium max-w-[240px] leading-relaxed mb-6">
                                    Create a fresh workspace. Upload a CSV register or open a blank dashboard with empty states.
                                </p>

                                <span className="px-5 py-2.5 rounded-full liquid-glass-pill text-xs font-black uppercase tracking-wider text-[#71167F] group-hover:liquid-glass-active group-hover:text-white transition-all shadow-sm">
                                    Create Workspace
                                </span>
                            </div>
                        )}

                        {/* PAST CAMPAIGNS LIST */}
                        {pastCampaigns.map((campaign) => {
                            const stats = campaignStats[campaign.uuid] || { total: 0, participants: 0, facilitators: 0 };
                            const isDefault = campaign.uuid === DEFAULT_CAMPAIGN.uuid;

                            if (isMasterAdmin) {
                                // Master Admin can inspect past campaigns and promote to current
                                return (
                                    <div
                                        key={campaign.uuid}
                                        className="liquid-glass-elevated rounded-[2.5rem] p-7 sm:p-8 border border-white/80 shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col justify-between group relative overflow-hidden backdrop-blur-2xl"
                                    >
                                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />
                                        
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-500/10 text-gray-700 border border-gray-400/30">
                                                    <Archive size={11} className="text-gray-500" />
                                                    Past Campaign
                                                </span>

                                                {!isDefault && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteModal({ open: true, campaign });
                                                        }}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete Campaign"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>

                                            <h4 className="text-xl font-black text-gray-900 tracking-tight mb-2 group-hover:text-[#71167F] transition-colors line-clamp-1">
                                                {campaign.name}
                                            </h4>
                                            
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-6">
                                                <MapPin size={14} className="text-[#71167F] shrink-0" />
                                                <span>{campaign.village || 'Botswana'}</span>
                                                <span className="text-gray-300">•</span>
                                                <Calendar size={14} className="text-gray-400 shrink-0" />
                                                <span>{campaign.year || '2026'}</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl liquid-glass border border-white/70 shadow-xs mb-6">
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total</span>
                                                    <span className="text-lg font-black text-gray-900 tabular-nums">{stats.total}</span>
                                                </div>
                                                <div className="text-center border-x border-white/60">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Attendees</span>
                                                    <span className="text-lg font-black text-[#71167F] tabular-nums">{stats.participants}</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facilitators</span>
                                                    <span className="text-lg font-black text-[#3EB049] tabular-nums">{stats.facilitators}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleSelect(campaign)}
                                                className="w-full py-3 rounded-2xl liquid-glass-active text-white text-xs font-black uppercase tracking-widest shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-white/40"
                                            >
                                                <span>Launch Historical View</span>
                                                <ArrowRight size={14} />
                                            </button>

                                            <button
                                                onClick={() => handleSetCurrent(campaign.uuid)}
                                                className="w-full py-2.5 rounded-2xl bg-white/80 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-xs font-bold border border-gray-200 hover:border-emerald-300 transition-all flex items-center justify-center gap-1.5"
                                                title="Make this the active campaign for standard admins"
                                            >
                                                <Sparkles size={13} className="text-emerald-600" />
                                                <span>Set as Current Active</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Admin view: Past campaigns are locked!
                            return (
                                <div
                                    key={campaign.uuid}
                                    className="rounded-[2.5rem] p-7 sm:p-8 bg-gray-50/70 border border-gray-200/90 shadow-sm flex flex-col justify-between relative overflow-hidden opacity-85 select-none"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-200/80 text-gray-600 border border-gray-300/60">
                                                <Lock size={11} className="text-gray-500" />
                                                Locked Archive
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {campaign.year || 'Past'}
                                            </span>
                                        </div>

                                        <h4 className="text-xl font-bold text-gray-700 tracking-tight mb-2 line-clamp-1">
                                            {campaign.name}
                                        </h4>
                                        
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-6">
                                            <MapPin size={14} className="text-gray-400 shrink-0" />
                                            <span>{campaign.village || 'Botswana'}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-white/50 border border-gray-200/60 shadow-none mb-6">
                                            <div className="text-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total</span>
                                                <span className="text-base font-black text-gray-400 tabular-nums">{stats.total}</span>
                                            </div>
                                            <div className="text-center border-x border-gray-200">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Attendees</span>
                                                <span className="text-base font-black text-gray-400 tabular-nums">{stats.participants}</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facilitators</span>
                                                <span className="text-base font-black text-gray-400 tabular-nums">{stats.facilitators}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <button
                                            disabled
                                            className="w-full py-3 rounded-2xl bg-gray-200/80 border border-gray-300/60 text-gray-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
                                        >
                                            <Lock size={13} className="text-gray-400" />
                                            <span>Master Admin Access Only</span>
                                        </button>
                                        <p className="text-[10px] text-gray-400 text-center font-medium mt-2">
                                            Historical campaign preserved for audit
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* NEW CAMPAIGN CREATION MODAL */}
            {isCreateOpen && isMasterAdmin && (
                <div 
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300 overflow-y-auto"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsCreateOpen(false);
                    }}
                >
                    <div className="w-full max-w-xl liquid-glass-elevated rounded-[2.5rem] border border-white/80 shadow-2xl overflow-hidden relative backdrop-blur-2xl animate-in zoom-in-95 duration-300 my-8">
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-white/60 bg-white/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#71167F] text-white flex items-center justify-center shadow-md shadow-[#71167F]/25">
                                    <Plus size={20} className="stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none">
                                        Start New Campaign
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">
                                        Campaign Initialization Setup
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="p-2 rounded-2xl text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleCreateCampaign} className="p-8 space-y-6">
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Campaign Details */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                        Campaign Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Molepolole Outreach 2026"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Village / District
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Molepolole, Maun"
                                            value={formData.village}
                                            onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                            Target Attendees
                                        </label>
                                        <input
                                            type="number"
                                            min="10"
                                            max="50000"
                                            value={formData.targetAttendees}
                                            onChange={(e) => setFormData({ ...formData, targetAttendees: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 rounded-2xl border border-gray-200 liquid-glass-input text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Initialization Method Selector */}
                            <div className="pt-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2.5">
                                    Choose How to Initialize Your Workspace:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setInitMode('blank')}
                                        className={cn(
                                            "p-4 rounded-2xl border text-left transition-all relative overflow-hidden",
                                            initMode === 'blank'
                                                ? "bg-[#71167F]/10 border-[#71167F] shadow-md ring-2 ring-[#71167F]/20"
                                                : "liquid-glass border-white/80 hover:bg-white/60"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-white/80 border border-gray-200 flex items-center justify-center text-[#71167F] mb-2 shadow-xs">
                                            <Database size={16} />
                                        </div>
                                        <h4 className="text-xs font-black text-gray-900 uppercase">Blank Dashboard</h4>
                                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                            Start with 0 records. All metrics and charts will display clean empty states.
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setInitMode('csv')}
                                        className={cn(
                                            "p-4 rounded-2xl border text-left transition-all relative overflow-hidden",
                                            initMode === 'csv'
                                                ? "bg-[#71167F]/10 border-[#71167F] shadow-md ring-2 ring-[#71167F]/20"
                                                : "liquid-glass border-white/80 hover:bg-white/60"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-white/80 border border-gray-200 flex items-center justify-center text-[#3EB049] mb-2 shadow-xs">
                                            <Upload size={16} />
                                        </div>
                                        <h4 className="text-xs font-black text-gray-900 uppercase">Upload CSV / Excel</h4>
                                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                            Import existing attendance register or participant CSV file immediately.
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* CSV Dropzone (when CSV mode active) */}
                            {initMode === 'csv' && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <div
                                        {...getRootProps()}
                                        className={cn(
                                            "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative backdrop-blur-xl",
                                            isDragActive ? "border-[#71167F] bg-[#71167F]/10" : "border-gray-300 hover:border-[#71167F] bg-white/40",
                                            uploadedFile && "border-emerald-500 bg-emerald-50/50"
                                        )}
                                    >
                                        <input {...getInputProps()} />
                                        
                                        {uploadedFile ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                                                    <Check size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-gray-900">{uploadedFile.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-medium">
                                                        {(uploadedFile.size / 1024).toFixed(1)} KB • Click to change file
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-10 h-10 rounded-2xl liquid-glass-pill border border-white/80 text-[#71167F] flex items-center justify-center mb-2 shadow-xs">
                                                    <FileSpreadsheet size={20} />
                                                </div>
                                                <p className="text-xs font-black text-gray-800">
                                                    {isDragActive ? 'Drop your register file here' : 'Click or drag CSV / Excel file'}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    Supports .csv, .xlsx, .xls formats
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Form Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/60">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 text-xs font-black uppercase tracking-widest hover:bg-white/80 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-2xl liquid-glass-active text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-[#71167F]/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            <span>{initMode === 'csv' ? 'Create & Import Data' : 'Open Blank Dashboard'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.open && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-md liquid-glass-elevated rounded-3xl p-6 border border-white/80 shadow-2xl backdrop-blur-2xl text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto">
                            <Trash2 size={22} />
                        </div>
                        <h3 className="text-lg font-black text-gray-900">Delete Campaign?</h3>
                        <p className="text-xs text-gray-500 font-medium">
                            Are you sure you want to delete <strong className="text-gray-900">"{deleteModal.campaign?.name}"</strong>? All associated registrations and attendance records will be removed.
                        </p>
                        <div className="flex justify-center gap-3 pt-2">
                            <button
                                onClick={() => setDeleteModal({ open: false, campaign: null })}
                                className="px-5 py-2.5 rounded-2xl border border-gray-200 text-xs font-black uppercase tracking-wider text-gray-600 hover:bg-white/60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteModal.campaign)}
                                className="px-5 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
                            >
                                Delete Campaign
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
