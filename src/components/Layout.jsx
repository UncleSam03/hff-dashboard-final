import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from "../auth/AuthContext";
import Sidebar from './Sidebar';
import { Bell, Search, Menu, X, User, Shield, Users, RefreshCw, Layers, MapPin, Megaphone, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { reconcileWithCloud } from '../lib/syncManager';
import { isConfigured } from '../lib/firebase';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../lib/dexieDb';

const ROLE_BADGES = {
  admin: { label: "Admin", icon: Shield, bg: "bg-amber-50", text: "text-amber-700" },
  facilitator: { label: "Facilitator", icon: Users, bg: "bg-emerald-50", text: "text-emerald-700" },
};

const LAST_SEEN_NOTICES_KEY = 'hff_last_seen_notices_at';

const Layout = ({ children, activeTab, onTabChange, activeCampaign, onSwitchCampaign }) => {
  const { profile, role, signOut, isMasterAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    try {
      return localStorage.getItem(LAST_SEEN_NOTICES_KEY) || '';
    } catch {
      return '';
    }
  });
  const bellRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notificationData = useLiveQuery(async () => {
    const notices = (await db.notices.orderBy('created_at').reverse().toArray()) || [];
    const activeNotices = notices.filter(n => !n.is_deleted);

    const allRegs = await db.registrations.toArray();
    const campId = activeCampaign?.uuid;
    const campRegs = allRegs.filter(r => !r.is_deleted && (!campId || !r.campaign_id || r.campaign_id === campId));

    const facilitators = campRegs.filter(r => r.type === 'facilitator');
    const participants = campRegs.filter(r => r.type === 'participant');
    const pendingSyncCount = campRegs.filter(r => r.sync_status === 'pending').length;

    const alerts = [];
    if (pendingSyncCount > 0) {
      alerts.push({
        id: 'pending-sync',
        title: `${pendingSyncCount} Record${pendingSyncCount === 1 ? '' : 's'} Pending Cloud Sync`,
        message: 'Local changes are queued and will sync automatically.',
        priority: pendingSyncCount > 15 ? 'high' : 'normal',
        actionTab: 'hub',
        actionSubTab: 'people'
      });
    }

    const emptyFacs = facilitators.filter(f => !participants.some(p => p.facilitator_uuid === f.uuid || (f.form_number && p.group_form_number === f.form_number)));
    if (emptyFacs.length > 0) {
      alerts.push({
        id: 'empty-facilitators',
        title: `${emptyFacs.length} Facilitator${emptyFacs.length === 1 ? '' : 's'} Without Participants`,
        message: `${emptyFacs.slice(0, 2).map(f => `${f.first_name || ''} ${f.last_name || ''}`.trim()).join(', ')}${emptyFacs.length > 2 ? ` +${emptyFacs.length - 2} more` : ''} have 0 linked participants.`,
        priority: 'high',
        actionTab: 'hub',
        actionSubTab: 'paper_entry'
      });
    }

    return { notices: activeNotices, alerts };
  }, [activeCampaign?.uuid]) || { notices: [], alerts: [] };

  const unreadNoticesCount = notificationData.notices.filter(n => !lastSeenAt || (n.created_at && n.created_at > lastSeenAt)).length;
  const totalBadgeCount = unreadNoticesCount + notificationData.alerts.length;

  const handleToggleBell = () => {
    const next = !isBellOpen;
    setIsBellOpen(next);
    if (next) {
      const now = new Date().toISOString();
      setLastSeenAt(now);
      try {
        localStorage.setItem(LAST_SEEN_NOTICES_KEY, now);
      } catch {}
    }
  };

  const handleOpenNoticeBoard = () => {
    setIsBellOpen(false);
    onTabChange('hub', 'notice');
  };

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
      <div className="hidden lg:block w-24 ui-transition">
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSignOut={signOut}
          userProfile={profile}
          userRole={role}
          isCollapsed={true}
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
                    {isMasterAdmin && onSwitchCampaign ? (
                      <button
                        onClick={onSwitchCampaign}
                        className="text-[11px] font-bold text-gray-500 hover:text-[#71167F] px-2 py-0.5 rounded-md hover:bg-white/60 transition-colors"
                        title="Switch Campaign (Master Admin)"
                      >
                        Switch
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 px-1">
                        (Active)
                      </span>
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
            {/* Quick Switch Campaign Button - Master Admin only */}
            {isMasterAdmin && onSwitchCampaign && (
              <button
                onClick={onSwitchCampaign}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full liquid-glass-pill text-gray-700 hover:text-[#71167F] hover:border-[#71167F]/30 transition-all active:scale-95 group shadow-xs"
                title="Switch or start another campaign (Master Admin)"
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

            {/* Notifications Bell & Dropdown */}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={handleToggleBell}
                className={cn(
                  "relative p-2.5 liquid-glass-pill transition-all group",
                  isBellOpen
                    ? "text-[#71167F] border-[#71167F]/40 bg-white shadow-md"
                    : "text-gray-600 hover:text-[#71167F] hover:border-[#71167F]/30"
                )}
                title="Notifications & Campaign Notices"
              >
                <Bell size={18} />
                {totalBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                    {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
                  </span>
                )}
              </button>

              {isBellOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/80 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-[#71167F]" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                        Notifications & Notices
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBellOpen(false)}
                      className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                    {/* System Alerts */}
                    {notificationData.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          setIsBellOpen(false);
                          onTabChange(alert.actionTab, alert.actionSubTab);
                        }}
                        className="p-4 hover:bg-amber-50/50 cursor-pointer transition-colors flex items-start gap-3"
                      >
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                          <AlertTriangle size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-gray-900">{alert.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{alert.message}</p>
                        </div>
                      </div>
                    ))}

                    {/* Campaign Notices */}
                    {notificationData.notices.slice(0, 5).map((notice) => (
                      <div
                        key={notice.uuid || notice.id}
                        onClick={handleOpenNoticeBoard}
                        className="p-4 hover:bg-purple-50/40 cursor-pointer transition-colors flex items-start gap-3"
                      >
                        <div className="p-2 rounded-xl bg-[#71167F]/10 text-[#71167F] shrink-0 mt-0.5">
                          <Megaphone size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-gray-900 truncate">{notice.title}</p>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                              {notice.type || 'Notice'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                            {notice.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {notificationData.alerts.length === 0 && notificationData.notices.length === 0 && (
                      <div className="py-10 px-6 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
                          <CheckCircle2 size={20} />
                        </div>
                        <p className="text-xs font-black text-gray-900">All Caught Up</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          No pending alerts or new campaign announcements.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-gray-100 bg-gray-50/80">
                    <button
                      type="button"
                      onClick={handleOpenNoticeBoard}
                      className="w-full py-2.5 px-4 rounded-2xl bg-[#71167F] text-white hover:bg-[#5a1166] text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <span>Open Notice Board</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

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
