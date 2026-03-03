import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "../lib/supabase";

const AuthContext = createContext(null);
console.log("[AuthContext] Script loaded - v1.0.3");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role, full_name, phone }
  const [loading, setLoading] = useState(true);

  // Fetch or create the profile row for the given user
  async function fetchProfile(authUser) {
    if (!authUser || !isConfigured) {
      setProfile(null);
      return null;
    }

    const email = authUser.email?.toLowerCase() || "";
    const isAdminEmail = email.endsWith("@thehealthyfamilies.net");

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
          .single();

        let currentProfile = existingProfile;

        if (fetchErr && fetchErr.code === "PGRST116") {
          // No profile row — legacy user or trigger didn't fire
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
            .insert(newProfile)
            .select()
            .single();

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

        if (isAdminEmail && currentProfile.role !== "admin") {
          console.log("[AuthContext] Upgrading user to admin based on email domain");
          currentProfile = { ...currentProfile, role: "admin" };

          // Background sync to DB
          supabase.from("profiles").update({ role: "admin" }).eq("id", authUser.id).then(({ error }) => {
            if (error) console.error("[AuthContext] Failed to sync admin role upgrade:", error);
          });
        } else if (!isAdminEmail && currentProfile.role === "admin") {
          console.warn("[AuthContext] Restricted domain: Downgrading admin to facilitator");
          currentProfile = { ...currentProfile, role: "facilitator" };

          // Background sync to DB
          supabase.from("profiles").update({ role: "facilitator" }).eq("id", authUser.id).then(({ error }) => {
            if (error) console.error("[AuthContext] Failed to sync admin role downgrade:", error);
          });
        }

        setProfile(currentProfile);
        return currentProfile;
      })();

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.error("[AuthContext] Profile fetch error:", err);
      const fallback = { id: authUser.id, role: isAdminEmail ? "admin" : "facilitator", full_name: "", phone: "" };
      setProfile(fallback);
      return fallback;
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthContext] Auth state change:", event);
      setLoading(true);
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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
    () => ({ user, profile, role, loading, signOut }),
    [user, profile, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
