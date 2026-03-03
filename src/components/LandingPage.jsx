import React from 'react';
import {
    Users, Heart, Sparkles, ArrowRight, Play,
    MessageCircle, Shield, Globe, Mail, Phone,
    Instagram, Facebook, Twitter, MapPin
} from 'lucide-react';

const LandingPage = ({ onStart, onSignIn }) => {
    return (
        <div className="min-h-screen font-sans selection:bg-hff-primary/10">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between glass-card px-8 py-4 rounded-full">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 bg-gradient-to-br from-hff-primary to-hff-accent rounded-xl flex items-center justify-center text-white">
                            <Heart className="h-6 w-6" fill="currentColor" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-gray-900 font-serif leading-none mt-1">HFF <span className="text-hff-primary">Impact</span></span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
                        <a href="#mission" className="hover:text-hff-primary transition-colors">Our Mission</a>
                        <a href="#activities" className="hover:text-hff-primary transition-colors">Activities</a>
                        <a href="#testimonies" className="hover:text-hff-primary transition-colors">Testimonies</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onSignIn}
                            className="text-sm font-bold text-gray-700 hover:text-hff-primary px-4 py-2 transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => onStart('signup')}
                            className="bg-hff-primary text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-hff-accent transition-all shadow-lg shadow-hff-primary/20"
                        >
                            Join Us
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Background Shapes */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-hff-soft-purple rounded-full blur-[120px] -z-10 animate-float"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-hff-warm-green rounded-full blur-[100px] -z-10 animate-float" style={{ animationDelay: '2s' }}></div>

                <div className="max-w-7xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-hff-primary/10 text-hff-primary text-sm font-bold tracking-wide uppercase">
                        <Sparkles className="h-4 w-4" />
                        Making Families Healthier & Happier
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black text-gray-900 mb-8 leading-[1.1] tracking-tight">
                        Fix the <span className="italic text-hff-primary">Root</span>. <br />
                        Fix the <span className="italic text-hff-secondary">Fruit</span>.
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                        A non-profit trust dedicated to strengthening families and decreasing social ills through evidence-based programs.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <button
                            onClick={() => onStart('signup')}
                            className="w-full sm:w-auto px-10 py-5 rounded-full bg-hff-primary text-white font-black text-lg shadow-2xl shadow-hff-primary/30 hover:scale-105 transition-all flex items-center justify-center gap-3"
                        >
                            Become a Facilitator
                            <ArrowRight className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section id="mission" className="py-24 bg-white relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-hff-soft-purple rounded-3xl -z-10 animate-pulse"></div>
                            <div className="aspect-square rounded-2xl bg-gradient-to-br from-hff-primary/20 to-hff-secondary/20 flex items-center justify-center overflow-hidden border border-white">
                                <Heart className="h-48 w-48 text-hff-primary" fill="currentColor" opacity="0.2" />
                            </div>
                        </div>
                        <div className="space-y-8">
                            <h2 className="text-5xl font-bold text-gray-900 leading-tight">
                                Our Mission to <span className="text-hff-primary">Restore</span> Hope
                            </h2>
                            <p className="text-lg text-gray-600 leading-relaxed font-medium">
                                Healthy Families Foundation (HFF) is a non-profit Trust which focuses on strengthening families. We strive to make a positive impact in decreasing social ills like gender-based violence, substance abuse, and depression.
                            </p>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 rounded-3xl bg-hff-warm-green border border-green-100">
                                    <div className="h-10 w-10 bg-hff-secondary rounded-xl flex items-center justify-center text-white mb-4">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <h4 className="font-bold text-gray-900 mb-1 font-serif text-2xl">4000+</h4>
                                    <p className="text-sm text-gray-600">Daily Participants</p>
                                </div>
                                <div className="p-6 rounded-3xl bg-hff-soft-purple border border-purple-100">
                                    <div className="h-10 w-10 bg-hff-primary rounded-xl flex items-center justify-center text-white mb-4">
                                        <Globe className="h-6 w-6" />
                                    </div>
                                    <h4 className="font-bold text-gray-900 mb-1 font-serif text-2xl">Nationwide</h4>
                                    <p className="text-sm text-gray-600">Impact Reach</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Activities Bento Grid */}
            <section id="activities" className="py-24 bg-hff-warm-beige/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold text-gray-900 mb-4">Our Core Activities</h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">We use various platforms to help thousands of people through evidence-based programs.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
                        {/* Campaigns */}
                        <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-white border border-gray-100 p-8 flex flex-col justify-end">
                            <div className="absolute top-0 right-0 p-12 text-hff-primary opacity-5 group-hover:scale-110 transition-transform">
                                <Heart className="h-64 w-64" fill="currentColor" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-4xl font-bold text-gray-900 mb-4">Community campaigns</h3>
                                <p className="text-gray-600 max-w-md text-lg font-medium mb-6">
                                    Wide-reaching trainings impacting 3000-4000 people daily across Botswana.
                                </p>
                                <span className="inline-flex items-center gap-2 text-hff-primary font-black uppercase tracking-wider text-sm">
                                    Learn More <ArrowRight className="h-4 w-4" />
                                </span>
                            </div>
                        </div>

                        {/* TV Shows */}
                        <div className="relative group overflow-hidden rounded-3xl bg-hff-primary text-white p-8 flex flex-col justify-end">
                            <div className="absolute top-8 right-8 h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                <Play className="h-6 w-6 fill-current" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-2">TV Shows</h3>
                                <p className="text-white/80 font-medium text-sm">National broadcasting for family health.</p>
                            </div>
                        </div>

                        {/* Marriage Seminars */}
                        <div className="relative group overflow-hidden rounded-3xl bg-hff-secondary text-white p-8 flex flex-col justify-end">
                            <div className="absolute top-8 right-8 h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                <Heart className="h-6 w-6 fill-current" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-2">Marriage Seminars</h3>
                                <p className="text-white/80 font-medium text-sm">Building strong foundations for couples.</p>
                            </div>
                        </div>

                        {/* Youth Programs */}
                        <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-white border border-gray-100 p-8 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div className="h-12 w-12 bg-hff-soft-purple rounded-xl flex items-center justify-center text-hff-primary">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-10 w-10 rounded-full border-2 border-white bg-gray-200" />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 mb-2">Youth character workshops</h3>
                                <p className="text-gray-600 font-medium">Character development programs for the next generation.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonies" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-16">
                        <div className="max-w-2xl">
                            <h2 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">Echoes of <span className="text-hff-primary italic">Transformation</span></h2>
                            <p className="text-lg text-gray-600 font-medium">Our work is supported by leaders and communities across the nation.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="p-4 rounded-full border border-gray-100 bg-hff-warm-beige">
                                <MessageCircle className="h-8 w-8 text-hff-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: "Botswana Police Service", text: "Exceptional impact on community safety and family unity." },
                            { name: "Ministry of Gender Affairs", text: "HFF is a key partner in our mission to eliminate social ills." },
                            { name: "Member of Parliament", text: "Transforming Mahalapye West through evidence-based family programs." }
                        ].map((t, i) => (
                            <div key={i} className="p-8 rounded-[2.5rem] bg-hff-warm-beige/30 border border-white relative">
                                <div className="text-hff-primary mb-6 flex gap-1">
                                    {[1, 2, 3, 4, 5].map(j => <Sparkles key={j} className="h-4 w-4" fill="currentColor" />)}
                                </div>
                                <p className="text-gray-700 text-lg italic mb-8">"{t.text}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-hff-primary/10 flex items-center justify-center font-bold text-hff-primary font-serif">
                                        {t.name[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm leading-none mb-1">{t.name}</h4>
                                        <p className="text-xs text-hff-primary font-bold uppercase tracking-widest leading-none">Endorsement</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bento Footer */}
            <footer className="py-20 bg-gray-950 text-white rounded-t-[4rem]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-12 w-12 bg-white text-gray-950 rounded-2xl flex items-center justify-center">
                                    <Heart className="h-7 w-7" fill="currentColor" />
                                </div>
                                <span className="text-2xl font-black italic tracking-tighter font-serif">HFF FOUNDATION</span>
                            </div>
                            <p className="text-gray-400 text-lg max-w-sm mb-10 leading-relaxed font-medium">
                                Strengthening the core of society by restoring health and happiness to every family.
                            </p>
                            <div className="flex gap-4">
                                {[Facebook, Instagram, Twitter].map((Icon, i) => (
                                    <a key={i} href="#" className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10">
                                        <Icon className="h-5 w-5" />
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-8 text-sm uppercase tracking-widest">Quick Links</h4>
                            <ul className="space-y-4 text-gray-400 font-medium">
                                <li><a href="#" className="hover:text-white transition-colors">Who We Are</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Campaigns</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Testimonies</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Donate</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-8 text-sm uppercase tracking-widest">Contact</h4>
                            <ul className="space-y-4 text-gray-400 font-medium">
                                <li className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-hff-secondary" />
                                    +267 77 50 45 27
                                </li>
                                <li className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-hff-secondary" />
                                    info@thehealthyfamilies.net
                                </li>
                                <li className="flex items-center gap-3">
                                    <MapPin className="h-4 w-4 text-hff-secondary" />
                                    Botswana, Africa
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-gray-500 font-medium">
                        <p>© 2026 The Healthy Families Foundation. All Rights Reserved.</p>
                        <div className="flex gap-8">
                            <a href="#" className="hover:text-white">Privacy Policy</a>
                            <a href="#" className="hover:text-white">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
