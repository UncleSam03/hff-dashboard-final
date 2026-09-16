import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, GraduationCap, Heart } from 'lucide-react';

const COLORS = ['#71167F', '#3EB049', '#7E1B9B', '#A569BD', '#45B39D', '#264653', '#E76F51', '#F4A261'];

export const GenderChart = ({ data }) => {
    const chartData = Object.entries(data || {})
        .map(([name, value]) => ({ name, value }))
        .filter(item => (item.value || 0) > 0);

    if (chartData.length === 0) {
        return (
            <div className="h-[240px] flex flex-col items-center justify-center text-center p-6 rounded-3xl liquid-glass border border-white/70 shadow-inner backdrop-blur-xl">
                <div className="w-12 h-12 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm flex items-center justify-center text-[#71167F] mb-3">
                    <Users size={22} />
                </div>
                <p className="text-gray-700 text-xs font-black uppercase tracking-widest">No gender demographic data yet</p>
                <p className="text-gray-400 text-[10px] font-medium mt-1">Populates as registrations are added</p>
            </div>
        );
    }

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
                            contentStyle={{ 
                                borderRadius: '1rem', 
                                background: 'rgba(255, 255, 255, 0.88)', 
                                backdropFilter: 'blur(20px)', 
                                WebkitBackdropFilter: 'blur(20px)', 
                                border: '1px solid rgba(255, 255, 255, 0.85)', 
                                boxShadow: '0 16px 36px -4px rgba(113, 22, 127, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)', 
                                fontWeight: 'bold', 
                                fontSize: '12px' 
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
                {chartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill border border-white/70 shadow-xs">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.name === 'F' ? '#3EB049' : '#71167F' }}></div>
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">{labelMap[entry.name] || entry.name}</span>
                        <span className="text-xs font-extrabold text-gray-900 ml-1">{entry.value}</span>
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
            <div className="h-[200px] flex flex-col items-center justify-center text-center p-6 rounded-3xl liquid-glass border border-white/70 shadow-inner backdrop-blur-xl">
                <div className="w-11 h-11 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm flex items-center justify-center text-[#71167F] mb-2.5">
                    <GraduationCap size={20} />
                </div>
                <p className="text-gray-700 text-xs font-black uppercase tracking-widest">No education demographic data yet</p>
                <p className="text-gray-400 text-[10px] font-medium mt-1">Populates as registrations are added</p>
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
                        contentStyle={{ 
                            borderRadius: '1rem', 
                            background: 'rgba(255, 255, 255, 0.88)', 
                            backdropFilter: 'blur(20px)', 
                            WebkitBackdropFilter: 'blur(20px)', 
                            border: '1px solid rgba(255, 255, 255, 0.85)', 
                            boxShadow: '0 16px 36px -4px rgba(113, 22, 127, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)', 
                            fontWeight: 'bold', 
                            fontSize: '12px' 
                        }}
                        cursor={{ fill: '#71167F', opacity: 0.05 }}
                    />
                    <Bar dataKey="value" fill="#71167F" radius={[6, 6, 0, 0]} barSize={25} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const MaritalStatusChart = ({ data }) => {
    const chartData = Object.entries(data || {})
        .map(([name, value]) => ({ name, value }))
        .filter(item => (item.value || 0) > 0)
        .sort((a, b) => b.value - a.value);

    if (chartData.length === 0) {
        return (
            <div className="h-[200px] flex flex-col items-center justify-center text-center p-6 rounded-3xl liquid-glass border border-white/70 shadow-inner backdrop-blur-xl">
                <div className="w-11 h-11 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm flex items-center justify-center text-[#3EB049] mb-2.5">
                    <Heart size={20} />
                </div>
                <p className="text-gray-700 text-xs font-black uppercase tracking-widest">No marital status demographic data yet</p>
                <p className="text-gray-400 text-[10px] font-medium mt-1">Populates as registrations are added</p>
            </div>
        );
    }

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
                        contentStyle={{ 
                            borderRadius: '1rem', 
                            background: 'rgba(255, 255, 255, 0.88)', 
                            backdropFilter: 'blur(20px)', 
                            WebkitBackdropFilter: 'blur(20px)', 
                            border: '1px solid rgba(255, 255, 255, 0.85)', 
                            boxShadow: '0 16px 36px -4px rgba(62, 176, 73, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)', 
                            fontWeight: 'bold', 
                            fontSize: '12px' 
                        }}
                        cursor={{ fill: '#3EB049', opacity: 0.05 }}
                    />
                    <Bar dataKey="value" fill="#3EB049" radius={[0, 6, 6, 0]} barSize={15} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
