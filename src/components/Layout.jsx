import React, { useState } from 'react';
import { useAuth } from "@/auth/AuthContext";
import Sidebar from './Sidebar';
import { Bell, Search, Menu, X, User, Shield, Users } from 'lucide-react';
import { cn } from "@/lib/utils";

const ROLE_BADGES = {
  admin: { label: "Admin", icon: Shield, bg: "bg-amber-50", text: "text-amber-700" },
  facilitator: { label: "Facilitator", icon: Users, bg: "bg-emerald-50", text: "text-emerald-700" },
};

const Layout = ({ children, activeTab, onTabChange }) => {
  const { user, profile, role, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const badge = ROLE_BADGES[role] || ROLE_BADGES.facilitator;

  return (
    <div className="min-h-screen flex bg-[#FDFBFF]">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} onSignOut={signOut} userProfile={profile} userRole={role} />
      </div>

      {/* Sidebar - Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
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
      <main className="flex-1 lg:ml-64 min-w-0 flex flex-col relative">
        {/* TopBar */}
        <header className="sticky top-0 z-30 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-50 rounded-xl"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest leading-none">
                {activeTab === 'overview' ? 'Dashboard Overview' : 
                 activeTab === 'collect' ? 'Offline Collect' :
                 activeTab === 'hub' ? 'Campaign Hub' : 'Data Analysis'}
              </h2>
              <p className="text-[10px] font-bold text-[#71167F] uppercase tracking-widest mt-1">
                Real-Time Campaign Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Search Bar */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-[#71167F]/10 transition-all">
              <Search size={16} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                className="bg-transparent border-none focus:outline-none text-[11px] font-bold text-gray-600 placeholder:text-gray-300 w-40"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2.5 bg-gray-50 text-gray-500 rounded-2xl hover:bg-[#71167F]/5 hover:text-[#71167F] transition-all border border-gray-100 group">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white ring-2 ring-red-500/10" />
            </button>
            
            <div className="h-10 w-[1px] bg-gray-100 mx-1 hidden sm:block" />
            
            {/* Live Indicator */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-green-50 text-green-700 rounded-2xl border border-green-100 shadow-sm shadow-green-500/5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[11px] font-black uppercase tracking-widest">Live Sync: Phikwe</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 lg:p-10 space-y-8 scrollbar-hide">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
