import React from 'react';
import { cn } from "../lib/utils";

const StatsCard = ({ title, value, icon: Icon, description, className, color = 'purple', onClick }) => {
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
        emerald: {
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
        <div 
            onClick={onClick}
            className={cn(
                "liquid-glass-elevated p-6 group relative overflow-hidden min-h-[156px] flex flex-col justify-between cursor-pointer",
                className
            )}
        >
            {/* Ambient Liquid Glow Diffuser */}
            <div className={cn("absolute -top-20 -right-20 w-44 h-44 bg-gradient-radial blur-3xl opacity-20 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none", config.glow)} />
            
            {/* Top Specular Light Highlight (Apple Liquid Specular Rim) */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

            <div className="flex items-center justify-between gap-3 relative z-10 w-full">
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2 leading-snug">
                        {title}
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight tabular-nums leading-none">
                            {typeof value === 'number' ? value.toLocaleString() : (value ?? 0)}
                        </span>
                    </div>
                </div>

                <div className={cn(
                    "w-12 h-12 rounded-2xl shadow-lg shrink-0 flex items-center justify-center transform transition-all group-hover:rotate-6 group-hover:scale-110 duration-500 border border-white/60 relative overflow-hidden", 
                    config.icon
                )}>
                    {/* Inner light reflection on icon */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent pointer-events-none" />
                    {Icon && <Icon size={20} className="relative z-10" />}
                </div>
            </div>

            <div className="relative z-10 mt-4 pt-3 border-t border-white/60">
                {description && (
                    <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity tracking-wider uppercase truncate">
                        <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm shrink-0", config.text.replace('text-', 'bg-'))} />
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
