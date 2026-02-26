'use client';

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import Home from '@/components/Home';
import AuthGate from "@/auth/AuthGate";
import { useAuth } from "@/auth/AuthContext";

import OfflineCollect from '@/components/OfflineCollect';
import Hub from '@/components/Hub';
import FacilitatorDashboard from '@/components/FacilitatorDashboard';
import ParticipantDashboard from '@/components/ParticipantDashboard';
import NotesView from '@/components/NotesView';

import { startAutoSync } from '@/lib/syncManager';
import { initSupabaseSync } from '@/lib/supabaseSync';

function AppContent() {
    const { role, signOut } = useAuth();
    const [mode, setMode] = useState('home');

    useEffect(() => {
        // Start background sync engines on client mount
        if (typeof window !== 'undefined') {
            startAutoSync();
            initSupabaseSync();
        }
    }, []);

    const handleSelectMode = (newMode) => {
        setMode(newMode);
    };

    const handleBackToHome = () => {
        setMode('home');
    };

    // Facilitator role — dedicated dashboard
    if (role === 'facilitator') {
        return (
            <Layout onBackToHome={signOut} isHome={true} showNav={false}>
                <FacilitatorDashboard onBack={signOut} />
            </Layout>
        );
    }

    // Participant role — dedicated dashboard
    if (role === 'participant') {
        return (
            <Layout onBackToHome={signOut} isHome={true} showNav={false}>
                <ParticipantDashboard onBack={signOut} />
            </Layout>
        );
    }

    // Admin role — full dashboard access
    return (
        <Layout onBackToHome={handleBackToHome} isHome={mode === 'home'}>
            {mode === 'home' ? (
                <Home onSelectMode={handleSelectMode} />
            ) : mode === 'collect' ? (
                <OfflineCollect onBack={handleBackToHome} />
            ) : mode === 'hub' ? (
                <Hub onBack={handleBackToHome} />
            ) : mode === 'notes' ? (
                <NotesView onBack={handleBackToHome} />
            ) : (
                <Dashboard mode={mode} onBack={handleBackToHome} />
            )}
        </Layout>
    );
}

export default function Page() {
    return (
        <AuthGate>
            <AppContent />
        </AuthGate>
    );
}
