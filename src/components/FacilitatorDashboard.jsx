import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase, isConfigured } from "../lib/supabase";
import { db } from "../lib/dexieDb";
import {
    Users, UserPlus, ClipboardCheck, ArrowLeft, Search,
    Phone, Check, XCircle, ChevronDown, ChevronUp,
    Calendar, Loader2, Link2, AlertTriangle, User
} from "lucide-react";

import { TOTAL_CAMPAIGN_DAYS } from "../lib/constants";

const TOTAL_DAYS = TOTAL_CAMPAIGN_DAYS;

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
        place: "",
        education: "",
        marital_status: "",
        affiliation: "",
        occupation: "",
    });
    const [regMessage, setRegMessage] = useState("");
    const [regError, setRegError] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [lookupMatch, setLookupMatch] = useState(null); // { type: 'profile'|'registration', data: Object }

    useEffect(() => {
        if (view === "list" || view === "attendance") {
            loadParticipants();
        }
    }, [view]);

    async function loadParticipants() {
        setLoading(true);
        try {
            let facilitatorIds = [user.id];

            // 1. Identify all IDs associated with this facilitator (Legacy + Auth)
            if (isConfigured) {
                // Find any facilitator record matching this user's identity
                const { data: facRecords } = await supabase
                    .from("registrations")
                    .select("uuid")
                    .eq("type", "facilitator")
                    .or(`uuid.eq.${user.id},contact.eq.${profile?.phone || user?.phone || 'none'}`);

                if (facRecords) {
                    const ids = facRecords.map(r => r.uuid);
                    facilitatorIds = [...new Set([...facilitatorIds, ...ids])];
                }

                // 2. Fetch participants linked to ANY of these facilitator IDs
                const { data, error } = await supabase
                    .from("registrations")
                    .select("uuid, first_name, last_name, contact, attendance, books_received")
                    .in("facilitator_uuid", facilitatorIds)
                    .eq("type", "participant");

                if (!error && data) {
                    setParticipants(data);
                    setLoading(false);
                    return;
                }
            }

            // Fallback to local Dexie
            let localFacIds = [user.id];
            const phoneStr = profile?.phone || user?.phone || 'none';
            const localFacs = await db.registrations
                .where("type").equals("facilitator")
                .filter(r => r.uuid === user.id || r.contact === phoneStr)
                .toArray();

            if (localFacs.length > 0) {
                localFacIds = [...new Set([...localFacIds, ...localFacs.map(f => f.uuid)])];
            }

            const local = await db.registrations
                .filter(r => r.type === 'participant' && localFacIds.includes(r.facilitator_uuid))
                .toArray();

            setParticipants(local.map(p => ({
                uuid: p.uuid,
                first_name: p.first_name,
                last_name: p.last_name,
                contact: p.contact || p.phone || "",
                attendance: p.attendance || Array(TOTAL_DAYS).fill(false),
                books_received: p.books_received || false,
            })));
        } catch (err) {
            console.error("Error loading participants:", err);
        } finally {
            setLoading(false);
        }
    }

    async function checkExistingParticipant(phone) {
        if (!phone || phone.length < 7) {
            setLookupMatch(null);
            return;
        }

        setIsSearching(true);
        try {
            // 1. Check Supabase profiles (Auth users)
            if (isConfigured) {
                const { data: profileMatch } = await supabase
                    .from("profiles")
                    .select("id, full_name, phone, age, gender, occupation, place")
                    .eq("phone", phone)
                    .maybeSingle();

                if (profileMatch) {
                    setLookupMatch({ type: 'profile', data: profileMatch });
                    // Auto-fill form if name is empty
                    if (!regForm.first_name) {
                        const [first, ...rest] = (profileMatch.full_name || "").split(" ");
                        setRegForm(p => ({
                            ...p,
                            first_name: first || "",
                            last_name: rest.join(" ") || "",
                            age: profileMatch.age || p.age,
                            gender: profileMatch.gender || p.gender,
                            occupation: profileMatch.occupation || p.occupation,
                            place: profileMatch.place || p.place
                        }));
                    }
                    return;
                }

                // 2. Check Supabase registrations
                const { data: regMatch } = await supabase
                    .from("registrations")
                    .select("*")
                    .eq("contact", phone)
                    .eq("type", "participant")
                    .maybeSingle();

                if (regMatch) {
                    setLookupMatch({ type: 'registration', data: regMatch });
                    if (!regForm.first_name) {
                        setRegForm(p => ({
                            ...p,
                            first_name: regMatch.first_name,
                            last_name: regMatch.last_name,
                            age: regMatch.age || p.age,
                            gender: regMatch.gender || p.gender,
                            place: regMatch.place || p.place,
                            education: regMatch.education || p.education,
                            marital_status: regMatch.marital_status || p.marital_status,
                            occupation: regMatch.occupation || p.occupation,
                            affiliation: regMatch.affiliation || p.affiliation
                        }));
                    }
                    return;
                }
            }

            // 3. Fallback/Local Dexie check
            const localMatch = await db.registrations
                .where("contact").equals(phone)
                .filter(r => r.type === 'participant')
                .first();

            if (localMatch) {
                setLookupMatch({ type: 'registration', data: localMatch });
            } else {
                setLookupMatch(null);
            }
        } catch (err) {
            console.error("Lookup error:", err);
        } finally {
            setIsSearching(false);
        }
    }

    // Debounce phone lookup
    useEffect(() => {
        const timer = setTimeout(() => {
            if (view === "register") checkExistingParticipant(regForm.phone);
        }, 600);
        return () => clearTimeout(timer);
    }, [regForm.phone, view]);

    async function handleRegister(e) {
        e.preventDefault();
        setRegError("");
        setRegMessage("");
        setLoading(true);
        try {
            // Find the best facilitator UUID to use for this participant to avoid auth id mismatches
            let primaryFacilitatorUuid = user.id;
            const phoneStr = profile?.phone || user?.phone || 'none';
            const localFac = await db.registrations
                .where("type").equals("facilitator")
                .filter(r => r.contact === phoneStr || r.uuid === user.id)
                .first();
            
            if (localFac) {
                primaryFacilitatorUuid = localFac.uuid;
            }

            // Use existing UUID if matching participant found, otherwise new
            const finalUuid = lookupMatch ? (lookupMatch.type === 'profile' ? lookupMatch.data.id : lookupMatch.data.uuid) : crypto.randomUUID();

            const record = {
                uuid: finalUuid,
                first_name: regForm.first_name,
                last_name: regForm.last_name,
                contact: regForm.phone,
                age: regForm.age ? parseInt(regForm.age) : null,
                gender: regForm.gender || null,
                place: regForm.place || "",
                education: regForm.education || "",
                marital_status: regForm.marital_status || "",
                affiliation: regForm.affiliation || "",
                occupation: regForm.occupation || "",
                type: "participant",
                facilitator_uuid: primaryFacilitatorUuid,
                attendance: lookupMatch?.data?.attendance || Array(TOTAL_DAYS).fill(false),
                books_received: lookupMatch?.data?.books_received || false,
                source: "facilitator-dashboard",
                created_at: lookupMatch?.data?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sync_status: "pending",
            };

            // Save locally (using put instead of add to handle existing records)
            const existingLocally = await db.registrations.where("uuid").equals(finalUuid).first();
            if (existingLocally) {
                await db.registrations.update(existingLocally.id, record);
            } else {
                await db.registrations.add(record);
            }

            // Try Supabase
            if (isConfigured) {
                const { id, sync_status, synced_at, ...supabasePayload } = record;
                
                let error;
                if (lookupMatch?.type === 'registration' || (isConfigured && (await supabase.from("registrations").select("uuid").eq("uuid", finalUuid).maybeSingle()).data)) {
                    // Update existing registration
                    const { error: updateError } = await supabase.from("registrations").update(supabasePayload).eq("uuid", finalUuid);
                    error = updateError;
                } else {
                    // Insert new registration
                    const { error: insertError } = await supabase.from("registrations").insert(supabasePayload);
                    error = insertError;
                }

                if (!error) {
                    await db.registrations.where("uuid").equals(finalUuid).modify({
                        sync_status: "synced",
                        synced_at: new Date().toISOString()
                    });
                } else {
                    console.error("Supabase sync error:", error);
                }
            }

            setRegMessage(lookupMatch ? `Updated existing record for ${regForm.first_name}!` : `${regForm.first_name} ${regForm.last_name} registered successfully!`);
            setRegForm({ first_name: "", last_name: "", phone: "", age: "", gender: "", place: "", education: "", marital_status: "", affiliation: "", occupation: "" });
            setLookupMatch(null);
            loadParticipants(); // Refresh list after registration
        } catch (err) {
            setRegError(err.message || "Failed to register participant.");
        } finally {
            setLoading(false);
        }
    }

    async function toggleBookReceived(participantUuid) {
        // Compute new value from current state to avoid race conditions
        const participant = participants.find(p => p.uuid === participantUuid);
        if (!participant) return;
        const newStatus = !participant.books_received;

        setParticipants(prev =>
            prev.map(p => {
                if (p.uuid !== participantUuid) return p;
                return { ...p, books_received: newStatus };
            })
        );

        try {
            // Update locally
            await db.registrations
                .where("uuid")
                .equals(participantUuid)
                .modify({
                    books_received: newStatus,
                    updated_at: new Date().toISOString(),
                    sync_status: "pending"
                });

            // Update Supabase
            if (isConfigured) {
                const { error } = await supabase
                    .from("registrations")
                    .update({ books_received: newStatus, updated_at: new Date().toISOString() })
                    .eq("uuid", participantUuid);

                if (!error) {
                    await db.registrations
                        .where("uuid")
                        .equals(participantUuid)
                        .modify({ sync_status: "synced", synced_at: new Date().toISOString() });
                }
            }
        } catch (err) {
            console.error("Error updating book status:", err);
        }
    }

    async function toggleAttendance(participantUuid, dayIndex) {
        // Compute new attendance from current state to avoid race conditions
        const participant = participants.find(p => p.uuid === participantUuid);
        if (!participant) return;
        const att = [...(participant.attendance || Array(TOTAL_DAYS).fill(false))];
        att[dayIndex] = !att[dayIndex];

        setParticipants(prev =>
            prev.map(p => {
                if (p.uuid !== participantUuid) return p;
                return { ...p, attendance: att };
            })
        );

        try {
            // Update locally
            await db.registrations
                .where("uuid")
                .equals(participantUuid)
                .modify({
                    attendance: att,
                    updated_at: new Date().toISOString(),
                    sync_status: "pending"
                });

            // Update Supabase
            if (isConfigured) {
                const { error } = await supabase
                    .from("registrations")
                    .update({ attendance: att, updated_at: new Date().toISOString() })
                    .eq("uuid", participantUuid);

                if (!error) {
                    await db.registrations
                        .where("uuid")
                        .equals(participantUuid)
                        .modify({ sync_status: "synced", synced_at: new Date().toISOString() });
                }
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
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 max-w-2xl mx-auto">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-emerald-600" />
                        Register Participant
                    </h2>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                {isSearching && <Loader2 className="h-3 w-3 text-emerald-500 animate-spin" />}
                            </div>
                            <div className="relative">
                                <input
                                    type="tel"
                                    value={regForm.phone}
                                    onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                                    className={`w-full rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 transition-all ${lookupMatch ? 'border-amber-200 bg-amber-50 ring-amber-400/20' : 'border-gray-200 focus:ring-emerald-400/40'}`}
                                    placeholder="+267 71 234 567"
                                    required
                                />
                                {lookupMatch && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-amber-700 bg-white/80 px-2 py-0.5 rounded-lg border border-amber-100 shadow-sm animate-in fade-in zoom-in duration-200">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Matched</span>
                                    </div>
                                )}
                            </div>
                            {lookupMatch && (
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                                    <div className="p-2 bg-white rounded-lg border border-amber-200 shadow-sm">
                                        <Link2 className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Existing Participant Found</p>
                                        <p className="text-sm text-amber-800">
                                            {lookupMatch.type === 'profile' ? 'This user has a self-registered account.' : 'Already registered in the system.'}
                                        </p>
                                        <p className="text-xs text-amber-600 font-medium mt-0.5">Submitting will link this participant to your group.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <input
                                    type="number"
                                    value={regForm.age}
                                    onChange={e => setRegForm(p => ({ ...p, age: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                <select
                                    value={regForm.gender}
                                    onChange={e => setRegForm(p => ({ ...p, gender: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white"
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                                <select
                                    value={regForm.education}
                                    onChange={e => setRegForm(p => ({ ...p, education: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white"
                                >
                                    <option value="">Select Education</option>
                                    <option value="Primary">Primary</option>
                                    <option value="Junior Secondary">Junior Secondary</option>
                                    <option value="Senior Secondary">Senior Secondary</option>
                                    <option value="Vocational">Vocational</option>
                                    <option value="Tertiary">Tertiary</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                                <select
                                    value={regForm.marital_status}
                                    onChange={e => setRegForm(p => ({ ...p, marital_status: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white"
                                >
                                    <option value="">Select Status</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Widowed">Widowed</option>
                                    <option value="Cohabiting">Cohabiting</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation (e.g. Church, School)</label>
                                <input
                                    type="text"
                                    value={regForm.affiliation}
                                    onChange={e => setRegForm(p => ({ ...p, affiliation: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                    placeholder="Organization name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                                <input
                                    type="text"
                                    value={regForm.occupation}
                                    onChange={e => setRegForm(p => ({ ...p, occupation: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                    placeholder="e.g. Teacher, Farmer"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Village / Site Name</label>
                            <input
                                type="text"
                                value={regForm.place}
                                onChange={e => setRegForm(p => ({ ...p, place: e.target.value }))}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                placeholder="Location"
                            />
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
                            className={`w-full rounded-xl text-white font-bold px-4 py-3 disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${lookupMatch ? 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'}`}
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : lookupMatch ? (
                                <>
                                    <Link2 className="h-5 w-5" />
                                    Link Existing Participant
                                </>
                            ) : (
                                <>
                                    <UserPlus className="h-5 w-5" />
                                    Register New Participant
                                </>
                            )}
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
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Books Given</label>
                                            <button
                                                onClick={() => toggleBookReceived(p.uuid)}
                                                className={`p-2 rounded-lg border transition-all ${p.books_received
                                                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                                                    : "bg-gray-50 border-gray-100 text-gray-300 hover:border-gray-200"
                                                    }`}
                                                title={p.books_received ? "Book Given" : "Mark as Given"}
                                            >
                                                <Check className={`h-5 w-5 ${p.books_received ? "opacity-100" : "opacity-30"}`} />
                                            </button>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                                            <p className="text-sm text-gray-500 flex items-center justify-end gap-1">
                                                <Phone className="h-3.5 w-3.5" />
                                                {p.contact || "No phone"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-400 font-medium">
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
                                            <div className="text-left flex items-center gap-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleBookReceived(p.uuid);
                                                    }}
                                                    className={`p-2 rounded-lg border transition-all ${p.books_received
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                                                        : "bg-gray-50 border-gray-100 text-gray-300 hover:border-gray-200"
                                                        }`}
                                                    title={p.books_received ? "Book Given" : "Mark as Given"}
                                                >
                                                    <Check className={`h-5 w-5 ${p.books_received ? "opacity-100" : "opacity-30"}`} />
                                                </button>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                                                    <p className="text-sm text-gray-500">{attended}/{TOTAL_DAYS} days attended</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="hidden sm:block w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
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
                                                            {present ? <Check className="h-3 w-3 mt-0.5" /> : <XCircle className="h-3 w-3 mt-0.5 opacity-30" />}
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
