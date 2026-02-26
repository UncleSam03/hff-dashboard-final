import React, { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { supabase, isConfigured } from "@/lib/supabase";
import { db } from "@/lib/dexieDb";
import {
    Users, UserPlus, ClipboardCheck, ArrowLeft, Search,
    Phone, CheckCircle2, XCircle, ChevronDown, ChevronUp,
    Calendar, Loader2
} from "lucide-react";

const TOTAL_DAYS = 12;

export default function FacilitatorDashboard({ onBack }) {
    const { user, profile } = useAuth();
    const [view, setView] = useState("menu"); // menu | register | attendance | list
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    // Registration form state
    const [regForm, setRegForm] = useState({
        first_name: "",
        last_name: "",
        phone: "",
        age: "",
        gender: "",
    });
    const [regMessage, setRegMessage] = useState("");
    const [regError, setRegError] = useState("");

    useEffect(() => {
        if (view === "list" || view === "attendance") {
            loadParticipants();
        }
    }, [view]);

    async function loadParticipants() {
        setLoading(true);
        try {
            // Try Supabase first
            if (isConfigured) {
                const { data, error } = await supabase
                    .from("registrations")
                    .select("uuid, first_name, last_name, contact, attendance")
                    .eq("facilitator_uuid", user.id)
                    .eq("type", "participant");

                if (!error && data) {
                    setParticipants(data);
                    setLoading(false);
                    return;
                }
            }
            // Fallback to local Dexie
            const local = await db.registrations
                .where("facilitator_uuid")
                .equals(user.id)
                .toArray();
            setParticipants(local.map(p => ({
                uuid: p.uuid,
                first_name: p.first_name,
                last_name: p.last_name,
                contact: p.contact || p.phone || "",
                attendance: p.attendance || Array(TOTAL_DAYS).fill(false),
            })));
        } catch (err) {
            console.error("Error loading participants:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        setRegError("");
        setRegMessage("");
        setLoading(true);
        try {
            const newUuid = crypto.randomUUID();
            const record = {
                uuid: newUuid,
                first_name: regForm.first_name,
                last_name: regForm.last_name,
                contact: regForm.phone,
                age: regForm.age ? parseInt(regForm.age) : null,
                gender: regForm.gender || null,
                type: "participant",
                facilitator_uuid: user.id,
                attendance: Array(TOTAL_DAYS).fill(false),
                source: "facilitator-dashboard",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: "pending",
            };

            // Save locally
            await db.registrations.add(record);

            // Try Supabase - strip internal fields
            if (isConfigured) {
                const { sync_status, ...supabasePayload } = record;
                const { error } = await supabase.from("registrations").insert(supabasePayload);
                if (!error) {
                    await db.registrations.where("uuid").equals(newUuid).modify({ sync_status: "synced" });
                } else {
                    console.error("Supabase sync error:", error);
                }
            }

            setRegMessage(`${regForm.first_name} ${regForm.last_name} registered successfully!`);
            setRegForm({ first_name: "", last_name: "", phone: "", age: "", gender: "" });
        } catch (err) {
            setRegError(err.message || "Failed to register participant.");
        } finally {
            setLoading(false);
        }
    }

    async function toggleAttendance(participantUuid, dayIndex) {
        setParticipants(prev =>
            prev.map(p => {
                if (p.uuid !== participantUuid) return p;
                const att = [...(p.attendance || Array(TOTAL_DAYS).fill(false))];
                att[dayIndex] = !att[dayIndex];
                return { ...p, attendance: att };
            })
        );

        try {
            const participant = participants.find(p => p.uuid === participantUuid);
            const att = [...(participant?.attendance || Array(TOTAL_DAYS).fill(false))];
            att[dayIndex] = !att[dayIndex];

            // Update locally
            await db.registrations
                .where("uuid")
                .equals(participantUuid)
                .modify({ attendance: att, updated_at: new Date().toISOString() });

            // Update Supabase
            if (isConfigured) {
                await supabase
                    .from("registrations")
                    .update({ attendance: att, updated_at: new Date().toISOString() })
                    .eq("uuid", participantUuid);
            }
        } catch (err) {
            console.error("Error updating attendance:", err);
        }
    }

    const filteredParticipants = participants.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    /* ── Card button ── */
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
        <div className="max-w-5xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={view === "menu" ? onBack : () => setView("menu")}
                    className="flex items-center gap-2 text-gray-600 hover:text-hff-primary transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    {view === "menu" ? "Sign Out" : "Back to Menu"}
                </button>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                    <Users className="h-4 w-4" />
                    Facilitator
                </div>
            </div>

            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Welcome, <span className="text-emerald-600">{profile?.full_name || "Facilitator"}</span>
                </h1>
                <p className="text-gray-500 mt-1">Manage your participants and attendance</p>
            </div>

            {/* Menu */}
            {view === "menu" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MenuCard
                        icon={UserPlus}
                        title="Register Participant"
                        desc="Add a new participant to your group"
                        onClick={() => setView("register")}
                        color="bg-emerald-50 text-emerald-600"
                    />
                    <MenuCard
                        icon={ClipboardCheck}
                        title="Mark Attendance"
                        desc="Record daily attendance for participants"
                        onClick={() => setView("attendance")}
                        color="bg-blue-50 text-blue-600"
                    />
                    <MenuCard
                        icon={Users}
                        title="My Participants"
                        desc="View names and phone numbers"
                        onClick={() => setView("list")}
                        color="bg-purple-50 text-purple-600"
                    />
                </div>
            )}

            {/* Register Form */}
            {view === "register" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 max-w-md mx-auto">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-emerald-600" />
                        Register Participant
                    </h2>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={regForm.first_name}
                                    onChange={e => setRegForm(p => ({ ...p, first_name: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={regForm.last_name}
                                    onChange={e => setRegForm(p => ({ ...p, last_name: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                value={regForm.phone}
                                onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                placeholder="+267 71 234 567"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <input
                                    type="number"
                                    value={regForm.age}
                                    onChange={e => setRegForm(p => ({ ...p, age: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                <select
                                    value={regForm.gender}
                                    onChange={e => setRegForm(p => ({ ...p, gender: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                >
                                    <option value="">Select</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                </select>
                            </div>
                        </div>

                        {regError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{regError}</div>
                        )}
                        {regMessage && (
                            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{regMessage}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-emerald-600 text-white font-bold px-4 py-3 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            {loading ? "Registering…" : "Register Participant"}
                        </button>
                    </form>
                </div>
            )}

            {/* Participants List (Name + Phone only) */}
            {view === "list" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-600" />
                        My Participants ({participants.length})
                    </h2>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by name…"
                            className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                        />
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                        </div>
                    ) : filteredParticipants.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No participants registered yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredParticipants.map((p, i) => (
                                <div key={p.uuid || i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <Phone className="h-3.5 w-3.5" />
                                            {p.contact || "No phone"}
                                        </p>
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        {(p.attendance || []).filter(Boolean).length}/{TOTAL_DAYS} days
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Attendance */}
            {view === "attendance" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-blue-600" />
                        Mark Attendance
                    </h2>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search participant…"
                            className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        />
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                        </div>
                    ) : filteredParticipants.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No participants to mark attendance for.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredParticipants.map((p) => {
                                const isExpanded = expandedId === p.uuid;
                                const att = p.attendance || Array(TOTAL_DAYS).fill(false);
                                const attended = att.filter(Boolean).length;

                                return (
                                    <div key={p.uuid} className="border border-gray-100 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : p.uuid)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="text-left">
                                                <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                                                <p className="text-sm text-gray-500">{attended}/{TOTAL_DAYS} days attended</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${(attended / TOTAL_DAYS) * 100}%` }}
                                                    ></div>
                                                </div>
                                                {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                            </div>
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 pb-4 border-t border-gray-100">
                                                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-4">
                                                    {att.map((present, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => toggleAttendance(p.uuid, idx)}
                                                            className={[
                                                                "flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all",
                                                                present
                                                                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                                                                    : "bg-gray-50 text-gray-400 border-2 border-gray-100 hover:border-blue-200 hover:text-blue-500",
                                                            ].join(" ")}
                                                        >
                                                            <span className="text-[10px] opacity-60">Day</span>
                                                            <span>{idx + 1}</span>
                                                            {present ? <CheckCircle2 className="h-3 w-3 mt-0.5" /> : <XCircle className="h-3 w-3 mt-0.5 opacity-30" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
