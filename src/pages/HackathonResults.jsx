import React, { useState } from 'react';
import { db } from '@/api/dataClient';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    ArrowLeft,
    Trophy,
    Users,
    Target,
    Medal,
    BarChart3,
    Clock,
    Loader2,
    Zap,
    CheckCircle2,
    AlertTriangle,
    Download,
    Layers
} from 'lucide-react';
import { motion } from 'framer-motion';
import { generateCertificatePDF } from '@/utils/generateCertificate';
import { format } from 'date-fns';
import { toast } from 'sonner';

const podiumColors = {
    0: 'from-yellow-400 to-amber-500',
    1: 'from-slate-300 to-slate-400',
    2: 'from-amber-600 to-amber-700'
};

const podiumLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

export default function HackathonResults() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hackathonId = searchParams.get('id');
    const { user } = useAuth();
    const [selectedRound, setSelectedRound] = useState('overall');

    const { data: hackathon, isLoading: hackLoading } = useQuery({
        queryKey: ['hackathon', hackathonId],
        queryFn: async () => {
            const list = await db.entities.Hackathon.list();
            return list.find(h => h.id === hackathonId) || null;
        }
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['results-teams', hackathonId],
        queryFn: () => db.entities.Team.filter({ hackathon_id: hackathonId }),
        enabled: !!hackathonId
    });

    const queryClient = useQueryClient();
    React.useEffect(() => {
        if (!hackathonId || window.IS_MOCK_MODE) return;
        const channel = supabase
            .channel(`results-teams-${hackathonId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `hackathon_id=eq.${hackathonId}` }, 
            () => queryClient.invalidateQueries(['results-teams', hackathonId]))
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [hackathonId, queryClient]);

    const { data: challenges = [] } = useQuery({
        queryKey: ['results-challenges', hackathonId],
        queryFn: () => db.entities.Challenge.filter({ hackathon_id: hackathonId }),
        enabled: !!hackathonId
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['results-submissions', hackathonId],
        queryFn: async () => {
            const all = await db.entities.Submission.list();
            return all.filter(s => teams.some(t => t.id === s.team_id));
        },
        enabled: teams.length > 0
    });

    if (hackLoading) {
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
                        <Button onClick={() => navigate(createPageUrl('Home'))}>Go Home</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!hackathon.results_published) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-6">
                <Card className="max-w-md border-0 shadow-xl">
                    <CardContent className="p-10 text-center">
                        <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Results Not Published Yet</h2>
                        <p className="text-slate-500 mb-6">
                            The hackathon organizer hasn't published the results yet. Check back soon!
                        </p>
                        <Button onClick={() => navigate(createPageUrl('Home'))} className="bg-emerald-600 hover:bg-emerald-700">
                            Go Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Sort teams by score — per-round or overall
    const totalRounds  = hackathon.total_rounds  || 1;
    const roundsConfig = hackathon.rounds_config || [];

    const getTeamRoundScore = (team, roundNum) => {
        const rs = team.round_scores || {};
        return rs[String(roundNum)] || 0;
    };

    const displayTeams = selectedRound === 'overall'
        ? [...teams].sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
        : [...teams].sort((a, b) => getTeamRoundScore(b, parseInt(selectedRound)) - getTeamRoundScore(a, parseInt(selectedRound)));

    const rankedTeams = displayTeams;
    const topThree = rankedTeams.slice(0, 3);

    // Stats
    const totalSubmissions = submissions.length;
    const correctSubmissions = submissions.filter(s => s.status === 'correct').length;
    const uniqueSolvers = new Set(submissions.filter(s => s.status === 'correct').map(s => s.team_id)).size;
    const avgScore = rankedTeams.length > 0
        ? Math.round(rankedTeams.reduce((acc, t) => acc + (t.total_score || 0), 0) / rankedTeams.length)
        : 0;

    // Per-team details
    const getTeamStats = (team) => {
        const teamSubs = submissions.filter(s => s.team_id === team.id);
        const solved = new Set(teamSubs.filter(s => s.status === 'correct').map(s => s.challenge_id)).size;
        const totalViolations = teamSubs.reduce((acc, s) => {
            const v = s.violation_data ? (typeof s.violation_data === 'string' ? JSON.parse(s.violation_data) : s.violation_data) : null;
            return acc + (v?.total_violations || 0);
        }, 0);
        return { submissions: teamSubs.length, solved, totalViolations };
    };

    // Item 6: CSV Export
    const exportCSV = () => {
        const headers = ['Rank', 'Team Name', 'Score', 'Challenges Solved', 'Submissions', 'Violations', 'Members'];
        const rows = rankedTeams.map((team, i) => {
            const stats = getTeamStats(team);
            const members = team.members?.map(m => m.name || m.email).join('; ') || '';
            return [i + 1, team.name, team.total_score || 0, `${stats.solved}/${challenges.length}`, stats.submissions, stats.totalViolations, members];
        });
        const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${hackathon.title || 'hackathon'}_results.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-slate-900">{hackathon.title}</h1>
                        <p className="text-slate-500">{totalRounds > 1 ? `${totalRounds}-Round Hackathon — Final Results` : 'Final Results'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(user?.role === 'admin' || user?.role === 'organizer') && (
                            <Button variant="outline" size="sm" onClick={exportCSV} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                <Download className="w-4 h-4 mr-2" />
                                Download CSV
                            </Button>
                        )}
                        <Badge className="bg-purple-100 text-purple-700 border-0 text-lg px-4 py-1">
                            Completed
                        </Badge>
                    </div>
                </div>

                {/* Round tabs — only for multi-round hackathons */}
                {totalRounds > 1 && (
                    <div className="flex gap-2 mb-6 flex-wrap">
                        <button
                            onClick={() => setSelectedRound('overall')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                                selectedRound === 'overall'
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'
                            }`}
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            Overall
                        </button>
                        {Array.from({ length: totalRounds }, (_, i) => {
                            const rn = i + 1;
                            const cfg = roundsConfig.find(r => r.round_number === rn);
                            return (
                                <button
                                    key={rn}
                                    onClick={() => setSelectedRound(String(rn))}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                                        selectedRound === String(rn)
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    Round {rn}
                                    {cfg?.status === 'completed' && (
                                        <span className="text-xs ml-1 opacity-70">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Score context for per-round view */}
                {selectedRound !== 'overall' && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                        Showing scores earned in <strong>Round {selectedRound}</strong> only.
                        Switch to <button className="underline font-semibold" onClick={() => setSelectedRound('overall')}>Overall</button> to see cumulative rankings.
                    </div>
                )}

                {/* Podium */}
                {topThree.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {topThree.map((team, i) => (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.2 }}
                            >
                                <Card className={`border-0 shadow-xl overflow-hidden ${i === 0 ? 'md:order-2 ring-2 ring-yellow-400' : i === 1 ? 'md:order-1' : 'md:order-3'}`}>
                                    <div className={`h-2 bg-gradient-to-r ${podiumColors[i]}`} />
                                    <CardContent className="p-6 text-center">
                                        <div className="text-4xl mb-2">{['🥇', '🥈', '🥉'][i]}</div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-1">{team.name}</h3>
                                        <p className="text-sm text-slate-500 mb-3">{podiumLabels[i]}</p>
                                        <div className="text-3xl font-bold text-emerald-600">
                                            {selectedRound === 'overall'
                                                ? (team.total_score || 0)
                                                : getTeamRoundScore(team, parseInt(selectedRound))}
                                        </div>
                                        <p className="text-xs text-slate-400">points{selectedRound !== 'overall' ? ` (Round ${selectedRound})` : ' (total)'}</p>
                                        {(() => {
                                            const stats = getTeamStats(team);
                                            return (
                                                <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500">
                                                    <span>{stats.solved}/{challenges.length} solved</span>
                                                    <span>{stats.submissions} submissions</span>
                                                </div>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Teams', value: teams.length, icon: Users, color: 'text-blue-500' },
                        { label: 'Challenges', value: challenges.length, icon: Target, color: 'text-emerald-500' },
                        { label: 'Total Submissions', value: totalSubmissions, icon: Zap, color: 'text-amber-500' },
                        { label: 'Avg Score', value: avgScore, icon: BarChart3, color: 'text-purple-500' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
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

                {/* Full Leaderboard */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Full Leaderboard
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {rankedTeams.map((team, i) => {
                                const stats = getTeamStats(team);
                                const userEmail = user?.email?.toLowerCase();
                                const isCurrentTeam = userEmail && team.members?.some(m => {
                                    if (!m) return false;
                                    const memberEmail = typeof m === 'object' ? m.email : typeof m === 'string' ? m : '';
                                    return memberEmail?.toLowerCase() === userEmail;
                                });
                                
                                return (
                                    <motion.div
                                        key={team.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 + i * 0.05 }}
                                        className={`flex items-center gap-4 p-4 rounded-xl transition ${
                                            isCurrentTeam 
                                                ? 'bg-emerald-50 ring-2 ring-emerald-500 shadow-sm'
                                                : i < 3 
                                                    ? 'bg-gradient-to-r from-emerald-50 to-transparent' 
                                                    : 'bg-slate-50 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                            isCurrentTeam ? 'bg-emerald-100 text-emerald-700' :
                                            i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            i === 1 ? 'bg-slate-200 text-slate-700' :
                                            i === 2 ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-900">{team.name}</span>
                                                {isCurrentTeam && (
                                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                                        Your Team
                                                    </span>
                                                )}
                                                {isCurrentTeam && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="ml-auto text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-7 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const member = team.members?.find(m => {
                                                                const email = typeof m === 'object' ? m.email : typeof m === 'string' ? m : '';
                                                                return email?.toLowerCase() === userEmail;
                                                            });
                                                            const memberName = typeof member === 'object' ? (member.name || member.email) : member;
                                                            
                                                            generateCertificatePDF({
                                                                type: i < 3 ? 'winner' : 'participation',
                                                                recipientName: memberName || user.name || user.email,
                                                                teamName: team.name,
                                                                hackathonTitle: hackathon.title,
                                                                date: format(new Date(), 'MMMM d, yyyy'),
                                                                rank: i < 3 ? i + 1 : null,
                                                                certSettings: hackathon.certificate_settings || {}
                                                            });
                                                            toast.success('Certificate generated!');
                                                        }}
                                                    >
                                                        <Download className="w-3 h-3 mr-1" />
                                                        Get Certificate
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {stats.solved}/{challenges.length} solved
                                                </span>
                                                <span>{stats.submissions} submissions</span>
                                                {stats.totalViolations > 0 && (
                                                    <span className="text-red-500 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {stats.totalViolations} violations
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-emerald-600">
                                                {selectedRound === 'overall'
                                                    ? (team.total_score || 0)
                                                    : getTeamRoundScore(team, parseInt(selectedRound))}
                                            </div>
                                            <div className="text-xs text-slate-400">{selectedRound === 'overall' ? 'total pts' : `rnd ${selectedRound} pts`}</div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
