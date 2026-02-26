import React from 'react';
import { LayoutDashboard, FileSpreadsheet, MapPin, ArrowRight, Share2, Download, Zap, Database } from 'lucide-react';

const Home = ({ onSelectMode }) => {
    const [isOnline, setIsOnline] = React.useState(true);

    React.useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleStatusChange = (e) => {
            setIsOnline(e.detail.online);
        };

        window.addEventListener('hff-connectivity-status', handleStatusChange);

        // Final fallback to check on mount
        import('../lib/syncManager').then(m => m.checkConnectivity());

        return () => window.removeEventListener('hff-connectivity-status', handleStatusChange);
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-16">
                <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-hff-primary/10 text-hff-primary text-sm font-bold tracking-wide uppercase animate-bounce-subtle">
                    Welcome to the Analytics Portal
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                    HFF <span className="text-hff-primary">Analytics</span> Central
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Select a campaign or tool to begin analyzing your impact data and generating AI-powered insights.
                </p>
            </div>

            {/* Welcome Message Banner */}
            <div className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-br from-hff-primary/5 via-white to-indigo-500/5 p-8 border border-gray-100 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-hff-primary via-indigo-500 to-hff-primary"></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-hff-primary to-indigo-600">Champion!</span> 👋
                        </h2>
                        <p className="text-gray-600">
                            Your dashboard is ready with the latest metrics from your campaigns.
                            Let&apos;s make a difference today.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Status</span>
                            <span className={`flex items-center gap-1.5 font-bold transition-colors ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
                                <span className={`h-2 w-2 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {isOnline ? 'Systems Online' : 'Systems Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Offline Collection Card */}
                <div
                    onClick={() => onSelectMode('collect')}
                    className="group relative bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-500 cursor-pointer overflow-hidden border-t-4 border-t-green-500"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Database className="h-32 w-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Database className="h-8 w-8" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors">Offline Collect</h2>
                        <p className="text-gray-600 mb-8 line-height-relaxed">
                            Collect participant data in the field even without internet. Records are synced to Google Sheets when you&apos;re online.
                        </p>

                        <div className="flex items-center text-green-600 font-bold group-hover:gap-2 transition-all">
                            <span>Start Collection</span>
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Campaign Hub Card */}
                <div
                    onClick={() => onSelectMode('hub')}
                    className="group relative bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 cursor-pointer overflow-hidden border-t-4 border-t-purple-500"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <LayoutDashboard className="h-32 w-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform duration-500">
                            <LayoutDashboard className="h-8 w-8" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">Campaign Hub</h2>
                        <p className="text-gray-600 mb-8 line-height-relaxed">
                            Manage registered people, mark daily attendance, and track facilitator progress on the notice board.
                        </p>

                        <div className="flex items-center text-purple-600 font-bold group-hover:gap-2 transition-all">
                            <span>Open Hub</span>
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Phikwe Campaign Card */}
                <div
                    onClick={() => onSelectMode('phikwe')}
                    className="group relative bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-hff-primary/20 transition-all duration-500 cursor-pointer overflow-hidden border-t-4 border-t-hff-primary"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MapPin className="h-32 w-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="h-14 w-14 bg-hff-primary/10 rounded-2xl flex items-center justify-center text-hff-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Zap className="h-8 w-8" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-hff-primary transition-colors">Phikwe Campaign</h2>
                        <p className="text-gray-600 mb-8 line-height-relaxed">
                            Access live registration data and real-time syncing for the upcoming Phikwe campaign via Google Sheets integration.
                        </p>

                        <div className="flex items-center text-hff-primary font-bold group-hover:gap-2 transition-all">
                            <span>Access Live Dashboard</span>
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* General Dashboard Card */}
                <div
                    onClick={() => onSelectMode('general')}
                    className="group relative bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 cursor-pointer overflow-hidden border-t-4 border-t-indigo-500"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileSpreadsheet className="h-32 w-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="h-14 w-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform duration-500">
                            <FileSpreadsheet className="h-8 w-8" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">General Analysis</h2>
                        <p className="text-gray-600 mb-8 line-height-relaxed">
                            Upload ANY campaign register (CSV/XLSX) to process demographics, attendance, and generate downloadable reports.
                        </p>

                        <div className="flex items-center text-indigo-600 font-bold group-hover:gap-2 transition-all">
                            <span>Upload & Analyze</span>
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats or Info Footer */}
            <div className="mt-20 flex flex-wrap justify-center gap-12 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="font-medium">Interactive Charts</span>
                </div>
                <div className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    <span className="font-medium">PDF Reports</span>
                </div>
                <div className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    <span className="font-medium">Easy Sharing</span>
                </div>
            </div>
        </div>
    );
};

export default Home;
