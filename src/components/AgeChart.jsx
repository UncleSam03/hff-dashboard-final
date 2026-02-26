import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AgeChart = ({ data }) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <Card className="shadow-sm border-gray-100">
                <CardHeader>
                    <CardTitle className="text-gray-900 text-lg">Age Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <p className="text-gray-400 text-sm">No age data available</p>
                </CardContent>
            </Card>
        );
    }

    const hasData = data.some(item => item.count > 0);

    return (
        <Card className="shadow-sm border-gray-100">
            <CardHeader>
                <CardTitle className="text-gray-900 text-lg">Age Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-0">
                {!hasData ? (
                    <div className="h-full flex items-center justify-center p-6 pt-0">
                        <p className="text-gray-400 text-sm">No age data available</p>
                    </div>
                ) : (
                    <div className="w-full h-full p-6 pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [value, 'Participants']}
                                />
                                <Bar dataKey="count" fill="#7E1B9B" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AgeChart;
