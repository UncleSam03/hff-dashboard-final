import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, PieChart } from 'lucide-react';

const FinancialImpact = ({ uniqueAttendees }) => {
    const [budget, setBudget] = useState(50000); // Default example
    const [spend, setSpend] = useState(0);

    const costPerParticipant = uniqueAttendees > 0 ? (spend / uniqueAttendees).toFixed(2) : 0;
    const percentage = budget > 0 ? Math.min((spend / budget) * 100, 100) : 0;

    return (
        <Card className="col-span-full shadow-sm border-gray-100 bg-gradient-to-br from-white to-gray-50 border-l-4 border-l-hff-secondary">
            <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-hff-secondary" />
                    Financial Impact Module
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Inputs */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Total Campaign Budget (BWP)</label>
                        <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(Number(e.target.value))}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-hff-primary focus:border-transparent outline-none text-gray-900 font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Actual Spend (BWP)</label>
                        <input
                            type="number"
                            value={spend}
                            onChange={(e) => setSpend(Number(e.target.value))}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-hff-primary focus:border-transparent outline-none text-gray-900 font-medium"
                        />
                    </div>
                </div>

                {/* Visual Budget Tracking */}
                <div className="flex flex-col justify-center space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-600">Budget Usage</span>
                        <span className={percentage > 90 ? "text-red-500" : "text-hff-primary"}>{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-hff-secondary transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        {spend > budget ? "Over Budget!" : `${(budget - spend).toLocaleString()} BWP Remaining`}
                    </p>
                </div>

                {/* Cost Per Metrics */}
                <div className="flex flex-col justify-center items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 font-medium">Cost per Participant</p>
                    <p className="text-3xl font-bold text-hff-primary mt-1">BWP {costPerParticipant}</p>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        Based on {uniqueAttendees} unique attendees
                    </p>
                </div>

            </CardContent>
        </Card>
    );
};

export default FinancialImpact;
