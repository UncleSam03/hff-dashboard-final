import React, { useState, useEffect, useCallback } from 'react';
import { Users, CalendarCheck, ClipboardList, ArrowLeft, CloudUpload, RefreshCw, Check, AlertCircle } from 'lucide-react';
import PersonList from './hub/PersonList';
import AttendanceSheet from './hub/AttendanceSheet';
import NoticeBoard from './hub/NoticeBoard';
import { pushPendingToSupabase } from '../lib/supabaseSync';
import { isConfigured } from '../lib/supabase';
import db from '../lib/dexieDb';
import './hub/Hub.css';

const Hub = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('people'); // 'people', 'attendance', 'notice'
    const [syncState, setSyncState] = useState('idle'); // 'idle' | 'syncing' | 'success' | 'error'
    const [pendingCount, setPendingCount] = useState(0);

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
                return <PersonList />;
            case 'attendance':
                return <AttendanceSheet />;
            case 'notice':
                return <NoticeBoard />;
            default:
                return <PersonList />;
        }
    };

    return (
        <div className="hub-container min-h-screen bg-gray-50/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-500 hover:text-hff-primary mb-2 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Campaign Hub</h1>
                    <p className="text-gray-500">Manage participants, attendance, and team status.</p>
                </div>

                {/* Sync Button */}
                {isConfigured && (
                    <button
                        onClick={handleSync}
                        disabled={syncState === 'syncing'}
                        className={`sync-button ${syncState}`}
                        title={pendingCount > 0 ? `${pendingCount} record(s) pending sync` : 'All records synced'}
                    >
                        {getSyncButtonContent()}
                    </button>
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
