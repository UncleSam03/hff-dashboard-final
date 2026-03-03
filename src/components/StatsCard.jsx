import React from 'react';
import { cn } from "@/lib/utils";

const StatsCard = ({ title, value, icon: Icon, description, className, trend, color = 'purple' }) => {
    const colorMap = {
        purple: 'bg-[#71167F]/5 text-[#71167F] border-[#71167F]/10',
        green: 'bg-[#3EB049]/5 text-[#3EB049] border-[#3EB049]/10',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
    };

    const iconColorMap = {
        purple: 'bg-[#71167F] text-white',
        green: 'bg-[#3EB049] text-white',
        blue: 'bg-blue-600 text-white',
        amber: 'bg-amber-600 text-white',
    };

    const activeColorClass = colorMap[color] || colorMap.purple;
    const activeIconClass = iconColorMap[color] || iconColorMap.purple;

    return (
        <div className={cn(
            "glass-card p-6 card-hover-effect flex flex-col justify-between relative overflow-hidden group",
            className
        )}>
            {/* Background Decorative Element */}
            <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity", activeColorClass)} />

            <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl shadow-lg transition-transform group-hover:scale-110 duration-300", activeIconClass)}>
                    {Icon && <Icon className="h-6 w-6" />}
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                        {trend}
                    </div>
                )}
            </div>

            <div>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">
                    {title}
                </span>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gray-900 tracking-tight">
                        {value}
                    </span>
                </div>
                {description && (
                    <p className="text-[11px] font-bold text-gray-400 mt-2 flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
