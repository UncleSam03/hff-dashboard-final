import React, { useState, useEffect, useCallback } from 'react';
import { Users, CalendarCheck, ClipboardList, ArrowLeft, CloudUpload, RefreshCw, Check, AlertCircle, Layers } from 'lucide-react';
import PersonList from './hub/PersonList';
import AttendanceSheet from './hub/AttendanceSheet';
import NoticeBoard from './hub/NoticeBoard';
import MaintenanceTool from './MaintenanceTool';
import { pushPendingToSupabase, resetLocalFromSupabase } from '../lib/supabaseSync';
import { isConfigured } from '../lib/supabase';
import db from '../lib/dexieDb';
import './hub/Hub.css';

const Hub = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('people'); // 'people', 'attendance', 'notice'
    const [syncState, setSyncState] = useState('idle'); // 'idle' | 'syncing' | 'success' | 'error'
    const [pendingCount, setPendingCount] = useState(0);
    const [resetError, setResetError] = useState('');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [initialAttendanceContext, setInitialAttendanceContext] = useState(null);

    const handleRecordEdited = async (record) => {
        if (record.type === 'participant' && record.facilitator_uuid) {
            const fac = await db.registrations.where('uuid').equals(record.facilitator_uuid).first();
            if (fac) {
                setSelectedFacilitator(fac);
                setSelectedParticipant(null);
            }
        }
        setInitialAttendanceContext(record);
        setActiveTab('attendance');
    };

    // Fetch pending count from Dexie
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await db.registrations
                .where('sync_status')
                .equals('pending')
                .count();
            setPendingCount(count);
        } catch (err) {
            console.error('[Hub] Error counting pending records:', err);
        }
    }, []);

    useEffect(() => {
        refreshPendingCount();

        const handleSyncComplete = () => {
            refreshPendingCount();
        };

        window.addEventListener('hff-supabase-sync-complete', handleSyncComplete);
        window.addEventListener('hff-supabase-data-updated', handleSyncComplete);

        return () => {
            window.removeEventListener('hff-supabase-sync-complete', handleSyncComplete);
            window.removeEventListener('hff-supabase-data-updated', handleSyncComplete);
        };
    }, [refreshPendingCount]);

    const handleSync = async () => {
        if (syncState === 'syncing') return;

        setSyncState('syncing');
        try {
            await pushPendingToSupabase();
            await refreshPendingCount();
            const remaining = await db.registrations
                .where('sync_status')
                .equals('failed')
                .count();
            setSyncState(remaining > 0 ? 'error' : 'success');
        } catch (err) {
            console.error('[Hub] Sync failed:', err);
            setSyncState('error');
        }

        // Reset to idle after 3 seconds
        setTimeout(() => setSyncState('idle'), 3000);
    };

    const handleResetFromCloud = async () => {
        if (syncState === 'syncing') return;
        if (!window.confirm("This will overwrite this device's local data with what's currently in Supabase. Continue?")) return;

        setSyncState('syncing');
        setResetError('');
        try {
            await resetLocalFromSupabase();
            await refreshPendingCount();
            setSyncState('success');
            setResetError('');
        } catch (err) {
            console.error('[Hub] Reset from cloud failed:', err);
            setSyncState('error');
            setResetError(err instanceof Error ? err.message : String(err));
        }

        setTimeout(() => setSyncState('idle'), 3000);
    };

    const getSyncButtonContent = () => {
        switch (syncState) {
            case 'syncing':
                return (
                    <>
                        <RefreshCw className="h-4 w-4 sync-spin" />
                        <span>Syncing...</span>
                    </>
                );
            case 'success':
                return (
                    <>
                        <Check className="h-4 w-4" />
                        <span>Synced!</span>
                    </>
                );
            case 'error':
                return (
                    <>
                        <AlertCircle className="h-4 w-4" />
                        <span>Sync Failed</span>
                    </>
                );
            default:
                return (
                    <>
                        <CloudUpload className="h-4 w-4" />
                        <span>Sync to Cloud</span>
                        {pendingCount > 0 && (
                            <span className="sync-badge">{pendingCount}</span>
                        )}
                    </>
                );
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'people':
                return (
                    <PersonList 
                        onRecordEdited={handleRecordEdited}
                        selectedFacilitator={selectedFacilitator}
                        setSelectedFacilitator={setSelectedFacilitator}
                        selectedParticipant={selectedParticipant}
                        setSelectedParticipant={setSelectedParticipant}
                    />
                );
            case 'attendance':
                return (
                    <AttendanceSheet 
                        initialContext={initialAttendanceContext} 
                        onContextConsumed={() => setInitialAttendanceContext(null)} 
                        onBack={() => setActiveTab('people')}
                    />
                );
            case 'notice':
                return <NoticeBoard />;
            case 'maintenance':
                return <MaintenanceTool />;
            default:
                return <PersonList />;
        }
    };

    return (
        <div className="hub-container min-h-screen bg-gray-50/30">
            {/* Header / Sub-Nav */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 hff-gradient-bg rounded-2xl text-white shadow-lg shadow-[#71167F]/20">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-[#71167F] uppercase tracking-widest mb-1">Campaign Resource</p>
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Campaign Hub</h2>
                    </div>
                </div>

                {/* Sync Button */}
                {isConfigured && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSync}
                            disabled={syncState === 'syncing'}
                            className={`sync-button ${syncState}`}
                            title={pendingCount > 0 ? `${pendingCount} record(s) pending sync` : 'All records synced'}
                        >
                            {getSyncButtonContent()}
                        </button>
                        <button
                            onClick={handleResetFromCloud}
                            disabled={syncState === 'syncing'}
                            className="px-4 py-2.5 rounded-2xl bg-white border border-gray-100 text-gray-700 hover:shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
                            title="Overwrite local device cache from Supabase"
                        >
                            Refresh from Cloud
                        </button>
                    </div>
                )}

                {resetError && (
                    <div className="w-full mt-2 px-4 py-2 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold">
                        {resetError}
                    </div>
                )}

                {/* Navigation Tabs */}
                <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('people')}
                        className={`hub-nav-button flex items-center gap-2 ${activeTab === 'people' ? 'active' : ''}`}
                    >
                        <Users className="h-5 w-5" />
                        <span>People</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`hub-nav-button flex items-center gap-2 ${activeTab === 'attendance' ? 'active' : ''}`}
                    >
                        <CalendarCheck className="h-5 w-5" />
                        <span>Attendance</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('notice')}
                        className={`hub-nav-button flex items-center gap-2 ${activeTab === 'notice' ? 'active' : ''}`}
                    >
                        <ClipboardList className="h-5 w-5" />
                        <span>Notice Board</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`hub-nav-button flex items-center gap-2 ${activeTab === 'maintenance' ? 'active' : ''}`}
                    >
                        <Layers className="h-5 w-5" />
                        <span>Maintenance</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-transparent">
                {renderContent()}
            </div>
        </div>
    );
};

export default Hub;
