import React, { useState, useMemo } from 'react';
import { db } from '@/api/dataClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/api/supabaseClient';
import { 
    Trophy, 
    Search, 
    Users, 
    Star,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getTier } from '@/utils/ranking';
import { useAuth } from '@/lib/AuthContext';

const RANK_COLORS = {
    0: 'text-yellow-500 bg-yellow-50 border-yellow-200',
    1: 'text-slate-400 bg-slate-50 border-slate-200',
    2: 'text-amber-600 bg-amber-50 border-amber-200',
};

export default function GlobalLeaderboard() {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Subscribe to realtime updates for teams table
    React.useEffect(() => {
        const channel = supabase
            .channel('leaderboard-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'teams'
                },
                (payload) => {
                    console.log('Realtime change received:', payload);
                    queryClient.invalidateQueries({ queryKey: ['all-teams-global'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const { data: teams = [], isLoading: teamsLoading } = useQuery({
        queryKey: ['all-teams-global'],
        queryFn: () => db.entities.Team.list()
    });

    // Fetch current user details (names/avatars) from Supabase to ensure leaderboard is up to date
    const { data: publicUsers = [] } = useQuery({
        queryKey: ['public-users'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_public_leaderboard_users');
            if (error) return [];
            return data;
        }
    });

    const leaderboardData = useMemo(() => {
        // 1. Aggregate scores from teams first
        const teamScoreMap = new Map();
        teams.forEach(team => {
            if (!team.members) return;
            team.members.forEach(member => {
                const rawEmail = (member && typeof member === 'object') ? member.email : member;
                if (!rawEmail || typeof rawEmail !== 'string') return;
                const email = rawEmail.toLowerCase().trim();
                teamScoreMap.set(email, (teamScoreMap.get(email) || 0) + (team.total_score || 0));
            });
        });

        // 2. Base the leaderboard on the current list of active users from Supabase
        // If publicUsers is empty (e.g. RPC not run), we fallback to the old team-based aggregation
        if (!publicUsers || publicUsers.length === 0) {
            const tempMap = new Map();
            teams.forEach(team => {
                if (!team.members) return;
                team.members.forEach(member => {
                    const rawEmail = (member && typeof member === 'object') ? member.email : member;
                    if (!rawEmail || typeof rawEmail !== 'string') return;
                    const email = rawEmail.toLowerCase().trim();
                    const existing = tempMap.get(email) || { 
                        email, 
                        username: (member && typeof member === 'object') ? (member.name || member.full_name || email.split('@')[0]) : email.split('@')[0], 
                        totalScore: 0, 
                        teamsCount: 0 
                    };
                    existing.totalScore += (team.total_score || 0);
                    existing.teamsCount += 1;
                    tempMap.set(email, existing);
                });
            });
            return Array.from(tempMap.values())
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((user, index) => ({ ...user, rank: index + 1 }));
        }

        // 3. Map active users to their scores
        return publicUsers.filter(u => u && u.email).map((u, index) => {
            const email = u.email.toLowerCase().trim();
            const score = teamScoreMap.get(email) || 0;
            const teamsCount = teams.filter(t => 
                t.members?.some(m => {
                    const mEmail = (m && typeof m === 'object') ? m.email : m;
                    return mEmail?.toLowerCase().trim() === email;
                })
            ).length;

            return {
                email,
                username: u.full_name || email.split('@')[0],
                totalScore: score,
                teamsCount,
                avatar_style: u.avatar_style,
                avatar_seed: u.avatar_seed
            };
        })
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((user, index) => ({ ...user, rank: index + 1 }));
    }, [teams, publicUsers]);

    const filteredLeaderboard = useMemo(() => {
        return leaderboardData.filter(user => 
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [leaderboardData, searchTerm]);

    if (teamsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const topThree = leaderboardData.slice(0, 3);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center md:justify-start gap-3">
                            <Trophy className="w-10 h-10 text-yellow-500" />
                            Global Leaderboard
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">Ranking the top SQL Champions across all competitions</p>
                    </div>
                    
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Search by username..." 
                            className="pl-10 bg-white border-slate-200 focus:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Top 3 Podium Cards */}
                {!searchTerm && topThree.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {topThree.map((user, i) => (
                            <motion.div
                                key={user.email}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className={`border-0 shadow-lg overflow-hidden relative ${i === 0 ? 'md:scale-105 z-10' : ''}`}>
                                    <div className={`h-2 bg-gradient-to-r ${i === 0 ? 'from-yellow-400 to-amber-500' : i === 1 ? 'from-slate-300 to-slate-400' : 'from-amber-600 to-amber-700'}`} />
                                    <CardContent className="p-6 text-center">
                                        <div className="text-4xl mb-3">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                                        <h3 className="text-xl font-bold text-slate-900 truncate px-2">{user.username}</h3>
                                        <p className="text-xs text-slate-400 mb-4">{user.teamsCount} Hackathons Joined</p>
                                        
                                        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full font-bold text-2xl">
                                            {user.totalScore}
                                            <span className="text-xs font-normal opacity-70">pts</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Full List */}
                <Card className="border-0 shadow-xl overflow-hidden bg-white/70 backdrop-blur-sm">
                    <CardHeader className="border-b border-slate-100 bg-white/50">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-500" />
                                All Rankings
                            </CardTitle>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                {leaderboardData.length} Contenders
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/50 text-left text-slate-500 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-4 font-semibold">Rank</th>
                                        <th className="px-6 py-4 font-semibold">Username</th>
                                        <th className="px-6 py-4 font-semibold">Stars</th>
                                        <th className="px-6 py-4 font-semibold text-right">Total Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLeaderboard.length > 0 ? (
                                        filteredLeaderboard.map((user, i) => {
                                            const isMe = currentUser?.email === user.email;
                                            return (
                                                <motion.tr 
                                                    key={user.email}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.02 }}
                                                    className={`transition-colors group ${
                                                        isMe ? 'bg-emerald-50/80 ring-1 ring-inset ring-emerald-200 relative z-10' : 'hover:bg-slate-50/50'
                                                    }`}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${
                                                            isMe ? 'bg-emerald-600 text-white border-emerald-400' :
                                                            user.rank <= 3 ? RANK_COLORS[user.rank-1] : 'text-slate-400 bg-white border-slate-100'
                                                        }`}>
                                                            {user.rank}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                                                            <img 
                                                                src={user.avatar_style && user.avatar_seed 
                                                                    ? `https://api.dicebear.com/7.x/${user.avatar_style}/svg?seed=${encodeURIComponent(user.avatar_seed)}`
                                                                    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username)}`
                                                                }
                                                                alt={user.username}
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                            <div className="flex flex-col">
                                                                <span className={`font-semibold transition-colors ${isMe ? 'text-emerald-900' : 'text-slate-700 group-hover:text-emerald-600'}`}>
                                                                    {user.username}
                                                                </span>
                                                                {isMe && <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-black">That's You!</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex gap-0.5 mb-1">
                                                            {[1, 2, 3, 4, 5].map((s) => {
                                                                return (
                                                                    <Star 
                                                                        key={s} 
                                                                        className={`w-3.5 h-3.5 ${s <= getTier(user.totalScore).stars ? `${getTier(user.totalScore).color} fill-current` : 'text-slate-200'}`} 
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                        <span className={`text-xs font-bold ${getTier(user.totalScore).color}`}>
                                                            {getTier(user.totalScore).label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                                                        {user.totalScore.toLocaleString()}
                                                    </div>
                                                </td>
                                                </motion.tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-50">
                                                    <Users className="w-12 h-12" />
                                                    <p className="text-slate-500 font-medium">No users match your search.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
