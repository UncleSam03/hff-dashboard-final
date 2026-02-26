import React from "react";
import AuthPage from "@/auth/AuthPage";
import { useAuth } from "@/auth/AuthContext";

export default function AuthGate({ children }) {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 font-sans text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
          <p className="text-white/70 text-sm font-medium">Loading HFF Campaigns (v1.0.2)…</p>
        </div>
      </div>
    );
  }

  if (!user || !role) return <AuthPage />;

  return children;
}
