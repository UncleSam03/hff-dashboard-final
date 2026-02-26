import React from "react";
import AuthPage from "@/auth/AuthPage";
import { useAuth } from "@/auth/AuthContext";

export default function AuthGate({ children }) {
  const { user, loading, role } = useAuth();
  const [showReset, setShowReset] = React.useState(false);

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

  if (!user || !role) return <AuthPage />;

  return children;
}
