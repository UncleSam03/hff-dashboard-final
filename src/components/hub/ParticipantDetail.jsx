import React from 'react';
import { ArrowLeft, User, MapPin, CalendarDays, Activity, Briefcase, Heart, BookOpen, GraduationCap, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const ParticipantDetail = ({ participant, onBack, onNavigateToAttendance }) => {

    const safeFormatTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    };

    const getInitials = (first, last) => {
        return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || 'P';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-24">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row gap-6 justify-between md:items-end">
                <div className="space-y-6">
                    <button
                        onClick={onBack}
                        className="flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#71167F] transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                    {onNavigateToAttendance && (
                        <button
                            onClick={() => onNavigateToAttendance(participant)}
                            className="flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm mt-3"
                        >
                            <CalendarDays size={14} /> Mark Attendance
                        </button>
                    )}

                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#3EB049] to-[#2A8233] text-white flex items-center justify-center shadow-xl shadow-[#3EB049]/30 text-3xl font-black shrink-0 relative overflow-hidden">
                            {getInitials(participant.first_name, participant.last_name)}
                            <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                {participant.first_name} {participant.last_name}
                                {participant.sync_status === 'synced' && (
                                    <CheckCircle className="text-green-500 h-5 w-5" title="Cloud Synced" />
                                )}
                            </h2>
                            <p className="text-xs font-black text-[#3EB049] uppercase tracking-widest mt-2 flex items-center gap-2">
                                Participant Profile • Registered {safeFormatTime(participant.created_at).split(',')[0]}
                            </p>
                        </div>
                    </div>
                </div>

                {participant.facilitatorName && (
                    <div className="bg-white p-4 rounded-2xl border border-[#71167F]/10 shadow-sm flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-[#71167F]/10 text-[#71167F] flex items-center justify-center shrink-0">
                            <Briefcase size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Assigned Facilitator</p>
                            <p className="text-sm font-black text-gray-900">{participant.facilitatorName}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Profile Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Core Demographics Card */}
                <div className="glass-card p-6 md:col-span-2 space-y-8">
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                        <User className="text-[#3EB049]" size={20} />
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Core Demographics</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-8 gap-x-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gender</p>
                            <p className="text-base font-black text-gray-900">
                                {participant.gender === 'M' ? 'Male' : participant.gender === 'F' ? 'Female' : (participant.gender || 'Not specified')}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Age</p>
                            <p className="text-base font-black text-gray-900">
                                {participant.age ? `${participant.age} Years` : 'Unknown'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Location</p>
                            <p className="text-base font-black text-gray-900 flex items-center gap-1.5 line-clamp-2">
                                <MapPin size={14} className="text-gray-300" />
                                {participant.place || 'Not specified'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Education Level</p>
                            <p className="text-base font-black text-gray-900 flex items-center gap-1.5">
                                <GraduationCap size={14} className="text-gray-300" />
                                {participant.education || 'Not recorded'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Marital Status</p>
                            <p className="text-base font-black text-gray-900 flex items-center gap-1.5">
                                <Heart size={14} className="text-gray-300" />
                                {participant.marital_status || 'Not recorded'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Occupation</p>
                            <p className="text-base font-black text-gray-900 flex items-center gap-1.5">
                                <Briefcase size={14} className="text-gray-300" />
                                {participant.occupation || 'Not recorded'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Campaign Activity Card */}
                <div className="glass-card p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                        <Activity className="text-blue-500" size={20} />
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Campaign Data</h3>
                    </div>

                    <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <BookOpen size={12} /> Book Received
                        </p>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                    participant.books_received ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                                )}>
                                    {participant.books_received ? <CheckCircle size={16} /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                                </div>
                                <span className="font-black text-gray-900 text-sm">
                                    {participant.books_received ? "Yes, Received" : "Not yet distributed"}
                                </span>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        await db.registrations.update(participant.id, {
                                            books_received: !participant.books_received,
                                            sync_status: 'pending',
                                            updated_at: new Date().toISOString()
                                        });
                                    } catch (err) {
                                        console.error("Book update failed:", err);
                                    }
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    participant.books_received ? "bg-gray-100 text-gray-500" : "bg-[#71167F] text-white shadow-lg shadow-[#71167F]/20"
                                )}
                            >
                                {participant.books_received ? "Undo" : "Mark Received"}
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <CalendarDays size={12} /> Attendance Record
                        </p>
                        {participant.attendance && (Array.isArray(participant.attendance) ? participant.attendance.some(Boolean) : Object.values(participant.attendance).some(Boolean)) ? (
                            <div className="flex flex-wrap gap-2">
                                {Array.isArray(participant.attendance) 
                                    ? participant.attendance.map((present, i) => present && (
                                        <div key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black border border-blue-100 shadow-sm">
                                            Day {i + 1}
                                        </div>
                                    ))
                                    : Object.entries(participant.attendance).map(([day, present]) => present && (
                                        <div key={day} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black border border-blue-100 shadow-sm">
                                            {day.replace('D', 'Day ')}
                                        </div>
                                    ))
                                }
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 font-bold">No days recorded</p>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Clock size={12} /> Last Updated
                        </p>
                        <p className="text-xs font-bold text-gray-600">
                            {safeFormatTime(participant.updated_at || participant.created_at)}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                            <div className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                participant.sync_status === 'synced' ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                                {participant.sync_status === 'synced' ? 'Synchronized' : 'Sync Pending'}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ParticipantDetail;
