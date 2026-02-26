import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, StickyNote, Save } from 'lucide-react';

const NotesView = ({ onBack }) => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const resp = await fetch('/api/notes');
            const data = await resp.json();
            setNotes(data);
        } catch (err) {
            console.error("Failed to fetch notes:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        try {
            const resp = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newNote })
            });
            if (resp.ok) {
                const added = await resp.json();
                setNotes([added, ...notes]);
                setNewNote("");
            }
        } catch (err) {
            console.error("Failed to add note:", err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-hff-primary transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                    Back to Home
                </button>
                <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-sm font-semibold">
                    <StickyNote className="h-4 w-4" />
                    Supabase Notes Lab
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white">
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <StickyNote className="h-8 w-8" />
                        Campaign Notes
                    </h2>
                    <p className="opacity-90">Quick research and field notes synced directly to Supabase.</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleAddNote} className="mb-10">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Write a quick note..."
                                className="flex-1 rounded-2xl border border-gray-200 px-6 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                            />
                            <button
                                type="submit"
                                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                            >
                                <Plus className="h-5 w-5" />
                                Add Note
                            </button>
                        </div>
                    </form>

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {notes.length === 0 ? (
                                <div className="col-span-full text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                    <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No notes yet. Start recording insights!</p>
                                </div>
                            ) : (
                                notes.map((note) => (
                                    <div key={note.id} className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative">
                                        <p className="text-gray-800 line-clamp-3 mb-4">{note.content}</p>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="text-xs text-gray-400">
                                                {new Date(note.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotesView;
