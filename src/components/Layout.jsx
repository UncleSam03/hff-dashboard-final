import React, { useState } from 'react';
import { useAuth } from "../auth/AuthContext";
import Sidebar from './Sidebar';
import { Bell, Search, Menu, X, User, Shield, Users, RefreshCw, Layers, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { reconcileWithCloud } from '../lib/syncManager';
import { isConfigured } from '../lib/firebase';

const ROLE_BADGES = {
  admin: { label: "Admin", icon: Shield, bg: "bg-amber-50", text: "text-amber-700" },
  facilitator: { label: "Facilitator", icon: Users, bg: "bg-emerald-50", text: "text-emerald-700" },
};

const Layout = ({ children, activeTab, onTabChange, activeCampaign, onSwitchCampaign }) => {
  const { profile, role, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const handleRefresh = async () => {
    if (isReconciling) return;
    setIsReconciling(true);
    try {
      await reconcileWithCloud();
    } catch (err) {
      console.error("[Layout] Manual refresh failed:", err);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-transparent">
      {/* Sidebar - Desktop */}
      <div className={cn(
        "hidden lg:block ui-transition",
        isCollapsed ? "w-24" : "w-72"
      )}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSignOut={signOut}
          userProfile={profile}
          userRole={role}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Sidebar - Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 liquid-glass-sidebar shadow-2xl animate-in slide-in-from-left duration-300">
            <Sidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                onTabChange(tab);
                setIsMobileMenuOpen(false);
              }}
              onSignOut={signOut}
              userProfile={profile}
              userRole={role}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col relative ui-transition">
        {/* TopBar - Apple Liquid Glass */}
        <header className="sticky top-0 z-30 h-24 liquid-glass-header flex items-center justify-between px-8 lg:px-12">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-600 hover:bg-white/60 rounded-2xl liquid-glass-pill"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
                  {activeTab === 'overview' ? 'Dashboard Overview' :
                    activeTab === 'hub' ? 'Campaign Hub' : 
                      activeTab === 'sat' ? 'SAT Analysis' : 'Data Analysis'}
                </h2>
                {activeCampaign && (
                  <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#71167F]/10 text-[#71167F] border border-[#71167F]/20 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#71167F] animate-pulse" />
                      <span className="max-w-[140px] truncate">{activeCampaign.name}</span>
                    </span>
                    {onSwitchCampaign && (
                      <button
                        onClick={onSwitchCampaign}
                        className="text-[11px] font-bold text-gray-500 hover:text-[#71167F] px-2 py-0.5 rounded-md hover:bg-white/60 transition-colors"
                        title="Switch Campaign"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] font-semibold text-[#71167F] tracking-wider mt-1 opacity-90">
                Real-Time Campaign Performance (SYNCED)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Quick Switch Campaign Button */}
            {onSwitchCampaign && (
              <button
                onClick={onSwitchCampaign}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full liquid-glass-pill text-gray-700 hover:text-[#71167F] hover:border-[#71167F]/30 transition-all active:scale-95 group shadow-xs"
                title="Switch or start another campaign"
              >
                <Layers size={14} className="text-[#71167F] group-hover:rotate-12 transition-transform" />
                <span className="hidden md:inline text-[11px] font-bold tracking-wide">
                  Campaigns
                </span>
              </button>
            )}

            {/* Search Bar */}
            <div className="hidden md:flex items-center gap-2.5 liquid-glass-input px-4 py-2 rounded-full focus-within:ring-2 focus-within:ring-[#71167F]/20 transition-all">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search metrics..."
                className="bg-transparent border-none focus:outline-none text-[12px] font-medium text-gray-700 placeholder:text-gray-400 w-40"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2.5 liquid-glass-pill text-gray-600 hover:text-[#71167F] hover:border-[#71167F]/30 transition-all group">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm" />
            </button>

            <div className="h-8 w-[1px] bg-white/60 mx-0.5 hidden sm:block" />

            {/* Sync Control */}
            {isConfigured && (
              <button 
                onClick={handleRefresh}
                disabled={isReconciling}
                className={cn(
                  "hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full transition-all active:scale-95 group liquid-glass-pill",
                  isReconciling 
                    ? "bg-[#71167F]/10 border-[#71167F]/30 text-[#71167F]" 
                    : "text-gray-600 hover:text-[#71167F] hover:border-[#71167F]/30"
                )}
                title="Force deep sync with cloud (handles deletions)"
              >
                <RefreshCw size={13} className={cn("transition-transform", isReconciling && "animate-spin")} />
                <span className="text-[11px] font-semibold tracking-wide">
                  {isReconciling ? 'Reconciling...' : 'Refresh Hub'}
                </span>
              </button>
            )}

            {/* Live Indicator */}
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full liquid-glass-pill bg-emerald-500/10 text-emerald-700 border-emerald-400/30 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
              <span className="text-[11px] font-semibold tracking-wide">Live Sync: Phikwe</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 lg:p-12 space-y-12 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
