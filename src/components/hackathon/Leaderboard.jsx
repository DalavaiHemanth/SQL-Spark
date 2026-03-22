import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';

export default function Leaderboard({ teams, currentTeamId }) {
    const sortedTeams = [...teams].sort((a, b) => b.total_score - a.total_score);

    const getRankStyle = (rank) => {
        switch (rank) {
            case 1: return {
                icon: <Trophy className="w-5 h-5" />,
                bg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
                text: 'text-amber-900',
                glow: 'shadow-amber-200'
            };
            case 2: return {
                icon: <Medal className="w-5 h-5" />,
                bg: 'bg-gradient-to-r from-slate-300 to-slate-400',
                text: 'text-slate-700',
                glow: 'shadow-slate-200'
            };
            case 3: return {
                icon: <Award className="w-5 h-5" />,
                bg: 'bg-gradient-to-r from-amber-600 to-amber-700',
                text: 'text-amber-100',
                glow: 'shadow-amber-200'
            };
            default: return {
                icon: null,
                bg: 'bg-slate-100',
                text: 'text-slate-600',
                glow: ''
            };
        }
    };

    return (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Live Leaderboard
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {sortedTeams.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        No teams have scored yet
                    </div>
                ) : (
                    sortedTeams.slice(0, 10).map((team, index) => {
                        const rank = index + 1;
                        const style = getRankStyle(rank);
                        const isCurrentTeam = team.id === currentTeamId;

                        return (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl transition-all",
                                    isCurrentTeam ? "bg-emerald-50 ring-2 ring-emerald-500" : "hover:bg-slate-50"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg",
                                    style.bg, style.text, style.glow
                                )}>
                                    {style.icon || rank}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-semibold truncate",
                                            isCurrentTeam ? "text-emerald-700" : "text-slate-900"
                                        )}>
                                            {team.name}
                                        </span>
                                        {isCurrentTeam && (
                                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {team.challenges_completed || 0} challenges solved
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-bold text-slate-900">{team.total_score || 0}</div>
                                    <div className="text-xs text-slate-400">points</div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}