import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import AuthGate from "./auth/AuthGate";
import { useAuth } from "./auth/AuthContext";

import OfflineCollect from './components/OfflineCollect';
import Hub from './components/Hub';
import UnderConstruction from './components/UnderConstruction';
import FacilitatorDashboard from './components/FacilitatorDashboard';
import FacilitatorOnboarding from './components/FacilitatorOnboarding';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/dexieDb';
import { processAnalytics } from './lib/analytics';
import { pullFromSupabase } from './lib/supabaseSync';

function AppContent() {
  const { role, profile, signOut, loading } = useAuth();
  const [mode, setMode] = useState('overview'); // 'overview', 'collect', 'hub', 'analysis'
  const [initialSyncing, setInitialSyncing] = useState(false);

  const registrations = useLiveQuery(() => db.registrations.toArray()) || [];
  const analytics = processAnalytics(registrations);

  // For admin users: pull cloud data into Dexie on first mount
  // so the dashboard isn't empty on a new session / cleared browser
  useEffect(() => {
    if (role === 'admin' && navigator.onLine) {
      setInitialSyncing(true);
      pullFromSupabase()
        .catch(err => console.warn('[App] Initial Supabase pull failed:', err))
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
        // Re-fetch the profile to pick up onboarding_completed = true
        // without doing a full page reload
        window.dispatchEvent(new Event('hff-profile-refresh'));
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
        <UnderConstruction onBack={handleBackToHome} />
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
