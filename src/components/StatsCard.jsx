import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mocking shadcn Card components locally since we didn't run the CLI
// In a real shadcn setup these would be in components/ui/card.tsx

const StatsCard = ({ title, value, icon: Icon, description, className }) => {
    return (
        <div className={cn("bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between", className)}>
            <div className="flex items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium text-gray-500">{title}</h3>
                {Icon && <Icon className="h-4 w-4 text-hff-primary" />}
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>
        </div>
    );
};

export default StatsCard;
