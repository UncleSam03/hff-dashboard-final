import React, { useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import {
  AlertCircle, Key, Info, Shield, Users, User,
  Mail, Phone, Lock, Eye, EyeOff, ArrowRight,
  CheckCircle2, ChevronLeft, Sparkles
} from "lucide-react";
import LandingPage from "@/components/LandingPage";

/* ───────── helpers ───────── */
function friendlyAuthError(err) {
  const m = err?.message || "";
  if (m.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("Email not confirmed")) return "Please confirm your email address first.";
  if (m.includes("User already registered")) return "That email is already in use. Try signing in.";
  if (m.includes("Phone")) return "Invalid phone number or verification failed.";
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
function ConfigRequired() {
  return (
    <div className="min-h-screen bg-[#FDFCF9] font-sans text-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-[2.5rem] shadow-xl p-6 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-12 w-12 bg-hff-soft-purple rounded-xl flex items-center justify-center text-hff-primary">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuration Required</h1>
            <p className="text-gray-500">Supabase environment variables are missing.</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-hff-warm-beige border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-hff-primary mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-semibold mb-1">Why is this happening?</p>
                <p>The app requires Supabase Auth. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env.local</code> and restart the dev server.</p>
              </div>
            </div>
          </div>
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
  const [selectedRole, setSelectedRole] = useState("facilitator");

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!isConfigured) return <ConfigRequired />;

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
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

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

    try {
      if (authMode === "signin") {
        let loginEmail = trimmedEmail;
        const isEmail = trimmedEmail.includes("@");

        // If not an email, lookup in profiles by full_name
        if (!isEmail) {
          const { data: profileMatch, error: lookupErr } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .ilike("full_name", trimmedEmail)
            .single();

          if (lookupErr || !profileMatch) {
            throw new Error("Could not find a user with that name. Please check and try again.");
          }

          const { data: userData, error: userErr } = await supabase.rpc('get_user_email_by_id', { user_id: profileMatch.id });

          if (userErr || !userData) {
            throw new Error("Unable to retrieve login identifier for this name. Please use email or contact admin.");
          }
          loginEmail = userData;
        }

        const { data: signInData, error: err } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: trimmedPassword
        });
        if (err) throw err;

        // Check for must_change_password after successful login
        const { data: profile } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("id", signInData.user.id)
          .single();

        if (profile?.must_change_password) {
          setAuthMode("change-password");
          setMessage("You must change your password before proceeding.");
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
          options: {
            data: {
              role: selectedRole,
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });
        if (err) throw err;
        setMessage("Account created! Check your email for the confirmation link.");
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
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;

      // Update profile to mark password as changed
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", (await supabase.auth.getUser()).data.user.id);

      if (profErr) throw profErr;

      setMessage("Password changed successfully! Redirecting...");
      setTimeout(() => window.location.reload(), 1500);
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
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: window.location.origin,
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
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
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          data: {
            role: selectedRole,
            full_name: fullName,
            phone: phone,
          },
        },
      });
      if (err) throw err;
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
      const { error: err } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otpToken,
        type: "sms",
      });
      if (err) throw err;
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
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
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
    <div className="min-h-screen bg-[#FDFCF9] font-sans flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-hff-soft-purple rounded-full blur-[120px] -z-0"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-hff-warm-green rounded-full blur-[100px] -z-0"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          onClick={goToLanding}
          className="flex items-center gap-2 text-gray-500 hover:text-hff-primary mb-6 transition-colors text-sm font-bold"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to HFF Campaigns
        </button>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl shadow-hff-primary/5 p-6 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
              {authMode === "signin" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-gray-500 font-medium">
              {authMode === "signin"
                ? "Sign in to your HFF Campaign account."
                : "Join our mission to restore hope and help families."}
            </p>
          </div>

          {/* Auth mode tabs (Sign In / Sign Up) */}
          <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => { setAuthMode("signin"); setError(""); setMessage(""); }}
              className={[
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                authMode === "signin"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode("signup"); setError(""); setMessage(""); }}
              className={[
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                authMode === "signup"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              Sign Up
            </button>
          </div>

          {/* Auth Method Toggle (Email / Phone) */}
          {authMode !== "change-password" && (
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => { setAuthMethod("email"); setError(""); setMessage(""); setOtpSent(false); }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-[2rem] border-2 transition-all ${authMethod === "email"
                  ? "border-hff-primary bg-hff-primary/5 text-hff-primary"
                  : "border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200"
                  }`}
              >
                <Mail className="h-6 w-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Email</span>
              </button>
              <button
                onClick={() => { setAuthMethod("phone"); setError(""); setMessage(""); }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-[2rem] border-2 transition-all ${authMethod === "phone"
                  ? "border-hff-primary bg-hff-primary/5 text-hff-primary"
                  : "border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200"
                  }`}
              >
                <Phone className="h-6 w-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Phone</span>
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
    </div>
  );
}
