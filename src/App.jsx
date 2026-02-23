import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import AuthGate from "@/auth/AuthGate";
import { useAuth } from "@/auth/AuthContext";

import OfflineCollect from './components/OfflineCollect';
import Hub from './components/Hub';
import FacilitatorDashboard from './components/FacilitatorDashboard';
import ParticipantDashboard from './components/ParticipantDashboard';

function AppContent() {
  const { role, signOut } = useAuth();
  const [mode, setMode] = useState('home'); // 'home', 'phikwe', 'general', 'collect', 'hub'

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

  // Admin role — full dashboard access (existing behavior)
  return (
    <Layout onBackToHome={handleBackToHome} isHome={mode === 'home'}>
      {mode === 'home' ? (
        <Home onSelectMode={handleSelectMode} />
      ) : mode === 'collect' ? (
        <OfflineCollect onBack={handleBackToHome} />
      ) : mode === 'hub' ? (
        <Hub onBack={handleBackToHome} />
      ) : (
        <Dashboard mode={mode} onBack={handleBackToHome} />
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
