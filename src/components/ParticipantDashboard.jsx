import React, { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { supabase, isConfigured } from "@/lib/supabase";
import {
    CalendarCheck, FileText, Send, ArrowLeft,
    CheckCircle2, XCircle, Loader2, MessageSquarePlus,
    User, Clock
} from "lucide-react";

const TOTAL_DAYS = 12;

export default function ParticipantDashboard({ onBack }) {
    const { user, profile } = useAuth();
    const [view, setView] = useState("menu"); // menu | attendance | testimony
    const [registration, setRegistration] = useState(null);
    const [testimonies, setTestimonies] = useState([]);
    const [loading, setLoading] = useState(false);

    // Testimony form
    const [testimonyText, setTestimonyText] = useState("");
    const [sending, setSending] = useState(false);
    const [testMessage, setTestMessage] = useState("");
    const [testError, setTestError] = useState("");

    useEffect(() => {
        loadRegistration();
        loadTestimonies();
    }, []);

    async function loadRegistration() {
        if (!isConfigured) return;
        setLoading(true);
        try {
            // Find registration linked to this user's email or phone
            const { data, error } = await supabase
                .from("registrations")
                .select("*")
                .or(`contact.eq.${profile?.phone},contact.eq.${user?.email}`)
                .eq("type", "participant")
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                setRegistration(data);
            }
        } catch (err) {
            console.error("Error loading registration:", err);
        } finally {
            setLoading(false);
        }
    }

    async function loadTestimonies() {
        if (!isConfigured) return;
        try {
            const { data, error } = await supabase
                .from("testimonies")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setTestimonies(data);
            }
        } catch (err) {
            console.error("Error loading testimonies:", err);
        }
    }

    async function handleSendTestimony(e) {
        e.preventDefault();
        if (!testimonyText.trim()) return;
        setSending(true);
        setTestError("");
        setTestMessage("");

        try {
            if (!isConfigured) {
                setTestError("Cannot send testimony while offline. Please try again when connected.");
                return;
            }

            const { error } = await supabase.from("testimonies").insert({
                user_id: user.id,
                content: testimonyText.trim(),
            });

            if (error) throw error;

            setTestMessage("Testimony sent successfully! Thank you for sharing.");
            setTestimonyText("");
            loadTestimonies();
        } catch (err) {
            setTestError(err.message || "Failed to send testimony.");
        } finally {
            setSending(false);
        }
    }

    const attendance = registration?.attendance || Array(TOTAL_DAYS).fill(false);
    const daysAttended = attendance.filter(Boolean).length;

    const MenuCard = ({ icon: Icon, title, desc, onClick, color }) => (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group text-center"
        >
            <div className={`p-4 rounded-2xl mb-4 ${color} group-hover:scale-110 transition-transform`}>
                <Icon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={view === "menu" ? onBack : () => setView("menu")}
                    className="flex items-center gap-2 text-gray-600 hover:text-hff-primary transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    {view === "menu" ? "Sign Out" : "Back to Menu"}
                </button>
                <div className="flex items-center gap-2 bg-violet-50 text-violet-700 px-3 py-1 rounded-full text-sm font-semibold">
                    <User className="h-4 w-4" />
                    Participant
                </div>
            </div>

            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Welcome, <span className="text-violet-600">{profile?.full_name || "Participant"}</span>
                </h1>
                <p className="text-gray-500 mt-1">Track your campaign journey</p>
            </div>

            {/* Menu */}
            {view === "menu" && (
                <>
                    {/* Quick status card */}
                    <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/70 text-sm font-medium">Attendance Progress</p>
                                <p className="text-3xl font-black mt-1">{daysAttended} / {TOTAL_DAYS} days</p>
                            </div>
                            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                                <CalendarCheck className="h-8 w-8" />
                            </div>
                        </div>
                        <div className="mt-4 w-full h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all"
                                style={{ width: `${(daysAttended / TOTAL_DAYS) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-white/60 text-sm mt-2">
                            {registration ? "Registered and tracked by your facilitator" : "Registration not found — contact your facilitator"}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <MenuCard
                            icon={CalendarCheck}
                            title="Attendance Record"
                            desc="View which days your facilitator has marked you present"
                            onClick={() => setView("attendance")}
                            color="bg-blue-50 text-blue-600"
                        />
                        <MenuCard
                            icon={MessageSquarePlus}
                            title="Send Testimony"
                            desc="Share your experience and testimony from the campaign"
                            onClick={() => setView("testimony")}
                            color="bg-amber-50 text-amber-600"
                        />
                    </div>
                </>
            )}

            {/* Attendance View */}
            {view === "attendance" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 text-blue-600" />
                        My Attendance
                    </h2>
                    <p className="text-gray-500 text-sm mb-6">
                        {daysAttended} out of {TOTAL_DAYS} days attended
                    </p>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                        </div>
                    ) : !registration ? (
                        <div className="text-center py-12 text-gray-400">
                            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No registration found</p>
                            <p className="text-sm mt-1">Your facilitator needs to register you first.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-9 gap-3">
                            {attendance.map((present, idx) => (
                                <div
                                    key={idx}
                                    className={[
                                        "flex flex-col items-center justify-center p-3 rounded-xl text-xs font-semibold",
                                        present
                                            ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                                            : "bg-gray-50 text-gray-400 border-2 border-gray-100",
                                    ].join(" ")}
                                >
                                    <span className="text-[10px] opacity-60">Day</span>
                                    <span className="text-base">{idx + 1}</span>
                                    {present ? (
                                        <CheckCircle2 className="h-4 w-4 mt-1 text-emerald-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 mt-1 opacity-20" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Testimony View */}
            {view === "testimony" && (
                <div className="space-y-6">
                    {/* Send testimony */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageSquarePlus className="h-5 w-5 text-amber-600" />
                            Share Your Testimony
                        </h2>
                        <form onSubmit={handleSendTestimony} className="space-y-4">
                            <textarea
                                value={testimonyText}
                                onChange={e => setTestimonyText(e.target.value)}
                                placeholder="Tell us about your experience during the campaign…"
                                rows={5}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
                                required
                            />
                            {testError && (
                                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{testError}</div>
                            )}
                            {testMessage && (
                                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{testMessage}</div>
                            )}
                            <button
                                type="submit"
                                disabled={sending || !testimonyText.trim()}
                                className="w-full rounded-xl bg-amber-500 text-white font-bold px-4 py-3 hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="h-4 w-4" />
                                {sending ? "Sending…" : "Send Testimony"}
                            </button>
                        </form>
                    </div>

                    {/* Past testimonies */}
                    {testimonies.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-gray-500" />
                                Your Testimonies
                            </h3>
                            <div className="space-y-4">
                                {testimonies.map((t) => (
                                    <div key={t.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <p className="text-gray-800 whitespace-pre-wrap">{t.content}</p>
                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
