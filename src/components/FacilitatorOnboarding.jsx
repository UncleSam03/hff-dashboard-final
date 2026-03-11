import React, { useState } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/dexieDb";
import {
    Sparkles, User, Users, GraduationCap, Heart, MapPin,
    Calendar, Loader2, ArrowRight, Check
} from "lucide-react";

export default function FacilitatorOnboarding({ onComplete }) {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        age: "",
        gender: "",
        education: "",
        maritalStatus: "",
        place: "",
        affiliation: "",
        occupation: "",
    });

    async function handleSubmit(e) {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError("");

        try {
            const full_name = profile?.full_name || user?.user_metadata?.full_name || "";
            const phone = profile?.phone || user?.user_metadata?.phone || user?.phone || "";

            // Split names for registrations table
            let first_name = full_name;
            let last_name = "";
            if (full_name.includes(" ")) {
                const parts = full_name.split(" ");
                first_name = parts[0];
                last_name = parts.slice(1).join(" ");
            }

            let supabaseSuccess = false;

            // 1. Try Supabase first (if configured and online)
            if (isConfigured && navigator.onLine) {
                try {
                    // 1a. Profiles (Use upsert to be safe, though id exists)
                    const { error: profErr } = await supabase
                        .from("profiles")
                        .upsert({
                            id: user.id,
                            age: parseInt(form.age),
                            gender: form.gender,
                            education: form.education,
                            marital_status: form.maritalStatus,
                            place: form.place,
                            affiliation: form.affiliation,
                            occupation: form.occupation,
                            onboarding_completed: true,
                        }, { onConflict: 'id' });

                    if (profErr) throw profErr;

                    // 1b. Registrations (Atomic upsert by UUID)
                    const regPayload = {
                        uuid: user.id,
                        first_name,
                        last_name,
                        age: parseInt(form.age),
                        gender: form.gender,
                        contact: phone,
                        place: form.place,
                        education: form.education,
                        marital_status: form.maritalStatus,
                        affiliation: form.affiliation,
                        occupation: form.occupation,
                        type: "facilitator",
                        facilitator_uuid: user.id,
                        source: "facilitator-onboarding",
                        updated_at: new Date().toISOString()
                    };

                    const { error: regErr } = await supabase
                        .from("registrations")
                        .upsert(regPayload, { onConflict: 'uuid' });

                    if (regErr) {
                        console.warn("[Onboarding] Registration upsert failed, but profile succeeded:", regErr.message);
                    }
                    
                    supabaseSuccess = true;
                    supabaseSuccess = true;
                } catch (cloudErr) {
                    console.warn("[Onboarding] Supabase write failed, falling back to offline:", cloudErr.message);
                }
            }

            // 2. Always save to Dexie as a local record (for offline-first)
            try {
                const existing = await db.registrations.where("uuid").equals(user.id).first();
                const regData = {
                    uuid: user.id,
                    first_name,
                    last_name,
                    age: parseInt(form.age),
                    gender: form.gender,
                    contact: phone,
                    place: form.place,
                    education: form.education,
                    marital_status: form.maritalStatus,
                    affiliation: form.affiliation,
                    occupation: form.occupation,
                    type: "facilitator",
                    facilitator_uuid: user.id,
                    source: "facilitator-onboarding",
                    sync_status: supabaseSuccess ? "synced" : "pending",
                    updated_at: new Date().toISOString(),
                };

                if (existing) {
                    await db.registrations.update(existing.id, regData);
                } else {
                    await db.registrations.add({
                        ...regData,
                        created_at: new Date().toISOString(),
                    });
                }
            } catch (dexieErr) {
                console.error("[Onboarding] Dexie save error:", dexieErr);
            }

            // If Supabase failed, store a local flag so the profile update
            // can be retried on next sync.
            if (!supabaseSuccess) {
                localStorage.setItem('hff_onboarding_pending', JSON.stringify({
                    userId: user.id,
                    ...form,
                }));
            }

            // Trigger reload/redirect
            console.log("[Onboarding] Submission successful, triggering profile refresh...");
            window.dispatchEvent(new Event('hff-profile-refresh'));
            
            if (onComplete) {
                console.log("[Onboarding] Calling onComplete callback...");
                onComplete();
            }

        } catch (err) {
            console.error("Onboarding error:", err);
            setError(err.message || "Failed to save onboarding information.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#FDFCF9] font-sans flex items-center justify-center px-4 py-8 relative overflow-hidden">
            {/* Background Shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-hff-soft-purple rounded-full blur-[120px] -z-0"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-hff-warm-green rounded-full blur-[100px] -z-0"></div>
            </div>

            <div className="relative z-10 w-full max-w-xl">
                <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl shadow-hff-primary/5 p-6 sm:p-10 animate-in fade-in zoom-in duration-500">

                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-3 bg-hff-primary text-white rounded-2xl shadow-lg shadow-hff-primary/20 mb-6">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">Complete Your Profile</h1>
                        <p className="text-gray-500 font-medium">Just a few more details to get you started as a Facilitator.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Age */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3" /> Age
                                </label>
                                <input
                                    type="number"
                                    value={form.age}
                                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all"
                                    placeholder="e.g. 28"
                                    required
                                />
                            </div>

                            {/* Gender */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <User className="h-3 w-3" /> Gender
                                </label>
                                <select
                                    value={form.gender}
                                    onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all appearance-none"
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                </select>
                            </div>

                            {/* Education */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <GraduationCap className="h-3 w-3" /> Education
                                </label>
                                <select
                                    value={form.education}
                                    onChange={e => setForm(f => ({ ...f, education: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all appearance-none"
                                    required
                                >
                                    <option value="">Select Level</option>
                                    <option value="None">None</option>
                                    <option value="Primary">Primary</option>
                                    <option value="Secondary">Secondary</option>
                                    <option value="Tertiary">Tertiary</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Marital Status */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <Heart className="h-3 w-3" /> Marital Status
                                </label>
                                <select
                                    value={form.maritalStatus}
                                    onChange={e => setForm(f => ({ ...f, maritalStatus: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all appearance-none"
                                    required
                                >
                                    <option value="">Select Status</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Widowed">Widowed</option>
                                </select>
                            </div>

                            {/* Affiliation */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <Users className="h-3 w-3" /> Affiliation
                                </label>
                                <input
                                    type="text"
                                    value={form.affiliation}
                                    onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all"
                                    placeholder="e.g. Church, NGO"
                                />
                            </div>

                            {/* Occupation */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                    <Sparkles className="h-3 w-3" /> Occupation
                                </label>
                                <input
                                    type="text"
                                    value={form.occupation}
                                    onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all"
                                    placeholder="e.g. Teacher"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                <MapPin className="h-3 w-3" /> Location / Place
                            </label>
                            <input
                                type="text"
                                value={form.place}
                                onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
                                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-hff-primary/5 focus:border-hff-primary transition-all"
                                placeholder="e.g. Molepolole"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full hff-gradient-bg text-white font-black text-lg py-5 rounded-3xl shadow-2xl shadow-hff-primary/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    Complete Setup <ArrowRight className="h-6 w-6" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <Check className="h-4 w-4 text-hff-secondary" /> Secure HFF Database Entry
                    </p>
                </div>
            </div>
        </div>
    );
}
