import React, { useState } from 'react';
import { db } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    Zap,
    Target,
    ArrowRight,
    Users,
    Clock,
    Plus,
    LogOut,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Dashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [leavingTeamId, setLeavingTeamId] = useState(null);

    const { data: myTeams = [], isLoading } = useQuery({
        queryKey: ['my-teams', user?.email],
        queryFn: async () => {
            if (!user?.email) return [];
            const allTeams = await db.entities.Team.list();
            return allTeams.filter(team =>
                team.members?.some(m => (typeof m === 'string' ? m : m.email) === user.email) ||
                team.created_by === user.email
            );
        },
        enabled: !!user?.email
    });

    const { data: hackathons = [] } = useQuery({
        queryKey: ['hackathons'],
        queryFn: () => db.entities.Hackathon.list()
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['my-submissions', myTeams],
        queryFn: async () => {
            if (myTeams.length === 0) return [];
            const teamIds = myTeams.map(t => t.id);
            const allSubs = await db.entities.Submission.list();
            return allSubs.filter(s => teamIds.includes(s.team_id));
        },
        enabled: myTeams.length > 0
    });

    const leaveTeamMutation = useMutation({
        mutationFn: async (team) => {
            const firstMemberEmail = team.members?.[0] ? (typeof team.members[0] === 'string' ? team.members[0] : team.members[0].email) : null;
            const isCreator = team.created_by === user.email || firstMemberEmail === user.email;
            
            if (isCreator && team.members?.length === 1) {
                // Last person leaving, delete the team entirely
                await db.entities.Team.delete(team.id);
            } else if (isCreator && team.members?.length > 1) {
                throw new Error("You are the team creator. You cannot leave while others are in the team.");
            } else {
                // Just remove this member securely handling both formats
                const updatedMembers = team.members.filter(m => {
                    const memberEmail = typeof m === 'string' ? m : m.email;
                    return memberEmail !== user.email;
                });
                await db.entities.Team.update(team.id, { members: updatedMembers });
            }
        },
        onSuccess: () => {
            toast.success("Left the team successfully");
            queryClient.invalidateQueries(['my-teams']);
        },
        onError: (e) => {
            toast.error(e.message || "Failed to leave team");
        },
        onSettled: () => {
            setLeavingTeamId(null);
        }
    });

    const handleLeaveTeam = (team) => {
        if (window.confirm(`Are you sure you want to leave ${team.name}?`)) {
            setLeavingTeamId(team.id);
            leaveTeamMutation.mutate(team);
        }
    };

    const getHackathon = (id) => hackathons.find(h => h.id === id);

    const totalScore = myTeams.reduce((sum, team) => sum + (team.total_score || 0), 0);
    const totalChallenges = myTeams.reduce((sum, team) => sum + (team.challenges_completed || 0), 0);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-slate-100 p-1">
                        <img 
                            src={`https://api.dicebear.com/7.x/${user.avatar_style || 'initials'}/svg?seed=${encodeURIComponent(user.avatar_seed || user.email)}`} 
                            alt="Profile" 
                            className="w-full h-full rounded-xl object-cover"
                        />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            Welcome back, {user.full_name || 'Champion'}! 👋
                        </h1>
                        <p className="text-slate-500 font-medium">Track your progress and continue competing</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Score', value: totalScore, icon: Zap, color: 'text-amber-500' },
                        { label: 'Challenges Solved', value: totalChallenges, icon: Target, color: 'text-emerald-500' },
                        { label: 'Active Teams', value: myTeams.length, icon: Users, color: 'text-blue-500' },
                        { label: 'Submissions', value: submissions.length, icon: Clock, color: 'text-purple-500' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-5">
                                    <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                                    <div className="text-sm text-slate-500">{stat.label}</div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* My Teams */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">My Teams</h2>
                        <Link to={createPageUrl('Home')}>
                            <Button variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-1" />
                                Join New Hackathon
                            </Button>
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : myTeams.length === 0 ? (
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-8 text-center">
                                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Teams Yet</h3>
                                <p className="text-slate-500 mb-4">Join a hackathon to start competing!</p>
                                <Link to={createPageUrl('Home')}>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                                        Browse Hackathons
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {myTeams.map((team, i) => {
                                const hackathon = getHackathon(team.hackathon_id);
                                const hackStatus = getEffectiveHackathonStatus(hackathon);
                                return (
                                    <motion.div
                                        key={team.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <Card className="border-0 shadow-sm hover:shadow-lg transition-all relative">
                                            <CardContent className="p-6">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="text-lg font-semibold text-slate-900">{team.name}</h3>
                                                            <Badge variant="outline" className="text-xs">
                                                                {team.members?.length || 1} member{(team.members?.length || 1) > 1 ? 's' : ''}
                                                            </Badge>
                                                            {hackStatus === 'in_progress' && (
                                                                <Badge className="bg-green-100 text-green-700 border-0 animate-pulse">
                                                                    🟢 Live
                                                                </Badge>
                                                            )}
                                                            {hackStatus === 'completed' && (
                                                                <Badge className="bg-purple-100 text-purple-700 border-0">
                                                                    Completed
                                                                </Badge>
                                                            )}
                                                            {/* Only allow leaving if hackathon is not locked/completed/in-progress to avoid mid-contest dropping without penalty */}
                                                            {hackStatus === 'registration_open' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2 h-7 px-2"
                                                                    onClick={() => handleLeaveTeam(team)}
                                                                    disabled={leavingTeamId === team.id || leaveTeamMutation.isPending}
                                                                >
                                                                    {leavingTeamId === team.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
                                                                    Leave
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500">
                                                            {hackathon?.title || 'Unknown Hackathon'}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-emerald-600">{team.total_score || 0}</div>
                                                            <div className="text-xs text-slate-500">Points</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-slate-700">{team.challenges_completed || 0}</div>
                                                            <div className="text-xs text-slate-500">Solved</div>
                                                        </div>
                                                        <Link to={
                                                            hackStatus === 'completed'
                                                                ? createPageUrl(`HackathonResults?id=${hackathon?.id}`)
                                                                : createPageUrl(`TeamDashboard?teamId=${team.id}`)
                                                        }>
                                                            <Button 
                                                                className={
                                                                    hackStatus === 'in_progress'
                                                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                        : hackStatus === 'completed'
                                                                            ? 'bg-purple-600 hover:bg-purple-700'
                                                                            : 'bg-slate-700 hover:bg-slate-600'
                                                                }
                                                            >
                                                                {hackStatus === 'in_progress' ? 'Resume' :
                                                                    hackStatus === 'completed' 
                                                                        ? (hackathon?.results_published ? 'View Results' : 'View Stats') 
                                                                        : 'Open'}
                                                                <ArrowRight className="w-4 h-4 ml-2" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                {submissions.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">Recent Submissions</h2>
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {submissions.slice(0, 5).map((sub, i) => (
                                        <div key={sub.id} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${sub.status === 'correct' ? 'bg-emerald-500' :
                                                    sub.status === 'incorrect' ? 'bg-red-500' : 'bg-yellow-500'
                                                    }`} />
                                                <span className="text-slate-700">Challenge #{sub.challenge_id?.slice(-4)}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge className={
                                                    sub.status === 'correct' ? 'bg-emerald-100 text-emerald-700' :
                                                        sub.status === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                }>
                                                    {sub.status}
                                                </Badge>
                                                <span className="text-sm text-slate-500">
                                                    +{sub.score || 0} pts
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}