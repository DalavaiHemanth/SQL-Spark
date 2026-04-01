import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp, ChevronDown, ChevronUp, User } from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

export default function Leaderboard({ teams, currentTeamId }) {
    const sortedTeams = [...teams].sort((a, b) => b.total_score - a.total_score);
    const [expandedTeam, setExpandedTeam] = useState(null);

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
                    sortedTeams.slice(0, 50).map((team, index) => {
                        const rank = index + 1;
                        const style = getRankStyle(rank);
                        const isCurrentTeam = team.id === currentTeamId;
                        const isExpanded = expandedTeam === team.id;
                        const memberScores = team.member_scores || {};
                        const hasMemberScores = Object.keys(memberScores).length > 0;

                        return (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={cn(
                                    "flex flex-col gap-1 p-1 rounded-xl transition-all",
                                    isCurrentTeam ? "bg-emerald-50 ring-2 ring-emerald-500" : "hover:bg-slate-50"
                                )}
                            >
                                <div 
                                    className="flex items-center gap-3 p-2 cursor-pointer"
                                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
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
                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                            <span>{team.challenges_completed || 0} solved</span>
                                            {hasMemberScores && (
                                                <span className="flex items-center gap-0.5 text-violet-500 font-medium">
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    View members
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right pr-1">
                                        <div className="font-bold text-slate-900 leading-tight">{team.total_score || 0}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">pts</div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {isExpanded && hasMemberScores && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-slate-100 mt-1">
                                                {Object.entries(memberScores)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .map(([email, score]) => {
                                                        const member = team.members?.find(m => 
                                                            (typeof m === 'string' && m === email) || 
                                                            (m && typeof m === 'object' && m.email === email)
                                                        );
                                                        const memberName = (member && typeof member === 'object' ? member.name : null) || email.split('@')[0];
                                                        
                                                        return (
                                                            <div key={email} className="flex items-center justify-between text-xs py-1">
                                                                <div className="flex items-center gap-2 text-slate-600 truncate mr-2">
                                                                    <User className="w-3 h-3 text-slate-400" />
                                                                    <span className="truncate">{memberName}</span>
                                                                </div>
                                                                <span className="font-bold text-emerald-600 flex-shrink-0">{score} pts</span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}