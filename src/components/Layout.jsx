import React, { useState } from 'react';
import { LayoutDashboard, Heart, LogOut, Shield, Users, User, Menu, X, Bell } from 'lucide-react';
import { useAuth } from "@/auth/AuthContext";

const ROLE_BADGES = {
    admin: { label: "Admin", icon: Shield, bg: "bg-amber-50", text: "text-amber-700" },
    facilitator: { label: "Facilitator", icon: Users, bg: "bg-emerald-50", text: "text-emerald-700" },
};

const Layout = ({ children, onBackToHome, isHome, showNav = true }) => {
    const { user, profile, role, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const badge = ROLE_BADGES[role] || ROLE_BADGES.facilitator;
    const BadgeIcon = badge.icon;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 relative overflow-hidden">
            {/* Background Glows */}
            <div className="soft-glow-purple top-[-100px] left-[-100px]" />
            <div className="soft-glow-green bottom-[-100px] right-[-100px]" />

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div
                        className="flex items-center gap-4 cursor-pointer group"
                        onClick={onBackToHome}
                    >
                        <div className="h-12 w-12 hff-gradient-bg rounded-2xl flex items-center justify-center shadow-xl shadow-hff-primary/20 group-hover:scale-105 transition-all duration-300">
                            <Heart className="text-white h-7 w-7 fill-current" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black hff-gradient-text leading-tight tracking-tight">HFF Impact</h1>
                                <span className="h-2 w-2 rounded-full bg-hff-secondary animate-pulse" />
                            </div>
                            <p className="text-xs text-gray-400 font-bold tracking-[0.2em] uppercase">Admin Hub: Real-Time Campaign Insights</p>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        {showNav && !isHome && (
                            <button
                                onClick={onBackToHome}
                                className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-hff-primary transition-all pr-6 border-r border-gray-100"
                            >
                                <LayoutDashboard className="h-5 w-5" />
                                Overview
                            </button>
                        )}
                        
                        <div className="flex items-center gap-4 pl-2">
                            {/* Notification Bell */}
                            <button className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-hff-primary transition-all relative">
                                <Bell className="h-5 w-5" />
                                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
                            </button>

                            {user ? (
                                <div className="flex items-center gap-4 bg-gray-50/50 p-1.5 pr-4 rounded-2xl border border-gray-100">
                                    <div className="h-10 w-10 rounded-xl bg-hff-primary/10 flex items-center justify-center text-hff-primary font-bold overflow-hidden border border-hff-primary/20">
                                        {profile?.avatar_url ? (
                                            <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-6 w-6" />
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-gray-900 leading-none">
                                                {profile?.full_name || "Sarah M."} 
                                                <span className="text-gray-400 font-medium ml-1">({badge.label})</span>
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{user.email || "ADMIN"}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={signOut}
                                        className="ml-4 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                        title="Sign out"
                                    >
                                        <LogOut className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={toggleMenu}
                        className="md:hidden p-3 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Navigation Menu */}
                {isMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-lg absolute w-full left-0 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="p-6 space-y-6">
                            {user && (
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                    <div className="h-12 w-12 rounded-xl bg-hff-primary/10 flex items-center justify-center text-hff-primary">
                                        <User className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">{profile?.full_name || "Admin User"}</p>
                                        <p className="text-xs font-bold text-gray-400 tracking-wider uppercase">{badge.label}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-3">
                                {showNav && !isHome && (
                                    <button
                                        onClick={() => { onBackToHome(); setIsMenuOpen(false); }}
                                        className="flex items-center gap-4 w-full p-4 rounded-2xl bg-hff-primary text-white font-bold shadow-lg shadow-hff-primary/20 hover:scale-[1.02] transition-all"
                                    >
                                        <LayoutDashboard className="h-6 w-6" />
                                        Dashboard Overview
                                    </button>
                                )}
                                <button
                                    onClick={() => { signOut(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-4 w-full p-4 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-all"
                                >
                                    <LogOut className="h-6 w-6" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-10 relative z-10">
                {children}
            </main>
        </div>
    );
};

export default Layout;
