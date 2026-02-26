import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";

const AuthContext = createContext(null);

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

    try {
      // Try to get existing profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error && error.code === "PGRST116") {
        // No profile row — legacy user or trigger didn't fire
        // Insert a default admin profile (legacy users keep full access)
        const newProfile = {
          id: authUser.id,
          role: "admin",
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.username || "",
          phone: authUser.user_metadata?.phone || authUser.phone || "",
        };
        const { data: inserted, error: insertErr } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (insertErr) {
          console.error("Failed to create profile:", insertErr);
          setProfile({ role: "admin", full_name: "", phone: "" });
          return { role: "admin" };
        }
        setProfile(inserted);
        return inserted;
      }

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile({ role: "admin", full_name: "", phone: "" });
        return { role: "admin" };
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error("Profile fetch error:", err);
      setProfile({ role: "admin", full_name: "", phone: "" });
      return { role: "admin" };
    }
  }

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await fetchProfile(authUser);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true); // Show loading during transition if needed
      try {
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await fetchProfile(authUser);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth change error:", err);
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
