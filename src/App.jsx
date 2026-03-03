import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import AuthGate from "@/auth/AuthGate";
import { useAuth } from "@/auth/AuthContext";

import OfflineCollect from './components/OfflineCollect';
import Hub from './components/Hub';
import DeepAnalysis from './components/DeepAnalysis';
import FacilitatorDashboard from './components/FacilitatorDashboard';

function AppContent() {
  const { role, signOut } = useAuth();
  const [mode, setMode] = useState('overview'); // 'overview', 'collect', 'hub', 'analysis'

  const handleSelectMode = (newMode) => {
    setMode(newMode);
  };

  const handleBackToHome = () => {
    setMode('overview');
  };

  // Facilitator role — dedicated dashboard
  if (role === 'facilitator') {
    return (
      <FacilitatorDashboard onBack={signOut} />
    );
  }

  // Admin role — full dashboard access using Sidebar
  return (
    <Layout activeTab={mode} onTabChange={handleSelectMode}>
      {mode === 'overview' ? (
        <Dashboard mode="general" />
      ) : mode === 'collect' ? (
        <OfflineCollect onBack={handleBackToHome} />
      ) : mode === 'hub' ? (
        <Hub onBack={handleBackToHome} />
      ) : mode === 'analysis' ? (
        <DeepAnalysis analytics={{}} />
      ) : (
        <Dashboard mode="general" />
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
