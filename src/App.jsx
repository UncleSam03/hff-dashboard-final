import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AuthGate from "./auth/AuthGate";
import { useAuth } from "./auth/AuthContext";

import Hub from './components/Hub';
import AnalysisHub from './components/AnalysisHub';
import FacilitatorDashboard from './components/FacilitatorDashboard';
import FacilitatorOnboarding from './components/FacilitatorOnboarding';
import SatDashboard from './components/SatDashboard';
import UnderConstruction from './components/UnderConstruction';
import CampaignSelector from './components/campaign/CampaignSelector';
import { useLiveQuery } from 'dexie-react-hooks';
import db from './lib/dexieDb';
import { processAnalytics } from './lib/analytics';
import { reconcileWithCloud } from './lib/syncManager';
import { DEFAULT_CAMPAIGN, getActiveCampaignId, setActiveCampaignId, getAllCampaigns } from './lib/campaignManager';

function AppContent() {
  const { role, profile, signOut, loading } = useAuth();
  const [mode, setMode] = useState('overview'); // 'overview', 'hub', 'analysis', 'sat'
  const [hubInitialTab, setHubInitialTab] = useState('people');
  const [_initialSyncing, setInitialSyncing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);

  console.log("[AppContent] Status:", { role, onboarding_completed: profile?.onboarding_completed, loading });

  const rawRegistrations = useLiveQuery(() => db.registrations.toArray());
  const allRegistrations = useMemo(() => rawRegistrations || [], [rawRegistrations]);

  // Filter registrations by currently active campaign
  const registrations = useMemo(() => {
    if (!activeCampaign) return [];
    return allRegistrations.filter(r => {
      if (r.is_deleted) return false;
      if (r.campaign_id) return r.campaign_id === activeCampaign.uuid;
      // If record has no campaign_id, associate with default campaign
      return activeCampaign.uuid === DEFAULT_CAMPAIGN.uuid;
    });
  }, [allRegistrations, activeCampaign]);

  const analytics = useMemo(() => processAnalytics(registrations), [registrations]);

  console.log("[App] Analytics Update:", { 
    campaign: activeCampaign?.name,
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
        .catch(err => console.warn('[App] Initial Firebase reconciliation failed:', err))
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

  const handleSelectMode = (newMode, subTab) => {
    setMode(newMode);
    if (subTab) {
      setHubInitialTab(subTab);
    } else if (newMode === 'hub') {
      setHubInitialTab('people');
    }
  };

  const handleBackToHome = () => {
    setMode('overview');
  };

  const handleSelectCampaign = (campaign) => {
    setActiveCampaign(campaign);
    setActiveCampaignId(campaign?.uuid || null);
  };

  const handleSwitchCampaign = () => {
    setActiveCampaign(null);
    setActiveCampaignId(null);
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

  // Admin role — if no campaign is selected, present the Campaign Selector window
  if (!activeCampaign) {
    return (
      <CampaignSelector 
        onSelectCampaign={handleSelectCampaign}
      />
    );
  }

  // Admin role — full dashboard access for selected campaign
  return (
    <Layout 
      activeTab={mode} 
      onTabChange={handleSelectMode}
      activeCampaign={activeCampaign}
      onSwitchCampaign={handleSwitchCampaign}
    >
      {mode === 'overview' ? (
        <Dashboard analytics={analytics} onNavigate={handleSelectMode} />
      ) : mode === 'hub' ? (
        <Hub onBack={handleBackToHome} initialTab={hubInitialTab} />
      ) : mode === 'analysis' ? (
        <AnalysisHub analytics={analytics} onBack={handleBackToHome} />
      ) : mode === 'sat' ? (
        <SatDashboard analytics={analytics} onBack={handleBackToHome} />
      ) : (
        <Dashboard analytics={analytics} onNavigate={handleSelectMode} />
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

