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
      const email = authUser.email?.toLowerCase() || "";
      const isAdminEmail = email.endsWith("@thehealthyfamilies.net");

      // Try to get existing profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error && error.code === "PGRST116") {
        // No profile row — legacy user or trigger didn't fire
        // If admin email, force admin. Otherwise default to participant for new accounts.
        const role = isAdminEmail ? "admin" : "participant";
        
        const newProfile = {
          id: authUser.id,
          role: role,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.username || "",
          phone: authUser.user_metadata?.phone || authUser.phone || "",
          must_change_password: false, // Default for manual signups
        };
        const { data: inserted, error: insertErr } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (insertErr) {
          console.error("Failed to create profile:", insertErr);
          setProfile({ role: role, full_name: "", phone: "" });
          return { role: role };
        }
        setProfile(inserted);
        return inserted;
      }

      if (error) {
        console.error("Error fetching profile:", error);
        const fallbackRole = isAdminEmail ? "admin" : "participant";
        setProfile({ role: fallbackRole, full_name: "", phone: "" });
        return { role: fallbackRole };
      }

      // If they have an @thehealthyfamilies.net email but aren't admin in DB, fix it locally
      if (isAdminEmail && data.role !== "admin") {
        const updatedProfile = { ...data, role: "admin" };
        setProfile(updatedProfile);
        
        // Proactively update DB
        await supabase.from("profiles").update({ role: "admin" }).eq("id", authUser.id);
        
        return updatedProfile;
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error("Profile fetch error:", err);
      const fallbackRole = (authUser.email?.toLowerCase().endsWith("@thehealthyfamilies.net")) ? "admin" : "participant";
      setProfile({ role: fallbackRole, full_name: "", phone: "" });
      return { role: fallbackRole };
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
