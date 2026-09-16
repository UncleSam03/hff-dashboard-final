import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users } from 'lucide-react';

const AgeChart = ({ data }) => {
    const hasData = Array.isArray(data) && data.some(d => (d.count || 0) > 0);

    if (!data || !Array.isArray(data) || data.length === 0 || !hasData) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center liquid-glass rounded-3xl border border-white/70 shadow-inner backdrop-blur-xl">
                <div className="w-12 h-12 rounded-2xl liquid-glass-pill border border-white/80 shadow-sm flex items-center justify-center text-[#71167F] mb-3">
                    <Users size={22} />
                </div>
                <p className="text-gray-700 text-xs font-black uppercase tracking-widest">No age demographic data yet</p>
                <p className="text-gray-400 text-[10px] font-medium mt-1">Metrics update automatically as participants register</p>
            </div>
        );
    }

    const COLORS = ['#71167F', '#8E24AA', '#AB47BC', '#CE93D8'];

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                        dataKey="range" 
                        stroke="#9CA3AF" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        fontFamily="inherit"
                        fontWeight="bold"
                    />
                    <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        allowDecimals={false}
                        fontFamily="inherit"
                        fontWeight="bold"
                    />
                    <Tooltip
                        contentStyle={{ 
                            borderRadius: '1rem', 
                            background: 'rgba(255, 255, 255, 0.88)', 
                            backdropFilter: 'blur(20px)', 
                            WebkitBackdropFilter: 'blur(20px)', 
                            border: '1px solid rgba(255, 255, 255, 0.85)', 
                            boxShadow: '0 16px 36px -4px rgba(113, 22, 127, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)', 
                            fontWeight: 'bold', 
                            fontSize: '12px',
                            padding: '12px'
                        }}
                        cursor={{ fill: '#71167F', opacity: 0.05 }}
                    />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={40}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AgeChart;
