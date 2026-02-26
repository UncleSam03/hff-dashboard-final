import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ['#71167F', '#3EB049', '#7E1B9B', '#A569BD', '#45B39D', '#264653', '#E76F51', '#F4A261'];

export const GenderChart = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return (
            <Card className="shadow-sm border-gray-100">
                <CardHeader>
                    <CardTitle className="text-gray-900 text-lg">Gender Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <p className="text-gray-400 text-sm">No gender data available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
    const labelMap = { 'M': 'Male', 'F': 'Female' };

    return (
        <Card className="shadow-sm border-gray-100">
            <CardHeader>
                <CardTitle className="text-gray-900 text-lg">Gender Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-0">
                <div className="w-full h-full p-6 pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'F' ? '#3EB049' : '#71167F'} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-sm text-gray-600 mt-2">
                    {chartData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.name === 'F' ? '#3EB049' : '#71167F' }}></div>
                            <span>{labelMap[entry.name] || entry.name} ({entry.value})</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export const EducationChart = ({ data }) => {
    if (!data || typeof data !== 'object') {
        data = {};
    }

    // Support full-text keys from the offline form
    const chartData = Object.entries(data)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

    const hasData = chartData.length > 0;

    return (
        <Card className="shadow-sm border-gray-100">
            <CardHeader>
                <CardTitle className="text-gray-900 text-lg">Education Level</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-0">
                {!hasData ? (
                    <div className="h-full flex items-center justify-center p-6 pt-0">
                        <p className="text-gray-400 text-sm">No education data available</p>
                    </div>
                ) : (
                    <div className="w-full h-full p-6 pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: '#F9FAFB' }} />
                                <Bar dataKey="value" fill="#71167F" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const MaritalStatusChart = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return (
            <Card className="shadow-sm border-gray-100">
                <CardHeader>
                    <CardTitle className="text-gray-900 text-lg">Marital Status</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <p className="text-gray-400 text-sm">No marital status data available</p>
                </CardContent>
            </Card>
        );
    }

    // Support full-text keys from the offline form
    const chartData = Object.entries(data)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

    return (
        <Card className="shadow-sm border-gray-100">
            <CardHeader>
                <CardTitle className="text-gray-900 text-lg">Marital Status</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-0">
                <div className="w-full h-full p-6 pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} fontSize={12} />
                            <Tooltip cursor={{ fill: '#F9FAFB' }} />
                            <Bar dataKey="value" fill="#3EB049" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
