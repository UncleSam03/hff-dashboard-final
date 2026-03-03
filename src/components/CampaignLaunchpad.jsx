import React from 'react';
import { Smartphone, LayoutGrid, MapPin, BarChart3, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

const LAUNCH_CARDS = [
    {
        id: 'collect',
        title: 'Offline Collect',
        description: 'Capture participant data offline in the field.',
        icon: Smartphone,
        color: 'purple',
        badge: 'Mobile Ready'
    },
    {
        id: 'hub',
        title: 'Campaign Hub',
        description: 'Global campaign management & coordination tools.',
        icon: LayoutGrid,
        color: 'green',
        badge: 'Management'
    },
    {
        id: 'phikwe',
        title: 'Phikwe Campaign',
        description: 'Real-time sync status for active local campaign.',
        icon: MapPin,
        color: 'blue',
        badge: 'Syncing Live',
        isActive: true
    },
    {
        id: 'analysis',
        title: 'General Analysis',
        description: 'Batch file uploads and advanced data processing.',
        icon: BarChart3,
        color: 'amber',
        badge: 'Deep Dive'
    }
];

const CampaignLaunchpad = ({ onCardClick }) => {
    const getColors = (color) => {
        switch (color) {
            case 'green': return 'text-green-600 bg-green-50 border-green-100 hover:border-green-300';
            case 'blue': return 'text-blue-600 bg-blue-50 border-blue-100 hover:border-blue-300';
            case 'amber': return 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300';
            default: return 'text-hff-primary bg-hff-primary/5 border-hff-primary/10 hover:border-hff-primary/30';
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {LAUNCH_CARDS.map((card) => {
                const colors = getColors(card.color);
                const Icon = card.icon;

                return (
                    <div 
                        key={card.id}
                        className="glass-card p-6 card-hover-effect group cursor-pointer border-transparent hover:border-white/50"
                        onClick={() => onCardClick?.(card.id)}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={cn("p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 shadow-sm", colors)}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border",
                                card.isActive ? "bg-green-500 text-white border-green-400 animate-pulse" : "bg-gray-50 text-gray-400 border-gray-100"
                            )}>
                                {card.badge}
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-gray-900 group-hover:text-hff-primary transition-colors">
                                {card.title}
                            </h3>
                            <p className="text-xs font-bold text-gray-400 leading-relaxed line-clamp-2">
                                {card.description}
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <button className="text-[11px] font-black text-[#71167F] uppercase tracking-widest flex items-center gap-1 group/btn">
                                Open Module
                                <ChevronRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                            </button>
                            {card.isActive && (
                                <div className="flex gap-1">
                                    <span className="h-1 w-1 rounded-full bg-green-500" />
                                    <span className="h-1 w-1 rounded-full bg-green-500 animate-bounce" />
                                    <span className="h-1 w-1 rounded-full bg-green-500" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CampaignLaunchpad;
