import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#71167F', '#3EB049', '#7E1B9B', '#A569BD', '#45B39D', '#264653', '#E76F51', '#F4A261'];

export const GenderChart = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return (
            <div className="h-[250px] flex items-center justify-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No gender data</p>
            </div>
        );
    }

    const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
    const labelMap = { 'M': 'Male', 'F': 'Female' };

    return (
        <div className="space-y-4">
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'F' ? '#3EB049' : '#71167F'} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
                {chartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.name === 'F' ? '#3EB049' : '#71167F' }}></div>
                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{labelMap[entry.name] || entry.name}</span>
                        <span className="text-xs font-black text-gray-900 ml-1">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const EducationChart = ({ data }) => {
    if (!data || typeof data !== 'object') data = {};

    const chartData = Object.entries(data)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

    if (chartData.length === 0) {
        return (
            <div className="h-[200px] flex items-center justify-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No education data</p>
            </div>
        );
    }

    return (
        <div className="h-[200px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        fontFamily="inherit"
                        fontWeight="bold"
                    />
                    <YAxis stroke="#9CA3AF" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        cursor={{ fill: '#71167F', opacity: 0.05 }}
                    />
                    <Bar dataKey="value" fill="#71167F" radius={[6, 6, 0, 0]} barSize={25} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const MaritalStatusChart = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return (
            <div className="h-[200px] flex items-center justify-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No marital data</p>
            </div>
        );
    }

    const chartData = Object.entries(data)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

    return (
        <div className="h-[200px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -30, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={90} 
                        tickLine={false} 
                        axisLine={false} 
                        fontSize={10} 
                        fontFamily="inherit"
                        fontWeight="bold"
                        stroke="#9CA3AF"
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        cursor={{ fill: '#3EB049', opacity: 0.05 }}
                    />
                    <Bar dataKey="value" fill="#3EB049" radius={[0, 6, 6, 0]} barSize={15} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
