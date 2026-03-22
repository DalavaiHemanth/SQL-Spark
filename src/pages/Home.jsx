import React, { useState } from 'react';
import { db } from '@/api/dataClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    Database,
    Trophy,
    Users,
    Code2,
    ArrowRight,
    Sparkles,
    Terminal,
    Zap,
    Search,
    Loader2,
    Mail,
    Linkedin,
    GraduationCap,
    Building2,
    Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import HackathonCard from '@/components/hackathon/HackathonCard';

export default function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [hackCode, setHackCode] = useState('');
    const [joiningByCode, setJoiningByCode] = useState(false);

    const { data: allHackathons = [], isLoading } = useQuery({
        queryKey: ['hackathons-home'],
        queryFn: () => db.entities.Hackathon.list('-created_date')
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => db.entities.Team.list()
    });

    const getTeamCount = (hackathonId) =>
        teams.filter(t => t.hackathon_id === hackathonId).length;

    // Split hackathons into active and completed
    const activeHackathons = allHackathons.filter(h =>
        ['registration_open', 'in_progress'].includes(getEffectiveHackathonStatus(h))
    );

    // Filter COMPLETED hackathons by user participation
    // Users only see past hackathons they actually joined.
    // Admins and Organizers can see all past hackathons.
    const completedHackathons = allHackathons.filter(h => {
        const isCompleted = getEffectiveHackathonStatus(h) === 'completed';
        if (!isCompleted) return false;

        // Admins and Organizers see everything
        if (user?.role === 'admin' || user?.role === 'organizer') return true;

        // Regular users must have participated
        return teams.some(t =>
            t.hackathon_id === h.id &&
            t.members?.some(m => (typeof m === 'string' ? m : m.email) === user?.email)
        );
    });

    const filteredActive = activeHackathons.filter(h =>
        h.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredCompleted = completedHackathons.filter(h =>
        h.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl" />
                <div className="absolute top-40 right-10 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />

                <div className="relative max-w-6xl mx-auto px-6 py-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 px-4 py-1.5 text-sm font-medium mb-6">
                            <Sparkles className="w-4 h-4 mr-1.5" />
                            The Ultimate SQL Challenge Platform
                        </Badge>

                        <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight">
                            SQL
                            <span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent"> Spark</span>
                        </h1>

                        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Compete with teams, solve real-world SQL challenges, and climb the leaderboard.
                            Test your database skills in a thrilling competition.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            {user ? (
                                <>
                                    <Link to={createPageUrl('Dashboard')}>
                                        <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-8 h-14 text-lg">
                                            <Terminal className="w-5 h-5 mr-2" />
                                            My Dashboard
                                        </Button>
                                    </Link>
                                    {(user.role === 'admin' || user.role === 'organizer') && (
                                        <Link to={createPageUrl('AdminDashboard')}>
                                            <Button size="lg" variant="outline" className="px-8 h-14 text-lg border-2">
                                                {user.role === 'admin' ? 'Admin Panel' : 'Host Dashboard'}
                                                <ArrowRight className="w-5 h-5 ml-2" />
                                            </Button>
                                        </Link>
                                    )}
                                </>
                            ) : (
                                <Link to="/Login">
                                    <Button
                                        size="lg"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 text-lg"
                                    >
                                        Get Started
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Join by hackathon code */}
                        <div className="mt-8 flex flex-col items-center gap-2">
                            <p className="text-sm text-slate-500">Have a hackathon code from your organiser?</p>
                            <div className="flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-2 shadow-sm">
                                <Input
                                    placeholder="Enter code e.g. X7KP2Q"
                                    value={hackCode}
                                    onChange={e => setHackCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="w-44 h-11 text-center font-mono text-lg tracking-widest border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-300 placeholder:text-sm placeholder:tracking-normal"
                                />
                                <Button
                                    className="bg-violet-600 hover:bg-violet-700 h-11 px-5"
                                    disabled={hackCode.length < 4 || joiningByCode}
                                    onClick={async () => {
                                        setJoiningByCode(true);
                                        try {
                                            const all = await db.entities.Hackathon.list();
                                            const match = all.find(h => h.hackathon_code?.toUpperCase() === hackCode.toUpperCase());
                                            if (!match) { toast.error('Invalid code — ask your organiser'); return; }
                                            const effectiveStatus = getEffectiveHackathonStatus(match);
                                            if (effectiveStatus === 'completed') {
                                                toast.error('This hackathon has already ended');
                                                return;
                                            }
                                            if (effectiveStatus === 'draft') {
                                                toast.error('Registration is not open yet — check back later');
                                                return;
                                            }
                                            if (effectiveStatus === 'in_progress') {
                                                toast.error('This contest has already started — registration is closed');
                                                return;
                                            }
                                            // registration_open — allow
                                            navigate(createPageUrl(`JoinHackathon?id=${match.id}`));
                                        } finally { setJoiningByCode(false); }
                                    }}
                                >
                                    {joiningByCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join →'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Features */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="grid md:grid-cols-3 gap-6 mt-20"
                    >
                        {[
                            { icon: Database, title: 'Real SQL Databases', desc: 'Practice on actual database schemas' },
                            { icon: Users, title: 'Team Competition', desc: 'Collaborate with your team to solve challenges' },
                            { icon: Trophy, title: 'Live Leaderboard', desc: 'Track your ranking in real-time' }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-100">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                    <feature.icon className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-slate-500 text-sm">{feature.desc}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* Hackathons Section */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Active Hackathons</h2>
                        <p className="text-slate-500">Join a competition and start coding</p>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Search hackathons..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-12 border-slate-200"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredActive.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl">
                        <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Active Hackathons</h3>
                        <p className="text-slate-500">Check back soon for new competitions!</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredActive.map(hackathon => (
                            <motion.div
                                key={hackathon.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <HackathonCard
                                    hackathon={hackathon}
                                    teamCount={getTeamCount(hackathon.id)}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Item 3: Completed hackathons with published results */}
                {filteredCompleted.length > 0 && (
                    <div className="mt-16">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">🏁 Past Hackathons</h2>
                        <p className="text-slate-500 mb-6">View results from completed hackathons (results released when admin publishes them)</p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCompleted.map(hackathon => (
                                <motion.div
                                    key={hackathon.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <HackathonCard
                                        hackathon={hackathon}
                                        teamCount={getTeamCount(hackathon.id)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* CTA Section */}
            <div className="bg-slate-900 py-20">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <Zap className="w-12 h-12 text-emerald-400 mx-auto mb-6" />
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Ready to Test Your SQL Skills?
                    </h2>
                    <p className="text-slate-400 text-lg mb-8">
                        Join thousands of developers competing in SQL challenges
                    </p>
                    <Link to="/Login">
                        <Button
                            size="lg"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-14 text-lg"
                        >
                            Start Competing
                            <Code2 className="w-5 h-5 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Ultra-Premium Footer Section */}
            <footer className="relative bg-[#020617] text-slate-400 py-10 border-t border-slate-800/80 overflow-hidden mt-auto">
                {/* Glowing Backgrounds */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                        
                        {/* Brand Column */}
                        <div className="lg:col-span-5 relative z-10">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="flex items-center gap-3 mb-6"
                            >
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                    <Database className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tight">
                                    SQL Spark
                                </span>
                            </motion.div>
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="text-base text-slate-400 mb-6 leading-relaxed max-w-md font-medium"
                            >
                                Empowering developers to master databases through high-stakes, real-time SQL challenges. Built with precision and passion.
                            </motion.p>
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 font-semibold uppercase tracking-widest"
                            >
                                <span>&copy; {new Date().getFullYear()} SQL Spark</span>
                                <span className="hidden sm:inline border-l border-slate-800 h-4"></span>
                                <span className="flex items-center gap-1.5">
                                    Crafted with <Heart className="w-4 h-4 text-red-500/80 fill-red-500/20 animate-pulse" />
                                </span>
                            </motion.div>
                        </div>
                        
                        {/* Developer Profile Card */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, x: 20 }}
                            whileInView={{ opacity: 1, scale: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3, type: 'spring', bounce: 0.4 }}
                            className="lg:col-span-7 bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-6 md:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group z-10"
                        >
                            {/* Card Hover Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition duration-700 ease-out pointer-events-none" />
                            <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none" />
                            
                            <div className="relative flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8 border-b border-slate-800/80 pb-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase shadow-inner">
                                        <Code2 className="w-4 h-4" />
                                        Platform Developer
                                    </div>
                                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight">Dalavai Hemanth</h3>
                                    <p className="text-emerald-400 font-semibold flex items-center gap-2 text-base md:text-lg">
                                        Aspiring Data Engineer
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <a href="mailto:hemanthleads@gmail.com" className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                                        <Mail className="w-5 h-5" />
                                    </a>
                                    <a href="https://linkedin.com/in/dalavai-hemanth-86638931b" target="_blank" rel="noreferrer" className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.2)]">
                                        <Linkedin className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>

                            <div className="relative grid sm:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 md:gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:bg-slate-900 transition-colors hover:border-violet-500/30 group/item">
                                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20 group-hover/item:scale-110 transition-transform duration-300 ease-out">
                                        <GraduationCap className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Department</p>
                                        <p className="text-slate-200 font-semibold text-sm md:text-base">Data Science</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 md:gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:bg-slate-900 transition-colors hover:border-blue-500/30 group/item">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover/item:scale-110 transition-transform duration-300 ease-out">
                                        <Building2 className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Institution</p>
                                        <p className="text-slate-200 font-semibold text-xs md:text-sm leading-snug">
                                            Rajeev Gandhi Memorial College of Engineering and Technology
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </div>
            </footer>
        </div>
    );
}