import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import AuthGate from "./auth/AuthGate";
import { useAuth } from "./auth/AuthContext";

import OfflineCollect from './components/OfflineCollect';
import Hub from './components/Hub';
import AnalysisHub from './components/AnalysisHub';
import FacilitatorDashboard from './components/FacilitatorDashboard';
import FacilitatorOnboarding from './components/FacilitatorOnboarding';
import SatDashboard from './components/SatDashboard';
import UnderConstruction from './components/UnderConstruction';
import { useLiveQuery } from 'dexie-react-hooks';
import db from './lib/dexieDb';
import { processAnalytics } from './lib/analytics';
import { reconcileWithCloud } from './lib/syncManager';

function AppContent() {
  const { role, profile, signOut, loading } = useAuth();
  const [mode, setMode] = useState('overview'); // 'overview', 'collect', 'hub', 'analysis'
  const [initialSyncing, setInitialSyncing] = useState(false);

  console.log("[AppContent] Status:", { role, onboarding_completed: profile?.onboarding_completed, loading });

  const registrations = useLiveQuery(() => db.registrations.toArray()) || [];
  const analytics = useMemo(() => processAnalytics(registrations), [registrations]);

  console.log("[App] Analytics Update:", { 
    regCount: registrations.length, 
    totalRegistered: analytics.totalRegistered,
    mode 
  });

  // For admin users: pull cloud data into Dexie on first mount
  // so the dashboard isn't empty on a new session / cleared browser
  useEffect(() => {
    if (role === 'admin' && navigator.onLine) {
      setInitialSyncing(true);
      reconcileWithCloud()
        .catch(err => console.warn('[App] Initial Supabase reconciliation failed:', err))
        .finally(() => setInitialSyncing(false));
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCF9] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-hff-primary border-t-transparent"></div>
      </div>
    );
  }

  const handleSelectMode = (newMode) => {
    setMode(newMode);
  };

  const handleBackToHome = () => {
    setMode('overview');
  };

  // Facilitator role — dedicated dashboard
  if (role === 'facilitator') {
    if (!profile?.onboarding_completed) {
      return <FacilitatorOnboarding onComplete={() => {
        // Mark onboarding as just completed to trigger a custom redirect message on sign-in page
        localStorage.setItem('hff_onboarding_just_completed', 'true');
        // Sign out to force the user back to the login screen
        signOut();
      }} />;
    }
    return (
      <FacilitatorDashboard onBack={signOut} />
    );
  }

  // Admin role — full dashboard access using Sidebar
  return (
    <Layout activeTab={mode} onTabChange={handleSelectMode}>
      {mode === 'overview' ? (
        <Dashboard analytics={analytics} />
      ) : mode === 'collect' ? (
        <OfflineCollect onBack={handleBackToHome} />
      ) : mode === 'hub' ? (
        <Hub onBack={handleBackToHome} />
      ) : mode === 'analysis' ? (
        <AnalysisHub analytics={analytics} onBack={handleBackToHome} />
      ) : mode === 'sat' ? (
        <SatDashboard onBack={handleBackToHome} />
      ) : (
        <Dashboard analytics={analytics} />
      )}
    </Layout>
  );
}

function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

export default App;
