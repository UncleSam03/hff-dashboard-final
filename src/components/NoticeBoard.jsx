import React from 'react';
import { Megaphone, ArrowRight } from 'lucide-react';

const NOTICES = [
    { id: 1, title: 'Maun Site Visit', date: 'Oct 14', type: 'Event' },
    { id: 2, title: 'New Attendance Rules', date: 'Oct 12', type: 'Policy' },
    { id: 3, title: 'Server Maintenance (2 AM)', date: 'Oct 10', type: 'Update' },
];

const NoticeBoard = () => {
    return (
        <div className="glass-card p-6 h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-black text-gray-900">Notice Board</h2>
                </div>
                <button className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-hff-primary transition-colors">
                    <ArrowRight className="h-4 w-4" />
                </button>
            </div>

            <div className="space-y-4">
                {NOTICES.map((notice) => (
                    <div key={notice.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-white bg-gray-300 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                {notice.type}
                            </span>
                            <span className="text-sm font-bold text-gray-700 group-hover:text-hff-primary transition-colors">
                                {notice.title}
                            </span>
                        </div>
                        <span className="text-xs font-black text-gray-300 uppercase tracking-widest">{notice.date}</span>
                    </div>
                ))}
            </div>
            
            <button className="w-full mt-6 py-3 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:border-hff-primary/20 hover:text-hff-primary transition-all">
                Post Announcement
            </button>
        </div>
    );
};

export default NoticeBoard;
