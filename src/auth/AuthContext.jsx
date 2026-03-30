import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "../lib/supabase";

const AuthContext = createContext(null);
console.log("[AuthContext] Script loaded - v1.0.3");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role, full_name, phone }
  const [loading, setLoading] = useState(true);

  // #region agent log
  function hffDebugLog(payload) {
      // Removed agent log
  }
  // #endregion agent log

  // Fetch or create the profile row for the given user
  async function fetchProfile(authUser) {
    console.log("[AuthContext] fetchProfile called for:", authUser?.id);
    if (!authUser || !isConfigured) {
      setProfile(null);
      return null;
    }

    const email = authUser.email?.toLowerCase() || "";
    const isAdminEmail = email.endsWith("@thehealthyfamilies.net");
    const t0 = Date.now();

    // #region agent log
    hffDebugLog({
      hypothesisId: 'B',
      location: 'src/auth/AuthContext.jsx:fetchProfile:entry',
      message: 'fetchProfile entry',
      data: { hasUser: !!authUser, userIdPrefix: String(authUser?.id || '').slice(0, 8), isConfigured: !!isConfigured, isAdminEmail }
    });
    // #endregion agent log

    // Set a timeout of 10 seconds for the profile fetch
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Profile fetch timed out")), 10000);
    });

    try {
      const fetchPromise = (async () => {
        // Try to get existing profile
        const { data: existingProfile, error: fetchErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        // #region agent log
        hffDebugLog({
          hypothesisId: 'B',
          location: 'src/auth/AuthContext.jsx:fetchProfile:profiles_select',
          message: 'profiles select result',
          data: {
            ms: Date.now() - t0,
            hasData: !!existingProfile,
            error: fetchErr ? { message: fetchErr.message, code: fetchErr.code, status: fetchErr.status, name: fetchErr.name } : null
          }
        });
        // #endregion agent log

        let currentProfile = existingProfile;

        if (fetchErr && (fetchErr.code === "PGRST116" || fetchErr.status === 406)) {
          // No profile row (PGRST116 or 406) — legacy user or trigger didn't fire
          const role = isAdminEmail ? "admin" : (authUser.user_metadata?.role || "facilitator");

          const newProfile = {
            id: authUser.id,
            role: role,
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.username || "",
            phone: authUser.user_metadata?.phone || authUser.phone || "",
            must_change_password: false,
          };

          const { data: inserted, error: insertErr } = await supabase
            .from("profiles")
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();

          // #region agent log
          hffDebugLog({
            hypothesisId: 'B',
            location: 'src/auth/AuthContext.jsx:fetchProfile:profiles_upsert',
            message: 'profiles upsert result',
            data: {
              ms: Date.now() - t0,
              inserted: !!inserted,
              error: insertErr ? { message: insertErr.message, code: insertErr.code, status: insertErr.status, name: insertErr.name } : null
            }
          });
          // #endregion agent log

          if (insertErr) {
            console.error("[AuthContext] Failed to create profile:", insertErr);
            const fallback = { id: authUser.id, role, full_name: newProfile.full_name, phone: newProfile.phone };
            setProfile(fallback);
            return fallback;
          }
          currentProfile = inserted;
        } else if (fetchErr) {
          console.error("[AuthContext] Error fetching profile:", fetchErr);
          const fallback = { id: authUser.id, role: isAdminEmail ? "admin" : "facilitator", full_name: "", phone: "" };
          setProfile(fallback);
          return fallback;
        }

        // STRICT DOMAIN ENFORCEMENT
        // Any account with @thehealthyfamilies.net is ALWAYS an admin.
        // Any other account is ALWAYS a facilitator.
        const expectedRole = isAdminEmail ? "admin" : "facilitator";

        if (currentProfile.role !== expectedRole) {
          console.log(`[AuthContext] Correcting user role to ${expectedRole} based on email domain`);
          currentProfile = { ...currentProfile, role: expectedRole };

          // Sync to database
          supabase.from("profiles").update({ role: expectedRole }).eq("id", authUser.id).then(({ error }) => {
            if (error) console.error("[AuthContext] Failed to sync role update:", error);
          });
        }

        setProfile(currentProfile);
        return currentProfile;
      })();

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.error("[AuthContext] Profile fetch error:", err);
      // #region agent log
      hffDebugLog({
        hypothesisId: 'C',
        location: 'src/auth/AuthContext.jsx:fetchProfile:catch',
        message: 'fetchProfile threw/caught',
        data: { ms: Date.now() - t0, error: err ? { message: err.message, name: err.name } : null }
      });
      // #endregion agent log
      const fallback = { id: authUser.id, role: isAdminEmail ? "admin" : "facilitator", full_name: "", phone: "" };
      setProfile(fallback);
      return fallback;
    }
  }

  // Allows components to trigger a profile re-fetch (e.g. after onboarding)
  async function refreshProfile() {
    if (user) {
      console.log("[AuthContext] refreshProfile triggered for user:", user.id);
      await fetchProfile(user);
      console.log("[AuthContext] refreshProfile complete");
    } else {
      console.warn("[AuthContext] refreshProfile called but no user is logged in");
    }
  }

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    console.log("[AuthContext] Getting initial session...");
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const authUser = session?.user ?? null;
        console.log("[AuthContext] Session found:", authUser ? authUser.email : "none");
        setUser(authUser);
        if (authUser) {
          console.log("[AuthContext] Fetching profile for:", authUser.id);
          const p = await fetchProfile(authUser);
          console.log("[AuthContext] Profile result:", p ? p.role : "none");
        }
      } catch (err) {
        console.error("[AuthContext] Auth initialization error:", err);
      } finally {
        console.log("[AuthContext] Loading set to false");
        setLoading(false);
      }
    });

    // Listen for auth changes
    // Only show loading for meaningful auth events, not routine token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthContext] Auth state change:", event);

      // Skip loading state for routine token refreshes — these should be invisible
      const isSignificantEvent = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event);
      if (isSignificantEvent) setLoading(true);

      try {
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await fetchProfile(authUser);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("[AuthContext] Auth change error:", err);
      } finally {
        if (isSignificantEvent) setLoading(false);
      }
    });

    // Listen for profile-refresh events from other components
    const handleProfileRefresh = () => refreshProfile();
    window.addEventListener('hff-profile-refresh', handleProfileRefresh);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hff-profile-refresh', handleProfileRefresh);
    };
  }, []);

  async function signOut() {
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  }

  const role = profile?.role || null;

  const value = useMemo(
    () => ({ user, profile, role, loading, signOut, refreshProfile }),
    [user, profile, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
