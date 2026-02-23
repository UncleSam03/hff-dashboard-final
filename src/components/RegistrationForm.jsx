import React, { useState, useEffect } from 'react';
import { db } from '../lib/dexieDb';

import { Save, Search, User, CheckCircle2, AlertCircle } from 'lucide-react';

const RegistrationForm = ({ type, onBack, onSaveSuccess, inGroup }) => {
    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        age: '',
        gender: '',
        contact: '',
        place: '',
        education: '',
        maritalStatus: '',
        participantsCount: 1,
        booksDistributed: 0,
    });

    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [facilitatorResults, setFacilitatorResults] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState(null);

    // Search for Facilitators (local Dexie search)
    useEffect(() => {
        const searchFacilitators = async () => {
            if (searchTerm.length < 2) {
                setFacilitatorResults([]);
                return;
            }

            try {
                // Case-insensitive search on first_name OR last_name
                // Dexie's below() / startsWithIgnoreCase() etc might differ based on indexing.
                // Simple filter is robust for small offline datasets.
                const results = await db.registrations
                    .where('type').equals('facilitator')
                    .filter(rec => {
                        const fullName = `${rec.first_name} ${rec.last_name}`.toLowerCase();
                        return fullName.includes(searchTerm.toLowerCase());
                    })
                    .toArray();
                setFacilitatorResults(results);
            } catch (err) {
                console.error("Search error:", err);
            }
        };

        const debounce = setTimeout(searchFacilitators, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            // Validation
            if (!formData.firstName || !formData.lastName || !formData.age || !formData.gender) {
                throw new Error("Please fill in all required fields.");
            }

            if (type === 'participant' && inGroup && !selectedFacilitator) {
                throw new Error("Please select a facilitator or switch to 'Individual' if not in a group.");
            }

            // Construct Payload
            const newRecord = {
                id: self.crypto.randomUUID(),
                uuid: self.crypto.randomUUID(), // Consistency with other tables if needed
                first_name: formData.firstName,
                last_name: formData.lastName,
                age: parseInt(formData.age),
                gender: formData.gender,
                contact: formData.contact,
                place: formData.place,
                education: formData.education,
                marital_status: formData.maritalStatus,
                type: type, // 'facilitator' or 'participant'
                // Facilitator specific
                participants_count: type === 'facilitator' ? parseInt(formData.participantsCount) : null,
                books_distributed: type === 'facilitator' ? parseInt(formData.booksDistributed) : null,
                // Participant specific
                facilitator_uuid: (type === 'participant' && inGroup && selectedFacilitator) ? selectedFacilitator.uuid : null,

                // Metadata
                source: 'pwa_offline',
                sync_status: 'pending',
                created_at: new Date().toISOString(),
            };

            // Save to Dexie
            await db.registrations.add(newRecord);

            // Success
            setMessage({ type: 'success', text: 'Saved to Device (Will sync when online).' });

            // Reset Form
            setFormData({
                firstName: '',
                lastName: '',
                age: '',
                gender: '',
                contact: '',
                place: '',
                education: '',
                maritalStatus: '',
                participantsCount: 1,
                booksDistributed: 0,
            });
            setSelectedFacilitator(null);
            setSearchTerm('');

            // Notify Parent
            if (onSaveSuccess) setTimeout(onSaveSuccess, 1500); // Give user time to see toast

        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to save record.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">
                        {type === 'facilitator' ? 'Facilitator Registration' : 'Participant Registration'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {type === 'participant' && inGroup ? 'Registering as part of a group' : 'Standard offline entry'}
                    </p>
                </div>
                <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    Cancel
                </button>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* --- Facilitator Search (Only for Participants in Group) --- */}
                {type === 'participant' && inGroup && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <label className="block text-sm font-semibold text-purple-900 mb-2">
                            Link to Facilitator <span className="text-red-500">*</span>
                        </label>

                        {!selectedFacilitator ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search facilitator by name..."
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {facilitatorResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
                                        {facilitatorResults.map(fac => (
                                            <button
                                                key={fac.uuid}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFacilitator(fac);
                                                    setSearchTerm('');
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center gap-3 transition-colors"
                                            >
                                                <div className="bg-purple-100 p-2 rounded-full">
                                                    <User className="h-4 w-4 text-purple-700" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{fac.first_name} {fac.last_name}</div>
                                                    <div className="text-xs text-gray-500">{fac.place || 'No location'}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-full">
                                        <CheckCircle2 className="h-4 w-4 text-green-700" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">{selectedFacilitator.first_name} {selectedFacilitator.last_name}</div>
                                        <div className="text-xs text-gray-500">Selected Facilitator</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFacilitator(null)}
                                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                                >
                                    Change
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Common Fields --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                        <input
                            required
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="e.g. John"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                        <input
                            required
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="e.g. Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Age <span className="text-red-500">*</span></label>
                        <input
                            required
                            type="number"
                            name="age"
                            min="1"
                            max="120"
                            value={formData.age}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Age"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                        <select
                            required
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
                        >
                            <option value="">Select Gender</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                        <select
                            name="education"
                            value={formData.education}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
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
                            name="maritalStatus"
                            value={formData.maritalStatus}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all bg-white"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone / Contact</label>
                        <input
                            type="tel"
                            name="contact"
                            value={formData.contact}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Mobile Number"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Village / Site Name</label>
                        <input
                            type="text"
                            name="place"
                            value={formData.place}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                            placeholder="Location"
                        />
                    </div>
                </div>

                {/* --- Facilitator Specific Fields --- */}
                {type === 'facilitator' && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Facilitator Logistics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No. of Participants</label>
                                <input
                                    type="number"
                                    name="participantsCount"
                                    min="1"
                                    value={formData.participantsCount}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Books Given</label>
                                <input
                                    type="number"
                                    name="booksDistributed"
                                    min="0"
                                    value={formData.booksDistributed}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-hff-primary/50 focus:border-hff-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-hff-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-hff-primary/90 transition-all shadow-lg shadow-hff-primary/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <Save className="h-5 w-5" />
                        {isSubmitting ? 'Saving...' : 'Save Registration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
