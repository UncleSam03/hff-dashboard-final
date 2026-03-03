import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AgeChart = ({ data }) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No demographic data</p>
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
                            borderRadius: '16px', 
                            border: '1px solid #F3F4F6', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: 'bold',
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
