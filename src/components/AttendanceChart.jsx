import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AttendanceChart = ({ data }) => {
    // Validate data before rendering
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('AttendanceChart: Invalid or empty data', data);
        return (
            <Card className="col-span-full lg:col-span-2 shadow-sm border-gray-100">
                <CardHeader>
                    <CardTitle className="text-gray-900">Daily Attendance Trend</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full flex items-center justify-center">
                    <p className="text-gray-400 text-sm">No attendance data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-full lg:col-span-2 shadow-sm border-gray-100">
            <CardHeader>
                <CardTitle className="text-gray-900">Daily Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full p-0">
                <div className="w-full h-full p-6 pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={data}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                stroke="#6B7280"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#6B7280"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="#71167F"
                                strokeWidth={3}
                                dot={{ r: 4, fill: "#71167F", strokeWidth: 2, stroke: "#fff" }}
                                activeDot={{ r: 6, fill: "#3EB049" }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default AttendanceChart;
