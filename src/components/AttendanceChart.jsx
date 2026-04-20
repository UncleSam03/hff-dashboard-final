import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const AttendanceChart = ({ data, compareWithRetention = false }) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No analytic data available</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorParticipants" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#71167F" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#71167F" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorFacilitators" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3EB049" stopOpacity={0.05}/>
                            <stop offset="95%" stopColor="#3EB049" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis
                        dataKey="date"
                        stroke="#9CA3AF"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => val.replace('Day ', 'D')}
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
                        cursor={{ stroke: '#71167F', strokeOpacity: 0.2 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="participants"
                        name="Participants"
                        stroke="#71167F"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorParticipants)"
                    />
                    <Area
                        type="monotone"
                        dataKey="facilitators"
                        name="Facilitators"
                        stroke="#F59E0B"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorFacilitators)"
                    />
                    {compareWithRetention && (
                        <Area
                            type="monotone"
                            dataKey="retention"
                            name="Retention %"
                            stroke="#3EB049"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fillOpacity={1}
                            fill="url(#colorRetention)"
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AttendanceChart;
