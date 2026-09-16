import React, { useState, useEffect } from "react";
import { auth, db, isConfigured } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider, 
  updatePassword,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { doc, getDocs, collection, query, where, limit, updateDoc } from "firebase/firestore";
import {
  AlertCircle, Key, Info, Shield, Users, User,
  Mail, Phone, Lock, Eye, EyeOff, ArrowRight,
  Check, ChevronLeft, LockOpen
} from "lucide-react";
import LandingPage from "../components/LandingPage";
import { useAuth } from "./AuthContext";

/* ───────── helpers ───────── */
function friendlyAuthError(err) {
  const m = err?.message || "";
  if (m.includes("auth/invalid-credential")) return "Incorrect email or password.";
  if (m.includes("auth/email-already-in-use")) return "That email is already in use. Try signing in.";
  if (m.includes("auth/invalid-phone-number")) return "Invalid phone number.";
  return m || "Something went wrong. Please try again.";
}

const ROLES = [
  {
    id: "facilitator",
    label: "Facilitator",
    desc: "Register participants, mark daily attendance, and track your group.",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-400",
    ring: "ring-emerald-400/40",
  },
];

/* ───────── Not-configured fallback ───────── */
function ConfigRequired({ onBypass }) {
  return (
    <div className="min-h-screen bg-transparent font-sans text-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl liquid-glass-elevated rounded-[2.5rem] shadow-2xl p-6 sm:p-10 border border-white/60">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-12 w-12 bg-hff-soft-purple rounded-2xl flex items-center justify-center text-hff-primary shadow-sm">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuration Notice</h1>
            <p className="text-gray-500">Firebase cloud connection is optional in dev mode.</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="liquid-glass rounded-2xl p-5 border border-white/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-hff-primary mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-semibold mb-1">Development Access Available</p>
                <p>Passwords are disabled for development review. You can enter directly as Admin or Facilitator below.</p>
              </div>
            </div>
          </div>

          {onBypass && (
            <div className="pt-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Entry (No Password Required):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onBypass("admin")}
                  className="w-full py-3.5 px-4 rounded-2xl liquid-glass-active text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Shield className="w-4 h-4" />
                  Enter Directly as Admin
                </button>
                <button
                  type="button"
                  onClick={() => onBypass("facilitator")}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white/70 hover:bg-white text-gray-800 font-bold text-sm shadow-sm border border-gray-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Users className="w-4 h-4" />
                  Enter as Facilitator
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Main AuthPage ───────── */
export default function AuthPage() {
  const [screen, setScreen] = useState("landing"); // landing | auth
  const [authMode, setAuthMode] = useState("signin"); // signin | signup | change-password
  const [authMethod, setAuthMethod] = useState("email"); // email | phone
  const selectedRole = "facilitator";

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const { switchDevRole, isDevBypass } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Handle post-onboarding redirect
  useEffect(() => {
    const onboardingDone = localStorage.getItem('hff_onboarding_just_completed');
    if (onboardingDone) {
      setScreen("auth");
      setAuthMode("signin");
      setMessage("Registration complete! You can now sign in with your account.");
      localStorage.removeItem('hff_onboarding_just_completed');
    }
  }, []);

  if (!isConfigured) return <ConfigRequired onBypass={switchDevRole} />;

  /* ── handlers ── */

  function goToAuth(mode) {
    setAuthMode(mode);
    setScreen("auth");
    setError("");
    setMessage("");
  }

  function goToLanding() {
    setScreen("landing");
    setError("");
    setMessage("");
    setOtpSent(false);
    setOtpToken("");
    setConfirmPassword("");
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      setSubmitting(false);
      return;
    }

    if (authMode === "signup" && !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      setSubmitting(false);
      return;
    }

    if (authMode === "signup" && trimmedPassword !== trimmedConfirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      if (authMode === "signin") {
        let loginEmail = trimmedEmail;
        const isEmail = trimmedEmail.includes("@");

        // If not an email, lookup in profiles by full_name
        if (!isEmail) {
          const profilesRef = collection(db, "profiles");
          const q = query(profilesRef, where("full_name", "==", trimmedEmail), limit(5));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            throw new Error("Could not find a user with that name. Please check and try again.");
          }

          if (querySnapshot.size > 1) {
            throw new Error("Multiple accounts found with that name. Please sign in with your email address instead.");
          }

          throw new Error("Name-based login is not fully supported in Firebase yet. Please sign in with your email address.");
        }

        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, trimmedPassword);

        // Check for must_change_password after successful login (not typical in Firebase, but keeping logic)
        // Would need to fetch profile doc here if strictly required
      } else {
        const isDomainEmail = trimmedEmail.toLowerCase().endsWith("@thehealthyfamilies.net");
        const metadataRole = isDomainEmail ? "admin" : "facilitator";

        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        // Note: Profile creation happens automatically in AuthContext's onAuthStateChanged
        setMessage("Account created! You are now signed in.");
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      await updatePassword(auth.currentUser, password);

      // Update profile to mark password as changed
      const profileRef = doc(db, "profiles", auth.currentUser.uid);
      await updateDoc(profileRef, { must_change_password: false });

      setMessage("Password changed successfully! Redirecting...");
      setTimeout(() => window.dispatchEvent(new Event('hff-profile-refresh')), 1500);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  }

  async function handlePhoneSendOtp(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!phone) {
        setError("Please enter your phone number.");
        return;
      }
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setMessage("Verification code sent to your phone!");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhoneVerifyOtp(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await confirmationResult.confirm(otpToken);
      // Profile creation handled by AuthContext
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!email) {
        setError("Enter your email above first, then click Reset password.");
        return;
      }
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  /* ────────────────────────── LANDING SCREEN ────────────────────────── */
  if (screen === "landing") {
    return (
      <LandingPage
        onStart={(mode) => goToAuth(mode || "signup")}
        onSignIn={() => goToAuth("signin")}
      />
    );
  }

  /* ────────────────────────── AUTH SCREEN ────────────────────────── */
  const roleInfo = ROLES.find((r) => r.id === selectedRole);
  const RoleIcon = roleInfo?.icon || User;

  return (
    <div className="min-h-screen bg-transparent font-sans flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Ambient Diffusers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-[#71167F]/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-[#3EB049]/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          onClick={goToLanding}
          className="liquid-glass-pill px-4 py-2 inline-flex items-center gap-2 text-gray-600 hover:text-hff-primary mb-6 transition-colors text-xs font-bold shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to HFF Campaigns
        </button>

        {/* Card - Apple Liquid Glass */}
        <div className="glass-card p-6 sm:p-10 rounded-[2.5rem] border border-white/80 shadow-2xl relative overflow-hidden">
          {/* Specular top rim */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              {authMode === "signin" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-gray-500 text-xs font-medium">
              {authMode === "signin"
                ? "Sign in to your HFF Campaign account."
                : "Join our mission to restore hope and help families."}
            </p>
          </div>

          {/* Quick Dev Passwordless Entry */}
          {isDevBypass && (
            <div className="mb-8 p-4 rounded-2xl liquid-glass border border-emerald-500/30 bg-emerald-500/5 relative z-10 animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <LockOpen className="w-4 h-4 text-emerald-600" />
                  <span>Passwords Disabled for Review</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Dev Mode
                </span>
              </div>
              <p className="text-[11px] text-gray-600 mb-3">Jump straight into the app without entering passwords:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => switchDevRole("admin")}
                  className="py-2.5 px-3 rounded-xl liquid-glass-active text-white text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Enter as Admin
                </button>
                <button
                  type="button"
                  onClick={() => switchDevRole("facilitator")}
                  className="py-2.5 px-3 rounded-xl bg-white/80 hover:bg-white text-gray-800 text-xs font-bold border border-gray-200 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Enter as Facilitator
                </button>
              </div>
            </div>
          )}

          {/* Auth mode tabs (Sign In / Sign Up) */}
          <div className="flex p-1.5 liquid-glass-pill border border-white/70 mb-8 relative z-10">
            <button
              type="button"
              onClick={() => { setAuthMode("signin"); setError(""); setMessage(""); }}
              className={[
                "flex-1 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200",
                authMode === "signin"
                  ? "liquid-glass-active shadow-sm font-extrabold"
                  : "text-gray-500 hover:text-gray-800",
              ].join(" ")}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode("signup"); setError(""); setMessage(""); }}
              className={[
                "flex-1 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200",
                authMode === "signup"
                  ? "liquid-glass-active shadow-sm font-extrabold"
                  : "text-gray-500 hover:text-gray-800",
              ].join(" ")}
            >
              Sign Up
            </button>
          </div>

          {/* Auth Method Toggle (Email / Phone) */}
          {authMode !== "change-password" && (
            <div className="flex gap-4 mb-8 relative z-10">
              <button
                onClick={() => { setAuthMethod("email"); setError(""); setMessage(""); setOtpSent(false); }}
                className={`flex-1 flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all ${authMethod === "email"
                  ? "liquid-glass-active border-hff-primary/30"
                  : "liquid-glass-pill border-white/60 text-gray-400 hover:text-gray-700"
                  }`}
              >
                <Mail className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Email</span>
              </button>
              <button
                onClick={() => { setAuthMethod("phone"); setError(""); setMessage(""); }}
                className={`flex-1 flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all ${authMethod === "phone"
                  ? "liquid-glass-active border-hff-primary/30"
                  : "liquid-glass-pill border-white/60 text-gray-400 hover:text-gray-700"
                  }`}
              >
                <Phone className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Phone</span>
              </button>
            </div>
          )}

          {/* Form Area */}
          {authMode === "change-password" ? (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 pl-12 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 pl-12 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                    placeholder="Repeat new password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 font-medium ml-1">Please set a secure password you will remember.</p>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 font-medium">{error}</div>}
              {message && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 font-medium">{message}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-hff-primary text-white font-black text-lg px-8 py-4 shadow-xl shadow-hff-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Update Password"}
              </button>
            </form>
          ) : authMethod === "phone" ? (
            <form onSubmit={otpSent ? handlePhoneVerifyOtp : handlePhoneSendOtp} className="space-y-5">
              <div id="recaptcha-container"></div>
              {authMode === "signup" && !otpSent && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              )}
              {!otpSent ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-mono"
                        placeholder="+267 71 234 567"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2 ml-1">Enter with country code (e.g., +267)</p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-hff-primary text-white font-black text-lg px-8 py-4 shadow-xl shadow-hff-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Send Code"}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Verification Code</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={otpToken}
                        onChange={(e) => setOtpToken(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all text-center tracking-[0.5em] font-black"
                        placeholder="000000"
                        required
                        maxLength={6}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-hff-secondary text-white font-black text-lg px-8 py-4 shadow-xl shadow-hff-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submitting ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-xs font-bold text-gray-400 hover:text-hff-primary uppercase tracking-widest transition-colors"
                  >
                    Try another number
                  </button>
                </>
              )}
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 font-medium">{error}</div>}
              {message && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 font-medium">{message}</div>}
            </form>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-5">
              {authMode === "signup" && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  {authMode === "signin" ? "Email or Full Name" : "Email Address"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 pl-12 pr-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                    placeholder={authMode === "signin" ? "you@example.com or Full Name" : "you@example.com"}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    className="w-full rounded-2xl border border-gray-200 pl-12 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-gray-200 pl-12 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hff-primary/20 focus:border-hff-primary transition-all font-medium"
                      placeholder="••••••••"
                      required={authMode === "signup"}
                    />
                  </div>
                </div>
              )}


              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 font-medium">{error}</div>}
              {message && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 font-medium">{message}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-hff-primary text-white font-black text-lg px-8 py-4 shadow-xl shadow-hff-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? "Please wait…" : authMode === "signin" ? "Sign In" : "Create Account"}
              </button>

              {authMode === "signin" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={submitting}
                  className="w-full text-sm font-bold text-gray-400 hover:text-hff-primary uppercase tracking-widest transition-colors mt-2"
                >
                  Forgot password?
                </button>
              )}
            </form>
          )}

          {/* Google Sign-in moved below forms for cleaner look */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <button
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-white border-2 border-gray-100 text-gray-700 font-bold hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div >
  );
}
