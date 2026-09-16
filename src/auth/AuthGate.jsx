import React, { useState } from "react";
import AuthPage from "./AuthPage";
import { useAuth } from "./AuthContext";
import { Shield, Users, ChevronDown, ChevronUp, LockOpen } from "lucide-react";

export default function AuthGate({ children }) {
  const { user, loading, role, switchDevRole, isDevBypass } = useAuth();
  const [showReset, setShowReset] = useState(false);
  const [isSwitcherCollapsed, setIsSwitcherCollapsed] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowReset(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleReset = () => {
    if (confirm("This will clear your local app cache and restart. Continue?")) {
      // Unregister Service Workers
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
      // Clear all site data (Storage API)
      localStorage.clear();
      sessionStorage.clear();
      // Force reload from server
      window.location.reload(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 font-sans text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
          <div className="text-center">
            <p className="text-white/70 text-sm font-medium">Loading HFF Campaigns (v1.0.3)…</p>
            {showReset && (
              <button 
                onClick={handleReset}
                className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-semibold transition-all animate-in fade-in slide-in-from-top-2"
              >
                Trouble loading? Reset Site
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Floating Dev Switcher
  const devSwitcher = isDevBypass && (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-auto select-none">
      {isSwitcherCollapsed ? (
        <button
          onClick={() => setIsSwitcherCollapsed(false)}
          className="liquid-glass-pill px-3 py-2 text-xs font-bold text-hff-primary flex items-center gap-1.5 shadow-xl hover:scale-105 transition-transform"
          title="Open Role / Password Bypass Switcher"
        >
          <LockOpen className="w-3.5 h-3.5 text-emerald-600" />
          <span>Dev Passwords Off</span>
          <ChevronUp className="w-3.5 h-3.5 opacity-60" />
        </button>
      ) : (
        <div className="liquid-glass-elevated rounded-2xl p-2.5 shadow-2xl border border-white/60 flex items-center gap-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1.5 pl-2 pr-1 text-xs font-bold text-gray-800">
            <LockOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">No Passwords:</span>
          </div>

          <button
            onClick={() => switchDevRole("admin")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              role === "admin"
                ? "liquid-glass-active text-white shadow-md"
                : "bg-white/40 hover:bg-white/70 text-gray-700"
            }`}
          >
            <Shield className="w-3 h-3" />
            Admin
          </button>

          <button
            onClick={() => switchDevRole("facilitator")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              role === "facilitator"
                ? "liquid-glass-active text-white shadow-md"
                : "bg-white/40 hover:bg-white/70 text-gray-700"
            }`}
          >
            <Users className="w-3 h-3" />
            Facilitator
          </button>

          <button
            onClick={() => switchDevRole("none")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              !user ? "liquid-glass-active text-white" : "bg-white/40 hover:bg-white/70 text-gray-600"
            }`}
            title="View Login Page"
          >
            Login Page
          </button>

          <button
            onClick={() => setIsSwitcherCollapsed(true)}
            className="p-1 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700 ml-1"
            title="Minimize"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  if (!user || !role) {
    return (
      <>
        <AuthPage />
        {devSwitcher}
      </>
    );
  }

  return (
    <>
      {children}
      {devSwitcher}
    </>
  );
}
