import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexieDb';
import { AlertCircle, User, UserCheck, Edit3, ChevronRight, Search, Filter, Info, Phone, MapPin, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';
import RegistrationForm from './RegistrationForm';

const DataIntegrity = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRecord, setEditingRecord] = useState(null);
    const [viewingFacilitator, setViewingFacilitator] = useState(null);
    const [filterType, setFilterType] = useState('all'); // 'all', 'participant', 'facilitator'
    const [auditMode, setAuditMode] = useState('incomplete'); // 'incomplete' | 'duplicates'

    const registrations = useLiveQuery(() => db.registrations.toArray()) || [];

    // Helper to find missing fields
    const getMissingFields = (rec) => {
        const missing = [];
        const commonFields = ['first_name', 'last_name', 'age', 'gender', 'contact', 'place', 'education', 'marital_status'];
        
        commonFields.forEach(f => {
            if (!rec[f] || rec[f] === '') missing.push(f.replace('_', ' '));
        });

        if (rec.type === 'facilitator') {
            if (rec.participants_count === null || rec.participants_count === undefined) missing.push('participants count');
            // books_distributed could be 0, so check for null/undefined
            if (rec.books_distributed === null || rec.books_distributed === undefined) missing.push('books distributed');
        }

        return missing;
    };

    const incompleteRecords = useMemo(() => {
        return registrations
            .filter(rec => {
                const missing = getMissingFields(rec);
                if (missing.length === 0) return false;

                if (filterType !== 'all' && rec.type !== filterType) return false;

                if (searchTerm) {
                    const fullName = `${rec.first_name} ${rec.last_name}`.toLowerCase();
                    return fullName.includes(searchTerm.toLowerCase());
                }

                return true;
            })
            .map(rec => ({
                ...rec,
                missingFields: getMissingFields(rec)
            }));
    }, [registrations, searchTerm, filterType]);

    // Logic to identify duplicate groups
    const duplicateGroups = useMemo(() => {
        const groups = new Map();
        
        registrations.forEach(rec => {
            // Normalize name for comparison
            const fn = (rec.first_name || '').trim().toLowerCase();
            const ln = (rec.last_name || '').trim().toLowerCase();
            
            // Skip placeholders
            if (fn.length < 2 || ln.length < 2 || fn === '.' || ln === '.') return;

            // Group by Name + Gender + Age (Strong match)
            const key = `${fn}|${ln}|${rec.gender || 'none'}|${rec.age || 'none'}`;
            
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(rec);
        });

        // Only return groups with more than 1 record
        return Array.from(groups.values())
            .filter(group => group.length > 1)
            .filter(group => {
                if (filterType !== 'all') {
                    return group.some(r => r.type === filterType);
                }
                return true;
            })
            .filter(group => {
                if (!searchTerm) return true;
                const rec = group[0];
                const fullName = `${rec.first_name} ${rec.last_name}`.toLowerCase();
                return fullName.includes(searchTerm.toLowerCase());
            });
    }, [registrations, searchTerm, filterType]);

    const handleEdit = (record) => {
        setEditingRecord(record);
    };

    const handleViewFacilitator = async (uuid) => {
        if (!uuid) return;
        const fac = await db.registrations.where('uuid').equals(uuid).first();
        if (fac) {
            setViewingFacilitator(fac);
        } else {
            alert("Facilitator record not found in local storage.");
        }
    };

    const handleMerge = async (group) => {
        if (!group || group.length < 2) return;
        
        const winner = { ...group[0] };
        const losers = group.slice(1);
        
        try {
            // 1. Merge Strategy: Combine Attendance & Fill Gaps
            losers.forEach(loser => {
                // Merge attendance (Logical OR across all days)
                if (loser.attendance) {
                    if (!winner.attendance) winner.attendance = [];
                    // Ensure attendance is treated as an array of booleans (common in this app)
                    const winnerAtt = Array.isArray(winner.attendance) ? winner.attendance : [];
                    const loserAtt = Array.isArray(loser.attendance) ? loser.attendance : [];
                    
                    winner.attendance = winnerAtt.map((val, idx) => val || loserAtt[idx] || false);
                }
                
                // Fill missing fields from losers
                const fields = ['age', 'gender', 'contact', 'place', 'education', 'marital_status', 'affiliation', 'occupation', 'facilitator_uuid', 'books_received'];
                fields.forEach(f => {
                    if ((winner[f] === null || winner[f] === undefined || winner[f] === '') && loser[f]) {
                        winner[f] = loser[f];
                    }
                });
            });

            // 2. Metadata updates for Winner
            winner.updated_at = new Date().toISOString();
            winner.sync_status = 'pending';

            // 3. Mark Losers for Deletion on Cloud
            const deletedLosers = losers.map(l => ({
                ...l,
                is_deleted: true,
                sync_status: 'pending',
                updated_at: new Date().toISOString()
            }));

            // 4. Atomic Transaction: Local Update + Local Deletion Queue
            await db.transaction('rw', db.registrations, async () => {
                // Update winner
                await db.registrations.put(winner);
                
                // Instead of bulkDelete (which is local only), we update them to 'pending deletion'
                // The sync engine will then push 'is_deleted: true' to Supabase.
                for (const loser of deletedLosers) {
                    await db.registrations.put(loser);
                }
            });

            console.log(`Successfully merged ${group.length} records into ${winner.uuid}. Sync pending...`);
            
            // Trigger a background sync if possible
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('hff-trigger-sync'));
            }

        } catch (err) {
            console.error("Merge failed:", err);
            alert("Failed to merge records. See console for details.");
        }
    };

    if (editingRecord) {
        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                    <button 
                        onClick={() => setEditingRecord(null)}
                        className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 flex items-center gap-2"
                    >
                        <ChevronRight className="rotate-180" size={14} /> Back to Audit
                    </button>
                    <h2 className="text-xl font-black text-gray-900 uppercase">Repairing Record</h2>
                </div>
                <RegistrationForm 
                    type={editingRecord.type}
                    initialData={editingRecord}
                    onBack={() => setEditingRecord(null)}
                    onSaveSuccess={() => setEditingRecord(null)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-2 p-1.5 bg-gray-100/50 self-start rounded-2xl border border-gray-100 shadow-sm w-fit mb-4">
                <button
                    onClick={() => setAuditMode('incomplete')}
                    className={cn(
                        "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        auditMode === 'incomplete'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    Incomplete ({incompleteRecords.length})
                </button>
                <button
                    onClick={() => setAuditMode('duplicates')}
                    className={cn(
                        "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        auditMode === 'duplicates'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    Duplicates ({duplicateGroups.length})
                </button>
            </div>

            {/* Deficiency Scorecard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-red-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                                {auditMode === 'incomplete' ? 'Deficient Records' : 'Duplicate Groups'}
                            </p>
                            <h3 className="text-2xl font-black text-gray-900 leading-none">
                                {auditMode === 'incomplete' ? incompleteRecords.length : duplicateGroups.length}
                            </h3>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 border-l-4 border-blue-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <User size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Database</p>
                            <h3 className="text-2xl font-black text-gray-900 leading-none">
                                {registrations.length}
                            </h3>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 border-l-4 border-amber-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <Briefcase size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Facilitators</p>
                            <h3 className="text-2xl font-black text-gray-900 leading-none">
                                {registrations.filter(r => r.type === 'facilitator').length}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Audit records by name..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-[#71167F]/20 focus:border-[#71167F] outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    {['all', 'participant', 'facilitator'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                filterType === type
                                    ? "bg-gray-900 text-white"
                                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {type}s
                        </button>
                    ))}
                </div>
            </div>

            {/* Faciliator Quick View Overlay */}
            {viewingFacilitator && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5">
                            <User size={150} className="text-[#71167F]" />
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 bg-[#71167F] text-white rounded-[1.5rem] flex items-center justify-center text-2xl font-black">
                                    {viewingFacilitator.first_name[0]}{viewingFacilitator.last_name[0]}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 uppercase leading-none">
                                        {viewingFacilitator.first_name} {viewingFacilitator.last_name}
                                    </h3>
                                    <p className="text-[#3EB049] font-bold text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
                                        <UserCheck size={14} /> Verified Facilitator
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Affiliation</p>
                                    <p className="text-sm font-bold text-gray-700">{viewingFacilitator.affiliation || 'Unassigned'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Contact</p>
                                    <p className="text-sm font-bold text-gray-700">{viewingFacilitator.contact || 'No Phone'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Managed Pax</p>
                                    <p className="text-sm font-bold text-gray-700">{viewingFacilitator.participants_count || 0}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Location</p>
                                    <p className="text-sm font-bold text-gray-700">{viewingFacilitator.place || 'Unknown'}</p>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button 
                                    onClick={() => setViewingFacilitator(null)}
                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-[#71167F] transition-all active:scale-95"
                                >
                                    Dismiss Profile
                                </button>
                                <button 
                                    onClick={() => {
                                        setEditingRecord(viewingFacilitator);
                                        setViewingFacilitator(null);
                                    }}
                                    className="w-full py-4 mt-2 text-[#71167F] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-50 rounded-2xl transition-all"
                                >
                                    Full Edit Mode
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit List */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {auditMode === 'incomplete' ? (
                    incompleteRecords.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[3rem] border border-gray-100 flex flex-col items-center justify-center text-center shadow-sm">
                            <div className="h-20 w-20 bg-green-50 text-[#3EB049] rounded-3xl flex items-center justify-center mb-6">
                                <UserCheck size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase">Data Stream Pristine</h3>
                            <p className="text-gray-400 text-sm mt-2 font-medium">All records meet the completeness criteria.</p>
                        </div>
                    ) : (
                        incompleteRecords.map((rec) => (
                            <div key={rec.uuid} className="glass-card p-8 group hover:shadow-2xl hover:shadow-[#71167F]/5 transition-all duration-500 border-white/50 relative overflow-hidden">
                                <div className={cn(
                                    "absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest",
                                    rec.type === 'facilitator' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                )}>
                                    {rec.type}
                                </div>

                                <div className="flex justify-between items-start gap-4 mb-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg",
                                            rec.type === 'facilitator' ? "bg-amber-500 shadow-amber-500/20" : "hff-gradient-bg shadow-[#71167F]/20"
                                        )}>
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-gray-900 uppercase leading-none">
                                                {rec.first_name || '??'} {rec.last_name || '??'}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-2 text-gray-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                    <MapPin size={10} /> {rec.place || 'Location Missing'}
                                                </span>
                                                {rec.contact && (
                                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                        <Phone size={10} /> {rec.contact}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleEdit(rec)}
                                        className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-[#71167F] hover:text-white transition-all shadow-sm group/btn"
                                    >
                                        <Edit3 size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                </div>

                                {/* Missing Fields Indicator */}
                                <div className="space-y-3 mb-6 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="text-red-500" size={14} />
                                        <span className="text-[9px] font-black text-red-500/80 uppercase tracking-widest">Deficient Fields</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {rec.missingFields.map(field => (
                                            <span key={field} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-red-100/50">
                                                {field}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-gray-50 relative z-10">
                                    <div className="flex items-center gap-4">
                                        {rec.type === 'participant' && rec.facilitator_uuid ? (
                                            <button 
                                                onClick={() => handleViewFacilitator(rec.facilitator_uuid)}
                                                className="flex items-center gap-2 group/fac"
                                            >
                                                <div className="p-2 bg-[#3EB049]/10 text-[#3EB049] rounded-lg">
                                                    <UserCheck size={12} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Facilitator</p>
                                                    <p className="text-[9px] font-bold text-[#3EB049] uppercase group-hover/fac:underline">View Link</p>
                                                </div>
                                            </button>
                                        ) : rec.type === 'participant' ? (
                                            <div className="flex items-center gap-2 opacity-30">
                                                <div className="p-2 bg-gray-100 text-gray-400 rounded-lg">
                                                    <UserCheck size={12} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Facilitator</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Not Linked</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                                    <Briefcase size={12} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Capacity</p>
                                                    <p className="text-[9px] font-bold text-amber-600 uppercase">{rec.participants_count || 0} Participants</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => handleEdit(rec)}
                                        className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#71167F] hover:gap-3 transition-all"
                                    >
                                        Repair Now <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                ) : (
                    duplicateGroups.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[3rem] border border-gray-100 flex flex-col items-center justify-center text-center shadow-sm">
                            <div className="h-20 w-20 bg-green-50 text-[#3EB049] rounded-3xl flex items-center justify-center mb-6">
                                <UserCheck size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase">Database Decoupled</h3>
                            <p className="text-gray-400 text-sm mt-2 font-medium">No strong duplicate groups identified.</p>
                        </div>
                    ) : (
                        duplicateGroups.map((group, idx) => (
                            <div key={idx} className="glass-card p-8 border-l-4 border-[#71167F] relative overflow-hidden bg-white/40">
                                <div className="absolute top-0 right-0 px-4 py-1 bg-[#71167F] text-white text-[8px] font-black uppercase tracking-widest rounded-bl-2xl">
                                    {group.length} Duplicates
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-lg font-black text-gray-900 uppercase">
                                        {group[0].first_name} {group[0].last_name}
                                    </h4>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                        {group[0].gender} • Age {group[0].age || '??'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {group.map(rec => (
                                        <div key={rec.uuid} className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-gray-50 group hover:border-[#71167F]/20 transition-all">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">UUID:</span>
                                                    <span className="text-[10px] font-mono font-medium text-gray-600">...{rec.uuid?.slice(-8)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter flex items-center gap-1">
                                                        <MapPin size={10} /> {rec.place || 'Unknown'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter flex items-center gap-1">
                                                        <User size={10} /> {rec.facilitator_uuid ? 'Linked' : 'No Link'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleEdit(rec)}
                                                    className="p-2 text-gray-400 hover:text-[#71167F] transition-colors"
                                                    title="Edit individual"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(confirm(`Are you sure you want to delete this duplicate (UUID ends in ...${rec.uuid?.slice(-8)})?`)) {
                                                            db.registrations.delete(rec.id);
                                                        }
                                                    }}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                    title="Delete duplicate"
                                                >
                                                    <ChevronRight className="rotate-90" size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-50 flex justify-end items-center gap-4">
                                    <p className="text-[10px] font-black text-[#3EB049] uppercase italic">
                                        Data Integrity Verified
                                    </p>
                                    <button 
                                        onClick={() => {
                                            if(confirm(`Merge ${group.length} duplicate records for ${group[0].first_name}? This will combine attendance and preserve all metadata.`)) {
                                                handleMerge(group);
                                            }
                                        }}
                                        className="px-6 py-2 bg-gray-900 text-white hover:bg-[#71167F] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        Smart Merge
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

export default DataIntegrity;
