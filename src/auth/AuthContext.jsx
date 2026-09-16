import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, isConfigured } from "../lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const AuthContext = createContext(null);
console.log("[AuthContext] Script loaded - Firebase Migration");

export const DEV_BYPASS_PASSWORDS = true;

const DEV_MOCK_USERS = {
  admin: {
    user: {
      uid: "dev-admin-id",
      email: "admin@thehealthyfamilies.net",
    },
    profile: {
      id: "dev-admin-id",
      role: "admin",
      full_name: "HFF Administrator",
      phone: "+267 71234567",
      onboarding_completed: true
    }
  },
  facilitator: {
    user: {
      uid: "dev-facilitator-id",
      email: "facilitator@thehealthyfamilies.net",
    },
    profile: {
      id: "dev-facilitator-id",
      role: "facilitator",
      full_name: "Lead Facilitator",
      phone: "+267 72345678",
      onboarding_completed: true
    }
  }
};

function getInitialBypassRole() {
  if (typeof window === "undefined") return "admin";
  const stored = localStorage.getItem("hff_bypass_role");
  return stored !== null ? stored : "admin";
}

export function AuthProvider({ children }) {
  const initialRole = getInitialBypassRole();
  const initialMock = initialRole !== "none" ? DEV_MOCK_USERS[initialRole] || DEV_MOCK_USERS.admin : null;

  const [user, setUser] = useState(initialMock ? initialMock.user : null);
  const [profile, setProfile] = useState(initialMock ? initialMock.profile : null);
  const [loading, setLoading] = useState(false);

  // Switch role dynamically without password
  const switchDevRole = (newRole) => {
    if (newRole === "none") {
      localStorage.setItem("hff_bypass_role", "none");
      setUser(null);
      setProfile(null);
    } else {
      const mock = DEV_MOCK_USERS[newRole] || DEV_MOCK_USERS.admin;
      localStorage.setItem("hff_bypass_role", newRole);
      setUser(mock.user);
      setProfile(mock.profile);
    }
  };

  // Fetch or create the profile row for the given user
  async function fetchProfile(authUser) {
    console.log("[AuthContext] fetchProfile called for:", authUser?.uid);
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
        const profileRef = doc(db, "profiles", authUser.uid);
        const profileSnap = await getDoc(profileRef);

        let currentProfile;

        if (!profileSnap.exists()) {
          // No profile row — legacy user or just signed up
          const role = isAdminEmail ? "admin" : "facilitator";

          const newProfile = {
            id: authUser.uid,
            role: role,
            full_name: authUser.displayName || "",
            phone: authUser.phoneNumber || "",
            must_change_password: false,
          };

          try {
            await setDoc(profileRef, newProfile);
            currentProfile = newProfile;
          } catch (insertErr) {
            console.error("[AuthContext] Failed to create profile:", insertErr);
            const fallback = { id: authUser.uid, role, full_name: newProfile.full_name, phone: newProfile.phone };
            setProfile(fallback);
            return fallback;
          }
        } else {
          currentProfile = { id: profileSnap.id, ...profileSnap.data() };
        }

        // STRICT DOMAIN ENFORCEMENT
        const expectedRole = isAdminEmail ? "admin" : "facilitator";

        if (currentProfile.role !== expectedRole) {
          console.log(`[AuthContext] Correcting user role to ${expectedRole} based on email domain`);
          currentProfile = { ...currentProfile, role: expectedRole };

          // Sync to database
          try {
            await updateDoc(profileRef, { role: expectedRole });
          } catch (error) {
            console.error("[AuthContext] Failed to sync role update:", error);
          }
        }

        setProfile(currentProfile);
        return currentProfile;
      })();

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.error("[AuthContext] Profile fetch error:", err);
      const fallback = { id: authUser.uid, role: isAdminEmail ? "admin" : "facilitator", full_name: "", phone: "" };
      setProfile(fallback);
      return fallback;
    }
  }

  // Allows components to trigger a profile re-fetch (e.g. after onboarding)
  async function refreshProfile() {
    if (user) {
      console.log("[AuthContext] refreshProfile triggered for user:", user.uid);
      await fetchProfile(user);
      console.log("[AuthContext] refreshProfile complete");
    } else {
      console.warn("[AuthContext] refreshProfile called but no user is logged in");
    }
  }

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Listen for auth changes
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log("[AuthContext] Auth state change:", authUser ? authUser.email : "none");
      
      try {
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

    // Listen for profile-refresh events from other components
    const handleProfileRefresh = () => refreshProfile();
    window.addEventListener('hff-profile-refresh', handleProfileRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('hff-profile-refresh', handleProfileRefresh);
    };
  }, []);

  async function signOut() {
    if (isConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.warn("[AuthContext] signOut failed:", e);
      }
    }
    localStorage.setItem("hff_bypass_role", "none");
    setUser(null);
    setProfile(null);
  }

  const role = profile?.role || null;

  const value = useMemo(
    () => ({ user, profile, role, loading, signOut, refreshProfile, switchDevRole, isDevBypass: DEV_BYPASS_PASSWORDS }),
    [user, profile, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
