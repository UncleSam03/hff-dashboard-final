import React, { useState } from 'react';
import { LayoutDashboard, Heart, LogOut, Shield, Users, User, Menu, X } from 'lucide-react';
import { useAuth } from "@/auth/AuthContext";

const ROLE_BADGES = {
    admin: { label: "Admin", icon: Shield, bg: "bg-amber-50", text: "text-amber-700" },
    facilitator: { label: "Facilitator", icon: Users, bg: "bg-emerald-50", text: "text-emerald-700" },
    participant: { label: "Participant", icon: User, bg: "bg-violet-50", text: "text-violet-700" },
};

const Layout = ({ children, onBackToHome, isHome, showNav = true }) => {
    const { user, profile, role, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const badge = ROLE_BADGES[role] || ROLE_BADGES.participant;
    const BadgeIcon = badge.icon;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={onBackToHome}
                    >
                        <div className="h-10 w-10 bg-hff-primary rounded-xl flex items-center justify-center shadow-lg shadow-hff-primary/20 group-hover:scale-105 transition-transform">
                            <Heart className="text-white h-6 w-6 fill-current" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">HFF Campaigns</h1>
                            <p className="text-xs text-gray-500 font-medium tracking-wide">IMPACT TRACKER</p>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-4">
                        {showNav && !isHome && (
                            <button
                                onClick={onBackToHome}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-hff-primary transition-colors pr-4 border-r border-gray-100"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Home
                            </button>
                        )}
                        {/* Role badge */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                            <BadgeIcon className="h-3.5 w-3.5" />
                            {badge.label}
                        </div>
                        {user ? (
                            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                        {profile?.full_name || "Signed in"}
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">{user.email || profile?.phone || ""}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={signOut}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
                                    title="Sign out"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={toggleMenu}
                        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Navigation Menu */}
                {isMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 bg-white absolute w-full left-0 shadow-lg animate-in slide-in-from-top-2 duration-200">
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                                    <BadgeIcon className="h-3.5 w-3.5" />
                                    {badge.label}
                                </div>
                                {user && (
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 font-medium">
                                            {profile?.full_name || "Signed in"}
                                        </p>
                                        <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{user.email || profile?.phone}</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-2">
                                {showNav && !isHome && (
                                    <button
                                        onClick={() => { onBackToHome(); setIsMenuOpen(false); }}
                                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-gray-50 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
                                    >
                                        <LayoutDashboard className="h-5 w-5" />
                                        Dashboard Home
                                    </button>
                                )}
                                <button
                                    onClick={() => { signOut(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors"
                                >
                                    <LogOut className="h-5 w-5" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
};

export default Layout;
