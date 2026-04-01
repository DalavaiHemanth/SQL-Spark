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
    CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
        refetchInterval: 5000  // Refresh every 5s so newly-created teams appear immediately
    });

    // Fetch challenges to show per-round counts
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
            // CHECK FOR DUPLICATE TEAM NAME
            const trimmedName = teamName.trim();
            const nameExists = teams.some(t => t.name?.toLowerCase().trim() === trimmedName.toLowerCase());
            if (nameExists) {
                throw new Error(`The team name "${trimmedName}" is already taken in this hackathon. Please choose another.`);
            }

            const joinCodeGen = Math.random().toString(36).substring(2, 8).toUpperCase();
            const team = await db.entities.Team.create({
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
            return team;
        },
        onSuccess: (team) => {
            toast.success(`Team "${team.name}" created successfully!`);
            navigate(createPageUrl(`TeamDashboard?teamId=${team.id}`));
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to create team');
        }
    });

    const joinTeamMutation = useMutation({
        mutationFn: async () => {
            if (getEffectiveHackathonStatus(hackathon) !== 'registration_open') {
                throw new Error('Registration is not open for this hackathon');
            }
            
            // The RPC handles join code validation and user member addition securely
            const team = teams.find(t => t.join_code?.toUpperCase().trim() === joinCode.toUpperCase().trim());
            if (!team) throw new Error('Invalid join code');

            const result = await db.entities.Team.join(team.id, joinCode);
            return result;
        },
        onSuccess: (team) => {
            toast.success('Joined team successfully!');
            navigate(createPageUrl(`TeamDashboard?teamId=${team.id}`));
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to join team');
        }
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Hackathon Not Found</h2>
                        <p className="text-slate-500 mb-4">This hackathon doesn't exist or has been removed.</p>
                        <Button onClick={() => navigate(createPageUrl('Home'))}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Check if user already has a team in this hackathon
    const existingTeam = teams.find(t =>
        t.members?.some(m => m.email === user.email) ||
        t.created_by === user.email
    );

    if (existingTeam) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full border-0 shadow-xl">
                    <CardContent className="p-8 text-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">You're Already In!</h2>
                        <p className="text-slate-500 mb-6">
                            You're already part of team <strong>{existingTeam.name}</strong> in this hackathon.
                        </p>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 w-full"
                            onClick={() => navigate(createPageUrl(`TeamDashboard?teamId=${existingTeam.id}`))}
                        >
                            Go to Team Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Block registration if not open
    const effectiveStatus = getEffectiveHackathonStatus(hackathon);
    if (effectiveStatus !== 'registration_open') {
        const isCompleted = effectiveStatus === 'completed';
        const resultsPublished = hackathon.results_published;

        const statusMessages = {
            draft: { icon: '🔒', title: 'Registration Not Open Yet', desc: 'This hackathon is still being set up. Check back later.' },
            in_progress: { icon: '🏃', title: 'Contest Already Started', desc: 'This hackathon is currently in progress. Registration is closed.' },
            completed: { 
                icon: resultsPublished ? '🏆' : '🏁', 
                title: resultsPublished ? 'Results are Out!' : 'Hackathon Ended', 
                desc: resultsPublished 
                    ? 'The final rankings are in. Check out who topped the leaderboard!' 
                    : 'This hackathon has finished. We are currently finalizing the results.' 
            },
        };

        const msg = statusMessages[effectiveStatus] || { icon: '⛔', title: 'Registration Unavailable', desc: 'Registration is not currently open.' };
        
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full border-0 shadow-xl">
                    <CardContent className="p-8 text-center">
                        <div className="text-5xl mb-4">{msg.icon}</div>
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">{msg.title}</h2>
                        <p className="text-slate-500 mb-6">{msg.desc}</p>
                        
                        <div className="space-y-3">
                            {isCompleted && resultsPublished ? (
                                <Button 
                                    className="w-full bg-purple-600 hover:bg-purple-700 h-12"
                                    onClick={() => navigate(createPageUrl(`HackathonResults?id=${hackathon.id}`))}
                                >
                                    <Trophy className="w-4 h-4 mr-2" />
                                    View Final Results
                                </Button>
                            ) : isCompleted ? (
                                <Button 
                                    className="w-full bg-slate-100 text-slate-600 h-12 border-0 cursor-default hover:bg-slate-100"
                                    disabled
                                >
                                    <Clock className="w-4 h-4 mr-2 text-amber-500" />
                                    Results Pending
                                </Button>
                            ) : null}

                            <Button variant="outline" className="w-full h-12" onClick={() => navigate(createPageUrl('Home'))}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Home
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Helper: format datetime nicely
    const fmtDt = (dt) => {
        if (!dt) return null;
        try { return format(new Date(dt), 'MMM d, yyyy · h:mm a'); } catch { return null; }
    };

    const totalRounds = hackathon.total_rounds || 1;
    const roundsConfig = hackathon.rounds_config || [];
    const isMultiRound = totalRounds > 1;

    // Per-round challenge counts
    const challengeCountByRound = {};
    challenges.forEach(c => {
        const rn = c.round_number || 1;
        challengeCountByRound[rn] = (challengeCountByRound[rn] || 0) + 1;
    });

    const isFull = hackathon?.max_teams && teams.length >= hackathon.max_teams;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
            <div className="max-w-2xl mx-auto">
                <Button
                    variant="ghost"
                    className="mb-6"
                    onClick={() => navigate(createPageUrl('Home'))}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>

                {/* ── Hackathon Details Card ── */}
                <Card className="border-0 shadow-lg mb-6">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-emerald-100 flex-shrink-0">
                                <Trophy className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-2">
                                    Registration Open
                                </Badge>
                                <h1 className="text-2xl font-bold text-slate-900 mb-1">{hackathon.title}</h1>
                                {hackathon.description && (
                                    <p className="text-slate-500 text-sm leading-relaxed">{hackathon.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Quick stats row */}
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500 border-t border-slate-100 pt-4 mb-4">
                            {hackathon.start_time && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-emerald-500" />
                                    <span>Starts {fmtDt(hackathon.start_time)}</span>
                                </div>
                            )}
                            {hackathon.end_time && (
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span>Ends {fmtDt(hackathon.end_time)}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-violet-400" />
                                <span>{teams.length} / {hackathon.max_teams || 50} teams registered</span>
                            </div>
                            {isMultiRound && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-blue-500">R</span>
                                    <span>{totalRounds} Rounds</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="text-amber-500">⚡</span>
                                <span>{challenges.length} challenge{challenges.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* ── Multi-Round Schedule ── */}
                        {isMultiRound && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    📋 Round Schedule
                                </h3>
                                <div className="space-y-2">
                                    {Array.from({ length: totalRounds }, (_, i) => {
                                        const rn = i + 1;
                                        const cfg = roundsConfig.find(r => r.round_number === rn) || { round_number: rn, name: `Round ${rn}`, status: 'upcoming' };
                                        const count = challengeCountByRound[rn] || 0;
                                        const statusColors = {
                                            active: 'bg-emerald-50 border-emerald-200',
                                            completed: 'bg-slate-50 border-slate-200',
                                            upcoming: 'bg-blue-50 border-blue-100',
                                        };
                                        const badgeColors = {
                                            active: 'bg-emerald-100 text-emerald-700',
                                            completed: 'bg-slate-100 text-slate-600',
                                            upcoming: 'bg-blue-100 text-blue-700',
                                        };
                                        return (
                                            <div key={rn} className={`rounded-xl border p-3 flex items-center gap-4 ${statusColors[cfg.status] || statusColors.upcoming}`}>
                                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm flex-shrink-0">
                                                    {rn}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-800 text-sm">{cfg.name}</span>
                                                        <Badge className={`text-[10px] border-0 ${badgeColors[cfg.status] || badgeColors.upcoming}`}>
                                                            {cfg.status === 'active' ? '🟢 Active' : cfg.status === 'completed' ? '✅ Done' : '⏳ Upcoming'}
                                                        </Badge>
                                                        {cfg.qualification_score != null && cfg.status === 'completed' && (
                                                            <span className="text-xs text-slate-500">Cutoff: <strong>{cfg.qualification_score} pts</strong></span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                                                        {cfg.start_time && <span><Calendar className="w-3 h-3 inline mr-0.5" />{fmtDt(cfg.start_time)}</span>}
                                                        {cfg.end_time && <span>→ {fmtDt(cfg.end_time)}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-xs font-semibold text-slate-600">{count}</span>
                                                    <span className="text-xs text-slate-400 ml-1">challenge{count !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Join Options */}
                <Card className="border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle>Join the Hackathon</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="create" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="create">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Team
                                </TabsTrigger>
                                <TabsTrigger value="join">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Join Team
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="create" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="teamName">Team Name</Label>
                                    <Input
                                        id="teamName"
                                        placeholder="Enter your team name"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="h-12"
                                    />
                                </div>
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                                    onClick={() => createTeamMutation.mutate()}
                                    disabled={!teamName.trim() || createTeamMutation.isPending || isFull}
                                >
                                    {createTeamMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4 mr-2" />
                                    )}
                                    {isFull ? 'Hackathon Full' : 'Create Team'}
                                </Button>
                                {isFull ? (
                                    <p className="text-xs text-red-500 font-medium text-center">
                                        Team limit reached — maximum of {hackathon.max_teams} teams allowed.
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500 text-center">
                                        You'll receive a join code to share with teammates
                                    </p>
                                )}
                            </TabsContent>

                            <TabsContent value="join" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="joinCode">Team Join Code</Label>
                                    <Input
                                        id="joinCode"
                                        placeholder="Enter 6-character code"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        className="h-12 text-center text-lg font-mono tracking-widest"
                                        maxLength={6}
                                    />
                                </div>
                                <Button
                                    className="w-full bg-slate-900 hover:bg-slate-800 h-12"
                                    onClick={() => joinTeamMutation.mutate()}
                                    disabled={joinCode.length !== 6 || joinTeamMutation.isPending}
                                >
                                    {joinTeamMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <UserPlus className="w-4 h-4 mr-2" />
                                    )}
                                    Join Team
                                </Button>
                                <p className="text-xs text-slate-500 text-center">
                                    Ask your team leader for the join code
                                </p>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}