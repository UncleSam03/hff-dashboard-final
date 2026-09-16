import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { CalendarCheck } from 'lucide-react';

const AttendanceChart = ({ data, compareWithRetention = false, selectedDay, onSelectDay }) => {
    const hasAttendance = Array.isArray(data) && data.some(d => (d.participants || 0) > 0 || (d.facilitators || 0) > 0);

    if (!data || !Array.isArray(data) || data.length === 0 || !hasAttendance) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center liquid-glass rounded-3xl border border-white/70 shadow-inner relative overflow-hidden backdrop-blur-xl">
                <div className="w-14 h-14 rounded-2xl liquid-glass-pill border border-white/80 shadow-md flex items-center justify-center text-[#71167F] mb-4">
                    <CalendarCheck size={26} />
                </div>
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">No attendance records logged yet</h4>
                <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed font-medium">Daily trend lines and retention curves will emerge automatically as facilitators check in attendees.</p>
            </div>
        );
    }

    const handleClick = (e) => {
        if (e && e.activeLabel && onSelectDay) {
            onSelectDay(e.activeLabel);
        }
    };

    return (
        <div className="w-full h-full cursor-pointer" title="Click any day to inspect details">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    onClick={handleClick}
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
                            borderRadius: '1rem', 
                            background: 'rgba(255, 255, 255, 0.88)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.85)', 
                            boxShadow: '0 16px 36px -4px rgba(113, 22, 127, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
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
                    {selectedDay && (
                        <ReferenceLine 
                            x={selectedDay} 
                            stroke="#71167F" 
                            strokeDasharray="4 4" 
                            strokeWidth={2}
                            label={{ 
                                value: selectedDay.replace('Day ', 'D'), 
                                position: 'top', 
                                fill: '#71167F', 
                                fontSize: 10, 
                                fontWeight: 'bold' 
                            }} 
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AttendanceChart;
