import React, { useState } from 'react';
import { db } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    Users,
    Plus,
    UserPlus,
    ArrowLeft,
    Trophy,
    Calendar,
    Clock,
    Loader2,
    CheckCircle2,
    BookOpen,
    ShieldCheck,
    BarChart3,
    Zap,
    AlertCircle,
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function JoinHackathon() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [teamName, setTeamName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const urlParams = new URLSearchParams(window.location.search);
    const hackathonId = urlParams.get('id');

    const { data: hackathon, isLoading } = useQuery({
        queryKey: ['hackathon', hackathonId],
        queryFn: async () => {
            const hackathons = await db.entities.Hackathon.filter({ id: hackathonId });
            return hackathons[0];
        },
        enabled: !!hackathonId
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams', hackathonId],
        queryFn: () => db.entities.Team.filter({ hackathon_id: hackathonId }),
        enabled: !!hackathonId,
        refetchInterval: 5000 
    });

    const { data: challenges = [] } = useQuery({
        queryKey: ['challenges', hackathonId],
        queryFn: () => db.entities.Challenge.filter({ hackathon_id: hackathonId }),
        enabled: !!hackathonId
    });

    const createTeamMutation = useMutation({
        mutationFn: async () => {
            if (getEffectiveHackathonStatus(hackathon) !== 'registration_open') {
                throw new Error('Registration is not open for this hackathon');
            }
            if (!teamName.trim()) {
                throw new Error('Please enter a team name');
            }
            if (hackathon?.max_teams && teams.length >= hackathon.max_teams) {
                throw new Error(`Team limit reached — this hackathon allows a maximum of ${hackathon.max_teams} teams`);
            }
            const trimmedName = teamName.trim();
            const nameExists = teams.some(t => t.name?.toLowerCase().trim() === trimmedName.toLowerCase());
            if (nameExists) throw new Error(`The team name "${trimmedName}" is already taken.`);

            const joinCodeGen = Math.random().toString(36).substring(2, 8).toUpperCase();
            return await db.entities.Team.create({
                name: trimmedName,
                hackathon_id: hackathonId,
                join_code: joinCodeGen,
                members: [{
                    email: user.email,
                    name: user.full_name,
                    role: 'leader'
                }],
                total_score: 0,
                challenges_completed: 0
            });
        },
        onSuccess: (team) => {
            toast.success(`Team "${team.name}" created!`);
            navigate(createPageUrl(`TeamDashboard?teamId=${team.id}`));
        },
        onError: (err) => toast.error(err.message)
    });

    const joinTeamMutation = useMutation({
        mutationFn: async () => {
            if (getEffectiveHackathonStatus(hackathon) !== 'registration_open') {
                throw new Error('Registration is forbidden');
            }
            const team = teams.find(t => t.join_code?.toUpperCase().trim() === joinCode.toUpperCase().trim());
            if (!team) throw new Error('Invalid join code');
            return await db.entities.Team.join(team.id, joinCode);
        },
        onSuccess: (team) => {
            toast.success('Joined team!');
            navigate(createPageUrl(`TeamDashboard?teamId=${team.id}`));
        },
        onError: (err) => toast.error(err.message)
    });

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!hackathon) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Hackathon Not Found</h2>
                        <Button onClick={() => navigate(createPageUrl('Home'))} className="mt-4">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const fmtDt = (dt) => {
        if (!dt) return 'To be announced';
        try { return format(new Date(dt), 'MMM d, h:mm a'); } catch { return 'Invalid date'; }
    };

    const totalRounds = hackathon.total_rounds || 1;
    const isMultiRound = totalRounds > 1;
    const isFull = hackathon?.max_teams && teams.length >= hackathon.max_teams;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 py-10 px-4">
            <div className="max-w-6xl mx-auto">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <Button
                        variant="ghost"
                        onClick={() => navigate(createPageUrl('Home'))}
                        className="text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Competitions
                    </Button>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* ── Left Column: Hackathon Details ── */}
                    <div className="lg:col-span-2 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Card className="overflow-hidden border-0 shadow-2xl bg-white/70 backdrop-blur-md">
                                <div className="h-3 bg-gradient-to-r from-emerald-500 to-blue-500" />
                                <CardContent className="p-8">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-3 py-1 text-xs uppercase font-bold tracking-wider rounded-lg shadow-sm">
                                                    Registration Open
                                                </Badge>
                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                                    <Info className="w-3.5 h-3.5" />
                                                    Event ID: {hackathon.id.slice(0, 8)}
                                                </div>
                                            </div>
                                            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                                                {hackathon.title}
                                            </h1>
                                            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl font-medium">
                                                {hackathon.description || "The organizers haven't provided a detailed description yet, but get ready for an intense SQL challenge!"}
                                            </p>
                                        </div>
                                        <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 shadow-inner">
                                            <Trophy className="w-10 h-10 text-emerald-600" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3" /> Start Date
                                            </p>
                                            <p className="text-sm font-bold text-slate-800">{fmtDt(hackathon.start_time)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" /> Duration
                                            </p>
                                            <p className="text-sm font-bold text-slate-800">
                                                {hackathon.start_time && hackathon.end_time 
                                                    ? Math.round((new Date(hackathon.end_time) - new Date(hackathon.start_time)) / 3600000) + " Hours"
                                                    : "N/A"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Users className="w-3 h-3" /> Slots
                                            </p>
                                            <p className="text-sm font-bold text-slate-800">{teams.length} / {hackathon.max_teams || 50} Teams</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                                                <Zap className="w-3 h-3" /> Challenges
                                            </p>
                                            <p className="text-sm font-bold text-slate-800">{challenges.length} Total</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Rules & Guidelines */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                        Rules & Guidelines
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { t: "Anti-Cheat Enforcement", d: "A dedicated system monitors window switches, copy-pasting, and fullscreen exits." },
                                            { t: "Team Integrity", d: "Maximum " + (hackathon.max_members || 4) + " members per team. Members cannot switch teams after start." },
                                            { t: "Scoring Logic", d: "Points are awarded based on query accuracy and complexity. Ties are broken by submission time." },
                                            { t: "Submission Limit", d: "Unlimited submissions, but only your highest score per challenge is recorded." }
                                        ].map((rule, i) => (
                                            <div key={i} className="group p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-colors">
                                                <p className="text-sm font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">{rule.t}</p>
                                                <p className="text-xs text-slate-500 leading-relaxed">{rule.d}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Scoring Breakdown */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-500" />
                                        Scoring System
                                    </h3>
                                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                                        <div className="space-y-5 relative z-10">
                                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                                <span className="text-sm text-slate-400 font-medium">Easy Challenge</span>
                                                <span className="text-emerald-400 font-black">100 Pts</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                                <span className="text-sm text-slate-400 font-medium">Medium Challenge</span>
                                                <span className="text-blue-400 font-black">250 Pts</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                                <span className="text-sm text-slate-400 font-medium">Hard Challenge</span>
                                                <span className="text-purple-400 font-black">500 Pts</span>
                                            </div>
                                            <div className="pt-2">
                                                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-2">Bonus Points</p>
                                                <p className="text-xs text-slate-300 leading-relaxed">
                                                    First blood bonuses and round-specific multipliers may apply!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                        
                        {/* Preparation & Info */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <div className="p-6 bg-emerald-600 rounded-[2rem] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-emerald-200" />
                                        Ready for the challenge?
                                    </h3>
                                    <p className="text-emerald-50 text-sm leading-relaxed max-w-lg">
                                        Make sure you are familiar with advanced SQL joins, window functions, and subqueries. 
                                        All contests use actual datasets for a real-world experience.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-xs font-bold text-emerald-100">
                                        Live Ranking
                                    </div>
                                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-xs font-bold text-emerald-100">
                                        Team Collab
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* ── Right Column: Join Actions ── */}
                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden sticky top-8">
                                <CardHeader className="bg-slate-900 text-white p-8 pb-0">
                                    <CardTitle className="text-2xl font-black tracking-tight mb-2">Get Started</CardTitle>
                                    <p className="text-slate-400 text-sm font-medium">Choose your entry path</p>
                                    <div className="h-4" />
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <Tabs defaultValue="create" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 p-1.5 bg-slate-100 rounded-2xl h-14">
                                            <TabsTrigger value="create" className="rounded-xl font-bold text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                Create
                                            </TabsTrigger>
                                            <TabsTrigger value="join" className="rounded-xl font-bold text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                Join
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="create" className="space-y-6 mt-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">Team Name</Label>
                                                <Input
                                                    placeholder="The SQL Wizards..."
                                                    value={teamName}
                                                    onChange={(e) => setTeamName(e.target.value)}
                                                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base font-semibold"
                                                />
                                            </div>
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 h-16 rounded-[1.5rem] shadow-lg shadow-emerald-500/20 text-lg font-black transition-all hover:-translate-y-1 active:translate-y-0"
                                                onClick={() => createTeamMutation.mutate()}
                                                disabled={!teamName.trim() || createTeamMutation.isPending || isFull}
                                            >
                                                {createTeamMutation.isPending ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>Create My Team <ArrowLeft className="w-5 h-5 ml-2 rotate-180" /></>
                                                )}
                                            </Button>
                                            <div className="flex items-center gap-2 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                                <UserPlus className="w-4 h-4 text-blue-500" />
                                                <p className="text-[10px] text-blue-700 font-bold leading-tight">
                                                    You'll be the Team Leader and get a code to share.
                                                </p>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="join" className="space-y-6 mt-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">Join Code</Label>
                                                <Input
                                                    placeholder="E.G. X7KP2Q"
                                                    value={joinCode}
                                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white text-center text-xl font-black tracking-widest"
                                                    maxLength={6}
                                                />
                                            </div>
                                            <Button
                                                className="w-full bg-slate-900 hover:bg-slate-800 h-16 rounded-[1.5rem] shadow-lg shadow-slate-900/20 text-lg font-black transition-all hover:-translate-y-1 active:translate-y-0"
                                                onClick={() => joinTeamMutation.mutate()}
                                                disabled={joinCode.length !== 6 || joinTeamMutation.isPending}
                                            >
                                                {joinTeamMutation.isPending ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>Join Team <UserPlus className="w-5 h-5 ml-2" /></>
                                                )}
                                            </Button>
                                            <div className="flex items-center gap-2 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                                <p className="text-[10px] text-amber-700 font-bold leading-tight">
                                                    Verify your team name before joining!
                                                </p>
                                            </div>
                                        </TabsContent>
                                    </Tabs>

                                    {isFull && (
                                        <p className="text-sm text-red-500 font-black text-center mt-4">
                                            HACKATHON IS FULL! (Max {hackathon.max_teams})
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}