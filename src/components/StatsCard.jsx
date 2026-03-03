import React from 'react';
import { cn } from "../lib/utils";

const StatsCard = ({ title, value, icon: Icon, description, className, trend, color = 'purple' }) => {
    const colorMap = {
        purple: {
            bg: 'bg-[#71167F]/5',
            icon: 'bg-[#71167F] text-white shadow-[#71167F]/20',
            border: 'border-[#71167F]/10',
            glow: 'from-[#71167F]/20 to-transparent',
            text: 'text-[#71167F]'
        },
        green: {
            bg: 'bg-[#3EB049]/5',
            icon: 'bg-[#3EB049] text-white shadow-[#3EB049]/20',
            border: 'border-[#3EB049]/10',
            glow: 'from-[#3EB049]/20 to-transparent',
            text: 'text-[#3EB049]'
        },
        blue: {
            bg: 'bg-blue-50/50',
            icon: 'bg-blue-600 text-white shadow-blue-500/20',
            border: 'border-blue-100',
            glow: 'from-blue-400/20 to-transparent',
            text: 'text-blue-600'
        },
        amber: {
            bg: 'bg-amber-50/50',
            icon: 'bg-amber-600 text-white shadow-amber-500/20',
            border: 'border-amber-100',
            glow: 'from-amber-400/20 to-transparent',
            text: 'text-amber-600'
        }
    };

    const config = colorMap[color] || colorMap.purple;

    return (
        <div className={cn(
            "glass-card p-8 group relative overflow-hidden ui-transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-gray-200/50 border border-white/40 min-h-[160px] flex flex-col justify-between",
            className
        )}>
            {/* Soft Glow Radial */}
            <div className={cn("absolute -top-24 -right-24 w-48 h-48 bg-gradient-radial blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700", config.glow)} />

            <div className="flex items-center justify-between relative z-10 w-full">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] block mb-1">
                        {title}
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-gray-900 tracking-tighter tabular-nums leading-none">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </span>
                    </div>
                </div>

                <div className={cn("p-4 rounded-2xl shadow-xl transform transition-all group-hover:rotate-6 group-hover:scale-110 duration-500", config.icon)}>
                    {Icon && <Icon size={24} />}
                </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-gray-50/50">
                {description && (
                    <p className="text-[10px] font-bold text-gray-400 flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                        <span className={cn("w-1.5 h-1.5 rounded-full", config.text.replace('text-', 'bg-'))} />
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
