import React from 'react';
import { useEffect, useState } from 'react';
import { db } from '../lib/dexieDb';
import { Database, ArrowLeft, UserPlus, Users, Briefcase, HelpCircle, ChevronRight, User } from 'lucide-react';
import RegistrationForm from './RegistrationForm';

const OfflineCollect = ({ onBack }) => {
    // State for navigation flow
    // view: 'menu' | 'pre-reg' | 'participant-check' | 'form'
    const [view, setView] = useState('menu');
    const [pendingCount, setPendingCount] = useState(0);

    // Selection state
    const [selection, setSelection] = useState({
        type: null, // 'facilitator', 'participant'
        inGroup: false // boolean
    });

    useEffect(() => {
        updatePendingCount();
        window.addEventListener('hff-supabase-sync-complete', updatePendingCount);
        return () => window.removeEventListener('hff-supabase-sync-complete', updatePendingCount);
    }, []);

    const updatePendingCount = async () => {
        try {
            const count = await db.registrations
                .where('sync_status')
                .equals('pending')
                .count();
            setPendingCount(count);
        } catch (err) {
            console.error("Error counting pending:", err);
        }
    };

    // Navigation Handlers
    const handlePreRegClick = () => setView('pre-reg');
    const handleFacilitatorClick = () => {
        setSelection({ type: 'facilitator', inGroup: false });
        setView('form');
    };
    const handleParticipantClick = () => {
        setSelection({ type: 'participant', inGroup: false }); // Default, helps logic
        setView('participant-check');
    };

    const handlePreRegSubClick = (subType) => {
        // subType is 'participant' or 'facilitator'
        if (subType === 'participant') {
            setSelection({ type: 'participant', inGroup: false });
            setView('participant-check');
        } else {
            setSelection({ type: 'facilitator', inGroup: false });
            setView('form');
        }
    };

    const handleGroupCheck = (isInGroup) => {
        setSelection(prev => ({ ...prev, inGroup: isInGroup }));
        setView('form');
    };

    const goBack = () => {
        if (view === 'form') {
            if (selection.type === 'participant') setView('participant-check');
            else if (selection.type === 'facilitator' && view === 'pre-reg') setView('pre-reg'); // Logic simplification
            else setView('menu');
        } else if (view === 'pre-reg' || view === 'participant-check') {
            setView('menu');
        } else {
            onBack(); // Exit offline mode
        }
    };

    // Reusable Card Component
    const OptionCard = ({ icon: Icon, title, desc, onClick, colorClass = "text-hff-primary" }) => (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:scale-105 transition-all duration-300 group h-full w-full text-center"
        >
            <div className={`p-4 rounded-full bg-gray-50 mb-4 group-hover:bg-hff-primary/10 transition-colors ${colorClass}`}>
                <Icon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
            {desc && <p className="text-sm text-gray-500 px-2">{desc}</p>}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-hff-primary transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                    {view === 'menu' ? 'Back to Home' : 'Back'}
                </button>
                <div className="flex items-center gap-2 bg-hff-primary/10 text-hff-primary px-3 py-1 rounded-full text-sm font-semibold">
                    <Database className="h-4 w-4" />
                    {pendingCount} Pending Sync
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
                <div className="bg-hff-primary p-6 text-white text-center shrink-0">
                    <h2 className="text-2xl font-bold">Offline Data Collection</h2>
                    <p className="text-hff-primary-light opacity-90">Collect participant data without internet.</p>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                    {/* View: Menu (3 Cards) */}
                    {view === 'menu' && (
                        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-xl font-semibold text-center mb-8 text-gray-800">Select Registration Type</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <OptionCard
                                    icon={UserPlus}
                                    title="Pre-registering"
                                    desc="Register new users or facilitators"
                                    onClick={handlePreRegClick}
                                />
                                <OptionCard
                                    icon={Briefcase}
                                    title="Facilitator"
                                    desc="Log data as a Facilitator"
                                    onClick={handleFacilitatorClick}
                                />
                                <OptionCard
                                    icon={Users}
                                    title="Participant"
                                    desc="Log data as a Participant"
                                    onClick={handleParticipantClick}
                                />
                            </div>
                        </div>
                    )}

                    {/* View: Pre-Register Selection (2 Cards) */}
                    {view === 'pre-reg' && (
                        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-8 duration-300">
                            <h3 className="text-xl font-semibold text-center mb-8 text-gray-800">Who are you pre-registering?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto w-full">
                                <OptionCard
                                    icon={User}
                                    title="Participant"
                                    desc="Register a new participant"
                                    onClick={() => handlePreRegSubClick('participant')}
                                />
                                <OptionCard
                                    icon={Briefcase}
                                    title="Facilitator"
                                    desc="Register a new facilitator"
                                    onClick={() => handlePreRegSubClick('facilitator')}
                                />
                            </div>
                        </div>
                    )}

                    {/* View: Participant Group Check */}
                    {view === 'participant-check' && (
                        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-4 bg-purple-50 rounded-full mb-4 text-hff-primary">
                                    <HelpCircle className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Is the participant in a group?</h3>
                                <p className="text-gray-500 mt-2">Please confirm if this participant is part of an active group.</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => handleGroupCheck(true)}
                                    className="w-full p-4 border-2 border-hff-primary/20 hover:border-hff-primary hover:bg-hff-primary/5 rounded-xl flex items-center justify-between group transition-all"
                                >
                                    <span className="font-semibold text-lg text-gray-700 group-hover:text-hff-primary">Yes, in a group</span>
                                    <ChevronRight className="text-gray-400 group-hover:text-hff-primary" />
                                </button>
                                <button
                                    onClick={() => handleGroupCheck(false)}
                                    className="w-full p-4 border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 rounded-xl flex items-center justify-between group transition-all"
                                >
                                    <span className="font-semibold text-lg text-gray-700">No, individual</span>
                                    <ChevronRight className="text-gray-400" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* View: Form */}
                    {view === 'form' && (
                        <RegistrationForm
                            type={selection.type}
                            inGroup={selection.inGroup}
                            onBack={() => setView('menu')}
                            onSaveSuccess={updatePendingCount}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineCollect;
